import { CONSTANTS } from './Constants';
import { Player } from './Player';
import { Zombie, ZombieType } from './Zombie';
import { ObstacleType, GameMode } from './types';
import { Projectile } from './Projectile';
import { Item, ItemType } from './Item';
import { MapManager } from './map/MapManager';
import { Obstacle } from './map/Obstacle';
import { audioManager } from './AudioManager';
import { WaveManager } from './WaveManager';
import { ZOMBIE_REGISTRY } from './entities/definitions/ZombieDefinitions';
import { WEAPON_REGISTRY } from './entities/definitions/WeaponDefinitions';
import { drawHitEffect, drawHealVFX, HitEffect, HealVFX } from './renderers/EffectRenderer';
import { BULLET_REGISTRY } from './renderers/BulletDefinitions';
import { resolveOverlaps } from './systems/PhysicsSystem';
import { spawnZombie as _spawnZombie, spawnItemAt as _spawnItemAt, spawnItem as _spawnItem } from './systems/SpawnSystem';
import { applyWaveMechanisms as _applyWaveMechanisms, drawWaveFilters as _drawWaveFilters } from './systems/WaveMechanicsSystem';
import { serializeState as _serializeState, applyNetworkState as _applyNetworkState } from './systems/NetworkSyncSystem';
import { handleObstacleInteractions as _handleObstacleInteractions, handlePlayerAttacks as _handlePlayerAttacks, findNearestZombie as _findNearestZombie, explodeObstacle as _explodeObstacle, dropVendingMachineItems as _dropVendingMachineItems } from './systems/CombatSystem';
import { SwordProjectile } from './entities/SwordProjectile';
import { updateSwordProjectiles } from './systems/SwordSystem';
import { MissileProjectile } from './entities/MissileProjectile';
import { updateMissiles } from './systems/MissileSystem';
import { drawMissiles } from './renderers/MissileRenderer';
import { updateActiveEffects } from './systems/ActiveEffectSystem';
import { ArcProjectile } from './entities/ArcProjectile';
import { ArcSystem } from './modules/ArcSystem';
import { drawArcProjectiles } from './renderers/ArcRenderer';
import { drawSwordProjectiles } from './renderers/SwordRenderer';
import { drawActiveEffects } from './renderers/EffectRenderer';
import type { ActiveEffect } from './types';
import { ArenaBorderLayout, ArenaPlayableBounds, createArenaBorderLayout, drawArenaBorder } from './renderers/ArenaBorderRenderer';
import { getGeneratedObstacleSize } from './map/MapManager';

export class Game {
  players: Player[] = [];
  zombies: Zombie[] = [];
  projectiles: Projectile[] = [];
  swordProjectiles: SwordProjectile[] = [];
  missiles: MissileProjectile[] = [];
  arcProjectiles: ArcProjectile[] = [];
  items: Item[] = [];
  hitEffects: HitEffect[] = [];
  activeEffects: ActiveEffect[] = [];
  healVFX: HealVFX[] = [];
  slimeTrails: { x: number, y: number, radius: number, lifetime: number, maxLifetime: number }[] = [];
  mapManager: MapManager;
  camera: { x: number, y: number } = { x: 0, y: 0 };
  keys: Record<string, boolean> = {};
  joystickInputs: ({ x: number, y: number } | null)[] = [null, null];
  hitStopTimer: number = 0;
  lastTime: number = 0;
  lastItemSpawnTime: number = 0;
  zombieSpawnTimer: number = 0;
  score: number = 0;
  startTime: number = 0;
  isGameOver: boolean = false;
  shakeTimer: number = 0;
  onGameOver: (time: number, kills: number) => void;
  onUpdateUI: (p1: Player | null, p2: Player | null, waveManager: WaveManager) => void;
  waveManager: WaveManager;
  mode: GameMode = 'endless';
  arenaWidth: number = 1500;
  arenaHeight: number = 1500;
  arenaBorder: ArenaBorderLayout | null = null;
  baggedMaterials: number = 0;
  private _arenaWaveStartLevels: number[] = []  // 每位玩家的波次開始等級;
  sharedStatPoints: number = 0;   // 本地雙人模式共享素質點數池

  // 網路多人模式
  networkMode: boolean = false;
  networkPlayerId: number = 1;
  networkInputSendTimer: number = 0;
  onSendInput: ((dx: number, dy: number) => void) | null = null;

  // ── 模組 C：環形緩衝區（最近 200 幀本地狀態，備 Rollback 用）
  localTick = 0;
  readonly CIRC_BUF_SIZE = 200;
  circularBuffer: Array<{ tick: number; x: number; y: number; vx: number; vy: number } | null>
    = new Array(200).fill(null);

  // ── Reconciliation：Host 確認的最後一個 P2 input tick ─────
  hostLastAckTick = 0;

  // ── 模組 H：道具拾取預測（client-side prediction）
  pendingPickups: Array<{ x: number; y: number; type: string; time: number }> = [];

  // ── 模組 E / F：HardSync 旗標（背景分頁恢復 or 波次切換）
  pendingHardSync = false;

  // ── Feature 3/6: Stable zombie IDs
  _zombieIdCounter: number = 0;

  // ── Host 模式（P2P）：本地跑完整物理後序列化送給 P2 ──────
  isHostMode: boolean = false;

  // ── 劍系投射物擊殺佇列（SwordSystem 填入，Game.update 結尾處理）
  pendingSwordKills: Map<Zombie, { ownerId: number | null; level: number; hitAngle?: number }> = new Map();

  // ── Feature 5: Lag compensation — hitbox expansion + backward reconciliation
  lagCompensationRadius: number = 0;
  playerLatencies: Map<number, number> = new Map(); // playerId → one-way latency (ms)

  // Zombie position history ring buffer for backward reconciliation (30 ticks @ 60Hz = 500ms)
  private _zombieHistoryBuf: Array<Map<number, { x: number; y: number }>> = [];
  private _zombieHistoryTick: number = 0;
  private readonly _HISTORY_SIZE = 30;

  // ── Feature 4: Snapshot ring buffer for timing-based interpolation (50ms render delay)
  _snapBuffer: Array<{
    ts: number;
    zs: Map<number, { x: number; y: number }>;
    remotePs: Map<number, { x: number; y: number }>;
  }> = [];
  private readonly _SNAP_DELAY_MS = 50;
  readonly _SNAP_BUF_MAX = 24;

  queueZombieDeath(zombie: Zombie, ownerId: number | null, level: number, hitAngle?: number) {
    if (zombie.hp > 0 || this.pendingSwordKills.has(zombie)) return;
    this.pendingSwordKills.set(zombie, { ownerId, level, hitAngle });
  }

