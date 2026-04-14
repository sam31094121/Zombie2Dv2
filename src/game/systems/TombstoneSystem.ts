import type { Game } from '../Game';
import type { Obstacle } from '../map/Obstacle';
import type { ZombieType } from '../types';
import { CONSTANTS } from '../Constants';

const SUMMON_INTERVAL_MS = 3000;
const SUMMON_COUNT = 10;
const SUMMON_RADIUS = 70;
const SCREEN_MARGIN = 80;

export interface TombstoneTarget {
  obstacle: Obstacle;
  x: number;
  y: number;
}

export function getTombstoneCenter(obs: Obstacle) {
  return {
    x: obs.x + obs.width / 2,
    y: obs.y + obs.height / 2,
  };
}

export function isActiveTombstone(obs: Obstacle): boolean {
  return obs.type === 'tombstone' && !obs.isDestroyed;
}

export function getVisibleTombstones(game: Game): Obstacle[] {
  const nearby = game.mapManager.getNearbyObstacles(
    game.camera.x + CONSTANTS.CANVAS_WIDTH / 2,
    game.camera.y + CONSTANTS.CANVAS_HEIGHT / 2,
  );

  const left = game.camera.x - SCREEN_MARGIN;
  const top = game.camera.y - SCREEN_MARGIN;
  const right = game.camera.x + CONSTANTS.CANVAS_WIDTH + SCREEN_MARGIN;
  const bottom = game.camera.y + CONSTANTS.CANVAS_HEIGHT + SCREEN_MARGIN;

  return nearby.filter(obs => {
    if (!isActiveTombstone(obs)) return false;
    const c = getTombstoneCenter(obs);
    return c.x >= left && c.x <= right && c.y >= top && c.y <= bottom;
  });
}

export function findNearestTombstoneTarget(game: Game, x: number, y: number, maxDist: number): TombstoneTarget | null {
  const candidates = getVisibleTombstones(game);
  let best: TombstoneTarget | null = null;
  let bestDist = maxDist;
  for (const obstacle of candidates) {
    const center = getTombstoneCenter(obstacle);
    const dist = Math.hypot(center.x - x, center.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = { obstacle, x: center.x, y: center.y };
    }
  }
  return best;
}

function queueSummon(game: Game, x: number, y: number, zombieType: ZombieType = 'ghost') {
  game.activeEffects.push({
    type: 'spawn_warning',
    x,
    y,
    radius: 24,
    lifetime: 650,
    maxLifetime: 650,
    damage: 0,
    tickInterval: 650,
    tickTimer: 650,
    ownerId: 0,
    level: 1,
    zombieType,
  });
}

export function updateTombstones(game: Game, dt: number): void {
  if (game.mode !== 'arena') return;

  const tombstones = getVisibleTombstones(game);
  for (const tombstone of tombstones) {
    tombstone.tombstoneSummonTimer -= dt;
    if (tombstone.tombstoneSummonTimer > 0) continue;

    tombstone.tombstoneSummonTimer += SUMMON_INTERVAL_MS;
    const center = getTombstoneCenter(tombstone);

    for (let i = 0; i < SUMMON_COUNT; i++) {
      const angle = (i / SUMMON_COUNT) * Math.PI * 2 + Math.random() * 0.35;
      const radius = 18 + Math.random() * SUMMON_RADIUS;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;
      queueSummon(game, x, y, 'ghost');
    }

    game.hitEffects.push({
      x: center.x,
      y: center.y,
      type: 'purple_particles',
      lifetime: 600,
      maxLifetime: 600,
      startTime: Date.now(),
      radius: 28,
    });
  }
}

