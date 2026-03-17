// ── TestModePanel.tsx ─────────────────────────────────────────────────────────
// 左側可收折測試面板（只在 testMode 時顯示）
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { Game } from '../../game/Game';
import { ZombieType } from '../../game/types';
import { ItemType } from '../../game/Item';
import { ObstacleType } from '../../game/types';

interface Props {
  gameRef: React.RefObject<Game | null>;
}

// ── 分類區塊 ─────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-gray-700">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-3 py-2 text-xs font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 flex justify-between items-center"
      >
        {title}
        <span className="text-gray-500">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="p-2 space-y-1">{children}</div>}
    </div>
  );
}

// ── 小按鈕 ────────────────────────────────────────────────────────────────────
// key?: 讓 React .map() 使用時不報 TS2322
function Btn({
  children, onClick, color = 'gray', active = false, className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  color?: 'gray' | 'red' | 'green' | 'blue' | 'yellow' | 'purple';
  active?: boolean;
  className?: string;
  key?: string | number;
}) {
  const base = 'px-2 py-1 rounded text-xs font-bold cursor-pointer border transition-colors ';
  const cols: Record<string, string> = {
    gray:   'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600',
    red:    'bg-red-900 border-red-700 text-red-200 hover:bg-red-700',
    green:  'bg-green-900 border-green-700 text-green-200 hover:bg-green-700',
    blue:   'bg-blue-900 border-blue-700 text-blue-200 hover:bg-blue-700',
    yellow: 'bg-yellow-900 border-yellow-700 text-yellow-200 hover:bg-yellow-700',
    purple: 'bg-purple-900 border-purple-700 text-purple-200 hover:bg-purple-700',
  };
  return (
    <button
      onClick={onClick}
      className={base + cols[color] + (active ? ' ring-1 ring-white' : '') + ' ' + className}
    >
      {children}
    </button>
  );
}

