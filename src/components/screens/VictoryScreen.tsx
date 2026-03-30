// ── VictoryScreen.tsx ─────────────────────────────────────────────────────────
// 競技場模式通關畫面（完成第 10 波）
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';

interface Props {
  kills: number;
  playerCount: number;
  onMainMenu: () => void;
}

export const VictoryScreen: React.FC<Props> = ({ kills, playerCount, onMainMenu }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at 50% 40%, #1a0f00 0%, #060400 100%)',
        opacity: show ? 1 : 0,
        transition: 'opacity 0.6s ease',
      }}
    >
      {/* Decorative top glow */}
      <div
        style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '60%', height: '2px',
          background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)',
        }}
      />

      {/* Trophy */}
      <div
        className="text-7xl mb-4"
        style={{ filter: 'drop-shadow(0 0 24px #f59e0b88)' }}
      >
        🏆
      </div>

      {/* Title */}
      <h1
        className="text-3xl font-black tracking-widest mb-1"
        style={{ color: '#fbbf24', textShadow: '0 0 30px #f59e0b66' }}
      >
        競技場通關
      </h1>

      <p className="text-neutral-400 text-sm mb-8 tracking-wider">
        已清除全 10 波殭屍
      </p>

      {/* Stats panel */}
      <div
        className="rounded-2xl px-8 py-5 mb-8 flex gap-10"
        style={{ background: '#0d0a02', border: '1px solid #f59e0b22' }}
      >
        <div className="text-center">
          <p className="text-neutral-500 text-xs tracking-widest uppercase mb-1">擊殺數</p>
          <p className="text-2xl font-bold text-white">{kills}</p>
        </div>
        <div className="text-center">
          <p className="text-neutral-500 text-xs tracking-widest uppercase mb-1">完成波次</p>
          <p className="text-2xl font-bold" style={{ color: '#fbbf24' }}>10 / 10</p>
        </div>
        <div className="text-center">
          <p className="text-neutral-500 text-xs tracking-widest uppercase mb-1">玩家</p>
          <p className="text-2xl font-bold text-white">{playerCount}P</p>
        </div>
      </div>

      {/* Button */}
      <button
        onClick={onMainMenu}
        className="px-10 py-3 rounded-xl font-bold text-base tracking-wider transition-all active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #92400e, #b45309)',
          color: '#fde68a',
          border: '1px solid #f59e0b44',
          boxShadow: '0 0 20px #f59e0b22',
        }}
      >
        回主選單
      </button>

      {/* Decorative bottom glow */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '40%', height: '1px',
          background: 'linear-gradient(90deg, transparent, #f59e0b66, transparent)',
        }}
      />
    </div>
  );
};
