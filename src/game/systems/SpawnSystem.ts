// ── SpawnSystem.ts ────────────────────────────────────────────────────────────
// 殭屍與道具的生成邏輯（從 Game.ts 分離）
// 新增殭屍型別：只改 ZombieDefinitions，不動此檔
// 新增道具型別：只改 ItemDefinitions（未來），不動此檔
// ─────────────────────────────────────────────────────────────────────────────
import type { Game } from '../Game';
import { Zombie } from '../Zombie';
import { Item, ItemType } from '../Item';
import { CONSTANTS } from '../Constants';

export function spawnZombie(game: Game): void {
  const side = Math.floor(Math.random() * 4);
  let x = 0, y = 0;

  const margin = 100;
  if (side === 0) {
    x = game.camera.x + Math.random() * CONSTANTS.CANVAS_WIDTH;
    y = game.camera.y - margin;
  } else if (side === 1) {
    x = game.camera.x + CONSTANTS.CANVAS_WIDTH + margin;
    y = game.camera.y + Math.random() * CONSTANTS.CANVAS_HEIGHT;
  } else if (side === 2) {
    x = game.camera.x + Math.random() * CONSTANTS.CANVAS_WIDTH;
    y = game.camera.y + CONSTANTS.CANVAS_HEIGHT + margin;
  } else {
    x = game.camera.x - margin;
    y = game.camera.y + Math.random() * CONSTANTS.CANVAS_HEIGHT;
  }

  const rand = Math.random();
  const comp = game.waveManager.getComposition();
  let type: 'normal' | 'big' | 'slime' | 'spitter' = 'normal';

  if (rand < comp.big) type = 'big';
  else if (rand < comp.big + comp.slime) type = 'slime';
  else if (rand < comp.big + comp.slime + comp.spitter) type = 'spitter';
  else type = 'normal';

  if (game.mode === 'arena') {
    x = Math.random() * game.arenaWidth;
    y = Math.random() * game.arenaHeight;
    // 競技場模式：產生警告光圈延遲生成
    game.activeEffects.push({
      type: 'spawn_warning',
      x, y,
      radius: 30,
      lifetime: 800,
      maxLifetime: 800,
      damage: 0, tickInterval: 800, tickTimer: 800,
      ownerId: 0, level: 1,
      zombieType: type
    });
    return;
  }

  spawnZombieAt(game, x, y, type);
}

export function spawnZombieAt(game: Game, x: number, y: number, type: 'normal' | 'big' | 'slime' | 'spitter'): void {
  const zombie = new Zombie(x, y, type);
  zombie.id = ++game._zombieIdCounter;

  const mult = game.waveManager.difficultyMultiplier;

  if (type === 'big') {
    zombie.hp *= mult;
    zombie.speed *= mult;
  } else if (type === 'slime') {
    zombie.hp *= mult;
    zombie.speed *= mult;
  } else if (type === 'spitter') {
    zombie.hp = 3 * mult;
    zombie.speed *= mult;
  } else {
    // 骷髏怪（normal）：永遠 1 滴血，最弱小兵，不參與波次血量縮放
    zombie.hp = 1;
    zombie.speed *= mult;
  }
  zombie.maxHp = zombie.hp;

  if (game.waveManager.isInfinite) {
    zombie.isInfiniteGlow = true;
  }

  game.zombies.push(zombie);
}

export function spawnItemAt(game: Game, x: number, y: number): void {
  const rand = Math.random();
  let type: ItemType;
  if (rand < 0.4) type = 'weapon_sword';
  else if (rand < 0.8) type = 'weapon_gun';
  else if (rand < 0.9) type = 'shield';
  else type = 'speed';

  game.items.push(new Item(x, y, type, CONSTANTS.ITEM_LIFETIME));
}

export function spawnItem(game: Game): void {
  const margin = 100;
  const x = game.camera.x + margin + Math.random() * (CONSTANTS.CANVAS_WIDTH - margin * 2);
  const y = game.camera.y + margin + Math.random() * (CONSTANTS.CANVAS_HEIGHT - margin * 2);
  spawnItemAt(game, x, y);
}
