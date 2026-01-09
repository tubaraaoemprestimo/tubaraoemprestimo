import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gold' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  isLoading, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "rounded-lg font-bold transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-6 py-3",
    lg: "px-8 py-4 text-lg"
  };
  
  const variants = {
    // Red (Shark) - Primary Action
    primary: "bg-[#FF0000] text-white shadow-lg shadow-red-900/20 hover:bg-red-600 border border-transparent",
    
    // Gold - Premium/Status
    gold: "bg-gradient-to-r from-[#D4AF37] to-[#B5942F] text-black shadow-lg shadow-[#D4AF37]/20 hover:shadow-[#D4AF37]/40 border border-[#D4AF37]",
    
    // Secondary - Dark Grey
    secondary: "bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700",
    
    // Danger - Also Red, but keeping for semantic clarity if needed differently later
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20",
    
    // Outline - Gold Text
    outline: "bg-transparent text-[#D4AF37] border border-[#D4AF37] hover:bg-[#D4AF37]/10"
  };

  return (
    <button 
      className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <svg className={`animate-spin text-current ${size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : children}
    </button>
  );
};