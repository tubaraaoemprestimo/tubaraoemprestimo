
import React, { useEffect, useState } from 'react';

interface ScoreGaugeProps {
  score: number;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score }) => {
  const [displayScore, setDisplayScore] = useState(0);
  
  // Animation loop
  useEffect(() => {
    let start = 0;
    const duration = 1500;
    const increment = score / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [score]);

  // Determine color based on score
  const getColor = (s: number) => {
    if (s < 400) return '#EF4444'; // Red
    if (s < 700) return '#EAB308'; // Yellow
    return '#22C55E'; // Green
  };

  const color = getColor(displayScore);
  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  // We only want a semi-circle gauge (or 3/4), let's do 220 degrees
  const maxAngle = 220; 
  const strokeDashoffset = circumference - (displayScore / 1000) * (circumference * (maxAngle/360));
  
  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      <div className="relative w-48 h-48 flex items-center justify-center">
        {/* Background Circle */}
        <svg height={radius * 2} width={radius * 2} className="rotate-[160deg]">
          <circle
            stroke="#333"
            strokeWidth={stroke}
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            strokeDasharray={`${circumference * (maxAngle/360)} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        
        {/* Progress Circle */}
        <svg height={radius * 2} width={radius * 2} className="absolute rotate-[160deg]">
          <circle
            stroke={color}
            strokeWidth={stroke}
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            style={{ 
                strokeDasharray: `${circumference * (maxAngle/360)} ${circumference}`, 
                strokeDashoffset: circumference - ((displayScore / 1000) * (circumference * (maxAngle/360))),
                transition: 'stroke-dashoffset 0.1s linear'
            }}
            strokeLinecap="round"
          />
        </svg>

        {/* Text */}
        <div className="absolute flex flex-col items-center top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-2">
            <span className="text-4xl font-bold text-white font-mono">{displayScore}</span>
            <span className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Score</span>
        </div>
      </div>
      
      <div className="mt-[-20px] px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-bold" style={{ color }}>
         {displayScore > 700 ? 'EXCELENTE' : displayScore > 400 ? 'REGULAR' : 'BAIXO'}
      </div>
    </div>
  );
};
