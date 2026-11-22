// 차량 물리. 수식과 값은 영상 때 만든 시뮬에서 옮겼다.
//   dto_tesla_roadster_unveil/research/nring/lapsim.py   (저항·마찰원·배터리)
//   dto_tesla_roadster_unveil/research/topspeed/topspeed.py (냉가스 추진기)
// 「공식」 = 테슬라 발표·인터뷰, 「가정」 = 영상 때 둔 전제, 「게임」 = 이 게임에서 새로 정한 값.

const G = 9.81, LBF = 4.44822, MPH = 0.44704;

export const SPEC = {
  massDry: 2050,            // kg, Thrust 트림 기준(사용자 11/12): Performance 공차 약 1,900(영상 때 역산, 1,830~1,980) + 추진 장비 약 70(내 추정 — 공개된 수치 없음) + 운전자 80. 질소는 따로 더한다
  pWheel: 1.0e6 * 0.97,     // W, 1 MW(공식) × 0.97(가정)
  vMotor: 230 * MPH,        // m/s, 최고속도 — Thrust 230 mph (탑기어 인터뷰, 기본형은 210)
  torqueF: 1400 * 8.4 * 0.97 / 0.367, // N, 1,400 N·m × 8.4:1 ÷ 바퀴 반지름 (가정)
  mu: 1.30 * 1.038,         // 타이어 마찰 × 보정 (가정)
  rear: 0.55,               // 뒤 하중 비율 — 뉘르 랩 시뮬(lapsim.py)과 같은 55% (사용자 11/15 「시뮬 값으로 맞춰」, 11/12 의 50:50 에서 되돌림)
  hCg: 0.16 * 2.825,        // m ≈ 0.452, 무게중심 높이 — 뉘르 랩 시뮬의 h/L 0.16 (사용자 11/15 「시뮬 값으로 맞춰」, 11/12 의 「낮은 무게 중심」 0.36 m 에서 되돌림)
  track: 1.70,              // m, 좌우 바퀴 간격 (가정)
  kIz: 1.0,                 // 요 관성 = kIz × 질량 × (휠베이스/2)² (가정)
  rollFront: 0.55,          // 좌우 하중 이동 가운데 앞바퀴가 받는 몫 (가정 — 뒤가 덜 받아 구동이 유리하다)
  tireB: 18, tireC: 1.4,    // 타이어 횡력 곡선: 미끄럼각 약 6.6° 에서 최대 (가정)
  driftMax: 0.6,            // rad, 드리프트 모드에서 이 각(약 34°)을 넘게 미끄러지면 토크 벡터링이 되돌린다 (게임, 대충 둔 값)
  gripBeta: 0.10,           // rad, 그립 모드에서 차체 미끄럼각이 이 각(약 5.7°)을 넘으면 토크 벡터링이 되돌린다 (게임, 11/15 — 0.07 도 시험해 스핀 0 이었다)
  tvGain: 8,                // 토크 벡터링: 요 속도 오차를 줄이는 세기 (게임)
  wheelbase: 2.825,         // m (공식 인터뷰)
  A: 39.6 * LBF,            // 도로부하 (가정)
  B: 0.450 * LBF / MPH,
  C: 0.0168 * LBF / MPH ** 2 * (1.16 / 1.20),
  fanKgf: 1800, pFan: 100e3,   // 흡입 팬 최대 다운포스(kgf, 아래 fanDown — 모든 트림 같음), 팬 전력 100 kW (가정)
  fanLag: 0.25,             // s, 팬이 도는 데 걸리는 시간 (게임)
  // 냉가스 추진기 = 요크의 BOOST 버튼
  thrustPeak: 85e3,         // N (공식 인터뷰 80~90 kN)
  gasFull: 81,              // kg 질소 — Thrust 는 200 L 탱크 1개, 5,500 PSI 로 채우면 약 81 kg (영상 때 계산, Rocket 은 600 L · 250 kg)
  vExhaust: 634,            // m/s (가정, 5,500 PSI 이상 팽창 × 노즐 0.9)
  gasP0: 379,               // bar = 5,500 PSI (공식 영상)
  // 2단 변속 (사용자 11/12 「최고속 시뮬레이션에서 한것과 같은 기어비, 변속시점은 최대토크가 계속 유지되는 그시점」)
  //   1단 8.4:1(회전수 한계 230 mph), 2단 = 최고속 시뮬의 「330 mph 기어비」 = 8.4 × 230/330 ≈ 5.85:1. 그 시뮬은 두 기어비를 따로 비교했을 뿐 변속하는 차는 아니었다 — 변속은 게임에서 새로 넣은 것.
  //   2단의 최대 구동력(토크 한계)이 출력 한계 곡선과 만나는 속도부터는 어느 단이든 구동력이 같다(출력 ÷ 속도) → 거기서 올리면 구동력이 끊기지 않는다. 내릴 때는 10% 낮은 속도에서.
  gear2: 230 / 330,         // 2단 기어비 ÷ 1단 기어비
  regenG: 0.65,             // 가속 페달을 뗐을 때의 회생 감속 (사용자 지정 11/12)
  // 스티어 바이 와이어 (요크 ±150° — 사용자 11/12 「360 → 300」. 실차는 ±170°, 탑기어 39:59)
  yokeLock: 150,            // 도, 요크 끝 (js/main.js 도 이 값을 쓴다)
  yokePeak: 90,             // 도, 이 각에서 그 속도의 횡그립 한계 — 사용자 11/15 「각각 90도 -90 각도 스티어링이 타이어 최대 횡그립나오는 슬립앵글까지만 꺽는거고 그다음부터는 언더스티어」
  sbwGain: 2.0, sbwMax: 0.06,   // 요 제어 세기 · 더하는 앞바퀴 각 상한(rad, 약 3.4°) (내가 둔 값 — 0.5 · 1 · 2 를 랩으로 재 2 가 가장 깨끗했다)
  // 고속일수록 그립 한계가 더 작은 요크 각에서 나온다 — 사용자 11/15 저녁 「아직 고속에서 스티어링 꺽는 각도가 너무 큰것 같아 … 스티어링 타각이 점점 작아질것같은데」
  //   (바로 전 판은 「고속에서는 조금씩만 스티어하게」를 거꾸로 읽어, 고속에서 요크를 더 돌려야(250 km/h 이상 150°) 한계가 나오게 했었다)
  //   한계 요크 각 = sbwV0 까지 yokePeak(90°), 그 위는 90° × sbwV0 / 속도(실차의 고정 조향비는 속도² 에 반비례 — 그보다 완만하게), 아래로 sbwPeakMin 까지
  //   → 100 km/h 90° · 120 75° · 160 56° · 200 45° · 250 36° · 300 이상 30°. 한계 각을 넘기면 같은 비율로 더 꺾여 언더스티어. 값은 내가 둔 것
  sbwV0: 100 / 3.6, sbwPeakMin: 30,
  steerSlip: 0,             // rad, 90° 에서 기하 각에 더하는 미끄럼 몫 — 0 / 0.01 / 0.02 를 재 보니 0 일 때 80~250 km/h 모두 90° 근처에서 횡가속이 가장 컸다 (tools/physcheck/yoke_sweep.mjs, 11/15)
};
// 흡입 다운포스 = 차 무게 × 2 ≈ 4,100 kgf — 스펙: 라스 「바닥 팬이 최대 2 G 를 당긴다」 · 사이트 「서 있어도 거꾸로 붙어 있을 만큼」 · 램프 시연 계기판 최대 4,699 kg
//   (dto_tesla_roadster_unveil/research/02-테크니컬-디테일.md §2 · §7). 사용자 11/15 「출발 흡입력도 스팩에 나온데로 한거 맞음?」 → 「스펙대로 바꿔」.
//   전에는 「코너 2 G」로 읽어 (2.0 / 1.30 − 1) × 무게 ≈ 1,104 kgf (뉘르 랩 시뮬 lapsim.py 와 같은 해석)였다.
//   → 11/21 지금 값은 아래 트림 설명의 1,800 kgf (모든 트림 같음).
SPEC.fanDown = SPEC.fanKgf * G;

