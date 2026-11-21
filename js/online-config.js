// 온라인 기록 보드 주소 — 구글 시트 Apps Script 웹 앱의 /exec 주소 (설치: tools/online-board/README.md)
//   비어 있으면 결과 화면의 「온라인」 탭은 「준비 중」으로 꺼져 있고, 기록을 아무 데도 보내지 않는다.
//   주소를 바꾸면 GitHub 저장소 변수 BOARD_URL 도 같이 바꾼다 (기록 사본 Action 이 그걸 본다 — gh variable set BOARD_URL)
export const BOARD_URL = 'https://script.google.com/macros/s/AKfycbxn1v_uYGRYd4AYNtUyU_kzPNcOVSft5EbmTZjAFbcDh2DUOZJE6Y84KvdfIMDC-eR2kQ/exec';
// 게임 판 — 물리(js/vehicle.js · js/autopedal.js)나 코스를 바꿔 랩 시간이 달라지면 날짜를 바꾼다. 시트의 「게임 판」 칸에 남는다
export const GAME_VER = '2026-11-19c';
