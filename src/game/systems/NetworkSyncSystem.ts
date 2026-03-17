// ── NetworkSyncSystem.ts ──────────────────────────────────────────────────────
// 網路狀態序列化與反序列化（從 Game.ts 分離）
// 修改同步欄位：只改此檔，Game.ts 零修改
// ─────────────────────────────────────────────────────────────────────────────
import type { Game } from '../Game';
import { Zombie } from '../Zombie';
import { Projectile } from '../Projectile';
import { Item, ItemType } from '../Item';

export function serializeState(game: Game, tick: number, hardSync: boolean): object {
  return {
    t:  'ST',
    tk: tick,
    hs: hardSync || undefined,
    ts: hardSync ? Date.now() : undefined,
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
      sl: Math.round(p.slowDebuffTimer),
    })),
    zs: game.zombies.map(z => ({
      id: z.id,
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

export function applyNetworkState(game: Game, state: any): void {
  if (!game.networkMode) return;

  const isHardSync = !!(state.hs) || game.pendingHardSync;
  game.pendingHardSync = false;

  game._snapBuffer.push({
    ts: Date.now(),
    zs: new Map((state.zs as any[]).map((ns: any) => [ns.id ?? 0, { x: ns.x as number, y: ns.y as number }])),
    remotePs: new Map((state.ps as any[])
      .filter((ps: any) => ps.id !== game.networkPlayerId)
      .map((ps: any) => [ps.id as number, { x: ps.x as number, y: ps.y as number }])),
  });
  if (game._snapBuffer.length > game._SNAP_BUF_MAX) game._snapBuffer.shift();
  if (isHardSync) game._snapBuffer = [];

  for (const ps of state.ps) {
    const player = game.players.find(p => p.id === ps.id);
    if (!player) continue;

    if (ps.id !== game.networkPlayerId) {
      const prevTx = (player as any)._tx as number | undefined;
      const prevTy = (player as any)._ty as number | undefined;
      (player as any)._tx = ps.x;
      (player as any)._ty = ps.y;
      if (prevTx !== undefined && prevTy !== undefined) {
        (player as any)._tvx = ps.x - prevTx;
        (player as any)._tvy = ps.y - prevTy;
      }
      player.aimAngle = ps.aim;
    } else {
      (player as any)._serverX = ps.x;
      (player as any)._serverY = ps.y;
      if (isHardSync) {
        player.x = ps.x;
        player.y = ps.y;
        game._hardSyncFade = 0.55;
      } else {
        const dist = Math.hypot(ps.x - player.x, ps.y - player.y);
        if (dist >= 100) {
          player.x = ps.x;
          player.y = ps.y;
        }
      }
      player.slowDebuffTimer = (ps as any).sl ?? 0;
    }
    player.hp  = ps.hp;
    player.maxHp = ps.mh;
    player.xp  = ps.xp;
    player.maxXp = ps.mx;
    player.level = ps.lv;
    player.prestigeLevel = ps.pl;
    player.weapon = ps.wp as 'sword' | 'gun';
    player.shield = ps.sh;
  }

  // ID-based zombie matching
  const nowStamp = Date.now();
  const serverIds = new Set((state.zs as any[]).map((ns: any) => ns.id ?? 0));
  game.zombies = game.zombies.filter(z => serverIds.has(z.id));
  for (const ns of state.zs as any[]) {
    const nsId = ns.id ?? 0;
    const existing = game.zombies.find(z => z.id === nsId);
    if (existing) {
      (existing as any)._prevHp = existing.hp;
      existing.hp = ns.hp;
      existing.maxHp = ns.mh;
      existing.angle = ns.ag;
      (existing as any)._tx = ns.x;
      (existing as any)._ty = ns.y;
    } else {
      const z = new Zombie(ns.x, ns.y, ns.tp);
      z.id = nsId;
      z.hp = ns.hp; z.maxHp = ns.mh; z.angle = ns.ag; z.time = nowStamp;
      (z as any)._tx = ns.x; (z as any)._ty = ns.y;
      game.zombies.push(z);
    }
  }

  // 模組 I：擊中視覺補償
  for (const e of game.hitEffects as any[]) {
    if (!e._pendingZombieIdx) continue;
    const z = game.zombies[e._pendingZombieIdx];
    if (z && (z as any)._prevHp !== undefined && z.hp >= (z as any)._prevHp) {
      e._grayOut = true;
    }
    delete e._pendingZombieIdx;
  }

  // 子彈更新
  const localPlayerForProj = game.players[game.networkPlayerId - 1];
  const projOffX = localPlayerForProj
    ? localPlayerForProj.x - ((localPlayerForProj as any)._serverX ?? localPlayerForProj.x)
    : 0;
  const projOffY = localPlayerForProj
    ? localPlayerForProj.y - ((localPlayerForProj as any)._serverY ?? localPlayerForProj.y)
    : 0;
  game.projectiles = (state.pj as any[]).map((ps) => {
    const isLocalOwned = ps.oi === game.networkPlayerId && !ps.en;
    const px = ps.x + (isLocalOwned ? projOffX : 0);
    const py = ps.y + (isLocalOwned ? projOffY : 0);
    const p = new Projectile(ps.oi, px, py, ps.vx, ps.vy, 0, 1, ps.lt, ps.tp, ps.r, false, ps.lv, ps.en);
    p.maxLifetime = ps.ml;
    return p;
  });

  // 模組 H：道具
  const nowMs = Date.now();
  game.pendingPickups = game.pendingPickups.filter(p => nowMs - p.time < 600);
  game.items = (state.it as any[]).map((is) => {
    const item = new Item(is.x, is.y, is.tp as ItemType, 99999, is.v, is.c);
    const pendingIdx = game.pendingPickups.findIndex(
      p => Math.hypot(p.x - is.x, p.y - is.y) < 12 && p.type === is.tp
    );
    if (pendingIdx >= 0) {
      (item as any)._fadeAlpha = 0;
      game.pendingPickups.splice(pendingIdx, 1);
    }
    return item;
  });

  // 波次狀態
  game.waveManager.currentWave     = state.wv.w;
  game.waveManager.isResting       = state.wv.r;
  game.waveManager.timer           = state.wv.t;
  game.waveManager.isInfinite      = state.wv.i;
  game.waveManager.activeMechanics = state.wv.m;
}
