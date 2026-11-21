// 자동 페달 — 운전대만 잡으면 액셀 · 브레이크는 차가 알아서 한다
//   사용자 11/15 「브레이크랑 엑셀을 자동으로 해주는 모드 만들어줄수있음? 스티어링에만 할수 있는 모드」
// 목표 속도 = 뉘르 영상 시뮬이 그 자리에서 낸 속도(data/track.json 의 ghost — Performance · 팬 958 kgf 기준. 11/19 부터 실제 모양 코스에서 다시 계산한 5:45.9).
//   · 코너(시뮬 속도가 낮은 곳)는 strength 배로 낮추고(게임 기본 100% = 시뮬 속도 그대로), 거기서 다시 가속하고 미리 감속하는 구간은 시뮬의 v² 변화량을 그대로 이어 붙인다 → 직선은 끝까지 밟는다
//   · 앞 200 m 안의 느린 곳까지 차가 낼 수 있는 제동(마찰 × (무게 + 팬) × 0.9)으로 줄여 갈 수 있는 속도를 넘으면 미리 브레이크
//     (11/15: 전에는 1.9 G 고정이라 시뮬보다 일찍 밟아 한 바퀴 4~7 s 를 잃었다)
//   · 차가 코스 반대쪽을 보고 있으면 시속 30 km 까지만
// 페달 다루는 법 (11/15 사용자 「브레이크 엑셀 여기가 히스테리시스하듯이 하는거 아냐? … 브레이크엑셀브레이크엑셀을 번갈아 스위칭하는 그런 콘트롤안하도록」)
//   전에는 목표와 0.3 m/s(1 km/h)만 어긋나도 액셀 ↔ 브레이크가 바뀌고, 액셀을 떼면 회생 0.65 G 가 걸려 다시 목표 밑으로 떨어졌다
//   → 한 바퀴 상태 바뀜 3,413회 · 1 초 안에 되돌아옴 3,225회 (tools/physcheck/lap_sim.mjs 가 센다).
//   이제는 「지금 내야 할 가속도」를 먼저 정하고 그걸 페달로 바꾼다:
//   · 내야 할 가속도 = 목표 속도 곡선의 기울기(지금 자리 → 0.3 s 앞, 앞먹임) + 목표와의 차이 × KV
//   · 액셀: 그 가속도 + 주행 저항(공기 · 구름)을 낼 만큼. 최소 0.03 — js/vehicle.js 는 0.02 이하를 「뗌」으로 보고 회생 0.65 G 를 건다
//   · 브레이크: 그 감속도에서 회생 몫을 뺀 만큼 (브레이크 b → 회생 + b × (0.96 μN − 회생))
//   · 차가 낼 수 없는 감속(타력 0.2~0.4 G 와 회생 0.65 G 사이)에서만 둘 중 하나를 고르는데, 가운데 ± HYST 로 히스테리시스를 두고
//     한 번 바꾸면 DWELL 동안 그대로 둔다. 페달은 정해진 빠르기 안에서만 움직인다(THR_* · BRK_*)
// tools/physcheck/lap_sim.mjs 가 이 파일을 그대로 써서 한 바퀴를 시험한다 (시뮬 선을 따라가는 자동 조향 + 이 자동 페달).
const G = 9.81, ABRK = 1.9, LOOK = 200;   // ABRK: spec 이 없을 때의 미리 감속 G
const DWELL = 0.25, HYST = 0.1 * G, KV = 2.5, AHEAD = 0.3, TF = 0.08;   // 상태 유지 s · 히스테리시스 · 속도 차이 되먹임(1/s) · 기울기 보는 앞 시간 s · 가속도 명령 눅임 s
const THR_UP = 3, THR_DN = 6, BRK_UP = 12, BRK_DN = 4;   // 페달이 1 초에 움직이는 양 (0→1 = 1)
const THR_MIN = 0.03;                     // D 에서의 최소 액셀 — js/vehicle.js 는 0.02 이하를 「뗌」으로 보고 회생 0.65 G 를 건다
const step = (x, to, up, dn) => (to > x ? Math.min(to, x + up) : Math.max(to, x - dn));

