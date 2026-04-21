import type { Game } from '../Game';
import { CONSTANTS } from '../Constants';
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
  private readonly TICK_RATE = 500;
  private readonly OPENING_PRESSURE_RATIO = 0.2;
  private readonly LIGHT_OPENING_MS = 1500;
  private readonly FULL_PRESSURE_MS = 6000;

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

    if (committedWeight >= pressure.targetCap) return;

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
    const center = this.getRandomOffscreenEdge();
    let loops = 0;

    while (spent < budget && loops < 20) {
      loops++;
      const type = this.pickZombieType(pressure.maxUnitWeight, pressure.allowSpitter);
      const weight = ZOMBIE_REGISTRY[type].weight ?? 1;
      if (spent + weight > budget && type !== 'normal' && type !== 'slime_small') continue;

      const x = center.x + (Math.random() - 0.5) * 150;
      const y = center.y + (Math.random() - 0.5) * 150;

      this.spawnZombie(type, x, y);
      spent += weight;
    }
  }

  private spawnFormation(budget: number, type: 'circle') {
    if (type !== 'circle') return;

    const radius = 600;
    const count = Math.min(25, Math.floor(budget));
    const playerCenter = this.getGlobalPlayerCenter();

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = playerCenter.x + Math.cos(angle) * radius;
      const y = playerCenter.y + Math.sin(angle) * radius;
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
    const rampProgress = this.getRampProgress(elapsed);
    const targetRatio = this.OPENING_PRESSURE_RATIO + (1 - this.OPENING_PRESSURE_RATIO) * rampProgress;
    const fullTickBudget = Math.max(4, Math.min(18, Math.round(weightCap * 0.08)));

    return {
      rampProgress,
      targetCap: Math.max(1, Math.ceil(weightCap * targetRatio)),
      maxCommitPerTick: Math.max(1, Math.round(4 + (fullTickBudget - 4) * rampProgress)),
      maxUnitWeight: elapsed < 3000 ? 1 : Number.POSITIVE_INFINITY,
      allowSpitter: elapsed >= this.LIGHT_OPENING_MS,
    };
  }

  private getRampProgress(elapsedMs: number) {
    if (elapsedMs <= this.LIGHT_OPENING_MS) return 0;
    if (elapsedMs >= this.FULL_PRESSURE_MS) return 1;
    return (elapsedMs - this.LIGHT_OPENING_MS) / (this.FULL_PRESSURE_MS - this.LIGHT_OPENING_MS);
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

  private getRandomOffscreenEdge() {
    const side = Math.floor(Math.random() * 4);
    const margin = 200;

    if (side === 0) {
      return {
        x: this.game.camera.x + Math.random() * CONSTANTS.CANVAS_WIDTH,
        y: this.game.camera.y - margin,
      };
    }
    if (side === 1) {
      return {
        x: this.game.camera.x + CONSTANTS.CANVAS_WIDTH + margin,
        y: this.game.camera.y + Math.random() * CONSTANTS.CANVAS_HEIGHT,
      };
    }
    if (side === 2) {
      return {
        x: this.game.camera.x + Math.random() * CONSTANTS.CANVAS_WIDTH,
        y: this.game.camera.y + CONSTANTS.CANVAS_HEIGHT + margin,
      };
    }
    return {
      x: this.game.camera.x - margin,
      y: this.game.camera.y + Math.random() * CONSTANTS.CANVAS_HEIGHT,
    };
  }

  private getGlobalPlayerCenter() {
    let px = 0;
    let py = 0;
    let active = 0;

    for (const player of this.game.players) {
      if (player.hp <= 0) continue;
      px += player.x;
      py += player.y;
      active++;
    }

    if (active === 0) {
      return {
        x: this.game.camera.x + CONSTANTS.CANVAS_WIDTH / 2,
        y: this.game.camera.y + CONSTANTS.CANVAS_HEIGHT / 2,
      };
    }

    return { x: px / active, y: py / active };
  }
}
