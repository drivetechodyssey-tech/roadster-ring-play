// 화면 위 정보 — 미니맵 · 랩 텔레메트리 · 랩보드
//   사용자 11/15 밤 「ui 에 맵이랑 내위치 표시되는게 좋을것같고. 엑셀 브레이크 몇%로 밟고있는지 보여주는것도 … 랩타임을 좀더 크게 상단 우측에 …
//   1랩 돌면 끝내고 기록이랑 텔레메트리같은거 보여주고 랩보드 보여주는거어떄?」
// 기준선 「시뮬」 = data/track.json 의 ghost — 뉘르 영상의 시뮬 코드로 이 코스에서 계산한 한 바퀴(tools/ring/sim_ref.py. 옛 코스 5:43.8 → 11/19 실제 모양 코스 5:45.9). 내 기록 · 이 기기 보드는 이 브라우저(localStorage)에만 남고,
// 온라인 보드는 구글 시트(js/online.js · tools/online-board/)에서 받는다.
export const BIN = 10;   // 텔레메트리 한 칸 m

// 시뮬 기록을 코스 거리 BIN m 칸에 맞춘다 (ghost 선 길이와 코스 중심선 길이가 조금 달라 비율로 맞춤)
export function simRef(track) {
  const g = track.ghost, n = g.x.length, gs = new Float64Array(n);
  for (let i = 1; i < n; i++) gs[i] = gs[i - 1] + Math.hypot(g.x[i] - g.x[i - 1], g.y[i] - g.y[i - 1]);
  const total = gs[n - 1] + Math.hypot(g.x[0] - g.x[n - 1], g.y[0] - g.y[n - 1]);
  const f = total / track.length, nb = Math.ceil(track.length / BIN) + 1, kmh = new Float32Array(nb), t = new Float32Array(nb);
  let j = 0;
  for (let b = 0; b < nb; b++) {
    const s = Math.min(b * BIN * f, gs[n - 1]);
    while (j < n - 2 && gs[j + 1] < s) j++;
    const u = Math.min(Math.max((s - gs[j]) / Math.max(gs[j + 1] - gs[j], 1e-6), 0), 1);
    kmh[b] = (g.v[j] + (g.v[j + 1] - g.v[j]) * u) * 3.6; t[b] = g.t[j] + (g.t[j + 1] - g.t[j]) * u;
  }
  return { kmh, t, nb, lap: g.lap };
}

// 시뮬 차가 랩 시간 t 에 있던 자리 (미니맵의 회색 점)
export function ghostAt(track, t) {
  const g = track.ghost; let lo = 0, hi = g.t.length - 1;
  if (t <= g.t[0]) return [g.x[0], g.y[0]];
  if (t >= g.t[hi]) return [g.x[hi], g.y[hi]];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (g.t[m] <= t) lo = m; else hi = m; }
  const u = (t - g.t[lo]) / Math.max(g.t[hi] - g.t[lo], 1e-6);
  return [g.x[lo] + (g.x[hi] - g.x[lo]) * u, g.y[lo] + (g.y[hi] - g.y[lo]) * u];
}

// 한 바퀴 기록: BIN m 마다 랩 시간 · 속도 · 액셀 · 브레이크 + 요약
export class LapTel {
  constructor(nb) { this.nb = nb; this.reset(); }
  reset() {
    const nb = this.nb;
    this.t = new Float32Array(nb).fill(NaN); this.kmh = new Float32Array(nb).fill(NaN);
    this.thr = new Float32Array(nb); this.brk = new Float32Array(nb);
    this.last = -1; this.vmax = 0; this.gmax = 0; this.hits = 0; this.off = 0; this.auto = false;
  }
  add(s, t, kmh, thr, brk) {
    const b = Math.floor(s / BIN); if (b === this.last || b < 0 || b >= this.nb) return;
    this.last = b; this.t[b] = t; this.kmh[b] = kmh; this.thr[b] = thr; this.brk[b] = brk;
  }
}

