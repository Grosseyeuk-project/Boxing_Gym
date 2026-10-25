// Combat-feel : hit-stop, secousse caméra, ralenti (knockdown/KO), flash d'impact, gouttelettes.
// S'abonne uniquement au bus ; agit via game.loop, game.cameraRig, game.post.
import { DropletSystem } from './particles.js';

export function createFeel(game) {
  const { bus, loop } = game;
  const drops = new DropletSystem(game.scene);
  let impact = 0, damage = 0, desat = 0;
  let slowmo = null; // { scale, remaining }

  function setSlowmo(scale, seconds) {
    slowmo = { scale, remaining: seconds };
    loop.timeScale = scale;
  }

  bus.on('hit', (e) => {
    const p = e.power;
    loop.hitstop(0.03 + p * 0.09 + (e.counter ? 0.04 : 0));
    game.cameraRig.addTrauma(0.12 + p * 0.45);
    impact = Math.min(1, impact + 0.3 + p * 0.7);
    const dir = e.dir.clone(); dir.y = 0.15;
    drops.burst(e.point, dir, Math.round(10 + p * 30), 0xdfe8ee, 1.8 + p * 2.5);
    if (p > 0.55 && e.defender.stats.headDamage > 30 && !e.body) drops.burst(e.point, dir, Math.round(4 + p * 10), 0x6a0a08, 1.6 + p * 2);
    if (e.defender === game.player) damage = Math.min(1, damage + p * 0.8);
  });
  bus.on('block', (e) => {
    loop.hitstop(0.025);
    game.cameraRig.addTrauma(0.08);
    drops.burst(e.point, e.dir, 5, 0xdfe8ee, 1.2);
  });
  bus.on('knockdown', () => { setSlowmo(0.3, 1.4); game.cameraRig.addTrauma(0.6); desat = 0.6; });
  bus.on('ko', () => { setSlowmo(0.25, 2.2); desat = 1; });
  bus.on('roundStart', () => { desat = 0; });

  function update(realDt) {
    if (slowmo) {
      slowmo.remaining -= realDt;
      if (slowmo.remaining <= 0) { slowmo = null; loop.timeScale = 1; }
    }
    impact = Math.max(0, impact - realDt * 6);
    damage = Math.max(0, damage - realDt * 0.8);
    if (game.player) damage = Math.max(damage, game.player.stats.health < 25 ? 0.35 : 0);
    desat = Math.max(0, desat - realDt * 0.3);
    const u = game.post?.uniforms;
    if (u) { u.uImpact.value = impact; u.uDamage.value = damage; u.uDesat.value = desat; }
    drops.update(realDt * loop.timeScale * (loop.freezeTimer > 0 ? 0 : 1));
  }

  return { update, drops, setSlowmo };
}
