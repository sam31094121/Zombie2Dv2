// ── PlayerRenderer.ts ────────────────────────────────────────────────────────
// 玩家繪圖邏輯（從 Player.ts 分離，武器繪圖由 WeaponDefinitions 處理）
// ─────────────────────────────────────────────────────────────────────────────
import { Player } from '../Player';
import { WEAPON_REGISTRY, getWeaponKey } from '../entities/definitions/WeaponDefinitions';

// ── 武器槽位座標矩陣（export 供 PlayerPreviewCanvas 點擊熱區使用）────────────
// 相對於玩家中心的偏移（px），右 3 把 rx>0，左 3 把 rx<0
export const WEAPON_SLOT_POSITIONS = [
  { rx: 44, ry: 0 }, // 0: 右中
  { rx: -44, ry: 0 }, // 1: 左中
  { rx: -44, ry: -26 }, // 2: 左上
  { rx: 44, ry: -26 }, // 3: 右上
  { rx: -44, ry: 26 }, // 4: 左下
  { rx: 44, ry: 26 }, // 5: 右下
];

/**
 * ── 全局高級武器渲染模組 ──
 * 封裝了平滑描邊、稀有度顏色與互動 Dim 效果。
 * 呼叫此函式即可獲得全遊戲統一的高質感武器呈現。
 */
export function drawWeaponWithPremiumStyle(
  ctx: CanvasRenderingContext2D,
  player: Player,
  slot: import('../Player').WeaponSlot,
  options?: {
    isOtherSelected?: boolean;
    dimUnselected?: boolean;
    forceSmooth?: boolean;
    scale?: number;
  }
): void {
  const wKey = getWeaponKey(slot.type, slot.level, slot.branch);
  const weaponDef = WEAPON_REGISTRY[slot.type]?.[wKey];
  if (!weaponDef) return;

  const isOtherSelected = options?.isOtherSelected ?? false;
  const dimUnselected = options?.dimUnselected ?? false;
  const scale = options?.scale ?? 1.0;

  // 保存原始狀態
  ctx.save();
  if (scale !== 1.0) ctx.scale(scale, scale);

  // 1. 決定稀有度顏色 (1:White/Black, 2:Green, 3:Blue, 4:Purple, 5+:Gold)
  const rarityColor = slot.level >= 5
    ? '#fbbf24'
    : ['#000000', '#4ade80', '#60a5fa', '#c084fc'][Math.min(slot.level - 1, 3)];

  // 2. 透明度處理：如果是副武器則變暗
  if (isOtherSelected && dimUnselected) {
    ctx.globalAlpha *= 0.25;
  }

  // 🔽 核心：徹底固定渲染模式
  // 全軍統一使用 1.6 像素的「8 向位移疊加」實體厚邊框
  const thickness = 1.6;

  // 3. 繪製 8 層厚描邊 (Solid Outline)
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.shadowColor = rarityColor;
  
  const dirs = [
    {x:thickness, y:0}, {x:-thickness, y:0}, {x:0, y:thickness}, {x:0, y:-thickness},
    {x:thickness, y:thickness}, {x:-thickness, y:thickness}, {x:thickness, y:-thickness}, {x:-thickness, y:-thickness}
  ];

  // 🔔 標記目前為描邊階段，讓火花等特效自動跳過，避免火花也帶有描邊
  (ctx as any).isOutlinePass = true;

  dirs.forEach(d => {
    ctx.shadowOffsetX = d.x;
    ctx.shadowOffsetY = d.y;
    weaponDef.drawWeapon(ctx, player, slot);
  });

  (ctx as any).isOutlinePass = false;

  // 4. 重置 Shadow 狀態，確保本體乾淨
  ctx.restore(); 

  // 5. 繪製最終本體 (第 9 層)
  weaponDef.drawWeapon(ctx, player, slot);
  
  // 還原最外層狀態
  ctx.restore();
}

