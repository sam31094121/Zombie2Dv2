// ?? WeaponDefinitions.ts ????????????????????????????????????????????????????
// 甇血??駁?銵剁?Registry Pattern / Open-Closed Principle嚗?
//
// ?啣?甇血?孵?嚗?
//   1. ??WEAPON_REGISTRY ????key嚗???sword/gun ? level entry嚗?
//   2. 撖虫? fire() + drawWeapon()
//   ??Game.ts handlePlayerAttacks / Player.ts draw() 銝駁?頛舫靽格
// ????????????????????????????????????????????????????????????????????????????
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

// ?? 甇血蝑?摰儔隞 ?????????????????????????????????????????????????????????
export interface IWeaponLevelDef {
  readonly attackInterval: number;   // ms ?餅???
  readonly attackRange?: number;     // px ?餅?撠?嚗誑甇血銝剖??箏?暺?嚗閮剖??券?閮哨?sword=150, gun=300
  readonly burstCount?: number;      // ??甈⊥嚗??gun lv5 = 2嚗?
  readonly burstDelay?: number;      // ???? ms

  // ?Ｙ??活?餅?????敶???
  // dmgMult = player.damageMultiplier ? altar boost嚗 caller 閮?嚗?
  fire(player: Player, dmgMult: number, origin?: {x: number, y: number, aimAngle: number}): ProjectileSpec[];

  // ?脤??餅?嚗ranch A/B ?頂雿輻嚗??湔?? game嚗ire() ?蝛粹??
  fireDirect?: (game: Game, player: Player, dmgMult: number, origin?: {x: number, y: number, aimAngle: number}) => void;

  // 蝜芾ˊ甇血嚗tx 撌脩 caller ??rotate(aimAngle)嚗?
  // ?賢??扯撌?save/restore
  drawWeapon(ctx: CanvasRenderingContext2D, player: Player, slot?: import('../../Player').WeaponSlot): void;
}

// ????????????????????????????????????????????????????????????????????????????
// SWORD ?餅??賢?
// ????????????????????????????????????????????????????????????????????????????
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

// ????????????????????????????????????????????????????????????????????????????
// GUN ?餅??賢?
// ????????????????????????????????????????????????????????????????????????????
function makeBullet(
  player: Player, dmgMult: number,
  vx: number, vy: number,
  damage: number, pierce: number, speed: number, radius: number,
  ox = 0, oy = 0,
  bulletType = 'blue_ellipse',
  origin?: {x: number, y: number, aimAngle: number}
): ProjectileSpec {
  // ??閮?摮???280px ??憭望??????(?身?箸? 60 FPS: 16.66ms per tick)
  const maxRange = 280;
  const lifetime = (maxRange / speed) * (1000 / 60);

  const angle = origin?.aimAngle ?? player.aimAngle;
  // 撠????蝘?(ox, oy) ?脰???嚗?甇血??撠?
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotatedOx = ox * cos - oy * sin;
  const rotatedOy = ox * sin + oy * cos;

  return {
    ownerId: player.id, 
    x: (origin?.x ?? player.x) + rotatedOx, 
    y: (origin?.y ?? player.y) + rotatedOy,
    vx: vx * speed, vy: vy * speed,
    damage: damage * dmgMult,
    pierce, lifetime,
    type: 'bullet', radius, knockback: false, level: player.level,
    bulletType,
  };
}

function angleVec(a: number) { return { x: Math.cos(a), y: Math.sin(a) }; }

// ????????????????????????????????????????????????????????????????????????????
// SWORD DRAW HELPERS
// ????????????????????????????????????????????????????????????????????????????
function swordSwingOffset(player: Player, slot?: import('../../Player').WeaponSlot): number {
  if ((player as any).isPreview) return 0;
  const t = Date.now() - (slot?.lastAttackTime ?? player.lastAttackTime);
  const dur = 200;
  return t < dur ? -Math.PI / 2 + (t / dur) * Math.PI : -Math.PI / 4;
}

// ?? 蝒?箏? drawWeapon 頛嚗摰嗆?????閫嚗??????????????????????????????
// ?銝?餅?嚗swordOut = true嚗?憿舐內蝛箸嚗?憿舐內?
// ??????憿舐內?
function drawHeldKnife(ctx: CanvasRenderingContext2D, player: Player, level: number = 2, slot?: import('../../Player').WeaponSlot): void {
  // 瘚桃征甇血銝蝙?函摰嗅??_swordOut ????踹?憭?甇血鈭撟脫撠暺嚗?
  if (!slot && (player as any)._swordOut) { _drawEmptyFist(ctx); return; }
  ctx.save();
  ctx.translate(14, 8);
  ctx.rotate(swordSwingOffset(player, slot));
  if (level === 1) drawWoodenStakeShape(ctx);
  else if (level === 2) drawRustyDirkShape(ctx);
  else if (level === 3) drawSoldierDirkShape(ctx);
  else drawBlackSteelKatanaShape(ctx, Boolean((player as any).disableWeaponGlow));
  ctx.restore();
}

