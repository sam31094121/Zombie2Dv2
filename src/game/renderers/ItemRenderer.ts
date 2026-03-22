// ── ItemRenderer.ts ──────────────────────────────────────────────────────────
// 道具繪圖邏輯（從 Item.ts 分離）
// 新增道具外觀：在 drawItem() 加 case，Item.ts 零修改
// ─────────────────────────────────────────────────────────────────────────────
import { Item } from '../Item';

export function drawItem(item: Item, ctx: CanvasRenderingContext2D): void {
  const time = Date.now() / 200;
  const bobOffset = Math.sin(time) * 4;

  ctx.save();
  ctx.translate(item.x, item.y + bobOffset);

  if (item.type === 'energy_orb') {
    const baseColor = item.color || '#fbbf24';
    
    // Hand-drawn sketch style coin
    ctx.fillStyle = baseColor;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        // Deterministic irregular edge based on spawnTime
        const wobble = Math.sin(i * 15.3 + item.spawnTime) * 0.15;
        const r = item.radius * (0.95 + wobble);
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner symbol "Z"
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = `bold ${Math.floor(item.radius * 1.2)}px Courier`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Z', 0, 0);

    // Gleam
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(-item.radius * 0.35, -item.radius * 0.35, item.radius * 0.15, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Shadow
    ctx.beginPath(); ctx.ellipse(0, 15-bobOffset, item.radius, item.radius*0.4, 0, 0, Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fill();

    let glowColor = '';
    if (item.type === 'weapon_sword') glowColor = 'rgba(200,200,200,0.5)';
    if (item.type === 'weapon_gun')   glowColor = 'rgba(255,150,0,0.5)';
    if (item.type === 'speed')        glowColor = 'rgba(0,255,255,0.5)';
    if (item.type === 'shield')       glowColor = 'rgba(0,100,255,0.5)';
    ctx.shadowColor = glowColor; ctx.shadowBlur = 15;

    if (item.type === 'weapon_sword') {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#e0e0e0';
      ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(4,-10); ctx.lineTo(4,10); ctx.lineTo(-4,10); ctx.lineTo(-4,-10); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(2,-10); ctx.lineTo(2,10); ctx.lineTo(0,10); ctx.fill();
      ctx.fillStyle = '#d4af37'; ctx.fillRect(-8,10,16,4);
      ctx.fillStyle = '#5d4037'; ctx.fillRect(-3,14,6,10);
      ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(0,25,4,0,Math.PI*2); ctx.fill();

    } else if (item.type === 'weapon_gun') {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0,-5,18,6); ctx.fillRect(-10,-5,10,8);
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.moveTo(-8,3); ctx.lineTo(-2,3); ctx.lineTo(-4,12); ctx.lineTo(-10,12); ctx.fill();
      ctx.fillStyle = '#555'; ctx.fillRect(2,-4,15,2);
      ctx.fillStyle = '#888'; ctx.fillRect(-8,-3,6,2);

    } else if (item.type === 'speed') {
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath(); ctx.moveTo(-6,-5); ctx.lineTo(6,-5); ctx.lineTo(10,12); ctx.lineTo(-10,12); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.moveTo(-4,-5); ctx.lineTo(-2,-5); ctx.lineTo(-6,10); ctx.lineTo(-8,10); ctx.fill();
      ctx.fillStyle = '#e0e0e0'; ctx.fillRect(-4,-12,8,7);
      ctx.fillStyle = '#8d6e63'; ctx.fillRect(-3,-16,6,4);

    } else if (item.type === 'shield') {
      ctx.fillStyle = '#1976d2';
      ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(12,-4); ctx.lineTo(10,10); ctx.lineTo(0,16); ctx.lineTo(-10,10); ctx.lineTo(-12,-4); ctx.fill();
      ctx.fillStyle = '#64b5f6';
      ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(6,-1); ctx.lineTo(5,6); ctx.lineTo(0,10); ctx.lineTo(-5,6); ctx.lineTo(-6,-1); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0,2,3,0,Math.PI*2); ctx.fill();
    }
  }

  ctx.restore();
}
