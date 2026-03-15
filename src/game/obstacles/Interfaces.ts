import { Vector2 } from '../types';

export interface IDestructible {
  hp: number;
  takeDamage(amount: number): void;
  onBreak(): void;
}

export interface IAuraProvider {
  effectRadius: number;
  applyAura(entity: any): void;
}

export interface IProjectileBlocker {
  isBlocking: boolean;
}

export interface IFieldOfView {
  getLightSource(): { x: number, y: number, radius: number };
}
