export interface ChordSegment {
    start: number;
    end: number;
    chord: string;
}

// Parses the `start_time,end_time,chord` CSV produced by the chords container function.
export function parseChordsCsv(csvText: string): ChordSegment[] {
    const lines = csvText.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return [];

    const dataLines = /start_time/i.test(lines[0]) ? lines.slice(1) : lines;

    return dataLines
        .map((line) => {
            const [start, end, chord] = line.split(',');
            return {
                start: parseFloat(start),
                end: parseFloat(end),
                chord: (chord ?? '').trim(),
            };
        })
        .filter((segment) => !Number.isNaN(segment.start) && !Number.isNaN(segment.end));
}
