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

// Mur bas : parpaings peints (vert-gris délavé) écaillés, plinthe crasseuse, fissures, tags.
// Canvas 1024×512 = 6 m × 3 m.
export function wallLowerTexture() {
  const r = rnd(11);
  return canvasTexture(1024, (ctx, s) => {
    const H = s / 2;
    ctx.fillStyle = '#4a4a44'; ctx.fillRect(0, 0, s, H);
    const bw = 68, bh = 34;
    for (let y = 0; y < H; y += bh) {
      const off = (y / bh) % 2 ? bw / 2 : 0;
      for (let x = -bw; x < s + bw; x += bw) {
        const c = 88 + r() * 22;
        ctx.fillStyle = `rgb(${c},${c * 0.98},${c * 0.92})`;
        ctx.fillRect(x + off + 1.5, y + 1.5, bw - 3, bh - 3);
      }
    }
    // peinture vert-gris par-dessus (2/3 haut), puis écaillage
    ctx.fillStyle = '#56685c'; ctx.globalAlpha = 0.88; ctx.fillRect(0, 0, s, H * 0.78); ctx.globalAlpha = 1;
    // bande de couleur (ancienne salle de sport)
    ctx.fillStyle = '#6e1f1a'; ctx.globalAlpha = 0.8; ctx.fillRect(0, H * 0.70, s, H * 0.06); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 90; i++) {
      ctx.beginPath();
      const x = r() * s, y = r() * H * 0.8, rad = 4 + r() * 38;
      for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, rr = rad * (0.4 + r() * 0.9); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7); }
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#3d3a34'; ctx.fillRect(0, 0, s, H);
    ctx.globalCompositeOperation = 'source-over';
    // plinthe sombre + remontées d'humidité
    const g = ctx.createLinearGradient(0, H, 0, H * 0.72);
    g.addColorStop(0, 'rgba(18,15,12,0.92)'); g.addColorStop(0.25, 'rgba(25,22,18,0.6)'); g.addColorStop(1, 'rgba(25,22,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.6, s, H * 0.4);
    // traces de chaises / chocs
    blotches(ctx, s, r, 50, '#1a1612', 6, 40, 0.22);
    cracks(ctx, s, r, 18, '#141210', 1.3);
    // coulures de rouille
    ctx.strokeStyle = '#5a3418';
    for (let i = 0; i < 40; i++) { ctx.globalAlpha = 0.08 + r() * 0.2; ctx.lineWidth = 1 + r() * 3; const x = r() * s, y = r() * H * 0.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 4, y + 30 + r() * 150); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // tags délavés
    const tags = ['KO', 'RIP DANNY', '79', 'NO REFS', 'PIT'];
    ctx.font = 'bold 60px Impact, Arial Black, sans-serif';
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.translate(80 + r() * (s - 160), H * 0.35 + r() * H * 0.3); ctx.rotate((r() - 0.5) * 0.4);
      ctx.globalAlpha = 0.18 + r() * 0.2; ctx.fillStyle = ['#c8c0b0', '#a02020', '#2050a0', '#d0b020'][i % 4];
      ctx.fillText(tags[Math.floor(r() * tags.length)], 0, 0); ctx.restore();
    }
    ctx.globalAlpha = 1;
    noise(ctx, s, r, 26);
    // la moitié basse du canvas = copie (texture carrée, on n'utilise que la moitié haute via repeat/offset)
    ctx.drawImage(ctx.canvas, 0, 0, s, H, 0, H, s, H);
  }, { repeat: [1, 0.5] });
}

// Mur haut : briques nues noircies, restes de peinture crème, salpêtre, suie au-dessus des lampes.
// Canvas 1024² = 5 m × 5 m.
export function wallUpperTexture() {
  const r = rnd(13);
  return canvasTexture(1024, (ctx, s) => {
    ctx.fillStyle = '#2b211b'; ctx.fillRect(0, 0, s, s);
    const bw = 46, bh = 15;
    for (let y = 0; y < s; y += bh) {
      const off = (y / bh) % 2 ? bw / 2 : 0;
      for (let x = -bw; x < s + bw; x += bw) {
        const c = 62 + r() * 38, burnt = r() < 0.12 ? 0.6 : 1;
        ctx.fillStyle = `rgb(${(c + 30) * burnt},${c * 0.52 * burnt},${c * 0.38 * burnt})`;
        ctx.fillRect(x + off + 1.5, y + 1.5, bw - 3, bh - 3);
      }
    }
    // vieille peinture crème en plaques
    ctx.fillStyle = '#8f8a78';
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.5 + r() * 0.4;
      ctx.beginPath();
      const x = r() * s, y = r() * s, rad = 20 + r() * 110;
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, rr = rad * (0.5 + r() * 0.7); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    blotches(ctx, s, r, 40, '#cfc8b8', 10, 70, 0.07); // salpêtre
    blotches(ctx, s, r, 70, '#0e0b09', 30, 160, 0.16); // suie / humidité
    ctx.strokeStyle = '#120e0b';
    for (let i = 0; i < 90; i++) { ctx.globalAlpha = 0.08 + r() * 0.22; ctx.lineWidth = 1 + r() * 5; const x = r() * s, y = r() * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 6, y + 40 + r() * 260); ctx.stroke(); }
    ctx.globalAlpha = 1;
    cracks(ctx, s, r, 14, '#0d0a08', 1.6);
    noise(ctx, s, r, 30);
  });
}

