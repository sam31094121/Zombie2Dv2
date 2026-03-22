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
  bulletType = 'blue_ellipse',
): ProjectileSpec {
  return {
    ownerId: player.id, x: player.x + ox, y: player.y + oy,
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
  if (level === 1)      drawWoodenStakeShape(ctx);
  else if (level === 2) drawRustyDirkShape(ctx);
  else if (level === 3) drawSoldierDirkShape(ctx);
  else                  drawBlackSteelKatanaShape(ctx);
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

  // Lv1：左輪手槍（單發直射）
  1: {
    attackInterval: 800,
    fire: (player, dmgMult) => {
      audioManager.playShoot(1);
      const v = angleVec(player.aimAngle);
      return [makeBullet(player, dmgMult, v.x, v.y, 1, 1, 6, 5)];
    },
    drawWeapon(ctx, player) {
      ctx.save();
      // 原始設計 44×44，offset (-14, -22) 將握柄對齊玩家手部，槍管朝右
      const ox = -14, oy = -22;
      const r = (x: number, y: number, w: number, h: number) =>
        ctx.fillRect(x + ox, y + oy, w, h);

      const C = {
        silver: '#cbd5e1', white: '#ffffff', shadow: '#475569',
        deep: '#0f172a',   triggerSteel: '#334155',
        wood: '#78350f',   woodDark: '#451a03',
        brass: '#fbbf24',  black: '#000000',
      };

      // 1. 槍管
      ctx.fillStyle = C.silver; r(18, 16, 21, 3);
      ctx.fillStyle = C.white;  r(18, 16, 21, 1);
      ctx.fillStyle = C.shadow; r(18, 18, 21, 1);
      ctx.fillStyle = C.shadow; r(36, 15,  2, 1); // 準星

      // 2. 轉輪
      ctx.fillStyle = C.silver; r(10, 16, 8, 7);
      ctx.fillStyle = C.white;  r(10, 16, 8, 1);
      ctx.fillStyle = C.deep;   r(11, 18, 6, 1); // 溝槽
      ctx.fillStyle = C.deep;   r(11, 21, 6, 1);

      // 3. 槍身框架
      ctx.fillStyle = C.silver; r(6, 16, 4, 7);
      ctx.fillStyle = C.white;  r(6, 16, 4, 1);

      // 4. 擊錘
      ctx.fillStyle = C.shadow; r(4, 13, 2, 2);
      ctx.fillStyle = C.deep;   r(5, 15, 2, 2);

      // 5. 握柄（木製）
      ctx.fillStyle = C.wood;     r(2, 23, 6, 8);
      ctx.fillStyle = C.wood;     r(3, 31, 5, 2);
      ctx.fillStyle = C.wood;     r(4, 33, 4, 1);
      ctx.fillStyle = C.woodDark; r(2, 23, 1, 9); // 木紋
      ctx.fillStyle = C.woodDark; r(4, 27, 1, 1);
      ctx.fillStyle = C.brass;    r(4, 28, 1, 1); // 飾釘

      // 6. 護圈 + 板機
      ctx.fillStyle = C.shadow;       r( 9, 23, 9, 1); // 護圈上緣
      ctx.fillStyle = C.shadow;       r(17, 23, 1, 4); // 護圈前緣
      ctx.fillStyle = C.shadow;       r(10, 27, 7, 1); // 護圈底緣
      ctx.fillStyle = C.white;        r(11, 28, 5, 1); // 底部反光
      ctx.fillStyle = C.black;        r(12, 23, 2, 1); // 板機根部陰影
      ctx.fillStyle = C.triggerSteel; r(12, 24, 1, 2); // 板機主體
      ctx.fillStyle = C.triggerSteel; r(13, 25, 1, 1); // 板機鉤尖
      ctx.fillStyle = C.shadow;       r(12, 24, 1, 1); // 板機高光
      ctx.fillStyle = C.deep;         r(13, 24, 1, 1); // 板機內陰影

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
    fire: (player, dmgMult) => {
      audioManager.playShoot(2);
      const v = angleVec(player.aimAngle);
      return [makeBullet(player, dmgMult, v.x, v.y, 2, 1, 8, 6)];
    },
    drawWeapon(ctx, player) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.lineWidth = 2; ctx.strokeStyle = '#111';
      ctx.fillStyle = '#333'; ctx.fillRect(0,-4,22,6); ctx.strokeRect(0,-4,22,6);
      ctx.fillStyle = '#111'; ctx.fillRect(22,-2,6,3); ctx.fillRect(8,2,4,10);
      ctx.beginPath(); ctx.moveTo(-2,2); ctx.lineTo(4,2); ctx.lineTo(2,10); ctx.lineTo(-4,10); ctx.fill();
      drawMuzzleFlash(ctx, 28, 0, player.lastAttackTime);
      ctx.restore();
    },
  },

  // Lv3：左右雙管齊發
  3: {
    attackInterval: 600,
    fire: (player, dmgMult) => {
      audioManager.playShoot(3);
      const v    = angleVec(player.aimAngle);
      const perp = { x: -v.y * 10, y: v.x * 10 };
      return [
        makeBullet(player, dmgMult, v.x, v.y, 2, 1, 9, 5,  perp.x,  perp.y),
        makeBullet(player, dmgMult, v.x, v.y, 2, 1, 9, 5, -perp.x, -perp.y),
      ];
    },
    drawWeapon(ctx, player) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.lineWidth = 2; ctx.strokeStyle = '#111';
      ctx.fillStyle = '#2c3e50'; ctx.fillRect(0,-6,28,5); ctx.strokeRect(0,-6,28,5); // 上管
      ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 1,28,5); ctx.strokeRect(0, 1,28,5); // 下管
      ctx.fillStyle = '#111'; ctx.fillRect(-10,-4,10,8); // 握把
      ctx.beginPath(); ctx.moveTo(0,6); ctx.lineTo(5,6); ctx.lineTo(3,14); ctx.lineTo(-2,14); ctx.fill();
      drawMuzzleFlash(ctx, 28, -4, player.lastAttackTime);
      drawMuzzleFlash(ctx, 28,  4, player.lastAttackTime);
      ctx.restore();
    },
  },

  // Lv4：前大後小三角陣型（1 大 + 2 小）
  4: {
    attackInterval: 600,
    fire: (player, dmgMult) => {
      audioManager.playShoot(4);
      const v    = angleVec(player.aimAngle);
      const perp = { x: -v.y, y: v.x };
      // 大子彈（中央前方）
      const front = makeBullet(player, dmgMult, v.x, v.y, 3, 2, 10, 8,
        v.x * 8, v.y * 8);
      // 兩顆小子彈（左右後方）
      const left  = makeBullet(player, dmgMult, v.x, v.y, 2, 2, 10, 5,
        perp.x * 10 - v.x * 4, perp.y * 10 - v.y * 4);
      const right = makeBullet(player, dmgMult, v.x, v.y, 2, 2, 10, 5,
        -perp.x * 10 - v.x * 4, -perp.y * 10 - v.y * 4);
      return [front, left, right];
    },
    drawWeapon(ctx, player) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.lineWidth = 2; ctx.strokeStyle = '#111';
      // 雙管
      ctx.fillStyle = '#3e2723'; ctx.fillRect(0,-6,32,5); ctx.strokeRect(0,-6,32,5);
      ctx.fillStyle = '#3e2723'; ctx.fillRect(0, 1,32,5); ctx.strokeRect(0, 1,32,5);
      // 槍管中段連接件
      ctx.fillStyle = '#212121'; ctx.fillRect(20,-7,4,14);
      // 握把 + 扳機
      ctx.fillStyle = '#111'; ctx.fillRect(-12,-4,12,8);
      ctx.beginPath(); ctx.moveTo(0,4); ctx.lineTo(6,4); ctx.lineTo(4,12); ctx.lineTo(-2,12); ctx.fill();
      drawMuzzleFlash(ctx, 32, -4, player.lastAttackTime);
      drawMuzzleFlash(ctx, 32,  4, player.lastAttackTime);
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
): MissileProjectile {
  return new MissileProjectile({
    ownerId: p.id,
    x: p.x, y: p.y,
    angle: p.aimAngle,
    damage: damage * dmgMult,
    speed:     8,
    turnSpeed: 0.005,   // rad/ms 軟追蹤
    radius:    10,
    isSmall:   false,
    splitAfter,
    groundFireRadius:   70,  // 跟龍捲風差不多大
    groundFireDuration: 3000,
  });
}

