import { Obstacle, ObstacleType } from './Obstacle';
import { Player } from '../Player';

const CHUNK_SIZE = 800;

export class MapManager {
  obstacles: Map<string, Obstacle[]> = new Map();

  private pseudoRandom(seed: number) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  getChunkKey(cx: number, cy: number) {
    return `${cx},${cy}`;
  }

  generateChunk(cx: number, cy: number) {
    const key = this.getChunkKey(cx, cy);
    if (this.obstacles.has(key)) return;

    const chunkObstacles: Obstacle[] = [];
    // Create a unique seed for this chunk
    const seed = (cx * 73856093) ^ (cy * 19349663);
    
    // Generate 1-4 obstacles per chunk (sparse)
    const numObstacles = Math.floor(this.pseudoRandom(seed) * 4) + 1;
    
    for (let i = 0; i < numObstacles; i++) {
      const typeRand = this.pseudoRandom(seed + i * 10);
      let type: ObstacleType = 'tree';
      
      if (typeRand < 0.15) type = 'tree';
      else if (typeRand < 0.25) type = 'rock';
      else if (typeRand < 0.35) type = 'wall';
      else if (typeRand < 0.40) type = 'pillar';
      else if (typeRand < 0.45) type = 'building';
      else if (typeRand < 0.55) type = 'sandbag';
      else if (typeRand < 0.60) type = 'electric_fence';
      else if (typeRand < 0.70) type = 'explosive_barrel'; // Increased range
      else if (typeRand < 0.80) type = 'streetlight';
      else if (typeRand < 0.85) type = 'tombstone';
      else if (typeRand < 0.90) type = 'vending_machine';
      else if (typeRand < 0.95) type = 'container';
      else if (typeRand < 0.98) type = 'altar';
      else type = 'monolith';

      const x = cx * CHUNK_SIZE + this.pseudoRandom(seed + i * 11) * (CHUNK_SIZE - 200) + 100;
      const y = cy * CHUNK_SIZE + this.pseudoRandom(seed + i * 12) * (CHUNK_SIZE - 200) + 100;
      
      if (type === 'wall' || type === 'container' || type === 'vending_machine') {
        const isHorizontal = this.pseudoRandom(seed + i * 13) > 0.5;
        let w = 30, h = 30;
        if (type === 'wall') {
          w = isHorizontal ? 100 + this.pseudoRandom(seed + i * 14) * 150 : 30;
          h = isHorizontal ? 30 : 100 + this.pseudoRandom(seed + i * 14) * 150;
        } else if (type === 'container') {
          w = isHorizontal ? 120 : 60;
          h = isHorizontal ? 60 : 120;
        } else if (type === 'vending_machine') {
          w = 40; h = 40;
        }
        chunkObstacles.push(new Obstacle(x, y, w, h, type));
      } else if (type === 'electric_fence') {
        const isHorizontal = this.pseudoRandom(seed + i * 13) > 0.5;
        const len = 150 + this.pseudoRandom(seed + i * 14) * 100;
        const w = isHorizontal ? len : 0;
        const h = isHorizontal ? 0 : len;
        chunkObstacles.push(new Obstacle(x, y, w, h, type));
      } else if (type === 'building' || type === 'altar') {
        const r = (type === 'altar' ? 40 : 80) + this.pseudoRandom(seed + i * 15) * 60;
        chunkObstacles.push(new Obstacle(x, y, r * 2, r * 2, type));
      } else if (type === 'tree' || type === 'sandbag' || type === 'explosive_barrel' || type === 'streetlight' || type === 'tombstone' || type === 'monolith') {
        let r = 30;
        if (type === 'tree') r = 40 + this.pseudoRandom(seed + i * 15) * 30;
        else if (type === 'sandbag') r = 30;
        else if (type === 'explosive_barrel') r = 22; // Increased size
        else if (type === 'streetlight') r = 20;
        else if (type === 'tombstone') r = 25;
        else if (type === 'monolith') r = 35;
        
        chunkObstacles.push(new Obstacle(x, y, r * 2, r * 2, type));

        // Chance to spawn a second explosive barrel nearby
        if (type === 'explosive_barrel' && this.pseudoRandom(seed + i * 16) < 0.3) {
          const offsetX = (this.pseudoRandom(seed + i * 17) - 0.5) * 100;
          const offsetY = (this.pseudoRandom(seed + i * 18) - 0.5) * 100;
          chunkObstacles.push(new Obstacle(x + offsetX, y + offsetY, r * 2, r * 2, type));
        }
      } else {
        const r = 30 + this.pseudoRandom(seed + i * 15) * 30;
        chunkObstacles.push(new Obstacle(x, y, r * 2, r * 2, type));
      }
    }
    
    this.obstacles.set(key, chunkObstacles);
  }