// ?? 憌? fireDirect ?嚗ase branch嚗??????????????????????????????????????
function _mkBase(level: number, p: Player, dmgMult: number, origin?: {x: number, y: number, aimAngle: number}): SwordConfig {
  // maxRange ?函?蝝凝憓?damage = 蝑??賂??瑕蝯曹? 800ms
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

// ????????????????????????????????????????????????????????????????????????????
// WEAPON REGISTRY嚗? Lv1-4嚗rotato ??憌?嚗?
// ????????????????????????????????????????????????????????????????????????????
export const SWORD_LEVELS: Record<number, IWeaponLevelDef> = {

  1: {
    attackInterval: 800,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playSlash(1);
      if (!p.isFloatingWeapons) (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(_mkBase(1, p, m, origin)));
    },
    drawWeapon(ctx, p, slot) { drawHeldKnife(ctx, p, 1, slot); },
  },

  2: {
    attackInterval: 800,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playSlash(2);
      if (!p.isFloatingWeapons) (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(_mkBase(2, p, m, origin)));
    },
    drawWeapon(ctx, p, slot) { drawHeldKnife(ctx, p, 2, slot); },
  },

  3: {
    attackInterval: 800,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playSlash(3);
      if (!p.isFloatingWeapons) (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(_mkBase(3, p, m, origin)));
    },
    drawWeapon(ctx, p, slot) { drawHeldKnife(ctx, p, 3, slot); },
  },

  4: {
    attackInterval: 800,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playSlash(4);
      if (!p.isFloatingWeapons) (p as any)._swordOut = true;
      game.swordProjectiles.push(new SwordProjectile(_mkBase(4, p, m, origin)));
    },
    drawWeapon(ctx, p, slot) { drawHeldKnife(ctx, p, 4, slot); },
  },

};

