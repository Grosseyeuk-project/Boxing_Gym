// Salle de boxe clandestine délabrée : sol béton, murs briques écaillées, ring surélevé usé,
// cordes affaissées, poteaux, foule instanciée dans la pénombre, néons, rampe de lumière.
// Expose `lightAnchors` : points où lumiere/ installe ses lumières (intensité animée ici).
import * as THREE from 'three';
import { RING } from '../fondations/constants.js';
import { concreteTextures, wallTextures, canvasMatTexture, apronTexture, posterTexture, neonTexture } from './textures.js';
import { rand } from '../fondations/rng.js';

function add(parent, geo, mat, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

const ROOM = { x: 13, z: 11, h: 7.5 };

export function buildArena(scene) {
  const g = new THREE.Group();
  g.name = 'arena';
  scene.add(g);
  const anchors = [];
  const flickers = [];

  // ---------- sol + murs + plafond ----------
  const conc = concreteTextures();
  add(g, new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z * 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ ...conc, roughness: 0.9, color: 0xffffff }), 0, 0, 0, { cast: false });
  const wall = wallTextures();
  const wallMat = new THREE.MeshStandardMaterial({ map: wall.map, roughness: 0.95 });
  for (const [w, x, z, ry] of [[ROOM.x * 2, 0, -ROOM.z, 0], [ROOM.x * 2, 0, ROOM.z, Math.PI], [ROOM.z * 2, -ROOM.x, 0, Math.PI / 2], [ROOM.z * 2, ROOM.x, 0, -Math.PI / 2]]) {
    const geo = new THREE.PlaneGeometry(w, ROOM.h);
    const m = add(g, geo, wallMat.clone(), x, ROOM.h / 2, z, { cast: false });
    m.material.map = wall.map.clone(); m.material.map.repeat.set(w / 7, 1); m.material.map.needsUpdate = true;
    m.rotation.y = ry;
  }
  add(g, new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z * 2).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 1 }), 0, ROOM.h, 0, { cast: false });
  // poutres métalliques + tuyaux
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.7, metalness: 0.6 });
  for (let x = -ROOM.x + 2; x < ROOM.x; x += 4) add(g, new THREE.BoxGeometry(0.25, 0.5, ROOM.z * 2), steel, x, ROOM.h - 0.3, 0, { receive: false });
  const pipe = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.5, metalness: 0.7 });
  for (const z of [-4, 3.5]) { const p = add(g, new THREE.CylinderGeometry(0.09, 0.09, ROOM.x * 2, 10), pipe, 0, ROOM.h - 0.9, z); p.rotation.z = Math.PI / 2; }
  // piliers
  const pillarMat = new THREE.MeshStandardMaterial({ map: wall.map, roughness: 0.9, color: 0xbbbbbb });
  for (const [x, z] of [[-8, -6.5], [8, -6.5], [-8, 6.5], [8, 6.5]]) add(g, new THREE.BoxGeometry(0.7, ROOM.h, 0.7), pillarMat, x, ROOM.h / 2, z);

  // ---------- ring ----------
  const H = RING.floorY, half = RING.half, rp = RING.ropeHalf;
  const apron = apronTexture();
  const skirtMat = new THREE.MeshStandardMaterial({ map: apron, roughness: 0.85 });
  add(g, new THREE.BoxGeometry(half * 2, H - 0.05, half * 2), skirtMat, 0, (H - 0.05) / 2, 0);
  const matTex = canvasMatTexture();
  const matMat = new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.82, color: 0xffffff });
  const mat = add(g, new THREE.BoxGeometry(half * 2 + 0.06, 0.08, half * 2 + 0.06), [skirtMat, skirtMat, matMat, skirtMat, skirtMat, skirtMat], 0, H - 0.04, 0);
  mat.name = 'canvas';
  // poteaux + coussins de coin
  const postMat = new THREE.MeshStandardMaterial({ color: 0x777470, roughness: 0.35, metalness: 0.85 });
  const padCols = [0x8c1418, 0xd8d4cc, 0x152f7a, 0xd8d4cc]; // coin rouge (joueur), neutres, coin bleu
  const corners = [[-rp, -rp], [rp, -rp], [rp, rp], [-rp, rp]];
  corners.forEach(([x, z], i) => {
    add(g, new THREE.CylinderGeometry(0.05, 0.06, 1.65, 12), postMat, x * 1.02, H + 0.75, z * 1.02);
    const pad = add(g, new THREE.CylinderGeometry(0.11, 0.11, 1.2, 12), new THREE.MeshPhysicalMaterial({ color: padCols[i], roughness: 0.45, clearcoat: 0.4 }), x, H + 0.92, z);
    pad.rotation.y = Math.PI / 4;
  });
  // cordes affaissées (tubes le long de courbes)
  const ropeCols = [0xb01d1d, 0xd8d4cc, 0x1d3a9a, 0xb01d1d];
  const ropeHeights = [0.45, 0.8, 1.15, 1.45];
  ropeHeights.forEach((h, k) => {
    const ropeMat = new THREE.MeshPhysicalMaterial({ color: ropeCols[k], roughness: 0.5, clearcoat: 0.3 });
    for (let s = 0; s < 4; s++) {
      const [x0, z0] = corners[s], [x1, z1] = corners[(s + 1) % 4];
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const sag = Math.sin(Math.PI * t) * (0.035 + k * 0.006);
        pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, H + h - sag, z0 + (z1 - z0) * t));
      }
      add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.022, 8), ropeMat, 0, 0, 0);
    }
  });
  // sangles verticales au milieu des côtés
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });
  for (const [x, z] of [[0, -rp], [0, rp], [-rp, 0], [rp, 0]]) add(g, new THREE.BoxGeometry(0.05, 1.05, 0.05), strapMat, x, H + 0.95, z);
  // marches
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.5 });
  for (let i = 0; i < 3; i++) add(g, new THREE.BoxGeometry(0.8, 0.05, 0.35), stepMat, -half - 0.25 - i * 0.3, H - 0.3 - i * 0.3, -half + 0.6);

  // ---------- abords : chaises, table des juges, barrières ----------
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.6 });
  const chair = (x, z, ry) => {
    const c = new THREE.Group();
    add(c, new THREE.BoxGeometry(0.42, 0.03, 0.4), chairMat, 0, 0.45, 0);
    add(c, new THREE.BoxGeometry(0.42, 0.4, 0.03), chairMat, 0, 0.68, -0.2);
    for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) add(c, new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6), chairMat, lx, 0.225, lz);
    c.position.set(x, 0, z); c.rotation.y = ry; g.add(c);
  };
  chair(-half - 0.6, -half - 0.6, Math.PI / 4); chair(half + 0.6, half + 0.6, -Math.PI * 0.75);
  const table = add(g, new THREE.BoxGeometry(3, 0.75, 0.7), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.8 }), 0, 0.375, half + 1.3);
  for (let i = -1; i <= 1; i++) chair(i * 0.9, half + 1.9, Math.PI);
  // seau + serviette
  add(g, new THREE.CylinderGeometry(0.15, 0.12, 0.3, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a8a80, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }), -half - 0.3, 0.15, -half - 0.9);
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0x55534d, roughness: 0.6, metalness: 0.7 });
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(10.8, 0.05, 0.05), barrierMat, 0, 1.0, s * 5.2);
    add(g, new THREE.BoxGeometry(0.05, 0.05, 10.4), barrierMat, s * 5.4, 1.0, 0);
  }

  // ---------- sacs de frappe le long du mur ----------
  const bagMat = new THREE.MeshPhysicalMaterial({ color: 0x3b1d14, roughness: 0.6, clearcoat: 0.3 });
  for (const x of [-9.5, -7.8]) {
    add(g, new THREE.CylinderGeometry(0.18, 0.17, 1.1, 16), bagMat, x, 2.0, -ROOM.z + 1.2);
    add(g, new THREE.CylinderGeometry(0.008, 0.008, 2.0, 4), steel, x, 3.5, -ROOM.z + 1.2);
  }
  // affiches
  [['FIGHT NIGHT', 'SAT · 10PM', 30, -5, -ROOM.z + 0.02, 0], ['NO MERCY', 'IRON PIT', 50, 4, -ROOM.z + 0.02, 0], ['CHAMPION', '1987', 10, -ROOM.x + 0.02, 3, Math.PI / 2]].forEach(([t, s, h, x, z, ry]) => {
    const p = add(g, new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ map: posterTexture(t, s, h), roughness: 0.9 }), x, 2.2, z, { cast: false });
    p.rotation.y = ry; p.rotation.z = (rand() - 0.5) * 0.1;
  });

  // ---------- néons ----------
  const neon = (text, color, x, y, z, ry, w = 3.2) => {
    const mat = new THREE.MeshBasicMaterial({ map: neonTexture(text, color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffffff });
    const m = add(g, new THREE.PlaneGeometry(w, w / 4), mat, x, y, z, { cast: false, receive: false });
    m.rotation.y = ry;
    const a = { name: 'neon:' + text, kind: 'neon', color: new THREE.Color(color), position: new THREE.Vector3(x, y, z).multiplyScalar(0.94), intensity: 1, base: 1 };
    anchors.push(a);
    flickers.push({ anchor: a, mat, t: 0, broken: text === 'GYM' });
  };
  neon('IRON PIT', '#ff2a2a', 0, 4.6, -ROOM.z + 0.05, 0, 4.2);
  neon('GYM', '#2a9dff', -ROOM.x + 0.05, 4.0, -3, Math.PI / 2, 2.6);
  neon('BAR', '#ffb02a', ROOM.x - 0.05, 3.6, 4, -Math.PI / 2, 2.2);

  // ---------- rampe lumineuse au-dessus du ring ----------
  const rig = new THREE.Group();
  rig.position.set(0, H + 4.3, 0);
  g.add(rig);
  add(rig, new THREE.BoxGeometry(4.2, 0.12, 4.2), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.7 }), 0, 0.1, 0, { cast: false });
  const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.92, 0.8).multiplyScalar(6) });
  for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4], [0, -1.4], [0, 1.4], [-1.4, 0], [1.4, 0]]) {
    add(rig, new THREE.BoxGeometry(0.6, 0.04, 0.35), panelMat, x, 0.02, z, { cast: false, receive: false });
  }
  for (const x of [-1.9, 1.9]) add(rig, new THREE.CylinderGeometry(0.01, 0.01, 2.8, 4), steel, x, 1.5, 0, { cast: false });
  anchors.push({ name: 'ringLamp', kind: 'lamp', color: new THREE.Color(1.0, 0.9, 0.78), position: new THREE.Vector3(0, H + 4.25, 0), intensity: 1, base: 1 });
  // ampoules nues au-dessus de la foule
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.7, 0.4).multiplyScalar(4) });
  for (const [x, z] of [[-7, 0], [7, 0], [0, -7.5], [0, 8]]) {
    add(g, new THREE.SphereGeometry(0.06, 10, 8), bulbMat, x, 4.4, z, { cast: false, receive: false });
    add(g, new THREE.CylinderGeometry(0.004, 0.004, ROOM.h - 4.4, 4), steel, x, (ROOM.h + 4.4) / 2, z, { cast: false });
    anchors.push({ name: 'bulb', kind: 'bulb', color: new THREE.Color(1, 0.65, 0.35), position: new THREE.Vector3(x, 4.35, z), intensity: 1, base: 1 });
  }

  // ---------- foule ----------
  const crowd = buildCrowd(g);

  function update(dt, time, excitement = 0) {
    for (const f of flickers) {
      f.t -= dt;
      if (f.t <= 0) {
        f.t = f.broken ? 0.03 + rand() * 0.25 : 0.05 + rand() * 3;
        const on = f.broken ? rand() > 0.35 : rand() > 0.06;
        f.anchor.intensity = on ? f.anchor.base * (0.85 + rand() * 0.15) : 0.08;
      }
      f.mat.opacity = f.anchor.intensity;
      f.mat.color.setScalar(0.4 + f.anchor.intensity * 1.4);
    }
    crowd.update(dt, time, excitement);
  }

  return { group: g, lightAnchors: anchors, update, crowd, room: ROOM };
}