export function drawPlayer(player: Player, ctx: CanvasRenderingContext2D, options?: {
  hideUI?: boolean;
  selectedSlotIdx?: number | null;
  dimUnselected?: boolean;
  weaponScale?: number;
}): void {
  if (player.hp <= 0) return;

  const angle = player.aimAngle;

  ctx.save();
  if (player.isInsideContainer) ctx.globalAlpha = 0.4;
  ctx.translate(player.x, player.y);

  // Infinite mode glow
  if (player.level >= 5 || player.isInfiniteGlow) {
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 15;
  }

  // Weapon switch ring
  if (player.weaponSwitchTimer > 0) {
    const progress = 1 - (player.weaponSwitchTimer / 500);
    ctx.beginPath(); ctx.arc(0, 0, player.radius + progress * 40, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${1 - progress})`; ctx.lineWidth = 4 * (1 - progress); ctx.stroke();
  }

  // Shadow
  ctx.beginPath(); ctx.arc(4, 6, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill(); ctx.closePath();

  // ── 武器渲染（統一使用浮空武器體系） ─────────────────────────────
  if (player.weapons && player.weapons.length > 0) {
    player.weapons.forEach((slot, i) => {
      // ── 正確帶入 branch，確保 Lv5+ 分支武器能找到對應的 drawWeapon ──
      const wKey = getWeaponKey(slot.type, slot.level, slot.branch);
      const weaponDef = WEAPON_REGISTRY[slot.type]?.[wKey];
      if (weaponDef) {
        ctx.save();
        const time = Date.now();

        const slotPos = WEAPON_SLOT_POSITIONS[i % WEAPON_SLOT_POSITIONS.length];

        // ── 互動邏輯：當有選中某把武器時，其餘武器不呼吸 (bob=0) 並變暗 ──
        const isSelected = options?.selectedSlotIdx === i;
        const isOtherSelected = options?.selectedSlotIdx !== undefined && options?.selectedSlotIdx !== null && !isSelected;
        const bob = isOtherSelected ? 0 : Math.sin(time / 300 + i) * 4;

        const facingAngle = slotPos.rx > 0 ? 0 : Math.PI;
        ctx.translate(slotPos.rx, slotPos.ry + bob);
        
        // 優先使用 slot 個別的 aimAngle（如有索敵），否則使用玩家朝向
        const finalAngle = slot.aimAngle !== undefined ? slot.aimAngle : facingAngle;
        ctx.rotate(finalAngle);

        // 預覽模式下，左側武器水平翻轉避免上下顛倒
        if ((player as any).isPreview && Math.abs(finalAngle) > Math.PI / 2) {
          ctx.scale(1, -1);
        }

        // ── 槍械後座力 ──
        if (slot.type === 'gun') {
          const timeSinceAttack = Date.now() - slot.lastAttackTime;
          if (timeSinceAttack < 150) {
            const recoil = Math.max(0, 8 - (timeSinceAttack / 150) * 8);
            ctx.translate(slotPos.rx > 0 ? -recoil : recoil, 0);
          }
        }

        // ── 使用封裝好的 Premium 渲染模組 ──
        drawWeaponWithPremiumStyle(ctx, player, slot, {
          isOtherSelected,
          dimUnselected: options?.dimUnselected,
          scale: options?.weaponScale ?? 1.0,
          forceSmooth: player.weaponSwitchTimer > 0 // 換槍時強制平滑
        });

        ctx.restore();
      }
    });
  } else {
    // ── 傳統單手武器模式：同樣套用統一的高級渲染模組 ──
    ctx.save();
    ctx.rotate(angle);

    const slot: import('../Player').WeaponSlot = {
      id: 'main',
      type: player.weapon,
      level: player.weaponLevels[player.weapon],
      branch: player.weaponBranches[player.weapon],
      lastAttackTime: player.lastAttackTime,
    };

    // ── 槍械後座力 ──
    if (slot.type === 'gun') {
      const timeSinceAttack = Date.now() - slot.lastAttackTime;
      if (timeSinceAttack < 150) {
        const recoil = Math.max(0, 8 - (timeSinceAttack / 150) * 8);
        ctx.translate(-recoil, 0);
      }
    }

    // ── 換彈/換槍發光特效與高級描邊整合 ──
    const forceSmooth = player.weaponSwitchTimer > 0;
    
    drawWeaponWithPremiumStyle(ctx, player, slot, {
      forceSmooth,
      // 如果正在換槍，可以考慮微調顏色或厚度，這裡維持一致以保證「紮實感」
    });

    ctx.restore();
  }

  // Hands
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = '#ffccaa'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(10, -10, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(15, 10, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();

  // Body
  ctx.beginPath(); ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = player.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#222'; ctx.stroke(); ctx.closePath();

  // Shield ring
  if (player.shield) {
    ctx.beginPath(); ctx.arc(0, 0, player.radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'cyan'; ctx.lineWidth = 2; ctx.stroke(); ctx.closePath();
  }

  // Slow debuff ring
  if (player.slowDebuffTimer > 0) {
    ctx.beginPath(); ctx.arc(0, 0, player.radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(139,195,74,0.8)'; ctx.lineWidth = 4; ctx.stroke(); ctx.closePath();
  }

  ctx.restore();

  if (!options?.hideUI) {
    // HP Bar（world-space）
    const hpRatio = player.hp / player.maxHp;
    ctx.fillStyle = 'red'; ctx.fillRect(player.x - 15, player.y - 25, 30, 4);
    ctx.fillStyle = 'green'; ctx.fillRect(player.x - 15, player.y - 25, 30 * hpRatio, 4);
  }

  if (!options?.hideUI) {
    // Level indicator
    ctx.fillStyle = 'white'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    if (player.isFloatingWeapons) {
      ctx.fillText(`Lv.${player.level}`, player.x, player.y - 30);
    } else {
      const wLv = player.weaponLevels[player.weapon];
      const branch = player.weaponBranches[player.weapon];
      const branchTag = branch ? `[${branch}]` : '';
      const levelText = `Lv.${player.level}  ⚔${wLv}${branchTag}`;
      ctx.fillStyle = branch === 'A' ? '#4fc3f7' : branch === 'B' ? '#ff8a65' : 'white';
      ctx.fillText(levelText, player.x, player.y - 30);
    }
  }
}