// 트림 두 개 — 사용자 11/15 「게임에서 퍼포먼스트림이랑 쓰러스트 트림 두개중 선택할수있게 해야겠다」
//   Performance: 뉘르 영상 시뮬(dto_tesla_roadster_unveil/research/nring/lapsim.py roadster())과 같은 1,700 + 운전자 80 = 1,780 kg, 추진기 없음
//   Thrust: 11/12 에 정한 2,050 kg(운전자 포함) + 질소 81 kg, 추진기 있음
//   모터 · 기어 · 타이어는 같다. 흡입 팬: Performance 는 1,800 kgf — 뉘르 영상 시뮬의 958 kgf(= (2.0 / 1.30 − 1) × 1,780 kg, 「코너 2 G」 역산)로는
//   게임(네 바퀴 모델 + 운전)이 시뮬 속도를 못 따라가(6:09.8, 전 구간 평균 −14 km/h) 사용자 11/15 「시뮬레이션 속도와 비슷하게 될수있도록 팬 다운포스를 조절하던 출력을 조정하던」 →
//   1,400 · 1,600 · 1,800 kgf 를 자동 조향 + 자동 페달 100% 로 재 보고 1,800 에서 5:46.1(가드레일 0)이라 골랐다 (tools/physcheck/lap_sim.mjs FAN=…),
//   Thrust 는 전에 스펙대로 트림 무게 × 2(4,100 kgf)였다. 사용자 11/15 랩 검증 뒤 「시뮬 958 kgf로」(Performance 만 물었다 — 스펙 흡입이면 랩이 영상 5:43.8 보다 훨씬 빨라져서)
//   11/21 사용자 「퍼포던 쓰러스트 던 로켓이던 팬스팩은 똑같으니 다 다운포스 최대량은 똑같지」 → 팬은 모든 트림이 SPEC.fanKgf(1,800 kgf) 하나.
//   (Thrust 만 4,100 kgf 라 더 무거운데도 제동 3.8 G 로 Performance 2.6 G 보다 셌다)
export const TRIMS = {
  performance: { label: 'Performance', massDry: 1780, gasFull: 0 },
  thrust: { label: 'Thrust', massDry: 2050, gasFull: 81 },
};
export function setTrim(name) {
  const key = TRIMS[name] ? name : 'thrust', t = TRIMS[key];
  SPEC.trim = key; SPEC.massDry = t.massDry; SPEC.gasFull = t.gasFull; SPEC.fanDown = SPEC.fanKgf * G;
  return key;
}
SPEC.trim = 'thrust';

