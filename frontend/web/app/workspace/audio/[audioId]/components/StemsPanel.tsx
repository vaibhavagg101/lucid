'use client';

import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import { fetchStorageBlob, triggerBlobDownload } from '@/app/google-firebase/storage';
import { useAuth } from '@/app/context/auth-context';
import { triggerMidiConversion } from '@/app/actions/midi';
import { triggerTabsConversion } from '@/app/actions/tabs';
import { db } from '@/app/google-firebase/firestore';
import { onSnapshot, doc } from 'firebase/firestore';

interface StemsPanelProps {
    separatedFiles?: string[];
    separationOption: number;
    separationStatus?: string;
    audioId: string;
}

function stemLabel(path: string) {
    const base = path.split('/').pop() || path;
    const name = base.split('.').slice(0, -1).join('.') || base;
    return name.charAt(0).toUpperCase() + name.slice(1);
}

// Stems eligible for MIDI conversion (single-instrument signals).
// "other" / "no_vocals" are allowed but with a warning.
const MIDI_ELIGIBLE = ['vocals', 'guitar', 'piano', 'bass', 'other', 'no_vocals'];
const MIDI_WARN_OTHER = ['other', 'no_vocals'];

function isMidiEligible(path: string): boolean {
    const base = (path.split('/').pop() || path).split('.')[0].toLowerCase();
    return MIDI_ELIGIBLE.includes(base);
}

function isMidiOther(path: string): boolean {
    const base = (path.split('/').pop() || path).split('.')[0].toLowerCase();
    return MIDI_WARN_OTHER.includes(base);
}

// Stems eligible for Tabs conversion: vocals, guitar, other, no_vocals.
const TABS_ELIGIBLE = ['vocals', 'guitar', 'other', 'no_vocals'];
const TABS_WARN_OTHER = ['other', 'no_vocals'];

function isTabsEligible(path: string): boolean {
    const base = (path.split('/').pop() || path).split('.')[0].toLowerCase();
    return TABS_ELIGIBLE.includes(base);
}

function isTabsOther(path: string): boolean {
    const base = (path.split('/').pop() || path).split('.')[0].toLowerCase();
    return TABS_WARN_OTHER.includes(base);
}

// iOS Safari silently fails (blank waveform, no error) when several WaveSurfer
// instances decode audio via Web Audio at the same time, so stems must load one at a time.
let stemLoadQueue: Promise<unknown> = Promise.resolve();

function queueStemLoad<T>(task: () => Promise<T>): Promise<T> {
    const run = stemLoadQueue.then(task, task);
    stemLoadQueue = run.then(
        () => undefined,
        () => undefined
    );
    return run;
}

type JobState = 'idle' | 'confirming' | 'loading' | 'done' | 'error';