export const GUN_LEVELS: Record<number, IWeaponLevelDef> = {

  // Lv1嚗椰頛芣?瑽??桃?游?嚗?
  1: {
    attackInterval: 800,
    fire: (player, dmgMult, origin) => {
      audioManager.playShoot(1);
      const angle = origin?.aimAngle ?? player.aimAngle;
      const v = angleVec(angle);
      return [makeBullet(player, dmgMult, v.x, v.y, 1, 1, 6, 5, 25, -2, 'blue_ellipse', origin)];
    },
    drawWeapon(ctx, player, slot) {
      ctx.save();
      // ??閮剛? 44?44嚗ffset (-14, -22) 撠??朣摰嗆??剁?瑽恣?
      const ox = -14, oy = -22;
      const r = (x: number, y: number, w: number, h: number) =>
        ctx.fillRect(x + ox, y + oy, w, h);

      const C = {
        silver: '#cbd5e1', white: '#ffffff', shadow: '#475569',
        deep: '#0f172a', triggerSteel: '#334155',
        wood: '#78350f', woodDark: '#451a03',
        brass: '#fbbf24', black: '#000000',
      };

      // 1. 瑽恣
      ctx.fillStyle = C.silver; r(18, 16, 21, 3);
      ctx.fillStyle = C.white; r(18, 16, 21, 1);
      ctx.fillStyle = C.shadow; r(18, 18, 21, 1);
      ctx.fillStyle = C.shadow; r(36, 15, 2, 1); // 皞?

      // 2. 頧憚
      ctx.fillStyle = C.silver; r(10, 16, 8, 7);
      ctx.fillStyle = C.white; r(10, 16, 8, 1);
      ctx.fillStyle = C.deep; r(11, 18, 6, 1); // 皞局
      ctx.fillStyle = C.deep; r(11, 21, 6, 1);

      // 3. 瑽澈獢
      ctx.fillStyle = C.silver; r(6, 16, 4, 7);
      ctx.fillStyle = C.white; r(6, 16, 4, 1);

      // 4. ??
      ctx.fillStyle = C.shadow; r(4, 13, 2, 2);
      ctx.fillStyle = C.deep; r(5, 15, 2, 2);

      // 5. ?⊥?嚗鋆踝?
      ctx.fillStyle = C.wood; r(2, 23, 6, 8);
      ctx.fillStyle = C.wood; r(3, 31, 5, 2);
      ctx.fillStyle = C.wood; r(4, 33, 4, 1);
      ctx.fillStyle = C.woodDark; r(2, 23, 1, 9); // ?函?
      ctx.fillStyle = C.woodDark; r(4, 27, 1, 1);
      ctx.fillStyle = C.brass; r(4, 28, 1, 1); // 憌暸?

      // 6. 霅瑕? + ?踵?
      ctx.fillStyle = C.shadow; r(9, 23, 9, 1); // 霅瑕?銝楠
      ctx.fillStyle = C.shadow; r(17, 23, 1, 4); // 霅瑕??楠
      ctx.fillStyle = C.shadow; r(10, 27, 7, 1); // 霅瑕?摨楠
      ctx.fillStyle = C.white; r(11, 28, 5, 1); // 摨??
      ctx.fillStyle = C.black; r(12, 23, 2, 1); // ?踵??寥?啣蔣
      ctx.fillStyle = C.triggerSteel; r(12, 24, 1, 2); // ?踵?銝駁?
      ctx.fillStyle = C.triggerSteel; r(13, 25, 1, 1); // ?踵??文?
      ctx.fillStyle = C.shadow; r(12, 24, 1, 1); // ?踵?擃?
      ctx.fillStyle = C.deep; r(13, 24, 1, 1); // ?踵??折敶?

      // 7. 瑽恣?亦葦
      ctx.fillStyle = C.black; r(18, 16, 1, 4);

      // 8. 瑽?怠?嚗芋蝯? 2-frame flash嚗?
      drawMuzzleFlash(ctx, 25, -5, slot?.lastAttackTime ?? player.lastAttackTime);

      ctx.restore();
    },
  },

  // Lv2嚗?潛撠??湧??瑕拿嚗?
  2: {
    attackInterval: 605,
    fire: (player, dmgMult, origin) => {
      audioManager.playShoot(2);
      const angle = origin?.aimAngle ?? player.aimAngle;
      const v = angleVec(angle);
      return [makeBullet(player, dmgMult, v.x, v.y, 2, 1, 8, 6, 28, 0, 'blue_ellipse', origin)];
    },
    drawWeapon(ctx, player, slot) {
      ctx.save();
      // 隞?(0,0) ?箸郎?刻?閬箔葉敹?瑽恣?
      ctx.translate(2, 0);
      ctx.lineWidth = 2; ctx.strokeStyle = '#1e293b';
      // 皛?嚗??潸嚗?
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, -4, 22, 8); ctx.strokeRect(0, -4, 22, 8);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, -4, 22, 1); // 擃???
      // 瑽恣撱嗡撓 + 獢嚗楛?潸嚗?
      ctx.fillStyle = '#475569'; ctx.fillRect(22, -2, 6, 4); ctx.fillRect(8, 4, 4, 10);
      // ?⊥?嚗楛?堆?
      ctx.fillStyle = '#374151';
      ctx.beginPath(); ctx.moveTo(-2, 4); ctx.lineTo(4, 4); ctx.lineTo(2, 14); ctx.lineTo(-4, 14); ctx.closePath(); ctx.fill();
      drawMuzzleFlash(ctx, 28, 0, slot?.lastAttackTime ?? player.lastAttackTime);
      ctx.restore();
    },
  },

  // Lv3嚗椰?喲?蝞⊿???
  3: {
    attackInterval: 600,
    fire: (player, dmgMult, origin) => {
      audioManager.playShoot(3);
      const angle = origin?.aimAngle ?? player.aimAngle;
      const v = angleVec(angle);
      const perp = { x: -v.y * 10, y: v.x * 10 };
      return [
        makeBullet(player, dmgMult, v.x, v.y, 2, 1, 9, 5, 28, -5, 'blue_ellipse', origin),
        makeBullet(player, dmgMult, v.x, v.y, 2, 1, 9, 5, 28, 5, 'blue_ellipse', origin),
      ];
    },
    drawWeapon(ctx, player, slot) {
      ctx.save();
      // 隞?(0,0) ?箸郎?刻?閬箔葉敹?瑽恣?嚗?銝?蝔梢?蝞∟身閮?
      ctx.translate(2, 0);
      ctx.lineWidth = 2; ctx.strokeStyle = '#1e293b';
      // 銝恣嚗??嚗?
      ctx.fillStyle = '#8bacc4'; ctx.fillRect(0, -7, 28, 5); ctx.strokeRect(0, -7, 28, 5);
      ctx.fillStyle = '#dce8f2'; ctx.fillRect(0, -7, 28, 1); // 擃?
      // 銝恣嚗?瘛梢???
      ctx.fillStyle = '#7a9eb8'; ctx.fillRect(0, 2, 28, 5); ctx.strokeRect(0, 2, 28, 5);
      ctx.fillStyle = '#ccdde8'; ctx.fillRect(0, 2, 28, 1); // 擃?
      // ?⊥?嚗楛?堆?
      ctx.fillStyle = '#374151'; ctx.fillRect(-12, -5, 12, 10);
      ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(5, 5); ctx.lineTo(3, 13); ctx.lineTo(-2, 13); ctx.closePath(); ctx.fill();
      drawMuzzleFlash(ctx, 28, -5, slot?.lastAttackTime ?? player.lastAttackTime);
      drawMuzzleFlash(ctx, 28, 5, slot?.lastAttackTime ?? player.lastAttackTime);
      ctx.restore();
    },
  },

  // Lv4嚗?憭批?撠?閫??1 憭?+ 2 撠?
  4: {
    attackInterval: 600,
    fire: (player, dmgMult, origin) => {
      audioManager.playShoot(4);
      const angle = origin?.aimAngle ?? player.aimAngle;
      const v = angleVec(angle);
      const perp = { x: -v.y, y: v.x };
      // 憭批?敶?瑽銝剖亢嚗?
      const front = makeBullet(player, dmgMult, v.x, v.y, 3, 2, 10, 8,
        32, 0, 'blue_ellipse', origin);
      // ?拚?撠?敶???蝞⊥????
      const left = makeBullet(player, dmgMult, v.x, v.y, 2, 2, 10, 5,
        32, -5, 'blue_ellipse', origin);
      const right = makeBullet(player, dmgMult, v.x, v.y, 2, 2, 10, 5,
        32, 5, 'blue_ellipse', origin);
      return [front, left, right];
    },
    drawWeapon(ctx, player, slot) {
      ctx.save();
      // 隞?(0,0) ?箸郎?刻?閬箔葉敹?瑽恣?嚗?銝?蝔曹?蝞∟身閮?
      ctx.translate(2, 0);
      ctx.lineWidth = 2; ctx.strokeStyle = '#1e293b';
      // 銝恣嚗??嚗?
      ctx.fillStyle = '#7496b0'; ctx.fillRect(0, -7, 32, 5); ctx.strokeRect(0, -7, 32, 5);
      ctx.fillStyle = '#c8d9e8'; ctx.fillRect(0, -7, 32, 1); // 擃?
      // 銝恣嚗??嚗?
      ctx.fillStyle = '#7496b0'; ctx.fillRect(0, 2, 32, 5); ctx.strokeRect(0, 2, 32, 5);
      ctx.fillStyle = '#c8d9e8'; ctx.fillRect(0, 2, 32, 1); // 擃?
      // 瑽恣銝剜挾??隞塚?瘛梢?莎?
      ctx.fillStyle = '#4a6a80'; ctx.fillRect(20, -8, 4, 16);
      // ?⊥? + ?單?
      ctx.fillStyle = '#374151'; ctx.fillRect(-14, -5, 14, 10);
      ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(6, 5); ctx.lineTo(4, 13); ctx.lineTo(-2, 13); ctx.closePath(); ctx.fill();
      drawMuzzleFlash(ctx, 32, -5, slot?.lastAttackTime ?? player.lastAttackTime);
      drawMuzzleFlash(ctx, 32, 5, slot?.lastAttackTime ?? player.lastAttackTime);
      ctx.restore();
    },
  },
};

