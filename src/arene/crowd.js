// Foule instanciée : 9 silhouettes articulées (debout bras ballants, bras croisés, poing levé,
// deux bras en l'air, mains en porte-voix, doigt pointé, assis, assis bras levé...), largeurs /
// tailles / teintes de peau / vêtements / casquettes variés. Un InstancedMesh par pose.
// Les couleurs peau/pantalon/cheveux viennent d'attributs par sommet (aPart) + par instance.
import * as THREE from 'three';
import { rand } from '../fondations/rng.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// ---------- construction de silhouettes ----------
function limb(a, b, r, part, out) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(0.01, len), 1, 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  out.push([g, part]);
}
function blob(geo, x, y, z, sx, sy, sz, part, out) {
  geo.scale(sx, sy, sz); geo.translate(x, y, z); out.push([geo, part]);
}

// part : 0 haut (couleur instance), 1 peau, 2 pantalon, 3 cheveux, 4 casquette
function person(pose) {
  const out = [];
  const seated = !!pose.seated;
  const dy = seated ? -0.42 : 0;
  // jambes
  for (const s of [-1, 1]) {
    if (seated) {
      limb(V(s * 0.1, 0.5, 0.0), V(s * 0.12, 0.5, 0.42), 0.075, 2, out);
      limb(V(s * 0.12, 0.5, 0.42), V(s * 0.13, 0.08, 0.46), 0.06, 2, out);
      blob(new THREE.BoxGeometry(0.1, 0.07, 0.22), s * 0.13, 0.04, 0.5, 1, 1, 1, 2, out);
    } else {
      const k = pose.legs?.[s < 0 ? 0 : 1] || 0;
      limb(V(s * 0.1, 0.9, 0), V(s * (0.11 + k * 0.04), 0.48, 0.03), 0.075, 2, out);
      limb(V(s * (0.11 + k * 0.04), 0.48, 0.03), V(s * (0.12 + k * 0.08), 0.07, 0), 0.06, 2, out);
      blob(new THREE.BoxGeometry(0.1, 0.07, 0.24), s * (0.12 + k * 0.08), 0.035, 0.05, 1, 1, 1, 2, out);
    }
  }
  blob(new THREE.SphereGeometry(1, 8, 5), 0, 0.93 + dy, 0, 0.18, 0.12, 0.12, 2, out); // bassin
  // torse (un peu penché si besoin)
  const lean = pose.lean || 0;
  const torso = new THREE.CapsuleGeometry(0.16, 0.3, 2, 8);
  torso.scale(1.22, 1, 0.72); torso.rotateX(lean); torso.translate(0, 1.2 + dy, lean * 0.15);
  out.push([torso, 0]);
  const sh = 1.42 + dy, lz = lean * 0.3;
  limb(V(0, sh, lz), V(0, sh + 0.12, lz + 0.01), 0.05, 1, out); // cou
  const hz = lz + 0.02 + (pose.headF || 0);
  blob(new THREE.SphereGeometry(1, 10, 7), 0, sh + 0.21, hz, 0.095, 0.115, 0.105, 1, out); // tête
  if (pose.cap) {
    blob(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), 0, sh + 0.25, hz - 0.005, 0.105, 0.09, 0.115, 4, out);
    blob(new THREE.BoxGeometry(0.16, 0.012, 0.1), 0, sh + 0.255, hz + 0.12, 1, 1, 1, 4, out);
  } else {
    blob(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.42), 0, sh + 0.235, hz - 0.012, 0.1, 0.1, 0.11, 3, out);
  }
  // bras : pose.arms = [[coude, main] gauche(+X), [coude, main] droit(-X)]
  const sleeve = pose.tshirt ? 1 : 0;
  pose.arms.forEach(([e, h], i) => {
    const s = i === 0 ? 1 : -1;
    const S = V(s * 0.21, sh - 0.02, lz);
    const E = V(s * e[0], e[1] + dy, e[2]), Hd = V(s * h[0], h[1] + dy, h[2]);
    blob(new THREE.SphereGeometry(1, 7, 5), S.x, S.y, S.z, 0.075, 0.07, 0.075, 0, out); // épaule
    limb(S, E, 0.052, 0, out);
    limb(E, Hd, 0.044, sleeve, out);
    blob(new THREE.SphereGeometry(1, 6, 4), Hd.x, Hd.y, Hd.z, 0.05, 0.055, 0.045, 1, out); // poing
  });
  return mergeParts(out);
}

