// 차 바깥 모델(data/exterior/body.json — 사진을 측량해 만든 부품 420개)을 게임에 올린다. 시점 전환은 js/main.js (C 키).
//   좌표: 외관 좌표(x = 코끝에서 뒤로 · y = 오른쪽 · z = 위)를 실내(js/interior.js)와 같은 basis 로 놓는다.
//   원점은 물리의 무게중심 = 외관 x 2.404 (앞축 0.8404 + 0.55 × 축간 2.8427. 물리의 뒤 하중 0.55 · 축간 2.825).
//   실내는 X_C = 2.08(눈 기준)이라 0.32 m 다르지만 둘은 동시에 보이지 않으므로 그대로 둔다 — 미결(HANDOFF 3-1).
//   차체는 cab 과 같은 pitch · roll · 내려앉음을 따라가는 묶음에, 바퀴 넷은 carGroup 바로 밑의 따로 된 묶음에(바퀴는 땅에 붙어 있고 차체만 기운다).
//   반드시 carGroup 밑에 둔다 — js/main.js draw() 의 번짐 처리가 carGroup 과 조명 말고 scene 의 자식을 숨기고, 차 묶음 밑 재질의 colorWrite 를 껐다 켠다.
import * as THREE from 'three';

export const X_CG = 2.404;
const WHEELS = {      // 바퀴 중심(외관 좌표) · 타이어 반지름
  F: { x: 0.8404, y: 0.800, z: 0.3385, r: 0.3425 },
  R: { x: 3.6831, y: 0.8085, z: 0.363, r: 0.367 },
};
export const STEER_MAX = 0.52;   // 앞바퀴 보이는 조향 한계(js/vehicle.js 의 조향 한계와 같은 값). 실제 바퀴 각은 Vehicle 이 내놓지 않아 운전대 입력 × 이 값으로 보이기만 한다(눈에 보이는 근사)

