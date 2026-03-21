// ── WeaponDefinitions.ts ────────────────────────────────────────────────────
// 武器型別登錄表（Registry Pattern / Open-Closed Principle）
//
// 新增武器方式：
//   1. 在 WEAPON_REGISTRY 加一個 key（或在 sword/gun 加新 level entry）
//   2. 實作 fire() + drawWeapon()
//   ✅ Game.ts handlePlayerAttacks / Player.ts draw() 主邏輯零修改
// ────────────────────────────────────────────────────────────────────────────
import type { Player } from '../../Player';
import type { Game } from '../../Game';
import { ProjectileSpec } from '../../types';
import { audioManager } from '../../AudioManager';
import { SwordProjectile } from '../SwordProjectile';
import type { SwordConfig } from '../SwordProjectile';
import { drawBranchAShape, drawBranchBShape, getBranchColors } from '../../renderers/SwordRenderer';

// ── 武器等級定義介面 ─────────────────────────────────────────────────────────
export interface IWeaponLevelDef {
  readonly attackInterval: number;   // ms 攻擊間隔
  readonly burstCount?: number;      // 連發次數（只有 gun lv5 = 2）
  readonly burstDelay?: number;      // 連發間隔 ms

  // 產生這次攻擊的所有子彈規格
  // dmgMult = player.damageMultiplier × altar boost（由 caller 計算）
  fire(player: Player, dmgMult: number): ProjectileSpec[];

  // 進階攻擊（Branch A/B 劍系使用）：直接操作 game，fire() 回傳空陣列
  fireDirect?: (game: Game, player: Player, dmgMult: number) => void;

  // 繪製武器（ctx 已由 caller 做 rotate(aimAngle)）
  // 函式內自己 save/restore
  drawWeapon(ctx: CanvasRenderingContext2D, player: Player): void;
}

