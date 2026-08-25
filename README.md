<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="frontend/web/public/master-logo-on-primary.svg">
    <img src="frontend/web/public/master-logo-on-surface.svg" alt="LUCID" width="420">
  </picture>
</p>

<p align="center">
  Serverless AI music analysis. Upload or record a track and get back isolated stems,<br>
  timestamped chords, key, BPM, MIDI and guitar tablature, each produced by its own<br>
  open source model running on demand in the cloud.
</p>

<p align="center">
  <a href="https://lucid.vaibhavaggarwal.dev"><strong>lucid.vaibhavaggarwal.dev</strong></a>
</p>

Nothing runs while idle. The seven Python services that do the audio work sit at zero
instances until a Pub/Sub message wakes them, so the browser never waits on a
long-running request and closing the tab doesn't cancel a job.

## What it does

- **Noise reduction**: spectral gating, either adaptive or from a noise clip you drag on the waveform
- **Stem separation**: 2, 4 or 6 tracks via Demucs
- **Chord recognition**: timestamped chord chart from the raw waveform
- **Key and BPM**: Krumhansl-Schmuckler key detection over the chord chart, librosa for tempo
- **MIDI transcription**: polyphonic, on the full mix or on individual stems
- **Guitar tablature**: timestamped ASCII tab, three measures per line
- **Spectral fingerprint**: one PNG per track, a second per column and an octave per row

A YouTube import service exists (`containerised_functions/youtube`) and is deployed, but
it is disabled in the UI on copyright grounds and is not a user-facing feature.

## Getting started and guide

Using the hosted app. Nothing to install.

1. **Sign in** with Google or GitHub. A workspace is created for you on first sign-in.
2. **Add audio.** Upload a file (WAV, MP3, M4A, AAC, WebM, OGG, FLAC or AIFF, under
   50 MB and 6.5 minutes) or record straight from the browser.
3. **Reduce noise**, optionally. Choose Reduce Noise to let the system estimate the noise
   floor, or Select Noise Clip and drag over a quiet passage first, which is markedly
   better for steady hiss or hum. Compare the before and after, then keep either version.
4. **Choose separation.** 2 stems (vocals and everything else), 4 (adds drums and bass),
   6 (adds guitar and piano), or none.
5. **Read the results.** The detail page fills in as each service finishes, so you can
   close the tab and come back later. Overview carries key, BPM, channels, sample rate and
   bit depth. Chords highlights each chord as it plays. Stems gives every track its own
   player and download.
6. **Generate MIDI or tabs** from the controls under the main player, or per stem. These
   work best on single-instrument stems; selecting "other" warns you first, because mixed
   signals transcribe poorly.

Files stay until you delete them. Deleting is immediate and removes every derived artefact
along with the original.

## Running locally

Requires Node.js 24+, Python 3.10 to 3.14 (version varies per service), Docker, FFmpeg,
and the `gcloud` and `firebase` CLIs authenticated against a Firebase project with
Auth, Firestore, Storage and Pub/Sub enabled.

```bash
# frontend
cd frontend/web
npm install
# create .env.local with the values in the table below
npm run dev                  # http://localhost:3000

# cloud functions
cd firebase_functions/functions
npm install && npm run build
```

For local dev the Server Actions need a service account with the **Pub/Sub Publisher**
and **Firebase Admin** roles, pointed at by `GOOGLE_APPLICATION_CREDENTIALS`. On App
Hosting the runtime identity is used instead.

### Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | frontend | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | frontend | OAuth redirect domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | frontend | Project identifier |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | frontend | Target GCS bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | frontend | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | frontend | Firebase web config |
| `NEXT_PUBLIC_SITE_URL` | frontend | Canonical site URL |
| `NR_PUBSUB_TOPIC` | Server Action | Noise reduction topic |
| `MIDI_PUBSUB_TOPIC` | Server Action | MIDI conversion topic |
| `TABS_PUBSUB_TOPIC` | Server Action | Tablature topic |
| `YOUTUBE_PUBSUB_TOPIC` | Server Action | YouTube import topic |
| `GOOGLE_APPLICATION_CREDENTIALS` | Server Action (local only) | Service account key path |
| `BG_PROCESSING_PUBSUB_TOPIC` | Cloud Function | Chords + fingerprint fan-out |
| `STEM_PUBSUB_TOPIC` | Cloud Function | Stem separation topic |
| `GSBUCKET` | Cloud Function | Target GCS bucket |

