// 운전자 팔: 흰 레이싱 슈트 + 흰 장갑. 장갑은 요크 손잡이에 붙어 같이 돌고, 팔은 어깨에서 손목까지 두 마디로 따라간다.
// 치수는 전부 가정(성인 평균 체형): 위팔 0.33 m, 아래팔 0.30 m, 어깨는 눈에서 옆 0.19·아래 0.27·뒤 0.10 m.
import * as THREE from 'three';

const UPPER = 0.33, FORE = 0.30;

export function makeArms(cab, yoke, eye, grip = 0.15) {
  const suit = new THREE.MeshStandardMaterial({ color: 0xdedfdc, roughness: 0.92, envMapIntensity: 0.45 });
  const glove = new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.7, envMapIntensity: 0.45 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.8, envMapIntensity: 0.3 });
  const g = new THREE.Group(); cab.add(g);
  const seg = (r0, r1, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 20, 1), mat); m.geometry.translate(0, 0.5, 0); g.add(m); return m; };
  const ball = (r, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat); g.add(m); return m; };
  const Y = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), dir = new THREE.Vector3(), pole = new THREE.Vector3();
  const place = (m, a, b) => { dir.subVectors(b, a); m.position.copy(a); m.scale.set(1, dir.length(), 1); m.quaternion.setFromUnitVectors(Y, dir.normalize()); };

  const arms = [-1, 1].map((sx) => {
    // 장갑: 요크에 붙는다 (요크 좌표: +X 오른쪽, +Y 위, +Z 운전자 쪽)
    const hand = new THREE.Group(); hand.position.set(sx * grip, 0.005, 0.012); yoke.add(hand);
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); hand.add(m); return m; };
    add(new THREE.CapsuleGeometry(0.03, 0.062, 6, 14), glove, sx * 0.012, 0, 0.004).scale.set(0.9, 1, 1.25);          // 손등·손바닥
    for (let i = 0; i < 4; i++) add(new THREE.CapsuleGeometry(0.0105, 0.036, 4, 10), glove, sx * -0.004, 0.036 - i * 0.024, -0.03, 0, 0, Math.PI / 2 + sx * 0.2); // 손가락(테두리 뒤로 감김)
    add(new THREE.CapsuleGeometry(0.012, 0.04, 4, 10), glove, sx * -0.028, 0.03, 0.022, 0.5, 0, sx * 1.0);              // 엄지
    add(new THREE.CylinderGeometry(0.033, 0.036, 0.022, 18), trim, sx * 0.02, -0.052, 0.03, 1.0, 0, sx * -0.35);         // 손목 밴드
    const wristL = new THREE.Vector3(sx * 0.022, -0.058, 0.034);                                                        // 손목(장갑 좌표)
    return { sx, hand, wristL, shoulder: new THREE.Vector3(eye.x + sx * 0.19, eye.y - 0.27, eye.z + 0.10),
      upper: seg(0.058, 0.048, suit), fore: seg(0.048, 0.036, suit), elbow: ball(0.049, suit), cuff: ball(0.037, suit) };
  });

  const W = new THREE.Vector3(), E = new THREE.Vector3();
  return function update() {
    yoke.updateWorldMatrix(true, true);
    for (const a of arms) {
      W.copy(a.wristL); a.hand.localToWorld(W); cab.worldToLocal(W);
      dir.subVectors(W, a.shoulder); const d = Math.min(dir.length(), UPPER + FORE - 0.002); dir.normalize();
      const x = (UPPER * UPPER - FORE * FORE + d * d) / (2 * d), h = Math.sqrt(Math.max(UPPER * UPPER - x * x, 0));
      pole.set(a.sx * 0.55, -1, 0.1); pole.addScaledVector(dir, -pole.dot(dir)).normalize();
      E.copy(a.shoulder).addScaledVector(dir, x).addScaledVector(pole, h);
      tmp.copy(a.shoulder).addScaledVector(dir, d);                         // 팔이 다 펴져도 손목에 닿게
      place(a.upper, a.shoulder, E); place(a.fore, E, W.distanceTo(tmp) > 0.02 ? W : tmp);
      a.elbow.position.copy(E); a.cuff.position.copy(W);
    }
  };
}
