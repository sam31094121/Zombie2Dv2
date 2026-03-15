import { BaseObstacle } from './BaseObstacle';
import { DestructibleComponent } from './Components';
import { ObstacleType } from '../types';

export class Sandbag extends BaseObstacle {
  constructor(x: number, y: number) {
    super(x, y, 20, 'sandbag');
    this.addComponent('destructible', new DestructibleComponent(100, () => {
      this.isDestroyed = true;
      console.log('Sandbag destroyed!');
    }));
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
