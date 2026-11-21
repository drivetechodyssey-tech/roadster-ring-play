// 운전석. 좌표: +X 오른쪽, +Y 위, -Z 앞. 원점은 차 중심 바닥.
// 실내 사실(메모): 사이드미러·룸미러 없음, 앞유리 위 가운데 삼각형 카메라 모듈,
// 요크는 밝은 회백색 테두리 + 짙은 육각 패드, 오른쪽 아래 금색 BOOST 패들, 가로로 넓은 검은 화면이 요크 바로 오른쪽.
import * as THREE from 'three';
import { canvasTex } from './track.js';

export const EYE = new THREE.Vector3(-0.36, 1.0, 0.2);

export function buildCockpit(paint = 0x8a0f12) {
  const cab = new THREE.Group();
  // 가죽·알칸타라 느낌의 잔 요철
  const grain = canvasTex(256, 256, (c) => { const d = c.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = 118 + Math.random() * 20; d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 255; } c.putImageData(d, 0, 0); });
  grain.colorSpace = THREE.NoColorSpace; grain.repeat.set(14, 14);
  const soft = (color, rough = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: rough, bumpMap: grain, bumpScale: 0.6 });
  const dark = soft(0x1b1c1f), mid = soft(0x2b2d31, 0.8), suede = soft(0x3d3f44, 1);
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x08080a, roughness: 0.12, metalness: 0.2, clearcoat: 1 });
  const body = new THREE.MeshPhysicalMaterial({ color: paint, roughness: 0.3, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.04 });
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); cab.add(o); return o; };
  const beam = (a, b, w, h, m) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, A.distanceTo(B)), m); o.position.copy(A).add(B).multiplyScalar(0.5); o.lookAt(B); cab.add(o); return o; };
  // 단면(앞뒤 거리 d = -z, 높이 y)을 차 폭 방향으로 밀어낸 덩어리
  const slab = (pts, width, m, bevel = 0.012) => {
    const sh = new THREE.Shape(); pts.forEach(([d, y], i) => i ? sh.lineTo(d, y) : sh.moveTo(d, y));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 8 });
    return add(geo, m, -width / 2, 0, 0, 0, Math.PI / 2, 0);
  };

  let hood;
  // 보닛: 가운데가 살짝 솟고 양쪽 펜더가 불룩한 곡면
  {
    const geo = new THREE.PlaneGeometry(1.96, 1.5, 48, 36); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), t = (0.75 - z) / 1.5;                       // t: 0 = 앞유리 쪽, 1 = 코끝
      const fender = 0.085 * Math.exp(-(((Math.abs(x) - 0.74) / 0.17) ** 2)) * (1 - 0.3 * t);
      const crown = 0.03 * (1 - (x / 0.98) ** 2), drop = -0.2 * t ** 2.2, edge = -0.25 * Math.max(Math.abs(x) - 0.9, 0) / 0.08;
      p.setY(i, 0.72 + fender + crown + drop + edge);
    }
    geo.computeVertexNormals(); hood = add(geo, body, 0, 0, -1.82); hood.castShadow = true;
  }
  // 대시보드: 윗면은 완만하게 내려오고 운전자 쪽 가장자리는 둥글다
  slab([[1.1, 0.8], [0.85, 0.8], [0.62, 0.785], [0.5, 0.76], [0.455, 0.72], [0.445, 0.66], [0.47, 0.6], [1.1, 0.6]], 1.86, dark);
  slab([[0.47, 0.6], [0.445, 0.66], [0.452, 0.705], [0.437, 0.708], [0.43, 0.66], [0.455, 0.6]], 1.82, suede, 0.003);   // 앞면 스웨이드 띠
  slab([[0.5, 0.61], [0.56, 0.3], [0.9, 0.12], [1.1, 0.12], [1.1, 0.61]], 1.86, mid, 0);                              // 무릎 아래
  add(new THREE.BoxGeometry(1.9, 0.04, 2.0), dark, 0, 0.1, 0.3);
  add(new THREE.BoxGeometry(0.3, 0.34, 1.5), mid, 0.02, 0.36, 0.25);                                                  // 가운데 콘솔
  // 문: 윗선이 둥근 패널
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.12, 0.62, 2.0), mid, sx * 0.93, 0.47, 0.05);
    add(new THREE.CapsuleGeometry(0.045, 1.9, 6, 12), dark, sx * 0.9, 0.79, 0.05, Math.PI / 2, 0, 0);
    // A필러(대시보드 모서리 → 지붕 앞단)
    beam([sx * 0.9, 0.8, -1.1], [sx * 0.7, 1.3, -0.4], 0.05, 0.085, dark);
    beam([sx * 0.9, 0.82, 0.9], [sx * 0.72, 1.3, 0.55], 0.05, 0.1, dark);                                             // 문 뒤 기둥
    beam([sx * 0.7, 1.3, -0.4], [sx * 0.72, 1.3, 0.55], 0.05, 0.05, dark);                                            // 지붕 옆선
  }
  add(new THREE.BoxGeometry(1.44, 0.05, 0.07), dark, 0, 1.305, -0.4);
  add(new THREE.BoxGeometry(1.44, 0.03, 1.1), suede, 0, 1.325, 0.15);                                                 // 천장
  // 앞유리 위 가운데 카메라 모듈 (삼각형)
  add(new THREE.CylinderGeometry(0.06, 0.075, 0.03, 3), dark, 0, 1.262, -0.43, 0.55, Math.PI, 0);
  // 가운데 화면: 가로로 넓은 검은 유리, 요크 바로 오른쪽, 운전자 쪽으로 틀어짐
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 400;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const bezel = add(new THREE.BoxGeometry(0.44, 0.185, 0.012), gloss, 0.14, 0.895, -0.6, -0.14, -0.3, 0);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.425, 0.166), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  scr.position.z = 0.0065; bezel.add(scr);
  add(new THREE.BoxGeometry(0.1, 0.06, 0.05), dark, 0.14, 0.8, -0.615);                                               // 화면 받침

  // 요크
  const yokePivot = new THREE.Group(); yokePivot.position.set(EYE.x, 0.74, -0.34); yokePivot.rotation.x = -0.36; cab.add(yokePivot);
  const yoke = new THREE.Group(); yokePivot.add(yoke);
  const rimM = new THREE.MeshStandardMaterial({ color: 0xd4d3cd, roughness: 0.78, bumpMap: grain, bumpScale: 0.4 });
  const pad = soft(0x34363a, 0.75), gold = new THREE.MeshStandardMaterial({ color: 0xc19a45, roughness: 0.28, metalness: 1 }), alu = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.3, metalness: 1 });
  {
    const w = 0.33, h = 0.2, r = 0.062, sh = new THREE.Shape();
    sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0); sh.lineTo(w / 2, h / 2 - r); sh.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2);
    sh.lineTo(-w / 2 + r, h / 2); sh.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI); sh.lineTo(-w / 2, -h / 2 + r); sh.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5);
    const curve = new THREE.CatmullRomCurve3(sh.getSpacedPoints(90).slice(0, 90).map((p) => new THREE.Vector3(p.x, p.y, 0)), true);
    const rim = new THREE.Mesh(new THREE.TubeGeometry(curve, 180, 0.017, 14, true), rimM); rim.scale.z = 1.25; yoke.add(rim);
    const hexS = new THREE.Shape(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; i ? hexS.lineTo(Math.cos(a) * 0.058, Math.sin(a) * 0.058) : hexS.moveTo(Math.cos(a) * 0.058, Math.sin(a) * 0.058); }
    const hex = new THREE.Mesh(new THREE.ExtrudeGeometry(hexS, { depth: 0.022, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 3 }), pad); hex.position.z = -0.006; yoke.add(hex);
    for (const sx of [-1, 1]) {
      const sp = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.085, 6, 12), pad); sp.rotation.z = Math.PI / 2; sp.scale.z = 0.7; sp.position.set(sx * 0.105, 0, 0.002); yoke.add(sp);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.016, 16), new THREE.MeshBasicMaterial({ color: 0xff3020 })); wheel.rotation.z = Math.PI / 2; wheel.position.set(sx * 0.098, 0.002, 0.016); yoke.add(wheel);
      const sig = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.006), alu); sig.position.set(sx * 0.112, 0.036, -0.026); yoke.add(sig);  // 위 작은 패들
    }
  }
  const boost = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.036, 0.008), gold); boost.position.set(0.108, -0.044, -0.028); yoke.add(boost);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.3, 16), dark); col.rotation.x = Math.PI / 2; col.position.z = -0.17; yokePivot.add(col);

  cab.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return { cab, yoke, boost, hood, screen: { cv, tex, ctx: cv.getContext('2d') } };
}

