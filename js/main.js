import * as THREE from 'three';
import { Track, HALF, WALL } from './track.js';
import { Vehicle, SPEC, MODES, TRIMS, setTrim, peakCurv } from './vehicle.js';
import { buildCockpit, drawScreen, EYE } from './cockpit.js';
import { loadPhotoCockpit } from './photo.js';
import { loadModelCockpit } from './model.js';
import { loadInteriorCockpit } from './interior.js';
import { makeArms } from './arms.js';
import { loadExterior } from './exterior.js';
import { PhoneLink } from './link.js';
import { AutoPedal } from './autopedal.js';
import { simRef, ghostAt, LapTel, makeMinimap, drawTelemetry, loadBoard, saveLap, getDriver, setDriver, cleanName, boardHTML } from './laphud.js';
import { boardOn, sendOn, setBoardUrl, submitLap, fetchBoard, WHY } from './online.js';
import { makeForest } from './trees.js';
import { buildGraffiti } from './graffiti.js';
import { buildRoadWear } from './roadwear.js';
import { RGBELoader } from '../vendor/jsm/loaders/RGBELoader.js';

const $ = (id) => document.getElementById(id);
const fmt = (t) => t == null ? '-:--.-' : `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const fmt2 = (t) => t == null ? '-:--.--' : `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;

// ── 화면 ──
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.22;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 6000);

// ── 하늘과 빛 ──
//   11/19 사용자 「광원이라던지 빛반사라던지 … 도로표면 … 폴리곤월드같잖아」 「니가 비교한 실사이미지를 보라고」 — 실제 온보드 장면과의 차이는 주로 빛이었다:
//   실사는 하늘이 밝고 뿌옇고 지평선이 하얗게 뜨며, 그 하늘이 노면 · 가드레일에 비쳐 번들거리고, 먼 숲 · 능선은 옅은 안개에 묻힌다.
//   → 하늘은 사진 대신 그려서 만든다(밝은 지평선 · 옅은 구름 띠 · 해 둘레 빛). 같은 하늘을 둘레 빛(환경광 · 반사)으로도 쓴다.
const texLoader = new THREE.TextureLoader();
const loadTex = (f, srgb = false, rep = true) => texLoader.loadAsync('assets/' + f).then((t) => { if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; });
const [asphalt, asphaltN, asphaltR, grass, grassN, forest, twig, twigA, bark] = await Promise.all([
  loadTex('asphalt_track_diffuse.jpg', true), loadTex('asphalt_track_nor_gl.jpg'), loadTex('asphalt_track_rough.jpg'),
  loadTex('aerial_grass_rock_diffuse.jpg', true), loadTex('aerial_grass_rock_nor_gl.jpg'), loadTex('forrest_ground_01_diffuse.jpg', true),
  loadTex('fir_tree_01_twig_diff.jpg', true, false), loadTex('fir_tree_01_twig_alpha.png', false, false), loadTex('fir_tree_01_bark_diff.jpg', true),
]);
// 해: 서북서 · 높이 24° — 출발 직선에서 앞 왼쪽 낮게(온보드 영상과 비슷한 자리). 값은 내가 둔 것
const SUN_AZ = 292 * Math.PI / 180, SUN_EL = 24 * Math.PI / 180;
const sunDir = new THREE.Vector3(Math.sin(SUN_AZ) * Math.cos(SUN_EL), Math.sin(SUN_EL), -Math.cos(SUN_AZ) * Math.cos(SUN_EL));
function makeSky() {
  const W = 2048, H = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, H);   // 위 = 천정, 가운데 = 지평선, 아래 = 땅 쪽. 톤 매핑을 거치면 옅어지므로 색을 진하게 둔다
  [[0, '#2c68c8'], [0.2, '#4c8be0'], [0.34, '#7fb2ea'], [0.44, '#b7d5f0'], [0.488, '#f2ecdc'], [0.5, '#f6efe0'], [0.512, '#cfcdbf'], [1, '#868b7c']].forEach(([s, col]) => g.addColorStop(s, col));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  let seed = 5; const r = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  c.filter = 'blur(9px)';                          // 구름: 옅고 납작한 띠 몇 줄 (하늘 전체를 덮지 않게 — 처음엔 90개를 겹쳐 온통 잿빛이 됐다)
  for (let q = 0; q < 26; q++) {
    const y = H * (0.26 + r() * 0.2), w = 110 + r() * 300, h = (5 + r() * 14) * (0.6 + (0.47 - y / H) * 3), x = r() * W;
    c.fillStyle = `rgba(255,${250 - (r() * 10 | 0)},${240 - (r() * 18 | 0)},${0.1 + r() * 0.22})`;
    for (const dx of [-W, 0, W]) { c.beginPath(); c.ellipse(x + dx, y, w, h, 0, 0, 6.283); c.fill(); }
  }
  c.filter = 'none';
  const sx = (Math.atan2(sunDir.z, sunDir.x) / (2 * Math.PI) + 0.5) * W, sy = (0.5 - SUN_EL / Math.PI) * H;
  for (const dx of [-W, 0, W]) for (const [rad, a] of [[420, 0.5], [170, 0.75], [46, 1]]) {   // 해 둘레 빛
    const rg = c.createRadialGradient(sx + dx, sy, 0, sx + dx, sy, rad); rg.addColorStop(0, `rgba(255,246,226,${a})`); rg.addColorStop(1, 'rgba(255,246,226,0)');
    c.fillStyle = rg; c.fillRect(sx + dx - rad, sy - rad, rad * 2, rad * 2);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; return t;   // 그림의 위 = 천정(화면으로 확인함)
}
const sky = makeSky();
scene.background = sky; scene.backgroundIntensity = 1.15;
scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(sky).texture; scene.environmentIntensity = 0.9;
// 실내가 받는 하늘빛: 같은 하늘의 채도를 낮춘 것. 하늘 그림은 톤 매핑을 견디도록 파랑을 진하게 둔 것이라, 그대로 실내에 비추면 그늘 속 대시가 남색 벨벳처럼 떴다
//   (보조 검토: 그늘의 대시 윗면이 R14 G25 B46 — 파랑이 빨강의 3배. 어두운 스웨이드는 그늘에서 거의 무채색이다). 유리 · 실내 반사를 거친 빛으로 보고 채도를 45% 로(대충 둔 값)
const envInterior = (() => {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const c = cv.getContext('2d'); c.drawImage(sky.image, 0, 0, 1024, 512);
  const im = c.getImageData(0, 0, 1024, 512), d = im.data;
  for (let k = 0; k < d.length; k += 4) { const y = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; d[k] = y + (d[k] - y) * 0.45; d[k + 1] = y + (d[k + 1] - y) * 0.45; d[k + 2] = y + (d[k + 2] - y) * 0.45; }
  c.putImageData(im, 0, 0);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.mapping = THREE.EquirectangularReflectionMapping;
  return new THREE.PMREMGenerator(renderer).fromEquirectangular(tx).texture;
})();
scene.add(new THREE.HemisphereLight(0xe6eef5, 0x6f7450, 0.85));   // 나무(판)는 환경광을 못 받아서 따로 준다
const HAZE = new THREE.Color(0xdfe5e8);
scene.fog = new THREE.FogExp2(HAZE, 0.00085);   // 1 km 에서 절반쯤, 2 km 면 거의 묻힌다
// 화면 가장자리를 조금 어둡게(렌즈 느낌) — 그림 위에 얹는 띠라 계산이 들지 않는다
{ const v = document.createElement('div'); v.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 42%,rgba(0,0,0,0) 52%,rgba(0,0,0,.3) 100%)'; renderer.domElement.after(v); }
const sun = new THREE.DirectionalLight(0xffe6c4, 3.1);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 500 });
scene.add(sun, sun.target);

