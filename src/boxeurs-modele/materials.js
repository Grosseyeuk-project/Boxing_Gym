// Matériaux procéduraux des boxeurs (peau avec faux SSS via sheen, satin, cuir).
import * as THREE from 'three';

function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let skinBump = null;
function getSkinBump() {
  if (skinBump) return skinBump;
  skinBump = canvasTex(256, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let i = 0; i < s * s; i++) {
      const v = 128 + (Math.random() - 0.5) * 60;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, false);
  skinBump.repeat.set(6, 6);
  return skinBump;
}

function skinMap(tone) {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = tone.getStyle();
    ctx.fillRect(0, 0, s, s);
    // taches / variations de teint
    for (let i = 0; i < 260; i++) {
      const c = tone.clone().offsetHSL((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.08);
      ctx.fillStyle = c.getStyle();
      ctx.globalAlpha = 0.12;
      const r = 4 + Math.random() * 22;
      ctx.beginPath();
      ctx.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

export function makeMaterials(o) {
  const tone = new THREE.Color(o.skin);
  const skin = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: skinMap(tone),
    roughness: 0.52,
    bumpMap: getSkinBump(),
    bumpScale: 0.6,
    sheen: 0.35,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0.75, 0.25, 0.18), // diffusion rougeâtre (faux SSS)
    clearcoat: 0.15,            // sueur (modulée par setSweat)
    clearcoatRoughness: 0.35,
  });
  const shorts = new THREE.MeshPhysicalMaterial({ color: o.shorts, roughness: 0.42, sheen: 1, sheenRoughness: 0.3, sheenColor: new THREE.Color(o.shorts).offsetHSL(0, 0, 0.25) });
  const trim = new THREE.MeshPhysicalMaterial({ color: o.trim, roughness: 0.35, sheen: 1, sheenColor: new THREE.Color(o.trim) });
  const gloves = new THREE.MeshPhysicalMaterial({ color: o.gloves, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  const gloveTrim = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.6 });
  const wraps = new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.9 });
  const boots = new THREE.MeshPhysicalMaterial({ color: o.boots, roughness: 0.45, clearcoat: 0.3 });
  const sole = new THREE.MeshStandardMaterial({ color: 0xdedad2, roughness: 0.8 });
  const hair = new THREE.MeshStandardMaterial({ color: o.hair, roughness: 0.95 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xd8cfc4, roughness: 0.3 });
  const iris = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.15 });
  const lips = new THREE.MeshPhysicalMaterial({ color: tone.clone().offsetHSL(0, 0.05, -0.12), roughness: 0.4, sheen: 0.3, sheenColor: new THREE.Color(0.6, 0.2, 0.2) });
  const socks = new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: 0.95 });
  return { skin, shorts, trim, gloves, gloveTrim, wraps, boots, sole, hair, eyeWhite, iris, lips, socks, baseTone: tone };
}
