// 새 실내(tools/front_glass.py → data/interior/front_glass.json)를 게임 운전석에 붙인다. 자료가 없으면 null.
// 실내 좌표: x = 코끝에서 뒤로, y = 오른쪽(조수석), z = 땅에서 위로 (m).  운전석 좌표: +X 오른쪽, +Y 위, -Z 앞.
// 재질 · 무늬 값은 보기 화면(tools/viewer_template.html 의 REAL)과 같다 — 한쪽을 고치면 다른 쪽도 맞춘다.
import * as THREE from 'three';

const DIR = 'assets/private/';
const f32 = async (f) => new Float32Array(await (await fetch(DIR + f)).arrayBuffer());
const u32 = async (f) => new Uint32Array(await (await fetch(DIR + f)).arrayBuffer());
const X_C = 2.08;   // 실내 좌표의 x 에서 차 중심(게임의 원점)까지 — 눈(x 2.28)이 원점 뒤 0.2 m 에 온다 (옛 모델 운전석과 같은 자리)
const ENV = 0.35;   // 실내는 하늘빛을 덜 받는다 (지붕 · 차체에 가려지는 만큼을 대충 줄인 값)

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; return tx;
}
function makeTextures() {
  const suede = (A0, A1, A2, A3, A4) => canvasTex(512, 512, (x, w, hh) => {      // 스웨이드: 큰 얼룩 + 중간 얼룩 + 고운 알갱이 (되풀이돼도 경계가 안 보이는 잡음)
    const im = x.createImageData(w, hh); let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const layer = (cells) => { const gr = new Float32Array(cells * cells); for (let i = 0; i < gr.length; i++) gr[i] = rnd();
      return (px, py) => { const fx = px / w * cells, fy = py / hh * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const g = (i, j) => gr[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
        return (g(x0, y0) * (1 - sx) + g(x0 + 1, y0) * sx) * (1 - sy) + (g(x0, y0 + 1) * (1 - sx) + g(x0 + 1, y0 + 1) * sx) * sy; }; };
    const L1 = layer(5), L2 = layer(14), L3 = layer(48);
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
      const v = A0 + A1 * L1(i, j) + A2 * L2(i, j) + A3 * L3(i, j) + A4 * rnd(), c = Math.round(255 * Math.min(1, v)), k4 = 4 * (j * w + i);
      im.data[k4] = im.data[k4 + 1] = im.data[k4 + 2] = c; im.data[k4 + 3] = 255;
    }
    x.putImageData(im, 0, 0);
  });
  const suedeT = suede(0.60, 0.24, 0.12, 0.07, 0.05), suedeLT = suede(0.80, 0.08, 0.06, 0.05, 0.04);      // 짙은 스웨이드용 · 밝은 스웨이드용(얼룩이 옅다)
  const leatherT = canvasTex(256, 256, (x, w, hh) => {      // 가죽: 고운 주름 알갱이
    const im = x.createImageData(w, hh); let sd = 29; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const cells = 72, gr = new Float32Array(cells * cells); for (let i = 0; i < gr.length; i++) gr[i] = rnd();
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
      const fx = i / w * cells, fy = j / hh * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, g = (a, b) => gr[(b % cells) * cells + (a % cells)];
      const n = (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
      const c = Math.round(255 * Math.min(1, 0.84 + 0.14 * n + 0.03 * rnd())), k4 = 4 * (j * w + i); im.data[k4] = im.data[k4 + 1] = im.data[k4 + 2] = c; im.data[k4 + 3] = 255;
    }
    x.putImageData(im, 0, 0);
  });
  const bump = (t) => { const b = new THREE.CanvasTexture(t.image); b.wrapS = b.wrapT = THREE.RepeatWrapping; b.anisotropy = 8; return b; };      // 같은 그림을 굴곡(높낮이)으로도 쓴다
  return { suedeT, suedeLT, leatherT, suedeB: bump(suedeT), leatherB: bump(leatherT) };
}

