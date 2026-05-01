import { DirectorAI } from "./systems/DirectorAI";
import { ZombiePool } from "./systems/ObjectPool";
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
import { handleObstacleInteractions as _handleObstacleInteractions, handlePlayerAttacks as _handlePlayerAttacks, findNearestAutoTarget as _findNearestAutoTarget, explodeObstacle as _explodeObstacle, dropVendingMachineItems as _dropVendingMachineItems } from './systems/CombatSystem';
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
import { drawArenaAppleTree } from './renderers/ArenaAppleTreeRenderer';
import { getGeneratedObstacleSize } from './map/MapManager';
import { updateTombstones } from './systems/TombstoneSystem';
import { applyGunKnockback } from './systems/GunKnockback';

type KillZombieOptions = {
  suppressOrbDrops?: boolean;
  suppressItemDrop?: boolean;
  suppressBagReward?: boolean;
  suppressSplit?: boolean;
};

type ArenaLootBagState = {
  startX: number;
  startY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  phase: 'throw' | 'suck' | 'settle';
  timer: number;
  duration: number;
  storedValue: number;
};

type PendingArenaBagReward = {
  value: number;
  sourceWave: number;
  spawned: boolean;
};

type ArenaAppleTreeState = {
  ownerPlayerId: number;
  x: number;
  y: number;
  nextDropAt: number;
  seed: number;
};

export class Game {
  players: Player[] = [];
  zombies: Zombie[] = [];
  zombiePool: ZombiePool;
  directorAI: DirectorAI;
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
  onVictory?: (time: number, kills: number) => void;
  onUpdateUI: (p1: Player | null, p2: Player | null, waveManager: WaveManager) => void;
  waveManager: WaveManager;
  mode: GameMode = 'endless';
  arenaWidth: number = 1500;
  arenaHeight: number = 1500;
  arenaBorder: ArenaBorderLayout | null = null;
  private _arenaWaveStartLevels: number[] = []  // 瘥??拙振?郭甈⊿?憪?蝝?
  sharedStatPoints: number = 0;   // ?砍?犖璅∪??曹澈蝝釭暺瘙?
  arenaLootBag: ArenaLootBagState | null = null;
  pendingArenaBagReward: PendingArenaBagReward | null = null;
  arenaAppleTrees: ArenaAppleTreeState[] = [];
  activeBagCarrierId: number | null = null;
  bagCarrierSpawnTimer: number = 0;
  private readonly SLIME_TRAIL_SLOW_MS = 700;
  private readonly ARENA_APPLE_TREE_ITEM_ID = 'apple_tree';
  private readonly ARENA_APPLE_DROP_INTERVAL_MS = 10000;
  private readonly ARENA_APPLE_HEAL_AMOUNT = 50;
  private readonly ARENA_APPLE_DROP_MIN_RADIUS = 28;
  private readonly ARENA_APPLE_DROP_MAX_RADIUS = 62;

  // 蝬脰楝憭犖璅∪?
  networkMode: boolean = false;
  networkPlayerId: number = 1;
  networkInputSendTimer: number = 0;
  onSendInput: ((dx: number, dy: number) => void) | null = null;

  // ?? 璅∠? C嚗敶Ｙ楨銵?嚗?餈?200 撟?砍?????Rollback ?剁?
  localTick = 0;
  readonly CIRC_BUF_SIZE = 200;
  circularBuffer: Array<{ tick: number; x: number; y: number; vx: number; vy: number } | null>
    = new Array(200).fill(null);

  // ?? Reconciliation嚗ost 蝣箄???敺???P2 input tick ?????
  hostLastAckTick = 0;

  // ?? 璅∠? H嚗??瑟??皜穿?client-side prediction嚗?
  pendingPickups: Array<{ x: number; y: number; type: string; time: number }> = [];

  // ?€?€ 璅∠? E / F嚗ardSync ??嚗??臬??敺?or 瘜Ｘ活??嚗?
  pendingHardSync = false;

  // ?€?€ Feature 3/6: Stable zombie IDs
  _zombieIdCounter: number = 0;

  // ── Host 模式，P2P，與本地預測 ──
  isHostMode: boolean = false;

  // 哥布林生成回調（用於 UI 提示）
  public onGoblinSpawned: ((carrier: Zombie) => void) | null = null;
  public hasFiredGoblinEvent: boolean = false;

  // ?€?€ ?頂???拇?畾箔???SwordSystem 憛怠嚗ame.update 蝯偏??嚗?
  pendingSwordKills: Map<Zombie, { ownerId: number | null; level: number; hitAngle?: number }> = new Map();

  // ?€?€ Feature 5: Lag compensation ??hitbox expansion + backward reconciliation
  lagCompensationRadius: number = 0;
  playerLatencies: Map<number, number> = new Map(); // playerId ??one-way latency (ms)

  // Zombie position history ring buffer for backward reconciliation (30 ticks @ 60Hz = 500ms)
  private _zombieHistoryBuf: Array<Map<number, { x: number; y: number }>> = [];
  private _zombieHistoryTick: number = 0;
  private readonly _HISTORY_SIZE = 30;

