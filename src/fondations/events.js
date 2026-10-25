// Bus d'événements minimal : les pièces communiquent sans se connaître.
//
// Événements émis (payloads) — contrat entre pièces, à étendre sans casser :
//   'stateChange'  { from, to }                       état global du jeu (title/intro/fight/ended)
//   'pause'        { paused }
//   'roundStart'   { round }
//   'roundEnd'     { round, scores }
//   'bell'         { kind: 'start'|'end'|'final' }
//   'punchStart'   { attacker, type, body }           un coup est lancé (whoosh, souffle)
//   'whiff'        { attacker, defender, type }       coup dans le vide
//   'dodge'        { attacker, defender, type }       coup esquivé
//   'block'        { attacker, defender, type, body, damage, point }
//   'hit'          { attacker, defender, type, body, damage, power(0..1), counter, point, dir }
//   'knockdown'    { fighter, attacker, count }        fighter au tapis (count = n° de knockdown)
//   'count'        { fighter, n }                      compte de l'arbitre (1..10)
//   'getUp'        { fighter }
//   'ko'           { winner, loser, method }           method: 'KO' | 'TKO'
//   'fightEnd'     { winner, loser, method, scores }   method: 'KO' | 'TKO' | 'DEC' | 'DRAW'
//   'hudMessage'   { text, sub, duration }
// Les objets attacker/defender/fighter sont des instances de Fighter (src/fondations/fighter.js).
export class EventBus {
  constructor() {
    this.map = new Map();
  }
  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type).add(fn);
    return () => this.off(type, fn);
  }
  once(type, fn) {
    const off = this.on(type, (p) => {
      off();
      fn(p);
    });
    return off;
  }
  off(type, fn) {
    this.map.get(type)?.delete(fn);
  }
  emit(type, payload = {}) {
    const set = this.map.get(type);
    if (set) for (const fn of [...set]) {
      try { fn(payload); } catch (e) { console.error(`[bus] ${type} handler failed`, e); }
    }
    const all = this.map.get('*');
    if (all) for (const fn of [...all]) fn(type, payload);
  }
}
