// Déroulé du combat : rounds, chrono, knockdowns + compte, KO/TKO, cartes des juges.
import { restRecover, getUpRecover, createStats } from './stats.js';
import { GETUP_DUR } from './moves.js';
import { rand } from '../fondations/rng.js';

export const MATCH_DEFAULTS = { rounds: 3, roundTime: 90, restTime: 8, introTime: 2.2, endTime: 3 };

export class Match {
  constructor(bus, fighters, cfg = {}) {
    this.bus = bus;
    this.fighters = fighters;
    this.cfg = { ...MATCH_DEFAULTS, ...cfg };
    this.phase = 'idle'; // idle | roundIntro | fighting | knockdown | roundEnd | rest | ended
    this.round = 0;
    this.time = this.cfg.roundTime;
    this.phaseTime = 0;
    this.scores = [[], [], []]; // 3 juges × rounds : [ptsF0, ptsF1]
    this.result = null;
    this.down = null; // { fighter, attacker, n, getUpAt, timer }
  }

  /** Les boxeurs peuvent-ils combattre ? (sinon les contrôleurs sont ignorés) */
  get active() { return this.phase === 'fighting'; }

  start() {
    this.round = 0;
    this.scores = [[], [], []];
    this.result = null;
    for (const f of this.fighters) f.stats = createStats();
    this._nextRound();
  }

  _nextRound() {
    this.round++;
    this.time = this.cfg.roundTime;
    for (const f of this.fighters) {
      f.stats.roundPoints = 0;
      f.stats.roundKnockdowns = 0;
    }
    this.fighters[0].resetForRound(0, -1.25);
    this.fighters[1].resetForRound(0, 1.25);
    this._setPhase('roundIntro');
    this.bus.emit('hudMessage', { text: `ROUND ${this.round}`, sub: this.round === this.cfg.rounds ? 'Dernier round' : '', duration: 2 });
  }

  _setPhase(p) {
    this.phase = p;
    this.phaseTime = 0;
  }

  knockdown(fighter, attacker) {
    if (this.phase !== 'fighting') return;
    fighter.knockDown();
    fighter.stats.knockdowns++;
    fighter.stats.roundKnockdowns++;
    const n = fighter.stats.knockdowns;
    const stay = fighter.forceStayDown ||
      fighter.stats.roundKnockdowns >= 3 ||
      rand() < Math.min(0.95, (n - 1) * 0.22 + Math.max(0, 40 - fighter.stats.maxHealth) / 50);
    this.down = { fighter, attacker, n: 0, timer: 0, getUpAt: stay ? 99 : Math.min(9, 3 + Math.floor(rand() * 4) + n) };
    this._setPhase('knockdown');
    this.bus.emit('knockdown', { fighter, attacker, count: n });
    if (fighter.stats.roundKnockdowns >= 3) this._end(attacker, fighter, 'TKO', 2.5);
  }

  update(dt) {
    this.phaseTime += dt;
    switch (this.phase) {
      case 'roundIntro':
        if (this.phaseTime >= this.cfg.introTime) {
          this._setPhase('fighting');
          this.bus.emit('bell', { kind: 'start' });
          this.bus.emit('roundStart', { round: this.round });
          this.bus.emit('hudMessage', { text: 'FIGHT', duration: 0.9 });
        }
        break;
      case 'fighting':
        this.time -= dt;
        if (this.time <= 0) {
          this.time = 0;
          this._endRound();
        }
        break;
      case 'knockdown': {
        const d = this.down;
        d.timer += dt;
        if (d.getUpAt === -1) { // en train de se relever
          if (d.timer >= GETUP_DUR) this._setPhase('fighting');
          break;
        }
        if (d.timer >= 1.0 + (d.n === 0 ? 0.6 : 0)) {
          d.timer = 0;
          d.n++;
          this.bus.emit('count', { fighter: d.fighter, n: d.n });
          if (d.n >= d.getUpAt && d.n < 10) {
            d.fighter.getUp();
            getUpRecover(d.fighter.stats);
            d.getUpAt = -1;
            this.bus.emit('getUp', { fighter: d.fighter });
          } else if (d.n >= 10) {
            d.fighter.setKO();
            this._end(d.attacker, d.fighter, 'KO', 2.5);
          }
        }
        break;
      }
      case 'roundEnd':
        if (this.phaseTime >= this.cfg.endTime) {
          if (this.round >= this.cfg.rounds) this._decision();
          else {
            for (const f of this.fighters) restRecover(f.stats);
            this.fighters[0].resetForRound(-2.2, -2.2);
            this.fighters[1].resetForRound(2.2, 2.2);
            this._setPhase('rest');
          }
        }
        break;
      case 'rest':
        if (this.phaseTime >= this.cfg.restTime) this._nextRound();
        break;
      case 'ended':
        if (this._endPending != null && this.phaseTime >= this._endPending) {
          this._endPending = null;
          this.bus.emit('fightEnd', this.result);
        }
        break;
    }
  }

  _endRound() {
    this._scoreRound();
    this._setPhase('roundEnd');
    this.bus.emit('bell', { kind: 'end' });
    this.bus.emit('roundEnd', { round: this.round, scores: this.totals() });
  }

  _scoreRound() {
    const [a, b] = this.fighters.map((f) => f.stats);
    for (const card of this.scores) {
      const diff = a.roundPoints - b.roundPoints + (rand() - 0.5) * 3;
      let pa = 10, pb = 10;
      if (diff > 1.2) pb = 9; else if (diff < -1.2) pa = 9;
      pa -= a.roundKnockdowns; pb -= b.roundKnockdowns;
      card.push([Math.max(6, pa), Math.max(6, pb)]);
    }
  }

  /** Totaux par juge : [[tot0, tot1], ×3] */
  totals() {
    return this.scores.map((card) => card.reduce((t, r) => [t[0] + r[0], t[1] + r[1]], [0, 0]));
  }

  _decision() {
    const t = this.totals();
    let w0 = 0, w1 = 0;
    for (const [x, y] of t) { if (x > y) w0++; else if (y > x) w1++; }
    if (w0 === w1) this._end(null, null, 'DRAW', 0);
    else if (w0 > w1) this._end(this.fighters[0], this.fighters[1], 'DEC', 0);
    else this._end(this.fighters[1], this.fighters[0], 'DEC', 0);
  }

  _end(winner, loser, method, delay) {
    if (this.phase === 'ended') return;
    if (method === 'KO' || method === 'TKO') {
      if (loser) loser.setKO();
      this.bus.emit('ko', { winner, loser, method });
    }
    this._setPhase('ended');
    this.result = { winner, loser, method, scores: this.totals(), round: this.round, time: this.time };
    this._endPending = delay; // 'fightEnd' émis après `delay` s de simulation (ralenti KO, etc.)
    this.bus.emit('bell', { kind: 'final' });
  }
}
