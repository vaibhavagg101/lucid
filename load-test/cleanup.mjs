// Removes everything a run created: audio docs, job docs, Storage objects and (optionally) the test users.
//   node cleanup.mjs              # data only, keeps the test auth users for the next run
//   node cleanup.mjs --users      # also delete the auth users and their users/{uid} docs
import { config, TEST_UID_PREFIX } from './src/config.mjs';
import { initAdmin, testUid } from './src/users.mjs';

const alsoUsers = process.argv.includes('--users');
const MAX_USERS = 9;

async function main() {
    const admin = initAdmin();
    const uids = Array.from({ length: MAX_USERS }, (_, i) => testUid(i));

    for (const uid of uids) {
        const audioDocs = await admin.db.collection('audio_files').where('userId', '==', uid).get();
        const jobDocs = await admin.db.collection('jobs').where('userid', '==', uid).get();
        const batchDeletes = [...audioDocs.docs, ...jobDocs.docs].map((d) => d.ref.delete());
        await Promise.all(batchDeletes);

        const [files] = await admin.bucket.getFiles({ prefix: `${uid}/` });
        await Promise.all(files.map((f) => f.delete().catch(() => { })));

        console.log(`${uid}: ${audioDocs.size} audio docs, ${jobDocs.size} job docs, ${files.length} objects removed`);

        if (alsoUsers) {
            await admin.db.collection('users').doc(uid).delete().catch(() => { });
            await admin.auth.deleteUser(uid).catch(() => { });
            console.log(`${uid}: auth user and users/ doc deleted`);
        }
    }

    console.log(`\nDone (prefix ${TEST_UID_PREFIX}, bucket ${config.bucket}).`);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
