// Drives one virtual user through the full LUCID pipeline, recording a duration for every stage.
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { config } from './config.mjs';
export { STAGE_ORDER } from './stages.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Resolves once the document satisfies `predicate`, or rejects on timeout — the same
// onSnapshot mechanism the workspace UI uses to watch for background results.
function waitForDoc(docRef, predicate, timeoutMs, label) {
    return new Promise((resolve, reject) => {
        let unsub = () => { };
        const timer = setTimeout(() => {
            unsub();
            reject(new Error(`timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${label}`));
        }, timeoutMs);
        unsub = onSnapshot(
            docRef,
            (snap) => {
                if (!snap.exists()) return;
                const data = snap.data();
                if (predicate(data)) {
                    clearTimeout(timer);
                    unsub();
                    resolve(data);
                }
            },
            (err) => {
                clearTimeout(timer);
                unsub();
                reject(err);
            },
        );
    });
}

// Records a stage's wall-clock duration whether it succeeds or fails.
function makeRecorder(stages) {
    return async function stage(name, fn, startedAt = Date.now()) {
        try {
            const value = await fn();
            stages.push({ stage: name, ms: Date.now() - startedAt, ok: true });
            return value;
        } catch (err) {
            stages.push({ stage: name, ms: Date.now() - startedAt, ok: false, error: err.message });
            throw err;
        }
    };
}

// Replicates what the `triggerMidiConversion` / `triggerTabsConversion` server actions publish.
// NOTE: this goes straight to Pub/Sub, so it exercises the container but not the Next.js action itself.
async function publishJob(admin, topicName, uid, filepath, audioId) {
    const jobRef = await admin.db.collection('jobs').add({
        userid: uid,
        status: 'processing',
        filepath,
        createdAt: new Date(),
    });
    const payload = { jobId: jobRef.id, gsBucket: config.bucket, filepath, audioId };
    await admin.pubsub.topic(topicName).publishMessage({ data: Buffer.from(JSON.stringify(payload)) });
    return jobRef.id;
}

export async function runVirtualUser({ user, fixture, admin, waveSize }) {
    const stages = [];
    const stage = makeRecorder(stages);
    const result = { uid: user.uid, index: user.index, fixture: fixture.name, waveSize, stages, audioId: null, ok: false };
    const startedAt = Date.now();

    // Each virtual user gets its own Firebase app so their auth states stay independent.
    const app = initializeApp(config.client, `vu-${waveSize}-${user.index}-${Date.now()}`);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const storage = getStorage(app, `gs://${config.bucket}`);

    try {
        await stage('signin', () => signInWithCustomToken(auth, user.token));

        const audioId = doc(collection(db, 'audio_files')).id;
        result.audioId = audioId;
        const filepath = `${user.uid}/audio/${audioId}.${fixture.ext}`;
        const audioDocRef = doc(collection(db, 'audio_files'), audioId);

        // 1. Upload to Storage. contentType matters: validateAudioFile feeds it to music-metadata.
        await stage('upload', () =>
            uploadBytes(ref(storage, filepath), fixture.bytes, { contentType: fixture.contentType }),
        );

        // 2. Create the Firestore doc, which is what fires validateAudioFile.
        await stage('create-doc', () =>
            setDoc(audioDocRef, {
                id: audioId,
                filename: fixture.name.split('.').at(0) || fixture.name,
                filetype: fixture.ext,
                userId: user.uid,
                filepath,
                uploadedAt: new Date(),
                usingNoiseReduced: null,
                separationOption: 0,
                bpm: null,
                key: null,
            }),
        );

        // 3. Wait for validateAudioFile to stamp the doc.
        const validated = await stage('validate', () =>
            waitForDoc(audioDocRef, (d) => d.validated !== undefined, config.timeouts.validate, 'validated'),
        );
        if (validated.validated !== true) throw new Error('file failed validation');

        // 4. Decline noise reduction, which is what fires backgroundAudioProcessing (chords + fingerprint).
        await stage('nr-decision', () => updateDoc(audioDocRef, { usingNoiseReduced: false }));
        const backgroundStartedAt = Date.now();

        // The UI lets the user pick a stem option a moment later; that update fires triggerStemsCreation.
        await sleep(config.thinkMs);
        await stage('separation-request', () => updateDoc(audioDocRef, { separationOption: config.separationOption }));
        const stemsStartedAt = Date.now();

        // 5. Chords, fingerprint and stems all run concurrently from here.
        const [, , stemsDoc] = await Promise.all([
            stage(
                'chords',
                () =>
                    waitForDoc(
                        audioDocRef,
                        (d) => d.bpm != null && d.key != null && d.chords_csv_filepath,
                        config.timeouts.chords,
                        'chords/key/bpm',
                    ),
                backgroundStartedAt,
            ),
            stage(
                'fingerprint',
                () =>
                    waitForDoc(audioDocRef, (d) => d.fingerprint_image_path, config.timeouts.fingerprint, 'fingerprint'),
                backgroundStartedAt,
            ),
            stage(
                'stems',
                async () => {
                    // 'failed' is terminal too — waiting out the full timeout would tell us nothing.
                    const d = await waitForDoc(
                        audioDocRef,
                        (doc) =>
                            (doc.separation_status === 'completed' && Array.isArray(doc.separated_files)) ||
                            doc.separation_status === 'failed',
                        config.timeouts.stems,
                        'stem separation',
                    );
                    if (d.separation_status === 'failed') throw new Error('stem separation reported failed');
                    return d;
                },
                stemsStartedAt,
            ),
        ]);
        result.separatedFileCount = stemsDoc.separated_files?.length ?? 0;

        // 6. MIDI, then tabs from the MIDI output — the order the audio workspace enforces.
        const midiJob = await stage('midi', async () => {
            const jobId = await publishJob(admin, config.topics.midi, user.uid, filepath, audioId);
            const job = await waitForDoc(
                doc(collection(db, 'jobs'), jobId),
                (d) => d.status === 'completed' || d.status === 'failed',
                config.timeouts.midi,
                'midi job',
            );
            if (job.status === 'failed') throw new Error(`midi job failed: ${job.error}`);
            return job;
        });

        await stage('tabs', async () => {
            const jobId = await publishJob(admin, config.topics.tabs, user.uid, midiJob.midi_filepath, audioId);
            const job = await waitForDoc(
                doc(collection(db, 'jobs'), jobId),
                (d) => d.status === 'completed' || d.status === 'failed',
                config.timeouts.tabs,
                'tabs job',
            );
            if (job.status === 'failed') throw new Error(`tabs job failed: ${job.error}`);
            return job;
        });

        result.ok = true;
    } catch (err) {
        result.error = err.message;
    } finally {
        result.totalMs = Date.now() - startedAt;
        await deleteApp(app).catch(() => { });
    }

    return result;
}

