import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, Camera as CameraIcon } from 'lucide-react';
import { Button } from './Button';
import { api } from '../services/apiClient';
import { useToast } from './Toast';

interface ImageUploadProps {
  label: string;
  subtitle?: string;
  imageUrl?: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
  maxSize?: number; // MB
  aspectRatio?: string; // "16:9", "1:1", "4:3"
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  label,
  subtitle,
  imageUrl,
  onUpload,
  onRemove,
  maxSize = 10,
  aspectRatio
}) => {
  const { addToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(imageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    // Validar tipo
    if (!file.type.startsWith('image/')) {
      addToast('Por favor, selecione uma imagem válida', 'error');
      return;
    }

    // Validar tamanho
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      addToast(`Imagem muito grande. Máximo: ${maxSize}MB`, 'error');
      return;
    }

    setUploading(true);

    try {
      // Upload para o servidor
      const { data, error } = await api.upload(file, file.name);

      if (error) {
        throw new Error(error);
      }

      const uploadedUrl = data.url;
      setPreview(uploadedUrl);
      onUpload(uploadedUrl);
      addToast('Imagem enviada com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro no upload:', error);
      addToast(error.message || 'Erro ao enviar imagem', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onRemove();
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '16:9':
        return 'aspect-video';
      case '1:1':
        return 'aspect-square';
      case '4:3':
        return 'aspect-[4/3]';
      default:
        return 'aspect-video';
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-white mb-2">
        {label}
      </label>
      {subtitle && (
        <p className="text-xs text-zinc-400 mb-3">{subtitle}</p>
      )}

      {preview ? (
        <div className="relative">
          <div className={`w-full ${getAspectRatioClass()} bg-zinc-900 rounded-lg overflow-hidden border border-zinc-700`}>
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          </div>
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 transition-colors"
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Upload da Galeria */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
            id={`file-upload-${label.replace(/\s+/g, '-')}`}
            disabled={uploading}
          />
          <label
            htmlFor={`file-upload-${label.replace(/\s+/g, '-')}`}
            className={`flex flex-col items-center justify-center w-full ${getAspectRatioClass()} border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-[#D4AF37] transition-colors bg-zinc-900/50 ${
              uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={32} className="text-[#D4AF37] animate-spin" />
                <span className="text-sm text-zinc-400">Enviando...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={32} className="text-zinc-400" />
                <span className="text-sm text-white font-medium">Escolher da Galeria</span>
                <span className="text-xs text-zinc-500">Máximo {maxSize}MB</span>
              </div>
            )}
          </label>

          {/* Captura via Câmera (Mobile) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInputChange}
            className="hidden"
            id={`camera-upload-${label.replace(/\s+/g, '-')}`}
            disabled={uploading}
          />
          <label
            htmlFor={`camera-upload-${label.replace(/\s+/g, '-')}`}
            className={`flex items-center justify-center gap-2 w-full py-3 border border-zinc-700 rounded-lg cursor-pointer hover:border-[#D4AF37] transition-colors bg-zinc-900/50 ${
              uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <CameraIcon size={20} className="text-zinc-400" />
            <span className="text-sm text-white font-medium">Tirar Foto</span>
          </label>
        </div>
      )}
    </div>
  );
};
