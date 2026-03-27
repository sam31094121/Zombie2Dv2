// ── P2Card.tsx ────────────────────────────────────────────────────────────────
import React from 'react';
import { Player } from '../../game/Player';

interface P2CardProps {
  p2State: Player;
  p2RespawnCountdown: number;
}

export const P2Card: React.FC<P2CardProps> = ({ p2State, p2RespawnCountdown }) => (
  <div className="absolute right-4 top-4 w-40 sm:w-64 select-none pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-right">
    <div className="flex items-center justify-end mb-1 gap-2">
      <div className="text-white bg-green-600/40 px-1.5 py-0.5 rounded text-[10px] sm:text-sm font-bold border border-green-400/20 order-1">
        Lv.{p2State.level}{p2State.prestigeLevel > 0 ? ` (+${p2State.prestigeLevel})` : ''}
      </div>
      <div className="text-green-400 font-black text-sm sm:text-xl tracking-tighter italic order-2">P2</div>
    </div>
    
    {p2RespawnCountdown > 0 ? (
      <div className="w-full h-4 rounded-sm mb-1 flex items-center justify-end">
        <span className="text-xs font-bold text-red-500 animate-pulse">REBSPAWNING: {p2RespawnCountdown}s</span>
      </div>
    ) : (
      <div className="w-full mb-1">
        <div className="flex justify-between items-end mb-0.5 flex-row-reverse">
          <span className="text-[10px] sm:text-xs font-black text-white/90">HP</span>
          <span className="text-[10px] sm:text-xs font-bold text-white/90">{Math.ceil(p2State.hp)} / {p2State.maxHp}</span>
        </div>
        <div className="w-full bg-black/40 h-2.5 sm:h-3 rounded-sm overflow-hidden border border-white/10 flex justify-end">
          <div 
            className="bg-gradient-to-l from-red-600 to-red-400 h-full transition-all duration-300 shadow-[0_0_10px_rgba(239,68,68,0.6)]" 
            style={{ width: `${(p2State.hp / p2State.maxHp) * 100}%` }} 
          />
        </div>
      </div>
    )}

    <div className="w-full">
      <div className="flex justify-between items-end mb-0.5 flex-row-reverse">
        <span className="text-[8px] sm:text-[10px] font-black text-green-300/80">XP</span>
        <span className="text-[8px] sm:text-[10px] font-bold text-green-200/80">
          {p2State.level === 5 ? 'MAX' : `${p2State.xp}/${p2State.maxXp}`}
        </span>
      </div>
      <div className="w-full bg-black/40 h-1 sm:h-1.5 rounded-sm overflow-hidden border border-white/5 flex justify-end">
        <div 
          className="bg-gradient-to-l from-green-600 to-green-400 h-full transition-all duration-300 shadow-[0_0_5px_rgba(34,197,94,0.5)]" 
          style={{ width: `${p2State.level === 5 ? 100 : (p2State.xp / p2State.maxXp) * 100}%` }} 
        />
      </div>
    </div>
  </div>
);
