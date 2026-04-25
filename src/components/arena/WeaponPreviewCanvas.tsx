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

    // ── 中心位置與縮放校準 ──
    const isSword = type === 'sword';
    const rotation = isSword ? -Math.PI / 4 : 0;
    
    // 武器在本地座標系（原點位於握柄）的視覺中心偏移量
    const localCx = isSword ? 24 : 18;
    const localCy = isSword ? 0 : 2;

    // ── 使用者指定的微調 (螢幕像素空間) ──
    let screenOffsetX = 0;
    let screenOffsetY = 0;
    
    if (isSword) {
      // 刀子全部向上兩格像素
      screenOffsetY = -2;
    } else if (type === 'gun' && branch === 'B') {
      // 槍枝（只有閃電狙擊槍）向左邊移動 6 格像素
      screenOffsetX = -6;
    }

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
      
      // 1. 先將畫布原點移動到「邏輯畫布」的正中心
      ctx.translate(LOGICAL_W / 2, LOGICAL_H / 2);
      
      // 套用使用者的微調 (螢幕空間)
      ctx.translate(screenOffsetX, screenOffsetY);
      
      // 2. 智慧縮放：確保最大型武器（長度約 70）不會超出邊框
      const safeSize = 75; 
      const scaleToFit = Math.min(1.0, LOGICAL_W / safeSize, LOGICAL_H / safeSize);
      ctx.scale(scaleToFit, scaleToFit);
      
      // 3. 旋轉武器
      ctx.rotate(rotation);
      
      // 4. 反向平移武器的「本地中心點」，使其對齊畫布正中心
      ctx.translate(-localCx, -localCy);
      
      // ── 使用統一的高級渲染模組 ──
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
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
    />
  );
};
