'use client';

import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { fetchStorageBlob, triggerBlobDownload } from '@/app/google-firebase/storage';

interface StemsPanelProps {
    separatedFiles?: string[];
    separationOption: number;
    separationStatus?: string;
}

function stemLabel(path: string) {
    const base = path.split('/').pop() || path;
    const name = base.split('.').slice(0, -1).join('.') || base;
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function StemRow({ path }: { path: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const waveRef = useRef<WaveSurfer | null>(null);
    const [blob, setBlob] = useState<Blob | null>(null);
    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

        const wave = WaveSurfer.create({
            container: containerRef.current,
            height: 60,
            waveColor: 'rgb(0, 188, 212)',
            progressColor: 'rgb(10, 15, 40)',
        });

        wave.on('play', () => setPlaying(true));
        wave.on('pause', () => setPlaying(false));
        wave.loadBlob(blob);
        waveRef.current = wave;

        return () => {
            wave.destroy();
            waveRef.current = null;
        };
    }, [blob]);

    const handleDownload = () => {
        if (blob) triggerBlobDownload(blob, path.split('/').pop() || 'stem');
    };

    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-outline/30 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-on-surface">{stemLabel(path)}</p>

                <div className="flex items-center gap-2">
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

                    <button
                        onClick={handleDownload}
                        disabled={!blob}
                        className="cursor-pointer rounded-lg border border-outline/30 px-4 py-2 text-sm font-medium text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Download
                    </button>
                </div>
            </div>

            <div
                ref={containerRef}
                className="w-full overflow-hidden rounded-xl border border-outline/30 bg-background"
            />

            {loading && <p className="text-xs text-on-surface-variant">Loading stem...</p>}
            {error && <p className="text-xs text-error">{error}</p>}
        </div>
    );
}

export default function StemsPanel({ separatedFiles, separationOption, separationStatus }: StemsPanelProps) {
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
                <StemRow key={path} path={path} />
            ))}
        </div>
    );
}