// ── 배터리: 192S5P, 사용 가능 100 kWh, R0 + R1‖C1 등가회로 (전부 가정) ──
const OCV_SOC = [0, .05, .10, .20, .30, .40, .50, .60, .70, .80, .90, 1.0];
const OCV_V = [3.00, 3.30, 3.45, 3.55, 3.62, 3.68, 3.74, 3.82, 3.90, 3.98, 4.07, 4.18];
function ocv(soc) {
  if (soc <= 0) return OCV_V[0];
  if (soc >= 1) return OCV_V[11];
  let i = 1; while (OCV_SOC[i] < soc) i++;
  const f = (soc - OCV_SOC[i - 1]) / (OCV_SOC[i] - OCV_SOC[i - 1]);
  return OCV_V[i - 1] + f * (OCV_V[i] - OCV_V[i - 1]);
}
let vavg = 0;
for (let i = 1; i < 12; i++) vavg += (OCV_V[i] + OCV_V[i - 1]) / 2 * (OCV_SOC[i] - OCV_SOC[i - 1]);
const BAT = {
  n: 192 * 5, mCell: 0.33, cp: 1050, tau: 10, vMin: 2.7, vMax: 4.2, regenC: 6,
  ua: 1000, tCool: 25, etaDrive: 0.95, pAux: 5e3, tChargeCut: 70,
  derate: [60, 70, 0.3],
};
BAT.qAh = 100e3 / (BAT.n * vavg);
BAT.dcir25 = 64e-3 / BAT.qAh;
function rFactor(T, soc) {
  const arr = Math.exp(20e3 / 8.314 * (1 / (T + 273.15) - 1 / 298.15));
  return arr * (1 + 0.6 * Math.exp(-soc / 0.08) + 0.1 * Math.max(soc - 0.9, 0) / 0.1);
}
// 정전력 pCell(W, +방전)을 dt 동안. 반환: 실제로 낸 전력
function cellStep(st, pCell, dt) {
  const f = rFactor(st.T, st.soc), r0 = 0.5 * BAT.dcir25 * f, r1 = 0.8 * BAT.dcir25 * f;
  const e = ocv(st.soc) - st.v1;
  let i, pReal;
  if (pCell >= 0) {
    const disc = e * e - 4 * r0 * pCell, iV = (e - BAT.vMin) / r0;
    if (disc < 0 || pCell > BAT.vMin * iV) { i = Math.max(iV, 0); pReal = BAT.vMin * i; }
    else { i = (e - Math.sqrt(disc)) / (2 * r0); pReal = pCell; }
  } else {
    let ramp = Math.min(Math.max((0.98 - st.soc) / 0.08, 0), 1);
    if (st.T > BAT.tChargeCut) ramp = 0;
    const ic = Math.min(-pCell / Math.max(e, 3), BAT.regenC * BAT.qAh * ramp, Math.max((BAT.vMax - e) / r0, 0));
    i = -ic; pReal = i * (e - i * r0);
  }
  const ex = Math.exp(-dt / BAT.tau);
  st.v1 = st.v1 * ex + i * r1 * (1 - ex);
  const q = i * i * r0 + st.v1 * st.v1 / r1;
  st.soc = Math.max(st.soc - i * dt / 3600 / BAT.qAh, 0);
  st.T += (q - BAT.ua / BAT.n * (st.T - BAT.tCool)) * dt / (BAT.mCell * BAT.cp);
  return pReal;
}
function wheelCap(st, pFan) {
  const r0 = 0.5 * BAT.dcir25 * rFactor(st.T, st.soc), e = ocv(st.soc) - st.v1;
  let pMax = e > BAT.vMin ? BAT.vMin * (e - BAT.vMin) / r0 : 0;
  if (st.soc <= 0.01) pMax = 0;
  let cap = Math.min(SPEC.pWheel, (pMax * BAT.n - pFan - BAT.pAux) * BAT.etaDrive * 0.97);
  const [t1, t2, keep] = BAT.derate;
  const fr = 1 - (1 - keep) * Math.min(Math.max((st.T - t1) / (t2 - t1), 0), 1);
  return Math.max(Math.min(cap, SPEC.pWheel * fr), st.soc <= 0.01 ? 0 : 50e3);
}

export const MODES = ['LOW DRAG', 'AUTO', 'HIGH DOWNFORCE'];

