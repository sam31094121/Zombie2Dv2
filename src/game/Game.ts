import { CONSTANTS } from './Constants';
import { Player } from './Player';
import { Zombie } from './Zombie';
import { Projectile } from './Projectile';
import { Item, ItemType } from './Item';
import { MapManager } from './map/MapManager';
import { Obstacle } from './map/Obstacle';
import { audioManager } from './AudioManager';
import { WaveManager } from './WaveManager';

export class Game {
  players: Player[] = [];
  zombies: Zombie[] = [];
  projectiles: Projectile[] = [];
  items: Item[] = [];
  hitEffects: { x: number, y: number, type: string, lifetime: number, maxLifetime: number, startTime?: number }[] = [];
  healVFX: { x: number, y: number, alpha: number, startTime: number }[] = [];
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

  // 網路多人模式
  networkMode: boolean = false;
  networkPlayerId: number = 1;
  networkInputSendTimer: number = 0;
  onSendInput: ((dx: number, dy: number) => void) | null = null;

  constructor(playerCount: number, onGameOver: (time: number, kills: number) => void, onUpdateUI: (p1: Player | null, p2: Player | null, waveManager: WaveManager) => void) {
    this.onGameOver = onGameOver;
    this.onUpdateUI = onUpdateUI;
    this.mapManager = new MapManager();
    this.waveManager = new WaveManager();
    this.init(playerCount);
  }