// ????????????????????????????????????????????????????????????????????????????
// SWORD ?嚗v5A-8A嚗?憸冽?嚗?????+ ????+ ??
// 雿輻 fireDirect ?湔?萄遣 SwordProjectile嚗ire() ?蝛粹??
// ????????????????????????????????????????????????????????????????????????????

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

// ?? 蝛箸嚗?銝?餅????剁??????????????????????????????????????????????????
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

// ?? Branch A/B ??頛嚗??SwordRenderer ???shape嚗???????????????????
function _drawHeldBranchA(ctx: CanvasRenderingContext2D, player: Player, slot?: import('../../Player').WeaponSlot): void {
  if (!slot && (player as any)._swordOut) { _drawEmptyFist(ctx); return; }
  const colors = getBranchColors('A', player.weaponLevels[player.weapon]);
  ctx.save();
  ctx.translate(14, 8);
  ctx.rotate(swordSwingOffset(player, slot));
  drawBranchAShape(ctx, colors);
  ctx.restore();
}

function _drawHeldBranchB(ctx: CanvasRenderingContext2D, player: Player, slot?: import('../../Player').WeaponSlot): void {
  if (!slot && (player as any)._swordOut) { _drawEmptyFist(ctx); return; }
  const colors = getBranchColors('B', player.weaponLevels[player.weapon]);
  ctx.save();
  ctx.translate(14, 8);
  ctx.rotate(swordSwingOffset(player, slot));
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
    drawWeapon(ctx, p, slot) { _drawHeldBranchA(ctx, p, slot); },
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
    drawWeapon(ctx, p, slot) { _drawHeldBranchA(ctx, p, slot); },
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
    drawWeapon(ctx, p, slot) { _drawHeldBranchA(ctx, p, slot); },
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
    drawWeapon(ctx, p, slot) { _drawHeldBranchA(ctx, p, slot); },
  },
};

