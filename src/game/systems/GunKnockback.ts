import { Zombie } from '../Zombie';

const BASE_GUN_KNOCKBACK_FORCE = 30;
const BIG_ZOMBIE_GUN_KNOCKBACK_MULT = 0.15;
const KNOCKBACK_VELOCITY_SCALE = 0.08;

export function applyGunKnockback(
  zombie: Zombie,
  sourceX: number,
  sourceY: number,
  strength: number,
  bonus: number = 0,
): void {
  if (strength <= 0) return;

  const angle = Math.atan2(zombie.y - sourceY, zombie.x - sourceX);
  const baseKb = strength * BASE_GUN_KNOCKBACK_FORCE + bonus * 4;
  const kbForce = zombie.type === 'big' ? baseKb * BIG_ZOMBIE_GUN_KNOCKBACK_MULT : baseKb;
  const v0 = kbForce * KNOCKBACK_VELOCITY_SCALE;
  zombie.vx += Math.cos(angle) * v0;
  zombie.vy += Math.sin(angle) * v0;
}
