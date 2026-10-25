// Hook de test : window.__game (état + helpers de debug pour Playwright / critiques).
import { CAMERA_PRESETS } from '../camera/index.js';

export function installDebug(game) {
  const pick = (who) => (who === 'opponent' || who === 'ai' || who === 1 ? game.opponent : game.player);
  const snapFighter = (f) => ({
    name: f.name, state: f.state, action: f.action?.type || null,
    health: +f.stats.health.toFixed(1), maxHealth: +f.stats.maxHealth.toFixed(1), stamina: +f.stats.stamina.toFixed(1),
    knockdowns: f.stats.knockdowns, landed: f.stats.landed, thrown: f.stats.thrown,
    pos: { x: +f.pos.x.toFixed(3), z: +f.pos.z.toFixed(3) }, yaw: +f.yaw.toFixed(3),
  });
  const api = {
    game,
    bus: game.bus,
    get state() {
      const m = game.match;
      return {
        state: game.state, paused: game.paused, phase: m.phase, round: m.round, rounds: m.cfg.rounds,
        time: +m.time.toFixed(2), camera: game.cameraRig.override?.mode || game.cameraRig.mode,
        quality: game.qualityName, fps: +game.loop.fps.toFixed(1), simTime: +game.loop.simTime.toFixed(2),
        fighters: game.fighters.map(snapFighter), result: m.result ? { winner: m.result.winner?.name || null, method: m.result.method, scores: m.result.scores } : null,
      };
    },
    events: [],
    debug: {
      startFight: () => game.startFight(),
      skipIntro: () => game.skipIntro(),
      /** Force un coup : type jab|cross|hook|uppercut ; who 'player'|'opponent'. */
      punch(type = 'jab', who = 'player', body = false) {
        const f = pick(who);
        if (!f.canAct()) f._setState('idle');
        return f.startPunch(type, body);
      },
      block(on = true, who = 'player') { const f = pick(who); f._setState(on ? 'block' : 'idle'); },
      dodge(dir = 'left', who = 'player') { const f = pick(who); if (!f.canAct()) f._setState('idle'); return f.startDodge(dir); },
      /** Knockdown immédiat (le boxeur se relève ou non selon les règles). */
      knockdown(who = 'opponent') {
        const f = pick(who);
        if (game.state !== 'fight') game.skipIntro();
        game.match.phase = 'fighting';
        f.stats.health = 0;
        game.match.knockdown(f, f.opponent);
      },
      /** KO : le boxeur reste au tapis. instant=true saute le compte. */
      ko(who = 'opponent', instant = false) {
        const f = pick(who);
        f.forceStayDown = true;
        api.debug.knockdown(who);
        if (instant && game.match.down) { game.match.down.n = 9; game.match.down.timer = 1; }
      },
      setCamera(preset = 'broadcast') {
        if (!CAMERA_PRESETS.includes(preset)) return CAMERA_PRESETS;
        game.fightCamera = preset;
        game.cameraRig.setMode(preset);
        return preset;
      },
      cameraPresets: () => [...CAMERA_PRESETS],
      setAI(enabled = true) { game.ai.enabled = enabled; },
      setDifficulty: (d) => game.setDifficulty(d),
      /** Avance la simulation de `s` secondes (déterministe, sans dépendre du framerate). */
      advance(s = 1) {
        const step = game.loop.step;
        for (let i = 0, n = Math.round(s / step); i < n; i++) {
          game.loop._tick();
          game.updateVisuals(1, step, step);
        }
      },
      /** Place les boxeurs face à face à `dist` mètres. */
      setPositions(dist = 1.05, angle = 0) {
        const c = Math.cos(angle), s = Math.sin(angle);
        game.player.resetForRound(-s * dist / 2, -c * dist / 2);
        game.opponent.resetForRound(s * dist / 2, c * dist / 2);
      },
      setHealth(who, v) { pick(who).stats.health = v; },
      pause: (p = true) => game.setPaused(p),
      setQuality: (q) => game.setQuality(q),
      setTimeScale: (t) => { game.loop.timeScale = t; },
      /** Gèle/dégèle complètement la simulation (pour cadrer une capture). */
      freeze(on = true) { game.loop.paused = on; },
      hideUI(on = true) { game.hud.root.style.display = on ? 'none' : ''; },
    },
  };
  game.bus.on('*', (type, p) => {
    api.events.push({ type, t: +game.loop.simTime.toFixed(2), who: p?.attacker?.name || p?.fighter?.name || undefined, punch: p?.type });
    if (api.events.length > 200) api.events.shift();
  });
  window.__game = api;
  return api;
}