// 색 · 재질: tools/body_viewer_template.html 의 MAT 그대로. 게임 조명(해 3.1 · 하늘 환경맵 · ACES)에 맞춘 조정은 아래 TUNE (밝기만)
const D = THREE.DoubleSide;
const std = (o) => new THREE.MeshStandardMaterial({ side: D, ...o });
const phys = (o) => new THREE.MeshPhysicalMaterial({ side: D, ...o });
const basic = (o) => new THREE.MeshBasicMaterial({ side: D, ...o });
function makeMats() {
  return {
    paint: phys({ color: 0xd2d2ce, metalness: 0.30, roughness: 0.46, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
    paint_dark: std({ color: 0x8e8e8c, metalness: 0.2, roughness: 0.6 }),
    glass: phys({ color: 0x1c1410, metalness: 0.0, roughness: 0.18, clearcoat: 0.35, clearcoatRoughness: 0.1, envMapIntensity: 0.3 }),
    // 카본(문턱 아래 치마 · 코 밑 카본 띠 · 스플리터): 게임의 햇빛에서는 사진처럼 거의 검게 (사용자 11/19 「어둡게 바꾸기」).
    //   보기 화면(tools/body_viewer_template.html)의 0x62646b · 0x6e6f75 는 스튜디오 사진과 견주려고 밝게 둔 값이라 여기서는 쓰지 않는다
    carbon: std({ color: 0x26272b, metalness: 0.15, roughness: 0.55 }),
    carbon_edge: std({ color: 0x383a40, metalness: 0.25, roughness: 0.45 }),
    void: basic({ color: 0x040405 }),
    tail_red: basic({ color: 0xff2030 }),
    plate: std({ color: 0xe6e6e2, metalness: 0.1, roughness: 0.55 }),
    carbon_dark: std({ color: 0x202124, metalness: 0.15, roughness: 0.55 }),
    carbon_dark_edge: std({ color: 0x33353a, metalness: 0.25, roughness: 0.45 }),
    nozzle: std({ color: 0xb87a46, metalness: 0.85, roughness: 0.32 }),
    nozzle_in: std({ color: 0x70482c, metalness: 0.7, roughness: 0.5 }),
    nozzle_rim: std({ color: 0xe8d8be, metalness: 0.9, roughness: 0.2 }),
    reflector: std({ color: 0x8c1418, metalness: 0.1, roughness: 0.35, emissive: 0x300406 }),
    trim: phys({ color: 0x0c0c0e, metalness: 0.2, roughness: 0.25, clearcoat: 0.8 }),
    lamp: phys({ color: 0xc4c4c2, metalness: 0.30, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
    light: basic({ color: 0xffffff }),
    rubber: std({ color: 0x2a2a2d, metalness: 0, roughness: 0.9 }),
    wheel: std({ color: 0xeeeeec, metalness: 0.05, roughness: 0.6 }),
    wheel_in: std({ color: 0x141416, metalness: 0.5, roughness: 0.5 }),
    wheel_cap: phys({ color: 0x0e0e10, metalness: 0.4, roughness: 0.2, clearcoat: 0.6 }),
    wheel_dark: std({ color: 0x45474d, metalness: 0.75, roughness: 0.32 }),
  };
}
// 게임 조명에서 너무 밝으면 색 값만 곱해서 낮춘다(빛을 받는 재질만, Basic 은 건드리지 않음). 값은 화면을 보고 정한 것 — HANDOFF 3-1
const TUNE = { paint: 1, paint_dark: 1, carbon: 1, wheel: 1 };

// 가운데선에서 좌우가 이어지는 면(tools/build_body_viewer.py 의 WELD_LR · GROUP 과 같다)
const GROUP = { fender_upper_front: 'fender_upper', fender_upper_arch: 'fender_upper', fender_upper_rear: 'fender_upper' };
const WELD_LR = new Set(['hood', 'windshield', 'roof_glass', 'rear_glass', 'deck_centre', 'tail_bar', 'tail_strip', 'tail_light', 'fascia', 'tail_ledge', 'tail_valance', 'housing_top', 'housing_rim', 'housing_void', 'housing_inner', 'housing_shelf', 'plate', 'diff_floor', 'diff_floor_lip', 'diff_floor_under', 'diff_back', 'diff_ceiling', 'lightbar', 'fascia_band', 'fascia_step', 'splitter_top', 'splitter_floor', 'splitter_face', 'splitter_bottom', 'intake_ceiling', 'intake_back']);

function wheelId(p) {   // 'F_R' 처럼 앞 · 뒤 + 좌우. 바퀴가 아니면 null (wheel_well* 는 차체)
  const k = p.kind, side = p.name.slice(-1);
  if (k === 'tyre' || (k.startsWith('wheel_') && !k.startsWith('wheel_well'))) return 'F' + side;
  if (k === 'r_tyre' || k.startsWith('r_wheel_')) return 'R' + side;
  return null;
}

// 같은 묶음(kind · mat · 좌우)의 꼭짓점을 2e4 로 반올림해 합친 뒤 법선을 계산(면을 매끈하게 잇는다) → 같은 (바퀴, 재질) 끼리 한 덩어리로 이어 붙인다(그리는 횟수를 줄임)
function buildMeshes(parts, mats, off) {
  const groups = new Map();
  for (const p of parts) { const k = (GROUP[p.kind] || p.kind) + '|' + p.mat + (WELD_LR.has(p.kind) ? '' : '|' + p.name.slice(-1)); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  const byMat = new Map();
  for (const ps of groups.values()) {
    const pos = [], idx = [], map = new Map();
    for (const p of ps) {
      const loc = p.mesh.pos.map((q) => { const key = q.map((v) => Math.round(v * 2e4)).join(','); if (!map.has(key)) { map.set(key, pos.length / 3); pos.push(q[0] - off[0], q[1] - off[1], q[2] - off[2]); } return map.get(key); });
      for (const t of p.mesh.tri) { const a = loc[t[0]], b = loc[t[1]], c = loc[t[2]]; if (a !== b && b !== c && a !== c) idx.push(a, b, c); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = ps[0].mat; if (!byMat.has(m)) byMat.set(m, []); byMat.get(m).push(g);
  }
  const out = [];
  for (const [m, gs] of byMat) {
    const P = [], N = [], I = []; let base = 0;
    for (const g of gs) { P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); for (const i of g.index.array) I.push(i + base); base += g.attributes.position.count; g.dispose(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setIndex(I);
    const mesh = new THREE.Mesh(geo, mats[m] || mats.paint); mesh.castShadow = true; mesh.receiveShadow = true; out.push(mesh);
  }
  return out;
}

const BASIS = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0));   // 실내(interior.js)와 같다: 외관 x(뒤) → +Z, y(오른쪽) → +X, z(위) → +Y

// 바깥 모델을 만들어 carGroup 밑에 붙인다. 돌려주는 것: { setVisible, update(dt, car, inp, pitch, roll, sink) }
export async function loadExterior(carGroup, url = 'data/exterior/body.json') {
  const D0 = await (await fetch(url)).json();
  const mats = makeMats();
  for (const [k, s] of Object.entries(TUNE)) if (s !== 1 && mats[k]) mats[k].color.multiplyScalar(s);
  const bodyParts = [], wheelParts = { FR: [], FL: [], RR: [], RL: [] };
  for (const p of D0.parts) { const w = wheelId(p); if (w) wheelParts[w].push(p); else bodyParts.push(p); }

  // 차체: cab 과 같은 자세(main.js 가 매 프레임 rotation · position.y 를 준다)
  const body = new THREE.Group(); body.rotation.order = 'YXZ'; body.rotation.y = -Math.PI / 2;
  const bi = new THREE.Group(); bi.quaternion.setFromRotationMatrix(BASIS); bi.position.set(0, 0, -X_CG); body.add(bi);
  for (const m of buildMeshes(bodyParts, mats, [0, 0, 0])) bi.add(m);
  carGroup.add(body);

  // 바퀴: 차체 자세와 상관없이 carGroup 에 붙는다. steer(위 축) → roll(차축) 순서의 묶음, 꼭짓점은 바퀴 중심 기준
  const wroot = new THREE.Group(); wroot.rotation.y = -Math.PI / 2;
  const wi = new THREE.Group(); wi.quaternion.setFromRotationMatrix(BASIS); wi.position.set(0, 0, -X_CG); wroot.add(wi);
  const wheels = [];
  for (const [id, ps] of Object.entries(wheelParts)) {
    const W = WHEELS[id[0]], sgn = id[1] === 'R' ? 1 : -1, c = [W.x, sgn * W.y, W.z];
    const steer = new THREE.Group(); steer.position.set(...c);
    const roll = new THREE.Group(); steer.add(roll);
    for (const m of buildMeshes(ps, mats, c)) roll.add(m);
    wi.add(steer); wheels.push({ steer, roll, r: W.r, front: id[0] === 'F' });
  }
  carGroup.add(wroot);

  const all = [body, wroot];
  all.forEach((o) => { o.visible = false; });
  const ang = wheels.map(() => 0);
  return {
    wheels,      // 시험용: 바퀴 묶음(steer · roll)
    setVisible(v) { all.forEach((o) => { o.visible = v; }); },
    // 한 장마다: 차체는 cab 과 같은 값, 바퀴는 구르고(car.v · dt / 반지름) 앞바퀴는 조향(inp.steer × 0.52 — 눈에 보이는 근사)
    update(dt, car, inp, pitch, roll, sink) {
      body.rotation.set(pitch, -Math.PI / 2, roll, 'YXZ'); body.position.y = sink;
      for (let i = 0; i < wheels.length; i++) {
        const w = wheels[i]; ang[i] = (ang[i] - car.v * dt / w.r) % (2 * Math.PI);
        w.roll.rotation.y = ang[i];      // 앞으로 가면 윗면이 앞(−x)으로: 차축(y) 둘레로 음의 방향
        w.steer.rotation.z = w.front ? -(inp.steer || 0) * STEER_MAX : 0;      // 오른쪽(+)이면 앞바퀴 앞이 오른쪽으로
      }
    },
  };
}