// 가운데 화면: 검은 바탕 + 빨간 선
export function drawScreen(s, d) {
  const c = s.ctx, W = 1024, H = 400, red = '#ff3b2f';
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#050506'; c.fillRect(0, 0, W, s.cv.height); c.translate(0, (s.cv.height - H) / 2);
  c.strokeStyle = red; c.lineWidth = 2; c.strokeRect(14, 14, W - 28, H - 28);
  c.fillStyle = '#f4f4f4'; c.textBaseline = 'alphabetic';
  c.font = '700 190px -apple-system, Helvetica, sans-serif'; c.textAlign = 'right'; c.fillText(d.kmh.toFixed(0), 400, 230);
  c.font = '500 34px -apple-system, Helvetica, sans-serif'; c.fillStyle = '#9a9a9a'; c.textAlign = 'left'; c.fillText('km/h', 412, 228);
  c.fillStyle = red; c.font = '600 34px -apple-system, Helvetica, sans-serif'; c.fillText(d.mode, 44, 66);
  const bar = (x, y, w, label, frac, txt, color = '#f4f4f4') => {
    c.fillStyle = '#8a8a8a'; c.font = '500 26px -apple-system, Helvetica, sans-serif'; c.textAlign = 'left'; c.fillText(label, x, y - 12);
    c.textAlign = 'right'; c.fillStyle = color; c.fillText(txt, x + w, y - 12);
    c.fillStyle = '#26262a'; c.fillRect(x, y, w, 12); c.fillStyle = color; c.fillRect(x, y, w * Math.min(Math.max(frac, 0), 1), 12);
  };
  bar(560, 86, 410, 'BATTERY', d.soc, (d.soc * 100).toFixed(0) + '%');
  bar(560, 158, 410, 'CELL', (d.T - 20) / 50, d.T.toFixed(0) + '°C', d.T > 60 ? red : '#f4f4f4');
  bar(560, 230, 410, 'THRUSTER', d.gas, d.gas > 0.01 ? (d.gas * 5500).toFixed(0) + ' PSI' : 'EMPTY', d.boost ? red : '#f4f4f4');
  bar(560, 302, 410, 'DOWNFORCE', d.fan, (d.fanKgf).toFixed(0) + ' kgf');
  bar(44, 302, 430, 'POWER', Math.abs(d.kw) / 1160, d.kw.toFixed(0) + ' kW', d.kw < 0 ? '#4bd37b' : '#f4f4f4');
  c.fillStyle = '#8a8a8a'; c.textAlign = 'left'; c.font = '500 30px -apple-system, Helvetica, sans-serif';
  c.fillText(d.lap, 44, 360); c.textAlign = 'right'; c.fillText(d.g, 970, 360);
  s.tex.needsUpdate = true;
}
