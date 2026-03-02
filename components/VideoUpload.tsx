import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Video, Trash2, Upload, CheckCircle, Camera, Loader2, Square, AlertCircle } from 'lucide-react';

interface VideoUploadProps {
  label: string;
  onUpload: (videoUrl: string) => void;
  onRemove: () => void;
  videoUrl?: string;
  subtitle?: string;
}

const MIN_RECORDING_TIME = 30; // Mínimo 30 segundos

// Detectar plataforma
const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const hasMediaRecorderSupport = (): boolean => {
  return typeof MediaRecorder !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
};

export const VideoUpload: React.FC<VideoUploadProps> = ({ label, onUpload, onRemove, videoUrl, subtitle }) => {
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showRecorder, setShowRecorder] = useState(false);
  const [durationError, setDurationError] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimeRef = useRef(0); // Ref para acessar dentro de closures

  const inputId = `video-upload-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;
  const captureInputId = `video-capture-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;

  // Cleanup
  useEffect(() => {
    return () => {
      stopAndCleanup();
    };
  }, []);

  // Validar duração do vídeo selecionado da galeria ou câmera nativa
  const validateVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(0); // Não bloquear se não conseguir ler duração
      };
      video.src = URL.createObjectURL(file);
    });
  };

  // Upload de arquivo da galeria
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert("Por favor, envie apenas arquivos de vídeo.");
      return;
    }

    setLoading(true);
    setDurationError(null);

    try {
      const duration = await validateVideoDuration(file);

      if (duration > 0 && duration < MIN_RECORDING_TIME) {
        setDurationError(`Vídeo muito curto (${Math.round(duration)}s). Mínimo: ${MIN_RECORDING_TIME} segundos.`);
        setLoading(false);
        e.target.value = '';
        return;
      }

      const url = URL.createObjectURL(file);
      onUpload(url);
    } catch {
      alert('Erro ao processar o vídeo.');
    }
    setLoading(false);
    e.target.value = '';
  };

  // Upload via câmera nativa (iOS / fallback mobile)
  const handleNativeCaptureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setDurationError(null);

    try {
      const duration = await validateVideoDuration(file);

      if (duration > 0 && duration < MIN_RECORDING_TIME) {
        setDurationError(`Vídeo muito curto (${Math.round(duration)}s). Grave pelo menos ${MIN_RECORDING_TIME} segundos.`);
        setLoading(false);
        e.target.value = '';
        return;
      }

      const url = URL.createObjectURL(file);
      onUpload(url);
    } catch {
      alert('Erro ao processar o vídeo.');
    }
    setLoading(false);
    e.target.value = '';
  };

  // Abrir câmera com MediaRecorder (Desktop e Android)
  const openCamera = async () => {
    try {
      setShowRecorder(true);
      setDurationError(null);

      // Constraints adaptadas para mobile
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'user',
          width: { ideal: isMobile() ? 640 : 1280 },
          height: { ideal: isMobile() ? 480 : 720 }
        },
        audio: true
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      // Aguardar ref estar disponível
      requestAnimationFrame(() => {
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = mediaStream;
          videoPreviewRef.current.play().catch(() => { });
        }
      });

      setCameraReady(true);
    } catch (err: any) {
      console.error('Error opening camera:', err);

      // Fallback: se getUserMedia falhar, usar câmera nativa
      if (isMobile()) {
        setShowRecorder(false);
        // Trigger native capture
        const captureInput = document.getElementById(captureInputId);
        if (captureInput) captureInput.click();
      } else {
        alert('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
        setShowRecorder(false);
      }
    }
  };

  // Iniciar gravação
  const startRecording = () => {
    if (!stream) return;

    chunksRef.current = [];
    recordingTimeRef.current = 0;

    // Detectar o melhor mimeType suportado
    const getMimeType = (): string => {
      // Ordem de preferência: mp4 primeiro (melhor compatibilidade iOS/Safari)
      const types = [
        'video/mp4;codecs=h264,aac',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      for (const type of types) {
        try {
          if (MediaRecorder.isTypeSupported(type)) {
            return type;
          }
        } catch { /* ignore */ }
      }
      return '';
    };

    const mimeType = getMimeType();
    const options: MediaRecorderOptions = {};
    if (mimeType) options.mimeType = mimeType;

    // Bitrate para boa qualidade sem arquivo enorme
    options.videoBitsPerSecond = 1500000; // 1.5 Mbps

    let mediaRecorder: MediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(stream, options);
    } catch {
      // Fallback sem opções específicas
      try {
        mediaRecorder = new MediaRecorder(stream);
      } catch (err) {
        console.error('MediaRecorder creation failed:', err);
        alert('Seu navegador não suporta gravação de vídeo. Use a opção "Enviar da Galeria".');
        stopAndCleanup();
        return;
      }
    }

    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onerror = (e: any) => {
      console.error('MediaRecorder error:', e);
      alert('Erro durante a gravação. Tente novamente.');
      stopAndCleanup();
    };

    mediaRecorder.onstop = () => {
      if (chunksRef.current.length > 0) {
        const finalMimeType = mediaRecorder.mimeType || mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: finalMimeType });
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          onUpload(url);
        } else {
          alert('Vídeo vazio. Tente gravar novamente.');
        }
      } else {
        alert('Nenhum dado gravado. Tente novamente.');
      }
      stopAndCleanup();
    };

    // Coletar dados a cada 1 segundo (mais compatível que 500ms)
    try {
      mediaRecorder.start(1000);
    } catch {
      // Alguns browsers não suportam timeslice
      mediaRecorder.start();
    }

    setIsRecording(true);
    setRecordingTime(0);

    // Timer
    timerRef.current = setInterval(() => {
      recordingTimeRef.current += 1;
      setRecordingTime(recordingTimeRef.current);

      // Sem limite máximo - gravação continua até o usuário parar
    }, 1000);
  };

  // Finalizar gravação (forçado - auto-stop ou manual após min time)
  const finishRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.requestData();
      } catch { /* ignore */ }

      setTimeout(() => {
        try {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        } catch { /* ignore */ }
      }, 200);
    }

    setIsRecording(false);
  }, []);

  // Botão parar (só funciona se atingiu o mínimo)
  const stopRecording = () => {
    if (recordingTimeRef.current < MIN_RECORDING_TIME) {
      return; // Não permitir parar antes do tempo mínimo
    }
    finishRecording();
  };

  const stopAndCleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => {
        try { track.stop(); } catch { /* ignore */ }
      });
    }
    setStream(null);
    setShowRecorder(false);
    setCameraReady(false);
    setIsRecording(false);
    setRecordingTime(0);
    recordingTimeRef.current = 0;
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      // Parar sem processar
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    chunksRef.current = [];
    stopAndCleanup();
  };

  const handleStartRecorder = () => {
    // iOS: usar câmera nativa (mais confiável)
    if (isIOS() || !hasMediaRecorderSupport()) {
      const captureInput = document.getElementById(captureInputId);
      if (captureInput) captureInput.click();
      return;
    }
    openCamera();
  };

  const canUseInBrowserRecording = hasMediaRecorderSupport() && !isIOS();

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-[#D4AF37] font-semibold text-sm flex items-center gap-2">
          <Video size={16} /> {label}
          {videoUrl && <CheckCircle size={14} className="text-green-500" />}
        </label>
        {videoUrl && (
          <button onClick={onRemove} className="text-red-500 hover:text-red-400 text-xs flex items-center gap-1">
            <Trash2 size={12} /> Remover
          </button>
        )}
      </div>

      {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}

      {/* Erro de duração */}
      {durationError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          {durationError}
        </div>
      )}

      {/* Input oculto para captura nativa (iOS e fallback) */}
      <input
        type="file"
        accept="video/*"
        capture="user"
        className="hidden"
        id={captureInputId}
        onChange={handleNativeCaptureChange}
      />

      {videoUrl ? (
        // Video Preview
        <div className="relative rounded-xl overflow-hidden border border-green-700/50 bg-black aspect-video">
          <video
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-contain"
          />
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <CheckCircle size={12} /> Salvo
          </div>
        </div>
      ) : showRecorder ? (
        // Camera/Recording Mode (Desktop e Android com MediaRecorder)
        <div className="relative rounded-xl overflow-hidden border-2 border-[#D4AF37] bg-black aspect-video">
          <video
            ref={videoPreviewRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]"
            style={{ WebkitTransform: 'scaleX(-1)' }}
          />

          {/* Status indicator */}
          <div className="absolute top-3 left-3 right-3 flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-full">
            {isRecording ? (
              <>
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse flex-shrink-0"></div>
                <span className="text-white text-sm font-mono">
                  {recordingTime}s
                  {recordingTime < MIN_RECORDING_TIME ? (
                    <span className="text-yellow-400 ml-1">
                      (mín: {MIN_RECORDING_TIME - recordingTime}s)
                    </span>
                  ) : (
                    <span className="text-green-400 ml-1">✓</span>
                  )}
                </span>
              </>
            ) : cameraReady ? (
              <>
                <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                <span className="text-white text-sm">Pronta - Mín. {MIN_RECORDING_TIME}s</span>
              </>
            ) : (
              <>
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse flex-shrink-0"></div>
                <span className="text-white text-sm">Carregando câmera...</span>
              </>
            )}
          </div>

          {/* Progress bar */}
          {isRecording && (
            <div className="absolute bottom-0 left-0 w-full h-1.5 bg-zinc-800">
              <div
                className={`h-full transition-all duration-1000 ${
                  recordingTime < MIN_RECORDING_TIME ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((recordingTime / MIN_RECORDING_TIME) * 100, 100)}%` }}
              ></div>
            </div>
          )}

          {/* Controls */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
            <button
              onClick={cancelRecording}
              className="p-3 bg-zinc-800 border border-zinc-600 rounded-full text-zinc-300 hover:bg-zinc-700 transition-colors"
              title="Cancelar"
            >
              <Trash2 size={20} />
            </button>

            {!isRecording && cameraReady ? (
              <button
                onClick={startRecording}
                className="p-4 bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30 flex items-center gap-2"
              >
                <Video size={24} />
                <span className="text-sm font-bold pr-2">Gravar {MIN_RECORDING_TIME}s</span>
              </button>
            ) : isRecording ? (
              <button
                onClick={stopRecording}
                disabled={recordingTime < MIN_RECORDING_TIME}
                className={`p-4 rounded-full text-white transition-colors shadow-lg flex items-center gap-2 ${
                  recordingTime < MIN_RECORDING_TIME
                    ? 'bg-zinc-700 cursor-not-allowed opacity-50'
                    : 'bg-green-600 hover:bg-green-700 shadow-green-500/30'
                }`}
                title={recordingTime < MIN_RECORDING_TIME ? `Aguarde mais ${MIN_RECORDING_TIME - recordingTime}s` : 'Finalizar gravação'}
              >
                <Square size={24} />
                {recordingTime >= MIN_RECORDING_TIME && (
                  <span className="text-sm font-bold pr-1">Finalizar</span>
                )}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        // Upload Options
        <div className="space-y-3">
          {/* Upload from gallery */}
          <div className="relative">
            <input
              type="file"
              accept="video/*"
              className="hidden"
              id={inputId}
              onChange={handleFileChange}
            />
            <label
              htmlFor={inputId}
              className={`flex items-center justify-center gap-3 w-full p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${loading
                ? 'border-zinc-700 bg-zinc-900 opacity-50'
                : 'border-[#D4AF37] bg-zinc-900/50 hover:bg-zinc-800'
                }`}
            >
              {loading ? (
                <Loader2 size={24} className="text-[#D4AF37] animate-spin" />
              ) : (
                <Upload size={24} className="text-[#D4AF37]" />
              )}
              <div className="text-left">
                <span className="block text-sm font-bold text-white">
                  {loading ? "Processando..." : "Enviar Vídeo da Galeria"}
                </span>
                <span className="text-xs text-zinc-500">Mínimo: {MIN_RECORDING_TIME} segundos</span>
              </div>
            </label>
          </div>

          {/* Record button */}
          <button
            onClick={handleStartRecorder}
            className="flex items-center justify-center gap-3 w-full p-4 rounded-xl border border-zinc-700 bg-black hover:bg-zinc-900 transition-all cursor-pointer group"
          >
            <div className="p-2 bg-zinc-800 rounded-full text-white group-hover:bg-red-600 transition-colors">
              <Camera size={20} />
            </div>
            <div className="text-left">
              <span className="block text-sm font-medium text-zinc-300 group-hover:text-white">
                {canUseInBrowserRecording ? 'Gravar Vídeo Agora' : 'Abrir Câmera'}
              </span>
              <span className="text-xs text-zinc-500">
                {canUseInBrowserRecording
                  ? `Grave ${MIN_RECORDING_TIME}s com a câmera`
                  : `Grave pelo menos ${MIN_RECORDING_TIME}s`
                }
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
