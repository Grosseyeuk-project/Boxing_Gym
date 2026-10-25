// Résolution des coups : à l'entrée en phase active, on teste portée/angle/défense.
import * as THREE from 'three';
import { MOVES, BODY_MOD, BLOCK, DODGE } from './moves.js';
import { applyHit, staminaFactor } from './stats.js';
import { randRange } from '../fondations/rng.js';

const _p = new THREE.Vector3();

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function resolvePunches(fighters, bus, match) {
  for (const a of fighters) {
    const act = a.action;
    if (a.state !== 'punch' || !act || act.resolved) continue;
    const m = MOVES[act.type];
    const startup = m.startup * (act.body ? BODY_MOD.startup : 1);
    if (act.t < startup) continue;
    act.resolved = true;
    const d = a.opponent;
    const dx = d.pos.x - a.pos.x, dz = d.pos.z - a.pos.z;
    const dist = Math.hypot(dx, dz);
    const ang = Math.abs(angleDiff(Math.atan2(dx, dz), a.yaw));
    const dir = new THREE.Vector3(dx / (dist || 1), 0, dz / (dist || 1));
    const base = { attacker: a, defender: d, type: act.type, body: act.body };

    if (dist > m.reach || ang > 0.65 || ['down', 'ko', 'getup'].includes(d.state)) {
      bus.emit('whiff', base);
      continue;
    }
    if (d.state === 'dodge' && !act.body && d.action.t >= DODGE.invulnFrom && d.action.t <= DODGE.invulnTo) {
      bus.emit('dodge', base);
      continue;
    }
    let dmg = m.damage * (act.body ? BODY_MOD.damage : 1) * staminaFactor(a.stats) * randRange(0.85, 1.15);
    const counter = d.state === 'punch' && d.action && !d.action.resolved;
    if (counter) dmg *= 1.5;
    d.getTargetWorld(act.body ? 'body' : 'head', _p);
    const point = _p.clone();

    if (d.state === 'block' && !act.body) {
      const chip = dmg * BLOCK.chip;
      d.stats.stamina = Math.max(0, d.stats.stamina - dmg * BLOCK.staminaDrain);
      applyHit(d.stats, chip, false);
      d.stats.health = Math.max(1, d.stats.health);
      a.stats.roundPoints += 0.15;
      d.onBlocked(dir, m.power);
      bus.emit('block', { ...base, damage: chip, point, dir });
      continue;
    }
    if (d.state === 'block') dmg *= BLOCK.bodyLeak;
    applyHit(d.stats, dmg, act.body);
    a.stats.landed++;
    if (act.type !== 'jab') a.stats.powerLanded++;
    a.stats.damageDealt += dmg;
    a.stats.roundPoints += m.score * (counter ? 1.5 : 1);
    const power = Math.min(1, (dmg / 14) * (0.6 + m.power * 0.6));
    d.onHit(dir, power, act.type, act.body, m.stun * (counter ? 1.3 : 1));
    bus.emit('hit', { ...base, damage: dmg, power, counter, point, dir });
    if (d.stats.health <= 0) match.knockdown(d, a);
  }
}
