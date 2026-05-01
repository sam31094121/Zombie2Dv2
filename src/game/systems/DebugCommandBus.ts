// ── DebugCommandBus.ts ────────────────────────────────────────────────────────
// 統一偵錯指令執行器：單機與網路模式呼叫完全相同的介面
//
// 呼叫流程（兩種模式完全一致）：
//   TestModePanel → onCmd(cmd) → executeDebugCmd(game, cmd)   ← 本地執行
//                              → nm.sendDebugCmd(cmd)          ← 若有網路則轉發
//   對端收到 DEBUG_CMD → nm.onDebugCmd → executeDebugCmd(game, cmd)
// ─────────────────────────────────────────────────────────────────────────────
import type { Game } from '../Game';
import type { ZombieType } from '../types';
import type { ItemType } from '../Item';
import type { ObstacleType } from '../types';

export type DebugCmd =
  | { tp: 'sz'; zt: ZombieType; c: number }
  | { tp: 'si'; it: ItemType }
  | { tp: 'so'; ot: ObstacleType }
  | { tp: 'cz' }
  | { tp: 'ci' }
  | { tp: 'cs' }
  | { tp: 'ce' }
  | { tp: 'ha' }
  | { tp: 'sw'; w: number }
  | { tp: 'tp' }
  | { tp: 'hl' }
  | { tp: 'ic' }
  | { tp: 'pw'; pid: number; wp: 'sword' | 'gun'; lv: number }
  | { tp: 'pb'; pid: number; wp: 'sword' | 'gun'; br: 'A' | 'B' | null }
  | { tp: 'pl'; pid: number; lv: number }
  | { tp: 'ts'; pid: number; k: 'shield' | 'speedBoost' | 'slowDebuff' | 'glow' };

export function executeDebugCmd(game: Game, cmd: DebugCmd): void {
  switch (cmd.tp) {
    case 'sz': game.debugSpawnZombie(cmd.zt, cmd.c);                    break;
    case 'si': game.debugSpawnItem(cmd.it);                              break;
    case 'so': game.debugSpawnObstacle(cmd.ot);                         break;
    case 'cz': game.zombies = [];                                        break;
    case 'ci': game.items   = [];                                        break;
    case 'cs': game.debugClearSlime();                                   break;
    case 'ce': game.hitEffects = [];                                     break;
    case 'ha': game.debugHealAll();                                      break;
    case 'sw': game.debugSetWave(cmd.w);                                 break;
    case 'tp': game.debugTogglePause();                                  break;
    case 'hl': game.debugToggleHpLock();                                 break;
    case 'ic': game.debugToggleInfiniteCoins();                          break;
    case 'pw': game.debugSetWeapon(cmd.pid, cmd.wp, cmd.lv);            break;
    case 'pb': game.debugSetWeaponBranch(cmd.pid, cmd.wp, cmd.br);      break;
    case 'pl': game.debugSetPlayerLevel(cmd.pid, cmd.lv);               break;
    case 'ts': game.debugToggleStatus(cmd.pid, cmd.k);                  break;
  }
}
