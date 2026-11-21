// 나무. 실물 스캔 가문비 가지 사진(Poly Haven fir_tree_01, CC0)으로 3D 나무를 한 번 조립해
// 그림 네 장(변형 4종)으로 찍어 두고, 숲에는 그 그림을 십자로 세운 판으로 심는다.
// 이유: 나무 2만 그루를 3D 그대로 그리면 너무 무겁다.
import * as THREE from 'three';

function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; }
const TWIGS = [[0.30, 0.22, 0.36, 0.38], [0.63, 0.17, 0.33, 0.38], [0.18, 0.72, 0.24, 0.2]]; // 가지 사진 속 조각 [u, v(아래 기준), 폭, 높이]

function buildTree(seed, twig, bark) {
  const r = rng(seed), tree = new THREE.Group(), H = 1, pos = [], uv = [], col = [], idx = [];
  const quad = (o, ax, up, L, W, t, shade) => { // o 에서 ax 방향으로 길이 L, 폭 W 인 가지 판
    const side = new THREE.Vector3().crossVectors(ax, up).normalize().multiplyScalar(W / 2), tip = o.clone().addScaledVector(ax, L), b = pos.length / 3;
    for (const [P, sgn, tu, tv] of [[o, -1, 0, 0], [o, 1, 1, 0], [tip, -1, 0, 1], [tip, 1, 1, 1]]) {
      pos.push(P.x + side.x * sgn, P.y + side.y * sgn, P.z + side.z * sgn); uv.push(t[0] + tu * t[2], t[1] + tv * t[3]);
      const sh = shade * (tv ? 1 : 0.45); col.push(sh, sh, sh);   // 줄기 쪽은 어둡게: 나무 속 그늘
    }
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  };
  const lean = (r() - 0.5) * 0.04;
  for (let y = 0.2 + r() * 0.06; y < 0.985; y += 0.016 + r() * 0.012) {
    const k = (1 - y) / 0.8, L = (0.03 + 0.2 * Math.pow(k, 0.85)) * (0.8 + r() * 0.4), cnt = 5 + (r() * 4 | 0), a0 = r() * 6.28;
    for (let c = 0; c < cnt; c++) {
      const a = a0 + c / cnt * 6.283 + (r() - 0.5) * 0.5, droop = -0.15 - r() * 0.35 * k + (1 - k) * 0.5;
      const ax = new THREE.Vector3(Math.cos(a) * Math.cos(droop), Math.sin(droop), Math.sin(a) * Math.cos(droop));
      const o = new THREE.Vector3(lean * y, y * H, 0), t = TWIGS[r() * 2 | 0], sh = 0.75 + r() * 0.35;
      quad(o, ax, new THREE.Vector3(0, 1, 0), L, L * 0.9, t, sh);
      quad(o, ax, new THREE.Vector3(-Math.sin(a), 0.4, Math.cos(a)), L, L * 0.75, t, sh * 0.85);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  tree.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: twig.map, alphaMap: twig.alpha, alphaTest: 0.35, side: THREE.DoubleSide, vertexColors: true })));
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.016, H, 8).translate(0, H / 2, 0), new THREE.MeshLambertMaterial({ map: bark, color: 0x8a7a6a }));
  tree.add(trunk);
  return tree;
}

// 활엽수(너도밤나무 · 참나무 느낌): 줄기 위에 둥근 잎 덩어리. 잎은 같은 가지 사진 조각을 여러 방향으로 붙여 만든다(새 사진 없이).
//   11/19 실제 온보드 대조: 노르트슐라이페 숲은 전나무만이 아니라 활엽수가 섞인 빽빽한 숲 — 측량의 근적외선 밝기로 나무마다 침엽/활엽을 가른다
function buildBroadleaf(seed, twig, bark) {
  const r = rng(seed), tree = new THREE.Group(), pos = [], uv = [], col = [], idx = [];
  const rx = 0.2 + r() * 0.03, ry = 0.3 + r() * 0.05, cy = 0.63, lean = (r() - 0.5) * 0.05;
  for (let q = 0; q < 520; q++) {
    const a = r() * 6.283, cz = r() * 2 - 1, sr = Math.sqrt(1 - cz * cz), u = Math.pow(r(), 0.4);
    const dir = new THREE.Vector3(Math.cos(a) * sr, cz, Math.sin(a) * sr);
    const o = new THREE.Vector3(lean + dir.x * rx * u, cy + dir.y * ry * u * (dir.y < 0 ? 0.8 : 1), dir.z * rx * u);
    const ax = dir.clone().add(new THREE.Vector3((r() - 0.5) * 0.9, (r() - 0.5) * 0.9 - 0.15, (r() - 0.5) * 0.9)).normalize();
    const L = 0.085 + r() * 0.06, t = TWIGS[r() * 3 | 0], sh = (0.5 + 0.55 * u) * (0.72 + 0.28 * (dir.y * 0.5 + 0.5)) * (0.85 + r() * 0.3);
    const up = Math.abs(ax.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(ax, up).normalize().multiplyScalar(L * 0.5), tip = o.clone().addScaledVector(ax, L), b = pos.length / 3;
    for (const [P, sgn, tu, tv] of [[o, -1, 0, 0], [o, 1, 1, 0], [tip, -1, 0, 1], [tip, 1, 1, 1]]) {
      pos.push(P.x + side.x * sgn, P.y + side.y * sgn, P.z + side.z * sgn); uv.push(t[0] + tu * t[2], t[1] + tv * t[3]); col.push(sh, sh, sh);
    }
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  tree.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: twig.map, alphaMap: twig.alpha, alphaTest: 0.35, side: THREE.DoubleSide, vertexColors: true })));
  tree.add(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.02, 0.55, 8).translate(lean * 0.5, 0.275, 0), new THREE.MeshLambertMaterial({ map: bark, color: 0x7a6d5e })));
  return tree;
}