export function concreteCeilingTexture() {
  const r = rnd(17);
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#3a3733'; ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, r, 160, '#1c1a17', 10, 60, 0.2);
    blotches(ctx, s, r, 40, '#53504a', 10, 50, 0.12);
    ctx.strokeStyle = '#1b1915'; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
    for (let i = 0; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * s / 2, 0); ctx.lineTo(i * s / 2, s); ctx.stroke(); }
    ctx.globalAlpha = 1;
    cracks(ctx, s, r, 10, '#111', 1.2);
    noise(ctx, s, r, 22);
  }, { repeat: [8, 8] });
}

export function woodTexture() {
  const r = rnd(29);
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#3b2c1f'; ctx.fillRect(0, 0, s, s);
    const ph = s / 4;
    for (let i = 0; i < 4; i++) {
      const c = 52 + r() * 30;
      ctx.fillStyle = `rgb(${c * 1.25},${c * 0.95},${c * 0.68})`;
      ctx.fillRect(0, i * ph + 3, s, ph - 6);
      ctx.strokeStyle = 'rgba(20,12,6,0.25)';
      for (let k = 0; k < 14; k++) { ctx.lineWidth = 0.5 + r() * 1.5; ctx.beginPath(); const y = i * ph + 6 + r() * (ph - 12); ctx.moveTo(0, y); ctx.bezierCurveTo(s * 0.3, y + (r() - 0.5) * 8, s * 0.6, y + (r() - 0.5) * 8, s, y + (r() - 0.5) * 4); ctx.stroke(); }
    }
    blotches(ctx, s, r, 60, '#15100b', 4, 30, 0.25);
    blotches(ctx, s, r, 30, '#8a7a60', 4, 20, 0.08); // usure claire
    noise(ctx, s, r, 24);
  });
}

