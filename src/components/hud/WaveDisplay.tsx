import React from 'react';

interface WaveDisplayProps {
  wave: number;
  isResting: boolean;
  timer: number | null;
  objectiveText: string | null;
}

export const WaveDisplay: React.FC<WaveDisplayProps> = ({ wave, isResting, timer, objectiveText }) => {
  const statusText = isResting
    ? `休息 ${timer ?? 0} 秒`
    : objectiveText ?? `剩餘 ${timer ?? 0} 秒`;
  const statusTone = isResting
    ? 'text-green-400'
    : objectiveText
      ? 'text-amber-300'
      : 'text-red-400';

  return (
    <div className="flex flex-col items-center z-10">
      <div className="bg-neutral-900/80 backdrop-blur-sm p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-neutral-700 shadow-lg text-center min-w-[110px] sm:min-w-[190px]">
        <div className="text-sm sm:text-xl font-black text-white leading-none mb-1">第 {wave} 波</div>
        <div className={`text-[10px] sm:text-sm font-bold leading-none ${statusTone}`}>
          {statusText}
        </div>
      </div>
    </div>
  );
};
