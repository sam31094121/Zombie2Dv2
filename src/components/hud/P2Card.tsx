// ── P2Card.tsx ────────────────────────────────────────────────────────────────
import React from 'react';
import { Player } from '../../game/Player';

interface P2CardProps {
  p2State: Player;
  p2RespawnCountdown: number;
}

export const P2Card: React.FC<P2CardProps> = ({ p2State, p2RespawnCountdown }) => (
  <div className="absolute right-0 top-0 bg-neutral-900/80 backdrop-blur-sm p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-green-500/30 w-[32%] sm:w-64 max-w-[16rem] shadow-lg text-right">
    <div className="flex flex-col-reverse sm:flex-row justify-between items-end sm:items-center mb-1 sm:mb-2 gap-1">
      <div className="bg-green-500/20 text-green-300 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md text-[8px] sm:text-sm font-bold leading-none">
        Lv.{p2State.level}{p2State.prestigeLevel > 0 ? ` (+${p2State.prestigeLevel})` : ''}
      </div>
      <div className="text-green-400 font-bold text-xs sm:text-lg leading-none">玩家 2</div>
    </div>
    {p2RespawnCountdown > 0 ? (
      <div className="w-full h-3 sm:h-4 rounded-full mb-1 sm:mb-2 flex items-center justify-center bg-neutral-800 border border-red-500/50">
        <span className="text-[8px] sm:text-[10px] font-bold text-red-400">{p2RespawnCountdown}s 復活</span>
      </div>
    ) : (
      <div className="w-full bg-neutral-800 h-3 sm:h-4 rounded-full mb-1 sm:mb-2 overflow-hidden border border-neutral-700 relative flex justify-end">
        <div className="bg-gradient-to-l from-red-600 to-red-400 h-full transition-all duration-300" style={{ width: `${(p2State.hp / p2State.maxHp) * 100}%` }} />
        <div className="absolute inset-0 flex items-center justify-center text-[8px] sm:text-[10px] font-bold text-white drop-shadow-sm">
          {Math.ceil(p2State.hp)} / {p2State.maxHp}
        </div>
      </div>
    )}
    <div className="w-full bg-neutral-800 h-1.5 sm:h-2 rounded-full mb-1 overflow-hidden border border-neutral-700 flex justify-end">
      <div className="bg-gradient-to-l from-green-600 to-green-400 h-full transition-all duration-300" style={{ width: `${p2State.level === 5 ? 100 : (p2State.xp / p2State.maxXp) * 100}%` }} />
    </div>
    <div className="text-[8px] sm:text-[10px] text-neutral-400 font-mono text-left uppercase tracking-tighter leading-none">
      {p2State.level === 5 ? 'MAX' : `${p2State.xp}/${p2State.maxXp}`}
    </div>
  </div>
);
