// ── 伺服器廣播的遊戲狀態型別 ─────────────────────────────
export interface NetPlayerState {
  id: number; x: number; y: number;
  hp: number; mh: number;
  xp: number; mx: number;
  lv: number; pl: number;
  wp: string; aim: number; sh: boolean; st?: number;
  sl: number;  // slowDebuffTimer（ms）— 同步給 P2 保持減速預測一致
}

export interface NetGameState {
  t: 'ST';
  tk: number;       // TickID
  hs?: boolean;     // HardSync flag（波次切換時為 true）
  ts: number;       // 每幀時間戳（供插值與時鐘校正）
  ack: number;      // Host 最後確認的 P2 input tick（Reconciliation 用）
  ps: NetPlayerState[];
  zs: { id: number; x: number; y: number; hp: number; mh: number; tp: string; ag: number }[];
  pj: { x: number; y: number; vx: number; vy: number; tp: string; lv: number; lt: number; ml: number; en: boolean; r: number; oi: number }[];
  it: { x: number; y: number; tp: string; v?: number; c?: string }[];
  wv: { w: number; r: boolean; t: number; i: boolean; m: string[] };
}

// ── STUN 伺服器（Google 免費，供 NAT 穿透） ──────────────
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ── NetworkManager：管理 WebSocket 信令 + WebRTC DataChannel ─
export class NetworkManager {
  private ws:           WebSocket | null = null;
  private pc:           RTCPeerConnection | null = null;
  private reliableDC:   RTCDataChannel | null = null; // ordered, reliable — 遊戲事件
  private fastDC:       RTCDataChannel | null = null; // unordered, unreliable — 移動/狀態

  private reliableReady = false;
  private fastReady     = false;
  private _peerReady    = false;   // 收到對方的 DC_READY
  private _gameStarted  = false;   // 防止重複觸發 onGameStart
  private _isHost       = false;   // P1 = Host/Caller, P2 = Client/Callee

  private sendTick = 0;

  // ── 回呼事件（介面與舊版相同，外部程式碼無需改動）──────
  onRoomJoined:    ((code: string, playerId: number) => void) | null = null;
  onGameStart:     (() => void) | null = null;
  onStateUpdate:   ((state: NetGameState) => void) | null = null;
  onGameOver:      ((time: number, kills: number) => void) | null = null;
  onError:         ((msg: string) => void) | null = null;
  onDisconnect:    (() => void) | null = null;
  onRespawnStart:  ((pid: number, duration: number) => void) | null = null;
  onRespawned:     ((pid: number) => void) | null = null;
  onPlayerReady:   ((pid: number) => void) | null = null;
  // Host 接收 P2 的移動輸入（含 inputTick 供 Reconciliation）
  onRemoteInput:   ((dx: number, dy: number, tick: number) => void) | null = null;

  get isHost() { return this._isHost; }

