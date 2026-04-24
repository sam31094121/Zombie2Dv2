// ── TestModePanel.tsx ─────────────────────────────────────────────────────────
// 測試面板：原始 Section 排版 + 殭屍/物品/障礙物 用 Canvas 真實繪製
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Game }        from '../../game/Game';
import { ZombieType }  from '../../game/types';
import { ItemType }    from '../../game/Item';
import { ObstacleType } from '../../game/types';
import { drawZombie }  from '../../game/renderers/ZombieRenderer';

interface Props { gameRef: React.RefObject<Game | null>; }

// ── 每種殭屍的 radius（對應 ZombieDefinitions）───────────────────────────────
const ZOMBIE_RADIUS: Record<ZombieType, number> = {
  normal: 12, big: 30, slime: 16, slime_small: 10, spitter: 18, butcher: 40, ghost: 14, goblin_courier: 13,
};

// ── 建立殭屍預覽用假物件 ─────────────────────────────────────────────────────
function makeMockZombie(type: ZombieType, t: number) {
  return {
    type,
    radius:            ZOMBIE_RADIUS[type],
    x:                 0,   // 由呼叫端 translate 到中心
    y:                 0,
    angle:             Math.PI / 2,
    time:              t,
    isInsideContainer: false,
    leanBackTimer:     0,
    hp:                100,
    maxHp:             100,
    flashWhiteTimer:   0,
    isInfiniteGlow:    false,
    isCloseToPlayer:   false,
    jellyPhase:        t * 0.001,
    extraState:        new Map([['phase', 'walk']]),
    isDestroyed:       false,
    vx: 0, vy: 0,
  } as unknown as import('../../game/Zombie').Zombie;
}

// ── 殭屍 Canvas 預覽（真實 drawZombie 動畫）──────────────────────────────────
function ZombieCard({
  type, label, color, active, onClick, spawnCount,
}: {
  type: ZombieType; label: string; color: string;
  active: boolean; onClick: () => void; spawnCount: number; key?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    // cy: 為了把 HP bar 推到頂部裁切區外，往下偏移
    const cy = H / 2 + 6;

    const render = () => {
      // 背景
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = active ? '#0f2a4a' : '#0d0d1a';
      ctx.fillRect(0, 0, W, H);

      const t = performance.now();
      const mock = makeMockZombie(type, t);
      mock.x = cx;
      mock.y = cy;

      // 裁切：把 HP bar（在角色上方）藏掉
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 14, W, H);   // 頂部 14px 不顯示（HP bar 區）
      ctx.clip();
      drawZombie(mock, ctx);
      ctx.restore();

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [type, active]);

  return (
    <button
      onClick={onClick}
      title={`生成 ${label} ×${spawnCount}`}
      className="relative flex flex-col items-center rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 active:scale-95"
      style={{
        border: `2px solid ${active ? color : '#333'}`,
        boxShadow: active ? `0 0 10px ${color}55` : 'none',
        background: active ? '#0f2a4a' : '#0d0d1a',
        width: 80, height: 88,
      }}
    >
      <canvas ref={canvasRef} width={80} height={72}
              style={{ imageRendering: 'pixelated', display: 'block' }} />
      <div className="w-full text-center text-xs font-bold py-0.5"
           style={{ color, background: '#00000055' }}>
        {label}
      </div>
    </button>
  );
}

