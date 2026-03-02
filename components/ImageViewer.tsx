
import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, Sun, Contrast, RefreshCw, Eye, Image as ImageIcon } from 'lucide-react';
import { Button } from './Button';

interface ImageViewerProps {
  urls: string[];
  title: string;
  initialIndex?: number;
  onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ urls, title, initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  // Transform State
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  
  // Filter State (CSI Mode)
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(0);
  const [grayscale, setGrayscale] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  const handleNext = () => {
    if (currentIndex < urls.length - 1) {
        setCurrentIndex(c => c + 1);
        resetTransform();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
        setCurrentIndex(c => c - 1);
        resetTransform();
    }
  };

  const resetTransform = () => {
    setScale(1);
    setRotation(0);
  };

  const resetFilters = () => {
    setBrightness(100);
    setContrast(100);
    setInvert(0);
    setGrayscale(0);
    resetTransform();
  };

  const currentUrl = urls[currentIndex];

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200 backdrop-blur-sm">
       {/* Header */}
       <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900/80 z-50">
          <div className="flex items-center gap-4">
             <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <ImageIcon size={20} className="text-[#D4AF37]" />
                {title}
             </h3>
             {urls.length > 1 && (
                 <span className="bg-zinc-800 text-zinc-400 px-2 py-1 rounded text-xs font-mono">
                    {currentIndex + 1} / {urls.length}
                 </span>
             )}
          </div>
          <div className="flex items-center gap-2">
             <Button variant="secondary" size="sm" onClick={resetFilters} title="Resetar Visualização">
                <RefreshCw size={16} className="mr-2"/> Reset
             </Button>
             <div className="h-6 w-px bg-zinc-700 mx-2"></div>
             <Button variant="danger" size="sm" onClick={onClose}><X size={20}/></Button>
          </div>
       </div>

       {/* Main Canvas */}
       <div className="flex-1 overflow-hidden flex items-center justify-center relative bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
          
          {/* Navigation Arrows */}
          {urls.length > 1 && (
              <>
                <button 
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="absolute left-4 z-40 p-3 rounded-full bg-black/50 hover:bg-[#D4AF37] text-white hover:text-black disabled:opacity-30 disabled:hover:bg-black/50 disabled:hover:text-white transition-all"
                >
                    <ChevronLeft size={32} />
                </button>
                <button 
                    onClick={handleNext}
                    disabled={currentIndex === urls.length - 1}
                    className="absolute right-4 z-40 p-3 rounded-full bg-black/50 hover:bg-[#D4AF37] text-white hover:text-black disabled:opacity-30 disabled:hover:bg-black/50 disabled:hover:text-white transition-all"
                >
                    <ChevronRight size={32} />
                </button>
              </>
          )}

          {/* Image */}
          <div 
             className="transition-transform duration-200 ease-out origin-center"
             style={{ 
               transform: `scale(${scale}) rotate(${rotation}deg)`,
             }}
          >
             <img 
               src={currentUrl} 
               alt={title} 
               className="max-w-[90vw] max-h-[80vh] object-contain shadow-2xl shadow-black ring-1 ring-zinc-800"
               style={{
                   filter: `brightness(${brightness}%) contrast(${contrast}%) invert(${invert}%) grayscale(${grayscale}%)`
               }}
               draggable={false}
             />
          </div>
       </div>

       {/* Toolbar (CSI Controls) */}
       <div className="bg-zinc-900 border-t border-zinc-800 p-4 pb-6">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
             
             {/* Filters */}
             <div className="flex items-center gap-6 flex-1">
                <div className="flex flex-col gap-2 w-32">
                    <label className="text-[10px] text-zinc-500 uppercase flex items-center gap-1 font-bold"><Sun size={10}/> Brilho</label>
                    <input type="range" min="50" max="200" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#D4AF37]" />
                </div>
                <div className="flex flex-col gap-2 w-32">
                    <label className="text-[10px] text-zinc-500 uppercase flex items-center gap-1 font-bold"><Contrast size={10}/> Contraste</label>
                    <input type="range" min="50" max="200" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#D4AF37]" />
                </div>
                
                <div className="h-8 w-px bg-zinc-800"></div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => setInvert(v => v === 0 ? 100 : 0)} 
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${invert > 0 ? 'bg-white text-black border-white' : 'bg-black text-zinc-400 border-zinc-800 hover:border-zinc-600'}`}
                    >
                        INVERTER
                    </button>
                    <button 
                        onClick={() => setGrayscale(v => v === 0 ? 100 : 0)} 
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${grayscale > 0 ? 'bg-zinc-500 text-white border-zinc-500' : 'bg-black text-zinc-400 border-zinc-800 hover:border-zinc-600'}`}
                    >
                        P/B
                    </button>
                </div>
             </div>

             {/* Transforms */}
             <div className="flex items-center gap-2 bg-black/50 p-2 rounded-xl border border-zinc-800">
                <Button variant="secondary" size="sm" onClick={() => setScale(s => Math.max(0.5, s - 0.5))} disabled={scale <= 0.5}><ZoomOut size={18}/></Button>
                <span className="w-12 text-center text-xs font-mono text-[#D4AF37]">{Math.round(scale * 100)}%</span>
                <Button variant="secondary" size="sm" onClick={() => setScale(s => Math.min(4, s + 0.5))} disabled={scale >= 4}><ZoomIn size={18}/></Button>
                <div className="h-4 w-px bg-zinc-700 mx-1"></div>
                <Button variant="secondary" size="sm" onClick={() => setRotation(r => (r + 90) % 360)}><RotateCw size={18}/></Button>
             </div>

          </div>
       </div>
    </div>
  );
};
