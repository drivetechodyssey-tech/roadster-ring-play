// 아이폰 조종기 연결. 맥 화면의 QR 을 아이폰 카메라로 찍으면 controller.html 이 열리고,
// PeerJS(WebRTC — 같은 와이파이의 두 기기를 직접 잇는 브라우저 기능)로 조종값이 온다.
// 연결을 주선하는 데만 PeerJS 공개 서버(0.peerjs.com)를 쓰고, 조종값은 두 기기 사이로 직접 간다.
export class PhoneLink {
  constructor(onStatus) {
    this.state = { steer: 0, throttle: 0, brake: 0, boost: false, mode: null };
    this.last = 0; this.conn = null; this.onStatus = onStatus;
    this.id = 'rr-' + Math.random().toString(36).slice(2, 8);
    this.url = null;
    this.start();
  }
  get active() { return this.conn && performance.now() - this.last < 600; }
  async start() {
    let base = location.origin + location.pathname.replace(/[^/]*$/, '');
    try { const r = await fetch('__lan'); if (r.ok) base = (await r.json()).base; } catch { /* GitHub Pages 에서는 지금 주소를 그대로 쓴다 */ }
    this.url = base + 'controller.html#' + this.id;
    this.onStatus('waiting');
    // 맥이 와이파이를 바꾸면(예: 아이폰 핫스팟) 주소가 바뀐다 — 연결 전에는 5 초마다 다시 물어 QR 을 새 주소로 (11/18)
    setInterval(async () => {
      if (this.conn) return;
      try { const r = await fetch('__lan'); if (!r.ok) return; const b = (await r.json()).base, u = b + 'controller.html#' + this.id; if (u !== this.url) { this.url = u; this.onStatus('waiting'); } } catch { /* 무시 */ }
    }, 5000);
    if (!window.Peer) return this.onStatus('error', 'PeerJS 를 불러오지 못했습니다');
    const peer = this.peer = new window.Peer(this.id);
    peer.on('open', () => this.onStatus('waiting'));
    peer.on('error', (e) => this.onStatus('error', e.type || String(e)));
    peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* 무시 */ } });
    peer.on('connection', (c) => {
      this.conn = c;
      c.on('data', (d) => { if (d && d.t === 'c') { this.state = d; this.last = performance.now(); } });
      c.on('open', () => this.onStatus('connected'));
      c.on('close', () => { this.conn = null; this.onStatus('waiting'); });
    });
  }
  send(obj) { if (this.conn && this.conn.open) this.conn.send(obj); }
}
