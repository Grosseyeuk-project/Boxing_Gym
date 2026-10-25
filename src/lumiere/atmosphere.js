// Atmosphère : poussière en suspension dans les faisceaux + cônes de lumière volumétrique (faux).
import * as THREE from 'three';
import { RING } from '../fondations/constants.js';

function softSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createAtmosphere(scene, q) {
  const H = RING.floorY;
  // poussière
  const n = q.dust;
  const pos = new Float32Array(n * 3), seeds = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(Math.random()) * 3.6, a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = H + Math.random() * 4; pos[i * 3 + 2] = Math.sin(a) * r;
    seeds[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.022, map: softSprite(), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe8cc }));
  dust.frustumCulled = false;
  scene.add(dust);

  // cône de lumière sous la rampe (shader additif, dégradé vertical + bords doux)
  const coneGeo = new THREE.CylinderGeometry(1.6, 3.6, 4.2, 48, 1, true);
  coneGeo.translate(0, -2.1, 0);
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(1.0, 0.88, 0.7) }, uStrength: { value: 0.045 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vH; varying float vD;
      void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition-wp.xyz); vH = -position.y/4.2; vD = distance(cameraPosition, wp.xyz); gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uStrength; uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vH; varying float vD;
      void main(){ float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float fade = (1.0 - vH) * smoothstep(0.0, 0.08, vH);
        float near = smoothstep(1.0, 4.0, vD); float flick = 0.95 + 0.05*sin(uTime*13.0);
        gl_FragColor = vec4(uColor * rim * fade * uStrength * flick * near, 1.0); }`,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(0, H + 4.2, 0);
  cone.renderOrder = 10;
  scene.add(cone);

  function update(dt, time) {
    const p = geo.attributes.position.array;
    for (let i = 0; i < n; i++) {
      const s = seeds[i];
      p[i * 3] += Math.sin(time * 0.3 + s) * 0.0015;
      p[i * 3 + 1] += Math.sin(time * 0.2 + s * 1.3) * 0.0008 + 0.0003;
      p[i * 3 + 2] += Math.cos(time * 0.25 + s) * 0.0015;
      if (p[i * 3 + 1] > H + 4.2) p[i * 3 + 1] = H;
    }
    geo.attributes.position.needsUpdate = true;
    coneMat.uniforms.uTime.value = time;
  }
  return { dust, cone, update };
}
