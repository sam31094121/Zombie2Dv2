import type { Game } from '../Game';
import { ZOMBIE_REGISTRY } from '../entities/definitions/ZombieDefinitions';
import type { ZombieType } from '../Zombie';

type PressureState = {
  rampProgress: number;
  targetCap: number;
  maxCommitPerTick: number;
  maxUnitWeight: number;
  allowSpitter: boolean;
};

export class DirectorAI {
  private game: Game;
  private directorTimer: number = 0;
  private isSpawningPhase: boolean = true;
  private readonly TICK_RATE = 500;
  private readonly OPENING_PRESSURE_RATIO = 0.2;
  private readonly MID_WAVE_PRESSURE_RATIO = 0.5;
  private readonly INITIAL_TICK_RATIO = 0.5;
  private readonly SPITTER_UNLOCK_MS = 1500;
  private readonly HEAVY_UNIT_UNLOCK_MS = 3000;
  private readonly OBJECTIVE_VIRTUAL_DURATION_MS = 30000;
  private readonly SPAWN_PADDING = 120;
  private readonly SPAWN_SAFE_RADIUS = 220;

  constructor(game: Game) {
    this.game = game;
  }

  public update(dt: number) {
    if (this.game.waveManager.isTransitioning || this.game.waveManager.isResting) return;
    if (this.game.mode !== 'arena') return;

    this.directorTimer += dt;
    if (this.directorTimer >= this.TICK_RATE) {
      this.directorTimer -= this.TICK_RATE;
      this.evaluateAndSpawn();
    }

    this.processAutoDespawn();
  }

  private evaluateAndSpawn() {
    const config = this.game.waveManager.currentWaveConfig;
    const weightCap = config.weightCap ?? 30;
    const pressure = this.getPressureState(weightCap);
    const committedWeight = this.getCommittedWeight();

    if (this.isSpawningPhase) {
      if (committedWeight >= pressure.targetCap) {
        this.isSpawningPhase = false;
        return;
      }
    } else {
      const restartThreshold = Math.max(1, Math.floor(pressure.targetCap * 0.3));
      if (committedWeight <= restartThreshold) {
        this.isSpawningPhase = true;
      } else {
        return;
      }
    }

    const deficit = pressure.targetCap - committedWeight;
    const spawnBudget = Math.min(deficit, pressure.maxCommitPerTick);
    if (spawnBudget <= 0) return;

    this.triggerSpawns(spawnBudget, pressure);
  }

  private triggerSpawns(deficit: number, pressure: PressureState) {
    const useFormation = pressure.rampProgress >= 0.45 && Math.random() < 0.2 && deficit > 20;
    if (useFormation) {
      this.spawnFormation(deficit, 'circle');
      return;
    }
    this.spawnClump(deficit, pressure);
  }

  private spawnClump(budget: number, pressure: PressureState) {
    let spent = 0;
    const center = this.getRandomArenaSpawnPoint();
    let loops = 0;

    while (spent < budget && loops < 20) {
      loops++;
      const type = this.pickZombieType(pressure.maxUnitWeight, pressure.allowSpitter);
      const weight = ZOMBIE_REGISTRY[type].weight ?? 1;
      if (spent + weight > budget && type !== 'normal' && type !== 'slime_small') continue;

      const x = center.x + (Math.random() - 0.5) * 110;
      const y = center.y + (Math.random() - 0.5) * 110;

      this.spawnZombie(type, x, y);
      spent += weight;
    }
  }

