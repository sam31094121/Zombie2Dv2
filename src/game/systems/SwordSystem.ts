import type { Game } from '../Game';
import type { Zombie } from '../Zombie';
import { SwordProjectile } from '../entities/SwordProjectile';
import { audioManager } from '../AudioManager';
import { ZOMBIE_REGISTRY } from '../entities/definitions/ZombieDefinitions';
import { ZombieType } from '../types';
import type { ActiveEffect } from '../types';

type LavaMarkConfig = {
  level: number;
  radius: number;
  tickDamage: number;
  tickInterval: number;
  embedDuration: number;
  explodeDamage: number;
  explodeRadius: number;
};

const ALTAR_SWORD_LAVA_CONFIG: LavaMarkConfig = {
  level: 6,
  radius: 20,
  tickDamage: 2,
  tickInterval: 200,
  embedDuration: 350,
  explodeDamage: 35,
  explodeRadius: 140,
};

export function updateSwordProjectiles(
  swords: SwordProjectile[],
  game: Game,
  dt: number,
): void {
  for (const sword of swords) {
    if (sword.isDone) continue;

    if (sword.branch === 'A') {
      sword.visualAngle += dt * (Math.PI * 0.6 / 1000);
    }

    switch (sword.state) {
      case 'going_out':
        _goingOut(sword, game, dt);
        break;
      case 'returning':
        _returning(sword, game, dt);
        break;
    }
  }

  for (let i = swords.length - 1; i >= 0; i--) {
    if (swords[i].isDone) swords.splice(i, 1);
  }
}

function _recordTrail(sword: SwordProjectile): void {
  if (sword.branch !== 'base' || sword.level !== 4) return;
  const now = Date.now();
  const last = sword.trail[sword.trail.length - 1];
  if (!last || Math.hypot(sword.x - last.x, sword.y - last.y) >= 1) {
    sword.trail.push({ x: sword.x, y: sword.y, angle: sword.angle, t: now });
  }
  const cutoff = now - 800;
  while (sword.trail.length > 0 && sword.trail[0].t < cutoff) sword.trail.shift();
}

