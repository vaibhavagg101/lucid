import Link from "next/link";
import AmbientVideo from "./components/landing/ambient-video";
import StartCta from "./components/landing/start-cta";
import StemPanel from "./components/landing/stem-panel";
import styles from "./components/landing/landing.module.css";

type Fact = { term: string; value: string };

function DemoLink() {
  return (
    <Link
      href="/demo-video"
      className="inline-flex w-full items-center justify-center rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold tracking-wide text-white/90 transition hover:border-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60 sm:w-auto"
    >
      Watch the demo
    </Link>
  );
}

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[0.7rem] font-semibold tracking-[0.18em] text-white/30">{index}</span>
      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-secondary sm:text-[0.7rem]">
        {label}
      </span>
    </div>
  );
}

function Facts({ facts, className = "" }: { facts: Fact[]; className?: string }) {
  return (
    <dl className={`grid grid-cols-2 gap-x-6 gap-y-5 ${className}`}>
      {facts.map((fact) => (
        <div key={fact.term}>
          <dt className="text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-white/35">
            {fact.term}
          </dt>
          <dd className="mt-1.5 text-sm text-white/85">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Text on one side, a clip bleeding off the opposite edge. The media is a
 * single element that sits in the flow on phones and goes absolute from `lg`,
 * so nothing is rendered twice.
 */
function Feature({
  index,
  label,
  title,
  children,
  facts,
  media,
  mediaSide,
  backgroundClass,
}: {
  index: string;
  label: string;
  title: string;
  children: React.ReactNode;
  facts: Fact[];
  media: React.ReactNode;
  mediaSide: "left" | "right";
  backgroundClass: string;
}) {
  return (
    <section className={`relative isolate w-full overflow-hidden ${backgroundClass}`}>
      <div className={styles.grain} />
      <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-24 lg:px-10 lg:py-32">
        <div
          className={`relative ${mediaSide === "left" ? "lg:ml-auto lg:max-w-[40%]" : "lg:max-w-[40%]"}`}
        >
          <SectionLabel index={index} label={label} />
          <h2 className="mt-5 text-[clamp(1.9rem,5.4vw,3.15rem)] font-extrabold leading-[1.03] tracking-[-0.025em]">
            {title}
          </h2>
          <p className="mt-5 max-w-xl text-[0.98rem] font-light leading-relaxed text-white/65 sm:text-lg sm:leading-relaxed">
            {children}
          </p>
          <Facts facts={facts} className="mt-9 max-w-md" />
        </div>
        {media}
      </div>
    </section>
  );
}

const capabilities = [
  "Separate vocals, drums, bass, guitar and piano",
  "Chord recognition",
  "Key & BPM detection",
  "Noise reduction",
  "MIDI transcription",
  "Guitar tablature",
  "Spectral fingerprint",
];

export default function Home() {
  return (
    <div
      className="main h-[calc(100dvh-4rem)] w-full overflow-y-auto overflow-x-hidden bg-[#070b1f] text-white no-scrollbar selection:bg-secondary selection:text-[#0b1030]"
      style={{ padding: 0 }}
    >
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative isolate flex min-h-[calc(100dvh-4rem)] w-full flex-col justify-center overflow-hidden bg-[radial-gradient(125%_105%_at_12%_-15%,#26409c_0%,#1a2a63_32%,#0d1338_62%,#070b1f_100%)]">
        <span
          className="absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-secondary via-[#4fe0f0] to-tertiary opacity-70"
          aria-hidden="true"
        />
        <div className={styles.grain} />

        {/* The separation clip, screen-blended so its black background drops out
            and only the waveform is left glowing along the bottom edge. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] sm:h-[44%]">
          <AmbientVideo
            src="/videos/track-separation-720.webm"
            poster="/videos/track-separation-poster.jpg"
            className={`${styles.horizon} h-full w-full object-cover opacity-70 mix-blend-screen`}
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-14 pb-[16vh] sm:px-8 sm:pt-16 sm:pb-[18vh] lg:px-10">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-secondary sm:text-[0.72rem]">
            Serverless AI music analysis
          </p>

          <h1 className="mt-5 max-w-[15ch] text-[clamp(2.9rem,9.4vw,6.75rem)] font-extrabold leading-[0.9] tracking-[-0.04em]">
            Take any song apart<span className="text-tertiary">.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base font-light leading-relaxed text-white/65 sm:mt-8 sm:text-xl sm:leading-relaxed">
            Upload or record a track and get isolated stems, chords, key, BPM, MIDI and guitar
            tablature back, each one produced by its own open source model, running on demand in
            the cloud.
          </p>

          <div className="mt-9 flex flex-col items-stretch gap-3 sm:mt-11 sm:flex-row sm:items-center sm:gap-4">
            <StartCta />
            {/* <DemoLink /> */}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ 01 · Noise reduction */}
      <Feature
        index="01"
        label="Noise reduction"
        title="Remove background noise."
        facts={[
          { term: "Method", value: "Spectral gating" },
          { term: "Noise profile", value: "Adaptive or hand-picked" },
        ]}
        mediaSide="right"
        backgroundClass="bg-[linear-gradient(180deg,#070b1f_0%,#0a1233_48%,#070b1f_100%)]"
        media={
          <div className="pointer-events-none relative mt-12 aspect-16/11 w-full lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:aspect-auto lg:w-[50%] hidden lg:block">
            <AmbientVideo
              src="/videos/noise-reduction-720.webm"
              poster="/videos/noise-reduction-poster.jpg"
              className={`${styles.dissolveRight} h-full w-full object-cover mix-blend-screen hidden lg:block`}
            />
          </div>
        }
      >
        Let the system estimate the noise floor on its own, or drag over a quiet passage first and
        it works from your clip instead, which is markedly better on steady hiss and mains hum.
        Play the before and after against each other, then keep whichever one you want.
      </Feature>

      {/* ------------------------------------------------------ 02 · Stem separation */}
      <section className="relative isolate w-full overflow-hidden bg-[linear-gradient(180deg,#070b1f_0%,#131e57_52%,#0a1130_100%)]">
        <div className={styles.grain} />
        <div className="relative mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-24 lg:px-10 lg:py-28">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            <div className="max-w-xl">
              <SectionLabel index="02" label="Stem separation" />
              <h2 className="mt-5 text-[clamp(1.9rem,5.4vw,3.15rem)] font-extrabold leading-[1.03] tracking-[-0.025em]">
                Split a track into stems.
              </h2>
              <p className="mt-5 text-[0.98rem] font-light leading-relaxed text-white/65 sm:text-lg sm:leading-relaxed">
                Demucs hands every part back as its own track, with its own player and its own
                download. Two stems splits vocals from everything else, four adds drums and bass,
                six pulls the guitar and piano out on top of that.
              </p>
            </div>
            <Facts
              facts={[
                { term: "Model", value: "Demucs" },
                { term: "Stems", value: "2 · 4 · 6" },
              ]}
              className="lg:shrink-0 lg:text-right"
            />
          </div>

          <StemPanel className="mt-11 sm:mt-14" />
        </div>
      </section>

      {/* ------------------------------------------------------ 03 · MIDI */}
      <Feature
        index="03"
        label="MIDI transcription"
        title="Turn audio into MIDI."
        facts={[
          { term: "Notes", value: "Polyphonic" },
          { term: "Source", value: "Full mix or any stem" },
        ]}
        mediaSide="left"
        backgroundClass="bg-[linear-gradient(180deg,#0a1130_0%,#070b1f_55%,#080d26_100%)]"
        media={
          <div className="pointer-events-none relative mt-12 aspect-[16/10] w-full overflow-hidden rounded-2xl ring-1 ring-white/10 lg:absolute lg:inset-y-10 lg:left-0 lg:mt-0 lg:aspect-auto lg:w-[50%] lg:rounded-l-none lg:rounded-r-[2rem] lg:ring-0">
            <AmbientVideo
              src="/videos/midi-playing-1080.webm"
              poster="/videos/midi-playing-poster.jpg"
              className="h-full w-full object-cover contrast-[1.05] saturate-[0.95]"
            />
            <div
              className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,31,0)_50%,rgba(7,11,31,0.6)_100%)] lg:bg-[linear-gradient(90deg,rgba(7,11,31,0.22)_0%,rgba(7,11,31,0)_32%,rgba(7,11,31,0.92)_100%)]"
              aria-hidden="true"
            />
          </div>
        }
      >
        Transcription catches overlapping notes, chord voicings and pitch bends, on the whole mix
        or on one stem at a time. A single instrument transcribes far more cleanly than a crowded
        one, so run it on a stem when the result has to be exact.
      </Feature>

      {/* ------------------------------------------------------ 04 · Analysis */}
      <Feature
        index="04"
        label="Chords, key & tempo"
        title="Get chords, key and BPM."
        facts={[
          { term: "Key", value: "Krumhansl-Schmuckler" },
          { term: "Tempo", value: "librosa" },
        ]}
        mediaSide="right"
        backgroundClass="bg-[linear-gradient(180deg,#080d26_0%,#0b1435_50%,#070b1f_100%)]"
        media={
          <div className="pointer-events-none relative mt-12 aspect-[16/10] w-full overflow-hidden rounded-2xl ring-1 ring-white/10 lg:absolute lg:inset-y-10 lg:right-0 lg:mt-0 lg:aspect-auto lg:w-[50%] lg:rounded-r-none lg:rounded-l-[2rem] lg:ring-0">
            <AmbientVideo
              src="/videos/analysis-1080.webm"
              poster="/videos/analysis-poster.jpg"
              className="h-full w-full object-cover"
            />
            <div
              className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,31,0)_50%,rgba(7,11,31,0.6)_100%)] lg:bg-[linear-gradient(270deg,rgba(7,11,31,0.22)_0%,rgba(7,11,31,0)_34%,rgba(7,11,31,0.92)_100%)]"
              aria-hidden="true"
            />
          </div>
        }
      >
        Key and BPM land in the overview. The chord chart is timestamped and lights each change up
        as the track plays, guitar tablature comes back as plain ASCII three measures to a line,
        and a spectral fingerprint renders the whole thing as one image.
      </Feature>

      {/* ------------------------------------------------------------- Closing */}
      <section className="relative isolate w-full overflow-hidden bg-[radial-gradient(115%_100%_at_85%_110%,#1c2c72_0%,#0d1338_45%,#070b1f_100%)]">
        <div className={styles.grain} />
        <div className="relative mx-auto w-full max-w-6xl px-6 pt-16 pb-24 sm:px-8 sm:pt-24 sm:pb-28 lg:px-10 lg:pt-28 lg:pb-32">
          <h2 className="max-w-3xl text-[clamp(1.9rem,5.4vw,3.15rem)] font-extrabold leading-[1.03] tracking-[-0.025em]">
            Everything runs in the cloud.
          </h2>
          <p className="mt-6 max-w-2xl text-[0.98rem] font-light leading-relaxed text-white/65 sm:text-lg sm:leading-relaxed">
            Seven Python services do the audio work and every one of them sits at zero instances
            until a message wakes it. Nothing long-running is held open in the browser, so you can
            close the tab in the middle of a job and come back to a finished file.
          </p>

          <ul className="mt-10 flex flex-wrap gap-2.5">
            {capabilities.map((capability) => (
              <li
                key={capability}
                className="rounded-full border border-white/15 px-4 py-2 text-[0.78rem] text-white/70 sm:text-[0.85rem]"
              >
                {capability}
              </li>
            ))}
          </ul>

          <div className="mt-12 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
            <StartCta />
            {/* <DemoLink /> */}
          </div>

          <p className="mt-10 text-[0.72rem] leading-relaxed tracking-[0.04em] text-white/35 sm:text-[0.78rem]">
            WAV, MP3, M4A, AAC, WebM, OGG, FLAC or AIFF · under 50 MB · under 6½ minutes
          </p>
        </div>
      </section>
    </div>
  );
}
