// 人柱愛麗絲 : 망가진 꿈 — 클라이언트
import { CFG, GR, WL, WALL_H, TRACE_INFO, MAPS, MAP_NAMES, genWorld, stepPlayer } from './shared.js';

const $ = id => document.getElementById(id);
const W = 400, H = 300;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const r2 = v => Math.round(v * 100) / 100;
const mkStore = s => ({ get(k, d) { try { const v = s.getItem('injoo_m_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { s.setItem('injoo_m_' + k, JSON.stringify(v)); } catch (e) {} } });
const store = mkStore(window.localStorage), sess = mkStore(window.sessionStorage);
const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

let myId = sess.get('id', null); if (!myId) { myId = makeId(); sess.set('id', myId); }
let device = store.get('device', null);
let chicken = store.get('chicken', false);
let myName = store.get('name', '');
let bright = (() => { try { const v = JSON.parse(localStorage.getItem('injoo_bright')); return v == null ? 2 : v; } catch (e) { return 2; } })();
const BRIGHT = [[.72, -4], [.86, -2], [1, 0], [1.2, 7], [1.45, 16]];
function setBright(v) { bright = clamp(v, 0, 4); try { localStorage.setItem('injoo_bright', JSON.stringify(bright)); } catch (e) {} const el = $('selBright'); if (el) el.value = bright; }
const SERVER = String(window.INJOO_SERVER || '').replace(/\/+$/, '');
const HTTP = SERVER || location.origin;
const WSB = HTTP.replace(/^http/i, 'ws');

function josa(name, a, b) {
  const c = name.charCodeAt(name.length - 1) - 0xAC00;
  if (c < 0 || c > 11171) return `${name}${a}(${b})`;
  return name + (c % 28 ? a : b);
}
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

/* =========================================================
   화면 전환 · 기기 선택 · 홈
   ========================================================= */
function show(id) { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; }
function homeErr(t) { $('homeErr').textContent = t || ''; }

document.querySelectorAll('[data-dev]').forEach(b => b.addEventListener('click', () => {
  device = b.dataset.dev; store.set('device', device);
  if (device === 'phone') { try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {} }
  goHome();
}));
$('btnDev').addEventListener('click', () => show('scDevice'));
function goHome() {
  $('devLabel').textContent = device === 'phone' ? '폰 · 태블릿' : '컴퓨터';
  $('inName').value = myName; $('chkChicken').checked = chicken;
  show('scHome');
}
$('chkChicken').addEventListener('change', e => { chicken = e.target.checked; store.set('chicken', chicken); });
function takeName() {
  const v = $('inName').value.replace(/[<>]/g, '').trim().slice(0, 10);
  if (!v) { homeErr('이름을 적어 주세요.'); $('inName').focus(); return false; }
  myName = v; store.set('name', v); return true;
}
$('btnCreate').addEventListener('click', async () => {
  homeErr(''); if (!takeName()) return; initAudio();
  $('btnCreate').disabled = true;
  try {
    const r = await fetch(HTTP + '/api/create', { method: 'POST' });
    const j = await r.json();
    if (!j.code) throw new Error(j.error || 'fail');
    connect(j.code, true);
  } catch (e) { homeErr('서버에 연결할 수 없어요. 주소 설정(config.js)을 확인해 주세요.'); }
  $('btnCreate').disabled = false;
});
$('homeForm').addEventListener('submit', e => {
  e.preventDefault(); homeErr(''); if (!takeName()) return; initAudio();
  const code = $('inCode').value.toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== 4) { homeErr('방 코드 4자리를 적어 주세요.'); return; }
  connect(code, false);
});
$('inCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });

/* =========================================================
   네트워크
   ========================================================= */
let ws = null, leaving = false, lastErr = '', curCode = '', lobby = null, retries = 0, rtt = 0;
function connect(code, create) {
  leaving = false; curCode = code;
  const u = `${WSB}/ws/${code}?id=${encodeURIComponent(myId)}&name=${encodeURIComponent(myName)}&dev=${device}&create=${create ? 1 : 0}`;
  let sock;
  try { sock = new WebSocket(u); } catch (e) { homeErr('서버에 연결할 수 없어요.'); return; }
  ws = sock;
  sock.onopen = () => { retries = 0; };
  sock.onmessage = e => { if (sock !== ws) return; let m; try { m = JSON.parse(e.data); } catch (_) { return; } onMsg(m); };
  sock.onclose = () => {
    if (sock !== ws) return; ws = null;
    if (leaving) return;
    if (game && !lastErr && retries < 4) { retries++; addSys('연결이 끊겨 다시 연결하는 중…'); setTimeout(() => { if (!leaving) connect(curCode, false); }, 700 * retries); return; }
    stopGame(); show('scHome'); homeErr(lastErr || '연결이 끊겼어요.'); lastErr = '';
  };
}
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
setInterval(() => send({ type: 'ping', t: performance.now() }), 2000);

function onMsg(m) {
  switch (m.type) {
    case 'hello': curCode = m.code; break;
    case 'err': lastErr = m.msg; break;
    case 'lobby':
      lobby = m; renderLobby();
      if (m.phase === 'lobby' && game) { stopGame(); show('scLobby'); }
      else if (!game) show('scLobby');
      break;
    case 'chat': addChat(m); break;
    case 'start': startGame(m); break;
    case 'snap': if (game) onSnap(m); break;
    case 'end': if (game) onEnd(m); break;
    case 'pong': rtt = performance.now() - m.t; send({ type: 'rtt', v: Math.round(rtt) }); break;
  }
}

/* =========================================================
   로비
   ========================================================= */
$('btnLeave').addEventListener('click', () => { leaving = true; try { ws && ws.close(); } catch (e) {} ws = null; stopGame(); goHome(); });
$('btnCopy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(curCode); $('btnCopy').textContent = '복사됨'; }
  catch (e) { $('btnCopy').textContent = curCode; }
  setTimeout(() => { $('btnCopy').textContent = '코드 복사'; }, 1500);
});
$('btnReady').addEventListener('click', () => { const me = lobby && lobby.players.find(p => p.id === myId); send({ type: 'ready', v: !(me && me.ready) }); });
$('btnWant').addEventListener('click', () => { const me = lobby && lobby.players.find(p => p.id === myId); send({ type: 'want', v: !(me && me.want) }); });
$('btnStart').addEventListener('click', () => send({ type: 'start' }));
$('selDreams').addEventListener('change', e => send({ type: 'set', dreams: +e.target.value, max: lobby.settings.max, map: lobby.settings.map }));
$('selMax').addEventListener('change', e => send({ type: 'set', dreams: lobby.settings.dreams, max: +e.target.value, map: lobby.settings.map }));
{ const sb = $('selBright'); for (let i = 0; i < 5; i++) { const o = document.createElement('option'); o.value = i; o.textContent = '■'.repeat(i + 1) + '□'.repeat(4 - i); sb.append(o); } sb.value = bright; sb.addEventListener('change', e => setBright(+e.target.value)); }
$('selMap').addEventListener('change', e => send({ type: 'set', dreams: lobby.settings.dreams, max: lobby.settings.max, map: e.target.value }));
$('lbChatForm').addEventListener('submit', e => { e.preventDefault(); const v = $('lbChatIn').value.trim(); if (v) send({ type: 'chat', text: v }); $('lbChatIn').value = ''; });

function renderLobby() {
  const L = lobby; if (!L) return;
  $('lbCode').textContent = L.code;
  const isHost = L.host === myId, me = L.players.find(p => p.id === myId);
  $('lbCount').textContent = `${L.players.length} / ${L.settings.max}`;
  const ul = $('lbPlayers'); ul.textContent = '';
  for (const p of L.players) {
    const li = document.createElement('li');
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = p.name + (p.id === myId ? ' (나)' : ''); li.append(nm);
    const add = (t, c) => { const b = document.createElement('span'); b.className = 'badge ' + (c || ''); b.textContent = t; li.append(b); };
    add(p.dev === 'phone' ? '폰' : 'PC');
    if (p.id === L.host) add('방장', 'host');
    if (p.want) add('꿈 지원', 'dream');
    if (!p.on) add('연결 끊김');
    add(p.ready ? '준비 완료' : '대기', p.ready ? 'ready' : '');
    ul.append(li);
  }
  const sd = $('selDreams'), sm = $('selMax');
  const fill = (sel, from, to, val, fmt) => { sel.textContent = ''; for (let i = from; i <= to; i++) { const o = document.createElement('option'); o.value = i; o.textContent = fmt(i); sel.append(o); } sel.value = val; };
  fill(sm, Math.max(2, L.players.length), CFG.MAX_PLAYERS, L.settings.max, i => `${i}명`);
  fill(sd, 1, Math.min(CFG.MAX_DREAMS, L.settings.max - 1), L.settings.dreams, i => `꿈 ${i} · 앨리스 최대 ${L.settings.max - i}`);
  const smp = $('selMap'); smp.textContent = '';
  for (const k of ['random', ...MAPS]) { const o = document.createElement('option'); o.value = k; o.textContent = MAP_NAMES[k]; smp.append(o); }
  smp.value = L.settings.map || 'random';
  sd.disabled = sm.disabled = smp.disabled = !isHost;
  $('btnReady').textContent = me && me.ready ? '준비 취소' : '준비';
  $('btnReady').classList.toggle('on', !!(me && me.ready));
  $('btnWant').textContent = me && me.want ? '꿈 지원 중' : '꿈 하고 싶어요';
  $('btnWant').classList.toggle('on', !!(me && me.want));
  $('btnStart').hidden = !isHost;
  let why = '';
  if (L.phase !== 'lobby') why = '이전 게임이 끝나는 중이에요…';
  else if (L.players.length < 2) why = '친구에게 방 코드를 알려 주세요. 최소 2명이 필요해요.';
  else if (L.players.some(p => !p.ready)) why = '모두 준비하면 방장이 시작할 수 있어요.';
  else if (L.settings.dreams >= L.players.length) why = '앨리스가 최소 1명 있어야 해요. 꿈 인원을 줄여 주세요.';
  $('btnStart').disabled = !!why;
  $('lbHint').textContent = why || (isHost ? '모두 준비됐어요. 시작을 누르세요.' : '방장이 시작하길 기다리는 중…');
}

function addChat(m) {
  const log = $('lbChat');
  const div = document.createElement('div');
  if (m.sys) { div.className = 'sys'; div.textContent = m.text; }
  else { div.className = m.role === 'dream' ? 'r-dream' : ''; const b = document.createElement('b'); b.textContent = m.name + (m.role === 'dream' ? ' (꿈)' : ''); div.append(b, document.createTextNode(' ' + m.text)); }
  log.append(div); while (log.children.length > 80) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
  if (game) { game.chat.push({ t: performance.now(), name: m.name, text: m.text, sys: m.sys, dream: m.role === 'dream' }); if (game.chat.length > 8) game.chat.shift(); if (!m.sys) sfx.tick(); }
}
function addSys(text) { addChat({ sys: 1, text }); }

/* =========================================================
   소리
   ========================================================= */
const A = { ctx: null, master: null, noise: null, drone: null, pv: 1, pp: 0 };
function initAudio() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const C = new AC(); A.ctx = C;
  const comp = C.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 5;
  A.master = C.createGain(); A.master.gain.value = .9; A.master.connect(comp); comp.connect(C.destination);
  const len = C.sampleRate * 2, b = C.createBuffer(1, len, C.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  A.noise = b;
  const hs = C.createBufferSource(); hs.buffer = b; hs.loop = true;
  const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
  const hg = C.createGain(); hg.gain.value = .014; hs.connect(hp); hp.connect(hg); hg.connect(A.master); hs.start();
  const dg = C.createGain(); dg.gain.value = 0;
  const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 5;
  const base = [55, 55.7, 41.2];
  const oscs = base.map((f, i) => { const o = C.createOscillator(); o.type = i === 2 ? 'sine' : 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); return o; });
  const lfo = C.createOscillator(); lfo.frequency.value = .07; const lg = C.createGain(); lg.gain.value = 90; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  lp.connect(dg); dg.connect(A.master);
  A.drone = { g: dg, oscs, base };
}
function drone(level, pitch = 1, time = 1) {
  if (!A.ctx) return; const t = A.ctx.currentTime;
  if (chicken) level *= .25;
  A.drone.g.gain.setTargetAtTime(level, t, time / 3);
  A.drone.oscs.forEach((o, i) => o.frequency.setTargetAtTime(A.drone.base[i] * pitch, t, time / 3));
}
function route(node, pan) {
  if (pan && A.ctx.createStereoPanner) { const p = A.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); node.connect(p); p.connect(A.master); }
  else node.connect(A.master);
}
function nz(dur, o = {}) {
  const C = A.ctx; if (!C) return;
  const { type = 'bandpass', f = 1000, f2 = 0, q = 1, a = .005, delay = 0 } = o;
  const vol = (o.vol || .3) * A.pv; if (vol < .002) return;
  const pan = o.pan != null ? o.pan + A.pp : A.pp;
  const t = C.currentTime + delay;
  const s = C.createBufferSource(); s.buffer = A.noise; s.loop = true;
  const fl = C.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
  const gn = C.createGain(); gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + a); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(fl); fl.connect(gn); route(gn, pan); s.start(t, Math.random() * 1.5); s.stop(t + dur + .05);
}
function osc(type, f, dur, o = {}) {
  const C = A.ctx; if (!C) return;
  const { f2 = 0, a = .005, delay = 0, detune = 0 } = o;
  const vol = (o.vol || .2) * A.pv; if (vol < .002) return;
  const pan = o.pan != null ? o.pan + A.pp : A.pp;
  const t = C.currentTime + delay;
  const os = C.createOscillator(); os.type = type; os.frequency.setValueAtTime(f, t); if (f2) os.frequency.exponentialRampToValueAtTime(f2, t + dur); os.detune.value = detune;
  const gn = C.createGain(); gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + a); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
  os.connect(gn); route(gn, pan); os.start(t); os.stop(t + dur + .05);
}
// 꿈의 기척: 가까울수록 짙어지는 숨소리 · 낮은 으르렁 · 귀울림 (꿈이 있는 방향에서 들림)
const PR = { on: false };
function presenceInit() {
  if (PR.on || !A.ctx) return;
  const C = A.ctx; PR.on = true;
  const pan = C.createStereoPanner ? C.createStereoPanner() : C.createGain(); pan.connect(A.master); PR.pan = pan;
  const n = C.createBufferSource(); n.buffer = A.noise; n.loop = true;
  const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 430; bp.Q.value = 1.3;
  const am = C.createGain(); am.gain.value = .5;
  const lfo = C.createOscillator(); lfo.frequency.value = .38; const lg = C.createGain(); lg.gain.value = .5; lfo.connect(lg); lg.connect(am.gain);
  PR.breath = C.createGain(); PR.breath.gain.value = 0;
  n.connect(bp); bp.connect(am); am.connect(PR.breath); PR.breath.connect(pan); n.start(); lfo.start();
  const ws = C.createWaveShaper(), curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 4); }
  ws.curve = curve;
  const glp = C.createBiquadFilter(); glp.type = 'lowpass'; glp.frequency.value = 320;
  PR.growl = C.createGain(); PR.growl.gain.value = 0;
  for (const f of [44, 45.3, 66.7]) { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(ws); o.start(); }
  const glfo = C.createOscillator(); glfo.frequency.value = 5.5; const gld = C.createGain(); gld.gain.value = 60; glfo.connect(gld); gld.connect(glp.frequency); glfo.start();
  ws.connect(glp); glp.connect(PR.growl); PR.growl.connect(pan);
  const ti = C.createOscillator(); ti.type = 'sine'; ti.frequency.value = 3950;
  const tlfo = C.createOscillator(); tlfo.frequency.value = .2; const tld = C.createGain(); tld.gain.value = 40; tlfo.connect(tld); tld.connect(ti.frequency); tlfo.start();
  PR.ring = C.createGain(); PR.ring.gain.value = 0; ti.connect(PR.ring); PR.ring.connect(A.master); ti.start();
}
function presence(v, pan) {
  if (!A.ctx) return;
  presenceInit();
  const t = A.ctx.currentTime, k = chicken ? .12 : 1;
  PR.breath.gain.setTargetAtTime(Math.pow(v, 1.4) * .55 * k, t, .25);
  PR.growl.gain.setTargetAtTime(Math.pow(v, 2.2) * .3 * k, t, .25);
  PR.ring.gain.setTargetAtTime(chicken ? 0 : Math.max(0, v - .55) * .07, t, .4);
  if (PR.pan.pan) PR.pan.pan.setTargetAtTime(clamp(pan, -1, 1), t, .1);
}
const NOTES = [392, 466.16, 523.25, 622.25, 698.46];
const sfx = {
  tick() { osc('square', 1700 + Math.random() * 400, .02, { vol: .02 }); },
  step(v = 1) { nz(.12, { type: 'lowpass', f: 600, vol: .09 * v }); },
  thud() { osc('sine', 62, .22, { vol: .45, f2: 34 }); nz(.18, { type: 'lowpass', f: 300, vol: .35 }); },
  heart(v) { osc('sine', 55, .16, { vol: .45 * v, f2: 40 }); osc('sine', 50, .16, { vol: .32 * v, f2: 37, delay: .22 }); },
  whisper(dur = 1.6) { for (let i = 0; i < 6; i++) nz(.22 + Math.random() * .35, { type: 'bandpass', f: 1300 + Math.random() * 1900, q: 5, vol: .07 + Math.random() * .05, a: .07, pan: (Math.random() - .5) * .5, delay: i * dur / 6 }); },
  screech() { if (chicken) return sfx.boing(); for (let i = 0; i < 4; i++) osc('sawtooth', 280 + Math.random() * 500, 1, { vol: .2, f2: 1700 + Math.random() * 1600, a: .008 }); nz(1, { type: 'highpass', f: 1400, vol: .5, a: .004 }); osc('square', 58, 1, { vol: .28, f2: 30 }); },
  growl() { if (chicken) return sfx.boing(); osc('sawtooth', 70, 1.4, { vol: .35, f2: 48, a: .2 }); nz(1.4, { type: 'bandpass', f: 300, q: 2, vol: .3, a: .3 }); osc('sawtooth', 141, 1.2, { vol: .1, f2: 90, a: .2, detune: 30 }); },
  shriek() { if (chicken) return sfx.boing(); for (let i = 0; i < 6; i++) osc('sawtooth', 900 + Math.random() * 900, 1.2, { vol: .17, f2: 300 + Math.random() * 300, a: .004, detune: (Math.random() - .5) * 80 }); nz(1.2, { type: 'bandpass', f: 2500, q: .7, vol: .55, a: .003 }); osc('sine', 48, 1, { vol: .6, f2: 28, a: .003 }); },
  ear() { if (chicken) return sfx.chime(); for (let i = 0; i < 8; i++) nz(.18 + Math.random() * .2, { type: 'bandpass', f: 1600 + Math.random() * 1500, q: 6, vol: .14, a: .03, pan: (Math.random() < .5 ? -1 : 1) * .95, delay: i * .14 }); nz(1.4, { type: 'bandpass', f: 380, q: 1, vol: .35, a: .5 }); },
  reverse() { if (chicken) return sfx.chime(); nz(1.3, { type: 'bandpass', f: 400, f2: 2600, q: 3, vol: .35, a: 1.1 }); osc('sawtooth', 200, 1.3, { vol: .15, f2: 900, a: 1.1 }); },
  scream() { if (chicken) return sfx.pop(); for (let i = 0; i < 3; i++) osc('sawtooth', 620 + i * 37, .9, { vol: .16, f2: 380, a: .02, delay: i * .02 }); nz(.9, { type: 'bandpass', f: 1500, q: 2, vol: .2 }); },
  swing() { nz(.25, { type: 'bandpass', f: 600, f2: 2400, q: 1.5, vol: .3, a: .03 }); },
  dash() { nz(.45, { type: 'lowpass', f: 300, f2: 2000, vol: .4, a: .05 }); },
  music(i) { const f = NOTES[i % NOTES.length]; osc('sine', f, 1.4, { vol: .26, a: .003, detune: (Math.random() - .5) * 60 }); osc('sine', f * 2.006, .6, { vol: .08 }); },
  bell() { osc('sine', 196, 3.5, { vol: .22 }); osc('sine', 196 * 2.76, 2.2, { vol: .07 }); osc('sine', 196 * 5.4, 1.1, { vol: .03 }); },
  clang() { osc('square', 180, .5, { vol: .2, f2: 90 }); osc('sine', 860, 1.2, { vol: .12 }); nz(.3, { type: 'highpass', f: 2500, vol: .25 }); },
  squelch() { if (chicken) return sfx.pop(); nz(.6, { type: 'lowpass', f: 700, f2: 120, vol: .5, a: .01 }); osc('sine', 90, .5, { vol: .4, f2: 30 }); },
  choir() { for (const [f, d] of [[261.6, 0], [329.6, .1], [392, .2], [523.2, .3]]) osc('sine', f, 4.5, { vol: .1, a: 1.2, delay: d }); },
  gasp() { nz(.7, { type: 'bandpass', f: 650, f2: 2300, q: 2, vol: .3, a: .04 }); },
  boing() { osc('sine', 300, .45, { vol: .3, f2: 900 }); osc('sine', 600, .3, { vol: .12, f2: 200, delay: .12 }); },
  chime() { [1046, 1318, 1568].forEach((f, i) => osc('sine', f, .6, { vol: .1, delay: i * .07 })); },
  pop() { osc('sine', 500, .15, { vol: .3, f2: 1200 }); }
};
function at(x, z, maxD, fn) {
  if (!game || !A.ctx) return;
  const c = game.cam, dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
  if (d > maxD) return;
  let rel = Math.atan2(dz, dx) - c.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  A.pv = Math.pow(Math.max(0, 1 - d / maxD), 1.3); A.pp = d < .5 ? 0 : Math.sin(rel) * .85;
  try { fn(); } finally { A.pv = 1; A.pp = 0; }
}

