// Post-process : Render → Bloom (HDR) → Output (ACES + sRGB) → Grade (vignette, grain, aberration, étalonnage).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.42 },
    uGrain: { value: 0.055 },
    uAberration: { value: 0.0012 },
    uImpact: { value: 0 },      // flash d'impact (combat-feel)
    uDamage: { value: 0 },      // voile rouge quand le joueur est sonné
    uDesat: { value: 0 },       // désaturation (ralenti KO)
    uLift: { value: new THREE.Vector3(0.012, 0.01, 0.014) },
    uGain: { value: new THREE.Vector3(1.04, 1.0, 0.94) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uAberration, uImpact, uDamage, uDesat;
    uniform vec3 uLift, uGain; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    void main(){
      vec2 c = vUv - 0.5;
      float ab = uAberration + uImpact*0.006;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + c*ab).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - c*ab).b;
      // étalonnage : ombres légèrement froides, hautes lumières chaudes
      col = col*uGain + uLift*(1.0-col);
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(col, vec3(l), 0.12 + uDesat*0.75);
      col = mix(col, col*vec3(1.25,0.55,0.5), uDamage*smoothstep(0.2,0.8,length(c)*1.4));
      col += uImpact*0.05;
      // vignette
      float v = smoothstep(0.85, 0.2, length(c*vec2(1.0,0.9))*(1.0+uVignette));
      col *= mix(1.0, v, 0.85);
      // grain animé
      float g = hash(vUv*vec2(1920.0,1080.0) + fract(uTime*7.0)*100.0) - 0.5;
      col += g*uGrain*(1.0 - l*0.5);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createPost(renderer, scene, camera, quality) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const size = renderer.getSize(new THREE.Vector2());
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.35, 0.5, 0.92);
  bloom.enabled = quality.bloom;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  return {
    composer, bloom, grade,
    uniforms: grade.uniforms,
    setSize(w, h) { composer.setSize(w, h); },
    render(dt, time) {
      grade.uniforms.uTime.value = time;
      composer.render(dt);
    },
  };
}
