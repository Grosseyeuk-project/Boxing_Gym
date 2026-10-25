// Gouttelettes (sueur / sang) : pool de Points avec gravité, rebond amorti sur le tapis.
import * as THREE from 'three';
import { RING } from '../fondations/constants.js';

function dropSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export class DropletSystem {
  constructor(scene, max = 600) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo = g;
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.02, map: dropSprite(), vertexColors: true, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false;
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -100;
    scene.add(this.points);
  }
  /** Gerbe de gouttelettes. dir : direction principale (monde). */
  burst(point, dir, count, color, speed = 2.5, spread = 0.9) {
    const c = new THREE.Color(color);
    for (let k = 0; k < count; k++) {
      const i = this.next; this.next = (this.next + 1) % this.max;
      this.pos[i * 3] = point.x; this.pos[i * 3 + 1] = point.y; this.pos[i * 3 + 2] = point.z;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.vel[i * 3] = (dir.x + (Math.random() - 0.5) * spread) * s;
      this.vel[i * 3 + 1] = (dir.y + 0.3 + Math.random() * spread * 0.8) * s;
      this.vel[i * 3 + 2] = (dir.z + (Math.random() - 0.5) * spread) * s;
      this.life[i] = 0.6 + Math.random() * 0.8;
      const b = 0.7 + Math.random() * 0.3;
      this.col[i * 3] = c.r * b; this.col[i * 3 + 1] = c.g * b; this.col[i * 3 + 2] = c.b * b;
    }
  }
  update(dt) {
    if (dt <= 0) return;
    const floor = RING.floorY + 0.01;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 9.8 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < floor && Math.abs(this.pos[i * 3]) < 3.3 && Math.abs(this.pos[i * 3 + 2]) < 3.3) {
        this.pos[i * 3 + 1] = floor; this.vel[i * 3] *= 0.2; this.vel[i * 3 + 1] = 0; this.vel[i * 3 + 2] *= 0.2;
      }
      if (this.life[i] <= 0) this.pos[i * 3 + 1] = -100;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
