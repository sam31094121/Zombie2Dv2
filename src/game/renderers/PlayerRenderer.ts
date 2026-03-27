// ── PlayerRenderer.ts ────────────────────────────────────────────────────────
// 玩家繪圖邏輯（從 Player.ts 分離，武器繪圖由 WeaponDefinitions 處理）
// ─────────────────────────────────────────────────────────────────────────────
import { Player } from '../Player';
import { WEAPON_REGISTRY, getWeaponKey } from '../entities/definitions/WeaponDefinitions';

// ── 武器槽位座標矩陣（export 供 PlayerPreviewCanvas 點擊熱區使用）────────────
// 相對於玩家中心的偏移（px），右 3 把 rx>0，左 3 把 rx<0
export const WEAPON_SLOT_POSITIONS = [
  {  rx:  44, ry:   0 }, // 0: 右中
  {  rx: -44, ry:   0 }, // 1: 左中
  {  rx: -44, ry: -26 }, // 2: 左上
  {  rx:  44, ry: -26 }, // 3: 右上
  {  rx: -44, ry:  26 }, // 4: 左下
  {  rx:  44, ry:  26 }, // 5: 右下
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

  ctx.save();
  if (scale !== 1.0) ctx.scale(scale, scale);

  // 1. 決定稀有度顏色
  const rarityColor = slot.level >= 5
    ? '#fbbf24' // 金色
    : ['#ffffff', '#4ade80', '#60a5fa', '#c084fc'][Math.min(slot.level - 1, 3)];

  // 2. 處理 Dim 變暗
  if (isOtherSelected && dimUnselected) {
    ctx.globalAlpha = 0.25;
  }

  // 3. 繪製描邊 (Outline)
  // 自動偵測：若畫布有明顯縮放或強制開啟，則使用平滑描邊
  const currentTransform = ctx.getTransform();
  const isHighRes = options?.forceSmooth || currentTransform.a > 1.1 || (player as any).isPreview;

  if (!(isOtherSelected && dimUnselected)) {
    ctx.save();
    if (isHighRes) {
      // 🔽 高質感平滑描邊
      ctx.shadowBlur = 1.5;
      ctx.shadowColor = rarityColor;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      weaponDef.drawWeapon(ctx, player, slot);
    } else {
      // 🔼 經典像素硬邊描邊
      ctx.shadowBlur = 0;
      ctx.shadowColor = rarityColor;
      const offsets = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
      offsets.forEach(off => {
        ctx.shadowOffsetX = off.x;
        ctx.shadowOffsetY = off.y;
        weaponDef.drawWeapon(ctx, player, slot);
      });
    }
    ctx.restore();
  }

  // 4. 繪製本體
  weaponDef.drawWeapon(ctx, player, slot);
  
  // 還原狀態
  ctx.globalAlpha = 1.0;
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

  // ── 武器（委派給 WeaponDefinitions registry）─────────────────────────────
  if (player.isFloatingWeapons && player.weapons && player.weapons.length > 0) {
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
        const finalAngle = slot.aimAngle ?? facingAngle;
        ctx.rotate(finalAngle);

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
          scale: options?.weaponScale ?? 1.0
        });

        ctx.restore();
      }
    });
  } else {
    ctx.save();
    ctx.rotate(angle);
    if (player.weaponSwitchTimer > 0) { ctx.shadowColor = 'white'; ctx.shadowBlur = 10; }
    const wKey = getWeaponKey(player.weapon, player.weaponLevels[player.weapon], player.weaponBranches[player.weapon]);
    WEAPON_REGISTRY[player.weapon]?.[wKey]?.drawWeapon(ctx, player);
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
    ctx.fillStyle = 'red';   ctx.fillRect(player.x - 15, player.y - 25, 30, 4);
    ctx.fillStyle = 'green'; ctx.fillRect(player.x - 15, player.y - 25, 30 * hpRatio, 4);
  }

  if (!options?.hideUI) {
    // Level indicator
    ctx.fillStyle = 'white'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    if (player.isFloatingWeapons) {
      ctx.fillText(`Lv.${player.level}`, player.x, player.y - 30);
    } else {
      const wLv    = player.weaponLevels[player.weapon];
      const branch = player.weaponBranches[player.weapon];
      const branchTag = branch ? `[${branch}]` : '';
      const levelText = `Lv.${player.level}  ⚔${wLv}${branchTag}`;
      ctx.fillStyle = branch === 'A' ? '#4fc3f7' : branch === 'B' ? '#ff8a65' : 'white';
      ctx.fillText(levelText, player.x, player.y - 30);
    }
  }
}
