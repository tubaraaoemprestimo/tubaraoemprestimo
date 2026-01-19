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
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showRecorder, setShowRecorder] = useState(false);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const inputId = `video-upload-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;

  // Cleanup
  useEffect(() => {
    return () => {
      stopRecording();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

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

  const startRecording = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true
      });

      setStream(mediaStream);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = mediaStream;
        videoPreviewRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });

      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        onUpload(url);
        setShowRecorder(false);
        setRecordingTime(0);

        // Stop tracks
        mediaStream.getTracks().forEach(track => track.stop());
        setStream(null);
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 30) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.error('Error starting recording:', err);
      alert('Não foi possível acessar a câmera. Verifique as permissões.');
      setShowRecorder(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
  };

  const cancelRecording = () => {
    stopRecording();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowRecorder(false);
    setRecordingTime(0);
  };

  const handleStartRecorder = () => {
    setShowRecorder(true);
    startRecording();
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
        // Recording Mode
        <div className="relative rounded-xl overflow-hidden border-2 border-red-600 bg-black aspect-video">
          <video
            ref={videoPreviewRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]"
          />

          {/* Recording indicator */}
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-full">
            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-mono">{recordingTime}s / 30s</span>
          </div>

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 w-full h-1 bg-zinc-800">
            <div
              className="h-full bg-red-600 transition-all duration-1000"
              style={{ width: `${(recordingTime / 30) * 100}%` }}
            ></div>
          </div>

          {/* Controls */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
            <button
              onClick={cancelRecording}
              className="p-3 bg-zinc-800 border border-zinc-600 rounded-full text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <Trash2 size={20} />
            </button>

            <button
              onClick={stopRecording}
              className="p-4 bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30"
            >
              <Square size={24} />
            </button>
          </div>
        </div>
      ) : (
        // Upload Options
        <div className="space-y-3">
          {/* Record Button */}
          <button
            onClick={handleStartRecorder}
            className="flex items-center justify-center gap-3 w-full p-4 rounded-xl border-2 border-dashed border-red-600/50 bg-red-900/10 hover:bg-red-900/20 hover:border-red-600 transition-all cursor-pointer group"
          >
            <div className="p-2 bg-red-600 rounded-full text-white group-hover:scale-110 transition-transform">
              <Camera size={20} />
            </div>
            <div className="text-left">
              <span className="block text-sm font-bold text-red-400">Gravar Vídeo Agora</span>
              <span className="text-xs text-zinc-500">Use a câmera do celular</span>
            </div>
          </button>

          {/* Upload Button */}
          <div className="relative">
            <input
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              id={inputId}
              onChange={handleFileChange}
            />
            <label
              htmlFor={inputId}
              className={`flex items-center justify-center gap-3 w-full p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${loading
                  ? 'border-zinc-700 bg-zinc-900 opacity-50'
                  : 'border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 hover:border-[#D4AF37]'
                }`}
            >
              {loading ? (
                <Loader2 size={24} className="text-[#D4AF37] animate-spin" />
              ) : (
                <Upload size={24} className="text-zinc-500 group-hover:text-[#D4AF37]" />
              )}
              <div className="text-left">
                <span className="block text-sm font-medium text-zinc-300">
                  {loading ? "Processando..." : "Enviar Vídeo da Galeria"}
                </span>
                <span className="text-xs text-zinc-500">Máx: 30 segundos</span>
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
