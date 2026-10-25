// Entrées clavier + souris. Codes physiques (e.code) : WASD = ZQSD sur AZERTY.
// Les appuis sont mis en tampon (buffer) pour être consommés par le PlayerController.
export const CONTROLS = [
  ['Déplacement', 'W A S D (ZQSD en AZERTY) / flèches'],
  ['Jab (bras avant)', 'Clic gauche ou J'],
  ['Direct (bras arrière)', 'Clic droit ou K'],
  ['Crochet', 'U'],
  ['Uppercut', 'I'],
  ['Coup au corps', 'Maintenir Maj (Shift) + coup'],
  ['Garde / blocage', 'Maintenir Espace'],
  ['Esquive', 'L ou C (+ direction : gauche / droite / recul)'],
  ['Pause', 'Échap ou P'],
];

const KEYMAP = {
  KeyJ: 'jab', KeyK: 'cross', KeyU: 'hook', KeyI: 'uppercut',
  KeyL: 'dodge', KeyC: 'dodge',
};

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.buffer = []; // { action, time }
    this.mouse = { left: false, right: false };
    this.enabled = true;
    this.listeners = new Set(); // callbacks(code) pour les menus
    target.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      for (const l of this.listeners) l(e.code, e);
      if (e.repeat) return;
      this.down.add(e.code);
      const a = KEYMAP[e.code];
      if (a) this.push(a);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.mouse.left = this.mouse.right = false; });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  attachMouse(el) {
    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.left = true; this.push('jab'); }
      if (e.button === 2) { this.mouse.right = true; this.push('cross'); }
      if (e.button === 1) { e.preventDefault(); this.push('dodge'); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
  }
  push(action) {
    if (!this.enabled) return;
    this.buffer.push({ action, time: performance.now(), body: this.isDown('ShiftLeft', 'ShiftRight') });
  }
  isDown(...codes) {
    return codes.some((c) => this.down.has(c));
  }
  /** Retire et renvoie la plus ancienne action encore valide (fenêtre de tampon en ms). */
  take(windowMs = 250) {
    const now = performance.now();
    while (this.buffer.length && now - this.buffer[0].time > windowMs) this.buffer.shift();
    return this.buffer.shift() || null;
  }
  peek() { return this.buffer[0] || null; }
  clear() { this.buffer.length = 0; }
}

/** Transforme l'état d'Input en intention de combat (même format que l'IA). */
export class PlayerController {
  constructor(input) {
    this.input = input;
  }
  intent(fighter) {
    const i = this.input;
    const f = (i.isDown('KeyW', 'ArrowUp') ? 1 : 0) - (i.isDown('KeyS', 'ArrowDown') ? 1 : 0);
    const s = (i.isDown('KeyD', 'ArrowRight') ? 1 : 0) - (i.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    const out = { moveF: f, moveS: s, punch: null, block: i.isDown('Space'), dodge: null };
    // On ne consomme le tampon que si le boxeur peut agir (sinon l'appui reste en attente).
    if (fighter.canAct()) {
      const b = i.take();
      if (b) {
        if (b.action === 'dodge') out.dodge = s < 0 ? 'left' : s > 0 ? 'right' : f < 0 ? 'back' : 'duck';
        else out.punch = { type: b.action, body: b.body };
      }
    }
    return out;
  }
}