/* =========================================================
   스프라이트 (도트)
   ========================================================= */
function mk(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const R = new Uint8Array(w * h), G = new Uint8Array(w * h), B = new Uint8Array(w * h), A_ = new Uint8Array(w * h), E = new Uint8Array(w * h);
  rows.forEach((row, y) => { for (let x = 0; x < w; x++) { const c = row[x] || '.'; const p = pal[c]; if (!p) continue; const k = y * w + x; R[k] = p[0]; G[k] = p[1]; B[k] = p[2]; A_[k] = 1; E[k] = p[3] ? 1 : 0; } });
  return { w, h, r: R, g: G, b: B, a: A_, e: E };
}
const SPR = {
  alice: mk([
    '....hhhh....', '...hhhhhh...', '..hhffffhh..', '..hfeffefh..', '..hffffffh..', '..hhffffhh..', '..hh.ff.hh..',
    '....dddd....', '...dddddd...', '..addwwdda..', '..adwwwwda..', '.aadwwwwdaa.', '.a.dwwwwd.a.', '.a.dwwwwd.a.',
    '..ddwwwwdd..', '..dddddddd..', '.dddddddddd.', 'dddddddddddd', 'dddddddddddd', '...ll..ll...', '...ll..ll...',
    '...ll..ll...', '..sss..sss..'
  ], { h: [200, 186, 140], f: [232, 220, 203], e: [26, 20, 24], d: [72, 88, 128], w: [230, 226, 216], a: [224, 212, 196], l: [216, 208, 196], s: [20, 18, 18] }),
  dream: mk([
    '....kkkk....', '...kkkkkk...', '..kkkkkkkk..', '..kEkkkkEk..', '..kkkkkkkk..', '..kkmmmmkk..', '...kmmmmk...',
    '....kkkk....', '...kkkkkk...', '..kkkkkkkk..', '.kkkkkkkkkk.', '.kk.kkkk.kk.', 'kk..kkkk..kk', 'kk..kkkk..kk',
    'kk..kkkk..kk', 'k...kkkk...k', 'k...kkkk...k', 'k...kkkk...k', 'k..kkkkkk..k', 'c..kkkkkk..c', 'c..kkkkkk..c',
    'c..kkkkkk..c', '...kkkkkk...', '...kk..kk...', '...kk..kk...', '...kk..kk...', '...kk..kk...', '...kk..kk...',
    '...kk..kk...', '..kkk..kkk..'
  ], { k: [24, 20, 26], E: [245, 240, 230, 1], m: [70, 4, 8], c: [74, 66, 62] }),
  ghost: mk([
    '.....wwww.....', '...wwwwwwww...', '..wwwwwwwwww..', '.wwwwwwwwwwww.', '.wwweewwweeww.', '.wwweewwweeww.',
    '.wppwwwwwwwppw', '.wwwwwmmwwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.',
    '.ww.www.www.w.', '.w...w...w....'
  ], { w: [246, 243, 255, 1], e: [42, 34, 51, 1], p: [255, 140, 175, 1], m: [42, 34, 51, 1] }),
  body: mk([
    '...gggg...', '..gGggGg..', '..gggggg..', '...gGGg...', '....gg....', '..dddddd..', '.dddddddd.', 'gdddddddg.',
    'gdddddddd.', 'g.dddddd.g', '..dddddd..', '..dddddd..', '...dddd...', '...g..g...', '...g..g...', '...g..g...',
    '...b..b...', '...b..b...', '..........', '...b......'
  ], { g: [96, 104, 78], G: [10, 6, 6], d: [44, 48, 58], b: [110, 10, 10] }),
  sword: mk(['..h..', '..h..', '..h..', 'ggggg', '.sss.', '.srs.', '.sss.', '.ssr.', '.sss.', '.srs.', '.sss.', '.sss.', '..s..', '..s..', 'rrrrr'],
    { h: [70, 30, 20], g: [80, 66, 40], s: [196, 196, 206], r: [150, 14, 14] }),
  musicbox: mk(['..........', '....pp....', '....pp....', '...pppp...', 'bbbbbbbbbb', 'wwwwwwwwww', 'wggggggggw', 'wwwwwwwwww', 'wwwwwwwwww', '.w......w.'],
    { p: [220, 224, 240], b: [70, 46, 30], w: [96, 62, 38], g: [200, 160, 60] }),
  crown: mk(['..........', '.y..y..y..', '.yy.yy.yy.', '.yyyyyyyy.', '.yrygygry.', '.yyyyyyyy.', '..........', '..pppppp..', '...pppp...', '...pppp...', '...pppp...', '...pppp...', '..pppppp..', '.pppppppp.'],
    { y: [214, 176, 60], r: [190, 20, 30], g: [40, 160, 70], p: [90, 92, 86] }),
  card: mk(['wwwwwwww', 'wwrwwrww', 'wrrrrrrw', 'wrrrrrrw', 'wwrrrrww', 'wwwrrwww', 'wwwwwwww', '...ss...', '...ss...', '...ss...'],
    { w: [228, 220, 200], r: [170, 20, 24], s: [70, 50, 34] }),
  table: mk(['cccccccccccccccc', 'cccccccccccccccc', 'cwcccccccccccccw', '.l............l.', '.l............l.', '.l............l.'],
    { c: [150, 140, 126], w: [120, 112, 100], l: [60, 40, 26] }),
  chair: mk(['.bbbbbb.', '.b....b.', '.b....b.', '.bbbbbb.', '.b....b.', '.b....b.', 'bbbbbbbb', 'b......b', 'b......b', 'b......b', 'b......b', 'b......b'],
    { b: [58, 36, 30] }),
  pole: mk(['.s.', '.s.', 'sws', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.', '.w.'],
    { s: [150, 150, 150], w: [62, 44, 30] }),
  seat: mk(['.rrrrrrrr.', 'rRRRRRRRRr', 'rRRRRRRRRr', 'rRRRRRRRRr', 'rRRRRRRRRr', 'rrrrrrrrrr', 'gggggggggg', 'rRRRRRRRRr', 'rrrrrrrrrr', '.k......k.', '.k......k.'],
    { r: [70, 10, 20], R: [110, 18, 32], g: [160, 130, 50], k: [30, 20, 18] }),
  mann: mk(['....hhhh....', '...hffffh...', '...feffef...', '...ffffff...', '....ffff....', '.....ff.....', '..ffffffff..', '.ff.ffff.ff.', '.f..ffff..f.', '.f..ffff..f.', '....ffff....', '..ffffffff..', '..ff....ff..', '..ff....ff..', '..ff....ff..'],
    { h: [60, 50, 40], f: [200, 184, 150], e: [10, 8, 8] }),
  bars: mk(['iiiiiiiiiiii', 'i..i..i..i.i', 'i..i..i..i.i', 'i..i..i..i.i', 'i..i..i..i.i', 'i..i..i..i.i', 'i..i..i..i.i', 'i..i..i..i.i', 'i..i..i..i.i', 'i..i..i..i.i', 'i..i..i..i.i', 'i..i..i..i.i', 'i..i..i..i.i', 'i..i..i..i.i', 'i..i..i..i.i', 'iiiiiiiiiiii'],
    { i: [70, 66, 62] })
};

/* =========================================================
   렌더러 (1인칭 레이캐스터 + VHS)
   ========================================================= */
const cv = $('cv'), ctx = cv.getContext('2d');
const wimg = ctx.createImageData(W, H), pix = new Uint32Array(wimg.data.buffer);
const out = ctx.createImageData(W, H);
for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;
const zbuf = new Float32Array(W), zcol = new Float32Array(W);
const FOVP = 0.66;
const fx = { noise: .09, ca: 1, wobble: .5, flicker: .04, glitch: 0, tr: 1, tg: 1, tb: 1 };
let band = { y: -99, h: 0, s: 0, life: 0 };
let now = 0, frameDt = 0;
const STARS = Array.from({ length: 70 }, (_, i) => ({ a: Math.random() * Math.PI * 2, h: .15 + Math.random() * .85, b: 80 + Math.random() * 120 }));
const GCOL = [[22, 25, 18], [96, 14, 14], [48, 50, 46], [56, 38, 24], [30, 37, 24], [72, 22, 36], [58, 16, 26], [96, 84, 44], [22, 20, 26]];
const WCOL = [[0, 0, 0], [76, 82, 72], [62, 68, 60], [58, 56, 54], [0, 0, 0], [36, 34, 100], [92, 18, 30], [170, 150, 78], [120, 108, 60]];
// 맵별 하늘·안개
const STYLE = { forest: { fogC: [7, 7, 10], fogD: 10.5 }, theater: { fogC: [6, 6, 16], fogD: 11, ceil: [14, 12, 26] }, tea: { fogC: [46, 40, 18], fogD: 9.5, ceil: [120, 110, 70] } };
const pack = (r, g, b) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return (h ^ (h >>> 16)) & 255; };

