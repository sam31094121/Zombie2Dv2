// ── NetworkSyncSystem.ts ──────────────────────────────────────────────────────
// 網路狀態序列化與反序列化（從 Game.ts 分離）
// 修改同步欄位：只改此檔，Game.ts 零修改
// ─────────────────────────────────────────────────────────────────────────────
import type { Game } from '../Game';
import { Zombie } from '../Zombie';
import { Projectile } from '../Projectile';
import { Item, ItemType } from '../Item';
import { SwordProjectile } from '../entities/SwordProjectile';
import { MissileProjectile } from '../entities/MissileProjectile';
import { ArcProjectile } from '../entities/ArcProjectile';
import type { ActiveEffect } from '../types';

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
      mt: Math.round(p.materials),
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
      kb: p.knockback,
      oi: p.ownerId,
    })),
    it: game.items.map(i => ({
      x:  Math.round(i.x),
      y:  Math.round(i.y),
      tp: i.type,
      v:  i.value,
      c:  i.color,
    })),
    at: game.arenaAppleTrees.map(tree => ({
      oi: tree.ownerPlayerId,
      x:  Math.round(tree.x),
      y:  Math.round(tree.y),
      rd: Math.max(0, tree.nextDropAt - Date.now()),
      sd: tree.seed,
    })),
    // Bug 3 Fix：序列化剣系投射物，P2 才能看到剥筍動畫
    sp: game.swordProjectiles
      .filter(s => !s.isDone)
      .map(s => ({
        x:   Math.round(s.x),
        y:   Math.round(s.y),
        ag:  s.angle,
        va:  s.visualAngle,
        st:  s.state,
        lv:  s.level,
        br:  s.branch,
        oi:  s.ownerId,
        ox:  Math.round(s.originX),
        oy:  Math.round(s.originY),
        cfg: {
          branch: s.config.branch,
          level:  s.config.level,
          ownerId: s.config.ownerId,
          x: s.config.x, y: s.config.y,
          angle: s.config.angle,
          dmgMult: s.config.dmgMult,
          passRadius: s.config.passRadius,
          damage: s.config.damage,
          speed: s.config.speed,
          maxRange: s.config.maxRange,
          attackInterval: s.config.attackInterval,
          spinRadius: s.config.spinRadius,
          spinDamage: s.config.spinDamage,
          spinDuration: s.config.spinDuration,
          spinTickMs: s.config.spinTickMs,
          embedDuration: s.config.embedDuration,
          explodeDamage: s.config.explodeDamage,
          explodeRadius: s.config.explodeRadius,
        },
      })),
    ms: game.missiles.filter(m => m.alive).map(m => ({
      x: Math.round(m.x), y: Math.round(m.y), vx: m.vx, vy: m.vy,
      oi: m.ownerId, dm: m.damage, r: m.radius,
      sm: m.isSmall, va: m.variant,
      sp: m.speed, ts: m.turnSpeed,
      lt: m.lifetime, ml: m.maxLifetime,
      hd: Math.round(m.homingDelayTimer), og: Math.round(m.obstacleGraceTimer),
      pr: m.pierceRemaining, sr: m.splashRadius,
    })),
    ac: game.arcProjectiles
      .filter(a => a.lifetime > 0 && !a.isEmbedded)
      .map(a => ({
        x: Math.round(a.x), y: Math.round(a.y), vx: a.vx, vy: a.vy,
        oi: a.ownerId, lv: a.level,
        dm: a.damage, mj: a.maxJumps, pd: a.paralyzeDuration,
        lt: a.lifetime, ml: a.maxLifetime,
      })),
    wv: {
      w: game.waveManager.currentWave,
      r: game.waveManager.isResting,
      t: Math.round(game.waveManager.timer),
      i: game.waveManager.isInfinite,
      m: game.waveManager.activeMechanics,
      sr: (game as any)._shopReadyToOpen ?? false,
    },
    ae: game.activeEffects.map(e => ({
      tp: e.type,
      x: Math.round(e.x), y: Math.round(e.y),
      r: e.radius,
      lt: Math.round(e.lifetime), ml: e.maxLifetime,
      dm: e.damage, ti: e.tickInterval, tt: Math.round(e.tickTimer),
      oi: e.ownerId, lv: e.level,
      tid: e.targetZombieId,
      er: e.explodeRadius, ed: e.explodeDamage,
    })),
    str: game.slimeTrails.map(t => ({
      x: Math.round(t.x), y: Math.round(t.y), r: t.radius,
      lt: Math.round(t.lifetime), ml: t.maxLifetime,
    })),
    hv: game.healVFX.map(v => ({
      x: Math.round(v.x), y: Math.round(v.y), al: v.alpha,
      st: v.startTime, oi: v.ownerId, va: v.variant, sc: v.scale,
    })),
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
      // Bug 2 Fix：同步武器槽角度，確保 PlayerRenderer 渲染遠端玩家的武器旋轉正確
      for (const slot of player.weapons) {
        if (slot) slot.aimAngle = ps.aim;
      }
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
    // 只在戰鬥中同步材料；商店休息期間由本地端自行管理（玩家正在消費）
    if (!game.waveManager.isResting && ps.mt !== undefined) {
      player.materials = ps.mt;
    }
  }

  // ID-based zombie matching
  const nowStamp = Date.now();
  const serverIds = new Set((state.zs as any[]).map((ns: any) => ns.id ?? 0));
  // P2 殭屍死亡特效：Host 移除殭屍時，P2 本地生成碎肢/爆炸視覺
  for (const z of game.zombies) {
    if (serverIds.has(z.id)) continue;
    game.hitEffects.push({ x: z.x, y: z.y, type: 'death_burst', lifetime: 450, maxLifetime: 450 });
    const burstAngle = Math.random() * Math.PI * 2;
    const gibCount = 3 + Math.floor(Math.random() * 3);
    for (let g = 0; g < gibCount; g++) {
      const sa = burstAngle + (Math.random() - 0.5) * 1.4;
      const spd = 10 + Math.random() * 7;
      game.hitEffects.push({
        x: z.x, y: z.y, type: 'gib_blood',
        lifetime: 400 + Math.random() * 200, maxLifetime: 600,
        vx: Math.cos(sa) * spd, vy: Math.sin(sa) * spd,
        rotation: Math.random() * Math.PI * 2, size: 3 + Math.random() * 4,
      });
    }
    // 如果這隻殭屍有 lava_mark 追蹤，同步觸發爆炸灼燒視覺
    for (const ae of game.activeEffects) {
      if (ae.type === 'lava_mark' && ae.targetZombieId === z.id) {
        game.hitEffects.push({
          x: ae.x, y: ae.y, type: 'charred_body',
          lifetime: ae.lifetime + 300, maxLifetime: ae.lifetime + 300,
        });
      }
    }
  }
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
    const p = new Projectile(ps.oi, px, py, ps.vx, ps.vy, 0, 1, ps.lt, ps.tp, ps.r, ps.kb ?? 0, ps.lv, ps.en);
    p.maxLifetime = ps.ml;
    return p;
  });

  // 模組 H：道具 — 複用現有 Item 物件以避免 spawnTime 每幀重置導致 wobble 抖動
  const nowMs = Date.now();
  game.pendingPickups = game.pendingPickups.filter(p => nowMs - p.time < 600);
  const prevItems = game.items;
  game.items = (state.it as any[]).map((is) => {
    // 最近優先配對：避免多顆同類型 orb 聚集時幀間換位導致 spawnTime 突變抖動
    let bestIdx = -1, bestDist = 80;
    for (let j = 0; j < prevItems.length; j++) {
      const e = prevItems[j];
      if (e.type !== is.tp) continue;
      const d = Math.hypot(e.x - is.x, e.y - is.y);
      if (d < bestDist) { bestDist = d; bestIdx = j; }
    }
    const existIdx = bestIdx;
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
  game.waveManager.currentWave     = state.wv.w;
  game.arenaAppleTrees = Array.isArray((state as any).at)
    ? ((state as any).at as any[]).map((tree: any) => ({
        ownerPlayerId: tree.oi,
        x: tree.x,
        y: tree.y,
        nextDropAt: nowMs + Math.max(0, tree.rd ?? 0),
        seed: tree.sd ?? 0,
      }))
    : [];

  game.waveManager.isResting       = state.wv.r;
  game.waveManager.timer           = state.wv.t;
  game.waveManager.isInfinite      = state.wv.i;
  game.waveManager.activeMechanics = state.wv.m;

  // Bug 3 Fix：重建劍系投射物（P2 端純視覺，不執行傷害邏輯）
  // 使用 ID-based 匹配複用既有物件，保留 trail / visualAngle 視覺狀態
  if (Array.isArray(state.sp)) {
    const prevSwords = game.swordProjectiles;
    const prevById = new Map(prevSwords.map(s => [s.id, s]));
    game.swordProjectiles = (state.sp as any[]).map((ss) => {
      // 嘗試找到對應的現有劍（依 ownerId + branch + level 近似匹配，因 id 是本地遞增的）
      let existing: SwordProjectile | undefined;
      for (const [, s] of prevById) {
        if (s.ownerId === ss.oi && s.branch === ss.br && s.level === ss.lv && !s.isDone) {
          existing = s;
          prevById.delete(s.id);
          break;
        }
      }
      if (existing) {
        // 只更新位置與狀態，保留 trail 等視覺資料
        existing.x = ss.x;
        existing.y = ss.y;
        existing.angle = ss.ag;
        existing.visualAngle = ss.va;
        existing.state = ss.st;
        return existing;
      }
      // 找不到就新建
      const s = new SwordProjectile(ss.cfg);
      s.x = ss.x;
      s.y = ss.y;
      s.angle = ss.ag;
      s.visualAngle = ss.va;
      s.state = ss.st;
      return s;
    });
  }

  // 飛彈反序列化（P2 純視覺，不執行追蹤 / 傷害邏輯）
  if (Array.isArray(state.ms)) {
    game.missiles = (state.ms as any[]).map((ms: any) => {
      const angle = Math.atan2(ms.vy, ms.vx);
      const m = new MissileProjectile({
        ownerId: ms.oi, x: ms.x, y: ms.y, angle,
        damage: ms.dm, speed: ms.sp, turnSpeed: ms.ts,
        radius: ms.r, isSmall: ms.sm, splitAfter: 0,
        groundFireRadius: 0, groundFireDuration: 0,
        pierceRemaining: ms.pr, variant: ms.va,
        homingDelayMs: ms.hd, obstacleGraceMs: ms.og, splashRadius: ms.sr,
      });
      m.vx = ms.vx; m.vy = ms.vy;
      m.lifetime = ms.lt; m.maxLifetime = ms.ml;
      m.homingDelayTimer = ms.hd; m.obstacleGraceTimer = ms.og;
      return m;
    });
  }

  // 電弧反序列化（P2 純視覺）
  if (Array.isArray(state.ac)) {
    game.arcProjectiles = (state.ac as any[]).map((ac: any) =>  {
      const a = new ArcProjectile(ac.oi, ac.lv, ac.x, ac.y, ac.vx, ac.vy, ac.dm, ac.mj, ac.pd);
      a.lifetime = ac.lt; a.maxLifetime = ac.ml;
      return a;
    });
  }

  // activeEffects 反序列化（P2 純視覺：岩漿標記、龍捲風、地面火焰）
  if (Array.isArray(state.ae)) {
    game.activeEffects = (state.ae as any[]).map((ae: any): ActiveEffect => ({
      type: ae.tp,
      x: ae.x, y: ae.y,
      radius: ae.r,
      lifetime: ae.lt, maxLifetime: ae.ml,
      damage: ae.dm,
      tickInterval: ae.ti, tickTimer: ae.tt,
      ownerId: ae.oi, level: ae.lv,
      targetZombieId: ae.tid,
      explodeRadius: ae.er,
      explodeDamage: ae.ed,
    }));
  }

  // slimeTrails 反序列化（P2 純視覺：地板黏液）
  if (Array.isArray(state.str)) {
    game.slimeTrails = (state.str as any[]).map((t: any) => ({
      x: t.x, y: t.y, radius: t.r, lifetime: t.lt, maxLifetime: t.ml,
    }));
  }

  // healVFX 反序列化（P2 純視覺：回血特效）
  if (Array.isArray(state.hv)) {
    game.healVFX = (state.hv as any[]).map((v: any) => ({
      x: v.x, y: v.y, alpha: v.al, startTime: v.st,
      ownerId: v.oi, variant: v.va, scale: v.sc,
    }));
  }
}
