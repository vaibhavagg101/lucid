import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getYoutubeVideoId,
  isValidYoutubeUrl,
  validateYoutubeVideoDuration,
} from './youtube-validation';

// These helpers gate the whole YouTube flow — a bad URL here never reaches
// the yt-dlp service. The duration check is only a first pass; the cloud
// function enforces the same 10-minute limit again server-side.
const VIDEO_ID = 'dQw4w9WgXcQ';

describe('getYoutubeVideoId', () => {
  it('extracts the id from a standard watch URL', () => {
    expect(getYoutubeVideoId(`https://www.youtube.com/watch?v=${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it('extracts the id from a youtu.be short URL', () => {
    expect(getYoutubeVideoId(`https://youtu.be/${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it('extracts the id from a shorts URL', () => {
    expect(getYoutubeVideoId(`https://www.youtube.com/shorts/${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it('extracts the id from an embed URL', () => {
    expect(getYoutubeVideoId(`https://www.youtube.com/embed/${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it('extracts the id from music.youtube.com and mobile hosts', () => {
    expect(getYoutubeVideoId(`https://music.youtube.com/watch?v=${VIDEO_ID}`)).toBe(VIDEO_ID);
    expect(getYoutubeVideoId(`https://m.youtube.com/watch?v=${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it('works without an explicit protocol', () => {
    expect(getYoutubeVideoId(`www.youtube.com/watch?v=${VIDEO_ID}`)).toBe(VIDEO_ID);
  });

  it('ignores extra query parameters', () => {
    expect(getYoutubeVideoId(`https://www.youtube.com/watch?v=${VIDEO_ID}&t=30`)).toBe(VIDEO_ID);
  });

  it('returns null for a watch URL without a video id', () => {
    expect(getYoutubeVideoId('https://www.youtube.com/watch')).toBeNull();
  });

  // Video ids are always 11 characters, so anything else is rejected.
  it('returns null for an incorrectly sized video id', () => {
    expect(getYoutubeVideoId('https://www.youtube.com/watch?v=tooshort')).toBeNull();
    expect(getYoutubeVideoId('https://youtu.be/thisidistoolong123456')).toBeNull();
  });

  it('returns null for non-YouTube hosts and garbage input', () => {
    expect(getYoutubeVideoId('https://vimeo.com/12345')).toBeNull();
    expect(getYoutubeVideoId('https://example.com/watch?v=' + VIDEO_ID)).toBeNull();
    expect(getYoutubeVideoId('not a url')).toBeNull();
    expect(getYoutubeVideoId('')).toBeNull();
    expect(getYoutubeVideoId(null as unknown as string)).toBeNull();
  });
});

describe('isValidYoutubeUrl', () => {
  it('accepts valid YouTube URLs', () => {
    expect(isValidYoutubeUrl(`https://www.youtube.com/watch?v=${VIDEO_ID}`)).toBe(true);
    expect(isValidYoutubeUrl(`https://youtu.be/${VIDEO_ID}`)).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(isValidYoutubeUrl('https://example.com')).toBe(false);
    expect(isValidYoutubeUrl('')).toBe(false);
  });
});

describe('validateYoutubeVideoDuration', () => {
  const fetchMock = vi.fn();
  // Real YouTube pages embed a `ytInitialPlayerResponse` JSON blob with the
  // video metadata; here we fake just enough of that HTML for the parser.
  const playerResponseHtml = (lengthSeconds: string) =>
    `<html><script>var ytInitialPlayerResponse = {"videoDetails":{"lengthSeconds":"${lengthSeconds}"}};</script></html>`;

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('accepts a video within the 10 minute limit', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => playerResponseHtml('300') });
    vi.stubGlobal('fetch', fetchMock);

    const result = await validateYoutubeVideoDuration(`https://www.youtube.com/watch?v=${VIDEO_ID}`);

    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects a video longer than 10 minutes', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => playerResponseHtml('700') });
    vi.stubGlobal('fetch', fetchMock);

    const result = await validateYoutubeVideoDuration(`https://www.youtube.com/watch?v=${VIDEO_ID}`);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('longer than 10 minutes');
  });

  it('returns an error when the fetch fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await validateYoutubeVideoDuration(`https://www.youtube.com/watch?v=${VIDEO_ID}`);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Failed to fetch');
  });

  // The limit is enforced again in the cloud function, so when we can't
  // read the metadata we deliberately let the request through rather than
  // blocking valid videos on a parsing hiccup.
  it('does not fail closed when duration metadata is unavailable', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => '<html><script>var nothingHere = true;</script></html>',
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await validateYoutubeVideoDuration(`https://www.youtube.com/watch?v=${VIDEO_ID}`);

    expect(result.isValid).toBe(true);
    expect(result.error).toBeDefined();
  });

  it('rejects an invalid URL without calling fetch', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await validateYoutubeVideoDuration('https://example.com/not-youtube');

    expect(result.isValid).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