function renderWorld(g, cam) {
  const w = g.world, N = w.N, dream = g.role === 'dream', ST = STYLE[w.map] || STYLE.forest;
  const fogD = dream ? ST.fogD + 2.5 : ST.fogD, fogS = 1.2;
  const fogC = dream ? [Math.min(255, ST.fogC[0] + 12), ST.fogC[1] * .5 | 0, ST.fogC[2] * .5 | 0] : ST.fogC;
  const tube = w.map === 'tea' ? .82 + .18 * (Math.sin(now * 37) > -.9 ? 1 : 0) * (Math.sin(now * 3.1) > -.97 ? 1 : .2) : 1;
  const dirX = Math.cos(cam.yaw), dirZ = Math.sin(cam.yaw), plX = -dirZ * FOVP, plZ = dirX * FOVP;
  const hor = (H / 2 + cam.bob) | 0;
  const fogT = d => { const t = clamp((d - fogS) / (fogD - fogS), 0, 1); return t * t * (3 - 2 * t); };
  const chick = chicken;

  // 하늘 (실내 맵은 천장)
  if (w.indoor) {
    const cc = ST.ceil, c0x = dirX - plX, c0z = dirZ - plZ, c1x = dirX + plX, c1z = dirZ + plZ;
    for (let y = 0; y <= hor && y < H; y++) {
      const rowDist = (.5 * H) / Math.max(1, hor - y);
      if (rowDist > fogD) { pix.fill(pack(fogC[0], fogC[1], fogC[2]), y * W, y * W + W); continue; }
      const ft = clamp((rowDist - fogS) / (fogD - fogS), 0, 1), kf = 1 - ft;
      const sx = rowDist * (c1x - c0x) / W, sz = rowDist * (c1z - c0z) / W;
      let fx2 = cam.x + rowDist * c0x, fz2 = cam.z + rowDist * c0z;
      for (let x = 0; x < W; x++, fx2 += sx, fz2 += sz) {
        let m = .9 * tube;
        if (w.map === 'tea') { const u = fx2 % 3, v = fz2 % 3; if (u < .06 || v < .06) m *= .7; else if (u > 1 && u < 2 && v > 1.2 && v < 1.8) { const L = 1.9 * tube; pix[y * W + x] = pack(Math.min(255, 255 * L * kf + fogC[0] * ft) | 0, Math.min(255, 246 * L * kf + fogC[1] * ft) | 0, Math.min(255, 200 * L * kf + fogC[2] * ft) | 0); continue; } }
        else if ((fx2 * 2 % 1) < .05) m *= .6;
        pix[y * W + x] = pack((cc[0] * m * kf + fogC[0] * ft) | 0, (cc[1] * m * kf + fogC[1] * ft) | 0, (cc[2] * m * kf + fogC[2] * ft) | 0);
      }
    }
  } else
  for (let y = 0; y <= hor && y < H; y++) {
    const t = y / Math.max(1, hor);
    const c = pack(lerp(4, fogC[0] + 8, t) | 0, lerp(3, fogC[1] + 6, t) | 0, lerp(8, fogC[2] + 12, t) | 0);
    pix.fill(c, y * W, y * W + W);
  }
  if (!w.indoor) for (const s of STARS) {
    let rel = s.a - cam.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    if (Math.abs(rel) > .6) continue;
    const x = (W / 2 + Math.tan(rel) / FOVP * W / 2) | 0, y = (hor - s.h * hor) | 0;
    if (x >= 0 && x < W && y >= 0 && y < hor) pix[y * W + x] = pack(s.b, s.b, s.b + 20);
  }
  if (!w.indoor) { // 달
    let rel = -2.3 - cam.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    if (Math.abs(rel) < .7) {
      const mx = W / 2 + Math.tan(rel) / FOVP * W / 2, my = hor * .28, mr = 9;
      for (let y = (my - mr) | 0; y <= my + mr; y++) for (let x = (mx - mr) | 0; x <= mx + mr; x++) {
        if (x < 0 || x >= W || y < 0 || y >= hor) continue;
        const d = Math.hypot(x - mx, y - my);
        if (d < mr) pix[y * W + x] = dream ? pack(200, 60, 60) : pack(196, 192, 176);
        else if (d < mr + 6) { const k = (1 - (d - mr) / 6) * .25, o = pix[y * W + x]; pix[y * W + x] = pack(((o & 255) + 180 * k) | 0, (((o >> 8) & 255) + 170 * k) | 0, (((o >> 16) & 255) + 160 * k) | 0); }
      }
    }
  }
  // 멀리 보이는 성의 실루엣
  if (w.map === 'forest') {
    const dx = 40 - cam.x, dz = 40 - cam.z, dist = Math.hypot(dx, dz);
    if (dist > 9.5) {
      let rel = Math.atan2(dz, dx) - cam.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const half = Math.atan(9 / dist);
      for (let x = 0; x < W; x++) {
        const ang = Math.atan((x - W / 2) / (W / 2) * FOVP);
        const u = (ang - (rel - half)) / (2 * half);
        if (u < 0 || u > 1) continue;
        let hh = .55 + (u < .12 || u > .88 ? .45 : 0) + (Math.abs(u - .5) < .07 ? .7 : 0) + ((u * 16 % 1) < .5 ? .06 : 0) - (hash((u * 40) | 0, 7) / 255) * .18;
        if (u > .62 && u < .74) hh -= .25;
        const px = Math.min(hor, (hh * 3.2 / dist) * H * 1.6) | 0;
        const c = dream ? pack(26, 10, 12) : pack(16, 18, 17);
        for (let y = hor - px; y < hor; y++) if (y >= 0) pix[y * W + x] = c;
      }
    }
  }
  // 바닥
  const rd0x = dirX - plX, rd0z = dirZ - plZ, rd1x = dirX + plX, rd1z = dirZ + plZ;
  const fogPack = pack(fogC[0], fogC[1], fogC[2]);
  for (let y = Math.max(0, hor + 1); y < H; y++) {
    const rowDist = (.5 * H) / (y - hor);
    if (rowDist > fogD) { pix.fill(fogPack, y * W, y * W + W); continue; }
    const ft = fogT(rowDist), kf = 1 - ft;
    const sx = rowDist * (rd1x - rd0x) / W, sz = rowDist * (rd1z - rd0z) / W;
    let fx_ = cam.x + rowDist * rd0x, fz_ = cam.z + rowDist * rd0z;
    const row = y * W;
    for (let x = 0; x < W; x++, fx_ += sx, fz_ += sz) {
      const ix = fx_ | 0, iz = fz_ | 0;
      const t = (ix >= 0 && iz >= 0 && ix < N && iz < N) ? w.ground[iz * N + ix] : 0;
      let c = GCOL[t];
      let r = c[0], gg = c[1], b = c[2];
      if (t === GR.RED && chick) { r = 150; gg = 70; b = 110; }
      if (tube !== 1) { r *= tube; gg *= tube; b *= tube; }
      const n = hash((fx_ * 4) | 0, (fz_ * 4) | 0);
      let m = .82 + n / 255 * .3;
      if (t === GR.STONE && ((fx_ * 2 % 1) < .06 || (fz_ * 2 % 1) < .06)) m *= .6;
      if (t === GR.BOARD && (fx_ * 3 % 1) < .08) m *= .55;
      if (t === GR.YCARPET && (((fx_ * 2) | 0) + ((fz_ * 2) | 0)) % 7 === 0) m *= .8;
      if (t === GR.CARPET && ((fx_ * 4 % 1) < .1)) m *= .75;
      pix[row + x] = pack((r * m * kf + fogC[0] * ft) | 0, (gg * m * kf + fogC[1] * ft) | 0, (b * m * kf + fogC[2] * ft) | 0);
    }
  }
  // 벽 (DDA)
  for (let x = 0; x < W; x++) {
    const cx = 2 * x / W - 1, rdx = dirX + plX * cx, rdz = dirZ + plZ * cx;
    let mx = cam.x | 0, mz = cam.z | 0;
    const ddx = Math.abs(1 / (rdx || 1e-9)), ddz = Math.abs(1 / (rdz || 1e-9));
    let stx, stz, sdx, sdz;
    if (rdx < 0) { stx = -1; sdx = (cam.x - mx) * ddx; } else { stx = 1; sdx = (mx + 1 - cam.x) * ddx; }
    if (rdz < 0) { stz = -1; sdz = (cam.z - mz) * ddz; } else { stz = 1; sdz = (mz + 1 - cam.z) * ddz; }
    let hit = 0, side = 0, perp = 99;
    for (let k = 0; k < 64; k++) {
      if (sdx < sdz) { sdx += ddx; mx += stx; side = 0; } else { sdz += ddz; mz += stz; side = 1; }
      if (mx < 0 || mz < 0 || mx >= N || mz >= N) break;
      const t = w.wall[mz * N + mx];
      if (t && t !== WL.BARS) { hit = t; break; }
      if ((side ? sdz - ddz : sdx - ddx) > fogD + 1) break;
    }
    if (!hit) { zbuf[x] = 99; continue; }
    perp = side ? sdz - ddz : sdx - ddx;
    if (perp > fogD + .5) { zbuf[x] = 99; continue; }
    zbuf[x] = perp;
    const lh = H / perp, wh = WALL_H[hit];
    const bot = hor + .5 * lh, top = bot - wh * lh;
    let wx = side ? cam.x + perp * rdx : cam.z + perp * rdz; wx -= Math.floor(wx);
    const ft = fogT(perp), kf = 1 - ft, sh = side ? .74 : 1;
    const base = WCOL[hit];
    const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H - 1, Math.floor(bot));
    const patch = hash(mx * 3 + 1, mz * 7 + 3);
    for (let y = y0; y <= y1; y++) {
      const vh = (bot - y) / lh;
      let m = sh;
      if (hit === WL.CURTAIN || hit === WL.VELVET) m *= .65 + .35 * Math.sin(wx * (hit === WL.VELVET ? 14 : 22));
      else if (hit === WL.YPAPER) { m *= tube * (((wx * 6) | 0) % 2 ? .9 : 1) * (vh < .15 ? .7 : 1) * (patch < 40 && vh < .6 ? .78 : 1); if ((hash((wx * 8) | 0, (vh * 8) | 0) & 63) < 3) m *= .6; }
      else if (hit === WL.PILLAR) m *= tube * (.8 + .2 * Math.sin(wx * 6.28));
      else {
        const row = Math.floor(vh * 4), off = (row & 1) * .5;
        if ((vh * 4) % 1 < .1 || ((wx * 2 + off) % 1) < .06) m *= .55;
        if (hash(row + mx * 5, ((wx * 2 + off) | 0) + mz * 11) < 40) m *= .7;
        if (patch < 70 && vh > wh * .7) m *= .6;
      }
      pix[y * W + x] = pack((base[0] * m * kf + fogC[0] * ft) | 0, (base[1] * m * kf + fogC[1] * ft) | 0, (base[2] * m * kf + fogC[2] * ft) | 0);
    }
  }

  // ---- 스프라이트 ----
  const inv = 1 / (plX * dirZ - dirX * plZ);
  const proj = (sx_, sz_) => {
    const dx = sx_ - cam.x, dz = sz_ - cam.z;
    return [inv * (dirZ * dx - dirX * dz), inv * (-plZ * dx + plX * dz)];
  };
  zcol.set(zbuf);
  // 나무: 가까운 것부터 그리며 그 열을 가린다
  const trees = [];
  const R = Math.ceil(fogD) + 1, cix = cam.x | 0, ciz = cam.z | 0;
  for (let cz = ciz - R; cz <= ciz + R; cz++) for (let cx2 = cix - R; cx2 <= cix + R; cx2++) {
    if (cx2 < 0 || cz < 0 || cx2 >= N || cz >= N) continue;
    const l = w.treeCells[cz * N + cx2]; if (!l) continue;
    for (const t of l) { if (t.seat) continue; const [tx, ty] = proj(t.x, t.z); if (ty > .1 && ty < fogD + 1) trees.push({ t, tx, ty }); }
  }
  trees.sort((a, b) => a.ty - b.ty);
  for (const { t, tx, ty } of trees) {
    const scale = H / ty, sx = W / 2 * (1 + tx / ty), wpx = 2 * t.r * scale;
    const x0 = Math.floor(sx - wpx / 2), x1 = Math.floor(sx + wpx / 2);
    if (x1 < 0 || x0 >= W) continue;
    const bot = Math.min(H - 1, Math.floor(hor + .5 * scale)), top = Math.max(0, Math.ceil(hor + .5 * scale - 7 * scale));
    const ft = fogT(ty), kf = 1 - ft, cb = 26 + t.s * 30;
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      if (ty >= zcol[x]) continue;
      zcol[x] = ty;
      const u = (x - (sx - wpx / 2)) / wpx;
      const edge = 1 - Math.abs(u - .5) * 1.3;
      for (let y = top; y <= bot; y++) {
        const bark = (hash(x - x0 + ((t.s * 99) | 0), (y / scale * 6) | 0) & 31) / 160;
        const m = edge * (.85 + bark) * (u > .62 ? .55 : 1);
        const r = cb * m, gg = cb * .92 * m, b = cb * .82 * m;
        pix[y * W + x] = pack((r * kf + fogC[0] * ft) | 0, (gg * kf + fogC[1] * ft) | 0, (b * kf + fogC[2] * ft) | 0);
      }
    }
  }
  // 그 밖의 스프라이트: 먼 것부터
  const list = [];
  const push = (spr, x, z, ww, wh, z0, mode, extra) => { const [tx, ty] = proj(x, z); if (ty > .12 && (ty < fogD + 2 || mode === 3)) list.push({ spr, tx, ty, ww, wh, z0, mode, extra }); };
  for (const p of w.props) {
    if (p.kind === 'table') push(SPR.table, p.x, p.z, 1.0, .55, 0, 0);
    else if (p.kind === 'chair') push(SPR.chair, p.x, p.z, .45, .8, 0, 0);
    else if (p.kind === 'pole') push(SPR.pole, p.x, p.z + .02, .12, 2.4, 0, 0);
    else if (p.kind === 'bars') push(SPR.bars, p.x, p.z, 1.0, 1.4, 0, 0);
    else if (p.kind === 'seat') push(SPR.seat, p.x, p.z, .8, .8, 0, 0);
    else if (p.kind === 'mann') push(chick ? SPR.ghost : SPR.mann, p.x, p.z - .05, chick ? .6 : .55, chick ? .6 : 1.0, chick ? .35 : 0, 0);
  }
  w.traces.forEach((t, i) => {
    if (g.tr[i]) return;
    const s = SPR[t.kind];
    const dims = { sword: [.3, .9, 0], musicbox: [.5, .5, 0], crown: [.45, .65, 0], card: [.3, .38, i === 3 ? .5 : 0] }[t.kind];
    push(s, t.x, t.z, dims[0], dims[1], dims[2], 2);
  });
  for (const pl of g.players.values()) {
    if (pl.id === myId && !g.spectating) continue;
    const ip = interp(pl); if (!ip || !pl.cur) continue;
    const st = pl.cur.s;
    if (st === 4) continue;
    if (pl.id === g.spectating) continue;
    if (pl.role === 'dream') {
      if (pl.cur.o === 0) continue;
      if (g.meS && g.meS.s === 1 && Math.hypot(ip.x - cam.x, ip.z - cam.z) < 1.3) continue;
      if (chick) push(SPR.ghost, ip.x, ip.z, 1.0, 1.0, .35 + Math.sin(now * 3) * .05, 0, pl);
      else push(SPR.dream, ip.x, ip.z, .75, 1.8, 0, pl.cur.sn > 0 ? 4 : 0, pl);
    } else if (st === 3) {
      push(chick ? SPR.ghost : SPR.body, ip.x, ip.z, .55, 1.0, 1.3, 0, pl);
    } else {
      if (st === 1 && Math.hypot(ip.x - cam.x, ip.z - cam.z) < 1.3) continue;
      push(SPR.alice, ip.x, ip.z, .55, 1.05, st === 1 ? .55 : 0, dream ? 1 : 0, pl);
    }
  }
  list.sort((a, b) => b.ty - a.ty);
  const tags = [];
  for (const s of list) {
    const { spr, tx, ty, ww, wh, z0, mode } = s;
    const tyS = Math.max(ty, .55), scale = H / tyS, sx = W / 2 * (1 + tx / ty), hpx = wh * scale, wpx = ww * scale;
    const bot = hor + (.5 - z0) * scale, top = bot - hpx;
    const x0 = Math.floor(sx - wpx / 2), x1 = Math.floor(sx + wpx / 2);
    if (x1 < 0 || x0 >= W) continue;
    let ft = fogT(ty);
    if (mode === 1) ft *= .35; if (mode === 2) ft *= .55;
    const kf = 1 - ft;
    const pulse = mode === 2 ? .15 + .15 * Math.sin(now * 3) : 0;
    const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H - 1, Math.floor(bot));
    let vis = false;
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      if (ty >= zcol[x]) continue;
      vis = true;
      const fu = (x - (sx - wpx / 2)) / wpx * spr.w, pu = Math.min(spr.w - 1, fu | 0), ffu = fu - pu, big = spr === SPR.dream && wpx / spr.w > 5;
      for (let y = y0; y <= y1; y++) {
        const fv = (y - top) / hpx * spr.h, pv = Math.min(spr.h - 1, fv | 0);
        const k = pv * spr.w + pu;
        if (!spr.a[k]) continue;
        let r = spr.r[k], gg = spr.g[k], b = spr.b[k];
        if (spr.e[k]) {
          const ffv = fv - pv;
          if (!big || (Math.abs(ffu - .5) < .2 && Math.abs(ffv - .5) < .2)) { pix[y * W + x] = pack(r, gg, b); continue; }
          r = 22; gg = 18; b = 24;
        }
        if (mode === 1) { r = 200; gg = 215; b = 255; }
        if (mode === 4 && (now * 10 | 0) % 2) { r = 120; gg = 20; b = 20; }
        if (pulse) { r = lerp(r, 255, pulse); gg = lerp(gg, 236, pulse); b = lerp(b, 200, pulse); }
        pix[y * W + x] = pack((r * kf + fogC[0] * ft) | 0, (gg * kf + fogC[1] * ft) | 0, (b * kf + fogC[2] * ft) | 0);
      }
    }
    if (vis && s.extra && s.extra.role === g.role && ty < 8) tags.push({ x: sx, y: top - 4, name: s.extra.name, a: 1 - ty / 8 });
  }
  // 하늘의 문 빛기둥
  if (g.door) {
    const [tx, ty] = proj(g.door.x, g.door.z);
    if (ty > .1) {
      const sx = W / 2 * (1 + tx / ty), wpx = Math.max(6, 2.2 * H / ty);
      for (let x = Math.max(0, (sx - wpx / 2) | 0); x <= Math.min(W - 1, (sx + wpx / 2) | 0); x++) {
        if (ty >= zcol[x] && ty > 2) continue;
        const u = Math.abs((x - sx) / (wpx / 2)), k0 = (1 - u * u) * (.55 + .15 * Math.sin(now * 2 + x * .1));
        for (let y = 0; y < H; y++) {
          const k = k0 * (y < hor ? 1 : Math.max(0, 1 - (y - hor) / 60));
          if (k <= 0) continue;
          const o = pix[y * W + x];
          pix[y * W + x] = pack(lerp(o & 255, 235, k) | 0, lerp((o >> 8) & 255, 240, k) | 0, lerp((o >> 16) & 255, 255, k) | 0);
        }
      }
    }
  }
  return tags;
}

