/**
 * Extracts the 11-character YouTube video ID from a URL.
 * Returns the video ID string if valid, or null if invalid or not found.
 */
export function getYoutubeVideoId(url: string): string | null {
    if (!url) return null;
    try {
        // Ensure url has a protocol, otherwise URL parser fails
        const urlWithProtocol = url.match(/^https?:\/\//i) ? url : `https://${url}`;
        const parsed = new URL(urlWithProtocol);
        const host = parsed.hostname.replace(/^(www\.|m\.)/, '');
        
        if (host === 'youtube.com' || host === 'music.youtube.com') {
            // Check for search params
            if (parsed.pathname === '/watch') {
                const videoId = parsed.searchParams.get('v');
                return (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) ? videoId : null;
            }
            // Check for embed or shorts path
            const pathParts = parsed.pathname.split('/'); // e.g. ["", "shorts", "VIDEO_ID"]
            if (pathParts[1] === 'embed' || pathParts[1] === 'shorts') {
                const videoId = pathParts[2];
                return (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) ? videoId : null;
            }
            return null;
        } else if (host === 'youtu.be') {
            const videoId = parsed.pathname.substring(1); // remove leading slash
            return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Validates whether a given string is a valid YouTube URL (supporting watch, embed, shorts, and youtu.be links).
 * Extends to music.youtube.com as well.
 * Returns true if valid, false otherwise.
 */
export function isValidYoutubeUrl(url: string): boolean {
    return getYoutubeVideoId(url) !== null;
}

/**
 * Validates the duration of a YouTube video by fetching its public metadata.
 * Returns an object indicating whether the video is valid and within the 10-minute limit.
 */
export async function validateYoutubeVideoDuration(url: string): Promise<{ isValid: boolean; error?: string }> {
    const videoId = getYoutubeVideoId(url);
    if (!videoId) {
        return { isValid: false, error: "Invalid YouTube URL format." };
    }

    try {
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) {
            return { isValid: false, error: "Failed to fetch YouTube video details." };
        }
        const html = await response.text();
        
        // Match ytInitialPlayerResponse JSON object in the page source
        const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        let dataString = '';
        if (match) {
            dataString = match[1];
        } else {
            // Check alternative match formats
            const altMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*(?:<\/script>|;)/);
            if (altMatch) {
                dataString = altMatch[1];
            }
        }

        if (!dataString) {
            return { isValid: true, error: "Unable to retrieve video duration metadata." };
        }

        const data = JSON.parse(dataString);
        const lengthSecondsStr = data?.videoDetails?.lengthSeconds;
        if (!lengthSecondsStr) {
            return { isValid: true, error: "Unable to find video duration." };
        }

        const lengthSeconds = parseInt(lengthSecondsStr, 10);
        if (isNaN(lengthSeconds)) {
            return { isValid: true, error: "Invalid video duration format." };
        }

        if (lengthSeconds > 600) {
            return { isValid: false, error: "Video is longer than 10 minutes." };
        }

        return { isValid: true };
    } catch (e) {
        console.error("Error validating YouTube video duration:", e);
        return { isValid: true, error: "Error validating YouTube video duration." };
    }
}

