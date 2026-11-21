// 노면 낙서 — 노르트슐라이페의 상징 (11/19 사용자 「도로 표면에 낙서같은게 있는 구간이 있음 이게 은근 시그니쳐라 꼭있었으면 함」)
//   어디에 얼마나: 항공사진(2023년 촬영)에서 잰 것 — track.graf = 점(2 m)마다 흰 실선 사이를 GC 칸으로 나눈 낙서 단계 0~9 (tools/ring/surface.py)
//   무엇이 적혀 있나: 여기서 지어 그린 것이다. 실제 낙서의 글 · 상표 · 사람 이름을 옮기지 않는다
//   그리는 법: 글 · 그림 조각을 한 장(2048²)에 흰색으로 그려 두고(=투명도 지도), 조각마다 길 면을 따라 굽는 작은 판을 얹는다.
//             색 · 바랜 정도 · 바퀴가 지나는 곳의 닳음은 꼭짓점 값. 사진은 쓰지 않는다
import * as THREE from 'three';

function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; }

const S = 2048, PXM = 128;          // 그림 한 장의 크기 · 1 m 당 화소
const FONTS = ['"Marker Felt"', 'Chalkduster', '"Bradley Hand"', 'Noteworthy', '"Arial Black"', 'Impact', '"Comic Sans MS"', '"Trebuchet MS"'];
// 지어낸 글: 흔한 이름 · 인사 · 구호 · 동네 이름 (DTO = 이 게임을 만든 채널)
const TEXTS = ['NORDSCHLEIFE', 'GRÜNE HÖLLE', 'VOLLGAS', '24H', 'RING FREI', 'GAS GEBEN', 'EIFEL', 'ADENAU', 'MOIN MOIN', 'HALLO MAMA',
  'PROST', 'CAMP 7', 'KURVE 9', 'TEAM 21', 'NO LIMITS', 'FULL SEND', 'KEEP PUSHING', 'FOREVER', 'BIS 2027', 'DRIVE TECH ODYSSEY',
  'MAX + LISA', 'TIM', 'JONAS', 'PAUL WAR HIER', 'ANNA', 'FELIX', 'LEON 2026', 'NICO', 'UWE & KALLE', 'STEFFI',
  'DTO', 'ROADSTER', 'FLAT OUT', 'SEND IT', 'KÖLN', 'HAMBURG', 'WIEN', 'SEOUL', 'GO GO GO', 'SCHNELLER!'];
const SHORT = ['24H', '#7', '07', '99', '13', '44', '2025', '2026', 'OK', 'GO', 'JA', 'HI', 'NEIN', 'XX', 'LOL', 'WOW', 'AB', 'JK', 'MS', 'TK', 'RS', 'EV', 'DTO', '♥'];

