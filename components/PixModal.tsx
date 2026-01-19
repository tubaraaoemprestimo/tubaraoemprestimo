// 💳 PIX Payment Modal - Integrado com configurações do sistema
// Modal de pagamento PIX com QR Code real e upload de comprovante

import React, { useState, useEffect } from 'react';
import { X, Clock } from 'lucide-react';
import { Button } from './Button';
import { PixQrCode } from './PixQrCode';
import { PaymentReceiptUpload } from './PaymentReceiptUpload';
import { supabaseService } from '../services/supabaseService';

interface PixModalProps {
  amount: number;
  installmentId: string;
  loanId: string;
  customerId?: string;
  customerName?: string;
  onClose: () => void;
  onPaymentSubmitted?: () => void;
}

export const PixModal: React.FC<PixModalProps> = ({
  amount,
  installmentId,
  loanId,
  customerId,
  customerName,
  onClose,
  onPaymentSubmitted
}) => {
  const [pixConfig, setPixConfig] = useState<{
    pixKey: string;
    pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';
    pixReceiverName: string;
  } | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPixConfig();
  }, []);

  const loadPixConfig = async () => {
    setLoading(true);
    try {
      const settings = await supabaseService.getSettings();
      setPixConfig({
        pixKey: settings.pixKey || '',
        pixKeyType: settings.pixKeyType || 'ALEATORIA',
        pixReceiverName: settings.pixReceiverName || 'TUBARAO EMPRESTIMOS'
      });
    } catch (err) {
      console.error('Erro ao carregar config PIX:', err);
    }
    setLoading(false);
  };

  const handleUploadSuccess = () => {
    onPaymentSubmitted?.();
    onClose();
  };

  // Get current user info
  const user = JSON.parse(localStorage.getItem('tubarao_user') || '{}');
  const finalCustomerId = customerId || user.customerId || user.id;
  const finalCustomerName = customerName || user.name || 'Cliente';

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white p-2 z-10">
          <X size={24} />
        </button>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-zinc-500">
              <div className="w-12 h-12 border-2 border-zinc-700 border-t-[#D4AF37] rounded-full animate-spin mx-auto mb-4"></div>
              <p>Carregando dados de pagamento...</p>
            </div>
          ) : !showUpload ? (
            <>
              {/* PIX QR Code Section */}
              {pixConfig && pixConfig.pixKey ? (
                <PixQrCode
                  pixKey={pixConfig.pixKey}
                  pixKeyType={pixConfig.pixKeyType}
                  receiverName={pixConfig.pixReceiverName}
                  amount={amount}
                  txId={`TUB${installmentId.slice(-8)}`}
                />
              ) : (
                <div className="text-center py-8 bg-yellow-900/20 border border-yellow-700/30 rounded-xl mb-6">
                  <p className="text-yellow-400 text-sm">
                    Chave PIX não configurada pelo administrador.
                  </p>
                  <p className="text-zinc-500 text-xs mt-2">
                    Entre em contato para obter os dados de pagamento.
                  </p>
                </div>
              )}

              {/* Action Button */}
              <div className="mt-6 space-y-3">
                <Button
                  onClick={() => setShowUpload(true)}
                  className="w-full"
                >
                  Já Paguei - Anexar Comprovante
                </Button>

                <Button onClick={onClose} variant="secondary" className="w-full">
                  Fechar
                </Button>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-500">
                <Clock size={12} />
                <span>O comprovante será analisado pelo administrador</span>
              </div>
            </>
          ) : (
            <>
              {/* Upload Section */}
              <div className="mb-4">
                <button
                  onClick={() => setShowUpload(false)}
                  className="text-[#D4AF37] text-sm hover:underline"
                >
                  ← Voltar para QR Code
                </button>
              </div>

              <PaymentReceiptUpload
                installmentId={installmentId}
                loanId={loanId}
                customerId={finalCustomerId}
                customerName={finalCustomerName}
                amount={amount}
                onUploadSuccess={handleUploadSuccess}
              />

              <Button onClick={onClose} variant="secondary" className="w-full mt-4">
                Cancelar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PixModal;