// ── 코스와 차 ──
const track = new Track(await (await fetch('data/track.json')).json());
// 나무 자리 · 건물(측량에서 뽑은 것): 없으면 나무는 길 옆에 고르게 뿌린다
try { const sc = await (await fetch('data/scene.json')).json(); track.trees = sc.trees; track.boxes = sc.boxes || []; track.far = sc.far || null; } catch (e) { /* scene.json 없이도 돈다 */ }
track.build(scene, { asphalt, asphaltN, asphaltR, grass, grassN, forest }, makeForest(renderer, { twig, twigA, bark }));
// 노면 낙서(자리 · 양은 항공사진에서 잰 것, 글 · 그림은 지어 그린 것). ?graf=0 으로 끄고 ?graf=0.5 · 2 처럼 양을 바꾼다
const GRAF = parseFloat(new URLSearchParams(location.search).get('graf') ?? '1');
const graffiti = buildGraffiti(track, renderer, Number.isFinite(GRAF) ? GRAF : 1); if (graffiti) scene.add(graffiti);
const roadwear = buildRoadWear(track); if (roadwear) scene.add(roadwear);   // 포장 이음매(잰 자리) · 때운 줄(지어낸 자리)
// 트림: 시작 화면에서 고른다(기본 Thrust). 주소에 ?trim=performance 를 붙이면 그것으로 시작
setTrim(new URLSearchParams(location.search).get('trim') || 'thrust');
const car = new Vehicle();
// 자동 페달: 운전대만 잡으면 액셀 · 브레이크를 시뮬 속도에 맞춰 차가 한다 (P 키 · 아이폰 「자동 페달」, [ ] 로 세기) — 사용자 11/15
const auto = new AutoPedal(track.ghost, 1.0, SPEC);   // 기본 100% = 시뮬 속도 그대로 (11/15 팬 보정 뒤)
const carGroup = new THREE.Group(); scene.add(carGroup);

// ── 시야각 · 속도 번짐 (11/19 사용자 「실제로 앉아있으면 시아각이 어느정도 될련지. 지금은 좀 시아각이 좁아보이는 느낌」 「속도감이 좀더 나도록 화면 좌우경계가 모션블러?」 → 「둘 다 넣기」)
//   시야각: 실내 모델에서 잰 눈 → 앞유리의 좌우 범위는 −26° ~ +64°(폭 90°). 세로 56°(가로 71~87°)로는 앞유리 오른쪽 20~30° 가 잘렸다 → 세로 64° 를 기본으로, − / = 키로 2° 씩(50~80°, 이 맥에 기억).
//   번짐: 「바깥 풍경만」 번지게 한다 — 화면 전체를 번지게 하면 가장자리의 기둥 · 대시까지 뭉개진다. 그래서 한 장을 세 번에 나눠 그린다:
//     ① 실내를 뺀 바깥을 따로 그려 두고 ② 그 그림을 「차가 1/90 초 동안 움직인 만큼」 화소마다 끌어 번지게 화면에 옮기고(가까운 것 · 가장자리일수록 길게, 먼 산 · 하늘은 그대로) ③ 그 위에 실내를 선명하게 그린다.
//     B 키로 세기 0 → 0.7 → 1.2 (0 이면 예전처럼 한 번에 그린다). 주소에 ?fov=64 · ?blur=0.7 로도 정한다.
const QS = new URLSearchParams(location.search);
const remembered = (k, d) => { try { const v = parseFloat(localStorage.getItem(k)); return Number.isFinite(v) ? v : d; } catch { return d; } };
const remember = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* 저장 못 해도 그냥 간다 */ } };
const qnum = (k) => { const v = parseFloat(QS.get(k)); return Number.isFinite(v) ? v : null; };
let FOVB = Math.min(Math.max(qnum('fov') ?? remembered('rr_fov', 64), 50), 80);
let BLUR = Math.min(Math.max(qnum('blur') ?? remembered('rr_blur', 0.7), 0), 2);
const toast = (() => {
  const el = document.createElement('div'); el.style.cssText = 'position:fixed;left:50%;top:18%;transform:translateX(-50%);padding:8px 16px;border-radius:8px;background:rgba(0,0,0,.62);color:#fff;font:600 15px -apple-system,sans-serif;pointer-events:none;opacity:0;transition:opacity .25s;z-index:30';
  document.body.appendChild(el); let h = 0;
  return (t) => { el.textContent = t; el.style.opacity = '1'; clearTimeout(h); h = setTimeout(() => { el.style.opacity = '0'; }, 1400); };
})();
const post = (() => {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  // 바깥을 따로 그려 둘 그림: 화면에 바로 그릴 때와 똑같이 「화소마다 톤 처리 → 그다음 계단 지우기(4배)」가 되어야 한다.
  //   처음에는 밝기 범위가 넓은 그림(톤 처리 전)에 그렸다가 나중에 톤 처리를 했더니, 서 있을 때도 나무 가장자리가 26~32% 흐려졌다(밝은 하늘과 어두운 잎을 톤 처리 전에 섞어서).
  //   three.js 는 따로 그리는 그림에는 톤 처리를 안 넣는데, 「XR 용 그림」 표시가 있으면 화면과 같은 처리를 넣는다 → 그 표시를 빌려 쓴다(r170 에서 이 표시가 하는 일은 톤 처리 · 색 공간 · 버퍼 형식 셋뿐임을 코드에서 확인).
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.UnsignedByteType, samples: 4, depthTexture: new THREE.DepthTexture(size.x, size.y) });
  rt.texture.colorSpace = THREE.SRGBColorSpace; rt.texture.internalFormat = 'RGBA8'; rt.isXRRenderTarget = true;      // RGBA8: 이미 화면용으로 바꾼 값을 그대로 담는다(한 번 더 바뀌지 않게)
  const mat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, uProj: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() }, uDelta: { value: new THREE.Vector3() }, uAspect: { value: 1 }, uMax: { value: 0.045 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tColor; uniform sampler2D tDepth; uniform mat4 uProj; uniform mat4 uProjInv; uniform vec3 uDelta; uniform float uAspect; uniform float uMax; varying vec2 vUv;
      void main() {
        float d = texture2D(tDepth, vUv).x;
        vec4 p = uProjInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); p /= p.w;             // 이 화소에 보이는 것의 자리(카메라 기준 — 코스 좌표는 수천 m 라 정밀도가 모자라 먼 곳이 서 있을 때도 번졌다)
        vec4 c0 = uProj * vec4(p.xyz, 1.0), c1 = uProj * vec4(p.xyz + uDelta, 1.0);         // 지금 화면의 자리 · 조금 전 카메라에서 본 자리(같은 식 둘이라 움직임이 0 이면 차이도 정확히 0)
        vec2 vel = c1.w > 0.0 ? (c0.xy / c0.w - c1.xy / c1.w) * 0.5 : vec2(0.0);
        float L = length(vel * vec2(uAspect, 1.0)); if (L > uMax) vel *= uMax / L;                 // 너무 길게 끌리지 않게(화면 높이의 4.5% 까지)
        float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));  // 화소마다 조금씩 어긋나게(띠가 안 생기게)
        vec3 acc = vec3(0.0);
        for (int i = 0; i < 10; i++) { vec3 c = texture2D(tColor, vUv + vel * ((float(i) + j) / 10.0 - 0.5)).rgb; acc += mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }   // 화면용 값 → 빛의 양으로 바꿔서 섞는다
        gl_FragColor = vec4(acc / 10.0, 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false, toneMapped: false,      // 톤 처리는 ①에서 이미 했다
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(quad);
  return { rt, mat, sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mats: new Map(), hidden: [] };
})();
function draw() {
  if (!(BLUR > 0) || (replay.on && replay.side)) { renderer.render(scene, camera); return; }      // 코스 옆 카메라는 서 있어서 번짐을 쓰지 않는다      // 번짐을 끄면 예전 그대로
  // 조금 전의 카메라 = 지금 자리에서 「차 속도 × 1/90 초 × 세기」만큼 뒤 (방향은 그대로 — 굽이에서 도는 만큼은 넣지 않았다)
  scene.updateMatrixWorld(); camera.updateMatrixWorld();
  const mp = replay.on ? replay.mo.psi : car.psi, mv = replay.on ? replay.mo.v : car.v, mg = replay.on ? 0 : (loc.grade || 0);      // 리플레이 중에는 적어 둔 속도 · 방향(물리 상태는 안 쓴다)
  const T = 0.011 * BLUR, vx = Math.cos(mp) * mv * T, vz = -Math.sin(mp) * mv * T, vy = mg * mv * T;
  const U = post.mat.uniforms; U.uProj.value.copy(camera.projectionMatrix); U.uProjInv.value.copy(camera.projectionMatrixInverse); U.uAspect.value = camera.aspect;
  U.uDelta.value.set(vx, vy, vz).transformDirection(camera.matrixWorldInverse).multiplyScalar(Math.hypot(vx, vy, vz));      // 그동안 카메라가 움직인 만큼(카메라 기준 방향으로)
  // ① 바깥만: 실내(차 묶음)는 보이게 둔 채 색 · 깊이만 안 쓰게 한다 — 숨기면 실내 부품이 그림자 지도에서 빠져 기둥 그림자가 사라진다
  carGroup.traverse((o) => { const mt = o.material; if (mt && !post.mats.has(mt)) post.mats.set(mt, [mt.colorWrite, mt.depthWrite]); });
  post.mats.forEach((_, mt) => { mt.colorWrite = false; mt.depthWrite = false; });
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;      // 그림자 지도는 이번 장에서 한 번만(①에서) 그린다
  renderer.setRenderTarget(post.rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
  post.mats.forEach((w, mt) => { mt.colorWrite = w[0]; mt.depthWrite = w[1]; });
  // ② 번지게 화면으로
  renderer.render(post.sc, post.cam);
  // ③ 실내만 그 위에 선명하게: 바깥은 숨기고(그림자 지도는 ①의 것을 그대로 쓴다) 깊이만 지운 뒤 그린다
  post.hidden.length = 0;
  for (const o of scene.children) if (o !== carGroup && !o.isLight && o.visible) { o.visible = false; post.hidden.push(o); }
  const bg = scene.background; scene.background = null; renderer.autoClear = false; renderer.clearDepth();
  renderer.render(scene, camera);
  renderer.autoClear = true; scene.background = bg; for (const o of post.hidden) o.visible = true; renderer.shadowMap.autoUpdate = true;
}
const { cab, yoke: yoke3d, boost: boostPaddle, screen, hood } = buildCockpit();
// 실내 사진이 있으면 사진 운전석, 없으면 모델링 운전석 (?cockpit=3d 로 강제)
// 운전석 네 가지: 기본 = 새 실내(data/interior/front_glass.json, 없으면 Blender 모델), ?cockpit=model = Blender 모델(assets/private/model.json), ?cockpit=photo = 사진 투영, ?cockpit=3d 또는 자료 없음 = 코드로 만든 옛 운전석
const mode = new URLSearchParams(location.search).get('cockpit');
cab.children.forEach((o) => { o.userData.old = true; });
const photo = mode === '3d' ? null : mode === 'photo' ? (screen.cv.height = 656, await loadPhotoCockpit(cab, screen.tex))
  : (mode !== 'model' && (screen.cv.height = 628, await loadInteriorCockpit(cab, screen.tex, { envMap: envInterior, envScale: scene.environmentIntensity }))) || (screen.cv.height = 480, await loadModelCockpit(cab, screen.tex));
if (photo) { cab.children.forEach((o) => { if (o.userData.old) o.visible = false; }); EYE.copy(photo.eye); camera.rotation.x = -0.05; } else screen.cv.height = 400;
// 새 실내는 햇빛 그림자를 받는다: 기둥 · 지붕 굵기(5~10 cm)가 그림자에 나오도록 그림자 지도를 촘촘하게 (±75 m · 2048 → ±40 m · 4096, 한 칸 약 2 cm). 대신 40 m 밖의 나무 그림자는 안 그려진다
if (photo && photo.interior) { sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.012; }
const yoke = photo ? photo.yoke : yoke3d;
// 팔은 원통을 이어 붙인 임시 형상이라 기본으로 끈다(사용자 판정: 품질 미달). 제대로 된 손 모델을 구하면 교체. ?arms=1 로만 켜진다
const updateArms = new URLSearchParams(location.search).get('arms') === '1' ? makeArms(cab, yoke, EYE, photo ? 0.15 : 0.16) : () => {};
cab.rotation.y = -Math.PI / 2; carGroup.add(cab);   // 운전석의 -Z(앞)를 차의 +X(진행 방향)로
const head = new THREE.Group(); head.position.copy(EYE); cab.add(head); head.add(camera);
// ── 시점: 운전석(기본) ↔ 바깥(C 키). 카메라는 하나를 계속 쓴다 — 바깥에서는 head 에서 떼어 부모 없이 월드 좌표로 놓는다
//   (scene.add(camera) 는 쓰지 않는다: draw() 의 번짐 ③단계가 carGroup · 조명 말고 scene 의 자식을 전부 숨긴다. 외관은 carGroup 밑이라 안전)
//   바깥 카메라 값(차 뒤 6.5 m · 높이 2.0 m · 차 앞 1 m 쯤을 봄 · 시야 60° · 따라가는 빠르기)은 사용자가 정한 것이 아니라 내가 임시로 둔 값이다
const OUT = { back: 6.5, up: 2.0, ahead: 1.0, lookUp: 0.6, fov: 60, follow: 5, side: 0 };   // side: 옆으로 비킨 양(시험용 — 기본 0)
let viewMode = 'in', ext = null, extLoading = null, camYaw = 0; const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function outsideCam(dt, snap, psi = car.psi) {
  const k = snap ? 1 : 1 - Math.exp(-dt * OUT.follow);
  let d = psi - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); camYaw += d * k;   // 방향은 조금 늦게 따라온다(뒤따르는 느낌)
  const fx = Math.cos(camYaw), fz = -Math.sin(camYaw), cp = carGroup.position;
  camPos.set(cp.x - fx * OUT.back - fz * OUT.side, cp.y + OUT.up, cp.z - fz * OUT.back + fx * OUT.side);
  camera.position.copy(camPos); camLook.set(cp.x + Math.cos(psi) * OUT.ahead, cp.y + OUT.lookUp, cp.z - Math.sin(psi) * OUT.ahead); camera.lookAt(camLook);
}
function loadExt() {      // 외관 파일(1.1 MB)은 처음 필요할 때 한 번만 불러온다
  if (ext) return Promise.resolve(ext);
  if (!extLoading) extLoading = loadExterior(carGroup).then((e) => { ext = e; return e; }).catch((e) => { extLoading = null; console.error('외관 모델을 못 불러옴', e); toast('바깥 모델을 못 불러왔습니다'); return null; });
  return extLoading;
}
async function setView(m, quiet) {
  if (m === viewMode) return;
  if (m === 'out') {
    if (!ext) { if (!extLoading && !quiet) toast('바깥 모델 불러오는 중…'); await loadExt(); if (!ext || viewMode === 'out') return; }
    head.remove(camera); camera.rotation.set(0, 0, 0); cab.visible = false; ext.setVisible(true); viewMode = 'out'; camYaw = car.psi; if (!quiet) toast('바깥 시점');
  } else {
    if (ext) ext.setVisible(false);
    cab.visible = true; head.add(camera); camera.position.set(0, 0, 0); camera.quaternion.identity(); camera.rotation.set(photo ? -0.05 : 0, 0, 0); viewMode = 'in'; if (!quiet) toast('운전석 시점');
  }
}

