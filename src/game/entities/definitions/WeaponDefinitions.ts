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
import { drawBranchAShape, drawBranchBShape, getBranchColors, drawStilettoShape, drawWoodenStakeShape, drawRustyDirkShape, drawSoldierDirkShape, drawBlackSteelKatanaShape } from '../../renderers/SwordRenderer';
import { drawMuzzleFlash } from '../../renderers/EffectRenderer';
import { MissileProjectile } from '../MissileProjectile';
import { ArcProjectile } from '../ArcProjectile';

// ── 武器等級定義介面 ─────────────────────────────────────────────────────────
export interface IWeaponLevelDef {
  readonly attackInterval: number;   // ms 攻擊間隔
  readonly burstCount?: number;      // 連發次數（只有 gun lv5 = 2）
  readonly burstDelay?: number;      // 連發間隔 ms

  // 產生這次攻擊的所有子彈規格
  // dmgMult = player.damageMultiplier × altar boost（由 caller 計算）
  fire(player: Player, dmgMult: number, origin?: {x: number, y: number, aimAngle: number}): ProjectileSpec[];

  // 進階攻擊（Branch A/B 劍系使用）：直接操作 game，fire() 回傳空陣列
  fireDirect?: (game: Game, player: Player, dmgMult: number, origin?: {x: number, y: number, aimAngle: number}) => void;

  // 繪製武器（ctx 已由 caller 做 rotate(aimAngle)）
  // 函式內自己 save/restore
  drawWeapon(ctx: CanvasRenderingContext2D, player: Player): void;
}

// ═══════════════════════════════════════════════════════════════════════════
// SWORD 攻擊函式
// ═══════════════════════════════════════════════════════════════════════════
function makeSwordSpec(player: Player, dmgMult: number, radius: number, damage: number, origin?: {x: number, y: number, aimAngle: number}): ProjectileSpec {
  const angle = origin?.aimAngle ?? player.aimAngle;
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  return {
    ownerId: player.id, 
    x: origin?.x ?? player.x, 
    y: origin?.y ?? player.y,
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
  bulletType = 'blue_ellipse',
  origin?: {x: number, y: number, aimAngle: number}
): ProjectileSpec {
  return {
    ownerId: player.id, 
    x: (origin?.x ?? player.x) + ox, 
    y: (origin?.y ?? player.y) + oy,
    vx: vx * speed, vy: vy * speed,
    damage: damage * dmgMult,
    pierce, lifetime: 2000,
    type: 'bullet', radius, knockback: false, level: player.level,
    bulletType,
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
function drawHeldKnife(ctx: CanvasRenderingContext2D, player: Player, level: number = 2): void {
  if ((player as any)._swordOut) { _drawEmptyFist(ctx); return; }
  ctx.save();
  ctx.translate(14, 8);
  ctx.rotate(swordSwingOffset(player));
  if (level === 1) drawWoodenStakeShape(ctx);
  else if (level === 2) drawRustyDirkShape(ctx);
  else if (level === 3) drawSoldierDirkShape(ctx);
  else drawBlackSteelKatanaShape(ctx);
  ctx.restore();
}

// ── 飛刀 fireDirect 參數（base branch）──────────────────────────────────────
function _mkBase(level: number, p: Player, dmgMult: number, origin?: {x: number, y: number, aimAngle: number}): SwordConfig {
  // maxRange 隨等級微增；damage = 等級數；冷卻統一 800ms
  const ranges = [160, 180, 200, 220];
  const speed = 0.42;
  const maxRange = ranges[level - 1];
  const attackInterval = 800;
  return {
    branch: 'base', level, ownerId: p.id,
    x: origin?.x ?? p.x, 
    y: origin?.y ?? p.y, 
    angle: origin?.aimAngle ?? p.aimAngle, 
    dmgMult,
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
    fireDirect(game, p, m, origin) {
      audioManager.playSlash(1);
      if (!p.isFloatingWeapons) (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(_mkBase(1, p, m, origin)));
    },
    drawWeapon(ctx, p) { drawHeldKnife(ctx, p, 1); },
  },

  2: {
    attackInterval: 800,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playSlash(2);
      if (!p.isFloatingWeapons) (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(_mkBase(2, p, m, origin)));
    },
    drawWeapon(ctx, p) { drawHeldKnife(ctx, p, 2); },
  },

  3: {
    attackInterval: 800,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playSlash(3);
      if (!p.isFloatingWeapons) (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(_mkBase(3, p, m, origin)));
    },
    drawWeapon(ctx, p) { drawHeldKnife(ctx, p, 3); },
  },

  4: {
    attackInterval: 800,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playSlash(4);
      if (!p.isFloatingWeapons) (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(_mkBase(4, p, m, origin)));
    },
    drawWeapon(ctx, p) { drawHeldKnife(ctx, p, 4); },
  },

  5: {
    attackInterval: 1500,
    fire: (player, dmgMult, origin) => {
      audioManager.playSlash(5);
      return [makeSwordSpec(player, dmgMult, 300, 5, origin)];
    },
    drawWeapon(ctx, player) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.rotate(swordSwingOffset(player));
      ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 15;
      ctx.fillStyle = '#e0ffff';
      ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(45, -2); ctx.lineTo(55, 0); ctx.lineTo(45, 2); ctx.lineTo(2, 4); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(4, -1); ctx.lineTo(40, 0); ctx.lineTo(4, 1); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#212121'; ctx.fillRect(-10, -5, 12, 10);
      ctx.fillStyle = '#00e5ff'; ctx.fillRect(-6, -3, 4, 6);
      ctx.restore();
    },
  },
};

