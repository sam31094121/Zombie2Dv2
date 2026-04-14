import type { Game } from '../Game';
import { MissileProjectile } from '../entities/MissileProjectile';

export function updateMissiles(missiles: MissileProjectile[], game: Game, dt: number): void {
  const toSpawn: MissileProjectile[] = [];

  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    if (!m.alive) { missiles.splice(i, 1); continue; }

    m.lifetime -= dt;
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

    if (nearest) {
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

    const obs = game.mapManager.getNearbyObstacles(m.x, m.y);
    let hitWall = false;
    for (const o of obs) {
      if (!o.isDestroyed && o.collidesWithCircle(m.x, m.y, m.radius)) {
        hitWall = true;
        break;
      }
    }

    if (hitWall) {
      _onImpact(m, game, null);
      missiles.splice(i, 1);
      continue;
    }

    let hit = false;
    for (const z of game.zombies) {
      if (z.hp <= 0) continue;
      if (Math.hypot(z.x - m.x, z.y - m.y) < z.radius + m.radius) {
        z.hp -= m.damage;
        z.flashWhiteTimer = 100;
        if (z.hp <= 0) {
          game.queueZombieDeath(z, m.ownerId, 5, Math.atan2(m.vy, m.vx));
        }
        _onImpact(m, game, z);
        hit = true;
        break;
      }
    }

    if (hit) {
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