// ????????????????????????????????????????????????????????????????????????????
// SWORD ?嚗v5B-8B嚗祟?斗?嚗?憌 ??撋?格? ??AOE 憭抒???
// ????????????????????????????????????????????????????????????????????????????
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
    drawWeapon(ctx, p, slot) { _drawHeldBranchB(ctx, p, slot); },
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
    drawWeapon(ctx, p, slot) { _drawHeldBranchB(ctx, p, slot); },
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
    drawWeapon(ctx, p, slot) { _drawHeldBranchB(ctx, p, slot); },
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
    drawWeapon(ctx, p, slot) { _drawHeldBranchB(ctx, p, slot); },
  },
};

// ????????????????????????????????????????????????????????????????????????????
// GUN ?嚗v5A-8A嚗??瘚? / Lv5B-8B嚗???嚗?
// ????????????????????????????????????????????????????????????????????????????
// ?? 撠?頛嚗遣蝡?MissileProjectile 閮剖? ?????????????????????????????????????
function _makeMissile(
  p: Player, dmgMult: number,
  damage: number, splitAfter: number,
  origin?: {x: number, y: number, aimAngle: number}
): MissileProjectile {
  const speed = 8;
  const maxRange = 280;
  const lifetime = (maxRange / speed) * (1000 / 60);

  const angle = origin?.aimAngle ?? p.aimAngle;
  // 撠??澆????蝘?(閮???_drawMissileLauncher ??MuzzleFlash 雿蔭)
  const mx = 29;
  const my = -6;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotatedOx = mx * cos - my * sin;
  const rotatedOy = mx * sin + my * cos;

  const proj = new MissileProjectile({
    ownerId: p.id,
    x: (origin?.x ?? p.x) + rotatedOx,
    y: (origin?.y ?? p.y) + rotatedOy,
    angle,
    speed,
    damage: damage * dmgMult,
    turnSpeed: 0.005,   // rad/ms 頠蕭頩?
    radius: 10,
    isSmall: false,
    splitAfter,
    groundFireRadius: 70,  // 頝??脤◢撌桐?憭之
    groundFireDuration: 3000,
  });
  proj.lifetime = lifetime;
  proj.maxLifetime = Math.max(proj.maxLifetime, lifetime);
  return proj;
}