  private spawnFormation(budget: number, type: 'circle') {
    if (type !== 'circle') return;

    const radius = 85 + Math.random() * 40;
    const count = Math.min(25, Math.floor(budget));
    const center = this.getRandomArenaSpawnPoint(this.SPAWN_SAFE_RADIUS + 40);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;
      this.spawnZombie('normal', x, y);
    }
  }

  private spawnZombie(type: ZombieType, x: number, y: number) {
    if (this.game.mode === 'arena') {
      const clamped = this.game.clampToArenaBounds(x, y, 20);
      this.game.activeEffects.push({
        type: 'spawn_warning',
        x: clamped.x,
        y: clamped.y,
        radius: 30,
        lifetime: 800,
        maxLifetime: 800,
        damage: 0,
        tickInterval: 800,
        tickTimer: 800,
        ownerId: 0,
        level: 1,
        zombieType: type,
      });
      return;
    }

    const zombie = this.game.zombiePool.get(x, y, type);
    this.game.zombies.push(zombie);
  }

  private getCommittedWeight() {
    let total = 0;

    for (const zombie of this.game.zombies) {
      if (zombie.hp <= 0) continue;
      total += ZOMBIE_REGISTRY[zombie.type].weight ?? 1;
    }

    for (const effect of this.game.activeEffects) {
      if (effect.type !== 'spawn_warning' || !effect.zombieType) continue;
      total += ZOMBIE_REGISTRY[effect.zombieType].weight ?? 1;
    }

    return total;
  }

  private getPressureState(weightCap: number): PressureState {
    const elapsed = this.game.waveManager.combatElapsedMs;
    const targetRatio = this.getTargetRatio(elapsed);
    const rampProgress = this.getRampProgress(targetRatio);
    const fullTickBudget = Math.max(4, Math.min(18, Math.round(weightCap * 0.08)));
    const openingTickBudget = Math.max(2, Math.round(fullTickBudget * this.INITIAL_TICK_RATIO));

    return {
      rampProgress,
      targetCap: Math.max(1, Math.ceil(weightCap * targetRatio)),
      maxCommitPerTick: Math.max(1, Math.round(openingTickBudget + (fullTickBudget - openingTickBudget) * rampProgress)),
      maxUnitWeight: elapsed < this.HEAVY_UNIT_UNLOCK_MS ? 1 : Number.POSITIVE_INFINITY,
      allowSpitter: elapsed >= this.SPITTER_UNLOCK_MS,
    };
  }

  // Arena pressure timeline: 20% at wave start, 50% at mid-wave, full at the start of the final third.
  private getTargetRatio(elapsedMs: number) {
    const { halfWaveMs, peakStartMs } = this.getPressureBreakpointsMs();
    if (elapsedMs <= 0) return this.OPENING_PRESSURE_RATIO;

    if (elapsedMs <= halfWaveMs) {
      const progress = elapsedMs / halfWaveMs;
      return this.OPENING_PRESSURE_RATIO
        + (this.MID_WAVE_PRESSURE_RATIO - this.OPENING_PRESSURE_RATIO) * progress;
    }

    if (elapsedMs >= peakStartMs) {
      return 1;
    }

    const finalRampWindow = Math.max(this.TICK_RATE, peakStartMs - halfWaveMs);
    const progress = (elapsedMs - halfWaveMs) / finalRampWindow;
    return this.MID_WAVE_PRESSURE_RATIO + (1 - this.MID_WAVE_PRESSURE_RATIO) * progress;
  }

  private getRampProgress(targetRatio: number) {
    return Math.max(
      0,
      Math.min(1, (targetRatio - this.OPENING_PRESSURE_RATIO) / (1 - this.OPENING_PRESSURE_RATIO)),
    );
  }

  private processAutoDespawn() {
    const limitDist = 2000;
    for (const player of this.game.players) {
      if (player.hp <= 0) continue;

      for (let i = this.game.zombies.length - 1; i >= 0; i--) {
        const zombie = this.game.zombies[i];
        if (zombie.hp <= 0 || zombie.type === 'butcher') continue;

        const dist = Math.hypot(player.x - zombie.x, player.y - zombie.y);
        if (dist > limitDist) {
          zombie.hp = 0;
          zombie.extraState.set('auto_despawned', true);
        }
      }
    }
  }

  private pickZombieType(maxUnitWeight = Number.POSITIVE_INFINITY, allowSpitter = true): ZombieType {
    const comp = this.game.waveManager.getComposition();

    for (let attempt = 0; attempt < 8; attempt++) {
      const rand = Math.random();
      let candidate: ZombieType = 'normal';
      if (rand < comp.big) candidate = 'big';
      else if (rand < comp.big + comp.slime) candidate = 'slime';
      else if (rand < comp.big + comp.slime + comp.spitter) candidate = 'spitter';

      if (!allowSpitter && candidate === 'spitter') continue;
      if ((ZOMBIE_REGISTRY[candidate].weight ?? 1) <= maxUnitWeight) return candidate;
    }

    if (allowSpitter && (ZOMBIE_REGISTRY.spitter.weight ?? 1) <= maxUnitWeight) return 'spitter';
    if ((ZOMBIE_REGISTRY.slime.weight ?? 1) <= maxUnitWeight) return 'slime';
    return 'normal';
  }

  private getPeakPressureStartMs() {
    const waveDuration = this.game.waveManager.currentWaveConfig.arenaDuration;
    const totalDurationMs = typeof waveDuration === 'number'
      ? waveDuration * 1000
      : this.OBJECTIVE_VIRTUAL_DURATION_MS;

    return Math.max(this.TICK_RATE, Math.floor(totalDurationMs * (2 / 3)));
  }

  private getPressureBreakpointsMs() {
    const peakStartMs = this.getPeakPressureStartMs();
    return {
      peakStartMs,
      halfWaveMs: Math.max(this.TICK_RATE, Math.floor(peakStartMs * 0.75)),
    };
  }

  private getRandomArenaSpawnPoint(minPlayerDistance = this.SPAWN_SAFE_RADIUS) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const point = this.game.randomArenaPoint(this.SPAWN_PADDING);
      if (this.isSpawnPointSafe(point.x, point.y, minPlayerDistance)) {
        return point;
      }
    }

    return this.game.randomArenaPoint(this.SPAWN_PADDING);
  }

  private isSpawnPointSafe(x: number, y: number, minPlayerDistance: number) {
    for (const player of this.game.players) {
      if (player.hp <= 0) continue;
      if (Math.hypot(player.x - x, player.y - y) < minPlayerDistance) {
        return false;
      }
    }

    for (const effect of this.game.activeEffects) {
      if (effect.type !== 'spawn_warning') continue;
      if (Math.hypot(effect.x - x, effect.y - y) < 70) {
        return false;
      }
    }

    const obstacles = this.game.mapManager.getNearbyObstacles(x, y);
    for (const obstacle of obstacles) {
      if (obstacle.isDestroyed) continue;
      if (obstacle.collidesWithCircle(x, y, 40)) {
        return false;
      }
    }

    return true;
  }
}
