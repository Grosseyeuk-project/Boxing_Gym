// Boxeur humanoïde procédural : hiérarchie d'articulations (Object3D) + segments sculptés.
// Repère local : le boxeur regarde +Z, gauche = +X, pieds à y=0.
// Chaque segment de membre pend le long de -Y depuis son articulation (pose de repos bras le long du corps).
//
// API renvoyée par createFighterModel(opts) :
//   root, joints{hips,spine,chest,neck,head,shoulderL/R,elbowL/R,wristL/R,hipL/R,kneeL/R,ankleL/R},
//   dims{upperArm,foreArm,hand,thigh,shin,ankleH,hipH}, materials,
//   getPartWorld(part,out)  part: 'head'|'chin'|'body'|'gloveL'|'gloveR'
//   setSweat(0..1), setDamage(head0..1, body0..1)
import * as THREE from 'three';
import { loft, blob, headGeometry, noseGeometry } from './geometry.js';
import { makeMaterials } from './materials.js';

export const PRESETS = {
  player: { skin: '#b9825e', shorts: '#8c1018', trim: '#e9c46a', gloves: '#9b0f14', boots: '#151515', hair: '#140d09', height: 1.80, bulk: 1.0, name: 'Marco "Iron" Reyes' },
  opponent: { skin: '#6a4430', shorts: '#0f2a6b', trim: '#e8e8e8', gloves: '#101a3a', boots: '#e8e4dc', hair: '#0a0705', height: 1.83, bulk: 1.06, name: 'Dante "The Wall" Okafor' },
};