export function makeForest(renderer, tex) {
  // 변형 8종(전나무 4 · 활엽수 4)을 한 장(4096×1024)에 나란히 찍는다
  const N = 8, rt = new THREE.WebGLRenderTarget(512 * N, 1024, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, colorSpace: THREE.SRGBColorSpace });
  rt.texture.anisotropy = 4;
  const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-0.25, 0.25, 1.0, 0, -2, 2);
  sc.add(new THREE.HemisphereLight(0xdfe9f5, 0x2a3320, 2.6));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.8); sun.position.set(-0.7, 0.9, 0.6); sc.add(sun);
  const old = { tm: renderer.toneMapping, cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha(), rtt: renderer.getRenderTarget() };
  renderer.toneMapping = THREE.NoToneMapping; renderer.setRenderTarget(rt); renderer.setClearColor(0x1f3318, 0); renderer.clear();
  const twig = { map: tex.twig, alpha: tex.twigA };
  for (let v = 0; v < N; v++) {
    const t = v < 4 ? buildTree(101 + v * 37, twig, tex.bark) : buildBroadleaf(301 + v * 53, twig, tex.bark); sc.add(t);
    rt.viewport.set(512 * v, 0, 512, 1024); rt.scissor.set(512 * v, 0, 512, 1024); rt.scissorTest = true;
    renderer.setRenderTarget(rt); renderer.render(sc, cam); sc.remove(t);
  }
  renderer.setRenderTarget(old.rtt); renderer.toneMapping = old.tm; renderer.setClearColor(old.cc, old.ca);

  return (group, spots) => {
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    for (let v = 0; v < N; v++) {
      const mine = spots.filter((s) => s.v === v);
      const q1 = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), geo = new THREE.BufferGeometry(), P = [], U = [], I = [];
      [0, Math.PI / 2].forEach((a, k) => { // 판 두 장을 십자로
        const g = q1.clone().rotateY(a); P.push(...g.attributes.position.array);
        for (let j = 0; j < 4; j++) U.push((v + g.attributes.uv.getX(j)) / N, g.attributes.uv.getY(j));
        I.push(...[0, 2, 1, 2, 3, 1].map((x) => x + k * 4));
      });
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(8).fill([0, 1, 0]).flat(), 3)); geo.setIndex(I);
      const mat = new THREE.MeshLambertMaterial({ map: rt.texture, alphaTest: 0.4, alphaToCoverage: true, side: THREE.DoubleSide });   // 가장자리를 부드럽게(오려 붙인 것처럼 보이지 않게)
      const mesh = new THREE.InstancedMesh(geo, mat, mine.length);
      mine.forEach((s, i) => {
        const wd = v < 4 ? 0.5 : 0.78;   // 활엽수는 옆으로 넓다
        V.set(s.p[0], s.p[1], s.p[2]); S.set(s.h * wd, s.h, s.h * wd); M.compose(V, Q.setFromAxisAngle(UP, s.rot), S); mesh.setMatrixAt(i, M);
        if (v < 4) mesh.setColorAt(i, col.setRGB(s.shade * 1.0, s.shade * 1.22, s.shade * 1.02)); else mesh.setColorAt(i, col.setRGB(s.shade * 1.28, s.shade * 1.36, s.shade * 0.85));   // 실제 숲보다 시커멓게 나와 밝게(11/19 온보드 대조)
      });
      mesh.castShadow = true;
      mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: rt.texture, alphaTest: 0.5 });
      mesh.frustumCulled = false; group.add(mesh);
    }
  };
}
