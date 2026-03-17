import { drawItem } from './renderers/ItemRenderer';

export type ItemType = 'weapon_sword' | 'weapon_gun' | 'speed' | 'shield' | 'energy_orb';

export class Item {
  x: number;
  y: number;
  type: ItemType;
  radius: number = 15;
  lifetime: number;
  value?: number;
  color?: string;
  spawnTime: number;
  initialX: number;
  initialY: number;

  constructor(x: number, y: number, type: ItemType, lifetime: number, value?: number, color?: string) {
    this.x = x;
    this.y = y;
    this.initialX = x;
    this.initialY = y;
    this.spawnTime = Date.now();
    this.type = type;
    this.lifetime = lifetime;
    this.value = value;
    this.color = color;
    if (type === 'energy_orb') {
      this.radius = value && value > 2 ? 12 : 8;
    }
  }

  update(dt: number) {
    this.lifetime -= dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    drawItem(this, ctx);
  }
}
