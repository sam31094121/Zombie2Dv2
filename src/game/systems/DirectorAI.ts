import type { Game } from '../Game';
import { CONSTANTS } from '../Constants';
import { ZOMBIE_REGISTRY } from '../entities/definitions/ZombieDefinitions';
import type { ZombieType } from '../Zombie';

export class DirectorAI {
  private game: Game;
  private directorTimer: number = 0;
  private readonly TICK_RATE = 500; // 0.5 seconds evaluation
  
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
    const weightCap = config.weightCap ?? 30; // Default if undefined
    
    let currentWeight = 0;
    for (const z of this.game.zombies) {
      const def = ZOMBIE_REGISTRY[z.type];
      currentWeight += (def.weight ?? 1);
    }

    if (currentWeight < weightCap) {
      const weightDeficit = weightCap - currentWeight;
      this.triggerSpawns(weightDeficit);
    }
  }

  private triggerSpawns(deficit: number) {
    const r = Math.random();
    if (r < 0.20 && deficit > 20) {
      this.spawnFormation(deficit, 'circle');
    } else {
      this.spawnClump(deficit);
    }
  }

  private spawnClump(budget: number) {
    let spent = 0;
    // Pick a random cluster center at the edge of the screen
    const center = this.getRandomOffscreenEdge();
    let loops = 0;
    
    while (spent < budget && loops < 20) {
      loops++;
      const type = this.pickZombieType();
      const weight = ZOMBIE_REGISTRY[type].weight ?? 1;
      if (spent + weight > budget && type !== 'normal' && type !== 'slime_small') continue;
      
      const x = center.x + (Math.random() - 0.5) * 150;
      const y = center.y + (Math.random() - 0.5) * 150;
      
      this.spawnZombie(type, x, y);
      spent += weight;
    }
  }

  private spawnFormation(budget: number, type: 'circle') {
    if (type === 'circle') {
      const radius = 600;
      const count = Math.min(25, Math.floor(budget)); // Assuming normal zombies weight 1
      const playerCenter = this.getGlobalPlayerCenter();
      
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const x = playerCenter.x + Math.cos(angle) * radius;
        const y = playerCenter.y + Math.sin(angle) * radius;
        this.spawnZombie('normal', x, y);
      }
    }
  }

  private spawnZombie(type: ZombieType, x: number, y: number) {
    if (this.game.mode === 'arena') {
      // In arena, clamp to bounds and sometimes use warnings
      const clamped = this.game.clampToArenaBounds(x, y, 20);
      
      this.game.activeEffects.push({
        type: 'spawn_warning',
        x: clamped.x, y: clamped.y,
        radius: 30,
        lifetime: 800, maxLifetime: 800,
        damage: 0, tickInterval: 800, tickTimer: 800,
        ownerId: 0, level: 1, zombieType: type
      });
    } else {
      // Direct spawn for infinite mode or outside bounds
      const zombie = this.game.zombiePool.get(x, y, type);
      this.game.zombies.push(zombie);
    }
  }

  private processAutoDespawn() {
    const LIMIT_DIST = 2000;
    for (const player of this.game.players) {
      if (player.hp <= 0) continue;
      
      for (let i = this.game.zombies.length - 1; i >= 0; i--) {
        const z = this.game.zombies[i];
        if (z.hp <= 0) continue; // Already dying
        // Bosses shouldn't auto despawn
        if (z.type === 'butcher') continue;
        
        const dist = Math.hypot(player.x - z.x, player.y - z.y);
        if (dist > LIMIT_DIST) {
          // Despawn
          z.hp = 0; // Trigger cleanup later in Game.ts flushQueuedZombieDeaths, but with suppress drops
          z.extraState.set('auto_despawned', true);
        }
      }
    }
  }

  private pickZombieType(): ZombieType {
    const comp = this.game.waveManager.getComposition();
    const rand = Math.random();
    if (rand < comp.big) return 'big';
    if (rand < comp.big + comp.slime) return 'slime';
    if (rand < comp.big + comp.slime + comp.spitter) return 'spitter';
    return 'normal';
  }

  private getRandomOffscreenEdge() {
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    const margin = 200;
    if (side === 0) {
      x = this.game.camera.x + Math.random() * CONSTANTS.CANVAS_WIDTH;
      y = this.game.camera.y - margin;
    } else if (side === 1) {
      x = this.game.camera.x + CONSTANTS.CANVAS_WIDTH + margin;
      y = this.game.camera.y + Math.random() * CONSTANTS.CANVAS_HEIGHT;
    } else if (side === 2) {
      x = this.game.camera.x + Math.random() * CONSTANTS.CANVAS_WIDTH;
      y = this.game.camera.y + CONSTANTS.CANVAS_HEIGHT + margin;
    } else {
      x = this.game.camera.x - margin;
      y = this.game.camera.y + Math.random() * CONSTANTS.CANVAS_HEIGHT;
    }
    return { x, y };
  }

  private getGlobalPlayerCenter() {
    let px = 0, py = 0, active = 0;
    for (const p of this.game.players) {
      if (p.hp > 0) {
        px += p.x; py += p.y; active++;
      }
    }
    if (active === 0) return { x: this.game.camera.x + CONSTANTS.CANVAS_WIDTH/2, y: this.game.camera.y + CONSTANTS.CANVAS_HEIGHT/2 };
    return { x: px / active, y: py / active };
  }
}
