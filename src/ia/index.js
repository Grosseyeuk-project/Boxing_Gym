// IA de base : gestion de distance, tournoiement, combinaisons, réactions défensives.
// Produit la même "intention" que le PlayerController : { moveF, moveS, punch, block, dodge }.
import { rand } from '../fondations/rng.js';

const COMBOS = [
  [['jab']], [['jab'], ['jab']], [['jab'], ['cross']], [['jab'], ['jab'], ['cross']],
  [['cross'], ['hook']], [['jab'], ['cross'], ['hook']], [['hook'], ['uppercut']],
  [['jab', true], ['cross']], [['jab'], ['hook', true]], [['uppercut'], ['hook']],
];

export const DIFFICULTY = {
  facile: { reaction: 0.32, defense: 0.25, aggression: 0.35, accuracy: 0.8 },
  normal: { reaction: 0.2, defense: 0.45, aggression: 0.55, accuracy: 1 },
  difficile: { reaction: 0.12, defense: 0.65, aggression: 0.75, accuracy: 1 },
};

export class AIController {
  constructor(opts = {}) {
    this.setDifficulty(opts.difficulty || 'normal');
    this.range = opts.range || 0.98;
    this.queue = [];
    this.cooldown = 1;
    this.strafeDir = 1;
    this.strafeTimer = 0;
    this.watched = null; // action adverse déjà évaluée
    this.defend = null;  // { kind, until }
    this.enabled = true;
    this.t = 0;
  }
  setDifficulty(name) {
    this.difficultyName = name;
    this.d = DIFFICULTY[name] || DIFFICULTY.normal;
  }
  intent(f, dt) {
    const out = { moveF: 0, moveS: 0, punch: null, block: false, dodge: null };
    if (!this.enabled) return out;
    this.t += dt;
    const o = f.opponent;
    const dist = Math.hypot(o.pos.x - f.pos.x, o.pos.z - f.pos.z);
    const st = f.stats;
    const hurt = st.health < 30 || st.stamina < 20;
    this.cooldown -= dt;

    // --- distance ---
    const want = hurt ? this.range + 0.45 : this.range;
    if (dist > want + 0.12) out.moveF = 1;
    else if (dist < want - 0.18) out.moveF = -0.8;
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) { this.strafeTimer = 0.8 + rand() * 1.6; this.strafeDir = rand() < 0.5 ? -1 : rand() < 0.5 ? 0 : 1; }
    out.moveS = this.strafeDir * 0.6;
    // éviter les cordes : revenir vers le centre
    const r = Math.hypot(f.pos.x, f.pos.z);
    if (r > 2.1) out.moveS = Math.sign(f.pos.x * Math.cos(f.yaw) - f.pos.z * Math.sin(f.yaw)) || 1;

    // --- défense réactive ---
    if (o.state === 'punch' && o.action && this.watched !== o.action) {
      if (o.action.t >= this.d.reaction * 0.5) {
        this.watched = o.action;
        const roll = rand();
        if (roll < this.d.defense * 0.7) this.defend = { kind: 'block', until: this.t + 0.45 };
        else if (roll < this.d.defense) this.defend = { kind: rand() < 0.5 ? 'left' : rand() < 0.5 ? 'right' : 'back', until: this.t + 0.1 };
        else this.defend = null;
      }
    }
    if (this.defend && this.t < this.defend.until) {
      if (this.defend.kind === 'block') out.block = true;
      else if (f.canAct()) { out.dodge = this.defend.kind; this.defend = null; }
    } else if (hurt && dist < 1.3 && rand() < 0.02) {
      this.defend = { kind: 'block', until: this.t + 0.6 };
    }

    // --- attaque ---
    if (f.canAct() && !out.dodge) {
      if (this.queue.length) {
        const [type, body] = this.queue.shift();
        out.punch = { type, body: !!body };
        out.block = false;
      } else if (this.cooldown <= 0 && dist < this.range + 0.25 && st.stamina > 12) {
        if (rand() < this.d.aggression * (hurt ? 0.5 : 1)) {
          const c = COMBOS[Math.floor(rand() * COMBOS.length)];
          this.queue = c.map((x) => [...x]);
          const [type, body] = this.queue.shift();
          out.punch = { type, body: !!body };
          out.block = false;
        }
        this.cooldown = 0.35 + rand() * (1.4 - this.d.aggression);
      }
    }
    return out;
  }
}
