// ── WaveDisplay.tsx ───────────────────────────────────────────────────────────
import React from 'react';

interface WaveDisplayProps {
  wave: number;
  isResting: boolean;
  timer: number;
}

export const WaveDisplay: React.FC<WaveDisplayProps> = ({ wave, isResting, timer }) => (
  <div className="flex flex-col items-center z-10">
    <div className="bg-neutral-900/80 backdrop-blur-sm p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-neutral-700 shadow-lg text-center min-w-[80px] sm:min-w-[150px]">
      <div className="text-sm sm:text-xl font-black text-white leading-none mb-1">WAVE {wave}</div>
      <div className={`text-[10px] sm:text-sm font-bold leading-none ${isResting ? 'text-green-400' : 'text-red-400'}`}>
        {isResting ? 'REST' : 'COMBAT'} {timer}s
      </div>
    </div>
  </div>
);
