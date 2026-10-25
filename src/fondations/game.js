// Intégration : crée chaque pièce, câble le bus, pilote les états (title → intro → fight → ended).
import * as THREE from 'three';
import { EventBus } from './events.js';
import { FixedLoop } from './loop.js';
import { Input, PlayerController } from './input.js';
import { Fighter, separate } from './fighter.js';
import { RING, SIM_STEP } from './constants.js';
import { seed } from './rng.js';
import { buildArena } from '../arene/index.js';
import { createLighting, QUALITY } from '../lumiere/index.js';
import { createPost } from '../lumiere/post.js';
import { createFighterModel, PRESETS } from '../boxeurs-modele/index.js';
import { createAnimator } from '../boxeurs-anim/index.js';
import { createFeel } from '../combat-feel/index.js';
import { AIController } from '../ia/index.js';
import { Match } from '../regles/match.js';
import { resolvePunches } from '../regles/combat.js';
import { createAudio } from '../audio/index.js';
import { createHUD } from '../hud-menus/index.js';
import { CameraRig, bindCameraEvents } from '../camera/index.js';

const lerpAngle = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };

export class Game {
  constructor(container = document.body) {
    const params = new URLSearchParams(location.search);
    this.params = params;
    seed(+(params.get('seed') || 1234));
    this.state = 'title'; // title | intro | fight | ended
    this.paused = false;
    this.time = 0;
    this.qualityName = params.get('quality') || 'high';
    this.autoQuality = !params.get('quality');

    // ---- rendu ----
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(QUALITY[this.qualityName].pixelRatio);
    r.setSize(window.innerWidth, window.innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.9;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.bus = new EventBus();
    this.input = new Input();
    this.input.attachMouse(r.domElement);

    // ---- pièces ----
    this.arena = buildArena(this.scene);
    this.lighting = createLighting(this.scene, r, this.arena.lightAnchors, this.qualityName);
    this.cameraRig = new CameraRig(window.innerWidth / window.innerHeight);
    this.post = createPost(r, this.scene, this.cameraRig.camera, this.lighting.quality);

    this.player = this._makeFighter(0, PRESETS.player, 'red');
    this.opponent = this._makeFighter(1, PRESETS.opponent, 'blue');
    this.player.opponent = this.opponent;
    this.opponent.opponent = this.player;
    this.fighters = [this.player, this.opponent];
    this.player.controller = new PlayerController(this.input);
    this.ai = new AIController({ difficulty: params.get('difficulty') || 'normal' });
    this.opponent.controller = this.ai;
    this.player.resetForRound(0, -1.25);
    this.opponent.resetForRound(0, 1.25);

    this.match = new Match(this.bus, this.fighters, params.get('roundTime') ? { roundTime: +params.get('roundTime') } : {});
    this.cameraRig.attach(this.fighters);
    bindCameraEvents(this.cameraRig, this.bus, () => this.match);
    this.loop = new FixedLoop({ step: SIM_STEP, update: (dt) => this.tick(dt), render: (a, real, sim) => this.frame(a, real, sim) });
    this.feel = createFeel(this);
    this.audio = createAudio(this.bus);
    this.hud = createHUD(this);
    this.hud.setScreen('title');
    this.cameraRig.setMode('intro');

    this.bus.on('fightEnd', () => this._setState('ended'));
    this.input.listeners.add((code) => {
      if ((code === 'Escape' || code === 'KeyP') && (this.state === 'fight' || this.state === 'intro')) this.setPaused(!this.paused);
      if ((code === 'Enter' || code === 'NumpadEnter') && (this.state === 'title' || this.state === 'ended')) this.startFight();
      if (code === 'Space' && this.state === 'intro') this.skipIntro();
    });
    window.addEventListener('resize', () => this.resize());
    this._qualityTimer = 0;
  }

  _makeFighter(id, preset, corner) {
    const f = new Fighter({ id, name: preset.name, bus: this.bus, corner });
    f.model = createFighterModel(preset);
    this.scene.add(f.model.root);
    f.animator = createAnimator(f, f.model, this.bus);
    f.renderPos = new THREE.Vector3();
    return f;
  }

  _setState(s) {
    const from = this.state;
    this.state = s;
    this.bus.emit('stateChange', { from, to: s });
  }

  start() { this.loop.start(); }

  startFight() {
    this.setPaused(false);
    this._setState('intro');
    this.match.phase = 'idle';
    for (const f of this.fighters) { f.forceStayDown = false; }
    this.player.resetForRound(0, -1.25);
    this.opponent.resetForRound(0, 1.25);
    this.loop.timeScale = 1;
    this.cameraRig.setMode('intro');
    this.hud.setScreen('fight');
    this.hud.message('IRON PIT', `${this.player.name}  vs  ${this.opponent.name}`, 3);
    this._introLeft = this.params.has('nointro') ? 0 : 4.5;
  }

  skipIntro() {
    if (this.state === 'title' || this.state === 'ended') this.startFight();
    this._introLeft = 0;
    this._beginMatch();
  }

  _beginMatch() {
    if (this.state === 'fight') return;
    this._setState('fight');
    this.cameraRig.setMode(this.fightCamera || 'broadcast');
    this.match.start();
  }

  toTitle() {
    this.setPaused(false);
    this._setState('title');
    this.match.phase = 'idle';
    this.cameraRig.setMode('intro');
    this.hud.setScreen('title');
  }

  setPaused(p) {
    if (this.state !== 'fight' && this.state !== 'intro') p = false;
    this.paused = p;
    this.loop.paused = p;
    this.input.clear();
    if (this.state === 'fight' || this.state === 'intro') this.hud.setScreen(p ? 'pause' : 'fight');
    this.bus.emit('pause', { paused: p });
  }

  setDifficulty(d) { this.ai.setDifficulty(d); }

  setQuality(name) {
    const q = QUALITY[name];
    if (!q) return;
    this.qualityName = name;
    this.renderer.setPixelRatio(q.pixelRatio);
    this.post.bloom.enabled = q.bloom;
    const key = this.lighting.key;
    key.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    key.shadow.map?.dispose(); key.shadow.map = null;
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.post.setSize(w, h);
    this.cameraRig.resize(w / h);
  }

  // ---------- simulation à pas fixe ----------
  tick(dt) {
    if (this.state === 'intro') {
      this._introLeft -= dt;
      if (this._introLeft <= 0) this._beginMatch();
    }
    const fighting = this.state === 'fight' || this.state === 'ended';
    if (fighting) this.match.update(dt);
    const active = fighting && this.match.active;
    for (const f of this.fighters) f.update(dt, active);
    separate(this.player, this.opponent, 0.9);
    if (active || this.match.phase === 'knockdown') resolvePunches(this.fighters, this.bus, this.match);
  }

  // ---------- rendu interpolé ----------
  frame(alpha, realDt, simDt) {
    this.updateVisuals(alpha, realDt, simDt);
    this.post.render(realDt, this.time);
    this._autoQuality(realDt);
  }

  /** Tout ce qui est visuel/audio, sans rendu GPU (aussi utilisé par debug.advance). */
  updateVisuals(alpha, realDt, simDt) {
    this.time += realDt;
    for (const f of this.fighters) {
      f.renderPos.lerpVectors(f.prevPos, f.pos, alpha);
      const root = f.model.root;
      root.position.set(f.renderPos.x, RING.floorY, f.renderPos.z);
      root.rotation.y = lerpAngle(f.prevYaw, f.yaw, alpha);
      f.animator.update(simDt, alpha, this.loop.step);
      const s = f.stats;
      f.model.setSweat(Math.min(1, 0.15 + (this.match.round - 1) * 0.25 + (100 - s.stamina) / 250));
      f.model.setDamage(s.headDamage / 100, s.bodyDamage / 100);
    }
    this.arena.update(realDt, this.time, this.audio.excitement);
    this.lighting.update(realDt, this.time);
    this.cameraRig.update(realDt);
    this.feel.update(realDt);
    this.audio.update(realDt);
    this.hud.update(realDt);
  }

  _autoQuality(dt) {
    if (!this.autoQuality || this.state !== 'fight' || this.paused) return;
    this._qualityTimer += dt;
    if (this._qualityTimer < 4) return;
    this._qualityTimer = 0;
    const fps = this.loop.fps;
    if (fps < 28 && this.qualityName !== 'low') this.setQuality(this.qualityName === 'high' ? 'medium' : 'low');
    else if (fps < 45 && this.qualityName === 'high') this.setQuality('medium');
    else return;
    console.info('[quality] auto ->', this.qualityName, 'fps', fps.toFixed(1));
  }
}