// 그 속도에서 그립 한계가 나오는 요크 각(도)
export function peakYoke(va, S = SPEC) { return va <= S.sbwV0 ? S.yokePeak : Math.max(S.sbwPeakMin, S.yokePeak * S.sbwV0 / va); }
// 요크 90° 가 만드는 곡률(1/m): 한계 요크 각에서 그립 한계 곡률이 되게 (바퀴 끝 30° 가 먼저 오면 그것)
//   js/main.js 의 자동 조향 시험(tools/physcheck/autopilot.js) · lap_sim.mjs · yoke_sweep.mjs 도 이 함수를 쓴다
export function peakCurv(va, aMax0, S = SPEC) {
  return Math.min(Math.tan(0.52) / S.wheelbase, S.yokePeak / peakYoke(va, S) * aMax0 / Math.max(va * va, 1));
}

export class Vehicle {
  constructor() { this.reset(0, 0, 0); }
  reset(x, y, psi) {
    Object.assign(this, { x, y, psi, v: 0, vy: 0, r: 0, fan: this.drift ? 0 : SPEC.fanDown, gas: SPEC.gasFull, mode: 1, gear: 1, drift: this.drift || false,   // 팬은 이미 돌고 있는 채로 선다(AUTO)
      aLat: 0, aLon: 0, axF: 0, ayF: 0, thrust: 0, pPack: 0, cap: SPEC.pWheel, offroad: false, slip: 0, tv: 0 });
    this.bat = { soc: 0.95, T: 20, v1: 0 };   // 게임 시작 배터리 — 사용자 11/15 「게임시작은 100% 20도씨」 → 98% 위에서는 회생 충전이 안 된다고 하자 「그러면 95% 로 해」 (전에는 95% · 30°C)
  }
  refillGas() { this.gas = SPEC.gasFull; }
  get gasFrac() { return SPEC.gasFull > 0 ? this.gas / SPEC.gasFull : 0; }   // Performance 는 추진기 · 질소가 없다

