// 온라인 기록 보드 — 구글 시트 + Apps Script 웹 앱 (사용자 11/16 「Yes, Google Sheets」)
//   서버 쪽 코드 · 설치: tools/online-board/ (Code.gs · README.md). 주소는 js/online-config.js 한 곳.
//   POST 는 Content-Type text/plain 으로 보낸다 — Apps Script 는 사전 확인(OPTIONS)을 받지 못해서, 사전 확인이 없는 「단순 요청」이어야 한다.
//   주소 뒤에 ?offline 을 붙여 연 게임은 보내지 않는다 (시험 주행이 진짜 시트에 쌓이지 않게)
import { BOARD_URL, GAME_VER } from './online-config.js';

let url = BOARD_URL;
const offline = new URLSearchParams(location.search).has('offline');
export const boardOn = () => !!url;                 // 순위 받기
export const sendOn = () => !!url && !offline;      // 기록 보내기
export function setBoardUrl(u) { url = String(u || ''); }   // 시험용 — tools/online-board/mock_server.mjs 주소로 바꿔 쓴다

// 기기 표시: 이 브라우저에서 처음 만든 무작위 8 글자. 시트 주인이 같은 기기의 가짜 기록을 한꺼번에 찾을 때 쓴다
function devId() {
  try {
    let d = localStorage.getItem('roadsterRing.dev');
    if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem('roadsterRing.dev', d); }
    return d;
  } catch { return ''; }
}

async function call(q, body) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 12000);
  try {
    const r = await fetch(url + q, body
      ? { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ac.signal }
      : { signal: ac.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(to); }
}

// 한 바퀴 기록 보내기 → { ok, rank, best, board } 또는 { ok: false, why }. 인터넷이 안 되면 throw
export function submitLap(rec) {
  return call('', { driver: rec.driver, time: rec.time, trim: rec.trim, auto: !!rec.auto, hits: rec.hits | 0, off: rec.off, vmax: rec.vmax, ver: GAME_VER, dev: devId() });
}
// 트림 하나의 순위 → { ok, boards: { [trim]: { trim, laps, drivers, rows } } }
export function fetchBoard(trim, n = 20) { return call(`?trim=${encodeURIComponent(trim)}&n=${n}`); }

// 서버가 안 받은 까닭 (Code.gs 의 why) · retry = 다시 보내기 단추를 보일지
export const WHY = {
  name: ['이름이 비어 있음', false], trim: ['모르는 트림', false], time: ['랩 시간이 받는 범위(4:30~1:00:00) 밖', false],
  vmax: ['최고 속도가 받는 범위 밖', false], json: ['보낸 내용이 깨짐', true], busy: ['기록 서버가 바쁨', true],
  soon: ['같은 이름 · 기기로 3 분 안에 다시 보냄', false], limit: ['지금 기록이 몰림 — 1 분 뒤 다시', true], full: ['기록 보드가 가득 참', false],
};
