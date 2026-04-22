import type { Game } from '../Game';
import { MissileProjectile } from '../entities/MissileProjectile';

export function updateMissiles(missiles: MissileProjectile[], game: Game, dt: number): void {
  const toSpawn: MissileProjectile[] = [];

  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    if (!m.alive) { missiles.splice(i, 1); continue; }

    m.lifetime -= dt;
    m.homingDelayTimer = Math.max(0, m.homingDelayTimer - dt);
    m.obstacleGraceTimer = Math.max(0, m.obstacleGraceTimer - dt);
    if (m.lifetime <= 0) { missiles.splice(i, 1); continue; }

    if (!m.isSmall && m.splitAfter > 0) {
      m.splitTimer -= dt;
      if (m.splitTimer <= 0) {
        _spawnSplitMissiles(m, toSpawn, game);
        missiles.splice(i, 1);
        continue;
      }
    }

    let nearest: (typeof game.zombies[0]) | null = null;
    let nearestDist = 700;
    for (const z of game.zombies) {
      if (z.hp <= 0) continue;
      const d = Math.hypot(z.x - m.x, z.y - m.y);
      if (d < nearestDist) { nearestDist = d; nearest = z; }
    }

    if (nearest && m.homingDelayTimer <= 0) {
      const cur = Math.atan2(m.vy, m.vx);
      const tgt = Math.atan2(nearest.y - m.y, nearest.x - m.x);
      let diff = tgt - cur;
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      const maxT = m.turnSpeed * dt;
      const turn = Math.max(-maxT, Math.min(maxT, diff));
      const newA = cur + turn;
      m.vx = Math.cos(newA) * m.speed;
      m.vy = Math.sin(newA) * m.speed;
    }

    m.x += m.vx * (dt / 16);
    m.y += m.vy * (dt / 16);

    let hitWall = false;
    if (m.obstacleGraceTimer <= 0) {
      const obs = game.mapManager.getNearbyObstacles(m.x, m.y);
      for (const o of obs) {
        if (!o.isDestroyed && o.collidesWithCircle(m.x, m.y, m.radius)) {
          hitWall = true;
          break;
        }
      }
    }

    if (hitWall) {
      _onImpact(m, game, null);
      missiles.splice(i, 1);
      continue;
    }

    let destroyed = false;
    for (const z of game.zombies) {
      if (z.hp <= 0) continue;
      if (Math.hypot(z.x - m.x, z.y - m.y) < z.radius + m.radius) {
        z.hp -= m.damage;
        z.flashWhiteTimer = 100;
        if (z.hp <= 0) {
          game.queueZombieDeath(z, m.ownerId, 5, Math.atan2(m.vy, m.vx));
        }
        m.pierceRemaining--;
        if (m.pierceRemaining <= 0) {
          _onImpact(m, game, z);
          destroyed = true;
          break;
        }
        // Pierced — flash effect but missile continues
        if (m.variant === 'energy') {
          _spawnEnergyImpactEffects(game, z.x, z.y, false);
        } else {
          game.hitEffects.push({ x: z.x, y: z.y, type: 'white_sparks', lifetime: 150, maxLifetime: 150 });
        }
      }
    }

    if (destroyed) {
      missiles.splice(i, 1);
      continue;
    }
  }

  for (const m of toSpawn) missiles.push(m);
}

function _onImpact(
  m: MissileProjectile,
  game: Game,
  _zombie: (typeof game.zombies[0]) | null,
): void {
  if (m.variant === 'energy') {
    _applySplashDamage(game, m.x, m.y, m.splashRadius, m.damage, m.ownerId, _zombie);
    _spawnEnergyImpactEffects(game, m.x, m.y, true);
    return;
  }
  game.activeEffects.push({
    type: 'ground_fire',
    x: m.x,
    y: m.y,
    radius: m.groundFireRadius,
    lifetime: m.groundFireDuration,
    maxLifetime: m.groundFireDuration,
    damage: 2,
    tickInterval: 500,
    tickTimer: 500,
    ownerId: m.ownerId,
    level: 5,
  });
}

function _spawnSplitMissiles(
  parent: MissileProjectile,
  out: MissileProjectile[],
  game: Game,
): void {
  const base = Math.atan2(parent.vy, parent.vx);
  const SPREAD = Math.PI / 6;
  const SPLIT_MAX_RANGE = 420;

  for (let i = -1; i <= 1; i++) {
    const child = new MissileProjectile({
      ownerId: parent.ownerId,
      x: parent.x,
      y: parent.y,
      angle: base + i * SPREAD,
      damage: 1,
      speed: parent.speed * 1.15,
      turnSpeed: parent.turnSpeed * 1.5,
      radius: 7,
      isSmall: true,
      splitAfter: 0,
      groundFireRadius: parent.groundFireRadius * 0.65,
      groundFireDuration: parent.groundFireDuration * 0.7,
      variant: parent.variant,
      homingDelayMs: parent.homingDelayTimer,
      obstacleGraceMs: parent.obstacleGraceTimer,
      splashRadius: parent.splashRadius * 0.75,
    });

    const childLifetime = (SPLIT_MAX_RANGE / child.speed) * (1000 / 60);
    child.lifetime = childLifetime;
    child.maxLifetime = childLifetime;
    out.push(child);
  }

  game.hitEffects.push({
    x: parent.x,
    y: parent.y,
    type: 'white_sparks',
    lifetime: 250,
    maxLifetime: 250,
  });
}

function _applySplashDamage(
  game: Game,
  x: number,
  y: number,
  radius: number,
  baseDamage: number,
  ownerId: number,
  directTarget: (typeof game.zombies[0]) | null,
): void {
  if (radius <= 0) return;

  for (const zombie of game.zombies) {
    if (zombie.hp <= 0 || zombie === directTarget) continue;

    const dist = Math.hypot(zombie.x - x, zombie.y - y);
    if (dist >= radius) continue;

    const splashDamage = Math.max(1, baseDamage * 0.45 * (1 - dist / radius));
    zombie.hp -= splashDamage;
    zombie.flashWhiteTimer = Math.max(zombie.flashWhiteTimer, 70);
    if (zombie.hp <= 0) {
      game.queueZombieDeath(zombie, ownerId, 5, Math.atan2(zombie.y - y, zombie.x - x));
    }
  }
}

function _spawnEnergyImpactEffects(
  game: Game,
  x: number,
  y: number,
  isLargeBurst: boolean,
): void {
  game.hitEffects.push({
    x,
    y,
    type: 'blue_circle',
    lifetime: isLargeBurst ? 260 : 150,
    maxLifetime: isLargeBurst ? 260 : 150,
  });
  game.hitEffects.push({
    x,
    y,
    type: 'white_sparks',
    lifetime: isLargeBurst ? 260 : 140,
    maxLifetime: isLargeBurst ? 260 : 140,
  });
  game.hitEffects.push({
    x,
    y,
    type: 'green_electricity',
    lifetime: isLargeBurst ? 220 : 140,
    maxLifetime: isLargeBurst ? 220 : 140,
  });

  const sparkCount = isLargeBurst ? 6 : 3;
  for (let i = 0; i < sparkCount; i++) {
    const angle = (i / sparkCount) * Math.PI * 2 + Math.random() * 0.5;
    const distance = isLargeBurst ? 10 + Math.random() * 16 : 4 + Math.random() * 8;
    game.hitEffects.push({
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      type: 'arc_spark',
      lifetime: isLargeBurst ? 180 : 120,
      maxLifetime: isLargeBurst ? 180 : 120,
      radius: isLargeBurst ? 2.5 : 2,
    });
  }
}