// ── +/- 等級控制 ──────────────────────────────────────────────────────────────
function LevelCtrl({
  label, emoji, level, onWeapon, onLevel,
}: {
  label: string; emoji: string; level: number;
  onWeapon: () => void; onLevel: (d: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={onWeapon} className="text-base hover:scale-110 transition-transform cursor-pointer" title={`切換至${label}`}>
        {emoji}
      </button>
      <span className="text-xs text-gray-400 w-10 truncate">{label}</span>
      <button onClick={() => onLevel(-1)} className="w-5 h-5 bg-gray-700 rounded text-xs text-gray-200 hover:bg-gray-600 flex items-center justify-center">−</button>
      <span className="w-5 text-center text-xs text-yellow-300 font-bold">{level}</span>
      <button onClick={() => onLevel(+1)} className="w-5 h-5 bg-gray-700 rounded text-xs text-gray-200 hover:bg-gray-600 flex items-center justify-center">＋</button>
    </div>
  );
}

// ── 主面板 ────────────────────────────────────────────────────────────────────
export function TestModePanel({ gameRef }: Props) {
  const [open, setOpen] = useState(false);
  const [targetPid, setTargetPid] = useState(1);
  const [spawnCount, setSpawnCount] = useState<1 | 5 | 10>(1);
  const [p1Lv, setP1Lv] = useState(1);
  const [p2Lv, setP2Lv] = useState(1);

  const g = () => gameRef.current;

  // 同步 backtick 鍵盤開關
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '`') setOpen(v => !v);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const player = () => g()?.players.find(p => p.id === targetPid) ?? g()?.players[0];

  const setWeapon = (w: 'sword' | 'gun') => {
    const lv = targetPid === 1 ? p1Lv : p2Lv;
    g()?.debugSetWeapon(targetPid, w, lv);
  };

  const changeLevel = (w: 'sword' | 'gun', d: number) => {
    const cur = targetPid === 1 ? p1Lv : p2Lv;
    const next = Math.max(1, Math.min(5, cur + d));
    if (targetPid === 1) setP1Lv(next); else setP2Lv(next);
    g()?.debugSetWeapon(targetPid, w, next);
  };

  const statusActive = (key: 'shield' | 'speedBoost' | 'slowDebuff' | 'glow') => {
    const p = player();
    if (!p) return false;
    if (key === 'shield')     return p.shield;
    if (key === 'speedBoost') return p.speedBoostTimer > 0;
    if (key === 'slowDebuff') return p.slowDebuffTimer > 0;
    if (key === 'glow')       return p.isInfiniteGlow;
    return false;
  };

  const zombies: { type: ZombieType; emoji: string; label: string; color: 'gray' | 'red' | 'green' | 'blue' | 'yellow' | 'purple' }[] = [
    { type: 'normal',      emoji: '🟢', label: '普通',   color: 'green'  },
    { type: 'big',         emoji: '🟣', label: '大型',   color: 'purple' },
    { type: 'slime',       emoji: '🟡', label: '黏液',   color: 'yellow' },
    { type: 'slime_small', emoji: '🟡', label: '黏液小', color: 'yellow' },
    { type: 'spitter',     emoji: '💜', label: '吐口水', color: 'purple' },
    { type: 'butcher',     emoji: '🔴', label: '屠夫',   color: 'red'    },
  ];

  const items: { type: ItemType; emoji: string; label: string }[] = [
    { type: 'weapon_sword', emoji: '🗡️', label: '劍' },
    { type: 'weapon_gun',   emoji: '🔫', label: '槍' },
    { type: 'speed',        emoji: '💨', label: '速度' },
    { type: 'shield',       emoji: '🛡️', label: '護盾' },
    { type: 'energy_orb',   emoji: '🔮', label: 'XP球' },
  ];

  const obstacles: { type: ObstacleType; emoji: string; label: string }[] = [
    { type: 'sandbag',          emoji: '🪣', label: '沙包'  },
    { type: 'electric_fence',   emoji: '⚡', label: '電網'  },
    { type: 'explosive_barrel', emoji: '🛢️', label: '爆炸桶'},
    { type: 'tombstone',        emoji: '🪦', label: '墓碑'  },
    { type: 'vending_machine',  emoji: '🏧', label: '販賣機'},
    { type: 'container',        emoji: '📦', label: '貨櫃'  },
    { type: 'altar',            emoji: '⛩️', label: '祭壇'  },
    { type: 'monolith',         emoji: '🗿', label: '巨石'  },
  ];

  const curLv = targetPid === 1 ? p1Lv : p2Lv;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-50 bg-gray-900/90 border border-gray-600 text-gray-300 text-xs px-1 py-3 rounded-r-lg hover:bg-gray-800 cursor-pointer"
        title="開啟測試面板 (`)"
      >
        🔧
      </button>
    );
  }

  return (
    <div className="fixed left-0 top-0 h-full z-50 flex flex-col w-52 bg-gray-900/95 border-r border-gray-700 overflow-y-auto text-white select-none">
      {/* 標題列 */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <span className="text-xs font-bold text-green-400">🔧 TEST MODE</span>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-xs cursor-pointer">✕</button>
      </div>

      {/* ── 玩家目標選擇 ── */}
      {g()?.players && g()!.players.length > 1 && (
        <div className="flex gap-1 px-2 py-1 bg-gray-800/60 border-b border-gray-700">
          <span className="text-xs text-gray-400 self-center">目標:</span>
          {[1, 2].map(pid => (
            <Btn key={pid} onClick={() => setTargetPid(pid)} color="blue" active={targetPid === pid}>
              P{pid}
            </Btn>
          ))}
        </div>
      )}

      {/* ── 玩家 ── */}
      <Section title="👤 玩家">
        <Btn onClick={() => g()?.debugHealAll()} color="green" className="w-full">
          💉 滿血（所有玩家）
        </Btn>

        <LevelCtrl
          label="劍" emoji="🗡️"
          level={curLv}
          onWeapon={() => setWeapon('sword')}
          onLevel={d => changeLevel('sword', d)}
        />
        <LevelCtrl
          label="槍" emoji="🔫"
          level={curLv}
          onWeapon={() => setWeapon('gun')}
          onLevel={d => changeLevel('gun', d)}
        />
      </Section>

      {/* ── 狀態 ── */}
      <Section title="✨ 狀態">
        <div className="grid grid-cols-2 gap-1">
          {([
            { key: 'shield',     emoji: '🛡️', label: '護盾'     },
            { key: 'speedBoost', emoji: '💨', label: '加速'     },
            { key: 'slowDebuff', emoji: '🟫', label: '減速'     },
            { key: 'glow',       emoji: '🌟', label: '無限光芒' },
          ] as const).map(({ key, emoji, label }) => (
            <Btn
              key={key}
              onClick={() => g()?.debugToggleStatus(targetPid, key)}
              color={key === 'slowDebuff' ? 'yellow' : 'blue'}
              active={statusActive(key)}
            >
              {emoji} {label}
            </Btn>
          ))}
        </div>
      </Section>

      {/* ── 殭屍 ── */}
      <Section title="🧟 殭屍">
        <div className="flex gap-1 mb-1">
          <span className="text-xs text-gray-400 self-center">數量:</span>
          {([1, 5, 10] as const).map(n => (
            <Btn key={n} onClick={() => setSpawnCount(n)} color="gray" active={spawnCount === n}>
              ×{n}
            </Btn>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {zombies.map(({ type, emoji, label, color }) => (
            <Btn key={type} onClick={() => g()?.debugSpawnZombie(type, spawnCount)} color={color}>
              {emoji} {label}
            </Btn>
          ))}
        </div>
        <Btn onClick={() => { if (g()) g()!.zombies = []; }} color="red" className="w-full mt-1">
          🧹 清除全部殭屍
        </Btn>
      </Section>

      {/* ── 物品 ── */}
      <Section title="🎁 物品">
        <div className="grid grid-cols-2 gap-1">
          {items.map(({ type, emoji, label }) => (
            <Btn key={type} onClick={() => g()?.debugSpawnItem(type)} color="blue">
              {emoji} {label}
            </Btn>
          ))}
        </div>
        <Btn onClick={() => { if (g()) g()!.items = []; }} color="red" className="w-full mt-1">
          🧹 清除物品
        </Btn>
      </Section>

      {/* ── 障礙物 ── */}
      <Section title="🧱 障礙物">
        <div className="grid grid-cols-2 gap-1">
          {obstacles.map(({ type, emoji, label }) => (
            <Btn key={type} onClick={() => g()?.debugSpawnObstacle(type)} color="gray">
              {emoji} {label}
            </Btn>
          ))}
        </div>
      </Section>

      {/* ── 遊戲控制 ── */}
      <Section title="🎮 遊戲控制">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">波次:</span>
          <button
            onClick={() => g()?.debugSetWave((g()?.waveManager.currentWave ?? 1) - 1)}
            className="w-5 h-5 bg-gray-700 rounded text-xs text-gray-200 hover:bg-gray-600 flex items-center justify-center cursor-pointer"
          >−</button>
          <span className="w-8 text-center text-xs text-yellow-300 font-bold">
            {g()?.waveManager.currentWave ?? 1}
          </span>
          <button
            onClick={() => g()?.debugSetWave((g()?.waveManager.currentWave ?? 1) + 1)}
            className="w-5 h-5 bg-gray-700 rounded text-xs text-gray-200 hover:bg-gray-600 flex items-center justify-center cursor-pointer"
          >＋</button>
        </div>
        <Btn
          onClick={() => g()?.debugTogglePause()}
          color={g()?.debugPaused ? 'yellow' : 'gray'}
          active={g()?.debugPaused ?? false}
          className="w-full mt-1"
        >
          {g()?.debugPaused ? '▶ 繼續生成' : '⏸ 暫停生成'}
        </Btn>
        <div className="grid grid-cols-2 gap-1 mt-1">
          <Btn onClick={() => g()?.debugClearSlime()} color="gray">🧹 黏液</Btn>
          <Btn onClick={() => { if (g()) g()!.hitEffects = []; }} color="gray">🧹 特效</Btn>
          <Btn onClick={() => { if (g()) g()!.players.forEach(p => { p.hp = p.maxHp; }); }} color="green">
            💊 全員滿血
          </Btn>
          <Btn onClick={() => { if (g()) g()!.zombies = []; }} color="red">🗑️ 清殭屍</Btn>
        </div>
      </Section>

      <div className="px-3 py-2 text-xs text-gray-600 text-center">`（反引號）收折</div>
    </div>
  );
}
