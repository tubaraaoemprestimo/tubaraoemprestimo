
import React, { useState, useRef } from 'react';
import { Video, Trash2, Upload, CheckCircle } from 'lucide-react';
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
  const inputId = `video-upload-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        alert("Por favor, envie apenas arquivos de vídeo.");
        return;
      }
      
      // In a real app, you would upload to server here.
      // For this prototype, we use ObjectURL for immediate preview.
      // Warning: In production, large videos should be chunk-uploaded.
      setLoading(true);
      
      setTimeout(() => {
          const url = URL.createObjectURL(file);
          onUpload(url);
          setLoading(false);
      }, 1000);
    }
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
          <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-black aspect-video">
             <video 
                src={videoUrl} 
                controls 
                className="w-full h-full object-contain"
             />
          </div>
      ) : (
          <div className="relative group">
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
                  className={`flex flex-col items-center justify-center gap-2 w-full p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                      loading 
                      ? 'border-zinc-700 bg-zinc-900 opacity-50' 
                      : 'border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 hover:border-[#D4AF37]'
                  }`}
              >
                  {loading ? (
                      <div className="w-8 h-8 border-4 border-zinc-600 border-t-[#D4AF37] rounded-full animate-spin"></div>
                  ) : (
                      <Upload size={24} className="text-zinc-500 group-hover:text-[#D4AF37]" />
                  )}
                  <span className="text-xs text-zinc-400 font-medium">
                      {loading ? "Processando..." : "Gravar ou Escolher Vídeo"}
                  </span>
                  <span className="text-[10px] text-zinc-600">Máx: 30 segundos</span>
              </label>
          </div>
      )}
    </div>
  );
};
