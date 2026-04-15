const fs = require("fs"); let c = fs.readFileSync("src/game/WaveManager.ts", "utf8"); c = c.replace(/\\n/g, "\n"); fs.writeFileSync("src/game/WaveManager.ts", c);
