// 코스: data/track.json (2판 — tools/ring/build_track.py 가 측량 자료에서 만든다) → 도로 · 연석 · 가드레일 · 땅 · 숲 메시.
//   점마다(2 m 간격): 실제 중심선 x · y, 고도 z, 포장 끝까지 거리 wl(왼쪽) · wr(오른쪽), 길 단면 높이 prof(K 칸 — 뱅크가 여기 들어 있다),
//   길 옆 땅 높이 gl · gr(포장 끝에서 D m 떨어진 곳들), 가드레일 거리 bl · br, 옆으로 갈 수 있는 거리 rl · rr(다른 구간과의 중간선).
//   11/18 사용자 「서킷 모양좀 실제랑 똑같이 … 고저차나 지형구조물 … 카루셀」 — 전에는 폭 9 m 평평한 띠에 식으로 만든 땅이었다.
// 좌표: 코스 (x 동, y 북, z 높이) → three.js (x, z, -y)
import * as THREE from 'three';

export const HALF = 4.5;      // 대표 반폭 (실제 폭은 점마다 wl · wr — 이 값은 옛 도구 호환용)
export const WALL = 8.0;      // 대표 가드레일 거리 (실제는 점마다 bl · br)
const KERB_H = 0.07;          // 연석 바깥 끝 높이 m (가정 — 실제 연석은 5~10 cm 로 솟고 톱니가 있다)

function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; }