// 삼각형의 감긴 방향을 저장된 법선에 맞춘다(모양 · 법선은 그대로, 꼭짓점 순서만).
//   좌우를 뒤집어 만든 쪽 부품(왼쪽 기둥 · 한쪽 문 · 화면 테 등 삼각형의 33%)은 감긴 방향이 법선과 반대였다. 양면 재질은 「뒷면이면 법선을 뒤집는다」를 감긴 방향으로 판단하므로,
//   그런 부품은 눈에 보이는 안쪽 면이 바깥 면의 법선으로 칠해졌다 — 바깥에서 비추는 해를 안쪽 면이 받아 기둥 · 천장이 하얗게 떴다(11/19 낮에 빛을 하나씩 꺼 보며 찾음. 전부터 있던 잘못)
function fixWinding(pos, nrm, idx) {
  for (let t = 0; t < idx.length; t += 3) {
    const a = pos[idx[t]], b = pos[idx[t + 1]], c = pos[idx[t + 2]], na = nrm[idx[t]], nb = nrm[idx[t + 1]], nc = nrm[idx[t + 2]];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    if (gx * (na[0] + nb[0] + nc[0]) + gy * (na[1] + nb[1] + nc[1]) + gz * (na[2] + nb[2] + nc[2]) < 0) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; }
  }
  return idx;
}

