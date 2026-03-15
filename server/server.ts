import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { Game } from '../src/game/Game';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// ── HTTP 伺服器（Render 健康檢查 + 喚醒冷啟動） ───────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const httpServer = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }
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
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(data);
    }
  }
}

// ── 序列化遊戲狀態（壓縮鍵名節省頻寬） ───────────────────
function serializeState(game: Game) {
  return {
    t: 'ST',
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

// ── 開始遊戲 ──────────────────────────────────────────────
function startRoom(room: Room) {
  room.game = new Game(
    2,
    (time, kills) => {
      broadcast(room, JSON.stringify({ t: 'GO', time, kills }));
      stopRoom(room);
    },
    () => {}   // UI 回呼，伺服器不需要
  );

  broadcast(room, JSON.stringify({ t: 'START' }));
  console.log(`[Room ${room.code}] Game started`);

  let lastTime = Date.now();
  room.interval = setInterval(() => {
    if (!room.game) return;

    const now = Date.now();
    const dt = Math.min(now - lastTime, 100); // 最大 dt 100ms 防止跳幀
    lastTime = now;

    // 套用每位玩家的輸入
    for (const conn of room.players) {
      room.game.setJoystickInput(conn.playerId - 1, conn.input);
    }

    try {
      room.game.update(dt);
      broadcast(room, JSON.stringify(serializeState(room.game)));
    } catch (e) {
      console.error(`[Room ${room.code}] Game error:`, e);
    }
  }, 33); // ~30Hz
}

function stopRoom(room: Room) {
  if (room.interval) {
    clearInterval(room.interval);
    room.interval = null;
  }
  try { room.game?.destroy(); } catch (_) {}
  room.game = null;
  rooms.delete(room.code);
  console.log(`[Room ${room.code}] Closed`);
}

// ── WebSocket 伺服器（掛載在 HTTP 伺服器上） ─────────────
const wss = new WebSocketServer({ server: httpServer });

// Keepalive ping/pong（防止 Render 因閒置而斷線）
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const socket = ws as WebSocket & { isAlive?: boolean };
    if (socket.isAlive === false) { ws.terminate(); return; }
    socket.isAlive = false;
    ws.ping();
  });
}, 30_000);
wss.on('close', () => clearInterval(pingInterval));

wss.on('connection', (ws) => {
  (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
  ws.on('pong', () => { (ws as WebSocket & { isAlive?: boolean }).isAlive = true; });

  let currentRoom: Room | null = null;
  let myPlayerId = 0;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // 建立房間
      if (msg.t === 'CREATE') {
        let code = generateCode();
        while (rooms.has(code)) code = generateCode();

        const room: Room = { code, players: [], game: null, interval: null };
        rooms.set(code, room);
        currentRoom = room;
        myPlayerId = 1;
        room.players.push({ ws, playerId: 1, input: { x: 0, y: 0 } });

        ws.send(JSON.stringify({ t: 'ROOM', code, pid: 1 }));
        console.log(`[Room ${code}] Created by P1`);
      }

      // 加入房間
      else if (msg.t === 'JOIN') {
        const code = String(msg.code ?? '').trim();
        const room = rooms.get(code);

        if (!room) {
          ws.send(JSON.stringify({ t: 'ERR', msg: '房間不存在，請確認代碼' }));
          return;
        }
        if (room.players.length >= 2) {
          ws.send(JSON.stringify({ t: 'ERR', msg: '房間已滿' }));
          return;
        }
        if (room.game) {
          ws.send(JSON.stringify({ t: 'ERR', msg: '遊戲已開始' }));
          return;
        }

        currentRoom = room;
        myPlayerId = 2;
        room.players.push({ ws, playerId: 2, input: { x: 0, y: 0 } });

        ws.send(JSON.stringify({ t: 'ROOM', code: room.code, pid: 2 }));
        console.log(`[Room ${code}] Joined by P2`);
        startRoom(room);
      }

      // 玩家輸入
      else if (msg.t === 'IN' && currentRoom) {
        const conn = currentRoom.players.find(p => p.ws === ws);
        if (conn) {
          conn.input = {
            x: Math.max(-1, Math.min(1, msg.dx ?? 0)),
            y: Math.max(-1, Math.min(1, msg.dy ?? 0)),
          };
        }
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

  ws.on('error', (err) => {
    console.error('WS error:', err.message);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT} (HTTP + WebSocket)`);
});
