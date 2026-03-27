// ── P1Card.tsx ────────────────────────────────────────────────────────────────
import React from 'react';
import { Player } from '../../game/Player';

interface P1CardProps {
  p1State: Player;
  p1RespawnCountdown: number;
}

export const P1Card: React.FC<P1CardProps> = ({ p1State, p1RespawnCountdown }) => (
  <div className="absolute left-4 top-4 w-40 sm:w-64 select-none pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
    <div className="flex items-center mb-1 gap-2">
      <div className="text-blue-400 font-black text-sm sm:text-xl tracking-tighter italic">P1</div>
      <div className="text-white bg-blue-600/40 px-1.5 py-0.5 rounded text-[10px] sm:text-sm font-bold border border-blue-400/20">
        Lv.{p1State.level}{p1State.prestigeLevel > 0 ? ` (+${p1State.prestigeLevel})` : ''}
      </div>
    </div>
    
    {p1RespawnCountdown > 0 ? (
      <div className="w-full h-4 rounded-sm mb-1 flex items-center justify-start">
        <span className="text-xs font-bold text-red-500 animate-pulse">REBSPAWNING: {p1RespawnCountdown}s</span>
      </div>
    ) : (
      <div className="w-full mb-1">
        <div className="flex justify-between items-end mb-0.5">
          <span className="text-[10px] sm:text-xs font-black text-white/90">HP</span>
          <span className="text-[10px] sm:text-xs font-bold text-white/90">{Math.ceil(p1State.hp)} / {p1State.maxHp}</span>
        </div>
        <div className="w-full bg-black/40 h-2.5 sm:h-3 rounded-sm overflow-hidden border border-white/10">
          <div 
            className="bg-gradient-to-r from-red-600 to-red-400 h-full transition-all duration-300 shadow-[0_0_10px_rgba(239,68,68,0.6)]" 
            style={{ width: `${(p1State.hp / p1State.maxHp) * 100}%` }} 
          />
        </div>
      </div>
    )}

    <div className="w-full">
      <div className="flex justify-between items-end mb-0.5">
        <span className="text-[8px] sm:text-[10px] font-black text-blue-300/80 text-shadow-sm">XP</span>
        <span className="text-[8px] sm:text-[10px] font-bold text-blue-200/80">
          {p1State.level === 5 ? 'MAX' : `${p1State.xp}/${p1State.maxXp}`}
        </span>
      </div>
      <div className="w-full bg-black/40 h-1 sm:h-1.5 rounded-sm overflow-hidden border border-white/5">
        <div 
          className="bg-gradient-to-r from-blue-600 to-blue-400 h-full transition-all duration-300 shadow-[0_0_5px_rgba(59,130,246,0.5)]" 
          style={{ width: `${p1State.level === 5 ? 100 : (p1State.xp / p1State.maxXp) * 100}%` }} 
        />
      </div>
    </div>
  </div>
);
