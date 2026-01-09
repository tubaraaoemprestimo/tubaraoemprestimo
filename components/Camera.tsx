import React, { useRef, useState, useEffect } from 'react';
import { Camera as CameraIcon, RefreshCw, CheckCircle, Upload, AlertCircle, Image as ImageIcon } from 'lucide-react';
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

  // Generate a unique ID for the upload input
  const inputId = `upload-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setError(null);
    setIsLoading(true);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Seu navegador não suporta acesso à câmera. Por favor, utilize o upload.");
      setIsLoading(false);
      return;
    }

    try {
      // Attempt 1: Try with preferred facing mode 'user'
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      handleStreamSuccess(mediaStream);
    } catch (err: any) {
      console.warn("Primary camera attempt failed:", err);
      
      try {
        // Attempt 2: Relax constraints completely (any video device)
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
        handleStreamSuccess(mediaStream);
      } catch (fallbackErr: any) {
        console.error("All camera attempts failed:", fallbackErr);
        handleError(fallbackErr);
      }
    }
    setIsLoading(false);
  };

  const handleStreamSuccess = (mediaStream: MediaStream) => {
    setStream(mediaStream);
    setError(null);
    if (videoRef.current) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(e => console.error("Error playing video:", e));
    }
  };

  const handleError = (err: any) => {
    let msg = "Erro ao acessar câmera.";
    
    // Check specific error names or messages
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError' || err.message?.includes('not found')) {
      msg = "Nenhuma câmera encontrada no dispositivo. Por favor, faça o upload do arquivo.";
    } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
       msg = "Permissão da câmera negada. Habilite nas configurações ou use o upload.";
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
       msg = "A câmera está em uso por outro app. Feche outros apps ou use o upload.";
    } else if (err.name === 'OverconstrainedError') {
       msg = "Câmera solicitada não disponível. Tente o upload.";
    }
    
    setError(msg);
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Mirror the image only if we think it's a user-facing camera (heuristic)
        // Usually plain 'video: true' might be back camera on mobile, but let's keep consistent mirroring for self-view UX
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Reset transform
        context.setTransform(1, 0, 0, 1, 0, 0);

        const imageSrc = canvas.toDataURL('image/png');
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
  };

  return (
    <div className={`flex flex-col gap-4 p-4 border rounded-xl bg-zinc-900/50 transition-colors ${error ? 'border-red-900/50' : 'border-zinc-800'}`}>
      <h3 className="text-[#D4AF37] font-semibold flex items-center gap-2">
        {label}
        {error && <span className="text-xs text-red-500 font-normal ml-auto">Erro de Câmera</span>}
      </h3>
      
      {/* Viewport Area */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center group shadow-inner">
        
        {capturedImage ? (
          <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
        ) : stream ? (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transform scale-x-[-1]" 
          />
        ) : (
          <div className="text-zinc-500 flex flex-col items-center p-4 text-center w-full">
             {error ? (
                <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                    <AlertCircle className="text-red-500 mb-2" size={40} />
                    <p className="text-red-400 text-sm mb-4 max-w-[250px] font-medium leading-relaxed">{error}</p>
                </div>
             ) : (
                <>
                    <CameraIcon size={48} className="mb-2 opacity-50 text-[#D4AF37]" />
                    <p className="text-sm">Câmera inativa</p>
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
                  stream ? (
                      <Button onClick={capturePhoto} className="w-full shadow-[0_0_15px_rgba(212,175,55,0.3)]">
                          <div className="w-4 h-4 bg-white rounded-full mr-2 animate-pulse"></div> Capturar Foto
                      </Button>
                  ) : (
                      <Button onClick={startCamera} className="w-full" variant="secondary" isLoading={isLoading}>
                          <CameraIcon size={18} className="mr-2" /> 
                          {isLoading ? "Iniciando..." : "Ativar Câmera"}
                      </Button>
                  )
                )}

                {/* Upload Action (Enhanced visibility on error) */}
                <div className="relative group">
                    <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        id={inputId}
                        onChange={handleFileUpload} 
                    />
                    <label 
                        htmlFor={inputId}
                        className={`flex items-center justify-center gap-2 w-full p-3 rounded-lg border cursor-pointer transition-all text-sm font-medium
                          ${error 
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] hover:bg-[#B5942F] shadow-lg animate-pulse' 
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