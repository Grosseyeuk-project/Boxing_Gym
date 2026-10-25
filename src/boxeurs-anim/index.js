// Animation procédurale d'un boxeur : couches de pose (garde, coups, esquives, réactions, chute)
// + IK bras (cibles de gants) et jambes (pieds plantés avec pas automatiques).
// Purement visuel : lit l'état logique du Fighter, n'écrit jamais dans la simulation.
import * as THREE from 'three';
import { solveTwoBone } from './ik.js';
import { MOVES } from '../regles/moves.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

class Spring {
  constructor(k = 140, c = 13) { this.k = k; this.c = c; this.x = 0; this.v = 0; }
  kick(v) { this.v += v; }
  update(dt) { const a = -this.k * this.x - this.c * this.v; this.v += a * dt; this.x += this.v * dt; return this.x; }
}

/** Courbe d'extension d'un coup (0 garde → 1 bras tendu). */
export function punchExtension(t, startup, active, recovery) {
  if (t < startup) { const k = t / startup; return k < 0.3 ? -0.12 * Math.sin((k / 0.3) * Math.PI) : Math.pow((k - 0.3) / 0.7, 1.4); }
  if (t < startup + active) return 1;
  const k = clamp01((t - startup - active) / recovery);
  return 1 - k * k * (3 - 2 * k);
}

