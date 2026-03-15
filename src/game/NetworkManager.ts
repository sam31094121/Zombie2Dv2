// ── 伺服器廣播的遊戲狀態型別 ─────────────────────────────
export interface NetPlayerState {
  id: number; x: number; y: number;
  hp: number; mh: number;
  xp: number; mx: number;
  lv: number; pl: number;
  wp: string; aim: number; sh: boolean;
}

export interface NetGameState {
  t: 'ST';
  ps: NetPlayerState[];
  zs: { x: number; y: number; hp: number; mh: number; tp: string; ag: number }[];
  pj: { x: number; y: number; vx: number; vy: number; tp: string; lv: number; lt: number; ml: number; en: boolean; r: number; oi: number }[];
  it: { x: number; y: number; tp: string; v?: number; c?: string }[];
  wv: { w: number; r: boolean; t: number; i: boolean; m: string[] };
}

// ── NetworkManager：管理 WebSocket 連線 ──────────────────
export class NetworkManager {
  private ws: WebSocket | null = null;

  // 回呼事件
  onRoomJoined:  ((code: string, playerId: number) => void) | null = null;
  onGameStart:   (() => void) | null = null;
  onStateUpdate: ((state: NetGameState) => void) | null = null;
  onGameOver:    ((time: number, kills: number) => void) | null = null;
  onError:       ((msg: string) => void) | null = null;
  onDisconnect:  (() => void) | null = null;

  // 建立 WebSocket 連線
  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => resolve();

        this.ws.onerror = (e) => {
          console.error('WS error:', e);
          reject(new Error('無法連線到伺服器'));
        };

        this.ws.onclose = () => {
          this.onDisconnect?.();
        };

        this.ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data as string);
            switch (msg.t) {
              case 'ROOM': this.onRoomJoined?.(msg.code, msg.pid); break;
              case 'START': this.onGameStart?.(); break;
              case 'ST':   this.onStateUpdate?.(msg as NetGameState); break;
              case 'GO':   this.onGameOver?.(msg.time, msg.kills); break;
              case 'ERR':  this.onError?.(msg.msg); break;
            }
          } catch (err) {
            console.error('WS parse error:', err);
          }
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  createRoom() {
    this.send({ t: 'CREATE' });
  }

  joinRoom(code: string) {
    this.send({ t: 'JOIN', code: code.trim() });
  }

  sendInput(dx: number, dy: number) {
    this.send({ t: 'IN', dx, dy });
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