export const GUN_LEVELS: Record<number, IWeaponLevelDef> = {

  // Lv1：左輪手槍（單發直射）
  1: {
    attackInterval: 800,
    fire: (player, dmgMult, origin) => {
      audioManager.playShoot(1);
      const angle = origin?.aimAngle ?? player.aimAngle;
      const v = angleVec(angle);
      return [makeBullet(player, dmgMult, v.x, v.y, 1, 1, 6, 5, 0, 0, 'blue_ellipse', origin)];
    },
    drawWeapon(ctx, player) {
      ctx.save();
      // 原始設計 44×44，offset (-14, -22) 將握柄對齊玩家手部，槍管朝右
      const ox = -14, oy = -22;
      const r = (x: number, y: number, w: number, h: number) =>
        ctx.fillRect(x + ox, y + oy, w, h);

      const C = {
        silver: '#cbd5e1', white: '#ffffff', shadow: '#475569',
        deep: '#0f172a', triggerSteel: '#334155',
        wood: '#78350f', woodDark: '#451a03',
        brass: '#fbbf24', black: '#000000',
      };

      // 1. 槍管
      ctx.fillStyle = C.silver; r(18, 16, 21, 3);
      ctx.fillStyle = C.white; r(18, 16, 21, 1);
      ctx.fillStyle = C.shadow; r(18, 18, 21, 1);
      ctx.fillStyle = C.shadow; r(36, 15, 2, 1); // 準星

      // 2. 轉輪
      ctx.fillStyle = C.silver; r(10, 16, 8, 7);
      ctx.fillStyle = C.white; r(10, 16, 8, 1);
      ctx.fillStyle = C.deep; r(11, 18, 6, 1); // 溝槽
      ctx.fillStyle = C.deep; r(11, 21, 6, 1);

      // 3. 槍身框架
      ctx.fillStyle = C.silver; r(6, 16, 4, 7);
      ctx.fillStyle = C.white; r(6, 16, 4, 1);

      // 4. 擊錘
      ctx.fillStyle = C.shadow; r(4, 13, 2, 2);
      ctx.fillStyle = C.deep; r(5, 15, 2, 2);

      // 5. 握柄（木製）
      ctx.fillStyle = C.wood; r(2, 23, 6, 8);
      ctx.fillStyle = C.wood; r(3, 31, 5, 2);
      ctx.fillStyle = C.wood; r(4, 33, 4, 1);
      ctx.fillStyle = C.woodDark; r(2, 23, 1, 9); // 木紋
      ctx.fillStyle = C.woodDark; r(4, 27, 1, 1);
      ctx.fillStyle = C.brass; r(4, 28, 1, 1); // 飾釘

      // 6. 護圈 + 板機
      ctx.fillStyle = C.shadow; r(9, 23, 9, 1); // 護圈上緣
      ctx.fillStyle = C.shadow; r(17, 23, 1, 4); // 護圈前緣
      ctx.fillStyle = C.shadow; r(10, 27, 7, 1); // 護圈底緣
      ctx.fillStyle = C.white; r(11, 28, 5, 1); // 底部反光
      ctx.fillStyle = C.black; r(12, 23, 2, 1); // 板機根部陰影
      ctx.fillStyle = C.triggerSteel; r(12, 24, 1, 2); // 板機主體
      ctx.fillStyle = C.triggerSteel; r(13, 25, 1, 1); // 板機鉤尖
      ctx.fillStyle = C.shadow; r(12, 24, 1, 1); // 板機高光
      ctx.fillStyle = C.deep; r(13, 24, 1, 1); // 板機內陰影

      // 7. 槍管接縫
      ctx.fillStyle = C.black; r(18, 16, 1, 4);

      // 8. 槍口火光（模組化 2-frame flash）
      drawMuzzleFlash(ctx, 25, -5, player.lastAttackTime);

      ctx.restore();
    },
  },

  // Lv2：單發直射（更高傷害）
  2: {
    attackInterval: 605,
    fire: (player, dmgMult, origin) => {
      audioManager.playShoot(2);
      const angle = origin?.aimAngle ?? player.aimAngle;
      const v = angleVec(angle);
      return [makeBullet(player, dmgMult, v.x, v.y, 2, 1, 8, 6, 0, 0, 'blue_ellipse', origin)];
    },
    drawWeapon(ctx, player) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.lineWidth = 2; ctx.strokeStyle = '#111';
      ctx.fillStyle = '#333'; ctx.fillRect(0, -4, 22, 6); ctx.strokeRect(0, -4, 22, 6);
      ctx.fillStyle = '#111'; ctx.fillRect(22, -2, 6, 3); ctx.fillRect(8, 2, 4, 10);
      ctx.beginPath(); ctx.moveTo(-2, 2); ctx.lineTo(4, 2); ctx.lineTo(2, 10); ctx.lineTo(-4, 10); ctx.fill();
      drawMuzzleFlash(ctx, 28, 0, player.lastAttackTime);
      ctx.restore();
    },
  },

  // Lv3：左右雙管齊發
  3: {
    attackInterval: 600,
    fire: (player, dmgMult, origin) => {
      audioManager.playShoot(3);
      const angle = origin?.aimAngle ?? player.aimAngle;
      const v = angleVec(angle);
      const perp = { x: -v.y * 10, y: v.x * 10 };
      return [
        makeBullet(player, dmgMult, v.x, v.y, 2, 1, 9, 5, perp.x, perp.y, 'blue_ellipse', origin),
        makeBullet(player, dmgMult, v.x, v.y, 2, 1, 9, 5, -perp.x, -perp.y, 'blue_ellipse', origin),
      ];
    },
    drawWeapon(ctx, player) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.lineWidth = 2; ctx.strokeStyle = '#111';
      ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, -6, 28, 5); ctx.strokeRect(0, -6, 28, 5); // 上管
      ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 1, 28, 5); ctx.strokeRect(0, 1, 28, 5); // 下管
      ctx.fillStyle = '#111'; ctx.fillRect(-10, -4, 10, 8); // 握把
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(5, 6); ctx.lineTo(3, 14); ctx.lineTo(-2, 14); ctx.fill();
      drawMuzzleFlash(ctx, 28, -4, player.lastAttackTime);
      drawMuzzleFlash(ctx, 28, 4, player.lastAttackTime);
      ctx.restore();
    },
  },

  // Lv4：前大後小三角陣型（1 大 + 2 小）
  4: {
    attackInterval: 600,
    fire: (player, dmgMult, origin) => {
      audioManager.playShoot(4);
      const angle = origin?.aimAngle ?? player.aimAngle;
      const v = angleVec(angle);
      const perp = { x: -v.y, y: v.x };
      // 大子彈（中央前方）
      const front = makeBullet(player, dmgMult, v.x, v.y, 3, 2, 10, 8,
        v.x * 8, v.y * 8, 'blue_ellipse', origin);
      // 兩顆小子彈（左右後方）
      const left = makeBullet(player, dmgMult, v.x, v.y, 2, 2, 10, 5,
        perp.x * 10 - v.x * 4, perp.y * 10 - v.y * 4, 'blue_ellipse', origin);
      const right = makeBullet(player, dmgMult, v.x, v.y, 2, 2, 10, 5,
        -perp.x * 10 - v.x * 4, -perp.y * 10 - v.y * 4, 'blue_ellipse', origin);
      return [front, left, right];
    },
    drawWeapon(ctx, player) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.lineWidth = 2; ctx.strokeStyle = '#111';
      // 雙管
      ctx.fillStyle = '#3e2723'; ctx.fillRect(0, -6, 32, 5); ctx.strokeRect(0, -6, 32, 5);
      ctx.fillStyle = '#3e2723'; ctx.fillRect(0, 1, 32, 5); ctx.strokeRect(0, 1, 32, 5);
      // 槍管中段連接件
      ctx.fillStyle = '#212121'; ctx.fillRect(20, -7, 4, 14);
      // 握把 + 扳機
      ctx.fillStyle = '#111'; ctx.fillRect(-12, -4, 12, 8);
      ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(6, 4); ctx.lineTo(4, 12); ctx.lineTo(-2, 12); ctx.fill();
      drawMuzzleFlash(ctx, 32, -4, player.lastAttackTime);
      drawMuzzleFlash(ctx, 32, 4, player.lastAttackTime);
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
function _drawHeldBranchA(ctx: CanvasRenderingContext2D, player: Player): void {
  if ((player as any)._swordOut) { _drawEmptyFist(ctx); return; }
  const colors = getBranchColors('A', player.weaponLevels[player.weapon]);
  ctx.save();
  ctx.translate(14, 8);
  ctx.rotate(swordSwingOffset(player));
  drawBranchAShape(ctx, colors);
  ctx.restore();
}

function _drawHeldBranchB(ctx: CanvasRenderingContext2D, player: Player): void {
  if ((player as any)._swordOut) { _drawEmptyFist(ctx); return; }
  const colors = getBranchColors('B', player.weaponLevels[player.weapon]);
  ctx.save();
  ctx.translate(14, 8);
  ctx.rotate(swordSwingOffset(player));
  drawBranchBShape(ctx, colors);
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
    drawWeapon(ctx, p) { _drawHeldBranchA(ctx, p); },
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
    drawWeapon(ctx, p) { _drawHeldBranchA(ctx, p); },
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
    drawWeapon(ctx, p) { _drawHeldBranchA(ctx, p); },
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
    drawWeapon(ctx, p) { _drawHeldBranchA(ctx, p); },
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
    drawWeapon(ctx, p) { _drawHeldBranchB(ctx, p); },
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
    drawWeapon(ctx, p) { _drawHeldBranchB(ctx, p); },
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
    drawWeapon(ctx, p) { _drawHeldBranchB(ctx, p); },
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
    drawWeapon(ctx, p) { _drawHeldBranchB(ctx, p); },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// GUN 分支：Lv5A-8A（連射流） / Lv5B-8B（狙擊流）
// ═══════════════════════════════════════════════════════════════════════════
// ── 導彈輔助：建立 MissileProjectile 設定 ─────────────────────────────────────
function _makeMissile(
  p: Player, dmgMult: number,
  damage: number, splitAfter: number,
  origin?: {x: number, y: number, aimAngle: number}
): MissileProjectile {
  return new MissileProjectile({
    ownerId: p.id,
    x: origin?.x ?? p.x, 
    y: origin?.y ?? p.y,
    angle: origin?.aimAngle ?? p.aimAngle,
    damage: damage * dmgMult,
    speed: 8,
    turnSpeed: 0.005,   // rad/ms 軟追蹤
    radius: 10,
    isSmall: false,
    splitAfter,
    groundFireRadius: 70,  // 跟龍捲風差不多大
    groundFireDuration: 3000,
  });
}

// ── 火箭炮外觀（5A-8A 共用；用戶設計 64×64 → offset dx=-14, dy=-32 對齊玩家中心）──
// 砲管中心在 game(16, 0)；砲口尖在 game(42, 0)；握把在 game(8, 4)
function _drawMissileLauncher(
  ctx: CanvasRenderingContext2D,
  player: Player,
): void {
  const ox = 10, oy = 28, len = 38; // 縮短一點點主砲管，為強化砲口騰出空間
  const dx = -14, dy = -32; // 坐標偏移：user + offset = game
  const r = (x: number, y: number, w: number, h: number) =>
    ctx.fillRect(x + dx, y + dy, w, h);

  // 精煉高對比調色盤
  const C = {
    steelDark: '#334155',
    steelMid: '#64748b',
    steelLight: '#cbd5e1',
    steelHigh: '#f1f5f9',
    bloodDeep: '#991b1b',
    bloodMain: '#ef4444',
    bloodGlow: '#fca5a5',
    bloodHigh: '#fee2e2',
    boneSolid: '#f5f5f4',
    eyeRed: '#ff0000',
    brass: '#fbbf24',
    black: '#0f172a',
    white: '#ffffff',
  };

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // --- 1. 砲管主體 (Polished Barrel) ---
  ctx.fillStyle = C.steelMid; r(ox, oy, len, 8);

  // 頂部與底部光影
  ctx.fillStyle = C.steelLight; r(ox, oy, len, 2);
  ctx.fillStyle = C.steelHigh; r(ox + 2, oy, len - 4, 1);
  ctx.fillStyle = C.steelDark; r(ox, oy + 6, len, 2);

  // 機械細節：鉚釘與面板線
  ctx.fillStyle = C.black; r(ox + 8, oy, 1, 8);
  ctx.fillStyle = C.black; r(ox + 25, oy, 1, 8);
  ctx.fillStyle = C.brass; r(ox + 10, oy + 1, 1, 1);
  ctx.fillStyle = C.brass; r(ox + 10, oy + 6, 1, 1);

  // --- 2. 流暢強化砲口 (Smooth Reinforced Muzzle) ---
  const mx = ox + len;
  const my = oy - 1;
  const mw = 8;
  const mh = 10;

  ctx.fillStyle = C.steelMid; r(mx, my, mw, mh);
  ctx.fillStyle = C.steelLight; r(mx, my, mw, 2);
  ctx.fillStyle = C.steelHigh; r(mx + 1, my, mw - 2, 1);
  ctx.fillStyle = C.steelHigh; r(mx + mw - 2, my + 1, 1, mh - 2);

  ctx.fillStyle = C.bloodDeep; r(mx + mw - 1, my + 1, 1, mh - 2);
  ctx.fillStyle = C.bloodMain; r(mx + 2, my + 3, mw - 2, 4);
  ctx.fillStyle = C.bloodGlow; r(mx + 4, my + 4, mw - 4, 2);

  // --- 3. 能量導管組件 (Energy System) ---
  ctx.fillStyle = C.steelDark; r(ox + 6, oy - 2, 4, 4); // 接口 A
  ctx.fillStyle = C.bloodDeep; r(ox + 7, oy - 2, 22, 2);
  ctx.fillStyle = C.bloodMain; r(ox + 7, oy - 1, 20, 1);
  ctx.fillStyle = C.bloodHigh; r(ox + 12, oy - 1, 4, 1);

  // --- 4. 戰術瞄準器 (Tactical Scope) ---
  ctx.fillStyle = C.black; r(ox + 14, oy - 11, 10, 11);
  ctx.fillStyle = C.steelMid; r(ox + 15, oy - 10, 8, 9);
  ctx.fillStyle = C.bloodDeep; r(ox + 16, oy - 9, 6, 7);
  ctx.fillStyle = C.eyeRed; r(ox + 17, oy - 8, 4, 5);
  ctx.fillStyle = C.white; r(ox + 17, oy - 8, 1, 1);

  // --- 5. 握把與板機 (Ergo Grip) ---
  ctx.fillStyle = C.black; r(ox + 12, oy + 8, 5, 11);
  ctx.fillStyle = C.steelDark; r(ox + 13, oy + 8, 3, 11);
  ctx.fillStyle = C.bloodMain; r(ox + 20, oy + 9, 1, 3); // 板機

  // --- 6. 後部平衡裝置 (Rear Stock) ---
  ctx.fillStyle = C.steelMid; r(ox - 6, oy - 1, 6, 11);
  ctx.fillStyle = C.steelHigh; r(ox - 6, oy - 1, 6, 1);
  ctx.fillStyle = C.steelDark; r(ox - 6, oy + 8, 6, 2);

  // 槍口火光（對齊新砲口）
  drawMuzzleFlash(ctx, mx + mw + dx, oy + 4 + dy, player.lastAttackTime);

  ctx.restore();
}

const GUN_BRANCH_A: Record<string, IWeaponLevelDef> = {
  // ── 5A：單發追蹤導彈 ────────────────────────────────────────────────────
  '5A': {
    attackInterval: 1200,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playShoot(4);
      game.missiles.push(_makeMissile(p, m, 5, 0, origin));
    },
    drawWeapon(ctx, player) { _drawMissileLauncher(ctx, player); },
  },

  // ── 6A：連射 ×2 追蹤導彈 ─────────────────────────────────────────────
  '6A': {
    attackInterval: 1100,
    burstCount: 2,
    burstDelay: 220,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playShoot(4);
      game.missiles.push(_makeMissile(p, m, 6, 0, origin));
    },
    drawWeapon(ctx, player) { _drawMissileLauncher(ctx, player); },
  },

  // ── 7A：連射 ×3 追蹤導彈 ─────────────────────────────────────────────
  '7A': {
    attackInterval: 1100,
    burstCount: 3,
    burstDelay: 200,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playShoot(5);
      game.missiles.push(_makeMissile(p, m, 7, 0, origin));
    },
    drawWeapon(ctx, player) { _drawMissileLauncher(ctx, player); },
  },

  // ── 8A：連射 ×3 分裂彈（0.3s 後裂成 3 顆小導彈）────────────────────
  '8A': {
    attackInterval: 1100,
    burstCount: 3,
    burstDelay: 200,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playShoot(5);
      game.missiles.push(_makeMissile(p, m, 8, 300, origin)); // splitAfter=300ms
    },
    drawWeapon(ctx, player) { _drawMissileLauncher(ctx, player); },
  },
};

