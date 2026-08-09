'use client';

import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import { formatTime } from '@/app/utils/format-time';
import { triggerBlobDownload } from '@/app/google-firebase/storage';

interface AudioPlayerProps {
    audioBlob: Blob | null;
    downloadName: string;
    onTimeUpdate?: (seconds: number) => void;
}

export default function AudioPlayer({ audioBlob, downloadName, onTimeUpdate }: AudioPlayerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const waveRef = useRef<WaveSurfer | null>(null);
    const [playing, setPlaying] = useState(false);
    const [durationStr, setDurationStr] = useState('0:00');

    useEffect(() => {
        if (!containerRef.current || !audioBlob) return;

        const zoom = ZoomPlugin.create({
            scale: 0.5,
            maxZoom: 1000,
        });

        const wave = WaveSurfer.create({
            container: containerRef.current,
            height: 100,
            waveColor: 'rgb(0, 188, 212)',
            progressColor: 'rgb(10, 15, 40)',
            plugins: [zoom],
        });

        wave.on('ready', () => setDurationStr(formatTime(wave.getDuration())));
        wave.on('play', () => setPlaying(true));
        wave.on('pause', () => setPlaying(false));
        wave.on('timeupdate', (time) => onTimeUpdate?.(time));

        wave.loadBlob(audioBlob);
        waveRef.current = wave;

        return () => {
            wave.destroy();
            waveRef.current = null;
        };
    }, [audioBlob]);

    const handleDownload = () => {
        if (audioBlob) triggerBlobDownload(audioBlob, downloadName);
    };

    if (!audioBlob) {
        return (
            <div className="flex w-full items-center justify-center rounded-2xl border border-outline/30 bg-background py-12 text-sm text-on-surface-variant">
                Loading audio...
            </div>
        );
    }

    return (
        <div className="w-full rounded-3xl border border-outline/30 p-6 md:p-8">
            <div
                ref={containerRef}
                className="w-full overflow-hidden rounded-2xl border border-outline/30 bg-background touch-pan-y"
            ></div>

            <div className="mt-3 flex w-full justify-between px-1 text-xs font-medium text-on-surface">
                <span>0:00</span>
                <span>{durationStr}</span>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
                <button
                    onClick={() => waveRef.current?.playPause()}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-primary text-on-primary transition-colors hover:bg-primary-variant"
                    aria-label={playing ? 'Pause audio' : 'Play audio'}
                >
                    {playing ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                            <path d="M6.75 5.25A.75.75 0 017.5 4.5h2.25a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm6.75 0a.75.75 0 01.75-.75h2.25a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-2.25a.75.75 0 01-.75-.75V5.25z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                            <path d="M8.25 5.25v13.5L18.75 12 8.25 5.25z" />
                        </svg>
                    )}
                </button>

                <button
                    onClick={handleDownload}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-surface-variant text-primary transition-colors hover:bg-outline/20"
                    aria-label="Download audio"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.8}
                        stroke="currentColor"
                        className="h-5 w-5"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 3v12m0 0l-4-4m4 4l4-4M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}