  update(playerX: number, playerY: number) {
    const cx = Math.floor(playerX / CHUNK_SIZE);
    const cy = Math.floor(playerY / CHUNK_SIZE);
    
    // Generate 3x3 chunks around player
    for (let x = cx - 1; x <= cx + 1; x++) {
      for (let y = cy - 1; y <= cy + 1; y++) {
        this.generateChunk(x, y);
      }
    }
  }

  getNearbyObstacles(x: number, y: number): Obstacle[] {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    let nearby: Obstacle[] = [];
    
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cy - 1; j <= cy + 1; j++) {
        const chunk = this.obstacles.get(this.getChunkKey(i, j));
        if (chunk) nearby.push(...chunk);
      }
    }
    return nearby;
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, width: number, height: number, players?: Player[], waveInfo?: { wave: number, isInfinite: boolean, activeMechanics: string[] }) {
    // Fill base ground color (Dark Asphalt)
    ctx.fillStyle = waveInfo?.isInfinite ? '#000000' : '#1e2024';
    ctx.fillRect(cameraX, cameraY, width, height);

    if (waveInfo?.isInfinite) {
      // In infinite mode, we might skip some ground details for performance or style
    }

    const cx = Math.floor((cameraX + width/2) / CHUNK_SIZE);
    const cy = Math.floor((cameraY + height/2) / CHUNK_SIZE);
    
    for (let i = cx - 2; i <= cx + 2; i++) {
      for (let j = cy - 2; j <= cy + 2; j++) {
        const seed = (i * 73856093) ^ (j * 19349663);
        
        if (!waveInfo?.isInfinite) {
          // Draw Road Markings
          // Vertical dashed yellow line
          ctx.strokeStyle = 'rgba(200, 160, 0, 0.4)'; // Faded yellow
          ctx.lineWidth = 6;
          ctx.setLineDash([40, 60]); // Dashed line
          ctx.beginPath();
          ctx.moveTo(i * CHUNK_SIZE + CHUNK_SIZE / 2, j * CHUNK_SIZE);
          ctx.lineTo(i * CHUNK_SIZE + CHUNK_SIZE / 2, (j + 1) * CHUNK_SIZE);
          ctx.stroke();
          
          // Horizontal solid white line (crosswalks or lane dividers)
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // Faded white
          ctx.lineWidth = 4;
          ctx.setLineDash([]); // Solid line
          ctx.beginPath();
          ctx.moveTo(i * CHUNK_SIZE, j * CHUNK_SIZE + CHUNK_SIZE / 2);
          ctx.lineTo((i + 1) * CHUNK_SIZE, j * CHUNK_SIZE + CHUNK_SIZE / 2);
          ctx.stroke();
        }

        // Draw ground details (blood, craters, cracks)
        const numDetails = waveInfo?.isInfinite ? 5 : 20;
        for (let k = 0; k < numDetails; k++) {
          const dx = i * CHUNK_SIZE + this.pseudoRandom(seed + k * 20) * CHUNK_SIZE;
          const dy = j * CHUNK_SIZE + this.pseudoRandom(seed + k * 21) * CHUNK_SIZE;
          
          // Only draw if within camera view
          if (dx >= cameraX - 100 && dx <= cameraX + width + 100 &&
              dy >= cameraY - 100 && dy <= cameraY + height + 100) {
            
            const detailType = this.pseudoRandom(seed + k * 23);
            
            if (detailType < 0.3) {
              // Blood stain (Dark red/brown)
              const alpha = 0.1 + this.pseudoRandom(seed + k * 24) * 0.4;
              ctx.fillStyle = `rgba(100, 0, 0, ${alpha})`;
              ctx.beginPath();
              const radius = 10 + this.pseudoRandom(seed + k * 25) * 40;
              ctx.ellipse(dx, dy, radius, radius * (0.4 + this.pseudoRandom(seed + k * 26) * 0.6), this.pseudoRandom(seed + k * 27) * Math.PI, 0, Math.PI * 2);
              ctx.fill();
            } else if (detailType < 0.6) {
              // Crater / Explosion mark
              ctx.fillStyle = waveInfo?.isInfinite ? 'rgba(20, 20, 20, 0.8)' : 'rgba(15, 16, 18, 0.8)';
              const size = 15 + this.pseudoRandom(seed + k * 22) * 30;
              ctx.beginPath();
              ctx.arc(dx, dy, size, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // Asphalt Crack
              ctx.strokeStyle = waveInfo?.isInfinite ? 'rgba(40, 40, 40, 0.8)' : 'rgba(20, 22, 25, 0.8)';
              ctx.lineWidth = 2 + this.pseudoRandom(seed + k * 31) * 3;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.beginPath();
              ctx.moveTo(dx, dy);
              
              let currentX = dx;
              let currentY = dy;
              const segments = 3 + Math.floor(this.pseudoRandom(seed + k * 32) * 5);
              for(let s=0; s<segments; s++) {
                currentX += (this.pseudoRandom(seed + k * 33 + s) - 0.5) * 50;
                currentY += (this.pseudoRandom(seed + k * 34 + s) - 0.5) * 50;
                ctx.lineTo(currentX, currentY);
              }
              ctx.stroke();
            }
          }
        }

        // W8 Mechanism: Earthquake Cracks and Black Liquid
        if (waveInfo?.wave === 8 || (waveInfo?.isInfinite && waveInfo?.activeMechanics.includes('slow_liquid'))) {
          this.drawEarthquakeDetails(ctx, i, j, seed, cameraX, cameraY, width, height);
        }

        const chunk = this.obstacles.get(this.getChunkKey(i, j));
        if (chunk) {
          chunk.forEach(obs => obs.draw(ctx, players));
        }
      }
    }

    // W2 Mechanism: Cloud Shadows
    if (waveInfo?.wave === 2 || (waveInfo?.wave >= 2 && !waveInfo?.isInfinite)) {
      this.drawCloudShadows(ctx, cameraX, cameraY, width, height);
    }
  }

  private drawEarthquakeDetails(ctx: CanvasRenderingContext2D, i: number, j: number, seed: number, cameraX: number, cameraY: number, width: number, height: number) {
    const numCracks = 3;
    for (let k = 0; k < numCracks; k++) {
      const dx = i * CHUNK_SIZE + this.pseudoRandom(seed + k * 50) * CHUNK_SIZE;
      const dy = j * CHUNK_SIZE + this.pseudoRandom(seed + k * 51) * CHUNK_SIZE;

      if (dx >= cameraX - 200 && dx <= cameraX + width + 200 &&
          dy >= cameraY - 200 && dy <= cameraY + height + 200) {
        
        // Large Earthquake Crack
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 15;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        let curX = dx;
        let curY = dy;
        for (let s = 0; s < 8; s++) {
          curX += (this.pseudoRandom(seed + k * 52 + s) - 0.5) * 100;
          curY += (this.pseudoRandom(seed + k * 53 + s) - 0.5) * 100;
          ctx.lineTo(curX, curY);
        }
        ctx.stroke();

        // Black Liquid Eruption
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.beginPath();
        ctx.arc(dx, dy, 40 + this.pseudoRandom(seed + k * 54) * 40, 0, Math.PI * 2);
        ctx.fill();
        
        // Bubbles
        ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
        for (let b = 0; b < 3; b++) {
          ctx.beginPath();
          ctx.arc(dx + (this.pseudoRandom(seed + b) - 0.5) * 40, dy + (this.pseudoRandom(seed + b + 1) - 0.5) * 40, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  private drawCloudShadows(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, width: number, height: number) {
    const time = Date.now() / 10000;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    
    for (let i = 0; i < 3; i++) {
      const ox = (time * (100 + i * 50)) % (width * 2) - width;
      const oy = (time * (50 + i * 30)) % (height * 2) - height;
      
      ctx.beginPath();
      ctx.ellipse(cameraX + width / 2 + ox, cameraY + height / 2 + oy, 400, 250, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
