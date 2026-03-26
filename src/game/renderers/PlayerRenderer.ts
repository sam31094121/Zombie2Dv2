// ── PlayerRenderer.ts ────────────────────────────────────────────────────────
// 玩家繪圖邏輯（從 Player.ts 分離，武器繪圖由 WeaponDefinitions 處理）
// ─────────────────────────────────────────────────────────────────────────────
import { Player } from '../Player';
import { WEAPON_REGISTRY, getWeaponKey } from '../entities/definitions/WeaponDefinitions';

export function drawPlayer(player: Player, ctx: CanvasRenderingContext2D): void {
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

        // ── 6 把武器固定槽位：右 3 左 3，垂直等距排列 ──
        // 槽位索引：0=右上, 1=右中, 2=右下, 3=左上, 4=左中, 5=左下
        const SLOT_POSITIONS = [
          {  rx:  44, ry:   0 }, // 0: 右中 (1)
          {  rx: -44, ry:   0 }, // 1: 左中 (2)
          {  rx: -44, ry: -26 }, // 2: 左上 (3)
          {  rx:  44, ry: -26 }, // 3: 右上 (4)
          {  rx: -44, ry:  26 }, // 4: 左下 (5)
          {  rx:  44, ry:  26 }, // 5: 右下 (6)
        ];

        const slotPos = SLOT_POSITIONS[i % SLOT_POSITIONS.length];
        const bob = Math.sin(time / 300 + i) * 4; // 個別呼吸感偏移

        // 右邊 3 把朝右（angle=0），左邊 3 把朝左（angle=PI）
        const facingAngle = slotPos.rx > 0 ? 0 : Math.PI;

        ctx.translate(slotPos.rx, slotPos.ry + bob);
        ctx.rotate(slot.aimAngle ?? facingAngle);

        // ── 槍械後座力 ──
        if (slot.type === 'gun') {
          const timeSinceAttack = Date.now() - slot.lastAttackTime;
          if (timeSinceAttack < 150) {
            const recoil = Math.max(0, 8 - (timeSinceAttack / 150) * 8);
            // 右側武器後座向左，左側向右
            ctx.translate(slotPos.rx > 0 ? -recoil : recoil, 0);
          }
        }

        // Lv1=白, Lv2=綠, Lv3=藍, Lv4=紫, Lv5+=金
        const glowColor = slot.level >= 5
          ? '#fbbf24' // 金色光暈（分支武器）
          : ['#ffffff', '#4ade80', '#60a5fa', '#c084fc'][Math.min(slot.level - 1, 3)];
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 10;

        weaponDef.drawWeapon(ctx, player, slot);
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

  // HP Bar（world-space）
  const hpRatio = player.hp / player.maxHp;
  ctx.fillStyle = 'red';   ctx.fillRect(player.x - 15, player.y - 25, 30, 4);
  ctx.fillStyle = 'green'; ctx.fillRect(player.x - 15, player.y - 25, 30 * hpRatio, 4);

  // Level indicator
  ctx.fillStyle = 'white'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
  if (player.isFloatingWeapons) {
    ctx.fillText(`Lv.${player.level}`, player.x, player.y - 30);
  } else {
    const wLv    = player.weaponLevels[player.weapon];
    const branch = player.weaponBranches[player.weapon];
    const branchTag = branch ? `[${branch}]` : '';
    let levelText = `Lv.${player.level}  ⚔${wLv}${branchTag}`;
    ctx.fillStyle = branch === 'A' ? '#4fc3f7' : branch === 'B' ? '#ff8a65' : 'white';
    ctx.fillText(levelText, player.x, player.y - 30);
  }
}