// ── 리플레이: 한 바퀴를 마친 뒤 기록 화면의 「리플레이 보기」 단추로 본다 (사용자 11/19 「차 보여주지는 마. 리플레이때 보여줘」 → 「단추로 보기」). 차 외관은 여기서만 보인다.
//   기록: 한 바퀴를 재는 동안(출발선 통과 ~ 완주) 매 REPLAY.hz 초에 한 번 차의 자세를 적는다 — 물리는 다시 돌리지 않고, 적어 둔 자세를 사이사이 이어서 놓는다.
//   임시 값(사용자가 정하지 않은 것): 카메라 = 뒤따르는 카메라(OUT) 하나, 길이 = 한 바퀴 전체, 빠르기 = 실제 그대로(speed 1), 기록 간격 1/30 초
const REPLAY = { hz: 30, speed: 1,
  // 코스 옆 카메라 — 숫자는 전부 내가 임시로 둔 값(사용자가 정해 주지 않았다): 코스를 따라 300 m 마다 하나 · 포장 끝에서 바깥으로 5 m(가드레일 안쪽에 머물게 줄임) · 땅 위 4 m
  sideEvery: 300, sideOut: 5, sideUp: 4, sideHyst: 40,      // sideHyst: 다음 카메라가 이만큼(m) 더 가까워져야 넘어간다(왔다 갔다 하지 않게)
  fovMin: 12, fovMax: 50, viewH: 7,                         // 차가 너무 작아지지 않게 시야각을 거리에 맞춘다: 거리 d 에서 세로 viewH(m) 가 보이도록 fovMin ~ fovMax 안에서
  autoSegSec: 8 };                                          // 자동: 8 초 단위로 코스 옆 · 코스 옆 · 뒤따르기를 되풀이
