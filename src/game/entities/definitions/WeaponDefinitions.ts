// ── WeaponDefinitions.ts ────────────────────────────────────────────────────
// 武器型別登錄表（Registry Pattern / Open-Closed Principle）
//
// 新增武器方式：
//   1. 在 WEAPON_REGISTRY 加一個 key（或在 sword/gun 加新 level entry）
//   2. 實作 fire() + drawWeapon()
//   ✅ Game.ts handlePlayerAttacks / Player.ts draw() 主邏輯零修改
// ────────────────────────────────────────────────────────────────────────────
import type { Player } from '../../Player';
import { ProjectileSpec } from '../../types';
import { audioManager } from '../../AudioManager';

// ── 武器等級定義介面 ─────────────────────────────────────────────────────────
export interface IWeaponLevelDef {
  readonly attackInterval: number;   // ms 攻擊間隔
  readonly burstCount?: number;      // 連發次數（只有 gun lv5 = 2）
  readonly burstDelay?: number;      // 連發間隔 ms

  // 產生這次攻擊的所有子彈規格
  // dmgMult = player.damageMultiplier × altar boost（由 caller 計算）
  fire(player: Player, dmgMult: number): ProjectileSpec[];

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

// ═══════════════════════════════════════════════════════════════════════════
// WEAPON REGISTRY
// ═══════════════════════════════════════════════════════════════════════════
export const SWORD_LEVELS: Record<number, IWeaponLevelDef> = {

  1: {
    attackInterval: 800,
    fire: (player, dmgMult) => {
      audioManager.playSlash(1);
      return [makeSwordSpec(player, dmgMult, 50, 1)];
    },
    drawWeapon(ctx, player) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.rotate(swordSwingOffset(player));
      ctx.lineWidth = 2; ctx.strokeStyle = '#222';
      // Blade
      ctx.fillStyle = '#9e9e9e';
      ctx.beginPath(); ctx.moveTo(0,-3); ctx.lineTo(18,-3); ctx.lineTo(22,0); ctx.lineTo(18,3); ctx.lineTo(0,3); ctx.fill();
      ctx.stroke();
      // Blood stain
      ctx.fillStyle = 'rgba(139,0,0,0.6)';
      ctx.beginPath(); ctx.moveTo(15,-2); ctx.lineTo(21,0); ctx.lineTo(15,2); ctx.fill();
      // Handle
      ctx.fillStyle = '#3e2723'; ctx.fillRect(-6,-2,6,4); ctx.strokeRect(-6,-2,6,4);
      ctx.restore();
    },
  },

  2: {
    attackInterval: 500,
    fire: (player, dmgMult) => {
      audioManager.playSlash(2);
      return [makeSwordSpec(player, dmgMult, 90, 3)];
    },
    drawWeapon(ctx, player) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.rotate(swordSwingOffset(player));
      ctx.lineWidth = 2; ctx.strokeStyle = '#222';
      ctx.fillStyle = '#cfd8dc';
      ctx.beginPath(); ctx.moveTo(0,-4); ctx.lineTo(28,-2); ctx.lineTo(32,0); ctx.lineTo(28,2); ctx.lineTo(0,4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#90a4ae'; ctx.fillRect(2,-1,20,2);
      ctx.fillStyle = '#ffb300'; ctx.fillRect(-2,-8,4,16); ctx.strokeRect(-2,-8,4,16);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-8,-2,6,4);
      ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.arc(-9,0,3,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
  },

  3: {
    attackInterval: 1000,
    fire: (player, dmgMult) => {
      audioManager.playSlash(3);
      return [makeSwordSpec(player, dmgMult, 180, 3)];
    },
    drawWeapon(ctx, player) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.rotate(swordSwingOffset(player));
      ctx.lineWidth = 2; ctx.strokeStyle = '#222';
      ctx.fillStyle = '#eceff1';
      ctx.beginPath(); ctx.moveTo(0,-2); ctx.quadraticCurveTo(15,-6,35,-2); ctx.lineTo(38,2); ctx.quadraticCurveTo(15,0,0,2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(2,0); ctx.quadraticCurveTo(15,-2,32,0); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = '#222';
      ctx.fillStyle = '#212121'; ctx.fillRect(-2,-5,3,10);
      ctx.fillStyle = '#b71c1c'; ctx.fillRect(-10,-2,8,4);
      ctx.fillStyle = '#000';
      for(let i=-9;i<-2;i+=3){ ctx.fillRect(i,-2,1,4); }
      ctx.restore();
    },
  },

  4: {
    attackInterval: 1200,
    fire: (player, dmgMult) => {
      audioManager.playSlash(4);
      return [makeSwordSpec(player, dmgMult, 180, 3)];
    },
    drawWeapon(ctx, player) {
      ctx.save();
      ctx.translate(15, 10);
      ctx.rotate(swordSwingOffset(player));
      ctx.lineWidth = 2; ctx.strokeStyle = '#222';
      ctx.fillStyle = '#37474f';
      ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(35,-6); ctx.lineTo(45,0); ctx.lineTo(35,6); ctx.lineTo(0,8); ctx.fill(); ctx.stroke();
      ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 10; ctx.fillStyle = '#ff1744'; ctx.font = '10px Arial'; ctx.fillText('▼▲▼',15,3); ctx.shadowBlur = 0;
      ctx.fillStyle = '#263238';
      ctx.beginPath(); ctx.moveTo(-4,-12); ctx.lineTo(2,-8); ctx.lineTo(2,8); ctx.lineTo(-4,12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.fillRect(-12,-3,8,6);
      ctx.restore();
    },
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

// ── 統一登錄表 ───────────────────────────────────────────────────────────────
export const WEAPON_REGISTRY: Record<'sword' | 'gun', Record<number, IWeaponLevelDef>> = {
  sword: SWORD_LEVELS,
  gun:   GUN_LEVELS,
};
