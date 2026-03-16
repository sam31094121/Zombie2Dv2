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
  latencyMs: number;     // Feature 5: Estimated one-way latency (ms)
}

interface Room {
  code: string;
  players: PlayerConn[];
  game: Game | null;
  interval: ReturnType<typeof setInterval> | null;
  readyStates: boolean[];               // [p1Ready, p2Ready] for rematch
  respawnTimers: Map<number, number>;   // playerId → death timestamp
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
      id: z.id,             // Feature 3/6: Stable ID for client-side ID-based matching
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

// ── 開始/重開遊戲（60Hz 物理 + 30Hz 廣播 + TickID + HardSync + 復活 + 重賽） ─
function startRoom(room: Room) {
  // 重置復活 & 準備狀態
  room.readyStates = [false, false];
  room.respawnTimers = new Map();

  room.game = new Game(
    2,
    (time, kills) => {
      // 兩人都死亡 → 發送遊戲結束，但保留房間等待重賽
      broadcast(room, JSON.stringify({ t: 'GO', time, kills }));
      if (room.interval) { clearInterval(room.interval); room.interval = null; }
      try { room.game?.destroy(); } catch (_) {}
      room.game = null;
      room.readyStates = [false, false];
      room.respawnTimers = new Map();
      console.log(`[Room ${room.code}] Game over — waiting for rematch`);
    },
    () => {}
  );

  broadcast(room, JSON.stringify({ t: 'START' }));
  console.log(`[Room ${room.code}] Game started`);

  let lastTime = Date.now();
  let serverTick = 0;
  let prevWave = 1;
  let prevResting = false;
  // Feature 1: Deterministic tick accumulator (fixed dt = 16ms, max 3 ticks per interval)
  let accumulator = 0;
  const FIXED_DT = 16;

  room.interval = setInterval(() => {
    if (!room.game) return;

    const now = Date.now();
    const elapsed = Math.min(now - lastTime, 100);
    lastTime = now;

    // Fix 3 — Accumulator safety valve: if server falls >5 ticks behind, reset to 1 tick.
    // Prevents death spiral: Render.com CPU throttle → burst of 3 ticks → more CPU load → worse throttle.
    if (accumulator > FIXED_DT * 5) {
      console.warn(`[Room ${room.code}] Accumulator reset (${accumulator.toFixed(0)}ms) — CPU throttle detected`);
      accumulator = FIXED_DT;
    }
    // Feature 1: Run physics at deterministic fixed timestep
    accumulator += elapsed;
    let ticksRan = 0;
    while (accumulator >= FIXED_DT && ticksRan < 3) {
      if (!room.game) break;  // onGameOver may have set room.game = null mid-loop
      serverTick++;
      for (const conn of room.players) {
        room.game.setJoystickInput(conn.playerId - 1, conn.input);
      }
      try {
        room.game.update(FIXED_DT);
      } catch (e) {
        console.error(`[Room ${room.code}] Game error:`, e);
      }
      accumulator -= FIXED_DT;
      ticksRan++;
    }

    if (ticksRan === 0 || !room.game) return;

    // ── 復活邏輯 ──────────────────────────────────────────
    const alivePlayers = room.game.players.filter(p => p.hp > 0);
    for (const p of room.game.players) {
      if (p.hp <= 0 && !room.respawnTimers.has(p.id) && alivePlayers.length > 0) {
        room.respawnTimers.set(p.id, now);
        broadcast(room, JSON.stringify({ t: 'RESPAWN_START', pid: p.id, dur: 10000 }));
        console.log(`[Room ${room.code}] P${p.id} died — respawn in 10s`);
      }
    }
    for (const [pid, deathTime] of room.respawnTimers) {
      if (now - deathTime >= 10000) {
        room.respawnTimers.delete(pid);
        const dead  = room.game.players.find(p => p.id === pid);
        const alive = room.game.players.find(p => p.id !== pid && p.hp > 0);
        if (dead && alive) {
          const angle = Math.random() * Math.PI * 2;
          dead.x = alive.x + Math.cos(angle) * 60;
          dead.y = alive.y + Math.sin(angle) * 60;
          dead.hp = dead.maxHp;
          dead.shield = true;
          broadcast(room, JSON.stringify({ t: 'RESPAWNED', pid }));
          console.log(`[Room ${room.code}] P${pid} respawned`);
        }
      }
    }

    // Feature 5: Lag compensation — feed per-player latency into game for backward reconciliation
    for (const conn of room.players) {
      room.game.playerLatencies.set(conn.playerId, conn.latencyMs);
    }
    const avgLatency = room.players.reduce((sum, p) => sum + p.latencyMs, 0)
      / Math.max(1, room.players.length);
    room.game.lagCompensationRadius = Math.min(avgLatency * 0.3, 40);

    // Fix 1 — Adaptive broadcast rate:
    // ≤30 zombies → 60Hz (low latency priority)
    // >30 zombies → 30Hz (CPU/bandwidth relief — JSON grows linearly with zombie count,
    //               100 zombies × 60Hz = ~480KB/s JSON parsing on client → frame drops)
    const zombieCount = room.game.zombies.length;
    const broadcastEvery = zombieCount > 30 ? 2 : 1;
    const wm = room.game.waveManager;
    const hardSync = wm.currentWave !== prevWave || wm.isResting !== prevResting;
    if (hardSync) {
      prevWave = wm.currentWave;
      prevResting = wm.isResting;
      console.log(`[Room ${room.code}] HardSync wave=${wm.currentWave} rest=${wm.isResting}`);
    }
    if (serverTick % broadcastEvery === 0 || hardSync) {
      const state = serializeState(room.game, serverTick, hardSync);
      broadcast(room, JSON.stringify(state));
    }
  }, 16);
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
    // ── Feature 5: Binary input 封包（8 bytes：TickID + clientTs_u16 + dx_i8 + dy_i8）
    if (Buffer.isBuffer(rawData) && rawData.length === 8) {
      if (!currentRoom) return;
      const tickId   = rawData.readUInt32BE(0);
      const clientTs = rawData.readUInt16BE(4);         // 16-bit truncated ms timestamp
      const dx       = rawData.readInt8(6) / 127;
      const dy       = rawData.readInt8(7) / 127;
      // RTT estimation: compare server time (16-bit) vs client timestamp
      const now16    = Date.now() & 0xFFFF;
      const rttMs    = (now16 - clientTs + 65536) & 0xFFFF;  // handle wrap-around
      const conn     = currentRoom.players.find(p => p.ws === ws);
      if (conn) {
        conn.input      = { x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) };
        conn.lastTickId = tickId;
        // Smooth latency update (exponential moving average, α=0.1)
        conn.latencyMs  = conn.latencyMs * 0.9 + Math.min(rttMs * 0.5, 300) * 0.1;
      }
      return;
    }

