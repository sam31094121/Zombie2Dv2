import React, { useRef, useEffect } from 'react';
import type { Player, WeaponSlot } from '../../game/Player';
import { drawWeaponWithPremiumStyle } from '../../game/renderers/PlayerRenderer';
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
  bufW = 624, bufH = 384, // 3x 解析度提升 (208 * 3)
  bg = '#0d1623',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    // ── 核心邏輯：1:1 視覺標準化 ──
    // 設定邏輯視窗為 134x80，對應商店卡片的 CSS 實體尺寸
    // 這樣 1 個邏輯單位就等於 1 個實體像素，達成與戰鬥畫面的比例同步
    const LOGICAL_W = bufW / 3;
    const LOGICAL_H = bufH / 3;

    // 每一幀（或每次更新）重新設定 transform 並縮放
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bufW, bufH);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, bufW, bufH);
    
    // 套用 3x 渲染解析度
    ctx.scale(3, 3);

    // 中心位置校準：
    // 因為武器原點在握柄，直接放 0.5 會導致視覺偏右。
    // 透過偏移，讓武器的「幾何中心」落在畫布中央。
    const isSword = type === 'sword';
    const rotation = isSword ? -Math.PI / 4 : 0;
    
    // 槍：長度約 40，握柄在左，需左移約 15~18 單位
    // 劍：斜放後，需同時補償水平與垂直位移
    const cx = isSword ? LOGICAL_W * 0.48 : LOGICAL_W * 0.38;
    const cy = isSword ? LOGICAL_H * 0.56 : LOGICAL_H * 0.50;

    const slot: WeaponSlot = {
      id: 'preview', type, level, branch,
      lastAttackTime: 0, 
      aimAngle: rotation, // 套用旋轉
    };

    // 建立最小可用 mock player (標記為 isPreview 觸發平滑描邊)
    const mock = {
      isPreview: true,
      weapon: type,
      weapons: [slot],
      weaponLevels:  { sword: level, gun: level },
      weaponBranches: { sword: branch, gun: branch },
      aimAngle: rotation,
      lastAttackTime: 0,
    } as unknown as Player;

    try {
      ctx.save();
      ctx.translate(cx, cy);
      // 旋轉畫布進行繪製
      ctx.rotate(rotation);
      
      // ── 使用統一的高級渲染模組 (維持 1.0x 原始比例) ──
      drawWeaponWithPremiumStyle(ctx, mock, slot, { scale: 1.0 });
      ctx.restore();
    } catch (e) {
      console.error('WeaponPreview error:', e);
      ctx.restore();
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