// 작은 그림: 가운데 (0, 0), 반지름 46 안에 굵은 선으로
const SHAPES = [
  (c) => { c.beginPath(); c.moveTo(0, 36); c.bezierCurveTo(-62, -6, -30, -54, 0, -20); c.bezierCurveTo(30, -54, 62, -6, 0, 36); c.stroke(); },                                  // 하트
  (c) => { c.beginPath(); for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + k * 4 * Math.PI / 5; c.lineTo(Math.cos(a) * 44, Math.sin(a) * 44); } c.stroke(); },          // 별
  (c) => { c.beginPath(); c.arc(0, 0, 42, 0, 6.3); c.stroke(); c.beginPath(); c.arc(0, 4, 24, 0.25, 2.9); c.stroke(); c.beginPath(); c.arc(-15, -12, 3, 0, 6.3); c.arc(15, -12, 3, 0, 6.3); c.stroke(); },   // 웃는 얼굴
  (c) => { c.beginPath(); c.moveTo(-44, 0); c.lineTo(40, 0); c.moveTo(14, -24); c.lineTo(42, 0); c.lineTo(14, 24); c.stroke(); },                                                // 화살표
  (c) => { c.beginPath(); c.moveTo(-36, -36); c.lineTo(36, 36); c.moveTo(36, -36); c.lineTo(-36, 36); c.stroke(); },                                                              // X
  (c) => { c.beginPath(); c.arc(0, 0, 40, 0.3, 6.1); c.stroke(); },                                                                                                               // 동그라미
  (c) => { c.beginPath(); for (let a = 0; a < 15; a += 0.2) c.lineTo(Math.cos(a) * a * 2.9, Math.sin(a) * a * 2.9); c.stroke(); },                                              // 소용돌이
  (c) => { c.beginPath(); for (let k = 0; k < 7; k++) c.lineTo(-45 + k * 15, k % 2 ? -22 : 22); c.stroke(); },                                                                    // 지그재그
  (c) => { c.beginPath(); c.moveTo(-40, 28); c.lineTo(-44, -24); c.lineTo(-20, 4); c.lineTo(0, -34); c.lineTo(20, 4); c.lineTo(44, -24); c.lineTo(40, 28); c.closePath(); c.stroke(); },   // 왕관
  (c) => { c.beginPath(); c.arc(0, 0, 42, 0, 6.3); c.moveTo(0, -42); c.lineTo(0, 42); c.moveTo(0, 0); c.lineTo(-29, 30); c.moveTo(0, 0); c.lineTo(29, 30); c.stroke(); },        // 평화
  (c) => { c.beginPath(); c.arc(0, 0, 20, 0, 6.3); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); c.lineTo(Math.cos(a) * 46, Math.sin(a) * 46); } c.stroke(); },   // 해
  (c) => { c.beginPath(); c.moveTo(10, -46); c.lineTo(-18, 2); c.lineTo(6, 2); c.lineTo(-10, 46); c.lineTo(22, -8); c.lineTo(-2, -8); c.closePath(); c.stroke(); },              // 번개
  (c) => { for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.beginPath(); c.arc(Math.cos(a) * 24, Math.sin(a) * 24, 14, 0, 6.3); c.stroke(); } },                     // 꽃
  (c) => { c.beginPath(); c.moveTo(-34, 46); c.lineTo(-34, -44); c.lineTo(38, -44); c.lineTo(38, 0); c.lineTo(-34, 0); c.stroke(); c.fillRect(-34, -44, 24, 22); c.fillRect(-10, -22, 24, 22); c.fillRect(14, -44, 24, 22); },   // 깃발
  (c) => { c.beginPath(); c.arc(0, -30, 12, 0, 6.3); c.moveTo(0, -18); c.lineTo(0, 14); c.moveTo(-24, -6); c.lineTo(24, -6); c.moveTo(0, 14); c.lineTo(-18, 44); c.moveTo(0, 14); c.lineTo(18, 44); c.stroke(); },   // 사람
  (c) => { for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if ((a + b) % 2 === 0) c.fillRect(-42 + a * 28, -42 + b * 28, 28, 28); c.strokeRect(-42, -42, 84, 84); },    // 체크 무늬
];

