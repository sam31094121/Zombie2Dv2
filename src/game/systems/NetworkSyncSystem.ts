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
    t:   'ST',
    tk:  tick,
    hs:  hardSync || undefined,
    ts:  Date.now(),                   // 每幀都送：供 P2 快照插值精確計時
    ack: game.hostLastAckTick,         // P2 最後確認的 input tick
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
      wls: p.weaponLevels.sword,
      wlg: p.weaponLevels.gun,
      wbs: p.weaponBranches.sword,
      wbg: p.weaponBranches.gun,
      aim: p.aimAngle,
      sh: p.shield,
      st: Math.round(p.shieldTimer),
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
      sr: (game as any)._shopReadyToOpen ?? false,
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
        // HardSync（波次切換 / 背景分頁）：強制對齊
        player.x = ps.x;
        player.y = ps.y;
        game._hardSyncFade = 0.55;
      } else {
        // ── Delta Reconciliation（病因 A + B 修復）────────────────
        // ackTick = Host 最後確認處理的 P2 input tick
        // circularBuffer[ackTick] = P2 當時「預測位置」
        // server position（ps.x/y）= Host 確認的「正確位置」
        // 兩者之差 = delta，直接平移到當前幀即可修正（免重播）
        const ackTick = (state as any).ack as number;
        const bufEntry = ackTick > 0
          ? game.circularBuffer[ackTick % game.CIRC_BUF_SIZE]
          : null;

        if (bufEntry && bufEntry.tick === ackTick) {
          const errX = ps.x - bufEntry.x;
          const errY = ps.y - bufEntry.y;
          const err  = Math.hypot(errX, errY);

          if (err <= 1.5) {
            // Zone 1：浮點噪音，不動
          } else if (err <= 60) {
            // Zone 2：線性漂移（網路延遲）→ Delta 平移
            const alpha = err / 60;
            player.x += errX * alpha;
            player.y += errY * alpha;
          } else {
            // Zone 3：碰撞分歧 → Snap + Mini Replay（防止 circularBuffer 汙染）
            // ─────────────────────────────────────────────────────
            // 問題：P2 預測穿牆，Host 停牆 → circularBuffer[ackTick+1..N] 全是錯誤起點的積分
            // 解法：從 server truth（ps.x/y）重新跑 velocity vectors，還原「現在應在哪裡」
            // 注意：不帶牆壁碰撞（近似），但比直接 snap 少 1-2 幀的視覺抖動
            let replayX = ps.x;
            let replayY = ps.y;
            const speed    = player.speed;
            const replayTo = Math.min(game.localTick, ackTick + 45); // 最多回播 45 幀（750ms）
            for (let t = ackTick + 1; t <= replayTo; t++) {
              const e = game.circularBuffer[t % game.CIRC_BUF_SIZE];
              if (e && e.tick === t) {
                replayX += e.vx * speed * (16 / 16);
                replayY += e.vy * speed * (16 / 16);
              }
            }
            player.x = replayX;
            player.y = replayY;
            // 覆寫 buffer[ackTick] = server truth，讓下一輪 reconciliation 從乾淨起點算
            game.circularBuffer[ackTick % game.CIRC_BUF_SIZE] = {
              tick: ackTick, x: ps.x, y: ps.y,
              vx: bufEntry.vx, vy: bufEntry.vy,
            };
          }
        } else {
          // Fallback：ack 不可用時，平滑插值（取代舊版 >= 100px 瞬移）
          const dist = Math.hypot(ps.x - player.x, ps.y - player.y);
          if (dist > 2) {
            const alpha = Math.min(0.25, dist / 120);
            player.x += (ps.x - player.x) * alpha;
            player.y += (ps.y - player.y) * alpha;
          }
        }
      }
      player.slowDebuffTimer = (ps as any).sl ?? 0;
      player.shieldTimer = (ps as any).st ?? ((ps as any).sh ? Math.max(player.shieldTimer, 100) : 0);
    }
    player.hp  = ps.hp;
    player.maxHp = ps.mh;
    player.xp  = ps.xp;
    player.maxXp = ps.mx;
    player.level = ps.lv;
    player.prestigeLevel = ps.pl;
    player.weapon = ps.wp as 'sword' | 'gun';
    if (ps.wls !== undefined) player.weaponLevels.sword  = ps.wls;
    if (ps.wlg !== undefined) player.weaponLevels.gun    = ps.wlg;
    if (ps.wbs !== undefined) player.weaponBranches.sword = ps.wbs;
    if (ps.wbg !== undefined) player.weaponBranches.gun   = ps.wbg;
    player.syncWeaponToSlot();
    player.shield = player.shieldTimer > 0 || ps.sh;
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

  // 模組 H：道具 — 複用現有 Item 物件以避免 spawnTime 每幀重置導致 wobble 抖動
  const nowMs = Date.now();
  game.pendingPickups = game.pendingPickups.filter(p => nowMs - p.time < 600);
  const prevItems = game.items;
  game.items = (state.it as any[]).map((is) => {
    // 先嘗試找同類型、位置相近的既有物件（距離 < 40px 視為同一個 orb）
    const existIdx = prevItems.findIndex(
      e => e.type === is.tp && Math.hypot(e.x - is.x, e.y - is.y) < 40
    );
    let item: Item;
    if (existIdx >= 0) {
      item = prevItems.splice(existIdx, 1)[0];
      // 只更新位置，保留 spawnTime 確保 wobble 穩定
      item.x = is.x;
      item.y = is.y;
      item.value = is.v ?? item.value;
    } else {
      item = new Item(is.x, is.y, is.tp as ItemType, 99999, is.v, is.c);
    }
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

  // 同步 Host 的商店開放旗標：P2 端的 isArenaShopReady 依此驅動
  if (state.wv.sr && !(game as any)._shopReadyToOpen) {
    (game as any)._shopReadyToOpen = true;
    (game as any)._shopCleared     = true;
  }
}