// Toile du ring : usure au centre et dans les coins, traces de semelles et de pivots, sang étalé,
// plis, logo délavé et gratté. Canvas 2048² = toile entière (≈6.8 m).
export function canvasMatTexture() {
  const r = rnd(23);
  return canvasTexture(2048, (ctx, s) => {
    const k = s / 1024;
    ctx.fillStyle = '#c4bdab'; ctx.fillRect(0, 0, s, s);
    // grandes variations sales (jamais uniformes)
    blotches(ctx, s, r, 160, '#9c9482', 40 * k, 220 * k, 0.07);
    blotches(ctx, s, r, 80, '#d6d0c0', 40 * k, 160 * k, 0.05);
    // trame
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < s; i += 3) { ctx.fillStyle = i % 6 ? '#000' : '#fff'; ctx.fillRect(i, 0, 1, s); ctx.fillRect(0, i, s, 1); }
    ctx.globalAlpha = 1;
    // logo délavé puis gratté par l'usure
    ctx.save(); ctx.translate(s / 2, s / 2); ctx.globalAlpha = 0.32;
    ctx.strokeStyle = '#7a1414'; ctx.lineWidth = 14 * k; ctx.beginPath(); ctx.arc(0, 0, 190 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.arc(0, 0, 165 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#7a1414'; ctx.font = `bold ${120 * k}px Impact, Arial Black, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('IRON', 0, -55 * k); ctx.fillText('PIT', 0, 70 * k);
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#c4bdab';
    for (let i = 0; i < 220; i++) { // grattage du logo (plaques claires)
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 230 * k;
      ctx.globalAlpha = 0.25 + r() * 0.4;
      ctx.beginPath(); ctx.ellipse(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, (3 + r() * 14) * k, (1 + r() * 4) * k, r() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // usure grise au centre : nuée de frottements (densité gaussienne)
    const gauss = () => (r() + r() + r() - 1.5) / 1.5;
    const scuff = (cx, cy, spread, n, col, alpha) => {
      ctx.strokeStyle = col; ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const x = cx + gauss() * spread, y = cy + gauss() * spread;
        ctx.globalAlpha = alpha * (0.3 + r() * 0.7); ctx.lineWidth = (2 + r() * 8) * k;
        const a = r() * Math.PI * 2, L = (6 + r() * 30) * k;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * L * 0.6, y + Math.sin(a + 0.6) * L * 0.6, x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    scuff(s / 2, s / 2, 360 * k, 2600, '#6d6556', 0.10);
    scuff(s / 2, s / 2, 200 * k, 1400, '#4e473c', 0.08);
    // pivots (arcs) des appuis
    ctx.strokeStyle = '#3e382f';
    for (let i = 0; i < 90; i++) {
      const x = s / 2 + gauss() * 320 * k, y = s / 2 + gauss() * 320 * k, rad = (10 + r() * 22) * k;
      ctx.globalAlpha = 0.06 + r() * 0.1; ctx.lineWidth = (3 + r() * 6) * k;
      const a0 = r() * Math.PI * 2; ctx.beginPath(); ctx.arc(x, y, rad, a0, a0 + 1 + r() * 3); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // traces de semelles (empreintes avec rainures)
    for (let i = 0; i < 70; i++) {
      const x = s / 2 + gauss() * 380 * k, y = s / 2 + gauss() * 380 * k;
      ctx.save(); ctx.translate(x, y); ctx.rotate(r() * Math.PI * 2);
      ctx.globalAlpha = 0.07 + r() * 0.1; ctx.fillStyle = '#2e2922';
      const L = (26 + r() * 6) * k, W = 9 * k;
      ctx.beginPath(); ctx.ellipse(0, -L * 0.18, W, L * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, L * 0.34, W * 0.75, L * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha *= 0.8; ctx.fillStyle = '#c4bdab';
      for (let t = -L * 0.45; t < L * 0.5; t += 3.5 * k) ctx.fillRect(-W, t, W * 2, 1.2 * k);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // coins : crasse, eau, résine (les coins de la toile sont à ≈0.44·s du centre)
    const cOff = s * 0.5 * (3.0 / 3.38);
    const corner = (cx, cy, col, rad) => { const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad); gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); };
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = s / 2 + sx * cOff, cy = s / 2 + sy * cOff;
      corner(cx, cy, 'rgba(55,45,32,0.55)', 190 * k);
      scuff(cx - sx * 60 * k, cy - sy * 60 * k, 70 * k, 300, '#3a3228', 0.12);
      blotches2(ctx, r, cx - sx * 70 * k, cy - sy * 70 * k, 90 * k, 14, '#5a5040', 10 * k, 40 * k, 0.12); // eau renversée
    }
    // sang : gouttes + traînées étalées (frais et séché)
    const smear = (x, y, ang, len, w, col) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.fillStyle = col;
      for (let t = 0; t < len; t += 1.5 * k) {
        const f = 1 - t / len;
        ctx.globalAlpha = 0.5 * f * f + 0.04;
        ctx.beginPath(); ctx.ellipse(t, Math.sin(t * 0.05) * 3 * k, 1.2 * k, w * (0.4 + 0.6 * f) * (0.8 + r() * 0.4), 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.ellipse(0, 0, w * 1.1, w * 0.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      for (let i = 0; i < 12; i++) { ctx.globalAlpha = 0.4 + r() * 0.4; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + gauss() * 40 * k, y + gauss() * 40 * k, (0.8 + r() * 3) * k, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    };
    for (let i = 0; i < 9; i++) smear(s / 2 + gauss() * 330 * k, s / 2 + gauss() * 330 * k, r() * Math.PI * 2, (40 + r() * 120) * k, (4 + r() * 6) * k, r() < 0.4 ? '#6e0f0c' : '#4a120d');
    // plis de la toile (lignes claires/sombres doublées), surtout vers les bords
    for (let i = 0; i < 16; i++) {
      const side = Math.floor(r() * 4), t = 0.15 + r() * 0.7;
      let x = side < 2 ? t * s : (side === 2 ? 60 * k : s - 60 * k), y = side < 2 ? (side === 0 ? 60 * k : s - 60 * k) : t * s;
      const a = (side < 2 ? Math.PI / 2 : 0) + (r() - 0.5) * 0.6, L = (80 + r() * 220) * k;
      const dx = Math.cos(a) * L * (side === 1 || side === 3 ? -1 : 1), dy = Math.sin(a) * L * (side === 1 || side === 3 ? -1 : 1);
      for (const [off, col, al] of [[0, '#58503f', 0.22], [3 * k, '#ece6d6', 0.18]]) {
        ctx.strokeStyle = col; ctx.globalAlpha = al; ctx.lineWidth = (2 + r() * 2) * k;
        ctx.beginPath(); ctx.moveTo(x + off, y + off); ctx.quadraticCurveTo(x + dx * 0.5 + (r() - 0.5) * 30 * k + off, y + dy * 0.5 + off, x + dx + off, y + dy + off); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // bords plus sales (là où l'on marche le long des cordes) + ruban adhésif réparé
    const edge = ctx.createRadialGradient(s / 2, s / 2, s * 0.32, s / 2, s / 2, s * 0.72);
    edge.addColorStop(0, 'rgba(60,50,38,0)'); edge.addColorStop(1, 'rgba(60,50,38,0.4)');
    ctx.fillStyle = edge; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(s * (0.2 + r() * 0.6), s * (0.2 + r() * 0.6)); ctx.rotate(r() * Math.PI); ctx.globalAlpha = 0.55; ctx.fillStyle = '#8e8a80'; ctx.fillRect(-40 * k, -7 * k, 80 * k, 14 * k); ctx.restore(); }
    ctx.globalAlpha = 1;
    noise(ctx, s, r, 16);
  });
}

function blotches2(ctx, r, cx, cy, spread, n, color, rmin, rmax, alpha) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * (0.3 + r() * 0.7);
    const rad = rmin + r() * (rmax - rmin);
    ctx.beginPath(); ctx.ellipse(cx + (r() - 0.5) * spread * 2, cy + (r() - 0.5) * spread * 2, rad, rad * (0.4 + r() * 0.6), r() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Corde gainée : torsade, crasse, ruban adhésif. Blanc → teinté par le matériau. u = longueur.
export function ropeTexture(seed = 1) {
  const r = rnd(41 + seed);
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#d8d2c4'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 6;
    for (let x = -s; x < s * 2; x += 22) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + s * 0.5, s); ctx.stroke(); }
    blotches(ctx, s, r, 90, '#3a2e22', 6, 50, 0.22);   // crasse
    blotches(ctx, s, r, 14, '#4a0c0a', 3, 12, 0.5);    // sang
    blotches(ctx, s, r, 30, '#fff', 4, 20, 0.08);      // usure claire
    for (let i = 0; i < 3; i++) { const x = r() * s; ctx.fillStyle = 'rgba(40,40,40,0.75)'; ctx.fillRect(x, 0, 18 + r() * 20, s); } // ruban
    noise(ctx, s, r, 30);
  }, { repeat: [10, 1] });
}

// Coussin de coin en vinyle : plis, craquelures, taches, sangle. Blanc → teinté par le matériau.
export function padTexture() {
  const r = rnd(53);
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#e0dbd0'; ctx.fillRect(0, 0, s, s);
    const g = ctx.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(0.5, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    cracks(ctx, s, r, 26, 'rgba(30,20,15,0.6)', 1.1);
    blotches(ctx, s, r, 60, '#2a2018', 6, 40, 0.18);
    blotches(ctx, s, r, 10, '#4a0c0a', 3, 14, 0.45);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const y = r() * s; ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(s / 2, y + (r() - 0.5) * 30, s, y + (r() - 0.5) * 10); ctx.stroke(); }
    noise(ctx, s, r, 26);
  });
}

export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,255,255,0.55)'); g.addColorStop(0.4, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Fenêtres hautes encrassées (nuit : faible lueur bleutée de la rue, carreaux cassés noirs).
export function windowTexture() {
  const r = rnd(61);
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#0a0c10'; ctx.fillRect(0, 0, s, s);
    const n = 6, cw = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const broken = r() < 0.12;
      const v = broken ? 6 : 40 + r() * 40 + (j / n) * 30;
      ctx.fillStyle = `rgb(${v * 0.55},${v * 0.7},${v})`;
      ctx.fillRect(i * cw + 6, j * cw + 6, cw - 12, cw - 12);
    }
    blotches(ctx, s, r, 80, '#000', 6, 50, 0.35);
    ctx.fillStyle = '#050505'; for (let i = 0; i <= n; i++) { ctx.fillRect(i * cw - 4, 0, 8, s); ctx.fillRect(0, i * cw - 4, s, 8); }
  });
}

export function signTexture(text, fg, bg, w = 512, h = 192) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg; ctx.font = `bold ${h * 0.55}px Arial Black, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h * 0.54);
  const r = rnd(text.length * 7);
  blotches(ctx, w, r, 30, '#000', 4, 30, 0.2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Bannière en tissu suspendue (délavée, auréoles).
export function bannerTexture(title, sub, bg, fg) {
  const r = rnd(title.length * 13);
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = fg; ctx.lineWidth = 10; ctx.strokeRect(22, 22, s - 44, s - 44);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 120px Impact, Arial Black, sans-serif'; ctx.fillText(title, s / 2, s * 0.42);
    ctx.font = 'bold 44px Arial'; ctx.fillText(sub, s / 2, s * 0.66);
    blotches(ctx, s, r, 50, '#000', 10, 80, 0.18);
    ctx.globalCompositeOperation = 'multiply'; blotches(ctx, s, r, 30, '#8a7a5a', 20, 90, 0.4); ctx.globalCompositeOperation = 'source-over';
    noise(ctx, s, r, 30);
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
