// ── SwordProjectile.ts ────────────────────────────────────────────────────────
// 劍系特殊子彈實體（旋風流 Branch A / 審判流 Branch B）
// 各 state 的更新邏輯在 SwordSystem.ts
// ─────────────────────────────────────────────────────────────────────────────

export type SwordBranch = 'base' | 'A' | 'B';
export type SwordState = 'going_out' | 'returning' | 'done';

let _idCounter = 0;

export interface SwordConfig {
  branch: SwordBranch;
  level: number;          // 5~8
  ownerId: number;
  x: number; y: number;  // spawn position (player center)
  angle: number;         // launch direction (radians)
  dmgMult: number;       // player damage multiplier

  // flying pass
  passRadius: number;    // hitbox radius while going_out / returning
  damage: number;        // damage per hit while flying
  speed: number;         // px per ms (going out)

  maxRange: number;      // distance before transitioning state

  // ── 動態回程計時（回程速度 = 距離 / returnTimer）────────────────────────────
  // returnBudget = attackInterval - (maxRange/speed) - 100ms hold
  // 存在 config 供 SwordSystem 讀取，實際倒數放在 SwordProjectile.returnTimer
  attackInterval: number;  // ms，與 WeaponDefinitions 同值

  // Branch A – tornado（已移至 activeEffects；以下欄位保留供渲染讀取）
  spinRadius: number;    // tornado 半徑（for rendering reference）
  spinDamage: number;    // tornado 每 tick 傷害
  spinDuration: number;  // tornado 存活時間 ms
  spinTickMs: number;    // tornado tick 間隔 ms

  // Branch B – lava mark（已移至 activeEffects；以下欄位保留供讀取）
  embedDuration: number;    // lava mark 存活 ms（到期爆炸）
  explodeDamage: number;    // 爆炸最大傷害
  explodeRadius: number;    // 爆炸半徑
}

export class SwordProjectile {
  readonly id: number;
  readonly branch: SwordBranch;
  readonly level: number;
  readonly ownerId: number;
  readonly config: SwordConfig;

  x: number;
  y: number;
  angle: number;
  readonly originX: number;
  readonly originY: number;

  state: SwordState = 'going_out';

  // 動態回程計時器（SwordSystem 在轉入 returning 時設定，每幀 -= dt）
  returnTimer: number = 0;

  // Zombies already hit during current pass (going_out or returning)
  // Cleared when transitioning to spinning/returning
  hitZombieIds = new Set<number>();

  isDone: boolean = false;

  // Visual rotation accumulator (for spinning animation)
  visualAngle: number = 0;

  // 飛行殘影軌跡（只有 level 4 base 武士刀使用）
  // 記錄過去 800ms 內的位置，用來繪製 Hamon 流光殘影
  trail: { x: number; y: number; angle: number; t: number }[] = [];

  constructor(config: SwordConfig) {
    this.id = ++_idCounter;
    this.branch = config.branch;
    this.level = config.level;
    this.ownerId = config.ownerId;
    this.config = config;
    this.x = config.x;
    this.y = config.y;
    this.angle = config.angle;
    this.originX = config.x;
    this.originY = config.y;
  }
}