const REC_W = 12;   // 한 칸 = [t, 위치 x y z(carGroup), 기울기 x y z(carGroup.rotation), pitch, roll, 내려앉음, 속도, 조향 입력]
const rec = { d: [], n: 0, next: 0, closed: false };
function recReset() { rec.d.length = 0; rec.n = 0; rec.next = 0; rec.closed = false; }
function recSample(inp) {
  const f = rec.closed || lap.t < rec.next - 1e-9 && !finished; if (f) return;
  const P = carGroup.position, Rt = carGroup.rotation;
  rec.d.push(lap.t, P.x, P.y, P.z, Rt.x, Rt.y, Rt.z, pitch, roll, cab.position.y, car.v, inp.steer || 0); rec.n++; rec.next = lap.t + 1 / REPLAY.hz;
  if (finished) rec.closed = true;      // 완주한 장면까지 적고 닫는다
}
const replay = { on: false, t: 0, i: 0, cam: 'auto', side: false, camIdx: -1, fov: 30, mo: { psi: 0, v: 0 }, cur: new Array(REC_W).fill(0), end: 0, shownT: -1 };
function replayAt(t) {      // 적어 둔 값을 시간 t 에서 이어서(방향은 짧은 쪽으로) 읽는다
  const d = rec.d, n = rec.n; let i = replay.i; if (i > 0 && d[i * REC_W] > t) i = 0;
  while (i < n - 2 && d[(i + 1) * REC_W] <= t) i++;
  replay.i = i; const a = i * REC_W, b = a + REC_W, span = d[b] - d[a], u = span > 1e-9 ? Math.min(Math.max((t - d[a]) / span, 0), 1) : 0, o = replay.cur;
  for (let k = 1; k < REC_W; k++) o[k] = d[a + k] + (d[b + k] - d[a + k]) * u;
  const dy = Math.atan2(Math.sin(d[b + 5] - d[a + 5]), Math.cos(d[b + 5] - d[a + 5])); o[5] = d[a + 5] + dy * u; o[0] = t; return o;
}
// 코스 옆 카메라 자리: 트랙 자료(포장 끝 wl · wr, 가드레일 선 bl · br)에서 계산. 굽이에서는 바깥쪽, 곧은 곳은 왼쪽.
//   옆 거리 = 포장 끝 + 5 m 이되 가드레일 선 1 m 안쪽까지만(가드레일 뒤에 놓이지 않게). 나무 · 건물 · 다리에 가리는지는 따로 검사하지 않았다.
let sideCams = null;
function buildSideCams() {
  const T = track, out = [], n = T.n, tr = T.trees;
  const ang = (i) => Math.atan2(T.ty[i], T.tx[i]);
  const idxAt = (s) => { let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (T.s[m] < s) lo = m + 1; else hi = m; } return lo; };
  // 나무 20 m 칸 — 카메라가 나무 속에 놓이거나 나무 뒤에서 길이 가려지는 자리를 피하려고(처음에는 안 피했다가 캡처 한 장이 숲 속이었다)
  const grid = new Map(); if (tr) for (let j = 0; j < tr.x.length; j++) { const k = Math.floor(tr.x[j] / 20) + ',' + Math.floor(tr.y[j] / 20); (grid.get(k) || grid.set(k, []).get(k)).push(j); }
  const near = (x, y, r) => { let c = 0; if (!tr) return 0; for (let gx = Math.floor((x - r) / 20); gx <= Math.floor((x + r) / 20); gx++) for (let gy = Math.floor((y - r) / 20); gy <= Math.floor((y + r) / 20); gy++) { const l = grid.get(gx + ',' + gy); if (l) for (const j of l) if ((tr.x[j] - x) ** 2 + (tr.y[j] - y) ** 2 < r * r) c++; } return c; };
  for (let sd = 0; sd < T.length; sd += REPLAY.sideEvery) {
    const i0 = idxAt(sd), a = idxAt(Math.max(sd - 80, 0)), b = idxAt(Math.min(sd + 80, T.length - 1));
    let da = ang(b) - ang(a); da = Math.atan2(Math.sin(da), Math.cos(da));      // 양수 = 왼쪽으로 도는 굽이 → 바깥은 오른쪽
    const left = Math.abs(da) < 0.05 ? true : da < 0;
    let best = null;
    for (const ds of [0, -40, 40, -80, 80, -120, 120]) {      // 이상적인 자리에서 앞뒤로 비켜 가며 나무를 덜 만나는 자리를 고른다
      const i = idxAt(Math.min(Math.max(sd + ds, 0), T.length - 1)), w = left ? T.wl[i] : T.wr[i], bar = left ? T.bl[i] : T.br[i];
      for (const o of [REPLAY.sideOut, 3.5, 2, 6.5, 8]) {      // 포장 끝에서 바깥으로: 5 m 가 기본, 막히면 가까이 · 더 멀리
        let lat = Math.min(w + o, bar - 1.0); lat = Math.max(lat, w + 1.5);
        const sg = left ? 1 : -1, cx = T.x[i] + T.nx[i] * lat * sg, cy = T.y[i] + T.ny[i] * lat * sg;
        let blocked = near(cx, cy, 3.5) * 10;      // 카메라 둘레 3.5 m 안의 나무(수관 안 — 숲길은 어디나 8 m 안에 나무가 있어 더 크게 잡으면 자리가 안 남는다)
        // 카메라 → 길 가운데의 앞뒤 여러 점(차가 다가오고 멀어지는 길목) 사이를 가리는 나무: 처음에는 바로 맞은편만 봤더니, 멀리서 길을 따라 비스듬히 보는 장면이 나무에 막혔다
        for (const dt of [-120, -60, 0, 60, 120]) {
          const k = idxAt(Math.min(Math.max(T.s[i] + dt, 0), T.length - 1)), tx = T.x[k], ty = T.y[k], len = Math.hypot(tx - cx, ty - cy), m = Math.max(3, Math.ceil(len / 8));
          for (let q = 1; q < m; q++) { const u = q / m; blocked += near(cx + (tx - cx) * u, cy + (ty - cy) * u, 3); }
        }
        const cost = blocked + Math.abs(ds) * 0.02 + Math.abs(o - REPLAY.sideOut) * 0.05;
        if (!best || cost < best.cost) best = { cost, i, lat: lat * sg, blocked };
      }
    }
    out.push({ s: T.s[best.i], blocked: best.blocked, pos: new THREE.Vector3(...T.at(best.i, best.lat, REPLAY.sideUp)) });
  }
  return out;
}
function sideCam(dt, psi) {
  const P = carGroup.position, cams = sideCams; let k = replay.camIdx;
  const d2 = (c) => (c.pos.x - P.x) ** 2 + (c.pos.z - P.z) ** 2;
  let bi = 0, bd = Infinity; for (let q = 0; q < cams.length; q++) { const d = d2(cams[q]); if (d < bd) { bd = d; bi = q; } }
  if (k < 0) k = bi; else { const dc = Math.sqrt(d2(cams[k])), dn = Math.sqrt(bd); if (bi !== k && dn + REPLAY.sideHyst < dc) k = bi; }
  const cut = k !== replay.camIdx; replay.camIdx = k;
  const c = cams[k]; camera.position.copy(c.pos); camera.lookAt(P.x, P.y + 0.7, P.z);
  const dist = Math.hypot(c.pos.x - P.x, c.pos.y - P.y, c.pos.z - P.z);
  replay.fov = Math.min(Math.max(2 * Math.atan(REPLAY.viewH / 2 / dist) * 180 / Math.PI, REPLAY.fovMin), REPLAY.fovMax);
  if (cut) { camera.fov = replay.fov; camera.updateProjectionMatrix(); }
}
const CAM_LABEL = { auto: '자동 (코스 옆 + 뒤따르기)', side: '코스 옆', chase: '뒤따르기' };
function setReplayCam(m) { replay.cam = m; replay.camIdx = -1; $('btnReplayCam').textContent = '카메라: ' + CAM_LABEL[m]; }
function nextReplayCam() { setReplayCam(replay.cam === 'auto' ? 'side' : replay.cam === 'side' ? 'chase' : 'auto'); }
async function startReplay() {
  if (!finished || rec.n < 2 || replay.on) return;
  replay.on = true; replay.t = 0; replay.i = 0; replay.side = false; replay.camIdx = -1; if (!sideCams) sideCams = buildSideCams(); setReplayCam(replay.cam); replay.end = rec.d[(rec.n - 1) * REC_W]; replay.shownT = -1;
  $('result').classList.add('hide'); document.body.classList.add('replay'); $('replayBar').classList.remove('hide');
  await loadExt();
  if (!replay.on) return;      // 불러오는 동안 닫았다
  if (!ext) { stopReplay(); return; }
  await setView('out', true); if (!replay.on) return;
  const s = replayAt(0); camYaw = s[5]; replay.mo.psi = s[5]; replay.mo.v = s[10];
}
function stopReplay(silent) {
  if (!replay.on) return;
  replay.on = false; replay.side = false; document.body.classList.remove('replay'); $('replayBar').classList.add('hide');
  setView('in', true);      // 운전석으로: 차 외관을 다시 숨긴다
  if (!silent && finished) $('result').classList.remove('hide');
}
function replayFrame(dt) {
  replay.t += dt * REPLAY.speed;
  if (replay.t >= replay.end) { stopReplay(); return; }
  const s = replayAt(replay.t), P = carGroup.position;
  P.set(s[1], s[2], s[3]); carGroup.rotation.set(s[4], s[5], s[6], 'YZX');
  replay.mo.psi = s[5]; replay.mo.v = s[10];
  ext.update(dt, { v: s[10] }, { steer: s[11] }, s[7], s[8], s[9]);
  const useSide = replay.cam === 'side' || (replay.cam === 'auto' && Math.floor(replay.t / REPLAY.autoSegSec) % 3 !== 2);
  if (useSide !== replay.side) { replay.side = useSide; replay.camIdx = -1; if (!useSide) outsideCam(dt, true, s[5]); }      // 방식이 바뀌면 뒤따르기 방향은 지금 차 방향으로 맞춘다
  if (useSide) sideCam(dt, s[5]); else outsideCam(dt, false, s[5]);
  const sec = Math.floor(replay.t); if (sec !== replay.shownT) { replay.shownT = sec; $('replayT').textContent = `리플레이 ${fmt(replay.t)} / ${fmt(replay.end)}`; }
}
$('btnReplay').addEventListener('click', startReplay);
$('btnReplayClose').addEventListener('click', () => stopReplay());
$('btnReplayCam').addEventListener('click', nextReplayCam);

