// Blender 로 만든 운전석 모델(tools/cockpit_model.py)을 읽어 붙인다. 없으면 null.
// 구석의 어두움(주변광 가림)은 Blender 에서 정점마다 구워 온 값을 색에 곱한다.
import * as THREE from 'three';

const DIR = 'assets/private/';
const f32 = async (f) => new Float32Array(await (await fetch(DIR + f)).arrayBuffer());
const u32 = async (f) => new Uint32Array(await (await fetch(DIR + f)).arrayBuffer());
export const MODEL_OFFSET = new THREE.Vector3(0, 0, 0.2);   // 모델 원점(눈 바로 아래 땅)을 차 안 어디에 둘지

const LOOK = {
  suede: { roughness: 0.96, envMapIntensity: 0.5 },
  carbon: { roughness: 0.42, metalness: 0.2, envMapIntensity: 0.9 },
  white: { roughness: 0.72, envMapIntensity: 0.6 },
  gloss: { roughness: 0.12, metalness: 0.3, envMapIntensity: 1.0 },
  trim: { roughness: 0.3, metalness: 1 },
  rubber: { roughness: 0.9, envMapIntensity: 0.4 },
};

export async function loadModelCockpit(cab, screenTex) {
  let meta;
  try { const r = await fetch(DIR + 'model.json'); if (!r.ok) return null; meta = await r.json(); } catch { return null; }
  const g = new THREE.Group(); g.position.copy(MODEL_OFFSET); cab.add(g);
  await Promise.all(Object.keys(meta.groups).map(async (name) => {
    const [pos, nrm, ao] = await Promise.all([f32(`model_${name}_pos.bin`), f32(`model_${name}_nrm.bin`), f32(`model_${name}_ao.bin`)]);
    const col = new Float32Array(ao.length * 3);
    for (let i = 0; i < ao.length; i++) { const a = 0.25 + 0.75 * ao[i]; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = a; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const c = new THREE.Color().setRGB(...meta.color[name]);
    const mat = name === 'red' ? new THREE.MeshBasicMaterial({ color: 0xff2a14, toneMapped: false })
      : name === 'glass' ? new THREE.MeshPhysicalMaterial({ color: 0x0b1014, transparent: true, opacity: 0.2, roughness: 0.02, metalness: 0, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false })
      : name === 'paint' ? new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.32, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: c, vertexColors: true, ...LOOK[name] });
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; if (name === 'glass') m.renderOrder = 5; g.add(m);
  }));

  // 가운데 화면
  {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(meta.screen.flat()), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
    geo.setIndex([0, 3, 2, 0, 2, 1]);
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, side: THREE.DoubleSide })));
  }

  // 요크: 영상 때 만든 3D 메시가 있으면 쓴다. 허브에서 운전자 눈을 본다
  const eye = new THREE.Vector3(...meta.eye), hub = new THREE.Vector3(...meta.hub);
  const pivot = new THREE.Group(); pivot.position.copy(hub);
  pivot.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, hub, new THREE.Vector3(0, 1, 0)));
  g.add(pivot);
  const yoke = new THREE.Group(); pivot.add(yoke);
  try {
    const albedo = await new THREE.TextureLoader().loadAsync(DIR + 'yoke_albedo.jpg'); albedo.colorSpace = THREE.SRGBColorSpace; albedo.anisotropy = 16;
    const ym = new THREE.MeshStandardMaterial({ map: albedo, roughness: 0.62, metalness: 0.05, side: THREE.DoubleSide, envMapIntensity: 0.55 });
    for (const n of ['rim', 'hub', 'paddle']) {
      const [p, uv, idx] = await Promise.all([f32(`yoke_${n}_pos.bin`), f32(`yoke_${n}_uv.bin`), u32(`yoke_${n}_idx.bin`)]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals();
      (n === 'paddle' ? pivot : yoke).add(new THREE.Mesh(geo, ym));
    }
  } catch { /* 요크 메시가 없으면 빈 채로 */ }
  return { yoke, eye: eye.add(MODEL_OFFSET), meta };
}