// ?? ?怎悌?桀?閫嚗?A-8A ?梁嚗?嗉身閮?64?64 ??offset dx=-14, dy=-32 撠??拙振銝剖?嚗??
// ?脩恣銝剖???game(16, 0)嚗?????game(42, 0)嚗? game(8, 4)
function _drawMissileLauncher(
  ctx: CanvasRenderingContext2D,
  player: Player,
  slot?: import('../../Player').WeaponSlot
): void {
  const ox = 10, oy = 28, len = 38; // 蝮桃銝暺?銝餌蝞∴??箏撥???辰?箇征??
  const dx = -14, dy = -32; // ???宏嚗ser + offset = game
  const r = (x: number, y: number, w: number, h: number) =>
    ctx.fillRect(x + dx, y + dy, w, h);

  // 蝎曄?擃?瘥矽?脩
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

  // --- 1. ?脩恣銝駁? (Polished Barrel) ---
  ctx.fillStyle = C.steelMid; r(ox, oy, len, 8);

  // ????典?敶?
  ctx.fillStyle = C.steelLight; r(ox, oy, len, 2);
  ctx.fillStyle = C.steelHigh; r(ox + 2, oy, len - 4, 1);
  ctx.fillStyle = C.steelDark; r(ox, oy + 6, len, 2);

  // 璈１蝝啁?嚗????Ｘ蝺?
  ctx.fillStyle = C.black; r(ox + 8, oy, 1, 8);
  ctx.fillStyle = C.black; r(ox + 25, oy, 1, 8);
  ctx.fillStyle = C.brass; r(ox + 10, oy + 1, 1, 1);
  ctx.fillStyle = C.brass; r(ox + 10, oy + 6, 1, 1);

  // --- 2. 瘚撘瑕??脣 (Smooth Reinforced Muzzle) ---
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

  // --- 3. ?賡?撠恣蝯辣 (Energy System) ---
  ctx.fillStyle = C.steelDark; r(ox + 6, oy - 2, 4, 4); // ?亙 A
  ctx.fillStyle = C.bloodDeep; r(ox + 7, oy - 2, 22, 2);
  ctx.fillStyle = C.bloodMain; r(ox + 7, oy - 1, 20, 1);
  ctx.fillStyle = C.bloodHigh; r(ox + 12, oy - 1, 4, 1);

  // --- 4. ?啗?????(Tactical Scope) ---
  ctx.fillStyle = C.black; r(ox + 14, oy - 11, 10, 11);
  ctx.fillStyle = C.steelMid; r(ox + 15, oy - 10, 8, 9);
  ctx.fillStyle = C.bloodDeep; r(ox + 16, oy - 9, 6, 7);
  ctx.fillStyle = C.eyeRed; r(ox + 17, oy - 8, 4, 5);
  ctx.fillStyle = C.white; r(ox + 17, oy - 8, 1, 1);

  // --- 5. ?⊥??璈?(Ergo Grip) ---
  ctx.fillStyle = C.black; r(ox + 12, oy + 8, 5, 11);
  ctx.fillStyle = C.steelDark; r(ox + 13, oy + 8, 3, 11);
  ctx.fillStyle = C.bloodMain; r(ox + 20, oy + 9, 1, 3); // ?踵?

  // --- 6. 敺撟唾﹛鋆蔭 (Rear Stock) ---
  ctx.fillStyle = C.steelMid; r(ox - 6, oy - 1, 6, 11);
  ctx.fillStyle = C.steelHigh; r(ox - 6, oy - 1, 6, 1);
  ctx.fillStyle = C.steelDark; r(ox - 6, oy + 8, 6, 2);

  // 瑽?怠?嚗?朣?脣嚗?
  drawMuzzleFlash(ctx, mx + mw + dx, oy + 4 + dy, slot?.lastAttackTime ?? player.lastAttackTime);

  ctx.restore();
}

const GUN_BRANCH_A: Record<string, IWeaponLevelDef> = {
  // ?? 5A嚗?潸蕭頩文?敶?????????????????????????????????????????????????????
  '5A': {
    attackInterval: 1200,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playShoot(4);
      game.missiles.push(_makeMissile(p, m, 5, 0, origin));
    },
    drawWeapon(ctx, player, slot) { _drawMissileLauncher(ctx, player, slot); },
  },

  // ?? 6A嚗?? ?2 餈質馱撠? ?????????????????????????????????????????????
  '6A': {
    attackInterval: 1100,
    burstCount: 2,
    burstDelay: 220,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playShoot(4);
      game.missiles.push(_makeMissile(p, m, 6, 0, origin));
    },
    drawWeapon(ctx, player, slot) { _drawMissileLauncher(ctx, player, slot); },
  },

  // ?? 7A嚗?? ?3 餈質馱撠? ?????????????????????????????????????????????
  '7A': {
    attackInterval: 1100,
    burstCount: 3,
    burstDelay: 200,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playShoot(5);
      game.missiles.push(_makeMissile(p, m, 7, 0, origin));
    },
    drawWeapon(ctx, player, slot) { _drawMissileLauncher(ctx, player, slot); },
  },

  // ?? 8A嚗?? ?3 ??敶?0.3s 敺???3 憿?撠?嚗????????????????????
  '8A': {
    attackInterval: 1100,
    burstCount: 3,
    burstDelay: 200,
    fire: () => [],
    fireDirect(game, p, m, origin) {
      audioManager.playShoot(5);
      game.missiles.push(_makeMissile(p, m, 8, 300, origin)); // splitAfter=300ms
    },
    drawWeapon(ctx, player, slot) { _drawMissileLauncher(ctx, player, slot); },
  },
};

