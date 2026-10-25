// Éclairage : rampe au-dessus du ring (spot principal avec ombres douces), contre-jours,
// lumières pratiques (néons/ampoules) synchronisées sur les ancres de l'arène, brouillard.
import * as THREE from 'three';
import { RING } from '../fondations/constants.js';
import { createAtmosphere } from './atmosphere.js';

export const QUALITY = {
  low: { shadowMap: 1024, pixelRatio: 0.75, bloom: false, dust: 300, practicalLights: 2 },
  medium: { shadowMap: 2048, pixelRatio: 1, bloom: true, dust: 700, practicalLights: 4 },
  high: { shadowMap: 2048, pixelRatio: Math.min(2, window.devicePixelRatio || 1), bloom: true, dust: 1400, practicalLights: 6 },
};

export function createLighting(scene, renderer, anchors, qualityName = 'high') {
  const q = QUALITY[qualityName] || QUALITY.high;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.fog = new THREE.FogExp2(0x0b0a0a, 0.03);
  scene.background = new THREE.Color(0x050505);

  const H = RING.floorY;
  const hemi = new THREE.HemisphereLight(0x39404a, 0x120c08, 0.35);
  scene.add(hemi);

  // spot principal (rampe) : lumière chaude et dure, ombres
  const key = new THREE.SpotLight(0xffe6c8, 75, 14, Math.PI * 0.28, 0.55, 1.6);
  key.position.set(0, H + 4.2, 0);
  key.target.position.set(0, H, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(q.shadowMap, q.shadowMap);
  key.shadow.camera.near = 1; key.shadow.camera.far = 9;
  key.shadow.bias = -0.0002; key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key, key.target);

  // spots secondaires en biais (modelé des corps) sans ombres
  const fills = [];
  for (const [x, z, c, i] of [[3.5, 3.5, 0xffd7b0, 30], [-3.5, -3.5, 0xc8d8ff, 22]]) {
    const s = new THREE.SpotLight(c, i, 12, Math.PI * 0.18, 0.7, 1.5);
    s.position.set(x, H + 3.8, z);
    s.target.position.set(0, H + 1.2, 0);
    scene.add(s, s.target);
    fills.push(s);
  }

  // lumières pratiques sur les ancres (néons, ampoules)
  const practical = [];
  const sorted = [...anchors].filter((a) => a.kind !== 'lamp').slice(0, q.practicalLights);
  for (const a of sorted) {
    const l = new THREE.PointLight(a.color, a.kind === 'neon' ? 9 : 5, a.kind === 'neon' ? 9 : 7, 1.8);
    l.position.copy(a.position);
    scene.add(l);
    practical.push({ light: l, anchor: a, base: l.intensity });
  }

  const atmosphere = createAtmosphere(scene, q);

  function update(dt, time) {
    for (const p of practical) p.light.intensity = p.base * p.anchor.intensity;
    // légère respiration du spot (vieux ballast)
    key.intensity = 75 * (0.97 + 0.03 * Math.sin(time * 37) * Math.sin(time * 3.1));
    atmosphere.update(dt, time);
  }

  return { key, fills, hemi, practical, atmosphere, update, quality: q };
}