  flushQueuedZombieDeaths() {
    for (const [zombie, { ownerId, level, hitAngle }] of this.pendingSwordKills) {
      if (zombie.hp <= 0) this.killZombie(zombie, ownerId, level, hitAngle);
    }
    this.pendingSwordKills.clear();

    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const zombie = this.zombies[i];
      if (zombie.hp <= 0) this.killZombie(zombie, null, 1);
    }
  }

  constructor(playerCount: number, onGameOver: (time: number, kills: number) => void, onUpdateUI: (p1: Player | null, p2: Player | null, waveManager: WaveManager) => void, mode: GameMode = 'endless') {
    this.onGameOver = onGameOver;
    this.onUpdateUI = onUpdateUI;
    this.mapManager = new MapManager();
    this.mode = mode;
    this.waveManager = new WaveManager(mode);
    this.init(playerCount);
  }

  init(playerCount: number) {
    this.players = [];
    if (playerCount >= 1) {
      const p1 = new Player(1, 400, 300, '#3498db');
      // [模組化調整] 所有的模式現在都預設使用懸浮武器邏輯，提供更一致的體驗
      p1.isFloatingWeapons = true;
      this.players.push(p1);
    }
    if (playerCount >= 2) {
      const p2 = new Player(2, 450, 300, '#e74c3c');
      p2.isFloatingWeapons = true;
      this.players.push(p2);
    }
    this.zombies = [];
    this.projectiles = [];
    this.swordProjectiles = [];
    this.arcProjectiles = [];
    this.missiles = [];
    this.items = [];
    this.hitEffects = [];
    this.activeEffects = [];
    this.slimeTrails = [];
    this.keys = {};
    this.score = 0;
    this.startTime = Date.now();
    this.lastItemSpawnTime = Date.now();
    this.isGameOver = false;
    this.mapManager = new MapManager();
    this.camera = { x: 0, y: 0 };
    this.initArenaLayout();

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
    }
  }

  private initArenaLayout() {
    if (this.mode !== 'arena') {
      this.arenaBorder = null;
      return;
    }

    const seed = Math.floor(Math.random() * 1_000_000);
    this.arenaBorder = createArenaBorderLayout(this.arenaWidth, this.arenaHeight, seed);

    const centerX = (this.playableArenaBounds.left + this.playableArenaBounds.right) * 0.5;
    const centerY = (this.playableArenaBounds.top + this.playableArenaBounds.bottom) * 0.5;

    if (this.players[0]) {
      this.players[0].x = centerX - (this.players.length > 1 ? 28 : 0);
      this.players[0].y = centerY;
    }
    if (this.players[1]) {
      this.players[1].x = centerX + 28;
      this.players[1].y = centerY;
    }
  }

  get playableArenaBounds(): ArenaPlayableBounds {
    return this.arenaBorder?.playable ?? {
      left: 20,
      top: 20,
      right: this.arenaWidth - 20,
      bottom: this.arenaHeight - 20,
    };
  }

  randomArenaPoint(padding: number = 0) {
    const bounds = this.playableArenaBounds;
    const left = bounds.left + padding;
    const top = bounds.top + padding;
    const right = bounds.right - padding;
    const bottom = bounds.bottom - padding;
    return {
      x: left + Math.random() * Math.max(1, right - left),
      y: top + Math.random() * Math.max(1, bottom - top),
    };
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
    }
  }

  // 模組 F：背景分頁恢復 — 觸發下一幀強制硬同步
  triggerHardSync() {
    this.pendingHardSync = true;
  }

  // ── Host 模式：序列化遊戲狀態（供 P2P 廣播給 P2）────────
  // 格式與舊版 server.ts serializeState 完全相同，P2 的 applyNetworkState 不需改動
  serializeState(tick: number, hardSync: boolean): object {
    return _serializeState(this, tick, hardSync);
  }

  // 接收伺服器狀態並更新本地實體
  // HardSync 淡入遮罩（0 = 全透明，>0 漸出）
  _hardSyncFade = 0;

  applyNetworkState(state: any) {
    _applyNetworkState(this, state);
  }

  testMode: boolean = false;
  debugPaused: boolean = false;
  isPaused: boolean = false; // 新增全局暫停狀態
  debugHpLocked: boolean = false;
  debugInfiniteCoins: boolean = false; // 測試用：無限金幣

  handleKeyDown = (e: KeyboardEvent) => {
    this.keys[e.key] = true;
    if (e.key === '`') { this.testMode = !this.testMode; return; }
    if (!this.testMode) return;
    if (e.key === 'b' || e.key === 'B') this._debugSpawn('butcher');
    if (e.key === 'n' || e.key === 'N') for (let i = 0; i < 5; i++) this._debugSpawn('normal');
    if (e.key === 'k' || e.key === 'K') this.zombies = [];
    if (e.key === 'h' || e.key === 'H') this.players.forEach(p => { p.hp = p.maxHp; });
    const lvl = parseInt(e.key);
    if (lvl >= 1 && lvl <= 5 && this.players[0]) this.players[0].level = lvl;
    if ((e.key === 'q' || e.key === 'Q') && this.players[0]) {
      this.players[0].weapon = 'sword';
      this.players[0].syncWeaponToSlot();
    }
    if ((e.key === 'e' || e.key === 'E') && this.players[0]) {
      this.players[0].weapon = 'gun';
      this.players[0].syncWeaponToSlot();
    }
  };

  handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key] = false;
  };

  private _debugSpawn(type: ZombieType) {
    const p = this.players[0];
    if (!p) return;
    const angle = Math.random() * Math.PI * 2;
    const z = new Zombie(p.x + Math.cos(angle) * 200, p.y + Math.sin(angle) * 200, type);
    z.id = ++this._zombieIdCounter;
    this.zombies.push(z);
  }

  // ── Debug API（供 TestModePanel 呼叫）────────────────────────────────────
  debugSpawnZombie(type: ZombieType, count: number = 1) {
    for (let i = 0; i < count; i++) this._debugSpawn(type);
  }

  debugHealAll() {
    this.players.forEach(p => { p.hp = p.maxHp; });
  }

  debugSetWeapon(pid: number, weapon: 'sword' | 'gun', level: number) {
    const p = this.players.find(pl => pl.id === pid);
    if (!p) return;
    p.weapon = weapon;
    p.weaponLevels[weapon] = Math.max(1, Math.min(8, level));
  }
  debugSetWeaponBranch(pid: number, weapon: 'sword' | 'gun', branch: 'A' | 'B' | null) {
    const p = this.players.find(pl => pl.id === pid);
    if (!p) return;
    p.weaponBranches[weapon] = branch;
    if (branch && p.weaponLevels[weapon] < 5) p.weaponLevels[weapon] = 5;
  }

  debugSpawnItem(type: ItemType) {
    const p = this.players[0];
    if (!p) return;
    const angle = Math.random() * Math.PI * 2;
    this.items.push(new Item(p.x + Math.cos(angle) * 100, p.y + Math.sin(angle) * 100, type, 15000));
  }

  debugSpawnObstacle(type: ObstacleType) {
    const p = this.players[0];
    if (!p) return;
    const angle = Math.random() * Math.PI * 2;
    const x = p.x + Math.cos(angle) * 130;
    const y = p.y + Math.sin(angle) * 130;
    const size = getGeneratedObstacleSize(type, Math.random, Date.now() + angle);
    const w = size.width;
    const h = size.height;
    const obs = new Obstacle(x - w / 2, y - h / 2, w, h, type as any);
    const CHUNK_SIZE = 800;
    const key = `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)}`;
    const list = this.mapManager.obstacles.get(key) ?? [];
    list.push(obs);
    this.mapManager.obstacles.set(key, list);
  }

  debugSetWave(wave: number) {
    this.waveManager.currentWave = Math.max(1, Math.min(99, wave));
    this.waveManager.isInfinite = false; // 手動跳波次時重置無限模式，避免深色背景
  }

  debugClearSlime() {
    this.slimeTrails = [];
  }

  debugToggleStatus(pid: number, key: 'shield' | 'speedBoost' | 'slowDebuff' | 'glow') {
    const p = this.players.find(pl => pl.id === pid);
    if (!p) return;
    if (key === 'shield') p.shieldTimer > 0 ? (p.shieldTimer = 0, p.shield = false) : p.activateShield(3000);
    if (key === 'speedBoost') p.speedBoostTimer = p.speedBoostTimer > 0 ? 0 : 6000;
    if (key === 'slowDebuff') p.slowDebuffTimer = p.slowDebuffTimer > 0 ? 0 : 5000;
    if (key === 'glow') p.isInfiniteGlow = !p.isInfiniteGlow;
  }

  debugTogglePause() {
    this.debugPaused = !this.debugPaused;
  }
  debugToggleHpLock() {
    this.debugHpLocked = !this.debugHpLocked;
  }
  debugToggleInfiniteCoins() {
    this.debugInfiniteCoins = !this.debugInfiniteCoins;
    // 立即生效：所有玩家金幣設為極大值
    if (this.debugInfiniteCoins) {
      this.players.forEach(p => { p.materials = 999999; });
    }
  }

  // ── 升級選擇套用 ────────────────────────────────────────────────────────────
  applyUpgrade(playerId: number, card: import('../components/UpgradePanel').UpgradeCard) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    if (card.kind === 'weapon_level') {
      player.weaponLevels[card.weapon] = Math.min(8, player.weaponLevels[card.weapon] + 1);
    } else if (card.kind === 'branch') {
      player.weaponBranches[card.weapon] = card.branch;
      player.weaponLevels[card.weapon] = 5; // 選分支同時升到 Lv5
    } else {
      // 被動
      switch (card.key) {
        case 'damage': player.damageMultiplier += 0.15; break;
        case 'haste': player.attackSpeedMultiplier += 0.15; break;
        case 'agility': player.speed += player.speed * 0.10; break;
        case 'vitality': player.maxHp += 25; player.hp = Math.min(player.hp + 25, player.maxHp); break;
        case 'magnet': player.pickupRadiusMultiplier += 0.5; break;
        case 'recovery': player.hp = Math.min(player.hp + 30, player.maxHp); break;
      }
    }

    // ── 模組化同步 ──
    // 套用升級後立即同步到武器槽位，解決無線模式武器不更新的問題
    player.syncWeaponToSlot();
    
    // 升級完成後給予保護與加速
    player.activateShield(2500); 
    player.speedBoostTimer = 4000;

    player.pendingLevelUp = false;

    // ── 立即觸發 UI 更新 ──
    // 確保彈窗立即關閉，避免「不會動」的凍結感
    this.onUpdateUI(this.players[0] || null, this.players[1] || null, this.waveManager);
  }

  // ── Arena Mode Logic ────────────────────────────────────────────────────────
  clearEntitiesForShop() {
    if (this._shopEntryHandled) return;
    this._shopEntryHandled = true;

    let uncollected = 0;
    for (const item of this.items) {
      if (item.type === 'energy_orb') {
        uncollected += (item.value || 1);
      }
    }
    this.baggedMaterials = Math.floor(uncollected * 0.5); // 50% risk mechanics

    // ── 競技場素質點數結算：每波固定 1 點 + 本波升級次數 ──────────────────────
    if (this.mode === 'arena') {
      const isLocalDuo = !this.networkMode && this.players.length === 2;
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        const startLv = this._arenaWaveStartLevels[i] ?? 1;
        const levelsGained = Math.max(0, p.level - startLv);
        const earned = 1 + levelsGained;
        if (isLocalDuo) {
          // 本地雙人：共享點數池（只計算 P1 的升級，避免重複疊加）
          if (i === 0) this.sharedStatPoints += earned;
        } else {
          p.arenaStatPoints += earned;
        }
        p.pendingLevelUp = false;
      }
    }

    this.zombies = [];
    this.projectiles = [];
    this.swordProjectiles = [];
    this.arcProjectiles = [];
    this.missiles = [];
    this.hitEffects = [];
    this.activeEffects = [];
    this.slimeTrails = []; // explicitly clear these
    this.items = [];
    this.pendingSwordKills.clear();
  }

  nextArenaWave() {
    if (this.mode !== 'arena') return;
    this._arenaWaveStartLevels = this.players.map(p => p.level); // 所有玩家波次開始等級
    this.waveManager.startCombat();
    this._shopEntryHandled = false;
    this._shopCleared = false;
  }

  private _shopEntryHandled: boolean = false;
  private _shopCleared: boolean = false;

  // 取得需要升級選擇的玩家（回傳第一個等待中的）
  get upgradePendingPlayer(): import('./Player').Player | null {
    if (this.mode === 'arena') return null; // 競技場模式禁用升級介面
    return this.players.find(p => p.pendingLevelUp) ?? null;
  }

  private get isLocalSharedXpMode(): boolean {
    return !this.networkMode && !this.isHostMode && this.players.length > 1 && this.mode !== 'arena';
  }

  private awardOrbXp(player: Player, amount: number) {
    if (this.mode === 'arena') {
      const prevLevel = player.level;
      player.pendingLevelUp = false;
      player.addXp(amount, false);
      const levelsGained = player.level - prevLevel;
      if (levelsGained > 0) {
        player.arenaStatPoints += levelsGained;
        player.pendingLevelUp = false;
      }
      return;
    }

    if (!this.isLocalSharedXpMode) {
      player.addXp(amount);
      return;
    }

    if (this.players.some(p => p.pendingLevelUp)) return;

    const lead = this.players[0];
    const prevLevel = lead.level;
    lead.addXp(amount);
    const leveledUp = lead.level > prevLevel;

    for (const teammate of this.players) {
      teammate.level = lead.level;
      teammate.xp = lead.xp;
      teammate.maxXp = lead.maxXp;
      teammate.weaponLevels.sword = lead.weaponLevels.sword;
      teammate.weaponLevels.gun = lead.weaponLevels.gun;
      teammate.syncWeaponToSlot();
      teammate.pendingLevelUp = leveledUp;
    }
  }

  setJoystickInput(playerIndex: number, input: { x: number, y: number } | null) {
    if (this.joystickInputs[playerIndex] !== undefined) {
      this.joystickInputs[playerIndex] = input;
    }
  }

  resetInputState() {
    this.keys = {};
    this.joystickInputs = [null, null];
    for (const player of this.players) {
      player.lastMoveDir = { x: 1, y: 0 };
    }
  }

  update(dt: number) {
    if (this.isGameOver) return;
    
    // 發生升級選擇或主動暫停時，凍結所有邏輯更新
    if (this.isPaused || this.upgradePendingPlayer !== null) {
      if (this.upgradePendingPlayer !== null) {
        // 確保升級期間依舊觸發 UI 以顯示面板
        this.onUpdateUI(this.players[0] || null, this.players[1] || null, this.waveManager);
      }
      return; 
    }

    // ── 網路模式：只處理本地玩家預測 + 傳送輸入 ──
    if (this.networkMode) {
      const playerIdx = this.networkPlayerId - 1;
      const localPlayer = this.players[playerIdx];

      if (localPlayer && localPlayer.hp > 0) {
        // 每幀重新計算鍵盤輸入（WASD / 方向鍵均有效，不依賴 player.id）
        let dx = 0, dy = 0;
        if (this.keys['w'] || this.keys['W'] || this.keys['ArrowUp']) dy -= 1;
        if (this.keys['s'] || this.keys['S'] || this.keys['ArrowDown']) dy += 1;
        if (this.keys['a'] || this.keys['A'] || this.keys['ArrowLeft']) dx -= 1;
        if (this.keys['d'] || this.keys['D'] || this.keys['ArrowRight']) dx += 1;
        const kbLen = Math.sqrt(dx * dx + dy * dy);
        if (kbLen > 0) { dx /= kbLen; dy /= kbLen; }

        // 手機搖桿優先；沒有搖桿則用鍵盤值（含靜止 0,0）
        const mobileInput = this.joystickInputs[playerIdx];
        const finalInput = mobileInput ?? { x: dx, y: dy };

        const obstacles = this.mapManager.getNearbyObstacles(localPlayer.x, localPlayer.y);
        localPlayer.update(dt, this.keys, obstacles, finalInput);

        // 修復 Fix 2：本地玩家自動瞄準（網路模式也更新 aimAngle）
        {
          let targetAngle = Math.atan2(localPlayer.lastMoveDir.y, localPlayer.lastMoveDir.x);
          let nearestEnemy = null;
          let minDistSq = Infinity;
          for (const z of this.zombies) {
            if (z.hp <= 0) continue;
            const zDx = z.x - localPlayer.x, zDy = z.y - localPlayer.y;
            const distSq = zDx * zDx + zDy * zDy;
            if (distSq < minDistSq) { minDistSq = distSq; nearestEnemy = z; }
          }
          if (nearestEnemy) {
            targetAngle = Math.atan2((nearestEnemy as any).y - localPlayer.y, (nearestEnemy as any).x - localPlayer.x);
          }
          let angleDiff = targetAngle - localPlayer.aimAngle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          const maxRot = 2 * (dt / 1000);
          localPlayer.aimAngle += Math.abs(angleDiff) <= maxRot ? angleDiff : Math.sign(angleDiff) * maxRot;
          while (localPlayer.aimAngle > Math.PI) localPlayer.aimAngle -= Math.PI * 2;
          while (localPlayer.aimAngle < -Math.PI) localPlayer.aimAngle += Math.PI * 2;
        }

        // 攝影機跟隨本地玩家（存活時）
        this.camera.x += (localPlayer.x - CONSTANTS.CANVAS_WIDTH / 2 - this.camera.x) * 0.1;
        this.camera.y += (localPlayer.y - CONSTANTS.CANVAS_HEIGHT / 2 - this.camera.y) * 0.1;
        this.mapManager.update(localPlayer.x, localPlayer.y);

        // 模組 A / C：每幀傳送 binary 輸入（Fix 3 零延遲）+ 寫入環形緩衝區
        if (this.onSendInput) {
          this.onSendInput(finalInput.x, finalInput.y);
          this.localTick = (this.localTick + 1) >>> 0;
          this.circularBuffer[this.localTick % this.CIRC_BUF_SIZE] = {
            tick: this.localTick, x: localPlayer.x, y: localPlayer.y,
            vx: finalInput.x, vy: finalInput.y,
          };
        }

        // 模組 H：道具拾取預測（本地立即消失 + 播音效）
        const nowPick = Date.now();
        for (let i = this.items.length - 1; i >= 0; i--) {
          const item = this.items[i];
          if ((item as any)._fadeAlpha !== undefined) continue;
          const dist = Math.hypot(localPlayer.x - item.x, localPlayer.y - item.y);
          if (dist < localPlayer.radius + item.radius) {
            audioManager.playPickup();
            this.pendingPickups.push({ x: item.x, y: item.y, type: item.type, time: nowPick });
            this.items.splice(i, 1);
          }
        }
      } else {
        // 本地玩家死亡時鏡頭跟隨隊友（復活等待期間）
        const followTarget = this.players.find(p => p.id !== this.networkPlayerId && p.hp > 0);
        if (followTarget) {
          this.camera.x += (followTarget.x - CONSTANTS.CANVAS_WIDTH / 2 - this.camera.x) * 0.1;
          this.camera.y += (followTarget.y - CONSTANTS.CANVAS_HEIGHT / 2 - this.camera.y) * 0.1;
          this.mapManager.update(followTarget.x, followTarget.y);
        }
      }

      // ── Feature 4: Snapshot interpolation — render remote entities 50ms behind live ──
      const renderTime = Date.now() - this._SNAP_DELAY_MS;
      let snapA: typeof this._snapBuffer[0] | null = null;
      let snapB: typeof this._snapBuffer[0] | null = null;
      for (let _si = 0; _si < this._snapBuffer.length - 1; _si++) {
        if (this._snapBuffer[_si].ts <= renderTime && this._snapBuffer[_si + 1].ts >= renderTime) {
          snapA = this._snapBuffer[_si];
          snapB = this._snapBuffer[_si + 1];
          break;
        }
      }

      if (snapA && snapB) {
        const _alpha = (renderTime - snapA.ts) / Math.max(1, snapB.ts - snapA.ts);
        const _t = Math.max(0, Math.min(1, _alpha));

        // Interpolate zombies by stable ID — O(1) Map lookup instead of O(n) find
        for (const z of this.zombies) {
          const zA = snapA.zs.get(z.id);
          const zB = snapB.zs.get(z.id);
          if (zA && zB) {
            z.x = zA.x + (zB.x - zA.x) * _t;
            z.y = zA.y + (zB.y - zA.y) * _t;
          } else if (zB) {
            z.x = zB.x; z.y = zB.y;
          }
        }

        // Interpolate remote player position
        const remotePlayer = this.players.find(p => p.id !== this.networkPlayerId);
        if (remotePlayer) {
          const rpA = snapA.remotePs.get(remotePlayer.id);
          const rpB = snapB.remotePs.get(remotePlayer.id);
          if (rpA && rpB) {
            remotePlayer.x = rpA.x + (rpB.x - rpA.x) * _t;
            remotePlayer.y = rpA.y + (rpB.y - rpA.y) * _t;
          }
        }
      } else {
        // Fallback: simple lerp when snapshot buffer isn't warm yet (game start / after hard sync)
        const remotePlayer = this.players.find(p => p.id !== this.networkPlayerId);
        if (remotePlayer) {
          const tx = (remotePlayer as any)._tx as number | undefined;
          const ty = (remotePlayer as any)._ty as number | undefined;
          const tvx = ((remotePlayer as any)._tvx as number | undefined) ?? 0;
          const tvy = ((remotePlayer as any)._tvy as number | undefined) ?? 0;
          if (tx !== undefined && ty !== undefined) {
            remotePlayer.x += (tx + tvx * 0.5 - remotePlayer.x) * 0.35;
            remotePlayer.y += (ty + tvy * 0.5 - remotePlayer.y) * 0.35;
          }
        }
        for (const z of this.zombies) {
          const tx = (z as any)._tx as number | undefined;
          const ty = (z as any)._ty as number | undefined;
          if (tx !== undefined && ty !== undefined) {
            z.x += (tx - z.x) * 0.25;
            z.y += (ty - z.y) * 0.25;
          }
        }
      }

      // 模組 E：HardSync 淡入遮罩逐幀消散
      if (this._hardSyncFade > 0) {
        this._hardSyncFade = Math.max(0, this._hardSyncFade - 0.03);
      }

      // 更新 VFX
      this.healVFX = this.healVFX.filter(vfx => {
        vfx.y -= 1;
        vfx.alpha -= 0.02;
        return vfx.alpha > 0;
      });
      for (let i = this.hitEffects.length - 1; i >= 0; i--) {
        this.hitEffects[i].lifetime -= dt;
        if (this.hitEffects[i].lifetime <= 0) this.hitEffects.splice(i, 1);
      }
      // Fix 4 — Defensive slimeTrails lifetime cleanup in network mode.
      // Prevents unbounded growth if any code path adds trails on the client side.
      for (let i = this.slimeTrails.length - 1; i >= 0; i--) {
        this.slimeTrails[i].lifetime -= dt;
        if (this.slimeTrails[i].lifetime <= 0) this.slimeTrails.splice(i, 1);
      }

      this.onUpdateUI(this.players[0] || null, this.players[1] || null, this.waveManager);
      return;
    }

    // --- ARENA MODE WAVE END FREEZE & AUTO-LOOT ---
    if (this.mode === 'arena' && this.waveManager.isResting) {
      if (!this._shopCleared) {
        this.zombies = []; // 強制銷毀所有殭屍
        this.projectiles = [];
        this.swordProjectiles = [];
        this.missiles = [];
        this.arcProjectiles = [];
        this.activeEffects = [];

        const p = this.players[0];
        if (p) {
          let allLooted = true;
          for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            const dx = p.x - item.x;
            const dy = p.y - item.y;
            const dist = Math.hypot(dx, dy);
            // 瞬間吸星大法
            if (dist < 40) {
              if (item.type === 'energy_orb') {
                this.awardOrbXp(p, item.value || 1);
                p.materials += (item.value || 1);
              }
              audioManager.playPickup();
              this.items.splice(i, 1);
            } else {
              item.x += (dx / dist) * Math.min(dist, 50); // 每幀飛 50px
              item.y += (dy / dist) * Math.min(dist, 50);
              allLooted = false;
            }
          }
          if (allLooted) this._shopCleared = true;
        } else {
          this._shopCleared = true;
        }
      }
      this.onUpdateUI(this.players[0] || null, this.players[1] || null, this.waveManager);
      return; // Freeze all normal physics and game objects during Shop Phase
    }

    const isIntro = this.waveManager.waveIntroTimer > 0;

    // Apply Wave Mechanisms
    this.applyWaveMechanisms(dt);

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      for (let i = this.hitEffects.length - 1; i >= 0; i--) {
        const effect = this.hitEffects[i];
        effect.lifetime -= dt;
        if (effect.lifetime <= 0) {
          this.hitEffects.splice(i, 1);
        }
      }
      this.onUpdateUI(this.players[0] || null, this.players[1] || null, this.waveManager);
      return;
    }

    // Check game over
    if (this.players.every(p => p.hp <= 0)) {
      this.isGameOver = true;
      this.onGameOver(Date.now() - this.startTime, this.score);
      return;
    }

    // Feature 5 – Backward Reconciliation: snapshot zombie positions before physics moves them.
    // Fix: reuse the existing Map object (clear + repopulate) instead of allocating a new Map
    // every physics tick — eliminates the main GC hotspot at high zombie counts.
    {
      const idx = this._zombieHistoryTick % this._HISTORY_SIZE;
      let snap = this._zombieHistoryBuf[idx];
      if (!snap) {
        snap = new Map<number, { x: number; y: number }>();
        this._zombieHistoryBuf[idx] = snap;
      } else {
        snap.clear();
      }
      for (const z of this.zombies) snap.set(z.id, { x: z.x, y: z.y });
      this._zombieHistoryTick++;
    }

    // Update camera to follow alive players
    const alivePlayers = this.players.filter(p => p.hp > 0);
    if (alivePlayers.length > 0) {
      let cx = 0, cy = 0;
      for (const p of alivePlayers) {
        cx += p.x;
        cy += p.y;
      }
      cx /= alivePlayers.length;
      cy /= alivePlayers.length;

      // Smooth camera follow
      this.camera.x += (cx - CONSTANTS.CANVAS_WIDTH / 2 - this.camera.x) * 0.1;
      this.camera.y += (cy - CONSTANTS.CANVAS_HEIGHT / 2 - this.camera.y) * 0.1;

      if (this.mode === 'arena') {
        const minCamX = 0;
        const minCamY = 0;
        const maxCamX = Math.max(0, this.arenaWidth - CONSTANTS.CANVAS_WIDTH);
        const maxCamY = Math.max(0, this.arenaHeight - CONSTANTS.CANVAS_HEIGHT);
        this.camera.x = Math.max(minCamX, Math.min(maxCamX, this.camera.x));
        this.camera.y = Math.max(minCamY, Math.min(maxCamY, this.camera.y));
      }

      // Update map chunks based on camera center
      this.mapManager.update(cx, cy);
    }

    // Update players
    for (const player of this.players) {
      if (player.hp > 0) {
        if (this.waveManager.isInfinite) {
          // 移除強制發光
        }
        const obstacles = this.mapManager.getNearbyObstacles(player.x, player.y);
        const playerIdx = this.players.indexOf(player);
        let pKeys = this.keys;
        if (this.players.length === 1 && player.id === 1) {
          pKeys = { ...this.keys };
          if (this.keys['ArrowUp']) pKeys['w'] = true;
          if (this.keys['ArrowDown']) pKeys['s'] = true;
          if (this.keys['ArrowLeft']) pKeys['a'] = true;
          if (this.keys['ArrowRight']) pKeys['d'] = true;
        }
        player.update(dt, pKeys, obstacles, this.joystickInputs[playerIdx] || undefined);

        if (player.isRegenerating) {
          const now = Date.now();
          if (now - player.lastRegenVfxTime > 1200) {
            this.healVFX.push({
              x: (Math.random() - 0.5) * 10,
              y: 0,
              alpha: 0.8,
              startTime: now,
              ownerId: player.id,
            });
            player.lastRegenVfxTime = now;
          }
        }

        // Smooth auto-aim logic
        let targetAngle = Math.atan2(player.lastMoveDir.y, player.lastMoveDir.x);
        let nearestEnemy = null;
        let minDistanceSq = Infinity;
        for (const zombie of this.zombies) {
          if (zombie.hp <= 0) continue;
          const dx = zombie.x - player.x;
          const dy = zombie.y - player.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            nearestEnemy = zombie;
          }
        }

        if (nearestEnemy) {
          targetAngle = Math.atan2(nearestEnemy.y - player.y, nearestEnemy.x - player.x);
        }

        if (player.aimAngle === undefined) {
          player.aimAngle = targetAngle;
        }

        let angleDiff = targetAngle - player.aimAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const rotationSpeed = 2;
        const maxRotation = rotationSpeed * (dt / 1000);

        if (Math.abs(angleDiff) <= maxRotation) {
          player.aimAngle = targetAngle;
        } else {
          player.aimAngle += Math.sign(angleDiff) * maxRotation;
        }

        while (player.aimAngle > Math.PI) player.aimAngle -= Math.PI * 2;
        while (player.aimAngle < -Math.PI) player.aimAngle += Math.PI * 2;

        this.handlePlayerAttacks(player);
      }
    }

    // ── Debug：無限金幣每幀補滿 ────────────────────────────────────────────
    if (this.debugInfiniteCoins) {
      this.players.forEach(p => { p.materials = 999999; });
    }

    // Spawn zombies
    if (!this.debugPaused) this.waveManager.update(dt);
    if (!this.waveManager.isResting && !this.debugPaused) {
      this.zombieSpawnTimer += dt;
      let spawnRate = Math.max(500, 2000 - (this.waveManager.currentWave * 100));

      // Tombstone spawn boost
      const nearbyObstacles = this.mapManager.getNearbyObstacles(this.camera.x + CONSTANTS.CANVAS_WIDTH / 2, this.camera.y + CONSTANTS.CANVAS_HEIGHT / 2);
      const activeTombstones = nearbyObstacles.filter(obs => obs.type === 'tombstone' && !obs.isDestroyed);
      if (activeTombstones.length > 0) {
        spawnRate /= (1 + activeTombstones.length * 0.5); // 50% faster per tombstone
      }

      if (this.zombieSpawnTimer > spawnRate) {
        this.zombieSpawnTimer = 0;
        this.spawnZombie();
      }
    }

    // Spawn items
    if (Date.now() - this.lastItemSpawnTime > CONSTANTS.ITEM_SPAWN_INTERVAL) {
      this.lastItemSpawnTime = Date.now();
      this.spawnItem();
    }

    // Update slime trails
    for (let i = this.slimeTrails.length - 1; i >= 0; i--) {
      const trail = this.slimeTrails[i];
      trail.lifetime -= dt;
      if (trail.lifetime <= 0) {
        this.slimeTrails.splice(i, 1);
        continue;
      }

      // Check player collision
      for (const player of this.players) {
        if (player.hp > 0) {
          const dist = Math.hypot(player.x - trail.x, player.y - trail.y);
          if (dist < player.radius + trail.radius) {
            player.slowDebuffTimer = 4000; // 4 seconds slow
          }
        }
      }
    }

    this.flushQueuedZombieDeaths();

    // Update zombies
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const zombie = this.zombies[i];
      if (zombie.hp <= 0) {
        this.queueZombieDeath(zombie, null, 1);
        continue;
      }

      // Update glow state based on intro timer
      if (this.waveManager.isInfinite) {
        // 移除殭屍強制發光
      }

      const obstacles = this.mapManager.getNearbyObstacles(zombie.x, zombie.y);
      zombie.update(dt, this.players, obstacles, this.projectiles, this.slimeTrails);

      // Zombie-Player collision (damage)
      for (const player of this.players) {
        if (player.hp <= 0) continue;
        const dist = Math.hypot(player.x - zombie.x, player.y - zombie.y);
        if (dist < player.radius + zombie.radius) {
          const lastDmgTime = zombie.lastDamageTime.get(player.id) || 0;
          if (Date.now() - lastDmgTime > CONSTANTS.ZOMBIE_DAMAGE_INTERVAL) {
            zombie.lastDamageTime.set(player.id, Date.now());
            let damage = CONSTANTS.ZOMBIE_DAMAGE;
            if (zombie.type === 'slime' || zombie.type === 'slime_small') {
              damage = 0.5; // Very low damage
            }
            if (!this.debugHpLocked && player.takeDamage(damage)) audioManager.playPlayerHit();
          }
        }
      }
    }

    resolveOverlaps(this.zombies, this.players);

    // ── Arena Mode Boundaries ──
    if (this.mode === 'arena') {
      const bounds = this.playableArenaBounds;
      for (const p of this.players) {
        if (p.hp <= 0) continue;
        if (p.x < bounds.left) p.x = bounds.left;
        if (p.x > bounds.right) p.x = bounds.right;
        if (p.y < bounds.top) p.y = bounds.top;
        if (p.y > bounds.bottom) p.y = bounds.bottom;
      }
      for (const z of this.zombies) {
        if (z.x < bounds.left + z.radius) z.x = bounds.left + z.radius;
        if (z.x > bounds.right - z.radius) z.x = bounds.right - z.radius;
        if (z.y < bounds.top + z.radius) z.y = bounds.top + z.radius;
        if (z.y > bounds.bottom - z.radius) z.y = bounds.bottom - z.radius;
      }
    }

    this.handleObstacleInteractions(dt);
    this.flushQueuedZombieDeaths();

    // Update sword projectiles (Branch A/B boomerang + embed)
    updateSwordProjectiles(this.swordProjectiles, this, dt);

    // 更新燃燒導彈（Gun Branch A）
    updateMissiles(this.missiles, this, dt);

    // 更新電弧槍（Gun Branch B）電漿彈與連鎖邏輯
    ArcSystem.updateArcs(this.arcProjectiles, this, dt);

    // 更新場地效果（龍捲風 / 岩漿標記 / 地面火焰）並蒐集新的擊殺
    updateActiveEffects(this, dt);

    // 處理劍系 + 場地效果擊殺（SwordSystem / ActiveEffectSystem 蒐集的死亡殭屍）
    this.flushQueuedZombieDeaths();

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const obstacles = this.mapManager.getNearbyObstacles(proj.x, proj.y);
      proj.update(dt, obstacles);

      if (this.mode === 'arena') {
        if (proj.x < 0 || proj.x > this.arenaWidth || proj.y < 0 || proj.y > this.arenaHeight) {
          proj.lifetime = 0;
        }
      }

      // Projectile-Obstacle collision (for destructible obstacles and monolith)
      for (const obs of obstacles) {
        if (obs.isDestroyed) continue;
        if (obs.collidesWithCircle(proj.x, proj.y, proj.radius)) {
          if (obs.type === 'monolith' && proj.type === 'bullet') {
            // Reflect to nearest zombie
            const nearestZombie = this.findNearestZombie(obs.x + obs.width / 2, obs.y + obs.height / 2, 500);
            const currentSpeed = Math.hypot(proj.vx, proj.vy) || 1;
            if (nearestZombie) {
              const dx = nearestZombie.x - proj.x;
              const dy = nearestZombie.y - proj.y;
              const dist = Math.hypot(dx, dy);
              if (dist > 0) {
                proj.vx = (dx / dist) * currentSpeed;
                proj.vy = (dy / dist) * currentSpeed;
              } else {
                proj.vx *= -1;
                proj.vy *= -1;
              }
            } else {
              proj.vx *= -1;
              proj.vy *= -1;
            }
            const reflectDist = obs.width * 0.5 + proj.radius + 6;
            const reflectLen = Math.hypot(proj.vx, proj.vy) || 1;
            proj.x = obs.x + obs.width / 2 + (proj.vx / reflectLen) * reflectDist;
            proj.y = obs.y + obs.height / 2 + (proj.vy / reflectLen) * reflectDist;
            this.hitEffects.push({ x: proj.x, y: proj.y, type: 'white_sparks', lifetime: 200, maxLifetime: 200 });
            continue; // Don't destroy projectile on reflection
          }

          if (obs.type === 'sandbag' || obs.type === 'explosive_barrel' || obs.type === 'tombstone' || obs.type === 'vending_machine') {
            obs.takeDamage(proj.damage);
            this.hitEffects.push({ x: proj.x, y: proj.y, type: 'grey_sparks', lifetime: 200, maxLifetime: 200 });
            if (proj.type === 'bullet') {
              proj.lifetime = 0;
              break;
            }
          }
        }
      }

      if (proj.lifetime <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Projectile-Player collision (for enemy projectiles like zombie_spit)
      if (proj.isEnemy) {
        for (const player of this.players) {
          if (player.hp <= 0) continue;
          const dist = Math.hypot(player.x - proj.x, player.y - proj.y);
          if (dist < player.radius + proj.radius) {
            if (!this.debugHpLocked && player.takeDamage(proj.damage)) audioManager.playPlayerHit();
            proj.lifetime = 0;
            break;
          }
        }
        continue; // Skip zombie collision for enemy projectiles
      }

      // Projectile-Zombie collision
      for (let j = this.zombies.length - 1; j >= 0; j--) {
        const zombie = this.zombies[j];
        if (proj.hitZombies.has(zombie)) continue;

        let hit = false;
        if (proj.type === 'bullet') {
          // Feature 5: Backward Reconciliation — rewind zombie to when shooter fired
          const shooterLatencyMs = this.playerLatencies.get(proj.ownerId) ?? 0;
          const rewindTicks = Math.min(Math.round(shooterLatencyMs / 16), this._HISTORY_SIZE - 1);
          let czx = zombie.x, czy = zombie.y;
          if (rewindTicks > 0) {
            const hIdx = ((this._zombieHistoryTick - 1 - rewindTicks) % this._HISTORY_SIZE + this._HISTORY_SIZE) % this._HISTORY_SIZE;
            const hp = this._zombieHistoryBuf[hIdx]?.get(zombie.id);
            if (hp) { czx = hp.x; czy = hp.y; }
          }
          const dist = Math.hypot(proj.x - czx, proj.y - czy);
          if (dist < proj.radius + zombie.radius + this.lagCompensationRadius) hit = true;
        } else if (proj.type === 'slash') {
          const elapsed = proj.maxLifetime - proj.lifetime;
          // Only hit during the "slash" phase (50ms to 150ms)
          if (elapsed >= 50 && elapsed <= 150) {
            const dist = Math.hypot(proj.x - zombie.x, proj.y - zombie.y);
            if (dist < proj.radius + zombie.radius + this.lagCompensationRadius) {
              // Check angle
              const angleToZombie = Math.atan2(zombie.y - proj.y, zombie.x - proj.x);
              const slashAngle = Math.atan2(proj.vy, proj.vx);
              let angleDiff = angleToZombie - slashAngle;
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

              let hitArc = Math.PI / 4; // default 90 degrees (±45)
              if (proj.level === 2) hitArc = Math.PI / 4; // 90 degrees (±45)
              else if (proj.level === 3) hitArc = 50 * Math.PI / 180; // 100 degrees (±50)
              else if (proj.level === 4) hitArc = Math.PI / 3; // 120 degrees (±60)
              else if (proj.level === 5) hitArc = 85 * Math.PI / 180; // 170 degrees (±85)

              // If zombie is very close, always hit (prevents missing when overlapping)
              if (dist < 40 || Math.abs(angleDiff) < hitArc) {
                hit = true;
              }
            }
          }
        }

        if (hit) {
          audioManager.playHit();
          proj.hitZombies.add(zombie);

          zombie.hp -= proj.damage;

          if (proj.type === 'slash') {
            this.hitStopTimer = 20; // 0.02s hit stop
          }

          if (proj.knockback) {
            const angle = Math.atan2(zombie.y - proj.y, zombie.x - proj.x);

            // Check if big zombie ignores knockback from low level weapons
            let ignoreKnockback = false;
            if (zombie.type === 'big' && proj.level <= 3) {
              ignoreKnockback = true;
            }

            if (!ignoreKnockback) {
              if (proj.type === 'slash') {
                // Push to the edge of the slash radius (or 80% for big zombies)
                const edgeDist = proj.radius + zombie.radius;
                const targetDist = zombie.type === 'big' ? edgeDist * 0.8 : edgeDist;
                const currentDist = Math.hypot(zombie.x - proj.x, zombie.y - proj.y);
                if (currentDist < targetDist) {
                  const kbForce = targetDist - currentDist;
                  // Calculate initial velocity needed to travel kbForce distance with 0.92 friction
                  const v0 = kbForce * 0.08;
                  zombie.vx += Math.cos(angle) * v0;
                  zombie.vy += Math.sin(angle) * v0;
                }
              } else {
                const baseKb = 30;
                const kbForce = zombie.type === 'big' ? baseKb * 0.15 : baseKb;
                const v0 = kbForce * 0.08;
                zombie.vx += Math.cos(angle) * v0;
                zombie.vy += Math.sin(angle) * v0;
              }
            }
          }

          // Hit effects — 由 BulletDefinitions / 未來 SlashDefinitions 的 onHit 決定
          if (proj.type === 'bullet') {
            zombie.flashWhiteTimer = 90; // 怪物全身純白閃爍 0.09秒
            const bulletDef = BULLET_REGISTRY[proj.bulletType] ?? BULLET_REGISTRY['blue_ellipse'];
            bulletDef.onHit?.({ zombie, pushEffect: e => this.hitEffects.push(e) });
          }

          if (zombie.type === 'big') {
            // Dark green liquid drip
            this.slimeTrails.push({ x: zombie.x, y: zombie.y, radius: 10, lifetime: 3000, maxLifetime: 3000 });
          }

          if (zombie.hp <= 0) {
            const hitAngle = Math.atan2(proj.vy, proj.vx);
            const children = this.killZombie(zombie, proj.ownerId, proj.level, hitAngle);
            for (const child of children) proj.hitZombies.add(child);
          }

          if (proj.type === 'bullet' && proj.hitZombies.size >= proj.pierce) {
            this.projectiles.splice(i, 1);
            break;
          }
        }
      }
    }

    // Update items
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.update(dt);

      if (item.lifetime <= 0) {
        this.items.splice(i, 1);
        continue;
      }

      let isBeingStepped = false;

      // Item-Player collision
      for (const player of this.players) {
        if (player.hp <= 0) continue;

        // Magnetic effect for energy orbs
        if (item.type === 'energy_orb' && Date.now() - item.spawnTime > 200) {
          if (item.attractedByPlayerId !== null) {
            const lockedPlayer = this.players.find(p => p.id === item.attractedByPlayerId && p.hp > 0);
            if (!lockedPlayer) item.attractedByPlayerId = null;
          }

          if (item.attractedByPlayerId === null) {
            const magneticRadius = 200 * player.pickupRadiusMultiplier;
            const distToPlayer = Math.hypot(player.x - item.x, player.y - item.y);
            if (distToPlayer < magneticRadius) {
              item.attractedByPlayerId = player.id;
            }
          }

          if (item.attractedByPlayerId === player.id) {
            const angle = Math.atan2(player.y - item.y, player.x - item.x);
            const speed = 400 * (dt / 1000); // Magnetic speed

            // Wave motion: add a sine wave perpendicular to the movement direction
            const time = Date.now() / 100;
            const waveAmplitude = 10;
            const waveFrequency = 0.5;
            const waveOffset = Math.sin(time * waveFrequency) * waveAmplitude;

            // Perpendicular vector
            const perpX = -Math.sin(angle);
            const perpY = Math.cos(angle);

            item.x += Math.cos(angle) * speed + perpX * waveOffset * 0.1;
            item.y += Math.sin(angle) * speed + perpY * waveOffset * 0.1;
          }
        }

        if (item.type === 'energy_orb' && item.attractedByPlayerId !== null && item.attractedByPlayerId !== player.id) {
          continue;
        }

        const dist = Math.hypot(player.x - item.x, player.y - item.y);

        if (dist < player.radius + item.radius) {
          if (item.type === 'weapon_sword' || item.type === 'weapon_gun') {
            isBeingStepped = true;
            item.targetedByPlayerId = player.id;
            item.pickupProgress += dt;
            
            // 蓄力達到 3000ms (3秒) 拾取成功
            if (item.pickupProgress >= 3000) {
              audioManager.playPickup();
              player.weapon = item.type === 'weapon_sword' ? 'sword' : 'gun';
              player.syncWeaponToSlot(); // 立即同步等級與狀態
              player.weaponSwitchTimer = 500;
              player.weaponSwitchType = player.weapon;
              
              item.pickupProgress = 0;
              item.targetedByPlayerId = null;
              this.items.splice(i, 1);
              break; 
            }
          } else {
            // 普通道具立即拾取
            audioManager.playPickup();
            if (item.type === 'speed') {
              player.speedBoostTimer = 5000;
            } else if (item.type === 'shield') {
              player.activateShield(3000);
            } else if (item.type === 'energy_orb') {
              const val = item.value || 1;
              this.awardOrbXp(player, val);
              // ── 共同薪資：所有存活玩家各自獲得相同金幣（獨立錢包）──
              for (const p of this.players) {
                p.materials += val;
              }
            }

            this.items.splice(i, 1);
            break;
          }
        }
      }

      // 如果無人踩在該武器上，進度瞬間歸零
      if (!isBeingStepped && (item.type === 'weapon_sword' || item.type === 'weapon_gun')) {
        item.pickupProgress = 0;
        item.targetedByPlayerId = null;
      }
    }

    // Update heal VFX
    this.healVFX = this.healVFX.filter(vfx => {
      const owner = vfx.ownerId !== undefined
        ? this.players.find(player => player.id === vfx.ownerId)
        : null;

      if (owner && owner.hp >= owner.maxHp) {
        return false;
      }

      vfx.y -= 1; // 相對玩家向上漂浮
      vfx.alpha -= 0.02; // 逐漸淡出
      return vfx.alpha > 0;
    });

    // Update hit effects
    for (let i = this.hitEffects.length - 1; i >= 0; i--) {
      const effect = this.hitEffects[i];
      effect.lifetime -= dt;
      // 物理驅動的碎片：套用慣性與空氣阻力
      if (effect.vx !== undefined && effect.vy !== undefined) {
        effect.x += effect.vx * (dt / 16);
        effect.y += effect.vy * (dt / 16);
        const drag = Math.pow(0.88, dt / 16); // 極強空氣阻力 → 快速定格
        effect.vx *= drag;
        effect.vy *= drag;
        // 加入微弱重力
        effect.vy += 0.15 * (dt / 16);
      }
      if (effect.lifetime <= 0) {
        this.hitEffects.splice(i, 1);
      }
    }

    this.onUpdateUI(this.players[0] || null, this.players[1] || null, this.waveManager);
  }

  applyWaveMechanisms(dt: number) {
    _applyWaveMechanisms(this, dt);
  }

  handleObstacleInteractions(dt: number) { _handleObstacleInteractions(this, dt); }
  private findNearestZombie(x: number, y: number, maxDist: number) { return _findNearestZombie(this, x, y, maxDist); }
  private explodeObstacle(obs: Obstacle) { _explodeObstacle(this, obs); }
  private dropVendingMachineItems(obs: Obstacle) { _dropVendingMachineItems(this, obs); }
  handlePlayerAttacks(player: Player) { _handlePlayerAttacks(this, player); }
  spawnZombie() { _spawnZombie(this); }
  spawnItemAt(x: number, y: number) { _spawnItemAt(this, x, y); }
  spawnItem() { _spawnItem(this); }

  /**
   * 殭屍死亡統一處理：音效、掉落 orb、爆裂特效、slime 分裂、移除、加分。
   * 回傳新生成的子殭屍（供呼叫方加入命中保護 Set）。
   */
  killZombie(zombie: Zombie, ownerId: number | null, attackLevel: number, hitAngle?: number): Zombie[] {
    const zombieIndex = this.zombies.indexOf(zombie);
    if (zombieIndex === -1) return [];

    audioManager.playKill();
    const zombieDef = ZOMBIE_REGISTRY[zombie.type];

    // ── 碎裂噴發 (Gibbing) ─────────────────────────────────────────────────
    const burstAngle = hitAngle !== undefined ? hitAngle : Math.random() * Math.PI * 2;
    const gibCount = 3 + Math.floor(Math.random() * 3); // 3~5 顆肉塊
    for (let g = 0; g < gibCount; g++) {
      // 在受擊反方向的扇形範圍 (±40°) 內散射
      const spreadAngle = burstAngle + (Math.random() - 0.5) * 1.4;
      const speed = 10 + Math.random() * 7; // 初速 10~17 px/tick (目標距離 80~150px)
      this.hitEffects.push({
        x: zombie.x, y: zombie.y,
        type: 'gib_blood',
        lifetime: 400 + Math.random() * 200,
        maxLifetime: 600,
        vx: Math.cos(spreadAngle) * speed,
        vy: Math.sin(spreadAngle) * speed,
        rotation: Math.random() * Math.PI * 2,
        size: 3 + Math.random() * 4,
      });
    }

    // 掉落能量球
    for (let i = 0; i < zombieDef.orbCount; i++) {
      const ox = (Math.random() - 0.5) * 20;
      const oy = (Math.random() - 0.5) * 20;
      this.items.push(new Item(zombie.x + ox, zombie.y + oy, 'energy_orb', 15000, zombieDef.orbValue, zombieDef.orbColor));
    }

    if (this.mode === 'arena' && this.baggedMaterials > 0) {
      this.items.push(new Item(zombie.x, zombie.y, 'energy_orb', 15000, this.baggedMaterials, '#fbbf24'));
      this.baggedMaterials = 0;
    }

    // 爆裂死亡特效
    this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'death_burst', lifetime: 450, maxLifetime: 450 });

    // 解體特效（高等級攻擊）
    if ((zombie.type === 'normal' || zombie.type === 'spitter') && attackLevel >= 4) {
      this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'dismember', lifetime: 500, maxLifetime: 500 });
    }

    // slime 分裂
    const children: Zombie[] = [];
    if (zombieDef.splitOnDeath) {
      const specs = zombieDef.splitOnDeath(zombie.x, zombie.y);
      for (const spec of specs) {
        const child = new Zombie(spec.x, spec.y, spec.type);
        child.id = ++this._zombieIdCounter;
        child.vx = spec.vx;
        child.vy = spec.vy;
        this.zombies.push(child);
        children.push(child);
      }
    }

    // 岩漿標記：怪死時鎖定位置 + 生成焦屍視覺
    for (const effect of this.activeEffects) {
      if (effect.type === 'lava_mark' && effect.targetZombieId === zombie.id) {
        effect.targetZombieId = undefined;  // 停止跟蹤，位置已鎖定
        this.hitEffects.push({ x: effect.x, y: effect.y, type: 'charred_body', lifetime: effect.lifetime + 300, maxLifetime: effect.lifetime + 300 });
      }
    }

    this.zombies.splice(zombieIndex, 1);

    this.score++;
    const owner = this.players.find(p => p.id === ownerId);
    if (owner) owner.kills++;

    if (Math.random() < 0.10) this.spawnItemAt(zombie.x, zombie.y);

    return children;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);

    ctx.save();

    // Screen Shake
    if (this.shakeTimer > 0) {
      const intensity = 5;
      ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
    }

    // Pixel snap camera in render path to avoid sub-pixel seam artifacts on tiled ground.
    const renderCameraX = Math.round(this.camera.x);
    const renderCameraY = Math.round(this.camera.y);
    ctx.translate(-renderCameraX, -renderCameraY);

    // Draw map (grid and obstacles)
    this.mapManager.draw(ctx, renderCameraX, renderCameraY, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT, this.players, {
      wave: this.waveManager.currentWave,
      isInfinite: this.waveManager.isInfinite,
      activeMechanics: this.waveManager.activeMechanics
    });

    if (this.mode === 'arena') {
      if (this.arenaBorder) {
        drawArenaBorder(ctx, this.arenaWidth, this.arenaHeight, this.arenaBorder);
      }
    }

    // Draw slime trails
    for (const trail of this.slimeTrails) {
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, trail.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(139, 195, 74, ${(trail.lifetime / trail.maxLifetime) * 0.5})`;
      ctx.fill();
      ctx.closePath();
    }

    // 模組 H：道具淡入修復動畫（_fadeAlpha: 0→1 漸出）
    for (const item of this.items) {
      const alpha = (item as any)._fadeAlpha;
      if (alpha !== undefined) {
        ctx.globalAlpha = alpha;
        const next = Math.min(1, alpha + 0.05);
        (item as any)._fadeAlpha = next;
        if (next >= 1) delete (item as any)._fadeAlpha;
      }
      item.draw(ctx);
      if (alpha !== undefined) ctx.globalAlpha = 1;
    }
    for (const proj of this.projectiles) proj.draw(ctx);
    drawActiveEffects(this.activeEffects, ctx);
    drawMissiles(this.missiles, ctx);
    drawArcProjectiles(this.arcProjectiles, ctx);
    drawSwordProjectiles(this.swordProjectiles, ctx);
    for (const zombie of this.zombies) {
      if (zombie.hp > 0) zombie.draw(ctx);
    }
    for (const player of this.players) player.draw(ctx);

    // Apply Mechanism Filters (Fog of War, etc.)
    this.drawWaveFilters(ctx);

    for (const effect of this.hitEffects) {
      if (effect.followZombieId !== undefined) {
        const target = this.zombies.find(z => z.id === effect.followZombieId);
        if (target) {
          drawHitEffect({ ...effect, x: target.x, y: target.y }, ctx);
          continue;
        }
      }
      drawHitEffect(effect, ctx);
    }

    ctx.restore(); // Restore camera translation


  }

  drawWaveFilters(ctx: CanvasRenderingContext2D) {
    _drawWaveFilters(this, ctx);
  }

}
