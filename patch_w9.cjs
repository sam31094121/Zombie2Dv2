const fs = require('fs');
let code = fs.readFileSync('src/game/Game.ts', 'utf8');

const target = /\} else if \(waveId >= 6 && waveId <= 8\) \{\s*const pt = this\.randomArenaPoint\(150\);\s*const obs = new Obstacle\(pt\.x, pt\.y, 60, 60, "tombstone"\);\s*this\.addObstacleToMap\(obs\);\s*this\.activeTombstones\.push\(obs\);\s*\} else if \(waveId === 10\) \{/m;

const replacement = `} else if (waveId >= 6 && waveId <= 8) {
      const pt = this.randomArenaPoint(150);
      const obs = new Obstacle(pt.x, pt.y, 60, 60, "tombstone");
      this.addObstacleToMap(obs);
      this.activeTombstones.push(obs);
    } else if (waveId === 9) {
      for (let i = 0; i < 3; i++) {
        const pt = this.randomArenaPoint(150);
        const obs = new Obstacle(pt.x, pt.y, 60, 60, "tombstone");
        this.addObstacleToMap(obs);
        this.activeTombstones.push(obs);
      }
    } else if (waveId === 10) {`;

code = code.replace(target, replacement);
fs.writeFileSync('src/game/Game.ts', code, 'utf8');