  // ── 建立 WebSocket 信令連線 ──────────────────────────────
  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.onopen  = () => resolve();
        this.ws.onerror = (e) => { console.error('WS error:', e); reject(new Error('無法連線到伺服器')); };
        this.ws.onclose = () => {
          // 只在 DataChannel 尚未建立時才觸發斷線（遊戲中 WS 可自然關閉）
          if (!this._gameStarted) this.onDisconnect?.();
        };
        this.ws.onmessage = (e) => this._handleWsMsg(e.data as string);
      } catch (e) { reject(e); }
    });
  }

  // ── WebSocket 信令訊息處理 ────────────────────────────────
  private _handleWsMsg(data: string) {
    try {
      const msg = JSON.parse(data);
      switch (msg.t) {
        case 'ROOM':
          this.onRoomJoined?.(msg.code, msg.pid);
          break;
        case 'PEER_JOINED':
          // P2 加入房間 → P1（Host/Caller）開始建立 WebRTC
          if (this._isHost) this._startAsHost();
          break;
        case 'OFFER':
          // P2（Callee）收到 Offer
          this._handleOffer(msg.offer);
          break;
        case 'ANSWER':
          // P1（Caller）收到 Answer
          this.pc?.setRemoteDescription(new RTCSessionDescription(msg.answer)).catch(console.error);
          break;
        case 'ICE':
          // ICE Trickle：邊產生邊加入，不等全部收集完（連線速度快 2–8 秒）
          if (msg.candidate) {
            this.pc?.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(console.error);
          }
          break;
        case 'ERR':
          this.onError?.(msg.msg);
          break;
      }
    } catch (err) { console.error('WS parse error:', err); }
  }

  // ── 建立房間（P1/Host/Caller）────────────────────────────
  createRoom() {
    this._isHost = true;
    this._sendWs({ t: 'CREATE' });
  }

  // ── 加入房間（P2/Client/Callee）──────────────────────────
  joinRoom(code: string) {
    this._isHost = false;
    this._sendWs({ t: 'JOIN', code: code.trim() });
  }

  // ── P1（Host/Caller）：建立 RTCPeerConnection + DataChannel ─
  private async _startAsHost() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this._setupPCHandlers();

    // 重要：只有 Caller 呼叫 createDataChannel
    // P2（Callee）必須透過 ondatachannel 接收，不可自己建立
    this.reliableDC = this.pc.createDataChannel('reliable', { ordered: true });
    this.fastDC     = this.pc.createDataChannel('fast',     { ordered: false, maxRetransmits: 0 });

    this._setupDataChannel(this.reliableDC, 'reliable');
    this._setupDataChannel(this.fastDC,     'fast');

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this._sendWs({ t: 'OFFER', offer: this.pc.localDescription });
  }

  // ── P2（Client/Callee）：收到 Offer 建立連線 ────────────
  private async _handleOffer(offer: RTCSessionDescriptionInit) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this._setupPCHandlers();

    // P2 透過 ondatachannel 接收 Caller 建立的 DataChannel
    // 不可自己呼叫 createDataChannel，否則是不同的 channel
    this.pc.ondatachannel = (e) => {
      const ch = e.channel;
      ch.binaryType = 'arraybuffer';
      if (ch.label === 'reliable') {
        this.reliableDC = ch;
        this._setupDataChannel(ch, 'reliable');
      } else if (ch.label === 'fast') {
        this.fastDC = ch;
        this._setupDataChannel(ch, 'fast');
      }
    };

    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this._sendWs({ t: 'ANSWER', answer: this.pc.localDescription });
  }

  // ── RTCPeerConnection 通用事件 ────────────────────────────
  private _setupPCHandlers() {
    if (!this.pc) return;

    // ICE Trickle：每產生一個 candidate 就立刻送出，不等全部收集完
    this.pc.onicecandidate = (e) => {
      if (e.candidate) this._sendWs({ t: 'ICE', candidate: e.candidate });
    };

    // P2P 連線狀態監控（斷線偵測）
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log(`[WebRTC] Connection state: ${state}`);
      if ((state === 'disconnected' || state === 'failed') && this._gameStarted) {
        this.onDisconnect?.();
      }
    };
  }

  // ── DataChannel 事件設定 ──────────────────────────────────
  private _setupDataChannel(ch: RTCDataChannel, label: 'reliable' | 'fast') {
    ch.binaryType = 'arraybuffer';

    ch.onopen = () => {
      console.log(`[WebRTC] DataChannel "${label}" open`);
      if (label === 'reliable') {
        this.reliableReady = true;
        // 可靠頻道開啟後立刻發送握手確認訊號
        // 重要：在收到對方的 DC_READY 之前絕對不送遊戲資料
        ch.send(JSON.stringify({ t: 'DC_READY' }));
      }
      if (label === 'fast') {
        this.fastReady = true;
      }
      this._checkBothReady();
    };

    ch.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        // Binary 移動輸入（8 bytes，只有 Host 會收到來自 P2 的）
        if (e.data.byteLength === 8) {
          const view      = new DataView(e.data);
          const inputTick = view.getUint32(0, false);   // bytes 0-3：P2 本地 tick
          const dx        = view.getInt8(6) / 127;
          const dy        = view.getInt8(7) / 127;
          this.onRemoteInput?.(
            Math.max(-1, Math.min(1, dx)),
            Math.max(-1, Math.min(1, dy)),
            inputTick,
          );
        }
      } else {
        try {
          const msg = JSON.parse(e.data as string);
          this._handleDCMsg(msg);
        } catch (err) { console.error('DC parse error:', err); }
      }
    };

    ch.onerror = (e) => console.error(`[WebRTC] "${label}" error:`, e);
    ch.onclose = () => {
      console.log(`[WebRTC] DataChannel "${label}" closed`);
      // reliable 頻道關閉 = 對方斷線
      if (label === 'reliable' && this._gameStarted) {
        this.onDisconnect?.();
      }
    };
  }

  // ── DataChannel 訊息處理 ──────────────────────────────────
  private _handleDCMsg(msg: any) {
    switch (msg.t) {
      case 'DC_READY':
        // 收到對方的握手確認 → 雙方都準備好了
        this._peerReady = true;
        this._checkBothReady();
        break;
      case 'START':
        // Host 通知 P2 開始遊戲（初始或重賽）
        if (!this._isHost && !this._gameStarted) {
          this._gameStarted = true;
          this.onGameStart?.();
        } else if (!this._isHost && this._gameStarted) {
          // 重賽：重設狀態後再呼叫 onGameStart
          this.onGameStart?.();
        }
        break;
      case 'ST':
        this.onStateUpdate?.(msg as NetGameState);
        break;
      case 'GO':
        this.onGameOver?.(msg.time, msg.kills);
        break;
      case 'RESPAWN_START':
        this.onRespawnStart?.(msg.pid, msg.dur);
        break;
      case 'RESPAWNED':
        this.onRespawned?.(msg.pid);
        break;
      case 'PLAYER_READY':
        this.onPlayerReady?.(msg.pid);
        break;
    }
  }

  // ── 雙向 Ready 確認（兩個頻道都開啟 + 收到對方握手）────
  // 重要：在所有條件滿足之前，不可送任何遊戲資料，否則 Script 崩潰
  private _checkBothReady() {
    if (!this.reliableReady || !this.fastReady || !this._peerReady || this._gameStarted) return;

    if (this._isHost) {
      // Host 確認雙方都就緒 → 送 START 給 P2 → 本地開始遊戲
      this._gameStarted = true;
      this.reliableDC!.send(JSON.stringify({ t: 'START' }));
      this.onGameStart?.();
    }
    // P2 等待 Host 送來的 START，不在這裡觸發 onGameStart
  }

  // ── 對外介面：傳送移動輸入（P2 送給 Host，8-byte binary）─
  sendInput(dx: number, dy: number) {
    if (!this.fastDC || this.fastDC.readyState !== 'open') return;
    this.sendTick = (this.sendTick + 1) >>> 0;
    const buf  = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(0, this.sendTick, false);
    view.setUint16(4, Date.now() & 0xFFFF, false);
    view.setInt8(6, Math.round(Math.max(-1, Math.min(1, dx)) * 127));
    view.setInt8(7, Math.round(Math.max(-1, Math.min(1, dy)) * 127));
    this.fastDC.send(buf);
  }

  // ── 對外介面：Host 傳送遊戲狀態給 P2（fast channel）────
  sendGameState(state: object) {
    if (!this.fastDC || this.fastDC.readyState !== 'open') return;
    this.fastDC.send(JSON.stringify(state));
  }

  // ── 對外介面：傳送控制訊息（reliable channel）──────────
  // 用於：GO、RESPAWN_START、RESPAWNED、PLAYER_READY、START（重賽）
  sendControl(msg: object) {
    if (!this.reliableDC || this.reliableDC.readyState !== 'open') return;
    this.reliableDC.send(JSON.stringify(msg));
  }

  // ── 對外介面：重賽準備 ────────────────────────────────────
  sendReady() {
    this.sendControl({ t: 'PLAYER_READY', pid: this._isHost ? 1 : 2 });
  }

  // ── 斷線清理 ─────────────────────────────────────────────
  disconnect() {
    this.reliableDC?.close();
    this.fastDC?.close();
    this.pc?.close();
    this.ws?.close();
    this.ws          = null;
    this.pc          = null;
    this.reliableDC  = null;
    this.fastDC      = null;
    this.reliableReady = false;
    this.fastReady     = false;
    this._peerReady    = false;
    this._gameStarted  = false;
  }

  get isConnected() { return this.fastDC?.readyState === 'open'; }
  get isSignalingConnected() { return this.ws?.readyState === WebSocket.OPEN; }

  private _sendWs(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
