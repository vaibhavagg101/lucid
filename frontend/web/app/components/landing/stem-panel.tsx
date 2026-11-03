import styles from './landing.module.css';

const BAR_COUNT = 96;

/** Small deterministic PRNG so the server and the client draw the same waveform. */
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `shape` gets position through the lane (0-1), the bar index and a random 0-1. */
function lane(seed: number, shape: (position: number, index: number, random: number) => number) {
  const random = mulberry32(seed);
  return Array.from({ length: BAR_COUNT }, (_, index) =>
    Math.min(1, Math.max(0.07, shape(index / BAR_COUNT, index, random())))
  );
}

// Each stem gets its own character, the way it would in a real session: vocals
// breathe, drums are all transient, bass sits flat and loud, the rest is scraps.
const fullMix = lane(9, (position, _index, random) =>
  0.34 + 0.44 * Math.abs(Math.sin(position * Math.PI * 3.1)) + 0.22 * random
);

const stems = [
  {
    label: 'Vocals',
    barClass: 'bg-secondary',
    values: lane(21, (position, _index, random) =>
      0.2 + 0.58 * Math.sin(position * Math.PI * 2.3) ** 2 + 0.14 * random
    ),
  },
  {
    label: 'Drums',
    barClass: 'bg-tertiary',
    values: lane(34, (_position, index, random) =>
      (index % 8 === 0 ? 0.92 : index % 4 === 0 ? 0.58 : index % 2 === 0 ? 0.3 : 0.16) + 0.1 * random
    ),
  },
  {
    label: 'Bass',
    barClass: 'bg-white/55',
    values: lane(55, (position, _index, random) =>
      0.56 + 0.2 * Math.sin(position * Math.PI * 4.7) + 0.07 * random
    ),
  },
  {
    label: 'Other',
    barClass: 'bg-white/25',
    values: lane(89, (position, _index, random) =>
      0.14 + 0.34 * random + 0.12 * Math.sin(position * Math.PI * 6.2)
    ),
  },
];

function Lane({ values, barClass }: { values: number[]; barClass: string }) {
  return (
    <div className={`${styles.lane} flex h-full w-full items-center justify-between gap-px`}>
      {values.map((value, index) => (
        <span
          key={index}
          className={`w-[2px] shrink-0 rounded-full sm:w-[3px] ${barClass}`}
          style={{ height: `${Math.round(value * 100)}%` }}
        />
      ))}
    </div>
  );
}

/**
 * The separation result, drawn rather than screenshotted: one mix on top, four
 * stems underneath, and a playhead running the length of the panel.
 */
export default function StemPanel({ className = '' }: { className?: string }) {
  return (
    <figure
      className={`relative overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(165deg,rgba(255,255,255,0.07),rgba(255,255,255,0.015))] p-4 sm:rounded-3xl sm:p-8 ${className}`}
    >
      <figcaption className="flex items-baseline gap-4 text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-white/45 sm:text-[0.7rem]">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary" aria-hidden="true" />
          Your upload
        </span>
      </figcaption>

      <div className="relative mt-5 grid grid-cols-[3.5rem_1fr] items-center gap-x-3 gap-y-3 sm:mt-7 sm:grid-cols-[5.5rem_1fr] sm:gap-x-6 sm:gap-y-4">
        <span className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-white/40 sm:text-[0.65rem] sm:tracking-[0.22em]">
          Full mix
        </span>
        <div className="h-16 sm:h-24">
          <Lane values={fullMix} barClass="bg-white/85" />
        </div>

        <div className="col-span-2 flex items-center gap-3 py-1 sm:gap-5">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-tertiary/90 sm:text-[0.68rem] sm:tracking-[0.26em]">
            Demucs · 4-stem separation
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {stems.map((stem) => (
          <div key={stem.label} className="contents">
            <span className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-white/45 sm:text-[0.65rem] sm:tracking-[0.22em]">
              {stem.label}
            </span>
            <div className="h-9 sm:h-12">
              <Lane values={stem.values} barClass={stem.barClass} />
            </div>
          </div>
        ))}

        {/* Transport, offset past the label column so it lines up with the bars. */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 left-[4.25rem] sm:left-[7rem]"
          aria-hidden="true"
        >
          <div
            className={`${styles.played} absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,rgba(0,188,212,0)_0%,rgba(0,188,212,0.05)_55%,rgba(0,188,212,0.16)_100%)]`}
          />
          <div className={`${styles.playhead} absolute inset-y-0 w-px bg-white/70 shadow-[0_0_14px_2px_rgba(0,188,212,0.55)]`} />
        </div>
      </div>
    </figure>
  );
}
