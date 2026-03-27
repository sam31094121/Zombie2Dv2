// ?? 隡箸??典誨?剔????????????????????????????????????
export interface NetPlayerState {
  id: number; x: number; y: number;
  hp: number; mh: number;
  xp: number; mx: number;
  lv: number; pl: number;
  wp: string; aim: number; sh: boolean; st?: number;
  sl: number;  // slowDebuffTimer嚗s嚗??郊蝯?P2 靽?皜?皜砌???
}

export interface NetGameState {
  t: 'ST';
  tk: number;       // TickID
  hs?: boolean;     // HardSync flag嚗郭甈∪?????true嚗?
  ts: number;       // 瘥????喉?靘??潸????⊥迤嚗?
  ack: number;      // Host ?敺Ⅱ隤? P2 input tick嚗econciliation ?剁?
  ps: NetPlayerState[];
  zs: { id: number; x: number; y: number; hp: number; mh: number; tp: string; ag: number }[];
  pj: { x: number; y: number; vx: number; vy: number; tp: string; lv: number; lt: number; ml: number; en: boolean; r: number; oi: number }[];
  it: { x: number; y: number; tp: string; v?: number; c?: string }[];
  wv: { w: number; r: boolean; t: number; i: boolean; m: string[] };
}

// ?? STUN 隡箸??剁?Google ?祥嚗? NAT 蝛輸? ??????????????
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ?? NetworkManager嚗恣??WebSocket 靽∩誘 + WebRTC DataChannel ?
export class NetworkManager {
  private ws:           WebSocket | null = null;
  private pc:           RTCPeerConnection | null = null;
  private reliableDC:   RTCDataChannel | null = null; // ordered, reliable ???鈭辣
  private fastDC:       RTCDataChannel | null = null; // unordered, unreliable ??蝘餃?/???

  private reliableReady = false;
  private fastReady     = false;
  private _peerReady    = false;   // ?嗅撠??DC_READY
  private _peerConnected = false;  // 雙向 DataChannel 都 ready
  private _gameStarted  = false;   // ?脫迫??閫貊 onGameStart
  private _isHost       = false;   // P1 = Host/Caller, P2 = Client/Callee

  private sendTick = 0;

  // ?? ?鈭辣嚗??Ｚ????詨?嚗??函?撘Ⅳ?⊿??孵?嚗??????
  onRoomJoined:    ((code: string, playerId: number) => void) | null = null;
  onPeerConnected: (() => void) | null = null;
  onGameStart:     ((mode?: 'endless' | 'arena') => void) | null = null;
  onStateUpdate:   ((state: NetGameState) => void) | null = null;
  onGameOver:      ((time: number, kills: number) => void) | null = null;
  onError:         ((msg: string) => void) | null = null;
  onDisconnect:    (() => void) | null = null;
  onRespawnStart:  ((pid: number, duration: number) => void) | null = null;
  onRespawned:     ((pid: number) => void) | null = null;
  onPlayerReady:   ((pid: number) => void) | null = null;
  // Host ?交 P2 ?宏?撓?伐???inputTick 靘?Reconciliation嚗?
  onRemoteInput:   ((dx: number, dy: number, tick: number) => void) | null = null;

  get isHost() { return this._isHost; }

