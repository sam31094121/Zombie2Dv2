import type { Game } from '../Game';
import type { Obstacle } from '../map/Obstacle';
import { spawnZombieAt } from './SpawnSystem';
import { CONSTANTS } from '../Constants';

const SUMMON_COUNT = 10;
const SUMMON_RADIUS = 70;
const SCREEN_MARGIN = 80;
const GHOST_COOLDOWN_MS = 5000; // wait after all ghosts die before next wave

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
    if (game.mode === 'arena' && !obs.isArenaWaveObstacle) return false;
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

export function updateTombstones(game: Game, dt: number): void {
  if (game.mode !== 'arena') return;

  const tombstones = getVisibleTombstones(game);
  for (const tombstone of tombstones) {
    // --- Phase 1: prune dead ghosts from tracked set ---
    if (tombstone.spawnedGhostIds.size > 0) {
      for (const id of tombstone.spawnedGhostIds) {
        const z = game.zombies.find(z => z.id === id);
        if (!z || z.hp <= 0) tombstone.spawnedGhostIds.delete(id);
      }
      // All ghosts just cleared → start cooldown
      if (tombstone.spawnedGhostIds.size === 0 && tombstone.tombstoneCooldown <= 0) {
        tombstone.tombstoneCooldown = GHOST_COOLDOWN_MS;
      }
    }

    // --- Phase 2: cooldown countdown ---
    if (tombstone.tombstoneCooldown > 0) {
      tombstone.tombstoneCooldown -= dt;
      continue; // not ready yet
    }

    // --- Phase 3: summon timer ---
    tombstone.tombstoneSummonTimer -= dt;
    if (tombstone.tombstoneSummonTimer > 0) continue;

    // Only summon if no active ghosts currently alive
    if (tombstone.spawnedGhostIds.size > 0) continue;

    tombstone.tombstoneSummonTimer = 3000;
    const center = getTombstoneCenter(tombstone);

    // Spawn ghosts directly and track their IDs (so we can detect when all die)
    for (let i = 0; i < SUMMON_COUNT; i++) {
      const angle = (i / SUMMON_COUNT) * Math.PI * 2 + Math.random() * 0.35;
      const radius = 18 + Math.random() * SUMMON_RADIUS;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;
      const ghost = spawnZombieAt(game, x, y, 'ghost');
      tombstone.spawnedGhostIds.add(ghost.id);
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
