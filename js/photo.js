// 사진 운전석(3D): 실내 사진을 단순한 3D 실내 면에 투영한 메시 + 3D 요크. 눈은 운전석 시트 자리.
// 자료는 tools/build_cockpit3d.py 가 assets/private/ 에 만든다(사진에서 나온 것이라 git 에 넣지 않는다). 없으면 null → 모델링 운전석.
import * as THREE from 'three';

const DIR = 'assets/private/';
const bin = async (f, T) => new T(await (await fetch(DIR + f)).arrayBuffer());
const geom = (pos, uv, idx) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); return g;
};

export async function loadPhotoCockpit(cab, screenTex) {
  let meta;
  try { const r = await fetch(DIR + 'cockpit3d.json'); if (!r.ok) return null; meta = await r.json(); } catch { return null; }
  const L = new THREE.TextureLoader();
  const names = ['rim', 'hub', 'paddle'];
  const [plate, glass, albedo, pos, uv, idx, ...yk] = await Promise.all([
    L.loadAsync(DIR + 'cockpit_plate.jpg'), L.loadAsync(DIR + 'cockpit_glass.png'), L.loadAsync(DIR + 'yoke_albedo.jpg'),
    bin('cockpit3d_pos.bin', Float32Array), bin('cockpit3d_uv.bin', Float32Array), bin('cockpit3d_idx.bin', Uint32Array),
    ...names.flatMap((n) => [bin(`yoke_${n}_pos.bin`, Float32Array), bin(`yoke_${n}_uv.bin`, Float32Array), bin(`yoke_${n}_idx.bin`, Uint32Array)]),
  ]);
  plate.colorSpace = albedo.colorSpace = THREE.SRGBColorSpace; plate.anisotropy = albedo.anisotropy = 16;
  const g = new THREE.Group(); cab.add(g);

  // 실내: 사진 색 그대로(빛 계산 없음), 유리 자리는 그리지 않는다.
  // 사진 아래쪽(좌석·콘솔)은 실제로는 운전자 뒤·옆이라 앞에 보이면 안 된다 → 어둡게 지운다
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: plate }, mask: { value: glass }, gain: { value: 1.35 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D map, mask; uniform float gain; varying vec2 vUv; void main(){ if (texture2D(mask, vUv).r > 0.5) discard; vec3 c = texture2D(map, vUv).rgb * gain; c = mix(vec3(0.012, 0.012, 0.014), c, smoothstep(0.30, 0.37, vUv.y)); gl_FragColor = vec4(c, 1.0); \n#include <colorspace_fragment>\n }',
    side: THREE.DoubleSide,
  });
  const shell = new THREE.Mesh(geom(pos, uv, idx), mat); shell.frustumCulled = false; g.add(shell);

  // 가운데 화면
  {
    const s = meta.screen.flat(), sg = geom(new Float32Array(s), new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), new Uint32Array([0, 3, 2, 0, 2, 1]));
    g.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, side: THREE.DoubleSide })));
  }

  // 요크: 허브에서 운전자 눈을 똑바로 본다. 테두리·허브는 돌고, 패들은 기둥에 붙어 안 돈다
  const eye = new THREE.Vector3(...meta.eye), hub = new THREE.Vector3(...meta.hub);
  const pivot = new THREE.Group(); pivot.position.copy(hub);
  pivot.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, hub, new THREE.Vector3(0, 1, 0)));
  g.add(pivot);
  const yoke = new THREE.Group(); pivot.add(yoke);
  const ym = new THREE.MeshStandardMaterial({ map: albedo, roughness: 0.62, metalness: 0.05, side: THREE.DoubleSide, envMapIntensity: 0.55 });
  names.forEach((n, i) => {
    const gm = geom(yk[i * 3], yk[i * 3 + 1], yk[i * 3 + 2]); gm.computeVertexNormals();
    (n === 'paddle' ? pivot : yoke).add(new THREE.Mesh(gm, ym));
  });
  return { yoke, eye, meta };
}