function post(dt) {
  const sd = wimg.data, d = out.data, BR = BRIGHT[bright] || BRIGHT[2], bo = BR[1];
  const ns = (fx.noise + fx.glitch * .5) * 255, ca = Math.round(fx.ca + fx.glitch * 5), fl = 1 - Math.random() * fx.flicker;
  const roll = (now * 22) % (H + 80) - 40;
  if (band.life <= 0 && Math.random() < .004 + fx.glitch * .25) band = { y: Math.random() * H, h: 3 + Math.random() * 22, s: (Math.random() - .5) * 34, life: .08 + Math.random() * .3 };
  band.life -= dt; band.y += dt * 50;
  const wob = fx.wobble + fx.glitch * 3, tr = fx.tr, tg = fx.tg, tb = fx.tb;
  for (let y = 0; y < H; y++) {
    let sh = Math.round(Math.sin(y * .045 + now * 2.3) * wob + Math.sin(y * .31 + now * 17) * wob * .3), extra = 0;
    if (band.life > 0 && y >= band.y && y < band.y + band.h) { sh += band.s + (Math.random() * 4 | 0); extra = .5; }
    if (y > H - 5) { sh += 6 + (Math.random() * 8 | 0); extra = .9; }
    const rd = Math.abs(y - roll), rb = rd < 18 ? (1 - rd / 18) * 10 : 0;
    const k = ((y & 1) ? .82 : 1) * fl * BR[0], row = y * W, amp = ns + extra * 220;
    for (let x = 0; x < W; x++) {
      let sx = x - sh; if (sx < 0) sx = 0; else if (sx >= W) sx = W - 1;
      let xr = sx + ca; if (xr >= W) xr = W - 1; let xb = sx - ca; if (xb < 0) xb = 0;
      const n = (Math.random() - .5) * amp + rb, o = (row + x) * 4;
      d[o] = (sd[(row + xr) * 4] * tr + n) * k + bo;
      d[o + 1] = (sd[(row + sx) * 4 + 1] * tg + n) * k + bo;
      d[o + 2] = (sd[(row + xb) * 4 + 2] * tb + n) * k + bo;
    }
  }
  ctx.putImageData(out, 0, 0);
}

/* =========================================================
   조작
   ========================================================= */
const keys = {};
const ctl = { actHeld: false, actLatch: false, dashQ: false, joyX: 0, joyY: 0, touchAct: false };
let chatOpen = false;
window.addEventListener('keydown', e => {
  if (!game) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT') {
    if (e.key === 'Escape' && chatOpen) closeChat();
    return;
  }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
  if (k === 'enter' || k === 't') { e.preventDefault(); openChat(); return; }
  if (keys[k]) return;
  keys[k] = true;
  initAudio();
  if (k === 'e' || k === ' ') { ctl.actLatch = true; if (game.spectate) cycleSpectate(); }
  if (k === 'shift') ctl.dashQ = true;
  if (k === 'm') game.mapOn = !game.mapOn;
  if (k === 'tab' || k === 'h' || k === '?') game.briefOn = !game.briefOn;
  if (k === 'b') { setBright((bright + 1) % 5); say(`밝기 ${'■'.repeat(bright + 1)}${'□'.repeat(4 - bright)}`, '#cfc6b6', 1.5); }
});
window.addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase(); keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; ctl.touchAct = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { for (const k in keys) keys[k] = false; ctl.touchAct = false; ctl.joyX = ctl.joyY = 0; } });

// 마우스 시점
let dragLook = false;
cv.addEventListener('mousedown', e => {
  if (!game || device === 'phone') return;
  initAudio();
  if (game.spectate) { cycleSpectate(); return; }
  if (document.pointerLockElement !== cv && cv.requestPointerLock) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => { dragLook = true; }); } catch (_) { dragLook = true; } }
  else dragLook = true;
});
window.addEventListener('mouseup', () => { dragLook = false; });
window.addEventListener('mousemove', e => {
  if (!game || device === 'phone') return;
  if (document.pointerLockElement === cv) game.yaw += e.movementX * .0026;
  else if (dragLook) game.yaw += e.movementX * .006;
});
document.addEventListener('pointerlockchange', () => { if (game) $('lockHint').hidden = device === 'phone' || document.pointerLockElement === cv; });

// 터치: 조이스틱 · 시점 · 버튼
const joy = $('joy'), knob = $('joyKnob');
let joyId = null, lookId = null, lookX = 0;
joy.addEventListener('pointerdown', e => { e.preventDefault(); joyId = e.pointerId; try { joy.setPointerCapture(e.pointerId); } catch (_) {} moveJoy(e); initAudio(); });
joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) moveJoy(e); });
const endJoy = e => { if (e.pointerId !== joyId) return; joyId = null; ctl.joyX = ctl.joyY = 0; knob.style.transform = 'translate(-50%,-50%)'; };
joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
const ROT = () => document.body.classList.contains('rot90');
function moveJoy(e) {
  const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width / 2;
  let dx = (e.clientX - cx) / rad, dy = (e.clientY - cy) / rad; if (ROT()) { const t = dx; dx = dy; dy = -t; } const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
  ctl.joyX = Math.abs(dx) < .12 ? 0 : dx; ctl.joyY = Math.abs(dy) < .12 ? 0 : dy;
  knob.style.transform = `translate(calc(-50% + ${dx * rad * .6}px), calc(-50% + ${dy * rad * .6}px))`;
}
cv.addEventListener('pointerdown', e => {
  if (!game || device !== 'phone' || e.pointerType === 'mouse') return;
  initAudio();
  if (game.spectate) { cycleSpectate(); return; }
  lookId = e.pointerId; lookX = ROT() ? e.clientY : e.clientX; try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== lookId || !game) return;
  const r = cv.getBoundingClientRect();
  const v = ROT() ? e.clientY : e.clientX, span = ROT() ? r.height : r.width;
  game.yaw += (v - lookX) / span * 4.2; lookX = v;
});
const endLook = e => { if (e.pointerId === lookId) lookId = null; };
cv.addEventListener('pointerup', endLook); cv.addEventListener('pointercancel', endLook);
const hold = (el, on, off) => {
  el.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); on(); });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(t, () => off && off());
};
hold($('tAct'), () => { ctl.touchAct = true; ctl.actLatch = true; if (game && game.spectate) cycleSpectate(); }, () => { ctl.touchAct = false; });
hold($('tDash'), () => { ctl.dashQ = true; });
hold($('tMap'), () => { if (game) game.mapOn = !game.mapOn; });
hold($('tChat'), () => openChat());
hold($('tHelp'), () => { if (game) game.briefOn = !game.briefOn; });