export function createAnimator(fighter, model, bus) {
  const J = model.joints;
  const S = model.dims.scale;
  for (const j of Object.values(J)) j.rotation.order = 'YXZ';
  const L = {
    upper: model.dims.upperArm * S, fore: (model.dims.foreArm + 0.085) * S,
    thigh: model.dims.thigh * S, shin: model.dims.shin * S, ankleH: model.dims.ankleH * S, hipH: model.dims.hipH * S,
  };
  const root = model.root;
  const springs = { headP: new Spring(160, 12), headY: new Spring(160, 12), headR: new Spring(150, 12), chestP: new Spring(110, 12), chestY: new Spring(110, 12), hipZ: new Spring(90, 13) };
  const feet = {
    L: { planted: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, init: false, ideal: V(0.16, 0, 0.21), yaw: -0.25 },
    R: { planted: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, init: false, ideal: V(-0.17, 0, -0.23), yaw: -0.75 },
  };
  let time = Math.random() * 10;
  let downW = 0;
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion();
  const ikQ = {};
  const _opp = new THREE.Vector3();

  bus.on('hit', (e) => {
    if (e.defender !== fighter) return;
    const p = e.power, side = Math.sign(_localDir(e.dir).x) || 1;
    if (e.body) { springs.chestP.kick(5 + p * 9); springs.hipZ.kick(-0.6 - p * 1.2); return; }
    switch (e.type) {
      case 'jab': springs.headP.kick(-6 - p * 10); springs.chestP.kick(-2); break;
      case 'cross': springs.headP.kick(-8 - p * 14); springs.headY.kick(3 * side); springs.chestP.kick(-3 - p * 4); break;
      case 'hook': springs.headY.kick(-(12 + p * 18)); springs.headR.kick(6 + p * 8); springs.chestY.kick(-3 - p * 5); break;
      case 'uppercut': springs.headP.kick(-14 - p * 18); springs.chestP.kick(-4 - p * 6); break;
    }
    springs.hipZ.kick(-0.3 - p * 0.8);
  });
  bus.on('block', (e) => {
    if (e.defender !== fighter) return;
    springs.headP.kick(-3); springs.chestP.kick(-2); springs.hipZ.kick(-0.3);
  });

  function _localDir(dirWorld) {
    // direction monde → repère du boxeur (rotation inverse du yaw)
    const c = Math.cos(-root.rotation.y), s = Math.sin(-root.rotation.y);
    return V(dirWorld.x * c + dirWorld.z * s, 0, -dirWorld.x * s + dirWorld.z * c);
  }

  function toWorld(v, out) { return out.copy(v).applyMatrix4(root.matrixWorld); }

  function updateFeet(dt, moving, stance) {
    for (const k of ['L', 'R']) {
      const f = feet[k];
      toWorld(_v.copy(f.ideal).multiplyScalar(stance), _w);
      _w.y = root.position.y;
      if (!f.init || f.planted.distanceTo(_w) > 0.6) { f.planted.copy(_w); f.from.copy(_w); f.to.copy(_w); f.t = 1; f.init = true; }
    }
    // un seul pied à la fois
    const stepping = feet.L.t < 1 || feet.R.t < 1;
    if (!stepping) {
      let worst = null, wd = 0;
      for (const k of ['L', 'R']) {
        const f = feet[k];
        toWorld(_v.copy(f.ideal).multiplyScalar(stance), _w);
        _w.y = root.position.y;
        const d = f.planted.distanceTo(_w);
        if (d > (moving ? 0.07 : 0.12) && d > wd) { wd = d; worst = k; }
      }
      if (worst) {
        const f = feet[worst];
        toWorld(_v.copy(f.ideal).multiplyScalar(stance), f.to);
        f.to.y = root.position.y;
        f.to.addScaledVector(fighter.vel, 0.08);
        f.from.copy(f.planted);
        f.t = 0;
      }
    }
    for (const k of ['L', 'R']) {
      const f = feet[k];
      if (f.t < 1) {
        f.t = Math.min(1, f.t + dt / 0.13);
        const e = smooth(0, 1, f.t);
        f.planted.lerpVectors(f.from, f.to, e);
        f.lift = Math.sin(Math.PI * f.t) * 0.045;
      } else f.lift = 0;
    }
  }

  /**
   * @param dt     secondes (déjà multipliées par timeScale ; 0 pendant un hitstop)
   * @param alpha  interpolation du pas fixe
   * @param step   durée d'un pas de simulation
   */
  function update(dt, alpha = 0, step = 1 / 60) {
    time += dt;
    const st = fighter.state;
    const act = fighter.action;
    const tA = act ? act.t + (dt > 0 ? alpha * step * (act.speed || 1) : 0) : 0;
    root.updateMatrixWorld(true);

    // ---- vitesse locale (inclinaisons) ----
    const lv = _localDir(fighter.vel);
    const moving = Math.hypot(lv.x, lv.z) > 0.15;

    // ---- pose de base : garde orthodoxe ----
    const P = {
      hx: 0, hy: L.hipH - 0.07 * S, hz: 0, hYaw: -0.5, hPitch: 0.04, hRoll: 0,
      sYaw: 0.05, sPitch: 0.1, sRoll: 0, cYaw: 0.08, cPitch: 0.06, cRoll: 0,
      nPitch: -0.05, headPitch: -0.12, headYaw: 0, headRoll: 0,
      gl: V(0.11, 1.47 * S, 0.3), gr: V(-0.07, 1.5 * S, 0.17),
      pl: V(0.45, 0.85 * S, -0.05), pr: V(-0.4, 0.85 * S, -0.15),
      stance: 1,
    };
    const breath = Math.sin(time * 2 * Math.PI * 0.9);
    const bounce = Math.sin(time * 2 * Math.PI * 1.7);
    P.hy += 0.008 * bounce * (moving ? 0.5 : 1);
    P.cPitch += 0.015 * breath;
    P.gl.y += 0.012 * Math.sin(time * 3.1); P.gl.x += 0.01 * Math.sin(time * 2.3);
    P.gr.y += 0.01 * Math.sin(time * 2.7 + 1);
    P.hPitch += lv.z * 0.06; P.hRoll += -lv.x * 0.05;

    // ---- blocage ----
    if (st === 'block') {
      const k = smooth(0, 0.1, fighter.stateTime);
      P.gl.lerp(V(0.07, 1.58 * S, 0.2), k); P.gr.lerp(V(-0.075, 1.59 * S, 0.19), k);
      P.pl.lerp(V(0.25, 0.9 * S, 0.1), k); P.pr.lerp(V(-0.25, 0.9 * S, 0.05), k);
      P.sPitch += 0.12 * k; P.headPitch -= 0.08 * k; P.hy -= 0.03 * k; P.hYaw += 0.15 * k;
    }

    // ---- coups ----
    if (st === 'punch' && act) {
      const m = MOVES[act.type];
      const e = punchExtension(tA, act.startup, m.active, m.recovery);
      const ePos = Math.max(0, e);
      const lead = m.hand === 'lead';
      const opp = fighter.opponent;
      if (opp && opp.model) opp.model.getPartWorld(act.body ? 'body' : 'chin', _opp); else _opp.set(0, 1.6, 2).applyMatrix4(root.matrixWorld);
      const tgt = root.worldToLocal(_opp.clone());
      tgt.z -= 0.04; // contact sur la surface
      const shoulder = lead ? V(0.17, 1.42 * S, 0.12) : V(-0.17, 1.42 * S, -0.02);
      const reach = (L.upper + L.fore) * 1.12;
      const off = tgt.clone().sub(shoulder);
      if (off.length() > reach) tgt.copy(shoulder).addScaledVector(off.normalize(), reach);
      const g = lead ? P.gl : P.gr;
      const pole = lead ? P.pl : P.pr;
      const base = g.clone();
      g.lerpVectors(base, tgt, ePos);
      const arc = Math.sin(Math.PI * ePos);
      const sx = lead ? 1 : -1;
      switch (act.type) {
        case 'jab':
          P.hYaw += -0.08 * e; P.cYaw += -0.18 * e; P.hz += 0.06 * ePos; P.sPitch += 0.06 * ePos;
          P.headYaw += 0.1 * ePos; P.gr.y += 0.02 * ePos;
          break;
        case 'cross':
          P.hYaw += 0.55 * e; P.cYaw += 0.35 * e; P.hz += 0.1 * ePos; P.sPitch += 0.1 * ePos; P.hy -= 0.02 * ePos;
          P.headYaw -= 0.2 * ePos; P.gl.lerp(V(0.08, 1.55 * S, 0.2), ePos * 0.7);
          break;
        case 'hook':
          g.x += sx * 0.28 * arc; g.z -= 0.12 * arc; g.y += 0.03 * arc;
          pole.lerp(V(sx * 0.7, 1.45 * S, -0.1), ePos);
          P.hYaw += -0.45 * e + 0.12 * (e < 0 ? -e * 8 : 0); P.cYaw += -0.5 * e; P.sRoll += -0.06 * e; P.hy -= 0.04 * ePos;
          P.headYaw += 0.35 * ePos; P.gr.lerp(V(-0.07, 1.57 * S, 0.17), ePos);
          break;
        case 'uppercut':
          g.y -= 0.22 * arc; g.z -= 0.05 * arc; g.x += sx * 0.03 * arc;
          pole.lerp(V(sx * 0.25, 0.9 * S, 0.1), ePos);
          P.hYaw += 0.4 * e; P.cYaw += 0.3 * e; P.hy += -0.07 * arc + 0.02 * ePos; P.sPitch += 0.12 * arc - 0.08 * ePos;
          P.headYaw -= 0.15 * ePos; P.gl.lerp(V(0.08, 1.55 * S, 0.2), ePos * 0.7);
          break;
      }
      if (act.body) { P.hy -= 0.1 * ePos; P.sPitch += 0.15 * ePos; P.hRoll += sx * 0.05 * ePos; }
    }

    // ---- esquives ----
    if (st === 'dodge' && act) {
      const k = Math.sin(Math.PI * clamp01(tA / act.dur));
      switch (act.dir) {
        case 'left': P.hx += 0.14 * k; P.hy -= 0.08 * k; P.sRoll -= 0.22 * k; P.cRoll -= 0.15 * k; P.sPitch += 0.15 * k; P.headRoll -= 0.1 * k; break;
        case 'right': P.hx -= 0.14 * k; P.hy -= 0.08 * k; P.sRoll += 0.22 * k; P.cRoll += 0.15 * k; P.sPitch += 0.15 * k; P.headRoll += 0.1 * k; break;
        case 'duck': P.hy -= 0.2 * k; P.sPitch += 0.38 * k; P.headPitch -= 0.3 * k; break;
        case 'back': P.hz -= 0.06 * k; P.sPitch -= 0.25 * k; P.cPitch -= 0.15 * k; P.headPitch += 0.1 * k; break;
      }
    }

    // ---- sonné : garde qui tombe ----
    if (st === 'hit' && act) {
      const k = 1 - clamp01(tA / act.dur);
      P.gl.y -= 0.12 * k * act.power; P.gr.y -= 0.12 * k * act.power;
      P.gl.x += 0.06 * k; P.gr.x -= 0.06 * k;
      P.hy -= 0.03 * k;
    }

    // ---- ressorts de réaction ----
    const hp = springs.headP.update(dt) * 0.04, hy = springs.headY.update(dt) * 0.04, hr = springs.headR.update(dt) * 0.04;
    const cp = springs.chestP.update(dt) * 0.04, cy = springs.chestY.update(dt) * 0.04, hz = springs.hipZ.update(dt) * 0.1;
    P.headPitch += hp; P.headYaw += hy; P.headRoll += hr; P.cPitch += cp + hp * 0.3; P.cYaw += cy; P.hz += hz;

    // ---- application FK tronc ----
    J.hips.position.set(P.hx / S, P.hy / S, P.hz / S);
    J.hips.rotation.set(P.hPitch, P.hYaw, P.hRoll);
    J.spine.rotation.set(P.sPitch, P.sYaw, P.sRoll);
    J.chest.rotation.set(P.cPitch, P.cYaw, P.cRoll);
    J.neck.rotation.set(P.nPitch, -(P.hYaw + P.sYaw + P.cYaw) * 0.45, 0);
    J.head.rotation.set(P.headPitch, -(P.hYaw + P.sYaw + P.cYaw) * 0.45 + P.headYaw, P.headRoll);
    root.updateMatrixWorld(true);

    // ---- IK bras ----
    const tw = new THREE.Vector3(), pw = new THREE.Vector3();
    solveTwoBone(J.shoulderL, J.elbowL, L.upper, L.fore, toWorld(P.gl, tw), toWorld(P.pl, pw), -1);
    solveTwoBone(J.shoulderR, J.elbowR, L.upper, L.fore, toWorld(P.gr, tw), toWorld(P.pr, pw), -1);
    J.wristL.rotation.set(0, 0, 0); J.wristR.rotation.set(0, 0, 0);

    // ---- IK jambes / pas ----
    const grounded = st !== 'down' && st !== 'ko';
    if (grounded || downW < 1) updateFeet(dt, moving, P.stance);
    const yawQ = new THREE.Quaternion();
    for (const [k, hip, knee, ankle] of [['L', J.hipL, J.kneeL, J.ankleL], ['R', J.hipR, J.kneeR, J.ankleR]]) {
      const f = feet[k];
      const target = tw.copy(f.planted); target.y += L.ankleH + (f.lift || 0);
      const fwd = V(Math.sin(root.rotation.y + f.yaw * 0.4), 0, Math.cos(root.rotation.y + f.yaw * 0.4));
      pw.copy(target).addScaledVector(fwd, 0.6); pw.y += 0.35;
      solveTwoBone(hip, knee, L.thigh, L.shin, target, pw, 1);
      yawQ.setFromAxisAngle(V(0, 1, 0), root.rotation.y + f.yaw);
      ankle.parent.getWorldQuaternion(_q);
      ankle.quaternion.copy(_q.invert().multiply(yawQ));
    }

    // ---- chute / relevé (FK mélangé par-dessus l'IK) ----
    let fall = 0;
    if (st === 'down' || st === 'ko') { fall = smooth(0.1, 0.9, tA); downW = smooth(0, 0.35, tA); }
    else if (st === 'getup') { const k = clamp01(tA / act.dur); fall = 1 - smooth(0.15, 0.85, k); downW = 1 - smooth(0.55, 1, k); }
    else downW = 0;
    if (downW > 0) {
      const buckle = Math.sin(Math.PI * clamp01(tA / 0.5)) * (st === 'getup' ? 0 : 1);
      J.hips.position.set(P.hx / S, lerp(P.hy, 0.16, fall) / S - buckle * 0.12, lerp(P.hz, -0.5, fall) / S);
      _q.setFromEuler(new THREE.Euler(lerp(P.hPitch, -1.42, fall), lerp(P.hYaw, -0.2, fall), lerp(P.hRoll, 0.1, fall), 'YXZ'));
      J.hips.quaternion.slerp(_q, downW);
      const fk = {
        spine: [-0.05, 0, 0.05], chest: [-0.1, 0.1, 0], neck: [0.1, 0, 0], head: [0.2, 0.6, 0.15],
        shoulderL: [-0.4, 0, 1.15], shoulderR: [-0.2, 0, -1.0], elbowL: [-0.7, 0, 0], elbowR: [-1.0, 0, 0],
        hipL: [-0.35 - buckle * 0.6, 0, 0.12], hipR: [-0.1 - buckle * 0.6, 0, -0.1], kneeL: [0.7 + buckle * 0.8, 0, 0], kneeR: [0.3 + buckle * 0.8, 0, 0],
        ankleL: [0.5, 0, 0], ankleR: [0.4, 0, 0],
      };
      for (const [name, [x, y, z]] of Object.entries(fk)) {
        _q.setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
        J[name].quaternion.slerp(_q, downW);
      }
      root.updateMatrixWorld(true);
    }
  }

  return { update, springs, feet };
}