let loc;
// 출발 자리: 출발선 30 m 앞. 주소에 ?km=11.7 처럼 붙이면 그 지점에서 시작한다(구간 확인용)
const KM0 = parseFloat(new URLSearchParams(location.search).get('km'));
const START_I = Number.isFinite(KM0) ? Math.round(KM0 * 1000 / track.length * track.n) % track.n : track.n - 15;
function placeAt(i, lat = 0) {
  const psi = Math.atan2(track.ty[i], track.tx[i]);
  car.reset(track.x[i] + track.nx[i] * lat, track.y[i] + track.ny[i] * lat, psi);
  loc = track.locate(car.x, car.y, i);
}
placeAt(START_I);

// ── 입력: 키보드 + 아이폰 ──
const keys = new Set(); let kSteer = 0;
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;   // 드라이버 이름을 칠 때는 게임 키로 쓰지 않는다
  keys.add(e.code);
  if (e.code === 'Digit1') car.mode = 0; if (e.code === 'Digit2') car.mode = 1; if (e.code === 'Digit3') car.mode = 2;
  if (e.code === 'KeyR') { placeAt(loc.i); lap.t = null; }
  if (e.code === 'KeyQ') $('qr').classList.toggle('hide');
  if (e.code === 'KeyT') car.drift = !car.drift;   // 토크 벡터링: 그립 ↔ 드리프트
  if (e.code === 'KeyP') auto.on = !auto.on;
  // 주행 중에는 차를 바깥에서 보여 주지 않는다 — 리플레이 때만 보인다 (사용자 11/19 「차 보여주지는 마. 리플레이때 보여줘」).
  //   그래서 C 키 전환은 뺐다. setView('out') 는 리플레이(아래 startReplay)가 쓴다. 시험할 때는 window.__game.setView('out')
  if (e.code === 'KeyC' && replay.on) nextReplayCam();      // 리플레이 중에만 카메라 방식 바꾸기(주행 중 C 는 아무 일도 안 한다)
  if (e.code === 'Escape') { if (replay.on) stopReplay(); else setPause(!paused); }   // 일시 정지 (사용자 11/15 「게임 일시 멈춤 만들어줘」)
  if (e.code === 'BracketLeft') auto.setStrength(auto.strength - 0.01); if (e.code === 'BracketRight') auto.setStrength(auto.strength + 0.01);
  if (e.code === 'Minus' || e.code === 'Equal') { FOVB = Math.min(Math.max(FOVB + (e.code === 'Equal' ? 2 : -2), 50), 80); remember('rr_fov', FOVB); toast(`시야각 세로 ${FOVB}° (가로 약 ${Math.round(2 * Math.atan(Math.tan(FOVB * Math.PI / 360) * camera.aspect) * 180 / Math.PI)}°)`); }
  if (e.code === 'KeyB') { BLUR = BLUR <= 0 ? 0.7 : BLUR < 1 ? 1.2 : 0; remember('rr_blur', BLUR); toast(BLUR > 0 ? `속도 번짐 ${BLUR}` : '속도 번짐 끔'); }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
const link = new PhoneLink((st, msg) => {
  $('phone').textContent = st === 'connected' ? '아이폰 연결됨' : st === 'error' ? '연결 오류: ' + msg : '아이폰 대기 중 (Q: QR)';
  $('phone').className = st;
  if (st === 'connected') $('qr').classList.add('hide');
  if (link.url && $('qr').dataset.url !== link.url && window.qrcode) {   // 주소가 바뀌면(와이파이 ↔ 핫스팟) 다시 그린다
    const q = window.qrcode(0, 'M'); q.addData(link.url); q.make();
    $('qrimg').innerHTML = q.createSvgTag({ cellSize: 5, margin: 2 }); $('qrurl').textContent = link.url; $('qr').dataset.url = link.url;
  }
});
function readInput(dt) {
  if (link.active) {
    const p = link.state; if (p.mode != null && p.mode !== readInput.pm) { car.mode = p.mode; readInput.pm = p.mode; }
    if (p.drift != null && p.drift !== readInput.pd) { car.drift = !!p.drift; readInput.pd = p.drift; }
    if (p.auto != null && p.auto !== readInput.pa) { auto.on = !!p.auto; readInput.pa = p.auto; }
    return { steer: p.steer, throttle: p.throttle, brake: p.brake, boost: !!p.boost };
  }
  const want = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
  const rate = want === 0 ? 4 : 2.2; // 키보드는 운전대를 서서히 돌린다
  kSteer += Math.sign(want - kSteer) * Math.min(Math.abs(want - kSteer), rate * dt);
  return { steer: kSteer, throttle: keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0, brake: keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0, boost: keys.has('Space') };
}

