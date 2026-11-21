// 노면의 자잘한 흔적 — 11/19 사용자 「도로 표면도 지금은 너무 깔끔한 느낌」
//   ① 포장 이음매: 아스팔트 밝기(track.tone — 항공사진에서 잰 것)가 앞뒤로 뚜렷이 달라지는 자리에 가로로 가는 검은 줄. 자리는 잰 것
//   ② 때운 줄(균열에 역청을 부어 메운 구불구불한 검은 줄): 오래된(밝은) 포장일수록 많게 뿌린다. 자리 · 모양은 지어낸 것(가정) — 실제 균열 위치를 잰 것이 아니다
//   둘 다 사진 없이 가는 띠 메시로 그린다
import * as THREE from 'three';

function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; }
const LIFT = 0.008;

export function buildRoadWear(track, amount = 1) {
  if (!track.tone || !(amount > 0)) return null;
  const n = track.n, K = track.K, DS = track.length / n, r = rng(404);
  const pos = [], idx = [];
  const P = (u, lat) => { const i = Math.floor(u), f = u - i, a = track.at(i, lat, LIFT), b = track.at(i + 1, lat, LIFT); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; };
  const edge = (i) => { const j = ((i % n) + n) % n; return [-track.lineR(j) + 0.15, track.lineL(j) - 0.15]; };      // 흰 실선 사이
  // 점열(u, lat)을 폭 w 의 띠로: 진행 방향에 수직으로 양옆 꼭짓점
  const strip = (pts, w) => {
    const base = pos.length / 3;
    for (let k = 0; k < pts.length; k++) {
      const a = pts[Math.max(k - 1, 0)], b = pts[Math.min(k + 1, pts.length - 1)];
      const du = (b[0] - a[0]) * DS, dl = b[1] - a[1], h = Math.hypot(du, dl) || 1, ou = -dl / h * w / 2, ol = du / h * w / 2;   // 수직 방향(코스 거리 · 옆 거리)
      pos.push(...P(pts[k][0] + ou / DS, pts[k][1] + ol), ...P(pts[k][0] - ou / DS, pts[k][1] - ol));
    }
    for (let k = 0; k < pts.length - 1; k++) { const v = base + k * 2; idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); }
  };
  // ① 포장 이음매: 앞 4 m 와 뒤 4 m 의 평균 밝기 차이가 큰 곳(그 근처에서 가장 큰 점 하나)
  const rm = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 2; k < K - 2; k++) s += track.tone[i * K + k]; rm[i] = s / (K - 4); }
  const at = (i) => rm[((i % n) + n) % n], step = (i) => Math.abs(at(i + 1) + at(i + 2) - at(i - 1) - at(i - 2)) / 2;
  let seams = 0;
  for (let i = 0; i < n; i++) {
    const d = step(i); if (d < 0.14) continue;
    let top = true; for (let o = -5; o <= 5; o++) if (o && step(i + o) > d) { top = false; break; }
    if (!top) continue;
    const [lo, hi] = edge(i), pts = []; for (let q = 0; q <= 8; q++) pts.push([i + 0.5 + (r() - 0.5) * 0.02, lo + (hi - lo) * q / 8]);
    strip(pts, 0.05 + r() * 0.03); seams++;
  }
  // ② 때운 줄: 점마다 확률(밝은 포장일수록 높다)로 시작해 길을 따라 3~30 m 구불구불 이어진다. 콘크리트 뱅크(카루셀) 앞뒤는 뺀다
  const conc = new Uint8Array(n); for (const [i0, rows] of track.conc || []) for (let q = -20; q < rows.length + 5; q++) conc[(((i0 + q) % n) + n) % n] = 1;
  let snakes = 0;
  for (let i = 0; i < n; i++) {
    if (conc[i]) continue;
    const old = Math.min(Math.max((rm[i] - 0.9) / 0.5, 0), 1);
    if (r() > (0.012 + 0.11 * old) * amount) continue;
    const [lo, hi] = edge(i); if (hi - lo < 4) continue;
    let lat = lo + 0.4 + r() * (hi - lo - 0.8), drift = (r() - 0.5) * 0.12; const len = 3 + r() * r() * 27, pts = [];
    for (let s = 0; s <= len; s += 0.5) {
      const [a, b] = edge(Math.floor(i + s / DS));
      drift += (r() - 0.5) * 0.09; drift *= 0.9; lat = Math.min(Math.max(lat + drift, a + 0.2), b - 0.2);
      pts.push([i + s / DS, lat]);
    }
    strip(pts, 0.03 + r() * 0.035); snakes++;
    if (r() < 0.35) {                                                   // 곁가지(짧게 갈라진 줄)
      const k = pts.length * r() | 0, br = []; let l2 = pts[k][1], d2 = (r() < 0.5 ? -1 : 1) * (0.1 + r() * 0.2);
      for (let s = 0; s <= 1.5 + r() * 4; s += 0.5) { const u = pts[k][0] + s / DS, [a, b] = edge(Math.floor(u)); l2 = Math.min(Math.max(l2 + d2, a + 0.2), b - 0.2); d2 *= 0.85; br.push([u, l2]); }
      if (br.length > 1) strip(br, 0.03);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  // 역청: 검고 아스팔트보다 매끈해 하늘이 비친다
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.42, envMapIntensity: 1.0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide }));
  mesh.name = 'roadwear'; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.userData = { seams, snakes };
  return mesh;
}
