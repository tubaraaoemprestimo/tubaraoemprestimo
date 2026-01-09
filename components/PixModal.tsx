
import React, { useState } from 'react';
import { X, Copy, CheckCircle2, Clock, Upload, Loader2 } from 'lucide-react';
import { Button } from './Button';

interface PixModalProps {
  amount: number;
  pixCode: string;
  onClose: () => void;
  onUploadProof?: (file: string) => Promise<void>; // New prop
}

export const PixModal: React.FC<PixModalProps> = ({ amount, pixCode, onClose, onUploadProof }) => {
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadProof) {
        setUploading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            const result = reader.result as string;
            await onUploadProof(result);
            setUploading(false);
            onClose();
        };
        reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white p-2">
          <X size={24} />
        </button>

        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center mb-4">
             <img src="https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo%E2%80%94pix_powered_by_Banco_Central_%28Brazil%2C_2020%29.svg" alt="Pix" className="w-10 opacity-80" />
          </div>
          
          <h2 className="text-xl font-bold text-white mb-1">Pagamento via Pix</h2>
          <p className="text-zinc-400 text-sm mb-6">Escaneie o QR Code ou copie o código abaixo.</p>

          <div className="bg-white p-4 rounded-xl mb-6">
             {/* Using a placeholder QR code API for demo visualization */}
             <img 
               src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`} 
               alt="QR Code" 
               className="w-48 h-48"
             />
          </div>

          <div className="mb-6">
             <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Valor a Pagar</div>
             <div className="text-3xl font-bold text-[#D4AF37]">R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>

          <div className="w-full bg-black border border-zinc-800 rounded-xl p-4 mb-4 flex items-center justify-between gap-4 group cursor-pointer hover:border-[#D4AF37]/50 transition-colors" onClick={handleCopy}>
             <div className="flex-1 overflow-hidden">
                <p className="text-xs text-zinc-500 mb-1 text-left">Código Copia e Cola</p>
                <p className="text-zinc-300 text-xs truncate font-mono text-left">{pixCode}</p>
             </div>
             <div className={`${copied ? 'text-green-500' : 'text-[#D4AF37]'}`}>
                {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
             </div>
          </div>

          <div className="w-full space-y-2">
             {/* Upload Button */}
             {onUploadProof && (
                 <div className="relative">
                    <input 
                        type="file" 
                        id="proof-upload" 
                        accept="image/*,application/pdf"
                        className="hidden" 
                        onChange={handleFileChange}
                        disabled={uploading}
                    />
                    <label 
                        htmlFor="proof-upload" 
                        className={`flex items-center justify-center gap-2 w-full p-4 rounded-xl cursor-pointer transition-colors font-bold ${
                            uploading ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-[#D4AF37] text-black hover:bg-[#B5942F]'
                        }`}
                    >
                        {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                        {uploading ? "Enviando..." : "Anexar Comprovante"}
                    </label>
                 </div>
             )}
             
             <Button onClick={onClose} variant="secondary" className="w-full" disabled={uploading}>
                Fechar
             </Button>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900/50 py-1 px-3 rounded-full">
             <Clock size={12} />
             <span>Este código expira em 30 minutos</span>
          </div>
        </div>
      </div>
    </div>
  );
};