function makeAtlas(r, aniso) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, S, S);
  c.lineCap = c.lineJoin = 'round'; c.textBaseline = 'middle'; c.textAlign = 'center';
  const g3 = () => (r() + r() + r() - 1.5) / 1.5;                       // 대략 종 모양 −1 ~ 1
  // 닳은 자국: 페인트가 군데군데 벗겨진 점 + 한 방향으로 긁힌 줄 (amt 0 = 새것 ~ 1 = 거의 지워짐)
  const wear = (x, y, w, h, amt) => {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = '#000';
    for (let q = 0, m = amt * w * h / 16; q < m; q++) { c.globalAlpha = 0.5 + r() * 0.5; c.beginPath(); c.arc(x + r() * w, y + r() * h, 0.7 + r() * r() * 3.2, 0, 6.3); c.fill(); }
    c.globalAlpha = 1; c.strokeStyle = 'rgba(0,0,0,0.8)'; const ang = (r() - 0.5) * 1.2;
    c.translate(x + w / 2, y + h / 2); c.rotate(ang);
    for (let q = 0, m = 1 + amt * 16; q < m; q++) { c.lineWidth = 1 + r() * 6; const yy = (r() - 0.5) * (w + h); c.beginPath(); c.moveTo(-w, yy); c.lineTo(w, yy + (r() - 0.5) * 20); c.stroke(); }
    c.restore();
  };
  const words = [], small = [], scuff = [];
  // 글: 10줄 × 4칸 (칸 512 × 128 = 4 m × 1 m)
  for (let q = 0; q < 40; q++) {
    const x0 = (q % 4) * 512, y0 = (q / 4 | 0) * 128, txt = TEXTS[q % TEXTS.length], font = FONTS[r() * FONTS.length | 0];
    let size = 84; c.font = `bold ${size}px ${font}, sans-serif`; let tw = c.measureText(txt).width;
    if (tw > 480) { size *= 480 / tw; c.font = `bold ${size}px ${font}, sans-serif`; tw = 480; }
    c.save(); c.translate(x0 + 256, y0 + 66); c.rotate((r() - 0.5) * 0.04);
    c.fillStyle = c.strokeStyle = '#fff';
    if (r() < 0.45) { c.lineWidth = 6 + r() * 4; c.strokeText(txt, 0, 0); }       // 테두리만 그린 글
    else { c.fillText(txt, 0, 0); c.lineWidth = 3; c.strokeText(txt, 0, 0); }     // 칠한 글
    c.restore();
    wear(x0, y0, 512, 128, 0.12 + r() * 0.6);
    words.push({ x: x0 + 256 - tw / 2 - 14, y: y0 + 2, w: tw + 28, h: 124 });
  }
  // 작은 것: 4줄 × 16칸 (칸 128 × 128 = 1 m × 1 m) — 그림 · 숫자 · 머리글자
  for (let q = 0; q < 64; q++) {
    const x0 = (q % 16) * 128, y0 = 1280 + (q / 16 | 0) * 128;
    c.save(); c.beginPath(); c.rect(x0 + 2, y0 + 2, 124, 124); c.clip(); c.translate(x0 + 64, y0 + 64); c.rotate((r() - 0.5) * 0.5);
    c.fillStyle = c.strokeStyle = '#fff'; c.lineWidth = 8 + r() * 5;
    if (q % 8 < 3) { const t = SHORT[(q * 5 + (q / 8 | 0)) % SHORT.length]; let size = 78; c.font = `bold ${size}px ${FONTS[r() * FONTS.length | 0]}, sans-serif`; const tw = c.measureText(t).width; if (tw > 104) c.font = `bold ${size * 104 / tw}px ${FONTS[0]}, sans-serif`; c.fillText(t, 0, 4); }
    else { const k = 0.8 + r() * 0.25; c.scale(k, k); SHAPES[(q * 7 + 3) % SHAPES.length](c); }
    c.restore();
    wear(x0, y0, 128, 128, 0.1 + r() * 0.6);
    small.push({ x: x0 + 3, y: y0 + 3, w: 122, h: 122 });
  }
  // 바랜 흔적: 2줄 × 16칸 — 거의 지워져 획 조각만 남은 옛 낙서. 실제 노면에서 가장 흔한 모습이다
  const erase = (x, y, w, h, frac) => {                                  // 넓게 벗겨진 자리: 크고 작은 구멍
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = '#000';
    for (let q = 0, m = frac * w * h / 60; q < m; q++) { c.beginPath(); c.arc(x + r() * w, y + r() * h, 2 + r() * r() * 9, 0, 6.3); c.fill(); }
    c.restore();
  };
  const ABC = 'ABDEHKMNORSTUVWXZ0123456789';
  for (let q = 0; q < 32; q++) {
    const x0 = (q % 16) * 128, y0 = 1792 + (q / 16 | 0) * 128;
    c.save(); c.beginPath(); c.rect(x0 + 2, y0 + 2, 124, 124); c.clip(); c.translate(x0 + 64, y0 + 64); c.rotate((r() - 0.5) * 0.8);
    c.fillStyle = c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 8 + r() * 5;
    if (q % 2) { const t = ABC[r() * ABC.length | 0] + ABC[r() * ABC.length | 0] + (r() < 0.5 ? ABC[r() * ABC.length | 0] : ''); c.font = `bold ${t.length > 2 ? 62 : 84}px ${FONTS[r() * FONTS.length | 0]}, sans-serif`; if (r() < 0.5) { c.lineWidth = 7; c.strokeText(t, 0, 4); } else c.fillText(t, 0, 4); }
    else SHAPES[(q * 5 + 1) % SHAPES.length](c);
    c.restore();
    erase(x0, y0, 128, 128, 0.8 + r() * 0.7); wear(x0, y0, 128, 128, 0.2);
    scuff.push({ x: x0 + 3, y: y0 + 3, w: 122, h: 122 });
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = aniso; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex, words, small, scuff };
}

