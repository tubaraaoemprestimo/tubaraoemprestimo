import { useRef, useEffect } from 'react';

interface FunnelVideoProps {
  src:         string;
  poster?:     string;
  autoPlay?:   boolean;
  onPlay?:     () => void;
  onComplete?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// FunnelVideo — player reutilizável para todos os steps do funil.
// autoPlay inicia mudo (obrigatório pela política dos browsers modernos).
// ─────────────────────────────────────────────────────────────────────────────
export function FunnelVideo({ src, poster, autoPlay = false, onPlay, onComplete }: FunnelVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !autoPlay) return;
    video.muted = true;
    video.play().catch(() => {/* autoplay bloqueado pelo browser */});
  }, [autoPlay, src]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
      <video
        ref={ref}
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
        onPlay={onPlay}
        onEnded={onComplete}
      />
    </div>
  );
}
