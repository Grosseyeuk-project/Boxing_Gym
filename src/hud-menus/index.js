// HUD minimal façon diffusion TV + menus (titre, pause/réglages, fin de combat). DOM pur.
import { CSS } from './style.js';
import { CONTROLS } from '../fondations/input.js';

const fmt = (t) => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

export function createHUD(game) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = document.createElement('div');
  ui.id = 'ui';
  const ctlRows = CONTROLS.map(([a, k]) => `<tr><td>${a}</td><td>${k}</td></tr>`).join('');
  ui.innerHTML = `
  <div id="hud" class="hidden">
    <div class="plate left"><div class="name"><i class="corner" style="background:#b3191f"></i><span data-n="0"></span></div>
      <div class="bar"><div class="cap" data-cap="0"></div><div class="fill" data-h="0"></div></div><div class="bar stam"><div class="fill" data-s="0"></div></div></div>
    <div id="clock"><div class="rnd">ROUND <b data-round>1</b>/<b data-rounds>3</b></div><div class="time" data-time>3:00</div></div>
    <div class="plate right"><div class="name"><span data-n="1"></span><i class="corner" style="background:#1f45b3"></i></div>
      <div class="bar"><div class="cap" data-cap="1"></div><div class="fill" data-h="1"></div></div><div class="bar stam"><div class="fill" data-s="1"></div></div></div>
  </div>
  <div id="msg"></div>
  <div id="count" class="hidden"></div>
  <div id="title" class="panel"><div class="box">
    <h1>IRON <span>PIT</span></h1><div class="tag">Boxe clandestine · combat en 3 rounds</div>
    <button class="btn" data-act="fight">▶ Combattre (Entrée)</button>
    <div class="row"><span>Difficulté</span><select data-set="difficulty"><option>facile</option><option selected>normal</option><option>difficile</option></select></div>
    <table class="ctl">${ctlRows}</table>
  </div></div>
  <div id="pause" class="panel hidden"><div class="box">
    <h2>PAUSE</h2>
    <button class="btn" data-act="resume">Reprendre (Échap)</button>
    <div class="row"><span>Qualité graphique</span><select data-set="quality"><option>low</option><option>medium</option><option selected>high</option></select></div>
    <div class="row"><span>Volume</span><input type="range" min="0" max="1" step="0.05" value="0.8" data-set="volume"></div>
    <div class="row"><span>Difficulté</span><select data-set="difficulty"><option>facile</option><option selected>normal</option><option>difficile</option></select></div>
    <button class="btn" data-act="restart">Recommencer le combat</button>
    <button class="btn" data-act="title">Menu principal</button>
    <table class="ctl">${ctlRows}</table>
  </div></div>
  <div id="end" class="panel hidden"><div class="box">
    <h2 data-result>VICTOIRE</h2><div class="tag" data-method></div><div class="cards" data-cards></div>
    <button class="btn" data-act="restart">Revanche</button>
    <button class="btn" data-act="title">Menu principal</button>
  </div></div>
  <div id="hint" class="hidden">Échap : pause · réglages et contrôles</div>`;
  document.body.appendChild(ui);
  const $ = (s) => ui.querySelector(s);
  const $$ = (s) => [...ui.querySelectorAll(s)];

  ui.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    game.audio?.unlock();
    if (act === 'fight' || act === 'restart') game.startFight();
    if (act === 'resume') game.setPaused(false);
    if (act === 'title') game.toTitle();
  });
  ui.addEventListener('change', (e) => {
    const k = e.target.dataset.set;
    if (k === 'quality') game.setQuality(e.target.value);
    if (k === 'volume') game.audio?.setVolume(+e.target.value);
    if (k === 'difficulty') { game.setDifficulty(e.target.value); $$('[data-set=difficulty]').forEach((s) => (s.value = e.target.value)); }
  });
  ui.addEventListener('input', (e) => { if (e.target.dataset.set === 'volume') game.audio?.setVolume(+e.target.value); });

  let msgTimer = 0;
  function message(text, sub = '', duration = 1.5) {
    const m = $('#msg');
    m.innerHTML = `${text}${sub ? `<span class="sub">${sub}</span>` : ''}`;
    m.classList.add('show');
    msgTimer = duration;
  }
  game.bus.on('hudMessage', (e) => message(e.text, e.sub, e.duration));
  game.bus.on('knockdown', (e) => { message('KNOCKDOWN', e.fighter.name, 1.4); });
  game.bus.on('count', (e) => { const c = $('#count'); c.classList.remove('hidden'); c.textContent = e.n; });
  game.bus.on('getUp', () => $('#count').classList.add('hidden'));
  game.bus.on('ko', (e) => { $('#count').classList.add('hidden'); message(e.method === 'KO' ? 'K.O.' : 'T.K.O.', e.winner?.name || '', 3); });
  game.bus.on('roundEnd', (e) => message(`FIN DU ROUND ${e.round}`, '', 2));
  game.bus.on('fightEnd', (r) => showEnd(r));

  function show(id, on) { $(id).classList.toggle('hidden', !on); }

  function showEnd(r) {
    const win = r.winner === game.player;
    $('[data-result]').textContent = r.method === 'DRAW' ? 'MATCH NUL' : win ? 'VICTOIRE' : 'DÉFAITE';
    const how = { KO: 'par K.O.', TKO: 'par K.O. technique', DEC: 'aux points', DRAW: 'décision partagée' }[r.method];
    $('[data-method]').textContent = `${r.winner ? r.winner.name + ' gagne ' : ''}${how} · round ${r.round}`;
    $('[data-cards]').innerHTML = r.scores.length && r.scores[0][0] ? r.scores.map((s, i) => `Juge ${i + 1} : ${s[0]} – ${s[1]}`).join('<br>') : '';
    show('#end', true); show('#hud', false); show('#hint', false);
  }

  function setScreen(name) {
    show('#title', name === 'title');
    show('#pause', name === 'pause');
    show('#end', name === 'end');
    const inFight = name === 'fight' || name === 'pause';
    show('#hud', name === 'fight');
    show('#hint', name === 'fight');
    if (!inFight) $('#count').classList.add('hidden');
  }

  function update(dt) {
    if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $('#msg').classList.remove('show'); }
    const fs = game.fighters;
    if (!fs) return;
    fs.forEach((f, i) => {
      $(`[data-n="${i}"]`).textContent = f.name;
      $(`[data-h="${i}"]`).style.width = `${f.stats.health}%`;
      $(`[data-cap="${i}"]`).style.width = `${f.stats.maxHealth}%`;
      $(`[data-s="${i}"]`).style.width = `${(f.stats.stamina / 100) * 100}%`;
    });
    const m = game.match;
    if (m) {
      $('[data-round]').textContent = Math.max(1, m.round);
      $('[data-rounds]').textContent = m.cfg.rounds;
      $('[data-time]').textContent = m.phase === 'rest' ? `${fmt(m.cfg.restTime - m.phaseTime)}` : fmt(m.time);
    }
  }

  return { update, setScreen, message, root: ui };
}