// ═══════════════════════════════════════════════════════════════════════════
// SWORD 攻擊函式
// ═══════════════════════════════════════════════════════════════════════════
function makeSwordSpec(player: Player, dmgMult: number, radius: number, damage: number): ProjectileSpec {
  const dir = { x: Math.cos(player.aimAngle), y: Math.sin(player.aimAngle) };
  return {
    ownerId: player.id, x: player.x, y: player.y,
    vx: dir.x, vy: dir.y,
    damage: damage * dmgMult,
    pierce: Infinity, lifetime: 250,
    type: 'slash', radius, knockback: true, level: player.level,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GUN 攻擊函式
// ═══════════════════════════════════════════════════════════════════════════
function makeBullet(
  player: Player, dmgMult: number,
  vx: number, vy: number,
  damage: number, pierce: number, speed: number, radius: number,
  ox = 0, oy = 0,
): ProjectileSpec {
  return {
    ownerId: player.id, x: player.x + ox, y: player.y + oy,
    vx: vx * speed, vy: vy * speed,
    damage: damage * dmgMult,
    pierce, lifetime: 2000,
    type: 'bullet', radius, knockback: false, level: player.level,
  };
}

function angleVec(a: number) { return { x: Math.cos(a), y: Math.sin(a) }; }

// ═══════════════════════════════════════════════════════════════════════════
// SWORD DRAW HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function swordSwingOffset(player: Player): number {
  const t = Date.now() - player.lastAttackTime;
  const dur = 200;
  return t < dur ? -Math.PI / 2 + (t / dur) * Math.PI : -Math.PI / 4;
}

// ── 突刺刺刀 drawWeapon 輔助（玩家手持時的外觀）──────────────────────────────
// 刀丟出去時（_swordOut = true）：顯示空拳，不顯示刀
// 刀回到手上時：顯示刀
function drawHeldKnife(ctx: CanvasRenderingContext2D, player: Player, level: number): void {
  // ── 刀飛出去時：顯示空拳（接回動畫） ──────────────────────────────────────
  if ((player as any)._swordOut) {
    ctx.save();
    ctx.translate(14, 8);
    // 拳頭（小圓＋手指暗示）
    ctx.fillStyle = '#5d4037';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4e342e';
    ctx.beginPath(); ctx.arc(4, -4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-4, -4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }

  // ── 刀在手上：畫刺刀 ───────────────────────────────────────────────────────
  const glows: Array<string | null> = [null, '#ffffff', '#b3e5fc', '#1565c0'];
  const blurs = [0, 6, 8, 12];
  const blades = ['#8d5524', '#9e9e9e', '#cfd8dc', '#78909c'];
  const glow = glows[level - 1];

  ctx.save();
  ctx.translate(14, 8);
  ctx.rotate(swordSwingOffset(player));

  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = blurs[level - 1]; }

  ctx.fillStyle = blades[level - 1];
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(4, -3); ctx.lineTo(-2, -4); ctx.lineTo(-2, -2);
  ctx.lineTo(-12, -2); ctx.lineTo(-12, 2); ctx.lineTo(-2, 2);
  ctx.lineTo(-2, 4); ctx.lineTo(4, 3);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(5, -2); ctx.lineTo(3, -1); ctx.lineTo(15, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (let i = -10; i <= -4; i += 3) {
    ctx.beginPath(); ctx.moveTo(i, -2); ctx.lineTo(i, 2); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── 飛刀 fireDirect 參數（base branch）──────────────────────────────────────
function _mkBase(level: number, p: Player, dmgMult: number): SwordConfig {
  // maxRange 隨等級微增；damage = 等級數；冷卻統一 800ms
  const ranges = [160, 180, 200, 220];
  const speed = 0.42;
  const maxRange = ranges[level - 1];
  const attackInterval = 800;
  return {
    branch: 'base', level, ownerId: p.id,
    x: p.x, y: p.y, angle: p.aimAngle, dmgMult,
    passRadius: 12,
    damage: level,          // Lv1=1, Lv2=2, Lv3=3, Lv4=4
    speed, maxRange, attackInterval,
    spinRadius: 0, spinDamage: 0, spinDuration: 0, spinTickMs: 0,
    embedDuration: 0, explodeDamage: 0, explodeRadius: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// WEAPON REGISTRY（劍 Lv1-4：Brotato 回旋飛刀）
// ═══════════════════════════════════════════════════════════════════════════
export const SWORD_LEVELS: Record<number, IWeaponLevelDef> = {

  1: {
    attackInterval: 800,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playSlash(1);
      (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(_mkBase(1, p, m)));
    },
    drawWeapon(ctx, p) { drawHeldKnife(ctx, p, 1); },
  },

  2: {
    attackInterval: 800,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playSlash(2);
      (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(_mkBase(2, p, m)));
    },
    drawWeapon(ctx, p) { drawHeldKnife(ctx, p, 2); },
  },

  3: {
    attackInterval: 800,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playSlash(3);
      (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(_mkBase(3, p, m)));
    },
    drawWeapon(ctx, p) { drawHeldKnife(ctx, p, 3); },
  },

  4: {
    attackInterval: 800,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playSlash(4);
      (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(_mkBase(4, p, m)));
    },
    drawWeapon(ctx, p) { drawHeldKnife(ctx, p, 4); },
  },

  5: {
    attackInterval: 1500,
    fire: (player, dmgMult) => {
      audioManager.playSlash(5);
      return [makeSwordSpec(player, dmgMult, 300, 5)];
    },
    drawWeapon(ctx, player) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.rotate(swordSwingOffset(player));
      ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 15;
      ctx.fillStyle = '#e0ffff';
      ctx.beginPath(); ctx.moveTo(2,-4); ctx.lineTo(45,-2); ctx.lineTo(55,0); ctx.lineTo(45,2); ctx.lineTo(2,4); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(4,-1); ctx.lineTo(40,0); ctx.lineTo(4,1); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#212121'; ctx.fillRect(-10,-5,12,10);
      ctx.fillStyle = '#00e5ff'; ctx.fillRect(-6,-3,4,6);
      ctx.restore();
    },
  },
};

export const GUN_LEVELS: Record<number, IWeaponLevelDef> = {

  1: {
    attackInterval: 800,
    fire: (player, dmgMult) => {
      audioManager.playShoot(1);
      const v = angleVec(player.aimAngle);
      return [makeBullet(player, dmgMult, v.x, v.y, 1, 1, 6, 5)];
    },
    drawWeapon(ctx) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.lineWidth = 2; ctx.strokeStyle = '#111';
      ctx.fillStyle = '#424242'; ctx.fillRect(0,-4,16,5); ctx.strokeRect(0,-4,16,5);
      ctx.fillStyle = '#212121';
      ctx.beginPath(); ctx.moveTo(0,1); ctx.lineTo(12,1); ctx.lineTo(12,3); ctx.lineTo(0,3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2,1); ctx.lineTo(4,1); ctx.lineTo(2,10); ctx.lineTo(-4,10); ctx.fill();
      ctx.fillStyle = '#757575'; ctx.fillRect(12,-3,2,2);
      ctx.restore();
    },
  },

  2: {
    attackInterval: 500,
    fire: (player, dmgMult) => {
      audioManager.playShoot(2);
      const base = player.aimAngle;
      const v = angleVec(base);
      const perp = { x: -v.y * 10, y: v.x * 10 };
      return [
        makeBullet(player, dmgMult, v.x, v.y, 3, 1, 8, 5, perp.x, perp.y),
        makeBullet(player, dmgMult, v.x, v.y, 3, 1, 8, 5, -perp.x, -perp.y),
      ];
    },
    drawWeapon(ctx) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.lineWidth = 2; ctx.strokeStyle = '#111';
      ctx.fillStyle = '#333'; ctx.fillRect(0,-5,22,7); ctx.strokeRect(0,-5,22,7);
      ctx.fillStyle = '#111'; ctx.fillRect(22,-3,8,3); ctx.fillRect(8,2,4,12);
      ctx.beginPath(); ctx.moveTo(-2,2); ctx.lineTo(4,2); ctx.lineTo(2,10); ctx.lineTo(-4,10); ctx.fill();
      ctx.strokeStyle = '#555'; ctx.beginPath(); ctx.moveTo(0,-2); ctx.lineTo(-10,-2); ctx.lineTo(-10,8); ctx.stroke();
      ctx.restore();
    },
  },

  3: {
    attackInterval: 1000,
    fire: (player, dmgMult) => {
      audioManager.playShoot(3);
      const base = player.aimAngle;
      const spread = Math.PI / 4;
      const start = base - spread / 2;
      const step  = spread / 2;
      return [0,1,2].map(i => {
        const v = angleVec(start + i * step);
        return makeBullet(player, dmgMult, v.x, v.y, 3, 1, 10, 5);
      });
    },
    drawWeapon(ctx) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.lineWidth = 2; ctx.strokeStyle = '#111';
      ctx.fillStyle = '#2c3e50'; ctx.fillRect(0,-5,30,8); ctx.strokeRect(0,-5,30,8);
      ctx.fillStyle = '#111'; ctx.fillRect(30,-3,12,4); ctx.fillRect(10,3,6,10);
      ctx.beginPath(); ctx.moveTo(0,3); ctx.lineTo(6,3); ctx.lineTo(4,12); ctx.lineTo(-2,12); ctx.fill();
      ctx.fillRect(-12,-4,12,6);
      ctx.fillStyle = '#222'; ctx.fillRect(8,-9,8,4);
      ctx.fillStyle = 'rgba(255,0,0,0.5)'; ctx.fillRect(10,-8,4,2);
      ctx.restore();
    },
  },

  4: {
    attackInterval: 1000,
    fire: (player, dmgMult) => {
      audioManager.playShoot(4);
      const base = player.aimAngle;
      const spread = Math.PI / 3;
      const start  = base - spread / 2;
      const step   = spread / 3;
      return [0,1,2,3].map(i => {
        const v = angleVec(start + i * step);
        return makeBullet(player, dmgMult, v.x, v.y, 3, 2, 10, 10);
      });
    },
    drawWeapon(ctx) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.lineWidth = 2; ctx.strokeStyle = '#111';
      ctx.fillStyle = '#3e2723'; ctx.fillRect(-10,-3,10,6); ctx.fillRect(15,1,12,4);
      ctx.fillStyle = '#212121'; ctx.fillRect(0,-4,35,5); ctx.fillRect(0,1,32,3); ctx.strokeRect(0,-4,35,5);
      ctx.beginPath(); ctx.moveTo(0,4); ctx.lineTo(6,4); ctx.lineTo(4,12); ctx.lineTo(-2,12); ctx.fill();
      ctx.restore();
    },
  },

  5: {
    attackInterval: 1300,
    burstCount: 2,
    burstDelay: 150,
    fire: (player, dmgMult) => {
      audioManager.playShoot(5);
      const base  = player.aimAngle;
      const spread = 55 * Math.PI / 180;
      const start  = base - spread / 2;
      const step   = spread / 2;
      return [0,1,2].map(i => {
        const v = angleVec(start + i * step);
        return makeBullet(player, dmgMult, v.x, v.y, 3, 2, 12, 12);
      });
    },
    drawWeapon(ctx) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.lineWidth = 2; ctx.strokeStyle = '#111';
      ctx.fillStyle = '#1a237e';
      ctx.beginPath(); ctx.moveTo(-5,-8); ctx.lineTo(25,-8); ctx.lineTo(35,-4); ctx.lineTo(35,4); ctx.lineTo(25,8); ctx.lineTo(-5,8); ctx.fill(); ctx.stroke();
      ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 10; ctx.fillStyle = '#00e5ff';
      for(let i=5;i<25;i+=6){ ctx.fillRect(i,-6,3,12); }
      ctx.beginPath(); ctx.arc(35,0,6,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.moveTo(0,8); ctx.lineTo(8,8); ctx.lineTo(4,16); ctx.lineTo(-4,16); ctx.fill();
      ctx.fillRect(-15,-4,10,8);
      ctx.restore();
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SWORD 分支：Lv5A-8A（旋風流）— 回旋鏢 + 旋轉場 + 回飛
// 使用 fireDirect 直接創建 SwordProjectile，fire() 回傳空陣列
// ═══════════════════════════════════════════════════════════════════════════

function makeSwordConfigA(
  level: number,
  p: Player,
  dmgMult: number,
  speed: number,
  maxRange: number,
  spinRadius: number,
  spinDamage: number,
  spinDuration: number,
  spinTickMs: number,
  attackInterval: number,
  damage: number,
): SwordConfig {
  return {
    branch: 'A', level, ownerId: p.id,
    x: p.x, y: p.y, angle: p.aimAngle, dmgMult,
    passRadius: 14, damage, speed, maxRange, attackInterval,
    spinRadius, spinDamage, spinDuration, spinTickMs,
    embedDuration: 0, explodeDamage: 0, explodeRadius: 0,
  };
}

function makeSwordConfigB(
  level: number,
  p: Player,
  dmgMult: number,
  speed: number,
  maxRange: number,
  damage: number,
  embedDuration: number,
  explodeDamage: number,
  explodeRadius: number,
  attackInterval: number,
): SwordConfig {
  return {
    branch: 'B', level, ownerId: p.id,
    x: p.x, y: p.y, angle: p.aimAngle, dmgMult,
    passRadius: 14, damage, speed, maxRange, attackInterval,
    spinRadius: 0, spinDamage: 0, spinDuration: 0, spinTickMs: 0,
    embedDuration, explodeDamage, explodeRadius,
  };
}

// ── 空拳（刀丟出去時的手部）─────────────────────────────────────────────────
function _drawEmptyFist(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(14, 8);
  ctx.fillStyle = '#5d4037';
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4e342e';
  ctx.beginPath(); ctx.arc(4, -4, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -5, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-4, -4, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── Branch A/B 手持輔助（呼叫 SwordRenderer 的共用 shape）───────────────────
function _drawHeldBranchA(ctx: CanvasRenderingContext2D, player: Player, blur: number): void {
  if ((player as any)._swordOut) { _drawEmptyFist(ctx); return; }
  const colors = getBranchColors('A', player.weaponLevels[player.weapon]);
  ctx.save();
  ctx.translate(14, 8);
  ctx.rotate(swordSwingOffset(player));
  drawBranchAShape(ctx, colors, blur);
  ctx.restore();
}

function _drawHeldBranchB(ctx: CanvasRenderingContext2D, player: Player, blur: number): void {
  if ((player as any)._swordOut) { _drawEmptyFist(ctx); return; }
  const colors = getBranchColors('B', player.weaponLevels[player.weapon]);
  ctx.save();
  ctx.translate(14, 8);
  ctx.rotate(swordSwingOffset(player));
  drawBranchBShape(ctx, colors, blur);
  ctx.restore();
}

const SWORD_BRANCH_A: Record<string, IWeaponLevelDef> = {
  '5A': {
    attackInterval: 1800,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playSlash(4);
      (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(
        makeSwordConfigA(5, p, m, 0.35, 200, 70, 3, 1500, 300, 1800, 4)
      ));
    },
    drawWeapon(ctx, p) { _drawHeldBranchA(ctx, p, 12); },
  },
  '6A': {
    attackInterval: 1700,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playSlash(4);
      (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(
        makeSwordConfigA(6, p, m, 0.4, 220, 80, 4, 1800, 280, 1700, 4.5)
      ));
    },
    drawWeapon(ctx, p) { _drawHeldBranchA(ctx, p, 16); },
  },
  '7A': {
    attackInterval: 1600,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playSlash(5);
      (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(
        makeSwordConfigA(7, p, m, 0.45, 240, 90, 5, 2000, 260, 1600, 5)
      ));
    },
    drawWeapon(ctx, p) { _drawHeldBranchA(ctx, p, 20); },
  },
  '8A': {
    attackInterval: 1500,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playSlash(5);
      (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(
        makeSwordConfigA(8, p, m, 0.5, 260, 100, 6, 2200, 240, 1500, 5.5)
      ));
    },
    drawWeapon(ctx, p) { _drawHeldBranchA(ctx, p, 25); },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SWORD 分支：Lv5B-8B（審判流）— 飛出 → 嵌入目標 → AOE 大爆炸
// ═══════════════════════════════════════════════════════════════════════════
const SWORD_BRANCH_B: Record<string, IWeaponLevelDef> = {
  '5B': {
    attackInterval: 2000,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playSlash(5);
      (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(
        makeSwordConfigB(5, p, m, 0.4, 280, 8, 400, 25, 120, 2000)
      ));
    },
    drawWeapon(ctx, p) { _drawHeldBranchB(ctx, p, 14); },
  },
  '6B': {
    attackInterval: 2000,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playSlash(5);
      (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(
        makeSwordConfigB(6, p, m, 0.45, 300, 10, 350, 35, 140, 2000)
      ));
    },
    drawWeapon(ctx, p) { _drawHeldBranchB(ctx, p, 18); },
  },
  '7B': {
    attackInterval: 2000,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playSlash(5);
      (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(
        makeSwordConfigB(7, p, m, 0.5, 320, 12, 300, 48, 160, 2000)
      ));
    },
    drawWeapon(ctx, p) { _drawHeldBranchB(ctx, p, 22); },
  },
  '8B': {
    attackInterval: 2000,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playSlash(5);
      (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(
        makeSwordConfigB(8, p, m, 0.55, 350, 15, 280, 65, 180, 2000)
      ));
    },
    drawWeapon(ctx, p) { _drawHeldBranchB(ctx, p, 30); },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// GUN 分支：Lv5A-8A（連射流） / Lv5B-8B（狙擊流）
