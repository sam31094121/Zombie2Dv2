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
  ctx.save();
  ctx.rotate(angle);
  if (player.weaponSwitchTimer > 0) { ctx.shadowColor = 'white'; ctx.shadowBlur = 10; }
  const wKey = getWeaponKey(player.weapon, player.weaponLevels[player.weapon], player.weaponBranches[player.weapon]);
  WEAPON_REGISTRY[player.weapon]?.[wKey]?.drawWeapon(ctx, player);
  ctx.restore();

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
  const wLv    = player.weaponLevels[player.weapon];
  const branch = player.weaponBranches[player.weapon];
  const branchTag = branch ? `[${branch}]` : '';
  let levelText = `Lv.${player.level}  ⚔${wLv}${branchTag}`;
  ctx.fillStyle = branch === 'A' ? '#4fc3f7' : branch === 'B' ? '#ff8a65' : 'white';
  ctx.fillText(levelText, player.x, player.y - 30);
}
