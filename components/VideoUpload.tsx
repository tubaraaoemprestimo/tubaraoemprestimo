import React, { useState, useRef, useEffect } from 'react';
import { Video, Trash2, Upload, CheckCircle, Camera, StopCircle, Loader2, Play, Square } from 'lucide-react';
import { Button } from './Button';

interface VideoUploadProps {
  label: string;
  onUpload: (videoUrl: string) => void;
  onRemove: () => void;
  videoUrl?: string;
  subtitle?: string;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({ label, onUpload, onRemove, videoUrl, subtitle }) => {
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false); // Câmera aberta mas ainda não gravando
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showRecorder, setShowRecorder] = useState(false);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const inputId = `video-upload-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;

  // Cleanup
  useEffect(() => {
    return () => {
      stopAndCleanup();
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        alert("Por favor, envie apenas arquivos de vídeo.");
        return;
      }

      setLoading(true);
      setTimeout(() => {
        const url = URL.createObjectURL(file);
        onUpload(url);
        setLoading(false);
      }, 500);
    }
  };

  // Abrir câmera e mostrar preview (sem gravar ainda)
  const openCamera = async () => {
    try {
      setShowRecorder(true);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });

      setStream(mediaStream);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = mediaStream;
        videoPreviewRef.current.play().catch(() => { });
      }

      setCameraReady(true);
    } catch (err) {
      console.error('Error opening camera:', err);
      alert('Não foi possível acessar a câmera. Verifique as permissões.');
      setShowRecorder(false);
    }
  };

  // Iniciar gravação (após câmera já estar aberta)
  const startRecording = () => {
    if (!stream) return;

    chunksRef.current = [];

    // Detectar o melhor mimeType suportado pelo dispositivo
    const getMimeType = () => {
      const types = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4;codecs=h264,aac',
        'video/mp4'
      ];
      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      }
      return '';
    };

    const mimeType = getMimeType();
    const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

    const mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        console.log('Chunk collected:', e.data.size, 'bytes, Total chunks:', chunksRef.current.length);
      }
    };

    mediaRecorder.onstop = () => {
      console.log('MediaRecorder stopped. Chunks:', chunksRef.current.length);
      if (chunksRef.current.length > 0) {
        const finalMimeType = mediaRecorder.mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: finalMimeType });
        console.log('Blob created:', blob.size, 'bytes');
        const url = URL.createObjectURL(blob);
        onUpload(url);
      } else {
        console.error('No chunks collected!');
        alert('Erro ao gravar vídeo. Tente novamente.');
      }
      stopAndCleanup();
    };

    // Usar intervalo menor para coletar dados mais frequentemente
    mediaRecorder.start(500);
    setIsRecording(true);
    setRecordingTime(0);

    // Timer
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 60) {
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      // Forçar coleta de dados pendentes antes de parar
      mediaRecorderRef.current.requestData();
      // Pequeno delay para garantir que o último chunk seja coletado
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      }, 100);
    }

    setIsRecording(false);
  };

  const stopAndCleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setShowRecorder(false);
    setCameraReady(false);
    setIsRecording(false);
    setRecordingTime(0);
  };

  const cancelRecording = () => {
    stopAndCleanup();
  };

  const handleStartRecorder = () => {
    openCamera();
  };

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

      {videoUrl ? (
        // Video Preview
        <div className="relative rounded-xl overflow-hidden border border-green-700/50 bg-black aspect-video">
          <video
            src={videoUrl}
            controls
            className="w-full h-full object-contain"
          />
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <CheckCircle size={12} /> Salvo
          </div>
        </div>
      ) : showRecorder ? (
        // Camera/Recording Mode
        <div className="relative rounded-xl overflow-hidden border-2 border-[#D4AF37] bg-black aspect-video">
          <video
            ref={videoPreviewRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]"
          />

          {/* Status indicator */}
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-full">
            {isRecording ? (
              <>
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                <span className="text-white text-sm font-mono">{recordingTime}s / 60s</span>
              </>
            ) : cameraReady ? (
              <>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-white text-sm">Câmera pronta</span>
              </>
            ) : (
              <>
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-white text-sm">Carregando...</span>
              </>
            )}
          </div>

          {/* Progress bar (só aparece quando gravando) */}
          {isRecording && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-zinc-800">
              <div
                className="h-full bg-red-600 transition-all duration-1000"
                style={{ width: `${(recordingTime / 60) * 100}%` }}
              ></div>
            </div>
          )}

          {/* Controls */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
            <button
              onClick={cancelRecording}
              className="p-3 bg-zinc-800 border border-zinc-600 rounded-full text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <Trash2 size={20} />
            </button>

            {!isRecording && cameraReady ? (
              // Botão para INICIAR gravação
              <button
                onClick={startRecording}
                className="p-4 bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30 flex items-center gap-2"
              >
                <Video size={24} />
                <span className="text-sm font-bold pr-2">Gravar</span>
              </button>
            ) : isRecording ? (
              // Botão para PARAR gravação
              <button
                onClick={stopRecording}
                className="p-4 bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30"
              >
                <Square size={24} />
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        // Upload Options
        <div className="space-y-3">
          {/* Upload Button (Primary) */}
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
                <span className="text-xs text-zinc-500">Máx: 1 minuto</span>
              </div>
            </label>
          </div>

          {/* Record Button (Secondary) */}
          <button
            onClick={handleStartRecorder}
            className="flex items-center justify-center gap-3 w-full p-4 rounded-xl border border-zinc-700 bg-black hover:bg-zinc-900 transition-all cursor-pointer group"
          >
            <div className="p-2 bg-zinc-800 rounded-full text-white group-hover:bg-red-600 transition-colors">
              <Camera size={20} />
            </div>
            <div className="text-left">
              <span className="block text-sm font-medium text-zinc-300 group-hover:text-white">Gravar Vídeo Agora</span>
              <span className="text-xs text-zinc-500">Use a câmera</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
