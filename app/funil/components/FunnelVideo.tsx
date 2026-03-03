'use client';

import { useRef, useEffect } from 'react';

interface FunnelVideoProps {
  src:        string;
  poster?:    string;
  autoPlay?:  boolean;
  onPlay?:    () => void;
  onComplete?: () => void;
}

// ---------------------------------------------------------------
// FunnelVideo — player de vídeo reutilizável para o funil
//
// - autoPlay: inicia silenciado (política dos browsers)
// - onPlay / onComplete: callbacks para tracking de eventos
// - Aspect ratio 16/9 responsivo
// ---------------------------------------------------------------
export function FunnelVideo({ src, poster, autoPlay = false, onPlay, onComplete }: FunnelVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // AutoPlay silenciado ao montar (obrigatório por política dos browsers)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoPlay) return;

    video.muted  = true;
    video.play().catch(() => {
      // AutoPlay bloqueado pelo browser — ignora silenciosamente
    });
  }, [autoPlay]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
      <video
        ref={videoRef}
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