// ── 소리: 모터음·바람·추진기 (녹음 없이 합성) ──
let audio = null;
function startAudio() {
  const ac = new AudioContext(), out = ac.createGain(); out.gain.value = 0.5; out.connect(ac.destination);
  const noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const mk = (type, ftype, f) => { const g = ac.createGain(); g.gain.value = 0; const fl = ac.createBiquadFilter(); fl.type = ftype; fl.frequency.value = f; let src; if (type === 'noise') { src = ac.createBufferSource(); src.buffer = noise; src.loop = true; } else { src = ac.createOscillator(); src.type = type; } src.connect(fl).connect(g).connect(out); src.start(); return { src, g, fl }; };
  audio = { ac, m1: mk('sawtooth', 'lowpass', 1800), m2: mk('square', 'lowpass', 2600), wind: mk('noise', 'bandpass', 500), jet: mk('noise', 'highpass', 900), fan: mk('sawtooth', 'bandpass', 700), fanAir: mk('noise', 'bandpass', 1400) };
}
function updateAudio(inp) {
  if (!audio) return; const t = audio.ac.currentTime, v = Math.abs(car.v), rev = v / 0.367 * 8.4 / (2 * Math.PI);
  const load = Math.min(Math.abs(car.pPack) / 1.1e6, 1);
  audio.m1.src.frequency.setTargetAtTime(70 + rev * 3.2, t, 0.03); audio.m2.src.frequency.setTargetAtTime(140 + rev * 7.9, t, 0.03);
  audio.m1.g.gain.setTargetAtTime(0.015 + load * 0.07, t, 0.05); audio.m2.g.gain.setTargetAtTime(load * 0.025, t, 0.05);
  audio.wind.g.gain.setTargetAtTime(Math.min((v / 90) ** 2, 1.2) * 0.5 + car.fan / SPEC.fanDown * 0.12, t, 0.1); audio.wind.fl.frequency.setTargetAtTime(300 + v * 9, t, 0.1);
  audio.jet.g.gain.setTargetAtTime(car.thrust > 0 ? 0.3 + 0.6 * car.gasFrac : 0, t, 0.04);
  // 다운포스 팬: 서 있어도 돌면 들린다 — 터빈 같은 높은 음 + 빨아들이는 바람 (사용자 11/12 「팬을 키면 저속에서도 강력한 다운포스 … 그런 느낌이 아님」)
  const fr = car.fan / SPEC.fanDown;
  audio.fan.src.frequency.setTargetAtTime(260 + fr * 620, t, 0.08); audio.fan.fl.frequency.setTargetAtTime(500 + fr * 900, t, 0.08); audio.fan.g.gain.setTargetAtTime(fr * 0.11, t, 0.08);
  audio.fanAir.g.gain.setTargetAtTime(fr * 0.45, t, 0.08);
}

// ── 한 걸음 ──
const LOCK = Math.PI * SPEC.yokeLock / 180;   // 한쪽 150° = 끝에서 끝 300° (사용자 11/12: 360 → 300) — js/vehicle.js SPEC.yokeLock
const lap = { t: null, last: null, best: null };
let shake = 0;
// 랩 기록 · 미니맵 (js/laphud.js)
const ref = simRef(track), tel = new LapTel(ref.nb), drawMap = makeMinimap(track, $('minimap'));
let finished = false;
function physics(dt) {
  let inp = readInput(dt);
  const cosA = Math.cos(car.psi) * loc.tx + Math.sin(car.psi) * loc.ty;
  // 자동 페달이 켜져 있으면 액셀은 자동, 브레이크는 자동과 밟은 것 중 큰 쪽(밟으면 액셀은 뗀다)
  if (auto.on) { const a = auto.update(car, cosA, dt); inp = { ...inp, throttle: inp.brake > 0.05 ? 0 : a.throttle, brake: Math.max(inp.brake, a.brake) }; }
  const onRoad = loc.lat < loc.wl + 1.2 && loc.lat > -loc.wr - 1.2;
  const sinH = -Math.cos(car.psi) * loc.ty + Math.sin(car.psi) * loc.tx;   // 차 방향의 왼쪽 성분
  // 길 기울기를 차 방향 기준으로: 앞뒤(grade) · 좌우(bank — 차 왼쪽으로 오르면 +). 카루셀 뱅크가 여기로 들어간다
  car.step(inp, { grade: loc.grade * cosA + loc.bank * sinH, bank: loc.bank * cosA - loc.grade * sinH, grip: onRoad ? 1 : 0.5 }, dt);
  const prevS = loc.s;
  loc = track.locate(car.x, car.y, loc.i);
  // 가드레일: 밖으로 못 나가고, 부딪힌 각도만큼 속도를 잃는다
  const lim = (loc.lat > 0 ? loc.bl : loc.br) - 1.05;
  if (Math.abs(loc.lat) > lim) {
    const sd = Math.sign(loc.lat), over = Math.abs(loc.lat) - lim;
    car.x += loc.ty * sd * over; car.y -= loc.tx * sd * over;
    const sinA = -Math.cos(car.psi) * loc.ty + Math.sin(car.psi) * loc.tx; // 진행 방향의 왼쪽 성분
    if (sinA * sd * Math.sign(car.v || 1) > 0) {
      if (lap.t != null && Math.abs(car.v * sinA) > 2) tel.hits++;   // 가드레일에 2 m/s 넘게 부딪힘
      shake = Math.min(Math.abs(car.v * sinA) / 12, 1.5);
      car.v *= 1 - 0.75 * Math.abs(sinA);
      const tang = Math.atan2(loc.ty, loc.tx) + (cosA < 0 ? Math.PI : 0);
      car.psi = tang - sd * 0.02 * Math.sign(cosA || 1);
      car.vy = 0; car.r = 0;   // 벽에 닿으면 옆 미끄러짐 · 회전을 멈춘다
    }
    loc = track.locate(car.x, car.y, loc.i);
  }
  // 랩: 출발선을 앞으로 지나면 시작·기록
  const crossed = prevS > track.length - 60 && loc.s < 60 && car.v > 0;
  if (lap.t != null) {
    lap.t += dt;
    if (!crossed) tel.add(loc.s, lap.t, car.v * 3.6, inp.throttle, inp.brake);
    tel.vmax = Math.max(tel.vmax, car.v * 3.6); tel.gmax = Math.max(tel.gmax, Math.hypot(car.aLat, car.aLon) / 9.81);
    if (!onRoad) tel.off += dt;
    if (auto.on) tel.auto = true;
  }
  if (crossed) {
    // 한 바퀴를 돌면 끝내고 기록 · 텔레메트리 · 랩보드를 보여 준다 (사용자 11/15 밤)
    if (lap.t != null) { lap.last = lap.t; lap.best = Math.min(lap.best ?? 1e9, lap.t); finishLap(); return inp; }
    lap.t = 0; recReset(); tel.reset(); tel.auto = auto.on; car.refillGas(); // 추진기 가스는 출발선에서 다시 채운다 (게임)
  }
  return inp;
}