// 주행선의 옆 자리(점마다, 왼쪽 +) — 시뮬 기준선을 코스에 얹어 읽는다
export function racingLine(track) {
  const n = track.n, lat = new Float32Array(n).fill(NaN), g = track.ghost;
  if (!g || !g.x) return lat.fill(0);
  let hint = track.findNearest(g.x[0], g.y[0]).i;
  for (let j = 0; j < g.x.length; j++) { const L = track.locate(g.x[j], g.y[j], hint, 80); hint = L.i; lat[L.i] = L.lat; }
  let last = -1, first = -1;
  for (let i = 0; i < n; i++) if (!Number.isNaN(lat[i])) { if (first < 0) first = i; last = i; }
  if (first < 0) return lat.fill(0);
  for (let i = 0, prev = last - n, pv = lat[last]; i < n; i++) {   // 빈 점은 앞뒤 값 사이를 곧게
    if (!Number.isNaN(lat[i])) { prev = i; pv = lat[i]; continue; }
    let j = i; while (Number.isNaN(lat[j % n])) j++;
    const nv = lat[j % n]; lat[i] = pv + (nv - pv) * (i - prev) / (j - prev);
  }
  return lat;
}

const LIFT = 0.012, RATE = 0.11, WEAR = 0.6;
const TINTS = [[0.8, 0.8, 0.77], [0.8, 0.66, 0.14], [0.26, 0.46, 0.8], [0.75, 0.17, 0.15], [0.26, 0.62, 0.3], [0.84, 0.4, 0.6], [0.85, 0.43, 0.1]];