  // ?? 撱箇? WebSocket 靽∩誘??? ??????????????????????????????
  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.onopen  = () => resolve();
        this.ws.onerror = (e) => { console.error('WS error:', e); reject(new Error('?⊥?????唬撩?')); };
        this.ws.onclose = () => {
          // ?芸 DataChannel 撠撱箇???閫貊?瑞?嚗??脖葉 WS ?航?園???
          if (!this._gameStarted) this.onDisconnect?.();
        };
        this.ws.onmessage = (e) => this._handleWsMsg(e.data as string);
      } catch (e) { reject(e); }
    });
  }

  // ?? WebSocket 靽∩誘閮?? ????????????????????????????????
  private _handleWsMsg(data: string) {
    try {
      const msg = JSON.parse(data);
      switch (msg.t) {
        case 'ROOM':
          this.onRoomJoined?.(msg.code, msg.pid);
          break;
        case 'PEER_JOINED':
          // P2 ??輸? ??P1嚗ost/Caller嚗?憪遣蝡?WebRTC
          if (this._isHost) this._startAsHost();
          break;
        case 'OFFER':
          // P2嚗allee嚗??Offer
          this._handleOffer(msg.offer);
          break;
        case 'ANSWER':
          // P1嚗aller嚗??Answer
          this.pc?.setRemoteDescription(new RTCSessionDescription(msg.answer)).catch(console.error);
          break;
        case 'ICE':
          // ICE Trickle嚗??Ｙ????伐?銝??券?園?摰?????漲敹?2?? 蝘?
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

  // ?? 撱箇??輸?嚗1/Host/Caller嚗????????????????????????????
  createRoom() {
    this._isHost = true;
    this._sendWs({ t: 'CREATE' });
  }

  // ?? ??輸?嚗2/Client/Callee嚗??????????????????????????
  joinRoom(code: string) {
    this._isHost = false;
    this._sendWs({ t: 'JOIN', code: code.trim() });
  }

  // ?? P1嚗ost/Caller嚗?撱箇? RTCPeerConnection + DataChannel ?
  private async _startAsHost() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this._setupPCHandlers();

    // ??嚗??Caller ?澆 createDataChannel
    // P2嚗allee嚗??? ondatachannel ?交嚗??航撌勗遣蝡?
    this.reliableDC = this.pc.createDataChannel('reliable', { ordered: true });
    this.fastDC     = this.pc.createDataChannel('fast',     { ordered: false, maxRetransmits: 0 });

    this._setupDataChannel(this.reliableDC, 'reliable');
    this._setupDataChannel(this.fastDC,     'fast');

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this._sendWs({ t: 'OFFER', offer: this.pc.localDescription });
  }

  // ?? P2嚗lient/Callee嚗??嗅 Offer 撱箇???? ????????????
  private async _handleOffer(offer: RTCSessionDescriptionInit) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this._setupPCHandlers();

    // P2 ?? ondatachannel ?交 Caller 撱箇???DataChannel
    // 銝?芸楛?澆 createDataChannel嚗?銝???channel
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

  // ?? RTCPeerConnection ?鈭辣 ????????????????????????????
  private _setupPCHandlers() {
    if (!this.pc) return;

    // ICE Trickle嚗??Ｙ?銝??candidate 撠梁??駁嚗?蝑?冽??
    this.pc.onicecandidate = (e) => {
      if (e.candidate) this._sendWs({ t: 'ICE', candidate: e.candidate });
    };

    // P2P ??????改??瑞??菜葫嚗?
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log(`[WebRTC] Connection state: ${state}`);
      if ((state === 'disconnected' || state === 'failed') && this._gameStarted) {
        this.onDisconnect?.();
      }
    };
  }

  // ?? DataChannel 鈭辣閮剖? ??????????????????????????????????
  private _setupDataChannel(ch: RTCDataChannel, label: 'reliable' | 'fast') {
    ch.binaryType = 'arraybuffer';

    ch.onopen = () => {
      console.log(`[WebRTC] DataChannel "${label}" open`);
      if (label === 'reliable') {
        this.reliableReady = true;
        // ?舫??駁???敺??餌??Ⅱ隤???
        // ??嚗?嗅撠??DC_READY 銋?蝯?銝??脰???
        ch.send(JSON.stringify({ t: 'DC_READY' }));
      }
      if (label === 'fast') {
        this.fastReady = true;
      }
      this._checkBothReady();
    };

    ch.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        // Binary 蝘餃?頛詨嚗? bytes嚗??Host ??唬???P2 ??
        if (e.data.byteLength === 8) {
          const view      = new DataView(e.data);
          const inputTick = view.getUint32(0, false);   // bytes 0-3嚗2 ?砍 tick
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
      // reliable ?駁??? = 撠?瑞?
      if (label === 'reliable' && this._gameStarted) {
        this.onDisconnect?.();
      }
    };
  }

  // ?? DataChannel 閮?? ??????????????????????????????????
  private _handleDCMsg(msg: any) {
    switch (msg.t) {
      case 'DC_READY':
        // ?嗅撠??Ⅱ隤?????賣??末鈭?
        this._peerReady = true;
        this._checkBothReady();
        break;
      case 'START':
        // Host ? P2 ???嚗?憪??魚嚗?
        if (!this._isHost && !this._gameStarted) {
          this._gameStarted = true;
          this.onGameStart?.(msg.mode);
        } else if (!this._isHost && this._gameStarted) {
          // ?魚嚗?閮剔??????onGameStart
          this.onGameStart?.(msg.mode);
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

  // ?? ?? Ready 蝣箄?嚗???? + ?嗅撠?⊥?嚗????
  // ??嚗???隞嗆遛頞喃???銝?遙雿??脰????血? Script 撏拇蔑
  private _checkBothReady() {
    if (!this.reliableReady || !this.fastReady || !this._peerReady || this._peerConnected) return;
    this._peerConnected = true;
    this.onPeerConnected?.();
  }

  // ?? 撠?隞嚗?宏?撓?伐?P2 ?策 Host嚗?-byte binary嚗?
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

  // ?? 撠?隞嚗ost ?喲??脩??策 P2嚗ast channel嚗????
  sendGameState(state: object) {
    if (!this.fastDC || this.fastDC.readyState !== 'open') return;
    this.fastDC.send(JSON.stringify(state));
  }

  // ?? 撠?隞嚗??嗉??荔?reliable channel嚗??????????
  // ?冽嚗O?ESPAWN_START?ESPAWNED?LAYER_READY?TART嚗?鞈踝?
  sendControl(msg: object) {
    if (!this.reliableDC || this.reliableDC.readyState !== 'open') return;
    if ((msg as any)?.t === 'START') this._gameStarted = true;
    this.reliableDC.send(JSON.stringify(msg));
  }

  // ?? 撠?隞嚗?鞈賣???????????????????????????????????????
  sendReady() {
    this.sendControl({ t: 'PLAYER_READY', pid: this._isHost ? 1 : 2 });
  }

  // ?? ?瑞?皜? ?????????????????????????????????????????????
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
    this._peerConnected = false;
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

