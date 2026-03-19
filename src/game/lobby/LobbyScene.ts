// ── LobbyScene.ts ─────────────────────────────────────────────────────────────
// 大廳遊戲邏輯：玩家移動 + NPC 距離偵測 + 圓圈進度條
// ─────────────────────────────────────────────────────────────────────────────
import { LobbyNPC, NPCType, LOBBY_NPCS } from './LobbyNPC';

const LOBBY_W = 800;
const LOBBY_H = 680;
const PLAYER_SPEED = 2.8;

export class LobbyScene {
  // ── 玩家狀態 ────────────────────────────────────────────────────────────────
  playerX: number = 400;
  playerY: number = 400;
  playerRadius: number = 16;
  playerColor: string;

  // ── NPC（複製避免修改原始資料）────────────────────────────────────────────
  npcs: LobbyNPC[];

  // ── 觸發回呼 ────────────────────────────────────────────────────────────────
  onNPCTrigger: (id: NPCType) => void = () => {};

  // ── 內部狀態 ────────────────────────────────────────────────────────────────
  private keys: Record<string, boolean> = {};
  private activeNPC: NPCType | null = null;  // 正在計時的 NPC
  private triggered = new Set<NPCType>();    // 已觸發（面板開啟中）避免重複

  constructor(color: string) {
    this.playerColor = color;
    this.npcs = LOBBY_NPCS.map(n => ({ ...n, progress: 0 }));
  }

  handleKeyDown = (e: KeyboardEvent) => { this.keys[e.key] = true;  };
  handleKeyUp   = (e: KeyboardEvent) => { this.keys[e.key] = false; };

  /** 從外部注入搖桿輸入（手機用） */
  joystick: { x: number; y: number } | null = null;

  /** 面板關閉後呼叫，重置該 NPC 的進度 */
  resetNPC(id: NPCType) {
    const npc = this.npcs.find(n => n.id === id);
    if (npc) npc.progress = 0;
    this.triggered.delete(id);
    if (this.activeNPC === id) this.activeNPC = null;
  }

  update(dt: number) {
    this._movePlayer(dt);
    this._updateNPCProgress(dt);
  }

  private _movePlayer(dt: number) {
    let dx = 0, dy = 0;

    if (this.joystick) {
      dx = this.joystick.x;
      dy = this.joystick.y;
    } else {
      if (this.keys['w'] || this.keys['W'] || this.keys['ArrowUp'])    dy -= 1;
      if (this.keys['s'] || this.keys['S'] || this.keys['ArrowDown'])  dy += 1;
      if (this.keys['a'] || this.keys['A'] || this.keys['ArrowLeft'])  dx -= 1;
      if (this.keys['d'] || this.keys['D'] || this.keys['ArrowRight']) dx += 1;
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      this.playerX += (dx / len) * PLAYER_SPEED * (dt / 16);
      this.playerY += (dy / len) * PLAYER_SPEED * (dt / 16);
    }

    // 邊界夾緊
    this.playerX = Math.max(this.playerRadius, Math.min(LOBBY_W - this.playerRadius, this.playerX));
    this.playerY = Math.max(this.playerRadius, Math.min(LOBBY_H - this.playerRadius, this.playerY));
  }

  private _updateNPCProgress(dt: number) {
    for (const npc of this.npcs) {
      if (this.triggered.has(npc.id)) continue;

      const dist = Math.hypot(this.playerX - npc.x, this.playerY - npc.y);
      const inside = dist < npc.interactRadius;

      if (inside) {
        this.activeNPC = npc.id;
        npc.progress = Math.min(1, npc.progress + dt / npc.interactDuration);

        if (npc.progress >= 1) {
          this.triggered.add(npc.id);
          this.activeNPC = null;
          this.onNPCTrigger(npc.id);
        }
      } else {
        // 離開範圍：進度歸零
        if (this.activeNPC === npc.id) this.activeNPC = null;
        npc.progress = Math.max(0, npc.progress - dt / (npc.interactDuration * 0.3));
      }
    }
  }

  get width()  { return LOBBY_W; }
  get height() { return LOBBY_H; }
}
