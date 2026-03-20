import React, { useState, useEffect, useContext } from 'react';
import { BrandContext } from '../contexts/BrandContext';

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  showText?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '', showText, ...props }) => {
  // Use context safely without throwing error
  const brandContext = useContext(BrandContext);
  const settings = brandContext?.settings || { logoUrl: null };
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const heightMap = { xs: "60px", sm: "100px", md: "160px", lg: "220px", xl: "280px" };

  useEffect(() => {
    // Logo atualizado com fundo transparente
    const customLogo = settings.logoUrl && settings.logoUrl.trim() !== "";
    const logoPath = customLogo ? settings.logoUrl : "/logo-transparent.png";

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
          setImageSrc("/logo-transparent.png");
          setImageLoaded(true);
        };
        fallbackImg.onerror = () => {
          // Se até a padrão falhar, não mostra nada
          setImageLoaded(false);
        };
        fallbackImg.src = "/logo-transparent.png";
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
      style={{
        height: heightMap[size as keyof typeof heightMap],
        opacity: 0.9
      }}
      {...props}
    />
  );
};