// 욕설 · 혐오 이름 미리 알리기 — 진짜로 막는 곳은 기록 서버(tools/online-board/Code.gs)다. 여기는 6 분 달리고 나서야
//   「이 이름은 안 받음」을 듣지 않게 출발 전에 알려 주는 것뿐. 목록 · 정규화는 Code.gs 의 BAD · norm_ 과 같아야 한다(test.mjs 가 대조).
export const BAD = [
  '시발', '씨발', '씨바', '씨빨', '시빨', '씨팔', '시팔', 'ㅅㅂ', 'ㅆㅂ', 'ㅆㅃ', '병신', '븅신', '빙신', 'ㅂㅅ', '좆', '존나', 'ㅈㄴ', '졸라',
  '개새', '개색', '개세', '개쉐', '새끼', '쌔끼', '섹스', '보지', '자지', '니미', '니애미', '느금', '엠창', '애미', '미친놈', '미친년', '미친새',
  '꺼지', '닥쳐', '지랄', 'ㅈㄹ', '염병', '창녀', '걸레년', '한남충', '김치녀', '틀딱', '짱깨', '쪽바리', '홍어', '일베', '메갈', '운지',
  'fuck', 'shit', 'bitch', 'cunt', 'nigg', 'faggot', 'whore', 'slut', 'pussy', 'retard', 'nazi', 'hitler', 'porn',
];
export function norm(s) {
  const low = String(s || '').normalize('NFKC').toLowerCase();   // NFKC: 전각 ｆｕｃｋ → fuck, 풀어 쓴 자모 → 한 글자
  const leet = low.replace(/[0134578@$!]/g, (c) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' }[c]));
  const keep = (x) => x.replace(/[^a-z가-힣ㄱ-ㅎㅏ-ㅣ\u1100-\u1112\u1161-\u1175\u11a8-\u11c2]/g, '');   // NFKC 가 ㅅ 같은 낱자모를 U+1100 대 자모로 바꾼다 — 그중 진짜 자모만 남기고 채움 문자(U+115F · U+1160, ㅤ U+3164 는 NFKC 뒤 U+1160) 는 지운다
  return [keep(low), keep(leet)];
}
export function isBad(name) {
  const v = norm(name);
  return BAD.some((w) => { w = w.normalize('NFKC'); return v[0].includes(w) || v[1].includes(w); });
}
