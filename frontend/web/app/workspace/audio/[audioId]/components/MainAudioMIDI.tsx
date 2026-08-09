import { useEffect, useState, useRef } from 'react';
import { fetchStorageBlob, triggerBlobDownload } from '@/app/google-firebase/storage';
import type { AudioFileDoc } from '@/app/google-firebase/firestore';
import { useAuth } from '@/app/context/auth-context';
import { triggerMidiConversion } from '@/app/actions/midi';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/app/google-firebase/firestore';


export default function MainAudioMIDI({ audioId, audioDoc }: { audioId: string; audioDoc: AudioFileDoc }) {
    const { user } = useAuth()

    type MidiState = 'idle' | 'confirming' | 'loading' | 'done' | 'error'
    const [midiFilePath, setMidiFilePath] = useState<string | null>(null)
    const [midiError, setMidiError] = useState<string | null>(null)
    const [midiState, setMidiState] = useState<MidiState>('idle')
    const jobUnsubRef = useRef<(() => void) | null>(null);

    const midiPath = audioDoc.filepath.replace(/\.[^.]+$/, '.mid')
    const rawBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
    const gsBucket = rawBucket.startsWith('gs://') ? rawBucket.slice(5) : rawBucket;

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

    const submitMidiJob = async () => {
        setMidiState('loading');
        setMidiError(null);
        try {
            const token = await user?.getIdToken();
            if (!token) throw new Error('Not authenticated.');
            const { jobId } = await triggerMidiConversion({
                token,
                gsBucket,
                filepath: audioDoc.filepath,
                audioId
            })
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
    }

    const handleMidiClick = () => {
        if (midiState === 'idle') {
            // Show confirmation warning before submitting
            setMidiState('confirming');
            return;
        }
        submitMidiJob();
    };

    const handleMidiDownload = async () => {
        if (!midiFilePath) return;
        try {
            const blob = await fetchStorageBlob(midiFilePath);
            triggerBlobDownload(blob, midiFilePath.split('/').pop() || 'output.mid');
        } catch (err) {
            console.error('MIDI download error:', err);
        }
    }

    return (
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
                    className="cursor-pointer rounded-lg border border-outline/30 px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-variant/20 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Convert this audio to MIDI"
                >
                    Generate MIDI
                </button>
            )}

            {midiState === 'error' && midiError && (
                <p className="text-xs text-error">{midiError}</p>
            )}
        </>
    );
}