// ═══════════════════════════════════════════════════════════════════════════
const GUN_BRANCH_A: Record<string, IWeaponLevelDef> = {
  '5A': {
    attackInterval: 350,
    fire: (p, m) => {
      audioManager.playShoot(4);
      const v = angleVec(p.aimAngle);
      const perp = { x: -v.y * 8, y: v.x * 8 };
      return [
        makeBullet(p, m, v.x, v.y, 2, 1, 10, 5),
        makeBullet(p, m, v.x, v.y, 2, 1, 10, 5, perp.x, perp.y),
        makeBullet(p, m, v.x, v.y, 2, 1, 10, 5, -perp.x, -perp.y),
      ];
    },
    drawWeapon(ctx) {
      ctx.save(); ctx.translate(15,10);
      ctx.fillStyle = '#424242'; ctx.fillRect(0,-5,28,7); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.strokeRect(0,-5,28,7);
      ctx.fillStyle='#f57c00'; ctx.fillRect(28,-3,10,4);
      ctx.fillStyle='#212121'; ctx.fillRect(-12,-3,12,6); ctx.fillRect(8,2,4,12);
      ctx.restore();
    },
  },
  '6A': {
    attackInterval: 280,
    fire: (p, m) => {
      audioManager.playShoot(4);
      const a = p.aimAngle;
      const spread = 0.3;
      return [-spread, -spread/2, 0, spread/2, spread].map(o => {
        const v = angleVec(a + o);
        return makeBullet(p, m, v.x, v.y, 2, 1, 11, 5);
      });
    },
    drawWeapon(ctx) {
      ctx.save(); ctx.translate(15,10);
      ctx.fillStyle='#333'; ctx.fillRect(0,-5,32,7); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.strokeRect(0,-5,32,7);
      ctx.fillStyle='#e65100'; ctx.fillRect(32,-3,12,4);
      ctx.fillStyle='#111'; ctx.fillRect(-14,-3,14,6); ctx.fillRect(10,2,4,12);
      ctx.restore();
    },
  },
  '7A': {
    attackInterval: 220,
    burstCount: 3,
    burstDelay: 80,
    fire: (p, m) => {
      audioManager.playShoot(5);
      const a = p.aimAngle;
      const spread = 0.35;
      return [-spread, 0, spread].map(o => {
        const v = angleVec(a + o);
        return makeBullet(p, m, v.x, v.y, 2.5, 1, 12, 6);
      });
    },
    drawWeapon(ctx) {
      ctx.save(); ctx.translate(15,10);
      ctx.fillStyle='#263238'; ctx.fillRect(0,-6,36,9); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.strokeRect(0,-6,36,9);
      ctx.fillStyle='#ff6d00'; ctx.shadowColor='#ff6d00'; ctx.shadowBlur=8;
      ctx.fillRect(36,-3,14,4);
      ctx.shadowBlur=0; ctx.fillStyle='#111'; ctx.fillRect(-16,-4,16,8); ctx.fillRect(10,3,5,12);
      ctx.restore();
    },
  },
  '8A': {
    attackInterval: 160,
    burstCount: 4,
    burstDelay: 60,
    fire: (p, m) => {
      audioManager.playShoot(5);
      const a = p.aimAngle;
      const spread = 0.5;
      return [-spread, -spread/3, spread/3, spread].map(o => {
        const v = angleVec(a + o);
        return makeBullet(p, m, v.x, v.y, 3, 2, 13, 6);
      });
    },
    drawWeapon(ctx) {
      ctx.save(); ctx.translate(15,10);
      ctx.fillStyle='#1a237e'; ctx.fillRect(0,-7,40,10); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.strokeRect(0,-7,40,10);
      ctx.shadowColor='#ff6d00'; ctx.shadowBlur=12; ctx.fillStyle='#ff6d00';
      ctx.fillRect(40,-3,16,4); ctx.beginPath(); ctx.arc(56,0,4,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.fillStyle='#000'; ctx.fillRect(-18,-5,18,10); ctx.fillRect(12,3,6,14);
      ctx.restore();
    },
  },
};

const GUN_BRANCH_B: Record<string, IWeaponLevelDef> = {
  '5B': {
    attackInterval: 1800,
    fire: (p, m) => {
      audioManager.playShoot(5);
      const v = angleVec(p.aimAngle);
      return [makeBullet(p, m, v.x, v.y, 12, 5, 18, 10)];
    },
    drawWeapon(ctx) {
      ctx.save(); ctx.translate(15,10);
      ctx.fillStyle='#37474f'; ctx.fillRect(0,-4,48,6); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.strokeRect(0,-4,48,6);
      ctx.fillStyle='#546e7a'; ctx.fillRect(8,-8,8,3); // scope
      ctx.fillStyle='#263238'; ctx.fillRect(-14,-3,14,6); ctx.fillRect(16,2,4,10);
      ctx.restore();
    },
  },
  '6B': {
    attackInterval: 1800,
    fire: (p, m) => {
      audioManager.playShoot(5);
      const v = angleVec(p.aimAngle);
      return [makeBullet(p, m, v.x, v.y, 16, 8, 20, 10)];
    },
    drawWeapon(ctx) {
      ctx.save(); ctx.translate(15,10);
      ctx.fillStyle='#263238'; ctx.fillRect(0,-4,54,6); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.strokeRect(0,-4,54,6);
      ctx.fillStyle='#455a64'; ctx.fillRect(10,-9,10,4);
      ctx.fillStyle='#1c313a'; ctx.fillRect(-16,-4,16,8); ctx.fillRect(18,2,4,12);
      ctx.restore();
    },
  },
  '7B': {
    attackInterval: 2000,
    fire: (p, m) => {
      audioManager.playShoot(5);
      const v = angleVec(p.aimAngle);
      return [makeBullet(p, m, v.x, v.y, 20, 10, 22, 12)];
    },
    drawWeapon(ctx) {
      ctx.save(); ctx.translate(15,10);
      ctx.fillStyle='#1a237e'; ctx.fillRect(0,-5,58,8); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.strokeRect(0,-5,58,8);
      ctx.shadowColor='#7c4dff'; ctx.shadowBlur=10; ctx.fillStyle='#7c4dff';
      ctx.fillRect(58,-3,10,4);
      ctx.shadowBlur=0; ctx.fillStyle='#311b92'; ctx.fillRect(-16,-4,16,8); ctx.fillRect(20,3,5,12);
      ctx.restore();
    },
  },
  '8B': {
    attackInterval: 2200,
    fire: (p, m) => {
      audioManager.playShoot(5);
      const v = angleVec(p.aimAngle);
      return [makeBullet(p, m, v.x, v.y, 28, Infinity, 25, 14)];
    },
    drawWeapon(ctx) {
      ctx.save(); ctx.translate(15,10);
      ctx.shadowColor='#7c4dff'; ctx.shadowBlur=20;
      ctx.fillStyle='#1a237e'; ctx.fillRect(0,-5,64,8); ctx.strokeStyle='#311b92'; ctx.lineWidth=2; ctx.strokeRect(0,-5,64,8);
      ctx.fillStyle='#7c4dff'; ctx.fillRect(50,-4,14,6);
      ctx.fillStyle='#b39ddb'; ctx.fillRect(12,-9,12,4);
      ctx.shadowBlur=0; ctx.fillStyle='#000028'; ctx.fillRect(-18,-5,18,10); ctx.fillRect(22,3,5,14);
      ctx.restore();
    },
  },
};

// ── 分支資訊（給 UpgradePanel 顯示用）────────────────────────────────────────
export interface IWeaponBranchInfo {
  name: string;
  emoji: string;
  description: string;
}
export const WEAPON_BRANCH_INFO: Record<'sword' | 'gun', Record<'A' | 'B', IWeaponBranchInfo>> = {
  sword: {
    A: { name: '旋風流', emoji: '🌪️', description: '高速連斬，5方向清場' },
    B: { name: '審判流', emoji: '⚡', description: '超重單斬，傷害暴增' },
  },
  gun: {
    A: { name: '連射流', emoji: '🔥', description: '子彈倍增，超高射速' },
    B: { name: '狙擊流', emoji: '🎯', description: '無限穿透，精準爆發' },
  },
};

// ── 統一登錄表 ───────────────────────────────────────────────────────────────
export const WEAPON_REGISTRY: Record<'sword' | 'gun', Record<number | string, IWeaponLevelDef>> = {
  sword: { ...SWORD_LEVELS, ...SWORD_BRANCH_A, ...SWORD_BRANCH_B },
  gun:   { ...GUN_LEVELS,   ...GUN_BRANCH_A,   ...GUN_BRANCH_B   },
};

// ── 武器等級鍵值（依玩家 weaponLevel + branch 計算）──────────────────────────
export function getWeaponKey(level: number, branch: 'A' | 'B' | null): number | string {
  if (level >= 5 && branch) return `${level}${branch}`;
  return Math.min(level, 5); // fallback to lv5 if branch not yet chosen
}