The three function-side values are declared with `defineString` in
`firebase_functions/functions/src/index.ts`, so `firebase deploy` will prompt for them.
No credentials are committed; `.env` and `.env.*` are gitignored.

## Repo layout

```
frontend/web/              Next.js 16 (App Router) + React 19 + Tailwind v4
  app/actions/             Server Actions: token check, ownership check, Pub/Sub publish
  app/workspace/           File list and the per-track detail page
firebase_functions/        4 Cloud Functions: user creation, validation, job fan-out
containerised_functions/   7 FastAPI services, one Dockerfile each
  chords/                  Includes vendored ISMIR 2019 model, see CREDITS.md
load-test/                 Concurrent-user harness (Node.js + Firebase client SDK)
documentation/             Report, diagrams, poster
```

## Architecture

Three layers, deliberately decoupled. The browser never calls a Cloud Run service and
no service knows the browser exists. All they share is state in Firestore and objects
in Cloud Storage.

1. **Client**: Next.js in the browser. Firebase client SDK for auth, resumable uploads
   and `onSnapshot` listeners, so results appear the instant a service writes them.
2. **Control**: Cloud Functions and Server Actions. Decides what work is needed,
   verifies the caller owns the file, records a job, publishes to Pub/Sub. No audio work.
3. **Compute**: seven FastAPI services on Cloud Run, each on one push subscription.
   Download from GCS, do one job, upload, update Firestore.

A track's flow: the browser uploads to `{userId}/audio/{audioId}.{ext}` and creates the
Firestore document, `validateAudioFile` enforces 50 MB / 6.5 min server-side and deletes
anything over, the noise-reduction choice fans out to chords and fingerprint in parallel,
the stem choice triggers separation, and MIDI and tabs are requested per stem on demand.

Diagrams (high-level architecture, DFD, component interaction) are in
[documentation/Diagrams/](documentation/Diagrams/).

### Services

| Service | Endpoint | Triggered by | Output |
| --- | --- | --- | --- |
| `noisereduce` | `POST /noisereduce-pubsub` | Server Action | Cleaned audio + before/after plots |
| `chords` | `POST /chords-pubsub` | `backgroundAudioProcessing` | Chord CSV, key, BPM |
| `audio_fingerprint` | `POST /audio-fingerprint-pubsub` | `backgroundAudioProcessing` | Spectrogram PNG, channels, rate, depth |
| `stem` | `POST /stem-pubsub` | `triggerStemsCreation` | 2 / 4 / 6 stem files |
| `midi` | `POST /midi-pubsub` | Server Action | `.mid` file |
| `tabs` | `POST /tabs-pubsub` | Server Action | Timestamped ASCII tab `.txt` |
| `youtube` | `POST /youtube-pubsub` | Server Action (disabled in UI) | Extracted audio |

### Design decisions

| Decision | Why |
| --- | --- |
| Pub/Sub between the control and compute layers, never a direct HTTP call | A synchronous call would hold a connection open for minutes and die on browser or gateway timeouts. Pub/Sub also retries a failed job for free. |
| Firestore documents as the only shared state | The user can close the tab mid-analysis. Results appear through `onSnapshot` whenever the service gets round to writing them. |
| CPU-only inference, PyTorch CPU wheels | Cloud Run GPUs have no free tier and bill per instance rather than per request, which is the wrong shape for bursty work. CPU stays inside the Pub/Sub ACK window for files under 6.5 min and cuts over a gigabyte off each image, which is what actually drives cold-start time. |
| One container per service, each free to pin its own Python | `tabs` needs 3.10 and `midi` needs 3.11 because of their dependencies; the rest run 3.14. A shared runtime would have dragged all seven down to the oldest. |
| Chords recognised from the raw waveform, not derived from generated MIDI | A purpose-built chord model is substantially more accurate than inferring harmony from a transcription that has already lost information. |
| Model weights baked in at image build time | A cold container never has to fetch checkpoints over the network before it can start work. |
| 50 MB and 6.5 min ceiling, enforced server-side | Keeps worst-case Demucs separation inside the Cloud Run request timeout and the Pub/Sub ACK deadline. The client-side check is a courtesy; `validateAudioFile` is the actual gate. |
| Ownership verified in the Server Action, not the UI | Every action re-checks the Firebase ID token and that the requested path belongs to the caller before publishing a job. |