function _drawThreeClawArcGun(ctx: CanvasRenderingContext2D, player: Player, level: number, slot?: import('../../Player').WeaponSlot): void {
  ctx.save();
  ctx.imageSmoothingEnabled = true;

  ctx.translate(14, 10);
  ctx.scale(0.4, 0.4);
  ctx.translate(-24, -65);

  const t = Date.now() / 1000;
  const pulse = (Math.sin(t * 8) + 1) / 2;
  const lvlExt = (level - 5) * 5; // ?函?蝝辣?瑞?撠箏站

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

  // 瞍詨惜摰儔
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

  // 1. ?啗??⊥? (Grip)
  poly([24, 58, 45, 58, 40, 94, 18, 94], armorWhite, '#000', 0.2); // 憭挺
  ctx.globalAlpha = 0.9;
  poly([22, 64, 38, 64, 36, 90, 20, 90], frameDark); // ?脫??
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#0f172a'; ctx.fillRect(16, 94, 26, 3); // 摨漣
  ctx.beginPath(); ctx.arc(21, 95.5, 0.6, 0, Math.PI * 2); ctx.fillStyle = goldTrim; ctx.fill(); // ?ˇ暺?

  // 2. ?踵??風??
  ctx.beginPath(); ctx.moveTo(45, 58); ctx.bezierCurveTo(45, 80, 60, 80, 60, 65);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5; ctx.stroke();
  poly([48, 60, 46, 72, 50, 72, 52, 60], goldTrim);

  // 3. 瑽澈銝餅???(Receiver)
  poly([12, 42, 70, 42, 70, 64, 20, 64, 12, 56], frameDark, '#000', 0.3); // 銝惜?嗆?
  poly([15, 40, 65, 40, 65, 54, 18, 54, 15, 48], armorWhite, '#94a3b8', 0.2); // 銝惜鋆
  ctx.globalAlpha = 0.6;
  line(25, 44, 55, 44, '#94a3b8', 0.3);
  line(25, 48, 50, 48, '#94a3b8', 0.3);
  ctx.globalAlpha = 1.0;

  // 璈１?Ｘ?箇結
  ctx.fillStyle = '#334155';
  [20, 24, 60].forEach(x => { ctx.beginPath(); ctx.arc(x, 42, 0.6, 0, Math.PI * 2); ctx.fill(); });

  // 4. 敺蔭?? (Hammer)
  ctx.beginPath(); ctx.moveTo(12, 48); ctx.bezierCurveTo(2, 48, -2, 38, 8, 34); ctx.lineTo(16, 42); ctx.closePath();
  ctx.fillStyle = frameDark; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 0.4; ctx.stroke();
  ctx.beginPath(); ctx.arc(8, 34, 2.5, 0, Math.PI * 2); ctx.fillStyle = goldTrim; ctx.fill();

  // 5. ?賣??詨?閫皜祉? (蝛拙??啗?)
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

  // 6. 蝯勗?撘?撘瑕?瑽恣??????
  const blExt = lvlExt; // Blade extension
  poly([70, 42, 95 + blExt, 42, 105 + blExt, 48, 105 + blExt, 58, 95 + blExt, 64, 70, 64], frameDark, '#000', 0.5); // 瑽恣霅瑟
  ctx.globalAlpha = 0.8; ctx.fillStyle = armorWhite; ctx.fillRect(75, 44, 15 + blExt * 0.5, 16); ctx.globalAlpha = 1.0;

  // 銝? A
  poly([95 + blExt, 42, 125 + blExt, 28, 105 + blExt, 48, 100 + blExt, 46], armorWhite, '#94a3b8', 0.4);
  ctx.lineCap = 'round'; line(100 + blExt, 44, 118 + blExt, 34, goldTrim, 0.8); ctx.lineCap = 'butt';

  // 銝? B
  poly([95 + blExt, 64, 125 + blExt, 78, 105 + blExt, 58, 100 + blExt, 60], armorWhite, '#94a3b8', 0.4);
  ctx.lineCap = 'round'; line(100 + blExt, 62, 118 + blExt, 70, goldTrim, 0.8); ctx.lineCap = 'butt';

  // 銝剖亢撠? C
  poly([85, 53, 135 + blExt, 53, 110 + blExt, 57, 85, 57], '#94a3b8', '#1e293b', 0.4);
  ctx.globalAlpha = 0.9; line(95, 53, 130 + blExt, 53, '#ffffff', 1.2); ctx.globalAlpha = 1.0;

  // 蝛拙??賡?撠?
  ctx.globalAlpha = 0.2; line(65, 53, 120 + blExt, 53, '#7dd3fc', 1.0); ctx.globalAlpha = 1.0;
  ctx.beginPath(); ctx.moveTo(70, 53); ctx.lineTo(110 + blExt, 53);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.4; ctx.globalAlpha = 0.4;
  ctx.setLineDash([3, 6]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1.0;

  // 瑽?暸?望?怠? (?冽??垢?)
  drawMuzzleFlash(ctx, 135 + blExt, 53, slot?.lastAttackTime ?? player.lastAttackTime);

  ctx.restore();
}

function _fireArc(game: Game, p: Player, level: number, damage: number, jumps: number, paralyze: number, origin?: {x: number, y: number, aimAngle: number, muzzleOffset?: {x: number, y: number}}) {
  audioManager.playShoot(5); // 閫貊?餃憫???澆??單?
  const speed = level >= 8 ? 20 : 16;
  const angle = origin?.aimAngle ?? p.aimAngle;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  
  let ox = origin?.x ?? p.x;
  let oy = origin?.y ?? p.y;

  if (origin?.muzzleOffset) {
    const rotatedOffsetX = origin.muzzleOffset.x * Math.cos(angle) - origin.muzzleOffset.y * Math.sin(angle);
    const rotatedOffsetY = origin.muzzleOffset.x * Math.sin(angle) + origin.muzzleOffset.y * Math.cos(angle);
    ox += rotatedOffsetX;
    oy += rotatedOffsetY;
  }
  
  const lifetime = (360 / speed) * (1000 / 60);
  const proj = new ArcProjectile(p.id, level, ox, oy, vx, vy, damage, jumps, paralyze);
  proj.lifetime = lifetime;
  proj.maxLifetime = lifetime;
  game.arcProjectiles.push(proj);
}

const GUN_BRANCH_B: Record<string, IWeaponLevelDef> = {
  '5B': {
    attackInterval: 1800,
    fire: () => [],
    fireDirect(game, p, m, origin) { _fireArc(game, p, 5, 5, 3, 1000, origin); },
    drawWeapon(ctx, player, slot) { _drawThreeClawArcGun(ctx, player, 5, slot); },
  },
  '6B': {
    attackInterval: 1800,
    fire: () => [],
    fireDirect(game, p, m, origin) { _fireArc(game, p, 6, 6, 5, 1200, origin); },
    drawWeapon(ctx, player, slot) { _drawThreeClawArcGun(ctx, player, 6, slot); },
  },
  '7B': {
    attackInterval: 1800,
    fire: () => [],
    fireDirect(game, p, m, origin) { _fireArc(game, p, 7, 7, 8, 1500, origin); },
    drawWeapon(ctx, player, slot) { _drawThreeClawArcGun(ctx, player, 7, slot); },
  },
  '8B': {
    attackInterval: 2000,
    fire: () => [],
    fireDirect(game, p, m, origin) { _fireArc(game, p, 8, 8, 10, 2000, origin); },
    drawWeapon(ctx, player, slot) { _drawThreeClawArcGun(ctx, player, 8, slot); },
  },
};

// ?? ?鞈?嚗策 UpgradePanel 憿舐內?剁?????????????????????????????????????????
export interface IWeaponBranchInfo {
  name: string;
  emoji: string;
  description: string;
}
export const WEAPON_BRANCH_INFO: Record<'sword' | 'gun', Record<'A' | 'B', IWeaponBranchInfo>> = {
  sword: {
    A: { name: '旋刃', emoji: '🗡️', description: '強化直線穿刺與持續輸出' },
    B: { name: '爆裂', emoji: '💥', description: '命中後造成範圍爆發傷害' },
  },
  gun: {
    A: { name: '導彈', emoji: '🚀', description: '追蹤飛彈，重視壓制與區域控場' },
    B: { name: '電漿', emoji: '⚡', description: '電漿彈鏈鎖打擊，偏向清群與控場' },
  },
};

// ?? 蝯曹??駁?銵????????????????????????????????????????????????????????????????
export const WEAPON_REGISTRY: Record<'sword' | 'gun', Record<number | string, IWeaponLevelDef>> = {
  sword: { ...SWORD_LEVELS, ...SWORD_BRANCH_A, ...SWORD_BRANCH_B },
  gun: { ...GUN_LEVELS, ...GUN_BRANCH_A, ...GUN_BRANCH_B },
};

// ?? 甇血蝑??萄潘?靘摰?weaponLevel + branch 閮?嚗??????????????????????????
export function getWeaponKey(
  weapon: 'sword' | 'gun',
  level: number,
  branch: 'A' | 'B' | null,
): number | string {
  if (level >= 5 && branch) return `${level}${branch}`;
  // 瑽蝷??芸 Lv4嚗 Lv5 ?腹嚗??蝷?銋 Lv4嚗v5 ?芣??嚗?
  const maxBase = 4;
  return Math.min(level, maxBase);
}

