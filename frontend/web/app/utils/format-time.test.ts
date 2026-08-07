import { describe, expect, it } from 'vitest';
import { formatTime } from './format-time';

describe('formatTime', () => {
  it('formats zero as 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('pads seconds with a leading zero below ten', () => {
    expect(formatTime(9)).toBe('0:09');
  });

  it('does not pad the minutes', () => {
    expect(formatTime(65)).toBe('1:05');
  });

  it('floors fractional seconds', () => {
    expect(formatTime(59.9)).toBe('0:59');
  });

  it('formats times over an hour as raw minutes (no hours rollover)', () => {
    expect(formatTime(3600)).toBe('60:00');
    expect(formatTime(3661)).toBe('61:01');
  });
});
