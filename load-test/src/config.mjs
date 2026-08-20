// Loads .env and exposes the resolved configuration for a load-test run.
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '..');

const envPath = resolve(ROOT, '.env');
if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
} else {
    console.error(`No .env found at ${envPath} — copy .env.example and fill it in.`);
    process.exit(1);
}

const required = (name) => {
    const value = process.env[name];
    if (!value) {
        console.error(`Missing required env var: ${name}`);
        process.exit(1);
    }
    return value;
};

const num = (name, fallback) => Number(process.env[name] ?? fallback);

export const config = {
    projectId: required('FIREBASE_PROJECT_ID'),
    // Strip any gs:// prefix so the value works for both the Admin and client SDKs.
    bucket: required('GS_BUCKET').replace(/^gs:\/\//, ''),
    client: {
        apiKey: required('FIREBASE_API_KEY'),
        authDomain: required('FIREBASE_AUTH_DOMAIN'),
        projectId: required('FIREBASE_PROJECT_ID'),
        appId: process.env.FIREBASE_APP_ID,
    },
    topics: {
        midi: process.env.MIDI_PUBSUB_TOPIC || 'midi-topic',
        tabs: process.env.TABS_PUBSUB_TOPIC || 'tabs-topic',
    },
    fixtureDir: resolve(ROOT, process.env.FIXTURE_DIR || '../containerised_functions/Test Audio LUCID/test_samples_wav_only'),
    separationOption: num('SEPARATION_OPTION', 4),
    thinkMs: num('THINK_MS', 2000),
    cooldownMs: num('COOLDOWN_MS', 120000),
    timeouts: {
        validate: num('TIMEOUT_VALIDATE', 120000),
        chords: num('TIMEOUT_CHORDS', 900000),
        fingerprint: num('TIMEOUT_FINGERPRINT', 600000),
        stems: num('TIMEOUT_STEMS', 1800000),
        midi: num('TIMEOUT_MIDI', 900000),
        tabs: num('TIMEOUT_TABS', 600000),
    },
    resultsDir: resolve(ROOT, 'results'),
};

// Test users are created with this prefix so cleanup can find them unambiguously.
export const TEST_UID_PREFIX = 'loadtest-';
export const TEST_EMAIL_DOMAIN = 'loadtest.lucid.invalid';