export class Track {
  constructor(data) {
    if (data.v !== 2) throw new Error('data/track.json 이 2판이 아니다 — tools/ring/build_track.py 로 다시 만든다');
    const n = this.n = data.x.length, K = this.K = data.K, D = this.D = data.D, nd = this.nd = D.length;
    const f32 = (a) => Float32Array.from(a);
    this.x = f32(data.x); this.y = f32(data.y); this.z = f32(data.z);
    this.wl = f32(data.wl); this.wr = f32(data.wr); this.bl = f32(data.bl); this.br = f32(data.br);
    this.reach = [f32(data.rl), f32(data.rr)];
    const pu = data.pu || 1;                                           // 길 단면 눈금: 1 cm 당 pu 칸(mm 로 저장하면 10)
    this.prof = Float32Array.from(data.prof, (v) => v / pu); this.gl = Int16Array.from(data.gl); this.gr = Int16Array.from(data.gr);   // cm, 중심 z 대비
    const arr = (a) => f32(a || new Array(n).fill(0));
    this.kl = arr(data.kl); this.kr = arr(data.kr);                    // 연석 폭 m (포장 끝 안쪽, 없으면 0)
    this.ll = data.ll ? f32(data.ll) : null; this.lr = data.lr ? f32(data.lr) : null;   // 흰 실선까지의 옆 거리 m (항공사진에서 잰 자리. 옛 자료에는 없다 → 포장 끝 · 연석 안쪽 0.2 m)
    this.fl = arr(data.fl); this.fr = arr(data.fr);                    // 펜스 높이 m (없으면 0)
    this.boxes = []; this.far = null;                                   // 건물 상자 · 먼 지형 (data/scene.json — main.js 가 넣는다)
    this.wood = Uint8Array.from(data.wood || new Array(n).fill(3));     // 1 왼쪽 · 2 오른쪽이 숲
    this.pit = Uint8Array.from(data.pit || new Array(n).fill(0));       // 1 왼쪽 · 2 오른쪽 가드레일이 피트 벽(콘크리트)
    this.sections = data.sections || []; this.conc = data.conc || []; this.bridges = data.bridges || []; this.trees = data.trees || null;
    // 노면에서 잰 것(tools/ring/surface.py — 항공사진): 낙서 단계(점마다 흰 선 사이 GC 칸, 0~9) · 아스팔트 밝기(점마다 흰 선 사이 K 자리, 주변 대비)
    this.GC = data.GC || 8; this.graf = data.graf ? Uint8Array.from(data.graf, (ch) => ch.charCodeAt(0) - 48) : null;
    this.tone = data.tone ? Float32Array.from(data.tone, (ch) => 0.40 + (ch.charCodeAt(0) - 33) * 0.015) : null;
    this.tx = new Float32Array(n); this.ty = new Float32Array(n); this.grade = new Float32Array(n);
    this.nx = new Float32Array(n); this.ny = new Float32Array(n);       // 왼쪽 법선 (앞뒤 점으로 잡은 접선 기준 — 만드는 쪽과 같은 식)
    this.k = new Float32Array(n); this.s = new Float32Array(n + 1);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, dx = this.x[j] - this.x[i], dy = this.y[j] - this.y[i], d = Math.hypot(dx, dy);
      this.tx[i] = dx / d; this.ty[i] = dy / d; this.grade[i] = (this.z[j] - this.z[i]) / d; this.s[i + 1] = this.s[i] + d;
      const h = (i - 1 + n) % n, cx = this.x[j] - this.x[h], cy = this.y[j] - this.y[h], c = Math.hypot(cx, cy);
      this.nx[i] = -cy / c; this.ny[i] = cx / c;
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.k[i] = (this.tx[i] * this.ty[j] - this.ty[i] * this.tx[j]) / (this.s[i + 1] - this.s[i]); // 왼쪽 굽이 +
    }
    this.length = this.s[n];
    this.ghost = data.ghost;
  }
  // 길 옆 땅 칸 k 의 옆 거리(중심에서, 양수): 가드레일 선 + D[k](첫 칸 = 가드레일 바로 뒤 갓길), 단 다른 구간 · 굽이 안쪽 너머(reach)로는 안 간다
  gLat(i, left, k) { const w = left ? this.wl[i] : this.wr[i], b = left ? this.bl[i] : this.br[i]; return Math.min(b + this.D[k], Math.max(this.reach[left ? 0 : 1][i], w + 1)); }
  // 점 i 의 단면에서 옆 거리 lat(왼쪽 +)의 높이 — 중심 z 대비 m. 길 안은 prof, 밖은 땅 높이 사이를 곧게 잇는다
  hAt(i, lat) {
    const n = this.n; i = (i % n + n) % n;
    const K = this.K, wl = this.wl[i], wr = this.wr[i];
    if (lat <= wl && lat >= -wr) {
      const u = (lat + wr) / (wl + wr) * (K - 1), k = Math.min(Math.max(Math.floor(u), 0), K - 2), o = i * K + k;
      // 연석: 안쪽 끝은 노면 높이, 바깥으로 갈수록 KERB_H 까지 솟는다 (11/19 사용자 「연석 높낮이는 왜 없는거야」)
      const kl = this.kl[i], kr = this.kr[i], up = kl > 0 && lat > wl - kl ? (lat - (wl - kl)) / kl : kr > 0 && lat < -wr + kr ? (-wr + kr - lat) / kr : 0;
      return (this.prof[o] + (this.prof[o + 1] - this.prof[o]) * (u - k)) / 100 + up * KERB_H;
    }
    const left = lat > 0, a = Math.abs(lat), g = left ? this.gl : this.gr, o = i * this.nd;
    let pa = left ? wl : wr, ph = this.prof[i * K + (left ? K - 1 : 0)];
    for (let k = 0; k < this.nd; k++) {
      const ca = this.gLat(i, left, k), ch = g[o + k];
      if (a <= ca) return (ca - pa > 1e-3 ? ph + (ch - ph) * (a - pa) / (ca - pa) : ch) / 100;
      pa = ca; ph = ch;
    }
    return ph / 100;
  }
  // 중심선 점 i 에서 왼쪽으로 lat 만큼, 그 자리 땅(길) 위로 h → three.js 좌표 [x, 높이, z]
  at(i, lat, h = 0) {
    const n = this.n; i = (i % n + n) % n;
    return [this.x[i] + this.nx[i] * lat, this.z[i] + this.hAt(i, lat) + h, -(this.y[i] + this.ny[i] * lat)];
  }
  // 흰 실선의 가운데까지 옆 거리(양수): 왼쪽 · 오른쪽
  lineL(i) { return this.ll ? this.ll[i] : this.wl[i] - this.kl[i] - 0.2; }
  lineR(i) { return this.lr ? this.lr[i] : this.wr[i] - this.kr[i] - 0.2; }
  // 점 i · 옆 거리 lat 의 아스팔트 밝기(1 = 주변 평균). 흰 선 밖(연석 · 가장자리)은 선 쪽 값
  toneAt(i, lat) {
    if (!this.tone) return 1;
    const K = this.K, lo = -this.lineR(i) + 0.5, hi = this.lineL(i) - 0.5;      // 잴 때와 같은 범위: 흰 선에서 0.5 m 안쪽끼리
    const u = Math.min(Math.max((lat - lo) / Math.max(hi - lo, 1), 0), 1) * (K - 1), k = Math.min(Math.floor(u), K - 2), o = i * K + k;
    return Math.min(Math.max(this.tone[o] + (this.tone[o + 1] - this.tone[o]) * (u - k), 0.5), 1.7);
  }
  // 숲: 자료에 나무 자리(측량에서 뽑은 것)가 있으면 그대로, 없으면 가드레일 밖에 고르게 뿌린다
  forestSpots() {
    const spots = [], r = rng(11);
    if (this.trees) {
      const t = this.trees, m = t.x.length;
      for (let j = 0; j < m; j++) spots.push({ p: [t.x[j], t.z[j] - 0.3, -t.y[j]], h: t.h[j], rot: r() * 6.28, shade: 0.7 + r() * 0.3, v: (t.t[j] ? 4 : 0) + (r() * 4 | 0) });   // t: 0 침엽수 · 1 활엽수
      return spots;
    }
    const n = this.n;
    for (let i = 0; i < n; i += 2) for (const sd of [1, -1]) {
      if (i % 10 === 8 || !(this.wood[i] & (sd > 0 ? 1 : 2))) continue;   // 4 m 마다 심되 다섯 번에 한 번은 건너뛴다 = 옛 판(5 m 마다)과 같은 빽빽함
      const cnt = 2 + (r() * 3 | 0), b = sd > 0 ? this.bl[i] : this.br[i];
      for (let c = 0; c < cnt; c++) {
        const lat = sd * (b + 4.5 + r() * r() * 95), ii = (i + (r() * 2 | 0)) % n, h = 13 + r() * 14, rot = r() * 6.28, shade = 0.7 + r() * 0.3, v = r() * 4 | 0;
        if (Math.abs(lat) > this.reach[sd > 0 ? 0 : 1][ii] - 4) continue;
        spots.push({ p: this.at(ii, lat, -0.3), h, rot, shade, v });
      }
    }
    return spots;
  }

  // 차 위치 → 코스 위 가장 가까운 곳. hint 근처만 찾는다.
  //   z · grade · bank 는 차가 있는 옆 자리의 값(뱅크 안이면 뱅크의 높이 · 기울기): bank = 왼쪽으로 1 m 갈 때 오르는 높이
  locate(px, py, hint, span = 40) {
    const n = this.n; let best = hint, bd = Infinity;
    for (let o = -span; o <= span; o++) {
      const i = ((hint + o) % n + n) % n, d = (px - this.x[i]) ** 2 + (py - this.y[i]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    let i = best, dx = px - this.x[i], dy = py - this.y[i];
    let along = dx * this.tx[i] + dy * this.ty[i];
    if (along < 0) { i = (i - 1 + n) % n; dx = px - this.x[i]; dy = py - this.y[i]; along = dx * this.tx[i] + dy * this.ty[i]; }
    const seg = this.s[i + 1] - this.s[i], f = Math.min(Math.max(along / seg, 0), 1), j = (i + 1) % n, g = 1 - f;
    const lat = -dx * this.ty[i] + dy * this.tx[i];             // 왼쪽 +
    const za = this.z[i] + this.hAt(i, lat), zb = this.z[j] + this.hAt(j, lat), T = 0.85;   // T: 좌우 바퀴까지 거리
    const bank = ((this.hAt(i, lat + T) - this.hAt(i, lat - T)) * g + (this.hAt(j, lat + T) - this.hAt(j, lat - T)) * f) / (2 * T);
    return {
      i, f, s: this.s[i] + f * seg, lat, z: za * g + zb * f, grade: (zb - za) / seg, bank, tx: this.tx[i], ty: this.ty[i],
      wl: this.wl[i] * g + this.wl[j] * f, wr: this.wr[i] * g + this.wr[j] * f, bl: this.bl[i] * g + this.bl[j] * f, br: this.br[i] * g + this.br[j] * f,
      kerb: (this.kl[i] > 0 && lat > this.wl[i] - this.kl[i] - 0.85 && lat < this.wl[i] + 0.85) || (this.kr[i] > 0 && lat < -this.wr[i] + this.kr[i] + 0.85 && lat > -this.wr[i] - 0.85),   // 바퀴가 연석 위에 있는가
    };
  }
  findNearest(px, py) { return this.locate(px, py, 0, this.n); }
  // 지금 달리는 구간 이름 (OSM 구간 이름 — 화면 표시용)
  sectionAt(s) { let nm = ''; for (const [name, s0] of this.sections) { if (s0 <= s) nm = name; else break; } return nm || (this.sections.length ? this.sections[this.sections.length - 1][0] : ''); }

  // tex: 사진 재질(아스팔트·풀·숲 바닥), makeTrees: 나무 심는 함수
  build(scene, tex, makeTrees) {
    const n = this.n, K = this.K, nd = this.nd, g = new THREE.Group();
    const at = (i, lat, h = 0) => this.at(i, lat, h);
    // 띠 메시: cols(i) = 그 점 단면의 옆 거리 목록(왼쪽 → 오른쪽, 길이는 늘 같다), lift = 땅 위로 띄우는 높이(숫자 또는 칸별 목록).
    //   재질 사진은 tile 미터마다 반복. pick(i) 가 거짓이면 그 점 ~ 다음 점 사이 칸은 만들지 않는다
    //   uvU(i) 를 주면 가로 무늬 좌표를 그것으로(세워진 띠 — 펜스)
    const ribbon = (cols, mat, tile = 4, step = 1, lift = 0, pick = null, uvU = null) => {
      const m = Math.floor(n / step), w = cols(0).length, pos = [], uv = [], idx = [];
      for (let r = 0; r <= m; r++) {
        const i = (r % m) * step, sv = (r === m ? this.length : this.s[i]) / tile, c = cols(i);
        const lf = typeof lift === 'function' ? lift(i) : lift, uu = uvU ? uvU(i) : null;
        for (let q = 0; q < w; q++) { pos.push(...at(i, c[q], typeof lf === 'number' ? lf : lf[q])); uv.push(uu ? uu[q] : c[q] / tile, sv); }
      }
      for (let r = 0; r < m; r++) {
        if (pick && !pick((r % m) * step)) continue;
        for (let c = 0; c < w - 1; c++) { const a = r * w + c, b = a + 1, d = a + w, e = d + 1; idx.push(a, b, d, b, e, d); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      const c0 = cols(0);
      if (Math.abs(c0[0] - c0[w - 1]) > 0.5 && idx.length && geo.attributes.normal.getY(idx[0]) < 0) { geo.setIndex(idx.reverse()); geo.computeVertexNormals(); }
      const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; g.add(mesh); return mesh;
    };
    const roadCols = (i) => { const wl = this.wl[i], wr = this.wr[i], c = new Array(K); for (let k = 0; k < K; k++) c[k] = wl - (wl + wr) * k / (K - 1); return c; };
    const sideCols = (left, k0, k1) => (i) => {   // 길 옆 땅: 포장 끝(k = -1) 또는 칸 k0 부터 k1 까지
      const c = []; for (let k = k0; k <= k1; k++) c.push((left ? 1 : -1) * (k < 0 ? (left ? this.wl[i] : this.wr[i]) : this.gLat(i, left, k)));
      return left ? c.reverse() : c;
    };

    // 아스팔트(실물 스캔 사진) + 흰 실선
    const roadMesh = ribbon(roadCols, new THREE.MeshStandardMaterial({ map: tex.asphalt, normalMap: tex.asphaltN, roughnessMap: tex.asphaltR, color: new THREE.Color(6.9, 7.8, 7.5), roughness: 0.86, envMapIntensity: 0.75, normalScale: new THREE.Vector2(1.2, 1.2) }), 3.2);
    //   아스팔트 반사율: 스캔 사진의 평균은 0.015(젖은 듯 새까맣다) → 마른 아스팔트의 0.11 로 올리고 붉은 기를 뺀다(색 배수 6.9 · 7.8 · 7.5 — 하늘빛을 받아 푸르게 뜨는 만큼 푸른 쪽을 조금 덜 올린다).
    //   11/19 아침까지는 반사율을 0.02 로 둔 채 하늘 반사로만 밝게 보이게 했다 → 노면이 하늘색(남색)으로 뜨고, 밝기 변화 · 때운 줄 · 고무 자국을 넣어도 안 보였다
    // 아스팔트 밝기: 새 포장 · 옛 포장 · 때운 자리 · 주행선의 고무 자국이 실제 자리에 실제 만큼 (11/19 사용자 「도로 표면도 지금은 너무 깔끔한 느낌」)
    if (this.tone) {
      const col = new Float32Array((n + 1) * K * 3);
      for (let r = 0; r <= n; r++) { const i = r % n, c = roadCols(i); for (let q = 0; q < K; q++) { const t = this.toneAt(i, c[q]); col.set([t, t, t], (r * K + q) * 3); } }
      roadMesh.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); roadMesh.material.vertexColors = true;
    }
    const paint = new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: 0.6, normalMap: tex.asphaltN, polygonOffset: true, polygonOffsetFactor: -2 });
    ribbon((i) => { const a = this.lineL(i); return [a + 0.08, a - 0.08]; }, paint, 3.2, 1, 0.006);     // 흰 실선(폭 16 cm): 항공사진에서 잰 자리 — 연석 · 가장자리 띠의 안쪽
    ribbon((i) => { const a = this.lineR(i); return [-a + 0.08, -a - 0.08]; }, paint, 3.2, 1, 0.006);

    // 콘크리트 뱅크(카루셀): 안쪽 띠를 밝은 콘크리트 판으로 덮는다 — conc = [[시작 점, [옆 거리 안쪽, 바깥쪽] …], …]
    if (this.conc.length) {
      // 콘크리트 판: 길이 약 3 m 판이 이어지고 판마다 밝기가 조금씩 다르다(항공사진 · 온보드 3:50 에서 본 모습). 사진을 깔지 않고 그려서 만든다
      const slab = canvasTex(64, 512, (c) => {
        ['#8e8a80', '#868278', '#938f85', '#8a867c'].forEach((col, q) => { c.fillStyle = col; c.fillRect(0, q * 128, 64, 128); c.fillStyle = '#5f5c56'; c.fillRect(0, q * 128, 64, 5); });
        c.fillStyle = 'rgba(0,0,0,.06)'; for (let q = 0; q < 700; q++) c.fillRect(Math.random() * 64, Math.random() * 512, 2, 2);
      });
      const cm = new THREE.MeshStandardMaterial({ map: slab, roughness: 0.9, normalMap: tex.asphaltN, normalScale: new THREE.Vector2(0.5, 0.5), polygonOffset: true, polygonOffsetFactor: -1.5 });
      const lo = new Float32Array(n).fill(NaN), hi = new Float32Array(n).fill(NaN);
      for (const [i0, rows] of this.conc) rows.forEach(([a, b], q) => { lo[(i0 + q) % n] = a; hi[(i0 + q) % n] = b; });
      const NC = 5, has = (i) => !Number.isNaN(lo[i]) && !Number.isNaN(lo[(i + 1) % n]);
      ribbon((i) => { const c = []; const a = Number.isNaN(lo[i]) ? 0 : lo[i], b = Number.isNaN(hi[i]) ? 0 : hi[i]; for (let q = 0; q < NC; q++) c.push(b + (a - b) * q / (NC - 1)); return b > a ? c : c.reverse(); }, cm, 12, 1, 0.004, has);
    }

    // 풀밭과 숲 바닥 — 높이는 측량 그대로. 먼 쪽(30 m 밖)은 그 옆이 숲이면 숲 바닥, 아니면 풀
    const grass = new THREE.MeshStandardMaterial({ map: tex.grass, normalMap: tex.grassN, color: 0x88a84e, roughness: 1 });   // 실사: 풀은 누르스름한 밝은 초록
    const floor = new THREE.MeshStandardMaterial({ map: tex.forest, color: 0x8a8a70, roughness: 1 });
    const kFar = Math.max(this.D.findIndex((d) => d >= 25), 1);
    for (const left of [true, false]) {
      const bit = left ? 1 : 2;
      ribbon(sideCols(left, -1, kFar), grass, 5);
      ribbon(sideCols(left, kFar, nd - 1), floor, 7, 2, 0, (i) => this.wood[i] & bit);
      ribbon(sideCols(left, kFar, nd - 1), grass, 7, 2, 0, (i) => !(this.wood[i] & bit));
    }

    // 연석: 포장 끝 안쪽 kl · kr m 를 빨강·흰색으로 (사진에서 잰 곳 + 못 잰 굽이 안쪽)
    const kerb = canvasTex(8, 64, (c) => { c.fillStyle = '#b3261d'; c.fillRect(0, 0, 8, 32); c.fillStyle = '#dcdcd6'; c.fillRect(0, 32, 8, 32); });
    kerb.magFilter = THREE.NearestFilter;
    const km = new THREE.MeshStandardMaterial({ map: kerb, roughness: 0.75, normalMap: tex.asphaltN, polygonOffset: true, polygonOffsetFactor: -3 });
    ribbon((i) => { const k = Math.max(this.kl[i], 0.05), w = this.wl[i]; return [w, w - k * 0.5, w - k]; }, km, 3, 1, 0.012, (i) => this.kl[i] > 0 && this.kl[(i + 1) % n] > 0);
    ribbon((i) => { const k = Math.max(this.kr[i], 0.05), w = this.wr[i]; return [-w + k, -w + k * 0.5, -w]; }, km, 3, 1, 0.012, (i) => this.kr[i] > 0 && this.kr[(i + 1) % n] > 0);

    // 가드레일: 양쪽 물결 강판 2단 + 기둥 (거리는 점마다 bl · br)
    const rail = new THREE.MeshStandardMaterial({ color: 0xaeb3b7, roughness: 0.34, metalness: 0.8, envMapIntensity: 0.9, side: THREE.DoubleSide });   // 아연 도금 강판: 하늘이 비쳐 밝게 뜬다
    const beam = [[0, 0], [0.05, 0.05], [0, 0.11], [0, 0.2], [0.05, 0.26], [0, 0.31]];
    for (const sd of [1, -1]) for (const y0 of [0.16, 0.48, 0.8]) {   // 3단 (온보드 대조 11/19: 실제는 3단이 길에 바짝)
      ribbon((i) => beam.map(([d]) => sd * ((sd > 0 ? this.bl[i] : this.br[i]) - d)), rail, 4, 1, beam.map(([, y]) => y0 + y)).castShadow = true;
    }
    const postGeo = new THREE.BoxGeometry(0.09, 1.2, 0.12), posts = new THREE.InstancedMesh(postGeo, rail, Math.ceil(n / 2) * 2);
    const M = new THREE.Matrix4(); let pi = 0;
    for (let i = 0; i < n; i += 2) for (const sd of [1, -1]) { const p = at(i, sd * ((sd > 0 ? this.bl[i] : this.br[i]) + 0.1), 0.5); M.makeTranslation(p[0], p[1], p[2]); posts.setMatrixAt(pi++, M); }
    g.add(posts);

    // 피트 벽: 가드레일 자리에 빨강·흰색 콘크리트 벽 (출발 직선 — 벽 뒤가 포장된 피트 · 패독인 구간)
    {
      const wt = canvasTex(8, 64, (c) => { c.fillStyle = '#b3261d'; c.fillRect(0, 0, 8, 32); c.fillStyle = '#d9d9d3'; c.fillRect(0, 32, 8, 32); });
      wt.magFilter = THREE.NearestFilter;
      const wm = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.85, side: THREE.DoubleSide });
      for (const sd of [1, -1]) {
        const bit = sd > 0 ? 1 : 2, bb = sd > 0 ? this.bl : this.br;
        ribbon((i) => [sd * (bb[i] - 0.25), sd * (bb[i] - 0.25)], wm, 8, 1, [1.1, 0], (i) => (this.pit[i] & bit) && (this.pit[(i + 1) % n] & bit), () => [0.3, 0]).castShadow = true;
      }
    }

    // 펜스: 가드레일 0.5 m 뒤의 철망(그려서 만든 무늬)과 기둥 — 측량에 펜스 높이의 것이 잡힌 구간만
    {
      const wire = canvasTex(64, 64, (c) => { c.clearRect(0, 0, 64, 64); c.strokeStyle = 'rgba(205,210,214,0.95)'; c.lineWidth = 1.6; for (let q = -64; q < 128; q += 16) { c.beginPath(); c.moveTo(q, 0); c.lineTo(q + 64, 64); c.stroke(); c.beginPath(); c.moveTo(q + 64, 0); c.lineTo(q, 64); c.stroke(); } });
      const fm = new THREE.MeshBasicMaterial({ map: wire, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, color: 0x9aa0a4 });
      const pm = new THREE.MeshStandardMaterial({ color: 0x7e8388, roughness: 0.6, metalness: 0.6 }), spots = [];
      for (const sd of [1, -1]) {
        const fh = sd > 0 ? this.fl : this.fr, bb = sd > 0 ? this.bl : this.br;
        ribbon((i) => [sd * (bb[i] + 0.5), sd * (bb[i] + 0.5)], fm, 0.8, 1, (i) => [Math.max(fh[i], 0.1), 0], (i) => fh[i] > 0 && fh[(i + 1) % n] > 0, (i) => [Math.max(fh[i], 0.1) / 0.8, 0]);
        for (let i = 0; i < n; i += 2) if (fh[i] > 0) spots.push([i, sd * (bb[i] + 0.5), fh[i]]);
      }
      if (spots.length) {
        const fp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 1, 0.07), pm, spots.length), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
        spots.forEach(([i, lat, h], q) => { const p = at(i, lat, h / 2); M.compose(V.set(p[0], p[1], p[2]), Q, Sc.set(1, h, 1)); fp.setMatrixAt(q, M); });
        g.add(fp);
      }
    }

    // 건물: 측량(지표−지형)에서 뽑은 상자 [x, y, 바닥 높이, 길이, 폭, 높이, 방향, 코스 위 여부]
    if (this.boxes.length) {
      const wallM = new THREE.MeshStandardMaterial({ color: 0xb4b6b2, roughness: 0.9 });
      for (const [bx, by, base, ln, wd, h, ang, over] of this.boxes) {
        if (over) continue;
        const m = new THREE.Mesh(new THREE.BoxGeometry(ln, h, wd), wallM); m.position.set(bx, base + h / 2, -by); m.rotation.y = ang; m.castShadow = m.receiveShadow = true; g.add(m);
      }
    }

    // 코스 위를 지나는 다리 · 간판 틀: bridges = [[점 번호, 코스 방향 폭 m, 바닥 높이 m, 두께 m, 왼쪽 끝, 오른쪽 끝], …]
    if (this.bridges.length) {
      const deck = new THREE.MeshStandardMaterial({ color: 0x8c8f92, roughness: 0.85 });
      for (const [i, len, clear, thick, l0, r0] of this.bridges) {
        const l = Math.max(l0, this.bl[i] + 1.2), r = Math.max(r0, this.br[i] + 1.2);   // 받침은 가드레일 밖에 선다(자료의 폭이 좁으면 가드레일 밖까지 늘린다)
        const span = l + r, mid = (l - r) / 2, c = at(i, mid, 0), y = this.z[i] + clear + thick / 2;
        const box = new THREE.Mesh(new THREE.BoxGeometry(len, thick, span), deck);
        box.position.set(c[0], y, c[2]); box.rotation.y = Math.atan2(this.ty[i], this.tx[i]); box.castShadow = box.receiveShadow = true; g.add(box);
        for (const lat of [l - 0.6, -r + 0.6]) {      // 양쪽 받침
          const p = at(i, lat, 0), hgt = this.z[i] + clear - p[1];
          if (hgt < 0.5) continue;
          const pier = new THREE.Mesh(new THREE.BoxGeometry(len * 0.8, hgt, 1.0), deck);
          pier.position.set(p[0], p[1] + hgt / 2, p[2]); pier.rotation.y = box.rotation.y; pier.castShadow = true; g.add(pier);
        }
      }
    }

    // 먼 지형(능선): 20 m 격자. 높이 h(0.1 m), 숲 높이 c(m), 코스까지 거리 d(2 m 단위). 색은 꼭짓점 색 — 숲은 짙은 초록, 들판은 밝은 초록.
    //   숲은 나무 높이의 일부만큼 올려 멀리서 덩어리로 보이게 하고, 코스 가까이(길 옆 땅과 겹치는 곳)는 조금 내려 깜빡임을 막는다
    if (this.far) {
      const F = this.far, pos = new Float32Array(F.nx * F.ny * 3), col = new Float32Array(F.nx * F.ny * 3), idx = [], ok = new Uint8Array(F.nx * F.ny), r = rng(7);
      for (let j = 0, q = 0; j < F.ny; j++) for (let i = 0; i < F.nx; i++, q++) {
        const h = F.h[q], d = F.d[q] * 2, c = F.c[q]; ok[q] = h > -32000 ? 1 : 0;
        const up = Math.min(Math.max((d - 110) / 110, 0), 1), dn = d < 125 ? 0.8 : 0, fo = Math.min(c / 12, 1), n = 1;   // 칸마다 색을 흔들면 세모꼴이 그대로 보인다(11/19 「폴리곤월드」) → 흔들지 않는다
        pos[q * 3] = F.x0 + i * F.step; pos[q * 3 + 1] = (ok[q] ? h / 10 : 0) + c * 0.75 * up - dn; pos[q * 3 + 2] = -(F.y0 + j * F.step);
        col[q * 3] = (0.36 - 0.24 * fo) * n; col[q * 3 + 1] = (0.46 - 0.25 * fo) * n; col[q * 3 + 2] = (0.2 - 0.11 * fo) * n;
      }
      for (let j = 0; j < F.ny - 1; j++) for (let i = 0; i < F.nx - 1; i++) {
        const a = j * F.nx + i, b = a + 1, c = a + F.nx, e = c + 1;
        if (!(ok[a] && ok[b] && ok[c] && ok[e]) || Math.min(F.d[a], F.d[b], F.d[c], F.d[e]) * 2 < 88) continue;
        idx.push(a, b, c, b, e, c);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const fm = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); fm.frustumCulled = false; g.add(fm);
    }

    // 숲
    makeTrees(g, this.forestSpots());

    // 출발선
    {
      const lm = new THREE.MeshStandardMaterial({ color: 0xe6e6e0, roughness: 0.7, normalMap: tex.asphaltN, polygonOffset: true, polygonOffsetFactor: -3 });
      const a = at(0, this.wl[0], 0.008), b = at(0, -this.wr[0], 0.008), c = at(1, this.wl[1], 0.008), d = at(1, -this.wr[1], 0.008), q = 1.2 / (this.s[1] - this.s[0]);
      const mix = (p, r) => p.map((v, k) => v + (r[k] - v) * q), geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...mix(a, c), ...mix(b, d)], 3));
      geo.setIndex([0, 1, 2, 1, 3, 2]); geo.computeVertexNormals();
      if (geo.attributes.normal.getY(0) < 0) { geo.setIndex([0, 2, 1, 1, 2, 3]); geo.computeVertexNormals(); }
      const sl = new THREE.Mesh(geo, lm); sl.receiveShadow = true; g.add(sl);
    }
    scene.add(g);
  }
}

export function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), cv);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
