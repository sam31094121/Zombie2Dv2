import { BaseObstacle } from './BaseObstacle';
import { Vector2 } from '../types';

export class ObstacleManager {
  private obstacles: BaseObstacle[] = [];

  addObstacle(obstacle: BaseObstacle) {
    this.obstacles.push(obstacle);
  }

  update(dt: number) {
    this.obstacles = this.obstacles.filter(o => !o.isDestroyed);
    this.obstacles.forEach(o => o.update(dt));
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.obstacles.forEach(o => o.draw(ctx));
  }

  handleCollisions(entity: any) {
    for (const obs of this.obstacles) {
      obs.handleCollision(entity);
    }
  }
}
