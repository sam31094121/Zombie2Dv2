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
  tk: number;      // TickID
  hs?: boolean;    // HardSync flag（波次切換時為 true）
  ps: NetPlayerState[];
  zs: { x: number; y: number; hp: number; mh: number; tp: string; ag: number }[];
  pj: { x: number; y: number; vx: number; vy: number; tp: string; lv: number; lt: number; ml: number; en: boolean; r: number; oi: number }[];
  it: { x: number; y: number; tp: string; v?: number; c?: string }[];
  wv: { w: number; r: boolean; t: number; i: boolean; m: string[] };
}

// ── NetworkManager：管理 WebSocket 連線 ──────────────────
export class NetworkManager {
  private ws: WebSocket | null = null;
  private sendTick = 0;       // Binary input 的 TickID 計數器

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

        this.ws.onclose = () => { this.onDisconnect?.(); };

        this.ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data as string);
            switch (msg.t) {
              case 'ROOM':  this.onRoomJoined?.(msg.code, msg.pid); break;
              case 'START': this.onGameStart?.(); break;
              case 'ST':    this.onStateUpdate?.(msg as NetGameState); break;
              case 'GO':    this.onGameOver?.(msg.time, msg.kills); break;
              case 'ERR':   this.onError?.(msg.msg); break;
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

  createRoom() { this.send({ t: 'CREATE' }); }

  joinRoom(code: string) { this.send({ t: 'JOIN', code: code.trim() }); }

  /**
   * Binary DataView 輸入封包（模組 A）
   * 格式：[0-3] TickID Uint32BE  [4] dx×127 Int8  [5] dy×127 Int8
   * 6 bytes vs JSON ~26 bytes → 頻寬 ↓77%
   */
  sendInput(dx: number, dy: number) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.sendTick = (this.sendTick + 1) >>> 0;   // Uint32 wrapping increment
    const buf  = new ArrayBuffer(6);
    const view = new DataView(buf);
    view.setUint32(0, this.sendTick, false);      // big-endian TickID
    view.setInt8(4, Math.round(Math.max(-1, Math.min(1, dx)) * 127));
    view.setInt8(5, Math.round(Math.max(-1, Math.min(1, dy)) * 127));
    this.ws.send(buf);
  }

  disconnect() { this.ws?.close(); this.ws = null; }

  get isConnected() { return this.ws?.readyState === WebSocket.OPEN; }

  private send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