  // 네 바퀴 모델 (사용자 11/12 「타이어는 앞뒤 좌우가 있는데 모델링이 완전 잘못된거 아님?」 「무게중심은 50:50 에 낮은 무게 중심 … 후륜구동에 모터가 좌우 따로 … 토크벡터링」)
  //   차체: 앞뒤 속도 v · 옆 속도 vy · 요 속도 r.  바퀴마다: 하중(앞뒤 · 좌우 쏠림 + 팬) → 미끄럼각 → 횡력, 구동 · 제동력과 마찰원을 나눠 쓴다.
  //   바퀴가 헛돌거나 잠기는 것은 계산하지 않는다 — 구동력 제한(TC) · 제동력 제한(ABS)이 늘 켜져 있다고 본다 (게임).
  // inp: {steer -1..1(오른쪽 +), throttle 0..1, brake 0..1, boost bool}
  // road: {grade(진행 방향 기울기), bank(차 왼쪽으로 오르는 기울기, 없으면 0), grip(1=아스팔트)}
  step(inp, road, dt) {
    const S = SPEC, m = S.massDry + this.gas, mg = m * G, L = S.wheelbase, T = S.track;
    const cosT = 1 / Math.sqrt(1 + road.grade * road.grade), sinT = road.grade * cosT;
    // 뱅크(11/18): road.bank = 길이 차 왼쪽으로 오르는 기울기. 중력의 옆 성분(낮은 쪽으로 끌림)과 수직 하중에 들어간다
    const bank = road.bank || 0, cosB = 1 / Math.sqrt(1 + bank * bank), sinB = bank * cosB, cosN = cosT * cosB;
    const mu = S.mu * road.grip, v = this.v, va = Math.abs(v);
    const lf = L * S.rear, lr = L - lf;

    // 조향 → 앞바퀴 각 (스티어 바이 와이어 · 가변 조향비 — 사용자 11/15 「속도에 따라 스티어링 각도에 따라서 프론트 스티어가 어느정도되는지가 변하는게 sbw 의 중요한점」)
    //   요크 ±yokePeak(90°) = 그 속도에서 그립 한계 곡률. 저속에서는 바퀴 끝(30°)이 먼저 온다. 90° 를 넘기면 같은 비율로 바퀴만 더 꺾여 앞바퀴가 최대 횡력을 넘는다 → 언더스티어
    //   (전에는 요크 끝 = 그립 한계 곡률의 1.5배 + 미끄럼 0.09 rad 라, 최대 횡가속이 나오는 요크 각이 80 km/h 85° · 200 km/h 44° · 300 km/h 23° 로 들쭉날쭉했다)
    const N0 = mg * cosN + this.fan, aMax0 = mu * N0 / m;
    const kLock = Math.tan(0.52) / L;
    const sN = inp.steer * S.yokeLock / S.yokePeak;                       // 요크 90° = 1
    // 요크 → 곡률은 팬이 지금 도는지와 상관없이 「팬을 다 돌렸을 때의 그립」으로 바꾼다 (드리프트 · LOW DRAG 는 팬이 안 도니 팬 없이).
    //   11/15 저녁: 전에는 지금 팬 힘을 써서, AUTO 고속에서 요크를 조금 꺾으면 팬이 꺼진 채라 같은 각에 절반만 돌고, 팬이 켜지는 순간 두 배로 돌았다
    //   (yoke_sweep 200 km/h: 30° 0.45 G → 60° 1.79 G)
    const aMap = mu * (mg * cosN + (this.drift || this.mode === 0 ? 0 : S.fanDown)) / m;
    const kReq = sN * peakCurv(va, aMap, S);   // 11/15 저녁: 고속일수록 작은 요크 각에서 한계 (peakYoke)
    const aLatReq = va * va * kReq;
    // 스티어 바이 와이어 요 제어(그립 모드): 차가 요크가 원한 만큼 아직 덜 돌았으면 앞바퀴를 그만큼 더, 더 돌았으면 덜 꺾는다.
    //   정상 상태에서는 0 이라 「90° = 그립 한계」는 그대로이고, 돌기 시작이 빨라지며 뒤가 돌면 저절로 카운터를 친다 (11/15 — 이게 없으면 시속 250 km 에서 횡가속 90% 까지 0.5 s)
    // 목표 요 속도는 그립 한계를 넘지 않게 — 한계 요크 각을 넘긴 만큼은 앞바퀴만 더 꺾여 언더스티어가 되고, 요 제어가 차를 더 돌리지는 않는다
    //   (11/15 저녁: 고속 한계 요크 각을 줄이자 250 km/h 요크 75°(한계의 2배)에서 요 제어가 차를 더 돌려 미끄럼각 8° 를 넘었다)
    const rLim = aMap / Math.max(va, 1), rDes = Math.max(-rLim, Math.min(rLim, -v * kReq));
    const dYaw = !this.drift && va > 5 ? Math.max(-S.sbwMax, Math.min(S.sbwMax, S.sbwGain * (rDes - this.r) * L / va)) : 0;
    const delta = Math.max(-0.52, Math.min(0.52, -(Math.atan(L * kReq) + sN * S.steerSlip * Math.min(va / 15, 1)) + dYaw));   // 왼쪽 +

    // 2단 변속 (v 는 앞뒤 속도)
    const vShift = S.pWheel / (S.torqueF * S.gear2);
    if (this.gear === 1 && v > vShift) this.gear = 2; else if (this.gear === 2 && v < vShift * 0.9) this.gear = 1;
    const gr = this.gear === 2 ? S.gear2 : 1, torqueF = S.torqueF * gr, vTop = S.vMotor / gr;

    // 팬: 모드에 따라 목표 다운포스
    const fWant = inp.throttle > 0.02 && v < vTop ? inp.throttle * Math.min(S.pWheel / Math.max(va, 3), torqueF) : 0;
    const hL = S.hCg / L;
    // 구동에 필요한 다운포스: 뒷바퀴가 코너링에 쓰는 몫(뒤 하중 비율만큼의 횡력)까지 넣어 마찰원으로 본다
    //   (11/15 랩 검증: 전에는 구동력만 봐서, 0.4~0.8 G 로 돌아 나가며 풀액셀일 때 팬이 꺼져 있어 뒷바퀴가 미끄러짐 제한에 걸렸다. 시뮬의 가속 계산 acc_fwd 는 팬 다운포스를 늘 넣는다)
    const needDrive = Math.hypot(fWant * (1 - mu * hL), S.rear * m * this.ayF) / (mu * S.rear) - mg * cosN;
    // 실제 횡가속(ayF)도 본다 — 조향으로 계산한 aLatReq 는 실제의 절반 안팎이라, 그것만 보면 1.3~1.9 G 코너에서 팬이 안 켜져 바깥으로 밀렸다 (11/15 검증). 접지 사용률 80% 를 넘지 않게
    const need = Math.max(m * Math.abs(aLatReq) / mu - mg * cosN, m * Math.abs(this.ayF) / (0.8 * mu) - mg * cosN, needDrive, 0);
    // 팬은 켜면 최대로 — 뉘르 랩 시뮬의 「다운포스가 조금이라도 필요하면 팬을 최대로」(lapsim.py tire_demand fan_full, 사용자 10/20 지정)와 같게.
    //   제동 중에는 늘 최대 (시뮬의 제동 계산 dec_bwd 도 팬 다운포스를 넣는다). 11/15 랩 검증: 전에는 브레이크 밟은 만큼만 돌아서, 부분 제동 뒤 코너에 들어갈 때 팬이 200~600 kgf 에 머물러 뒤가 빠졌다
    const braking = inp.brake > 0.05 && va > 3;
    // 드리프트 모드에서는 다운포스 팬을 끈다 (사용자 11/12 「드리프트 모드에서는 다운포스팬 끔」)
    // AUTO: 1단 구간(변속 속도 아래)에서는 팬이 늘 최대로 돌며 대기한다 — 사용자 11/15 「출발순간에 팬이 도는게 아니고 이미 팬이 돌고있어야지」 「낮은속도에서는 팬이 돌아서 다운포스를 대기하고 있는 상태」.
    //   변속 속도를 기준으로 삼은 건 내 판단: 그 아래는 풀액셀이 뒷바퀴 접지에 막혀 다운포스가 늘 도움이 되고, 위는 출력에 막힌다. 서 있어도 팬 전력 100 kW 를 쓴다
    const target = this.drift || this.mode === 0 ? 0 : this.mode === 2 || va < vShift || braking || need > 0.01 * S.fanDown ? S.fanDown : 0;
    this.fan += (target - this.fan) * Math.min(dt / S.fanLag, 1);
    const pFan = S.pFan * this.fan / S.fanDown;
    const N = mg * cosN + this.fan;

    // 바퀴 하중: 정지 하중(50:50, 팬은 가운데를 누른다고 봄) + 앞뒤 쏠림 + 좌우 쏠림. 가속도는 직전 값을 조금 눅여서 쓴다
    const dLon = m * this.axF * S.hCg / L;                       // 가속 → 뒤로
    const dLat = m * this.ayF * S.hCg / T;                       // 왼쪽 가속(ayF +) → 오른쪽 바퀴로
    const Nf = N * (1 - S.rear) - dLon, Nr = N * S.rear + dLon;
    const Fz = [Nf / 2 - dLat * S.rollFront, Nf / 2 + dLat * S.rollFront, Nr / 2 - dLat * (1 - S.rollFront), Nr / 2 + dLat * (1 - S.rollFront)].map((q) => Math.max(q, 0));   // FL FR RL RR
    const wx = [lf, lf, -lr, -lr], wy = [T / 2, -T / 2, T / 2, -T / 2], wd = [delta, delta, 0, 0];

    // 바퀴마다 미끄럼각 → 횡력(구동 · 제동이 없을 때의 값)
    const vxs = Math.max(va, 2.5), Fy0 = [0, 0, 0, 0], al = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const vxw = Math.max(Math.abs(v - this.r * wy[i]), vxs), vyw = this.vy + this.r * wx[i];
      al[i] = Math.atan2(vyw, vxw) - wd[i];
      Fy0[i] = -mu * Fz[i] * Math.sin(S.tireC * Math.atan(S.tireB * al[i]));
    }

