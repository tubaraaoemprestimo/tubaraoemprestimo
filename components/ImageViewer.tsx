import React, { useState, useEffect, useCallback } from 'react';
import {
    X, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight,
    Sun, Contrast, RefreshCw, Download, ExternalLink, FileText,
    Image as ImageIcon, Maximize2, Minimize2
} from 'lucide-react';
import { Button } from './Button';

interface ImageViewerProps {
    urls: string[];
    title: string;
    initialIndex?: number;
    onClose: () => void;
}

// Detecta se a URL é um PDF (com ou sem extensão)
function detectType(url: string): 'pdf' | 'image' | 'unknown' {
    const lower = url.toLowerCase();
    if (lower.includes('.pdf')) return 'pdf';
    // Padrões do R2 para documentos suplementares sem extensão
    if (
        lower.includes('supp_doc') ||
        lower.includes('work_card') ||
        lower.includes('work-card')
    ) return 'unknown'; // mostrar ambas opções
    if (lower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/)) return 'image';
    return 'image'; // default tenta imagem
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
    urls, title, initialIndex = 0, onClose
}) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [imgError, setImgError] = useState(false);
    const [viewMode, setViewMode] = useState<'auto' | 'pdf' | 'image'>('auto');
    const [fullscreen, setFullscreen] = useState(false);

    // Transform
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);

    // Filters
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [invert, setInvert] = useState(0);
    const [grayscale, setGrayscale] = useState(0);

    const currentUrl = urls[currentIndex] || '';
    const detectedType = detectType(currentUrl);
    const effectiveMode = viewMode === 'auto' ? detectedType : viewMode;
    const isPdfMode = effectiveMode === 'pdf' || (effectiveMode === 'unknown' && !imgError);
    const showAsPdf = isPdfMode || imgError;

    const resetTransform = useCallback(() => {
        setScale(1);
        setRotation(0);
    }, []);

    const resetAll = useCallback(() => {
        setBrightness(100);
        setContrast(100);
        setInvert(0);
        setGrayscale(0);
        resetTransform();
    }, [resetTransform]);

    const handleNext = useCallback(() => {
        if (currentIndex < urls.length - 1) {
            setCurrentIndex(c => c + 1);
            setImgError(false);
            setViewMode('auto');
            resetTransform();
        }
    }, [currentIndex, urls.length, resetTransform]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(c => c - 1);
            setImgError(false);
            setViewMode('auto');
            resetTransform();
        }
    }, [currentIndex, resetTransform]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === '+' || e.key === '=') setScale(s => Math.min(4, s + 0.25));
            if (e.key === '-') setScale(s => Math.max(0.25, s - 0.25));
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [handleNext, handlePrev, onClose]);

    // Scroll zoom no canvas
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale(s => Math.min(4, Math.max(0.25, s + delta)));
    };

    return (
        <div
            className={`fixed inset-0 z-[200] bg-black/98 flex flex-col animate-in fade-in duration-150 ${fullscreen ? '' : ''}`}
            style={{ backdropFilter: 'blur(8px)' }}
        >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    {showAsPdf
                        ? <FileText size={20} className="text-red-400 shrink-0" />
                        : <ImageIcon size={20} className="text-[#D4AF37] shrink-0" />
                    }
                    <h3 className="text-white font-bold text-base truncate">{title}</h3>
                    {urls.length > 1 && (
                        <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded text-xs font-mono shrink-0">
                            {currentIndex + 1} / {urls.length}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Forçar modo */}
                    {detectedType === 'unknown' && (
                        <div className="flex gap-1 bg-zinc-900 border border-zinc-700 rounded-lg p-1">
                            <button
                                onClick={() => { setViewMode('image'); setImgError(false); }}
                                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${viewMode === 'image' ? 'bg-[#D4AF37] text-black' : 'text-zinc-400 hover:text-white'}`}
                            >
                                Imagem
                            </button>
                            <button
                                onClick={() => setViewMode('pdf')}
                                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${viewMode === 'pdf' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                            >
                                PDF
                            </button>
                        </div>
                    )}

                    <a
                        href={currentUrl}
                        download
                        className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                        title="Baixar arquivo"
                    >
                        <Download size={16} />
                    </a>
                    <a
                        href={currentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                        title="Abrir em nova aba"
                    >
                        <ExternalLink size={16} />
                    </a>

                    <div className="w-px h-5 bg-zinc-700" />

                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-red-900 transition-colors"
                        title="Fechar (Esc)"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* ── Thumbnails strip (múltiplos arquivos) ── */}
            {urls.length > 1 && (
                <div className="flex gap-2 px-4 py-2 bg-zinc-950 border-b border-zinc-800 overflow-x-auto shrink-0">
                    {urls.map((url, i) => {
                        const t = detectType(url);
                        return (
                            <button
                                key={i}
                                onClick={() => { setCurrentIndex(i); setImgError(false); setViewMode('auto'); resetTransform(); }}
                                className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${i === currentIndex ? 'border-[#D4AF37]' : 'border-zinc-700 hover:border-zinc-500'}`}
                            >
                                {t === 'pdf' ? (
                                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                        <FileText size={24} className="text-red-400" />
                                    </div>
                                ) : (
                                    <img src={url} alt={`${i + 1}`} className="w-full h-full object-cover" onError={() => {}} />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Main Content ── */}
            <div className="flex-1 relative overflow-hidden" onWheel={showAsPdf ? undefined : handleWheel}>

                {/* Setas de navegação */}
                {urls.length > 1 && (
                    <>
                        <button
                            onClick={handlePrev}
                            disabled={currentIndex === 0}
                            className="absolute left-3 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/60 hover:bg-[#D4AF37] text-white hover:text-black disabled:opacity-20 transition-all shadow-xl"
                        >
                            <ChevronLeft size={28} />
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={currentIndex === urls.length - 1}
                            className="absolute right-3 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/60 hover:bg-[#D4AF37] text-white hover:text-black disabled:opacity-20 transition-all shadow-xl"
                        >
                            <ChevronRight size={28} />
                        </button>
                    </>
                )}

                {/* PDF Viewer */}
                {showAsPdf ? (
                    <div className="w-full h-full flex flex-col">
                        <iframe
                            key={currentUrl}
                            src={currentUrl}
                            className="w-full flex-1 border-0"
                            title={title}
                            style={{ background: '#fff' }}
                        />
                    </div>
                ) : (
                    /* Image Viewer */
                    <div className="w-full h-full flex items-center justify-center overflow-hidden bg-zinc-950 bg-[radial-gradient(ellipse_at_center,_#1a1a1a_0%,_#000_100%)]">
                        <div
                            className="transition-transform duration-150 ease-out origin-center cursor-grab active:cursor-grabbing"
                            style={{
                                transform: `scale(${scale}) rotate(${rotation}deg)`,
                            }}
                        >
                            <img
                                key={currentUrl}
                                src={currentUrl}
                                alt={title}
                                className="max-w-[85vw] max-h-[75vh] object-contain shadow-2xl shadow-black select-none"
                                style={{
                                    filter: `brightness(${brightness}%) contrast(${contrast}%) invert(${invert}%) grayscale(${grayscale}%)`
                                }}
                                draggable={false}
                                onError={() => setImgError(true)}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Toolbar (só para imagens) ── */}
            {!showAsPdf && (
                <div className="bg-zinc-950 border-t border-zinc-800 px-4 py-3 shrink-0">
                    <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">

                        {/* Filtros */}
                        <div className="flex items-center gap-5">
                            <div className="flex flex-col gap-1 w-28">
                                <label className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                                    <Sun size={10} /> Brilho
                                </label>
                                <input
                                    type="range" min="50" max="200" value={brightness}
                                    onChange={e => setBrightness(Number(e.target.value))}
                                    className="h-1 bg-zinc-700 rounded appearance-none cursor-pointer accent-[#D4AF37]"
                                />
                            </div>
                            <div className="flex flex-col gap-1 w-28">
                                <label className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                                    <Contrast size={10} /> Contraste
                                </label>
                                <input
                                    type="range" min="50" max="200" value={contrast}
                                    onChange={e => setContrast(Number(e.target.value))}
                                    className="h-1 bg-zinc-700 rounded appearance-none cursor-pointer accent-[#D4AF37]"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setInvert(v => v === 0 ? 100 : 0)}
                                    className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${invert > 0 ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500'}`}
                                >
                                    INVERTER
                                </button>
                                <button
                                    onClick={() => setGrayscale(v => v === 0 ? 100 : 0)}
                                    className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${grayscale > 0 ? 'bg-zinc-500 text-white border-zinc-500' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500'}`}
                                >
                                    P&B
                                </button>
                                <button
                                    onClick={resetAll}
                                    className="px-3 py-1.5 rounded text-xs font-bold border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors flex items-center gap-1"
                                >
                                    <RefreshCw size={11} /> Reset
                                </button>
                            </div>
                        </div>

                        {/* Zoom e Rotação */}
                        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-2">
                            <button
                                onClick={() => setScale(s => Math.max(0.25, s - 0.25))}
                                disabled={scale <= 0.25}
                                className="p-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                                title="Diminuir (-)"
                            >
                                <ZoomOut size={16} />
                            </button>
                            <span className="w-12 text-center text-xs font-mono text-[#D4AF37]">
                                {Math.round(scale * 100)}%
                            </span>
                            <button
                                onClick={() => setScale(s => Math.min(4, s + 0.25))}
                                disabled={scale >= 4}
                                className="p-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                                title="Ampliar (+)"
                            >
                                <ZoomIn size={16} />
                            </button>
                            <div className="w-px h-4 bg-zinc-700 mx-1" />
                            <button
                                onClick={() => setRotation(r => (r + 90) % 360)}
                                className="p-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                title="Girar 90°"
                            >
                                <RotateCw size={16} />
                            </button>
                            <div className="w-px h-4 bg-zinc-700 mx-1" />
                            <button
                                onClick={resetTransform}
                                className="px-2 py-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-white text-xs transition-colors"
                                title="Ajustar à tela"
                            >
                                Ajustar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Dica teclas ── */}
            <div className="text-center text-[10px] text-zinc-700 py-1 bg-zinc-950 shrink-0">
                {showAsPdf ? 'Esc para fechar' : 'Esc · ← → navegar · scroll para zoom · + − ampliar'}
            </div>
        </div>
    );
};