// ── 火箭炮外觀（5A-8A 共用；用戶設計 64×64 → offset dx=-14, dy=-32 對齊玩家中心）──
// 砲管中心在 game(16, 0)；砲口尖在 game(42, 0)；握把在 game(8, 4)
function _drawMissileLauncher(
  ctx: CanvasRenderingContext2D,
  player: Player,
): void {
  const ox = 10, oy = 28, len = 40;
  const dx = -14, dy = -32; // 坐標偏移：user + offset = game
  const r = (x: number, y: number, w: number, h: number) =>
    ctx.fillRect(x + dx, y + dy, w, h);

  const M = {
    steelDark:  '#1e293b', steelMid:  '#475569',
    steelLight: '#94a3b8', steelHigh: '#f1f5f9',
    bloodDeep:  '#7f1d1d', bloodMain: '#dc2626',
    bloodGlow:  '#f87171', bloodHigh: '#fecaca',
    boneSolid:  '#e7e5e4', eyeRed:    '#ff0000',
    black:      '#0a0a0a',
  };

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // 1. 砲管
  ctx.fillStyle = M.steelMid;   r(ox,   oy,    len, 8);
  ctx.fillStyle = M.steelLight; r(ox,   oy,    len, 2);
  ctx.fillStyle = M.steelHigh;  r(ox+5, oy,    len-10, 1);
  ctx.fillStyle = M.steelDark;  r(ox,   oy+6,  len, 2);

  // 2. 能量導管（血色血脈）
  ctx.fillStyle = M.bloodDeep; r(ox+8,  oy-2, 22, 2);
  ctx.fillStyle = M.bloodMain; r(ox+8,  oy-1, 22, 1);
  ctx.fillStyle = M.bloodGlow; r(ox+12, oy-1, 10, 1);
  ctx.fillStyle = M.bloodMain; r(ox+4,  oy+3, 12, 1);
  ctx.fillStyle = M.bloodMain; r(ox+22, oy+4, 14, 1);
  ctx.fillStyle = M.bloodGlow; r(ox+6,  oy+3,  3, 1);

  // 3. 魔型砲口
  ctx.fillStyle = M.black;      r(ox+len,   oy-3,  6, 14);
  ctx.fillStyle = M.steelLight; r(ox+len,   oy-3,  6,  1);
  ctx.fillStyle = M.steelLight; r(ox+len,   oy+10, 6,  1);
  ctx.fillStyle = M.boneSolid;  r(ox+len+2, oy-5,  2,  3); // 上牙
  ctx.fillStyle = M.boneSolid;  r(ox+len+2, oy+10, 2,  3); // 下牙
  ctx.fillStyle = M.steelHigh;  r(ox+len+2, oy-5,  1,  1); // 牙齒高光

  // 4. 晶體瞄準器
  ctx.fillStyle = M.black;      r(ox+14, oy-10, 10, 10);
  ctx.fillStyle = M.steelMid;   r(ox+15, oy-9,   8,  8);
  ctx.fillStyle = M.bloodDeep;  r(ox+16, oy-8,   6,  6);
  ctx.fillStyle = M.eyeRed;     r(ox+17, oy-7,   4,  4);
  ctx.fillStyle = M.bloodHigh;  r(ox+17, oy-7,   2,  2); // 晶體折射光

  // 5. 握把
  ctx.fillStyle = M.black;      r(ox+12, oy+8,  4, 10);
  ctx.fillStyle = M.steelDark;  r(ox+13, oy+8,  2, 10);
  ctx.fillStyle = M.bloodMain;  r(ox+13, oy+10, 2,  1); // 防滑條
  ctx.fillStyle = M.bloodMain;  r(ox+13, oy+13, 2,  1);

  // 6. 後噴口
  ctx.fillStyle = M.black;      r(ox-4, oy-1, 6, 10);
  ctx.fillStyle = M.steelLight; r(ox-4, oy-1, 6,  1);

  // 7. 砲口環境光粒子
  ctx.fillStyle = M.bloodGlow;  r(ox+len+8, oy+2, 1, 1);
  r(ox+len+6, oy+8, 1, 1);

  // 槍口火光（砲口中心：game x=42, y=0）
  drawMuzzleFlash(ctx, ox + len + 6 + dx, oy + 4 + dy, player.lastAttackTime);

  ctx.restore();
}

