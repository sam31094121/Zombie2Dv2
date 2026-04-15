const fs = require("fs"); let c = fs.readFileSync("src/game/Game.ts", "utf8"); c = c.replace(/    \/\/ \?\?êΩ\?\?\?\?/g, "    } \n    // ??êΩ????"); fs.writeFileSync("src/game/Game.ts", c, "utf8");
