// 人柱愛麗絲 : 망가진 꿈 — 실시간 방 서버 (Cloudflare Workers + Durable Objects)
// 방 하나 = Durable Object 하나. 그 방의 모든 플레이어가 같은 객체에 연결되므로
// 위치·잡힘·감옥·흔적·문을 전부 서버 한 곳에서 판정한다 (권위 서버).

import { CFG, TRACE_INFO, MAPS, genWorld, stepPlayer, collide, worldSig, mapFingerprint, skinValid } from '../public/multi/shared.js';

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
    this.settings = { dreams: 1, max: 8, map: 'random', skins: false };
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
    let p = this.players.get(id);
    if (p) {
      if (p.ws) { try { p.ws.close(4001, 'replaced'); } catch (e) {} }
      p.ws = ws; p.on = true;
    } else {
      if (this.phase !== 'lobby') return err('이미 게임이 진행 중이에요. 끝나면 다시 들어와 주세요.');
      if (this.players.size >= this.settings.max) return err('방이 꽉 찼어요.');
      p = { id, name: clean(q.get('name')) || '이름 없는 아이', dev: q.get('dev') === 'phone' ? 'phone' : 'pc', ready: false, want: false, ws, on: true, chatT: [], rtt: 100 };
      this.players.set(id, p); this.order.push(id);
      if (!this.host) this.host = id;
      this.sys(`${p.name} 님이 들어왔어요.`);
    }
    ws.addEventListener('message', e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } try { this.onMsg(p, m); } catch (ex) { console.log('msg error', ex && ex.stack); } });
    ws.addEventListener('close', () => this.onClose(p, ws));
    ws.addEventListener('error', () => this.onClose(p, ws));
    this.send(p, { type: 'hello', id, code: this.code, fp: mapFingerprint() });
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
      players: this.order.map(id => this.players.get(id)).filter(Boolean).map(p => ({ id: p.id, name: p.name, ready: p.ready, want: p.want, dev: p.dev, on: p.on }))
    };
  }
  pushLobby() { this.all(this.lobbyMsg()); }

  onClose(p, ws) {
    if (p.ws !== ws) return;
    p.ws = null; p.on = false;
    if (this.phase === 'lobby') {
      this.players.delete(p.id); this.order = this.order.filter(i => i !== p.id);
      this.sys(`${p.name} 님이 나갔어요.`);
    } else {
      this.sys(`${p.name} 님의 연결이 끊겼어요.`);
      if (this.g && p.role === 'dream' && p.carry) this.drop(p);
    }
    if (this.host === p.id || !this.players.has(this.host)) this.pickHost();
    if (![...this.players.values()].some(x => x.on)) this.reset(true);
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
      case 'ready': if (this.phase === 'lobby') { p.ready = !!m.v; this.pushLobby(); } break;
      case 'want': if (this.phase === 'lobby') { p.want = !!m.v; this.pushLobby(); } break;
      case 'set':
        if (this.phase !== 'lobby' || p.id !== this.host) return;
        this.settings.max = clamp(m.max | 0 || this.settings.max, Math.max(2, this.players.size), CFG.MAX_PLAYERS);
        this.settings.dreams = clamp(m.dreams | 0 || this.settings.dreams, 1, Math.min(CFG.MAX_DREAMS, this.settings.max - 1));
        if (m.map === 'random' || MAPS.includes(m.map)) this.settings.map = m.map;
        if (typeof m.skins === 'boolean') this.settings.skins = m.skins;
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
      case 'skin': if (m.v === null) p.skin = null; else if (skinValid(m.v)) p.skin = m.v; break;
      case 'ping': this.send(p, { type: 'pong', t: m.t }); break;
      case 'rtt': p.rtt = clamp(+m.v || 100, 0, 1000); break;
    }
  }

  cantStart() {
    const ps = [...this.players.values()];
    if (ps.length < 2) return '최소 2명이 있어야 시작할 수 있어요.';
    if (ps.some(x => !x.ready)) return '모두 준비해야 시작할 수 있어요.';
    if (this.settings.dreams >= ps.length) return '앨리스가 한 명 이상 있어야 해요. 꿈 인원을 줄여 주세요.';
    return '';
  }

  startMsg(p) {
    const g = this.g;
    return {
      type: 'start', seed: g.seed, map: g.map, sig: g.sig, you: p.id, intro: g.intro, time: g.time,
      players: [...this.players.values()].map(x => ({ id: x.id, name: x.name, role: x.role, skin: this.settings.skins && x.role !== 'dream' ? x.skin || null : null })),
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
        aPrev: 0, aHeld: 0, im: 0, sg: 0, cell: -1, jt: 0, hist: []
      });
    }
    this.g = {
      seed, map, w, sig: worldSig(w), time: CFG.GAME_TIME, intro: CFG.INTRO, t: 0,
      tp: TRACE_INFO.map(() => 0), tr: TRACE_INFO.map(() => 0), tby: TRACE_INFO.map(() => null),
      rp: w.cells.map(() => 0), door: null, ev: [], mbT: 0, rotSlot: 0,
      cams: w.cams ? w.cams.map(() => 1) : null, cp: w.cams ? w.cams.map(() => 0) : null
    };
    this.phase = 'game';
    for (const p of this.players.values()) this.send(p, this.startMsg(p));
    this.pushLobby();
    clearInterval(this.loop);
    this.loop = setInterval(() => { try { this.tick(); } catch (e) { console.log('tick error', e && e.stack); } }, CFG.TICK_MS);
  }

  ev(k, o) { this.g.ev.push({ k, ...o }); }

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
      best.st = 1; best.carrier = d.id; best.sg = 0; d.carry = best.id;
      this.ev('catch', { a: best.id, d: d.id });
    } else {
      // 방송국: 가까운 CCTV 끄기
      if (g.cams) { let ci = -1, cd = 1.8; w.cams.forEach((c, i) => { const dd = Math.hypot(d.x - c.x, d.z - c.z); if (g.cams[i] && dd < cd) { cd = dd; ci = i; } }); if (ci >= 0) { g.cams[ci] = 0; g.cp[ci] = 0; this.ev('cam', { i: ci, on: 0, by: d.id }); return; } }
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
        } else if (p.st === 1 && press && inp.q - (p.sgQ || 0) >= CFG.STRUGGLE_GAP) { p.sg += CFG.STRUGGLE_ADD; p.sgQ = inp.q; }
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
        g.rp[i] += dt;
        if (g.rp[i] >= CFG.RESCUE_TIME) {
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
        if (g.tp[i] >= t.dur) { g.tr[i] = 1; g.tp[i] = t.dur; g.tby[i] = trT[i]; this.ev('trace', { i, by: trT[i] }); }
      } else g.tp[i] = Math.max(0, g.tp[i] - dt * .5);
    });

    if (camT) g.cams.forEach((on, i) => {
      if (on) return;
      if (camT[i]) { g.cp[i] += dt; if (g.cp[i] >= 2.5) { g.cams[i] = 1; g.cp[i] = 0; this.ev('cam', { i, on: 1, by: camT[i] }); } }
      else g.cp[i] = Math.max(0, g.cp[i] - dt);
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
      if (a.role === 'alice' && a.st === 0 && Math.hypot(a.x - g.door.x, a.z - g.door.z) < CFG.ESCAPE_R) { a.st = 4; this.ev('esc', { a: a.id }); }
    }

    for (const p of ps) { p.hist.push([g.t, p.x, p.z]); if (p.hist.length > 24) p.hist.shift(); }
    this.snap();

    const alices = ps.filter(p => p.role === 'alice');
    const active = alices.filter(p => (p.st === 0 || p.st === 1) && p.on).length;
    if (g.time <= 0 || active === 0) this.endGame();
  }

  snap() {
    const g = this.g;
    const p = [...this.players.values()].map(p => ({
      i: p.id, x: r2(p.x), z: r2(p.z), y: r2(p.yaw), s: p.st, m: p.m | 0, dc: r1(p.dc), dt: r2(p.dt), sn: r1(p.sn),
      c: p.carry ? 1 : 0, pc: r2(p.pc || 0), b: r1(p.burnT || 0), sg: r2(p.sg), jt: r1(p.jt), im: p.im > 0 ? 1 : 0, o: p.on ? 1 : 0, cl: p.cell
    }));
    const body = JSON.stringify({ type: 'snap', T: r1(g.time), in: r1(Math.max(0, g.intro)), tr: g.tr, tp: g.tp.map(r2), rp: g.rp.map(r2), door: g.door, cams: g.cams, cp: g.cp ? g.cp.map(r2) : null, ev: g.ev, p });
    g.ev = [];
    for (const pl of this.players.values()) if (pl.ws) try { pl.ws.send('{"ack":' + (pl.seq | 0) + ',' + body.slice(1)); } catch (e) {}
  }

  endGame() {
    const g = this.g; clearInterval(this.loop); this.loop = null;
    const ps = [...this.players.values()], alices = ps.filter(p => p.role === 'alice');
    const esc = alices.filter(p => p.st === 4);
    const win = esc.length > 0 ? 'alice' : 'dream';
    this.all({
      type: 'end', win, reason: win === 'alice' ? 'escape' : (g.time <= 0 ? 'time' : 'caught'),
      esc: esc.map(p => p.name), rot: alices.filter(p => p.st === 3).map(p => p.name),
      jail: alices.filter(p => p.st === 1 || p.st === 2 || (p.st === 0 && win === 'dream')).map(p => p.name),
      dreams: ps.filter(p => p.role === 'dream').map(p => p.name), traces: g.tr.reduce((a, b) => a + b, 0)
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