const GUN_BRANCH_A: Record<string, IWeaponLevelDef> = {
  // ── 5A：單發追蹤導彈 ────────────────────────────────────────────────────
  '5A': {
    attackInterval: 1200,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playShoot(4);
      game.missiles.push(_makeMissile(p, m, 5, 0));
    },
    drawWeapon(ctx, player) { _drawMissileLauncher(ctx, player); },
  },

  // ── 6A：連射 ×2 追蹤導彈 ─────────────────────────────────────────────
  '6A': {
    attackInterval: 1100,
    burstCount: 2,
    burstDelay: 220,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playShoot(4);
      game.missiles.push(_makeMissile(p, m, 6, 0));
    },
    drawWeapon(ctx, player) { _drawMissileLauncher(ctx, player); },
  },

  // ── 7A：連射 ×3 追蹤導彈 ─────────────────────────────────────────────
  '7A': {
    attackInterval: 1100,
    burstCount: 3,
    burstDelay: 200,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playShoot(5);
      game.missiles.push(_makeMissile(p, m, 7, 0));
    },
    drawWeapon(ctx, player) { _drawMissileLauncher(ctx, player); },
  },

  // ── 8A：連射 ×3 分裂彈（0.3s 後裂成 3 顆小導彈）────────────────────
  '8A': {
    attackInterval: 1100,
    burstCount: 3,
    burstDelay: 200,
    fire: () => [],
    fireDirect(game, p, m) {
      audioManager.playShoot(5);
      game.missiles.push(_makeMissile(p, m, 8, 300)); // splitAfter=300ms
    },
    drawWeapon(ctx, player) { _drawMissileLauncher(ctx, player); },
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
    drawWeapon(ctx, player) {
      ctx.save(); ctx.translate(15,10);
      ctx.fillStyle='#37474f'; ctx.fillRect(0,-4,48,6); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.strokeRect(0,-4,48,6);
      ctx.fillStyle='#546e7a'; ctx.fillRect(8,-8,8,3); // scope
      ctx.fillStyle='#263238'; ctx.fillRect(-14,-3,14,6); ctx.fillRect(16,2,4,10);
      drawMuzzleFlash(ctx, 48, -1, player.lastAttackTime);
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
    drawWeapon(ctx, player) {
      ctx.save(); ctx.translate(15,10);
      ctx.fillStyle='#263238'; ctx.fillRect(0,-4,54,6); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.strokeRect(0,-4,54,6);
      ctx.fillStyle='#455a64'; ctx.fillRect(10,-9,10,4);
      ctx.fillStyle='#1c313a'; ctx.fillRect(-16,-4,16,8); ctx.fillRect(18,2,4,12);
      drawMuzzleFlash(ctx, 54, -1, player.lastAttackTime);
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
    drawWeapon(ctx, player) {
      ctx.save(); ctx.translate(15,10);
      ctx.fillStyle='#1a237e'; ctx.fillRect(0,-5,58,8); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.strokeRect(0,-5,58,8);
      ctx.shadowColor='#7c4dff'; ctx.shadowBlur=10; ctx.fillStyle='#7c4dff';
      ctx.fillRect(58,-3,10,4);
      ctx.shadowBlur=0; ctx.fillStyle='#311b92'; ctx.fillRect(-16,-4,16,8); ctx.fillRect(20,3,5,12);
      drawMuzzleFlash(ctx, 68, -1, player.lastAttackTime);
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
    drawWeapon(ctx, player) {
      ctx.save(); ctx.translate(15,10);
      ctx.shadowColor='#7c4dff'; ctx.shadowBlur=20;
      ctx.fillStyle='#1a237e'; ctx.fillRect(0,-5,64,8); ctx.strokeStyle='#311b92'; ctx.lineWidth=2; ctx.strokeRect(0,-5,64,8);
      ctx.fillStyle='#7c4dff'; ctx.fillRect(50,-4,14,6);
      ctx.fillStyle='#b39ddb'; ctx.fillRect(12,-9,12,4);
      ctx.shadowBlur=0; ctx.fillStyle='#000028'; ctx.fillRect(-18,-5,18,10); ctx.fillRect(22,3,5,14);
      drawMuzzleFlash(ctx, 64, -1, player.lastAttackTime);
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