## Deploying

```bash
# one-time
gcloud auth configure-docker [region]-docker.pkg.dev

# per service, from its directory
docker build -t [region]-docker.pkg.dev/[project]/[repo]/[service]:[tag] .
docker push  [region]-docker.pkg.dev/[project]/[repo]/[service]:[tag]

gcloud run deploy [service] \
  --image [region]-docker.pkg.dev/[project]/[repo]/[service]:[tag] \
  --region [region] --platform managed --no-allow-unauthenticated

# the push subscription that wakes it
gcloud pubsub topics create [topic]
gcloud pubsub subscriptions create [subscription] \
  --topic [topic] \
  --push-endpoint https://[service-url]/[endpoint] \
  --push-auth-service-account [sa]@[project].iam.gserviceaccount.com
```

Services require authenticated invocation (IAM), so Pub/Sub is the only caller. Set the
subscription ACK deadline high enough for the job; stem separation needs the 600 s
maximum. Cloud Functions deploy with `firebase deploy --only functions` from
`firebase_functions/`; the frontend deploys through Firebase App Hosting on push.

## Testing

**Unit suites**, run offline: Vitest (frontend utilities and Server Actions), Jest (Cloud
Functions) and pytest (key detection). Firebase and Pub/Sub are mocked, so these need no
credentials, no emulator and no network. See [TESTING.md](TESTING.md). CI runs all three
on every push and pull request.

**Load test** in [load-test/](load-test/), run manually. This one is not offline: it
drives real users through the deployed pipeline in waves of 3, 6 and 9, so it needs a
staging Firebase project, a service-account key with Firestore, Storage, Pub/Sub
publisher and Auth admin access, and it spends real money on Cloud Run. Cap
`--max-instances` on every service before running it. `node run.mjs --dry-run` verifies
the setup without sending pipeline traffic, and `node cleanup.mjs` removes what a run
leaves behind. See [load-test/README.md](load-test/README.md).

Nine is the interesting number: the heavy services cap at 10 instances and take one
request each, so a 9-user wave sits exactly where queueing starts. Running it that way
turned up four faults that a single user never reaches, including a `SystemExit` that
escaped an error handler and left Pub/Sub redelivering one job 200 times, and two
services sharing Matplotlib's process-global figure state so concurrent requests
overwrote each other's output while still reporting success.

## Credits

LUCID is a thin orchestration layer over other people's research. The heavy lifting is
done by [Demucs](https://github.com/facebookresearch/demucs) (separation),
[basic-pitch](https://github.com/spotify/basic-pitch) (transcription),
[ISMIR 2019 Large-Vocabulary Chord Recognition](https://github.com/Music-X-Lab/ISMIR2019-Large-Vocabulary-Chord-Recognition)
(chords), [noisereduce](https://github.com/timsainb/noisereduce),
[librosa](https://librosa.org), [tuttut](https://github.com/adrien-mrn/tuttut) (tablature)
and [pretty_midi](https://github.com/craffel/pretty-midi).

The chord model's source is **vendored into this repository** at
`containerised_functions/chords/ISMIR2019-Large-Vocabulary-Chord-Recognition/` under its
own MIT license, which is retained in that directory. The Krumhansl-Schmuckler key
detector in `containerised_functions/chords/key_detection.py` was written for this project
with the help of Gemini.

Full attributions, licenses and paper citations are in [CREDITS.md](CREDITS.md).

## License

MIT, see [LICENSE](LICENSE). Third-party components remain under their own licenses;
see [CREDITS.md](CREDITS.md).