function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function joint(name, parent, x, y, z) {
  const j = new THREE.Object3D();
  j.name = name;
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

export function createFighterModel(opts = PRESETS.player) {
  const o = { ...PRESETS.player, ...opts };
  const M = makeMaterials(o);
  const b = o.bulk;
  const root = new THREE.Group();
  root.name = 'fighter';
  const S = o.height / 1.8; // échelle globale de taille
  const body = new THREE.Group();
  body.scale.setScalar(S);
  root.add(body);

  const dims = { upperArm: 0.29, foreArm: 0.265, hand: 0.1, thigh: 0.45, shin: 0.39, ankleH: 0.08, hipH: 0.98, scale: S };
  const J = {};
  J.hips = joint('hips', body, 0, dims.hipH, 0);
  J.spine = joint('spine', J.hips, 0, 0.1, 0);
  J.chest = joint('chest', J.spine, 0, 0.2, 0);
  J.neck = joint('neck', J.chest, 0, 0.235, -0.01);
  J.head = joint('head', J.neck, 0, 0.1, 0.01);
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    J['shoulder' + s] = joint('shoulder' + s, J.chest, sx * 0.185 * b, 0.165, -0.015);
    J['elbow' + s] = joint('elbow' + s, J['shoulder' + s], 0, -dims.upperArm, 0);
    J['wrist' + s] = joint('wrist' + s, J['elbow' + s], 0, -dims.foreArm, 0);
    J['hip' + s] = joint('hip' + s, J.hips, sx * 0.093, -0.065, 0);
    J['knee' + s] = joint('knee' + s, J['hip' + s], 0, -dims.thigh, 0);
    J['ankle' + s] = joint('ankle' + s, J['knee' + s], 0, -dims.shin, 0);
  }

  // ---------- tronc ----------
  // bassin (sous le short)
  mesh(loft([
    { y: -0.17, w: 0.12, d: 0.09 }, { y: -0.12, w: 0.165, d: 0.105 }, { y: -0.02, w: 0.17, d: 0.11 },
    { y: 0.08, w: 0.155, d: 0.1 }, { y: 0.12, w: 0.14, d: 0.09 },
  ]), M.skin, J.hips);
  // abdomen (suit la colonne)
  mesh(loft([
    { y: -0.06, w: 0.148 * b, df: 0.1, db: 0.095 }, { y: 0.02, w: 0.145 * b, df: 0.105, db: 0.095 },
    { y: 0.12, w: 0.152 * b, df: 0.108, db: 0.1 }, { y: 0.22, w: 0.162 * b, df: 0.112, db: 0.105 },
  ]), M.skin, J.spine);
  // abdominaux (légers reliefs)
  for (let r = 0; r < 3; r++) for (const sx of [-1, 1]) {
    mesh(blob(0.032, 0.03, 0.012, 10), M.skin, J.spine, sx * 0.034, 0.02 + r * 0.06, 0.098 - r * 0.0);
  }
  // cage thoracique + épaules
  mesh(loft([
    { y: -0.12, w: 0.155 * b, df: 0.107, db: 0.1 }, { y: -0.04, w: 0.168 * b, df: 0.118, db: 0.106 },
    { y: 0.04, w: 0.183 * b, df: 0.128, db: 0.112 }, { y: 0.11, w: 0.198 * b, df: 0.124, db: 0.115 },
    { y: 0.17, w: 0.2 * b, df: 0.108, db: 0.108, p: 2.3 }, { y: 0.215, w: 0.165 * b, df: 0.085, db: 0.09 },
    { y: 0.245, w: 0.09, df: 0.06, db: 0.065 }, { y: 0.26, w: 0.05, d: 0.045 },
  ], 28), M.skin, J.chest);
  // pectoraux
  for (const sx of [-1, 1]) {
    const pec = mesh(blob(0.082 * b, 0.058, 0.036, 16), M.skin, J.chest, sx * 0.072 * b, 0.065, 0.098);
    pec.rotation.z = sx * -0.25;
    // trapèzes
    const trap = mesh(blob(0.085 * b, 0.04, 0.06, 12), M.skin, J.chest, sx * 0.085 * b, 0.215, -0.03);
    trap.rotation.z = sx * -0.42;
    // dorsaux
    mesh(blob(0.05, 0.12, 0.08, 12), M.skin, J.chest, sx * 0.135 * b, 0.03, -0.035);
    // coiffe d'épaule (comble l'espace épaule/torse)
    mesh(blob(0.062 * b, 0.06, 0.066, 14), M.skin, J.chest, sx * 0.17 * b, 0.16, -0.012);
    // nipple
    mesh(blob(0.008, 0.008, 0.004, 6), M.lips, J.chest, sx * 0.085 * b, 0.05, 0.133);
  }

  // ---------- short ----------
  mesh(loft([
    { y: -0.13, w: 0.175, df: 0.125, db: 0.13 }, { y: -0.04, w: 0.182, df: 0.122, db: 0.128 },
    { y: 0.06, w: 0.172, df: 0.115, db: 0.118 }, { y: 0.115, w: 0.166, df: 0.11, db: 0.112 },
  ], 28), M.shorts, J.hips);
  mesh(loft([{ y: 0.1, w: 0.168, df: 0.112, db: 0.114 }, { y: 0.135, w: 0.168, df: 0.112, db: 0.114 }, { y: 0.17, w: 0.163, df: 0.108, db: 0.11 }], 28), M.trim, J.hips); // ceinture
  for (const s of ['L', 'R']) {
    const h = J['hip' + s];
    mesh(loft([
      { y: 0.08, w: 0.098, d: 0.1 }, { y: -0.04, w: 0.11, d: 0.112 }, { y: -0.2, w: 0.112, d: 0.112 }, { y: -0.235, w: 0.112, d: 0.112 },
    ], 22), M.shorts, h);
    mesh(loft([{ y: -0.215, w: 0.1135, d: 0.1135 }, { y: -0.24, w: 0.1135, d: 0.1135 }], 22), M.trim, h); // liseré
  }

  // ---------- jambes ----------
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    mesh(loft([
      { y: 0.04, w: 0.08, d: 0.08 }, { y: -0.04, w: 0.088 * b, df: 0.094, db: 0.088 }, { y: -0.15, w: 0.08 * b, df: 0.088, db: 0.08 },
      { y: -0.28, w: 0.068 * b, df: 0.072, db: 0.066 }, { y: -0.38, w: 0.055, df: 0.058, db: 0.054 }, { y: -0.45, w: 0.049, d: 0.05 }, { y: -0.475, w: 0.03, d: 0.03 },
    ]), M.skin, J['hip' + s]);
    mesh(blob(0.035, 0.035, 0.022, 10), M.skin, J['knee' + s], 0, 0.0, 0.04); // rotule
    mesh(loft([
      { y: 0.03, w: 0.045, d: 0.045 }, { y: -0.03, w: 0.05, df: 0.048, db: 0.054 }, { y: -0.1, w: 0.053 * b, df: 0.045, db: 0.068 * b },
      { y: -0.18, w: 0.047, df: 0.04, db: 0.058 }, { y: -0.28, w: 0.036, df: 0.034, db: 0.04 }, { y: -0.37, w: 0.031, d: 0.032 }, { y: -0.4, w: 0.02, d: 0.02 },
    ]), M.skin, J['knee' + s]);
    // bottines montantes
    mesh(loft([
      { y: -0.15, w: 0.05, df: 0.047, db: 0.058 }, { y: -0.17, w: 0.051, df: 0.048, db: 0.059 }, { y: -0.3, w: 0.044, d: 0.047 }, { y: -0.4, w: 0.046, d: 0.05 },
    ]), M.boots, J['knee' + s]);
    mesh(loft([{ y: -0.135, w: 0.049, df: 0.046, db: 0.056 }, { y: -0.155, w: 0.0505, df: 0.0475, db: 0.0585 }]), M.socks, J['knee' + s]);
    // pied : loft le long de Z (rings en y puis rotation)
    const foot = loft([
      { y: -0.07, w: 0.042, d: 0.045, p: 3 }, { y: -0.04, w: 0.046, d: 0.05, p: 3 }, { y: 0.04, w: 0.05, d: 0.042, p: 3 },
      { y: 0.13, w: 0.052, d: 0.033, p: 3 }, { y: 0.19, w: 0.045, d: 0.026, p: 3 }, { y: 0.215, w: 0.025, d: 0.015, p: 3 },
    ], 20);
    foot.rotateX(Math.PI / 2); // y -> z
    foot.translate(0, -0.04, 0);
    mesh(foot, M.boots, J['ankle' + s]);
    const sole = new THREE.BoxGeometry(0.098, 0.014, 0.28);
    mesh(sole, M.sole, J['ankle' + s], 0, -0.075, 0.07);
  }

  // ---------- bras ----------
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const sh = J['shoulder' + s];
    mesh(blob(0.066 * b, 0.085, 0.07, 16), M.skin, sh, sx * 0.012, -0.035, 0); // deltoïde
    mesh(loft([
      { y: 0.02, w: 0.05, d: 0.05 }, { y: -0.04, w: 0.056 * b, d: 0.054 }, { y: -0.1, w: 0.051 * b, df: 0.059 * b, db: 0.052 },
      { y: -0.17, w: 0.047 * b, df: 0.056 * b, db: 0.047 }, { y: -0.24, w: 0.042, d: 0.042 }, { y: -0.29, w: 0.037, d: 0.036 }, { y: -0.31, w: 0.024, d: 0.024 },
    ]), M.skin, sh);
    const el = J['elbow' + s];
    mesh(loft([
      { y: 0.025, w: 0.032, d: 0.032 }, { y: -0.03, w: 0.044 * b, d: 0.04 }, { y: -0.09, w: 0.043 * b, df: 0.04, db: 0.036 },
      { y: -0.17, w: 0.034, d: 0.029 }, { y: -0.22, w: 0.03, d: 0.025 }, { y: -0.25, w: 0.02, d: 0.02 },
    ]), M.skin, el);
    mesh(loft([{ y: -0.12, w: 0.036, d: 0.031 }, { y: -0.2, w: 0.032, d: 0.027 }, { y: -0.25, w: 0.031, d: 0.026 }]), M.wraps, el); // bandes
    // gant
    const wr = J['wrist' + s];
    mesh(loft([
      { y: 0.075, w: 0.044, d: 0.042 }, { y: 0.02, w: 0.047, d: 0.045 }, { y: -0.025, w: 0.054, d: 0.052 },
      { y: -0.06, w: 0.06, df: 0.064, db: 0.058 }, { y: -0.11, w: 0.062, df: 0.066, db: 0.058 }, { y: -0.15, w: 0.058, df: 0.058, db: 0.052 },
      { y: -0.175, w: 0.045, d: 0.042 }, { y: -0.188, w: 0.02, d: 0.02 },
    ], 22), M.gloves, wr);
    mesh(loft([{ y: 0.06, w: 0.0455, d: 0.0435 }, { y: 0.045, w: 0.046, d: 0.044 }]), M.gloveTrim, wr); // liseré du poignet
    const thumb = mesh(blob(0.022, 0.05, 0.024, 10), M.gloves, wr, -sx * 0.0, -0.07, 0.058);
    thumb.rotation.x = 0.35;
  }

  // ---------- cou + tête ----------
  mesh(loft([
    { y: -0.05, w: 0.064, df: 0.06, db: 0.07 }, { y: 0.02, w: 0.058, df: 0.056, db: 0.062 }, { y: 0.12, w: 0.054, df: 0.05, db: 0.058 },
  ]), M.skin, J.neck);
  const H = J.head;
  mesh(headGeometry(), M.skin, H);
  mesh(noseGeometry(), M.skin, H, 0, 0.1, 0.115);
  // cheveux ras (calotte)
  const hairG = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42);
  hairG.scale(0.08, 0.115, 0.1);
  const hairM = mesh(hairG, M.hair, H, 0, 0.107, 0.006);
  hairM.rotation.x = -0.32;
  hairM.castShadow = false;
  for (const sx of [-1, 1]) {
    // oreilles
    const ear = mesh(blob(0.012, 0.03, 0.02, 10), M.skin, H, sx * 0.076, 0.1, -0.005);
    ear.rotation.y = sx * 0.3;
    // yeux
    mesh(blob(0.012, 0.009, 0.006, 10), M.eyeWhite, H, sx * 0.03, 0.115, 0.095);
    mesh(blob(0.0055, 0.0055, 0.003, 8), M.iris, H, sx * 0.03, 0.115, 0.1);
    // sourcils
    const brow = mesh(new THREE.BoxGeometry(0.03, 0.006, 0.008), M.hair, H, sx * 0.031, 0.132, 0.1);
    brow.rotation.z = sx * -0.12;
    brow.castShadow = false;
  }
  mesh(blob(0.022, 0.005, 0.008, 10), M.lips, H, 0, 0.051, 0.106); // lèvres

  // ---------- API ----------
  const partOffsets = {
    head: [J.head, new THREE.Vector3(0, 0.1, 0.05)],
    chin: [J.head, new THREE.Vector3(0, 0.04, 0.09)],
    body: [J.chest, new THREE.Vector3(0, -0.06, 0.13)],
    gloveL: [J.wristL, new THREE.Vector3(0, -0.09, 0)],
    gloveR: [J.wristR, new THREE.Vector3(0, -0.09, 0)],
  };
  const sweatBase = M.skin.clearcoat;
  return {
    root, body, joints: J, dims, materials: M, opts: o,
    getPartWorld(part, out = new THREE.Vector3()) {
      const [j, off] = partOffsets[part] || partOffsets.head;
      j.updateWorldMatrix(true, false);
      return out.copy(off).applyMatrix4(j.matrixWorld);
    },
    setSweat(v) {
      M.skin.clearcoat = sweatBase + v * 0.75;
      M.skin.clearcoatRoughness = 0.35 - v * 0.2;
      M.skin.roughness = 0.52 - v * 0.15;
    },
    setDamage(head, bodyDmg) {
      // rougeur globale (à raffiner : bleus localisés, coupures, gonflement)
      const t = Math.min(1, head * 0.6 + bodyDmg * 0.2);
      M.skin.color.setRGB(1, 1 - t * 0.12, 1 - t * 0.15);
    },
  };
}
