// ── WeaponPreviewCanvas.tsx ───────────────────────────────────────────────────
// 直接呼叫 drawWeapon 繪製武器預覽，與 ZombieCard 使用相同的 mock + rAF 邏輯
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useEffect } from 'react';
import type { Player, WeaponSlot } from '../../game/Player';
import { WEAPON_REGISTRY, getWeaponKey } from '../../game/entities/definitions/WeaponDefinitions';

interface Props {
  type: 'sword' | 'gun';
  level: number;
  branch: 'A' | 'B' | null;
  /** Canvas buffer 解析度（CSS 會自動 scale 到 100% 寬） */
  bufW?: number;
  bufH?: number;
  bg?: string;
}

export const WeaponPreviewCanvas: React.FC<Props> = ({
  type, level, branch,
  bufW = 208, bufH = 128,
  bg = '#0d0d1a',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    // 武器水平朝右，原點居中偏左
    const cx = Math.round(W * 0.38);
    const cy = Math.round(H * 0.52);

    const key = getWeaponKey(type, level, branch);
    const def = WEAPON_REGISTRY[type]?.[key];

    // 建立最小可用 mock player
    const mock = {
      weapon: type,
      weaponLevels:  { sword: level, gun: level },
      weaponBranches: { sword: branch, gun: branch },
      aimAngle:       0,
      lastAttackTime: 0,
      x: 0, y: 0,
      color: '#4fc3f7',
      level, id: 0,
      hp: 100, maxHp: 100, speed: 0, radius: 15,
      shield: false, isFloatingWeapons: false, weapons: [],
      damageMultiplier: 1, attackSpeedMultiplier: 1, pickupRadiusMultiplier: 1,
    } as unknown as Player;

    const slot: WeaponSlot = {
      id: 'preview', type, level, branch,
      lastAttackTime: 0, aimAngle: 0,
    };

    // 靜態渲染一次即可，不自轉 → 消除顆粒鬆散鋸齒
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    if (def) {
      try {
        ctx.save();
        ctx.translate(cx, cy);
        // 固定水平朝右，不旋轉 → 保留像素銳利度
        def.drawWeapon(ctx, mock, slot);
        ctx.restore();
      } catch { ctx.restore(); }
    }
  }, [type, level, branch, bg, bufW, bufH]);

  return (
    <canvas
      ref={canvasRef}
      width={bufW}
      height={bufH}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    />
  );
};
