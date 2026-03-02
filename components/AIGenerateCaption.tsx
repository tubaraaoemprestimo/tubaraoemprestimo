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

        setIsLoading(true);
        try {
            let finalBase64 = imageBase64;

            // Se for URL, converter para Base64
            if (imageBase64.startsWith('http')) {
                try {
                    const response = await fetch(imageBase64);
                    const blob = await response.blob();
                    finalBase64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.error("Erro ao converter imagem:", e);
                    addToast("Erro ao processar imagem. Tente fazer upload novamente.", 'error');
                    setIsLoading(false);
                    return;
                }
            }

            const caption = await aiService.generateImageCaption(finalBase64);
            if (caption) {
                onCaptionGenerated(caption);
                addToast("Legenda gerada com sucesso! ✨", 'success');
            } else {
                addToast("Não foi possível gerar a legenda.", 'error');
            }
        } catch (error) {
            console.error(error);
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
