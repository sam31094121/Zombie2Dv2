// ── GameUI.tsx ─────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { Game } from '../game/Game';
import { CONSTANTS } from '../game/Constants';
import { Player } from '../game/Player';
import { audioManager } from '../game/AudioManager';
import { MobileControls } from './MobileControls';
import { NetworkManager } from '../game/NetworkManager';
import { useGameLoop } from '../hooks/useGameLoop';
import { HomeScreen } from './screens/HomeScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { P1Card } from './hud/P1Card';
import { P2Card } from './hud/P2Card';
import { WaveDisplay } from './hud/WaveDisplay';
import { TestModePanel } from './debug/TestModePanel';
import { UpgradePanel, UpgradeCard } from './UpgradePanel';
import { ShopPanel } from './arena/ShopPanel';
import { ManagementView } from './arena/ManagementView';
import { VictoryScreen } from './screens/VictoryScreen';

const WS_URL = (import.meta as any).env?.VITE_WS_URL ?? 'ws://localhost:3001';

export const GameUI: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFSVisible, setIsFSVisible] = useState(true);
  const fsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fsBtnRef = useRef<HTMLButtonElement>(null);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'shopping' | 'gameover' | 'victory'>('start');

  // ── 全螢幕引導提示（只顯示一次）────────────────────────────
  const [showFsHint, setShowFsHint] = useState(false);
  const [goblinHint, setGoblinHint] = useState<{ carrier: any } | null>(null);
  const [fsHintFading, setFsHintFading] = useState(false);
  const fsHintAutoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShownGoblinHintRef = useRef(false);

  const dismissFsHint = () => {
    if (fsHintAutoRef.current) clearTimeout(fsHintAutoRef.current);
    setFsHintFading(true);
    setTimeout(() => setShowFsHint(false), 500);
  };
  const [gameStats, setGameStats] = useState({ time: 0, kills: 0 });
  const [p1State, setP1State] = useState<Player | null>(null);
  const [p2State, setP2State] = useState<Player | null>(null);
  const [waveState, setWaveState] = useState<{ wave: number; isResting: boolean; timer: number | null; objectiveText: string | null } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isPausedUI, setIsPausedUI] = useState(false); // 新增暫停 UI 狀態
  const [isTestModeEnabled, setIsTestModeEnabled] = useState(false); // 控制測試面板是否顯示
  const gameRef = useRef<Game | null>(null);
  const gameStateRef = useRef<'start' | 'playing' | 'shopping' | 'gameover' | 'victory'>('start');
  const arenaShopEnteredRef = useRef(false);

  // ── 線上模式狀態 ──────────────────────────────────────────
  const [onlineStep, setOnlineStep] = useState<'menu' | 'waiting' | 'joining'>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [onlineError, setOnlineError] = useState('');
  const [myPlayerId, setMyPlayerId] = useState(1);
  const [onlineLobbyMode, setOnlineLobbyMode] = useState<'endless' | 'arena'>('endless');
  const networkRef = useRef<NetworkManager | null>(null);

  const [playerCount, setPlayerCount] = useState<number>(1);
  const [platform, setPlatform] = useState<'pc' | 'mobile'>('pc');
  const [mobileControlResetKey, setMobileControlResetKey] = useState(0);

  // ── 復活倒計時 ────────────────────────────────────────────
  const [p1RespawnCountdown, setP1RespawnCountdown] = useState(0);
  const [p2RespawnCountdown, setP2RespawnCountdown] = useState(0);
  const p1RespawnRef = useRef(0);
  const p2RespawnRef = useRef(0);

  // ── 競技場商店雙人準備狀態 ────────────────────────────────
  const [p1ShopReady, setP1ShopReady] = useState(false);
  const [p2ShopReady, setP2ShopReady] = useState(false);
  // 線上模式商店協調：紀錄自己和對方是否都按下了「準備」
  const onlineShopReadyRef = useRef({ myReady: false, otherReady: false });
  // 線上商店倒數：null=未倒數, 3/2/1=倒數中
  const [shopCountdown, setShopCountdown] = useState<number | null>(null);
  const shopCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // ── 全螢幕引導提示：每次進入都顯示
  useEffect(() => {
    const t = setTimeout(() => {
      setShowFsHint(true);
      // 5 秒後自動消失
      fsHintAutoRef.current = setTimeout(dismissFsHint, 5000);
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const MIN_DIMENSION = platform === 'mobile' ? 720 : 800;
      if (!isFinite(aspect) || isNaN(aspect) || aspect <= 0) {
        const fallbackHeight = Math.round(MIN_DIMENSION * 0.75);
        CONSTANTS.CANVAS_WIDTH = MIN_DIMENSION;
        CONSTANTS.CANVAS_HEIGHT = fallbackHeight;
        setDimensions({ width: MIN_DIMENSION, height: fallbackHeight });
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

    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // ── 全螢幕按鈕自動隱藏與靠近偵測 ──
    const handleFSActivity = (e: MouseEvent | TouchEvent) => {
      let cx = 0, cy = 0;
      if (e instanceof MouseEvent) { cx = e.clientX; cy = e.clientY; }
      else if (e.touches.length > 0) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }

      const btn = fsBtnRef.current;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const dist = Math.hypot(cx - (rect.left + rect.width / 2), cy - (rect.top + rect.height / 2));
        // 靠近按鈕 120px 內或點擊螢幕則顯現
        if (dist < 120 || e.type === 'touchstart') triggerFSShow();
      }
    };

    const triggerFSShow = () => {
      setIsFSVisible(true);
      if (fsTimerRef.current) clearTimeout(fsTimerRef.current);
      fsTimerRef.current = setTimeout(() => setIsFSVisible(false), 5000);
    };

    window.addEventListener('mousemove', handleFSActivity);
    window.addEventListener('touchstart', handleFSActivity, { capture: true }); // 使用 capture 強制在攔截前收到信號
    triggerFSShow();

    return () => {
      window.removeEventListener('resize', updateDimensions);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('mousemove', handleFSActivity);
      window.removeEventListener('touchstart', handleFSActivity, { capture: true } as any);
      if (fsTimerRef.current) clearTimeout(fsTimerRef.current);
    };
  }, [platform]);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const resetPlayerInputState = () => {
    gameRef.current?.resetInputState();
    setMobileControlResetKey(prev => prev + 1);
  };

  // ── HUD 更新 callback（共用）──────────────────────────────
  const makeOnUpdate = () => (p1: Player | null, p2: Player | null, waveManager: any) => {
    if (gameRef.current?.mode === 'arena') {
      const canOpenArenaOverlay = gameRef.current.isArenaShopReady && !gameRef.current.hasArenaGroundOrbs;
      if (waveManager.isResting && canOpenArenaOverlay) {
        if (!arenaShopEnteredRef.current) {
          arenaShopEnteredRef.current = true;
          gameRef.current.clearEntitiesForShop();
          if (waveManager.currentWave >= 10) {
            // 競技場第 10 波通關 → 勝利畫面
            gameStateRef.current = 'victory';
            setGameState('victory');
          } else {
            gameStateRef.current = 'shopping';
            setGameState('shopping');
            resetPlayerInputState();
            // 線上 Host 模式：主動通知 P2 進入商店（sr 旗標在同幀被清除，不可靠）
            if (networkRef.current?.isHost) {
              networkRef.current.sendControl({ t: 'SHOP_OPEN' });
            }
          }
        }
      } else {
        arenaShopEnteredRef.current = false;
      }
    }

    if (++uiFrameRef.current % 6 !== 0) return;
    setP1State(p1 ? { ...p1 } as Player : null);
    setP2State(p2 ? { ...p2 } as Player : null);
    setWaveState({
      wave: waveManager.currentWave,
      isResting: waveManager.isResting,
      timer: waveManager.isObjectiveBased() && !waveManager.isResting ? null : Math.ceil(waveManager.timer),
      objectiveText: waveManager.getObjectiveText(),
    });
  };

  // ── 本地遊戲開始 ──────────────────────────────────────────
  // 从大厅传门触发，带入难度和模式
  const startGame = (count: number, _difficulty: 'normal' | 'hard' | 'infinite' = 'normal', mode: 'endless' | 'arena' = 'endless') => {
    setPlayerCount(count);
    audioManager.init();
    audioManager.resume();
    audioManager.startBGM();

    if (gameRef.current) gameRef.current.destroy();
    uiFrameRef.current = 0;
    hostRespawnTimers.current = new Map();
    p1RespawnRef.current = 0; setP1RespawnCountdown(0);
    p2RespawnRef.current = 0; setP2RespawnCountdown(0);
    arenaShopEnteredRef.current = false;
    setP1ShopReady(false);
    setP2ShopReady(false);
    if (shopCountdownRef.current) { clearInterval(shopCountdownRef.current); shopCountdownRef.current = null; }
    setShopCountdown(null);

    gameRef.current = new Game(
      count,
      (time, kills) => { setGameStats({ time, kills }); setGameState('gameover'); audioManager.stopBGM(); },
      makeOnUpdate(),
      mode
    );
    gameRef.current.onVictory = (time, kills) => {
      setGameStats({ time, kills });
      setGameState('victory');
      audioManager.stopBGM();
    };

    hasShownGoblinHintRef.current = false;
    gameRef.current.onGoblinSpawned = (carrier) => {
      if (hasShownGoblinHintRef.current) return;
      hasShownGoblinHintRef.current = true;
      if (gameRef.current) gameRef.current.isPaused = true;
      setGoblinHint({ carrier });
    };

    setGameState('playing');
    startLoop();
  };

  // ── 線上遊戲開始 ──────────────────────────────────────────
  const startOnlineGame = (nm: NetworkManager, pid: number, mode: 'endless' | 'arena' = onlineLobbyMode) => {
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
    arenaShopEnteredRef.current = false;
    setP1ShopReady(false);
    setP2ShopReady(false);
    onlineShopReadyRef.current = { myReady: false, otherReady: false };
    if (shopCountdownRef.current) { clearInterval(shopCountdownRef.current); shopCountdownRef.current = null; }
    setShopCountdown(null);

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
      mode,
    );

    hasShownGoblinHintRef.current = false;
    game.onGoblinSpawned = (carrier) => {
      if (hasShownGoblinHintRef.current) return;
      hasShownGoblinHintRef.current = true;
      game.isPaused = true;
      setGoblinHint({ carrier });
    };

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

      nm.onShopOpen = () => {
        if (!gameRef.current || arenaShopEnteredRef.current) return;
        if (gameStateRef.current !== 'playing') return;
        gameRef.current.clearEntitiesForShop();
        arenaShopEnteredRef.current = true;
        gameStateRef.current = 'shopping';
        setGameState('shopping');
        resetPlayerInputState();
      };
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
        startOnlineGame(nm, 1, gameRef.current?.mode || onlineLobbyMode);
      }
    };

    // ── Loadout 同步：收到對方的裝備清單後，更新 Host 本地該玩家的資料 ──
    nm.onLoadoutSync = (loadoutPid, ld) => {
      if (!nm.isHost) return;
      const target = gameRef.current?.players.find(p => p.id === loadoutPid);
      if (!target) return;
      target.weapons = ld.weapons ?? target.weapons;
      target.ownedItems = ld.ownedItems ?? target.ownedItems;
      target.materials = ld.materials ?? target.materials;
      target.arenaStatPoints = ld.arenaStatPoints ?? target.arenaStatPoints;
    };

    // ── 線上競技場商店協調：Toggle 準備 + 3 秒倒數後 Host 廣播 WAVE_START ──
    nm.onShopReady = (readyPid, ready) => {
      const isMe = readyPid === pid;
      if (isMe) onlineShopReadyRef.current.myReady = ready;
      else      onlineShopReadyRef.current.otherReady = ready;

      if (pid === 1) setP1ShopReady(onlineShopReadyRef.current.myReady);
      else           setP2ShopReady(onlineShopReadyRef.current.myReady);
      if (pid === 2) {
        // P2 端也要顯示對方（P1）的燈號
        if (readyPid === 1) setP1ShopReady(ready);
        else                setP2ShopReady(ready);
      } else {
        if (readyPid === 2) setP2ShopReady(ready);
      }

      if (!nm.isHost) return;
      // Host 端管理倒數
      if (onlineShopReadyRef.current.myReady && onlineShopReadyRef.current.otherReady) {
        // 兩人都準備：啟動 3 秒倒數
        if (shopCountdownRef.current) return; // 已在倒數中
        setShopCountdown(3);
        nm.sendControl({ t: 'COUNTDOWN_START' });
        let secs = 3;
        shopCountdownRef.current = setInterval(() => {
          secs--;
          if (secs > 0) {
            setShopCountdown(secs);
          } else {
            if (shopCountdownRef.current) { clearInterval(shopCountdownRef.current); shopCountdownRef.current = null; }
            setShopCountdown(null);
            onlineShopReadyRef.current = { myReady: false, otherReady: false };
            _doNextArenaWave();
            const obsData = gameRef.current?.getArenaWaveObstacleData() ?? [];
            nm.sendControl({ t: 'WAVE_START', obs: obsData });
          }
        }, 1000);
      } else {
        // 有人取消準備：中止倒數
        if (shopCountdownRef.current) {
          clearInterval(shopCountdownRef.current);
          shopCountdownRef.current = null;
          setShopCountdown(null);
          nm.sendControl({ t: 'COUNTDOWN_CANCEL' });
        }
      }
    };

    // P2 端：收到 Host 的倒數訊號
    nm.onCountdownStart = () => {
      setShopCountdown(3);
      let secs = 3;
      if (shopCountdownRef.current) { clearInterval(shopCountdownRef.current); }
      shopCountdownRef.current = setInterval(() => {
        secs--;
        if (secs > 0) {
          setShopCountdown(secs);
        } else {
          if (shopCountdownRef.current) { clearInterval(shopCountdownRef.current); shopCountdownRef.current = null; }
          setShopCountdown(null);
        }
      }, 1000);
    };
    nm.onCountdownCancel = () => {
      if (shopCountdownRef.current) { clearInterval(shopCountdownRef.current); shopCountdownRef.current = null; }
      setShopCountdown(null);
    };

    nm.onWaveStart = (obsData?: any[]) => {
      // P2 收到 Host 的 WAVE_START：先推進波次（會清除並重新隨機生成障礙物），
      // 再用 Host 的資料覆寫，確保障礙物位置一致。
      _doNextArenaWave();
      if (obsData && gameRef.current) {
        gameRef.current.applyArenaWaveObstacles(obsData);
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
  const handleCreateRoom = async (mode: 'endless' | 'arena') => {
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
        setGameState('start');
      }
    };
    try { await nm.connect(WS_URL); } catch { setOnlineError('無法連線到伺服器，請稍後再試'); return; }
    let localPid = 1;
    nm.onRoomJoined = (code, pid) => { localPid = pid; setRoomCode(code); setMyPlayerId(pid); setOnlineStep('waiting'); };
    nm.onPeerConnected = () => {
      setPlayerCount(2);
      setOnlineLobbyMode(mode);
      // 直接開始遊戲，不再經過大廳
      nm.sendControl({ t: 'START', mode });
      startOnlineGame(nm, localPid, mode);
    };
    nm.onGameStart  = (m) => {
      const nextMode = m ?? gameRef.current?.mode ?? 'endless';
      setOnlineLobbyMode(nextMode);
      startOnlineGame(nm, localPid, nextMode);
    };
    nm.createRoom();
  };

  const handleJoinRoom = async () => {
    if (!joinInput.trim()) { setOnlineError('請輸入房間代碼'); return; }
    setOnlineError('正在連線伺服器...');
    await wakeUpServer();
    setOnlineError('');
    setOnlineStep('joining'); // 顯示連線中 spinner
    const nm = new NetworkManager();
    networkRef.current = nm;
    nm.onError = (msg) => setOnlineError(msg);
    nm.onDisconnect = () => {
      if (gameStateRef.current !== 'playing') {
        setOnlineError('與伺服器斷線');
        setOnlineStep('menu');
        setGameState('start');
      }
    };
    try { await nm.connect(WS_URL); } catch { setOnlineError('無法連線到伺服器，請稍後再試'); setOnlineStep('menu'); return; }
    let localPid = 2;
    nm.onRoomJoined = (code, pid) => { localPid = pid; setMyPlayerId(pid); setRoomCode(code); };
    nm.onPeerConnected = () => {
      setPlayerCount(2);
      // 留在 HomeScreen，等 P1 發送 START 訊息後由 nm.onGameStart 觸發
    };
    nm.onGameStart  = (mode) => {
      const nextMode = mode ?? gameRef.current?.mode ?? 'endless';
      setOnlineLobbyMode(nextMode);
      startOnlineGame(nm, localPid, nextMode);
    };
    nm.joinRoom(joinInput);
  };

  // ── 按鈕 handlers ─────────────────────────────────────────
  const handleCancelWait = () => { networkRef.current?.disconnect(); setOnlineStep('menu'); setRoomCode(''); };

  const handleMainMenu = () => {
    setGameState('start'); setOnlineStep('menu');
    setRoomCode(''); setJoinInput(''); setOnlineError('');
    setOnlineLobbyMode('endless');
    setReadyState({ myReady: false, otherReady: false });
    arenaShopEnteredRef.current = false;
    setP1ShopReady(false);
    setP2ShopReady(false);
    if (shopCountdownRef.current) { clearInterval(shopCountdownRef.current); shopCountdownRef.current = null; }
    setShopCountdown(null);
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

  const handleToggleReady = () => {
    if (!gameRef.current) return;
    const nm = networkRef.current;
    if (nm) {
      const newReady = !onlineShopReadyRef.current.myReady;
      onlineShopReadyRef.current.myReady = newReady;

      // 準備前先送裝備快照給 Host（讓 Host 的引擎用正確武器跑下一波）
      if (newReady) {
        const localPlayer = gameRef.current.players.find(p => p.id === myPlayerId);
        if (localPlayer) {
          nm.sendControl({
            t: 'LOADOUT_SYNC',
            pid: myPlayerId,
            ld: {
              weapons: localPlayer.weapons,
              ownedItems: localPlayer.ownedItems,
              materials: localPlayer.materials,
              arenaStatPoints: localPlayer.arenaStatPoints,
            },
          });
        }
      }

      nm.sendControl({ t: 'SHOP_READY', pid: myPlayerId, ready: newReady });
      if (myPlayerId === 1) setP1ShopReady(newReady);
      else                  setP2ShopReady(newReady);
      return;
    }
    // 單機模式：直接開始
    _doNextArenaWave();
  };

  // 向後相容：舊呼叫點保留（本地雙人 / ManagementView 用）
  const handleNextArenaWave = handleToggleReady;

  const _doNextArenaWave = () => {
    if (!gameRef.current) return;
    gameRef.current.nextArenaWave();
    arenaShopEnteredRef.current = false;
    gameStateRef.current = 'playing';
    setGameState('playing');
    setP1ShopReady(false);
    setP2ShopReady(false);
    onlineShopReadyRef.current = { myReady: false, otherReady: false };
    if (shopCountdownRef.current) { clearInterval(shopCountdownRef.current); shopCountdownRef.current = null; }
    setShopCountdown(null);
  };

  // 本地雙人模式：兩人都準備好才開始下一波（線上模式由 WAVE_START 訊息協調，不走這裡）
  useEffect(() => {
    const isLocalDuoShop = playerCount === 2 && !networkRef.current && p1ShopReady && p2ShopReady;
    if (isLocalDuoShop) {
      _doNextArenaWave();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p1ShopReady, p2ShopReady]);

  const handleBuyUpgrade = (key: string, cost: number) => {
    if (gameRef.current && p1State) {
      const p = gameRef.current.players.find(p => p.id === p1State.id);
      if (p && p.materials >= cost) {
        p.materials -= cost;
        if (key !== 'reroll') {
          if (key === 'damage') p.damageMultiplier += 0.15;
          if (key === 'haste') p.attackSpeedMultiplier += 0.15;
          if (key === 'agility') p.speed += p.speed * 0.10;
          if (key === 'vitality') { p.maxHp += 25; p.hp = Math.min(p.hp + 25, p.maxHp); }
          if (key === 'magnet') p.pickupRadiusMultiplier += 0.5;
          if (key === 'recovery') p.hp = Math.min(p.hp + 30, p.maxHp);
        }
        setP1State({ ...p } as Player);
      }
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
  const pendingUpgradePlayer = gameRef.current?.upgradePendingPlayer ?? null;

  useEffect(() => {
    if (gameState === 'shopping' || pendingUpgradePlayer) {
      resetPlayerInputState();
    }
  }, [gameState, pendingUpgradePlayer]);

  return (
    <div className="relative w-full h-screen bg-neutral-950 flex items-center justify-center overflow-hidden font-sans">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          width={dimensions.width * 2}
          height={dimensions.height * 2}
          className="bg-neutral-900 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-neutral-800 w-full h-full object-cover"
          style={{ 
            width: '100%',
            height: '100%',
            touchAction: gameState === 'playing' ? 'none' : 'auto' 
          }}
        />

        {/* ── 全螢幕按鈕 ────────────────────────────────────────── */}
        <button
          ref={fsBtnRef}
          onClick={() => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
            else document.exitFullscreen();
          }}
          className={`absolute z-[100] w-10 h-10 flex items-center justify-center bg-black/40 hover:bg-black/80 text-white rounded-full border border-white/20 backdrop-blur-md shadow-lg transition-all duration-500 touch-manipulation ${
            isFSVisible ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'
          }`}
          style={{ 
            top: 'calc(max(8px, env(safe-area-inset-top, 8px)) + 8px)', 
            right: 'calc(max(8px, env(safe-area-inset-right, 8px)) + 8px)'
          }}
          title={isFullscreen ? '離開全螢幕' : '進入全螢幕'}
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 15 6 6m-6-6v4.8m0-4.8h4.8"/><path d="M9 19.8V15m0 0H4.2M9 15l-6 6"/><path d="M15 4.2V9m0 0h4.8M15 9l6-6"/><path d="M9 4.2V9m0 0H4.2M9 9 3 3"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8"/><path d="M3 16.2V21m0 0h4.8M3 21l6-6"/><path d="M21 7.8V3m0 0h-4.8M21 3l-6 6"/><path d="M3 7.8V3m0 0h4.8M3 3l6 6"/>
            </svg>
          )}
        </button>

        {/* ── 哥布林教學提示 (Spotlight) ───────────────────────── */}
        {goblinHint && (() => {
          const carrier = goblinHint.carrier;
          const game = gameRef.current;
          if (!game) return null;
          
          // 將哥布林的世界座標轉換為螢幕百分比位置
          const screenX = carrier.x - game.camera.x;
          const screenY = carrier.y - game.camera.y;
          
          // 換算成百分比
          const leftPct = (screenX / CONSTANTS.CANVAS_WIDTH) * 100;
          const topPct = (screenY / CONSTANTS.CANVAS_HEIGHT) * 100;

          return (
            <div 
              className="absolute inset-0 z-[200] pointer-events-auto flex items-center justify-center cursor-pointer"
              onClick={() => {
                setGoblinHint(null);
                if (game) game.isPaused = false;
              }}
              style={{
                background: `radial-gradient(circle 90px at ${leftPct}% ${topPct}%, transparent 0%, transparent 60px, rgba(0,0,0,0.85) 120px, rgba(0,0,0,0.85) 100%)`
              }}
            >
              <div className="relative z-10 text-center font-mono animate-pulse pointer-events-none">
                <h3 className="text-yellow-400 font-bold text-2xl mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] flex items-center justify-center gap-2">
                  <span className="text-3xl">⚠️</span> 偷竊經驗的哥布林出現了！
                </h3>
                <p className="text-gray-100 text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-relaxed">
                  上一波殘餘的經驗值已被打包帶走<br/>
                  <span className="text-red-400 font-bold text-xl">在牠逃離前擊殺牠</span>，奪回所有經驗值！
                </p>
                <p className="text-gray-400 text-sm mt-8 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
                  ( 點擊任意處繼續遊戲 )
                </p>
              </div>
            </div>
          );
        })()}

        {/* ── 全螢幕一次性引導提示（Spotlight） ─────────────── */}
        {showFsHint && (
          <div
            onClick={dismissFsHint}
            className="pointer-events-auto"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
              opacity: fsHintFading ? 0 : 1,
              transition: 'opacity 0.5s ease',
              // 遮罩：全黑底，右上角挖出聚光燈圓洞（spotlight effect via radial-gradient）
              background: 'radial-gradient(circle 52px at calc(100% - 28px) 28px, transparent 38px, rgba(0,0,0,0.78) 52px)',
              cursor: 'pointer',
            }}
            aria-label="點擊任意處關閉全螢幕提示"
          >
            {/* 說明標籤 */}
            <div
              style={{
                position: 'absolute',
                top: 'calc(max(8px, env(safe-area-inset-top,8px)) + 62px)',
                right: 'calc(max(8px, env(safe-area-inset-right,8px)) + 2px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '6px',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {/* 彎曲箭頭 ↑ 指向按鈕 */}
              <svg
                width="32" height="40"
                viewBox="0 0 32 40"
                style={{
                  marginRight: '4px',
                  animation: 'fsHintBounce 1s ease-in-out infinite',
                }}
                fill="none"
              >
                <path
                  d="M28 36 C28 18, 8 18, 8 4"
                  stroke="white" strokeWidth="2.5" strokeLinecap="round"
                />
                <path
                  d="M4 8 L8 2 L12 8"
                  stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
              {/* 文字提示 */}
              <div style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.25)',
                backdropFilter: 'blur(12px)',
                borderRadius: '12px',
                padding: '8px 14px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                lineHeight: 1.5,
                textAlign: 'right',
                maxWidth: '160px',
              }}>
                點擊此處<br/>進入全螢幕<br/>
                <span style={{ fontSize: '11px', opacity: 0.65, fontWeight: 400 }}>獲得最佳遊戲體驗</span>
              </div>
              {/* 點任意處關閉的提示 */}
              <div style={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: '11px',
                marginRight: '2px',
              }}>點任意處關閉</div>
            </div>

            {/* 全域 keyframes（inline style 方式注入） */}
            <style>{`
              @keyframes fsHintBounce {
                0%, 100% { transform: translateY(0);   }
                50%       { transform: translateY(-6px); }
              }
            `}</style>
          </div>
        )}

        {/* ── 首頁 ────────────────────────────────────────────── */}
        {gameState === 'start' && (
          <HomeScreen
            platform={platform}
            setPlatform={setPlatform}
            onlineStep={onlineStep}
            roomCode={roomCode}
            joinInput={joinInput}
            setJoinInput={setJoinInput}
            onlineError={onlineError}
            onStartGame={(count, mode) => startGame(count, 'normal', mode)}
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
            onPlayAgain={() => startGame(playerCount, 'normal', gameRef.current?.mode || 'endless')}
            onMainMenu={handleMainMenu}
            onReadyRematch={handleReadyRematch}
          />
        )}

        {/* ── 競技場通關畫面 ──────────────────────────────────── */}
        {gameState === 'victory' && (
          <VictoryScreen
            kills={(p1State?.kills ?? 0) + (p2State?.kills ?? 0)}
            playerCount={playerCount}
            onMainMenu={handleMainMenu}
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
          <MobileControls
            playerCount={(!isOnlineMode && playerCount === 2) ? 2 : 1}
            resetSignal={mobileControlResetKey}
            onMove={(playerIdx, input) => {
              const idx = isOnlineMode ? (myPlayerId - 1) : playerIdx;
              gameRef.current?.setJoystickInput(idx, input);
            }}
          />
        )}

        {/* ── 升級選擇面板 ─────────────────────────────────────── */}
        {gameState === 'playing' && (() => {
          const pendingPlayer = pendingUpgradePlayer;
          if (!pendingPlayer) return null;
          return (
            <UpgradePanel
              player={pendingPlayer}
              onSelect={(card: UpgradeCard) => gameRef.current?.applyUpgrade(pendingPlayer.id, card)}
            />
          );
        })()}

        {/* ── 商店面板 (Arena Mode) ────────────────────────────── */}
        {gameState === 'shopping' && (() => {
          const g = gameRef.current;
          if (!g) return null;
          const isLocalDuo = playerCount === 2 && !isOnlineMode && !!g.players[1];
          if (isLocalDuo) {
            /* 本地雙人：管理視角 */
            return (
              <div className="absolute inset-0 z-20 overflow-hidden">
                <ManagementView
                  game={g}
                  wave={waveState?.wave || 1}
                  p1Ready={p1ShopReady}
                  p2Ready={p2ShopReady}
                  onP1Ready={() => setP1ShopReady(true)}
                  onP2Ready={() => setP2ShopReady(true)}
                />
              </div>
            );
          }
          /* 單人 / 線上：線上模式用 myPlayerId 找到本地玩家 */
          const localPlayer = isOnlineMode
            ? (g.players.find(p => p.id === myPlayerId) ?? g.players[0])
            : g.players[0];
          return localPlayer ? (
            <div className="absolute inset-0 z-20 overflow-hidden">
              <ShopPanel
                key={`shop-${waveState?.wave || 1}`}
                player={localPlayer}
                wave={waveState?.wave || 1}
                onNextWave={handleNextArenaWave}
                isOnline={isOnlineMode}
                myReady={myPlayerId === 1 ? p1ShopReady : p2ShopReady}
                otherReady={myPlayerId === 1 ? p2ShopReady : p1ShopReady}
                countdown={shopCountdown}
                onToggleReady={handleToggleReady}
              />
            </div>
          ) : null;
        })()}

        {/* ── 測試面板 (預設隱藏，須由暫停選單開啟) ────────────────── */}
        {gameState === 'playing' && isTestModeEnabled && <TestModePanel gameRef={gameRef} />}

        {/* ── 暫停選單 (Pause Modal) ────────────────────────────── */}
        {isPausedUI && gameState === 'playing' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-auto">
            <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-80 max-w-[90%] p-6 flex flex-col gap-4 shadow-2xl overflow-hidden relative">
              <div className="text-center pb-4 border-b border-neutral-800">
                <h2 className="text-white text-2xl font-black tracking-widest">PAUSED</h2>
                <div className="text-neutral-500 text-sm mt-1">遊戲暫停</div>
              </div>

              <button 
                onClick={() => {
                  setIsPausedUI(false);
                  if (gameRef.current) gameRef.current.isPaused = false;
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl active:scale-95 transition-all outline-none"
              >
                繼續遊戲
              </button>

              <button 
                onClick={() => startGame(playerCount, 'normal', gameRef.current?.mode || 'endless')}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3 rounded-xl active:scale-95 transition-all outline-none"
              >
                重新開始
              </button>

              <button 
                onClick={() => {
                  setIsPausedUI(false);
                  if (gameRef.current) {
                    gameRef.current.isPaused = false;
                    gameRef.current.destroy();
                  }
                  gameStateRef.current = 'start';
                  setGameState('start');
                }}
                className="w-full bg-red-900/50 hover:bg-red-800/80 text-red-200 font-bold py-3 rounded-xl active:scale-95 transition-all outline-none"
              >
                回到首頁
              </button>

              <div className="mt-2 pt-4 border-t border-neutral-800 flex items-center justify-between">
                <span className="text-neutral-400 text-sm font-medium">啟用測試模式</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={isTestModeEnabled} 
                    onChange={(e) => setIsTestModeEnabled(e.target.checked)} 
                  />
                  <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── HUD ─────────────────────────────────────────────── */}
        {gameState === 'playing' && waveState && (
          <div className="absolute inset-0 pointer-events-none z-30 transition-colors duration-500"
            style={{ padding: 'max(8px, env(safe-area-inset-top, 8px)) max(8px, env(safe-area-inset-right, 8px)) max(8px, env(safe-area-inset-bottom, 8px)) max(8px, env(safe-area-inset-left, 8px))' }}>
            <div className="relative flex justify-center items-start w-full">
              {p1State && <P1Card p1State={p1State} p1RespawnCountdown={p1RespawnCountdown} />}
              <div className="relative flex items-center">
                <WaveDisplay
                  wave={waveState.wave}
                  isResting={waveState.isResting}
                  timer={waveState.timer}
                  objectiveText={waveState.objectiveText}
                />
                {gameRef.current?.mode === 'arena' && gameRef.current.isArenaBagAbsorbing && (
                  <div className="absolute left-1/2 top-full mt-3 -translate-x-1/2 rounded-full border border-amber-400/40 bg-black/70 px-4 py-1 text-xs font-bold tracking-wide text-amber-200">
                    戰利品封袋中
                  </div>
                )}
                {gameRef.current?.mode === 'arena' && !gameRef.current.isArenaBagAbsorbing && gameRef.current.pendingBagRewardValue > 0 && (
                  <div className="absolute left-1/2 top-full mt-3 -translate-x-1/2 rounded-full border border-yellow-400/40 bg-black/70 px-4 py-1 text-xs font-bold tracking-wide text-yellow-200">
                    袋子怪攜帶 {gameRef.current.pendingBagRewardValue}
                  </div>
                )}
                
                {/* 遊戲暫停按鈕 (線上模式隱藏，避免單方面暫停) */}
                {!isOnlineMode && (
                  <button
                    onClick={() => {
                      const next = !isPausedUI;
                      setIsPausedUI(next);
                      if (gameRef.current) gameRef.current.isPaused = next;
                    }}
                    className="pointer-events-auto absolute -right-12 top-1/2 -translate-y-1/2 bg-neutral-800/80 border border-neutral-600 text-white rounded p-2 hover:bg-neutral-600 active:scale-95 transition-all w-10 h-10 flex items-center justify-center shadow-lg"
                    title="暫停遊戲"
                  >
                    {isPausedUI ? '▶️' : '⏸️'}
                  </button>
                )}
              </div>
              {p2State && <P2Card p2State={p2State} p2RespawnCountdown={p2RespawnCountdown} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