function _drawThreeClawArcGun(ctx: CanvasRenderingContext2D, player: Player, level: number): void {
  ctx.save();
  ctx.imageSmoothingEnabled = true;

  ctx.translate(14, 10);
  ctx.scale(0.4, 0.4);
  ctx.translate(-24, -65);

  const t = Date.now() / 1000;
  const pulse = (Math.sin(t * 8) + 1) / 2;
  const lvlExt = (level - 5) * 5; // 隨等級延長的尺寸

  const poly = (pts: number[], fill?: string | CanvasGradient, stroke?: string, lw?: number) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke && lw) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
  };
  const line = (x1: number, y1: number, x2: number, y2: number, c: string | CanvasGradient, lw: number) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.stroke();
  };

  // 漸層定義
  const armorWhite = ctx.createLinearGradient(0, 30, 0, 95);
  armorWhite.addColorStop(0, '#ffffff');
  armorWhite.addColorStop(1, '#d1d5db');

  const frameDark = ctx.createLinearGradient(0, 30, 0, 95);
  frameDark.addColorStop(0, '#475569');
  frameDark.addColorStop(0.5, '#1e293b');
  frameDark.addColorStop(1, '#0f172a');

  const goldTrim = ctx.createLinearGradient(10, 0, 130 + lvlExt, 0);
  goldTrim.addColorStop(0, '#92400e');
  goldTrim.addColorStop(0.5, '#fbbf24');
  goldTrim.addColorStop(1, '#92400e');

  const steadyEnergy = ctx.createRadialGradient(48, 52, 0, 48, 52, 5);
  steadyEnergy.addColorStop(0, '#ffffff');
  steadyEnergy.addColorStop(0.4, '#38bdf8');
  steadyEnergy.addColorStop(1, 'rgba(3,105,161,0)');

  // 1. 戰術握把 (Grip)
  poly([24, 58, 45, 58, 40, 94, 18, 94], armorWhite, '#000', 0.2); // 外殼
  ctx.globalAlpha = 0.9;
  poly([22, 64, 38, 64, 36, 90, 20, 90], frameDark); // 防滑區
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#0f172a'; ctx.fillRect(16, 94, 26, 3); // 底座
  ctx.beginPath(); ctx.arc(21, 95.5, 0.6, 0, Math.PI * 2); ctx.fillStyle = goldTrim; ctx.fill(); // 金飾點

  // 2. 板機與護圈
  ctx.beginPath(); ctx.moveTo(45, 58); ctx.bezierCurveTo(45, 80, 60, 80, 60, 65);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5; ctx.stroke();
  poly([48, 60, 46, 72, 50, 72, 52, 60], goldTrim);

  // 3. 槍身主機匣 (Receiver)
  poly([12, 42, 70, 42, 70, 64, 20, 64, 12, 56], frameDark, '#000', 0.3); // 下層架構
  poly([15, 40, 65, 40, 65, 54, 18, 54, 15, 48], armorWhite, '#94a3b8', 0.2); // 上層裝甲
  ctx.globalAlpha = 0.6;
  line(25, 44, 55, 44, '#94a3b8', 0.3);
  line(25, 48, 50, 48, '#94a3b8', 0.3);
  ctx.globalAlpha = 1.0;

  // 機械面板螺絲
  ctx.fillStyle = '#334155';
  [20, 24, 60].forEach(x => { ctx.beginPath(); ctx.arc(x, 42, 0.6, 0, Math.PI * 2); ctx.fill(); });

  // 4. 後置擊錘 (Hammer)
  ctx.beginPath(); ctx.moveTo(12, 48); ctx.bezierCurveTo(2, 48, -2, 38, 8, 34); ctx.lineTo(16, 42); ctx.closePath();
  ctx.fillStyle = frameDark; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 0.4; ctx.stroke();
  ctx.beginPath(); ctx.arc(8, 34, 2.5, 0, Math.PI * 2); ctx.fillStyle = goldTrim; ctx.fill();

  // 5. 能源核心觀測窗 (穩定冰藍)
  ctx.fillStyle = '#020617';
  if ((ctx as any).roundRect) {
    ctx.beginPath(); (ctx as any).roundRect(40, 46, 16, 12, 3); ctx.fill();
  } else {
    ctx.fillRect(40, 46, 16, 12);
  }
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 0.5; ctx.stroke();

  ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 8;
  ctx.globalAlpha = 0.6 + pulse * 0.4;
  ctx.beginPath(); ctx.arc(48, 52, 5, 0, Math.PI * 2); ctx.fillStyle = steadyEnergy; ctx.fill();
  ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;

  // 6. 統合式：強化槍管與三刃槍口
  const blExt = lvlExt; // Blade extension
  poly([70, 42, 95 + blExt, 42, 105 + blExt, 48, 105 + blExt, 58, 95 + blExt, 64, 70, 64], frameDark, '#000', 0.5); // 槍管護木
  ctx.globalAlpha = 0.8; ctx.fillStyle = armorWhite; ctx.fillRect(75, 44, 15 + blExt * 0.5, 16); ctx.globalAlpha = 1.0;

  // 上刃 A
  poly([95 + blExt, 42, 125 + blExt, 28, 105 + blExt, 48, 100 + blExt, 46], armorWhite, '#94a3b8', 0.4);
  ctx.lineCap = 'round'; line(100 + blExt, 44, 118 + blExt, 34, goldTrim, 0.8); ctx.lineCap = 'butt';

  // 下刃 B
  poly([95 + blExt, 64, 125 + blExt, 78, 105 + blExt, 58, 100 + blExt, 60], armorWhite, '#94a3b8', 0.4);
  ctx.lineCap = 'round'; line(100 + blExt, 62, 118 + blExt, 70, goldTrim, 0.8); ctx.lineCap = 'butt';

  // 中央導軌 C
  poly([85, 53, 135 + blExt, 53, 110 + blExt, 57, 85, 57], '#94a3b8', '#1e293b', 0.4);
  ctx.globalAlpha = 0.9; line(95, 53, 130 + blExt, 53, '#ffffff', 1.2); ctx.globalAlpha = 1.0;

  // 穩定能量導流
  ctx.globalAlpha = 0.2; line(65, 53, 120 + blExt, 53, '#7dd3fc', 1.0); ctx.globalAlpha = 1.0;
  ctx.beginPath(); ctx.moveTo(70, 53); ctx.lineTo(110 + blExt, 53);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.4; ctx.globalAlpha = 0.4;
  ctx.setLineDash([3, 6]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1.0;

  // 槍口放電共振火光 (在最前端開火)
  drawMuzzleFlash(ctx, 135 + blExt, 53, player.lastAttackTime);

  ctx.restore();
}

