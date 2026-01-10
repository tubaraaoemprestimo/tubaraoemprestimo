// 💳 PIX QR Code Generator Component
// Gera QR Code PIX para pagamentos com opção de copiar chave

import React, { useState, useEffect } from 'react';
import { QrCode, Copy, Check, CreditCard, Clock, AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface PixQrCodeProps {
    pixKey: string;
    pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';
    receiverName: string;
    amount: number;
    description?: string;
    txId?: string;
    onCopyKey?: () => void;
}

// Função para gerar o código PIX (payload EMV)
const generatePixPayload = (
    pixKey: string,
    receiverName: string,
    amount: number,
    txId: string = '',
    description: string = ''
): string => {
    const formatField = (id: string, value: string) => {
        const len = value.length.toString().padStart(2, '0');
        return `${id}${len}${value}`;
    };

    // Merchant Account Information (26)
    const gui = formatField('00', 'br.gov.bcb.pix');
    const key = formatField('01', pixKey);
    const merchantAccount = formatField('26', gui + key);

    // Merchant Category Code (52)
    const mcc = formatField('52', '0000');

    // Transaction Currency (53) - BRL
    const currency = formatField('53', '986');

    // Transaction Amount (54)
    const amountFormatted = amount > 0 ? formatField('54', amount.toFixed(2)) : '';

    // Country Code (58)
    const country = formatField('58', 'BR');

    // Merchant Name (59)
    const name = formatField('59', receiverName.substring(0, 25));

    // Merchant City (60)
    const city = formatField('60', 'SAO PAULO');

    // Additional Data Field (62)
    const additionalData = txId
        ? formatField('62', formatField('05', txId.substring(0, 25)))
        : '';

    // Payload Format Indicator (00)
    const payload = formatField('00', '01');

    // Montar payload sem CRC
    const payloadWithoutCRC = payload + merchantAccount + mcc + currency + amountFormatted + country + name + city + additionalData;

    // CRC16 (63) - placeholder, será calculado
    const crcField = '6304';
    const fullPayload = payloadWithoutCRC + crcField;

    // Calcular CRC16-CCITT
    const crc = calculateCRC16(fullPayload);

    return payloadWithoutCRC + formatField('63', crc);
};

// Função para calcular CRC16-CCITT
const calculateCRC16 = (str: string): string => {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
        crc &= 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
};

export const PixQrCode: React.FC<PixQrCodeProps> = ({
    pixKey,
    pixKeyType,
    receiverName,
    amount,
    description,
    txId,
    onCopyKey
}) => {
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [pixCode, setPixCode] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        generateQrCode();
    }, [pixKey, amount, receiverName]);

    const generateQrCode = async () => {
        if (!pixKey || !receiverName) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Gerar payload PIX
            const payload = generatePixPayload(
                pixKey,
                receiverName,
                amount,
                txId || `TUBARAO${Date.now().toString().slice(-8)}`,
                description
            );
            setPixCode(payload);

            // Usar API externa para gerar QR Code
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}`;
            setQrDataUrl(qrApiUrl);
        } catch (error) {
            console.error('Erro ao gerar QR Code:', error);
        }
        setLoading(false);
    };

    const handleCopyKey = async () => {
        try {
            await navigator.clipboard.writeText(pixKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
            onCopyKey?.();
        } catch (err) {
            console.error('Erro ao copiar:', err);
        }
    };

    const handleCopyCode = async () => {
        try {
            await navigator.clipboard.writeText(pixCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch (err) {
            console.error('Erro ao copiar:', err);
        }
    };

    const formatPixKey = (key: string, type: string) => {
        if (type === 'CPF') {
            return key.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        if (type === 'CNPJ') {
            return key.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        if (type === 'TELEFONE') {
            return key.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }
        return key;
    };

    if (!pixKey) {
        return (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                <AlertCircle size={48} className="mx-auto mb-4 text-yellow-500 opacity-70" />
                <p className="text-zinc-400">Chave PIX não configurada</p>
                <p className="text-xs text-zinc-600 mt-2">O administrador deve configurar a chave PIX nas configurações.</p>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-2xl p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-[#D4AF37]/20 rounded-xl">
                    <CreditCard size={24} className="text-[#D4AF37]" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">Pagamento via PIX</h3>
                    <p className="text-xs text-zinc-500">Escaneie o QR Code ou copie a chave</p>
                </div>
            </div>

            {/* Amount Display */}
            <div className="bg-black/50 rounded-xl p-4 mb-6 border border-zinc-800">
                <p className="text-xs text-zinc-500 mb-1">Valor a pagar</p>
                <p className="text-3xl font-bold text-[#D4AF37]">
                    R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-6">
                {loading ? (
                    <div className="w-48 h-48 bg-zinc-800 rounded-xl flex items-center justify-center animate-pulse">
                        <QrCode size={64} className="text-zinc-600" />
                    </div>
                ) : (
                    <div className="bg-white p-3 rounded-xl shadow-lg">
                        <img
                            src={qrDataUrl}
                            alt="QR Code PIX"
                            className="w-48 h-48"
                        />
                    </div>
                )}
            </div>

            {/* PIX Key Display */}
            <div className="space-y-4">
                <div className="bg-black/50 rounded-xl p-4 border border-zinc-800">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-zinc-500 uppercase font-bold">{pixKeyType}</span>
                        <button
                            onClick={handleCopyKey}
                            className="flex items-center gap-1 text-xs text-[#D4AF37] hover:text-[#B5942F] transition-colors"
                        >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                    </div>
                    <p className="text-white font-mono text-sm break-all">{formatPixKey(pixKey, pixKeyType)}</p>
                    <p className="text-zinc-400 text-xs mt-2">{receiverName}</p>
                </div>

                {/* Copy Full PIX Code */}
                <Button
                    onClick={handleCopyCode}
                    variant="secondary"
                    className="w-full"
                >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? 'Código Copiado!' : 'Copiar Código PIX Copia e Cola'}
                </Button>
            </div>

            {/* Instructions */}
            <div className="mt-6 pt-6 border-t border-zinc-800">
                <p className="text-xs text-zinc-500 text-center flex items-center justify-center gap-2">
                    <Clock size={14} />
                    Após o pagamento, anexe o comprovante abaixo
                </p>
            </div>
        </div>
    );
};

export default PixQrCode;