export class AutoPedal {
  constructor(ghost, strength = 0.95, spec = null) {
    this.spec = spec; this.g = ghost; this.n = ghost.x.length; this.i = 0; this.on = false; this.vt = 0;
    this.mode = 'D'; this.tm = 0; this.thr = 0; this.brk = 0;
    const { x, y } = ghost, n = this.n;
    this.ds = new Float64Array(n);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.ds[i] = Math.hypot(x[j] - x[i], y[j] - y[i]); }
    this.setStrength(strength);
  }
  setStrength(s) {
    this.strength = Math.round(Math.min(Math.max(s, 0.7), 1.05) * 100) / 100;
    const v = this.g.v, n = this.n, vP = this.vP = Float64Array.from(v, (a) => a * this.strength);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) { const j = (i + 1) % n, dv2 = v[j] ** 2 - v[i] ** 2; if (dv2 > 0) vP[j] = Math.max(vP[j], Math.min(Math.max(v[j], vP[j]), Math.sqrt(vP[i] ** 2 + dv2))); }
      for (let i = n - 1; i >= 0; i--) { const j = (i + 1) % n, dv2 = v[i] ** 2 - v[j] ** 2; if (dv2 > 0) vP[i] = Math.min(vP[i], Math.sqrt(vP[j] ** 2 + dv2)); }
    }
    return this.strength;
  }
  // 차 위치에서 가장 가까운 시뮬 점 (보통은 지난번 근처만, 멀리 떨어졌으면 전체에서)
  locate(px, py) {
    const { x, y } = this.g, n = this.n;
    let best = this.i, bd = Infinity;
    for (let o = -60; o <= 60; o++) { const i = ((this.i + o) % n + n) % n, d = (px - x[i]) ** 2 + (py - y[i]) ** 2; if (d < bd) { bd = d; best = i; } }
    if (bd > 30 * 30) for (let i = 0; i < n; i++) { const d = (px - x[i]) ** 2 + (py - y[i]) ** 2; if (d < bd) { bd = d; best = i; } }
    return (this.i = best);
  }
  // 시뮬 점 i 에서의 목표 속도 = 그 자리 시뮬 속도와, 앞 200 m 안의 느린 곳까지 계획 제동(aB)으로 줄여 갈 수 있는 속도 중 작은 것
  target(i, aB) {
    const n = this.n; let vt = this.vP[i];
    for (let j = i, d = 0; d < LOOK;) { d += this.ds[j]; j = (j + 1) % n; vt = Math.min(vt, Math.sqrt(this.vP[j] ** 2 + 2 * aB * d)); }
    return vt;
  }
  // car: Vehicle, cosA: 차 방향과 코스 방향의 cos, dt: 물리 한 걸음 s. 반환 {throttle, brake} 0..1
  update(car, cosA, dt = 1 / 240) {
    const n = this.n, i = this.locate(car.x, car.y), v = car.v, va = Math.max(Math.abs(v), 1);
    const S = this.spec, m = S ? S.massDry + (car.gas || 0) : 1700;
    const aB = S ? 0.9 * S.mu * (S.massDry * G + S.fanDown) / S.massDry : ABRK * G;   // 계획한 제동 감속도
    // 목표 속도: 지금 자리(11/15: 0.15 s 앞을 보면 시뮬보다 일찍 밟아 한 바퀴 약 4 s 를 잃었다)와 0.3 s 앞 → 그 사이 기울기가 앞먹임 가속도
    let k = i, dk = 0;
    while (dk < Math.max(va * AHEAD, 5)) { dk += this.ds[k]; k = (k + 1) % n; }
    let vt = this.target(i, aB), vtK = this.target(k, aB);
    if (cosA < 0.5) { vt = Math.min(vt, 30 / 3.6); vtK = Math.min(vtK, 30 / 3.6); }
    this.vt = vt;
    const aFF = (vtK * vtK - vt * vt) / (2 * dk);
    const aCmd0 = aFF + KV * (vt - v);
    this.aCmd = (this.aCmd ?? aCmd0) + (aCmd0 - (this.aCmd ?? aCmd0)) * Math.min(dt / TF, 1);
    const aCmd = this.aCmd, beta = Math.abs(Math.atan2(car.vy, Math.max(Math.abs(v), 3)));

    // 차가 낼 수 있는 힘: 주행 저항 · 최대 구동력 · 회생 · 최대 제동력 (js/vehicle.js 와 같은 식)
    const fan = car.fan || 0, N = m * G + fan;
    const res = S ? S.A * N / (m * G) + S.B * va + S.C * va * va : 0.02 * m * G;
    const gr = car.gear === 2 && S ? S.gear2 : 1;
    const fMax = S ? Math.min((car.cap || S.pWheel) / Math.max(va, 3), S.torqueF * gr) : 0.8 * m * G;
    const fReg = (S ? S.regenG : 0.65) * m * G * Math.min(va / 2, 1), fBrk = 0.96 * (S ? S.mu : 1.3) * N;
    // 액셀 0.03(타력)과 회생 사이의 가운데 — 내야 할 감속이 이보다 크면 브레이크 쪽, 작으면 액셀 쪽
    const mid = -((res - THR_MIN * fMax) + (res + fReg)) / (2 * m);

    this.tm += dt;
    if (this.tm >= DWELL) {
      if (this.mode === 'D' && aCmd < mid - HYST) { this.mode = 'B'; this.tm = 0; this.thr = 0; }
      else if (this.mode === 'B' && aCmd > mid + HYST) { this.mode = 'D'; this.tm = 0; this.brk = 0; this.thr = THR_MIN; }
    }
    if (this.mode === 'D') {
      let thrT = Math.min(Math.max((m * aCmd + res) / Math.max(fMax, 1), THR_MIN), 1);
      // 뒤가 미끄러지기 시작하면(차체 미끄럼각 4° 넘음) 액셀을 줄인다 — 떼지는 않는다(회생이 뒷바퀴에 걸리면 더 돈다)
      thrT = Math.min(thrT, Math.max(THR_MIN, 1 - (beta - 0.07) / 0.04));
      this.thr = step(this.thr, thrT, THR_UP * dt, THR_DN * dt);
      this.brk = 0;
    } else {
      const brkT = Math.min(Math.max((-m * aCmd - res - fReg) / Math.max(fBrk - fReg, 1), 0.03), 1);
      this.brk = step(this.brk, brkT, BRK_UP * dt, BRK_DN * dt);
      this.thr = 0;
    }
    return { throttle: this.thr, brake: this.brk };
  }
}