// ── 物品 Canvas（簡單幾何，符合遊戲風格）─────────────────────────────────────
function ItemCard({ type, label, active, onClick }: {
  type: ItemType; label: string; active: boolean; onClick: () => void; key?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;

    let raf: number;
    const render = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = active ? '#0f2a4a' : '#0d0d1a';
      ctx.fillRect(0, 0, W, H);
      const t = performance.now() / 1000;

      if (type === 'weapon_sword') {
        // 劍形
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4 + Math.sin(t * 1.2) * 0.08);
        ctx.fillStyle = '#aaa'; ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
        // 刀身
        ctx.beginPath(); ctx.roundRect(-3, -22, 6, 32, 2); ctx.fill(); ctx.stroke();
        // 護手
        ctx.fillStyle = '#888';
        ctx.beginPath(); ctx.roundRect(-10, 8, 20, 5, 2); ctx.fill(); ctx.stroke();
        // 握把
        ctx.fillStyle = '#6d4c41';
        ctx.beginPath(); ctx.roundRect(-3, 13, 6, 14, 2); ctx.fill(); ctx.stroke();
        // 刀刃高光
        ctx.fillStyle = '#eee';
        ctx.beginPath(); ctx.roundRect(-1, -20, 2, 28, 1); ctx.fill();
        ctx.restore();

      } else if (type === 'weapon_gun') {
        // 槍形
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI / 6 + Math.sin(t) * 0.05);
        // 槍管
        ctx.fillStyle = '#555'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(-4, -24, 8, 30, 2); ctx.fill(); ctx.stroke();
        // 槍身
        ctx.fillStyle = '#666';
        ctx.beginPath(); ctx.roundRect(-8, 2, 16, 12, 3); ctx.fill(); ctx.stroke();
        // 握把
        ctx.fillStyle = '#4a4a4a';
        ctx.beginPath(); ctx.roundRect(-5, 12, 10, 16, 3); ctx.fill(); ctx.stroke();
        // 槍口閃光
        ctx.fillStyle = '#ffeb3b';
        ctx.shadowColor = '#ffeb3b'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(0, -26, 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

      } else if (type === 'speed') {
        // 速度符文（閃電）
        ctx.save(); ctx.translate(cx, cy);
        ctx.fillStyle = `hsl(${(t * 100) % 360}, 100%, 60%)`;
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(6, -22); ctx.lineTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(-6, 22);
        ctx.lineTo(8, -4); ctx.lineTo(0, -4); ctx.lineTo(10, -22);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

      } else if (type === 'shield') {
        // 護盾
        ctx.save(); ctx.translate(cx, cy);
        const pulse = 1 + Math.sin(t * 2) * 0.05;
        ctx.scale(pulse, pulse);
        ctx.fillStyle = '#1565c0'; ctx.strokeStyle = '#42a5f5'; ctx.lineWidth = 2;
        ctx.shadowColor = '#42a5f5'; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -22); ctx.lineTo(18, -12); ctx.lineTo(18, 8);
        ctx.quadraticCurveTo(18, 26, 0, 30);
        ctx.quadraticCurveTo(-18, 26, -18, 8);
        ctx.lineTo(-18, -12); ctx.closePath();
        ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
        // 十字紋
        ctx.strokeStyle = '#90caf9'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-12, 2); ctx.lineTo(12, 2); ctx.stroke();
        ctx.restore();

      } else if (type === 'energy_orb') {
        // XP 球
        ctx.save(); ctx.translate(cx, cy);
        const orb = 1 + Math.sin(t * 3) * 0.08;
        ctx.scale(orb, orb);
        const grad = ctx.createRadialGradient(-5, -5, 2, 0, 0, 18);
        grad.addColorStop(0, '#e040fb');
        grad.addColorStop(1, '#4a148c');
        ctx.fillStyle = grad;
        ctx.shadowColor = '#e040fb'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // 高光
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.ellipse(-5, -6, 5, 3, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [type, active]);

  return (
    <button onClick={onClick} title={label}
            className="relative flex flex-col items-center rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 active:scale-95"
            style={{ border: `2px solid ${active ? '#60a5fa' : '#333'}`, background: active ? '#0f2a4a' : '#0d0d1a', width: 80, height: 88 }}>
      <canvas ref={canvasRef} width={80} height={72} style={{ imageRendering: 'pixelated', display: 'block' }} />
      <div className="w-full text-center text-xs font-bold py-0.5" style={{ color: active ? '#60a5fa' : '#aaa', background: '#00000055' }}>
        {label}
      </div>
    </button>
  );
}