    // ── JSON 控制訊息（CREATE / JOIN）
    try {
      const msg = JSON.parse(rawData.toString());

      if (msg.t === 'CREATE') {
        let code = generateCode();
        while (rooms.has(code)) code = generateCode();

        const room: Room = { code, players: [], game: null, interval: null, readyStates: [false, false], respawnTimers: new Map() };
        rooms.set(code, room);
        currentRoom = room;
        myPlayerId  = 1;
        room.players.push({ ws, playerId: 1, input: { x: 0, y: 0 }, lastTickId: 0, latencyMs: 0 });

        ws.send(JSON.stringify({ t: 'ROOM', code, pid: 1 }));
        console.log(`[Room ${code}] Created by P1`);

      } else if (msg.t === 'READY') {
        // 重賽準備（遊戲結束後雙方都按準備才重開）
        if (!currentRoom || currentRoom.game) return; // 只有遊戲結束後才允許
        const idx = myPlayerId - 1;
        currentRoom.readyStates[idx] = true;
        broadcast(currentRoom, JSON.stringify({ t: 'PLAYER_READY', pid: myPlayerId }));
        console.log(`[Room ${currentRoom.code}] P${myPlayerId} ready`);
        if (currentRoom.readyStates.every(r => r)) {
          startRoom(currentRoom); // 兩人都準備 → 重開
        }

      } else if (msg.t === 'JOIN') {
        const code = String(msg.code ?? '').trim();
        const room = rooms.get(code);

        if (!room)                    { ws.send(JSON.stringify({ t: 'ERR', msg: '房間不存在，請確認代碼' })); return; }
        if (room.players.length >= 2) { ws.send(JSON.stringify({ t: 'ERR', msg: '房間已滿' })); return; }
        if (room.game)                { ws.send(JSON.stringify({ t: 'ERR', msg: '遊戲已開始' })); return; }

        currentRoom = room;
        myPlayerId  = 2;
        room.players.push({ ws, playerId: 2, input: { x: 0, y: 0 }, lastTickId: 0, latencyMs: 0 });

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
