// Read-only view of what the test users currently have in Firestore — which pipeline stages have
// landed and which are still outstanding. Useful mid-run, or after a run is interrupted.
import { initAdmin, testUid } from './src/users.mjs';

const MAX_USERS = 9;
const age = (ts) => (ts ? `${Math.round((Date.now() - ts.toDate().getTime()) / 1000)}s ago` : '-');

async function main() {
    const admin = initAdmin();
    const uids = Array.from({ length: MAX_USERS }, (_, i) => testUid(i));

    let found = 0;
    for (const uid of uids) {
        const audioDocs = await admin.db.collection('audio_files').where('userId', '==', uid).get();
        if (audioDocs.empty) continue;
        found += audioDocs.size;

        for (const doc of audioDocs.docs) {
            const d = doc.data();
            const done = [
                d.validated === true && 'validated',
                d.usingNoiseReduced !== null && 'nr-decided',
                d.bpm != null && d.key != null && d.chords_csv_filepath && 'chords',
                d.fingerprint_image_path && 'fingerprint',
                d.separation_status === 'completed' && `stems(${d.separated_files?.length ?? 0})`,
                d.midi_files?.length && `midi(${d.midi_files.length})`,
                d.tabs_files?.length && `tabs(${d.tabs_files.length})`,
            ].filter(Boolean);

            console.log(`${uid}  ${doc.id}  uploaded ${age(d.uploadedAt)}`);
            console.log(`    complete: ${done.join(', ') || '(nothing yet)'}`);
            if (d.validated === false) console.log('    validated: FALSE — file was rejected');
        }

        const jobs = await admin.db.collection('jobs').where('userid', '==', uid).get();
        const byStatus = {};
        for (const j of jobs.docs) byStatus[j.data().status] = (byStatus[j.data().status] || 0) + 1;
        if (jobs.size) {
            console.log(`    jobs: ${Object.entries(byStatus).map(([s, n]) => `${s}=${n}`).join(' ')}`);
            for (const j of jobs.docs.filter((j) => j.data().error)) {
                console.log(`      ! ${j.id}: ${j.data().error}`);
            }
        }
    }

    if (!found) console.log('No test-user audio documents found — nothing from a run is outstanding.');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