// ── 障礙物 Canvas ─────────────────────────────────────────────────────────────
function ObstacleCard({ type, label, active, onClick }: {
  type: ObstacleType; label: string; active: boolean; onClick: () => void; key?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    let raf: number;

    const render = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = active ? '#1a1a0a' : '#0d0d0d';
      ctx.fillRect(0, 0, W, H);
      const t = performance.now() / 1000;
      ctx.save(); ctx.translate(cx, cy);

      if (type === 'sandbag') {
        ctx.fillStyle = '#c8a96e'; ctx.strokeStyle = '#8b7355'; ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.ellipse(i * 14, 4, 12, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.beginPath(); ctx.ellipse(-7, -8, 12, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(7, -8, 12, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      } else if (type === 'electric_fence') {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-24, -4); ctx.lineTo(24, -4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-24, 4); ctx.lineTo(24, 4); ctx.stroke();
        for (let x = -20; x <= 20; x += 10) {
          ctx.beginPath(); ctx.moveTo(x, -12); ctx.lineTo(x, 12); ctx.stroke();
        }
        // 電花
        ctx.strokeStyle = `hsl(60, 100%, ${50 + Math.sin(t * 8) * 30}%)`;
        ctx.lineWidth = 2; ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(-8, -4); ctx.lineTo(-2, 0); ctx.lineTo(-6, 4); ctx.lineTo(0, 0); ctx.lineTo(8, -4);
        ctx.stroke(); ctx.shadowBlur = 0;

      } else if (type === 'explosive_barrel') {
        // 桶身
        ctx.fillStyle = '#c62828'; ctx.strokeStyle = '#b71c1c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-14, -18, 28, 36, 4); ctx.fill(); ctx.stroke();
        // 金屬箍
        ctx.strokeStyle = '#888'; ctx.lineWidth = 3;
        [-8, 4, 16].forEach(y => {
          ctx.beginPath(); ctx.moveTo(-14, y - 18 + 9); ctx.lineTo(14, y - 18 + 9); ctx.stroke();
        });
        // 警告標誌
        ctx.fillStyle = '#ffeb3b';
        ctx.font = 'bold 18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚠', 0, 1);
        // 脈動光暈
        ctx.strokeStyle = `rgba(255,80,80,${0.3 + Math.sin(t * 3) * 0.2})`;
        ctx.lineWidth = 2; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 8 + Math.sin(t * 3) * 4;
        ctx.beginPath(); ctx.roundRect(-14, -18, 28, 36, 4); ctx.stroke(); ctx.shadowBlur = 0;

      } else if (type === 'tombstone') {
        ctx.fillStyle = '#607d8b'; ctx.strokeStyle = '#37474f'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-14, -24, 28, 36, [8, 8, 2, 2]); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#546e7a';
        ctx.beginPath(); ctx.rect(-14, 8, 28, 4); ctx.fill();
        ctx.fillStyle = '#cfd8dc'; ctx.font = 'bold 14px serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('†', 0, -6);
        ctx.font = '8px Arial'; ctx.fillStyle = '#90a4ae';
        ctx.fillText('R.I.P', 0, 8);

      } else if (type === 'vending_machine') {
        ctx.fillStyle = '#1565c0'; ctx.strokeStyle = '#0d47a1'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-18, -26, 36, 52, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#0d1b3e';
        ctx.beginPath(); ctx.roundRect(-13, -20, 26, 28, 3); ctx.fill();
        const items2 = ['🥤','🍫','⚡'];
        ctx.font = '10px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        items2.forEach((em, i) => ctx.fillText(em, (i - 1) * 9, -6));
        ctx.fillStyle = '#ef5350';
        ctx.beginPath(); ctx.roundRect(4, 14, 8, 8, 2); ctx.fill();
        ctx.fillStyle = '#555';
        ctx.beginPath(); ctx.roundRect(-13, 22, 26, 4, 2); ctx.fill();

      } else if (type === 'container') {
        ctx.fillStyle = '#e65100'; ctx.strokeStyle = '#bf360c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-24, -14, 48, 28, 3); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#bf360c'; ctx.lineWidth = 1.5;
        [-8, 8].forEach(x => { ctx.beginPath(); ctx.moveTo(x, -14); ctx.lineTo(x, 14); ctx.stroke(); });
        ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(24, 0); ctx.stroke();
        ctx.fillStyle = '#e8941a'; ctx.strokeStyle = '#c97016'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.rect(-6, -18, 12, 6); ctx.fill(); ctx.stroke();

      } else if (type === 'altar') {
        ctx.fillStyle = '#4a148c'; ctx.strokeStyle = '#7b1fa2'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(20, 14); ctx.lineTo(-20, 14); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6a1b9a';
        ctx.beginPath(); ctx.rect(-22, 14, 44, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = `hsl(${(t * 120) % 360}, 100%, 60%)`;
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
        ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✦', 0, -4);
        ctx.shadowBlur = 0;

      } else if (type === 'monolith') {
        ctx.fillStyle = '#212121'; ctx.strokeStyle = '#424242'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-10, -28); ctx.lineTo(10, -28); ctx.lineTo(14, 22); ctx.lineTo(-14, 22); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = `rgba(100,181,246,${0.5 + Math.sin(t * 1.5) * 0.4})`;
        ctx.lineWidth = 1.5; ctx.shadowColor = '#64b5f6'; ctx.shadowBlur = 8;
        [-12, -4, 4].forEach(y => { ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(8, y); ctx.stroke(); });
        ctx.shadowBlur = 0;
      }

      ctx.restore();
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [type, active]);

  return (
    <button onClick={onClick} title={label}
            className="relative flex flex-col items-center rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 active:scale-95"
            style={{ border: `2px solid ${active ? '#a3a3a3' : '#333'}`, background: active ? '#1a1a1a' : '#0d0d0d', width: 80, height: 88 }}>
      <canvas ref={canvasRef} width={80} height={72} style={{ imageRendering: 'pixelated', display: 'block' }} />
      <div className="w-full text-center text-xs font-bold py-0.5" style={{ color: active ? '#ddd' : '#777', background: '#00000055' }}>
        {label}
      </div>
    </button>
  );
}