    // 앞뒤 힘의 요구량
    const resist = (S.A * N / mg + S.B * va + S.C * v * v) * Math.sign(v || 1)
      + mg * sinT + (road.grip < 1 ? 0.12 * mg * Math.sign(v || 1) * Math.min(va, 1) : 0);
    this.cap = wheelCap(this.bat, pFan);
    const Fx = [0, 0, 0, 0];
    let pBatt = pFan + BAT.pAux, driving = false, tcL = Infinity, tcR = Infinity;
    const lim = (i) => mu * Fz[i];
    if (v > 0.3 && (inp.brake > 0.02 || inp.throttle <= 0.02)) {
      // 제동: 페달을 떼면 회생 0.65 G(뒷바퀴 모터가 먼저, 뒷바퀴가 못 버티는 만큼은 앞 브레이크가 채운다), 브레이크는 그 위에 더해진다. 바퀴 하중에 비례해 나눈다
      const fade = Math.min(va / 2, 1), fReg0 = S.regenG * m * G * fade, fTot = fReg0 + inp.brake * Math.max(0.96 * mu * N - fReg0, 0);
      const capW = (i) => 0.96 * lim(i);                         // ABS: 바퀴마다 마찰 한계의 96% 까지
      let rearWant = inp.brake > 0.02 ? fTot * (Fz[2] + Fz[3]) / Math.max(N, 1) : fTot;
      // 뒷바퀴는 브레이크를 밟아도 코너링에 쓰는 몫을 남기고, 모자라는 제동은 앞바퀴가 채운다 (11/15: 전에는 브레이크 때 뒷바퀴 횡력을 무시해서 코너 중 10~85% 제동이면 뒤가 빠져 스핀)
      const rearCapL = Math.sqrt(Math.max(capW(2) ** 2 - Fy0[2] ** 2, 0)), rearCapR = Math.sqrt(Math.max(capW(3) ** 2 - Fy0[3] ** 2, 0));
      // 좌우는 바퀴 하중에 비례해 나눈다 (11/15: 반반 나누면 코너에서 하중이 적은 안쪽 바퀴가 먼저 한계에 걸려 제동이 시뮬보다 15% 약했다)
      const sr = Fz[2] / Math.max(Fz[2] + Fz[3], 1), sf = Fz[0] / Math.max(Fz[0] + Fz[1], 1);
      const rl = Math.min(rearWant * sr, rearCapL), rr = Math.min(rearWant * (1 - sr), rearCapR);
      // 페달만 뗐을 때(브레이크 안 밟음)는 뒷바퀴 모터 회생뿐 — 앞 브레이크로 채우지 않는다 (11/15 랩 검증: 2 G 코너에서 액셀을 떼면 앞 브레이크까지 0.65 G 로 걸려 하중이 앞으로 쏠리고 뒤가 빠져 돌았다)
      const frontWant = inp.brake > 0.02 ? fTot - rl - rr : 0, fl = Math.min(frontWant * sf, capW(0)), fr = Math.min(frontWant * (1 - sf), capW(1));
      Fx[0] = -fl; Fx[1] = -fr; Fx[2] = -rl; Fx[3] = -rr;
      pBatt -= Math.min(rl + rr, 0.5 * mg) * va * 0.97 * BAT.etaDrive;     // 회생은 뒷바퀴 몫만
    } else if (inp.brake > 0.02) {
      const f = inp.brake * 0.25 * mu * N * (v > -6 ? 1 : 0) / 4;          // 서 있을 때 브레이크 = 천천히 후진 (게임)
      for (let i = 0; i < 4; i++) Fx[i] = -f;
    } else if (inp.throttle > 0.02) {
      driving = true;
      const pw = this.cap * inp.throttle;
      let Fd = v < vTop ? Math.min(pw / Math.max(va, 3), torqueF * inp.throttle) : 0;
      if (v < -0.3) Fd = inp.throttle * 0.5 * mu * N;
      // 구동력 제한(TC): 뒷바퀴가 코너링에 쓰고 남은 만큼. 최소 30% 는 아주 느릴 때(출발 · 제자리 회전)만 준다
      //   (11/15 랩 검증: 전에는 어느 속도에서나 30% 를 줘서, 시속 200 km 코너에서 뒷바퀴가 옆 접지를 다 쓰는데도 풀액셀이면 뒤가 빠져 돌았다)
      // 그립 모드 안정 제어: 차체 미끄럼각이 gripBeta 를 넘으면 그만큼 구동력을 줄인다 (8° 더 미끄러지면 0)
      const floor = 0.3 * Math.max(1 - va / 10, 0), betaV = Math.abs(Math.atan2(this.vy, Math.max(va, 3)));
      const esc = this.drift ? 1 : Math.min(Math.max(1 - (betaV - S.gripBeta) / 0.14, 0), 1);
      const avL = esc * Math.max(Math.sqrt(Math.max((0.97 * lim(2)) ** 2 - Fy0[2] ** 2, 0)), floor * lim(2)), avR = esc * Math.max(Math.sqrt(Math.max((0.97 * lim(3)) ** 2 - Fy0[3] ** 2, 0)), floor * lim(3));
      // 드리프트 모드: 구동력 제한을 풀어 밟는 대로 뒷바퀴에 준다 → 접지 한계를 넘으면 아래 마찰원에서 횡력이 빠져 뒤가 돌아 나간다
      if (this.drift) { Fx[2] = Fd / 2; Fx[3] = Fd / 2; } else { Fx[2] = Math.min(Fd / 2, avL); Fx[3] = Math.min(Fd / 2, avR); tcL = avL; tcR = avR; }
    }

