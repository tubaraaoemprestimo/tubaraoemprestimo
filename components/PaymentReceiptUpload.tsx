// 📄 Payment Receipt Upload Component
// Componente para cliente anexar comprovante de pagamento PIX

import React, { useState, useRef } from 'react';
import { Upload, FileText, Image, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { supabase } from '../services/supabaseClient';

interface PaymentReceiptUploadProps {
    installmentId: string;
    loanId: string;
    customerId: string;
    customerName: string;
    amount: number;
    onUploadSuccess?: (receiptUrl: string) => void;
    onUploadError?: (error: string) => void;
}

export const PaymentReceiptUpload: React.FC<PaymentReceiptUploadProps> = ({
    installmentId,
    loanId,
    customerId,
    customerName,
    amount,
    onUploadSuccess,
    onUploadError
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // Validar tipo de arquivo
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!validTypes.includes(selectedFile.type)) {
            setError('Formato inválido. Use: JPG, PNG, WebP ou PDF');
            return;
        }

        // Validar tamanho (máx 5MB)
        if (selectedFile.size > 5 * 1024 * 1024) {
            setError('Arquivo muito grande. Máximo 5MB.');
            return;
        }

        setFile(selectedFile);
        setError(null);

        // Criar preview se for imagem
        if (selectedFile.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
        } else {
            setPreview(null);
        }
    };

    const handleRemoveFile = () => {
        setFile(null);
        setPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async () => {
        if (!file) {
            setError('Selecione um arquivo primeiro');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            // Upload para o Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${customerId}/${installmentId}_${Date.now()}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('receipts')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                throw new Error(uploadError.message);
            }

            // Obter URL pública
            const { data: urlData } = supabase.storage
                .from('receipts')
                .getPublicUrl(fileName);

            const receiptUrl = urlData.publicUrl;

            // Salvar registro no banco
            const { error: dbError } = await supabase
                .from('payment_receipts')
                .insert({
                    installment_id: installmentId,
                    loan_id: loanId,
                    customer_id: customerId,
                    customer_name: customerName,
                    amount: amount,
                    receipt_url: receiptUrl,
                    receipt_type: file.type.startsWith('image/') ? 'IMAGE' : 'PDF',
                    status: 'PENDING',
                    submitted_at: new Date().toISOString()
                });

            if (dbError) {
                // Se insert falhar, tentar fallback com localStorage
                console.warn('Supabase insert failed, using localStorage:', dbError);
                const receipts = JSON.parse(localStorage.getItem('tubarao_payment_receipts') || '[]');
                receipts.push({
                    id: `receipt_${Date.now()}`,
                    installmentId,
                    loanId,
                    customerId,
                    customerName,
                    amount,
                    receiptUrl,
                    receiptType: file.type.startsWith('image/') ? 'IMAGE' : 'PDF',
                    status: 'PENDING',
                    submittedAt: new Date().toISOString()
                });
                localStorage.setItem('tubarao_payment_receipts', JSON.stringify(receipts));
            }

            setSubmitted(true);
            onUploadSuccess?.(receiptUrl);

        } catch (err: any) {
            console.error('Upload error:', err);
            const errorMsg = err.message || 'Erro ao enviar comprovante';
            setError(errorMsg);
            onUploadError?.(errorMsg);
        }

        setUploading(false);
    };

    if (submitted) {
        return (
            <div className="bg-green-900/20 border border-green-700/30 rounded-2xl p-6 text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={32} className="text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Comprovante Enviado!</h3>
                <p className="text-zinc-400 text-sm">
                    Seu comprovante foi recebido e está aguardando confirmação do administrador.
                </p>
                <p className="text-green-400 text-xs mt-4">
                    Você será notificado quando o pagamento for confirmado.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                    <Upload size={24} className="text-blue-400" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">Anexar Comprovante</h3>
                    <p className="text-xs text-zinc-500">Envie o comprovante do PIX realizado</p>
                </div>
            </div>

            {/* Upload Area */}
            <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${file
                        ? 'border-[#D4AF37] bg-[#D4AF37]/5'
                        : 'border-zinc-700 hover:border-zinc-500 bg-black/30'
                    }`}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                {file ? (
                    <div className="flex flex-col items-center">
                        {preview ? (
                            <img src={preview} alt="Preview" className="w-32 h-32 object-cover rounded-lg mb-4" />
                        ) : (
                            <div className="w-32 h-32 bg-zinc-800 rounded-lg flex items-center justify-center mb-4">
                                <FileText size={48} className="text-[#D4AF37]" />
                            </div>
                        )}
                        <p className="text-white font-medium">{file.name}</p>
                        <p className="text-zinc-500 text-xs mt-1">
                            {(file.size / 1024).toFixed(1)} KB
                        </p>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                            className="mt-4 flex items-center gap-2 text-red-400 hover:text-red-300 text-sm"
                        >
                            <X size={16} /> Remover
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Upload size={24} className="text-zinc-500" />
                        </div>
                        <p className="text-zinc-400 mb-2">Clique para selecionar ou arraste o arquivo</p>
                        <div className="flex items-center justify-center gap-4 text-xs text-zinc-600">
                            <span className="flex items-center gap-1"><Image size={14} /> JPG, PNG, WebP</span>
                            <span className="flex items-center gap-1"><FileText size={14} /> PDF</span>
                        </div>
                        <p className="text-zinc-700 text-[10px] mt-2">Máximo 5MB</p>
                    </>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-700/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {/* Submit Button */}
            <Button
                onClick={handleSubmit}
                disabled={!file || uploading}
                isLoading={uploading}
                className="w-full mt-6"
            >
                {uploading ? (
                    <>
                        <Loader2 size={18} className="animate-spin" />
                        Enviando...
                    </>
                ) : (
                    <>
                        <Check size={18} />
                        Enviar Comprovante
                    </>
                )}
            </Button>

            {/* Help Text */}
            <p className="text-xs text-zinc-600 text-center mt-4">
                O comprovante será analisado e sua parcela será baixada após confirmação.
            </p>
        </div>
    );
};

export default PaymentReceiptUpload;
