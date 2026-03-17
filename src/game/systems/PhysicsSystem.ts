// ── PhysicsSystem.ts ──────────────────────────────────────────────────────────
// 碰撞分離（殭屍-殭屍、玩家-殭屍、玩家-玩家）
// 新增碰撞對：在此加，Game.ts 不需修改
// ─────────────────────────────────────────────────────────────────────────────
import { Player } from '../Player';
import { Zombie } from '../Zombie';

export function resolveOverlaps(zombies: Zombie[], players: Player[]): void {
  // 1. Zombie vs Zombie
  for (let i = 0; i < zombies.length; i++) {
    for (let j = i + 1; j < zombies.length; j++) {
      const z1 = zombies[i];
      const z2 = zombies[j];
      const dx = z2.x - z1.x;
      const dy = z2.y - z1.y;
      const dist = Math.hypot(dx, dy);
      const minDist = z1.radius + z2.radius;
      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        z1.x -= (nx * overlap) / 2;
        z1.y -= (ny * overlap) / 2;
        z2.x += (nx * overlap) / 2;
        z2.y += (ny * overlap) / 2;
      }
    }
  }

  // 2. Player vs Zombie
  for (const player of players) {
    if (player.hp <= 0) continue;
    for (const zombie of zombies) {
      const dx = zombie.x - player.x;
      const dy = zombie.y - player.y;
      const dist = Math.hypot(dx, dy);
      const minDist = player.radius + zombie.radius;
      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        zombie.x += nx * overlap;
        zombie.y += ny * overlap;
      }
    }
  }

  // 3. Player vs Player
  if (players.length >= 2 && players[0].hp > 0 && players[1].hp > 0) {
    const p1 = players[0];
    const p2 = players[1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const minDist = p1.radius + p2.radius;
    if (dist < minDist && dist > 0) {
      const overlap = minDist - dist;
      const nx = dx / dist;
      const ny = dy / dist;
      p1.x -= (nx * overlap) / 2;
      p1.y -= (ny * overlap) / 2;
      p2.x += (nx * overlap) / 2;
      p2.y += (ny * overlap) / 2;
    }
  }
}
