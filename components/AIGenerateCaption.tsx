import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { aiService } from '../services/aiService';
import { useToast } from './Toast';
import { Button } from './Button';

interface Props {
    imageBase64: string | null;
    onCaptionGenerated: (caption: string) => void;
    className?: string;
}

export const AIGenerateCaption: React.FC<Props> = ({ imageBase64, onCaptionGenerated, className }) => {
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerate = async () => {
        if (!imageBase64) {
            addToast("Por favor, selecione uma imagem primeiro.", 'warning');
            return;
        }

        console.log('[AIGenerateCaption] Starting caption generation...');
        console.log('[AIGenerateCaption] Image URL/Base64:', imageBase64.substring(0, 100) + '...');
        console.log('[AIGenerateCaption] Is URL?', imageBase64.startsWith('http'));

        setIsLoading(true);
        try {
            // Se for URL do R2, enviar diretamente para o backend (evita CORS)
            if (imageBase64.startsWith('http')) {
                console.log('[AIGenerateCaption] Using generateImageCaptionFromUrl method');
                const caption = await aiService.generateImageCaptionFromUrl(imageBase64);
                console.log('[AIGenerateCaption] Caption received:', caption);
                if (caption) {
                    onCaptionGenerated(caption);
                    addToast("Legenda gerada com sucesso! ✨", 'success');
                } else {
                    addToast("Não foi possível gerar a legenda.", 'error');
                }
            } else {
                console.log('[AIGenerateCaption] Using generateImageCaption method (base64)');
                // Se já for base64, usar método normal
                const caption = await aiService.generateImageCaption(imageBase64);
                console.log('[AIGenerateCaption] Caption received:', caption);
                if (caption) {
                    onCaptionGenerated(caption);
                    addToast("Legenda gerada com sucesso! ✨", 'success');
                } else {
                    addToast("Não foi possível gerar a legenda.", 'error');
                }
            }
        } catch (error) {
            console.error('[AIGenerateCaption] Error:', error);
            addToast("Erro ao conectar com a IA.", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`flex justify-end ${className || ''}`}>
            <Button
                size="sm"
                onClick={handleGenerate}
                disabled={isLoading || !imageBase64}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0 py-2 px-4 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                type="button"
            >
                {isLoading ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> Criando Legenda...</>
                ) : (
                    <><Sparkles size={16} className="mr-2" /> ✨ Gerar Legenda com IA</>
                )}
            </Button>
        </div>
    );
};