    // 토크 벡터링: 좌우 뒷바퀴 모터의 힘을 달리 줘서 요 속도를 조향이 원하는 값으로 끌고 간다 (돌아 나가게 돕고, 뒤가 돌면 잡는다)
    this.tv = 0;
    if (va > 3) {
      // 목표 요 속도 = 요크가 원한 곡률 × 속도 (11/15: 앞바퀴 각으로 잡으면 미끄럼 몫까지 곡률로 읽어, 시속 160 km 위에서는 요크 30~60° 에서 벌써 그립 한계였다)
      const rRef = Math.max(-0.95 * aMax0 / va, Math.min(0.95 * aMax0 / va, -v * kReq));
      const Iz = S.kIz * m * (L / 2) ** 2;
      let dF = S.tvGain * Iz * (rRef - this.r) / T;              // 오른쪽 바퀴에 +, 왼쪽 바퀴에 −
      // 그립 모드: 차체 미끄럼각이 gripBeta 를 넘으면 되돌린다 (11/15: 없을 때 시속 200~250 코너에서 26~85° 로 돌았다. 드리프트 모드는 아래에서 dF 를 따로 정한다)
      { const beta = Math.atan2(this.vy, Math.max(va, 3)), over = Math.max(Math.abs(beta) - S.gripBeta, 0) * Math.sign(beta); dF += 250 * over * Iz / T; }
      if (this.drift) {
        // 드리프트 모드의 토크 벡터링: 스핀을 막지 않고 조향 쪽으로 더 돌게 밀어 준다. 미끄러진 각이 driftMax 를 넘을 때만 되돌린다
        const beta = Math.atan2(this.vy, Math.max(va, 3)), over = Math.max(Math.abs(beta) - S.driftMax, 0) * Math.sign(beta);
        dF = (0.25 * S.tvGain * (v * Math.tan(delta) / L * 1.3 - this.r) + 250 * over) * Iz / T;
      }
      const room = (this.drift ? 0.7 : 0.35) * Math.min(lim(2), lim(3)), motor = torqueF / 2;
      dF = Math.max(-room, Math.min(room, dF));
      const nl = Math.max(-motor, Math.min(motor, Fx[2] - dF)), nr = Math.max(-motor, Math.min(motor, Fx[3] + dF));
      // 그립 모드에서 구동 중이면 토크 벡터링 뒤에도 바퀴마다 구동력 제한(TC) 안에 둔다 (11/15: 넘기면 그 바퀴의 횡력이 0 이 되어 코너 탈출 가속이 시뮬의 60~80% 에 그쳤다)
      const cl = (f, c) => Math.max(-c, Math.min(c, f));
      const oL = Fx[2], oR = Fx[3]; Fx[2] = cl(nl, tcL); Fx[3] = cl(nr, tcR); this.tv = (Fx[3] - oR) - (Fx[2] - oL);
    }
    // 그립 모드 자세 제어(ESC): 뒤가 돌아 나가면(미끄럼각이 gripBeta 를 넘고 도는 방향과 반대로 미끄러지면) 바깥 앞바퀴에 브레이크를 걸어 되돌린다
    //   (11/15 랩 검증: 토크 벡터링만으로는 안쪽 뒷바퀴 하중이 작아 2 G 코너에서 되돌리는 힘이 모자랐다 — 실제 차의 ESC 처럼 바퀴 하나를 잡는다)
    if (!this.drift && va > 5) {
      const beta = Math.atan2(this.vy, Math.max(va, 3)), over = Math.abs(beta) - S.gripBeta;
      if (over > 0 && beta * this.r < 0) {
        const i = beta < 0 ? 1 : 0, F = 0.96 * lim(i) * Math.min(over / 0.06, 1);
        Fx[i] = -Math.max(-Fx[i], F);
      }
    }
    if (driving) pBatt += Math.max((Fx[2] + Fx[3]) * va, 0) / 0.97 / BAT.etaDrive;

