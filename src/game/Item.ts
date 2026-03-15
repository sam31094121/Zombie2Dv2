export type ItemType = 'weapon_sword' | 'weapon_gun' | 'speed' | 'shield' | 'energy_orb';

export class Item {
  x: number;
  y: number;
  type: ItemType;
  radius: number = 15;
  lifetime: number;
  value?: number;
  color?: string;
  spawnTime: number;
  initialX: number;
  initialY: number;

  constructor(x: number, y: number, type: ItemType, lifetime: number, value?: number, color?: string) {
    this.x = x;
    this.y = y;
    this.initialX = x;
    this.initialY = y;
    this.spawnTime = Date.now();
    this.type = type;
    this.lifetime = lifetime;
    this.value = value;
    this.color = color;
    if (type === 'energy_orb') {
      this.radius = value && value > 2 ? 12 : 8;
    }
  }

  update(dt: number) {
    this.lifetime -= dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const time = Date.now() / 200;
    const bobOffset = Math.sin(time) * 4;
    
    ctx.save();
    ctx.translate(this.x, this.y + bobOffset);

    if (this.type === 'energy_orb') {
      // Draw glowing energy orb
      const baseColor = this.color || '#00bcd4';
      
      // Outer glow
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * 2);
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(0.2, baseColor);
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Inner core
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      
      // Floating particles around orb
      for(let i=0; i<3; i++) {
         const angle = time * 2 + (i * Math.PI * 2 / 3);
         const px = Math.cos(angle) * this.radius * 1.2;
         const py = Math.sin(angle) * this.radius * 1.2;
         ctx.fillStyle = baseColor;
         ctx.beginPath();
         ctx.arc(px, py, 2, 0, Math.PI * 2);
         ctx.fill();
      }
    } else {
      // Draw shadow for physical items
      ctx.beginPath();
      ctx.ellipse(0, 15 - bobOffset, this.radius, this.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fill();

      // Draw Item Background Glow
      let glowColor = '';
      if (this.type === 'weapon_sword') glowColor = 'rgba(200, 200, 200, 0.5)';
      if (this.type === 'weapon_gun') glowColor = 'rgba(255, 150, 0, 0.5)';
      if (this.type === 'speed') glowColor = 'rgba(0, 255, 255, 0.5)';
      if (this.type === 'shield') glowColor = 'rgba(0, 100, 255, 0.5)';
      
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 15;

      if (this.type === 'weapon_sword') {
        // Realistic Sword Drop
        ctx.rotate(Math.PI / 4);
        
        // Blade
        ctx.fillStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(4, -10);
        ctx.lineTo(4, 10);
        ctx.lineTo(-4, 10);
        ctx.lineTo(-4, -10);
        ctx.fill();
        
        // Blade edge highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(2, -10);
        ctx.lineTo(2, 10);
        ctx.lineTo(0, 10);
        ctx.fill();

        // Crossguard
        ctx.fillStyle = '#d4af37'; // Gold
        ctx.fillRect(-8, 10, 16, 4);
        
        // Handle
        ctx.fillStyle = '#5d4037'; // Brown leather
        ctx.fillRect(-3, 14, 6, 10);
        
        // Pommel
        ctx.fillStyle = '#d4af37';
        ctx.beginPath();
        ctx.arc(0, 25, 4, 0, Math.PI * 2);
        ctx.fill();

      } else if (this.type === 'weapon_gun') {
        // Realistic Gun Drop
        ctx.fillStyle = '#2a2a2a'; // Dark metal
        
        // Barrel
        ctx.fillRect(0, -5, 18, 6);
        // Body
        ctx.fillRect(-10, -5, 10, 8);
        // Grip
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.moveTo(-8, 3);
        ctx.lineTo(-2, 3);
        ctx.lineTo(-4, 12);
        ctx.lineTo(-10, 12);
        ctx.fill();
        
        // Highlights
        ctx.fillStyle = '#555';
        ctx.fillRect(2, -4, 15, 2); // Barrel highlight
        ctx.fillStyle = '#888';
        ctx.fillRect(-8, -3, 6, 2); // Slide highlight

      } else if (this.type === 'speed') {
        // Energy Drink / Speed Potion
        // Flask body
        ctx.fillStyle = '#00e5ff'; // Cyan liquid
        ctx.beginPath();
        ctx.moveTo(-6, -5);
        ctx.lineTo(6, -5);
        ctx.lineTo(10, 12);
        ctx.lineTo(-10, 12);
        ctx.fill();
        
        // Glass reflection
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(-4, -5);
        ctx.lineTo(-2, -5);
        ctx.lineTo(-6, 10);
        ctx.lineTo(-8, 10);
        ctx.fill();

        // Neck & Cork
        ctx.fillStyle = '#e0e0e0'; // Glass neck
        ctx.fillRect(-4, -12, 8, 7);
        ctx.fillStyle = '#8d6e63'; // Cork
        ctx.fillRect(-3, -16, 6, 4);

      } else if (this.type === 'shield') {
        // High-tech Shield Generator / Armor Plate
        ctx.fillStyle = '#1976d2'; // Blue metal
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(12, -4);
        ctx.lineTo(10, 10);
        ctx.lineTo(0, 16);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-12, -4);
        ctx.fill();
        
        // Inner glowing core
        ctx.fillStyle = '#64b5f6';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(6, -1);
        ctx.lineTo(5, 6);
        ctx.lineTo(0, 10);
        ctx.lineTo(-5, 6);
        ctx.lineTo(-6, -1);
        ctx.fill();
        
        // Center light
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
