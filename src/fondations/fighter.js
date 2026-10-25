// Entité boxeur : état logique (position, orientation, action en cours) + liens vers
// le modèle (boxeurs-modele), l'animateur (boxeurs-anim), les stats (regles) et un contrôleur.
// La simulation (update) est à pas fixe ; le rendu lit prevPos/pos pour interpoler.
import * as THREE from 'three';
import { RING } from './constants.js';
import { MOVES, BODY_MOD, DODGE, GETUP_DUR, MOVE_SPEED, moveTotal } from '../regles/moves.js';
import { createStats, tickStats } from '../regles/stats.js';

// états : idle | block | punch | dodge | hit | down | getup | ko
export class Fighter {
  constructor({ id, name, bus, corner = 'red' }) {
    this.id = id;
    this.name = name;
    this.bus = bus;
    this.corner = corner;
    this.pos = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.prevYaw = 0;
    this.state = 'idle';
    this.stateTime = 0;
    this.action = null;  // { type, t, dur, body, resolved } | { type:'dodge', dir, t, dur } ...
    this.stats = createStats();
    this.opponent = null;
    this.controller = null;
    this.model = null;    // fourni par boxeurs-modele
    this.animator = null; // fourni par boxeurs-anim
    this.intent = { moveF: 0, moveS: 0, punch: null, block: false, dodge: null };
    this.stun = 0;
    this.lastHit = null;  // { dir, power, type, body, time }
    this.forceStayDown = false;
  }

  canAct() {
    return this.state === 'idle' || this.state === 'block';
  }

  resetForRound(x, z) {
    this.pos.set(x, 0, z);
    this.prevPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    this._setState('idle');
    this.action = null;
    if (this.opponent) {
      this.yaw = Math.atan2(-x, -z);
      this.prevYaw = this.yaw;
    }
  }

  _setState(s, action = null) {
    this.state = s;
    this.stateTime = 0;
    this.action = action;
  }

  startPunch(type, body = false) {
    const m = MOVES[type];
    if (!m) return false;
    const speed = 0.75 + 0.25 * (this.stats.stamina / 100);
    this.stats.stamina = Math.max(0, this.stats.stamina - m.stamina);
    this.stats.thrown++;
    this._setState('punch', { type, body, t: 0, speed, dur: moveTotal(m, body), resolved: false, startup: m.startup * (body ? BODY_MOD.startup : 1) });
    this.bus.emit('punchStart', { attacker: this, type, body });
    return true;
  }

  startDodge(dir) {
    if (this.stats.stamina < 2) return false;
    this.stats.stamina = Math.max(0, this.stats.stamina - DODGE.stamina);
    this._setState('dodge', { type: 'dodge', dir, t: 0, dur: DODGE.dur, speed: 1 });
    return true;
  }

  onHit(dir, power, type, body, stun) {
    this.lastHit = { dir: dir.clone(), power, type, body, time: performance.now() };
    this.vel.addScaledVector(dir, 0.25 + power * 0.9);
    this._setState('hit', { type: 'hit', t: 0, dur: stun, speed: 1, power, punch: type, body });
  }

  onBlocked(dir, power) {
    this.lastHit = { dir: dir.clone(), power: power * 0.4, type: 'block', body: false, time: performance.now() };
    this.vel.addScaledVector(dir, 0.15 + power * 0.35);
  }

  knockDown() {
    this._setState('down', { type: 'down', t: 0, dur: 99, speed: 1 });
  }
  getUp() {
    this._setState('getup', { type: 'getup', t: 0, dur: GETUP_DUR, speed: 1 });
  }
  setKO() {
    if (this.state !== 'down') this._setState('down', { type: 'down', t: 0, dur: 99, speed: 1 });
    this.state = 'ko';
  }

  /** Position monde d'une zone cible ('head' | 'body' | 'gloveL' | 'gloveR'). */
  getTargetWorld(part, out = new THREE.Vector3()) {
    if (this.model) return this.model.getPartWorld(part, out);
    return out.set(this.pos.x, RING.floorY + (part === 'body' ? 1.15 : 1.62), this.pos.z);
  }

