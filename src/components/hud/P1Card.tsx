// ── P1Card.tsx ────────────────────────────────────────────────────────────────
import React from 'react';
import { Player } from '../../game/Player';

interface P1CardProps {
  p1State: Player;
  p1RespawnCountdown: number;
}

export const P1Card: React.FC<P1CardProps> = ({ p1State, p1RespawnCountdown }) => (
  <div className="absolute left-0 top-0 bg-neutral-900/80 backdrop-blur-sm p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-500/30 w-[32%] sm:w-64 max-w-[16rem] shadow-lg">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1 sm:mb-2 gap-1">
      <div className="text-blue-400 font-bold text-xs sm:text-lg leading-none">Player 1</div>
      <div className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md text-[8px] sm:text-sm font-bold leading-none">
        Lv.{p1State.level}{p1State.prestigeLevel > 0 ? ` (+${p1State.prestigeLevel})` : ''}
      </div>
    </div>
    {p1RespawnCountdown > 0 ? (
      <div className="w-full h-3 sm:h-4 rounded-full mb-1 sm:mb-2 flex items-center justify-center bg-neutral-800 border border-red-500/50">
        <span className="text-[8px] sm:text-[10px] font-bold text-red-400">{p1RespawnCountdown}s 復活</span>
      </div>
    ) : (
      <div className="w-full bg-neutral-800 h-3 sm:h-4 rounded-full mb-1 sm:mb-2 overflow-hidden border border-neutral-700 relative">
        <div className="bg-gradient-to-r from-red-600 to-red-400 h-full transition-all duration-300" style={{ width: `${(p1State.hp / p1State.maxHp) * 100}%` }} />
        <div className="absolute inset-0 flex items-center justify-center text-[8px] sm:text-[10px] font-bold text-white drop-shadow-sm">
          {Math.ceil(p1State.hp)} / {p1State.maxHp}
        </div>
      </div>
    )}
    <div className="w-full bg-neutral-800 h-1.5 sm:h-2 rounded-full mb-1 overflow-hidden border border-neutral-700">
      <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-full transition-all duration-300" style={{ width: `${p1State.level === 5 ? 100 : (p1State.xp / p1State.maxXp) * 100}%` }} />
    </div>
    <div className="text-[8px] sm:text-[10px] text-neutral-400 font-mono text-right uppercase tracking-tighter leading-none">
      {p1State.level === 5 ? 'MAX' : `${p1State.xp}/${p1State.maxXp}`}
    </div>
  </div>
);