let pitch = 0, roll = 0, tHud = 0, tSend = 0, started = false, fps = 60, paused = false;
// 일시 정지: 물리 · 랩 시간 · 소리를 멈춘다(화면은 그대로 그린다). Esc · 멈춤 화면 누르기 · 아이폰 「일시 정지」 버튼
function setPause(p) {
  if (!started || finished) return;
  paused = p; $('pause').classList.toggle('hide', !paused);
  if (audio) (paused ? audio.ac.suspend() : audio.ac.resume()).catch(() => {});
}
$('pause').addEventListener('click', () => setPause(false));
function frame(now, once) {   // once: 한 장만 그리고 다음 장을 예약하지 않는다(시험용 캡처)
  const dt = Math.min((now - (frame.t ?? now)) / 1000, 0.05); frame.t = now;
  let inp = { steer: 0, throttle: 0, brake: 0, boost: false };
  // 아이폰 「일시 정지」 버튼은 누를 때마다 숫자(pz)가 하나씩 오른다 → 바뀌면 멈춤 ↔ 계속
  //   한 바퀴 기록 화면에서는 같은 버튼이 「다시 달리기」
  if (link.active && link.state.pz != null && link.state.pz !== frame.pz) { if (frame.pz != null) { if (finished) restartLap(); else setPause(!paused); } frame.pz = link.state.pz; }
  if (started && !paused && !finished) { const n = Math.max(1, Math.round(dt * 240)); for (let i = 0; i < n; i++) { inp = physics(dt / n); if (finished) break; } }
  if (dt > 0) fps += (1 / dt - fps) * 0.05;

  carGroup.position.set(car.x, loc.z, -car.y);
  const cosA = Math.cos(car.psi) * loc.tx + Math.sin(car.psi) * loc.ty;
  const sinH = -Math.cos(car.psi) * loc.ty + Math.sin(car.psi) * loc.tx;
  carGroup.rotation.set(Math.atan(loc.bank * cosA - loc.grade * sinH), car.psi, Math.atan(loc.grade * cosA + loc.bank * sinH), 'YZX');   // 길이 옆으로 기운 만큼(뱅크) 차도 기운다
  // 차체 기울기와 머리 흔들림
  pitch += (car.aLon * 0.0035 - pitch) * 0.1; roll += (car.aLat * 0.0028 - roll) * 0.1;
  cab.rotation.set(pitch, -Math.PI / 2, roll, 'YXZ');
  cab.position.y = -0.035 * car.fan / SPEC.fanDown;   // 팬이 돌면 차가 바닥으로 눌려 내려앉는다 (3.5 cm, 대충 둔 값)
  if (started && !paused && lap.t != null && !replay.on) recSample(inp);
  if (replay.on) { if (viewMode === 'out' && ext) replayFrame(dt); }      // 리플레이: 물리 상태(car · lap · tel)는 건드리지 않고 차 묶음 자세만 적어 둔 값으로
  else if (viewMode === 'out') { ext.update(dt, car, inp, pitch, roll, cab.position.y); outsideCam(dt, false); }
  const v = Math.abs(car.v), rough = (car.offroad ? 0.02 : loc.kerb ? 0.009 : 0.0012) * Math.min(v / 20, 1) + shake * 0.03 + (car.thrust > 0 ? 0.004 : 0);   // 연석 위에서는 톱니를 타는 떨림
  shake *= 0.9;
  head.position.set(EYE.x + (Math.random() - 0.5) * rough, EYE.y + (Math.random() - 0.5) * rough, EYE.z + Math.min(Math.max(car.aLon * 0.004, -0.06), 0.08));
  {
    head.rotation.y = -inp.steer * 0.12 * Math.min(v / 30, 1);   // 굽이 안쪽을 본다
    camera.fov += ((viewMode === 'out' ? (replay.on && replay.side ? replay.fov : OUT.fov) : (photo ? FOVB : 60) + Math.min(v / 95, 1.3) * (photo ? 6 : 14) + (car.thrust > 0 ? 5 : 0)) - camera.fov) * 0.08; camera.updateProjectionMatrix();   // 기본 시야각 FOVB(− / = 키) + 속도에 따라 최대 +8° + 부스트 +5°
  }
  yoke.rotation.z = -inp.steer * LOCK;   // 끝에서 끝까지 300° (사용자 지정)
  updateArms();
  boostPaddle.position.z = inp.boost ? -0.022 : -0.03;
  sun.target.position.copy(carGroup.position); sun.position.copy(carGroup.position).addScaledVector(sunDir, 200);
  updateAudio(inp);

  if (now - tHud > 1000 / 30 - 1) {   // 계기 · 속도 숫자: 초당 30번 — 뉘르 영상 온보드 HUD 와 같게(dto_tesla_roadster_unveil/onboard/render.py FPS 30, 사용자 11/15 「속도계표시가 뉘르 영상때 시뮬처럼 더 빠르게」). 전에는 0.1 s
    tHud = now;
    const d = { kmh: v * 3.6, mode: `${car.drift ? 'DRIFT (팬 꺼짐)' : MODES[car.mode]} · ${car.gear}단${auto.on ? ` · 자동 페달 ${Math.round(auto.strength * 100)}%` : ''}`, soc: car.bat.soc, T: car.bat.T, gas: car.gasFrac, boost: car.thrust > 0, fan: car.fan / SPEC.fanDown, fanKgf: car.fan / 9.81, kw: car.pPack / 1000,
      lap: `LAP ${fmt(lap.t)}   LAST ${fmt(lap.last)}`, g: `${(Math.hypot(car.aLat, car.aLon) / 9.81).toFixed(1)} G` };
    drawScreen(screen, d);
    $('speed').textContent = d.kmh.toFixed(0); $('mode').textContent = d.mode;
    // 랩 시간(오른쪽 위) · 시뮬 대비 · 지난 / 최고
    $('lapT').textContent = fmt(finished ? lap.last : lap.t);
    if (lap.t != null && !finished) {
      const dd = lap.t - ref.t[Math.min(Math.max(Math.floor(loc.s / 10), 0), ref.nb - 1)];
      $('lapD').textContent = `시뮬 대비 ${dd >= 0 ? '+' : '−'}${Math.abs(dd).toFixed(1)} s`; $('lapD').className = dd > 0 ? 'bad' : 'good';
    } else { $('lapD').textContent = lap.t == null && !finished ? '출발선을 지나면 시작' : ''; $('lapD').className = ''; }
    $('lapLB').textContent = `지난 ${fmt(lap.last)} · 최고 ${fmt(lap.best)} · 시뮬 ${fmt(track.ghost.lap)}`;
    // 액셀 · 브레이크 % (자동 페달이 밟은 것 포함)
    const th = Math.round(inp.throttle * 100), bk = Math.round(inp.brake * 100);
    $('thrV').textContent = th + '%'; $('brkV').textContent = bk + '%'; $('thrBar').style.height = th + '%'; $('brkBar').style.height = bk + '%';
    // 미니맵: 나(빨강) · 같은 랩 시간의 시뮬 차(회색)
    drawMap(car, lap.t != null && !finished ? ghostAt(track, lap.t) : null);
    $('info').textContent = `${TRIMS[SPEC.trim].label} · 배터리 ${(d.soc * 100).toFixed(0)}% · 셀 ${d.T.toFixed(0)}°C · ${SPEC.gasFull > 0 ? `부스트 ${(d.gas * 5500).toFixed(0)} PSI (${(d.gas * 100).toFixed(0)}%)` : '추진기 없음'} · ${(loc.s / 1000).toFixed(1)} km`;   // 최고 · 시뮬은 오른쪽 위 랩 시간 아래로 옮김
    $('fps').textContent = fps.toFixed(0) + ' fps';
  }
  if (now - tSend > 100) { tSend = now; link.send({ t: 's', kmh: Math.round(v * 3.6), gas: car.gasFrac, mode: car.mode, soc: car.bat.soc, auto: auto.on, pause: paused }); }
  draw();
  if (!once) requestAnimationFrame(frame);
}
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); const z = renderer.getDrawingBufferSize(new THREE.Vector2()); post.rt.setSize(z.x, z.y); }
addEventListener('resize', resize); resize();
// 시작 화면: 트림 버튼을 누르면 그 트림으로 차를 다시 세우고 출발한다(빈 곳을 누르면 지금 트림으로)
function chooseTrim(name) { setTrim(name); placeAt(START_I); lap.t = null; lap.last = null; lap.best = null;
  document.querySelectorAll('#start [data-trim]').forEach((b) => b.classList.toggle('on', b.dataset.trim === SPEC.trim)); }
chooseTrim(SPEC.trim);
// 드라이버 이름: 처음 시작할 때 넣는다(사용자 11/15 밤), 다음부터는 이 브라우저가 기억한다
let driver = getDriver();
$('driverName').value = driver;
function showDriverInfo() {
  const n = cleanName($('driverName').value), mine = loadBoard().filter((r) => (r.driver || '') === n);
  if (!n) { $('driverInfo').textContent = '이름을 넣고 트림을 눌러 출발'; return; }
  const best = {}; for (const r of mine) best[r.trim] = Math.min(best[r.trim] ?? Infinity, r.time);
  $('driverInfo').textContent = mine.length ? `${n} · ${mine.length}랩 · ` + Object.entries(best).map(([t, v]) => `${TRIMS[t]?.label ?? t} 최고 ${fmt2(v)}`).join(' · ') : `${n} · 첫 주행`;
}
$('driverName').addEventListener('input', () => { $('driverName').classList.remove('need'); showDriverInfo(); });
showDriverInfo();
$('start').addEventListener('click', (e) => { if (e.target.closest('.driver')) return;
  const name = cleanName($('driverName').value);
  if (!name) { $('driverName').classList.add('need'); $('driverName').focus(); $('driverInfo').textContent = '드라이버 이름을 먼저 넣어 주세요'; return; }
  driver = name; setDriver(name); $('driverName').value = name; $('driverName').blur();
  const b = e.target.closest('[data-trim]'); if (b) chooseTrim(b.dataset.trim);
  started = true; $('start').classList.add('hide'); try { if (!audio) startAudio(); } catch { /* 소리 없이 진행 */ } });   // !audio: 「트림 바꾸기」로 돌아와 다시 누를 때 소리가 두 겹이 되지 않게