function planarUV(g, sc) {      // 면이 향한 쪽에 맞춰 무늬를 편다
  const P_ = g.attributes.position, N_ = g.attributes.normal, uv = new Float32Array(P_.count * 2);
  for (let i = 0; i < P_.count; i++) {
    const ax = Math.abs(N_.getX(i)), ay = Math.abs(N_.getY(i)), az = Math.abs(N_.getZ(i));
    let u_, v_; if (az >= ax && az >= ay) { u_ = P_.getX(i); v_ = P_.getY(i); } else if (ay >= ax) { u_ = P_.getX(i); v_ = P_.getZ(i); } else { u_ = P_.getY(i); v_ = P_.getZ(i); }
    uv[2 * i] = u_ * sc; uv[2 * i + 1] = v_ * sc;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export async function loadInteriorCockpit(cab, screenTex, opts = {}) {
  let D;
  try { const r = await fetch('data/interior/front_glass.json'); if (!r.ok) return null; D = await r.json(); } catch { return null; }
  if (!D.game) return null;
  const { suedeT, suedeLT, leatherT, suedeB, leatherB } = makeTextures();
  // 실내가 받는 하늘빛: tools/bake_interior_light.py 가 꼭짓점마다 「유리로 들어오는 몫」(0~1)을 미리 계산해 둔 것(data/interior/light.json).
  //   전에는 하늘빛이 지붕 · 차체에 안 가려지고 모든 면에 고르게 닿아 기둥 · 천장이 밝고 평평한 판으로 보였다 → 색을 통째로 GAIN(0.55) · 하늘 비침을 ENV(0.35)로 낮춰 얼버무렸다.
  //   구운 값이 있으면 그 얼버무림을 빼고(GAIN 1 · ENV 1) 면마다 제 몫만큼만 받게 한다 — 대시 윗면은 밝고, 기둥 안쪽 · 문 · 대시 아래는 어둡고, 구석에 그늘이 진다. 햇빛(그림자 지도)은 그대로
  let LIGHT = null;
  try { const r = await fetch('data/interior/light.json'); if (r.ok) { LIGHT = await r.json(); if (LIGHT.src_parts !== D.parts.length) LIGHT = null; } } catch { LIGHT = null; }      // 부품 수가 다르면 옛 굽기 — 쓰지 않는다
  // GAIN 0.75(구운 빛이 있을 때): 햇빛이 유리를 지나며 줄어드는 몫(비스듬한 앞유리 약 0.75 — 대충 둔 값). 볕 든 대시 윗면이 볕 든 길의 0.7배 밝기로 나와(스웨이드 0.06 대 아스팔트 0.11 이면 0.45배쯤이어야) 낮춘 것
  const GAIN = LIGHT ? 0.75 : 0.55, ENVI = LIGHT ? 1.0 : ENV;
  // 구운 값은 「환경광 가림(aoMap)」 자리로 넣는다: 0~1 회색 띠 그림을 두고 꼭짓점의 둘째 좌표(uv1)의 가로 값으로 그 띠를 읽는다 → 하늘빛 · 하늘 비침에만 곱해지고 햇빛에는 안 곱해진다
  const ramp = new THREE.DataTexture(Uint8Array.from({ length: 1024 }, (_, k) => (k % 4 === 3 ? 255 : k >> 2)), 256, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.LinearFilter; ramp.channel = 1; ramp.needsUpdate = true;
  const lit = (geo, mat, vals) => {      // vals: 꼭짓점별 값(배열) 또는 한 값
    const n = geo.attributes.position.count, u = new Float32Array(n * 2);
    for (let k = 0; k < n; k++) { u[2 * k] = Math.min(Math.max(typeof vals === 'number' ? vals : vals[k], 0.002), 0.998); u[2 * k + 1] = 0.5; }
    geo.setAttribute('uv1', new THREE.BufferAttribute(u, 2)); mat.aoMap = ramp; mat.aoMapIntensity = 1; mat.needsUpdate = true;
  };
  // 실내용 환경광(채도를 낮춘 하늘 — main.js 가 넘겨 준다). 재질에 직접 물리면 장면의 환경광 세기가 안 곱해지므로 여기서 곱한다
  const EM = opts.envMap || null, EK = EM ? (opts.envScale ?? 1) : 1;
  const base = (o) => { const r = Object.assign({ side: THREE.DoubleSide, roughness: 0.9, metalness: 0, envMapIntensity: ENVI, envMap: EM }, o); r.envMapIntensity *= EK; return r; };
  const MS = (o) => { const m = new THREE.MeshStandardMaterial(base(o)); if (!o.transparent) m.color.multiplyScalar(GAIN); return m; };
  // 스웨이드(알칸타라): 결이 선 천이라 비스듬히 볼수록 희끗하게 빛난다(sheen) + 결의 잔 굴곡. 가죽: 주름 굴곡 + 은은한 번들거림. 광택 검정: 맑은 겉칠(clearcoat)
  const SUEDE = (o) => { const m = new THREE.MeshPhysicalMaterial(base(Object.assign({ map: suedeT, roughness: 1, bumpMap: suedeB, bumpScale: 1.2, sheen: 1, sheenRoughness: 0.55 }, o))); if (!o.vertexColors) m.color.multiplyScalar(GAIN);
    const sc = (o.vertexColors ? new THREE.Color(0x5a5d67) : m.color.clone()).lerp(new THREE.Color(1, 1, 1), 0.22).multiplyScalar(0.33), sy = 0.2126 * sc.r + 0.7152 * sc.g + 0.0722 * sc.b;
    m.sheenColor = new THREE.Color(sy, sy, sy); return m; };      // 결의 빛남은 무채색(바탕 색의 밝기만 따른다)
  const LEATHER = (o) => { const m = new THREE.MeshPhysicalMaterial(base(Object.assign({ map: leatherT, bumpMap: leatherB, bumpScale: 0.9, clearcoat: 0.25, clearcoatRoughness: 0.55 }, o))); m.color.multiplyScalar(GAIN); return m; };
  const BASIC = (o) => new THREE.MeshBasicMaterial(Object.assign({ side: THREE.DoubleSide }, o));
  const REAL = {
    glass: () => MS({ color: 0xc8d6e0, transparent: true, opacity: 0.06, roughness: 0.05, depthWrite: false }),
    glass_dark: () => MS({ color: 0x0c1118, transparent: true, opacity: 0.7, roughness: 0.08, depthWrite: false }),
    glass_side: () => MS({ color: 0xb4c4d0, transparent: true, opacity: 0.1, roughness: 0.05, depthWrite: false }),
    suede: () => SUEDE({ color: 0x5a5d67 }),
    suede_light: () => SUEDE({ color: 0xc0c2c7, map: suedeLT }),      // 밝은 스웨이드는 얼룩이 옅은 무늬(짙은 무늬를 그대로 쓰면 때 묻은 것처럼 보인다 — 보조 검토)
    suede_vc: () => SUEDE({ vertexColors: true }),
    navy: () => SUEDE({ color: 0x14161d }),
    trim_dark: () => MS({ color: 0x1b1c20, roughness: 0.55 }),
    suede_dark: () => SUEDE({ color: 0x24262c }),
    suede_mid: () => SUEDE({ color: 0x40424a }),
    black: () => MS({ color: 0x08090b, roughness: 0.85 }),
    gloss: () => { const m = new THREE.MeshPhysicalMaterial(base({ color: 0x0b0c0f, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 })); m.color.multiplyScalar(GAIN); return m; },
    metal_dark: () => MS({ color: 0x282a30, roughness: 0.38, metalness: 0.35 }),
    metal_bright: () => MS({ color: 0xdfe1e5, roughness: 0.28, metalness: 0.2 }),
    metal_mid: () => MS({ color: 0x8a8d94, roughness: 0.3, metalness: 0.2 }),
    plastic: () => MS({ color: 0x1f2024, roughness: 0.9 }),
    leather: () => LEATHER({ color: 0x2a2b31, roughness: 0.48 }),
    leather_black: () => LEATHER({ color: 0x0f1013, roughness: 0.42 }),
    screen: () => BASIC({ map: screenTex, toneMapped: false }),      // 가운데 화면: 게임의 계기 그림이 그대로 나온다
    void: () => BASIC({ color: 0x000000 }),
    glow_red: () => BASIC({ color: 0xff2a14, toneMapped: false }),
    halo: () => BASIC({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }),
    shade: () => BASIC({ vertexColors: true, transparent: true, depthWrite: false }),
  };
  const TILE = { suede: 2.2, suede_light: 2.2, suede_vc: 2.2, navy: 2.2, suede_dark: 2.2, suede_mid: 2.2, leather: 5, leather_black: 5 };
  const V3 = (q) => new THREE.Vector3(q[0], q[1], q[2]);

  const g = new THREE.Group();      // 실내 좌표 → 운전석 좌표: x(뒤) → +Z, y(오른쪽) → +X, z(위) → +Y
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)));
  g.position.set(0, 0, -X_C); cab.add(g);

  for (let pi = 0; pi < D.parts.length; pi++) {
    const p = D.parts[pi];
    if (p.kind === 'yoke' || p.bin) continue;      // 요크는 아래에서 돌아가는 것으로 따로 붙인다
    const mk = REAL[p.mat]; if (!mk) continue;
    let geo;
    if (p.mesh) {
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(p.mesh.pos.flat(), 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(p.mesh.nrm.flat(), 3));
      if (p.mesh.col4) geo.setAttribute('color', new THREE.Float32BufferAttribute(p.mesh.col4.flat(), 4));
      else geo.setAttribute('color', new THREE.Float32BufferAttribute((p.mesh.col2 || p.mesh.col).flat(), 3));
      geo.setIndex(fixWinding(p.mesh.pos, p.mesh.nrm, p.mesh.tri.flat()));
    } else if (p.verts) {      // 평면 다각형: 무게중심에서 부채꼴로
      const v = p.verts.map(V3), c = new THREE.Vector3(); v.forEach((q) => c.add(q)); c.multiplyScalar(1 / v.length);
      const pos = [];
      for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; pos.push(c.x, c.y, c.z, a.x, a.y, a.z, b.x, b.y, b.z); }
      geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    } else continue;
    if (p.uvmap) {      // 화면처럼 그림을 딱 맞춰 붙이는 면
      const o_ = V3(p.uvmap.o), u_ = V3(p.uvmap.u), v_ = V3(p.uvmap.v), P_ = geo.attributes.position, uv = new Float32Array(P_.count * 2), q_ = new THREE.Vector3();
      for (let i = 0; i < P_.count; i++) { q_.fromBufferAttribute(P_, i).sub(o_); uv[2 * i] = q_.dot(u_) / u_.lengthSq(); uv[2 * i + 1] = q_.dot(v_) / v_.lengthSq(); }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    } else if (TILE[p.mat]) planarUV(geo, TILE[p.mat]);
    const m = new THREE.Mesh(geo, mk()); m.frustumCulled = false;
    if (p.mat === 'screen') {      // 화면 유리의 비침: 같은 면에 「반사만 더하는」 겹 하나(바탕 검정 · 더하기 섞기 → 유리의 반사 4% 와 해의 번쩍임만 얹힌다). 전에는 늘 같은 밝기의 발광판이었다
      const gm = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1, metalness: 0, envMap: EM, envMapIntensity: ENVI * EK, side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const gl = new THREE.Mesh(geo, gm); gl.frustumCulled = false; gl.renderOrder = 4; gl.receiveShadow = true; g.add(gl);
      const lvs = LIGHT && LIGHT.parts[pi]; if (lvs && lvs.length === geo.attributes.position.count) lit(geo, gm, lvs);
    }
    const lv = LIGHT && LIGHT.parts[pi];      // 구운 하늘빛(맑은 유리 · 빛 번짐 · 빛을 안 받는 재질은 빼고)
    if (lv && lv.length === geo.attributes.position.count && m.material.isMeshStandardMaterial && !m.material.transparent) lit(geo, m.material, lv);
    m.renderOrder = (p.mat.startsWith('glass') || p.mat === 'halo' || p.mat === 'shade') ? 5 : 0;
    // 그림자: 불투명한 부품과 짙은 지붕 유리는 햇빛을 가리고, 빛을 받는 재질은 그림자를 받는다 (맑은 유리 · 빛 번짐은 제외)
    const clear = p.mat === 'glass' || p.mat === 'glass_side' || p.mat === 'halo' || p.mat === 'shade' || p.mat === 'glow_red';
    m.castShadow = !clear; m.receiveShadow = !clear && m.material.isMeshStandardMaterial;
    g.add(m);
  }

  // 요크: 게임에 있던 메시를 허브 자리에 세운다. 테두리 · 허브는 돌고 패들은 기둥에 붙어 있다
  const G = D.game, pivot = new THREE.Group(); pivot.position.copy(V3(G.hub));
  pivot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V3(G.yu), V3(G.yv), V3(G.ya)));
  g.add(pivot);
  const yoke = new THREE.Group(); pivot.add(yoke);
  try {
    const albedo = await new THREE.TextureLoader().loadAsync(DIR + 'yoke_albedo.jpg'); albedo.colorSpace = THREE.SRGBColorSpace; albedo.anisotropy = 16;
    const ym = MS({ map: albedo, roughness: 0.62, metalness: 0.05, envMapIntensity: LIGHT ? 1.0 : 0.55 });
    for (const n of ['rim', 'hub', 'paddle']) {
      const [pp, uv, idx] = await Promise.all([f32(`yoke_${n}_pos.bin`), f32(`yoke_${n}_uv.bin`), u32(`yoke_${n}_idx.bin`)]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pp, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals();
      if (LIGHT) lit(geo, ym, LIGHT.yoke);      // 요크는 도니까 꼭짓점마다가 아니라 허브 자리의 한 값
      const ymesh = new THREE.Mesh(geo, ym); ymesh.castShadow = ymesh.receiveShadow = true; (n === 'paddle' ? pivot : yoke).add(ymesh);
    }
  } catch { /* 요크 메시가 없으면 빈 채로 */ }
  const e = G.eye;
  return { yoke, eye: new THREE.Vector3(e[1], e[2], e[0] - X_C), interior: true };
}
