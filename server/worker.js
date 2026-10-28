// 人柱愛麗絲 : 망가진 꿈 — 실시간 방 서버 (Cloudflare Workers + Durable Objects)
// 방 하나 = Durable Object 하나. 그 방의 모든 플레이어가 같은 객체에 연결되므로
// 위치·잡힘·감옥·흔적·문을 전부 서버 한 곳에서 판정한다 (권위 서버).

import { CFG, TRACE_INFO, MAPS, genWorld, stepPlayer, collide, worldSig, mapFingerprint, skinValid, dskinValid, freeSkinValid, eyesValid, solid, PROTO } from '../public/multi/shared.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...CORS } });
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const clean = s => String(s || '').replace(/[<>\n\r\t]/g, '').trim().slice(0, 10);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/api/health') return json({ ok: true });
    if (url.pathname === '/api/create') {
      for (let i = 0; i < 10; i++) {
        let code = ''; for (let k = 0; k < 4; k++) code += CODE_CHARS[Math.random() * CODE_CHARS.length | 0];
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const res = await stub.fetch('https://room/exists');
        const j = await res.json();
        if (!j.ok) return json({ code });
      }
      return json({ error: '방을 만들 수 없어요. 잠시 후 다시 시도해 주세요.' }, 503);
    }
    const m = url.pathname.match(/^\/ws\/([A-Z]{4})$/);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
      return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
    }
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response('not found', { status: 404 });
  }
};

