import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { Game } from '../src/game/Game';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// ── HTTP 伺服器（Render 健康檢查 + CORS） ─────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const httpServer = createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS_HEADERS); res.end(); return; }
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
    res.end('OK');
    return;
  }
  res.writeHead(404, CORS_HEADERS);
  res.end();
});

// ── 型別定義 ──────────────────────────────────────────────
interface PlayerConn {
  ws: WebSocket;
  playerId: number;
  input: { x: number; y: number };
  lastTickId: number;
}

interface Room {
  code: string;
  players: PlayerConn[];
  game: Game | null;
  interval: ReturnType<typeof setInterval> | null;
}

// ── 房間管理 ──────────────────────────────────────────────
const rooms = new Map<string, Room>();

function generateCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

function broadcast(room: Room, data: string) {
  for (const p of room.players) {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(data);
  }
}

// ── 序列化遊戲狀態（壓縮鍵名 + TickID + HardSync flag） ──
function serializeState(game: Game, tick: number, hardSync: boolean) {
  return {
    t: 'ST',
    tk: tick,
    hs: hardSync || undefined,  // 只有 true 時才傳送（省頻寬）
    ps: game.players.map(p => ({
      id: p.id,
      x:  Math.round(p.x),
      y:  Math.round(p.y),
      hp: Math.round(p.hp),
      mh: p.maxHp,
      xp: p.xp,
      mx: p.maxXp,
      lv: p.level,
      pl: p.prestigeLevel,
      wp: p.weapon,
      aim: p.aimAngle,
      sh: p.shield,
    })),
    zs: game.zombies.map(z => ({
      x:  Math.round(z.x),
      y:  Math.round(z.y),
      hp: Math.round(z.hp),
      mh: z.maxHp,
      tp: z.type,
      ag: z.angle,
    })),
    pj: game.projectiles.map(p => ({
      x:  Math.round(p.x),
      y:  Math.round(p.y),
      vx: p.vx,
      vy: p.vy,
      tp: p.type,
      lv: p.level,
      lt: p.lifetime,
      ml: p.maxLifetime,
      en: p.isEnemy,
      r:  p.radius,
      oi: p.ownerId,
    })),
    it: game.items.map(i => ({
      x:  Math.round(i.x),
      y:  Math.round(i.y),
      tp: i.type,
      v:  i.value,
      c:  i.color,
    })),
    wv: {
      w: game.waveManager.currentWave,
      r: game.waveManager.isResting,
      t: Math.round(game.waveManager.timer),
      i: game.waveManager.isInfinite,
      m: game.waveManager.activeMechanics,
    },
  };
}

// ── 開始遊戲（60Hz 物理 + 30Hz 廣播 + TickID + HardSync） ─
function startRoom(room: Room) {
  room.game = new Game(
    2,
    (time, kills) => {
      broadcast(room, JSON.stringify({ t: 'GO', time, kills }));
      stopRoom(room);
    },
    () => {}
  );

  broadcast(room, JSON.stringify({ t: 'START' }));
  console.log(`[Room ${room.code}] Game started`);

  let lastTime = Date.now();
  let serverTick = 0;
  let prevWave = 1;
  let prevResting = false;

  room.interval = setInterval(() => {
    if (!room.game) return;

    serverTick++;
    const now = Date.now();
    const dt = Math.min(now - lastTime, 100); // 最大 dt 100ms，防跳幀
    lastTime = now;

    // 套用每位玩家輸入（binary 解碼後已存入 conn.input）
    for (const conn of room.players) {
      room.game.setJoystickInput(conn.playerId - 1, conn.input);
    }

    try {
      room.game.update(dt);

      // 30Hz 廣播（每 2 幀），偵測波次切換觸發 HardSync
      if (serverTick % 2 === 0) {
        const wm = room.game.waveManager;
        const hardSync = wm.currentWave !== prevWave || wm.isResting !== prevResting;
        if (hardSync) {
          prevWave = wm.currentWave;
          prevResting = wm.isResting;
          console.log(`[Room ${room.code}] HardSync wave=${wm.currentWave} rest=${wm.isResting}`);
        }
        const state = serializeState(room.game, serverTick, hardSync);
        broadcast(room, JSON.stringify(state));
      }
    } catch (e) {
      console.error(`[Room ${room.code}] Game error:`, e);
    }
  }, 16); // 60Hz
}

function stopRoom(room: Room) {
  if (room.interval) { clearInterval(room.interval); room.interval = null; }
  try { room.game?.destroy(); } catch (_) {}
  room.game = null;
  rooms.delete(room.code);
  console.log(`[Room ${room.code}] Closed`);
}

// ── WebSocket 伺服器 ───────────────────────────────────────
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

  let currentRoom: Room | null = null;
  let myPlayerId = 0;

  ws.on('message', (rawData) => {
    // ── Binary input 封包（6 bytes：TickID + dx_i8 + dy_i8）
    if (Buffer.isBuffer(rawData) && rawData.length === 6) {
      if (!currentRoom) return;
      const tickId = rawData.readUInt32BE(0);
      const dx     = rawData.readInt8(4) / 127;
      const dy     = rawData.readInt8(5) / 127;
      const conn   = currentRoom.players.find(p => p.ws === ws);
      if (conn) {
        conn.input     = { x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) };
        conn.lastTickId = tickId;
      }
      return;
    }

    // ── JSON 控制訊息（CREATE / JOIN）
    try {
      const msg = JSON.parse(rawData.toString());

      if (msg.t === 'CREATE') {
        let code = generateCode();
        while (rooms.has(code)) code = generateCode();

        const room: Room = { code, players: [], game: null, interval: null };
        rooms.set(code, room);
        currentRoom = room;
        myPlayerId  = 1;
        room.players.push({ ws, playerId: 1, input: { x: 0, y: 0 }, lastTickId: 0 });

        ws.send(JSON.stringify({ t: 'ROOM', code, pid: 1 }));
        console.log(`[Room ${code}] Created by P1`);

      } else if (msg.t === 'JOIN') {
        const code = String(msg.code ?? '').trim();
        const room = rooms.get(code);

        if (!room)                    { ws.send(JSON.stringify({ t: 'ERR', msg: '房間不存在，請確認代碼' })); return; }
        if (room.players.length >= 2) { ws.send(JSON.stringify({ t: 'ERR', msg: '房間已滿' })); return; }
        if (room.game)                { ws.send(JSON.stringify({ t: 'ERR', msg: '遊戲已開始' })); return; }

        currentRoom = room;
        myPlayerId  = 2;
        room.players.push({ ws, playerId: 2, input: { x: 0, y: 0 }, lastTickId: 0 });

        ws.send(JSON.stringify({ t: 'ROOM', code: room.code, pid: 2 }));
        console.log(`[Room ${code}] Joined by P2`);
        startRoom(room);
      }
    } catch (e) {
      console.error('WS message error:', e);
    }
  });

  ws.on('close', () => {
    if (currentRoom) {
      console.log(`[Room ${currentRoom.code}] P${myPlayerId} disconnected`);
      broadcast(currentRoom, JSON.stringify({ t: 'ERR', msg: '對手已斷線，遊戲結束' }));
      stopRoom(currentRoom);
      currentRoom = null;
    }
  });

  ws.on('error', (err) => { console.error('WS error:', err.message); });
});

httpServer.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT} (HTTP + WebSocket, 60Hz physics / 30Hz broadcast)`);
});
