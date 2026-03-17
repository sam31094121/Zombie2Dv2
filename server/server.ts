import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// ── HTTP 伺服器（Render 健康檢查 + CORS） ─────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// ── CPU 使用率量測 ────────────────────────────────────────
let _cpuSnapshot = process.cpuUsage();
let _cpuWallMs   = Date.now();
let _cpuPercent  = 0;

setInterval(() => {
  const now    = Date.now();
  const usage  = process.cpuUsage(_cpuSnapshot);
  const wallMs = now - _cpuWallMs;
  _cpuPercent  = ((usage.user + usage.system) / 1000) / wallMs * 100;
  _cpuSnapshot = process.cpuUsage();
  _cpuWallMs   = now;
  const mem = process.memoryUsage();
  console.log(
    `[Monitor] CPU: ${_cpuPercent.toFixed(1)}%  ` +
    `RAM: ${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB  ` +
    `Rooms: ${rooms.size}`
  );
}, 30_000);

const httpServer = createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS_HEADERS); res.end(); return; }
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
    res.end('OK');
    return;
  }
  if (req.url === '/metrics') {
    const mem = process.memoryUsage();
    const payload = JSON.stringify({
      cpu_pct:  +_cpuPercent.toFixed(1),
      heap_mb:  +(mem.heapUsed  / 1024 / 1024).toFixed(1),
      rss_mb:   +(mem.rss       / 1024 / 1024).toFixed(1),
      rooms:    rooms.size,
    });
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(payload);
    return;
  }
  res.writeHead(404, CORS_HEADERS);
  res.end();
});

// ── 型別定義 ──────────────────────────────────────────────
interface SignalConn {
  ws: WebSocket;
  playerId: number;
}

interface SignalRoom {
  code: string;
  players: SignalConn[];
}

// ── 房間管理 ──────────────────────────────────────────────
const rooms = new Map<string, SignalRoom>();

function generateCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

// ── WebSocket 信令伺服器 ───────────────────────────────────
// 職責：房間配對 + WebRTC OFFER/ANSWER/ICE Trickle 轉發
// 遊戲物理改由 Host（P1）瀏覽器直接跑，CPU 消耗轉移到客戶端
const wss = new WebSocketServer({ server: httpServer });

// Keepalive ping/pong（防 Render 閒置斷線）
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const s = ws as WebSocket & { isAlive?: boolean };
    if (s.isAlive === false) { ws.terminate(); return; }
    s.isAlive = false;
    ws.ping();
  });
}, 30_000);
wss.on('close', () => clearInterval(pingInterval));

wss.on('connection', (ws) => {
  (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
  ws.on('pong', () => { (ws as WebSocket & { isAlive?: boolean }).isAlive = true; });

  let currentRoom: SignalRoom | null = null;
  let myPlayerId = 0;

  ws.on('message', (rawData) => {
    try {
      const msg = JSON.parse(rawData.toString());

      // ── CREATE：P1 建立房間 ──────────────────────────────
      if (msg.t === 'CREATE') {
        let code = generateCode();
        while (rooms.has(code)) code = generateCode();

        const room: SignalRoom = { code, players: [] };
        rooms.set(code, room);
        currentRoom = room;
        myPlayerId  = 1;
        room.players.push({ ws, playerId: 1 });

        ws.send(JSON.stringify({ t: 'ROOM', code, pid: 1 }));
        console.log(`[Room ${code}] Created by P1`);

      // ── JOIN：P2 加入房間，通知 P1 啟動 WebRTC ──────────
      } else if (msg.t === 'JOIN') {
        const code = String(msg.code ?? '').trim();
        const room = rooms.get(code);

        if (!room)                    { ws.send(JSON.stringify({ t: 'ERR', msg: '房間不存在，請確認代碼' })); return; }
        if (room.players.length >= 2) { ws.send(JSON.stringify({ t: 'ERR', msg: '房間已滿' })); return; }

        currentRoom = room;
        myPlayerId  = 2;
        room.players.push({ ws, playerId: 2 });

        ws.send(JSON.stringify({ t: 'ROOM', code: room.code, pid: 2 }));
        console.log(`[Room ${code}] Joined by P2`);

        // 通知 P1（Caller）P2 已加入 → P1 開始建立 WebRTC
        const p1 = room.players.find(p => p.playerId === 1);
        if (p1 && p1.ws.readyState === WebSocket.OPEN) {
          p1.ws.send(JSON.stringify({ t: 'PEER_JOINED' }));
        }

      // ── OFFER / ANSWER / ICE：純轉發給房間另一方 ────────
      } else if (msg.t === 'OFFER' || msg.t === 'ANSWER' || msg.t === 'ICE') {
        if (!currentRoom) return;
        const other = currentRoom.players.find(p => p.playerId !== myPlayerId);
        if (other && other.ws.readyState === WebSocket.OPEN) {
          other.ws.send(JSON.stringify(msg));
        }
      }

    } catch (e) {
      console.error('WS message error:', e);
    }
  });

  ws.on('close', () => {
    if (currentRoom) {
      console.log(`[Room ${currentRoom.code}] P${myPlayerId} disconnected`);
      const other = currentRoom.players.find(p => p.playerId !== myPlayerId);
      if (other && other.ws.readyState === WebSocket.OPEN) {
        other.ws.send(JSON.stringify({ t: 'ERR', msg: '對手已斷線' }));
      }
      rooms.delete(currentRoom.code);
      currentRoom = null;
    }
  });

  ws.on('error', (err) => { console.error('WS error:', err.message); });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Signaling server running on port ${PORT} (WebRTC P2P)`);
});
