// Géométries procédurales pour le corps : "loft" d'anneaux superelliptiques + tête sculptée.
import * as THREE from 'three';

/**
 * Loft le long de Y. rings : [{ y, w, d?, df?, db?, x?, z?, p? }]
 *  w = demi-largeur (X), df/db = demi-profondeur avant (+Z) / arrière (-Z), p = exposant superellipse.
 * Les extrémités sont fermées par un sommet central. Normales lissées (pas de couture).
 */
export function loft(rings, seg = 24) {
  const pos = [], uv = [], idx = [];
  const n = rings.length;
  const ys = rings.map((r) => r.y);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  for (let r = 0; r < n; r++) {
    const R = rings[r];
    const df = R.df ?? R.d ?? R.w, db = R.db ?? R.d ?? R.w, p = R.p ?? 2;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const e = 2 / p;
      const x = Math.sign(c) * Math.pow(Math.abs(c), e) * R.w;
      const zr = s >= 0 ? df : db;
      const z = Math.sign(s) * Math.pow(Math.abs(s), e) * zr;
      pos.push(x + (R.x || 0), R.y, z + (R.z || 0));
      uv.push(i / seg, (R.y - yMin) / (yMax - yMin || 1));
    }
  }
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < seg; i++) {
      const a = r * seg + i, b = r * seg + ((i + 1) % seg);
      const c = (r + 1) * seg + i, d = (r + 1) * seg + ((i + 1) % seg);
      // orientation : anneaux ordonnés du haut vers le bas OU du bas vers le haut -> on corrige après
      idx.push(a, c, b, b, c, d);
    }
  }
  // capuchons
  const capTop = pos.length / 3;
  const R0 = rings[0], RN = rings[n - 1];
  pos.push(R0.x || 0, R0.y, R0.z || 0); uv.push(0.5, (R0.y - yMin) / (yMax - yMin || 1));
  const capBot = capTop + 1;
  pos.push(RN.x || 0, RN.y, RN.z || 0); uv.push(0.5, (RN.y - yMin) / (yMax - yMin || 1));
  for (let i = 0; i < seg; i++) {
    const i2 = (i + 1) % seg;
    idx.push(capTop, i, i2);
    idx.push(capBot, (n - 1) * seg + i2, (n - 1) * seg + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // si les anneaux vont du haut vers le bas, l'enroulement ci-dessus est inversé
  if (rings[0].y > rings[n - 1].y) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Ellipsoïde (sphère mise à l'échelle) — muscles, articulations. */
export function blob(sx, sy, sz, seg = 16) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(8, seg * 0.75));
  g.scale(sx, sy, sz);
  return g;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gauss = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));

/** Crâne + visage sculptés à partir d'une sphère (origine = base du crâne). */
export function headGeometry() {
  const g = new THREE.SphereGeometry(1, 48, 36);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); // direction unitaire
    const { x, y, z } = v;
    let sx = 0.077, sy = 0.112, sz = 0.098;
    // mâchoire qui se resserre vers le menton
    const low = smooth(0.05, -0.85, y);
    sx *= 1 - 0.28 * low * smooth(-0.6, 0.6, z);
    // arrière du crâne plus rond / volumineux
    if (z < 0) sz *= 1 + 0.08 * smooth(-0.2, 0.6, y);
    let X = x * sx, Y = y * sy, Z = z * sz;
    // menton projeté vers l'avant
    Z += 0.012 * gauss(y, -0.82, 0.15) * smooth(0.3, 0.9, z);
    // angle de la mâchoire
    X += Math.sign(x) * 0.006 * gauss(y, -0.45, 0.15) * gauss(z, 0.0, 0.35);
    // arcade sourcilière
    Z += 0.008 * gauss(y, 0.22, 0.07) * smooth(0.6, 0.95, z);
    // orbites creusées
    Z -= 0.009 * gauss(y, 0.08, 0.08) * gauss(Math.abs(x), 0.36, 0.13) * smooth(0.6, 0.95, z);
    // pommettes
    Z += 0.006 * gauss(y, -0.08, 0.1) * gauss(Math.abs(x), 0.55, 0.12) * smooth(0.3, 0.8, z);
    X += Math.sign(x) * 0.004 * gauss(y, -0.05, 0.12) * gauss(z, 0.55, 0.2);
    // front légèrement aplati
    Z -= 0.006 * smooth(0.45, 0.9, y) * smooth(0.5, 1, z);
    // bouche : léger creux + lèvres
    Z += 0.004 * gauss(y, -0.5, 0.05) * gauss(x, 0, 0.18) * smooth(0.7, 1, z);
    Z -= 0.003 * gauss(y, -0.58, 0.025) * gauss(x, 0, 0.2) * smooth(0.7, 1, z);
    p.setXYZ(i, X, Y + 0.105, Z + 0.012);
  }
  g.computeVertexNormals();
  return g;
}

/** Nez : petit prisme arrondi. */
export function noseGeometry() {
  const g = new THREE.ConeGeometry(0.017, 0.05, 10, 1);
  g.rotateX(Math.PI * 0.08);
  g.scale(1, 1, 0.9);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < -0.015) { p.setZ(i, p.getZ(i) + 0.008); p.setX(i, p.getX(i) * 1.25); }
  }
  g.computeVertexNormals();
  return g;
}
