export default function Home() {
  return (
    <div className="main flex flex-col items-center w-full" style={{ padding: 0 }}>

      {/* Full-Screen Video Section */}
      <section className="relative w-full h-[calc(100vh-4rem)] flex flex-col items-center justify-center overflow-hidden">

        {/* Background Video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
        >
          <source src="videos/1.mp4" type="video/mp4" />
          {/* <source src="videos/noise-reduction720.webm" type="video/webm" /> */}
          Your browser does not support the video tag.
        </video>

        {/* Dark Cinematic Overlay */}
        <div className="absolute inset-0 bg-black/60 z-10" />

        {/* Centered Text Content */}
        <div className="relative z-20 w-full max-w-4xl mx-auto px-6 text-center flex flex-col items-center space-y-6 md:space-y-8">
          <span className="text-secondary font-semibold tracking-[0.2em] uppercase text-sm md:text-base drop-shadow-md">
            Noise Reduction
          </span>
          <h2 className="text-white text-5xl md:text-7xl lg:text-8xl font-bold leading-tight drop-shadow-2xl">
            Crystal Clear Audio
          </h2>
          <p className="text-white/80 text-lg md:text-2xl leading-relaxed max-w-3xl drop-shadow-lg font-light">
            Clean up your tracks with state-of-the-art noise reduction. Our platform offers
            automatic background noise detection to instantly enhance your audio. For ultimate
            precision, you can also take control by manually selecting specific noise clips
            to isolate and remove complex interference.
          </p>
        </div>

      </section>

      {/* Track Separation Section */}
      <section className="relative w-full h-[calc(100vh-4rem)] flex flex-col items-center justify-center overflow-hidden">

        {/* Background Video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
        >
          <source src="videos/track-separation720.webm" type="video/webm" />
          Your browser does not support the video tag.
        </video>

        {/* Dark Cinematic Overlay */}
        <div className="absolute inset-0 bg-black/60 z-10" />

        {/* Centered Text Content */}
        <div className="relative z-20 w-full max-w-4xl mx-auto px-6 text-center flex flex-col items-center space-y-6 md:space-y-8">
          <span className="text-tertiary font-semibold tracking-[0.2em] uppercase text-sm md:text-base drop-shadow-md">
            Track Separation
          </span>
          <h2 className="text-white text-5xl md:text-7xl lg:text-8xl font-bold leading-tight drop-shadow-2xl">
            Isolate Every Element
          </h2>
          <p className="text-white/80 text-lg md:text-2xl leading-relaxed max-w-3xl drop-shadow-lg font-light">
            Deconstruct your music with unparalleled precision. Choose between our powerful
            4-stem and 6-stem separation models to seamlessly extract vocals, drums, bass,
            and other instruments from any mixed track.
          </p>
        </div>

      </section>

      {/* Audio Analysis Section */}
      <section className="relative w-full h-[calc(100vh-4rem)] flex flex-col items-center justify-center overflow-hidden">

        {/* Background Video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
        >
          <source src="videos/analysis1080.webm" type="video/webm" />
          Your browser does not support the video tag.
        </video>

        {/* Dark Cinematic Overlay */}
        <div className="absolute inset-0 bg-black/60 z-10" />

        {/* Centered Text Content */}
        <div className="relative z-20 w-full max-w-4xl mx-auto px-6 text-center flex flex-col items-center space-y-6 md:space-y-8">
          <span className="text-tertiary font-semibold tracking-[0.2em] uppercase text-sm md:text-base drop-shadow-md">
            Audio Analysis
          </span>
          <h2 className="text-white text-5xl md:text-7xl lg:text-8xl font-bold leading-tight drop-shadow-2xl">
            Deep Musical Insights
          </h2>
          <p className="text-white/80 text-lg md:text-2xl leading-relaxed max-w-3xl drop-shadow-lg font-light">
            Unlock the underlying structure of any song instantly. Our advanced analysis
            engine automatically detects chords, key signatures, and BPM, giving you the
            essential information you need to learn, remix, or deconstruct your music.
          </p>
        </div>

      </section>

    </div>
  );
}
