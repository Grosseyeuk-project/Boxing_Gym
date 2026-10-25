// Santé / endurance / dégâts cumulés d'un boxeur.
// health : jauge courante (0 => knockdown). maxHealth : plafond récupérable, baisse avec les dégâts.
export function createStats() {
  return {
    health: 100, maxHealth: 100,
    stamina: 100, maxStamina: 100,
    headDamage: 0, bodyDamage: 0,   // 0..100, visuel (bleus, coupures) + plafonds
    knockdowns: 0, roundKnockdowns: 0,
    thrown: 0, landed: 0, powerLanded: 0, damageDealt: 0,
    roundPoints: 0,                  // points "activité" du round courant (juges)
    sinceHit: 99,                    // secondes depuis le dernier coup reçu
  };
}

export function applyHit(stats, dmg, body) {
  stats.health = Math.max(0, stats.health - dmg);
  stats.sinceHit = 0;
  if (body) {
    stats.bodyDamage = Math.min(100, stats.bodyDamage + dmg * 0.8);
    stats.stamina = Math.max(0, stats.stamina - dmg * 1.2);
    stats.maxStamina = Math.max(40, stats.maxStamina - dmg * 0.35);
    stats.maxHealth = Math.max(15, stats.maxHealth - dmg * 0.15);
  } else {
    stats.headDamage = Math.min(100, stats.headDamage + dmg * 0.9);
    stats.maxHealth = Math.max(15, stats.maxHealth - dmg * 0.3);
  }
}

/** Récupération continue (appelée à chaque pas de simulation). */
export function tickStats(stats, dt, state) {
  stats.sinceHit += dt;
  const busy = state === 'punch' || state === 'dodge';
  const regen = state === 'block' ? 4 : busy ? 0 : 11;
  stats.stamina = Math.min(stats.maxStamina, stats.stamina + regen * dt * (0.5 + 0.5 * stats.maxStamina / 100));
  if (stats.sinceHit > 2.5 && state !== 'down' && state !== 'ko') {
    stats.health = Math.min(stats.maxHealth, stats.health + 1.6 * dt);
  }
}

/** Récupération entre les rounds. */
export function restRecover(stats) {
  stats.health = Math.min(stats.maxHealth, stats.health + (stats.maxHealth - stats.health) * 0.6 + 10);
  stats.stamina = stats.maxStamina;
  stats.roundKnockdowns = 0;
}

/** Récupération après s'être relevé d'un knockdown. */
export function getUpRecover(stats) {
  stats.maxHealth = Math.max(15, stats.maxHealth * 0.8);
  stats.health = Math.max(stats.health, stats.maxHealth * 0.45);
  stats.stamina = Math.max(stats.stamina, stats.maxStamina * 0.5);
}

export function staminaFactor(stats) {
  return 0.6 + 0.4 * (stats.stamina / 100);
}
