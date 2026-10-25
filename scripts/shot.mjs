#!/usr/bin/env node
// Captures automatiques : node scripts/shot.mjs <dossier> [--dev] [--url=http://...] [--quality=high] [--size=1280x720]
// - par défaut : build si dist/ absent puis `vite preview` (port 4173) ; --dev : serveur de dev (5173) ;
//   --url : utilise un serveur déjà lancé.
// - Chromium via Playwright (WebGL forcé en SwiftShader si besoin), combat démarré via window.__game.debug,
//   la simulation est gelée et avancée de façon déterministe entre les captures.
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const outDir = path.resolve(args.find((a) => !a.startsWith('--')) || 'shots');
const dev = args.includes('--dev');
const quality = opt('quality', 'high');
const [W, H] = opt('size', '1280x720').split('x').map(Number);
mkdirSync(outDir, { recursive: true });

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try { return req('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return req(path.join(globalRoot, 'playwright'));
}

async function waitFor(url, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('serveur injoignable : ' + url);
}

let server = null;
let base = opt('url', null);
if (!base) {
  if (!dev && !existsSync(path.join(root, 'dist/index.html'))) execSync('npx vite build', { cwd: root, stdio: 'inherit' });
  const port = dev ? 5173 : 4173;
  server = spawn('npx', ['vite', dev ? '' : 'preview', '--port', String(port), '--strictPort'].filter(Boolean), { cwd: root, stdio: 'ignore', detached: true });
  base = `http://localhost:${port}/`;
  await waitFor(base);
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const sep = base.includes('?') ? '&' : '?';
await page.goto(`${base}${sep}quality=${quality}&seed=7`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.game, null, { timeout: 60000 });

const G = (fn, arg) => page.evaluate(fn, arg);
const frames = (n = 3) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
let idx = 0;
async function shot(name) {
  await frames(3);
  const file = path.join(outDir, `${String(++idx).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  const st = await G(() => { const s = window.__game.state; return `${s.state}/${s.phase} r${s.round} ${s.time}s cam=${s.camera} ` + s.fighters.map((f) => `${f.name.split(' ')[0]}:${f.state} hp${f.health} st${f.stamina}`).join(' | '); });
  console.log(`📸 ${path.basename(file)}  ${st}`);
}

try {
  await page.waitForTimeout(1500);
  await shot('title');
  await G(() => { const d = window.__game.debug; d.startFight(); d.freeze(true); d.advance(2.0); });
  await shot('intro');
  await G(() => { const d = window.__game.debug; d.skipIntro(); d.setAI(false); d.advance(2.6); d.setPositions(1.05); d.advance(0.6); });
  await shot('guard-broadcast');
  await G(() => { const d = window.__game.debug; d.punch('jab'); d.advance(0.12); });
  await shot('jab');
  await G(() => { const d = window.__game.debug; d.advance(0.5); d.punch('cross'); d.advance(0.17); });
  await shot('cross');
  await G(() => { const d = window.__game.debug; d.advance(0.6); d.punch('hook', 'opponent'); d.advance(0.22); });
  await shot('hook-opponent');
  await G(() => { const d = window.__game.debug; d.advance(0.8); d.punch('uppercut', 'player'); d.advance(0.24); });
  await shot('uppercut');
  await G(() => { const d = window.__game.debug; d.advance(0.8); d.setCamera('close'); d.block(true, 'opponent'); d.advance(0.5); d.punch('jab'); d.advance(0.13); });
  await shot('close-block');
  await G(() => { const d = window.__game.debug; d.block(false, 'opponent'); d.setCamera('player'); d.advance(0.6); d.dodge('left', 'opponent'); d.punch('cross'); d.advance(0.15); });
  await shot('player-cam-dodge');
  await G(() => { const d = window.__game.debug; d.setCamera('broadcast'); d.setAI(true); d.advance(6); });
  await shot('ai-fight');
  await G(() => { const d = window.__game.debug; d.advance(0.3); d.ko('opponent'); d.advance(1.0); });
  await shot('knockdown');
  await G(() => { const d = window.__game.debug; d.advance(14); d.freeze(false); });
  await page.waitForTimeout(800);
  await shot('ko-end');
  const state = await G(() => window.__game.state);
  console.log('état final :', JSON.stringify({ state: state.state, result: state.result, quality: state.quality }));
  const gl = await G(() => { const g = window.__game.game.renderer.getContext(); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
  console.log('GPU :', gl);
} finally {
  if (logs.length) console.log('console :\n' + logs.slice(0, 30).join('\n'));
  await browser.close();
  if (server) { try { process.kill(-server.pid); } catch {} }
}