    const pReal = cellStep(this.bat, pBatt / BAT.n, dt) * BAT.n;
    if (driving && pBatt > 0 && pReal < pBatt * 0.999) { const k_ = Math.max(pReal - pFan - BAT.pAux, 0) / (pBatt - pFan - BAT.pAux); Fx[2] *= k_; Fx[3] *= k_; }
    this.pPack = pReal;

    // 마찰원: 앞뒤 힘을 쓰는 만큼 횡력이 줄어든다
    let sFx = 0, sFy = 0, Mz = 0, slip = 0;
    for (let i = 0; i < 4; i++) {
      const lm = Math.max(lim(i), 1), fx = Math.max(-lm, Math.min(lm, Fx[i]));
      const fy = Fy0[i] * Math.max(Math.sqrt(Math.max(1 - (fx / lm) ** 2, 0)), this.drift && i > 1 ? 0.35 : 0);   // 헛도는 뒷바퀴도 횡력이 35% 는 남는다 (게임 — 드리프트를 다룰 수 있게)
      const c = Math.cos(wd[i]), s_ = Math.sin(wd[i]), bx = fx * c - fy * s_, by = fx * s_ + fy * c;
      sFx += bx; sFy += by; Mz += wx[i] * by - wy[i] * bx;
      slip = Math.max(slip, Math.abs(al[i]) * S.tireB / 2.08 - 1);
    }

    // 추진기: 추력은 탱크 압력에 비례, 3 bar 아래로는 추력 없음 (등온 가정)
    this.thrust = 0;
    if (inp.boost && S.gasP0 * this.gasFrac > 3) {
      this.thrust = S.thrustPeak * this.gasFrac;
      this.gas = Math.max(this.gas - this.thrust / S.vExhaust * dt, 0);
    }

    // 차체 운동
    const Iz = S.kIz * m * (L / 2) ** 2;
    const ax = (sFx + this.thrust - resist) / m, ay = sFy / m;
    let vn = v + (ax + this.r * this.vy) * dt, vyn = this.vy + (ay - G * sinB - this.r * v) * dt, rn = this.r + Mz / Iz * dt;
    if (inp.throttle < 0.02 && inp.brake < 0.02 && !this.thrust && Math.sign(vn) !== Math.sign(v) && va < 0.5) vn = 0;
    if (v > 0.3 && vn < 0 && (inp.brake > 0.02 || inp.throttle <= 0.02)) vn = 0;
    // 아주 느릴 때(와 후진)는 미끄럼각 계산이 불안정해서 바퀴가 구르는 대로만 돈다
    const w = vn > 0 ? Math.min(Math.max((vn - 2) / 3, 0), 1) : 0;
    rn = w * rn + (1 - w) * vn * Math.tan(delta) / L; vyn *= w;
    this.v = vn; this.vy = vyn; this.r = rn;
    this.psi += rn * dt;                    // 오른쪽 조향 = 시계 방향 = 각도 감소
    const cp = Math.cos(this.psi), sp = Math.sin(this.psi);
    this.x += (vn * cp - vyn * sp) * dt;
    this.y += (vn * sp + vyn * cp) * dt;
    const kf = Math.min(dt / 0.08, 1);
    this.axF += (ax - this.axF) * kf; this.ayF += (ay - this.ayF) * kf;
    this.aLat = -(w * ay + (1 - w) * vn * rn); this.aLon = ax; this.slip = Math.max(slip, 0); this.offroad = road.grip < 1;
  }
}
