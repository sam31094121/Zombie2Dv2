// ── useGameLoop.ts ────────────────────────────────────────────────────────────
// requestAnimationFrame 遊戲主迴圈 + Host 廣播 + 復活管理
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useEffect } from 'react';
import { Game } from '../game/Game';
import { NetworkManager } from '../game/NetworkManager';

interface UseGameLoopOptions {
  gameRef: React.RefObject<Game | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  gameStateRef: React.MutableRefObject<'start' | 'playing' | 'gameover'>;
  networkRef: React.RefObject<NetworkManager | null>;
  // Host mode refs
  hostTickRef: React.MutableRefObject<number>;
  hostBroadcastTimer: React.MutableRefObject<number>;
  hostPrevWave: React.MutableRefObject<number>;
  hostPrevResting: React.MutableRefObject<boolean>;
  hostRespawnTimers: React.MutableRefObject<Map<number, number>>;
  // Respawn countdown
  p1RespawnRef: React.MutableRefObject<number>;
  p2RespawnRef: React.MutableRefObject<number>;
  setP1RespawnCountdown: (n: number) => void;
  setP2RespawnCountdown: (n: number) => void;
}

export function useGameLoop(opts: UseGameLoopOptions) {
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const {
    gameRef, canvasRef, gameStateRef, networkRef,
    hostTickRef, hostBroadcastTimer, hostPrevWave, hostPrevResting, hostRespawnTimers,
    p1RespawnRef, p2RespawnRef, setP1RespawnCountdown, setP2RespawnCountdown,
  } = opts;

  // Defined as a standalone function ref to allow recursive rAF call
  const gameLoopRef = useRef<(time: number) => void>();

  gameLoopRef.current = (time: number) => {
    if (gameStateRef.current !== 'playing') return;
    const rawDt = time - lastTimeRef.current;
    lastTimeRef.current = time;
    // 背景分頁恢復保護 — dt 超過 250ms 觸發 HardSync
    const dt = Math.min(rawDt, 250);
    if (rawDt > 250 && gameRef.current?.networkMode) {
      gameRef.current.triggerHardSync();
    }

    if (gameRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        gameRef.current.update(dt);
        gameRef.current.draw(ctx);

        // ── Host 模式：序列化狀態送給 P2 + 處理 P2 復活 ──
        if (gameRef.current.isHostMode && networkRef.current) {
          const game = gameRef.current;
          const nm   = networkRef.current;
          const now  = Date.now();

          const wm = game.waveManager;
          const hardSync = wm.currentWave !== hostPrevWave.current ||
                           wm.isResting   !== hostPrevResting.current;
          if (hardSync) {
            hostPrevWave.current    = wm.currentWave;
            hostPrevResting.current = wm.isResting;
          }

          hostBroadcastTimer.current += dt;
          if (hostBroadcastTimer.current >= 16 || hardSync) {
            hostBroadcastTimer.current = 0;
            nm.sendGameState(game.serializeState(hostTickRef.current++, hardSync));
          }

          // 復活管理
          const alive = game.players.filter(pl => pl.hp > 0);
          for (const p of game.players) {
            if (p.hp <= 0 && !hostRespawnTimers.current.has(p.id) && alive.length > 0) {
              hostRespawnTimers.current.set(p.id, now);
              nm.sendControl({ t: 'RESPAWN_START', pid: p.id, dur: 10000 });
            }
          }
          for (const [pid2, deathTime] of hostRespawnTimers.current) {
            const elapsed   = now - deathTime;
            const remaining = Math.max(0, Math.ceil((10000 - elapsed) / 1000));
            if (pid2 === 1 && remaining !== p1RespawnRef.current) {
              p1RespawnRef.current = remaining; setP1RespawnCountdown(remaining);
            }
            if (pid2 === 2 && remaining !== p2RespawnRef.current) {
              p2RespawnRef.current = remaining; setP2RespawnCountdown(remaining);
            }
            if (elapsed >= 10000) {
              hostRespawnTimers.current.delete(pid2);
              const dead     = game.players.find(p => p.id === pid2);
              const aliveNow = game.players.find(p => p.id !== pid2 && p.hp > 0);
              if (dead && aliveNow) {
                const angle = Math.random() * Math.PI * 2;
                dead.x = aliveNow.x + Math.cos(angle) * 60;
                dead.y = aliveNow.y + Math.sin(angle) * 60;
                dead.hp = dead.maxHp;
                dead.shield = true;
                nm.sendControl({ t: 'RESPAWNED', pid: pid2 });
              }
              if (pid2 === 1) { p1RespawnRef.current = 0; setP1RespawnCountdown(0); }
              if (pid2 === 2) { p2RespawnRef.current = 0; setP2RespawnCountdown(0); }
            }
          }
        }
      }
    }

    if (gameStateRef.current === 'playing' && !gameRef.current?.isGameOver) {
      requestRef.current = requestAnimationFrame(gameLoopRef.current!);
    }
  };

  const startLoop = () => {
    lastTimeRef.current = performance.now();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(gameLoopRef.current!);
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return { requestRef, lastTimeRef, startLoop };
}
