# Running the tests

There are three test suites in this repo. None of them need Firebase
credentials, an emulator, or network access — Firebase/PubSub are mocked in
the tests.

## Prerequisites

- Node.js 20+ and npm
- Python 3.13+ with `pandas`, `numpy` and `pytest` (only for the chords tests)

## 1. Frontend tests (Vitest) — `frontend/web`

```bash
cd frontend/web
npm install
npm test
```

Covers the utilities (`formatTime`, YouTube URL validation, chords CSV
parsing) and the server actions (`delete-audio`, `midi`, `noisereduce`).

## 2. Firebase Cloud Functions tests (Jest) — `firebase_functions/functions`

```bash
cd firebase_functions/functions
npm install
npm run build   # make sure the TypeScript build still passes
npm test
```

Covers all four functions: `onNewUserSignIn`, `backgroundAudioProcessing`,
`triggerStemsCreation`, `validateAudioFile`.

## 3. Chords key detection tests (pytest) — `containerised_functions/chords`

```bash
cd containerised_functions/chords
python3 -m venv env
source env/bin/activate
pip install pandas numpy pytest   # if not already installed
python3 -m pytest
```

Run pytest from this directory — the `pytest.ini` here sets the module search
path and test location.

## CI

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs all three suites
on every push to `master` and on pull requests.