  // ?? Feature 4: Snapshot ring buffer for timing-based interpolation (50ms render delay)
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
    this.mode = mode;
    this.mapManager = new MapManager(mode);
    this.waveManager = new WaveManager(mode);
    this.init(playerCount);
  }

  init(playerCount: number) {
    this.players = [];
    if (playerCount >= 1) {
      const p1 = new Player(1, 400, 300, '#3498db');
      // [璅∠??矽?弼 ???璅∪??曉?賡?閮凋蝙?冽瘚格郎?券?頛荔????港??渡?擃?
      p1.isFloatingWeapons = true;
      this.players.push(p1);
    }
    if (playerCount >= 2) {
      const p2 = new Player(2, 450, 300, '#e74c3c');
      p2.isFloatingWeapons = true;
      this.players.push(p2);
    }
    this.zombies = [];
      this.zombiePool = new ZombiePool(10);
      this.directorAI = new DirectorAI(this);
    this.projectiles = [];
    this.swordProjectiles = [];
    this.arcProjectiles = [];
    this.missiles = [];
    this.items = [];
    this.hitEffects = [];
    this.activeEffects = [];
    this.slimeTrails = [];
    this.arenaLootBag = null;
    this.pendingArenaBagReward = null;
    this.arenaAppleTrees = [];
    this.activeBagCarrierId = null;
    this.hasFiredGoblinEvent = false;
    this.bagCarrierSpawnTimer = 0;
    this.keys = {};
    this.score = 0;
    this.startTime = Date.now();
    this.lastItemSpawnTime = Date.now();
    this.zombieSpawnTimer = 0;
    this.isGameOver = false;
    this.mapManager = new MapManager(this.mode);
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

    this.resetArenaPlayersToCenter();
  }

  private resetArenaPlayersToCenter() {
    const centerX = (this.playableArenaBounds.left + this.playableArenaBounds.right) * 0.5;
    const centerY = (this.playableArenaBounds.top + this.playableArenaBounds.bottom) * 0.5;

    if (this.players[0]) {
      this.players[0].x = centerX - (this.players.length > 1 ? 28 : 0);
      this.players[0].y = centerY;
      this.players[0].lastMoveDir = { x: 1, y: 0 };
    }
    if (this.players[1]) {
      this.players[1].x = centerX + 28;
      this.players[1].y = centerY;
      this.players[1].lastMoveDir = { x: -1, y: 0 };
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

  clampToArenaBounds(x: number, y: number, padding: number = 0) { const bounds = this.playableArenaBounds; return { x: Math.max(bounds.left + padding, Math.min(bounds.right - padding, x)), y: Math.max(bounds.top + padding, Math.min(bounds.bottom - padding, y)) }; }

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

  private playerOwnsArenaAppleTree(player: Player): boolean {
    return player.ownedItems.some(item => item.defId === this.ARENA_APPLE_TREE_ITEM_ID);
  }

  private isArenaAppleTreeSpawnSafe(x: number, y: number): boolean {
    const minObstacleClearance = 52;
    const minTreeSpacing = 82;

    for (const obs of this.mapManager.getNearbyObstacles(x, y)) {
      const nearestX = Math.max(obs.x, Math.min(x, obs.x + obs.width));
      const nearestY = Math.max(obs.y, Math.min(y, obs.y + obs.height));
      if (Math.hypot(x - nearestX, y - nearestY) < minObstacleClearance) {
        return false;
      }
    }

    for (const tree of this.arenaAppleTrees) {
      if (Math.hypot(x - tree.x, y - tree.y) < minTreeSpacing) {
        return false;
      }
    }

    return true;
  }

  private findArenaAppleTreeSpawn(player: Player) {
    for (let attempt = 0; attempt < 14; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 110 + Math.random() * 110;
      const candidate = this.clampToArenaBounds(
        player.x + Math.cos(angle) * dist,
        player.y + Math.sin(angle) * dist,
        64,
      );
      if (this.isArenaAppleTreeSpawnSafe(candidate.x, candidate.y)) {
        return candidate;
      }
    }

    return this.clampToArenaBounds(player.x + player.lastMoveDir.x * 130, player.y + player.lastMoveDir.y * 130, 64);
  }

  private spawnArenaAppleTrees() {
    this.arenaAppleTrees = [];
    if (this.mode !== 'arena') return;

    const now = Date.now();
    for (const player of this.players) {
      if (!this.playerOwnsArenaAppleTree(player)) continue;
      const point = this.findArenaAppleTreeSpawn(player);
      this.arenaAppleTrees.push({
        ownerPlayerId: player.id,
        x: point.x,
        y: point.y,
        nextDropAt: now + this.ARENA_APPLE_DROP_INTERVAL_MS,
        seed: Math.random() * 1000,
      });
    }
  }

  private updateArenaAppleTrees() {
    if (this.mode !== 'arena' || this.arenaAppleTrees.length === 0) return;
    const now = Date.now();

    for (const tree of this.arenaAppleTrees) {
      while (now >= tree.nextDropAt) {
        const angle = Math.random() * Math.PI * 2;
        const radius = this.ARENA_APPLE_DROP_MIN_RADIUS
          + Math.random() * (this.ARENA_APPLE_DROP_MAX_RADIUS - this.ARENA_APPLE_DROP_MIN_RADIUS);
        const dropX = tree.x + Math.cos(angle) * radius;
        const dropY = tree.y + 10 + Math.sin(angle) * radius * 0.72;
        this.items.push(new Item(dropX, dropY, 'apple', Infinity, this.ARENA_APPLE_HEAL_AMOUNT));
        tree.nextDropAt += this.ARENA_APPLE_DROP_INTERVAL_MS;
      }
    }
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
    }
  }

  // 璅∠? F嚗??臬??敺???閫貊銝?撟撘瑕蝖砍?甇?
  triggerHardSync() {
    this.pendingHardSync = true;
  }

  // ?? Host 璅∪?嚗???????靘?P2P 撱?蝯?P2嚗????????
  // ?澆?????server.ts serializeState 摰?詨?嚗2 ??applyNetworkState 銝??孵?
  serializeState(tick: number, hardSync: boolean): object {
    return _serializeState(this, tick, hardSync);
  }

  // ?交隡箸??函??蒂?湔?砍撖阡?
  // HardSync 瘛∪?桃蔗嚗? = ?券?嚗?0 瞍詨嚗?
  _hardSyncFade = 0;

  applyNetworkState(state: any) {
    _applyNetworkState(this, state);
  }

  testMode: boolean = false;
  debugPaused: boolean = false;
  isPaused: boolean = false; // ?啣??典??怠????
  debugHpLocked: boolean = false;
  debugInfiniteCoins: boolean = false; // 皜祈岫?剁??⊿??馳

  handleKeyDown = (e: KeyboardEvent) => {
    this.keys[e.key] = true;
    if (e.key === '`') { this.testMode = !this.testMode; return; }
    if (!this.testMode) return;
    if (e.key === 'b' || e.key === 'B') this._debugSpawn('butcher');
    if (e.key === 'n' || e.key === 'N') for (let i = 0; i < 5; i++) this._debugSpawn('normal');
    if (e.key === 'k' || e.key === 'K') this.zombies = [];
      this.zombiePool = new ZombiePool(10);
      this.directorAI = new DirectorAI(this);
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

  // ?? Debug API嚗? TestModePanel ?澆嚗????????????????????????????????????
  debugSpawnZombie(type: ZombieType, count: number = 1) {
    for (let i = 0; i < count; i++) this._debugSpawn(type);
  }

  debugHealAll() {
    this.players.forEach(p => { p.hp = p.maxHp; });
  }

  debugSetPlayerLevel(pid: number, level: number) {
    const p = this.players.find(pl => pl.id === pid);
    if (!p) return;

    const next = Math.max(1, Math.min(8, level));
    p.level = next;
    p.weaponLevels.sword = next;
    p.weaponLevels.gun = next;
    if (next < 5) {
      p.weaponBranches.sword = null;
      p.weaponBranches.gun = null;
    }
    p.syncWeaponToSlot();
  }

  debugSetWeapon(pid: number, weapon: 'sword' | 'gun', level: number) {
    const p = this.players.find(pl => pl.id === pid);
    if (!p) return;
    p.weapon = weapon;
    p.weaponLevels[weapon] = Math.max(1, Math.min(8, level));
    p.syncWeaponToSlot();
  }
  debugSetWeaponBranch(pid: number, weapon: 'sword' | 'gun', branch: 'A' | 'B' | null) {
    const p = this.players.find(pl => pl.id === pid);
    if (!p) return;
    p.weaponBranches[weapon] = branch;
    if (branch && p.weaponLevels[weapon] < 5) p.weaponLevels[weapon] = 5;
    if (branch && p.level < 5) p.level = 5;
    p.syncWeaponToSlot();
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
    this.waveManager.isInfinite = false; // ??頝單郭甈⊥??蔭?⊿?璅∪?嚗?楛?脰???
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
    // 蝡??嚗??摰園?撟?身?箸扔憭批?
    if (this.debugInfiniteCoins) {
      this.players.forEach(p => { p.materials = 999999; });
    }
  }

  // ?? ???豢?憟 ????????????????????????????????????????????????????????????
  applyUpgrade(playerId: number, card: import('../components/UpgradePanel').UpgradeCard) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    if (card.kind === 'weapon_level') {
      player.weaponLevels[card.weapon] = Math.min(8, player.weaponLevels[card.weapon] + 1);
    } else if (card.kind === 'branch') {
      player.weaponBranches[card.weapon] = card.branch;
      player.weaponLevels[card.weapon] = 5; // ?詨??臬?????Lv5
    } else {
      // 鋡怠?
      switch (card.key) {
        case 'damage': player.damageMultiplier += 0.15; break;
        case 'haste': player.attackSpeedMultiplier += 0.15; break;
        case 'agility': player.speed += player.speed * 0.10; break;
        case 'vitality': player.maxHp += 25; player.hp = Math.min(player.hp + 25, player.maxHp); break;
        case 'magnet': player.pickupRadiusMultiplier += 0.5; break;
        case 'recovery': player.hp = Math.min(player.hp + 30, player.maxHp); break;
      }
    }

    // ?? 璅∠???甇???
    // 憟??敺??喳?甇亙甇血瑽賭?嚗圾瘙箇蝺芋撘郎?其??湔??憿?
    player.syncWeaponToSlot();

    // ??摰?敺策鈭?霅瑁???
    player.activateShield(2500);
    player.speedBoostTimer = 4000;

    player.pendingLevelUp = false;

    // ?? 蝡閫貊 UI ?湔 ??
    // 蝣箔?敶?蝡??嚗??????????
    this.onUpdateUI(this.players[0] || null, this.players[1] || null, this.waveManager);
  }

  // ?? Arena Mode Logic ????????????????????????????????????????????????????????
  clearEntitiesForShop() {
    if (this._shopEntryHandled) return;
    this._shopEntryHandled = true;

    // ?? 蝡嗆??渡?鞈芷??貊?蝞?瘥郭?箏? 1 暺?+ ?祆郭??甈⊥ ??????????????????????
    if (this.mode === 'arena') {
      const isLocalDuo = !this.networkMode && this.players.length === 2;
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        const startLv = this._arenaWaveStartLevels[i] ?? 1;
        const levelsGained = Math.max(0, p.level - startLv);
        const earned = 1 + levelsGained;
        if (isLocalDuo) {
          // ?砍?犖嚗鈭恍??豢?嚗閮? P1 ??蝝??踹?????嚗?
          if (i === 0) this.sharedStatPoints += earned;
        } else {
          p.arenaStatPoints += earned;
        }
        p.pendingLevelUp = false;
      }
    }

    this.zombies = [];
      this.zombiePool = new ZombiePool(10);
      this.directorAI = new DirectorAI(this);
    this.projectiles = [];
    this.swordProjectiles = [];
    this.arcProjectiles = [];
    this.missiles = [];
    this.hitEffects = [];
    this.activeEffects = [];
    this.slimeTrails = []; // explicitly clear these
    this.items = [];
    this.arenaAppleTrees = [];
    this.pendingSwordKills.clear();
    this.arenaLootBag = null;
    this._shopReadyToOpen = false;
    this.clearArenaWaveObstacles();
    this.activeBoss = null;
  }

  activeTombstones: Obstacle[] = [];
  activeBoss: Zombie | null = null;

  /** 序列化本波所有 isArenaWaveObstacle 障礙物，供 Host 傳送給 P2 */
  getArenaWaveObstacleData(): { x: number; y: number; w: number; h: number; tp: string; sd: number; hp: number; mhp: number }[] {
    const result: { x: number; y: number; w: number; h: number; tp: string; sd: number; hp: number; mhp: number }[] = [];
    for (const list of this.mapManager.obstacles.values()) {
      for (const obs of list) {
        if (obs.isArenaWaveObstacle) {
          result.push({ x: obs.x, y: obs.y, w: obs.width, h: obs.height, tp: obs.type, sd: obs.seed, hp: obs.hp, mhp: obs.maxHp });
        }
      }
    }
    return result;
  }

  /** P2 端：清除自己的波次障礙物，套用 Host 傳來的資料 */
  applyArenaWaveObstacles(data: { x: number; y: number; w: number; h: number; tp: string; sd: number; hp: number; mhp: number }[]) {
    this.clearArenaWaveObstacles();
    this.activeTombstones = [];
    for (const d of data) {
      const obs = new Obstacle(d.x, d.y, d.w, d.h, d.tp as import('./types').ObstacleType);
      obs.seed = d.sd;
      obs.hp   = d.hp;
      obs.maxHp = d.mhp;
      obs.isArenaWaveObstacle = true;
      this.addObstacleToMap(obs);
      if (obs.type === 'tombstone') this.activeTombstones.push(obs);
    }
  }

  addObstacleToMap(obs: Obstacle) {
    const CHUNK_SIZE = 800;
    const key = `${Math.floor(obs.x / CHUNK_SIZE)},${Math.floor(obs.y / CHUNK_SIZE)}`;
    const list = this.mapManager.obstacles.get(key) ?? [];
    list.push(obs);
    this.mapManager.obstacles.set(key, list);
  }

  private clearArenaWaveObstacles() {
    if (this.mode !== "arena") return;

    for (const [key, list] of [...this.mapManager.obstacles.entries()]) {
      const next = list.filter(obs => !obs.isArenaWaveObstacle);
      if (next.length === list.length) continue;
      if (next.length > 0) {
        this.mapManager.obstacles.set(key, next);
      } else {
        this.mapManager.obstacles.delete(key);
      }
    }

    this.activeTombstones = [];
  }

  nextArenaWave() {
    if (this.mode !== "arena") return;
    this._arenaWaveStartLevels = this.players.map(p => p.level);

    this.clearArenaWaveObstacles();
    this.activeBoss = null;
    this.resetArenaPlayersToCenter();

    this.waveManager.startCombat();
    this._shopEntryHandled = false;
    this._shopCleared = false;
    this._shopReadyToOpen = false;
    this.arenaLootBag = null;
    this.arenaAppleTrees = [];
    this.activeBagCarrierId = null;
    this.bagCarrierSpawnTimer = this.pendingArenaBagReward && !this.pendingArenaBagReward.spawned ? 3000 : 0;

    const waveId = this.waveManager.currentWaveConfig.id;
    if (waveId === 5) {
      const pt = this.randomArenaPoint(150);
      const obs = new Obstacle(pt.x, pt.y, 60, 60, "tombstone");
      obs.isArenaWaveObstacle = true;
      obs.maxHp *= 2;
      obs.hp = obs.maxHp;
      this.addObstacleToMap(obs);
      this.activeTombstones.push(obs);
    } else if (waveId >= 6 && waveId <= 8) {
      const pt = this.randomArenaPoint(150);
      const obs = new Obstacle(pt.x, pt.y, 60, 60, "tombstone");
      obs.isArenaWaveObstacle = true;
      this.addObstacleToMap(obs);
      this.activeTombstones.push(obs);
    } else if (waveId === 9) {
      for (let i = 0; i < 3; i++) {
        const pt = this.randomArenaPoint(150);
        const obs = new Obstacle(pt.x, pt.y, 60, 60, "tombstone");
        obs.isArenaWaveObstacle = true;
        this.addObstacleToMap(obs);
        this.activeTombstones.push(obs);
      }
    } else if (waveId === 10) {
      const pt = { x: this.arenaWidth / 2, y: this.arenaHeight / 2 - 100 };
      const boss = new Zombie(pt.x, pt.y, "butcher");
      boss.maxHp *= 30;
      boss.hp = boss.maxHp;
      (boss as any).scale = 2.5;
      this.zombies.push(boss);
      this.activeBoss = boss;
    }

    this.generateArenaTacticalObstacles(waveId);

    if (!this.networkMode) {
      this.spawnArenaAppleTrees();
    }
  }

  private generateArenaTacticalObstacles(waveId: number) {
    if (this.mode !== 'arena') return;

    // ── 碰撞半徑速查表（circle型用 width/2，AABB型用 {hw, hh}）
    // pillar: r=20, rock: r=45, building: r=100, sandbag: r=30
    // explosive_barrel: r=30, monolith: r=35, streetlight: r=10(特例)
    // tree: 樹幹 r≈14（不阻擋，幾乎無視）
    // container: AABB 140×80, wall: AABB 80×80, vending_machine: AABB 60×60
    // 安全間距 padding = 15px

    // ── 已放障礙物登記冊（用於散落背景物件的 AABB 檢查）
    type PlacedBox = { cx: number; cy: number; r: number };
    const placedBoxes: PlacedBox[] = [];

    const registerCircle = (cx: number, cy: number, r: number) =>
      placedBoxes.push({ cx, cy, r });

    const canPlace = (cx: number, cy: number, r: number, pad = 15) =>
      placedBoxes.every(b => Math.hypot(cx - b.cx, cy - b.cy) > r + b.r + pad);

    const place = (obs: Obstacle, effectiveRadius: number): boolean => {
      const cx = obs.x + obs.width / 2;
      const cy = obs.y + obs.height / 2;
      // Reject if overlaps any already-placed obstacle (universal check for ALL patterns + scatter)
      if (!canPlace(cx, cy, effectiveRadius)) return false;
      obs.isArenaWaveObstacle = true;
      this.addObstacleToMap(obs);
      registerCircle(cx, cy, effectiveRadius);
      return true;
    };

    // ── 9 個戰術陣型（偏移量依碰撞半徑精確設計，保留 15px 安全間距）
    const patterns = [

      // 1. 防禦陣地 (Sandbag fort)
      // 3 個沙包(r=30)圍成半圓弧 + 路燈在後方
      // 沙包間距：中心距 ≥ 30+30+15=75，用 80px
      () => {
        const pt = this.randomArenaPoint(200);
        // 半圓弧：3 個沙包，間距 80px，以 pt 為中心向下展開
        const sbOffsets = [{ x: -80, y: 50 }, { x: 0, y: 70 }, { x: 80, y: 50 }];
        sbOffsets.forEach(off => {
          const obs = new Obstacle(pt.x + off.x - 30, pt.y + off.y - 30, 60, 60, 'sandbag');
          place(obs, 30);
        });
        // 路燈：在中心正上方，遠離所有沙包（至少 30+10+15=55，用 80）
        const sl = new Obstacle(pt.x - 10, pt.y - 50, 60, 60, 'streetlight');
        place(sl, 10);
      },

      // 2. 廢棄路障 (Wall blockade)
      // 3 面牆 AABB 80×80，水平時左右排列，各牆之間緊貼（不重疊）
      // 水平：牆1 center-x = pt.x-80, 牆2 = pt.x, 牆3 = pt.x+80  → 各中心距 80 剛好不重疊
      // 垂直：同理 y 軸
      () => {
        const pt = this.randomArenaPoint(300);
        const isHorizontal = Math.random() > 0.5;
        const useWall = Math.random() > 0.5;
        const type = useWall ? 'wall' : 'electric_fence';
        for (let i = 0; i < 3; i++) {
          const ox = isHorizontal ? (i - 1) * 85 : 0;
          const oy = isHorizontal ? 0 : (i - 1) * 85;
          // wall: AABB，effective radius 近似 half-diagonal ≈ 57，但排列方向已計算，只登記 42（半寬）
          const obs = new Obstacle(pt.x + ox - 40, pt.y + oy - 40, 80, 80, type as any);
          place(obs, 42);
        }
      },

      // 3. 危險角落 (Container + Barrels)
      // container AABB 140×80，有效半徑近似 82
      // barrel(r=30) 放在 container 外側：需 82+30+15=127 ≥ center-to-center
      // 實際偏移：桶1 在右側 x+115, 桶2 在上側 y-105
      () => {
        const pt = this.randomArenaPoint(200);
        // Container 中心在 pt
        const cont = new Obstacle(pt.x - 70, pt.y - 40, 140, 80, 'container');
        place(cont, 82);
        // Barrel 右側：container right edge = pt.x+70, 再推 30+15=45 → barrel center = pt.x+115
        const b1 = new Obstacle(pt.x + 115 - 30, pt.y - 30, 60, 60, 'explosive_barrel');
        place(b1, 30);
        // Barrel 上方：container top edge = pt.y-40, 再推 30+15=45 → barrel center = pt.y-85
        const b2 = new Obstacle(pt.x - 30, pt.y - 115, 60, 60, 'explosive_barrel');
        place(b2, 30);
      },

      // 4. 自然點綴 (Trees & Rocks)
      // rock(r=45) 之間需 45+45+15=105，使用 110px 間距
      // tree(r≈14)，不阻擋，與 rock 間距 45+14+15=74，使用 80
      () => {
        const pt = this.randomArenaPoint(200);
        const positions = [
          { x: 0, y: 0, type: 'rock' as const },
          { x: 110, y: -30, type: 'rock' as const },
          { x: 55, y: 100, type: 'tree' as const },
        ];
        positions.forEach(p => {
          const w = 90;
          const r = p.type === 'rock' ? 45 : 14;
          const obs = new Obstacle(pt.x + p.x - w / 2, pt.y + p.y - w / 2, w, w, p.type);
          place(obs, r);
        });
      },

      // 5. 補給點 (Vending machine + Pillars)
      // vending_machine AABB 60×60，有效 r≈42
      // pillar r=20：vending 右側 42+20+15=77 → center offset x+80
      // pillar 另一個：offset x-80 對稱
      () => {
        const pt = this.randomArenaPoint(150);
        const vm = new Obstacle(pt.x - 30, pt.y - 30, 60, 60, 'vending_machine');
        place(vm, 42);
        const p1 = new Obstacle(pt.x + 80 - 20, pt.y - 20, 40, 40, 'pillar');
        place(p1, 20);
        const p2 = new Obstacle(pt.x - 80 - 20, pt.y - 20, 40, 40, 'pillar');
        place(p2, 20);
      },

      // 6. 死亡巷道 (Alley of Death)
      // 兩棟 building(r=100)，巷道寬 120px（夠玩家通過）
      // 水平巷道：兩棟上下排列，center 距離 = 100+100+120=320，各偏移 y±160
      // 垂直巷道：兩棟左右排列，center 距離同理，各偏移 x±160
      () => {
        const pt = this.randomArenaPoint(300);
        const isHorizontal = Math.random() > 0.5;
        const gap = 320; // building r100 + r100 + 120px 巷道
        const b1 = new Obstacle(
          pt.x + (isHorizontal ? 0 : -gap / 2) - 100,
          pt.y + (isHorizontal ? -gap / 2 : 0) - 100,
          200, 200, 'building'
        );
        const b2 = new Obstacle(
          pt.x + (isHorizontal ? 0 : gap / 2) - 100,
          pt.y + (isHorizontal ? gap / 2 : 0) - 100,
          200, 200, 'building'
        );
        place(b1, 100);
        place(b2, 100);
      },

      // 7. 反射砲陣地 (Monolith + Pillars)
      // monolith r=35，4 個 pillar(r=20)
      // pillar center 距 monolith center = 35+20+15=70，各放在四個角 offset ±70
      // 兩個 pillar 之間 center 距 = sqrt(70²+70²)≈99 > 20+20+15=55 ✓
      () => {
        const pt = this.randomArenaPoint(200);
        const center = new Obstacle(pt.x - 35, pt.y - 35, 70, 70, 'monolith');
        place(center, 35);
        const pOffsets = [{ x: -70, y: -70 }, { x: 70, y: -70 }, { x: -70, y: 70 }, { x: 70, y: 70 }];
        pOffsets.forEach(off => {
          const obs = new Obstacle(pt.x + off.x - 20, pt.y + off.y - 20, 40, 40, 'pillar');
          place(obs, 20);
        });
      },

      // 8. 邪教儀式區 (Altar + Ring of Trees/Rocks)
      // altar：無碰撞，登記 r=40 僅視覺留白
      // 5 個圓形排列，圓心距中心 105px（altar 40 + rock 45 + 20 留白）
      // 相鄰 rock(r=45)：兩個 rock 之間 center 距 = 2*105*sin(π/5)≈123 > 45+45+15=105 ✓
      () => {
        const pt = this.randomArenaPoint(200);
        const altar = new Obstacle(pt.x - 40, pt.y - 40, 80, 80, 'altar');
        altar.isArenaWaveObstacle = true;
        this.addObstacleToMap(altar);
        registerCircle(pt.x, pt.y, 40);
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          const type = Math.random() > 0.5 ? 'tree' : 'rock';
          const r = type === 'rock' ? 45 : 14;
          const cx = pt.x + Math.cos(angle) * 105;
          const cy = pt.y + Math.sin(angle) * 105;
          const obs = new Obstacle(cx - 45, cy - 45, 90, 90, type as any);
          place(obs, r);
        }
      },

      // 9. S型路障迷宮 (Maze)
      // container(AABB 140×80, r≈82) + sandbag(r=30) + wall(AABB 80×80, r≈42)
      // container1 center = pt + (-130, -60)
      // container2 center = pt + (130, 60)
      // sandbag = pt + (0, -60)：距 container1 center = 130 > 82+30+15=127 ✓（邊緣）
      // wall = pt + (0, 60)：距 container2 center = 130 > 82+42+15=139 → 修正為 ±145
      () => {
        const pt = this.randomArenaPoint(300);
        const c1 = new Obstacle(pt.x - 200, pt.y - 100, 140, 80, 'container');
        place(c1, 82);
        const c2 = new Obstacle(pt.x + 60, pt.y + 20, 140, 80, 'container');
        place(c2, 82);
        const sb = new Obstacle(pt.x - 70, pt.y - 70, 60, 60, 'sandbag');
        place(sb, 30);
        const w = new Obstacle(pt.x - 40, pt.y + 30, 80, 80, 'wall');
        place(w, 42);
        const barrel = new Obstacle(pt.x + 50, pt.y - 80, 60, 60, 'explosive_barrel');
        place(barrel, 30);
      },
    ];

    // ── 選取陣型（根據波次）
    const numPatterns = Math.min(3 + Math.floor(waveId / 3), 6);
    const shuffled = [...patterns].sort(() => Math.random() - 0.5);
    for (let i = 0; i < numPatterns; i++) {
      shuffled[i % shuffled.length]();
    }

    // ── 場地四象限散落背景障礙物（少量，AABB 防重疊）
    // 把場地分成 4 個象限，每個象限撒 2 個簡單物件
    const W = this.arenaWidth;
    const H = this.arenaHeight;
    const margin = 120;
    const quadrants = [
      { xMin: margin, xMax: W / 2 - 60, yMin: margin, yMax: H / 2 - 60 },
      { xMin: W / 2 + 60, xMax: W - margin, yMin: margin, yMax: H / 2 - 60 },
      { xMin: margin, xMax: W / 2 - 60, yMin: H / 2 + 60, yMax: H - margin },
      { xMin: W / 2 + 60, xMax: W - margin, yMin: H / 2 + 60, yMax: H - margin },
    ];

    const scatterTypes: Array<{ type: 'rock' | 'tree' | 'pillar' | 'sandbag'; w: number; r: number }> = [
      { type: 'rock', w: 90, r: 45 },
      { type: 'tree', w: 90, r: 14 },
      { type: 'pillar', w: 40, r: 20 },
      { type: 'sandbag', w: 60, r: 30 },
    ];

    for (const quad of quadrants) {
      let placed = 0;
      let tries = 0;
      while (placed < 2 && tries < 20) {
        tries++;
        const cx = quad.xMin + Math.random() * (quad.xMax - quad.xMin);
        const cy = quad.yMin + Math.random() * (quad.yMax - quad.yMin);
        const def = scatterTypes[Math.floor(Math.random() * scatterTypes.length)];
        if (canPlace(cx, cy, def.r)) {
          const obs = new Obstacle(cx - def.w / 2, cy - def.w / 2, def.w, def.w, def.type);
          place(obs, def.r);
          placed++;
        }
      }
    }
  }

  private _shopEntryHandled: boolean = false;
  private _shopCleared: boolean = false;
  private _shopReadyToOpen: boolean = false;

  // ???閬?蝝???拙振嚗??喟洵銝??敺葉??
  get upgradePendingPlayer(): import('./Player').Player | null {
    if (this.mode === 'arena') return null; // 蝡嗆??湔芋撘??典?蝝???
    return this.players.find(p => p.pendingLevelUp) ?? null;
  }

  private get isLocalSharedXpMode(): boolean {
    return !this.networkMode && !this.isHostMode && this.players.length > 1 && this.mode !== 'arena';
  }

  get isArenaShopReady(): boolean {
    return this._shopReadyToOpen;
  }

  get isArenaBagAbsorbing(): boolean {
    return this.mode === 'arena' && this.waveManager.isResting && !this._shopReadyToOpen;
  }

  get hasArenaGroundOrbs(): boolean {
    return this.items.some(item => item.type === 'energy_orb');
  }

  get pendingBagRewardValue(): number {
    return this.pendingArenaBagReward?.value ?? 0;
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

  private getArenaBagAnchor() {
    const alivePlayers = this.players.filter(player => player.hp > 0);
    const anchors = alivePlayers.length > 0 ? alivePlayers : this.players;
    const sum = anchors.reduce((acc, player) => {
      acc.x += player.x;
      acc.y += player.y;
      return acc;
    }, { x: 0, y: 0 });
    const count = Math.max(1, anchors.length);
    return {
      x: sum.x / count,
      y: sum.y / count,
    };
  }

  private startArenaLootBagSequence() {
    const anchor = this.getArenaBagAnchor();
    this.arenaLootBag = {
      startX: anchor.x,
      startY: anchor.y,
      x: anchor.x,
      y: anchor.y,
      targetX: anchor.x + 34,
      targetY: anchor.y - 52,
      phase: 'throw',
      timer: 1000,
      duration: 1000,
      storedValue: 0,
    };

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.type === 'energy_orb') continue;
      this.hitEffects.push({
        x: item.x,
        y: item.y,
        type: 'grey_sparks',
        lifetime: 220,
        maxLifetime: 220,
      });
      this.items.splice(i, 1);
    }
  }

  private finalizeArenaLootBag() {
    if (this.hasArenaGroundOrbs) return;

    const storedValue = this.arenaLootBag?.storedValue ?? 0;
    if (storedValue > 0 && this.waveManager.currentWave < 10) {
      this.pendingArenaBagReward = {
        value: Math.max(1, Math.floor(storedValue * 0.8)),
        sourceWave: this.waveManager.currentWave,
        spawned: false,
      };
    } else if (this.waveManager.currentWave >= 10) {
      this.pendingArenaBagReward = null;
    }

    this.arenaLootBag = null;
    this._shopCleared = true;
    this._shopReadyToOpen = true;
  }

  private updateArenaLootBagSequence(dt: number) {
    if (!this.arenaLootBag) {
      this.startArenaLootBagSequence();
    }
    if (!this.arenaLootBag) return;

    const bag = this.arenaLootBag;
    if (bag.phase === 'throw') {
      bag.timer -= dt;
      const progress = 1 - Math.max(0, bag.timer) / Math.max(1, bag.duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      bag.x = bag.startX + (bag.targetX - bag.startX) * eased;
      bag.y = bag.startY + (bag.targetY - bag.startY) * eased - Math.sin(progress * Math.PI) * 22;
      if (bag.timer <= 0) {
        bag.phase = 'suck';
        bag.timer = 400;
        bag.duration = 400;
        bag.x = bag.targetX;
        bag.y = bag.targetY;
      }
      return;
    }

    if (bag.phase === 'settle') {
      bag.timer -= dt;
      if (bag.timer <= 0) {
        this.finalizeArenaLootBag();
      }
      return;
    }

    let hasGroundOrbs = false;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.type !== 'energy_orb') continue;
      hasGroundOrbs = true;

      const dx = bag.x - item.x;
      const dy = bag.y - item.y;
      const dist = Math.hypot(dx, dy) || 1;
      const remaining = Math.max(16, bag.timer);
      const pull = Math.max(dist * (dt / remaining), 6);
      item.x += (dx / dist) * pull;
      item.y += (dy / dist) * pull;

      if (dist < item.radius + 12) {
        bag.storedValue += item.value || 1;
        this.hitEffects.push({
          x: bag.x,
          y: bag.y,
          type: 'white_sparks',
          lifetime: 120,
          maxLifetime: 120,
        });
        this.items.splice(i, 1);
      }
    }

    bag.timer = Math.max(0, bag.timer - dt);

    if (!hasGroundOrbs) {
      bag.phase = 'settle';
      bag.timer = 500;
      bag.duration = 500;
    }
  }

  private spawnRewardOrbs(x: number, y: number, totalValue: number, color: string) {
    const orbCount = Math.max(1, Math.min(6, totalValue < 6 ? totalValue : Math.ceil(totalValue / 6)));
    let remaining = totalValue;

    for (let i = 0; i < orbCount; i++) {
      const share = i === orbCount - 1 ? remaining : Math.max(1, Math.floor(remaining / (orbCount - i)));
      remaining -= share;
      const angle = (Math.PI * 2 * i) / orbCount;
      const offset = 16 + (i % 2) * 6;
      this.items.push(new Item(
        x + Math.cos(angle) * offset,
        y + Math.sin(angle) * offset,
        'energy_orb',
        15000,
        share,
        color,
      ));
    }
  }

  private spawnBagCarrier() {
    if (!this.pendingArenaBagReward || this.pendingArenaBagReward.spawned) return;

    // Spawn at nearest player position, fling outward
    const srcPlayer = this.players.find(p => p.hp > 0) ?? null;
    const spawnX = srcPlayer ? srcPlayer.x : (this.playableArenaBounds.left + this.playableArenaBounds.right) / 2;
    const spawnY = srcPlayer ? srcPlayer.y : (this.playableArenaBounds.top  + this.playableArenaBounds.bottom) / 2;

    const carrier = new Zombie(spawnX, spawnY, 'goblin_courier');
    carrier.id = ++this._zombieIdCounter;
    carrier.hp = Math.max(6, 4 + this.waveManager.currentWave * 2);
    carrier.maxHp = carrier.hp;
    carrier.speed = 1.8 + Math.random() * 0.6;

    // Fling the carrier outward in a random direction (pop-out effect)
    const flingAngle = Math.random() * Math.PI * 2;
    const flingPower = 8 + Math.random() * 4;
    carrier.vx = Math.cos(flingAngle) * flingPower;
    carrier.vy = Math.sin(flingAngle) * flingPower;

    const bounds = this.playableArenaBounds;
    carrier.extraState.set('bagRewardValue', this.pendingArenaBagReward.value);
    carrier.extraState.set('bagRewardWave', this.pendingArenaBagReward.sourceWave);
    carrier.extraState.set('spawnTimer', 600);
    carrier.extraState.set('arenaBounds', {
      left: bounds.left + 60, right: bounds.right - 60,
      top:  bounds.top  + 60, bottom: bounds.bottom - 60,
    });

    this.zombies.push(carrier);
    this.pendingArenaBagReward.spawned = true;
    this.activeBagCarrierId = carrier.id;
    this.hasFiredGoblinEvent = false;
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

    // ?潛????豢??蜓???嚗?蝯???頛舀??
    if (this.isPaused || this.upgradePendingPlayer !== null) {
      if (this.upgradePendingPlayer !== null) {
        // 蝣箔?????靘?閫貊 UI 隞仿＊蝷粹??
        this.onUpdateUI(this.players[0] || null, this.players[1] || null, this.waveManager);
      }
      return;
    }

    // ?? 蝬脰楝璅∪?嚗???砍?拙振?葫 + ?喲撓????
    if (this.networkMode) {
      const playerIdx = this.networkPlayerId - 1;
      const localPlayer = this.players[playerIdx];

      if (localPlayer && localPlayer.hp > 0) {
        // 瘥??閮??萇頛詨嚗ASD / ?孵??萄???嚗?靘陷 player.id嚗?
        let dx = 0, dy = 0;
        if (this.keys['w'] || this.keys['W'] || this.keys['ArrowUp']) dy -= 1;
        if (this.keys['s'] || this.keys['S'] || this.keys['ArrowDown']) dy += 1;
        if (this.keys['a'] || this.keys['A'] || this.keys['ArrowLeft']) dx -= 1;
        if (this.keys['d'] || this.keys['D'] || this.keys['ArrowRight']) dx += 1;
        const kbLen = Math.sqrt(dx * dx + dy * dy);
        if (kbLen > 0) { dx /= kbLen; dy /= kbLen; }

        // ???▼?芸?嚗???獢踹??券?文潘??恍?甇?0,0嚗?
        const mobileInput = this.joystickInputs[playerIdx];
        const finalInput = mobileInput ?? { x: dx, y: dy };

        const obstacles = this.mapManager.getNearbyObstacles(localPlayer.x, localPlayer.y);
        localPlayer.update(dt, this.keys, obstacles, finalInput);

        // 靽桀儔 Fix 2嚗?啁摰嗉??皞?蝬脰楝璅∪?銋??aimAngle嚗?
        {
          let targetAngle = Math.atan2(localPlayer.lastMoveDir.y, localPlayer.lastMoveDir.x);
          const nearestEnemy = _findNearestAutoTarget(this, localPlayer.x, localPlayer.y, 700);
          if (nearestEnemy) {
            targetAngle = Math.atan2(nearestEnemy.y - localPlayer.y, nearestEnemy.x - localPlayer.x);
          }
          let angleDiff = targetAngle - localPlayer.aimAngle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          const maxRot = 2 * (dt / 1000);
          localPlayer.aimAngle += Math.abs(angleDiff) <= maxRot ? angleDiff : Math.sign(angleDiff) * maxRot;
          while (localPlayer.aimAngle > Math.PI) localPlayer.aimAngle -= Math.PI * 2;
          while (localPlayer.aimAngle < -Math.PI) localPlayer.aimAngle += Math.PI * 2;

          // 同步旋轉角度到武器槽，確保 PlayerRenderer slot.aimAngle 隨自動瞄準轉動
          for (const slot of localPlayer.weapons) {
            slot.aimAngle = localPlayer.aimAngle;
          }
        }

        // ?蔣璈??冽?啁摰塚?摮暑??
        this.camera.x += (localPlayer.x - CONSTANTS.CANVAS_WIDTH / 2 - this.camera.x) * 0.1;
        this.camera.y += (localPlayer.y - CONSTANTS.CANVAS_HEIGHT / 2 - this.camera.y) * 0.1;
        this.mapManager.update(localPlayer.x, localPlayer.y);

        // 璅∠? A / C嚗?撟?喲?binary 頛詨嚗ix 3 ?嗅辣?莎?+ 撖怠?啣耦蝺抵??
        if (this.onSendInput) {
          this.onSendInput(finalInput.x, finalInput.y);
          this.localTick = (this.localTick + 1) >>> 0;
          this.circularBuffer[this.localTick % this.CIRC_BUF_SIZE] = {
            tick: this.localTick, x: localPlayer.x, y: localPlayer.y,
            vx: finalInput.x, vy: finalInput.y,
          };
        }

        // 璅∠? H嚗??瑟??皜穿??砍蝡瘨仃 + ?剝??
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
        // ?砍?拙振甇颱滿??剛??券???敺拇暑蝑???嚗?
        const followTarget = this.players.find(p => p.id !== this.networkPlayerId && p.hp > 0);
        if (followTarget) {
          this.camera.x += (followTarget.x - CONSTANTS.CANVAS_WIDTH / 2 - this.camera.x) * 0.1;
          this.camera.y += (followTarget.y - CONSTANTS.CANVAS_HEIGHT / 2 - this.camera.y) * 0.1;
          this.mapManager.update(followTarget.x, followTarget.y);
        }
      }

      // ?? Feature 4: Snapshot interpolation ??render remote entities 50ms behind live ??
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

        // Interpolate zombies by stable ID ??O(1) Map lookup instead of O(n) find
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

      // 璅∠? E嚗ardSync 瘛∪?桃蔗??瘨
      if (this._hardSyncFade > 0) {
        this._hardSyncFade = Math.max(0, this._hardSyncFade - 0.03);
      }

      // ?湔 VFX
      this.healVFX = this.healVFX.filter(vfx => {
        vfx.y -= 1;
        vfx.alpha -= 0.02;
        return vfx.alpha > 0;
      });
      for (let i = this.hitEffects.length - 1; i >= 0; i--) {
        const eff = this.hitEffects[i];
        eff.lifetime -= dt;
        if (eff.vx !== undefined && eff.vy !== undefined) {
          eff.x += eff.vx * (dt / 16);
          eff.y += eff.vy * (dt / 16);
          const drag = Math.pow(0.88, dt / 16);
          eff.vx *= drag;
          eff.vy *= drag;
          eff.vy += 0.15 * (dt / 16);
        }
        if (eff.lifetime <= 0) this.hitEffects.splice(i, 1);
      }
      // slimeTrails lifetime cleanup in network mode.
      // Prevents unbounded growth if any code path adds trails on the client side.
      for (let i = this.slimeTrails.length - 1; i >= 0; i--) {
        this.slimeTrails[i].lifetime -= dt;
        if (this.slimeTrails[i].lifetime <= 0) this.slimeTrails.splice(i, 1);
      }

      this.onUpdateUI(this.players[0] || null, this.players[1] || null, this.waveManager);
      return;
    }

    // Trigger goblin hint when spawn animation ends
    if (this.activeBagCarrierId !== null && !this.hasFiredGoblinEvent) {
      const carrier = this.zombies.find(z => z.id === this.activeBagCarrierId);
      if (carrier) {
        const st = (carrier.extraState.get('spawnTimer') as number) ?? 0;
        if (st <= 0) {
          this.hasFiredGoblinEvent = true;
          this.onGoblinSpawned?.(carrier);
        }
      }
    }

    // Objective check
    if (this.mode === 'arena' && this.waveManager.isObjectiveBased()) {
      const waveId = this.waveManager.currentWaveConfig.id;
      if (waveId === 5) {
        if (this.activeTombstones.length > 0 && this.activeTombstones.every(t => t.isDestroyed || t.hp <= 0)) {
          this.waveManager.completeObjective();
        }
      } else if (waveId === 10) {
        if (this.activeBoss && this.activeBoss.hp <= 0) {
          this.waveManager.completeObjective();
          // 勝利保護：魔王死後玩家進入無敵狀態
          for (const p of this.players) p.isInvincible = true;
        }
      }
    }

    // Smooth Transition Logic
    if (this.mode === 'arena' && this.waveManager.isTransitioning) {
      dt *= 0.3; // Slow motion
      
      // 清除敵方子彈 (Spitter 的噴吐物)
      this.projectiles = this.projectiles.filter(p => !p.isEnemy);
      
      if (!(this.waveManager as any)._transitionKilled) {
        for (const z of [...this.zombies]) {
          if (z.hp > 0) {
            z.hp = 0;
            this.killZombie(z, null, 1, undefined, {
              suppressOrbDrops: true,
              suppressItemDrop: true,
              suppressBagReward: true,
              suppressSplit: true,
            });
          }
        }
        (this.waveManager as any)._transitionKilled = true;
      }
    } else {
      (this.waveManager as any)._transitionKilled = false;
    }

    // --- ARENA MODE WAVE END FREEZE & LOOT BAG ---
    if (this.mode === 'arena' && this.waveManager.isResting) {
      if (!this._shopCleared) {
        this.clearArenaWaveObstacles();
        this.activeBoss = null;
        this.zombies = [];
      this.zombiePool = new ZombiePool(10);
      this.directorAI = new DirectorAI(this);
        this.projectiles = [];
        this.swordProjectiles = [];
        this.missiles = [];
        this.arcProjectiles = [];
        this.activeEffects = [];
        this.slimeTrails = [];
        this.pendingSwordKills.clear();
        
        if (this.waveManager.currentWave >= 10) {
          // 徹底勝利
          const time = Date.now() - this.startTime;
          this.onVictory?.(time, this.score);
          return;
        }

        this.updateArenaLootBagSequence(dt);
      }

      if (this.waveManager.currentWaveConfig.id === 10 && this._shopReadyToOpen) {
        this.isGameOver = true;
        this.onGameOver(Date.now() - this.startTime, this.score);
        return;
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

    // Feature 5 ??Backward Reconciliation: snapshot zombie positions before physics moves them.
    // Fix: reuse the existing Map object (clear + repopulate) instead of allocating a new Map
    // every physics tick ??eliminates the main GC hotspot at high zombie counts.
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
          // 蝘駁撘瑕?澆?
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
              variant: 'regen',
              scale: 0.9,
            });
            player.lastRegenVfxTime = now;
          }
        }

        // Smooth auto-aim logic
        let targetAngle = Math.atan2(player.lastMoveDir.y, player.lastMoveDir.x);
        const nearestEnemy = _findNearestAutoTarget(this, player.x, player.y, 700);
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

    // ?? Debug嚗??撟??撟鋆遛 ????????????????????????????????????????????
    if (this.debugInfiniteCoins) {
      this.players.forEach(p => { p.materials = 999999; });
    }

    // Spawn zombies
    if (!this.debugPaused) this.waveManager.update(dt);
    if (!this.waveManager.isResting && !this.debugPaused && !this.waveManager.isTransitioning) {
      this.updateZombieSpawning(dt);
    }

    if (this.mode === 'arena' && this.pendingArenaBagReward && !this.pendingArenaBagReward.spawned && !this.debugPaused) {
      this.bagCarrierSpawnTimer -= dt;
      if (this.bagCarrierSpawnTimer <= 0) {
        this.spawnBagCarrier();
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
            player.slowDebuffTimer = Math.max(player.slowDebuffTimer, this.SLIME_TRAIL_SLOW_MS);
          }
        }
      }
    }

    if (!this.networkMode && !this.waveManager.isResting && !this.debugPaused) {
      this.updateArenaAppleTrees();
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
        // 蝘駁畾剖?撘瑕?澆?
      }

      const obstacles = this.mapManager.getNearbyObstacles(zombie.x, zombie.y);
      zombie.update(dt, this.players, obstacles, this.projectiles, this.slimeTrails, this.debugHpLocked);

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

    // ?? Arena Mode Boundaries ??
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

    // ?湔??撠?嚗un Branch A嚗?
    updateMissiles(this.missiles, this, dt);

    // ?湔?餃憫瑽?Gun Branch B嚗瞍踹?????摩
    ArcSystem.updateArcs(this.arcProjectiles, this, dt);

    // ?湔?游??嚗??脤◢ / 撗拇撚璅? / ?圈?怎嚗蒂???啁??捏
    updateActiveEffects(this, dt);
    updateTombstones(this, dt);

    // ???頂 + ?游???捏嚗wordSystem / ActiveEffectSystem ???香鈭⊥悌撅?
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
          if (proj.isEnemy && obs.type === 'tombstone') {
            continue;
          }

          if (obs.type === 'monolith' && !proj.isEnemy && (proj.type === 'bullet' || proj.type === 'slash')) {
            // Energy Turret: absorb bullet → accumulate charge → fire 5 piercing missiles at 20
            const hitKey = `${obs.type}:${obs.x}:${obs.y}:${obs.seed}`;
            if (proj.type === 'slash') {
              if (proj.hitObstacleKeys.has(hitKey)) continue;
              proj.hitObstacleKeys.add(hitKey);
            }

            this.chargeMonolith(obs, proj.damage, proj.ownerId, proj.x, proj.y);

            if (proj.type === 'bullet') {
              proj.lifetime = 0;
              break;
            }
            continue;
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
          // Feature 5: Backward Reconciliation ??rewind zombie to when shooter fired
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

              let hitArc = Math.PI / 4; // default 90 degrees (簣45)
              if (proj.level === 2) hitArc = Math.PI / 4; // 90 degrees (簣45)
              else if (proj.level === 3) hitArc = 50 * Math.PI / 180; // 100 degrees (簣50)
              else if (proj.level === 4) hitArc = Math.PI / 3; // 120 degrees (簣60)
              else if (proj.level === 5) hitArc = 85 * Math.PI / 180; // 170 degrees (簣85)

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

          if (proj.knockback > 0) {
            const angle = Math.atan2(zombie.y - proj.y, zombie.x - proj.x);

            // Check if big zombie ignores knockback from low level weapons
            let ignoreKnockback = false;
            if (zombie.type === 'big' && proj.level <= 3) {
              ignoreKnockback = true;
            }

            if (!ignoreKnockback) {
              const pk = this.players.find(p => p.id === proj.ownerId)?.knockback ?? 0;
              if (proj.type === 'slash') {
                // Push to the edge of the slash radius (or 80% for big zombies) + knockback stat bonus
                const edgeDist = proj.radius + zombie.radius + pk * 4;
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
                applyGunKnockback(zombie, proj.x, proj.y, proj.knockback, pk);
              }
            }
          }

          // Hit effects ????BulletDefinitions / ?芯? SlashDefinitions ??onHit 瘙箏?
          if (proj.type === 'bullet') {
            zombie.flashWhiteTimer = 90; // ?芰?刻澈蝝?? 0.09蝘?
            const bulletDef = BULLET_REGISTRY[proj.bulletType] ?? BULLET_REGISTRY['blue_ellipse'];
            bulletDef.onHit?.({ zombie, pushEffect: e => this.hitEffects.push(e) });
          }

          if (zombie.type === 'big') {
            // Dark green liquid drip
            this.slimeTrails.push({ x: zombie.x, y: zombie.y, radius: 10, lifetime: 3000, maxLifetime: 3000 });
          }

          // Altar (Fire Totem) buff: bullet hits spawn ground_fire under the zombie
          if (proj.type === 'bullet' && !proj.isEnemy) {
            const shooter = this.players.find(p => p.id === proj.ownerId);
            if (shooter?.isAtAltar) {
              this.activeEffects.push({
                type: 'ground_fire',
                x: zombie.x,
                y: zombie.y,
                radius: 28,
                lifetime: 2200,
                maxLifetime: 2200,
                damage: 3,
                tickInterval: 300,
                tickTimer: 300,
                ownerId: proj.ownerId,
                level: proj.level,
              });
            }
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
            const magneticRadius = 38 * player.pickupRadiusMultiplier;
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

            // ??? 3000ms (3蝘? ?曉???
            if (item.pickupProgress >= 3000) {
              audioManager.playPickup();
              player.weapon = item.type === 'weapon_sword' ? 'sword' : 'gun';
              player.syncWeaponToSlot(); // 蝡?郊蝑?????
              player.weaponSwitchTimer = 500;
              player.weaponSwitchType = player.weapon;

              item.pickupProgress = 0;
              item.targetedByPlayerId = null;
              this.items.splice(i, 1);
              break;
            }
          } else {
            // ?桅??瑞??單??
            audioManager.playPickup();
            if (item.type === 'speed') {
              player.speedBoostTimer = 5000;
            } else if (item.type === 'shield') {
              player.activateShield(3000);
            } else if (item.type === 'magnet') {
              // Magnet effect: attract all existing energy orbs to the player
              for (const orb of this.items) {
                if (orb.type === 'energy_orb') {
                  orb.attractedByPlayerId = player.id;
                }
              }
            } else if (item.type === 'energy_orb') {
              const val = item.value || 1;
              this.awardOrbXp(player, val);
              // ?? ?勗??芾?嚗???瘣餌摰嗅??芰敺??撟???函??Ｗ?嚗??
              for (const p of this.players) {
                p.materials += val;
              }
            } else if (item.type === 'apple') {
              const healAmount = item.value || this.ARENA_APPLE_HEAL_AMOUNT;
              player.hp = Math.min(player.maxHp, player.hp + healAmount);
              this.healVFX.push({
                x: player.x,
                y: player.y - 18,
                alpha: 0.95,
                startTime: Date.now(),
                variant: 'burst',
                scale: 1.2,
              });
            }

            this.items.splice(i, 1);
            break;
          }
        }
      }

      // 憒??∩犖頦拙閰脫郎?其?嚗脣漲?祇?甇賊
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

      vfx.y -= 1; // ?詨??拙振??瞍筑
      vfx.alpha -= 0.02; // ?撓瘛∪
      return vfx.alpha > 0;
    });

    // Update hit effects
    for (let i = this.hitEffects.length - 1; i >= 0; i--) {
      const effect = this.hitEffects[i];
      effect.lifetime -= dt;
      // ?拍?撽?????憟??扯?蝛箸除?餃?
      if (effect.vx !== undefined && effect.vy !== undefined) {
        effect.x += effect.vx * (dt / 16);
        effect.y += effect.vy * (dt / 16);
        const drag = Math.pow(0.88, dt / 16); // 璆萄撥蝛箸除?餃? ??敹恍???
        effect.vx *= drag;
        effect.vy *= drag;
        // ?敺桀摹??
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
  chargeMonolith(obs: Obstacle, amount: number, ownerId: number, hitX: number, hitY: number) {
    if (obs.isDestroyed || amount <= 0) return;

    if (obs.monolithOverheatTimer > 0) {
      this.hitEffects.push({ x: hitX, y: hitY, type: 'grey_sparks', lifetime: 100, maxLifetime: 100 });
      return;
    }

    obs.monolithCharge += amount;
    this.hitEffects.push({ x: hitX, y: hitY, type: 'white_sparks', lifetime: 180, maxLifetime: 180 });
    this.hitEffects.push({ x: hitX, y: hitY, type: 'blue_circle', lifetime: 160, maxLifetime: 160 });

    const CHARGE_THRESHOLD = 10;
    if (obs.monolithCharge < CHARGE_THRESHOLD) return;

    obs.monolithCharge = 0;
    const ocx = obs.x + obs.width / 2;
    const ocy = obs.y + obs.height / 2;
    let target: typeof this.zombies[number] | null = null;
    let nearestDist = 900;
    for (const zombie of this.zombies) {
      if (zombie.hp <= 0) continue;
      const dist = Math.hypot(zombie.x - ocx, zombie.y - ocy);
      if (dist < nearestDist) {
        nearestDist = dist;
        target = zombie;
      }
    }

    if (target) {
      obs.monolithTargetX = target.x;
      obs.monolithTargetY = target.y;
      obs.monolithFacingAngle = Math.atan2(target.y - ocy, target.x - ocx);
    }

    obs.monolithVolleyShotsRemaining = 5;
    obs.monolithVolleyOwnerId = ownerId;
    obs.monolithShotCooldown = 160;
    obs.monolithLaunchPulse = 220;
    obs.monolithOverheatTimer = 160 * 5 + 3500; // 5 shots + 3.5s cooldown

    this.hitEffects.push({ x: ocx, y: ocy, type: 'blue_circle', lifetime: 520, maxLifetime: 520 });
    this.hitEffects.push({ x: ocx, y: ocy, type: 'white_sparks', lifetime: 500, maxLifetime: 500 });
    for (let burst = 0; burst < 8; burst++) {
      const burstAngle = (burst / 8) * Math.PI * 2 + Math.random() * 0.28;
      const burstDist = 14 + Math.random() * 22;
      this.hitEffects.push({
        x: ocx + Math.cos(burstAngle) * burstDist,
        y: ocy + Math.sin(burstAngle) * burstDist,
        type: 'arc_spark',
        lifetime: 220,
        maxLifetime: 220,
        radius: 2.5 + Math.random() * 2.5,
      });
    }
    this.shakeTimer = Math.max(this.shakeTimer, 110);
  }
  private explodeObstacle(obs: Obstacle) { _explodeObstacle(this, obs); }
  private dropVendingMachineItems(obs: Obstacle) { _dropVendingMachineItems(this, obs); }
  handlePlayerAttacks(player: Player) { _handlePlayerAttacks(this, player); }
  private updateZombieSpawning(dt: number) {
    if (this.mode === 'arena') {
      this.directorAI.update(dt);
      return;
    }

    this.zombieSpawnTimer += dt;
    const spawnRate = Math.max(500, 2000 - (this.waveManager.currentWave * 100));
    if (this.zombieSpawnTimer >= spawnRate) {
      this.zombieSpawnTimer = 0;
      this.spawnZombie();
    }
  }
  spawnZombie() { _spawnZombie(this); }
  spawnItemAt(x: number, y: number) { _spawnItemAt(this, x, y); }
  spawnItem() { _spawnItem(this); }

  /**
   * 畾剖?甇颱滿蝯曹???嚗????orb??鋆?lime ???宏?扎???
   * ??啁???摮悌撅?靘?急??賭葉靽風 Set嚗?
   */
  killZombie(zombie: Zombie, ownerId: number | null, attackLevel: number, hitAngle?: number, options: KillZombieOptions = {}): Zombie[] {
    const zombieIndex = this.zombies.indexOf(zombie);
    if (zombieIndex === -1) return [];

    const isAutoDespawned = zombie.extraState.get("auto_despawned") === true;
    if (!isAutoDespawned) audioManager.playKill();
    const zombieDef = ZOMBIE_REGISTRY[zombie.type];
    const isBagCarrier = zombie.type === 'goblin_courier';
    const bagRewardValue = Number(zombie.extraState.get('bagRewardValue') ?? 0);
      const suppressOrbDrops = options.suppressOrbDrops || isBagCarrier || isAutoDespawned;
    const suppressItemDrop = options.suppressItemDrop || isBagCarrier || isAutoDespawned;
    const suppressBagReward = options.suppressBagReward || false;

    // ?? 蝣??渡 (Gibbing) ?????????????????????????????????????????????????
    const burstAngle = hitAngle !== undefined ? hitAngle : Math.random() * Math.PI * 2;
    const gibCount = 3 + Math.floor(Math.random() * 3); // 3~5 憿?憛?
    if (!isAutoDespawned) { for (let g = 0; g < gibCount; g++) {
      // ?典????孵???敶Ｙ???(簣40簞) ?扳撠?
      const spreadAngle = burstAngle + (Math.random() - 0.5) * 1.4;
      const speed = 10 + Math.random() * 7; // ??10~17 px/tick (?格?頝 80~150px)
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

    // ??賡???
    }
    if (!suppressOrbDrops) {
      for (let i = 0; i < zombieDef.orbCount; i++) {
        const ox = (Math.random() - 0.5) * 20;
        const oy = (Math.random() - 0.5) * 20;
        this.items.push(new Item(zombie.x + ox, zombie.y + oy, 'energy_orb', Infinity, zombieDef.orbValue, zombieDef.orbColor));
      }
    }

    if (isBagCarrier) {
      this.activeBagCarrierId = null;
      this.pendingArenaBagReward = null;
      if (!suppressBagReward && bagRewardValue > 0) {
        this.spawnRewardOrbs(zombie.x, zombie.y, bagRewardValue, '#fbbf24');
      }
    }

    // ??甇颱滿?寞?
    this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'death_burst', lifetime: 450, maxLifetime: 450 });

    // 閫???寞?嚗?蝑??餅?嚗?
    if ((zombie.type === 'normal' || zombie.type === 'spitter') && attackLevel >= 4) {
      this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'dismember', lifetime: 500, maxLifetime: 500 });
    }

    // slime 分裂
    const children: Zombie[] = [];
    if (zombieDef.splitOnDeath && !options.suppressSplit) {
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

    // 撗拇撚璅?嚗芣香??摰?蝵?+ ???血?閬死
    for (const effect of this.activeEffects) {
      if (effect.type === 'lava_mark' && effect.targetZombieId === zombie.id) {
        effect.targetZombieId = undefined;  // ?迫頝馱嚗?蝵桀歇??
        this.hitEffects.push({ x: effect.x, y: effect.y, type: 'charred_body', lifetime: effect.lifetime + 300, maxLifetime: effect.lifetime + 300 });
      }
    }

    this.zombies.splice(zombieIndex, 1);
      this.zombiePool.release(zombie);

    this.score++;
    const owner = this.players.find(p => p.id === ownerId);
    if (owner) owner.kills++;

    if (!suppressItemDrop && Math.random() < 0.10) this.spawnItemAt(zombie.x, zombie.y);

    return children;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);

    ctx.save();

    // Screen Shake & Pixel snap camera to avoid sub-pixel seam artifacts on tiled ground.
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTimer > 0) {
      const intensity = 5;
      shakeX = Math.round((Math.random() - 0.5) * intensity);
      shakeY = Math.round((Math.random() - 0.5) * intensity);
    }

    const renderCameraX = Math.round(this.camera.x) - shakeX;
    const renderCameraY = Math.round(this.camera.y) - shakeY;
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

    // Draw altars as floor decals — must render BELOW all entities
    {
      const CHUNK_SIZE = 800;
      const fcx = Math.floor((renderCameraX + CONSTANTS.CANVAS_WIDTH / 2) / CHUNK_SIZE);
      const fcy = Math.floor((renderCameraY + CONSTANTS.CANVAS_HEIGHT / 2) / CHUNK_SIZE);
      for (let i = fcx - 2; i <= fcx + 2; i++) {
        for (let j = fcy - 2; j <= fcy + 2; j++) {
          const chunk = this.mapManager.obstacles.get(`${i},${j}`);
          if (chunk) {
            for (const obs of chunk) {
              if (obs.type === 'altar' || (obs.type === 'vending_machine' && obs.isDestroyed)) {
                obs.draw(ctx, this.players);
              }
            }
          }
        }
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

    for (const tree of this.arenaAppleTrees) {
      drawArenaAppleTree(ctx, tree);
    }

    // 璅∠? H嚗??瑟楚?乩耨敺拙??恬?_fadeAlpha: 0?? 瞍詨嚗?
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
    if (this.arenaLootBag) this.drawArenaLootBag(ctx, this.arenaLootBag);

    // DEPTH SORTING (Y-Sorting) for Obstacles, Zombies, and Players
    const renderables: { y: number; draw: () => void }[] = [];

    const CHUNK_SIZE = 800;
    const cx = Math.floor((renderCameraX + CONSTANTS.CANVAS_WIDTH / 2) / CHUNK_SIZE);
    const cy = Math.floor((renderCameraY + CONSTANTS.CANVAS_HEIGHT / 2) / CHUNK_SIZE);
    
    for (let i = cx - 2; i <= cx + 2; i++) {
      for (let j = cy - 2; j <= cy + 2; j++) {
        const chunk = this.mapManager.obstacles.get(`${i},${j}`);
        if (chunk) {
          for (const obs of chunk) {
            if (obs.type === 'altar' || (obs.type === 'vending_machine' && obs.isDestroyed)) continue;
            renderables.push({
              y: obs.y + obs.height, // Sort by bottom edge
              draw: () => obs.draw(ctx, this.players)
            });
          }
        }
      }
    }

    for (const zombie of this.zombies) {
      if (zombie.hp > 0) {
        renderables.push({
          y: zombie.y + zombie.radius,
          draw: () => zombie.draw(ctx)
        });
      }
    }

    for (const player of this.players) {
      renderables.push({
        y: player.y + player.radius,
        draw: () => player.draw(ctx)
      });
    }

    // Sort from top to bottom
    renderables.sort((a, b) => a.y - b.y);

    for (const entity of renderables) {
      entity.draw();
    }

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

  private drawArenaLootBag(ctx: CanvasRenderingContext2D, bag: ArenaLootBagState) {
    ctx.save();
    ctx.translate(bag.x, bag.y);

    const pulse = bag.phase === 'suck'
      ? 1 + Math.sin(Date.now() / 90) * 0.06
      : bag.phase === 'settle'
        ? 1 + Math.sin(Date.now() / 120) * 0.1
        : 1;
    ctx.scale(pulse, pulse);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(4, 16, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8b5a2b';
    ctx.strokeStyle = '#2f1b0c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 10);
    ctx.quadraticCurveTo(-16, -2, -6, -12);
    ctx.quadraticCurveTo(0, -18, 8, -12);
    ctx.quadraticCurveTo(16, -2, 12, 10);
    ctx.quadraticCurveTo(2, 16, -12, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -10);
    ctx.quadraticCurveTo(0, -18, 5, -10);
    ctx.stroke();

    if (bag.storedValue > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, -2, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

}
