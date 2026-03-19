// ── GameUI.tsx ─────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { Game } from '../game/Game';
import { CONSTANTS } from '../game/Constants';
import { Player } from '../game/Player';
import { audioManager } from '../game/AudioManager';
import { Joystick } from './Joystick';
import { NetworkManager } from '../game/NetworkManager';
import { useGameLoop } from '../hooks/useGameLoop';
import { StartScreen } from './screens/StartScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { P1Card } from './hud/P1Card';
import { P2Card } from './hud/P2Card';
import { WaveDisplay } from './hud/WaveDisplay';
import { TestModePanel } from './debug/TestModePanel';
import { UpgradePanel, UpgradeCard } from './UpgradePanel';
import { LobbyCanvas } from './lobby/LobbyCanvas';

const WS_URL = (import.meta as any).env?.VITE_WS_URL ?? 'ws://localhost:3001';

export const GameUI: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'start' | 'lobby' | 'playing' | 'gameover'>('start');
  const [gameStats, setGameStats] = useState({ time: 0, kills: 0 });
  const [p1State, setP1State] = useState<Player | null>(null);
  const [p2State, setP2State] = useState<Player | null>(null);
  const [waveState, setWaveState] = useState<{ wave: number; isResting: boolean; timer: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const gameRef = useRef<Game | null>(null);
  const gameStateRef = useRef<'start' | 'lobby' | 'playing' | 'gameover'>('start');

  // ── 線上模式狀態 ──────────────────────────────────────────
  const [selectionStep, setSelectionStep] = useState<'platform' | 'players' | 'online'>('platform');
  const [onlineStep, setOnlineStep] = useState<'menu' | 'waiting' | 'joining'>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [onlineError, setOnlineError] = useState('');
  const [myPlayerId, setMyPlayerId] = useState(1);
  const networkRef = useRef<NetworkManager | null>(null);

  const [playerCount, setPlayerCount] = useState<number>(1);
  const [platform, setPlatform] = useState<'pc' | 'mobile' | null>(null);

  // ── 復活倒計時 ────────────────────────────────────────────
  const [p1RespawnCountdown, setP1RespawnCountdown] = useState(0);
  const [p2RespawnCountdown, setP2RespawnCountdown] = useState(0);
  const p1RespawnRef = useRef(0);
  const p2RespawnRef = useRef(0);

  // ── 重賽準備狀態 ──────────────────────────────────────────
  const [readyState, setReadyState] = useState({ myReady: false, otherReady: false });
  const readyRef = useRef({ myReady: false, otherReady: false });

  // Client（P2）端復活計時器
  const clientRespawnEndTimes = useRef<Map<number, number>>(new Map());
  const clientRespawnInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── UI 更新節流 ────────────────────────────────────────────
  const uiFrameRef = useRef(0);

  // ── Host 模式專用 refs ────────────────────────────────────
  const hostTickRef        = useRef(0);
  const hostBroadcastTimer = useRef(0);
  const hostPrevWave       = useRef(1);
  const hostPrevResting    = useRef(false);
  const hostRespawnTimers  = useRef<Map<number, number>>(new Map());

  // ── rAF 遊戲主迴圈 Hook ───────────────────────────────────
  const { startLoop } = useGameLoop({
    gameRef, canvasRef, gameStateRef, networkRef,
    hostTickRef, hostBroadcastTimer, hostPrevWave, hostPrevResting, hostRespawnTimers,
    p1RespawnRef, p2RespawnRef, setP1RespawnCountdown, setP2RespawnCountdown,
  });

  // ── 視窗大小 ──────────────────────────────────────────────
  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth || 800;
      const height = window.innerHeight || 600;
      const aspect = width / height;
      const MIN_DIMENSION = 800;
      if (!isFinite(aspect) || isNaN(aspect) || aspect <= 0) {
        setDimensions({ width: 800, height: 600 });
        return;
      }
      if (aspect > 1) {
        CONSTANTS.CANVAS_HEIGHT = MIN_DIMENSION;
        CONSTANTS.CANVAS_WIDTH = MIN_DIMENSION * aspect;
      } else {
        CONSTANTS.CANVAS_WIDTH = MIN_DIMENSION;
        CONSTANTS.CANVAS_HEIGHT = MIN_DIMENSION / aspect;
      }
      setDimensions({ width: CONSTANTS.CANVAS_WIDTH, height: CONSTANTS.CANVAS_HEIGHT });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // ── HUD 更新 callback（共用）──────────────────────────────
  const makeOnUpdate = () => (p1: Player | null, p2: Player | null, waveManager: any) => {
    if (++uiFrameRef.current % 6 !== 0) return;
    setP1State(p1 ? { ...p1 } as Player : null);
    setP2State(p2 ? { ...p2 } as Player : null);
    setWaveState({
      wave: waveManager.currentWave,
      isResting: waveManager.isResting,
      timer: Math.ceil(waveManager.timer),
    });
  };

  // ── 本地遊戲開始 ──────────────────────────────────────────
  // 從大廳傳送門觸發，帶入難度
  const startGame = (count: number, _difficulty: 'normal' | 'hard' | 'infinite' = 'normal') => {
    setPlayerCount(count);
    audioManager.init();
    audioManager.resume();
    audioManager.startBGM();

    if (gameRef.current) gameRef.current.destroy();
    uiFrameRef.current = 0;
    hostRespawnTimers.current = new Map();
    p1RespawnRef.current = 0; setP1RespawnCountdown(0);
    p2RespawnRef.current = 0; setP2RespawnCountdown(0);

    gameRef.current = new Game(
      count,
      (time, kills) => { setGameStats({ time, kills }); setGameState('gameover'); audioManager.stopBGM(); },
      makeOnUpdate(),
    );

    setGameState('playing');
    startLoop();
  };

  // StartScreen → 進大廳（單人/雙人本地）
  const enterLobby = (count: number) => {
    setPlayerCount(count);
    audioManager.init();
    audioManager.resume();
    setGameState('lobby');
  };

  // ── 線上遊戲開始 ──────────────────────────────────────────
  const startOnlineGame = (nm: NetworkManager, pid: number) => {
    audioManager.init();
    audioManager.resume();
    audioManager.startBGM();

    if (clientRespawnInterval.current) { clearInterval(clientRespawnInterval.current); clientRespawnInterval.current = null; }
    clientRespawnEndTimes.current = new Map();
    p1RespawnRef.current = 0; setP1RespawnCountdown(0);
    p2RespawnRef.current = 0; setP2RespawnCountdown(0);
    readyRef.current = { myReady: false, otherReady: false };
    setReadyState({ myReady: false, otherReady: false });
    uiFrameRef.current = 0;

    hostTickRef.current        = 0;
    hostBroadcastTimer.current = 0;
    hostPrevWave.current       = 1;
    hostPrevResting.current    = false;
    hostRespawnTimers.current  = new Map();

    if (gameRef.current) gameRef.current.destroy();

    const game = new Game(
      2,
      (time, kills) => {
        setGameStats({ time, kills });
        setGameState('gameover');
        audioManager.stopBGM();
        if (pid === 1) nm.sendControl({ t: 'GO', time, kills });
      },
      makeOnUpdate(),
    );

    if (pid === 1) {
      game.isHostMode = true;
      nm.onRemoteInput = (dx, dy, tick) => {
        game.setJoystickInput(1, { x: dx, y: dy });
        game.hostLastAckTick = tick;   // 記錄最後確認的 P2 tick
      };
    } else {
      game.networkMode     = true;
      game.networkPlayerId = 2;
      game.onSendInput     = (dx, dy) => nm.sendInput(dx, dy);

      nm.onStateUpdate = (state) => { game.applyNetworkState(state); };
      nm.onGameOver = (time, kills) => {
        setGameStats({ time, kills }); setGameState('gameover'); audioManager.stopBGM();
      };

      nm.onRespawnStart = (respawnPid, duration) => {
        const endsAt = Date.now() + duration;
        clientRespawnEndTimes.current.set(respawnPid, endsAt);
        if (!clientRespawnInterval.current) {
          clientRespawnInterval.current = setInterval(() => {
            const now2 = Date.now();
            for (const [pid2, endsAt2] of clientRespawnEndTimes.current) {
              const rem = Math.max(0, Math.ceil((endsAt2 - now2) / 1000));
              if (pid2 === 1 && rem !== p1RespawnRef.current) { p1RespawnRef.current = rem; setP1RespawnCountdown(rem); }
              if (pid2 === 2 && rem !== p2RespawnRef.current) { p2RespawnRef.current = rem; setP2RespawnCountdown(rem); }
              if (rem <= 0) clientRespawnEndTimes.current.delete(pid2);
            }
            if (clientRespawnEndTimes.current.size === 0 && clientRespawnInterval.current) {
              clearInterval(clientRespawnInterval.current); clientRespawnInterval.current = null;
            }
          }, 200);
        }
      };
      nm.onRespawned = (respawnPid) => {
        clientRespawnEndTimes.current.delete(respawnPid);
        if (respawnPid === 1) { p1RespawnRef.current = 0; setP1RespawnCountdown(0); }
        if (respawnPid === 2) { p2RespawnRef.current = 0; setP2RespawnCountdown(0); }
      };
    }

    nm.onPlayerReady = (readyPid) => {
      const isMe = readyPid === pid;
      if (isMe) readyRef.current.myReady = true;
      else      readyRef.current.otherReady = true;
      setReadyState({ ...readyRef.current });
      if (nm.isHost && readyRef.current.myReady && readyRef.current.otherReady) {
        readyRef.current = { myReady: false, otherReady: false };
        nm.sendControl({ t: 'START' });
        startOnlineGame(nm, 1);
      }
    };

    gameRef.current      = game;
    gameStateRef.current = 'playing';
    setGameState('playing');
    startLoop();
  };

  // ── 喚醒 Render 伺服器 ────────────────────────────────────
  const wakeUpServer = async (): Promise<void> => {
    try {
      const httpUrl = WS_URL.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
      await Promise.race([
        fetch(`${httpUrl}/health`),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 25_000)),
      ]);
    } catch { /* 忽略 */ }
  };

  // ── 建立 / 加入房間 ───────────────────────────────────────
  const handleCreateRoom = async () => {
    setOnlineError('正在連線伺服器...');
    await wakeUpServer();
    setOnlineError('');
    const nm = new NetworkManager();
    networkRef.current = nm;
    nm.onError = (msg) => setOnlineError(msg);
    nm.onDisconnect = () => { if (gameStateRef.current !== 'playing') { setOnlineError('與伺服器斷線'); setOnlineStep('menu'); } };
    try { await nm.connect(WS_URL); } catch { setOnlineError('無法連線到伺服器，請稍後再試'); return; }
    let localPid = 1;
    nm.onRoomJoined = (code, pid) => { localPid = pid; setRoomCode(code); setMyPlayerId(pid); setOnlineStep('waiting'); };
    nm.onGameStart  = () => { startOnlineGame(nm, localPid); };
    nm.createRoom();
  };

  const handleJoinRoom = async () => {
    if (!joinInput.trim()) { setOnlineError('請輸入房間代碼'); return; }
    setOnlineError('正在連線伺服器...');
    await wakeUpServer();
    setOnlineError('');
    const nm = new NetworkManager();
    networkRef.current = nm;
    nm.onError = (msg) => setOnlineError(msg);
    nm.onDisconnect = () => { if (gameStateRef.current !== 'playing') { setOnlineError('與伺服器斷線'); setOnlineStep('menu'); } };
    try { await nm.connect(WS_URL); } catch { setOnlineError('無法連線到伺服器，請稍後再試'); return; }
    let localPid = 2;
    nm.onRoomJoined = (code, pid) => { localPid = pid; setMyPlayerId(pid); setRoomCode(code); };
    nm.onGameStart  = () => { startOnlineGame(nm, localPid); };
    nm.joinRoom(joinInput);
  };

  // ── 按鈕 handlers ─────────────────────────────────────────
  const handleCancelWait = () => { networkRef.current?.disconnect(); setOnlineStep('menu'); setRoomCode(''); };

  const handleMainMenu = () => {
    setGameState('start'); setSelectionStep('platform'); setOnlineStep('menu');
    setRoomCode(''); setJoinInput(''); setOnlineError('');
    setReadyState({ myReady: false, otherReady: false });
    networkRef.current?.disconnect();
  };

  const handleReadyRematch = () => {
    readyRef.current.myReady = true;
    setReadyState(prev => ({ ...prev, myReady: true }));
    networkRef.current?.sendReady();
    const nm2 = networkRef.current;
    if (nm2?.isHost && readyRef.current.otherReady) {
      readyRef.current = { myReady: false, otherReady: false };
      nm2.sendControl({ t: 'START' });
      startOnlineGame(nm2, 1);
    }
  };

  useEffect(() => {
    return () => {
      if (gameRef.current) gameRef.current.destroy();
      networkRef.current?.disconnect();
      if (clientRespawnInterval.current) clearInterval(clientRespawnInterval.current);
    };
  }, []);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const isOnlineMode = (gameRef.current?.networkMode || gameRef.current?.isHostMode) ?? false;

  return (
    <div className="relative w-full h-screen bg-neutral-950 flex items-center justify-center overflow-hidden font-sans">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="bg-neutral-900 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-neutral-800 w-full h-full object-cover"
        />

        {/* ── 大廳 ────────────────────────────────────────────── */}
        {gameState === 'lobby' && (
          <div className="absolute inset-0 z-30">
            <LobbyCanvas
              playerColor="#4fc3f7"
              onStartGame={(diff) => startGame(playerCount, diff)}
            />
          </div>
        )}

        {/* ── 開始畫面 ───────────────────────────────────────── */}
        {gameState === 'start' && (
          <StartScreen
            selectionStep={selectionStep} setSelectionStep={setSelectionStep}
            platform={platform}           setPlatform={setPlatform}
            onlineStep={onlineStep}       setOnlineStep={setOnlineStep}
            roomCode={roomCode}
            joinInput={joinInput}         setJoinInput={setJoinInput}
            onlineError={onlineError}     setOnlineError={setOnlineError}
            onStartGame={enterLobby}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onCancelWait={handleCancelWait}
          />
        )}

        {/* ── 遊戲結束畫面 ───────────────────────────────────── */}
        {gameState === 'gameover' && (
          <GameOverScreen
            gameStats={gameStats}
            isOnlineMode={isOnlineMode}
            readyState={readyState}
            readyRef={readyRef}
            networkRef={networkRef}
            playerCount={playerCount}
            formatTime={formatTime}
            onPlayAgain={() => startGame(playerCount)}
            onMainMenu={handleMainMenu}
            onReadyRematch={handleReadyRematch}
          />
        )}

        {/* ── 線上玩家 ID 標籤 ────────────────────────────────── */}
        {gameState === 'playing' && isOnlineMode && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 text-xs font-bold px-3 py-1 rounded-full">
            你是 P{myPlayerId}
          </div>
        )}

        {/* ── 手機搖桿 ────────────────────────────────────────── */}
        {gameState === 'playing' && platform === 'mobile' && (
          <div className={`absolute inset-0 pointer-events-none z-20 flex items-end ${(!isOnlineMode && playerCount === 2) ? 'justify-between' : 'justify-center'} p-12`}>
            <div className="pointer-events-auto">
              <Joystick
                onMove={(input) => {
                  const idx = isOnlineMode ? (myPlayerId - 1) : 0;
                  gameRef.current?.setJoystickInput(idx, input);
                }}
                color="#3498db"
              />
            </div>
            {!isOnlineMode && playerCount === 2 && (
              <div className="pointer-events-auto">
                <Joystick onMove={(input) => gameRef.current?.setJoystickInput(1, input)} color="#e74c3c" />
              </div>
            )}
          </div>
        )}

        {/* ── 升級選擇面板 ─────────────────────────────────────── */}
        {gameState === 'playing' && (() => {
          const pendingPlayer = gameRef.current?.upgradePendingPlayer;
          if (!pendingPlayer) return null;
          return (
            <UpgradePanel
              player={pendingPlayer}
              onSelect={(card: UpgradeCard) => gameRef.current?.applyUpgrade(pendingPlayer.id, card)}
            />
          );
        })()}

        {/* ── 測試面板 ─────────────────────────────────────────── */}
        {gameState === 'playing' && <TestModePanel gameRef={gameRef} />}

        {/* ── HUD ─────────────────────────────────────────────── */}
        {gameState === 'playing' && waveState && (
          <div className={`absolute inset-0 p-2 sm:p-6 flex flex-col pointer-events-none z-10 transition-colors duration-500 ${waveState.wave >= 10 ? 'bg-black/90' : ''}`}>
            <div className="relative flex justify-center items-start w-full">
              {p1State && <P1Card p1State={p1State} p1RespawnCountdown={p1RespawnCountdown} />}
              <WaveDisplay wave={waveState.wave} isResting={waveState.isResting} timer={waveState.timer} />
              {p2State && <P2Card p2State={p2State} p2RespawnCountdown={p2RespawnCountdown} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
