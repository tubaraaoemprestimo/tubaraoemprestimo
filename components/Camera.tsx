import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera as CameraIcon, RefreshCw, CheckCircle, Upload, AlertCircle, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from './Button';

interface CameraProps {
  onCapture: (imageSrc: string) => void;
  label: string;
}

export const Camera: React.FC<CameraProps> = ({ onCapture, label }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  // Generate a unique ID for the upload input
  const inputId = `upload-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Effect to handle video element when stream changes
  useEffect(() => {
    if (stream && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = stream;

      const handleCanPlay = () => {
        setCameraReady(true);
        video.play()
          .then(() => console.log("Camera video playing"))
          .catch(e => console.error("Error playing video:", e));
      };

      const handleLoadedMetadata = () => {
        console.log("Video metadata loaded:", video.videoWidth, "x", video.videoHeight);
      };

      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);

      // Try to play immediately as well
      video.play().catch(() => { });

      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [stream]);

  const startCamera = async () => {
    setError(null);
    setIsLoading(true);
    setCameraReady(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Seu navegador não suporta acesso à câmera. Por favor, utilize o upload.");
      setIsLoading(false);
      return;
    }

    try {
      // Try front camera first (for selfie)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      console.log("Camera stream obtained:", mediaStream.getVideoTracks()[0].label);
      setStream(mediaStream);
      setError(null);
    } catch (err: any) {
      console.warn("Front camera failed, trying any camera:", err);

      try {
        // Fallback: any camera
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });

        console.log("Fallback camera stream obtained:", mediaStream.getVideoTracks()[0].label);
        setStream(mediaStream);
        setError(null);
      } catch (fallbackErr: any) {
        console.error("All camera attempts failed:", fallbackErr);
        handleError(fallbackErr);
      }
    }

    setIsLoading(false);
  };

  const handleError = (err: any) => {
    let msg = "Erro ao acessar câmera.";

    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError' || err.message?.includes('not found')) {
      msg = "Nenhuma câmera encontrada. Por favor, faça o upload do arquivo.";
    } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      msg = "Permissão da câmera negada. Habilite nas configurações ou use o upload.";
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      msg = "A câmera está em uso por outro app. Feche outros apps ou use o upload.";
    } else if (err.name === 'OverconstrainedError') {
      msg = "Câmera solicitada não disponível. Tente o upload.";
    } else if (err.name === 'SecurityError') {
      msg = "Acesso à câmera bloqueado. Use HTTPS ou upload.";
    }

    setError(msg);
    setStream(null);
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log("Camera track stopped:", track.label);
      });
      setStream(null);
      setCameraReady(false);
    }
  }, [stream]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.error("Video dimensions are 0, cannot capture");
        setError("Câmera não está pronta. Aguarde ou tente novamente.");
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');

      if (context) {
        // Mirror the image for selfie camera
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        context.setTransform(1, 0, 0, 1, 0, 0);

        const imageSrc = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageSrc);
        onCapture(imageSrc);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError("Por favor, envie apenas arquivos de imagem.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const imageSrc = reader.result as string;
        setCapturedImage(imageSrc);
        onCapture(imageSrc);
        setError(null);
        stopCamera();
      };
      reader.onerror = () => {
        setError("Erro ao ler o arquivo.");
      };
      reader.readAsDataURL(file);
    }
  };

  const retake = () => {
    setCapturedImage(null);
    onCapture('');
    setError(null);
    setCameraReady(false);
  };

  return (
    <div className={`flex flex-col gap-4 p-4 border rounded-xl bg-zinc-900/50 transition-colors ${error ? 'border-red-900/50' : 'border-zinc-800'}`}>
      <h3 className="text-[#D4AF37] font-semibold flex items-center gap-2">
        {label}
        {error && <span className="text-xs text-red-500 font-normal ml-auto">Erro de Câmera</span>}
        {stream && cameraReady && <span className="text-xs text-green-500 font-normal ml-auto flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Ativa</span>}
      </h3>

      {/* Viewport Area */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center group shadow-inner">

        {capturedImage ? (
          <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
        ) : stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
              </div>
            )}
          </>
        ) : (
          <div className="text-zinc-500 flex flex-col items-center p-4 text-center w-full">
            {error ? (
              <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                <AlertCircle className="text-red-500 mb-2" size={40} />
                <p className="text-red-400 text-sm mb-4 max-w-[250px] font-medium leading-relaxed">{error}</p>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="animate-spin text-[#D4AF37] mb-2" size={48} />
                <p className="text-sm">Iniciando câmera...</p>
              </div>
            ) : (
              <>
                <CameraIcon size={48} className="mb-2 opacity-50 text-[#D4AF37]" />
                <p className="text-sm">Clique em "Ativar Câmera" para começar</p>
              </>
            )}
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        {/* If image captured */}
        {capturedImage && (
          <div className="flex gap-2 w-full animate-in slide-in-from-bottom-2">
            <div className="flex-1 flex items-center justify-center gap-2 text-green-500 font-bold border border-green-500/30 bg-green-500/10 rounded-lg p-2 text-sm">
              <CheckCircle size={18} /> Foto Salva
            </div>
            <Button onClick={retake} variant="secondary">
              <RefreshCw size={18} />
            </Button>
          </div>
        )}

        {/* If no image captured yet */}
        {!capturedImage && (
          <div className="flex flex-col gap-3 w-full">
            {/* Camera Actions */}
            {!error && (
              stream && cameraReady ? (
                <Button onClick={capturePhoto} className="w-full shadow-[0_0_15px_rgba(212,175,55,0.3)]">
                  <div className="w-4 h-4 bg-white rounded-full mr-2 animate-pulse"></div> Capturar Foto
                </Button>
              ) : stream && !cameraReady ? (
                <Button className="w-full" variant="secondary" disabled>
                  <Loader2 size={18} className="mr-2 animate-spin" /> Aguardando câmera...
                </Button>
              ) : (
                <Button onClick={startCamera} className="w-full" variant="secondary" isLoading={isLoading}>
                  <CameraIcon size={18} className="mr-2" />
                  {isLoading ? "Iniciando..." : "Ativar Câmera"}
                </Button>
              )
            )}

            {/* Upload Action */}
            <div className="relative group">
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                id={inputId}
                onChange={handleFileUpload}
              />
              <label
                htmlFor={inputId}
                className={`flex items-center justify-center gap-2 w-full p-3 rounded-lg border cursor-pointer transition-all text-sm font-medium
                  ${error
                    ? 'bg-[#D4AF37] text-black border-[#D4AF37] hover:bg-[#B5942F] shadow-lg'
                    : 'border-zinc-700 hover:bg-zinc-800 hover:text-white text-zinc-400'
                  }`}
              >
                {error ? <Upload size={18} /> : <ImageIcon size={16} />}
                {error ? "Fazer Upload do Arquivo" : "Ou faça upload de uma foto"}
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};