function _fireArc(game: Game, p: Player, level: number, damage: number, jumps: number, paralyze: number, origin?: {x: number, y: number, aimAngle: number}) {
  audioManager.playShoot(5); // 觸發電弧手槍發射音效
  const speed = level >= 8 ? 20 : 16;
  const angle = origin?.aimAngle ?? p.aimAngle;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  // ArcProjectile(ownerId, level, x, y, vx, vy, damage, jumps, paralyzeDuration)
  const ox = origin?.x ?? p.x;
  const oy = origin?.y ?? p.y;
  game.arcProjectiles.push(new ArcProjectile(p.id, level, ox, oy, vx, vy, damage, jumps, paralyze));
}

const GUN_BRANCH_B: Record<string, IWeaponLevelDef> = {
  '5B': {
    attackInterval: 1800,
    fire: () => [],
    fireDirect(game, p, m, origin) { _fireArc(game, p, 5, 5, 3, 1000, origin); },
    drawWeapon(ctx, player) { _drawThreeClawArcGun(ctx, player, 5); },
  },
  '6B': {
    attackInterval: 1800,
    fire: () => [],
    fireDirect(game, p, m, origin) { _fireArc(game, p, 6, 6, 5, 1200, origin); },
    drawWeapon(ctx, player) { _drawThreeClawArcGun(ctx, player, 6); },
  },
  '7B': {
    attackInterval: 1800,
    fire: () => [],
    fireDirect(game, p, m, origin) { _fireArc(game, p, 7, 7, 8, 1500, origin); },
    drawWeapon(ctx, player) { _drawThreeClawArcGun(ctx, player, 7); },
  },
  '8B': {
    attackInterval: 2000,
    fire: () => [],
    fireDirect(game, p, m, origin) { _fireArc(game, p, 8, 8, 10, 2000, origin); },
    drawWeapon(ctx, player) { _drawThreeClawArcGun(ctx, player, 8); },
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
    B: { name: '電弧流', emoji: '⚡', description: '連鎖電弧，群體麻痺' },
  },
};

// ── 統一登錄表 ───────────────────────────────────────────────────────────────
export const WEAPON_REGISTRY: Record<'sword' | 'gun', Record<number | string, IWeaponLevelDef>> = {
  sword: { ...SWORD_LEVELS, ...SWORD_BRANCH_A, ...SWORD_BRANCH_B },
  gun: { ...GUN_LEVELS, ...GUN_BRANCH_A, ...GUN_BRANCH_B },
};

// ── 武器等級鍵值（依玩家 weaponLevel + branch 計算）──────────────────────────
export function getWeaponKey(
  weapon: 'sword' | 'gun',
  level: number,
  branch: 'A' | 'B' | null,
): number | string {
  if (level >= 5 && branch) return `${level}${branch}`;
  // 槍基礎線只到 Lv4（無 Lv5 過渡），劍基礎線到 Lv5
  const maxBase = weapon === 'gun' ? 4 : 5;
  return Math.min(level, maxBase);
}
