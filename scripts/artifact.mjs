// Turns dist/index.html into a page body for the artifact host (it adds its own html/head/body).
import fs from 'node:fs';
const src = fs.readFileSync('dist/index.html', 'utf8');
const head = (src.match(/<head>([\s\S]*?)<\/head>/) || [, ''])[1]
  .replace(/<meta charset[^>]*>/i, '').replace(/<meta name="viewport"[^>]*>/i, '');
const body = (src.match(/<body[^>]*>([\s\S]*?)<\/body>/) || [, ''])[1];
const out = process.argv[2] || 'dist/artifact.html';
fs.writeFileSync(out, head.replace('<title>Iron Pit — Boxe</title>', '<title>Iron Pit</title>') + '\n' + body);
console.log('wrote', out);
