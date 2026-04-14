// ???? ZombieRenderer.ts ????????????????????????????????????????????????????????????????????????????????????????????????????????????????
// ?曉??????湔??? Zombie.ts ?????
// ????曉???叟▼??城謓?drawZombie() ??case??ombie.ts ??∟??
// ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
import { Zombie } from '../Zombie';
import { getSprite, BUTCHER_FRAME_URLS } from '../sprites/SpriteLoader';

// ???? ??鈭??∵??鞊? ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
// ??? state machine ?閮??鞊???撥? + ???
function getButcherFrameIndex(zombie: Zombie): number {
  const phase = (zombie.extraState.get('phase') ?? 'walk') as string;
  // 5??株都?脣??~4??
  if (phase === 'charging')     return Math.floor(zombie.time / 80)  % 5; // ?寞??賹???
  if (phase === 'slam_windup')  return 4;                                  // ?此??謚??
  if (phase === 'slamming')     return 4;                                  // ??謓菜??
  if (phase === 'pre_charge')   return 0;                                  // ?謕??謚怨翰
  if (phase === 'recovery')     return 0;                                  // ?嚗瑕??謚怨翰
  return Math.floor(zombie.time / 150) % 5;                               // walk?垮??賹???
}

export function drawZombie(zombie: Zombie, ctx: CanvasRenderingContext2D): void {
  // ???? ??鈭?謍???箸慫????????祗 ctx.save ??摰?????????????????????????????????????????????????????????
  if (zombie.type === 'butcher') drawButcherWorldFX(zombie, ctx);
  const isBagCarrier = zombie.extraState.get('bagCarrier') === true;
  const bagRewardValue = Number(zombie.extraState.get('bagRewardValue') ?? 0);

  ctx.save();
  if (zombie.isInsideContainer) ctx.globalAlpha = 0.4;

  let swayX = 0, swayY = 0;
  let rotation = zombie.angle + Math.PI / 2;

  if (zombie.leanBackTimer > 0) rotation -= Math.PI / 4 * (zombie.leanBackTimer / 300);

  if (zombie.type === 'big') {
    swayX = Math.sin(zombie.time / 400) * 3;
    swayY = Math.abs(Math.cos(zombie.time / 400)) * 2;
    rotation += Math.sin(zombie.time / 400) * 0.15;
  } else if (zombie.type === 'slime' || zombie.type === 'slime_small') {
    swayX = Math.sin(zombie.time / 150) * 2;
    swayY = Math.cos(zombie.time / 150) * 2;
  } else if (zombie.type === 'ghost') {
    swayX = Math.sin(zombie.time / 180) * 2.2;
    swayY = Math.cos(zombie.time / 220) * 3.5;
  } else if (zombie.type === 'butcher') {
    swayX = Math.sin(zombie.time / 600) * 2;
    swayY = Math.abs(Math.cos(zombie.time / 600)) * 1.5;
    // ???謘??蹓潸縣?嚗??????謇唾?擗??摮????
  } else {
    swayX = Math.sin(zombie.time / 100) * 1;
    swayY = Math.cos(zombie.time / 100) * 1;
  }

  ctx.translate(zombie.x + swayX, zombie.y + swayY);
  if (zombie.type !== 'butcher') ctx.rotate(rotation);

  if (zombie.type === 'big') {
    const bounce = Math.abs(Math.sin(zombie.time / 400));
    ctx.scale(1 + bounce * 0.08, 1 - bounce * 0.05);
  } else if (zombie.type === 'slime' || zombie.type === 'slime_small') {
    ctx.scale(1 + Math.sin(zombie.jellyPhase) * 0.15, 1 + Math.cos(zombie.jellyPhase) * 0.15);
  } else if (zombie.type === 'butcher') {
    const bounce = Math.abs(Math.sin(zombie.time / 600));
    ctx.scale(1 + bounce * 0.05, 1 - bounce * 0.04);
  }

  // Shadow
  ctx.beginPath(); ctx.arc(4, 6, zombie.radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill(); ctx.closePath();

  // ???? ??? ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  if (zombie.type === 'big') {
    const armSwing = Math.sin(zombie.time / 400) * 15;
    ctx.fillStyle = '#144d18'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-zombie.radius + 2, 5 + armSwing, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(zombie.radius - 2,  5 - armSwing, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // ???? ??? ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  if (zombie.type === 'butcher') {
    // ???? ???謖?5???∵?????????????????????????????????????????????????????????????????????????????????????????????????????
    const frameIdx = getButcherFrameIndex(zombie);
    const sprite   = getSprite(BUTCHER_FRAME_URLS[frameIdx]);
    const isEnraged = zombie.hp / zombie.maxHp < 0.3;

    if (isEnraged) {
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur  = 18 + Math.sin(zombie.time / 80) * 8;
    }
    if (zombie.flashWhiteTimer > 0) {
      ctx.filter = 'brightness(10)';
    }

    if (sprite) {
      const size = zombie.radius * 3.2;           // ???輯??扳?蝞?
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    } else {
      // ???垮謓舫????蹇? fallback????蟡???亥血??
      ctx.beginPath(); ctx.arc(0, 0, zombie.radius, 0, Math.PI * 2);
      ctx.fillStyle = zombie.flashWhiteTimer > 0 ? '#ffffff' : '#8b0000';
      ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
  } else {
    if (zombie.type !== 'normal') {
      ctx.beginPath(); ctx.arc(0, 0, zombie.radius, 0, Math.PI * 2);
      if      (zombie.type === 'big')         ctx.fillStyle = '#1b5e20';
      else if (zombie.type === 'slime')       ctx.fillStyle = '#8bc34a';
      else if (zombie.type === 'slime_small') ctx.fillStyle = '#7cb342';
      else if (zombie.type === 'spitter')     ctx.fillStyle = '#9c27b0';
      else                                    ctx.fillStyle = '#4caf50';
      if (zombie.flashWhiteTimer > 0) ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000'; ctx.stroke(); ctx.closePath();
      ctx.shadowBlur = 0;
    }

    // ???? ??改貉??? ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
    if (zombie.type === 'normal') {
      const walkCycle = Math.sin(zombie.time / 150);
      // ???
      ctx.fillStyle = zombie.flashWhiteTimer > 0 ? '#ffffff' : (isBagCarrier ? '#f1e4c6' : '#e0e0ce');
      ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-zombie.radius * 0.7, -zombie.radius * 0.9, zombie.radius * 1.4, zombie.radius * 1.2, 4);
      ctx.fill(); ctx.stroke();
      // ?瞏?
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(-zombie.radius * 0.3, -zombie.radius * 0.4, 2.5, 0, Math.PI * 2);
      ctx.arc(zombie.radius * 0.3,  -zombie.radius * 0.4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // ???????謚?
      ctx.fillStyle = '#ff0000';
      ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(-zombie.radius * 0.3, -zombie.radius * 0.4, 1, 0, Math.PI * 2);
      ctx.arc(zombie.radius * 0.3,  -zombie.radius * 0.4, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // ?謕??格??
      ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(i * 2, 0); ctx.lineTo(i * 2, 4); ctx.stroke();
      }
      // ?????
      const armSwing = walkCycle * 5;
      ctx.fillStyle = isBagCarrier ? '#f1e4c6' : '#e0e0ce'; ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(-zombie.radius * 0.9,  armSwing, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc( zombie.radius * 0.9, -armSwing, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (zombie.type === 'big') {
      ctx.fillStyle = '#8bc34a';
      ctx.beginPath(); ctx.arc(-12,-15,4,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(12,-15,4,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-22,-2); ctx.lineTo(18,12); ctx.stroke();
      for(let i=0;i<6;i++){const t=(i+1)/7;const sx=-22+40*t;const sy=-2+14*t;ctx.beginPath();ctx.moveTo(sx-5,sy+5);ctx.lineTo(sx+5,sy-5);ctx.stroke();}
      ctx.fillStyle = '#9e9e9e'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(-zombie.radius-4,-5,8,10); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(zombie.radius-4,-5,8,10); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10,-22); ctx.lineTo(10,-22); ctx.lineTo(8,-26); ctx.lineTo(-8,-26); ctx.closePath();
      ctx.fillStyle = '#111'; ctx.fill(); ctx.stroke();
    } else if (zombie.type === 'spitter') {
      ctx.fillStyle = '#8bc34a';
      ctx.beginPath(); ctx.arc(-5,-5,3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(6,2,4,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(-2,6,2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#00ff00';
      ctx.beginPath(); ctx.arc(-6,-10,2.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(6,-10,2.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0,-15,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8bc34a'; ctx.beginPath(); ctx.arc(0,-15,2,0,Math.PI*2); ctx.fill();
    } else if (zombie.type === 'ghost') {
      const bob = Math.sin(zombie.time / 180) * 2.5;
      const blink = Math.sin(zombie.time / 520) * 0.5 + 0.5;
      const bodyColor = zombie.flashWhiteTimer > 0 ? '#ffffff' : '#f5f3ff';
      ctx.shadowColor = 'rgba(147, 51, 234, 0.24)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = bodyColor;
      ctx.strokeStyle = '#312e81';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -18 + bob);
      ctx.bezierCurveTo(11, -18 + bob, 15, -10 + bob, 15, -1 + bob);
      ctx.bezierCurveTo(15, 9 + bob, 10, 15 + bob, 5, 18 + bob);
      ctx.quadraticCurveTo(2, 12 + bob, -1, 18 + bob);
      ctx.quadraticCurveTo(-5, 12 + bob, -8, 18 + bob);
      ctx.quadraticCurveTo(-12, 12 + bob, -15, 18 + bob);
      ctx.bezierCurveTo(-17, 10 + bob, -15, 1 + bob, -14, -4 + bob);
      ctx.bezierCurveTo(-13, -13 + bob, -9, -18 + bob, 0, -18 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(-4, -10 + bob, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111827';
      ctx.beginPath(); ctx.ellipse(-4, -10 + bob, 2.8, 4.6 - blink * 1.2, 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5, -8 + bob, 2.2, 3.8 - blink, -0.18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-1, -2 + bob); ctx.quadraticCurveTo(3, 1 + bob, 7, -1 + bob); ctx.stroke();
      ctx.fillStyle = '#f472b6';
      ctx.beginPath(); ctx.arc(8, 2 + bob, 1.8, 0, Math.PI * 2); ctx.fill();
      if (zombie.isSummoned && zombie.time < 900) {
        const alpha = 1 - zombie.time / 900;
        ctx.strokeStyle = 'rgba(168,85,247,' + (alpha * 0.75) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 6, 18 - zombie.time / 90, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(96,165,250,' + (alpha * 0.45) + ')';
        ctx.beginPath(); ctx.arc(0, 6, 24 - zombie.time / 70, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (zombie.type === 'slime' || zombie.type === 'slime_small') {
      ctx.fillStyle = '#33691e';
      ctx.beginPath(); ctx.arc(-4,-4,2,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(4,-4,2,0,Math.PI*2); ctx.fill();
    }

    if (isBagCarrier) {
      ctx.save();
      ctx.rotate(-0.25);
      ctx.fillStyle = '#8b5a2b';
      ctx.strokeStyle = '#2f1b0c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(5, -2);
      ctx.quadraticCurveTo(12, -10, 14, -2);
      ctx.quadraticCurveTo(16, 8, 8, 11);
      ctx.quadraticCurveTo(0, 8, 1, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(5, -2);
      ctx.quadraticCurveTo(9, -7, 12, -2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, -zombie.radius - 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = 'bold 8px Courier';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.max(1, bagRewardValue)), 0, -zombie.radius - 8);
    }
  }

  ctx.restore();

  // ???? HP Bar?????箸慫???????????????????????????????????????????????????????????????????????????????????????????????????????????
  const hpRatio = Math.max(0, zombie.hp / zombie.maxHp);
  const bw = zombie.type === 'butcher' ? zombie.radius * 2.5 : zombie.radius * 2;
  const bh = zombie.type === 'big' || zombie.type === 'butcher' ? 5 : 3;
  const isEnraged = zombie.type === 'butcher' && hpRatio < 0.3;
  ctx.fillStyle = 'red';
  ctx.fillRect(zombie.x - bw/2, zombie.y - zombie.radius - 10, bw, bh);
  ctx.fillStyle = isEnraged ? '#ff6600' : 'green';
  ctx.fillRect(zombie.x - bw/2, zombie.y - zombie.radius - 10, bw * hpRatio, bh);
}

// ???? ??鈭?謘??冽??撖?????????+ ?蛔?????????????????????????????????????????????????????????????????????????????
function drawButcherWorldFX(zombie: Zombie, ctx: CanvasRenderingContext2D): void {
  const phase      = (zombie.extraState.get('phase')      ?? 'walk') as string;
  const chargeDX   = (zombie.extraState.get('chargeDX')   ?? 0)      as number;
  const chargeDY   = (zombie.extraState.get('chargeDY')   ?? 0)      as number;
  const slamRadius = (zombie.extraState.get('slamRadius') ?? 0)      as number;

  if (phase === 'pre_charge' && (chargeDX !== 0 || chargeDY !== 0)) {
    const flash = (Math.sin(zombie.time / 80) * 0.5 + 0.5) * 0.85;
    ctx.save();
    ctx.globalAlpha = flash;
    ctx.strokeStyle = '#ff1a1a';
    ctx.lineWidth = 8;
    ctx.setLineDash([12, 6]);
    ctx.beginPath();
    ctx.moveTo(zombie.x, zombie.y);
    ctx.lineTo(zombie.x + chargeDX * 480, zombie.y + chargeDY * 480);
    ctx.stroke();
    ctx.setLineDash([]);
    // ??赯行?謘曉
    const tipX = zombie.x + chargeDX * 480;
    const tipY = zombie.y + chargeDY * 480;
    ctx.fillStyle = '#ff1a1a';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - chargeDX * 20 + (-chargeDY) * 10, tipY - chargeDY * 20 + chargeDX * 10);
    ctx.lineTo(tipX - chargeDX * 20 - (-chargeDY) * 10, tipY - chargeDY * 20 - chargeDX * 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (phase === 'slamming' && slamRadius > 0) {
    const progress = slamRadius / 180;
    ctx.save();
    ctx.globalAlpha = (1 - progress) * 0.65;
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 6 * (1 - progress * 0.6);
    ctx.beginPath();
    ctx.arc(zombie.x, zombie.y, slamRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = (1 - progress) * 0.1;
    ctx.fillStyle = '#ff4444';
    ctx.fill();
    ctx.restore();
  }
}
