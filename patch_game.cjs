const fs = require('fs');
let code = fs.readFileSync('src/game/Game.ts', 'utf8');

// Patch 1: Objective Check and Transition Logic
const search1 = "    // --- ARENA MODE WAVE END FREEZE & AUTO-LOOT ---";
const replace1 = `    // Objective check
    if (this.mode === 'arena' && this.waveManager.isObjectiveBased()) {
       const waveId = this.waveManager.currentWaveConfig.id;
       if (waveId === 5) {
          if (this.activeTombstones.length > 0 && this.activeTombstones.every(t => t.isDestroyed || t.hp <= 0)) {
             this.waveManager.completeObjective();
          }
       } else if (waveId === 10) {
          if (this.activeBoss && this.activeBoss.hp <= 0) {
             this.waveManager.completeObjective();
          }
       }
    }
    
    // Smooth Transition Logic
    if (this.mode === 'arena' && this.waveManager.isTransitioning) {
       dt *= 0.3; // Slow motion
       if (!(this.waveManager as any)._transitionKilled) {
          for (const z of this.zombies) {
             if (z.hp > 0) { 
               z.hp = 0; 
               this.queueZombieDeath(z, null, 1);
             }
          }
          (this.waveManager as any)._transitionKilled = true;
       }
    } else {
       (this.waveManager as any)._transitionKilled = false;
    }

    // --- ARENA MODE WAVE END FREEZE & AUTO-LOOT ---`;
code = code.replace(search1, replace1);

// Patch 2: W10 Victory Logic
const search2 = "if (this.mode === 'arena' && this.waveManager.isResting) {";
const replace2 = `if (this.mode === 'arena' && this.waveManager.isResting) {
      if (this.waveManager.currentWaveConfig.id === 10) {
          this.isGameOver = true;
          this.onGameOver(Date.now() - this.startTime, this.score);
          return;
      }`;
code = code.replace(search2, replace2);

// Patch 3: Spawn Logic with multiplier
const search3 = /if \(!this\.waveManager\.isResting && !this\.debugPaused\) \{\s*this\.zombieSpawnTimer \+= dt;\s*let spawnRate = Math\.max\(500, 2000 - \(this\.waveManager\.currentWave \* 100\)\);/;
const replace3 = `if (!this.waveManager.isResting && !this.debugPaused && !this.waveManager.isTransitioning) {
        this.zombieSpawnTimer += dt;
        let spawnRate = Math.max(500, 2000 - (this.waveManager.currentWave * 100));
        
        if (this.mode === 'arena' && this.waveManager.currentWaveConfig.spawnRateMultiplier) {
           spawnRate *= this.waveManager.currentWaveConfig.spawnRateMultiplier;
        }`;
code = code.replace(search3, replace3);

fs.writeFileSync('src/game/Game.ts', code, 'utf8');
console.log("Patch Success");
