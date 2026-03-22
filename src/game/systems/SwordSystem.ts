// ── SwordSystem.ts ────────────────────────────────────────────────────────────
// 所有分支統一：飛出 → (部署效果) → 動態速度回程
//
// base  (Lv1-4): going_out → returning（回程純動畫無交互）
// Branch A (旋風流): going_out → 部署龍捲風到 activeEffects → returning（回程可打）
// Branch B (審判流): going_out → 刺中時部署岩漿到 activeEffects → returning（回程無交互）
//
// 回程速度公式：
//   returnBudget = attackInterval - (travelDist / speed) - 100ms hold
//   returnSpeed  = currentDist / returnTimer  (每幀動態計算)
// ─────────────────────────────────────────────────────────────────────────────
import type { Game } from '../Game';
import type { Zombie } from '../Zombie';
import { SwordProjectile } from '../entities/SwordProjectile';
import { audioManager } from '../AudioManager';
import { ZOMBIE_REGISTRY } from '../entities/definitions/ZombieDefinitions';
import { ZombieType } from '../types';
import type { ActiveEffect } from '../types';

export function updateSwordProjectiles(
  swords: SwordProjectile[],
  game: Game,
  dt: number,
): void {
  for (const sword of swords) {
    if (sword.isDone) continue;

    // Branch A：0.3 rps = 0.6π/1000 rad/ms；Branch B 不旋轉（直線刺，不需要此值）
    if (sword.branch === 'A') sword.visualAngle += dt * (Math.PI * 0.6 / 1000);

    switch (sword.state) {
      case 'going_out': _goingOut(sword, game, dt); break;
      case 'returning': _returning(sword, game, dt); break;
    }
  }

  for (let i = swords.length - 1; i >= 0; i--) {
    if (swords[i].isDone) swords.splice(i, 1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// going_out
// ─────────────────────────────────────────────────────────────────────────────
function _recordTrail(sword: SwordProjectile): void {
  if (sword.branch !== 'base' || sword.level !== 4) return;
  const now = Date.now();
  const last = sword.trail[sword.trail.length - 1];
  // 每移動 3px 才記錄一次，避免過密
  if (!last || Math.hypot(sword.x - last.x, sword.y - last.y) >= 1) {
    sword.trail.push({ x: sword.x, y: sword.y, angle: sword.angle, t: now });
  }
  // 只保留 800ms 內的軌跡
  const cutoff = now - 800;
  while (sword.trail.length > 0 && sword.trail[0].t < cutoff) sword.trail.shift();
}

function _goingOut(sword: SwordProjectile, game: Game, dt: number): void {
  const { config } = sword;

  sword.x += Math.cos(sword.angle) * config.speed * dt;
  sword.y += Math.sin(sword.angle) * config.speed * dt;
  _recordTrail(sword);

  for (const z of game.zombies) {
    const dist = Math.hypot(z.x - sword.x, z.y - sword.y);
    if (dist >= config.passRadius + z.radius) continue;

    if (sword.branch === 'B') {
      // ── 審判流：刺中第一隻 → 部署岩漿標記 → 立刻回飛 ──────────────────
      if (!sword.hitZombieIds.has(z.id)) {
        sword.hitZombieIds.add(z.id);
        z.hp -= config.damage * config.dmgMult;
        _queueKill(game, z, sword.ownerId, sword.level);
        _pushForward(sword, z, 26);
        audioManager.playHit();
        game.hitEffects.push({ x: z.x, y: z.y, type: 'red_blood', lifetime: 300, maxLifetime: 300 });
        game.hitStopTimer = 30;

        // 部署岩漿標記（跟著這隻怪）
        const travelDist = Math.hypot(sword.x - sword.originX, sword.y - sword.originY);
        _deployLavaMark(sword, game, z.id, travelDist);

        _startReturning(sword, travelDist);
        return;
      }

    } else {
      // ── base / Branch A：穿透，每隻打一次 ─────────────────────────────────
      if (!sword.hitZombieIds.has(z.id)) {
        sword.hitZombieIds.add(z.id);
        z.hp -= config.damage * config.dmgMult;
        _queueKill(game, z, sword.ownerId, sword.level);
        _pushForward(sword, z, 26);
        audioManager.playHit();
        const fx = sword.branch === 'A' ? 'purple_particles' : 'grey_sparks';
        const lt = sword.branch === 'A' ? 300 : 180;
        game.hitEffects.push({ x: z.x, y: z.y, type: fx, lifetime: lt, maxLifetime: lt });
      }
    }
  }

  // 到達最遠距離
  const travelled = Math.hypot(sword.x - sword.originX, sword.y - sword.originY);
  if (travelled >= config.maxRange) {
    if (sword.branch === 'A') {
      // 部署龍捲風（固定位置），立刻回飛
      _deployTornado(sword, game);
    } else if (sword.branch === 'B') {
      // 空揮：直接回飛，不部署岩漿
    }
    // base / A / B 空揮 → 轉入 returning
    sword.hitZombieIds.clear();
    _startReturning(sword, config.maxRange);
    if (sword.branch === 'base') {
      sword.state = 'returning'; // pure animation, no combat
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// returning（所有分支統一：動態速度飛回玩家）
// base：純動畫，不傷怪
// Branch A：回程可繼續打
// Branch B：回程不傷怪
// ─────────────────────────────────────────────────────────────────────────────
function _returning(sword: SwordProjectile, game: Game, dt: number): void {
  const { config } = sword;

  const player = game.players.find(p => p.id === sword.ownerId);
  if (!player || player.hp <= 0) {
    _clearSwordOut(game, sword.ownerId);
    sword.isDone = true;
    return;
  }

  const dx = player.x - sword.x;
  const dy = player.y - sword.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 20) {
    _clearSwordOut(game, sword.ownerId);
    sword.isDone = true;
    return;
  }

  // 動態回程速度：確保在 returnTimer 內到達玩家
  sword.returnTimer = Math.max(sword.returnTimer - dt, dt);
  const returnSpeed = dist / sword.returnTimer;

  if (sword.branch === 'base') {
    // 刀保持原始角度（刀尖朝前飛回）
    sword.x += (dx / dist) * returnSpeed * dt;
    sword.y += (dy / dist) * returnSpeed * dt;
    _recordTrail(sword);
    return;
  }

  // Branch A / B：刀頭轉向玩家
  sword.angle = Math.atan2(dy, dx);
  sword.x += Math.cos(sword.angle) * returnSpeed * dt;
  sword.y += Math.sin(sword.angle) * returnSpeed * dt;

  // Branch A 回程：繼續打
  if (sword.branch === 'A') {
    for (const z of game.zombies) {
      if (sword.hitZombieIds.has(z.id)) continue;
      const zdist = Math.hypot(z.x - sword.x, z.y - sword.y);
      if (zdist < config.passRadius + z.radius) {
        sword.hitZombieIds.add(z.id);
        z.hp -= config.damage * config.dmgMult;
        _queueKill(game, z, sword.ownerId, sword.level);
        _knockbackFrom(sword.x, sword.y, z, 26);
        audioManager.playHit();
        game.hitEffects.push({ x: z.x, y: z.y, type: 'purple_particles', lifetime: 300, maxLifetime: 300 });
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 輔助：計算 returnTimer 並轉入 returning
// ─────────────────────────────────────────────────────────────────────────────
function _startReturning(sword: SwordProjectile, travelDist: number): void {
  const outTime = travelDist / sword.config.speed;
  const budget = sword.config.attackInterval - outTime - 100; // 100ms hold
  sword.returnTimer = Math.max(150, budget); // 至少 150ms 回程
  sword.state = 'returning';
}

// ─────────────────────────────────────────────────────────────────────────────
// 部署龍捲風（Branch A）
// ─────────────────────────────────────────────────────────────────────────────
function _deployTornado(sword: SwordProjectile, game: Game): void {
  const { config } = sword;
  const effect: ActiveEffect = {
    type: 'tornado',
    x: sword.x,
    y: sword.y,
    radius: config.spinRadius,
    lifetime: config.spinDuration,
    maxLifetime: config.spinDuration,
    damage: config.spinDamage * config.dmgMult,
    tickInterval: config.spinTickMs,
    tickTimer: config.spinTickMs,
    ownerId: sword.ownerId,
    level: sword.level,
  };
  game.activeEffects.push(effect);
  audioManager.playSlash(4);
}

// ─────────────────────────────────────────────────────────────────────────────
// 部署岩漿標記（Branch B 刺中）
// ─────────────────────────────────────────────────────────────────────────────
function _deployLavaMark(sword: SwordProjectile, game: Game, zombieId: number, _travelDist: number): void {
  const { config } = sword;
  const effect: ActiveEffect = {
    type: 'lava_mark',
    x: sword.x,
    y: sword.y,
    radius: 20,
    lifetime: config.embedDuration,
    maxLifetime: config.embedDuration,
    damage: 2 * config.dmgMult,   // 持續灼傷
    tickInterval: 200,
    tickTimer: 200,
    ownerId: sword.ownerId,
    level: sword.level,
    targetZombieId: zombieId,
    explodeRadius: config.explodeRadius,
    explodeDamage: config.explodeDamage * config.dmgMult,
  };
  game.activeEffects.push(effect);
}

// ─────────────────────────────────────────────────────────────────────────────
// 輔助：清除「刀已丟出」旗標
// ─────────────────────────────────────────────────────────────────────────────
function _clearSwordOut(game: Game, ownerId: number): void {
  const player = game.players.find(p => p.id === ownerId);
  if (player) (player as any)._swordOut = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 擊殺佇列輔助
// ─────────────────────────────────────────────────────────────────────────────
function _queueKill(game: Game, z: Zombie, ownerId: number, level: number): void {
  if (z.hp <= 0 && !game.pendingSwordKills.has(z)) {
    game.pendingSwordKills.set(z, { ownerId, level });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 擊退輔助
// ─────────────────────────────────────────────────────────────────────────────

/** 統一擊退乘數：從 ZOMBIE_REGISTRY 讀取 knockbackResistLevel */
function _knockbackMult(z: { type: string }): number {
  const def = ZOMBIE_REGISTRY[z.type as ZombieType];
  const resistLevel = def?.knockbackResistLevel ?? 0;
  return 1 - resistLevel / 10;
}

/** 沿突刺方向施加固定衝擊力 */
function _pushForward(
  sword: SwordProjectile,
  z: { vx: number; vy: number; type: string },
  force: number,
): void {
  z.vx += Math.cos(sword.angle) * force * _knockbackMult(z);
  z.vy += Math.sin(sword.angle) * force * _knockbackMult(z);
}

/** 從指定座標向外推 */
function _knockbackFrom(
  ox: number, oy: number,
  z: { x: number; y: number; vx: number; vy: number; type: string },
  force = 4,
): void {
  const dx = z.x - ox;
  const dy = z.y - oy;
  const dist = Math.hypot(dx, dy) || 1;
  z.vx += (dx / dist) * force * _knockbackMult(z);
  z.vy += (dy / dist) * force * _knockbackMult(z);
}