requestAnimationFrame(frame);
// ── 한 바퀴 끝 ──
function finishLap() {
  finished = true;
  if (audio) audio.ac.suspend().catch(() => {});
  const time = lap.last, trim = SPEC.trim;
  const prev = loadBoard().filter((r) => r.trim === trim && (r.driver || '') === driver).reduce((m, r) => Math.min(m, r.time), Infinity);
  const rec = { id: Date.now(), driver, time, trim, auto: tel.auto, hits: tel.hits, off: +tel.off.toFixed(1), vmax: Math.round(tel.vmax), date: (() => { const d = new Date(), p = (x) => String(x).padStart(2, '0'); return `${d.getMonth() + 1}.${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`; })() };
  const board = saveLap(rec);
  const dSim = time - ref.lap, sgn = (d) => `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)} s`;
  $('resTime').textContent = fmt2(time);
  $('resDriver').textContent = driver;
  $('resDelta').innerHTML = `영상 시뮬 ${fmt2(ref.lap)} 대비 <b class="${dSim > 0 ? 'bad' : 'good'}">${sgn(dSim)}</b>`
    + (Number.isFinite(prev) ? `<br>내 이 트림 최고 ${fmt2(prev)} 대비 <b class="${time > prev ? 'bad' : 'good'}">${sgn(time - prev)}</b>${time < prev ? ' · 새 최고 기록' : ''}` : '<br>이 트림 첫 기록');
  const stats = [['트림', TRIMS[trim].label], ['자동 페달', tel.auto ? '썼음' : '안 씀'], ['최고 속도', `${Math.round(tel.vmax)} km/h`], ['최대 G', `${tel.gmax.toFixed(2)} G`], ['가드레일', `${tel.hits}회`], ['도로 밖', `${tel.off.toFixed(1)} s`]];
  $('resStats').innerHTML = stats.map(([k, v]) => `<span style="opacity:.6">${k}</span><span>${v}</span>`).join('');
  lastBoard = { recs: board, cur: rec.id };
  Object.assign(onl, { rec, trim, auto: !!rec.auto, board: null, why: '', state: boardOn() ? 'idle' : 'off' });
  $('resOnline').textContent = '';
  if (sendOn()) sendOnline(); else if (boardOn()) $('resOnline').textContent = '?offline 으로 열어서 온라인에 보내지 않았습니다';
  showBoard('me');
  $('btnReplay').disabled = rec.n < 2;
  $('result').classList.remove('hide');
  drawTelemetry($('telCv'), tel, ref);   // 바로 그린다 (다음 프레임으로 미루면 창이 숨겨져 느릴 때 안 그려졌다)
}
// 기록 보드 탭: 내 기록 · 이 기기 · 온라인(구글 시트 — js/online.js, 사용자 11/16 「Yes, Google Sheets」)
let lastBoard = { recs: [], cur: null }, curTab = 'me';
function showBoard(tab) {
  curTab = tab;
  document.querySelectorAll('#result .tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  const { head, rows } = boardHTML(tab, lastBoard.recs, { cur: lastBoard.cur, driver, refLap: ref.lap, label: (t) => TRIMS[t]?.label ?? t, fmt: fmt2, online: onl });
  $('boardHead').textContent = head; $('board').innerHTML = rows;
}
document.querySelectorAll('#result .tabs button').forEach((b) => b.addEventListener('click', () => {
  if (b.disabled) return;
  if (b.dataset.tab === 'online' && (onl.state === 'idle' || onl.state === 'error') && !onl.sending) loadOnline();
  showBoard(b.dataset.tab);
}));
// 온라인: 한 바퀴를 돌면 보내고(받은 순위를 바로 보인다), 탭을 누르면 그 트림 순위를 받는다
const onl = { state: 'off', board: null, why: '', trim: null, auto: false, rec: null, sending: false };
function onlineTab() {
  const b = document.querySelector('#result .tabs [data-tab="online"]'), on = boardOn();
  b.disabled = !on; b.textContent = on ? '온라인' : '온라인 (준비 중)'; b.title = on ? '구글 시트 기록 보드' : '연결 전 — tools/online-board/README.md';
}
onlineTab();
function resOnline(html, retry) {
  $('resOnline').innerHTML = html + (retry ? ' <button id="btnResend">다시 보내기</button>' : '');
  if (retry) $('btnResend').onclick = sendOnline;
}
function sendOnline() {
  const rec = onl.rec;
  if (!rec || !sendOn() || onl.sending) return;
  onl.sending = true; onl.state = 'loading'; resOnline('온라인 기록 보드에 보내는 중…');
  if (curTab === 'online') showBoard('online');
  submitLap(rec).then((j) => {
    if (onl.rec !== rec) return;
    if (j && j.ok && j.board) {
      onl.state = 'ok'; onl.board = j.board;
      resOnline(`온라인 <b>${j.rank | 0}위</b> · ${TRIMS[rec.trim]?.label ?? ''} ${j.board.drivers | 0}명 중${j.best ? '' : ' (이 이름의 더 빠른 기록이 이미 있음)'}`);   // 숫자로만 — 서버 답을 그대로 HTML 에 넣지 않는다
    } else {
      const [w, retry] = WHY[j?.why] || [`알 수 없는 답 (${String(j?.why ?? '').replace(/[^\w ]/g, '').slice(0, 20)})`, true];
      resOnline(`온라인에 안 올라감 — ${w}`, retry);
      onl.state = 'idle';
    }
  }).catch(() => {
    if (onl.rec !== rec) return;
    onl.state = 'error'; onl.why = '인터넷 연결 확인';
    resOnline('온라인 전송 실패 — 인터넷 연결 확인', true);
  }).finally(() => {
    onl.sending = false;
    if (onl.rec === rec && onl.state === 'idle') loadOnline();   // 안 받아 줬어도 순위는 보인다
    else if (curTab === 'online') showBoard('online');
  });
}
function loadOnline() {
  if (!boardOn() || !onl.trim) return;
  const trim = onl.trim;
  onl.state = 'loading';
  if (curTab === 'online') showBoard('online');
  fetchBoard(trim).then((j) => {
    if (onl.trim !== trim) return;
    if (j?.ok && j.boards?.[trim]) { onl.state = 'ok'; onl.board = j.boards[trim]; } else { onl.state = 'error'; onl.why = '서버 답이 이상함'; }
  }).catch(() => { if (onl.trim === trim) { onl.state = 'error'; onl.why = '인터넷 연결 확인'; } })
    .finally(() => { if (curTab === 'online') showBoard('online'); });
}
function restartLap() {
  stopReplay(true); recReset();
  finished = false; $('result').classList.add('hide');
  placeAt(START_I); lap.t = null; tel.reset();
  if (audio) audio.ac.resume().catch(() => {});
}
$('btnAgain').addEventListener('click', restartLap);
$('btnTrim').addEventListener('click', () => { restartLap(); started = false; showDriverInfo(); $('start').classList.remove('hide'); });
addEventListener('keydown', (e) => { if (e.code === 'Enter' && finished && !replay.on) restartLap(); });
addEventListener('resize', () => { if (finished) drawTelemetry($('telCv'), tel, ref); });
window.__game = { get sideCams() { return sideCams; }, rec, replay, startReplay, stopReplay,
  // 시험용: now 를 직접 올려 가며 n 장 돌린다(미리보기 창이 숨겨져 requestAnimationFrame 이 안 돌 때)
  tick(n, ms = 16.7) { let t = frame.t ?? performance.now(); for (let i = 0; i < n; i++) { t += ms; frame(t, true); } },
  setView, OUT, get ext() { return ext; }, get viewMode() { return viewMode; }, view: { get fov() { return FOVB; }, set fov(v) { FOVB = v; }, get blur() { return BLUR; }, set blur(v) { BLUR = v; } }, post, renderer, scene, camera, car, track, lap, auto, SPEC, peakCurv, placeAt, chooseTrim, setPause, finishLap, restartLap, tel, ref, onl,
  // 시험용 캡처: 지금 자리의 화면을 그려 로컬 서버(tools/serve.mjs 의 /__shot)로 보낸다 → research/onboard/shots/<이름>.jpg
  async shot(name) { frame(performance.now(), true); frame(performance.now(), true); const b = await new Promise((r) => renderer.domElement.toBlob(r, 'image/jpeg', 0.9)); return (await fetch('/__shot/' + name + '.jpg', { method: 'POST', body: b })).status; },
  setBoardUrl(u) { setBoardUrl(u); onlineTab(); },   // 시험용: tools/online-board/mock_server.mjs 주소로
  get finished() { return finished; }, get paused() { return paused; }, get loc() { return loc; }, start() { started = true; $('start').classList.add('hide'); }, keys };
