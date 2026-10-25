// Textures procédurales (canvas 2D) pour l'arène : béton, briques écaillées, toile du ring, etc.
import * as THREE from 'three';

function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function canvasTexture(size, draw, { srgb = true, repeat = [1, 1] } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function noise(ctx, s, r, amount, alpha = 1) {
  const img = ctx.getImageData(0, 0, s, s);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}
function blotches(ctx, s, r, n, color, rmin, rmax, alpha) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * (0.3 + r() * 0.7);
    ctx.beginPath();
    const x = r() * s, y = r() * s, rad = rmin + r() * (rmax - rmin);
    ctx.ellipse(x, y, rad, rad * (0.5 + r()), r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function cracks(ctx, s, r, n, color, width = 1.5) {
  ctx.strokeStyle = color;
  for (let i = 0; i < n; i++) {
    ctx.lineWidth = width * (0.5 + r());
    ctx.globalAlpha = 0.5 + r() * 0.5;
    ctx.beginPath();
    let x = r() * s, y = r() * s, a = r() * Math.PI * 2;
    ctx.moveTo(x, y);
    const len = 10 + r() * 40;
    for (let k = 0; k < len; k++) {
      a += (r() - 0.5) * 0.9;
      x += Math.cos(a) * 4; y += Math.sin(a) * 4;
      ctx.lineTo(x, y);
      if (r() < 0.04) { ctx.moveTo(x, y); a += (r() - 0.5) * 2; }
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function concreteTextures() {
  const r = rnd(7);
  const map = canvasTexture(1024, (ctx, s) => {
    ctx.fillStyle = '#5b5852'; ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, r, 400, '#3e3b36', 10, 80, 0.12);
    blotches(ctx, s, r, 200, '#77736a', 10, 60, 0.08);
    blotches(ctx, s, r, 40, '#2a2620', 30, 140, 0.15); // taches d'huile / humidité
    // joints de dalles
    ctx.strokeStyle = '#2b2925'; ctx.lineWidth = 3; ctx.globalAlpha = 0.6;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * s / 4, 0); ctx.lineTo(i * s / 4, s); ctx.moveTo(0, i * s / 4); ctx.lineTo(s, i * s / 4); ctx.stroke(); }
    ctx.globalAlpha = 1;
    cracks(ctx, s, r, 30, '#1f1d1a', 1.6);
    noise(ctx, s, r, 26);
  }, { repeat: [6, 6] });
  const rough = canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#d0d0d0'; ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, r, 60, '#5a5a5a', 10, 60, 0.4); // zones lisses / humides
    noise(ctx, s, r, 40);
  }, { srgb: false, repeat: [6, 6] });
  return { map, roughnessMap: rough };
}

export function wallTextures() {
  const r = rnd(11);
  const map = canvasTexture(1024, (ctx, s) => {
    // briques
    ctx.fillStyle = '#3a2a22'; ctx.fillRect(0, 0, s, s);
    const bw = 64, bh = 28;
    for (let y = 0; y < s; y += bh) {
      const off = (y / bh) % 2 ? bw / 2 : 0;
      for (let x = -bw; x < s + bw; x += bw) {
        const c = 70 + r() * 40;
        ctx.fillStyle = `rgb(${c + 25},${c * 0.55},${c * 0.4})`;
        ctx.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
      }
    }
    // peinture écaillée (vert délavé) par-dessus
    ctx.fillStyle = '#4f5b4c';
    ctx.globalAlpha = 0.92;
    ctx.fillRect(0, 0, s, s * 0.62);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 70; i++) {
      ctx.beginPath();
      const x = r() * s, y = r() * s * 0.65, rad = 8 + r() * 60;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, rr = rad * (0.5 + r() * 0.8);
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
      }
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // bande basse sombre + coulures
    ctx.fillStyle = '#2a2f29'; ctx.globalAlpha = 0.85; ctx.fillRect(0, s * 0.62, s, 18); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#1b1712';
    for (let i = 0; i < 80; i++) {
      ctx.globalAlpha = 0.1 + r() * 0.25; ctx.lineWidth = 1 + r() * 4;
      const x = r() * s, y = r() * s * 0.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 6, y + 40 + r() * 300); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    blotches(ctx, s, r, 60, '#14110d', 20, 120, 0.18);
    noise(ctx, s, r, 30);
  }, { repeat: [4, 1] });
  return { map };
}

