// Ring surélevé usé : jupe, toile tachée, poteaux, coussins de coin en vinyle sanglés,
// 4 cordes gainées ternies et fléchies (plus basses au milieu), attaches verticales fines, marches.
import * as THREE from 'three';
import { RING } from '../fondations/constants.js';
import { canvasMatTexture, apronTexture, ropeTexture, padTexture } from './textures.js';

function add(parent, geo, mat, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function buildRing(g, roomLight) {
  const H = RING.floorY, half = RING.half, rp = RING.ropeHalf;
  const apron = apronTexture();
  const skirtMat = roomLight.patch(new THREE.MeshStandardMaterial({ map: apron, roughness: 0.85 }));
  add(g, new THREE.BoxGeometry(half * 2, H - 0.05, half * 2), skirtMat, 0, (H - 0.05) / 2, 0);
  const matTex = canvasMatTexture();
  const matMat = new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.86, color: 0xffffff });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x1c1b1d, roughness: 0.8 });
  const mat = add(g, new THREE.BoxGeometry(half * 2 + 0.06, 0.08, half * 2 + 0.06), [edgeMat, edgeMat, matMat, edgeMat, edgeMat, edgeMat], 0, H - 0.04, 0);
  mat.name = 'canvas';
  // bourrelet de toile tendue sur le bord (lèvre arrondie)
  const lipMat = new THREE.MeshStandardMaterial({ color: 0x8e887a, roughness: 0.9 });
  for (const [x, z, ry] of [[0, half + 0.03, 0], [0, -half - 0.03, 0], [half + 0.03, 0, Math.PI / 2], [-half - 0.03, 0, Math.PI / 2]]) {
    const lip = add(g, new THREE.CylinderGeometry(0.045, 0.045, half * 2 + 0.1, 8), lipMat, x, H - 0.03, z, false);
    lip.rotation.set(0, ry, Math.PI / 2);
  }

  // poteaux
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6d6a66, roughness: 0.45, metalness: 0.8 });
  const corners = [[-rp, -rp], [rp, -rp], [rp, rp], [-rp, rp]];
  const padCols = [0x7a1a18, 0xb8b2a6, 0x1d2e5c, 0xb8b2a6]; // rouge (joueur), neutres, bleu
  const padTex = padTexture();
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x1a1918, roughness: 0.75 });
  corners.forEach(([x, z], i) => {
    add(g, new THREE.CylinderGeometry(0.055, 0.065, 1.7, 12), postMat, x * 1.025, H + 0.8, z * 1.025);
    add(g, new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12), postMat, x * 1.025, H + 1.66, z * 1.025);
    // coussin vinyle haut et arrondi, orienté vers le centre
    const padG = new THREE.CapsuleGeometry(0.11, 1.0, 3, 12);
    padG.scale(1.25, 1, 0.75);
    const pad = add(g, padG, new THREE.MeshPhysicalMaterial({ color: padCols[i], map: padTex, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.5 }), x * 0.985, H + 0.95, z * 0.985);
    pad.rotation.y = Math.atan2(-x, -z);
    // sangles qui tiennent le coussin
    for (const hy of [0.55, 0.95, 1.38]) {
      const sg = new THREE.TorusGeometry(0.15, 0.012, 4, 16).scale(0.93, 0.6, 1).rotateX(Math.PI / 2).rotateY(Math.atan2(-x, -z));
      add(g, sg, strapMat, x * 0.985, H + hy, z * 0.985, false);
    }
  });

  // cordes gainées : ternies, tachées, fléchies (plus au milieu, plus pour la corde du haut)
  const ropeCols = [0x6e1d1a, 0xa8a090, 0x22325e, 0x6e1d1a];
  const ropeHeights = [0.42, 0.78, 1.14, 1.48];
  const ropes = [];
  ropeHeights.forEach((h, k) => {
    const ropeMat = roomLight.patch(new THREE.MeshStandardMaterial({ color: ropeCols[k], map: ropeTexture(k), roughness: 0.62 }));
    for (let s = 0; s < 4; s++) {
      const [x0, z0] = corners[s], [x1, z1] = corners[(s + 1) % 4];
      const pts = [];
      const sagMax = 0.055 + k * 0.018 + ((s * 7 + k * 3) % 5) * 0.006;
      const bow = 0.02 + k * 0.006; // poussée vers l'extérieur (boxeurs qui s'y appuient)
      const nx = (z1 - z0) / (rp * 2), nz = -(x1 - x0) / (rp * 2);
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const f = Math.sin(Math.PI * t);
        const sag = Math.pow(f, 0.8) * sagMax;
        pts.push(new THREE.Vector3(x0 + (x1 - x0) * t + nx * f * bow, H + h - sag, z0 + (z1 - z0) * t + nz * f * bow));
      }
      const m = add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.024, 8), ropeMat);
      ropes.push(m);
    }
  });
  // attaches verticales fines (2 par côté, blanc sale) — à ±1.15 m pour ne pas couper le plan ringside
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.85 });
  for (let s = 0; s < 4; s++) {
    const [x0, z0] = corners[s], [x1, z1] = corners[(s + 1) % 4];
    for (const t of [0.31, 0.69]) {
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const tie = add(g, new THREE.BoxGeometry(0.035, 1.02, 0.008), tieMat, x * 1.008, H + 0.98, z * 1.008, false);
      tie.rotation.y = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
    }
  }
  // marches (coin rouge) + seau / tabouret
  const stepMat = roomLight.patch(new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.5 }));
  for (let i = 0; i < 3; i++) add(g, new THREE.BoxGeometry(0.8, 0.05, 0.35), stepMat, -half - 0.25 - i * 0.3, H - 0.3 - i * 0.3, -half + 0.6);
  return { ropes };
}
