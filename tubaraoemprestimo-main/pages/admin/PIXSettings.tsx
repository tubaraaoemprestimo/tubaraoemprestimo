import React, { useState, useEffect } from 'react';
import { QrCode, Copy, Check, Smartphone } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';

const inputStyle = "w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none transition-colors";

interface PIXSettingsProps {
  settings: any;
  onUpdate: () => void;
}

export const PIXSettings: React.FC<PIXSettingsProps> = ({ settings, onUpdate }) => {
  const { addToast } = useToast();
  const [pixKey, setPixKey] = useState(settings.pixKey || '');
  const [pixKeyType, setPixKeyType] = useState<'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA'>(
    (settings.pixKeyType as any) || 'CPF'
  );
  const [pixReceiverName, setPixReceiverName] = useState(settings.pixReceiverName || '');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Gerar QR code PIX dinamicamente (usa chave do sistema)
  const generatePixPayload = () => {
    if (!pixKey) return null;

    // Formato básico do PIX (Payload version 2.0)
    const merchantAccount = {
      keyType: pixKeyType,
      key: pixKey,
      merchantName: pixReceiverName || 'Tubarao Emprestimos'
    };

    // Simples mock - em produção usar library específica (ex: corisco)
    // Aqui usamos formato simplificado para demonstração
    return {
      payload: `000201${pixKeyType === 'CPF' ? '11' : pixKeyType === 'CNPJ' ? '22' : '13'}${pixKey.padEnd(44, '0')}${' '.repeat(40)}${pixReceiverName || 'Tubarao Emprestimos'.padEnd(40, ' ')}${' '?.repeat(40)}`,
      qrCodeData: `PIX${pixKeyType === 'CPF' ? pixKey.padStart(14, '0') : pixKey}`,
      merchantAccount
    };
  };

  const pixPayload = generatePixPayload();

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiService.updateSettings({
        pixKey,
        pixKeyType: pixKeyType,
        pixReceiverName: pixReceiverName
      });
      addToast('Configurações PIX salvas com sucesso!', 'success');
      onUpdate();
    } catch (e) {
      addToast('Erro ao salvar configurações PIX.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      addToast('Copiado para a área de transferência!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      addToast('Erro ao copiar.', 'error');
    }
  };

  const getPixKeyTypeLabel = (type: string) => {
    switch (type) {
      case 'CPF': return 'CPF';
      case 'CNPJ': return 'CNPJ';
      case 'EMAIL': return 'Email';
      case 'TELEFONE': return 'Celular';
      case 'ALEATORIA': return 'Chave Aleatória';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-4">
        <h3 className="font-bold text-yellow-400 mb-2 flex items-center gap-2">
          <QrCode size={18} />
          Configuração PIX do Sistema
        </h3>
        <p className="text-sm text-zinc-300">
          Configure a chave PIX que será usada para recebimentos. Os clientes verão esse PIX na área de pagamento.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Tipo de Chave PIX</label>
          <div className="grid grid-cols-3 gap-2">
            {(['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA'] as const).map(type => (
              <button
                key={type}
                onClick={() => setPixKeyType(type)}
                className={`p-3 rounded-lg border text-sm transition-all ${pixKeyType === type
                  ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]'
                  : 'border-zinc-700 bg-black hover:border-zinc-500'
                  }`}
              >
                {getPixKeyTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Chave PIX</label>
          <input
            type="text"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder={pixKeyType === 'CPF' ? '000.000.000-00' :
              pixKeyType === 'CNPJ' ? '00.000.000/0000-00' :
                pixKeyType === 'EMAIL' ? 'email@exemplo.com' :
                  pixKeyType === 'TELEFONE' ? '(11) 99999-9999' :
                    '00000000-0000-0000-0000-000000000000'}
            className={inputStyle}
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Nome do Recebedor (opcional)</label>
          <input
            type="text"
            value={pixReceiverName}
            onChange={(e) => setPixReceiverName(e.target.value)}
            placeholder="Tubarao Emprestimos"
            className={inputStyle}
          />
        </div>
      </div>

      {pixKey && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h4 className="font-bold text-white mb-4 flex items-center gap-2">
            <QrCode size={20} />
            Prévia do QR Code PIX
          </h4>

          <div className="flex flex-col md:flex-row gap-6">
            {/* QR Code Placeholder */}
            <div className="flex-shrink-0">
              <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center">
                {/* Em produção, usar library de QR code. Por ora, placeholder */}
                <div className="text-black text-center p-4">
                  <QrCode size={64} className="mx-auto mb-2" />
                  <span className="text-xs">QR Code PIX</span>
                  <span className="block text-sm font-bold mt-1">{pixKey}</span>
                </div>
              </div>
            </div>

            {/* Detalhes e Código de Copia e Cola */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="text-xs text-zinc-500 uppercase mb-1 block">Chave PIX</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                    {pixKey}
                  </code>
                  <Button
                    onClick={() => copyToClipboard(pixKey)}
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 uppercase mb-1 block">Tipo</label>
                <div className="text-sm text-white">{getPixKeyTypeLabel(pixKeyType)}</div>
              </div>

              {pixReceiverName && (
                <div>
                  <label className="text-xs text-zinc-500 uppercase mb-1 block">Recebedor</label>
                  <div className="text-sm text-white">{pixReceiverName}</div>
                </div>
              )}

              <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                  <strong>⚠️ Teste primeiro!</strong> Use o aplicativo do seu banco para escanear o QR code e verificar se os dados estão corretos antes de disponibilizar aos clientes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} isLoading={loading} className="bg-[#D4AF37] hover:bg-[#B8860B] text-black">
          <Smartphone size={16} className="mr-2" />
          Salvar Configuração PIX
        </Button>
      </div>
    </div>
  );
};
