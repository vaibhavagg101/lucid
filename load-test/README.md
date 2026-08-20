# LUCID concurrent load test

Drives **3, then 6, then 9 simultaneous users** through the complete LUCID pipeline —
Storage upload → `validateAudioFile` → chords + fingerprint → stem separation → MIDI → tabs —
and reports how each stage's latency changes as concurrency rises.

Each virtual user is a real Firebase Auth user signing in with a custom token and using the
**client** SDK, so Storage rules, Firestore rules and the real Cloud Function triggers are all
exercised exactly as they are from the browser.

## Setup

```bash
cd load-test
npm install
cp .env.example .env      # then fill it in
```

You need a **staging Firebase project** — this writes real documents, uploads real audio and
runs real demucs jobs. Put its service-account key next to `.env` and point
`GOOGLE_APPLICATION_CREDENTIALS` at it. The key must have Firestore, Storage, Pub/Sub publisher
and Auth admin access.

Verify the setup without sending any pipeline traffic:

```bash
node run.mjs --dry-run
```

## Before you run: cap your spend

Nine concurrent demucs jobs can scale Cloud Run hard. Set `--max-instances` on every service
first, and run the audit to see what the deployed config actually is:

```bash
./gcp-check.sh
```

Measured baseline for `lucid-b0b9e` on 2026-08-21 — the services are already sized sensibly,
so the things to watch are not the ones you would normally worry about:

| Service | Region | Concurrency | Max instances | CPU / mem | Timeout |
|---|---|---|---|---|---|
| stem | asia-south2 | 1 | 10 | 4000m / 8Gi | 595s |
| chords | asia-south2 | 1 | 10 | 4000m / 8Gi | 540s |
| midi | asia-south2 | 1 | 100 | 2000m / 4Gi | 300s |
| tabs | asia-south2 | 2 | 100 | 2000m / 2Gi | 540s |
| noisereduce | asia-south2 | 2 | 10 | 4000m / 2Gi | 540s |
| audio-fingerprint | **europe-west1** | 10 | 10 | 2000m / 4Gi | 540s |

- **Concurrency is already 1 on the heavy services**, so demucs jobs get a dedicated instance.
  This is the failure mode that usually ruins a load test, and it is not present here.
- **Pub/Sub ack deadlines are all 600s**, the maximum. Duplicate work from redelivery is unlikely
  for short fixtures, but `stem`'s 595s request timeout sits just under it — a long track that
  times out will be redelivered and rerun, so keep checking for duplicates on full-length audio.
- **`maxScale: 10` on `stem` and `chords` is the binding constraint.** At concurrency 1 that is
  10 parallel jobs, so a 9-user wave sits right at the edge: the 10th concurrent job queues.
  This is why 9 is the interesting number, and why the 6→9 step is where you should expect the
  curve to bend.
- **`setGlobalOptions({ maxInstances: 10 })`** in `firebase_functions/functions/src/index.ts`
  applies the same cap to `validateAudioFile`, which streams every upload through
  `music-metadata` on 256Mi.
- **`audio-fingerprint` runs in europe-west1** while the bucket and every other service are in
  Asia. Expect its stage to carry a cross-region transfer penalty unrelated to load.

Re-run `./gcp-check.sh` before a session to confirm these still hold.

## Run

```bash
node run.mjs                  # waves of 3, 6, 9
node run.mjs --waves 3        # one wave
node run.mjs --waves 3,9      # skip the middle
```

Waves are separated by a cooldown (`COOLDOWN_MS`, default 120s) so each starts from a comparable
Cloud Run scale state rather than riding the previous wave's warm instances.

## Reading the output

Per wave you get a stage table, then a comparison across waves:

```
=== Median stage duration by wave size (seconds) ===
stage         3u     6u     9u
validate      4.2    4.5    11.8
chords        38.1   41.0   96.4
stems         92.7   96.2   288.9
END-TO-END    180.4  190.1  520.7
completed     3/3    6/6    7/9
```

A **flat row** means that stage has headroom. A row that **rises roughly linearly with wave size**
means work is serialized there — that stage is your bottleneck, and the number is how much
queueing a user sees. Compare `stems` against `validate`: they fail for different reasons
(container concurrency vs. the function instance cap) and the fix is different for each.

Raw results land in `results/run-<timestamp>.json` and `.csv` (one row per user per stage).

## After a run: check for duplicated work

```bash
./gcp-check.sh "2026-08-20T18:00:00Z"    # the wave start timestamp printed by run.mjs
```

This counts Cloud Run POSTs per service since that time. With a wave of 9 you submitted 9 chords
jobs, 9 stem jobs, 9 MIDI jobs and 9 tabs jobs; **materially more requests than that means Pub/Sub
redelivered and the container did the work twice.** Firestore won't reveal this on its own —
`separated_files` is overwritten and `midi_files` uses `ArrayUnion`, so both dedupe silently.

## Cleanup

```bash
node cleanup.mjs           # delete audio docs, job docs and Storage objects
node cleanup.mjs --users   # also delete the 9 auth users
```

Test users are `loadtest-0` … `loadtest-8`. Leaving them in place between runs is fine and saves
waiting on `onNewUserSignIn`.

## What this does and does not cover

Covered: Storage upload, `validateAudioFile`, `backgroundAudioProcessing`, `triggerStemsCreation`,
`onNewUserSignIn` (fired when the test users are created), and the chords, fingerprint, stem, midi
and tabs containers.

Not covered, deliberately:

- **The Next.js server actions.** MIDI and tabs jobs are published straight to Pub/Sub, replicating
  what `app/actions/midi.ts` and `tabs.ts` do. The actions themselves are thin — `verifyIdToken`,
  one Firestore write, one publish — so they are not the bottleneck. To load-test them for real,
  drive the deployed UI with Playwright contexts instead.
- **`noisereduce`.** It is an optional preview step the user may skip; the harness always declines
  it so every run measures the same path.
- **`youtube`.** yt-dlp bot-detection makes it unreliable under load, and the 3-uses-per-user quota
  caps it anyway. Worth testing separately: the quota check in `app/actions/youtube.ts` is a
  read-then-write with no transaction, so parallel requests from one user can exceed 3.

## Tuning

`SEPARATION_OPTION` defaults to `4`. Option `6` uses the heavier `htdemucs_6s` model — a useful
second run once the 4-stem numbers are established, but don't compare the two directly.
Fixtures default to `test_samples_wav_only/` (9–30s clips), which keeps a full 9-user run to
minutes rather than hours. Point `FIXTURE_DIR` at one of the full-length album directories for a
worst-case run.
