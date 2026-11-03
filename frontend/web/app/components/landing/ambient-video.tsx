'use client';

import { useEffect, useRef } from 'react';

type AmbientVideoProps = {
  src: string;
  poster: string;
  className?: string;
};

/**
 * Decorative background clip. Nothing downloads until the clip is close to the
 * viewport, playback is paused the moment it leaves again, and anyone who has
 * asked for reduced motion just keeps the poster frame.
 */
export default function AmbientVideo({ src, poster, className = '' }: AmbientVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Autoplay can still be refused (data saver, low power mode); the
          // poster frame is a perfectly good fallback.
          video.play().catch(() => { });
        } else {
          video.pause();
        }
      },
      { rootMargin: '15% 0px' }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={videoRef}
      className={className}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src={src} type="video/webm" />
    </video>
  );
}