// strength: 낙서의 양(1 = 항공사진에서 잰 만큼, 0 = 없음). 주소에 ?graf=0.5 처럼 붙여 바꾼다
export function buildGraffiti(track, renderer, strength = 1) {
  if (!track.graf || !(strength > 0)) return null;
  const n = track.n, GC = track.GC, r = rng(2026), A = makeAtlas(rng(77), renderer.capabilities.getMaxAnisotropy());
  const DS = track.length / n, line = track.line || (track.line = racingLine(track));
  const P = (u, lat) => { const i = Math.floor(u), f = u - i, a = track.at(i, lat, LIFT), b = track.at(i + 1, lat, LIFT); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; };
  const lineAt = (u) => { const i = ((Math.floor(u) % n) + n) % n; return line[i]; };
  const chunks = new Map(), CH = 250;                                   // 500 m 토막 — 안 보이는 토막은 그리지 않는다
  let count = 0;
  const put = (u0, lat0, th, w, h, rect, col, alpha) => {
    const key = ((Math.floor(u0 / CH) % Math.ceil(n / CH)) + Math.ceil(n / CH)) % Math.ceil(n / CH);
    let ck = chunks.get(key); if (!ck) chunks.set(key, ck = { pos: [], uv: [], col: [], idx: [] });
    const ca = Math.cos(th), sa = Math.sin(th), nA = Math.max(1, Math.ceil(w / 1.1)), nB = Math.max(1, Math.ceil(h / 1.1)), base = ck.pos.length / 3;
    for (let b = 0; b <= nB; b++) for (let a = 0; a <= nA; a++) {
      const la = (a / nA - 0.5) * w, lb = (b / nB - 0.5) * h, lat = lat0 + la * sa + lb * ca, u = u0 + (la * ca - lb * sa) / DS;
      const p = P(u, lat), d = lat - lineAt(u);
      ck.pos.push(p[0], p[1], p[2]);
      ck.uv.push((rect.x + a / nA * rect.w) / S, 1 - (rect.y + (1 - b / nB) * rect.h) / S);
      ck.col.push(col[0], col[1], col[2], alpha * (1 - WEAR * Math.exp(-(d * d) / 1.5)));     // 바퀴가 지나는 주행선 ±1.2 m 는 더 닳는다
    }
    for (let b = 0; b < nB; b++) for (let a = 0; a < nA; a++) { const v0 = base + b * (nA + 1) + a, v2 = v0 + nA + 1; ck.idx.push(v0, v0 + 1, v2, v0 + 1, v2 + 1, v2); }
    count++;
  };
  for (let i = 0; i < n; i++) {
    const lo = -track.lineR(i) + 0.5, hi = track.lineL(i) - 0.5, span = hi - lo;      // 흰 실선 사이(잴 때와 같은 범위)
    if (span < 3) continue;
    for (let q = 0; q < GC; q++) {
      const lv = track.graf[i * GC + q]; if (!lv) continue;
      let m = lv * RATE * strength; m = Math.floor(m) + (r() < m % 1 ? 1 : 0);
      while (m-- > 0) {
        const t = r(), pw = 0.10 + 0.025 * lv, ps = 0.45 - 0.02 * lv;                            // 낙서가 많은 곳일수록 큰 글이 많다
        let rect, w, h, th, alpha;
        const dir = r(), turn = dir < 0.3 ? -Math.PI / 2 : dir < 0.42 ? Math.PI / 2 : dir < 0.64 ? 0 : dir < 0.86 ? Math.PI : r() * 6.283;   // 운전자가 읽는 방향 30% · 반대 12% · 길 따라 44% · 아무 방향 14%
        if (t < pw) { rect = A.words[r() * A.words.length | 0]; const k = 0.5 + 1.3 * r() * r(); w = rect.w / PXM * k; h = rect.h / PXM * k; th = turn + (r() - 0.5) * 0.3; alpha = 0.38 + 0.5 * r(); }
        else if (t < pw + ps) { rect = A.scuff[r() * A.scuff.length | 0]; const k = 0.9 + 1.8 * r(); w = k * 1.25; h = k; th = turn + (r() - 0.5) * 0.5; alpha = 0.35 + 0.45 * r(); }
        else { rect = A.small[r() * A.small.length | 0]; const k = 0.6 + 1.2 * r() * r(); w = h = k; th = turn + (r() - 0.5) * 0.5; alpha = 0.45 + 0.5 * r(); }
        let half = (Math.abs(w * Math.sin(th)) + Math.abs(h * Math.cos(th))) / 2;
        if (2 * half > span - 0.2) { const k = (span - 0.2) / (2 * half); w *= k; h *= k; half *= k; }
        const lat = Math.min(Math.max(lo + (q + r()) / GC * span, lo + half), hi - half);
        const tint = r() < 0.8 ? TINTS[0] : r() < 0.35 ? TINTS[1] : TINTS[2 + (r() * 5 | 0)];
        put(i + r(), lat, th, w, h, rect, tint, alpha);
      }
    }
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, alphaMap: A.tex, transparent: true, vertexColors: true, depthWrite: false, roughness: 0.78, envMapIntensity: 0.9,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const grp = new THREE.Group(); grp.name = 'graffiti'; grp.userData.count = count;
  for (const ck of chunks.values()) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(ck.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(ck.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(ck.col, 4));
    geo.setIndex(ck.idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.renderOrder = -1; grp.add(mesh);   // 비치는 것들 가운데 맨 먼저 그린다 — 앞유리 · 펜스가 그 위에 얹히게
  }
  return grp;
}
