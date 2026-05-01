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
    if (item.type === 'magnet')       glowColor = 'rgba(255,50,50,0.5)';
    if (item.type === 'apple')        glowColor = 'rgba(255,80,80,0.45)';
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
      // ── 沙漠之鷹 (Desert Eagle) 帶局部木頭握把/護木 ──
      
      // 上機匣與巨型滑套 (深邃銀灰/鐵灰)
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(-8, -6, 20, 8); // 寬大的滑套
      
      // 滑套前端的特色倒角與槍口 (更亮的銀色凸顯金屬感)
      ctx.fillStyle = '#9ca3af';
      ctx.beginPath();
      ctx.moveTo(12, -6);
      ctx.lineTo(16, -2);
      ctx.lineTo(16, 2);
      ctx.lineTo(12, 2);
      ctx.fill();

      // 滑套上方的溝槽細節 (深色縫隙)
      ctx.fillStyle = '#374151';
      ctx.fillRect(-2, -6, 2, 8);
      ctx.fillRect(4, -6, 2, 8);

      // 下機匣與扳機護弓 (純黑戰術色)
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-6, 2, 14, 3);
      ctx.beginPath();
      ctx.moveTo(-1, 5);
      ctx.lineTo(3, 5);
      ctx.lineTo(3, 10);
      ctx.lineTo(1, 10);
      ctx.fill();

      // 沙漠之鷹招牌的粗壯握把 (包含木紋色護木)
      ctx.fillStyle = '#8B5A2B'; // 胡桃木色
      ctx.beginPath();
      ctx.moveTo(-6, 3);
      ctx.lineTo(0, 3);
      ctx.lineTo(-2, 14);
      ctx.lineTo(-8, 14);
      ctx.fill();

      // 握把上的防滑刻紋 (深色木紋)
      ctx.fillStyle = '#5C3A21';
      ctx.beginPath();
      ctx.moveTo(-5, 5); ctx.lineTo(-1, 5);
      ctx.moveTo(-5.5, 8); ctx.lineTo(-1.5, 8);
      ctx.moveTo(-6, 11); ctx.lineTo(-2, 11);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#5C3A21';
      ctx.stroke();

      // 準星與照門
      ctx.fillStyle = '#111827';
      ctx.fillRect(10, -8, 2, 2); // 準星
      ctx.fillRect(-6, -8, 3, 2); // 照門

    } else if (item.type === 'speed') {
      // 跑步鞋造型 (螢光動感)
      ctx.fillStyle = '#00e5ff'; // 鞋身
      ctx.beginPath();
      ctx.moveTo(-10, -2);
      ctx.quadraticCurveTo(-6, -8, 2, -4);
      ctx.lineTo(8, -2);
      ctx.quadraticCurveTo(14, 0, 14, 6);
      ctx.lineTo(-12, 6);
      ctx.quadraticCurveTo(-14, 2, -10, -2);
      ctx.fill();

      // 鞋底細節
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-12, 6, 24, 3);
      
      // 閃電 Swoosh 裝飾
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(-6, 2);
      ctx.lineTo(2, 2);
      ctx.lineTo(-2, 6);
      ctx.lineTo(8, -2);
      ctx.lineTo(0, -2);
      ctx.lineTo(4, -6);
      ctx.fill();

    } else if (item.type === 'shield') {
      ctx.fillStyle = '#1976d2';
      ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(12,-4); ctx.lineTo(10,10); ctx.lineTo(0,16); ctx.lineTo(-10,10); ctx.lineTo(-12,-4); ctx.fill();
      ctx.fillStyle = '#64b5f6';
      ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(6,-1); ctx.lineTo(5,6); ctx.lineTo(0,10); ctx.lineTo(-5,6); ctx.lineTo(-6,-1); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0,2,3,0,Math.PI*2); ctx.fill();
    } else if (item.type === 'magnet') {
      ctx.fillStyle = '#e53935'; // Red body
      ctx.beginPath();
      ctx.arc(0, -6, 12, Math.PI, 0); // Outer curve
      ctx.lineTo(12, 6);
      ctx.lineTo(6, 6);
      ctx.lineTo(6, -6);
      ctx.arc(0, -6, 6, 0, Math.PI, true); // Inner curve
      ctx.lineTo(-6, 6);
      ctx.lineTo(-12, 6);
      ctx.closePath();
      ctx.fill();

      // Silver tips
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(-12, 6, 6, 6);
      ctx.fillRect(6, 6, 6, 6);
      
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(0, -6, 9, Math.PI, 0);
      ctx.lineTo(9,-6);
      ctx.arc(0, -6, 3, 0, Math.PI, true);
      ctx.closePath();
      ctx.fill();
    } else if (item.type === 'apple') {
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(-4, 1, 8, 0, Math.PI * 2);
      ctx.arc(4, 1, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-3, -1, 6, 0, Math.PI * 2);
      ctx.arc(3, -1, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(-5, -4, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#5b3a29';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.quadraticCurveTo(1, -14, 4, -16);
      ctx.stroke();

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(7, -11, 5, 3, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── 新增：繪製拾取蓄力進度條 (Progress Ring) ──
  if (item.pickupProgress && item.pickupProgress > 0) {
    ctx.shadowBlur = 0; // 關閉發光避免模糊進度條
    const progress = Math.min(item.pickupProgress / 3000, 1);
    const radius = item.radius * 1.5;

    // 背景淺色圓環
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 蓄力進度實心環 (綠色/黃色漸變)
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.strokeStyle = progress > 0.8 ? '#4ade80' : '#facc15'; // 末端變綠色
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  ctx.restore();
}