function _goingOut(sword: SwordProjectile, game: Game, dt: number): void {
  const { config } = sword;

  sword.x += Math.cos(sword.angle) * config.speed * dt;
  sword.y += Math.sin(sword.angle) * config.speed * dt;
  _recordTrail(sword);
  _tryHitSwordObstacles(sword, game);

  for (const z of game.zombies) {
    const dist = Math.hypot(z.x - sword.x, z.y - sword.y);
    if (dist >= config.passRadius + z.radius) continue;

    if (sword.branch === 'B') {
      if (!sword.hitZombieIds.has(z.id)) {
        sword.hitZombieIds.add(z.id);
        z.hp -= config.damage * config.dmgMult;
        _queueKill(game, z, sword.ownerId, sword.level, sword.angle);
        _pushForward(sword, z, 26);
        audioManager.playHit();
        game.hitEffects.push({ x: z.x, y: z.y, type: 'red_blood', lifetime: 300, maxLifetime: 300 });
        game.hitStopTimer = 30;

        const travelDist = Math.hypot(sword.x - sword.originX, sword.y - sword.originY);
        _deployLavaMark(sword, game, z.id, travelDist);

        _startReturning(sword, travelDist);
        return;
      }
    } else {
      if (!sword.hitZombieIds.has(z.id)) {
        sword.hitZombieIds.add(z.id);
        z.hp -= config.damage * config.dmgMult;
        _queueKill(game, z, sword.ownerId, sword.level, sword.angle);
        _pushForward(sword, z, 26);
        audioManager.playHit();
        if (sword.branch === 'base' && sword.level >= 1 && sword.level <= 4) {
          game.hitEffects.push({
            x: z.x,
            y: z.y,
            type: 'wolf_claw_red',
            lifetime: 800,
            maxLifetime: 800,
            angle: -0.72,
            size: 0.96 + sword.level * 0.08,
            seed: z.id * 13 + sword.level * 101,
            followZombieId: z.id,
          });
        } else {
          const fx = sword.branch === 'A' ? 'purple_particles' : 'grey_sparks';
          const lt = sword.branch === 'A' ? 300 : 180;
          game.hitEffects.push({ x: z.x, y: z.y, type: fx, lifetime: lt, maxLifetime: lt });
        }

        _tryProcAltarLavaMark(sword, game, z.id);
      }
    }
  }

  const travelled = Math.hypot(sword.x - sword.originX, sword.y - sword.originY);
  if (travelled >= config.maxRange) {
    if (sword.branch === 'A') {
      _deployTornado(sword, game);
    }
    sword.hitZombieIds.clear();
    sword.hitObstacleKeys.clear();
    _startReturning(sword, config.maxRange);
    if (sword.branch === 'base') {
      sword.state = 'returning';
    }
  }
}

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

  sword.returnTimer = Math.max(sword.returnTimer - dt, dt);
  const returnSpeed = dist / sword.returnTimer;

  if (sword.branch === 'base') {
    sword.x += (dx / dist) * returnSpeed * dt;
    sword.y += (dy / dist) * returnSpeed * dt;
    _recordTrail(sword);
    return;
  }

  sword.angle = Math.atan2(dy, dx);
  sword.x += Math.cos(sword.angle) * returnSpeed * dt;
  sword.y += Math.sin(sword.angle) * returnSpeed * dt;

  if (sword.branch === 'A') {
    _tryHitSwordObstacles(sword, game);
    for (const z of game.zombies) {
      if (sword.hitZombieIds.has(z.id)) continue;
      const zdist = Math.hypot(z.x - sword.x, z.y - sword.y);
      if (zdist < config.passRadius + z.radius) {
        sword.hitZombieIds.add(z.id);
        z.hp -= config.damage * config.dmgMult;
        _queueKill(game, z, sword.ownerId, sword.level, sword.angle);
        audioManager.playHit();
        game.hitEffects.push({ x: z.x, y: z.y, type: 'purple_particles', lifetime: 300, maxLifetime: 300 });
      }
    }
  }
}

function _startReturning(sword: SwordProjectile, travelDist: number): void {
  const outTime = travelDist / sword.config.speed;
  const budget = sword.config.attackInterval - outTime - 100;
  sword.returnTimer = Math.max(150, budget);
  sword.state = 'returning';
}

function _tryHitSwordObstacles(sword: SwordProjectile, game: Game): void {
  const nearby = game.mapManager.getNearbyObstacles(sword.x, sword.y);
  const SWORD_DAMAGEABLE: Set<string> = new Set(['tombstone', 'vending_machine', 'sandbag', 'explosive_barrel', 'monolith']);
  for (const obs of nearby) {
    if (obs.isDestroyed || !SWORD_DAMAGEABLE.has(obs.type)) continue;
    if (!obs.collidesWithCircle(sword.x, sword.y, sword.config.passRadius)) continue;

    const hitKey = `${obs.type}:${obs.x}:${obs.y}:${obs.seed}`;
    if (sword.hitObstacleKeys.has(hitKey)) continue;
    sword.hitObstacleKeys.add(hitKey);

    if (obs.type === 'monolith') {
      game.chargeMonolith(obs, sword.config.damage * sword.config.dmgMult, sword.ownerId, sword.x, sword.y);
      audioManager.playHit();
      continue;
    }

    obs.takeDamage(sword.config.damage * sword.config.dmgMult);
    game.hitEffects.push({
      x: obs.x + obs.width / 2,
      y: obs.y + obs.height / 2,
      type: sword.branch === 'A' ? 'purple_particles' : 'grey_sparks',
      lifetime: sword.branch === 'A' ? 300 : 220,
      maxLifetime: sword.branch === 'A' ? 300 : 220,
    });
    audioManager.playHit();
  }
}

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