export function canvasMatTexture() {
  const r = rnd(23);
  return canvasTexture(1024, (ctx, s) => {
    ctx.fillStyle = '#b9b2a2'; ctx.fillRect(0, 0, s, s);
    // trame de toile
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < s; i += 3) { ctx.fillStyle = i % 6 ? '#000' : '#fff'; ctx.fillRect(i, 0, 1, s); ctx.fillRect(0, i, s, 1); }
    ctx.globalAlpha = 1;
    // usure au centre + traces de pas
    const g = ctx.createRadialGradient(s / 2, s / 2, 30, s / 2, s / 2, s * 0.55);
    g.addColorStop(0, 'rgba(70,60,45,0.35)'); g.addColorStop(1, 'rgba(70,60,45,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, r, 300, '#6f6555', 4, 30, 0.12);
    // logo délavé
    ctx.save(); ctx.translate(s / 2, s / 2); ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#7a1414'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, 0, 190, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#7a1414'; ctx.font = 'bold 120px Impact, Arial Black, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('IRON', 0, -55); ctx.fillText('PIT', 0, 70);
    ctx.restore(); ctx.globalAlpha = 1;
    // taches de sang séché / sueur
    blotches(ctx, s, r, 26, '#4a0d0a', 3, 14, 0.5);
    blotches(ctx, s, r, 40, '#3c3226', 10, 50, 0.15);
    // coins teintés
    const corner = (x, y, col) => { const gg = ctx.createRadialGradient(x, y, 0, x, y, 120); gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.fillRect(0, 0, s, s); };
    corner(0, 0, 'rgba(60,40,30,0.4)'); corner(s, s, 'rgba(60,40,30,0.4)');
    noise(ctx, s, r, 18);
  });
}

export function apronTexture() {
  const r = rnd(5);
  return canvasTexture(1024, (ctx, s) => {
    ctx.fillStyle = '#1a1a1d'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#8c1418'; ctx.fillRect(0, s * 0.1, s, s * 0.08);
    ctx.fillStyle = '#d8d0c0'; ctx.font = 'bold 150px Impact, Arial Black, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.75; ctx.fillText('IRON PIT', s / 2, s * 0.55); ctx.globalAlpha = 1;
    blotches(ctx, s, r, 200, '#000', 4, 40, 0.2);
    blotches(ctx, s, r, 80, '#555', 2, 18, 0.12);
    noise(ctx, s, r, 20);
  });
}

export function posterTexture(title, sub, hue) {
  const r = rnd(title.length * 31);
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = `hsl(${hue},45%,62%)`; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#111'; ctx.font = 'bold 86px Impact, Arial Black, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, s / 2, 120);
    ctx.font = 'bold 40px Arial'; ctx.fillText(sub, s / 2, 190);
    ctx.fillStyle = '#222'; ctx.fillRect(s * 0.2, 230, s * 0.25, 220); ctx.fillRect(s * 0.55, 230, s * 0.25, 220);
    ctx.globalCompositeOperation = 'multiply';
    blotches(ctx, s, r, 60, '#8a7a5a', 10, 80, 0.5);
    ctx.globalCompositeOperation = 'source-over';
    noise(ctx, s, r, 40);
  });
}

export function neonTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1024, 256);
  ctx.font = 'bold 170px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = 30;
  ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.strokeText(text, 512, 135);
  ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeText(text, 512, 135);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
