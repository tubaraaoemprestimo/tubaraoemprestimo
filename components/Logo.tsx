import React, { useState, useEffect } from 'react';
import { useBrand } from '../contexts/BrandContext';

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '', showText, ...props }) => {
  const { settings } = useBrand();
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const heightMap = { sm: "30px", md: "50px", lg: "80px", xl: "120px" };
  
  useEffect(() => {
    // Define a logo a ser usada
    const customLogo = settings.logoUrl && settings.logoUrl.trim() !== "";
    const logoPath = customLogo ? settings.logoUrl : "/Logo.png";
    
    // Testa se a imagem existe antes de definir
    const img = new Image();
    img.onload = () => {
      setImageSrc(logoPath);
      setImageLoaded(true);
    };
    img.onerror = () => {
      // Se falhar e era customizada, tenta a padrão
      if (customLogo) {
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          setImageSrc("/Logo.png");
          setImageLoaded(true);
        };
        fallbackImg.onerror = () => {
          // Se até a padrão falhar, não mostra nada
          setImageLoaded(false);
        };
        fallbackImg.src = "/Logo.png";
      } else {
        setImageLoaded(false);
      }
    };
    img.src = logoPath;
  }, [settings.logoUrl]);

  // Não renderiza nada até confirmar que a imagem existe
  if (!imageLoaded || !imageSrc) {
    return null;
  }

  return (
    <img 
      src={imageSrc} 
      alt="Logo" 
      className={`object-contain ${className}`}
      style={{ height: heightMap[size as keyof typeof heightMap] }}
      {...props}
    />
  );
};