// 기록 (이 브라우저에만) — 랩마다 { id, driver, time, trim, auto, hits, off, vmax, date }. 최근 500개까지(드라이버별 개인 기록이 빠른 기록에 밀려 지워지지 않게 오래된 것부터 지운다)
const KEY = 'roadsterRing.laps.v1', DKEY = 'roadsterRing.driver';
export function loadBoard() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
export function saveLap(rec) {
  const b = loadBoard(); b.push(rec); b.sort((a, c) => a.id - c.id);
  const keep = b.slice(-500);
  try { localStorage.setItem(KEY, JSON.stringify(keep)); } catch { /* 저장 못 해도 이번 화면에는 보인다 */ }
  return keep.some((r) => r.id === rec.id) ? keep : [...keep, rec];
}
// 드라이버 이름 (사용자 11/15 밤 「처음시작할떄 드라이버 이름 넣기」)
export function getDriver() { try { return localStorage.getItem(DKEY) || ''; } catch { return ''; } }
export function setDriver(name) { try { localStorage.setItem(DKEY, name); } catch { /* 이번 판만 */ } }
export const cleanName = (s) => String(s || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);

// 기록 보드 표 (사용자 11/15 밤 「개인기록 보드랑 그리고 온라인기록보드도」)
//   tab 'me' = 이 드라이버의 랩(빠른 순 10개 + 트림별 최고) · 'dev' = 이 기기의 모든 드라이버(빠른 순 10개 + 영상 시뮬 기준 줄)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
//   'online' = 구글 시트 기록 보드(js/online.js) — 트림 하나, 이름마다 최고 한 줄(자동 페달 랩은 따로) + 영상 시뮬 기준 줄
export function boardHTML(tab, recs, { cur, driver, refLap, label, fmt, online }) {
  const note = (r) => [r.auto ? '자동' : '', (r.hits | 0) ? `충돌 ${r.hits | 0}` : ''].filter(Boolean).join(' · ');   // 숫자로만 — 온라인 보드는 서버 답이라 그대로 HTML 에 넣지 않는다
  if (tab === 'online') {
    const o = online || {};
    if (o.state === 'off') return { head: '온라인 기록 보드는 아직 연결 전입니다', rows: '' };
    if (o.state === 'loading') return { head: '온라인 기록을 받는 중…', rows: '' };
    if (o.state === 'error') return { head: `온라인 기록을 못 받았습니다 — ${o.why || '인터넷 연결 확인'}`, rows: '' };
    const b = o.board;
    if (!b || !Array.isArray(b.rows) || !b.rows.length) return { head: `온라인 · ${label(o.trim)} · 아직 기록이 없습니다`, rows: '' };
    const me = String(driver || '').toLowerCase();
    const list = [...b.rows.map((r) => ({ driver: String(r.driver ?? ''), time: Number(r.time) || 0, auto: !!r.auto, hits: r.hits | 0, date: String(r.date ?? '') })), { ref: true, time: refLap }].sort((a, c) => a.time - c.time);   // 서버 답은 믿지 않고 형을 맞춘다
    let k = 0;
    const rows = '<tr><th>#</th><th>드라이버</th><th>기록</th><th></th><th>날짜</th></tr>' + list.map((r) => r.ref
      ? `<tr class="ref"><td></td><td>영상 시뮬</td><td>${fmt(r.time)}</td><td>Performance</td><td></td></tr>`
      : `<tr class="${r.driver.toLowerCase() === me && !!r.auto === !!o.auto ? 'me' : ''}"><td>${++k}</td><td>${esc(r.driver)}</td><td>${fmt(r.time)}</td><td>${note(r)}</td><td>${esc(r.date || '')}</td></tr>`).join('');
    return { head: `온라인 · ${label(o.trim)} · ${b.drivers | 0}명 · ${b.laps | 0}랩 · 이름마다 최고 기록 (자동 페달은 따로)`, rows };
  }
  if (tab === 'me') {
    const mine = recs.filter((r) => (r.driver || '') === driver).sort((a, b) => a.time - b.time);
    if (!mine.length) return { head: '', rows: '<tr><td colspan="5" style="opacity:.6">아직 기록이 없습니다</td></tr>' };
    const best = {}; for (const r of mine) if (!best[r.trim]) best[r.trim] = r;
    const head = `${esc(driver)} · ${mine.length}랩 · ` + Object.entries(best).map(([t, r]) => `${label(t)} 최고 ${fmt(r.time)}`).join(' · ');
    let k = 0;
    const rows = '<tr><th>#</th><th>기록</th><th>트림</th><th></th><th>날짜</th></tr>' + mine.slice(0, 10).map((r) =>
      `<tr class="${r.id === cur ? 'me' : ''}"><td>${++k}</td><td>${fmt(r.time)}</td><td>${label(r.trim)}</td><td>${note(r)}</td><td>${esc(r.date || '')}</td></tr>`).join('');
    return { head, rows };
  }
  const all = [...recs].sort((a, b) => a.time - b.time).slice(0, 10);
  const list = [...all, { ref: true, time: refLap }].sort((a, b) => a.time - b.time);
  let k = 0;
  const rows = '<tr><th>#</th><th>드라이버</th><th>기록</th><th>트림</th><th></th></tr>' + list.map((r) => r.ref
    ? `<tr class="ref"><td></td><td>영상 시뮬</td><td>${fmt(r.time)}</td><td>Performance</td><td></td></tr>`
    : `<tr class="${r.id === cur ? 'me' : ''}"><td>${++k}</td><td>${esc(r.driver || '이름 없음')}</td><td>${fmt(r.time)}</td><td>${label(r.trim)}</td><td>${note(r)}</td></tr>`).join('');
  return { head: `이 기기 · ${new Set(recs.map((r) => r.driver || '')).size}명 · ${recs.length}랩`, rows };
}

