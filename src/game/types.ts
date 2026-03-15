export class Vector2 {
  constructor(public x: number, public y: number) {}

  distanceTo(other: Vector2): number {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }

  add(other: Vector2): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }
}

export type ObstacleType = 
  | 'sandbag' | 'electric_fence' | 'explosive_barrel' | 'stone_wall' 
  | 'street_lamp' | 'tombstone' | 'vending_machine' | 'container' 
  | 'altar' | 'monolith';
