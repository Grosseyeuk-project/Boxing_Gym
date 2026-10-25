// IK à deux os (bras / jambes) pour un rig dont les segments pendent le long de -Y.
import * as THREE from 'three';

const _a = new THREE.Vector3(), _t = new THREE.Vector3(), _dir = new THREE.Vector3();
const _perp = new THREE.Vector3(), _mid = new THREE.Vector3(), _end = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();

function orient(joint, from, to, front) {
  // local +Y = de `to` vers `from` (le segment pend vers -Y) ; local +Z ≈ front
  _y.subVectors(from, to).normalize();
  _z.copy(front).addScaledVector(_y, -front.dot(_y));
  if (_z.lengthSq() < 1e-8) _z.set(0, 0, 1).addScaledVector(_y, -_y.z);
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
  _z.crossVectors(_x, _y);
  _m.makeBasis(_x, _y, _z);
  _q.setFromRotationMatrix(_m);
  joint.parent.getWorldQuaternion(_pq);
  joint.quaternion.copy(_pq.invert().multiply(_q));
  joint.updateWorldMatrix(false, false);
}

/**
 * upper/lower : articulations (épaule/coude ou hanche/genou). L1, L2 en mètres monde.
 * target : position monde de l'effecteur ; pole : point monde vers lequel plier l'articulation du milieu.
 * frontSign : -1 pour les bras (biceps côté intérieur du pli), +1 pour les jambes (genou devant).
 */
export function solveTwoBone(upper, lower, L1, L2, target, pole, frontSign) {
  upper.parent.updateWorldMatrix(true, false);
  upper.getWorldPosition(_a);
  _t.subVectors(target, _a);
  const dist = _t.length();
  _dir.copy(_t).divideScalar(dist || 1);
  const d = Math.min(Math.max(dist, Math.abs(L1 - L2) + 1e-3), L1 + L2 - 1e-4);
  _perp.subVectors(pole, _a);
  _perp.addScaledVector(_dir, -_perp.dot(_dir));
  if (_perp.lengthSq() < 1e-8) _perp.set(0, -1, 0);
  _perp.normalize();
  const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _mid.copy(_a).addScaledVector(_dir, cosA * L1).addScaledVector(_perp, sinA * L1);
  _end.copy(_a).addScaledVector(_dir, d);
  const front = _perp.clone().multiplyScalar(frontSign);
  orient(upper, _a, _mid, front);
  orient(lower, _mid, _end, front);
  return d < dist - 1e-3; // true si la cible est hors de portée
}