function buildCrowd(parent) {
  // silhouette simple fusionnée (tronc + tête + épaules) — à raffiner par la pièce arene
  const body = new THREE.CylinderGeometry(0.17, 0.2, 0.75, 8);
  body.translate(0, 1.0, 0);
  const legs = new THREE.CylinderGeometry(0.16, 0.13, 0.65, 8);
  legs.translate(0, 0.32, 0);
  const head = new THREE.SphereGeometry(0.11, 10, 8);
  head.translate(0, 1.55, 0);
  const shoulders = new THREE.SphereGeometry(1, 10, 6);
  shoulders.scale(0.25, 0.09, 0.14); shoulders.translate(0, 1.35, 0);
  const geo = mergeGeos([body, legs, head, shoulders]);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, color: 0xffffff });
  const spots = [];
  for (let ringIdx = 0; ringIdx < 4; ringIdx++) {
    const hx = 5.9 + ringIdx * 1.1, hz = 5.7 + ringIdx * 1.05;
    for (let x = -hx; x <= hx; x += 0.62 + rand() * 0.2) { spots.push([x, -hz - ringIdx * 0.05]); spots.push([x, hz]); }
    for (let z = -hz + 0.6; z <= hz - 0.6; z += 0.62 + rand() * 0.2) { spots.push([-hx, z]); spots.push([hx, z]); }
  }
  const usable = spots.filter(([x, z]) => !(Math.abs(x) < 2 && z > 5.5 && z < 6.4)); // place pour la table des juges
  const n = usable.length;
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const data = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  usable.forEach(([x, z], i) => {
    const row = Math.max(Math.abs(x) - 5.9, Math.abs(z) - 5.7);
    const h = 0.92 + rand() * 0.16;
    const d = { x: x + (rand() - 0.5) * 0.2, z: z + (rand() - 0.5) * 0.2, yaw: Math.atan2(-x, -z) + (rand() - 0.5) * 0.5, h, y: row * 0.18, phase: rand() * 10, energy: 0.5 + rand() };
    data.push(d);
    col.setHSL(rand(), 0.15 + rand() * 0.2, 0.08 + rand() * 0.12);
    mesh.setColorAt(i, col);
  });
  parent.add(mesh);
  function update(dt, time, excitement) {
    for (let i = 0; i < n; i++) {
      const d = data[i];
      const bob = Math.max(0, Math.sin(time * (2 + d.energy * 2) + d.phase)) * (0.02 + excitement * 0.12 * d.energy);
      p.set(d.x, d.y + bob, d.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.yaw + Math.sin(time * 0.5 + d.phase) * 0.15);
      s.set(1, d.h, 1);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0, 0, 0);
  return { mesh, update };
}

function mergeGeos(geos) {
  // fusion minimale (position + normal + index) sans dépendre des addons
  let total = 0, idxTotal = 0;
  const parts = geos.map((g) => { const ng = g.index ? g : g; total += ng.attributes.position.count; idxTotal += ng.index.count; return ng; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), idx = new Uint32Array(idxTotal);
  let vo = 0, io = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += g.attributes.position.count; io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
