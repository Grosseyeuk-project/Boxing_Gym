// Audio WebAudio 100 % procédural : impacts, blocages, souffles, cloche, foule réactive, chute.
// Démarre au premier geste utilisateur (politique autoplay). S'abonne uniquement au bus.
export function createAudio(bus) {
  let ctx = null, master = null, crowdGain = null, crowdFilter = null, noiseBuf = null;
  let volume = 0.8, excitement = 0;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startCrowd();
  }
  function unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  function noise(dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.5, attack = 0.002, decay = dur, sweepTo = null, when = 0 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }
  function tone(freq, dur, { type = 'sine', gain = 0.3, attack = 0.002, sweepTo = null, when = 0 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function startCrowd() {
    // rumeur de foule : bruit filtré + modulation lente
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    crowdFilter = ctx.createBiquadFilter();
    crowdFilter.type = 'bandpass'; crowdFilter.frequency.value = 500; crowdFilter.Q.value = 0.6;
    crowdGain = ctx.createGain(); crowdGain.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.015;
    lfo.connect(lfoG).connect(crowdGain.gain);
    src.connect(crowdFilter).connect(crowdGain).connect(master);
    src.start(); lfo.start();
    // bourdonnement électrique des néons
    const hum = ctx.createOscillator(); hum.frequency.value = 50; hum.type = 'sawtooth';
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 180;
    const hg = ctx.createGain(); hg.gain.value = 0.008;
    hum.connect(hf).connect(hg).connect(master); hum.start();
  }

  function impact(power, body) {
    if (body) {
      noise(0.18, { type: 'lowpass', freq: 500, gain: 0.5 + power * 0.4, decay: 0.16 });
      tone(80, 0.18, { gain: 0.4 + power * 0.3, sweepTo: 45 });
    } else {
      noise(0.08, { type: 'highpass', freq: 1800, gain: 0.35 + power * 0.3, decay: 0.06 }); // claquement cuir/peau
      noise(0.16, { type: 'bandpass', freq: 700, q: 0.8, gain: 0.4 + power * 0.4, decay: 0.14 });
      tone(110, 0.14, { gain: 0.3 + power * 0.4, sweepTo: 50 });
    }
  }
  function bell(times = 1) {
    for (let k = 0; k < times; k++) {
      const w = k * 0.35;
      for (const [f, g] of [[820, 0.25], [1640 * 1.01, 0.12], [2460 * 0.99, 0.08], [3300, 0.04]]) tone(f, 2.2, { gain: g, when: w, attack: 0.003 });
    }
  }
  function swell(amount) { excitement = Math.min(1, excitement + amount); }

  bus.on('punchStart', (e) => {
    const heavy = e.type !== 'jab';
    noise(0.16, { type: 'bandpass', freq: 600, sweepTo: heavy ? 1600 : 2200, q: 1.5, gain: heavy ? 0.12 : 0.07, decay: 0.15 });
    if (Math.random() < 0.6) noise(0.12, { type: 'bandpass', freq: 1200, q: 0.7, gain: 0.05, decay: 0.1 }); // souffle "tss"
  });
  bus.on('hit', (e) => { impact(e.power, e.body); swell(0.15 + e.power * 0.4); });
  bus.on('block', () => { noise(0.1, { type: 'lowpass', freq: 900, gain: 0.3, decay: 0.08 }); tone(140, 0.08, { gain: 0.15, sweepTo: 90 }); });
  bus.on('knockdown', () => { setTimeout(() => { noise(0.4, { type: 'lowpass', freq: 250, gain: 0.8, decay: 0.35 }); tone(55, 0.4, { gain: 0.6, sweepTo: 35 }); }, 700); swell(1); });
  bus.on('count', () => tone(300, 0.08, { type: 'triangle', gain: 0.12 }));
  bus.on('bell', (e) => bell(e.kind === 'start' ? 1 : e.kind === 'end' ? 2 : 3));
  bus.on('ko', () => swell(1));

  function update(dt) {
    excitement = Math.max(0, excitement - dt * 0.25);
    if (crowdGain && ctx) {
      crowdGain.gain.setTargetAtTime(0.05 + excitement * 0.25, ctx.currentTime, 0.1);
      crowdFilter.frequency.setTargetAtTime(450 + excitement * 900, ctx.currentTime, 0.2);
    }
  }
  return {
    unlock, update,
    get excitement() { return excitement; },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    get volume() { return volume; },
    get context() { return ctx; },
  };
}
