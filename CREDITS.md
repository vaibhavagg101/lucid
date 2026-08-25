# Credits and Attributions

LUCID orchestrates existing open source and published research models. This file records
what was used, where it came from, what it does in this project, and under which license.

## Vendored third-party source

One component is copied into this repository rather than installed as a dependency:

**ISMIR 2019 Large-Vocabulary Chord Recognition**, by Music X Lab
`containerised_functions/chords/ISMIR2019-Large-Vocabulary-Chord-Recognition/`
MIT License, retained unmodified in that directory alongside the original README.

It performs chord recognition directly on the audio waveform, producing the `.lab` output
that becomes LUCID's chord chart and the input to key detection. It is third-party work,
used under its published license, and is not authored by this project.

> J. Jiang, K. Chen, W. Li and G. Xia, "Large-Vocabulary Chord Transcription via Chord
> Structure Decomposition," *Proc. 20th Int. Society for Music Information Retrieval
> Conf. (ISMIR)*, Delft, 2019.
> https://archives.ismir.net/ismir2019/paper/000078.pdf

## Models and audio libraries

Installed as dependencies. Each remains under its own license.

| Component | Role in LUCID | Source |
| --- | --- | --- |
| Demucs (`htdemucs`, `htdemucs_6s`) | 2 / 4 / 6-way stem separation | https://github.com/facebookresearch/demucs |
| basic-pitch | Polyphonic audio-to-MIDI transcription | https://github.com/spotify/basic-pitch |
| noisereduce | Spectral-gating noise reduction | https://github.com/timsainb/noisereduce |
| librosa | BPM / tempo estimation | https://librosa.org |
| tuttut | MIDI-to-guitar-tablature fingering | https://github.com/adrien-mrn/tuttut |
| pretty_midi | MIDI parsing before tab generation | https://github.com/craffel/pretty-midi |
| yt-dlp | YouTube audio extraction (service disabled in UI) | https://github.com/yt-dlp/yt-dlp |
| pydub + FFmpeg | Decoding, conversion and export | https://ffmpeg.org |
| PyTorch (CPU wheels) | Inference backend for Demucs and the chord network | https://pytorch.org |
| NumPy / SciPy / pandas / Matplotlib | Array maths, FFT, CSV handling, plotting | - |

### Papers

> A. Défossez, "Hybrid Spectrogram and Waveform Source Separation," *Proc. ISMIR 2021
> Workshop on Music Source Separation*, 2021. (Demucs)

> R. M. Bittner, J. J. Bosch, D. Rubinstein, G. Meseguer-Brocal and S. Ewert, "A
> Lightweight Instrument-Agnostic Model for Polyphonic Note Transcription and Multipitch
> Estimation," *Proc. IEEE ICASSP*, Singapore, 2022. (basic-pitch)

> T. Sainburg, M. Thielk and T. Q. Gentner, "Finding, visualizing, and quantifying latent
> structure across diverse animal vocal repertoires," *PLoS Computational Biology*,
> vol. 16, no. 10, 2020. (noisereduce)

> B. McFee et al., "librosa: Audio and Music Signal Analysis in Python," *Proc. 14th
> Python in Science Conf. (SciPy)*, 2015, pp. 18-25.

> C. Raffel and D. P. W. Ellis, "Intuitive Analysis, Creation and Manipulation of MIDI
> Data with pretty_midi," *15th ISMIR Late Breaking and Demo Papers*, 2014.

## Algorithms

**Krumhansl-Schmuckler key detection**: `containerised_functions/chords/key_detection.py`
Implemented for this project, using the key profiles measured by Krumhansl and Kessler.
Rather than analysing raw audio it correlates a duration-weighted pitch-class profile,
derived from the chord chart, against all 24 major and minor reference profiles.

> C. L. Krumhansl and E. J. Kessler, "Tracing the dynamic changes in perceived tonal
> organization in a spatial representation of musical keys," *Psychological Review*,
> vol. 89, no. 4, pp. 334-368, 1982.

> C. L. Krumhansl, *Cognitive Foundations of Musical Pitch*. Oxford University Press, 1990.

## Platform and framework documentation

Next.js and Server Actions, FastAPI, Tailwind CSS, WaveSurfer.js, Firebase
(Authentication, Firestore, Cloud Functions, App Hosting) and Google Cloud
(Cloud Run, Pub/Sub push subscriptions, Cloud Storage, Artifact Registry).

## AI assistance

The Krumhansl-Schmuckler key detection implementation in `key_detection.py` was written
with the help of Gemini. This is disclosed here and in the project report.

## Licensing

LUCID's own code is MIT licensed, see [LICENSE](LICENSE). That license covers only the
code written for this project. Every component listed above remains under the license of
its own authors, and nothing here relicenses or supersedes those terms.
