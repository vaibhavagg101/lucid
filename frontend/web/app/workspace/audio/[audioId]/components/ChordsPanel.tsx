'use client';

import { useEffect, useState } from 'react';
import { fetchStorageBlob } from '@/app/google-firebase/storage';
import { parseChordsCsv, ChordSegment } from '../utils/parseChordsCsv';

interface ChordsPanelProps {
    chordsCsvPath?: string;
    currentTime: number;
}

export default function ChordsPanel({ chordsCsvPath, currentTime }: ChordsPanelProps) {
    const [segments, setSegments] = useState<ChordSegment[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!chordsCsvPath) return;
        let cancelled = false;

        fetchStorageBlob(chordsCsvPath)
            .then((blob) => blob.text())
            .then((text) => {
                if (!cancelled) setSegments(parseChordsCsv(text));
            })
            .catch((err) => {
                console.error('Error fetching chords CSV:', err);
                if (!cancelled) setError('Failed to load chords.');
            });

        return () => {
            cancelled = true;
        };
    }, [chordsCsvPath]);

    if (!chordsCsvPath) {
        return (
            <div className="mt-8 w-full rounded-2xl border border-outline/30 px-6 py-10 text-center text-sm text-on-surface-variant">
                Chords are still being generated. Check back soon.
            </div>
        );
    }

    if (error) {
        return <p className="mt-8 text-sm text-error">{error}</p>;
    }

    if (!segments) {
        return <p className="mt-8 text-sm text-on-surface-variant">Loading chords...</p>;
    }

    return (
        <div className="mt-8 flex w-full flex-wrap gap-2">
            {segments.map((segment, index) => {
                const active = currentTime >= segment.start && currentTime < segment.end;
                return (
                    <span
                        key={`${segment.start}-${index}`}
                        title={`${segment.start.toFixed(1)}s - ${segment.end.toFixed(1)}s`}
                        className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${active
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-variant text-on-surface-variant'
                            }`}
                    >
                        {segment.chord}
                    </span>
                );
            })}
        </div>
    );
}
