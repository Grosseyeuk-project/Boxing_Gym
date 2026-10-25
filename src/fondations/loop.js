// Boucle à pas fixe (simulation déterministe) + rendu interpolé.
// - update(step)                 : appelé N fois par frame à pas fixe (temps "simulé")
// - render(alpha, realDt, simDt) : une fois par frame ; alpha = fraction du pas suivant
// timeScale : ralenti global (combat-feel). hitstop(s) : gel de la simulation (temps réel).
export class FixedLoop {
  constructor({ step = 1 / 60, update, render, maxSubSteps = 8 }) {
    this.step = step;
    this.update = update;
    this.render = render;
    this.maxSubSteps = maxSubSteps;
    this.acc = 0;
    this.timeScale = 1;
    this.freezeTimer = 0;
    this.paused = false;
    this.simTime = 0;
    this.ticks = 0;
    this.running = false;
    this.last = 0;
    this.fps = 60;
    this._raf = null;
    this._frame = this._frame.bind(this);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this._raf = requestAnimationFrame(this._frame);
  }
  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }
  hitstop(seconds) {
    this.freezeTimer = Math.max(this.freezeTimer, seconds);
  }
  /** Avance la simulation de `seconds` sans rendu (debug / captures déterministes). */
  advance(seconds) {
    const n = Math.round(seconds / this.step);
    for (let i = 0; i < n; i++) this._tick();
  }
  _tick() {
    this.update(this.step);
    this.simTime += this.step;
    this.ticks++;
  }
  _frame(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._frame);
    let realDt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (realDt > 0) this.fps += (1 / realDt - this.fps) * 0.05;
    let simDt = 0;
    if (!this.paused) {
      if (this.freezeTimer > 0) {
        this.freezeTimer -= realDt;
      } else {
        simDt = realDt * this.timeScale;
        this.acc += simDt;
        let n = 0;
        while (this.acc >= this.step && n < this.maxSubSteps) {
          this._tick();
          this.acc -= this.step;
          n++;
        }
        if (n === this.maxSubSteps) this.acc = 0; // machine trop lente : on lâche du temps
      }
    }
    this.render(this.acc / this.step, realDt, simDt);
  }
}
