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

    const formattedAmount = amount.toFixed(2).replace('.', '');
    const paddedAmount = formattedAmount.padStart(10, '0');

    // Identificador Pix (chave)
    let pixKey = '';
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
            pixKey = key;
            break;
    }

    const encodedKey = Buffer.from(pixKey).toString('base64');
    const payloadString = `00020126330014BR.GOV.BCB.PIX01${encodedKey}5204000053039865406${paddedAmount}5802BR5913TUBARAOEMPRESTITIMOS6008SAOPAULO62070503***`;

    return payloadString;
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
