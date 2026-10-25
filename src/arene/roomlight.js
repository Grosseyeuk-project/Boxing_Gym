// Lumières "pratiques" factices de la salle (appliques, néons, ampoules, halo du ring sur la foule).
// Plutôt que d'ajouter 20+ vraies PointLight (coûteuses pour tous les matériaux, boxeurs compris),
// on injecte dans les seuls matériaux du décor (murs, sol, gradins, foule...) une boucle d'éclairage
// diffus analytique : position, portée, couleur, cône optionnel. Intensités animées (grésillement).
import * as THREE from 'three';

export const RL_MAX = 28;

export function createRoomLights() {
  const pos = Array.from({ length: RL_MAX }, () => new THREE.Vector4(0, -100, 0, 0.001));
  const dir = Array.from({ length: RL_MAX }, () => new THREE.Vector4(0, -1, 0, -2));
  const col = Array.from({ length: RL_MAX }, () => new THREE.Vector3());
  const uniforms = { uRLPos: { value: pos }, uRLDir: { value: dir }, uRLCol: { value: col }, uRLGain: { value: 1 } };
  const lights = [];

  // def : { position: Vector3, color, intensity, range, dir?: Vector3, cone?: rad (demi-angle) }
  function add(def) {
    if (lights.length >= RL_MAX) return null;
    const i = lights.length;
    const L = { i, color: new THREE.Color(def.color), intensity: def.intensity ?? 1, level: 1, ...def };
    pos[i].set(def.position.x, def.position.y, def.position.z, def.range ?? 8);
    if (def.dir) { const d = def.dir.clone().normalize(); dir[i].set(d.x, d.y, d.z, Math.cos(def.cone ?? 1)); }
    lights.push(L);
    sync(L);
    return L;
  }
  function sync(L) {
    const k = L.intensity * L.level;
    col[L.i].set(L.color.r * k, L.color.g * k, L.color.b * k);
  }

  const VERT_DECL = 'varying vec3 vRLW;\n';
  const VERT_BODY = `
  { vec4 rlp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    rlp = instanceMatrix * rlp;
  #endif
    vRLW = (modelMatrix * rlp).xyz; }
`;
  const FRAG_DECL = `varying vec3 vRLW;
uniform vec4 uRLPos[${RL_MAX}];
uniform vec4 uRLDir[${RL_MAX}];
uniform vec3 uRLCol[${RL_MAX}];
uniform float uRLGain;
`;
  const fragBody = (wrap) => `
  {
    vec3 rlN = inverseTransformDirection(normal, viewMatrix);
    vec3 rlAcc = vec3(0.0);
    for (int i = 0; i < ${RL_MAX}; i++) {
      vec3 d = uRLPos[i].xyz - vRLW;
      float dist = max(length(d), 0.05);
      vec3 L = d / dist;
      float a = clamp(1.0 - dist / uRLPos[i].w, 0.0, 1.0);
      a = a * a / (1.0 + dist * dist * 0.15);
      float ndl = clamp((dot(rlN, L) + ${wrap.toFixed(2)}) / ${(1 + wrap).toFixed(2)}, 0.0, 1.0);
      float cone = 1.0;
      if (uRLDir[i].w > -1.5) cone = smoothstep(uRLDir[i].w - 0.12, uRLDir[i].w + 0.18, dot(-L, uRLDir[i].xyz));
      rlAcc += uRLCol[i] * (a * ndl * cone);
    }
    reflectedLight.directDiffuse += diffuseColor.rgb * rlAcc * uRLGain;
  }
`;

  // Injecte l'éclairage factice dans un matériau standard/physique. opts.wrap : diffusion enveloppante
  // (tissus/foule), opts.vertex(src) / opts.fragment(src) : retouches supplémentaires du shader.
  function patch(mat, opts = {}) {
    const wrap = opts.wrap ?? 0.15;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      let v = shader.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_DECL)
        .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY);
      let f = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + FRAG_DECL)
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + fragBody(wrap));
      if (opts.vertex) v = opts.vertex(v);
      if (opts.fragment) f = opts.fragment(f);
      shader.vertexShader = v; shader.fragmentShader = f;
    };
    const key = 'roomlit' + wrap + (opts.key || '');
    mat.customProgramCacheKey = () => key;
    return mat;
  }

  function update() { for (const L of lights) sync(L); }

  return { uniforms, lights, add, patch, update };
}