// 미니맵: 북쪽이 위. 코스는 한 번만 그려 두고, 점(나 · 시뮬)만 다시 그린다
export function makeMinimap(track, cv) {
  const r = devicePixelRatio || 1, W = Math.round(cv.clientWidth * r), H = Math.round(cv.clientHeight * r);
  cv.width = W; cv.height = H;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < track.n; i++) { x0 = Math.min(x0, track.x[i]); x1 = Math.max(x1, track.x[i]); y0 = Math.min(y0, track.y[i]); y1 = Math.max(y1, track.y[i]); }
  const pad = 14 * r, sc = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
  const ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
  const P = (x, y) => [ox + (x - x0) * sc, oy + (y1 - y) * sc];
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  const c = bg.getContext('2d'); c.lineJoin = c.lineCap = 'round';
  c.beginPath(); for (let i = 0; i <= track.n; i++) { const [px, py] = P(track.x[i % track.n], track.y[i % track.n]); i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 7 * r; c.stroke();
  c.strokeStyle = '#d9d9d4'; c.lineWidth = 3 * r; c.stroke();
  { // 출발선: 코스에 수직인 짧은 선
    const [px, py] = P(track.x[0], track.y[0]), nx = -track.ty[0], ny = -track.tx[0];
    c.strokeStyle = '#ff5a4d'; c.lineWidth = 3 * r; c.beginPath(); c.moveTo(px - nx * 9 * r, py - ny * 9 * r); c.lineTo(px + nx * 9 * r, py + ny * 9 * r); c.stroke();
  }
  const ctx = cv.getContext('2d');
  const dot = ([x, y], fill, rad, ring) => { const [px, py] = P(x, y); ctx.beginPath(); ctx.arc(px, py, rad, 0, 6.2832); if (ring) { ctx.lineWidth = 2.5 * r; ctx.strokeStyle = ring; ctx.stroke(); } ctx.fillStyle = fill; ctx.fill(); };
  return (car, ghost) => {
    ctx.clearRect(0, 0, W, H); ctx.drawImage(bg, 0, 0);
    if (ghost) dot(ghost, '#9aa0a6', 4.5 * r, 'rgba(0,0,0,.6)');
    dot([car.x, car.y], '#ff5a4d', 6 * r, '#fff');
  };
}