function _deployLavaMark(sword: SwordProjectile, game: Game, zombieId: number, _travelDist: number): void {
  const { config } = sword;
  _pushLavaMark(game, sword, zombieId, {
    level: sword.level,
    radius: 20,
    tickDamage: 2,
    tickInterval: 200,
    embedDuration: config.embedDuration,
    explodeDamage: config.explodeDamage,
    explodeRadius: config.explodeRadius,
  });
}

function _clearSwordOut(game: Game, ownerId: number): void {
  const player = game.players.find(p => p.id === ownerId);
  if (player) (player as any)._swordOut = false;
}

function _queueKill(game: Game, z: Zombie, ownerId: number, level: number, hitAngle?: number): void {
  if (z.hp <= 0) game.queueZombieDeath(z, ownerId, level, hitAngle);
}

function _knockbackMult(z: { type: string }): number {
  const def = ZOMBIE_REGISTRY[z.type as ZombieType];
  const resistLevel = def?.knockbackResistLevel ?? 0;
  return 1 - resistLevel / 10;
}

function _pushForward(
  sword: SwordProjectile,
  z: { vx: number; vy: number; type: string },
  force: number,
): void {
  z.vx += Math.cos(sword.angle) * force * _knockbackMult(z);
  z.vy += Math.sin(sword.angle) * force * _knockbackMult(z);
}

function _tryProcAltarLavaMark(
  sword: SwordProjectile,
  game: Game,
  zombieId: number,
): void {
  if (sword.altarProcConsumed || sword.branch === 'B') return;

  const owner = game.players.find(player => player.id === sword.ownerId);
  if (!owner?.isAtAltar) return;

  sword.altarProcConsumed = true;
  _pushLavaMark(game, sword, zombieId, ALTAR_SWORD_LAVA_CONFIG);
}

function _pushLavaMark(
  game: Game,
  sword: SwordProjectile,
  zombieId: number,
  baseConfig: LavaMarkConfig,
): void {
  const effect = _createLavaMarkEffect(game, sword, zombieId, baseConfig);
  game.activeEffects.push(effect);
}

function _createLavaMarkEffect(
  game: Game,
  sword: SwordProjectile,
  zombieId: number,
  baseConfig: LavaMarkConfig,
): ActiveEffect {
  const config = _resolveLavaMarkConfig(game, sword, baseConfig);

  return {
    type: 'lava_mark',
    x: sword.x,
    y: sword.y,
    radius: config.radius,
    lifetime: config.embedDuration,
    maxLifetime: config.embedDuration,
    damage: config.tickDamage * sword.config.dmgMult,
    tickInterval: config.tickInterval,
    tickTimer: config.tickInterval,
    ownerId: sword.ownerId,
    level: config.level,
    targetZombieId: zombieId,
    explodeRadius: config.explodeRadius,
    explodeDamage: config.explodeDamage * sword.config.dmgMult,
  };
}

function _resolveLavaMarkConfig(
  game: Game,
  sword: SwordProjectile,
  baseConfig: LavaMarkConfig,
): LavaMarkConfig {
  const owner = game.players.find(player => player.id === sword.ownerId);
  if (!owner?.isAtAltar) return baseConfig;

  return {
    level: Math.max(baseConfig.level, ALTAR_SWORD_LAVA_CONFIG.level),
    radius: Math.max(baseConfig.radius, ALTAR_SWORD_LAVA_CONFIG.radius),
    tickDamage: ALTAR_SWORD_LAVA_CONFIG.tickDamage,
    tickInterval: ALTAR_SWORD_LAVA_CONFIG.tickInterval,
    embedDuration: Math.max(baseConfig.embedDuration, ALTAR_SWORD_LAVA_CONFIG.embedDuration),
    explodeDamage: Math.max(baseConfig.explodeDamage, ALTAR_SWORD_LAVA_CONFIG.explodeDamage),
    explodeRadius: Math.max(baseConfig.explodeRadius, ALTAR_SWORD_LAVA_CONFIG.explodeRadius),
  };
}
