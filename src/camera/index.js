// Caméra de combat : presets (diffusion TV, proche, épaule joueur, plongée, bord de ring, intro orbitale, KO),
// lissage critique-amorti, secousse par "trauma" (alimentée par combat-feel via addTrauma).
import * as THREE from 'three';
import { RING } from '../fondations/constants.js';

export const CAMERA_PRESETS = ['broadcast', 'close', 'player', 'overhead', 'ringside', 'intro', 'ko', 'corner'];

export class CameraRig {
  constructor(aspect = 16 / 9) {
    this.camera = new THREE.PerspectiveCamera(38, aspect, 0.05, 120);
    this.mode = 'intro';
    this.override = null; // { mode, until } (KO, entre-rounds...)
    this.fighters = null;
    this.pos = new THREE.Vector3(6, 3.2, 6);
    this.look = new THREE.Vector3(0, RING.floorY + 1.2, 0);
    this.trauma = 0;
    this.time = 0;
    this.side = 1;
    this.introT = 0;
    this.focus = null; // boxeur ciblé (KO)
    this.camera.position.copy(this.pos);
  }
  attach(fighters) { this.fighters = fighters; }
  setMode(mode) { this.mode = mode; this.override = null; if (mode === 'intro') this.introT = 0; }
  /** Plan temporaire (secondes), revient au mode courant ensuite. */
  cut(mode, duration, focus = null) { this.override = { mode, until: this.time + duration }; this.focus = focus; }
  addTrauma(t) { this.trauma = Math.min(1, this.trauma + t); }
  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }

  _target(mode, outPos, outLook) {
    const [a, b] = this.fighters;
    const y0 = RING.floorY;
    const pa = a.renderPos || a.pos, pb = b.renderPos || b.pos;
    const mid = new THREE.Vector3((pa.x + pb.x) / 2, 0, (pa.z + pb.z) / 2);
    const axis = new THREE.Vector3(pb.x - pa.x, 0, pb.z - pa.z);
    const sep = Math.max(0.6, axis.length());
    axis.normalize();
    const perp = new THREE.Vector3(-axis.z, 0, axis.x);
    switch (mode) {
      case 'broadcast': {
        // côté stable : on garde le joueur à gauche de l'écran, sans à-coups
        const dist = 3.3 + sep * 0.9;
        outPos.copy(mid).addScaledVector(perp, dist).addScaledVector(axis, -0.9);
        outPos.y = y0 + 2.25;
        outLook.copy(mid); outLook.y = y0 + 1.22;
        break;
      }
      case 'close': {
        outPos.copy(mid).addScaledVector(perp, 2.2).addScaledVector(axis, -0.5);
        outPos.y = y0 + 1.6;
        outLook.copy(mid); outLook.y = y0 + 1.35;
        break;
      }
      case 'player': {
        outPos.set(pa.x, 0, pa.z).addScaledVector(axis, -1.9).addScaledVector(perp, 0.55);
        outPos.y = y0 + 2.05;
        outLook.copy(pb); outLook.y = y0 + 1.3;
        break;
      }
      case 'overhead': {
        outPos.copy(mid); outPos.y = y0 + 7.5; outPos.z += 0.01;
        outLook.copy(mid); outLook.y = y0;
        break;
      }
      case 'ringside': {
        outPos.copy(mid).addScaledVector(perp, 4.2); outPos.y = y0 + 0.25;
        outLook.copy(mid); outLook.y = y0 + 1.3;
        break;
      }
      case 'intro': {
        const ang = 0.6 + this.introT * 0.18;
        const r = 7.5 - Math.min(2.5, this.introT * 0.35);
        outPos.set(Math.cos(ang) * r, y0 + 2.6 - Math.min(0.8, this.introT * 0.1), Math.sin(ang) * r);
        outLook.set(0, y0 + 1.0, 0);
        break;
      }
      case 'ko': {
        const f = this.focus || a;
        const p = f.renderPos || f.pos;
        const head = new THREE.Vector3();
        f.getTargetWorld('head', head);
        outPos.set(p.x, 0, p.z).addScaledVector(perp, 1.9).addScaledVector(axis, f === a ? -0.6 : 0.6);
        outPos.y = y0 + 0.55;
        outLook.lerpVectors(new THREE.Vector3(p.x, y0 + 0.4, p.z), head, 0.5);
        break;
      }
      case 'corner': {
        outPos.set(0, y0 + 4.2, -6.8);
        outLook.set(0, y0 + 0.6, 0);
        break;
      }
      default: return this._target('broadcast', outPos, outLook);
    }
    // rester hors des cordes en mode "broadcast/close" : la caméra est sur le tablier
    if (mode === 'broadcast' || mode === 'close') {
      const lim = RING.half + 0.9;
      outPos.x = Math.max(-lim, Math.min(lim, outPos.x));
      outPos.z = Math.max(-lim, Math.min(lim, outPos.z));
    }
  }

  update(dt) {
    if (!this.fighters) return;
    this.time += dt;
    if (this.mode === 'intro') this.introT += dt;
    if (this.override && this.time > this.override.until) this.override = null;
    const mode = this.override ? this.override.mode : this.mode;
    const tp = new THREE.Vector3(), tl = new THREE.Vector3();
    this._target(mode, tp, tl);
    const snap = this._lastMode !== mode && (mode === 'ko' || this._lastMode === 'ko' || mode === 'corner' || this._lastMode === 'intro' || this._lastMode === undefined);
    this._lastMode = mode;
    const k = snap ? 1 : 1 - Math.exp(-dt * (mode === 'intro' ? 2 : 3.5));
    this.pos.lerp(tp, k);
    this.look.lerp(tl, snap ? 1 : 1 - Math.exp(-dt * 5));
    // secousse
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma;
    const t = this.time * 40;
    const shake = new THREE.Vector3(Math.sin(t * 1.1) + Math.sin(t * 2.3) * 0.5, Math.sin(t * 1.7 + 1) + Math.sin(t * 2.9) * 0.5, Math.sin(t * 1.3 + 2)).multiplyScalar(s * 0.05);
    this.camera.position.copy(this.pos).add(shake);
    this.camera.lookAt(this.look.x + shake.x * 0.5, this.look.y + shake.y * 0.5, this.look.z);
    this.camera.rotateZ(Math.sin(t * 0.9) * s * 0.03);
  }
}

/** Plans automatiques liés aux événements du combat. */
export function bindCameraEvents(rig, bus, getMatch) {
  bus.on('knockdown', (e) => rig.cut('ko', 3.2, e.fighter));
  bus.on('ko', (e) => rig.cut('ko', 30, e.loser));
  bus.on('roundEnd', () => { const m = getMatch(); rig.cut('corner', m.cfg.endTime + m.cfg.restTime + m.cfg.introTime - 0.4); });
  bus.on('roundStart', () => { rig.override = null; });
}
