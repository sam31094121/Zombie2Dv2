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
    const baseColor = item.color || '#00bcd4';
    const gradient = ctx.createRadialGradient(0,0,0,0,0,item.radius*2);
    gradient.addColorStop(0, 'white'); gradient.addColorStop(0.2, baseColor); gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0,0,item.radius*2.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(0,0,item.radius*0.4,0,Math.PI*2); ctx.fill();
    for(let i=0;i<3;i++){
      const a=time*2+(i*Math.PI*2/3);
      const px=Math.cos(a)*item.radius*1.2; const py=Math.sin(a)*item.radius*1.2;
      ctx.fillStyle=baseColor; ctx.beginPath(); ctx.arc(px,py,2,0,Math.PI*2); ctx.fill();
    }
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