// ── 分類區塊（原始 Section 排版）─────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-gray-800">
      <button onClick={() => setOpen(v => !v)}
              className="w-full text-left px-3 py-2 text-xs font-bold text-gray-300 bg-gray-900 hover:bg-gray-800 flex justify-between items-center cursor-pointer">
        {title}
        <span className="text-gray-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="p-2 space-y-2">{children}</div>}
    </div>
  );
}

// ── 小按鈕（原始 Btn）────────────────────────────────────────────────────────
function Btn({ children, onClick, color = 'gray', active = false, className = '' }: {
  children: React.ReactNode; onClick: () => void;
  color?: 'gray'|'red'|'green'|'blue'|'yellow'|'purple';
  active?: boolean; className?: string; key?: string | number;
}) {
  const cols: Record<string, string> = {
    gray:   'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700',
    red:    'bg-red-900   border-red-700   text-red-200   hover:bg-red-700',
    green:  'bg-green-900 border-green-700 text-green-200 hover:bg-green-700',
    blue:   'bg-blue-900  border-blue-700  text-blue-200  hover:bg-blue-700',
    yellow: 'bg-yellow-900 border-yellow-700 text-yellow-200 hover:bg-yellow-700',
    purple: 'bg-purple-900 border-purple-700 text-purple-200 hover:bg-purple-700',
  };
  return (
    <button onClick={onClick}
            className={`px-2 py-1 rounded text-xs font-bold cursor-pointer border transition-colors ${cols[color]} ${active ? 'ring-1 ring-white' : ''} ${className}`}>
      {children}
    </button>
  );
}

