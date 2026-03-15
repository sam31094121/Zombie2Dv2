import React, { useEffect, useRef, useState } from 'react';
import { Game } from '../game/Game';
import { CONSTANTS } from '../game/Constants';
import { Player } from '../game/Player';
import { audioManager } from '../game/AudioManager';
import { Joystick } from './Joystick';
import { NetworkManager } from '../game/NetworkManager';

// 伺服器位址（開發：localhost，部署時改 .env.local 的 VITE_WS_URL）
const WS_URL = (import.meta as any).env?.VITE_WS_URL ?? 'ws://localhost:3001';

export const GameUI: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
  const [gameStats, setGameStats] = useState({ time: 0, kills: 0 });
  const [p1State, setP1State] = useState<Player | null>(null);
  const [p2State, setP2State] = useState<Player | null>(null);
  const [waveState, setWaveState] = useState<{ wave: number, isResting: boolean, timer: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const gameRef = useRef<Game | null>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const gameStateRef = useRef<'start' | 'playing' | 'gameover'>('start');

  // ── 線上模式狀態 ─────────────────────────────────────────
  const [selectionStep, setSelectionStep] = useState<'platform' | 'players' | 'online'>('platform');
  const [onlineStep, setOnlineStep] = useState<'menu' | 'waiting' | 'joining'>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [onlineError, setOnlineError] = useState('');
  const [myPlayerId, setMyPlayerId] = useState(1);
  const networkRef = useRef<NetworkManager | null>(null);

  const [playerCount, setPlayerCount] = useState<number>(1);
  const [platform, setPlatform] = useState<'pc' | 'mobile' | null>(null);

  // ── 視窗大小 ────────────────────────────────────────────
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

  // ── 本地遊戲開始 ─────────────────────────────────────────
  const startGame = (count: number) => {
    setPlayerCount(count);
    audioManager.init();
    audioManager.resume();
    audioManager.startBGM();

    if (gameRef.current) gameRef.current.destroy();

    gameRef.current = new Game(
      count,
      (time, kills) => {
        setGameStats({ time, kills });
        setGameState('gameover');
        audioManager.stopBGM();
      },
      (p1, p2, waveManager) => {
        setP1State(p1 ? { ...p1 } as Player : null);
        setP2State(p2 ? { ...p2 } as Player : null);
        setWaveState({
          wave: waveManager.currentWave,
          isResting: waveManager.isResting,
          timer: Math.ceil(waveManager.timer)
        });
      }
    );

    setGameState('playing');
    lastTimeRef.current = performance.now();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  // ── 線上遊戲開始（NetworkManager 啟動遊戲後呼叫） ────────
  const startOnlineGame = (nm: NetworkManager, pid: number) => {
    audioManager.init();
    audioManager.resume();
    audioManager.startBGM();

    if (gameRef.current) gameRef.current.destroy();

    const game = new Game(
      2,
      (time, kills) => {
        setGameStats({ time, kills });
        setGameState('gameover');
        audioManager.stopBGM();
        nm.disconnect();
      },
      (p1, p2, waveManager) => {
        setP1State(p1 ? { ...p1 } as Player : null);
        setP2State(p2 ? { ...p2 } as Player : null);
        setWaveState({
          wave: waveManager.currentWave,
          isResting: waveManager.isResting,
          timer: Math.ceil(waveManager.timer)
        });
      }
    );

    game.networkMode = true;
    game.networkPlayerId = pid;
    game.onSendInput = (dx, dy) => nm.sendInput(dx, dy);

    // 接收伺服器狀態
    nm.onStateUpdate = (state) => {
      game.applyNetworkState(state);
    };

    gameRef.current = game;
    // 直接同步更新 ref，確保 gameLoop 第一幀就能通過 gameStateRef 檢查
    // （WebSocket callback 非 React 事件，rAF 可能比 useEffect 更早執行）
    gameStateRef.current = 'playing';
    setGameState('playing');
    lastTimeRef.current = performance.now();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  // ── 喚醒 Render 伺服器（解決冷啟動斷線問題） ────────────
  const wakeUpServer = async (): Promise<void> => {
    try {
      const httpUrl = WS_URL.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
      await Promise.race([
        fetch(`${httpUrl}/health`),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 25_000)),
      ]);
    } catch { /* 忽略：即使失敗仍繼續嘗試 WebSocket */ }
  };

  // ── 建立房間 ─────────────────────────────────────────────
  const handleCreateRoom = async () => {
    setOnlineError('正在連線伺服器...');
    await wakeUpServer();
    setOnlineError('');

    const nm = new NetworkManager();
    networkRef.current = nm;

    nm.onError = (msg) => setOnlineError(msg);
    nm.onDisconnect = () => {
      if (gameStateRef.current !== 'playing') {
        setOnlineError('與伺服器斷線');
        setOnlineStep('menu');
      }
    };

    try {
      await nm.connect(WS_URL);
    } catch {
      setOnlineError('無法連線到伺服器，請稍後再試');
      return;
    }

    // 用 localPid 避免 React state closure 讀到舊值
    let localPid = 1;
    nm.onRoomJoined = (code, pid) => {
      localPid = pid;
      setRoomCode(code);
      setMyPlayerId(pid);
      setOnlineStep('waiting');
    };
    nm.onGameStart = () => {
      startOnlineGame(nm, localPid);
    };

    nm.createRoom();
  };

  // ── 加入房間 ─────────────────────────────────────────────
  const handleJoinRoom = async () => {
    if (!joinInput.trim()) { setOnlineError('請輸入房間代碼'); return; }
    setOnlineError('正在連線伺服器...');
    await wakeUpServer();
    setOnlineError('');

    const nm = new NetworkManager();
    networkRef.current = nm;

    nm.onError = (msg) => setOnlineError(msg);
    nm.onDisconnect = () => {
      if (gameStateRef.current !== 'playing') {
        setOnlineError('與伺服器斷線');
        setOnlineStep('menu');
      }
    };

    try {
      await nm.connect(WS_URL);
    } catch {
      setOnlineError('無法連線到伺服器，請稍後再試');
      return;
    }

    let localPid = 2;
    nm.onRoomJoined = (code, pid) => {
      localPid = pid;
      setMyPlayerId(pid);
      setRoomCode(code);
    };
    nm.onGameStart = () => {
      startOnlineGame(nm, localPid);
    };

    nm.joinRoom(joinInput);
  };

  // ── 遊戲主迴圈 ───────────────────────────────────────────
  const gameLoop = (time: number) => {
    if (gameStateRef.current !== 'playing') return;
    const rawDt = time - lastTimeRef.current;
    lastTimeRef.current = time;
    // 模組 F：背景分頁恢復保護 — dt 超過 250ms 觸發 HardSync
    const dt = Math.min(rawDt, 250);
    if (rawDt > 250 && gameRef.current?.networkMode) {
      gameRef.current.triggerHardSync();
    }

    if (gameRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        gameRef.current.update(dt);
        gameRef.current.draw(ctx);
      }
    }

    if (gameStateRef.current === 'playing' && !gameRef.current?.isGameOver) {
      requestRef.current = requestAnimationFrame(gameLoop);
    }
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(requestRef.current);
      if (gameRef.current) gameRef.current.destroy();
      networkRef.current?.disconnect();
    };
  }, []);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const isOnlineMode = gameRef.current?.networkMode ?? false;

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

        {/* ── 開始畫面 ─────────────────────────────────────── */}
        {gameState === 'start' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl text-white z-10 overflow-y-auto p-4">
            <div className="max-w-2xl w-full flex flex-col items-center my-auto py-8">
              <h1 className="text-4xl md:text-6xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 tracking-tight text-center">
                Survivor Survival
              </h1>

              {/* 選擇設備 */}
              {selectionStep === 'platform' && (
                <div className="flex flex-col items-center w-full">
                  <p className="text-neutral-400 mb-6 text-lg font-medium text-center">選擇遊玩設備</p>
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full justify-center">
                    <button onClick={() => { setPlatform('pc'); setSelectionStep('players'); }}
                      className="flex flex-col items-center gap-4 p-6 md:p-8 bg-neutral-900/80 rounded-2xl border-2 border-neutral-700 hover:border-blue-500 hover:bg-neutral-800 transition-all group w-full sm:w-64">
                      <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="text-2xl font-bold">電腦版</span>
                    </button>
                    <button onClick={() => { setPlatform('mobile'); setSelectionStep('players'); }}
                      className="flex flex-col items-center gap-4 p-6 md:p-8 bg-neutral-900/80 rounded-2xl border-2 border-neutral-700 hover:border-green-500 hover:bg-neutral-800 transition-all group w-full sm:w-64">
                      <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="text-2xl font-bold">手機版</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 選擇人數 or 線上 */}
              {selectionStep === 'players' && (
                <div className="flex flex-col items-center w-full">
                  <p className="text-neutral-400 mb-6 text-lg font-medium text-center">選擇模式</p>
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full justify-center mb-6">
                    <button onClick={() => startGame(1)}
                      className="flex flex-col items-center gap-3 p-6 bg-neutral-900/80 rounded-2xl border-2 border-neutral-700 hover:border-blue-500 hover:bg-neutral-800 transition-all group w-full sm:w-52">
                      <span className="text-3xl font-bold text-white">1 人</span>
                      <span className="text-sm text-neutral-400">本地單人</span>
                      {platform === 'pc' && <p className="text-blue-300 text-xs font-mono">W A S D</p>}
                    </button>
                    <button onClick={() => startGame(2)}
                      className="flex flex-col items-center gap-3 p-6 bg-neutral-900/80 rounded-2xl border-2 border-neutral-700 hover:border-purple-500 hover:bg-neutral-800 transition-all group w-full sm:w-52">
                      <span className="text-3xl font-bold text-white">2 人</span>
                      <span className="text-sm text-neutral-400">本地雙人</span>
                      {platform === 'pc' && (
                        <div className="text-xs text-center">
                          <p className="text-blue-300 font-mono">P1: WASD</p>
                          <p className="text-purple-300 font-mono">P2: ↑↓←→</p>
                        </div>
                      )}
                    </button>
                    <button onClick={() => setSelectionStep('online')}
                      className="flex flex-col items-center gap-3 p-6 bg-neutral-900/80 rounded-2xl border-2 border-neutral-700 hover:border-yellow-500 hover:bg-neutral-800 transition-all group w-full sm:w-52">
                      <span className="text-3xl font-bold text-white">🌐</span>
                      <span className="text-xl font-bold text-white">線上</span>
                      <span className="text-sm text-neutral-400">遠端雙人</span>
                    </button>
                  </div>
                  <button onClick={() => setSelectionStep('platform')} className="text-neutral-500 hover:text-white transition-colors underline underline-offset-4">返回上一步</button>
                </div>
              )}

              {/* 線上大廳 */}
              {selectionStep === 'online' && (
                <div className="flex flex-col items-center w-full max-w-md">
                  {onlineStep === 'menu' && (
                    <>
                      <p className="text-neutral-400 mb-6 text-lg font-medium text-center">線上多人遊戲</p>
                      {onlineError && (
                        <div className="mb-4 px-4 py-2 bg-red-900/50 border border-red-500 rounded-xl text-red-300 text-sm text-center">
                          {onlineError}
                        </div>
                      )}
                      <div className="flex flex-col gap-4 w-full mb-6">
                        <button onClick={handleCreateRoom}
                          className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-2xl transition-all text-xl">
                          建立房間
                        </button>
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={joinInput}
                            onChange={e => setJoinInput(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
                            placeholder="輸入 4 位數字代碼"
                            maxLength={4}
                            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-600 rounded-xl text-white font-mono text-center text-2xl tracking-widest placeholder-neutral-600 focus:outline-none focus:border-yellow-500"
                          />
                          <button onClick={handleJoinRoom}
                            className="w-full py-4 bg-neutral-700 hover:bg-neutral-600 text-white font-bold rounded-2xl transition-all text-xl border border-neutral-600">
                            加入房間
                          </button>
                        </div>
                      </div>
                      <button onClick={() => { setSelectionStep('players'); setOnlineError(''); }}
                        className="text-neutral-500 hover:text-white transition-colors underline underline-offset-4">返回</button>
                    </>
                  )}

                  {onlineStep === 'waiting' && (
                    <div className="flex flex-col items-center gap-6">
                      <p className="text-neutral-400 text-lg">等待對手加入...</p>
                      <div className="bg-neutral-900/80 border-2 border-yellow-500 rounded-2xl p-8 text-center">
                        <p className="text-neutral-400 text-sm mb-2">房間代碼</p>
                        <p className="text-5xl font-black font-mono tracking-widest text-yellow-400">{roomCode}</p>
                        <p className="text-neutral-500 text-xs mt-3">將代碼傳給朋友</p>
                      </div>
                      <div className="flex items-center gap-3 text-neutral-400">
                        <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>等待第二位玩家...</span>
                      </div>
                      <button onClick={() => {
                        networkRef.current?.disconnect();
                        setOnlineStep('menu');
                        setRoomCode('');
                      }} className="text-neutral-500 hover:text-white transition-colors underline underline-offset-4">取消</button>
                    </div>
                  )}

                  {onlineStep === 'joining' && (
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center gap-3 text-neutral-400">
                        <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>連線中...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 遊戲結束畫面 ──────────────────────────────────── */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center rounded-xl text-white z-10 overflow-y-auto p-4">
            <div className="max-w-md w-full flex flex-col items-center my-auto py-8">
              <h1 className="text-5xl md:text-6xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-800 tracking-tighter drop-shadow-lg text-center">GAME OVER</h1>
              <div className="bg-neutral-900/80 p-6 md:p-8 rounded-3xl border border-neutral-800 shadow-2xl mb-8 flex flex-col gap-4 w-full text-center">
                <div className="text-xl text-neutral-300 font-medium">Survival Time</div>
                <div className="text-3xl font-mono text-yellow-400 font-bold">{formatTime(gameStats.time)}</div>
                <div className="h-px w-full bg-neutral-800 my-2"></div>
                <div className="text-xl text-neutral-300 font-medium">Zombies Killed</div>
                <div className="text-3xl font-mono text-red-400 font-bold">{gameStats.kills}</div>
              </div>
              <div className="flex flex-col gap-4 w-full">
                {!isOnlineMode && (
                  <button onClick={() => startGame(playerCount)}
                    className="w-full py-4 bg-white text-black hover:bg-neutral-200 font-bold rounded-2xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:-translate-y-1 active:translate-y-0 text-xl">
                    Play Again
                  </button>
                )}
                <button onClick={() => { setGameState('start'); setSelectionStep('platform'); setOnlineStep('menu'); setRoomCode(''); setJoinInput(''); setOnlineError(''); networkRef.current?.disconnect(); }}
                  className="w-full py-4 bg-neutral-800 text-white hover:bg-neutral-700 font-bold rounded-2xl transition-all border border-neutral-700 hover:-translate-y-1 active:translate-y-0 text-lg">
                  Main Menu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 線上玩家 ID 標籤 ──────────────────────────────── */}
        {gameState === 'playing' && isOnlineMode && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 text-xs font-bold px-3 py-1 rounded-full">
            你是 P{myPlayerId}
          </div>
        )}

        {/* ── 手機搖桿 ──────────────────────────────────────── */}
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

        {/* ── HUD ────────────────────────────────────────────── */}
        {gameState === 'playing' && waveState && (
          <div className={`absolute inset-0 p-2 sm:p-6 flex flex-col pointer-events-none z-10 transition-colors duration-500 ${waveState.wave >= 10 ? 'bg-black/90' : ''}`}>
            <div className="relative flex justify-center items-start w-full">
              {p1State && (
                <div className="absolute left-0 top-0 bg-neutral-900/80 backdrop-blur-sm p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-500/30 w-[32%] sm:w-64 max-w-[16rem] shadow-lg">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1 sm:mb-2 gap-1">
                    <div className="text-blue-400 font-bold text-xs sm:text-lg leading-none">Player 1</div>
                    <div className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md text-[8px] sm:text-sm font-bold leading-none">
                      Lv.{p1State.level}{p1State.prestigeLevel > 0 ? ` (+${p1State.prestigeLevel})` : ''}
                    </div>
                  </div>
                  <div className="w-full bg-neutral-800 h-3 sm:h-4 rounded-full mb-1 sm:mb-2 overflow-hidden border border-neutral-700 relative">
                    <div className="bg-gradient-to-r from-red-600 to-red-400 h-full transition-all duration-300" style={{ width: `${(p1State.hp / p1State.maxHp) * 100}%` }} />
                    <div className="absolute inset-0 flex items-center justify-center text-[8px] sm:text-[10px] font-bold text-white drop-shadow-sm">
                      {Math.ceil(p1State.hp)} / {p1State.maxHp}
                    </div>
                  </div>
                  <div className="w-full bg-neutral-800 h-1.5 sm:h-2 rounded-full mb-1 overflow-hidden border border-neutral-700">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-full transition-all duration-300" style={{ width: `${p1State.level === 5 ? 100 : (p1State.xp / p1State.maxXp) * 100}%` }} />
                  </div>
                  <div className="text-[8px] sm:text-[10px] text-neutral-400 font-mono text-right uppercase tracking-tighter leading-none">
                    {p1State.level === 5 ? 'MAX' : `${p1State.xp}/${p1State.maxXp}`}
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center z-10">
                <div className="bg-neutral-900/80 backdrop-blur-sm p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-neutral-700 shadow-lg text-center min-w-[80px] sm:min-w-[150px]">
                  <div className="text-sm sm:text-xl font-black text-white leading-none mb-1">WAVE {waveState.wave}</div>
                  <div className={`text-[10px] sm:text-sm font-bold leading-none ${waveState.isResting ? 'text-green-400' : 'text-red-400'}`}>
                    {waveState.isResting ? 'REST' : 'COMBAT'} {waveState.timer}s
                  </div>
                </div>
              </div>

              {p2State && (
                <div className="absolute right-0 top-0 bg-neutral-900/80 backdrop-blur-sm p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-green-500/30 w-[32%] sm:w-64 max-w-[16rem] shadow-lg text-right">
                  <div className="flex flex-col-reverse sm:flex-row justify-between items-end sm:items-center mb-1 sm:mb-2 gap-1">
                    <div className="bg-green-500/20 text-green-300 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md text-[8px] sm:text-sm font-bold leading-none">
                      Lv.{p2State.level}{p2State.prestigeLevel > 0 ? ` (+${p2State.prestigeLevel})` : ''}
                    </div>
                    <div className="text-green-400 font-bold text-xs sm:text-lg leading-none">Player 2</div>
                  </div>
                  <div className="w-full bg-neutral-800 h-3 sm:h-4 rounded-full mb-1 sm:mb-2 overflow-hidden border border-neutral-700 relative flex justify-end">
                    <div className="bg-gradient-to-l from-red-600 to-red-400 h-full transition-all duration-300" style={{ width: `${(p2State.hp / p2State.maxHp) * 100}%` }} />
                    <div className="absolute inset-0 flex items-center justify-center text-[8px] sm:text-[10px] font-bold text-white drop-shadow-sm">
                      {Math.ceil(p2State.hp)} / {p2State.maxHp}
                    </div>
                  </div>
                  <div className="w-full bg-neutral-800 h-1.5 sm:h-2 rounded-full mb-1 overflow-hidden border border-neutral-700 flex justify-end">
                    <div className="bg-gradient-to-l from-green-600 to-green-400 h-full transition-all duration-300" style={{ width: `${p2State.level === 5 ? 100 : (p2State.xp / p2State.maxXp) * 100}%` }} />
                  </div>
                  <div className="text-[8px] sm:text-[10px] text-neutral-400 font-mono text-left uppercase tracking-tighter leading-none">
                    {p2State.level === 5 ? 'MAX' : `${p2State.xp}/${p2State.maxXp}`}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