  /** Pas de simulation. `active` = le match autorise le combat. */
  update(dt, active) {
    this.prevPos.copy(this.pos);
    this.prevYaw = this.yaw;
    this.stateTime += dt;
    tickStats(this.stats, dt, this.state);

    const intent = active && this.controller ? this.controller.intent(this, dt) : { moveF: 0, moveS: 0, punch: null, block: false, dodge: null };
    this.intent = intent;
    const act = this.action;
    if (act) act.t += dt * (act.speed || 1);

    switch (this.state) {
      case 'idle':
      case 'block':
        if (intent.punch) this.startPunch(intent.punch.type, intent.punch.body);
        else if (intent.dodge) this.startDodge(intent.dodge);
        else if (intent.block !== (this.state === 'block')) this._setState(intent.block ? 'block' : 'idle');
        break;
      case 'punch':
      case 'dodge':
      case 'hit':
      case 'getup':
        if (act && act.t >= act.dur) this._setState('idle');
        break;
      case 'down':
      case 'ko':
        break;
    }

    // ---- déplacement ----
    const cur = this.action; // l'action a pu changer dans le switch ci-dessus
    const mobile = this.state !== 'down' && this.state !== 'ko' && this.state !== 'getup';
    let tvx = 0, tvz = 0;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = -fz, rz = fx;
    if (mobile && active) {
      let mul = this.state === 'block' ? MOVE_SPEED.blockMul : this.state === 'punch' ? MOVE_SPEED.punchMul : this.state === 'hit' ? 0 : 1;
      mul *= 0.75 + 0.25 * (this.stats.stamina / 100);
      const f = intent.moveF > 0 ? intent.moveF * MOVE_SPEED.forward : intent.moveF * MOVE_SPEED.back;
      const s = intent.moveS * MOVE_SPEED.strafe;
      tvx = (fx * f + rx * s) * mul;
      tvz = (fz * f + rz * s) * mul;
      if (this.state === 'dodge') {
        const k = Math.sin(Math.PI * Math.min(1, cur.t / cur.dur));
        const d = cur.dir;
        const lat = d === 'left' ? -1 : d === 'right' ? 1 : 0;
        const back = d === 'back' ? -1.6 : 0;
        tvx += (rx * lat * 0.5 + fx * back) * k;
        tvz += (rz * lat * 0.5 + fz * back) * k;
      }
      if (this.state === 'punch' && cur.t < cur.startup + 0.05) {
        const lunge = cur.type === 'cross' ? 0.9 : cur.type === 'jab' ? 0.6 : 0.3;
        tvx += fx * lunge; tvz += fz * lunge;
      }
    }
    const k = 1 - Math.exp(-dt * (this.state === 'hit' ? 3 : 12));
    this.vel.x += (tvx - this.vel.x) * k;
    this.vel.z += (tvz - this.vel.z) * k;
    if (!mobile) this.vel.multiplyScalar(Math.exp(-dt * 6));
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    const L = RING.playHalf;
    this.pos.x = Math.max(-L, Math.min(L, this.pos.x));
    this.pos.z = Math.max(-L, Math.min(L, this.pos.z));

    // ---- orientation : toujours face à l'adversaire ----
    if (this.opponent && mobile) {
      const target = Math.atan2(this.opponent.pos.x - this.pos.x, this.opponent.pos.z - this.pos.z);
      let d = target - this.yaw;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const maxTurn = (this.state === 'hit' ? 3 : 9) * dt;
      this.yaw += Math.max(-maxTurn, Math.min(maxTurn, d));
    }
  }
}

/** Séparation physique simple entre deux boxeurs (corps qui se touchent). */
export function separate(a, b, minDist = 0.78) {
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < minDist && d > 1e-4) {
    const push = (minDist - d) / 2;
    const nx = dx / d, nz = dz / d;
    a.pos.x -= nx * push; a.pos.z -= nz * push;
    b.pos.x += nx * push; b.pos.z += nz * push;
  }
}