// 폰 가로 모드: 안드로이드는 전체화면+가로 고정, 안 되는 기기(아이폰)는 화면을 90도 돌린다
const isPortrait = () => window.matchMedia && matchMedia('(orientation: portrait)').matches;
let landMode = false;
function syncOrient() { $('tOrient').textContent = landMode ? '세로로' : '가로 모드'; }
async function goLandscape() {
  try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch (e) {}
  let locked = false;
  try { if (document.fullscreenElement && screen.orientation && screen.orientation.lock) { await screen.orientation.lock('landscape'); locked = true; } } catch (e) {}
  if (!locked && isPortrait()) document.body.classList.add('rot90');
  landMode = true; syncOrient();
}
async function goPortrait() {
  document.body.classList.remove('rot90');
  try { if (document.fullscreenElement && screen.orientation && screen.orientation.lock) await screen.orientation.lock('portrait'); } catch (e) { try { screen.orientation.unlock(); } catch (_) {} }
  landMode = false; syncOrient();
}
$('tOrient').addEventListener('click', e => { e.preventDefault(); initAudio(); landMode ? goPortrait() : goLandscape(); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && !document.body.classList.contains('rot90')) { landMode = false; syncOrient(); } });
if (window.matchMedia) {
  const mq = matchMedia('(orientation: portrait)');
  const onOrient = () => { if (!mq.matches && document.body.classList.contains('rot90')) document.body.classList.remove('rot90'); };
  mq.addEventListener ? mq.addEventListener('change', onOrient) : mq.addListener(onOrient);
}

function openChat() {
  if (!game) return;
  chatOpen = true; $('gChatForm').hidden = false;
  if (document.pointerLockElement) document.exitPointerLock();
  for (const k in keys) keys[k] = false;
  setTimeout(() => $('gChatIn').focus(), 0);
}
function closeChat() { chatOpen = false; $('gChatForm').hidden = true; $('gChatIn').value = ''; $('gChatIn').blur(); }
$('gChatForm').addEventListener('submit', e => { e.preventDefault(); const v = $('gChatIn').value.trim(); if (v) send({ type: 'chat', text: v }); closeChat(); });
$('gChatIn').addEventListener('blur', () => { if (chatOpen) setTimeout(() => { if (document.activeElement !== $('gChatIn')) closeChat(); }, 100); });
$('btnBack').addEventListener('click', () => { stopGame(); show('scLobby'); renderLobby(); });

function readControls() {
  let f = 0, s = 0;
  if (!chatOpen) {
    f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    s = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    f += -ctl.joyY; s += ctl.joyX;
  }
  const act = !chatOpen && (keys.e || keys[' '] || ctl.touchAct || ctl.actLatch);
  ctl.actLatch = false;
  const dash = ctl.dashQ; ctl.dashQ = false;
  return { f: clamp(f, -1, 1), s: clamp(s, -1, 1), act, dash };
}

/* =========================================================
   게임 상태
   ========================================================= */
let game = null;
function startGame(m) {
  const world = genWorld(m.seed, m.map);
  const players = new Map(m.players.map(p => [p.id, { id: p.id, name: p.name, role: p.role, snaps: [], cur: null }]));
  const me = players.get(myId); if (!me) return;
  const first = !game;
  game = {
    world, players, role: me.role, me,
    pred: { x: m.me.x, z: m.me.z, yaw: m.me.yaw, role: me.role, st: 0, dc: 0, dt: 0, sn: 0, carry: 0, m: 0 },
    yaw: first || !game ? m.me.yaw : game.yaw, seq: m.me.seq || 0, pending: [], outbox: [], acc: 0,
    T: m.time, intro: m.intro, tr: TRACE_INFO.map(() => 0), tp: TRACE_INFO.map(() => 0), rp: world.cells.map(() => 0), door: null,
    smooth: { x: 0, z: 0 }, msgs: [], chat: [], mapOn: false, briefOn: false, scare: null, ended: null, meS: null,
    spectate: false, spectating: null, terrorCd: 4, heartT: 0, stepT: 0, bob: 0, phase: 0,
    stepTimers: new Map(), prevTp: TRACE_INFO.map(() => 0), prevRp: world.cells.map(() => 0), alerts: [],
    cam: { x: m.me.x, z: m.me.z, yaw: m.me.yaw, bob: 0 }, mapImg: null, nearDream: 99, lastSnap: performance.now(),
    revealN: Math.floor((CFG.GAME_TIME - m.time) / CFG.REVEAL_EVERY), reveal: null
  };
  game.mapImg = buildMap(world);
  game.pdist = cellField(world);
  if (world.fogOfWar && game.role === 'alice') { game.seen = new Uint8Array(world.N * world.N); game.fogImg = document.createElement('canvas'); game.fogImg.width = game.fogImg.height = world.N; const fx_ = game.fogImg.getContext('2d'); fx_.fillStyle = '#050403'; fx_.fillRect(0, 0, world.N, world.N); }
  say(`맵: ${MAP_NAMES[world.map] || '숲'}`, '#cfc6b6', 4);
  show('scGame');
  $('endBox').hidden = true;
  const phone = device === 'phone';
  $('touch').hidden = !phone;
  $('tDash').hidden = game.role !== 'dream';
  $('tAct').textContent = game.role === 'dream' ? '잡기' : '행동';
  $('lockHint').hidden = phone || document.pointerLockElement === cv;
  initAudio(); drone(game.role === 'dream' ? .07 : .05, game.role === 'dream' ? .8 : 1, 2);
  fx.tr = game.role === 'dream' ? 1.12 : 1; fx.tg = game.role === 'dream' ? .82 : 1; fx.tb = game.role === 'dream' ? .82 : 1;
  sfx.bell();
  $('tOrient').hidden = !phone; syncOrient();
  if (phone && isPortrait() && !document.body.classList.contains('rot90')) say('오른쪽 위 [가로 모드]를 누르면 화면이 커져요', '#cfc6b6', 6);
}
function stopGame() {
  game = null; closeChat(); presence(0, 0);
  if (document.pointerLockElement) document.exitPointerLock();
  $('touch').hidden = true; drone(0, 1, .5);
}

function interp(pl) {
  const s = pl.snaps; if (!s.length) return null;
  const rt = performance.now() - 110;
  let a = s[0], b = s[s.length - 1];
  if (rt >= b.t) return b;
  if (rt <= a.t) return a;
  for (let i = s.length - 1; i > 0; i--) if (s[i - 1].t <= rt) { a = s[i - 1]; b = s[i]; break; }
  const k = (rt - a.t) / Math.max(1, b.t - a.t);
  let dy = b.y - a.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  return { x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), y: a.y + dy * k };
}

function say(text, color = '#efe8da', dur = 4) { if (!game) return; game.msgs.push({ text, color, t: performance.now(), dur }); if (game.msgs.length > 4) game.msgs.shift(); }
const nameOf = id => { const p = game && game.players.get(id); return p ? p.name : '누군가'; };

function onSnap(m) {
  const g = game, t = performance.now();
  g.lastSnap = t;
  g.T = m.T; g.intro = m.in; g.tr = m.tr; g.tp = m.tp; g.rp = m.rp; g.door = m.door;
  for (const s of m.p) {
    const pl = g.players.get(s.i); if (!pl) continue;
    pl.cur = s; pl.snaps.push({ t, x: s.x, z: s.z, y: s.y }); if (pl.snaps.length > 30) pl.snaps.shift();
  }
  for (const e of m.ev) handleEv(e);
  const s = m.p.find(p => p.i === myId);
  if (s) {
    g.meS = s;
    const P = g.pred;
    if (s.s === 0) {
      const ox = P.x, oz = P.z, was = P.st === 0;
      Object.assign(P, { x: s.x, z: s.z, dc: s.dc, dt: s.dt, sn: s.sn, carry: s.c, st: 0 });
      g.pending = g.pending.filter(i => i.q > m.ack);
      for (const i of g.pending) stepPlayer(g.world, P, i, CFG.INPUT_DT);
      if (was) { g.smooth.x += ox - P.x; g.smooth.z += oz - P.z; if (Math.hypot(g.smooth.x, g.smooth.z) > 1.5) g.smooth.x = g.smooth.z = 0; }
      else g.smooth.x = g.smooth.z = 0;
    } else { P.st = s.s; P.x = s.x; P.z = s.z; g.pending = []; g.smooth.x = g.smooth.z = 0; }
    const sp = s.s === 3 || s.s === 4;
    if (sp && !g.spectate) { g.spectate = true; cycleSpectate(); }
    if (!sp) { g.spectate = false; g.spectating = null; }
  }
  // 꿈에게 보이는 경보: 누군가 흔적이나 감옥을 건드리고 있다
  if (g.role === 'dream') {
    g.world.traces.forEach((tr, i) => { if (g.tp[i] > g.prevTp[i] + .01 && !g.tr[i]) g.alerts.push({ x: tr.x, z: tr.z, t, kind: 'trace' }); });
    g.world.cells.forEach((c, i) => { if (g.rp[i] > g.prevRp[i] + .01) g.alerts.push({ x: c.door.x, z: c.door.z, t, kind: 'cell' }); });
    if (g.alerts.length > 20) g.alerts.splice(0, g.alerts.length - 20);
  }
  g.prevTp = g.tp.slice(); g.prevRp = g.rp.slice();
}

function cycleSpectate() {
  const g = game; if (!g) return;
  const cands = [...g.players.values()].filter(p => p.id !== myId && p.cur && p.cur.s !== 3 && p.cur.s !== 4);
  if (!cands.length) { g.spectating = null; return; }
  const i = cands.findIndex(p => p.id === g.spectating);
  g.spectating = cands[(i + 1) % cands.length].id;
}

function handleEv(e) {
  const g = game, w = g.world;
  const posOf = id => { const p = g.players.get(id); return p && p.cur ? p.cur : null; };
  switch (e.k) {
    case 'catch': {
      const an = nameOf(e.a), dn = nameOf(e.d), p = posOf(e.a);
      if (e.a === myId) { fx.glitch = 1.6; jumpscare(); say(`잡혔다! ${device === 'phone' ? '행동 버튼' : 'E'} 연타로 몸부림쳐!`, '#ff6a6a', 5); }
      else { if (p) at(p.x, p.z, 40, sfx.scream); say(g.role === 'dream' ? `${josa(dn, '이', '가')} ${josa(an, '을', '를')} 잡았다` : `${josa(an, '이', '가')} 꿈에게 잡혔다`, '#e07070'); }
      break;
    }
    case 'swing': { const p = posOf(e.d); if (p) at(p.x, p.z, 10, sfx.swing); break; }
    case 'free':
      if (e.a === myId) { sfx.gasp(); say(e.struggle ? '빠져나왔다! 도망쳐!' : '풀려났다!', '#cfe8d2'); }
      else if (e.d === myId) { say(e.struggle ? '앨리스가 몸부림쳐 빠져나갔다… (잠시 움직일 수 없음)' : '앨리스를 놓쳤다', '#e07070'); fx.glitch = .8; }
      else say(`${josa(nameOf(e.a), '이', '가')} 빠져나왔다`, '#cfe8d2');
      break;
    case 'jail': {
      const c = w.cells[e.c]; at(c.x, c.z, 45, sfx.clang);
      if (e.a === myId) { say(`${prisonName()}에 갇혔다. 2분 안에 동료가 구하러 와야 해…`, '#ff6a6a', 6); sfx.clang(); }
      else say(`${josa(nameOf(e.a), '이', '가')} ${prisonName()}에 갇혔다 (2분 뒤 썩는다)`, '#e07070', 5);
      break;
    }
    case 'rescue':
      sfx.chime();
      if (e.ids.includes(myId)) say(`${josa(nameOf(e.by), '이', '가')} 감옥 문을 열었다! 도망쳐!`, '#cfe8d2', 5);
      else say(`${josa(nameOf(e.by), '이', '가')} 감옥에서 ${e.ids.map(nameOf).join(', ')}${e.ids.length ? '을(를)' : ''} 구했다`, '#cfe8d2');
      break;
    case 'rot':
      sfx.squelch(); fx.glitch = .7;
      if (e.a === myId) say('당신은 썩어 문드러져 성 위에 걸렸다.', '#b42121', 7);
      else say(`${josa(nameOf(e.a), '이', '가')} 썩어 문드러져 성 위에 걸렸다`, '#b42121', 5);
      break;
    case 'trace': {
      const tr = w.traces[e.i], n = g.tr.reduce((a, b) => a + b, 0);
      sfx.bell(); at(tr.x, tr.z, 30, sfx.whisper);
      say(`${tr.suit} ${josa(nameOf(e.by), '이', '가')} ${josa(tr.name, '을', '를')} 찾았다 (${n}/5)`, tr.color === '#b49b2e' ? '#e0c860' : tr.color === '#4a64c8' ? '#9fb0ff' : tr.color === '#3e8a4c' ? '#8fd29a' : '#ff7a7a', 5);
      break;
    }
    case 'door':
      sfx.choir(); fx.glitch = .6;
      say(g.role === 'dream' ? '하늘에 문이 열렸다. 앨리스들이 빠져나가려 한다!' : '하늘에 문이 열렸다! 빛기둥으로 달려가!', '#ffffff', 7);
      break;
    case 'esc':
      sfx.chime();
      say(e.a === myId ? '꿈에서 빠져나왔다.' : `${josa(nameOf(e.a), '이', '가')} 꿈에서 빠져나갔다`, '#ffffff', 5);
      break;
    case 'mb': { const tr = w.traces[e.i]; at(tr.x, tr.z, 45, () => sfx.music((now * 3 | 0) % 5)); break; }
  }
}