  init(playerCount: number) {
    this.players = [];
    if (playerCount >= 1) {
      this.players.push(new Player(1, 400, 300, '#3498db'));
    }
    if (playerCount >= 2) {
      this.players.push(new Player(2, 450, 300, '#e74c3c'));
    }
    this.zombies = [];
    this.projectiles = [];
    this.items = [];
    this.hitEffects = [];
    this.slimeTrails = [];
    this.keys = {};
    this.score = 0;
    this.startTime = Date.now();
    this.lastItemSpawnTime = Date.now();
    this.isGameOver = false;
    this.mapManager = new MapManager();
    this.camera = { x: 0, y: 0 };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
    }
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
    }
  }

  // 接收伺服器狀態並更新本地實體
  applyNetworkState(state: any) {
    if (!this.networkMode) return;

    // 更新玩家
    for (const ps of state.ps) {
      const player = this.players.find(p => p.id === ps.id);
      if (!player) continue;

      if (ps.id !== this.networkPlayerId) {
        // 遠端玩家：記錄目標位置，由 update() 做插值（平滑移動）
        (player as any)._tx = ps.x;
        (player as any)._ty = ps.y;
        player.aimAngle = ps.aim;
      }
      // 本地玩家：完全不修正位置，客戶端預測為準（避免跳位）
      player.hp = ps.hp;
      player.maxHp = ps.mh;
      player.xp = ps.xp;
      player.maxXp = ps.mx;
      player.level = ps.lv;
      player.prestigeLevel = ps.pl;
      player.weapon = ps.wp as 'sword' | 'gun';
      player.shield = ps.sh;
    }

    // 更新殭屍（直接替換陣列）
    this.zombies = state.zs.map((zs: any) => {
      const z = new Zombie(zs.x, zs.y, zs.tp);
      z.hp = zs.hp;
      z.maxHp = zs.mh;
      z.angle = zs.ag;
      z.time = Date.now();
      return z;
    });

    // 更新子彈
    this.projectiles = state.pj.map((ps: any) => {
      const p = new Projectile(
        ps.oi, ps.x, ps.y, ps.vx, ps.vy,
        0, 1, ps.lt, ps.tp, ps.r, false, ps.lv, ps.en
      );
      p.maxLifetime = ps.ml;
      return p;
    });

    // 更新道具
    this.items = state.it.map((is: any) => {
      return new Item(is.x, is.y, is.tp as ItemType, 99999, is.v, is.c);
    });

    // 更新波次狀態
    this.waveManager.currentWave = state.wv.w;
    this.waveManager.isResting = state.wv.r;
    this.waveManager.timer = state.wv.t;
    this.waveManager.isInfinite = state.wv.i;
    this.waveManager.activeMechanics = state.wv.m;
  }

  handleKeyDown = (e: KeyboardEvent) => {
    this.keys[e.key] = true;
  };

  handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key] = false;
  };

  setJoystickInput(playerIndex: number, input: { x: number, y: number } | null) {
    if (this.joystickInputs[playerIndex] !== undefined) {
      this.joystickInputs[playerIndex] = input;
    }
  }

  update(dt: number) {
    if (this.isGameOver) return;

    // ── 網路模式：只處理本地玩家預測 + 傳送輸入 ──
    if (this.networkMode) {
      const playerIdx = this.networkPlayerId - 1;
      const localPlayer = this.players[playerIdx];

      if (localPlayer && localPlayer.hp > 0) {
        // 每幀重新計算鍵盤輸入（WASD / 方向鍵均有效，不依賴 player.id）
        let dx = 0, dy = 0;
        if (this.keys['w'] || this.keys['W'] || this.keys['ArrowUp'])    dy -= 1;
        if (this.keys['s'] || this.keys['S'] || this.keys['ArrowDown'])  dy += 1;
        if (this.keys['a'] || this.keys['A'] || this.keys['ArrowLeft'])  dx -= 1;
        if (this.keys['d'] || this.keys['D'] || this.keys['ArrowRight']) dx += 1;
        const kbLen = Math.sqrt(dx * dx + dy * dy);
        if (kbLen > 0) { dx /= kbLen; dy /= kbLen; }

        // 手機搖桿優先；沒有搖桿則用鍵盤值（含靜止 0,0）
        const mobileInput = this.joystickInputs[playerIdx];
        const finalInput = mobileInput ?? { x: dx, y: dy };

        const obstacles = this.mapManager.getNearbyObstacles(localPlayer.x, localPlayer.y);
        // 永遠傳入 externalInput，繞過 Player 內部的 id 判斷
        localPlayer.update(dt, this.keys, obstacles, finalInput);

        // 平滑跟機攝影機
        this.camera.x += (localPlayer.x - CONSTANTS.CANVAS_WIDTH / 2 - this.camera.x) * 0.1;
        this.camera.y += (localPlayer.y - CONSTANTS.CANVAS_HEIGHT / 2 - this.camera.y) * 0.1;
        this.mapManager.update(localPlayer.x, localPlayer.y);

        // 每 33ms 傳送一次輸入（~30fps），降低延遲
        this.networkInputSendTimer += dt;
        if (this.networkInputSendTimer >= 33 && this.onSendInput) {
          this.networkInputSendTimer = 0;
          this.onSendInput(finalInput.x, finalInput.y);
        }
      }

      // 遠端玩家插值（平滑移動，避免每 33ms 跳一次）
      const remotePlayer = this.players.find(p => p.id !== this.networkPlayerId);
      if (remotePlayer) {
        const tx = (remotePlayer as any)._tx as number | undefined;
        const ty = (remotePlayer as any)._ty as number | undefined;
        if (tx !== undefined && ty !== undefined) {
          remotePlayer.x += (tx - remotePlayer.x) * 0.25;
          remotePlayer.y += (ty - remotePlayer.y) * 0.25;
        }
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

      this.onUpdateUI(this.players[0] || null, this.players[1] || null, this.waveManager);
      return;
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
      
      // Update map chunks based on camera center
      this.mapManager.update(cx, cy);
    }

    // Update players
    for (const player of this.players) {
      if (player.hp > 0) {
        if (this.waveManager.isInfinite) {
          player.isInfiniteGlow = isIntro;
        }
        const obstacles = this.mapManager.getNearbyObstacles(player.x, player.y);
        const playerIdx = this.players.indexOf(player);
        player.update(dt, this.keys, obstacles, this.joystickInputs[playerIdx] || undefined);
        
        if (player.isRegenerating) {
          const now = Date.now();
          if (now - player.lastRegenVfxTime > 1200) {
            this.healVFX.push({ 
              x: player.x + (Math.random() - 0.5) * 10, 
              y: player.y - 35, 
              alpha: 0.8, 
              startTime: now 
            });
            player.lastRegenVfxTime = now;
          }
        }

        // Smooth auto-aim logic
        let targetAngle = Math.atan2(player.lastMoveDir.y, player.lastMoveDir.x);
        let nearestEnemy = null;
        let minDistanceSq = Infinity;
        for (const zombie of this.zombies) {
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

        // Initialize aimAngle if it's the first time
        if (player.aimAngle === undefined) {
          player.aimAngle = targetAngle;
        }

        // Smoothly interpolate aimAngle towards targetAngle
        let angleDiff = targetAngle - player.aimAngle;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Constant rotation speed (2 radians per second)
        const rotationSpeed = 2;
        const maxRotation = rotationSpeed * (dt / 1000);
        
        if (Math.abs(angleDiff) <= maxRotation) {
          player.aimAngle = targetAngle;
        } else {
          player.aimAngle += Math.sign(angleDiff) * maxRotation;
        }
        
        // Keep aimAngle within [-PI, PI]
        while (player.aimAngle > Math.PI) player.aimAngle -= Math.PI * 2;
        while (player.aimAngle < -Math.PI) player.aimAngle += Math.PI * 2;

        this.handlePlayerAttacks(player);
      }
    }

    // Spawn zombies
    this.waveManager.update(dt);
    if (!this.waveManager.isResting) {
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

    // Update zombies
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const zombie = this.zombies[i];
      
      // Update glow state based on intro timer
      if (this.waveManager.isInfinite) {
        zombie.isInfiniteGlow = isIntro;
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
            if (player.shield) {
              player.shield = false;
            } else {
              let damage = CONSTANTS.ZOMBIE_DAMAGE;
              if (zombie.type === 'slime' || zombie.type === 'slime_small') {
                damage = 0.5; // Very low damage
              }
              player.hp -= damage;
              audioManager.playPlayerHit();
              player.lastDamageTime = Date.now();
            }
          }
        }
      }
    }

    // Resolve overlaps (prevent entities from overlapping)
    // 1. Zombie vs Zombie
    for (let i = 0; i < this.zombies.length; i++) {
      for (let j = i + 1; j < this.zombies.length; j++) {
        const z1 = this.zombies[i];
        const z2 = this.zombies[j];
        const dx = z2.x - z1.x;
        const dy = z2.y - z1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = z1.radius + z2.radius;
        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          z1.x -= (nx * overlap) / 2;
          z1.y -= (ny * overlap) / 2;
          z2.x += (nx * overlap) / 2;
          z2.y += (ny * overlap) / 2;
        }
      }
    }

    // 2. Player vs Zombie
    for (const player of this.players) {
      if (player.hp <= 0) continue;
      for (const zombie of this.zombies) {
        const dx = zombie.x - player.x;
        const dy = zombie.y - player.y;
        const dist = Math.hypot(dx, dy);
        const minDist = player.radius + zombie.radius;
        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          zombie.x += nx * overlap;
          zombie.y += ny * overlap;
        }
      }
    }

    // 3. Player vs Player
    if (this.players.length >= 2 && this.players[0].hp > 0 && this.players[1].hp > 0) {
      const p1 = this.players[0];
      const p2 = this.players[1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      const minDist = p1.radius + p2.radius;
      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        p1.x -= (nx * overlap) / 2;
        p1.y -= (ny * overlap) / 2;
        p2.x += (nx * overlap) / 2;
        p2.y += (ny * overlap) / 2;
      }
    }

    this.handleObstacleInteractions(dt);

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const obstacles = this.mapManager.getNearbyObstacles(proj.x, proj.y);
      proj.update(dt, obstacles);

      // Projectile-Obstacle collision (for destructible obstacles and monolith)
      for (const obs of obstacles) {
        if (obs.isDestroyed) continue;
        if (obs.collidesWithCircle(proj.x, proj.y, proj.radius)) {
          if (obs.type === 'monolith' && proj.type === 'bullet' && proj.level === 5) {
            // Reflect to nearest zombie
            const nearestZombie = this.findNearestZombie(obs.x + obs.width / 2, obs.y + obs.height / 2, 500);
            if (nearestZombie) {
              const dx = nearestZombie.x - proj.x;
              const dy = nearestZombie.y - proj.y;
              const dist = Math.hypot(dx, dy);
              proj.vx = (dx / dist) * Math.hypot(proj.vx, proj.vy);
              proj.vy = (dy / dist) * Math.hypot(proj.vx, proj.vy);
              this.hitEffects.push({ x: proj.x, y: proj.y, type: 'white_sparks', lifetime: 200, maxLifetime: 200 });
              continue; // Don't destroy projectile on reflection
            }
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
            if (player.shield) {
              player.shield = false;
            } else {
              player.hp -= proj.damage;
              audioManager.playPlayerHit();
              player.lastDamageTime = Date.now();
            }
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
          const dist = Math.hypot(proj.x - zombie.x, proj.y - zombie.y);
          if (dist < proj.radius + zombie.radius) hit = true;
        } else if (proj.type === 'slash') {
          const elapsed = proj.maxLifetime - proj.lifetime;
          // Only hit during the "slash" phase (50ms to 150ms)
          if (elapsed >= 50 && elapsed <= 150) {
            const dist = Math.hypot(proj.x - zombie.x, proj.y - zombie.y);
            if (dist < proj.radius + zombie.radius) {
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

          // Hit effects
          if (proj.type === 'bullet') {
            if (proj.level === 1) {
              this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'grey_sparks', lifetime: 200, maxLifetime: 200 });
            } else if (proj.level === 2) {
              this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'blue_circle', lifetime: 300, maxLifetime: 300 });
              zombie.vx += Math.cos(Math.random() * Math.PI * 2) * 2; // Shake
              zombie.vy += Math.sin(Math.random() * Math.PI * 2) * 2;
            } else if (proj.level === 3) {
              this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'green_electricity', lifetime: 400, maxLifetime: 400 });
              zombie.paralysisTimer = 500;
            } else if (proj.level === 4) {
              this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'orange_explosion', lifetime: 300, maxLifetime: 300 });
            } else if (proj.level === 5) {
              this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'black_hole', lifetime: 600, maxLifetime: 600 });
              if (zombie.type === 'big') zombie.leanBackTimer = 300;
            }
          } else if (proj.type === 'slash') {
            if (proj.level === 1) {
              this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'purple_particles', lifetime: 300, maxLifetime: 300 });
            } else if (proj.level === 2) {
              this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'white_cross', lifetime: 200, maxLifetime: 200 });
            } else if (proj.level === 3) {
              this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'ice_shatter', lifetime: 400, maxLifetime: 400 });
              zombie.slowTimer = 1000;
            } else if (proj.level === 4) {
              this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'red_blood', lifetime: 400, maxLifetime: 400 });
            } else if (proj.level === 5) {
              this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'golden_shatter', lifetime: 500, maxLifetime: 500 });
              zombie.flashWhiteTimer = 200;
              if (zombie.type === 'big') zombie.leanBackTimer = 300;
            }
          }

          if (zombie.type === 'big') {
            // Dark green liquid drip
            this.slimeTrails.push({ x: zombie.x, y: zombie.y, radius: 10, lifetime: 3000, maxLifetime: 3000 });
          }

          if (zombie.hp <= 0) {
            audioManager.playKill();
            
            // Spawn Energy Orbs
            let orbCount = 0;
            let orbColor = '#00bcd4'; // Blue
            let orbValue = 1;
            
            if (zombie.type === 'normal') {
              orbCount = 1;
              orbColor = '#2196f3'; // Blue
            } else if (zombie.type === 'slime_small') {
              orbCount = 1;
              orbColor = '#4caf50'; // Green
            } else if (zombie.type === 'slime') {
              orbCount = 2;
              orbColor = '#4caf50'; // Green
            } else if (zombie.type === 'spitter') {
              orbCount = 2;
              orbColor = '#4caf50'; // Green
            } else if (zombie.type === 'big') {
              orbCount = 4;
              orbColor = '#9c27b0'; // Purple
            }
            
            for (let i = 0; i < orbCount; i++) {
              const offsetX = (Math.random() - 0.5) * 20;
              const offsetY = (Math.random() - 0.5) * 20;
              this.items.push(new Item(zombie.x + offsetX, zombie.y + offsetY, 'energy_orb', 15000, orbValue, orbColor));
            }

            if (zombie.type === 'normal' || zombie.type === 'spitter') {
              if (proj.level >= 4) {
                // Dismemberment effect
                this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'dismember', lifetime: 500, maxLifetime: 500 });
              }
            } else if (zombie.type === 'slime') {
              // Split into two small slimes with explosion velocity
              const angle1 = Math.random() * Math.PI * 2;
              const angle2 = angle1 + Math.PI;
              
              const s1 = new Zombie(zombie.x + Math.cos(angle1) * 3, zombie.y + Math.sin(angle1) * 3, 'slime_small');
              const s2 = new Zombie(zombie.x + Math.cos(angle2) * 3, zombie.y + Math.sin(angle2) * 3, 'slime_small');
              
              s1.vx = Math.cos(angle1) * 16;
              s1.vy = Math.sin(angle1) * 16;
              
              s2.vx = Math.cos(angle2) * 16;
              s2.vy = Math.sin(angle2) * 16;

              this.zombies.push(s1, s2);
              
              // Prevent current projectile from immediately hitting them
              proj.hitZombies.add(s1);
              proj.hitZombies.add(s2);
            }
            this.zombies.splice(j, 1);
            this.score++;
            const owner = this.players.find(p => p.id === proj.ownerId);
            if (owner) {
              owner.kills++;
            }
            
            // 10% chance to drop an item
            if (Math.random() < 0.10) {
              this.spawnItemAt(zombie.x, zombie.y);
            }
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

      // Item-Player collision
      for (const player of this.players) {
        if (player.hp <= 0) continue;
        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        
        // Magnetic effect for energy orbs
        if (item.type === 'energy_orb' && Date.now() - item.spawnTime > 200) {
          const distToPlayer = Math.hypot(player.x - item.x, player.y - item.y);
          if (distToPlayer < 200) {
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

        if (dist < player.radius + item.radius) {
          audioManager.playPickup();
          if (item.type === 'weapon_sword') {
            player.weapon = 'sword';
            player.weaponSwitchTimer = 500;
            player.weaponSwitchType = 'sword';
          } else if (item.type === 'weapon_gun') {
            player.weapon = 'gun';
            player.weaponSwitchTimer = 500;
            player.weaponSwitchType = 'gun';
          } else if (item.type === 'speed') {
            player.speedBoostTimer = 5000;
          } else if (item.type === 'shield') {
            player.shield = true;
          } else if (item.type === 'energy_orb') {
            player.addXp(item.value || 1);
          }
          
          this.items.splice(i, 1);
          break;
        }
      }
    }

    // Update heal VFX
    this.healVFX = this.healVFX.filter(vfx => {
      vfx.y -= 1; // 向上漂浮
      vfx.alpha -= 0.02; // 逐漸淡出
      return vfx.alpha > 0;
    });

    // Update hit effects
    for (let i = this.hitEffects.length - 1; i >= 0; i--) {
      const effect = this.hitEffects[i];
      effect.lifetime -= dt;
      if (effect.lifetime <= 0) {
        this.hitEffects.splice(i, 1);
      }
    }

    this.onUpdateUI(this.players[0] || null, this.players[1] || null, this.waveManager);
  }

  applyWaveMechanisms(dt: number) {
    const wave = this.waveManager.currentWave;
    const isInfinite = this.waveManager.isInfinite;
    const mechanics = this.waveManager.activeMechanics;

    // Earthquake (W8 or Infinite)
    if (wave === 8 || (isInfinite && mechanics.includes('slow_liquid'))) {
      if (Math.random() < 0.02) {
        this.shakeTimer = 200;
      }
    }

    // Lightning (W9 or Infinite)
    if (wave === 9 || (isInfinite && mechanics.includes('lightning'))) {
      if (Math.random() < 0.005) { // Random lightning strike
        const lx = this.camera.x + Math.random() * CONSTANTS.CANVAS_WIDTH;
        const ly = this.camera.y + Math.random() * CONSTANTS.CANVAS_HEIGHT;
        this.hitEffects.push({ x: lx, y: ly, type: 'lightning', lifetime: 500, maxLifetime: 500 });
        
        // Stun nearby
        const stunRadius = 150;
        for (const player of this.players) {
          if (Math.hypot(player.x - lx, player.y - ly) < stunRadius) {
            player.slowDebuffTimer = 2000;
          }
        }
        for (const zombie of this.zombies) {
          if (Math.hypot(zombie.x - lx, zombie.y - ly) < stunRadius) {
            zombie.vx = 0; zombie.vy = 0;
          }
        }
      }
    }
  }

  handleObstacleInteractions(dt: number) {
    const obstacleSet = new Set<Obstacle>();
    for (const player of this.players) {
      if (player.hp > 0) {
        const nearby = this.mapManager.getNearbyObstacles(player.x, player.y);
        nearby.forEach(obs => obstacleSet.add(obs));
      }
    }
    const allObstacles = Array.from(obstacleSet);
    
    for (const player of this.players) {
      if (player.hp <= 0) continue;
      player.isInsideContainer = false;
      player.isAtAltar = false;
    }
    for (const zombie of this.zombies) {
      zombie.isInsideContainer = false;
    }

    for (const obs of allObstacles) {
      obs.update(dt, this.players, (p) => {
        // Enhanced onHeal visual feedback
        this.healVFX.push({ 
          x: p.x + (Math.random() - 0.5) * 15, 
          y: p.y - 30, 
          alpha: 1.0, 
          startTime: Date.now() 
        });
      });

      if (obs.isDestroyed && !obs.isTriggered) continue;

      // Handle trigger timers
      if (obs.isTriggered && obs.triggerTimer > 0) {
        obs.triggerTimer -= dt;
        if (obs.triggerTimer <= 0) {
          if (obs.type === 'explosive_barrel') {
            this.explodeObstacle(obs);
          } else if (obs.type === 'vending_machine') {
            this.dropVendingMachineItems(obs);
          } else if (obs.type === 'tombstone') {
            this.score += 500;
            this.hitEffects.push({ x: obs.x + obs.width / 2, y: obs.y + obs.height / 2, type: 'purple_particles', lifetime: 500, maxLifetime: 500 });
          }
        }
      }

      // 1. Sandbags: Destroyed by big zombies
      if (obs.type === 'sandbag' && !obs.isDestroyed) {
        for (const zombie of this.zombies) {
          if (zombie.type === 'big' && obs.collidesWithCircle(zombie.x, zombie.y, zombie.radius)) {
            obs.takeDamage(100); // Instant destroy
            this.hitEffects.push({ x: obs.x, y: obs.y, type: 'grey_sparks', lifetime: 300, maxLifetime: 300 });
          }
        }
      }

      // 2. Electric Fence: Damage and paralysis
      if (obs.type === 'electric_fence') {
        const now = Date.now();
        for (const player of this.players) {
          if (player.hp > 0 && obs.collidesWithCircle(player.x, player.y, player.radius)) {
            if (now - obs.lastEffectTime > 1000) {
              player.slowDebuffTimer = 500;
              obs.lastEffectTime = now;
            }
          }
        }
        for (const zombie of this.zombies) {
          if (obs.collidesWithCircle(zombie.x, zombie.y, zombie.radius)) {
            if (now - obs.lastEffectTime > 1000) {
              zombie.hp -= 5;
              zombie.paralysisTimer = 500;
              obs.lastEffectTime = now;
              this.hitEffects.push({ x: zombie.x, y: zombie.y, type: 'green_electricity', lifetime: 300, maxLifetime: 300 });
            }
          }
        }
      }

      // 5. Tombstone: Faster spawn
      if (obs.type === 'tombstone' && !obs.isDestroyed) {
        // Logic handled in spawn loop
      }

      // 7. Container: Transparency
      if (obs.type === 'container') {
        for (const player of this.players) {
          if (player.hp > 0 && obs.collidesWithCircle(player.x, player.y, player.radius)) {
            player.isInsideContainer = true;
          }
        }
        for (const zombie of this.zombies) {
          if (obs.collidesWithCircle(zombie.x, zombie.y, zombie.radius)) {
            zombie.isInsideContainer = true;
          }
        }
      }

      // 8. Altar: Buff and Drain
      if (obs.type === 'altar' && this.waveManager.currentWave >= 7) {
        for (const player of this.players) {
          if (player.hp > 0 && obs.collidesWithCircle(player.x, player.y, player.radius)) {
            player.isAtAltar = true;
            // player.hp -= 1 * (dt / 1000); // -1 HP/s - Disabled
            // Damage boost is handled in attack logic
          }
        }
      }
    }
  }

  private findNearestZombie(x: number, y: number, maxDist: number) {
    let nearest = null;
    let minDist = maxDist;
    for (const zombie of this.zombies) {
      const dist = Math.hypot(zombie.x - x, zombie.y - y);
      if (dist < minDist) {
        minDist = dist;
        nearest = zombie;
      }
    }
    return nearest;
  }

  private explodeObstacle(obs: Obstacle) {
    const explosionRadius = 150;
    const damage = 50;
    
    this.hitEffects.push({ 
      x: obs.x + obs.width / 2, 
      y: obs.y + obs.height / 2, 
      type: 'orange_explosion', 
      lifetime: 400,
      startTime: Date.now(),
      maxLifetime: 400 
    });
    
    // Chain reaction: Explode nearby barrels
    for (const chunkObstacles of this.mapManager.obstacles.values()) {
      for (const otherObs of chunkObstacles) {
        if (otherObs.type === 'explosive_barrel' && !otherObs.isDestroyed && otherObs !== obs) {
          const dist = Math.hypot(otherObs.x + otherObs.width / 2 - (obs.x + obs.width / 2), otherObs.y + otherObs.height / 2 - (obs.y + obs.height / 2));
          if (dist < explosionRadius) {
            otherObs.takeDamage(100); // Trigger explosion
          }
        }
      }
    }

    for (const player of this.players) {
      if (player.hp > 0) {
        const dist = Math.hypot(player.x - (obs.x + obs.width / 2), player.y - (obs.y + obs.height / 2));
        if (dist < explosionRadius) {
          player.hp -= damage * (1 - dist / explosionRadius);
          player.lastDamageTime = Date.now();
        }
      }
    }
    for (const zombie of this.zombies) {
      const dist = Math.hypot(zombie.x - (obs.x + obs.width / 2), zombie.y - (obs.y + obs.height / 2));
      if (dist < explosionRadius) {
        zombie.hp -= damage * 2 * (1 - dist / explosionRadius);
        zombie.vx += (zombie.x - (obs.x + obs.width / 2)) / dist * 10;
        zombie.vy += (zombie.y - (obs.y + obs.height / 2)) / dist * 10;
      }
    }
    obs.isDestroyed = true;
    obs.isTriggered = false;
  }

  private dropVendingMachineItems(obs: Obstacle) {
    // Drop shield or speed boost
    const type = Math.random() > 0.5 ? 'shield' : 'speed';
    this.items.push(new Item(
      obs.x + obs.width / 2,
      obs.y + obs.height / 2,
      type,
      10000
    ));
    
    // Attract zombies with noise
    for (const zombie of this.zombies) {
      const dist = Math.hypot(zombie.x - obs.x, zombie.y - obs.y);
      if (dist < 1000) {
        // Apply a strong velocity vector towards the vending machine to simulate distraction
        zombie.vx += ((obs.x + obs.width / 2) - zombie.x) / dist * 15;
        zombie.vy += ((obs.y + obs.height / 2) - zombie.y) / dist * 15;
      }
    }
    obs.isDestroyed = true;
    obs.isTriggered = false;
  }

  handlePlayerAttacks(player: Player) {
    let attackInterval = CONSTANTS.ATTACK_INTERVAL;
    if (player.weapon === 'sword') {
      if (player.level === 1) attackInterval = 800;
      else if (player.level === 2) attackInterval = 500;
      else if (player.level === 3) attackInterval = 1000;
      else if (player.level === 4) attackInterval = 1200;
      else if (player.level === 5) attackInterval = 1500;
    } else if (player.weapon === 'gun') {
      if (player.level === 1) attackInterval = 800;
      else if (player.level === 2) attackInterval = 500;
      else if (player.level === 3) attackInterval = 1000;
      else if (player.level === 4) attackInterval = 1000;
      else if (player.level === 5) attackInterval = 1300;
    }
    
    attackInterval /= player.attackSpeedMultiplier;

    if (Date.now() - player.lastAttackTime > attackInterval) {
      player.lastAttackTime = Date.now();
      
      const level = player.level;

      if (player.weapon === 'sword') {
        const dir = { x: Math.cos(player.aimAngle), y: Math.sin(player.aimAngle) };
        let radius = 50;
        let damage = 1;
        let knockback = true;

        if (level === 2) { radius = 90; damage = 3; }
        else if (level === 3) { radius = 180; damage = 3; }
        else if (level === 4) { radius = 180; damage = 3; }
        else if (level === 5) { radius = 300; damage = 5; }
        
        damage *= player.damageMultiplier;
        if (player.isAtAltar) damage *= 1.4;

        audioManager.playSlash(level);

        this.projectiles.push(new Projectile(
          player.id, player.x, player.y, dir.x, dir.y, damage, Infinity, 250, 'slash', radius, knockback, level
        ));
      } else {
        let count = 1;
        let damage = 1;
        let speed = 6;
        let pierce = 1;
        let spread = false;
        let burst = 1;

        if (level === 2) { count = 2; damage = 3; speed = 8; }
        else if (level === 3) { count = 3; damage = 3; speed = 10; spread = true; }
        else if (level === 4) { count = 4; damage = 3; speed = 10; pierce = 2; spread = true; }
        else if (level === 5) { count = 3; damage = 3; speed = 12; pierce = 2; spread = true; burst = 2; }
        
        damage *= player.damageMultiplier;
        if (player.isAtAltar) damage *= 1.4;

        const fireProjectiles = () => {
          if (player.hp <= 0) return; // Don't fire if dead
          
          audioManager.playShoot(level);

          const currentBaseAngle = player.aimAngle;
          const currentDir = { x: Math.cos(currentBaseAngle), y: Math.sin(currentBaseAngle) };
          
          if (!spread) {
            if (count === 1) {
              this.projectiles.push(new Projectile(player.id, player.x, player.y, currentDir.x * speed, currentDir.y * speed, damage, pierce, 2000, 'bullet', 5, false, level));
            } else if (count === 2) {
              const perpX = -currentDir.y * 10;
              const perpY = currentDir.x * 10;
              this.projectiles.push(new Projectile(player.id, player.x + perpX, player.y + perpY, currentDir.x * speed, currentDir.y * speed, damage, pierce, 2000, 'bullet', 5, false, level));
              this.projectiles.push(new Projectile(player.id, player.x - perpX, player.y - perpY, currentDir.x * speed, currentDir.y * speed, damage, pierce, 2000, 'bullet', 5, false, level));
            }
          } else {
            let spreadAngle = Math.PI / 4; // 45 degrees default
            if (level === 4) spreadAngle = Math.PI / 3; // 60 degrees
            if (level === 5) spreadAngle = 55 * Math.PI / 180; // 55 degrees
            
            const startAngle = currentBaseAngle - spreadAngle / 2;
            const angleStep = count > 1 ? spreadAngle / (count - 1) : 0;
            
            let bulletRadius = 5;
            if (level === 4) bulletRadius = 10;
            if (level === 5) bulletRadius = 12;
            
            for (let i = 0; i < count; i++) {
              const angle = count === 1 ? currentBaseAngle : startAngle + i * angleStep;
              const vx = Math.cos(angle) * speed;
              const vy = Math.sin(angle) * speed;
              this.projectiles.push(new Projectile(player.id, player.x, player.y, vx, vy, damage, pierce, 2000, 'bullet', bulletRadius, false, level));
            }
          }
        };

        fireProjectiles();
        
        if (burst > 1) {
          let burstCount = 1;
          const burstInterval = setInterval(() => {
            if (burstCount >= burst || player.hp <= 0) {
              clearInterval(burstInterval);
              return;
            }
            fireProjectiles();
            burstCount++;
          }, 150); // 150ms between bursts
        }
      }
    }
  }

  spawnZombie() {
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    
    // Spawn just outside the camera view
    const margin = 100;
    if (side === 0) { 
      x = this.camera.x + Math.random() * CONSTANTS.CANVAS_WIDTH; 
      y = this.camera.y - margin; 
    } else if (side === 1) { 
      x = this.camera.x + CONSTANTS.CANVAS_WIDTH + margin; 
      y = this.camera.y + Math.random() * CONSTANTS.CANVAS_HEIGHT; 
    } else if (side === 2) { 
      x = this.camera.x + Math.random() * CONSTANTS.CANVAS_WIDTH; 
      y = this.camera.y + CONSTANTS.CANVAS_HEIGHT + margin; 
    } else { 
      x = this.camera.x - margin; 
      y = this.camera.y + Math.random() * CONSTANTS.CANVAS_HEIGHT; 
    }

    const rand = Math.random();
    const comp = this.waveManager.getComposition();
    let type: 'normal' | 'big' | 'slime' | 'spitter' = 'normal';
    
    if (rand < comp.big) type = 'big';
    else if (rand < comp.big + comp.slime) type = 'slime';
    else if (rand < comp.big + comp.slime + comp.spitter) type = 'spitter';
    else type = 'normal';

    const zombie = new Zombie(x, y, type);
    
    // Apply difficulty multiplier
    const mult = this.waveManager.difficultyMultiplier;
    
    if (type === 'big') {
      zombie.hp *= mult;
      zombie.speed *= mult;
    } else if (type === 'slime') {
      zombie.hp *= mult;
      zombie.speed *= mult;
    } else if (type === 'spitter') {
      zombie.hp = 3 * mult;
      zombie.speed *= mult;
    } else {
      const gameTime = Date.now() - this.startTime;
      const baseHp = gameTime > 60000 ? 2 : 1;
      zombie.hp = baseHp * mult;
      zombie.speed *= mult;
    }
    zombie.maxHp = zombie.hp;
    
    if (this.waveManager.isInfinite) {
      zombie.isInfiniteGlow = true;
    }
    
    this.zombies.push(zombie);
  }

  spawnItemAt(x: number, y: number) {
    const rand = Math.random();
    let type: ItemType;
    if (rand < 0.4) type = 'weapon_sword';
    else if (rand < 0.8) type = 'weapon_gun';
    else if (rand < 0.9) type = 'shield';
    else type = 'speed';
    
    this.items.push(new Item(x, y, type, CONSTANTS.ITEM_LIFETIME));
  }

  spawnItem() {
    // Spawn item near the center of the camera
    const margin = 100;
    const x = this.camera.x + margin + Math.random() * (CONSTANTS.CANVAS_WIDTH - margin * 2);
    const y = this.camera.y + margin + Math.random() * (CONSTANTS.CANVAS_HEIGHT - margin * 2);
    this.spawnItemAt(x, y);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
    
    ctx.save();
    
    // Screen Shake
    if (this.shakeTimer > 0) {
      const intensity = 5;
      ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
    }

    ctx.translate(-this.camera.x, -this.camera.y);

    // Draw map (grid and obstacles)
    this.mapManager.draw(ctx, this.camera.x, this.camera.y, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT, this.players, {
      wave: this.waveManager.currentWave,
      isInfinite: this.waveManager.isInfinite,
      activeMechanics: this.waveManager.activeMechanics
    });

    // Draw slime trails
    for (const trail of this.slimeTrails) {
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, trail.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(139, 195, 74, ${(trail.lifetime / trail.maxLifetime) * 0.5})`;
      ctx.fill();
      ctx.closePath();
    }

    for (const item of this.items) item.draw(ctx);
    for (const proj of this.projectiles) proj.draw(ctx);
    for (const zombie of this.zombies) zombie.draw(ctx);
    for (const player of this.players) player.draw(ctx);

    // Apply Mechanism Filters (Fog of War, etc.)
    this.drawWaveFilters(ctx);

    for (const effect of this.hitEffects) {
      ctx.save();
      const progress = effect.startTime ? (Date.now() - effect.startTime) / effect.maxLifetime : (effect.lifetime / effect.maxLifetime);
      
      if (effect.type === 'orange_explosion') {
        this.drawRealExplosion(ctx, effect.x, effect.y, Math.min(progress, 1));
      } else if (effect.type === 'grey_sparks') {
        const p = effect.lifetime / effect.maxLifetime;
        ctx.fillStyle = `rgba(158, 158, 158, ${p})`;
        for(let i=0; i<5; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 10;
          ctx.beginPath();
          ctx.arc(effect.x + Math.cos(angle) * dist, effect.y + Math.sin(angle) * dist, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (effect.type === 'blue_circle') {
        ctx.strokeStyle = `rgba(0, 229, 255, ${progress})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 20 * (1 - progress), 0, Math.PI * 2);
        ctx.stroke();
      } else if (effect.type === 'green_electricity') {
        ctx.strokeStyle = `rgba(178, 255, 89, ${progress})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for(let i=0; i<4; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 10 + Math.random() * 15;
          ctx.moveTo(effect.x, effect.y);
          ctx.lineTo(effect.x + Math.cos(angle) * dist, effect.y + Math.sin(angle) * dist);
        }
        ctx.stroke();
      } else if (effect.type === 'orange_explosion') {
        ctx.fillStyle = `rgba(255, 152, 0, ${progress})`;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 15 * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
        // Residual fire
        ctx.fillStyle = `rgba(255, 87, 34, ${progress * 0.5})`;
        for(let i=0; i<3; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 20;
          ctx.beginPath();
          ctx.arc(effect.x + Math.cos(angle) * dist, effect.y + Math.sin(angle) * dist, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (effect.type === 'black_hole') {
        // Black hole collapse
        if (progress > 0.5) {
          // Sucking in
          const suckProgress = (progress - 0.5) * 2; // 1 to 0
          ctx.fillStyle = `rgba(0, 0, 0, ${suckProgress})`;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, 30 * suckProgress, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = `rgba(255, 255, 255, ${suckProgress})`;
          for(let i=0; i<10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 40 * suckProgress;
            ctx.beginPath();
            ctx.arc(effect.x + Math.cos(angle) * dist, effect.y + Math.sin(angle) * dist, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Explosion
          const expProgress = progress * 2; // 1 to 0
          ctx.fillStyle = `rgba(255, 255, 255, ${expProgress})`;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, 50 * (1 - expProgress), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (effect.type === 'purple_particles') {
        ctx.fillStyle = `rgba(156, 39, 176, ${progress})`;
        for(let i=0; i<5; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 15;
          ctx.beginPath();
          ctx.arc(effect.x + Math.cos(angle) * dist, effect.y + Math.sin(angle) * dist, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (effect.type === 'white_cross') {
        ctx.strokeStyle = `rgba(255, 255, 255, ${progress})`;
        ctx.lineWidth = 3;
        const size = 15 * (1 - progress);
        ctx.beginPath();
        ctx.moveTo(effect.x - size, effect.y - size);
        ctx.lineTo(effect.x + size, effect.y + size);
        ctx.moveTo(effect.x + size, effect.y - size);
        ctx.lineTo(effect.x - size, effect.y + size);
        ctx.stroke();
      } else if (effect.type === 'ice_shatter') {
        ctx.fillStyle = `rgba(128, 216, 255, ${progress})`;
        for(let i=0; i<6; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 20;
          ctx.fillRect(effect.x + Math.cos(angle) * dist, effect.y + Math.sin(angle) * dist, 4, 4);
        }
      } else if (effect.type === 'red_blood') {
        ctx.fillStyle = `rgba(244, 67, 54, ${progress})`;
        for(let i=0; i<8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 25;
          ctx.beginPath();
          ctx.arc(effect.x + Math.cos(angle) * dist, effect.y + Math.sin(angle) * dist, 3 + Math.random() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (effect.type === 'golden_shatter') {
        ctx.fillStyle = `rgba(255, 214, 0, ${progress})`;
        for(let i=0; i<12; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 30;
          ctx.beginPath();
          ctx.moveTo(effect.x + Math.cos(angle) * dist, effect.y + Math.sin(angle) * dist);
          ctx.lineTo(effect.x + Math.cos(angle) * dist + 5, effect.y + Math.sin(angle) * dist + 5);
          ctx.lineTo(effect.x + Math.cos(angle) * dist - 2, effect.y + Math.sin(angle) * dist + 8);
          ctx.fill();
        }
      } else if (effect.type === 'dismember') {
        ctx.fillStyle = `rgba(76, 175, 80, ${progress})`;
        for(let i=0; i<5; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 10 + Math.random() * 30 * (1 - progress);
          ctx.beginPath();
          ctx.arc(effect.x + Math.cos(angle) * dist, effect.y + Math.sin(angle) * dist, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (effect.type === 'lightning') {
        ctx.strokeStyle = `rgba(255, 255, 255, ${progress})`;
        ctx.lineWidth = 4;
        ctx.shadowColor = 'white';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y - 1000);
        let curX = effect.x;
        let curY = effect.y - 1000;
        while (curY < effect.y) {
          curX += (Math.random() - 0.5) * 40;
          curY += 50;
          ctx.lineTo(curX, curY);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }
    
    ctx.restore(); // Restore camera translation

    // Draw vignette effect
    const gradient = ctx.createRadialGradient(
      CONSTANTS.CANVAS_WIDTH / 2, CONSTANTS.CANVAS_HEIGHT / 2, CONSTANTS.CANVAS_HEIGHT * 0.3,
      CONSTANTS.CANVAS_WIDTH / 2, CONSTANTS.CANVAS_HEIGHT / 2, CONSTANTS.CANVAS_WIDTH * 0.7
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
  }

  drawWaveFilters(ctx: CanvasRenderingContext2D) {
    const wave = this.waveManager.currentWave;
    const isInfinite = this.waveManager.isInfinite;
    const mechanics = this.waveManager.activeMechanics;
    const introTimer = this.waveManager.waveIntroTimer;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to screen space

    // Intro Effects (First 3 Seconds)
    if (introTimer > 0) {
      const progress = introTimer / 3000; // 1 to 0
      this.drawIntroEffect(ctx, wave, isInfinite, progress);
    }

    // Ongoing Mechanics (After or during intro)
    // ONLY draw these filters during the 3-second intro period
    if (introTimer > 0) {
      // Toxic Fog (Green)
      if (wave === 6 || (isInfinite && mechanics.includes('toxic_fog'))) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
      }

      // Red Filter (Attack Boost / Blood Flow)
      if (wave === 7 || (isInfinite && mechanics.includes('attack_boost'))) {
        const time = Date.now() / 1000;
        const alpha = 0.2 + Math.sin(time * 2) * 0.03;
        ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
        ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
        
        // Blood flow edges
        ctx.strokeStyle = `rgba(150, 0, 0, ${alpha * 2})`;
        ctx.lineWidth = 40;
        ctx.strokeRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
      }
      
      // Yellow Filter (Lightning / Flicker)
      if (wave === 3 || wave === 9 || (isInfinite && mechanics.includes('lightning'))) {
        const time = Date.now() / 500;
        let alpha = wave === 3 ? 0.04 : (Math.random() < 0.1 ? 0.15 : 0.06);
        ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
        
        if (wave === 3) {
          // Edge flicker for W3
          ctx.strokeStyle = `rgba(255, 255, 0, ${alpha * 5})`;
          ctx.lineWidth = 20;
          ctx.strokeRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
        } else {
          ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
        }
      }

      // Infinite Mode: Pure Black & Glow
      if (isInfinite) {
        // Fog of War effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);

        ctx.globalCompositeOperation = 'destination-out';
        
        // Visibility around players
        for (const player of this.players) {
          if (player.hp <= 0) continue;
          const screenX = player.x - this.camera.x;
          const screenY = player.y - this.camera.y;
          const radius = 150;
          const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
          grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        // Visibility around streetlights
        const nearbyObstacles = this.mapManager.getNearbyObstacles(this.camera.x + CONSTANTS.CANVAS_WIDTH / 2, this.camera.y + CONSTANTS.CANVAS_HEIGHT / 2);
        for (const obs of nearbyObstacles) {
          if (obs.type === 'streetlight' && !obs.isDestroyed) {
            const screenX = obs.x + obs.width / 2 - this.camera.x;
            const screenY = obs.y + obs.height / 2 - this.camera.y;
            const radius = 300; // 200% of player visibility
            const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
            grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.globalCompositeOperation = 'source-over';
      }
    }

    this.drawHealVFX(ctx);

    ctx.restore();
  }

  drawHealVFX(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const vfx of this.healVFX) {
      // 已經在 world space (因為外層有 ctx.translate(-this.camera.x, -this.camera.y))
      // 所以不需要再減去 camera.x, camera.y
      
      ctx.globalAlpha = vfx.alpha;
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('+', vfx.x, vfx.y);
      
      ctx.strokeStyle = `rgba(0, 255, 0, ${vfx.alpha})`;
      ctx.beginPath();
      ctx.arc(vfx.x, vfx.y + 20, 15 * (1.5 - vfx.alpha), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCloudShadow(ctx: CanvasRenderingContext2D, progress: number, color: string = 'rgba(0, 0, 0, 0.3)') {
    ctx.fillStyle = color.replace('0.3', (progress * 0.3).toString());
    for (let i = 0; i < 5; i++) {
      const x = (Date.now() / 5 + i * 300) % (CONSTANTS.CANVAS_WIDTH * 2) - CONSTANTS.CANVAS_WIDTH;
      ctx.beginPath();
      ctx.ellipse(x, CONSTANTS.CANVAS_HEIGHT / 2, 500, 300, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawIntroEffect(ctx: CanvasRenderingContext2D, wave: number, isInfinite: boolean, progress: number) {
    if (isInfinite) {
      // W10+: Pure Black Transition
      ctx.fillStyle = `rgba(0, 0, 0, ${progress})`;
      ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
      return;
    }

    switch (wave) {
      case 1:
        // W1: Bright grass
        ctx.fillStyle = `rgba(255, 255, 255, ${progress * 0.5})`;
        ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
        break;
      case 2:
        // W2: Cloud shadows
        this.drawCloudShadow(ctx, progress);
        break;
      case 3:
        // W3: Green cloud shadows
        this.drawCloudShadow(ctx, progress, 'rgba(0, 100, 0, 0.3)');
        break;
      case 4:
        // W4: Cloud shadows
        this.drawCloudShadow(ctx, progress);
        break;
      case 5:
        // W5: Cloud shadows
        this.drawCloudShadow(ctx, progress);
        break;
      case 6:
        // W6: Deep green cloud shadows
        this.drawCloudShadow(ctx, progress, 'rgba(0, 100, 0, 0.5)');
        break;
      case 7:
        // W7: Red cloud shadows
        this.drawCloudShadow(ctx, progress, 'rgba(150, 0, 0, 0.5)');
        break;
      case 8:
        // W8: Cloud shadows + black liquid
        this.drawCloudShadow(ctx, progress);
        ctx.fillStyle = `rgba(0, 0, 0, ${progress * 0.4})`;
        ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
        break;
      case 9:
        // W9: Lightning sparks
        ctx.fillStyle = `rgba(0, 0, 0, ${progress * 0.7})`;
        ctx.fillRect(0, 0, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
        if (Math.random() < 0.2) {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(Math.random() * CONSTANTS.CANVAS_WIDTH, 0);
          ctx.lineTo(Math.random() * CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
          ctx.stroke();
        }
        break;
    }
  }

  private drawRealExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
    const maxRadius = 150; // 爆炸半徑
    const alpha = 1 - progress;

    ctx.save();

    // 1. 核心強光 (白色 -> 黃色)
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.arc(x, y, maxRadius * progress * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // 2. 主爆炸環 (橙色)
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 100, 0, ${alpha})`;
    ctx.lineWidth = 15 * (1 - progress);
    ctx.arc(x, y, maxRadius * Math.pow(progress, 0.5), 0, Math.PI * 2);
    ctx.stroke();

    // 3. 爆炸碎片 (隨機粒子)
    const particleCount = 12;
    ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + (progress * 2);
        const dist = maxRadius * progress * 1.2;
        const px = x + Math.cos(angle) * dist;
        const py = y + Math.sin(angle) * dist;
        ctx.beginPath();
        ctx.arc(px, py, 4 * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
  }
}
