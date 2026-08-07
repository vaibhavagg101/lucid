import { describe, expect, it } from 'vitest';
import { parseChordsCsv } from './parseChordsCsv';

// The chords container writes a start_time,end_time,chord CSV to GCS after
// running the ISMIR2019 model. The Chords panel parses it with this helper
// and renders the segments, so the parsed shape has to match exactly.
describe('parseChordsCsv', () => {
  it('parses a CSV with a header row', () => {
    const csv = [
      'start_time,end_time,chord',
      '0.0,2.5,C',
      '2.5,5.0,G',
      '5.0,8.0,Am',
    ].join('\n');

    expect(parseChordsCsv(csv)).toEqual([
      { start: 0, end: 2.5, chord: 'C' },
      { start: 2.5, end: 5, chord: 'G' },
      { start: 5, end: 8, chord: 'Am' },
    ]);
  });

  // The parser tolerates header-less files too, just in case.
  it('parses a CSV without a header row', () => {
    const csv = ['0.0,2.5,C:maj', '2.5,5.0,G:7'].join('\n');

    expect(parseChordsCsv(csv)).toEqual([
      { start: 0, end: 2.5, chord: 'C:maj' },
      { start: 2.5, end: 5, chord: 'G:7' },
    ]);
  });

  it('trims whitespace from chord names', () => {
    const csv = 'start_time,end_time,chord\n0.0,2.5,  C  \n';

    expect(parseChordsCsv(csv)).toEqual([{ start: 0, end: 2.5, chord: 'C' }]);
  });

  // A corrupt row shouldn't blow up the whole panel, just be skipped.
  it('filters out rows with non-numeric timestamps', () => {
    const csv = [
      'start_time,end_time,chord',
      '0.0,2.5,C',
      'abc,def,invalid',
      '3.0,4.0,G',
    ].join('\n');

    expect(parseChordsCsv(csv)).toEqual([
      { start: 0, end: 2.5, chord: 'C' },
      { start: 3, end: 4, chord: 'G' },
    ]);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseChordsCsv('')).toEqual([]);
    expect(parseChordsCsv('   \n\n')).toEqual([]);
  });

  it('returns an empty array for a header-only CSV', () => {
    expect(parseChordsCsv('start_time,end_time,chord')).toEqual([]);
  });
});