function StemRow({
    path,
    audioId,
    gsBucket,
}: {
    path: string;
    audioId: string;
    gsBucket: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const waveRef = useRef<WaveSurfer | null>(null);
    const [blob, setBlob] = useState<Blob | null>(null);
    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { user } = useAuth();

    // MIDI State
    const [midiState, setMidiState] = useState<JobState>('idle');
    const [midiError, setMidiError] = useState<string | null>(null);
    const [midiFilePath, setMidiFilePath] = useState<string | null>(null);
    const jobUnsubRef = useRef<(() => void) | null>(null);

    // Tabs State
    const [tabsState, setTabsState] = useState<JobState>('idle');
    const [tabsError, setTabsError] = useState<string | null>(null);
    const [tabsFilePath, setTabsFilePath] = useState<string | null>(null);
    const tabsJobUnsubRef = useRef<(() => void) | null>(null);

    const midiEligible = isMidiEligible(path);
    const midiOther = isMidiOther(path);

    const tabsEligible = isTabsEligible(path);
    const tabsOther = isTabsOther(path);

    // Derive expected MIDI and Tabs paths (.mid and .txt)
    const midiPath = path.replace(/\.[^.]+$/, '.mid');
    const tabsPath = path.replace(/\.[^.]+$/, '.txt');

    // Subscribe to the audio doc and check midi_files for the .mid path.
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'audio_files', audioId), (docSnap) => {
            if (!docSnap.exists()) return;
            const midiFiles: string[] | undefined = docSnap.data().midi_files;
            if (midiFiles?.includes(midiPath)) {
                setMidiFilePath(midiPath);
                setMidiState('done');
                jobUnsubRef.current?.();
                jobUnsubRef.current = null;
            }
        });
        return () => unsub();
    }, [audioId, midiPath]);

    // Subscribe to the audio doc and check tabs_files for the .txt path.
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'audio_files', audioId), (docSnap) => {
            if (!docSnap.exists()) return;
            const tabsFiles: string[] | undefined = docSnap.data().tabs_files;
            if (tabsFiles?.includes(tabsPath)) {
                setTabsFilePath(tabsPath);
                setTabsState('done');
                tabsJobUnsubRef.current?.();
                tabsJobUnsubRef.current = null;
            }
        });
        return () => unsub();
    }, [audioId, tabsPath]);

    // Cleanup job snapshot subscriptions on unmount.
    useEffect(() => {
        return () => {
            jobUnsubRef.current?.();
            tabsJobUnsubRef.current?.();
        };
    }, []);

    // Auto-fetch and load the stem as soon as it mounts, no user action required.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        fetchStorageBlob(path)
            .then((fetched) => {
                if (!cancelled) setBlob(fetched);
            })
            .catch((err) => {
                console.error('Error fetching stem:', err);
                if (!cancelled) setError('Failed to load stem.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [path]);

    useEffect(() => {
        if (!containerRef.current || !blob) return;

        let cancelled = false;
        const zoom = ZoomPlugin.create({
            scale: 0.5,
            maxZoom: 1000,
        });

        const wave = WaveSurfer.create({
            container: containerRef.current,
            height: 60,
            waveColor: 'rgb(0, 188, 212)',
            progressColor: 'rgb(10, 15, 40)',
            plugins: [zoom],
        });

        wave.on('play', () => setPlaying(true));
        wave.on('pause', () => setPlaying(false));
        wave.on('error', (err) => {
            console.error('Error decoding stem waveform:', err);
            if (!cancelled) setError('Failed to load stem.');
        });
        waveRef.current = wave;

        queueStemLoad(() => (cancelled ? Promise.resolve() : wave.loadBlob(blob))).catch((err) => {
            console.error('Error loading stem waveform:', err);
            if (!cancelled) setError('Failed to load stem.');
        });

        return () => {
            cancelled = true;
            wave.destroy();
            waveRef.current = null;
        };
    }, [blob]);

    const handleDownload = () => {
        if (blob) triggerBlobDownload(blob, path.split('/').pop() || 'stem');
    };

    const handleMidiClick = () => {
        if (midiOther && midiState === 'idle') {
            // Show confirmation warning before submitting
            setMidiState('confirming');
            return;
        }
        submitMidiJob();
    };

    const submitMidiJob = async () => {
        setMidiState('loading');
        setMidiError(null);
        try {
            const token = await user?.getIdToken();
            if (!token) throw new Error('Not authenticated.');
            const { jobId } = await triggerMidiConversion({
                token,
                gsBucket,
                filepath: path,
                audioId,
            });
            // Watch the job doc for failure only — success is detected via the audio doc listener above.
            jobUnsubRef.current?.();
            const unsub = onSnapshot(doc(db, 'jobs', jobId), (docSnap) => {
                if (!docSnap.exists()) return;
                const data = docSnap.data();
                if (data.status === 'failed') {
                    setMidiError('MIDI conversion failed.');
                    setMidiState('error');
                    unsub();
                    jobUnsubRef.current = null;
                }
            });
            jobUnsubRef.current = unsub;
        } catch (err) {
            console.error('MIDI conversion error:', err);
            setMidiError('Failed to start MIDI conversion.');
            setMidiState('error');
        }
    };

    const handleMidiDownload = async () => {
        if (!midiFilePath) return;
        try {
            const blob = await fetchStorageBlob(midiFilePath);
            triggerBlobDownload(blob, midiFilePath.split('/').pop() || 'output.mid');
        } catch (err) {
            console.error('MIDI download error:', err);
        }
    };

    const handleTabsClick = () => {
        if (tabsOther && tabsState === 'idle') {
            // Show confirmation warning before submitting
            setTabsState('confirming');
            return;
        }
        submitTabsJob();
    };

    const submitTabsJob = async () => {
        setTabsState('loading');
        setTabsError(null);
        try {
            const token = await user?.getIdToken();
            if (!token) throw new Error('Not authenticated.');
            if (!midiFilePath) throw new Error('MIDI required for tabs.');
            const { jobId } = await triggerTabsConversion({
                token,
                gsBucket,
                filepath: midiFilePath,
                audioId,
            });
            // Watch the job doc for failure only — success is detected via the audio doc listener above.
            tabsJobUnsubRef.current?.();
            const unsub = onSnapshot(doc(db, 'jobs', jobId), (docSnap) => {
                if (!docSnap.exists()) return;
                const data = docSnap.data();
                if (data.status === 'failed') {
                    setTabsError('Tabs conversion failed.');
                    setTabsState('error');
                    unsub();
                    tabsJobUnsubRef.current = null;
                }
            });
            tabsJobUnsubRef.current = unsub;
        } catch (err) {
            console.error('Tabs conversion error:', err);
            setTabsError('Failed to start Tabs conversion.');
            setTabsState('error');
        }
    };

    const handleTabsDownload = async () => {
        if (!tabsFilePath) return;
        try {
            const blob = await fetchStorageBlob(tabsFilePath);
            triggerBlobDownload(blob, tabsFilePath.split('/').pop() || 'output.txt');
        } catch (err) {
            console.error('Tabs download error:', err);
        }
    };

    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-outline/30 px-5 py-4">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-base font-semibold text-on-surface">{stemLabel(path)}</p>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Play / Pause */}
                    <button
                        onClick={() => waveRef.current?.playPause()}
                        disabled={!blob}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-primary text-on-primary transition-colors hover:bg-primary-variant disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={playing ? 'Pause stem' : 'Play stem'}
                    >
                        {playing ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                <path d="M6.75 5.25A.75.75 0 017.5 4.5h2.25a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm6.75 0a.75.75 0 01.75-.75h2.25a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-2.25a.75.75 0 01-.75-.75V5.25z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                <path d="M8.25 5.25v13.5L18.75 12 8.25 5.25z" />
                            </svg>
                        )}
                    </button>

                    {/* Download */}
                    <button
                        onClick={handleDownload}
                        disabled={!blob}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-outline/30 text-on-surface transition-colors hover:bg-surface-variant/20 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Download stem"
                        title="Download"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                        </svg>
                    </button>

                    {/* MIDI conversion — only for eligible stems */}
                    {midiEligible && (
                        <>
                            {midiFilePath ? (
                                /* File exists in GCS — always show Download MIDI */
                                <button
                                    onClick={handleMidiDownload}
                                    className="cursor-pointer rounded-lg border border-outline/30 px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-variant/20"
                                    title="Download MIDI file"
                                >
                                    Download MIDI
                                </button>
                            ) : midiState === 'loading' ? (
                                /* Job is running — show Loading... */
                                <button
                                    disabled
                                    className="cursor-not-allowed rounded-lg border border-outline/30 px-4 py-2 text-sm font-medium text-on-surface opacity-50"
                                >
                                    Loading...
                                </button>
                            ) : (
                                /* No job yet — show MIDI trigger button */
                                <button
                                    onClick={handleMidiClick}
                                    disabled={!blob}
                                    className="cursor-pointer rounded-lg border border-outline/30 px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-variant/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    title="Convert this stem to MIDI"
                                >
                                    MIDI
                                </button>
                            )}
                        </>
                    )}

                    {/* Tabs conversion — only for vocals, guitar, other, no_vocals stems when MIDI is ready */}
                    {tabsEligible && midiFilePath && (
                        <>
                            {tabsFilePath ? (
                                /* File exists in GCS — always show Download Tabs */
                                <button
                                    onClick={handleTabsDownload}
                                    className="cursor-pointer rounded-lg border border-outline/30 px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-variant/20"
                                    title="Download Tabs file"
                                >
                                    Download Tabs
                                </button>
                            ) : tabsState === 'loading' ? (
                                /* Job is running — show Loading... */
                                <button
                                    disabled
                                    className="cursor-not-allowed rounded-lg border border-outline/30 px-4 py-2 text-sm font-medium text-on-surface opacity-50"
                                >
                                    Loading...
                                </button>
                            ) : (
                                /* No job yet — show Tabs trigger button */
                                <button
                                    onClick={handleTabsClick}
                                    disabled={!blob}
                                    className="cursor-pointer rounded-lg border border-outline/30 px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-variant/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    title="Convert this stem to Tabs"
                                >
                                    Generate Tabs
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Warning + confirm for "other" / "no_vocals" stems (MIDI) */}
            {midiState === 'confirming' && (
                <div className="flex flex-col gap-2 rounded-xl border bg-tertiary-container px-4 py-3">
                    <p className="text-xs font-medium text-on-surface">
                        Best results require a single instrument
                    </p>
                    <p className="text-xs text-on-surface-variant">
                        The &ldquo;{stemLabel(path)}&rdquo; stem may contain multiple mixed instruments. MIDI
                        conversion works best on isolated stems. Proceed only if this
                        stem contains a single instrument.
                    </p>
                    <div className="mt-1 flex gap-2">
                        <button
                            onClick={submitMidiJob}
                            className="cursor-pointer rounded-lg bg-tertiary-container px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-tertiary"
                        >
                            Convert anyway
                        </button>
                        <button
                            onClick={() => setMidiState('idle')}
                            className="cursor-pointer rounded-lg border border-outline/30 px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:text-on-surface"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Warning + confirm for "other" / "no_vocals" stems (Tabs) */}
            {tabsState === 'confirming' && (
                <div className="flex flex-col gap-2 rounded-xl border bg-tertiary-container px-4 py-3">
                    <p className="text-xs font-medium text-on-surface">
                        Best results require guitar-like audio
                    </p>
                    <p className="text-xs text-on-surface-variant">
                        The &ldquo;{stemLabel(path)}&rdquo; stem may contain multiple mixed instruments. Tab
                        conversion works best on guitar-like audio. Proceed only if this
                        stem contains guitar-like sound.
                    </p>
                    <div className="mt-1 flex gap-2">
                        <button
                            onClick={submitTabsJob}
                            className="cursor-pointer rounded-lg bg-tertiary-container px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-tertiary"
                        >
                            Convert anyway
                        </button>
                        <button
                            onClick={() => setTabsState('idle')}
                            className="cursor-pointer rounded-lg border border-outline/30 px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:text-on-surface"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {midiState === 'error' && midiError && (
                <p className="text-xs text-error">{midiError}</p>
            )}

            {tabsState === 'error' && tabsError && (
                <p className="text-xs text-error">{tabsError}</p>
            )}

            <div
                ref={containerRef}
                className="w-full overflow-hidden rounded-xl border border-outline/30 bg-background touch-pan-y"
            />

            {loading && <p className="text-xs text-on-surface-variant">Loading stem...</p>}
            {error && <p className="text-xs text-error">{error}</p>}
        </div>
    );
}

export default function StemsPanel({ separatedFiles, separationOption, separationStatus, audioId }: StemsPanelProps) {
    // Derive the GCS bucket from the env var (strip gs:// prefix if present)
    const rawBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
    const gsBucket = rawBucket.startsWith('gs://') ? rawBucket.slice(5) : rawBucket;

    if (!separationOption) {
        return (
            <div className="mt-8 w-full rounded-2xl border border-outline/30 px-6 py-10 text-center text-sm text-on-surface-variant">
                Stem separation was not requested for this audio file.
            </div>
        );
    }

    if (!separatedFiles || separatedFiles.length === 0) {
        return (
            <div className="mt-8 w-full rounded-2xl border border-outline/30 px-6 py-10 text-center text-sm text-on-surface-variant">
                {separationStatus === 'completed'
                    ? 'No stems were produced.'
                    : 'Stems are still being generated. Check back soon.'}
            </div>
        );
    }

    return (
        <div className="mt-8 flex w-full flex-col gap-3">
            {separatedFiles.map((path) => (
                <StemRow
                    key={path}
                    path={path}
                    audioId={audioId}
                    gsBucket={gsBucket}
                />
            ))}
        </div>
    );
}