function mergeParts(list) {
  let nv = 0, ni = 0;
  for (const [g] of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), part = new Float32Array(nv), idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const [g, p] of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    part.fill(p, vo, vo + n);
    if (g.index) { const gi = g.index.array; for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo; io += gi.length; }
    else { for (let i = 0; i < n; i++) idx[io + i] = vo + i; io += n; }
    vo += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

// coudes/mains en coordonnées locales (x = côté, positif = vers l'extérieur)
const POSES = {
  idle: { arms: [[[0.25, 1.13, 0.0], [0.24, 0.88, 0.05]], [[0.25, 1.13, 0.0], [0.23, 0.88, 0.06]]] },
  pockets: { tshirt: true, legs: [0.5, 0], arms: [[[0.27, 1.14, -0.04], [0.17, 0.95, 0.06]], [[0.27, 1.14, -0.04], [0.17, 0.95, 0.06]]] },
  crossed: { tshirt: true, arms: [[[0.24, 1.15, 0.12], [-0.12, 1.25, 0.17]], [[0.24, 1.17, 0.12], [-0.1, 1.27, 0.14]]] },
  cheer: { tshirt: true, lean: -0.08, legs: [0.4, 0.4], arms: [[[0.36, 1.68, 0.02], [0.3, 1.98, 0.08]], [[0.36, 1.68, 0.02], [0.28, 1.98, 0.1]]] },
  pump: { legs: [0, 0.5], arms: [[[0.25, 1.13, 0.0], [0.24, 0.88, 0.05]], [[0.3, 1.66, 0.05], [0.22, 1.95, 0.1]]] },
  shout: { lean: 0.12, headF: 0.03, arms: [[[0.24, 1.32, 0.2], [0.07, 1.6, 0.17]], [[0.24, 1.32, 0.2], [0.07, 1.6, 0.17]]] },
  point: { tshirt: true, cap: true, lean: 0.1, arms: [[[0.25, 1.13, 0.0], [0.24, 0.9, 0.05]], [[0.24, 1.38, 0.3], [0.2, 1.48, 0.6]]] },
  seated: { seated: true, lean: 0.2, arms: [[[0.24, 1.08, 0.2], [0.15, 0.55, 0.38]], [[0.24, 1.08, 0.2], [0.15, 0.55, 0.38]]] },
  seatedUp: { seated: true, cap: true, arms: [[[0.24, 1.1, 0.15], [0.15, 0.58, 0.38]], [[0.32, 1.62, 0.05], [0.24, 1.9, 0.12]]] },
};
const STAND_WEIGHTS = [['idle', 3], ['pockets', 2], ['crossed', 2], ['cheer', 1.6], ['pump', 1.6], ['shout', 1.2], ['point', 1.0]];
const SEAT_WEIGHTS = [['seated', 3], ['seatedUp', 1.2]];
function pick(w) { const t = w.reduce((a, b) => a + b[1], 0); let x = rand() * t; for (const [k, v] of w) { x -= v; if (x <= 0) return k; } return w[0][0]; }

const SKINS = [[0.36, 0.22, 0.15], [0.55, 0.36, 0.25], [0.2, 0.12, 0.08], [0.62, 0.45, 0.34], [0.45, 0.29, 0.19], [0.12, 0.07, 0.05]];

// spots : [{ x, y, z, yaw, seated }]
export function buildCrowd(parent, spots, roomLight) {
  const groups = {};
  for (const sp of spots) {
    const k = sp.seated ? pick(SEAT_WEIGHTS) : pick(STAND_WEIGHTS);
    (groups[k] ||= []).push(sp);
  }
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, color: 0xffffff });
  roomLight.patch(mat, {
    wrap: 0.6, key: 'crowd',
    vertex: (v) => v.replace('#include <common>', '#include <common>\nattribute float aPart;\nattribute vec3 iSkin;\nattribute vec3 iPants;')
      .replace('#include <color_vertex>', `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
  if (aPart > 0.5 && aPart < 1.5) vColor.rgb = iSkin;
  else if (aPart > 1.5 && aPart < 2.5) vColor.rgb = iPants;
  else if (aPart > 2.5 && aPart < 3.5) vColor.rgb = vec3(0.025, 0.02, 0.018);
  else if (aPart > 3.5) vColor.rgb = instanceColor.rgb * 0.5 + vec3(0.04);
#endif`),
  });
  const meshes = [];
  const data = [];
  const col = new THREE.Color();
  for (const [k, list] of Object.entries(groups)) {
    const geo = person(POSES[k]);
    const n = list.length;
    const skin = new Float32Array(n * 3), pants = new Float32Array(n * 3);
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.castShadow = false; mesh.receiveShadow = true;
    list.forEach((sp, i) => {
      const r = rand();
      if (r < 0.12) col.setHSL(0, 0, 0.45 + rand() * 0.25);           // tee-shirts clairs
      else if (r < 0.3) col.setHSL(0, 0, 0.03 + rand() * 0.06);       // noir
      else col.setHSL(rand(), 0.2 + rand() * 0.45, 0.1 + rand() * 0.25);
      mesh.setColorAt(i, col);
      const s = SKINS[Math.floor(rand() * SKINS.length)], v = 0.85 + rand() * 0.3;
      skin.set([s[0] * v, s[1] * v, s[2] * v], i * 3);
      const p = rand();
      if (p < 0.5) pants.set([0.06, 0.08, 0.13], i * 3); else if (p < 0.8) pants.set([0.03, 0.03, 0.03], i * 3); else pants.set([0.16, 0.14, 0.1], i * 3);
      const cheer = k === 'cheer' || k === 'pump' || k === 'seatedUp';
      data.push({ mesh, i, x: sp.x, y: sp.y, z: sp.z, yaw: sp.yaw, h: 0.9 + rand() * 0.18, w: 0.88 + rand() * 0.3, phase: rand() * 10, energy: 0.5 + rand(), cheer, seated: !!sp.seated });
    });
    geo.setAttribute('iSkin', new THREE.InstancedBufferAttribute(skin, 3));
    geo.setAttribute('iPants', new THREE.InstancedBufferAttribute(pants, 3));
    mesh.instanceColor.needsUpdate = true;
    parent.add(mesh);
    meshes.push(mesh);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  function update(dt, time, excitement) {
    for (const d of data) {
      const amp = d.seated ? 0.01 + excitement * 0.03 : (d.cheer ? 0.03 + excitement * 0.16 : 0.012 + excitement * 0.08);
      const bob = Math.max(0, Math.sin(time * (2.2 + d.energy * 2.2) + d.phase)) * amp * d.energy;
      p.set(d.x, d.y + bob, d.z);
      e.set(Math.sin(time * 0.7 + d.phase) * 0.03 * (1 + excitement), d.yaw + Math.sin(time * 0.4 + d.phase) * 0.18, Math.sin(time * 0.9 + d.phase * 1.7) * 0.025);
      q.setFromEuler(e);
      s.set(d.w, d.h, d.w * 0.95);
      m4.compose(p, q, s);
      d.mesh.setMatrixAt(d.i, m4);
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  }
  update(0, 0, 0);
  for (const m of meshes) m.computeBoundingSphere();
  return { meshes, update, count: data.length };
}
