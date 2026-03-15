import { WebSocketServer, WebSocket } from 'ws';
import { Game } from '../src/game/Game';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// ── 型別定義 ──────────────────────────────────────────────
interface PlayerConn {
  ws: WebSocket;
  playerId: number;
  input: { dx: number; dy: number };
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
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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
  }, 50); // 20Hz
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

// ── WebSocket 伺服器 ──────────────────────────────────────
const wss = new WebSocketServer({ port: PORT });
console.log(`🟢 WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
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
        room.players.push({ ws, playerId: 1, input: { dx: 0, dy: 0 } });

        ws.send(JSON.stringify({ t: 'ROOM', code, pid: 1 }));
        console.log(`[Room ${code}] Created by P1`);
      }

      // 加入房間
      else if (msg.t === 'JOIN') {
        const code = (msg.code as string)?.toUpperCase?.() ?? msg.code;
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
        room.players.push({ ws, playerId: 2, input: { dx: 0, dy: 0 } });

        ws.send(JSON.stringify({ t: 'ROOM', code: room.code, pid: 2 }));
        console.log(`[Room ${code}] Joined by P2`);
        startRoom(room);
      }

      // 玩家輸入
      else if (msg.t === 'IN' && currentRoom) {
        const conn = currentRoom.players.find(p => p.ws === ws);
        if (conn) {
          conn.input = {
            dx: Math.max(-1, Math.min(1, msg.dx ?? 0)),
            dy: Math.max(-1, Math.min(1, msg.dy ?? 0)),
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