// ── 武器等級控制 ──────────────────────────────────────────────────────────────
function LevelCtrl({ label, emoji, level, onWeapon, onLevel }: {
  label: string; emoji: string; level: number;
  onWeapon: () => void; onLevel: (d: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={onWeapon} className="text-base hover:scale-110 transition-transform cursor-pointer" title={`切換至${label}`}>{emoji}</button>
      <span className="text-xs text-gray-400 w-8 truncate">{label}</span>
      <button onClick={() => onLevel(-1)} className="w-5 h-5 bg-gray-700 rounded text-xs text-gray-200 hover:bg-gray-600 flex items-center justify-center cursor-pointer">−</button>
      <span className="w-5 text-center text-xs text-yellow-300 font-bold">{level}</span>
      <button onClick={() => onLevel(+1)} className="w-5 h-5 bg-gray-700 rounded text-xs text-gray-200 hover:bg-gray-600 flex items-center justify-center cursor-pointer">＋</button>
    </div>
  );
}

// ── 主面板 ────────────────────────────────────────────────────────────────────
export function TestModePanel({ gameRef }: Props) {
  const [open, setOpen]     = useState(false);
  const [targetPid, setTargetPid] = useState(1);
  const [spawnCount, setSpawnCount] = useState<1|5|10>(1);
  const [p1Level, setP1Level] = useState(1);
  const [p2Level, setP2Level] = useState(1);
  const [selZombie, setSelZombie] = useState<ZombieType | null>(null);

  const g = () => gameRef.current;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === '`') setOpen(v => !v); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const getPlayerLevel = () => {
    const live = g()?.players.find(p => p.id === targetPid)?.level;
    if (typeof live === 'number') return live;
    return targetPid === 1 ? p1Level : p2Level;
  };

  const setPlayerLevelState = (pid: number, v: number) => {
    if (pid === 1) setP1Level(v);
    else setP2Level(v);
  };

  const getBranch = (w: 'sword'|'gun') =>
    g()?.players.find(p => p.id === targetPid)?.weaponBranches[w] ?? null;

  const changePlayerLevel = (d: number) => {
    const next = Math.max(1, Math.min(8, getPlayerLevel() + d));
    setPlayerLevelState(targetPid, next);
    g()?.debugSetPlayerLevel(targetPid, next);
  };

  const statusActive = (key: 'shield'|'speedBoost'|'slowDebuff'|'glow') => {
    const p = g()?.players.find(pl => pl.id === targetPid);
    if (!p) return false;
    if (key === 'shield')     return p.shield;
    if (key === 'speedBoost') return p.speedBoostTimer > 0;
    if (key === 'slowDebuff') return p.slowDebuffTimer > 0;
    return p.isInfiniteGlow;
  };

  const ZOMBIES: { type: ZombieType; label: string; color: string }[] = [
    { type: 'normal',      label: '普通',   color: '#81c784' },
    { type: 'big',         label: '大型',   color: '#ce93d8' },
    { type: 'slime',       label: '黏液',   color: '#dce775' },
    { type: 'slime_small', label: '小黏液', color: '#aed581' },
    { type: 'spitter',     label: '吐口水', color: '#ba68c8' },
    { type: 'butcher',     label: '屠夫',   color: '#ef9a9a' },
  ];

  const ITEMS: { type: ItemType; label: string }[] = [
    { type: 'weapon_sword', label: '劍'   },
    { type: 'weapon_gun',   label: '槍'   },
    { type: 'speed',        label: '速度' },
    { type: 'shield',       label: '護盾' },
    { type: 'energy_orb',   label: 'XP球' },
  ];

  const OBSTACLES: { type: ObstacleType; label: string }[] = [
    { type: 'sandbag',          label: '沙包'   },
    { type: 'electric_fence',   label: '電網'   },
    { type: 'explosive_barrel', label: '爆炸桶' },
    { type: 'streetlight',      label: '路燈'   },
    { type: 'tombstone',        label: '墓碑'   },
    { type: 'vending_machine',  label: '販賣機' },
    { type: 'container',        label: '貨櫃'   },
    { type: 'altar',            label: '祭壇'   },
    { type: 'monolith',         label: '巨石'   },
  ];

  if (!open) return (
    <button onClick={() => setOpen(true)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-[70] bg-gray-900/90 border border-gray-700 text-gray-300 text-xs px-1 py-3 rounded-r-lg hover:bg-gray-800 cursor-pointer"
            title="測試面板 (`)">🔧</button>
  );

  return (
    <div
      className="fixed left-0 top-0 h-full z-[70] flex flex-col w-52 bg-gray-950/97 border-r border-gray-800 overflow-y-auto text-white select-none"
      style={{ touchAction: 'pan-y', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >

      {/* 標題 */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <span className="text-xs font-black text-green-400">🔧 TEST MODE</span>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-xs cursor-pointer">✕</button>
      </div>

      {/* P1/P2 選擇 */}
      {(g()?.players.length ?? 0) > 1 && (
        <div className="flex gap-1 px-2 py-1 bg-gray-900/60 border-b border-gray-800">
          <span className="text-xs text-gray-500 self-center">目標:</span>
          {[1, 2].map(pid => (
            <Btn key={pid} onClick={() => setTargetPid(pid)} color="blue" active={targetPid === pid}>P{pid}</Btn>
          ))}
        </div>
      )}

      {/* ── 玩家 ── */}
      <Section title="👤 玩家">
        <Btn onClick={() => g()?.debugHealAll()} color="green" className="w-full">💉 滿血（所有玩家）</Btn>
        <LevelCtrl label="LV" emoji="🧬" level={getPlayerLevel()}
          onWeapon={() => g()?.debugSetPlayerLevel(targetPid, getPlayerLevel())}
          onLevel={changePlayerLevel} />
        <div className="grid grid-cols-2 gap-1">
          <Btn onClick={() => g()?.debugSetWeapon(targetPid, 'sword', getPlayerLevel())} color="blue">⚔ 刀</Btn>
          <Btn onClick={() => g()?.debugSetWeapon(targetPid, 'gun', getPlayerLevel())} color="yellow">🔫 槍</Btn>
        </div>
        {getPlayerLevel() >= 5 && (
          <div className="flex gap-1 pl-6">
            {(['A','B'] as const).map(b => (
              <Btn key={b} onClick={() => g()?.debugSetWeaponBranch(targetPid, 'sword', getBranch('sword') === b ? null : b)}
                   color={b === 'A' ? 'blue' : 'red'} active={getBranch('sword') === b}>
                {b === 'A' ? '🌪️' : '⚡'} {b}
              </Btn>
            ))}
          </div>
        )}
        {getPlayerLevel() >= 5 && (
          <div className="flex gap-1 pl-6">
            {(['A','B'] as const).map(b => (
              <Btn key={b} onClick={() => g()?.debugSetWeaponBranch(targetPid, 'gun', getBranch('gun') === b ? null : b)}
                   color={b === 'A' ? 'red' : 'yellow'} active={getBranch('gun') === b}>
                {b === 'A' ? '🔥' : '🎯'} {b}
              </Btn>
            ))}
          </div>
        )}
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
            <Btn key={key}
                 onClick={() => g()?.debugToggleStatus(targetPid, key)}
                 color={key === 'slowDebuff' ? 'yellow' : 'blue'}
                 active={statusActive(key)}>
              {emoji} {label}
            </Btn>
          ))}
        </div>
      </Section>

      {/* ── 殭屍（圖鑑 Canvas）── */}
      <Section title="🧟 殭屍">
        <div className="flex gap-1 mb-1">
          <span className="text-xs text-gray-500 self-center">數量:</span>
          {([1, 5, 10] as const).map(n => (
            <Btn key={n} onClick={() => setSpawnCount(n)} color="gray" active={spawnCount === n}>×{n}</Btn>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ZOMBIES.map(({ type, label, color }) => (
            <ZombieCard key={type} type={type} label={label} color={color}
              active={selZombie === type} spawnCount={spawnCount}
              onClick={() => {
                setSelZombie(type);
                g()?.debugSpawnZombie(type, spawnCount);
              }} />
          ))}
        </div>
        <Btn onClick={() => { if (g()) g()!.zombies = []; }} color="red" className="w-full mt-1">
          🧹 清除全部殭屍
        </Btn>
      </Section>

      {/* ── 物品（Canvas）── */}
      <Section title="🎁 物品">
        <div className="grid grid-cols-2 gap-2">
          {ITEMS.map(({ type, label }) => (
            <ItemCard key={type} type={type} label={label} active={false}
              onClick={() => g()?.debugSpawnItem(type)} />
          ))}
        </div>
        <Btn onClick={() => { if (g()) g()!.items = []; }} color="red" className="w-full mt-1">
          🧹 清除物品
        </Btn>
      </Section>

      {/* ── 障礙物（Canvas）── */}
      <Section title="🧱 障礙物">
        <div className="grid grid-cols-2 gap-2">
          {OBSTACLES.map(({ type, label }) => (
            <ObstacleCard key={type} type={type} label={label} active={false}
              onClick={() => g()?.debugSpawnObstacle(type)} />
          ))}
        </div>
      </Section>

      {/* ── 遊戲控制 ── */}
      <Section title="🎮 遊戲控制">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">波次:</span>
          <button onClick={() => g()?.debugSetWave((g()?.waveManager.currentWave ?? 1) - 1)}
                  className="w-5 h-5 bg-gray-700 rounded text-xs text-white hover:bg-gray-600 flex items-center justify-center cursor-pointer">−</button>
          <span className="w-8 text-center text-xs text-yellow-300 font-bold">{g()?.waveManager.currentWave ?? 1}</span>
          <button onClick={() => g()?.debugSetWave((g()?.waveManager.currentWave ?? 1) + 1)}
                  className="w-5 h-5 bg-gray-700 rounded text-xs text-white hover:bg-gray-600 flex items-center justify-center cursor-pointer">＋</button>
        </div>
        <Btn onClick={() => g()?.debugTogglePause()}
             color={g()?.debugPaused ? 'yellow' : 'gray'}
             active={g()?.debugPaused ?? false} className="w-full">
          {g()?.debugPaused ? '▶ 繼續波次' : '⏸ 波次暫停'}
        </Btn>
        <Btn onClick={() => g()?.debugToggleHpLock()}
             color={g()?.debugHpLocked ? 'red' : 'gray'}
             active={g()?.debugHpLocked ?? false} className="w-full">
          {g()?.debugHpLocked ? '🔓 鎖血：開' : '🔒 鎖血：關'}
        </Btn>
        <Btn onClick={() => g()?.debugToggleInfiniteCoins()}
             color={g()?.debugInfiniteCoins ? 'yellow' : 'gray'}
             active={g()?.debugInfiniteCoins ?? false} className="w-full">
          {g()?.debugInfiniteCoins ? '∞ 無限金幣：開' : '💰 無限金幣：關'}
        </Btn>
        <div className="grid grid-cols-2 gap-1 mt-1">
          <Btn onClick={() => g()?.debugClearSlime()} color="gray">🧹 黏液</Btn>
          <Btn onClick={() => { if (g()) g()!.hitEffects = []; }} color="gray">🧹 特效</Btn>
          <Btn onClick={() => g()?.debugHealAll()} color="green">💉 全員回血</Btn>
          <Btn onClick={() => { if (g()) g()!.zombies = []; }} color="red">🗑️ 清殭屍</Btn>
        </div>
      </Section>

      <div className="px-3 py-2 text-xs text-gray-700 text-center">` 收折</div>
    </div>
  );
}
