// Picks real audio files to upload, mirroring the extension/MIME rules the UI enforces.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Same mapping as frontend/web/app/workspace/new-audio/upload-path.tsx — first entry is the canonical type.
const EXTENSION_TO_TYPE = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aiff: 'audio/aiff',
    aif: 'audio/aiff',
};

export function loadFixtures(dir) {
    const files = readdirSync(dir)
        .map((name) => {
            const path = join(dir, name);
            const ext = extname(name).slice(1).toLowerCase();
            return { name, path, ext, contentType: EXTENSION_TO_TYPE[ext] };
        })
        .filter((f) => f.contentType && statSync(f.path).isFile() && statSync(f.path).size <= MAX_FILE_SIZE)
        .sort((a, b) => a.name.localeCompare(b.name));

    if (!files.length) {
        throw new Error(`No usable audio fixtures in ${dir} (need a supported extension and <50MB)`);
    }
    return files;
}

// Assigns a distinct fixture per virtual user where possible, wrapping around if there are more users than files.
export function assignFixtures(fixtures, userCount) {
    return Array.from({ length: userCount }, (_, i) => {
        const fixture = fixtures[i % fixtures.length];
        return { ...fixture, bytes: readFileSync(fixture.path) };
    });
}
