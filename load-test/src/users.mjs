// Creates (or reuses) the synthetic test users and mints the custom tokens the virtual users sign in with.
import { initializeApp as initAdminApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { PubSub } from '@google-cloud/pubsub';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config, ROOT, TEST_UID_PREFIX, TEST_EMAIL_DOMAIN } from './config.mjs';

export function initAdmin() {
    if (!getApps().length) {
        const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        const resolved = keyPath ? resolve(ROOT, keyPath) : null;
        if (resolved && !existsSync(resolved)) {
            console.error(`GOOGLE_APPLICATION_CREDENTIALS points at ${resolved}, which does not exist.`);
            console.error('Put the staging service-account key there, or unset it to use application default credentials.');
            process.exit(1);
        }
        initAdminApp({
            credential: resolved ? cert(resolved) : applicationDefault(),
            projectId: config.projectId,
            storageBucket: config.bucket,
        });
    }
    return {
        auth: getAuth(),
        db: getFirestore(),
        bucket: getStorage().bucket(config.bucket),
        pubsub: new PubSub({ projectId: config.projectId }),
    };
}

export const testUid = (index) => `${TEST_UID_PREFIX}${index}`;

// Read-only credential check used by --dry-run: proves the key can reach Auth, Firestore and
// Storage without creating anything.
export async function checkAdminAccess(admin) {
    const checks = [];
    const probe = async (label, fn) => {
        try {
            await fn();
            checks.push({ label, ok: true });
        } catch (err) {
            checks.push({ label, ok: false, error: err.message });
        }
    };
    await probe('auth (list users)', () => admin.auth.listUsers(1));
    await probe('firestore (read audio_files)', () => admin.db.collection('audio_files').limit(1).get());
    await probe('storage (list bucket)', () => admin.bucket.getFiles({ maxResults: 1 }));
    for (const [name, topic] of Object.entries(config.topics)) {
        await probe(`pubsub topic ${name} (${topic})`, async () => {
            // roles/pubsub.publisher grants topics.publish but NOT topics.get, so exists() gets
            // denied on topics we can publish to perfectly well. Ask IAM about the permission
            // the harness actually uses instead.
            const [permissions] = await admin.pubsub.topic(topic).iam.testPermissions(['pubsub.topics.publish']);
            if (!permissions['pubsub.topics.publish']) {
                throw new Error('service account cannot publish to this topic');
            }
        });
    }
    return checks;
}

// Creating the user through the Admin SDK also fires the real onNewUserSignIn trigger, so the
// users/{uid} document this test relies on is produced by the app itself, not by the harness.
export async function ensureTestUsers(admin, count) {
    const users = [];
    for (let i = 0; i < count; i++) {
        const uid = testUid(i);
        try {
            await admin.auth.getUser(uid);
        } catch (err) {
            if (err.code !== 'auth/user-not-found') throw err;
            await admin.auth.createUser({
                uid,
                email: `${uid}@${TEST_EMAIL_DOMAIN}`,
                displayName: `Load Test User ${i}`,
                password: `lt-${Math.random().toString(36).slice(2)}A1!`,
            });
            // Give onNewUserSignIn a moment to write users/{uid} before the run starts.
            await new Promise((r) => setTimeout(r, 1500));
        }
        users.push({ index: i, uid, token: await admin.auth.createCustomToken(uid) });
    }
    return users;
}
