// Données de gameplay des coups (temps en secondes à endurance pleine).
// hand: 'lead' (gauche en garde orthodoxe) | 'rear'. reach: distance centre-à-centre max pour toucher.
export const MOVES = {
  jab:      { hand: 'lead', startup: 0.11, active: 0.07, recovery: 0.20, reach: 1.16, damage: 4,  stamina: 3, stun: 0.22, power: 0.30, score: 1 },
  cross:    { hand: 'rear', startup: 0.16, active: 0.07, recovery: 0.28, reach: 1.2, damage: 8,  stamina: 6, stun: 0.32, power: 0.60, score: 2 },
  hook:     { hand: 'lead', startup: 0.20, active: 0.08, recovery: 0.32, reach: 1.0, damage: 10, stamina: 8, stun: 0.38, power: 0.80, score: 2 },
  uppercut: { hand: 'rear', startup: 0.22, active: 0.08, recovery: 0.36, reach: 0.92, damage: 11, stamina: 9, stun: 0.42, power: 0.90, score: 2 },
};
export const BODY_MOD = { damage: 0.8, staminaDamage: 1.6, startup: 1.1 }; // coups au corps
export const DODGE = { dur: 0.42, invulnFrom: 0.04, invulnTo: 0.32, stamina: 5 };
export const BLOCK = { chip: 0.15, staminaDrain: 0.6, bodyLeak: 0.5 };
export const GETUP_DUR = 1.6;
export const MOVE_SPEED = { forward: 1.7, back: 1.5, strafe: 1.4, blockMul: 0.55, punchMul: 0.35 };

export function moveTotal(m, body = false) {
  return m.startup * (body ? BODY_MOD.startup : 1) + m.active + m.recovery;
}