function onEnd(m) {
  const g = game; g.ended = { ...m, t: performance.now() };
  if (document.pointerLockElement) document.exitPointerLock();
  $('endBox').hidden = false;
  const iWin = (m.win === 'alice') === (g.role === 'alice');
  if (iWin) sfx.choir(); else sfx.growl();
}

/* =========================================================
   지도
   ========================================================= */
function buildMap(w) {
  const c = document.createElement('canvas'); c.width = w.N; c.height = w.N;
  const x = c.getContext('2d'), id = x.createImageData(w.N, w.N);
  const cols = [[44, 52, 36], [150, 30, 30], [110, 110, 104], [110, 80, 50], [70, 84, 52], [120, 50, 70], [110, 30, 46], [150, 132, 70], [40, 38, 50]];
  for (let i = 0; i < w.N * w.N; i++) {
    let col = cols[w.ground[i]];
    if (w.wall[i]) col = w.wall[i] === WL.BARS ? [160, 160, 160] : w.wall[i] === WL.CURTAIN ? [70, 70, 160] : w.wall[i] === WL.YPAPER ? [230, 214, 140] : w.wall[i] === WL.VELVET ? [160, 40, 60] : [190, 190, 180];
    id.data[i * 4] = col[0]; id.data[i * 4 + 1] = col[1]; id.data[i * 4 + 2] = col[2]; id.data[i * 4 + 3] = 255;
  }
  for (const t of w.trees) { const i = ((t.z | 0) * w.N + (t.x | 0)) * 4; if (t.seat) { id.data[i] = 80; id.data[i + 1] = 20; id.data[i + 2] = 30; } else { id.data[i] = 20; id.data[i + 1] = 30; id.data[i + 2] = 18; } }
  x.putImageData(id, 0, 0);
  return c;
}
const ENTRANCES = [{ x: 40, z: 49.2 }, { x: 30.8, z: 43 }, { x: 49.2, z: 37.5 }];
const prisonName = () => { const m = game && game.world.map; return m === 'theater' ? '무대 아래 감옥' : m === 'tea' ? '긴 식탁 방' : '성 감옥'; };
// 감옥 문까지의 걸음 수 (벽을 돌아가는 길 찾기용)
function cellField(w) {
  const N = w.N, d = new Int16Array(N * N).fill(-1), q = [];
  for (const c of w.cells) { const k = (c.door.z | 0) * N + (c.door.x | 0); d[k] = 0; q.push(k); }
  for (let h = 0; h < q.length; h++) { const k = q[h], x = k % N, z = (k / N) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue; const nk = nz * N + nx; if (d[nk] >= 0 || w.wall[nk]) continue; d[nk] = d[k] + 1; q.push(nk); } }
  return d;
}
function prisonTarget(w, x, z) {
  if (w.map !== 'forest' && game && game.pdist) {
    const N = w.N, D = game.pdist; let cx = x | 0, cz = z | 0;
    const here = D[cz * N + cx]; if (here < 0) { let best = w.cells[0]; return { x: best.door.x, z: best.door.z, dist: Math.hypot(x - best.door.x, z - best.door.z) }; }
    for (let s = 0; s < 4; s++) { let bk = -1, bv = D[cz * N + cx]; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue; const v = D[nz * N + nx]; if (v >= 0 && v < bv) { bv = v; bk = nz * N + nx; } } if (bk < 0) break; cx = bk % N; cz = (bk / N) | 0; }
    return { x: cx + .5, z: cz + .5, dist: here };
  }
  const inCastle = x > 31 && x < 49 && z > 31 && z < 49;
  let cell = w.cells[0], cd = 1e9;
  for (const c of w.cells) { const d = Math.hypot(x - c.door.x, z - c.door.z); if (d < cd) { cd = d; cell = c; } }
  if (inCastle) return { x: cell.door.x, z: cell.door.z, dist: cd };
  let best = ENTRANCES[0], bs = 1e9;
  for (const e of ENTRANCES) { const s = Math.hypot(x - e.x, z - e.z) + Math.hypot(e.x - cell.door.x, e.z - cell.door.z); if (s < bs) { bs = s; best = e; } }
  return { x: best.x, z: best.z, dist: bs };
}
function mapMarkers(g, ox, oy, k, big) {
  const c = ctx, tnow = performance.now();
  c.fillStyle = 'rgba(255,90,90,.95)';
  for (const cl of g.world.cells) c.fillRect(ox + cl.x * k - (big ? 3 : 1.5), oy + cl.z * k - (big ? 2 : 1), big ? 6 : 3, big ? 4 : 2);
  if (g.role === 'alice') {
    c.font = `10px 'Nanum Gothic Coding', monospace`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    for (const p of g.players.values()) {
      if (p.role !== 'alice' || p.id === myId || !p.cur || p.cur.s === 4) continue;
      const ip = interp(p) || p.cur, s = p.cur.s;
      const col = s === 0 ? '#9fe0ff' : s === 3 ? '#777' : '#ff6060';
      const px = ox + ip.x * k, py = oy + ip.z * k;
      c.fillStyle = '#000'; c.beginPath(); c.arc(px, py, big ? 4.5 : 2.6, 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(px, py, big ? 3.2 : 1.8, 0, 7); c.fill();
      if (big) { c.fillStyle = '#000'; c.fillText(p.name, px + 1, py - 6); c.fillStyle = col; c.fillText(p.name, px, py - 7); }
    }
  } else if (g.reveal) {
    const age = (tnow - g.reveal.t) / 1000;
    if (age < CFG.REVEAL_SHOW) {
      const a = 1 - age / CFG.REVEAL_SHOW, pr = (big ? 6 : 3.5) + Math.sin(now * 8) * (big ? 2 : 1);
      for (const pt of g.reveal.pts) {
        const px = ox + pt.x * k, py = oy + pt.z * k;
        c.globalAlpha = a; c.strokeStyle = '#ff3030'; c.lineWidth = big ? 2 : 1.2;
        c.beginPath(); c.arc(px, py, pr, 0, 7); c.stroke();
        c.fillStyle = '#ff5050'; c.beginPath(); c.arc(px, py, big ? 2.5 : 1.4, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
    }
  }
}
function drawMinimap(g) {
  const S = 76, ox = 8, oy = 32, k = S / g.world.N, c = ctx, cam = g.cam;
  c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(ox - 2, oy - 2, S + 4, S + 4);
  c.imageSmoothingEnabled = false; c.globalAlpha = .75; c.drawImage(g.mapImg, ox, oy, S, S); c.globalAlpha = 1;
  if (g.fogImg) c.drawImage(g.fogImg, ox, oy, S, S);
  g.world.traces.forEach((t, i) => { if (g.tr[i] || (g.seen && !g.seen[(t.z | 0) * g.world.N + (t.x | 0)])) return; c.fillStyle = t.color === '#4a64c8' ? '#8095ff' : t.color; c.fillRect(ox + t.x * k - 1.5, oy + t.z * k - 1.5, 3, 3); });
  if (g.door) { c.fillStyle = '#fff'; c.beginPath(); c.arc(ox + g.door.x * k, oy + g.door.z * k, 2.5 + Math.sin(now * 5), 0, 7); c.fill(); }
  mapMarkers(g, ox, oy, k, false);
  c.save(); c.translate(ox + cam.x * k, oy + cam.z * k); c.rotate(cam.yaw);
  c.fillStyle = g.role === 'dream' ? '#ff5050' : '#ffffff';
  c.beginPath(); c.moveTo(4.5, 0); c.lineTo(-3, -3); c.lineTo(-1.5, 0); c.lineTo(-3, 3); c.closePath(); c.fill(); c.restore();
  c.strokeStyle = 'rgba(220,210,200,.35)'; c.lineWidth = 1; c.strokeRect(ox - 1.5, oy - 1.5, S + 3, S + 3);
  if (g.role === 'dream' && !(g.intro > 0)) {
    const left = CFG.REVEAL_EVERY - ((CFG.GAME_TIME - g.T) % CFG.REVEAL_EVERY);
    c.font = `10px 'Nanum Gothic Coding', monospace`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const txt = `감지까지 ${Math.ceil(left)}초`;
    c.fillStyle = '#000'; c.fillText(txt, ox + 1, oy + S + 13); c.fillStyle = left < 4 ? '#ff6060' : '#c8a0a0'; c.fillText(txt, ox, oy + S + 12);
  }
}
function drawMap(g, cam) {
  const S = 230, ox = (W - S) / 2, oy = (H - S) / 2 + 6, k = S / g.world.N;
  ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1b1612'; ctx.fillRect(ox - 6, oy - 6, S + 12, S + 12);
  ctx.imageSmoothingEnabled = false; ctx.globalAlpha = .9; ctx.drawImage(g.mapImg, ox, oy, S, S); ctx.globalAlpha = 1;
  if (g.fogImg) ctx.drawImage(g.fogImg, ox, oy, S, S);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold 13px 'Nanum Myeongjo', serif`;
  g.world.traces.forEach((t, i) => {
    if (g.seen && !g.tr[i] && !g.seen[(t.z | 0) * g.world.N + (t.x | 0)]) return;
    ctx.fillStyle = g.tr[i] ? 'rgba(255,255,255,.3)' : t.color;
    ctx.fillText(t.suit, ox + t.x * k, oy + t.z * k);
  });
  ctx.fillStyle = '#e0d8c8'; ctx.font = `10px 'Nanum Gothic Coding', monospace`;
  for (const L of g.world.labels || []) ctx.fillText(L.t, ox + L.x * k, oy + L.z * k);
  if (g.door) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ox + g.door.x * k, oy + g.door.z * k, 5 + Math.sin(now * 5) * 1.5, 0, 7); ctx.fill(); ctx.fillText('문', ox + g.door.x * k, oy + g.door.z * k - 11); }
  mapMarkers(g, ox, oy, k, true);
  ctx.textBaseline = 'middle';
  ctx.save(); ctx.translate(ox + cam.x * k, oy + cam.z * k); ctx.rotate(cam.yaw);
  ctx.fillStyle = g.role === 'dream' ? '#ff5050' : '#ffffff';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-2, 0); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#cfc6b6'; ctx.font = `12px 'Nanum Myeongjo', serif`; ctx.textAlign = 'center';
  ctx.fillText(g.role === 'dream' ? `꿈의 지도 — ${CFG.REVEAL_EVERY}초마다 앨리스가 드러난다` : g.seen ? '가 본 곳만 보인다 — 파란 점: 동료, 빨간 점: 잡힌 동료' : '망가진 꿈의 지도 — 파란 점: 동료, 빨간 점: 잡힌 동료', W / 2, oy - 14);
  ctx.font = `10px 'Nanum Gothic Coding', monospace`; ctx.fillStyle = '#8d8478';
  ctx.fillText(device === 'phone' ? '지도 버튼으로 닫기' : 'M 으로 닫기', W / 2, oy + S + 14);
}

/* =========================================================
   매 프레임
   ========================================================= */
function revealFog(g) {
  if (!g.seen) return;
  const w = g.world, N = w.N, cx = g.cam.x, cz = g.cam.z, fc = g.fogImg.getContext('2d');
  for (let a = 0; a < 32; a++) {
    const ang = a / 32 * Math.PI * 2, dx = Math.cos(ang), dz = Math.sin(ang);
    for (let r = 0; r < 7; r += .5) {
      const x = (cx + dx * r) | 0, z = (cz + dz * r) | 0; if (x < 0 || z < 0 || x >= N || z >= N) break;
      const k = z * N + x;
      if (!g.seen[k]) { g.seen[k] = 1; fc.clearRect(x, z, 1, 1); }
      if (w.wall[k]) break;
    }
  }
}
function update(dt) {
  const g = game;
  revealFog(g);
  // 시점 회전 (방향키)
  if (!chatOpen) { if (keys.arrowleft) g.yaw -= 2.4 * dt; if (keys.arrowright) g.yaw += 2.4 * dt; }
  // 입력을 30Hz로 쪼개어 예측 이동 + 서버 전송
  g.acc += dt; let n = 0;
  while (g.acc >= CFG.INPUT_DT && n < 6) {
    g.acc -= CFG.INPUT_DT; n++;
    const c = readControls();
    const inp = { q: ++g.seq, f: r2(c.f), s: r2(c.s), y: Math.round(g.yaw * 1000) / 1000, a: c.act ? 1 : 0, d: c.dash ? 1 : 0 };
    if (c.dash && g.role === 'dream' && g.pred.st === 0 && g.pred.dc <= 0 && !g.pred.carry && !(g.intro > 0)) sfx.dash();
    if (g.pred.st === 0 && !(g.intro > 0) && !g.ended) stepPlayer(g.world, g.pred, inp, CFG.INPUT_DT);
    g.pending.push(inp); g.outbox.push(inp);
    if (g.pending.length > 90) g.pending.shift();
  }
  if (g.acc > .2) g.acc = 0;
  if (g.outbox.length >= 2) { send({ type: 'in', l: g.outbox }); g.outbox = []; }
  g.smooth.x *= Math.exp(-dt * 12); g.smooth.z *= Math.exp(-dt * 12);

  // 카메라
  const ms = g.meS;
  if (g.spectate) {
    const tp = g.spectating && g.players.get(g.spectating), ip = tp && interp(tp);
    if (ip) g.cam = { x: ip.x, z: ip.z, yaw: ip.y, bob: 0 };
  } else if (!ms || ms.s === 0) {
    if (g.pred.m) { g.phase += dt * 9; } g.bob = Math.sin(g.phase) * 2 * (g.pred.m ? 1 : 0);
    g.cam = { x: g.pred.x + g.smooth.x, z: g.pred.z + g.smooth.z, yaw: g.yaw, bob: g.bob };
    if (g.pred.m && !(g.intro > 0)) { g.stepT -= dt; if (g.stepT <= 0) { g.stepT = g.role === 'dream' ? .5 : .38; sfx.step(g.role === 'dream' ? 1.3 : .8); } }
  } else {
    const ip = interp(g.me) || { x: g.pred.x, z: g.pred.z };
    g.cam = { x: ip.x, z: ip.z, yaw: g.yaw, bob: ms.s === 1 ? Math.sin(now * 14) * 3 : 0 };
  }

  // 근접 공포: 꿈이 가까이 오면 앨리스에게 무서운 소리
  let nd = 99, ndp = null;
  if (g.role === 'alice' && !g.spectate) {
    for (const p of g.players.values()) {
      if (p.role !== 'dream' || !p.cur || p.cur.o === 0) continue;
      const ip = interp(p); if (!ip) continue;
      const d = Math.hypot(ip.x - g.cam.x, ip.z - g.cam.z);
      if (d < nd) { nd = d; ndp = ip; }
    }
  }
  g.nearDream = nd;
  const terror = clamp(1 - (nd - 2) / 14, 0, 1);
  g.terror = terror;
  {
    const pres = clamp(1 - (nd - 1.5) / 10.5, 0, 1);
    let pv = 0;
    if (ndp) { let rel = Math.atan2(ndp.z - g.cam.z, ndp.x - g.cam.x) - g.cam.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel)); pv = Math.sin(rel) * .85; }
    presence(g.ended || g.intro > 0 || !(ms && (ms.s === 0 || ms.s === 1)) ? 0 : pres, pv);
  }
  fx.noise = .09 + terror * .22 * (chicken ? .3 : 1);
  fx.wobble = .5 + terror * 2 * (chicken ? .3 : 1);
  if (A.ctx && !g.ended) {
    if (g.role === 'alice') drone(.05 + terror * .22, 1 + terror * .5, .8);
    if (terror > 0 && !(g.intro > 0)) {
      g.heartT -= dt;
      if (g.heartT <= 0) { g.heartT = lerp(1.3, .34, terror); sfx.heart(.25 + terror * .6); }
    }
    g.terrorCd -= dt;
    if (nd < 8.5 && g.terrorCd <= 0 && !(g.intro > 0) && ms && ms.s === 0) {
      g.terrorCd = nd < 4 ? 5 + Math.random() * 3 : 8 + Math.random() * 4;
      const pick = nd < 4 ? [sfx.shriek, sfx.screech, sfx.ear][Math.random() * 3 | 0] : [sfx.screech, sfx.growl, sfx.reverse, sfx.ear, () => sfx.whisper(2)][Math.random() * 5 | 0];
      pick(); fx.glitch = chicken ? .3 : 1.2;
      say(chicken ? '…뭔가 귀여운 게 가까이 있다' : ['무언가 가까이 있다.', '뒤에서 숨소리가 들린다.', '도망쳐.', '찾았다.'][Math.random() * 4 | 0], '#ff8080', 2.5);
    }
    // 다른 플레이어 발소리
    for (const p of g.players.values()) {
      if (p.id === myId || !p.cur || p.cur.s !== 0 || !p.cur.m) continue;
      const ip = interp(p); if (!ip) continue;
      const tm = (g.stepTimers.get(p.id) || 0) - dt;
      if (tm <= 0) {
        g.stepTimers.set(p.id, p.role === 'dream' ? .55 : .4);
        if (p.role === 'dream') at(ip.x, ip.z, 15, sfx.thud);
        else at(ip.x, ip.z, g.role === 'dream' ? 11 : 7, () => sfx.step(1.6));
      } else g.stepTimers.set(p.id, tm);
    }
  }
  if (!(g.intro > 0) && !g.ended) {
    const n = Math.floor((CFG.GAME_TIME - g.T) / CFG.REVEAL_EVERY);
    if (n > g.revealN) {
      g.revealN = n;
      if (g.role === 'dream') {
        g.reveal = { t: performance.now(), pts: [...g.players.values()].filter(p => p.role === 'alice' && p.cur && (p.cur.s === 0 || p.cur.s === 1)).map(p => { const ip = interp(p) || p.cur; return { x: ip.x, z: ip.z }; }) };
        sfx.whisper(1.2); say('앨리스들의 위치가 드러났다 — 지도를 봐라', '#ff8080', 4);
      } else if (!g.spectate) { sfx.whisper(1.2); say('꿈이 앨리스들의 위치를 느꼈다…', '#ff8080', 3); }
    }
  }
  fx.glitch = Math.max(0, fx.glitch - dt * 1.4);
}

const vib = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };
// 잡히는 순간의 점프스케어 (잡힌 앨리스 화면에만)
function jumpscare() {
  if (!game) return;
  game.scare = { t: performance.now(), dur: chicken ? 1.1 : 1.35 };
  if (chicken) { sfx.boing(); sfx.chime(); vib(60); return; }
  A.pv = 1.6; try { sfx.shriek(); sfx.screech(); } finally { A.pv = 1; }
  vib([260, 60, 340]); fx.glitch = 2.2;
}
function scareFace(c, cx, cy, s, t) {
  c.save(); c.translate(cx, cy); c.scale(s, s);
  const e = (x, y, rx, ry, col) => { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2); c.fillStyle = col; c.fill(); };
  const j = () => (Math.random() - .5) * 4;
  const gr = c.createRadialGradient(0, -10, 10, 0, 0, 100);
  gr.addColorStop(0, '#d9d3c4'); gr.addColorStop(.7, '#a39d8e'); gr.addColorStop(1, '#3b3833');
  c.beginPath(); c.ellipse(0, 0, 68, 96, 0, 0, Math.PI * 2); c.fillStyle = gr; c.fill();
  e(-30, 30, 16, 22, 'rgba(60,50,45,.35)'); e(30, 30, 16, 22, 'rgba(60,50,45,.35)');
  e(-27 + j(), -20, 20 + Math.random() * 3, 26, '#050404'); e(27 + j(), -20, 20 + Math.random() * 3, 26, '#050404');
  e(-27 + j(), -17, 2.4, 2.4, '#fff'); e(27 + j(), -17, 2.4, 2.4, '#fff');
  const mh = 38 + Math.sin(t * 40) * 7;
  e(0, 52, 23, mh, '#060303');
  c.fillStyle = '#ddd5c0';
  for (let i = -3; i <= 3; i++) { c.fillRect(i * 5 - 2, 52 - mh + 4 + Math.abs(i) * 2, 4, 7); c.fillRect(i * 5 - 2, 52 + mh - 11 - Math.abs(i) * 2, 4, 7); }
  c.strokeStyle = 'rgba(110,10,10,.8)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-27, 4); c.lineTo(-29, 30); c.lineTo(-25, 62); c.moveTo(27, 4); c.lineTo(30, 34); c.lineTo(28, 70); c.stroke();
  for (let i = 0; i < 9; i++) e(Math.sin(i * 7.1) * 45, Math.cos(i * 3.3) * 60, 8 + i % 3 * 5, 6 + i % 4 * 3, 'rgba(30,22,10,.75)');
  c.restore();
}
function scareGhost(c, x, y, r) {
  const e = (x, y, rx, ry, col) => { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2); c.fillStyle = col; c.fill(); };
  c.beginPath(); c.arc(x, y, r, Math.PI, 0); c.lineTo(x + r, y + r * 1.1);
  for (let i = 0; i < 4; i++) { const x1 = x + r - (i + .5) * r / 2, x2 = x + r - (i + 1) * r / 2; c.quadraticCurveTo(x1, y + r * 1.45, x2, y + r * 1.1); }
  c.closePath(); c.fillStyle = '#f6f3ff'; c.fill(); c.strokeStyle = '#c9c0e8'; c.lineWidth = r * .06; c.stroke();
  e(x - r * .35, y - r * .05, r * .11, r * .15, '#2a2233'); e(x + r * .35, y - r * .05, r * .11, r * .15, '#2a2233');
  e(x - r * .58, y + r * .2, r * .16, r * .09, 'rgba(255,130,170,.75)'); e(x + r * .58, y + r * .2, r * .16, r * .09, 'rgba(255,130,170,.75)');
  e(x, y + r * .32, r * .12, r * .16, '#2a2233');
}
function drawScare(c, g) {
  const sc = g.scare; if (!sc) return;
  const t = (performance.now() - sc.t) / 1000;
  if (t > sc.dur) { g.scare = null; return; }
  const sx = (Math.random() - .5) * (chicken ? 4 : 18), sy = (Math.random() - .5) * (chicken ? 4 : 18);
  c.save(); c.translate(sx, sy);
  if (chicken) {
    c.fillStyle = '#ffd9e6'; c.fillRect(-20, -20, W + 40, H + 40);
    scareGhost(c, W / 2, H / 2 + 14, 70 * (1 + t * .3 + Math.sin(t * 14) * .04));
    c.font = `800 30px 'Nanum Myeongjo', serif`; c.textAlign = 'center'; c.fillStyle = '#ff5c8a'; c.fillText('잡았다!', W / 2, 62);
  } else {
    const inv = (t * 14 | 0) % 5 === 0;
    c.fillStyle = inv ? '#d8d0c0' : '#120101'; c.fillRect(-20, -20, W + 40, H + 40);
    scareFace(c, W / 2 + (Math.random() - .5) * 10, H / 2 + 26, 1.25 + t * 1.1, now);
    c.fillStyle = `rgba(150,0,0,${.18 + Math.random() * .2})`; c.fillRect(-20, -20, W + 40, H + 40);
    if (t > .35) { c.font = `800 26px 'Nanum Myeongjo', serif`; c.textAlign = 'center'; c.fillStyle = '#000'; c.fillText('찾  았  다', W / 2 + 2, 52); c.fillStyle = '#e02020'; c.fillText('찾  았  다', W / 2, 50); }
  }
  c.restore();
}
// 역할 브리핑 카드: 시작할 때 + 언제든 Tab / ? 버튼
function keycap(c, x, y, label, w = 0) {
  c.font = `11px 'Nanum Gothic Coding', monospace`;
  const tw = Math.max(w, c.measureText(label).width + 10), h = 15;
  c.fillStyle = 'rgba(230,222,206,.12)'; c.fillRect(x, y - 11, tw, h);
  c.strokeStyle = 'rgba(230,222,206,.55)'; c.lineWidth = 1; c.strokeRect(x + .5, y - 10.5, tw - 1, h - 1);
  c.fillStyle = '#efe6d4'; c.textAlign = 'center'; c.fillText(label, x + tw / 2, y);
  return tw;
}
function drawBrief(c, g, alpha, count) {
  const dream = g.role === 'dream', phone = device === 'phone';
  c.save(); c.globalAlpha = alpha;
  c.fillStyle = 'rgba(4,3,4,.9)'; c.fillRect(0, 0, W, H);
  c.strokeStyle = dream ? 'rgba(200,60,60,.6)' : 'rgba(220,210,190,.4)'; c.lineWidth = 1; c.strokeRect(14.5, 14.5, W - 29, H - 29);
  c.textBaseline = 'alphabetic'; c.textAlign = 'center';
  const sh = (s, x, y, col, font, al = 'center') => { c.font = font; c.textAlign = al; c.fillStyle = 'rgba(0,0,0,.85)'; c.fillText(s, x + 1, y + 1); c.fillStyle = col; c.fillText(s, x, y); };
  const KR = `12px 'Nanum Gothic Coding', monospace`, KRS = `11px 'Nanum Gothic Coding', monospace`;
  sh(dream ? '당신은  작은 꿈' : '당신은  다섯 번째 앨리스', W / 2, 44, dream ? '#ff7070' : '#f0e8d8', `800 20px 'Nanum Myeongjo', serif`);
  sh('─  목 표  ─', W / 2, 68, '#8d8478', KRS);
  const goals = dream
    ? [`앨리스에게 다가가 잡고, ${prisonName()}까지 끌고 가 가두세요.`, '갇힌 지 2분이 지나면 앨리스는 썩어 전시대에 걸립니다.', '13분을 버티거나 앨리스를 모두 잡으면 승리.']
    : [`${g.world.map === 'theater' ? '극장' : g.world.map === 'tea' ? '노란 방들' : '숲'} 곳곳에 흩어진 이전 앨리스들의 흔적 5개를 찾으세요.`, '다 모으면 하늘에 빛기둥 문이 열립니다 → 그리로 탈출!', '잡히면 연타로 몸부림 · 갇힌 동료는 감옥 문에서 구출.'];
  goals.forEach((l, i) => sh(l, W / 2, 86 + i * 16, '#d8cfbf', KR));
  sh('─  조 작  ─', W / 2, 146, '#8d8478', KRS);
  const rows = phone
    ? (dream
      ? [[['왼쪽 원'], '이동'], [['화면 끌기'], '둘러보기'], [['잡기'], '잡기 · 감옥에 가두기'], [['대시'], `순간 돌진 (${CFG.DASH_CD}초마다)`], [['지도'], '지도 열기']]
      : [[['왼쪽 원'], '이동'], [['화면 끌기'], '둘러보기'], [['행동'], '꾹 눌러 흔적 줍기 · 동료 구출'], [['행동'], '잡혔을 때 연타로 몸부림'], [['지도'], '지도 열기']])
    : (dream
      ? [[['W', 'A', 'S', 'D'], '이동'], [['마우스'], '둘러보기 (화면 클릭)'], [['E'], '잡기 · 감옥에 가두기'], [['Shift'], `순간 돌진 (${CFG.DASH_CD}초마다)`], [['M'], '지도'], [['B'], '밝기'], [['Enter'], '채팅']]
      : [[['W', 'A', 'S', 'D'], '이동'], [['마우스'], '둘러보기 (화면 클릭)'], [['E'], '꾹 눌러 흔적 줍기 · 동료 구출'], [['E'], '잡혔을 때 연타로 몸부림'], [['M'], '지도'], [['Enter'], '채팅']]);
  let y = 166;
  for (const [ks, desc] of rows) {
    let x = 92;
    for (const k of ks) x += keycap(c, x, y, k, 15) + 3;
    sh(desc, 200, y, '#cfc6b6', KR, 'left');
    y += 17;
  }
  sh(phone ? '왼쪽 위 [?] 버튼으로 언제든 다시 볼 수 있어요' : 'Tab 키로 언제든 다시 볼 수 있어요', W / 2, H - 26, '#7a7268', KRS);
  if (count > 0) sh(`${Math.ceil(count)}`, W - 34, 46, '#ffffff', `28px 'VT323', monospace`);
  c.restore();
}
function drawHud(g, tags) {
  const c = ctx, ms = g.meS, dream = g.role === 'dream', tnow = performance.now();
  c.textBaseline = 'alphabetic';
  const sh = (s, x, y, col, font, al = 'left') => { c.font = font; c.textAlign = al; c.fillStyle = 'rgba(0,0,0,.85)'; c.fillText(s, x + 1, y + 1); c.fillStyle = col; c.fillText(s, x, y); };
  const OSD = `20px 'VT323', monospace`, KR = `12px 'Nanum Gothic Coding', monospace`, KRS = `11px 'Nanum Gothic Coding', monospace`;
  // 꿈이 가까우면 화면 가장자리가 심장 박동에 맞춰 붉게 조여든다
  if (!chicken && !dream && g.terror > .35 && !g.ended) {
    const k = (g.terror - .35) / .65, beat = .55 + .45 * Math.pow(Math.max(0, Math.sin(now * (4 + k * 6))), 6);
    const rg = c.createRadialGradient(W / 2, H / 2, H * (.62 - k * .25), W / 2, H / 2, H * .9);
    rg.addColorStop(0, 'rgba(120,0,0,0)'); rg.addColorStop(1, `rgba(120,0,0,${(.25 + k * .5) * beat})`);
    c.fillStyle = rg; c.fillRect(0, 0, W, H);
  }
  // 이름표
  c.font = KRS; c.textAlign = 'center';
  for (const t of tags) { c.globalAlpha = clamp(t.a * 1.4, 0, 1); c.fillStyle = '#000'; c.fillText(t.name, t.x + 1, t.y + 1); c.fillStyle = '#e8e0d0'; c.fillText(t.name, t.x, t.y); }
  c.globalAlpha = 1;
  // OSD
  if (dream) { sh('REC', 14, 26, '#f2f2ee', OSD); if ((now * 2 | 0) % 2) { c.fillStyle = '#e02020'; c.beginPath(); c.arc(56, 19, 4, 0, 7); c.fill(); } }
  else sh('PLAY ▶', 14, 26, '#f2f2ee', OSD);
  sh(fmtTime(g.T), W - 14, 26, g.T < 60 ? '#ff5a5a' : '#f2f2ee', OSD, 'right');
  sh(`${Math.round(rtt)}ms`, W - 14, H - 12, '#9a9488', `16px 'VT323', monospace`, 'right');
  if (!g.mapOn && !g.ended) drawMinimap(g);
  // 흔적
  c.font = `bold 15px 'Nanum Myeongjo', serif`; c.textAlign = 'center';
  g.world.traces.forEach((t, i) => {
    const x = W / 2 + (i - 2) * 20, y = 24;
    c.fillStyle = '#000'; c.fillText(t.suit, x + 1, y + 1);
    c.fillStyle = g.tr[i] ? t.color === '#4a64c8' ? '#8095ff' : t.color : '#3a3532'; c.fillText(t.suit, x, y);
    if (!g.tr[i] && g.tp[i] > 0) { c.fillStyle = '#e8e0d0'; c.fillRect(x - 7, y + 4, 14 * g.tp[i] / t.dur, 2); }
  });
  // 채팅
  c.font = KRS; c.textAlign = 'left';
  let cy = H - 30;
  for (let i = g.chat.length - 1; i >= 0 && cy > H - 110; i--) {
    const m = g.chat[i], age = (tnow - m.t) / 1000; if (age > 12 && !chatOpen) continue;
    c.globalAlpha = chatOpen ? 1 : clamp(1 - (age - 9) / 3, 0, 1);
    const s = m.sys ? m.text : `${m.name}${m.dream ? '(꿈)' : ''}: ${m.text}`;
    c.fillStyle = 'rgba(0,0,0,.8)'; c.fillText(s, 15, cy + 1); c.fillStyle = m.sys ? '#9a9080' : m.dream ? '#f0a0a0' : '#e8e0d0'; c.fillText(s, 14, cy);
    cy -= 13;
  }
  c.globalAlpha = 1;
  // 이벤트 문구
  let my = 66;
  for (const m of g.msgs) {
    const age = (tnow - m.t) / 1000; if (age > m.dur) continue;
    c.globalAlpha = clamp((m.dur - age) * 1.5, 0, 1);
    sh(m.text, W / 2, my, m.color, KR, 'center'); my += 16;
  }
  c.globalAlpha = 1;
  // 상황별 안내
  const P = g.pred, w = g.world, actKey = device === 'phone' ? '행동' : 'E';
  const bar = (x, y, wd, v, col) => { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - wd / 2 - 1, y - 1, wd + 2, 6); c.fillStyle = col; c.fillRect(x - wd / 2, y, wd * clamp(v, 0, 1), 4); };
  let prompt = '', pv = -1, pcol = '#e8e0d0';
  if (g.spectate) {
    prompt = `${ms && ms.s === 4 ? '탈출했다' : '성 위에 걸린 채'} — ${g.spectating ? nameOf(g.spectating) + ' 관전 중' : '관전 중'} (${device === 'phone' ? '화면 탭' : '클릭'}: 다음 사람)`;
  } else if (ms && ms.s === 1) {
    prompt = `몸부림쳐라! ${actKey} 연타`; pv = ms.sg; pcol = '#ff6a6a';
  } else if (ms && ms.s === 2) {
    const left = CFG.ROT_TIME - ms.jt;
    sh(`썩기까지 ${fmtTime(left)}`, W / 2, H / 2 + 6, left < 30 ? '#ff4040' : '#e8a0a0', `26px 'VT323', monospace`, 'center');
    prompt = '갇혔다. 동료가 감옥 문 앞에서 구해줘야 한다.'; pv = g.rp[ms.cl] / CFG.RESCUE_TIME;
  } else if (!dream) {
    let best = null;
    w.cells.forEach((cl, i) => { if (!best && Math.hypot(P.x - cl.door.x, P.z - cl.door.z) < CFG.CHANNEL_RANGE && [...g.players.values()].some(p => p.cur && p.cur.s === 2 && p.cur.cl === i)) best = { t: `${actKey} 꾹 — 감옥 문 열기`, v: g.rp[i] / CFG.RESCUE_TIME }; });
    if (!best) w.traces.forEach((t, i) => { if (!best && !g.tr[i] && Math.hypot(P.x - t.x, P.z - t.z) < CFG.CHANNEL_RANGE) best = { t: `${actKey} 꾹 — ${t.suit} ${t.name}`, v: g.tp[i] / t.dur }; });
    if (best) { prompt = best.t; pv = best.v; }
    else if (g.door) prompt = '하늘의 빛기둥으로 가면 탈출!';
    if (g.door) { // 문 방향 표시
      let rel = Math.atan2(g.door.z - g.cam.z, g.door.x - g.cam.x) - g.cam.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const ax = W / 2 + clamp(rel / .9, -1, 1) * (W / 2 - 20);
      c.fillStyle = `rgba(255,255,255,${.5 + .3 * Math.sin(now * 4)})`; c.beginPath(); c.moveTo(ax, 34); c.lineTo(ax - 5, 42); c.lineTo(ax + 5, 42); c.closePath(); c.fill();
    }
  } else {
    if (P.sn > 0) { prompt = '앨리스가 빠져나갔다… 움직일 수 없다'; pcol = '#ff8080'; }
    else if (P.carry) {
      const nearCell = w.cells.some(cl => Math.hypot(P.x - cl.door.x, P.z - cl.door.z) <= CFG.DEPOSIT_RANGE);
      prompt = nearCell ? `${actKey} — 감옥에 가두기` : `앨리스를 ${prisonName()}까지 끌고 가라`;
      pcol = nearCell ? '#ff8080' : '#e8e0d0';
      if (!nearCell) {
        const tg = prisonTarget(w, P.x, P.z);
        let rel = Math.atan2(tg.z - g.cam.z, tg.x - g.cam.x) - g.cam.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        c.save(); c.translate(W / 2, 92); c.rotate(rel);
        c.globalAlpha = .75 + .25 * Math.sin(now * 5);
        c.fillStyle = 'rgba(0,0,0,.7)'; c.beginPath(); c.moveTo(0, -20); c.lineTo(-13, 6); c.lineTo(-4, 2); c.lineTo(-4, 16); c.lineTo(4, 16); c.lineTo(4, 2); c.lineTo(13, 6); c.closePath(); c.fill();
        c.fillStyle = '#ff4040'; c.beginPath(); c.moveTo(0, -17); c.lineTo(-10, 4); c.lineTo(-3, 1); c.lineTo(-3, 13); c.lineTo(3, 13); c.lineTo(3, 1); c.lineTo(10, 4); c.closePath(); c.fill();
        c.restore(); c.globalAlpha = 1;
        sh(`감옥까지 ${Math.round(tg.dist)}m`, W / 2, 124, '#ff9090', KRS, 'center');
      }
    } else {
      let canCatch = false;
      for (const p of g.players.values()) { if (p.role !== 'alice' || !p.cur || p.cur.s !== 0 || p.cur.im) continue; const ip = interp(p); if (ip && Math.hypot(ip.x - P.x, ip.z - P.z) < CFG.CATCH_RANGE) canCatch = true; }
      prompt = canCatch ? `${actKey} — 잡아라!` : `${actKey}: 잡기 · ${device === 'phone' ? '대시' : 'Shift'}: 대시`;
      pcol = canCatch ? '#ff6060' : '#a89e90';
    }
    // 대시 쿨타임
    const cd = P.dc / CFG.DASH_CD;
    c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 4; c.beginPath(); c.arc(W - 30, H - 52, 10, 0, 7); c.stroke();
    c.strokeStyle = cd > 0 ? '#7a5050' : '#ff5050'; c.lineWidth = 2.5; c.beginPath(); c.arc(W - 30, H - 52, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cd)); c.stroke();
    sh('대시', W - 30, H - 34, cd > 0 ? '#7a6a60' : '#ffb0b0', `10px 'Nanum Gothic Coding', monospace`, 'center');
    // 경보 (흔적·감옥을 건드리는 앨리스)
    for (const a of g.alerts) {
      const age = (tnow - a.t) / 1000; if (age > 1.5) continue;
      let rel = Math.atan2(a.z - g.cam.z, a.x - g.cam.x) - g.cam.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const ax = W / 2 + clamp(rel / .9, -1, 1) * (W / 2 - 24);
      c.globalAlpha = 1 - age / 1.5; sh(a.kind === 'cell' ? '!' : '?', ax, 54, '#ff4040', `bold 16px 'VT323', monospace`, 'center');
    }
    c.globalAlpha = 1;
  }
  if (prompt) { sh(prompt, W / 2, H - 44, pcol, KR, 'center'); if (pv >= 0) bar(W / 2, H - 38, 120, pv, pcol); }
  // 시작 안내 (역할 브리핑)
  const briefing = g.intro > 0 || (g.briefOn && !g.ended);
  $('touch').classList.toggle('brief', briefing);
  if (g.intro > 0) drawBrief(c, g, clamp(g.intro / 1.2, 0, 1), g.intro);
  else if (g.briefOn && !g.ended) drawBrief(c, g, 1, 0);
  if (g.mapOn) drawMap(g, g.cam);
  if (g.ended) {
    const e = g.ended, iWin = (e.win === 'alice') === (g.role === 'alice');
    c.fillStyle = 'rgba(0,0,0,.78)'; c.fillRect(0, 0, W, H);
    sh(e.win === 'alice' ? '앨리스들이 꿈에서 빠져나갔다' : '꿈이 앨리스들을 삼켰다', W / 2, 92, e.win === 'alice' ? '#f0f0ff' : '#ff5050', `800 20px 'Nanum Myeongjo', serif`, 'center');
    sh(iWin ? '승리' : '패배', W / 2, 124, iWin ? '#cfe8d2' : '#e08080', `28px 'VT323', monospace`, 'center');
    const rows = [];
    if (e.esc.length) rows.push(`탈출: ${e.esc.join(', ')}`);
    if (e.rot.length) rows.push(`성 위에 걸림: ${e.rot.join(', ')}`);
    if (e.jail.length && e.win === 'dream') rows.push(`붙잡힘: ${e.jail.join(', ')}`);
    rows.push(`꿈: ${e.dreams.join(', ')}`);
    rows.push(`찾은 흔적 ${e.traces}/5${e.reason === 'time' ? ' · 시간 초과' : ''}`);
    rows.forEach((r, i) => sh(r, W / 2, 152 + i * 17, '#cfc6b6', KR, 'center'));
    sh('잠시 후 로비로 돌아갑니다', W / 2, 250, '#7a7268', KRS, 'center');
  }
  if (performance.now() - g.lastSnap > 1500 && !g.ended) sh('신호 약함…', W / 2, H / 2 - 30, '#ff8080', KR, 'center');
  drawScare(c, g);
}

let last = performance.now();
function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000); last = ts; now += dt; frameDt = dt;
  if (game) {
    try {
      update(dt);
      const tags = renderWorld(game, game.cam);
      post(dt);
      drawHud(game, tags);
    } catch (e) { console.error(e); }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 시작 화면
if (device) goHome(); else show('scDevice');
window.__injoo = { get game() { return game; }, get lobby() { return lobby; }, keys, ctl, setChicken(v) { chicken = !!v; } };