// 텔레메트리 그림: 위 = 속도(나 · 영상 시뮬), 가운데 = 시뮬 대비 시간 차, 아래 = 액셀(위) · 브레이크(아래)
export function drawTelemetry(cv, tel, ref) {
  const r = devicePixelRatio || 1, W = Math.round(cv.clientWidth * r), H = Math.round(cv.clientHeight * r);
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), nb = ref.nb;
  const L = 52 * r, R = 12 * r, T = 26 * r, B = 26 * r, gap = 16 * r, ih = H - T - B - 2 * gap;
  const hs = ih * 0.56, hd = ih * 0.2, hp = ih * 0.24, ys = T, yd = ys + hs + gap, yp = yd + hd + gap;
  const X = (b) => L + b / (nb - 1) * (W - L - R);
  const txt = (s, x, y, al = 'right', col = '#9a9a9a', size = 11) => { c.fillStyle = col; c.font = `${size * r}px -apple-system, sans-serif`; c.textAlign = al; c.textBaseline = 'middle'; c.fillText(s, x, y); };
  const hline = (y, col = 'rgba(255,255,255,.08)') => { c.strokeStyle = col; c.lineWidth = 1 * r; c.beginPath(); c.moveTo(L, y); c.lineTo(W - R, y); c.stroke(); };
  const line = (arr, y0, h, lo, hi, col, w) => {
    c.strokeStyle = col; c.lineWidth = w * r; c.lineJoin = 'round'; c.beginPath(); let on = false;
    for (let b = 0; b < nb; b++) { const v = arr(b); if (!Number.isFinite(v)) { on = false; continue; } const y = y0 + h - (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo) * h; on ? c.lineTo(X(b), y) : c.moveTo(X(b), y); on = true; }
    c.stroke();
  };
  // 범례
  c.fillStyle = '#ff5a4d'; c.fillRect(L, 8 * r, 18 * r, 3 * r); txt('나', L + 24 * r, 10 * r, 'left', '#ddd', 12);
  c.fillStyle = '#8a8f96'; c.fillRect(L + 52 * r, 8 * r, 18 * r, 3 * r); txt(`시뮬 (${Math.floor(ref.lap / 60)}:${(ref.lap % 60).toFixed(1).padStart(4, '0')})`, L + 76 * r, 10 * r, 'left', '#ddd', 12);   // 기준 랩 시간은 자료(ghost.lap)에서 — 코스를 바꾸면 따라 바뀐다(11/19: 5:43.8 → 5:45.9)
  // 속도
  for (const v of [0, 100, 200, 300]) { const y = ys + hs - v / 350 * hs; hline(y); txt(String(v), L - 6 * r, y); }
  txt('km/h', L - 6 * r, ys - 10 * r);
  line((b) => ref.kmh[b], ys, hs, 0, 350, '#8a8f96', 1.5);
  line((b) => tel.kmh[b], ys, hs, 0, 350, '#ff5a4d', 2);
  // 시뮬 대비 시간 차 (+ 면 시뮬보다 늦음)
  let dmax = 1; for (let b = 0; b < nb; b++) { const d = tel.t[b] - ref.t[b]; if (Number.isFinite(d)) dmax = Math.max(dmax, Math.abs(d)); }
  dmax = Math.ceil(dmax);
  hline(yd + hd / 2, 'rgba(255,255,255,.25)'); txt(`+${dmax} s`, L - 6 * r, yd + 4 * r); txt('0', L - 6 * r, yd + hd / 2); txt(`−${dmax} s`, L - 6 * r, yd + hd - 4 * r);
  txt('시뮬 대비 (위 = 늦음)', L + 6 * r, yd - 6 * r, 'left', '#9a9a9a', 11);
  line((b) => tel.t[b] - ref.t[b], yd, hd, -dmax, dmax, '#f0c04a', 1.8);
  // 페달: 액셀 위로(초록) · 브레이크 아래로(빨강)
  const mid = yp + hp / 2, bw = Math.max((W - L - R) / nb, 1);
  hline(mid, 'rgba(255,255,255,.25)'); txt('액셀', L - 6 * r, yp + 6 * r, 'right', '#3ec46d'); txt('브레이크', L - 6 * r, yp + hp - 6 * r, 'right', '#ff5a4d');
  for (let b = 0; b < nb; b++) {
    if (!Number.isFinite(tel.kmh[b])) continue;
    if (tel.thr[b] > 0.02) { c.fillStyle = 'rgba(62,196,109,.85)'; c.fillRect(X(b), mid - tel.thr[b] * hp / 2, bw, tel.thr[b] * hp / 2); }
    if (tel.brk[b] > 0.02) { c.fillStyle = 'rgba(255,90,77,.85)'; c.fillRect(X(b), mid, bw, tel.brk[b] * hp / 2); }
  }
  // 거리 눈금
  for (let km = 0; km <= 20; km += 2) { const x = X(km * 1000 / BIN); txt(`${km}`, x, H - B + 12 * r, 'center'); c.strokeStyle = 'rgba(255,255,255,.06)'; c.beginPath(); c.moveTo(x, ys); c.lineTo(x, yp + hp); c.stroke(); }
  txt('km', W - R, H - B + 12 * r, 'right');
}
