import React from 'react';
import { X, CheckCircle2, Share2, Download, Building2, Phone } from 'lucide-react';
import { Button } from './Button';
import { useBrand } from '../contexts/BrandContext';

interface ReceiptModalProps {
  data: {
    amount: number;
    date: string;
    description: string;
    id: string;
  };
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ data, onClose }) => {
  const { settings } = useBrand();

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Comprovante ${settings.systemName}`,
          text: `Comprovante de pagamento: R$ ${data.amount.toFixed(2)}`,
          url: window.location.href
        });
      } catch (error) {
        console.log('Share canceled');
      }
    } else {
        alert("Comprovante copiado!");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-white text-black w-full max-w-sm rounded-none shadow-2xl relative overflow-hidden font-mono">
        {/* Paper jagged edge top */}
        <div className="absolute top-0 left-0 w-full h-2 bg-[linear-gradient(45deg,transparent_33.333%,#fff_33.333%,#fff_66.667%,transparent_66.667%),linear-gradient(-45deg,transparent_33.333%,#fff_33.333%,#fff_66.667%,transparent_66.667%)] bg-[length:12px_24px] bg-[position:0_-12px]"></div>
        
        <div className="p-6 pt-8 pb-8">
            <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full border-4 border-black flex items-center justify-center">
                    <CheckCircle2 size={32} />
                </div>
            </div>
            
            <h2 className="text-center text-xl font-bold uppercase tracking-widest mb-1">RECIBO DE PAGAMENTO</h2>
            
            {/* Dynamic Company Info */}
            <div className="text-center text-xs text-gray-500 mb-6 flex flex-col gap-1">
                <p className="font-bold uppercase text-black">{settings.companyName}</p>
                <p>CNPJ: {settings.cnpj}</p>
                <p>{settings.address}</p>
            </div>

            <div className="border-t-2 border-dashed border-gray-300 my-4"></div>

            <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                    <span className="text-gray-600">Valor Pago</span>
                    <span className="font-bold text-lg">R$ {data.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Data</span>
                    <span>{new Date(data.date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Hora</span>
                    <span>{new Date(data.date).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Descrição</span>
                    <span className="text-right max-w-[150px]">{data.description}</span>
                </div>
            </div>

            <div className="border-t-2 border-dashed border-gray-300 my-6"></div>

            <div className="text-center space-y-1">
                <p className="text-xs text-gray-500 uppercase">Autenticação</p>
                <p className="text-[10px] break-all font-mono text-gray-400">{data.id.toUpperCase()}-{Date.now().toString(36).toUpperCase()}</p>
            </div>
            
            {/* Support Info */}
            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center gap-2 text-xs text-gray-400">
                <Phone size={10} /> {settings.phone}
            </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex gap-2">
            <button onClick={handleShare} className="flex-1 bg-black text-white py-3 rounded text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-800">
                <Share2 size={16} /> COMPARTILHAR
            </button>
            <button onClick={onClose} className="px-4 py-3 border border-gray-300 rounded hover:bg-gray-200 text-black">
                <X size={20} />
            </button>
        </div>

        {/* Paper jagged edge bottom */}
        <div className="absolute bottom-0 left-0 w-full h-2 bg-[linear-gradient(45deg,transparent_33.333%,#fff_33.333%,#fff_66.667%,transparent_66.667%),linear-gradient(-45deg,transparent_33.333%,#fff_33.333%,#fff_66.667%,transparent_66.667%)] bg-[length:12px_24px] bg-[position:0_12px] rotate-180"></div>
      </div>
    </div>
  );
};