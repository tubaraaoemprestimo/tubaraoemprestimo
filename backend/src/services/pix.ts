/**
 * Serviço para geração de QR Code Pix real (Padrão BSPC/Banco Central)
 */
import QRCode from 'qrcode';

export interface PixPayload {
    key: string;
    type: 'cpf' | 'email' | 'phone' | 'random';
    name: string;
    city: string;
    amount: number;
    txid: string;
    description?: string;
}

/**
 * Gera o código Pix Copia e Cola (BRCODE)
 * Formato: 00020126580014BR.GOV.BCB.PIX...
 */
export function generatePixCode(payload: PixPayload): string {
    const {
        key,
        type,
        name,
        city = 'SAO PAULO',
        amount,
        txid,
        description = ''
    } = payload;

    // Garantir nome com tamanho máximo de 25 caracteres
    const sanitizedName = name.substring(0, 25).padEnd(2, ' ');

    // Formatar valor com 2 casas decimais
    const formattedAmount = amount.toFixed(2);

    // Montar os campos EMV QR
    let result = "000201"; // Payload Format Indicator

    // Merchant Account Information (chave PIX)
    const keyType = type.toUpperCase();
    let pixKey = key;

    // Sanitizar a chave PIX de acordo com o tipo
    switch (type) {
        case 'cpf':
            pixKey = key.replace(/\D/g, '');
            break;
        case 'phone':
            pixKey = key.replace(/\D/g, '');
            if (!pixKey.startsWith('55')) {
                pixKey = '55' + pixKey;
            }
            break;
        case 'email':
            pixKey = key.toLowerCase().trim();
            break;
        case 'random':
            // Para chave aleatória, verificar se é um UUID ou similar
            pixKey = key;
            break;
    }

    // Adicionar campo da chave
    const merchantAccount = `0014BR.GOV.BCB.PIX01${pixKey.length.toString().padStart(2, '0')}${pixKey}`;
    result += `26${merchantAccount.length.toString().padStart(2, '0')}${merchantAccount}`;

    // Merchant Category Code
    result += "52040000";

    // Transaction Currency
    result += "5303986";

    // Transaction Amount (opcional, mas adicionando se fornecido)
    if (amount > 0) {
        result += `54${formattedAmount.length.toString().padStart(2, '0')}${formattedAmount}`;
    }

    // Country Code
    result += "5802BR";

    // Merchant Name
    const merchantName = sanitizedName.substring(0, 25);
    result += `59${merchantName.length.toString().padStart(2, '0')}${merchantName}`;

    // Merchant City
    const sanitixedCity = city.substring(0, 15);
    result += `60${sanitixedCity.length.toString().padStart(2, '0')}${sanitixedCity}`;

    // Transaction ID (TXID) - obrigatório e com tamanho fixo entre 25-35
    let finalTxid = txid.substring(0, 25).padEnd(25, 'A');
    // Garantir que o TXID tenha tamanho adequado (25-35)
    if (finalTxid.length < 25) {
        finalTxid = finalTxid.padEnd(25, '0');
    } else if (finalTxid.length > 35) {
        finalTxid = finalTxid.substring(0, 35);
    }

    const additionalData = `05${finalTxid.length.toString().padStart(2, '0')}${finalTxid}`;
    result += `62${additionalData.length.toString().padStart(2, '0')}${additionalData}`;

    // CRC16 - vamos adicionar o CRC16 no final
    const crc = calculateCRC16(result + "6304");
    result += "6304" + crc;

    return result;
}

// Função para calcular CRC16 CCITT
function calculateCRC16(data: string): string {
    // Implementação do CRC16 conforme padrão BSPC
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
            crc &= 0xFFFF;
        }
    }
    // Converter resultado para hexadecimal com 4 dígitos
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Gera QR Code PIX em formato data URL
 * @param payload Payload PIX
 * @returns Data URL base64 do QR Code
 */
export async function generatePixQRCodeDataURL(payload: PixPayload): Promise<string> {
    try {
        const pixCode = generatePixCode(payload);

        return new Promise<string>((resolve, reject) => {
            QRCode.toDataURL(pixCode, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#D4AF37'
                },
                errorCorrectionLevel: 'H'
            }, (error, url) => {
                if (error) reject(error);
                else resolve(url as string);
            });
        });
    } catch (error) {
        console.error('[PixService] Error generating QR Code:', error);
        throw error;
    }
}

/**
 * Gera QR Code PIX em formato Buffer PNG
 * @param payload Payload PIX
 * @returns Buffer do QR Code PNG
 */
export async function generatePixQRCodeBuffer(payload: PixPayload): Promise<Buffer> {
    try {
        const pixCode = generatePixCode(payload);

        return new Promise<Buffer>((resolve, reject) => {
            QRCode.toBuffer(pixCode, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#D4AF37'
                },
                errorCorrectionLevel: 'H',
                type: 'png'
            }, (error, buffer) => {
                if (error) reject(error);
                else resolve(buffer as Buffer);
            });
        });
    } catch (error) {
        console.error('[PixService] Error generating QR Code:', error);
        throw error;
    }
}

/**
 * Gera código Copia e Cola e QR Code para uma parcela
 */
export async function generateInstallmentPixData(
    pixKey: string,
    amount: number,
    customerName: string,
    customerCity?: string,
    installmentNumber?: number,
    loanId?: string
): Promise<{ pixCode: string; qrCodeUrl: string; qrCodeBuffer: Buffer }> {
    const txid = loanId && installmentNumber
        ? `${loanId}-${installmentNumber}-${Date.now()}`
        : `tubarao-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const payload: PixPayload = {
        key: pixKey,
        type: 'random',
        name: customerName,
        city: customerCity || 'SAO PAULO',
        amount: amount,
        txid,
        description: installmentNumber
            ? `Pagamento parcela ${installmentNumber} - Tubarão Empréstimos`
            : `Pagamento - Tubarão Empréstimos`
    };

    const [pixCode, qrCodeUrl, qrCodeBuffer] = await Promise.all([
        Promise.resolve(generatePixCode(payload)),
        generatePixQRCodeDataURL(payload),
        generatePixQRCodeBuffer(payload)
    ]);

    return { pixCode, qrCodeUrl, qrCodeBuffer };
}

/**
 * Salva QR Code de uma parcela no banco e retorna URL pública
 */
export async function saveInstallmentQRCode(
    prisma: any,
    installmentId: string,
    qrCodeBuffer: Buffer,
    pixCode: string
): Promise<string> {
    const fileName = `pix_qr_${installmentId}_${Date.now()}.png`;

    // Salva na tabela de installments atualizando o pixCode
    const installment = await prisma.installment.update({
        where: { id: installmentId },
        data: {
            pixCode: pixCode
        }
    });

    // Em produção, aqui você faria upload do QR Code para um storage (S3, Cloudflare R2, etc)
    // Por enquanto, vamos retornar o QR Code como base64 data URL
    const dataUrl = `data:image/png;base64,${qrCodeBuffer.toString('base64')}`;

    return dataUrl;
}