export class Room {
  constructor(state, env) {
    this.state = state; this.env = env;
    this.inited = false; this.code = '';
    this.players = new Map(); this.order = [];
    this.host = null;
    this.settings = { dreams: 1, max: 8, map: 'random', skins: false, freeCol: false, fate: false, boost: false, awake: false, stealth: false };
    this.phase = 'lobby';
    this.g = null; this.loop = null; this.backTimer = null;
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/exists') return Response.json({ ok: this.inited });
    const pair = new WebSocketPair();
    const client = pair[0], ws = pair[1];
    ws.accept();
    const done = () => new Response(null, { status: 101, webSocket: client });
    const err = msg => { try { ws.send(JSON.stringify({ type: 'err', msg })); ws.close(4000, 'err'); } catch (e) {} return done(); };
    const q = url.searchParams, code = url.pathname.split('/').pop();
    if (!this.inited) {
      if (q.get('create') !== '1') return err('그런 방이 없어요. 코드를 다시 확인해 주세요.');
      this.inited = true; this.code = code;
    }
    const id = String(q.get('id') || '').slice(0, 64);
    if (!id) return err('접속 정보가 잘못됐어요.');
    if (this.banned && this.banned.has(id)) return err('방장이 이 방에서 내보냈어요.');
    let p = this.players.get(id);
    if (p) {
      if (p.ws) { try { p.ws.close(4001, 'replaced'); } catch (e) {} }
      const back = !p.on; p.ws = ws; p.on = true;
      if (back) this.sys(`${p.name} 님이 다시 연결됐어요.`);
      if (!this.host || !this.players.has(this.host)) this.host = id;
    } else {
      if (this.phase !== 'lobby') return err('이미 게임이 진행 중이에요. 끝나면 다시 들어와 주세요.');
      if (this.players.size >= this.settings.max) return err('방이 꽉 찼어요.');
      p = { id, name: clean(q.get('name')) || '이름 없는 아이', dev: q.get('dev') === 'phone' ? 'phone' : 'pc', ready: false, want: false, ws, on: true, chatT: [], rtt: 100 };
      this.players.set(id, p); this.order.push(id);
      if (!this.host) this.host = id;
      this.sys(`${p.name} 님이 들어왔어요.`);
    }
    ws.addEventListener('message', e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } try { this.onMsg(p, m); } catch (ex) { console.log('msg error', ex && ex.stack); } });
    ws.addEventListener('close', () => { try { ws.close(1000, 'bye'); } catch (e) {} this.onClose(p, ws); });
    ws.addEventListener('error', () => this.onClose(p, ws));
    this.send(p, { type: 'hello', id, code: this.code, fp: mapFingerprint(), pv: PROTO });
    if (this.phase === 'game' && p.role) this.send(p, this.startMsg(p));
    this.pushLobby();
    return done();
  }

  send(p, o) { if (p.ws) try { p.ws.send(typeof o === 'string' ? o : JSON.stringify(o)); } catch (e) {} }
  all(o) { const s = JSON.stringify(o); for (const p of this.players.values()) this.send(p, s); }
  sys(text) { this.all({ type: 'chat', sys: 1, text }); }

  lobbyMsg() {
    return {
      type: 'lobby', code: this.code, host: this.host, phase: this.phase, settings: this.settings,
      players: this.order.map(id => this.players.get(id)).filter(Boolean).map(p => ({ id: p.id, name: p.name, ready: p.ready, want: p.want, dev: p.dev, on: p.on, t: p.title || null }))
    };
  }
  pushLobby() { this.all(this.lobbyMsg()); }

  onClose(p, ws) {
    if (p.ws !== ws) return;
    p.ws = null; p.on = false; p.offAt = Date.now();
    if (this.phase === 'lobby') {
      // 대기실: 15초 동안은 자리를 지켜 준다 (폰 화면을 잠깐 껐다 와도 그대로)
      this.sys(`${p.name} 님의 연결이 끊겼어요. 15초 안에 돌아오면 그대로예요.`);
      setTimeout(() => {
        if (p.on || this.players.get(p.id) !== p) return;
        if (this.phase === 'lobby') { this.players.delete(p.id); this.order = this.order.filter(i => i !== p.id); this.sys(`${p.name} 님이 나갔어요.`); }
        if (!this.players.has(this.host)) this.pickHost();
        if (![...this.players.values()].some(x => x.on)) this.reset(true); else this.pushLobby();
      }, 15000);
    } else {
      this.sys(`${p.name} 님의 연결이 끊겼어요.`);
      if (this.g && p.role === 'dream' && p.carry) this.drop(p);
    }
    if (this.host === p.id || !this.players.has(this.host)) this.pickHost();
    // 아무도 없으면: 대기실은 위 15초 뒤, 게임 중이면 1분 뒤까지 돌아오길 기다렸다가 정리
    if (![...this.players.values()].some(x => x.on) && this.phase !== 'lobby') {
      setTimeout(() => { if (![...this.players.values()].some(x => x.on)) this.reset(true); }, 60000);
    }
    this.pushLobby();
  }
  pickHost() {
    const next = this.order.map(i => this.players.get(i)).find(x => x && x.on);
    this.host = next ? next.id : null;
  }

  onMsg(p, m) {
    switch (m.type) {
      case 'chat': {
        const text = String(m.text || '').replace(/[\n\r]/g, ' ').trim().slice(0, 120);
        if (!text) return;
        const now = Date.now(); p.chatT = p.chatT.filter(t => t > now - 5000);
        if (p.chatT.length >= 5) return; p.chatT.push(now);
        this.all({ type: 'chat', id: p.id, name: p.name, role: this.phase === 'game' ? p.role : null, text });
        break;
      }
      case 'kick': {
        if (p.id !== this.host || m.id === p.id) return;
        const t = this.players.get(String(m.id || '')); if (!t) return;
        (this.banned || (this.banned = new Set())).add(t.id);
        this.send(t, { type: 'err', msg: '방장이 이 방에서 내보냈어요.' });
        const tw = t.ws; t.ws = null; t.on = false;
        if (this.phase === 'lobby') { this.players.delete(t.id); this.order = this.order.filter(i => i !== t.id); }
        else if (this.g && t.role === 'dream' && t.carry) this.drop(t);
        try { tw && tw.close(4002, 'kicked'); } catch (e) {}
        this.sys(`${t.name} 님을 방장이 내보냈어요.`);
        this.pushLobby();
        break;
      }
      case 'ready': if (this.phase === 'lobby') { p.ready = !!m.v; this.pushLobby(); } break;
      case 'want': if (this.phase === 'lobby') { p.want = !!m.v; this.pushLobby(); } break;
      case 'set':
        if (this.phase !== 'lobby' || p.id !== this.host) return;
        this.settings.max = clamp(m.max | 0 || this.settings.max, Math.max(2, this.players.size), CFG.MAX_PLAYERS);
        this.settings.dreams = clamp(m.dreams | 0 || this.settings.dreams, 1, Math.min(CFG.MAX_DREAMS, this.settings.max - 1));
        if (m.map === 'random' || MAPS.includes(m.map)) this.settings.map = m.map;
        if (typeof m.skins === 'boolean') this.settings.skins = m.skins;
        if (typeof m.fate === 'boolean') this.settings.fate = m.fate;
        if (typeof m.boost === 'boolean') this.settings.boost = m.boost;
        if (typeof m.freeCol === 'boolean') this.settings.freeCol = m.freeCol;
        if (typeof m.awake === 'boolean') this.settings.awake = m.awake;
        if (typeof m.stealth === 'boolean') this.settings.stealth = m.stealth;
        this.pushLobby();
        break;
      case 'start':
        if (this.phase !== 'lobby' || p.id !== this.host) return;
        { const why = this.cantStart(); if (why) { this.send(p, { type: 'chat', sys: 1, text: why }); return; } }
        this.startGame();
        break;
      case 'in':
        if (this.phase !== 'game' || !Array.isArray(m.l)) return;
        for (const inp of m.l.slice(0, 12)) if (inp && typeof inp.q === 'number') p.q.push(inp);
        if (p.q.length > 40) p.q.splice(0, p.q.length - 40);
        break;
      case 'skin':
        if (m.v === null) p.skin = null; else if (skinValid(m.v)) p.skin = m.v;
        if (m.d === null) p.dskin = null; else if (dskinValid(m.d)) p.dskin = m.d;
        if (m.vf === null) p.skinF = null; else if (freeSkinValid(m.vf, 'alice')) p.skinF = m.vf;
        if (m.df === null) p.dskinF = null; else if (freeSkinValid(m.df, 'dream')) p.dskinF = m.df;
        if (eyesValid(m.e)) p.deye = m.e.slice();
        break;
      case 'ping': { // 손짓: 같은 편에게만 위치를 알린다 (3초에 한 번)
        if (this.phase !== 'game' || !this.g || !p.role) return;
        const x = +m.x, z = +m.z, N = this.g.w.N, now = Date.now();
        if (!Number.isFinite(x) || !Number.isFinite(z) || x < 0 || z < 0 || x > N || z > N || now - (p.pingT || 0) < 2800) return;
        p.pingT = now;
        const o = JSON.stringify({ type: 'ping', a: p.id, x: r2(x), z: r2(z) });
        for (const q of this.players.values()) if (q.role === p.role) this.send(q, o);
        break;
      }
      case 'title': // 칭호 (각자 기기 기록 — 이름표 장식일 뿐)
        if (m.v === null || (typeof m.v === 'string' && /^[a-z]{1,8}$/.test(m.v))) { p.title = m.v; this.pushLobby(); }
        break;
      case 'ping': this.send(p, { type: 'pong', t: m.t }); break;
      case 'rtt': p.rtt = clamp(+m.v || 100, 0, 1000); break;
    }
  }

  cantStart() {
    const ps = [...this.players.values()];
    if (ps.length < 2) return '최소 2명이 있어야 시작할 수 있어요.';
    if (ps.some(x => !x.on)) return '연결이 끊긴 사람이 있어요. 잠깐 기다리거나 추방해 주세요.';
    if (ps.some(x => !x.ready)) return '모두 준비해야 시작할 수 있어요.';
    if (this.settings.dreams >= ps.length) return '앨리스가 한 명 이상 있어야 해요. 꿈 인원을 줄여 주세요.';
    return '';
  }

  startMsg(p) {
    const g = this.g;
    return {
      type: 'start', seed: g.seed, map: g.map, sig: g.sig, you: p.id, intro: g.intro, time: g.time, fate: g.fate ? 1 : 0, boost: g.boost ? 1 : 0, awake: g.awake ? 1 : 0, stealth: g.stealth ? 1 : 0,
      players: [...this.players.values()].map(x => ({ id: x.id, name: x.name, role: x.role, t: x.title || null, skin: !this.settings.skins ? null : (this.settings.freeCol && (x.role === 'dream' ? x.dskinF : x.skinF)) || (x.role === 'dream' ? x.dskin : x.skin) || null, eyes: x.role === 'dream' && this.settings.skins && x.deye ? x.deye : null })),
      me: { x: p.x, z: p.z, yaw: p.yaw, seq: p.seq }
    };
  }

  startGame() {
    clearTimeout(this.backTimer);
    const ids = this.order.filter(id => this.players.has(id));
    const seed = (Math.random() * 2147483647) | 0;
    const map = this.settings.map === 'random' || !MAPS.includes(this.settings.map) ? MAPS[(Math.random() * MAPS.length) | 0] : this.settings.map;
    const w = genWorld(seed, map);
    const pool = [...shuffle(ids.filter(id => this.players.get(id).want)), ...shuffle(ids.filter(id => !this.players.get(id).want))];
    const dreams = new Set(pool.slice(0, this.settings.dreams));
    const spA = shuffle(w.spawnA.slice());
    let ai = 0, di = 0;
    for (const id of ids) {
      const p = this.players.get(id);
      p.role = dreams.has(id) ? 'dream' : 'alice';
      const s = p.role === 'dream' ? w.spawnD[di++ % w.spawnD.length] : spA[ai++ % spA.length];
      Object.assign(p, {
        x: s.x, z: s.z, yaw: p.role === 'dream' ? Math.PI / 2 : Math.atan2(40 - s.z, 40 - s.x),
        st: 0, dc: 0, dt: 0, sn: 0, pc: 0, warp: null, sgQ: 0, m: 0, carry: null, carrier: null, q: [], seq: 0,
        aPrev: 0, aHeld: 0, im: 0, sg: 0, cell: -1, jt: 0, hist: [],
        dPrev: 0, kPrev: 0, sth: 0, stc: 0, chm: 0, fim: 0, tw: 0, dcd: this.settings.fate ? 5 : CFG.DASH_CD, fates: [], escT: 0,
        pts: { col: 0, assist: 0, res: 0, bear: 0, stun: 0, esc: 0, caught: 0 }
      });
    }
    this.g = {
      seed, map, w, sig: worldSig(w), time: CFG.GAME_TIME, intro: CFG.INTRO, t: 0,
      tp: TRACE_INFO.map(() => 0), tr: TRACE_INFO.map(() => 0), tby: TRACE_INFO.map(() => null),
      rp: w.cells.map(() => 0), door: null, ev: [], mbT: 0, rotSlot: 0,
      cams: w.cams ? w.cams.map(() => 1) : null, cp: w.cams ? w.cams.map(() => 0) : null, camOffT: w.cams ? w.cams.map(() => 0) : null,
      lastId: null, lastRvT: 0, stealth: !!this.settings.stealth, sthNext: 0,
      nA: ids.filter(id => !dreams.has(id)).length, nD: ids.filter(id => dreams.has(id)).length,
      fate: !!this.settings.fate, boost: !!this.settings.boost, sb: 1, awake: !!this.settings.awake, aw: 0, awT: 0, twins: null, doorT: 0, nextRv: 0, twfT: 0
    };
    this.phase = 'game';
    for (const p of this.players.values()) this.send(p, this.startMsg(p));
    this.pushLobby();
    clearInterval(this.loop);
    this.loop = setInterval(() => { try { this.tick(); } catch (e) { console.log('tick error', e && e.stack); } }, CFG.TICK_MS);
  }

  ev(k, o) { this.g.ev.push({ k, ...o }); }

  /* ---------- 숨은 꿈 ---------- */
  useStealth(d) {
    const g = this.g;
    if (!g.stealth || !g.door || !(d.stc > 0) || d.st !== 0 || g.t < g.sthNext) return;
    if ([...this.players.values()].some(o => o.role === 'dream' && o.sth > 0)) return; // 한 번에 한 꿈만
    if (Math.hypot(d.x - g.door.x, d.z - g.door.z) < CFG.BURN_R) return;
    d.stc = 0; d.sth = 10; this.ev('sth', { d: d.id });
  }
  endStealth(d) { d.sth = 0; this.g.sthNext = this.g.t + 10; this.ev('sthEnd', { d: d.id }); }

  /* ---------- 운명계승 ---------- */
  hasFate(p, k) { return p.fates && p.fates.some(f => f.k === k); }
  loseFate(p, k, quiet) {
    const i = p.fates.findIndex(f => f.k === k); if (i < 0) return;
    const f = p.fates[i]; p.fates.splice(i, 1);
    if (k === 'T') { p.tw = 0; const q = this.players.get(f.pt); if (q && this.hasFate(q, 'T')) { q.fates = q.fates.filter(x => x.k !== 'T'); q.tw = 0; } this.g.twins = null; }
    if (!quiet) this.ev('flose', { a: p.id, k });
  }
  addFate(p, f) {
    const g = this.g;
    if (f.k === 'S' && this.hasFate(p, 'C')) this.loseFate(p, 'C');
    if (f.k === 'C' && this.hasFate(p, 'S')) this.loseFate(p, 'S');
    while (p.fates.length >= 2) this.loseFate(p, p.fates[0].k);
    p.fates.push({ t: g.t, ...f });
    this.ev('fate', { a: p.id, k: f.k });
  }
  grantFate(p, i) {
    const g = this.g;
    if (i === 0) this.addFate(p, { k: 'S' });
    else if (i === 1) this.addFate(p, { k: 'M' });
    else if (i === 2) this.addFate(p, { k: 'C', u: 2 });
    else {
      const a = this.players.get(g.tby[3]), b = this.players.get(g.tby[4]);
      if (!a || !b || a === b || !g.tr[3] || !g.tr[4]) return;
      const ok = x => x.role === 'alice' && x.on && (x.st === 0 || x.st === 1);
      if (!ok(a) || !ok(b)) return;
      this.addFate(a, { k: 'T', pt: b.id }); this.addFate(b, { k: 'T', pt: a.id });
      g.twins = [a.id, b.id];
    }
  }
  useFate(a) {
    const g = this.g, w = g.w;
    if (!g.fate || a.st !== 0 || g.intro > 0) return;
    const dreams = [...this.players.values()].filter(d => d.role === 'dream' && d.st === 0 && d.sn <= 0 && d.fim <= 0);
    const sees = d => { const dx = d.x - a.x, dz = d.z - a.z, n = Math.ceil(Math.hypot(dx, dz) * 4); for (let k = 1; k < n; k++) if (solid(w, a.x + dx * k / n, a.z + dz * k / n)) return false; return true; };
    const near = r => { let best = null, bd = r; for (const d of dreams) { const dd = Math.hypot(d.x - a.x, d.z - a.z); if (dd <= bd && sees(d)) { bd = dd; best = d; } } return best; };
    if (this.hasFate(a, 'S')) {
      const d = near(2.2); if (!d) return;
      d.sn = 3; d.dt = 0; d.fim = 3 + 5; if (d.carry) this.drop(d);
      this.loseFate(a, 'S', true); a.pts.stun += 2;
      this.ev('fu', { k: 'S', a: a.id, d: d.id, x: r2(a.x), z: r2(a.z) });
    } else if (this.hasFate(a, 'C')) {
      const fc = a.fates.find(x => x.k === 'C'); if (fc.cd && fc.cd > g.t) return; // 재사용 대기 10초
      const d = near(6); if (!d) return;
      d.chm = 3; d.fim = 3 + 5;
      const f = a.fates.find(x => x.k === 'C'); f.u--; f.cd = g.t + 10;
      this.ev('fu', { k: 'C', a: a.id, d: d.id, x: r2(a.x), z: r2(a.z), u: f.u });
      if (f.u <= 0) this.loseFate(a, 'C', true);
    }
  }
  fateTick(ps, dt) {
    const g = this.g;
    for (const d of ps) if (d.role === 'dream' && d.fim > 0) d.fim = Math.max(0, d.fim - dt);
    for (const a of ps) {
      if (a.role !== 'alice' || !a.fates.length) continue;
      if (a.st === 2) { // 감옥에 갇히면 운명은 사라진다 — 쌍둥이 짝은 10초간 드러난다
        const tf = a.fates.find(f => f.k === 'T');
        if (tf) { const q = this.players.get(tf.pt); if (q && q.st === 0) this.ev('rv1', { a: q.id, dur: 10 }); }
        for (const f of a.fates.slice()) this.loseFate(a, f.k, true);
        this.ev('fclear', { a: a.id }); continue;
      }
      if (a.st === 3 || a.st === 4 || !a.on) { for (const f of a.fates.slice()) this.loseFate(a, f.k, true); continue; }
      for (const f of a.fates.slice()) if ((f.k === 'S' || f.k === 'M' || f.k === 'T') && g.t - f.t > 90) this.loseFate(a, f.k);
      if (a.st === 0 && a.fates.length) a.pts.bear += dt;
    }
    // 쌍둥이
    if (g.twins) {
      const [a, b] = g.twins.map(id => this.players.get(id));
      if (a && b && a.st === 0 && b.st === 0) {
        const dd = Math.hypot(a.x - b.x, a.z - b.z);
        a.tw = b.tw = dd < 6 ? 1 : 0;
        if (dd > 15) { g.twfT -= dt; if (g.twfT <= 0) { g.twfT = 5; this.ev('rv', { pts: [[r2(a.x), r2(a.z)], [r2(b.x), r2(b.z)]], dur: 3, tw: 1 }); } }
        else g.twfT = 0;
      } else if (a && b) { a.tw = b.tw = 0; }
    }
    // 흔적이 다 모이면: 문이 열리고 10초 뒤부터 6초마다 앨리스 위치가 꿈에게
    if (g.door) {
      if (!g.doorT) g.doorT = g.t;
      if (g.t - g.doorT >= 10 && g.t >= g.nextRv) {
        g.nextRv = g.t + 6;
        const pts = ps.filter(a => a.role === 'alice' && (a.st === 0 || a.st === 1)).map(a => [r2(a.x), r2(a.z)]);
        if (pts.length) this.ev('rv', { pts, dur: 6, dr: 1 });
      }
    }
  }
  scores(alices, win) {
    const fate = this.g.fate;
    const list = alices.map(p => {
      const s = p.pts || { col: 0, assist: 0, res: 0, bear: 0, stun: 0, esc: 0, caught: 0 }, bear = fate ? Math.floor(s.bear / 10) : 0;
      const t = Math.max(0, s.col + s.assist + s.res + bear + s.stun + s.esc - s.caught);
      return { n: p.name, id: p.id, t, d: { col: s.col, assist: s.assist, res: s.res, bear, stun: s.stun, esc: s.esc, caught: s.caught }, e: p.st === 4 ? p.escT : 1e9, c: s.caught };
    }).sort((x, y) => y.t - x.t || x.e - y.e || x.c - y.c);
    return { scores: list.map(({ e, c, ...r }) => r), mvp: win === 'alice' && list.length ? list[0].id : null, fate: fate ? 1 : 0 };
  }

  drop(d) {
    const a = this.players.get(d.carry); d.carry = null;
    if (a && a.st === 1) { a.st = 0; a.carrier = null; a.sg = 0; a.im = CFG.IMMUNE; this.ev('free', { a: a.id, d: d.id }); }
  }

  histAt(p, t) {
    let best = null, bd = 1e9;
    for (const h of p.hist) { const d = Math.abs(h[0] - t); if (d < bd) { bd = d; best = h; } }
    return best ? [best[1], best[2]] : null;
  }

  dreamAct(d) {
    const g = this.g, w = g.w;
    if (d.carry) {
      let best = -1, bd = 1e9;
      w.cells.forEach((c, i) => { const dd = Math.hypot(d.x - c.door.x, d.z - c.door.z); if (dd < bd) { bd = dd; best = i; } });
      if (bd <= CFG.DEPOSIT_RANGE) {
        const a = this.players.get(d.carry); d.carry = null;
        if (a) {
          const c = w.cells[best];
          Object.assign(a, { st: 2, cell: best, jt: 0, carrier: null, sg: 0, x: c.x + (Math.random() - .5) * 1.4, z: c.z + (Math.random() - .5) * .8, yaw: Math.PI / 2 });
          this.ev('jail', { a: a.id, c: best, d: d.id });
        }
      }
      return;
    }
    const tt = g.t - ((d.rtt || 100) / 2000 + .1);
    const dx0 = Math.cos(d.yaw), dz0 = Math.sin(d.yaw);
    let best = null, bd = 1e9;
    for (const a of this.players.values()) {
      if (a.role !== 'alice' || a.st !== 0 || a.im > 0) continue;
      const pts = [[a.x, a.z]]; const h = this.histAt(a, tt); if (h) pts.push(h);
      for (const [x, z] of pts) {
        const dx = x - d.x, dz = z - d.z, dd = Math.hypot(dx, dz);
        if (dd <= CFG.CATCH_RANGE && (dd < .8 || (dx * dx0 + dz * dz0) / dd > .2) && dd < bd) { bd = dd; best = a; }
      }
    }
    if (best) {
      for (const o of this.players.values()) if (o.carrier === d.id) o.carrier = null;
      best.st = 1; best.carrier = d.id; best.sg = 0; d.carry = best.id; best.pts.caught++;
      if (d.sth > 0) this.endStealth(d);
      this.ev('catch', { a: best.id, d: d.id });
    } else {
      // 방송국: 가까운 CCTV 끄기
      if (g.cams) { let ci = -1, cd = 1.8; w.cams.forEach((c, i) => { const dd = Math.hypot(d.x - c.x, d.z - c.z); if (g.cams[i] && dd < cd) { cd = dd; ci = i; } }); if (ci >= 0) { g.cams[ci] = 0; g.cp[ci] = 0; g.camOffT[ci] = g.t; this.ev('cam', { i: ci, on: 0, by: d.id }); return; } }
      this.ev('swing', { d: d.id });
    }
  }

  tick() {
    const g = this.g; if (!g) return;
    const dt = CFG.TICK_MS / 1000, w = g.w;
    g.t += dt;
    const ps = [...this.players.values()];

    for (const p of ps) {
      let n = 0;
      while (p.q.length && n < 10) {
        const inp = p.q.shift(); n++;
        if (inp.q <= p.seq) continue;
        p.seq = inp.q;
        const a = inp.a ? 1 : 0, press = a && !p.aPrev; p.aPrev = a; p.aHeld = a;
        if (g.intro > 0) continue;
        if (p.st === 0) {
          const bx = p.x, bz = p.z;
          stepPlayer(w, p, { f: clamp(+inp.f || 0, -1, 1), s: clamp(+inp.s || 0, -1, 1), y: +inp.y || 0, d: inp.d ? 1 : 0 }, CFG.INPUT_DT);
          if (p.warp != null) { this.ev('warp', { a: p.id, x: bx, z: bz, fx: p.x, fz: p.z, ey: p.warp }); p.warp = null; }
          if (press && p.role === 'dream') this.dreamAct(p);
          const dp = inp.d ? 1 : 0; if (dp && !p.dPrev && p.role === 'alice') this.useFate(p); p.dPrev = dp;
          const kp = inp.k ? 1 : 0; if (kp && !p.kPrev && p.role === 'dream') this.useStealth(p); p.kPrev = kp;
        } else if (p.st === 1 && press && inp.q - (p.sgQ || 0) >= CFG.STRUGGLE_GAP) { p.sg += CFG.STRUGGLE_ADD * (p.last ? 1.5 : 1); p.sgQ = inp.q; }
      }
      if (!p.on) { p.aHeld = 0; p.m = 0; }
    }

    if (g.intro > 0) { g.intro -= dt; this.snap(); return; }
    g.time -= dt;

    // 들려 가는 앨리스
    for (const a of ps) {
      if (a.st !== 1) continue;
      const d = this.players.get(a.carrier);
      if (!d || d.st !== 0 || d.carry !== a.id) { a.st = 0; a.carrier = null; a.im = CFG.IMMUNE; if (d && d.carry === a.id) d.carry = null; this.ev('free', { a: a.id }); continue; }
      a.x = d.x + Math.cos(d.yaw) * .45; a.z = d.z + Math.sin(d.yaw) * .45; a.yaw = d.yaw + Math.PI;
      a.sg = Math.max(0, a.sg - CFG.STRUGGLE_DECAY * dt);
      if (a.sg >= 1) {
        a.st = 0; a.sg = 0; a.carrier = null; a.im = CFG.IMMUNE; d.carry = null; d.sn = CFG.STUN;
        a.x = d.x - Math.cos(d.yaw) * .8; a.z = d.z - Math.sin(d.yaw) * .8; collide(w, a);
        this.ev('free', { a: a.id, d: d.id, struggle: 1 });
      }
    }
    for (const p of ps) if (p.im > 0) p.im = Math.max(0, p.im - dt);

    // 구출·흔적 줍기 (꾹 누르기)
    const cellT = w.cells.map(() => null), trT = w.traces.map(() => null), camT = g.cams ? g.cams.map(() => null) : null;
    for (const a of ps) {
      if (a.role !== 'alice' || a.st !== 0 || !a.aHeld) continue;
      let used = false;
      w.cells.forEach((c, i) => {
        if (used) return;
        if (Math.hypot(a.x - c.door.x, a.z - c.door.z) < CFG.CHANNEL_RANGE && ps.some(o => o.st === 2 && o.cell === i)) { cellT[i] = a.id; used = true; }
      });
      if (used) continue;
      w.traces.forEach((t, i) => {
        if (used || g.tr[i]) return;
        if (Math.hypot(a.x - t.x, a.z - t.z) < CFG.CHANNEL_RANGE) { trT[i] = a.id; used = true; }
      });
      if (!used && camT) w.cams.forEach((c, i) => { if (used || g.cams[i]) return; if (Math.hypot(a.x - c.x, a.z - c.z) < 1.8) { camT[i] = a.id; used = true; } });
    }
    w.cells.forEach((c, i) => {
      if (cellT[i]) {
        const rs = this.players.get(cellT[i]), mus = g.fate && rs && this.hasFate(rs, 'M');
        g.rp[i] += dt * (mus || (rs && rs.last) ? 2 : 1); // 오르골 · 최후의 앨리스: 2배
        if (g.rp[i] >= CFG.RESCUE_TIME) {
          if (rs) rs.pts.res += 3;
          if (mus) { this.loseFate(rs, 'M'); this.ev('fu', { k: 'M', a: rs.id, x: r2(rs.x), z: r2(rs.z) }); }
          g.rp[i] = 0; const ids = [];
          for (const o of ps) if (o.st === 2 && o.cell === i) {
            Object.assign(o, { st: 0, cell: -1, jt: 0, im: CFG.IMMUNE, x: c.door.x + (Math.random() - .5) * 1.2, z: c.door.z + .4 + Math.random() * .5 });
            collide(w, o); ids.push(o.id);
          }
          this.ev('rescue', { c: i, by: cellT[i], ids });
        }
      } else g.rp[i] = Math.max(0, g.rp[i] - dt * .5);
    });
    w.traces.forEach((t, i) => {
      if (g.tr[i]) return;
      if (trT[i]) {
        g.tp[i] += dt;
        if (t.kind === 'musicbox') { g.mbT -= dt; if (g.mbT <= 0) { g.mbT = .42; this.ev('mb', { i }); } }
        if (g.tp[i] >= t.dur) {
          g.tr[i] = 1; g.tp[i] = t.dur; g.tby[i] = trT[i]; this.ev('trace', { i, by: trT[i] });
          const col = this.players.get(trT[i]); if (col) col.pts.col += 3;
          for (const o of ps) if (o !== col && o.role === 'alice' && o.st === 0 && o.aHeld && Math.hypot(o.x - t.x, o.z - t.z) < CFG.CHANNEL_RANGE) o.pts.assist += 1;
          if (g.fate && col) this.grantFate(col, i);
        }
      } else g.tp[i] = Math.max(0, g.tp[i] - dt * .5);
    });

    if (camT) g.cams.forEach((on, i) => {
      if (on) return;
      if (camT[i]) { g.cp[i] += dt; if (g.cp[i] >= 2.5) { g.cams[i] = 1; g.cp[i] = 0; this.ev('cam', { i, on: 1, by: camT[i] }); } }
      else g.cp[i] = Math.max(0, g.cp[i] - dt);
      if (!g.cams[i] && g.t - (g.camOffT[i] || 0) >= 150) { g.cams[i] = 1; g.cp[i] = 0; this.ev('cam', { i, on: 1, by: null }); } // 꺼진 지 2분 30초면 저절로 켜진다
    });

    // 감옥에서 썩어가는 앨리스
    for (const a of ps) {
      if (a.st !== 2) continue;
      a.jt += dt;
      if (a.jt >= CFG.ROT_TIME) {
        const slot = w.displays[g.rotSlot++ % w.displays.length];
        Object.assign(a, { st: 3, x: slot.x, z: slot.z, cell: -1 });
        this.ev('rot', { a: a.id });
      }
    }

    // 하늘의 문
    if (!g.door && g.tr.every(Boolean)) {
      const dreams = ps.filter(p => p.role === 'dream');
      let best = w.doorCands[0], bs = -1;
      for (const c of w.doorCands) {
        const s = dreams.length ? Math.min(...dreams.map(d => Math.hypot(d.x - c.x, d.z - c.z))) : 0;
        if (s > bs) { bs = s; best = c; }
      }
      g.door = { x: best.x, z: best.z };
      this.ev('door', g.door);
      if (g.stealth) for (const p of ps) if (p.role === 'dream') p.stc = 1;
    }
    // 빛기둥 곁의 꿈: 느려지고, 오래 머물면 빛에 튕겨 나간다
    for (const d of ps) {
      if (d.role !== 'dream') continue;
      d.door = g.door;
      if (!g.door || d.st !== 0) { d.burnT = 0; continue; }
      const dx = d.x - g.door.x, dz = d.z - g.door.z, dist = Math.hypot(dx, dz);
      if (dist < CFG.BURN_R) {
        d.burnT = (d.burnT || 0) + dt;
        if (d.burnT >= CFG.BURN_TIME) {
          d.burnT = 0; if (d.carry) this.drop(d);
          const k = (CFG.BURN_R + 1.6) / (dist || 1); d.x = g.door.x + (dist ? dx : 1) * k; d.z = g.door.z + (dist ? dz : 0) * k; collide(w, d);
          d.sn = CFG.BURN_STUN; d.dt = 0;
          this.ev('burn', { d: d.id, x: d.x, z: d.z });
        }
      } else d.burnT = Math.max(0, (d.burnT || 0) - dt * 1.5);
    }
    if (g.door) for (const a of ps) {
      if (a.role === 'alice' && a.st === 0 && Math.hypot(a.x - g.door.x, a.z - g.door.z) < CFG.ESCAPE_R) { a.st = 4; a.pts.esc += 2; a.escT = g.t; this.ev('esc', { a: a.id }); }
    }

    // 최후의 앨리스: 앨리스 2명 이상인 판에서 나머지가 모두 잡혀 한 명만 남으면 (탈출한 동료가 있으면 없음)
    {
      const al = ps.filter(p => p.role === 'alice'), free = al.filter(p => p.on && (p.st === 0 || p.st === 1));
      const last = al.length >= 2 && free.length === 1 && !al.some(p => p.st === 4) ? free[0] : null, id = last ? last.id : null;
      if (id !== g.lastId) { g.lastId = id; g.lastRvT = 10; this.ev('last', { a: id }); }
      for (const p of al) p.last = p === last ? 1 : 0;
      if (last && last.st === 0) { g.lastRvT -= dt; if (g.lastRvT <= 0) { g.lastRvT = 10; this.ev('rv', { pts: [[r2(last.x), r2(last.z)]], dur: 3, lst: 1 }); } }
    }
    // 숨은 꿈: 은신 시간 · 빛기둥에 닿으면 풀림
    if (g.stealth) for (const d of ps) {
      if (d.role !== 'dream' || !(d.sth > 0)) continue;
      d.sth -= dt;
      if (d.sth <= 0 || d.st !== 0 || !d.on || (g.door && Math.hypot(d.x - g.door.x, d.z - g.door.z) < CFG.BURN_R)) this.endStealth(d);
    }
    if (g.fate) this.fateTick(ps, dt);
    // 꿈이 깨어나는 시간: 1분 30초마다 30초씩 (3초 전 예고)
    if (g.awake) {
      const run = CFG.GAME_TIME - g.time, cyc = run % 90;
      // 1분 30초마다 한 번: 60초 잠잠 → 3초 예고(57~60) → 30초 깨어남(60~90)
      g.aw = cyc >= 60 ? 2 : cyc >= 57 ? 1 : 0;
      g.awT = g.aw === 2 ? 90 - cyc : g.aw === 1 ? 60 - cyc : 0;
      for (const p of ps) if (p.role === 'dream') p.awk = g.aw === 2 ? 1 : 0;
    }
    // 인원 보정: 앨리스가 꿈보다 3명 이상 많으면 꿈이 빨라지고, 갇힌 앨리스가 늘수록 원래대로
    // 흔적이 하나 모일 때마다 꿈이 3%씩 빨라진다 (최대 +15%), 인원 보정과 곱해진다
    {
      // 흔적 보너스: 앨리스÷꿈 비율 1 이하면 0, 3 이상이면 흔적 하나에 1.8% (사이는 비례)
      const per = .018 * Math.min(1, Math.max(0, (g.nA / Math.max(1, g.nD) - 1) / 2));
      let mul = 1 + per * g.tr.reduce((a, b) => a + b, 0);
      if (g.boost) { const nd = ps.filter(p => p.role === 'dream' && p.on).length, free = ps.filter(p => p.role === 'alice' && p.on && (p.st === 0 || p.st === 1)).length; mul *= 1 + Math.min(.2, Math.max(0, free - nd - 2) * .04); }
      g.sb = mul;
      for (const p of ps) if (p.role === 'dream') p.sb = g.sb;
    }
    for (const p of ps) { p.hist.push([g.t, p.x, p.z]); if (p.hist.length > 24) p.hist.shift(); }
    this.snap();

    const alices = ps.filter(p => p.role === 'alice');
    const nowMs = Date.now(), active = alices.filter(p => (p.st === 0 || p.st === 1) && (p.on || nowMs - (p.offAt || 0) < 60000)).length;
    if (g.time <= 0 || active === 0) this.endGame();
  }

  snap() {
    const g = this.g;
    const p = [...this.players.values()].map(p => ({
      i: p.id, x: r2(p.x), z: r2(p.z), y: r2(p.yaw), s: p.st, m: p.m | 0, dc: r1(p.dc), dt: r2(p.dt), sn: r1(p.sn),
      c: p.carry ? 1 : 0, pc: r2(p.pc || 0), b: r1(p.burnT || 0), sg: r2(p.sg), jt: r1(p.jt), im: p.im > 0 ? 1 : 0, o: p.on ? 1 : 0, cl: p.cell,
      ...(g.stealth && p.role === 'dream' ? { h: p.sth > 0 ? r1(p.sth) : 0, hc: p.stc || 0 } : {}),
      ...(g.fate ? { f: p.fates.map(f => f.k + (f.k === 'C' ? f.u : '')).join(''), ch: r1(p.chm || 0), w: p.tw ? 1 : 0, fi: r1(p.fim || 0), fc: (() => { const c = p.fates.find(f => f.k === 'C'); return c && c.cd > g.t ? r1(c.cd - g.t) : 0; })() } : {})
    }));
    const body = JSON.stringify({ type: 'snap', T: r1(g.time), in: r1(Math.max(0, g.intro)), tr: g.tr, tp: g.tp.map(r2), rp: g.rp.map(r2), door: g.door, cams: g.cams, cp: g.cp ? g.cp.map(r2) : null, ev: g.ev, p, ...(g.fate ? { tw: g.twins } : {}), ...(g.sb > 1.001 ? { sb: r2(g.sb) } : {}), ...(g.awake ? { aw: g.aw, awT: r1(g.awT) } : {}), ...(g.lastId ? { la: g.lastId } : {}), ...(g.stealth ? { hn: r1(Math.max(0, g.sthNext - g.t)), sd: Math.abs(g.nA - g.nD) < 2 ? 1 : 0 } : {}) });
    g.ev = [];
    for (const pl of this.players.values()) if (pl.ws) try { pl.ws.send('{"ack":' + (pl.seq | 0) + ',' + body.slice(1)); } catch (e) {}
  }

  endGame() {
    const g = this.g; clearInterval(this.loop); this.loop = null;
    const ps = [...this.players.values()], alices = ps.filter(p => p.role === 'alice');
    const esc = alices.filter(p => p.st === 4);
    const need = Math.ceil(alices.length / 2), win = esc.length > 0 && esc.length >= need ? 'alice' : 'dream'; // 절반 이상 탈출해야 앨리스 승리
    this.all({
      type: 'end', win, need, total: alices.length, reason: win === 'alice' ? 'escape' : (g.time <= 0 ? 'time' : 'caught'),
      esc: esc.map(p => p.name), rot: alices.filter(p => p.st === 3).map(p => p.name),
      jail: alices.filter(p => p.st === 1 || p.st === 2 || (p.st === 0 && win === 'dream')).map(p => p.name),
      dreams: ps.filter(p => p.role === 'dream').map(p => p.name), traces: g.tr.reduce((a, b) => a + b, 0),
      ...this.scores(alices, win)
    });
    this.phase = 'end';
    this.pushLobby();
    clearTimeout(this.backTimer);
    this.backTimer = setTimeout(() => this.reset(false), 10000);
  }

  reset(empty) {
    clearInterval(this.loop); this.loop = null; clearTimeout(this.backTimer);
    this.phase = 'lobby'; this.g = null;
    for (const p of [...this.players.values()]) {
      if (!p.on || empty) { this.players.delete(p.id); continue; }
      p.ready = false; p.role = null;
    }
    this.order = this.order.filter(id => this.players.has(id));
    if (!this.players.has(this.host)) this.pickHost();
    this.settings.max = Math.max(this.settings.max, this.players.size, 2);
    if (!empty) this.pushLobby();
  }
}
