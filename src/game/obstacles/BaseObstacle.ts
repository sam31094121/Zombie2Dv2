import { Vector2, ObstacleType } from '../types';

export abstract class BaseObstacle {
  public id: string = crypto.randomUUID();
  public pos: Vector2;
  public radius: number;
  public type: ObstacleType;
  public isDestroyed: boolean = false;
  
  // Composition: Components handle specific behaviors
  private components: Map<string, any> = new Map();

  constructor(x: number, y: number, radius: number, type: ObstacleType) {
    this.pos = new Vector2(x, y);
    this.radius = radius;
    this.type = type;
  }

  addComponent(name: string, component: any) {
    this.components.set(name, component);
  }

  getComponent<T>(name: string): T | undefined {
    return this.components.get(name) as T;
  }

  abstract draw(ctx: CanvasRenderingContext2D): void;

  update(dt: number) {
    this.components.forEach(c => c.update?.(dt));
  }

  handleCollision(entity: any) {
    const dist = this.pos.distanceTo(entity.pos);
    if (dist < this.radius + entity.radius) {
      // Check for aura component
      const aura = this.getComponent<any>('aura');
      if (aura) aura.applyAura(entity);
      return true;
    }
    return false;
  }
}
