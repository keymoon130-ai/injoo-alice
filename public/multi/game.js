// 人柱愛麗絲 : 망가진 꿈 — 클라이언트
import { CFG, GR, WL, WALL_H, TRACE_INFO, MAPS, MAP_NAMES, PORTAL_COLS, genWorld, stepPlayer, worldSig, mapFingerprint, SKIN_PAL, SKIN_MASK, SKIN_DEFAULT, SKIN_W, SKIN_H, SKIN_DARK_MAX, skinValid, DSKIN_PAL, DSKIN_MASK, DSKIN_DEFAULT, DSKIN_W, DSKIN_H, DSKIN_BRIGHT, DSKIN_BRIGHT_MIN, DSKIN_BRIGHT_MAX, dskinValid, freeSkinValid, SKIN_CLEAR_MAX, DSKIN_EYES, eyesValid, PROTO } from './shared.js';

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
let hiss = store.get('hiss', true); // 테이프 잡음 (지지직)
const INAPP = /Instagram|FBAN|FBAV|KAKAOTALK|Line\/|NAVER\(inapp|everytimeApp|DaumApps|Twitter/i.test(navigator.userAgent || '');
if (INAPP) { const t = '⚠ 앱 안 브라우저로 열려 있어요. 이름·꾸민 모습이 초기화될 수 있으니 크롬이나 사파리로 열어 주세요.'; for (const id of ['storeWarn', 'skinWarn']) { const el = document.getElementById(id); el.textContent = t; el.style.color = '#ff8080'; } }
let myName = store.get('name', '');
let bright = (() => { try { const v = JSON.parse(localStorage.getItem('injoo_bright')); return v == null ? 2 : v; } catch (e) { return 2; } })();
const BRIGHT = [[.72, -4], [.86, -2], [1, 0], [1.2, 7], [1.45, 16]];
// 시점 감도 (1~9, 기본 5) — 솔로와 같은 저장값
const SENS = [0, .4, .55, .7, .85, 1, 1.2, 1.45, 1.75, 2.1];
let sens = (() => { try { const v = JSON.parse(localStorage.getItem('injoo_sens')); return v >= 1 && v <= 9 ? v : 5; } catch (e) { return 5; } })();
function setSens(v) { sens = clamp(v, 1, 9); try { localStorage.setItem('injoo_sens', JSON.stringify(sens)); } catch (e) {} const el = $('selSens'); if (el) el.value = sens; }
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
let ws = null, leaving = false, lastErr = '', curCode = '', lobby = null, retries = 0, rtt = 0, dropT = 0, retryTm = null, lastRx = 0;
function connect(code, create) {
  if (!dropT) lobby = null; // 새로 들어갈 때는 이전 방 정보 없이 (재연결 중엔 유지)
  leaving = false; curCode = code; $('btnRejoin').hidden = true;
  const u = `${WSB}/ws/${code}?id=${encodeURIComponent(myId)}&name=${encodeURIComponent(myName)}&dev=${device}&create=${create ? 1 : 0}`;
  let sock;
  try { sock = new WebSocket(u); } catch (e) { homeErr('서버에 연결할 수 없어요.'); return; }
  ws = sock; lastRx = Date.now();
  sock.onopen = () => { retries = 0; if (dropT) { dropT = 0; addSys('다시 연결됐어요.'); if (game) say('다시 연결됐다', '#cfe8d2', 2.5); } };
  sock.onmessage = e => { if (sock !== ws) return; lastRx = Date.now(); let m; try { m = JSON.parse(e.data); } catch (_) { return; } onMsg(m); };
  sock.onclose = () => {
    if (sock !== ws) return; ws = null;
    if (leaving) return;
    // 게임 중이든 대기실이든: 1분 동안은 계속 다시 연결해 본다 (폰 화면을 껐다 켜거나 앱을 잠깐 바꿔도 돌아오게)
    if ((game || lobby) && !lastErr) {
      if (!dropT) { dropT = Date.now(); addSys('연결이 끊겨 다시 연결하는 중…'); if (game) say('연결이 끊겼다 — 다시 연결하는 중…', '#e0c080', 4); }
      if (Date.now() - dropT < 60000) { retries++; clearTimeout(retryTm); retryTm = setTimeout(() => { if (!leaving && !ws) connect(curCode, false); }, Math.min(3000, 600 * retries)); return; }
    }
    const lost = !lastErr && (game || lobby) && curCode;
    dropT = 0; stopGame(); show('scHome'); homeErr(lastErr || '연결이 끊겼어요.'); lastErr = '';
    if (lost) showRejoin(curCode);
  };
}
// 홈 화면의 「다시 들어가기」 버튼 (끊겼던 방으로)
function showRejoin(code) { const b = $('btnRejoin'); b.textContent = `다시 들어가기 (${code})`; b.hidden = false; b.onclick = () => { b.hidden = true; homeErr(''); connect(code, false); }; }
// 화면으로 돌아오는 순간 바로 다시 연결
// 조용히 죽은 연결 감지: 서버는 게임 중 초당 20번, 대기실에선 2초마다 답을 보낸다. 한동안 아무것도 안 오면 끊긴 걸로 보고 다시 연결
function killStale(limit) {
  if (!ws || leaving || !(game || lobby)) return;
  if (Date.now() - lastRx > limit) { const s = ws; s.onclose(); try { s.close(); } catch (e) {} }
}
setInterval(() => killStale(ws && ws.readyState === 1 ? (game ? 4000 : 7000) : 6000), 1000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden || leaving || !curCode) return;
  if (ws) killStale(2500); // 화면으로 돌아왔는데 그동안 아무것도 못 받았으면 바로 새로 연결
  if (dropT && !ws) { clearTimeout(retryTm); connect(curCode, false); }
});
// 서버가 새 버전으로 업데이트돼서 맵 코드가 다르면: 새로고침하고 같은 방으로 다시 들어간다
function reloadAndRejoin() {
  const n = sess.get('rejoinN', 0);
  if (n >= 2) { leaving = true; try { ws && ws.close(); } catch (e) {} ws = null; stopGame(); show('scHome'); homeErr('게임이 방금 업데이트됐어요. 잠시 후 페이지를 새로고침해 주세요.'); return; }
  sess.set('rejoinN', n + 1); sess.set('rejoin', { code: curCode, t: Date.now() });
  leaving = true; try { ws && ws.close(); } catch (e) {}
  addSys('게임이 업데이트되어 새로고침합니다…');
  setTimeout(() => location.replace(location.pathname + '?r=' + Date.now()), 300);
}
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
setInterval(() => send({ type: 'ping', t: performance.now() }), 2000);

function onMsg(m) {
  switch (m.type) {
    case 'err': lastErr = m.msg; break;
    case 'hello':
      curCode = m.code;
      if ((m.fp && m.fp !== mapFingerprint()) || (m.pv != null && m.pv !== PROTO)) { reloadAndRejoin(); return; }
      sess.set('rejoinN', 0);
      break;
    case 'lobby':
      if (skinWs !== ws) { skinWs = ws; sendSkin(); sendTitle(); }
      lobby = m; renderLobby();
      if (m.phase === 'lobby' && game) { stopGame(); show('scLobby'); }
      else if (!game) show('scLobby');
      break;
    case 'chat': addChat(m); break;
    case 'ping': onPing(m); break;
    case 'start': startGame(m); break;
    case 'snap': if (game) onSnap(m); break;
    case 'end': if (game) onEnd(m); break;
    case 'pong': rtt = performance.now() - m.t; send({ type: 'rtt', v: Math.round(rtt) }); break;
  }
}


/* 운명계승: 흔적에 깃든 원래 주인의 운명 */
const FATES = {
  S: { suit: '♠', who: '붉은 앨리스', name: '붉은 검', col: '#ff7a7a', lose: '붉은 검이 녹슬어 사라졌다', story: '숲에서 수많은 것을 베고, 붉은 길을 남긴 앨리스', bless: '꿈이 바로 앞(2칸)에 오면 베어 3초 기절 · 1회', curse: '쓰기 전까지 지나간 길이 붉게 남아 꿈의 지도에 보인다' },
  M: { suit: '♦', who: '푸른 앨리스', name: '오르골', col: '#9fb0ff', lose: '오르골의 태엽이 다 풀렸다', story: '노래로 모두에게 사랑받다 총에 맞은 앨리스', bless: '다음 구출 1번이 2배 빠르다 (저절로 발동)', curse: '쓰기 전까지 노랫소리가 흘러 꿈이 방향을 안다' },
  C: { suit: '♥', who: '초록 앨리스', name: '왕관', col: '#8fd29a', lose: '왕관이 바스러졌다', story: '모두를 홀린 아름다운 여왕, 그러나 몸은 썩어 갔다', bless: '꿈이 6칸 안에 보이면 홀려 3초간 50% 느리게 · 2회 (재사용 대기 10초)', curse: '왕관을 가진 동안 시야가 점점 썩어 간다' },
  T: { suit: '♣', who: '쌍둥이', name: '초대장', col: '#e0c860', lose: '쌍둥이의 초대장이 흩어졌다', story: '초대장을 받고 숲을 건넌, 끝내 깨어나지 못한 쌍둥이', bless: '초대장 두 장을 모은 두 사람이 6칸 안에 붙어 있으면 둘 다 8% 빠르다', curse: '15칸 넘게 떨어지면 위치가 깜빡이고, 한 명이 갇히면 짝이 10초간 드러난다' }
};
const TRACE_FATE = ['S', 'M', 'C', 'T', 'T'];

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
$('selDreams').addEventListener('change', e => send({ type: 'set', dreams: +e.target.value, max: lobby.settings.max, map: lobby.settings.map, skins: !!lobby.settings.skins, fate: !!lobby.settings.fate, boost: !!lobby.settings.boost, freeCol: !!lobby.settings.freeCol, awake: !!lobby.settings.awake, stealth: !!lobby.settings.stealth }));
$('selMax').addEventListener('change', e => send({ type: 'set', dreams: lobby.settings.dreams, max: +e.target.value, map: lobby.settings.map, skins: !!lobby.settings.skins, fate: !!lobby.settings.fate, boost: !!lobby.settings.boost, freeCol: !!lobby.settings.freeCol, awake: !!lobby.settings.awake, stealth: !!lobby.settings.stealth }));
{ const sb = $('selBright'); for (let i = 0; i < 5; i++) { const o = document.createElement('option'); o.value = i; o.textContent = '■'.repeat(i + 1) + '□'.repeat(4 - i); sb.append(o); } sb.value = bright; sb.addEventListener('change', e => setBright(+e.target.value)); }
{ const ss = $('selSens'); for (let i = 1; i <= 9; i++) { const o = document.createElement('option'); o.value = i; o.textContent = `${i}${i === 5 ? ' (기본)' : ''}`; ss.append(o); } ss.value = sens; ss.addEventListener('change', e => setSens(+e.target.value)); }
$('selMap').addEventListener('change', e => send({ type: 'set', dreams: lobby.settings.dreams, max: lobby.settings.max, map: e.target.value, skins: !!lobby.settings.skins, fate: !!lobby.settings.fate, boost: !!lobby.settings.boost, freeCol: !!lobby.settings.freeCol, awake: !!lobby.settings.awake, stealth: !!lobby.settings.stealth }));
$('chkSkins').addEventListener('change', e => send({ type: 'set', dreams: lobby.settings.dreams, max: lobby.settings.max, map: lobby.settings.map, skins: e.target.checked, fate: !!lobby.settings.fate, boost: !!lobby.settings.boost, freeCol: !!lobby.settings.freeCol, awake: !!lobby.settings.awake, stealth: !!lobby.settings.stealth }));
$('chkFate').addEventListener('change', e => send({ type: 'set', dreams: lobby.settings.dreams, max: lobby.settings.max, map: lobby.settings.map, skins: !!lobby.settings.skins, fate: e.target.checked, boost: !!lobby.settings.boost, freeCol: !!lobby.settings.freeCol, awake: !!lobby.settings.awake, stealth: !!lobby.settings.stealth }));
$('chkBoost').addEventListener('change', e => send({ type: 'set', dreams: lobby.settings.dreams, max: lobby.settings.max, map: lobby.settings.map, skins: !!lobby.settings.skins, fate: !!lobby.settings.fate, boost: e.target.checked, freeCol: !!lobby.settings.freeCol, awake: !!lobby.settings.awake, stealth: !!lobby.settings.stealth }));
$('chkFree').addEventListener('change', e => send({ type: 'set', dreams: lobby.settings.dreams, max: lobby.settings.max, map: lobby.settings.map, skins: !!lobby.settings.skins, fate: !!lobby.settings.fate, boost: !!lobby.settings.boost, freeCol: e.target.checked, awake: !!lobby.settings.awake, stealth: !!lobby.settings.stealth }));
$('chkAwake').addEventListener('change', e => send({ type: 'set', dreams: lobby.settings.dreams, max: lobby.settings.max, map: lobby.settings.map, skins: !!lobby.settings.skins, fate: !!lobby.settings.fate, boost: !!lobby.settings.boost, freeCol: !!lobby.settings.freeCol, awake: e.target.checked, stealth: !!lobby.settings.stealth }));
$('chkStealth').addEventListener('change', e => send({ type: 'set', dreams: lobby.settings.dreams, max: lobby.settings.max, map: lobby.settings.map, skins: !!lobby.settings.skins, fate: !!lobby.settings.fate, boost: !!lobby.settings.boost, freeCol: !!lobby.settings.freeCol, awake: !!lobby.settings.awake, stealth: e.target.checked }));
{ const sh = $('selHiss'); sh.value = hiss ? '1' : '0'; sh.addEventListener('change', e => { hiss = e.target.value === '1'; store.set('hiss', hiss); if (A.hiss && A.ctx) A.hiss.gain.setTargetAtTime(hiss ? .014 : 0, A.ctx.currentTime, .05); }); }
$('lbChatForm').addEventListener('submit', e => { e.preventDefault(); const v = $('lbChatIn').value.trim(); if (v) send({ type: 'chat', text: v }); $('lbChatIn').value = ''; });

{ // 운명계승 설명 (로비)
  const box = $('fateList');
  for (const k of ['S', 'M', 'C', 'T']) { const F = FATES[k], d = document.createElement('div'); d.className = 'fate';
    const h = document.createElement('b'); h.style.color = F.col; h.textContent = `${F.suit} ${F.name} — ${F.who}`;
    const st = document.createElement('i'); st.textContent = F.story;
    const b1 = document.createElement('span'); b1.textContent = '축복 · ' + F.bless;
    const b2 = document.createElement('span'); b2.className = 'curse'; b2.textContent = '대가 · ' + F.curse;
    d.append(h, st, b1, b2); box.append(d); }
}
function renderLobby() {
  const L = lobby; if (!L) return;
  $('lbCode').textContent = L.code;
  const isHost = L.host === myId, me = L.players.find(p => p.id === myId);
  $('lbCount').textContent = `${L.players.length} / ${L.settings.max}`;
  const ul = $('lbPlayers'); ul.textContent = '';
  for (const p of L.players) {
    const li = document.createElement('li');
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = p.name + (p.id === myId ? ' (나)' : ''); { const ts = p.t && titleSpan(p.t); if (ts) nm.append(ts); } li.append(nm);
    const add = (t, c) => { const b = document.createElement('span'); b.className = 'badge ' + (c || ''); b.textContent = t; li.append(b); };
    add(p.dev === 'phone' ? '폰' : 'PC');
    if (p.id === L.host) add('방장', 'host');
    if (p.want) add('꿈 지원', 'dream');
    if (!p.on) add('연결 끊김');
    add(p.ready ? '준비 완료' : '대기', p.ready ? 'ready' : '');
    if (isHost && p.id !== myId) {
      const kb = document.createElement('button'); kb.type = 'button'; kb.className = 'kick'; kb.textContent = '추방';
      kb.addEventListener('click', () => {
        if (kb.dataset.sure) { send({ type: 'kick', id: p.id }); kb.disabled = true; return; }
        kb.dataset.sure = '1'; kb.textContent = '정말?'; kb.classList.add('sure');
        setTimeout(() => { if (kb.isConnected) { delete kb.dataset.sure; kb.textContent = '추방'; kb.classList.remove('sure'); } }, 3000);
      });
      li.append(kb);
    }
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
  $('chkSkins').checked = !!L.settings.skins; $('chkSkins').disabled = !isHost;
  $('skinPanel').hidden = !L.settings.skins;
  $('chkFate').checked = !!L.settings.fate; $('chkFate').disabled = !isHost; $('fateInfo').hidden = !L.settings.fate;
  $('chkBoost').checked = !!L.settings.boost; $('chkBoost').disabled = !isHost; $('boostInfo').hidden = !L.settings.boost;
  $('chkAwake').checked = !!L.settings.awake; $('chkAwake').disabled = !isHost; $('awakeInfo').hidden = !L.settings.awake;
  $('chkStealth').checked = !!L.settings.stealth; $('chkStealth').disabled = !isHost; $('stealthInfo').hidden = !L.settings.stealth;
  $('chkFree').checked = !!L.settings.freeCol; $('chkFree').disabled = !isHost; $('freeLbl').hidden = !L.settings.skins;
  skinEd.setFree(!!L.settings.freeCol);
  if (L.settings.skins) skinEd.draw();
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
  const hg = C.createGain(); hg.gain.value = hiss ? .014 : 0; A.hiss = hg; hs.connect(hp); hp.connect(hg); hg.connect(A.master); hs.start();
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
  song() { const N = [392, 466.16, 523.25, 622.25, 698.46, 622.25, 523.25, 466.16, 392, 349.23, 392]; N.forEach((f, i) => { osc('sine', f, .9, { vol: .16, a: .01, delay: i * .38 }); osc('triangle', f / 2, .9, { vol: .05, delay: i * .38 }); for (const dt of [-14, 11, 23]) osc('sine', f * Math.pow(2, dt / 1200), 1.1, { vol: .045, a: .15, delay: i * .38 + .06 }); }); },
  choir() { for (const [f, d] of [[261.6, 0], [329.6, .1], [392, .2], [523.2, .3]]) osc('sine', f, 4.5, { vol: .1, a: 1.2, delay: d }); },
  gasp() { nz(.7, { type: 'bandpass', f: 650, f2: 2300, q: 2, vol: .3, a: .04 }); },
  boing() { osc('sine', 300, .45, { vol: .3, f2: 900 }); osc('sine', 600, .3, { vol: .12, f2: 200, delay: .12 }); },
  chime() { [1046, 1318, 1568].forEach((f, i) => osc('sine', f, .6, { vol: .1, delay: i * .07 })); },
  pop() { osc('sine', 500, .15, { vol: .3, f2: 1200 }); },
  burn() { nz(1, { type: 'highpass', f: 2600, vol: .5, a: .01 }); osc('sawtooth', 220, .9, { vol: .15, f2: 60 }); osc('sine', 1200, .6, { vol: .1, f2: 2400 }); },
  sizzle(v) { nz(.25, { type: 'highpass', f: 4000 + Math.random() * 3000, vol: .05 + v * .12, a: .02 }); },
  warp() { nz(.7, { type: 'bandpass', f: 3000, f2: 400, q: 2, vol: .35, a: .02 }); osc('sine', 1400, .6, { vol: .12, f2: 220 }); osc('triangle', 2100, .4, { vol: .06, f2: 3200, delay: .1 }); }
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
  glass: mk(['gggggggggggg', 'g.w........g', 'g..w.......g', 'g...w......g', 'g..........g', 'g.......w..g', 'g........w.g', 'g..........g', 'g..........g', 'g.w........g', 'g..w.......g', 'g..........g', 'g......w...g', 'g.......w..g', 'g..........g', 'gggggggggggg'],
    { g: [60, 110, 80], w: [190, 240, 210, 1] }),
  cctvOn: mk(['..kkkkkk', '.kggggggk', 'kgggggggR', 'kggggggkk', '.kkkkkk..', '....kk...', '....kk...'], { k: [30, 30, 32], g: [150, 150, 140], R: [255, 40, 40, 1] }),
  cctvOff: mk(['..kkkkkk', '.kggggggk', 'kgggggggk', 'kggggggkk', '.kkkkkk..', '....kk...', '....kk...'], { k: [30, 30, 32], g: [90, 90, 86] }),
  desk: mk(['.mmmm.mmmm.mmmm.', '.mSSm.mSSm.mSSm.', '.mSSm.mSSm.mSSm.', '.mmmm.mmmm.mmmm.', '...k....k....k..', 'dddddddddddddddd', 'dddddddddddddddd', '.l............l.', '.l............l.', '.l............l.'],
    { m: [40, 42, 44], S: [150, 210, 170, 1], k: [30, 30, 30], d: [70, 60, 50], l: [40, 34, 28] }),
  tvcam: mk(['.kkkkk...', 'kkkkkkkkk', 'kkkkkkkkL', 'kkkkkkkkk', '.kkkkk...', '...kk....', '...kk....', '...kk....', '..k..k...', '.k....k..', 'k......k.'], { k: [36, 36, 40], L: [220, 220, 255, 1] }),
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
const mN = new Uint8Array(W), mA = new Uint8Array(W * 3), mC = new Float32Array(W * 3), mD = new Float32Array(W * 3), mW = new Float32Array(W * 3);
const colHit = new Uint8Array(W), colSide = new Uint8Array(W), colPerp = new Float32Array(W), colMx = new Int16Array(W), colMz = new Int16Array(W), colWx = new Float32Array(W);
const FOVP = 0.66;
const fx = { noise: .09, ca: 1, wobble: .5, flicker: .04, glitch: 0, tr: 1, tg: 1, tb: 1 };
let band = { y: -99, h: 0, s: 0, life: 0 };
let now = 0, frameDt = 0;
const STARS = Array.from({ length: 70 }, (_, i) => ({ a: Math.random() * Math.PI * 2, h: .15 + Math.random() * .85, b: 80 + Math.random() * 120 }));
const GCOL = [[22, 25, 18], [96, 14, 14], [48, 50, 46], [56, 38, 24], [30, 37, 24], [72, 22, 36], [58, 16, 26], [96, 84, 44], [22, 20, 26], [44, 92, 64], [70, 78, 86], [34, 34, 40]];
const WCOL = [[0, 0, 0], [76, 82, 72], [62, 68, 60], [58, 56, 54], [0, 0, 0], [36, 34, 100], [92, 18, 30], [170, 150, 78], [120, 108, 60], [60, 120, 84], [60, 120, 84], [0, 0, 0], [150, 144, 128], [50, 52, 58], [40, 44, 46], [92, 70, 50]];
// 맵별 하늘·안개
const STYLE = { forest: { fogC: [7, 7, 10], fogD: 10.5 }, theater: { fogC: [6, 6, 16], fogD: 11, ceil: [14, 12, 26] }, tea: { fogC: [46, 40, 18], fogD: 9.5, ceil: [120, 110, 70] }, mirror: { fogC: [4, 12, 8], fogD: 12, ceil: [16, 36, 26] }, studio: { fogC: [8, 9, 12], fogD: 11.5, ceil: [40, 42, 46] } };
const pack = (r, g, b) => (0xff000000 | ((b > 255 ? 255 : b < 0 ? 0 : b) << 16) | ((g > 255 ? 255 : g < 0 ? 0 : g) << 8) | (r > 255 ? 255 : r < 0 ? 0 : r)) >>> 0; // 255를 넘으면 다른 색으로 넘치지 않게 자른다
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return (h ^ (h >>> 16)) & 255; };

function renderWorld(g, cam, feed) {
  const w = g.world, N = w.N, dream = g.role === 'dream', ST = STYLE[w.map] || STYLE.forest;
  const fogD = dream ? ST.fogD + 2.5 : ST.fogD, fogS = 1.2;
  const fogC = dream ? [Math.min(255, ST.fogC[0] + 12), ST.fogC[1] * .5 | 0, ST.fogC[2] * .5 | 0] : ST.fogC;
  const tube = w.map === 'tea' ? .82 + .18 * (Math.sin(now * 37) > -.9 ? 1 : 0) * (Math.sin(now * 3.1) > -.97 ? 1 : .2) : 1;
  const dirX = Math.cos(cam.yaw), dirZ = Math.sin(cam.yaw), plX = -dirZ * FOVP, plZ = dirX * FOVP;
  const hor = (H / 2 + cam.bob) | 0;
  const fogT = d => { const t = clamp((d - fogS) / (fogD - fogS), 0, 1); return t * t * (3 - 2 * t); };
  const chick = chicken;

  // 하늘 (실내 맵은 천장)
  // CCTV 카메라: 벽 높은 곳, 켜져 있으면 빨간 불
  if (w.cams) { /* 아래 스프라이트 목록에서 처리 */ }
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
  // ---- 광선 (거울은 튕겨 나간다) ----
  const rd0x = dirX - plX, rd0z = dirZ - plZ, rd1x = dirX + plX, rd1z = dirZ + plZ;
  const fogPack = pack(fogC[0], fogC[1], fogC[2]);
  const MIR = w.map === 'mirror';
  for (let x = 0; x < W; x++) {
    const cx = 2 * x / W - 1;
    let rdx = dirX + plX * cx, rdz = dirZ + plZ * cx, ox = cam.x, oz = cam.z, tAcc = 0, nb = 0;
    mN[x] = 0; colHit[x] = 0; zbuf[x] = 99;
    for (;;) {
      let mx = ox | 0, mz = oz | 0;
      const ddx = Math.abs(1 / (rdx || 1e-9)), ddz = Math.abs(1 / (rdz || 1e-9));
      let stx, stz, sdx, sdz;
      if (rdx < 0) { stx = -1; sdx = (ox - mx) * ddx; } else { stx = 1; sdx = (mx + 1 - ox) * ddx; }
      if (rdz < 0) { stz = -1; sdz = (oz - mz) * ddz; } else { stz = 1; sdz = (mz + 1 - oz) * ddz; }
      let hit = 0, side = 0;
      for (let k = 0; k < 64; k++) {
        if (sdx < sdz) { sdx += ddx; mx += stx; side = 0; } else { sdz += ddz; mz += stz; side = 1; }
        if (mx < 0 || mz < 0 || mx >= N || mz >= N) break;
        const t = w.wall[mz * N + mx];
        if (t && t !== WL.BARS) { hit = t; break; }
        if (tAcc + (side ? sdz - ddz : sdx - ddx) > fogD + 1) break;
      }
      if (!hit) break;
      const tl = side ? sdz - ddz : sdx - ddx, perp = tAcc + tl;
      if (perp > fogD + .5) break;
      const hx = ox + rdx * tl, hz = oz + rdz * tl;
      if (MIR && hit === WL.MIRROR && nb < 3) { // 거울: 평면을 기억하고 반사된 방향으로 계속
        const ax = side, c = side ? (stz > 0 ? mz : mz + 1) : (stx > 0 ? mx : mx + 1);
        mA[x * 3 + nb] = ax; mC[x * 3 + nb] = c; mD[x * 3 + nb] = perp; mW[x * 3 + nb] = side ? hx - Math.floor(hx) : hz - Math.floor(hz); nb++; mN[x] = nb;
        if (side) rdz = -rdz; else rdx = -rdx;
        ox = hx + (side ? 0 : -stx * 1e-4); oz = hz + (side ? -stz * 1e-4 : 0); tAcc = perp;
        continue;
      }
      colHit[x] = hit; colSide[x] = side; colPerp[x] = perp; colMx[x] = mx; colMz[x] = mz;
      let wx = side ? hx : hz; colWx[x] = wx - Math.floor(wx);
      zbuf[x] = perp;
      break;
    }
  }
  // 반사: 점을 거울 평면들로 차례로 뒤집는다
  const refl = (x, d, px, pz, out) => { const n = mN[x]; for (let i = 0; i < n; i++) { if (mD[x * 3 + i] > d) break; if (mA[x * 3 + i]) pz = 2 * mC[x * 3 + i] - pz; else px = 2 * mC[x * 3 + i] - px; } out[0] = px; out[1] = pz; };
  const rp = [0, 0];
  // ---- 바닥 ----
  for (let y = Math.max(0, hor + 1); y < H; y++) {
    const rowDist = (.5 * H) / (y - hor);
    if (rowDist > fogD) { pix.fill(fogPack, y * W, y * W + W); continue; }
    const ft = fogT(rowDist), kf = 1 - ft;
    const sx = rowDist * (rd1x - rd0x) / W, sz = rowDist * (rd1z - rd0z) / W;
    let fx_ = cam.x + rowDist * rd0x, fz_ = cam.z + rowDist * rd0z;
    const row = y * W;
    for (let x = 0; x < W; x++, fx_ += sx, fz_ += sz) {
      let qx = fx_, qz = fz_, tint = 1;
      if (MIR && mN[x] && mD[x * 3] < rowDist) { refl(x, rowDist, fx_, fz_, rp); qx = rp[0]; qz = rp[1]; tint = .82; }
      const ix = qx | 0, iz = qz | 0;
      const t = (ix >= 0 && iz >= 0 && ix < N && iz < N) ? w.ground[iz * N + ix] : 0;
      let c = GCOL[t];
      let r = c[0], gg = c[1], b = c[2];
      if (t === GR.RED && chick) { r = 150; gg = 70; b = 110; }
      if (tube !== 1) { r *= tube; gg *= tube; b *= tube; }
      const n = hash((qx * 4) | 0, (qz * 4) | 0);
      let m = (.82 + n / 255 * .3) * tint;
      if (t === GR.STONE && ((qx * 2 % 1) < .06 || (qz * 2 % 1) < .06)) m *= .6;
      if (t === GR.BOARD && (qx * 3 % 1) < .08) m *= .55;
      if (t === GR.YCARPET && (((qx * 2) | 0) + ((qz * 2) | 0)) % 7 === 0) m *= .8;
      if (t === GR.CARPET && ((qx * 4 % 1) < .1)) m *= .75;
      if (t === GR.LINO && (((qx * 2) | 0) + ((qz * 2) | 0)) % 2) m *= .9;
      if (t === GR.STUDIO && ((qx % 4) < .04 || (qz % 4) < .04)) m *= .6;
      if (t === GR.MARBLE) { if ((((qx * 1.5) | 0) + ((qz * 1.5) | 0)) & 1) m *= .62; if ((hash((qx * 9) | 0, (qz * 3) | 0) & 31) < 2) m *= 1.3; }
      pix[row + x] = pack((r * m * kf + fogC[0] * ft) | 0, (gg * m * kf + fogC[1] * ft) | 0, (b * m * kf + fogC[2] * ft) | 0);
    }
  }
  // 거울 속 천장도 뒤집어서
  if (MIR) for (let y = 0; y <= hor && y < H; y++) {
    const rowDist = (.5 * H) / Math.max(1, hor - y); if (rowDist > fogD) continue;
    const ft = fogT(rowDist), kf = 1 - ft, cc = ST.ceil;
    for (let x = 0; x < W; x++) {
      if (!mN[x] || mD[x * 3] >= rowDist) continue;
      const cxx = 2 * x / W - 1; refl(x, rowDist, cam.x + rowDist * (dirX + plX * cxx), cam.z + rowDist * (dirZ + plZ * cxx), rp);
      const m = ((rp[0] * 2 % 1) < .05 ? .6 : .9) * .82;
      pix[y * W + x] = pack((cc[0] * m * kf + fogC[0] * ft) | 0, (cc[1] * m * kf + fogC[1] * ft) | 0, (cc[2] * m * kf + fogC[2] * ft) | 0);
    }
  }
  // ---- 벽 ----
  for (let x = 0; x < W; x++) {
    const hit = colHit[x]; if (!hit) continue;
    const perp = colPerp[x], side = colSide[x], mx = colMx[x], mz = colMz[x], wx = colWx[x];
    const lh = H / perp, wh = WALL_H[hit];
    const bot = hor + .5 * lh, top = bot - wh * lh;
    const ft = fogT(perp), kf = 1 - ft, sh = (side ? .74 : 1) * (mN[x] ? Math.pow(.82, mN[x]) : 1);
    const base = WCOL[hit];
    const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H - 1, Math.floor(bot));
    const patch = hash(mx * 3 + 1, mz * 7 + 3);
    if (hit === WL.PORTAL) { // 빛나는 거울 문
      const pi = w.portalAt[mz * N + mx], pc = PORTAL_COLS[(w.portals[pi] || { pair: 0 }).pair % 4];
      for (let y = y0; y <= y1; y++) {
        const vh = (bot - y) / lh, edge = wx < .08 || wx > .92 || vh < .06;
        const sw = .55 + .45 * Math.sin(Math.hypot(wx - .5, vh - .8) * 18 - now * 5);
        const k = edge ? .35 : sw * (.8 + .2 * Math.sin(now * 3));
        pix[y * W + x] = pack(Math.min(255, pc[0] * k + 30) | 0, Math.min(255, pc[1] * k + 30) | 0, Math.min(255, pc[2] * k + 30) | 0);
      }
      continue;
    }
    for (let y = y0; y <= y1; y++) {
      const vh = (bot - y) / lh;
      let m = sh;
      if (hit === WL.CURTAIN || hit === WL.VELVET) m *= .65 + .35 * Math.sin(wx * (hit === WL.VELVET ? 14 : 22));
      else if (hit === WL.YPAPER) { m *= tube * (((wx * 6) | 0) % 2 ? .9 : 1) * (vh < .15 ? .7 : 1) * (patch < 40 && vh < .6 ? .78 : 1); if ((hash((wx * 8) | 0, (vh * 8) | 0) & 63) < 3) m *= .6; }
      else if (hit === WL.PILLAR) m *= tube * (.8 + .2 * Math.sin(wx * 6.28));
      else if (hit === WL.OFFICE) { if ((wx * 2 % 1) < .04) m *= .7; if (vh < .1) m *= .55; if (Math.abs(vh - .9) < .02) m *= .7; if (patch < 30 && vh < .9 && vh > .5 && Math.abs(wx - .5) < .3) m *= .82; }
      else if (hit === WL.ACOUSTIC) { const u = (wx * 4) % 1, v = (vh * 4) % 1; m *= (u < .5) !== (v < .5) ? .78 : 1; m *= .9 + .1 * Math.sin(u * 12.6) * Math.sin(v * 12.6); }
      else if (hit === WL.TVWALL) { const u = (wx * 3) % 1, v = (vh * 3) % 1; if (u < .1 || v < .12 || vh < .15) m *= .3; else { const st = hash((x + (now * 30 | 0)) & 255, y) / 255; const on = hash(mx * 7 + ((wx * 3) | 0), mz * 5 + ((vh * 3) | 0) + (now * .5 | 0)) & 1; pix[y * W + x] = pack((on ? 90 + st * 120 : 40 + st * 40) * kf + fogC[0] * ft | 0, (on ? 110 + st * 120 : 46 + st * 40) * kf + fogC[1] * ft | 0, (on ? 100 + st * 110 : 44 + st * 40) * kf + fogC[2] * ft | 0); continue; } }
      else if (hit === WL.SHELF) { const v = (vh * 4) % 1; if (v < .15) m *= .45; else { const bk = hash(((wx * 10) | 0) + mx * 13, ((vh * 4) | 0) + mz * 7); m *= .6 + (bk & 63) / 160; } }
      else if (hit === WL.MARBLE || hit === WL.MIRROR) { const v = Math.sin(wx * 9 + vh * 4 + Math.sin(vh * 13 + mx) * 1.3); m *= .78 + .16 * v; if (vh < .08) m *= .6; if (Math.abs(vh - wh * .5) < .03) m *= .7; }
      else {
        const row = Math.floor(vh * 4), off = (row & 1) * .5;
        if ((vh * 4) % 1 < .1 || ((wx * 2 + off) % 1) < .06) m *= .55;
        if (hash(row + mx * 5, ((wx * 2 + off) | 0) + mz * 11) < 40) m *= .7;
        if (patch < 70 && vh > wh * .7) m *= .6;
      }
      pix[y * W + x] = pack((base[0] * m * kf + fogC[0] * ft) | 0, (base[1] * m * kf + fogC[1] * ft) | 0, (base[2] * m * kf + fogC[2] * ft) | 0);
    }
  }
  // 거울 유리: 초록빛 틴트와 테두리
  if (MIR) for (let x = 0; x < W; x++) {
    if (!mN[x]) continue;
    const d0 = mD[x * 3], lh = H / d0, bot = hor + .5 * lh, top = bot - WALL_H[WL.MIRROR] * lh, w0 = mW[x * 3];
    const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H - 1, Math.floor(bot));
    const ft = fogT(d0), frame = w0 < .045 || w0 > .955;
    for (let y = y0; y <= y1; y++) {
      const o = pix[y * W + x], vh = (bot - y) / lh;
      if (frame || vh < .05) { pix[y * W + x] = pack((40 * (1 - ft) + fogC[0] * ft) | 0, (62 * (1 - ft) + fogC[1] * ft) | 0, (44 * (1 - ft) + fogC[2] * ft) | 0); continue; }
      const glint = (Math.abs(w0 - vh * .35 - .2) < .04) ? 26 : 0;
      pix[y * W + x] = pack(Math.min(255, (o & 255) * .86 + 4 + glint) | 0, Math.min(255, ((o >> 8) & 255) * .96 + 10 + glint) | 0, Math.min(255, ((o >> 16) & 255) * .9 + 6 + glint) | 0);
    }
  }

  // ---- 스프라이트 ----
  const inv = 1 / (plX * dirZ - dirX * plZ);
  const proj = (sx_, sz_) => {
    const dx = sx_ - cam.x, dz = sz_ - cam.z;
    return [inv * (dirZ * dx - dirX * dz), inv * (-plZ * dx + plX * dz)];
  };
  zcol.set(zbuf);
  if (MIR) for (let x = 0; x < W; x++) if (mN[x]) zcol[x] = Math.min(zcol[x], mD[x * 3]);
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
  const raw = [];
  const push = (spr, x, z, ww, wh, z0, mode, extra) => { if (MIR) raw.push({ spr, x, z, ww, wh, z0, mode, extra }); const [tx, ty] = proj(x, z); if (ty > .12 && (ty < fogD + 2 || mode === 3)) list.push({ spr, tx, ty, ww, wh, z0, mode, extra }); };
  if (w.cams) w.cams.forEach((cm, i) => push(g.cams && g.cams[i] ? SPR.cctvOn : SPR.cctvOff, cm.x, cm.z, .45, .32, 1.15, 0));
  for (const p of w.props) {
    if (p.kind === 'table') push(SPR.table, p.x, p.z, 1.0, .55, 0, 0);
    else if (p.kind === 'chair') push(SPR.chair, p.x, p.z, .45, .8, 0, 0);
    else if (p.kind === 'pole') push(SPR.pole, p.x, p.z + .02, .12, 2.4, 0, 0);
    else if (p.kind === 'bars') push(SPR.bars, p.x, p.z, 1.0, 1.4, 0, 0);
    else if (p.kind === 'seat') push(SPR.seat, p.x, p.z, .8, .8, 0, 0);
    else if (p.kind === 'glass') push(SPR.glass, p.x, p.z, 1.0, 1.6, 0, 0);
    else if (p.kind === 'desk') push(SPR.desk, p.x, p.z, 1.6, .9, 0, 0);
    else if (p.kind === 'tvcam') push(SPR.tvcam, p.x, p.z, .6, 1.25, 0, 0);
    else if (p.kind === 'mann') push(chick ? SPR.ghost : SPR.mann, p.x, p.z - .05, chick ? .6 : .55, chick ? .6 : 1.0, chick ? .35 : 0, 0);
  }
  w.traces.forEach((t, i) => {
    if (g.tr[i]) return;
    const s = SPR[t.kind];
    const dims = { sword: [.3, .9, 0], musicbox: [.5, .5, 0], crown: [.45, .65, 0], card: [.3, .38, i === 3 ? .5 : 0] }[t.kind];
    push(s, t.x, t.z, dims[0], dims[1], dims[2], 2);
  });
  for (const pl of g.players.values()) {
    if (pl.id === myId && !g.spectating && !feed) continue;
    const ip = interp(pl); if (!ip || !pl.cur) continue;
    const st = pl.cur.s;
    if (st === 4) continue;
    if (pl.id === g.spectating) continue;
    if (pl.role === 'dream') {
      if (pl.cur.o === 0) continue;
      if (g.meS && g.meS.s === 1 && Math.hypot(ip.x - cam.x, ip.z - cam.z) < 1.3) continue;
      if (chick) push(SPR.ghost, ip.x, ip.z, 1.0, 1.0, .35 + Math.sin(now * 3) * .05, 0, pl);
      else push((g.skins && g.skins.get(pl.id)) || SPR.dream, ip.x, ip.z, .75, 1.8, 0, pl.cur.sn > 0 ? 4 : pl.cur.ch > 0 ? 5 : 0, pl);
    } else if (st === 3) {
      push(chick ? SPR.ghost : SPR.body, ip.x, ip.z, .55, 1.0, 1.3, 0, pl);
    } else {
      if (st === 1 && Math.hypot(ip.x - cam.x, ip.z - cam.z) < 1.3) continue;
      push((g.skins && g.skins.get(pl.id)) || SPR.alice, ip.x, ip.z, .55, 1.05, st === 1 ? .55 : 0, dream ? 1 : 0, pl);
    }
  }
  // 거울 속의 사람들 (나 자신 포함)
  if (MIR) {
    const meA = (g.skins && g.skins.get(myId)) || SPR.alice, meSpr = chick ? (dream ? SPR.ghost : meA) : (dream ? meA !== SPR.alice ? meA : SPR.dream : meA);
    if (!g.spectating) raw.push({ spr: meSpr, x: cam.x, z: cam.z, ww: dream && !chick ? .75 : .55, wh: dream && !chick ? 1.8 : 1.05, z0: 0, mode: 0 });
    const planes = new Map();
    for (let x = 0; x < W; x++) if (mN[x]) { const key = mA[x * 3] * 100000 + mC[x * 3]; if (!planes.has(key)) planes.set(key, [mA[x * 3], mC[x * 3]]); }
    for (const [key, [ax, c]] of planes) {
      const rl = [];
      for (const s0 of raw) { const rx = ax ? s0.x : 2 * c - s0.x, rz = ax ? 2 * c - s0.z : s0.z; const [tx, ty] = proj(rx, rz); if (ty > .3 && ty < fogD + 2) rl.push({ ...s0, tx, ty }); }
      rl.sort((a, b) => b.ty - a.ty);
      for (const s0 of rl) {
        const { spr, tx, ty, ww, wh, z0 } = s0, scale = H / ty, sx = W / 2 * (1 + tx / ty), hpx = wh * scale, wpx = ww * scale;
        const bot = hor + (.5 - z0) * scale, top = bot - hpx, x0 = Math.floor(sx - wpx / 2), x1 = Math.floor(sx + wpx / 2);
        if (x1 < 0 || x0 >= W) continue;
        const ft = fogT(ty), kf = (1 - ft) * .84, y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H - 1, Math.floor(bot));
        for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
          if (!mN[x] || mA[x * 3] * 100000 + mC[x * 3] !== key || ty <= mD[x * 3] || ty >= zbuf[x]) continue;
          const pu = Math.min(spr.w - 1, ((x - (sx - wpx / 2)) / wpx * spr.w) | 0);
          for (let y = y0; y <= y1; y++) {
            const pv = Math.min(spr.h - 1, ((y - top) / hpx * spr.h) | 0), k = pv * spr.w + pu;
            if (!spr.a[k]) continue;
            pix[y * W + x] = pack((spr.r[k] * kf + fogC[0] * ft) | 0, (spr.g[k] * kf * 1.06 + fogC[1] * ft) | 0, (spr.b[k] * kf + fogC[2] * ft) | 0);
          }
        }
      }
    }
  }
  list.sort((a, b) => b.ty - a.ty);
  const tags = [], eyePts = [], awakeOn = !feed && g.awake && g.aw === 2 && g.role === 'alice';
  const twinOf = g.fate && g.twins && g.role === 'alice' && g.pred.tw && g.twins.includes(myId) ? g.twins.find(id => id !== myId) : null;
  for (const s of list) {
    const { spr, tx, ty, ww, wh, z0, mode } = s;
    const xr = twinOf && s.extra && s.extra.id === twinOf;
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
      const hid = ty >= zcol[x];
      if (hid && !xr) continue;
      if (!hid) vis = true;
      const fu = (x - (sx - wpx / 2)) / wpx * spr.w, pu = Math.min(spr.w - 1, fu | 0), ffu = fu - pu, big = spr === SPR.dream && wpx / spr.w > 5;
      for (let y = y0; y <= y1; y++) {
        const fv = (y - top) / hpx * spr.h, pv = Math.min(spr.h - 1, fv | 0);
        const k = pv * spr.w + pu;
        if (!spr.a[k]) continue;
        if (hid) { const o = pix[y * W + x]; pix[y * W + x] = pack(lerp(o & 255, 235, .32) | 0, lerp((o >> 8) & 255, 205, .32) | 0, lerp((o >> 16) & 255, 110, .32) | 0); continue; } // 쌍둥이: 벽 너머 짝의 실루엣
        let r = spr.r[k], gg = spr.g[k], b = spr.b[k];
        if (spr.e[k]) {
          const ffv = fv - pv;
          if (!big || (Math.abs(ffu - .5) < .2 && Math.abs(ffv - .5) < .2)) { pix[y * W + x] = pack(r, gg, b); continue; }
          r = 22; gg = 18; b = 24;
        }
        if (mode === 1) { r = r * .72 + 62; gg = gg * .72 + 66; b = b * .72 + 82; }
        if (mode === 4 && (now * 10 | 0) % 2) { r = 120; gg = 20; b = 20; }
        if (mode === 5) { const q = .45 + .2 * Math.sin(now * 9); r = lerp(r, 90, q); gg = lerp(gg, 230, q); b = lerp(b, 120, q); } // 왕관에 홀린 꿈
        if (pulse) { r = lerp(r, 255, pulse); gg = lerp(gg, 236, pulse); b = lerp(b, 200, pulse); }
        pix[y * W + x] = pack((r * kf + fogC[0] * ft) | 0, (gg * kf + fogC[1] * ft) | 0, (b * kf + fogC[2] * ft) | 0);
      }
    }
    if (vis && s.extra && s.extra.role === g.role && ty < 8) tags.push({ x: sx, y: top - 4, name: s.extra.name, title: s.extra.title, a: 1 - ty / 8 });
    if (awakeOn && s.extra && s.extra.role === 'dream') { // 깨어난 꿈의 눈
      const ec = (g.eyes && g.eyes.get(s.extra.id)) || (spr === SPR.ghost ? [[4, 4], [9, 4]] : DEF_EYES);
      for (const [ex, ey] of ec) {
        const px_ = sx - wpx / 2 + (ex + .5) / spr.w * wpx, py_ = top + (ey + .5) / spr.h * hpx, xi = px_ | 0;
        if (xi < 0 || xi >= W || ty >= zcol[xi]) continue;
        eyePts.push({ x: px_, y: py_, r: Math.max(1.4, wpx / spr.w * .7) });
      }
    }
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
  if (!feed && g.awake && g.role === 'alice' && (g.aw === 2 || (g.aw === 1 && Math.random() < .35))) darkness(eyePts);
  return tags;
}
// 꿈이 깨어난 시간: 앨리스 화면은 손전등만큼만 보이고, 꿈의 눈만 붉게 떠오른다
let darkMask = null;
function darkness(eyes) {
  if (!darkMask) { darkMask = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot((x - W / 2) * .9, (y - H / 2 - 8) * 1.1), c = clamp(1 - (d - 46) / 34, 0, 1); darkMask[y * W + x] = .045 + .955 * c * c * (3 - 2 * c); } }
  const fl = .9 + Math.random() * .1;
  for (let i = 0; i < W * H; i++) { const m = darkMask[i] * fl; if (m >= .999) continue; const v = pix[i]; pix[i] = (0xff000000 | (((v >>> 16 & 255) * m) << 16) | (((v >>> 8 & 255) * m) << 8) | ((v & 255) * m)) >>> 0; }
  for (const e of eyes) {
    const R = e.r * 4;
    for (let y = Math.max(0, (e.y - R) | 0); y <= Math.min(H - 1, (e.y + R) | 0); y++) for (let x = Math.max(0, (e.x - R) | 0); x <= Math.min(W - 1, (e.x + R) | 0); x++) {
      const d = Math.hypot(x - e.x, y - e.y), o = pix[y * W + x];
      if (d <= e.r) { pix[y * W + x] = pack(255, 40 + (d < e.r * .4 ? 120 : 0), 30); continue; }
      const k = clamp(1 - (d - e.r) / (R - e.r), 0, 1) * .55; if (k <= 0) continue;
      pix[y * W + x] = pack(lerp(o & 255, 255, k) | 0, lerp((o >> 8) & 255, 20, k * .6) | 0, lerp((o >> 16) & 255, 20, k * .6) | 0);
    }
  }
}

function post(dt) {
  const sd = wimg.data, d = out.data, BR = BRIGHT[bright] || BRIGHT[2], bo = BR[1];
  const ns = (fx.noise + fx.glitch * .5) * 255, ca = Math.min(2, Math.round(fx.ca + fx.glitch * 5)), fl = 1 - Math.random() * fx.flicker; // 색 번짐은 최대 2칸 (꾸민 색이 틀어지지 않게)
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
const ctl = { actHeld: false, actLatch: false, dashQ: false, stQ: false, joyX: 0, joyY: 0, touchAct: false };
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
  if (k === 'e' || k === ' ') { if (cctvKey()) return; ctl.actLatch = true; if (game.spectate) cycleSpectate(); }
  if (game.cctv && (k === 'arrowleft' || k === 'a')) { game.cctv.page = (game.cctv.page + camPages() - 1) % camPages(); return; }
  if (game.cctv && (k === 'arrowright' || k === 'd')) { game.cctv.page = (game.cctv.page + 1) % camPages(); return; }
  if (game.cctv && k === 'escape') { game.cctv = null; return; }
  if (k === 'shift' && game.role === 'dream') ctl.dashQ = true;
  if (k === 'f') { if (game.role === 'dream') ctl.stQ = true; else ctl.dashQ = true; } // 꿈: 은신 · 앨리스: 운명
  if (k === 'm') game.mapOn = !game.mapOn;
  if (k === 'g') pingLook();
  if (k === 'tab' || k === 'h' || k === '?') game.briefOn = !game.briefOn;
  if (k === '[' || k === ']') { setSens(sens + (k === ']' ? 1 : -1)); say(`시점 감도 ${sens}`, '#cfc6b6', 1.5); }
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
  if (document.pointerLockElement === cv) game.yaw += e.movementX * .0026 * SENS[sens];
  else if (dragLook) game.yaw += e.movementX * .006 * SENS[sens];
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
/* ---------- 손짓 (핑): 같은 편에게 위치 알리기 ---------- */
let pingCd = 0;
function sendPing(x, z) {
  if (!game || game.ended || game.intro > 0) return;
  const t = performance.now(); if (t - pingCd < 3000) { say('손짓은 3초에 한 번', '#a89e90', 1.2); return; }
  pingCd = t; send({ type: 'ping', x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 });
}
function pingLook() { // PC: 보고 있는 곳 (벽 앞까지, 최대 16칸)
  const g = game; if (!g) return; if (g.mapOn) return;
  const w = g.world, N = w.N, dx = Math.cos(g.cam.yaw), dz = Math.sin(g.cam.yaw);
  let d = .5; for (; d < 16; d += .1) { const x = g.cam.x + dx * d, z = g.cam.z + dz * d; if (x < 0 || z < 0 || x >= N || z >= N || w.wall[(z | 0) * N + (x | 0)]) break; }
  d = Math.max(.6, d - .35); sendPing(g.cam.x + dx * d, g.cam.z + dz * d);
}
function onPing(m) {
  const g = game; if (!g) return;
  (g.tpings || (g.tpings = [])).push({ x: m.x, z: m.z, t: performance.now(), a: m.a, me: m.a === myId });
  if (g.tpings.length > 8) g.tpings.shift();
  at(m.x, m.z, 60, () => { osc('sine', 1320, .12, { vol: .12 }); osc('sine', 1760, .12, { vol: .08, delay: .09 }); });
}
// 지도를 연 채로 누르면 그 자리에 손짓
cv.addEventListener('pointerdown', e => {
  if (!game || !game.mapOn) return;
  const r = cv.getBoundingClientRect(); let cx, cy;
  if (ROT()) { cx = (e.clientY - r.top) / r.height * W; cy = (r.right - e.clientX) / r.width * H; } else { cx = (e.clientX - r.left) / r.width * W; cy = (e.clientY - r.top) / r.height * H; }
  const S = 230, ox = (W - S) / 2, oy = (H - S) / 2 + 6, k = S / game.world.N;
  if (cx < ox || cy < oy || cx > ox + S || cy > oy + S) return;
  e.stopImmediatePropagation(); e.preventDefault(); initAudio();
  sendPing((cx - ox) / k, (cy - oy) / k);
}, { capture: true });
function pingCol(g) { return g.role === 'dream' ? '255,110,110' : '120,235,255'; }
function drawPingsMap(g, ox, oy, k, big) {
  if (!g.tpings) return; const tn = performance.now(), c = ctx, col = pingCol(g);
  for (const p of g.tpings) {
    const a = (tn - p.t) / 1000; if (a > 4) continue;
    const x = ox + p.x * k, y = oy + p.z * k, ph = (a * 1.6) % 1;
    c.strokeStyle = `rgba(${col},${1 - ph})`; c.lineWidth = big ? 2 : 1.4; c.beginPath(); c.arc(x, y, (big ? 4 : 2) + ph * (big ? 14 : 8), 0, 7); c.stroke();
    c.fillStyle = `rgba(${col},${a < 3.5 ? 1 : (4 - a) * 2})`; c.beginPath(); c.moveTo(x, y - (big ? 5 : 3)); c.lineTo(x + (big ? 4 : 2.5), y); c.lineTo(x, y + (big ? 5 : 3)); c.lineTo(x - (big ? 4 : 2.5), y); c.closePath(); c.fill();
    if (big) { c.font = `10px 'Nanum Gothic Coding', monospace`; c.textAlign = 'center'; c.fillStyle = `rgb(${col})`; c.fillText(p.me ? '나' : nameOf(p.a), x, y - 11); }
  }
  g.tpings = g.tpings.filter(p => tn - p.t < 4000);
}
function drawPingsWorld(g) { // 화면 속: 벽 너머로도 보이는 표시
  if (!g.tpings || g.mapOn) return; const tn = performance.now(), c = ctx, col = pingCol(g), cam = g.cam, hor = H / 2 + (cam.bob || 0);
  for (const p of g.tpings) {
    const a = (tn - p.t) / 1000; if (a > 4) continue;
    const dx = p.x - cam.x, dz = p.z - cam.z, d = Math.hypot(dx, dz); let rel = Math.atan2(dz, dx) - cam.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const al = a < 3.4 ? 1 : (4 - a) / .6;
    if (Math.abs(rel) < 1.0 && Math.abs(Math.tan(rel)) < FOVP * 1.02) {
      const x = W / 2 + Math.tan(rel) / FOVP * W / 2, depth = Math.max(.4, d * Math.cos(rel)), y = clamp(hor - .6 * H / depth, 24, H - 40), bob = Math.sin(a * 8) * 2;
      c.save(); c.globalAlpha = al; c.fillStyle = `rgb(${col})`; c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x, y + bob); c.lineTo(x + 5, y - 7 + bob); c.lineTo(x, y - 14 + bob); c.lineTo(x - 5, y - 7 + bob); c.closePath(); c.stroke(); c.fill();
      c.font = `10px 'Nanum Gothic Coding', monospace`; c.textAlign = 'center'; const s = `${p.me ? '나' : nameOf(p.a)} · ${Math.round(d)}m`;
      c.fillStyle = '#000'; c.fillText(s, x + 1, y - 18 + bob); c.fillStyle = `rgb(${col})`; c.fillText(s, x, y - 19 + bob); c.restore();
    } else { // 화면 밖: 가장자리 화살표
      const sx = rel > 0 ? W - 14 : 14; c.save(); c.globalAlpha = al * (.6 + .4 * Math.sin(a * 10)); c.fillStyle = `rgb(${col})`;
      c.beginPath(); if (rel > 0) { c.moveTo(sx + 7, H / 2); c.lineTo(sx - 3, H / 2 - 7); c.lineTo(sx - 3, H / 2 + 7); } else { c.moveTo(sx - 7, H / 2); c.lineTo(sx + 3, H / 2 - 7); c.lineTo(sx + 3, H / 2 + 7); } c.closePath(); c.fill(); c.restore();
    }
  }
}
function moveJoy(e) {
  const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width / 2;
  let dx = (e.clientX - cx) / rad, dy = (e.clientY - cy) / rad; if (ROT()) { const t = dx; dx = dy; dy = -t; } const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
  ctl.joyX = Math.abs(dx) < .12 ? 0 : dx; ctl.joyY = Math.abs(dy) < .12 ? 0 : dy;
  knob.style.transform = `translate(calc(-50% + ${dx * rad * .6}px), calc(-50% + ${dy * rad * .6}px))`;
}
cv.addEventListener('pointerdown', e => {
  if (!game || device !== 'phone' || e.pointerType === 'mouse') return;
  initAudio();
  if (game.cctv) { const r = cv.getBoundingClientRect(), v = ROT() ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width; game.cctv.page = (game.cctv.page + (v < .5 ? camPages() - 1 : 1)) % camPages(); return; }
  if (game.spectate) { cycleSpectate(); return; }
  lookId = e.pointerId; lookX = ROT() ? e.clientY : e.clientX; try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== lookId || !game) return;
  const r = cv.getBoundingClientRect();
  const v = ROT() ? e.clientY : e.clientX, span = ROT() ? r.height : r.width;
  game.yaw += (v - lookX) / span * 4.2 * SENS[sens]; lookX = v;
});
const endLook = e => { if (e.pointerId === lookId) lookId = null; };
cv.addEventListener('pointerup', endLook); cv.addEventListener('pointercancel', endLook);
const hold = (el, on, off) => {
  el.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); on(); });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(t, () => off && off());
};
hold($('tAct'), () => { if (cctvKey()) return; ctl.touchAct = true; ctl.actLatch = true; if (game && game.spectate) cycleSpectate(); }, () => { ctl.touchAct = false; });
hold($('tDash'), () => { ctl.dashQ = true; });
hold($('tFate'), () => { if (game && game.role === 'dream') ctl.stQ = true; else ctl.dashQ = true; });
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

// 모니터실: 책상 앞에서 행동 → CCTV 보기 (보는 동안은 움직일 수 없다)
function nearMonitor(g) { const w = g.world; if (!w.monitors || g.role !== 'alice' || !g.meS || g.meS.s !== 0) return null; for (const m of w.monitors) if (Math.hypot(g.pred.x - m.x, g.pred.z - m.z) < 1.9) return m; return null; }
const camPages = () => Math.max(1, Math.ceil(((game && game.world.cams) || []).length / 4));
function cctvKey() {
  const g = game; if (!g || g.ended) return false;
  if (g.cctv) { g.cctv = null; sfx.tick(); return true; }
  if (nearMonitor(g)) { g.cctv = { page: 0, rr: 0 }; for (const k in keys) keys[k] = false; ctl.joyX = ctl.joyY = 0; sfx.tick(); nz(.3, { type: 'bandpass', f: 3000, q: .5, vol: .2 }); return true; }
  return false;
}
function readControls() {
  let f = 0, s = 0;
  if (game && game.cctv) { if (Math.hypot(ctl.joyX, ctl.joyY) > .6) game.cctv = null; else { ctl.actLatch = false; ctl.dashQ = false; ctl.stQ = false; return { f: 0, s: 0, act: false, dash: false, st: false }; } }
  if (!chatOpen) {
    f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    s = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    f += -ctl.joyY; s += ctl.joyX;
  }
  const act = !chatOpen && (keys.e || keys[' '] || ctl.touchAct || ctl.actLatch);
  ctl.actLatch = false;
  const dash = ctl.dashQ; ctl.dashQ = false;
  const st = ctl.stQ; ctl.stQ = false;
  return { f: clamp(f, -1, 1), s: clamp(s, -1, 1), act, dash, st };
}


/* =========================================================
   앨리스·꿈 꾸미기 (실루엣 고정 · 색만) — 자유 색상 추가 모드면 아무 색이나, 칸 수 제한 없이
   ========================================================= */
const SK = {
  alice: { W: SKIN_W, H: SKIN_H, MASK: SKIN_MASK, PAL: SKIN_PAL, DEF: SKIN_DEFAULT, valid: skinValid, key: 'skin', fkey: 'skinF', name: '앨리스', bright: 99 },
  dream: { W: DSKIN_W, H: DSKIN_H, MASK: DSKIN_MASK, PAL: DSKIN_PAL, DEF: DSKIN_DEFAULT, valid: dskinValid, key: 'dskin', fkey: 'dskinF', name: '꿈', bright: DSKIN_BRIGHT }
};
const hex2 = v => v.toString(16).padStart(2, '0');
const rgbHex = c => hex2(c[0]) + hex2(c[1]) + hex2(c[2]);
const hexRgb = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
const glowing = c => Math.max(c[0], c[1], c[2]) >= 200; // 자유 색상의 꿈: 아주 밝은 색은 스스로 빛난다
const eyeCoords = (eyes, D_ = SK.dream) => (eyes || DSKIN_EYES).map(i => { const k = D_.MASK[i]; return [k % D_.W, (k / D_.W) | 0]; });
const DEF_EYES = eyeCoords(DSKIN_EYES);
function skinSprite(str, kind = 'alice') {
  const D = SK[kind], n = D.W * D.H, R = new Uint8Array(n), G = new Uint8Array(n), B = new Uint8Array(n), A_ = new Uint8Array(n), E = new Uint8Array(n), free = str[0] === '#';
  D.MASK.forEach((k, i) => {
    let c, em;
    if (free) { const q = str.substr(1 + i * 6, 6); if (q === 'xxxxxx') return; c = hexRgb(q); em = kind === 'dream' && glowing(c); }
    else { if (str[i] === 'x') return; const ci = parseInt(str[i], 16); c = D.PAL[ci] || D.PAL[0]; em = ci >= D.bright; }
    R[k] = c[0]; G[k] = c[1]; B[k] = c[2]; A_[k] = 1; if (em) E[k] = 1;
  });
  return { w: D.W, h: D.H, r: R, g: G, b: B, a: A_, e: E, dreamLike: kind === 'dream' };
}
const mine = {
  alice: (() => { const v = store.get('skin', null); return skinValid(v) ? v : SKIN_DEFAULT; })(),
  dream: (() => { const v = store.get('dskin', null); return typeof v === 'string' && v.length === DSKIN_MASK.length ? v : DSKIN_DEFAULT; })(),
  aliceF: (() => { const v = store.get('skinF', null); return freeSkinValid(v, 'alice') ? v : null; })(),
  dreamF: (() => { const v = store.get('dskinF', null); return freeSkinValid(v, 'dream') ? v : null; })(),
  deye: (() => { const v = store.get('deye', null); return eyesValid(v) ? v : DSKIN_EYES.slice(); })()
};
let skinWs = null, skinSendT = 0;
/* ---------- 칭호 ---------- */
const TI = window.InjooTitles || null;
if (TI && store.get('title', null) && !TI.equipped()) { TI.equip(store.get('title', null)); store.set('title', null); } // 예전 저장 옮기기
function sendTitle() { send({ type: 'title', v: TI ? TI.equipped() : null }); }
function titleSpan(id) { const t = TI && TI.BY[id]; if (!t) return null; const sp = document.createElement('span'); sp.className = 'ttl' + (t.col === 'wave' ? ' wave' : ''); if (t.col !== 'wave') sp.style.color = t.col; sp.textContent = `「${t.name}」`; return sp; }
if (TI && $('titlePanel')) TI.mountPanel($('titlePanel'));
window.addEventListener('injoo-title-eq', () => sendTitle());
window.addEventListener('injoo-title', e => {
  const t = e.detail;
  if (game) { say(`칭호 획득 ─ 「${t.name}」`, t.col === 'wave' ? '#ffffff' : t.col, 5); sfx.chime && sfx.chime(); } else addSys(`칭호 획득 ─ 「${t.name}」`);
});
// 멀티 칭호 판정 (이 기기의 기록)
const tGive = id => TI && TI.give(id);
function sendSkin() { send({ type: 'skin', v: mine.alice === SKIN_DEFAULT ? null : mine.alice, d: mine.dream !== DSKIN_DEFAULT && dskinValid(mine.dream) ? mine.dream : null, vf: mine.aliceF, df: mine.dreamF, e: mine.deye }); }
const skinEd = (() => {
  const cv_ = $('skinCv'), cx = cv_.getContext('2d'), pv = $('skinPv'), px = pv.getContext('2d');
  const CS = 14;
  let kind = 'alice', D = SK.alice, idxOf = null, free = false;
  const col = { alice: 8, dream: 11 }, fcol = { alice: 'b22228', dream: 'ff2828' };
  let recent = (() => { const v = store.get('recentCols', null); return Array.isArray(v) ? v.filter(h => /^[0-9a-f]{6}$/.test(h)).slice(0, 12) : []; })();
  let sym = true, tool = 'pen', painting = false, msgT = 0;
  const hex = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const pal = $('skinPal');
  // 지금 칸들의 색 (자유 모드: 칸마다 RRGGBB)
  const palHex = (D_, ch) => ch === 'x' ? 'xxxxxx' : rgbHex(D_.PAL[parseInt(ch, 16)] || D_.PAL[0]);
  const freeOf = k => { const D_ = SK[k], f = mine[k + 'F']; if (f) return f; return '#' + D_.MASK.map((_, i) => palHex(D_, mine[k][i])).join(''); };
  const cellRGB = i => { if (free) { const q = freeOf(kind).substr(1 + i * 6, 6); return q === 'xxxxxx' ? null : hexRgb(q); } const ch = mine[kind][i]; return ch === 'x' ? null : D.PAL[parseInt(ch, 16)]; };
  let clear = false; // 투명 칠하기
  const isEye = i => kind === 'dream' && mine.deye.includes(i);
  const clearCount = () => { let n = 0; if (free) { const f = freeOf(kind); for (let i = 0; i < D.MASK.length; i++) if (f.substr(1 + i * 6, 6) === 'xxxxxx') n++; } else for (const ch of mine[kind]) if (ch === 'x') n++; return n; };
  function setKind(k) {
    kind = k; D = SK[k];
    cv_.width = D.W * CS; cv_.height = D.H * CS; cv_.style.height = (D.H * CS) + 'px'; pv.width = D.W; pv.height = D.H; pv.style.height = (D.H * 3) + 'px';
    idxOf = new Int16Array(D.W * D.H).fill(-1); D.MASK.forEach((kk, i) => idxOf[kk] = i);
    pal.textContent = '';
    D.PAL.forEach((c, i) => { const b = document.createElement('button'); b.type = 'button'; b.style.background = hex(c); b.setAttribute('aria-label', `색 ${i + 1}`); if (i >= D.bright) b.classList.add('glow'); b.addEventListener('click', () => { col[kind] = i; clear = false; mark(); }); pal.append(b); });
    $('skinTabA').classList.toggle('on', k === 'alice'); $('skinTabD').classList.toggle('on', k === 'dream');
    rule(); picker.set(fcol[kind]); mark(); draw(); if (typeof presetsUI === 'function') presetsUI();
  }
  function rule() {
    $('skinRule').textContent = free
      ? `자유 색상 모드 — 칸 수 제한 없이 아무 색이나 칠할 수 있어요.${kind === 'dream' ? ' 아주 밝은 색은 어둠 속에서 스스로 빛나요.' : ''} ${D.name}가 됐을 때 이 모습으로 나와요.`
      : kind === 'alice' ? '모양은 고정이고 색만 바꿀 수 있어요. 앨리스가 됐을 때 이 모습으로 나와요.' : `꿈은 어두운 색 위주예요. 빛나는 색(아래 줄)을 ${DSKIN_BRIGHT_MIN}칸 이상 칠해야 적용돼요 (최대 ${DSKIN_BRIGHT_MAX}칸). 꿈이 됐을 때 이 모습으로 나와요.`;
    pal.hidden = free; $('skinPick').hidden = !free;
  }
  const mark = () => { [...pal.children].forEach((b, i) => b.classList.toggle('on', i === col[kind])); $('skinSym').classList.toggle('on', sym); $('skinFill').classList.toggle('on', tool === 'fill'); $('skinDrop').classList.toggle('on', tool === 'drop'); $('skinDrop').hidden = !free; $('skinClear').classList.toggle('on', clear); $('skinEye').classList.toggle('on', tool === 'eye'); $('skinEye').hidden = kind !== 'dream'; };
  const darkN = s => { let n = 0; for (const ch of s) if (ch === '2' || ch === '7') n++; return n; };
  const brightN = s => { let n = 0; for (const ch of s) if (ch !== 'x' && parseInt(ch, 16) >= DSKIN_BRIGHT) n++; return n; };
  const xN = s => { let n = 0; for (const ch of s) if (ch === 'x') n++; return n; };
  const say_ = t => { $('skinMsg').textContent = t; clearTimeout(msgT); msgT = setTimeout(() => { $('skinMsg').textContent = ''; }, 2200); };
  const queue = () => { clearTimeout(skinSendT); skinSendT = setTimeout(sendSkin, 250); };
  function commit(next) {
    const cur = mine[kind]; if (next === cur) return;
    if (kind === 'alice' && darkN(next) > SKIN_DARK_MAX && darkN(next) > darkN(cur)) { say_(`아주 어두운 색은 ${SKIN_DARK_MAX}칸까지만 칠할 수 있어요.`); return; }
    if (kind === 'dream' && brightN(next) > DSKIN_BRIGHT_MAX && brightN(next) > brightN(cur)) { say_(`빛나는 색은 ${DSKIN_BRIGHT_MAX}칸까지만 칠할 수 있어요.`); return; }
    if (xN(next) > SKIN_CLEAR_MAX && xN(next) > xN(cur)) { say_(`투명은 ${SKIN_CLEAR_MAX}칸까지만 쓸 수 있어요.`); return; }
    mine[kind] = next; store.set(D.key, next === D.DEF ? null : next); draw(); queue();
  }
  function setCells(list) {
    if (clear && kind === 'dream' && list.some(isEye)) { list = list.filter(i => !isEye(i)); say_('눈 칸은 투명하게 할 수 없어요.'); if (!list.length) return; }
    if (free) {
      const s = freeOf(kind).split(''), h = clear ? 'xxxxxx' : fcol[kind];
      for (const i of list) for (let j = 0; j < 6; j++) s[1 + i * 6 + j] = h[j];
      const next = s.join(''); if (next === mine[kind + 'F']) return;
      if (clear) { let n = 0; for (let i = 0; i < D.MASK.length; i++) if (next.substr(1 + i * 6, 6) === 'xxxxxx') n++; if (n > SKIN_CLEAR_MAX) { say_(`투명은 ${SKIN_CLEAR_MAX}칸까지만 쓸 수 있어요.`); return; } }
      mine[kind + 'F'] = next; store.set(D.fkey, next); draw(); queue();
      if (!clear && !recent.includes(h)) { recent.unshift(h); recent = recent.slice(0, 12); try { store.set('recentCols', recent); } catch (_) {} picker.recents(); }
      return;
    }
    const a = mine[kind].split(''); const h = clear ? 'x' : col[kind].toString(16); for (const i of list) a[i] = h; commit(a.join(''));
  }
  const valAt = i => free ? freeOf(kind).substr(1 + i * 6, 6) : mine[kind][i];
  function cellsAt(x, y) { const out = []; const add = xx => { const i = idxOf[y * D.W + xx]; if (i >= 0 && !out.includes(i)) out.push(i); }; add(x); if (sym) add(D.W - 1 - x); return out; }
  function region(x, y, seen) {
    const st = idxOf[y * D.W + x]; if (st < 0) return [];
    const from = valAt(st), q = [[x, y]], out = [];
    while (q.length) { const [qx, qy] = q.pop(); if (qx < 0 || qy < 0 || qx >= D.W || qy >= D.H) continue; const k = qy * D.W + qx; if (seen.has(k)) continue; seen.add(k); const i = idxOf[k]; if (i < 0 || valAt(i) !== from) continue; out.push(i); q.push([qx + 1, qy], [qx - 1, qy], [qx, qy + 1], [qx, qy - 1]); }
    return out;
  }
  function flood(x, y) { const seen = new Set(), out = region(x, y, seen); if (sym) out.push(...region(D.W - 1 - x, y, seen)); return out; }
  function at(e) { const r = cv_.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * D.W), Math.floor((e.clientY - r.top) / r.height * D.H)]; }
  cv_.addEventListener('pointerdown', e => {
    e.preventDefault(); const [x, y] = at(e);
    if (tool === 'eye') {
      const i = idxOf[y * D.W + x]; if (i < 0 || kind !== 'dream') return;
      if (!cellRGB(i)) { say_('투명 칸은 눈이 될 수 없어요.'); return; }
      const e = mine.deye.slice(), at = e.indexOf(i);
      if (at >= 0) { if (e.length <= 1) { say_('눈은 최소 1개가 있어야 해요.'); return; } e.splice(at, 1); }
      else { e.push(i); if (e.length > 2) e.shift(); }
      mine.deye = e; store.set('deye', e); draw(); queue(); say_(`눈 ${e.length}개 — 꿈이 깨어나면 이 칸이 붉게 빛나요.`); return;
    }
    if (tool === 'drop') { const i = idxOf[y * D.W + x]; if (i >= 0 && free) { const v = valAt(i); if (v === 'xxxxxx') clear = true; else { fcol[kind] = v; picker.set(v); clear = false; } tool = 'pen'; mark(); } return; }
    if (tool === 'fill') { setCells(flood(x, y)); return; }
    painting = true; try { cv_.setPointerCapture(e.pointerId); } catch (_) {} setCells(cellsAt(x, y));
  });
  cv_.addEventListener('pointermove', e => { if (!painting) return; const [x, y] = at(e); if (x >= 0 && y >= 0 && x < D.W && y < D.H) setCells(cellsAt(x, y)); });
  const stop = () => { painting = false; };
  cv_.addEventListener('pointerup', stop); cv_.addEventListener('pointercancel', stop);
  $('skinSym').addEventListener('click', () => { sym = !sym; mark(); });
  $('skinFill').addEventListener('click', () => { tool = tool === 'fill' ? 'pen' : 'fill'; mark(); });
  $('skinDrop').addEventListener('click', () => { tool = tool === 'drop' ? 'pen' : 'drop'; mark(); });
  $('skinEye').addEventListener('click', () => { tool = tool === 'eye' ? 'pen' : 'eye'; clear = false; mark(); if (tool === 'eye') say_('눈으로 정할 칸을 누르세요 (1~2개).'); });
  $('skinClear').addEventListener('click', () => { clear = !clear; if (tool === 'drop') tool = 'pen'; mark(); if (clear) say_(`투명으로 칠해요 (최대 ${SKIN_CLEAR_MAX}칸). 지금 ${clearCount()}칸.`); });
  $('skinReset').addEventListener('click', () => { // 팔레트 그림과 자유 색상 그림 둘 다 지워서 진짜 기본으로
    mine[kind + 'F'] = null; store.set(D.fkey, null);
    mine[kind] = D.DEF; store.set(D.key, null);
    if (kind === 'dream') { mine.deye = DSKIN_EYES.slice(); store.set('deye', null); }
    draw(); clearTimeout(skinSendT); skinSendT = setTimeout(sendSkin, 100); say_(`기본 ${D.name}(으)로 돌아왔어요.`);
  });
  // 프리셋: 탭마다 5칸. 칸을 누르면 불러오고, 「저장」을 켠 뒤 칸을 누르면 지금 모습을 저장
  let presets = (() => { const v = store.get('presets', null); return v && Array.isArray(v.alice) && Array.isArray(v.dream) ? v : { alice: [null, null, null, null, null], dream: [null, null, null, null, null] }; })();
  let saving = false;
  const preBox = $('skinPre');
  function presetsUI() {
    preBox.textContent = '';
    presets[kind].forEach((v, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pre' + (v ? '' : ' empty') + (saving ? ' saving' : '');
      b.setAttribute('aria-label', `프리셋 ${i + 1}`);
      const vs = v ? v.split('|')[0] : v;
      if (v) { const v = vs; const c = document.createElement('canvas'); c.width = D.W; c.height = D.H; const x = c.getContext('2d'), im = x.createImageData(D.W, D.H), f = v[0] === '#';
        D.MASK.forEach((k, j) => { const q = f ? v.substr(1 + j * 6, 6) : v[j]; if (q === 'x' || q === 'xxxxxx') return; const col = f ? hexRgb(q) : D.PAL[parseInt(q, 16)] || D.PAL[0]; im.data.set([col[0], col[1], col[2], 255], k * 4); }); x.putImageData(im, 0, 0); b.append(c); }
      else b.textContent = saving ? '+' : String(i + 1);
      b.addEventListener('click', () => {
        if (saving) {
          presets[kind][i] = (free ? freeOf(kind) : mine[kind]) + (kind === 'dream' ? '|' + mine.deye.join(',') : ''); store.set('presets', presets); saving = false; $('skinSave').classList.remove('on'); presetsUI(); say_(`${i + 1}번 프리셋에 저장했어요.`); return;
        }
        if (!v) { say_('빈 칸이에요. 「저장」을 누른 뒤 칸을 고르면 저장돼요.'); return; }
        const pe = v.split('|')[1]; if (kind === 'dream' && pe) { const e = pe.split(',').map(Number); if (eyesValid(e)) { mine.deye = e; store.set('deye', e); } }
        const v0 = v; { const v = v0.split('|')[0];
        if (v[0] === '#') {
          if (!free) { say_('자유 색상으로 만든 프리셋은 자유 색상 모드에서만 불러올 수 있어요.'); return; }
          mine[kind + 'F'] = v; store.set(D.fkey, v);
        } else if (free) { mine[kind + 'F'] = '#' + D.MASK.map((_, j) => palHex(D, v[j])).join(''); store.set(D.fkey, mine[kind + 'F']); }
        else { mine[kind] = v; store.set(D.key, v === D.DEF ? null : v); }
        draw(); queue(); say_(`${i + 1}번 프리셋을 불러왔어요.`); }
      });
      preBox.append(b);
    });
  }
  $('skinSave').addEventListener('click', () => { saving = !saving; $('skinSave').classList.toggle('on', saving); presetsUI(); if (saving) say_('저장할 칸을 고르세요.'); });
  $('skinTabA').addEventListener('click', () => setKind('alice'));
  $('skinTabD').addEventListener('click', () => setKind('dream'));
  // 색 고르기 (채도·명도 판 + 색상 막대 + 코드)
  const picker = (() => {
    const sv = $('pickSV'), hu = $('pickHue'), sx = sv.getContext('2d'), hx = hu.getContext('2d'), inp = $('pickHex'), sw = $('pickSw'), rc = $('pickRecent');
    let H = 0, S = 1, V = 1, pickTouched = false;
    const hsv2rgb = (h, s, v) => { const f = n => { const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); }; return [f(5), f(3), f(1)]; };
    const rgb2hsv = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx]; };
    function paint() {
      const w = sv.width, h = sv.height;
      sx.fillStyle = `hsl(${H},100%,50%)`; sx.fillRect(0, 0, w, h);
      let g = sx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); sx.fillStyle = g; sx.fillRect(0, 0, w, h);
      g = sx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, '#000'); sx.fillStyle = g; sx.fillRect(0, 0, w, h);
      sx.strokeStyle = V > .5 ? '#000' : '#fff'; sx.lineWidth = 1.5; sx.beginPath(); sx.arc(S * w, (1 - V) * h, 6, 0, 7); sx.stroke();
      const gh = hx.createLinearGradient(0, 0, 0, hu.height); for (let i = 0; i <= 6; i++) gh.addColorStop(i / 6, `hsl(${i * 60},100%,50%)`); hx.fillStyle = gh; hx.fillRect(0, 0, hu.width, hu.height);
      hx.fillStyle = '#fff'; hx.fillRect(0, H / 360 * hu.height - 1.5, hu.width, 3); hx.strokeStyle = '#000'; hx.strokeRect(.5, H / 360 * hu.height - 2, hu.width - 1, 4);
      const c = hsv2rgb(H, S, V), hh = rgbHex(c); sw.style.background = '#' + hh; if (document.activeElement !== inp) inp.value = hh; fcol[kind] = hh; if (clear && pickTouched) { clear = false; mark(); } pickTouched = false;
    }
    const drag = (el, fn) => { let on = false; const go = e => { const r = el.getBoundingClientRect(); fn(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)); paint(); };
      el.addEventListener('pointerdown', e => { e.preventDefault(); on = true; pickTouched = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} go(e); });
      el.addEventListener('pointermove', e => { if (on) go(e); }); el.addEventListener('pointerup', () => { on = false; }); el.addEventListener('pointercancel', () => { on = false; }); };
    drag(sv, (u, v) => { S = u; V = 1 - v; }); drag(hu, (_, v) => { H = v * 359.9; });
    inp.addEventListener('input', () => { pickTouched = true; const v = inp.value.trim().replace(/^#/, '').toLowerCase(); if (/^[0-9a-f]{6}$/.test(v)) { [H, S, V] = rgb2hsv(hexRgb(v)); paint(); } });
    function recents() { rc.textContent = ''; for (const h of recent) { const b = document.createElement('button'); b.type = 'button'; b.style.background = '#' + h; b.setAttribute('aria-label', '#' + h); b.addEventListener('click', () => { pickTouched = true; set(h); }); rc.append(b); } }
    function set(h) { [H, S, V] = rgb2hsv(hexRgb(h)); inp.value = h; paint(); }
    recents(); paint();
    return { set, recents };
  })();
  function setFree(v) { if (v === free) return; free = v; if (free && tool === 'drop') tool = 'pen'; if (!free && tool === 'drop') tool = 'pen'; rule(); mark(); draw(); }
  function draw() {
    cx.fillStyle = '#0a0809'; cx.fillRect(0, 0, cv_.width, cv_.height);
    for (let y = 0; y < D.H; y++) for (let x = 0; x < D.W; x++) {
      const i = idxOf[y * D.W + x];
      if (i < 0) { cx.fillStyle = (x + y) & 1 ? '#121012' : '#0d0b0c'; cx.fillRect(x * CS, y * CS, CS, CS); continue; }
      const cc = cellRGB(i);
      if (!cc) { for (let q = 0; q < 4; q++) { cx.fillStyle = (q === 0 || q === 3) ? '#6a6460' : '#3a3632'; cx.fillRect(x * CS + (q & 1) * CS / 2, y * CS + (q >> 1) * CS / 2, CS / 2, CS / 2); } continue; }
      cx.fillStyle = hex(cc); cx.fillRect(x * CS, y * CS, CS, CS);
      cx.strokeStyle = kind === 'dream' ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.25)'; cx.strokeRect(x * CS + .5, y * CS + .5, CS - 1, CS - 1);
      if (isEye(i)) { cx.strokeStyle = '#ff2a2a'; cx.lineWidth = 2; cx.strokeRect(x * CS + 1.5, y * CS + 1.5, CS - 3, CS - 3); cx.lineWidth = 1; cx.fillStyle = '#ff2a2a'; cx.beginPath(); cx.arc(x * CS + CS / 2, y * CS + CS / 2, 2, 0, 7); cx.fill(); }
    }
    const im = px.createImageData(D.W, D.H);
    D.MASK.forEach((k, i) => { const c = cellRGB(i); if (c) im.data.set([c[0], c[1], c[2], 255], k * 4); });
    px.clearRect(0, 0, D.W, D.H); px.putImageData(im, 0, 0);
    let st;
    if (free) st = mine[kind + 'F'] ? `꾸민 ${D.name} (자유 색상)` : `기본 ${D.name}`;
    else if (kind === 'alice') st = mine.alice === D.DEF ? '기본 앨리스' : '꾸민 앨리스';
    else if (mine.dream === D.DEF) st = '기본 꿈';
    else { const n = brightN(mine.dream); st = n < DSKIN_BRIGHT_MIN ? `빛나는 색 ${n}/${DSKIN_BRIGHT_MIN} — 아직 기본 꿈으로 나와요` : '꾸민 꿈'; }
    { const n = clearCount(); if (n) st += ` · 투명 ${n}/${SKIN_CLEAR_MAX}`; }
    if (kind === 'dream') st += ` · 눈 ${mine.deye.length}`;
    $('skinState').textContent = st;
  }
  setKind('alice');
  return { draw, setFree };
})();

/* =========================================================
   게임 상태
   ========================================================= */
let game = null;
function startGame(m) {
  const world = genWorld(m.seed, m.map);
  if (m.sig && worldSig(world) !== m.sig) { reloadAndRejoin(); return; }
  const players = new Map(m.players.map(p => [p.id, { id: p.id, name: p.name, role: p.role, title: p.t || null, snaps: [], cur: null }]));
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
  game.skins = new Map(); for (const p of m.players) { if (!p.skin) continue; const k = p.role === 'dream' ? 'dream' : 'alice'; if (freeSkinValid(p.skin, k) || (k === 'dream' ? dskinValid(p.skin) : skinValid(p.skin))) game.skins.set(p.id, skinSprite(p.skin, k)); }
  game.stealth = !!m.stealth; game.mySth = 0; game.myStc = 0; game.hn = 0; game.sd = 0; game.anySth = false; game.sBtn = null;
  game.fate = !!m.fate; game.pred.dcd = game.fate ? 5 : CFG.DASH_CD; game.boost = !!m.boost; game.sb = 1;
  game.awake = !!m.awake; game.aw = 0; game.awT = 0; game.eyes = new Map(); for (const p of m.players) if (p.role === 'dream' && eyesValid(p.eyes)) game.eyes.set(p.id, eyeCoords(p.eyes));
  Object.assign(game, { trail: new Map(), pings: [], track: [], myF: '', fcard: null, cT: 0, twins: null, mbT: 0 });
  game.mapImg = buildMap(world);
  game.pdist = cellField(world);
  if (world.fogOfWar && game.role === 'alice') { game.seen = new Uint8Array(world.N * world.N); game.fogImg = document.createElement('canvas'); game.fogImg.width = game.fogImg.height = world.N; const fx_ = game.fogImg.getContext('2d'); fx_.fillStyle = '#050403'; fx_.fillRect(0, 0, world.N, world.N); }
  say(`맵: ${MAP_NAMES[world.map] || '숲'}`, '#cfc6b6', 4);
  show('scGame');
  $('endBox').hidden = true;
  const phone = device === 'phone';
  $('touch').hidden = !phone;
  $('tDash').hidden = game.role !== 'dream'; $('tDash').textContent = '대시'; $('tFate').hidden = true; game.fBtn = null;
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
  g.sb = m.sb || 1; g.pred.sb = g.sb;
  g.lastId = m.la || null; g.pred.last = g.lastId === myId ? 1 : 0;
  if (g.awake) { const pa = g.aw; g.aw = m.aw || 0; g.awT = m.awT || 0; g.pred.awk = g.role === 'dream' && g.aw === 2 ? 1 : 0; if (pa !== g.aw) awakeTurn(g, pa, g.aw); }
  g.T = m.T; g.intro = m.in; g.tr = m.tr; g.tp = m.tp; g.rp = m.rp; g.door = m.door; g.cams = m.cams; g.cp = m.cp;
  for (const s of m.p) {
    const pl = g.players.get(s.i); if (!pl) continue;
    pl.cur = s; pl.snaps.push({ t, x: s.x, z: s.z, y: s.y }); if (pl.snaps.length > 30) pl.snaps.shift();
  }
  if (g.fate) {
    g.twins = m.tw || null;
    const me0 = m.p.find(p => p.i === myId); if (me0) { if ((me0.f || '').includes('C') && !g.myF.includes('C')) g.cT = t; g.myF = me0.f || ''; g.myFc = me0.fc || 0; }
    // 붉은 검의 길 (꿈에게만 보인다)
    if (g.role === 'dream') for (const s0 of m.p) {
      const pl = g.players.get(s0.i); if (!pl || pl.role !== 'alice') continue;
      let tr = g.trail.get(s0.i); if (!tr) g.trail.set(s0.i, tr = []);
      if (s0.s === 0 && (s0.f || '').includes('S')) { const l = tr[tr.length - 1]; if (!l || Math.hypot(l.x - s0.x, l.z - s0.z) > .5) tr.push({ x: s0.x, z: s0.z, t, br: !!(l && Math.hypot(l.x - s0.x, l.z - s0.z) > 3) }); }
      while (tr.length && t - tr[0].t > 20000 && !(s0.f || '').includes('S')) tr.shift();
      if (tr.length > 600) tr.shift();
    }
  }
  if (g.stealth) { g.hn = m.hn || 0; g.sd = m.sd || 0; g.anySth = m.p.some(q => q.h > 0); const me1 = m.p.find(q => q.i === myId); g.sthBefore = g.mySth; g.mySth = me1 && me1.h || 0; g.myStc = me1 && me1.hc || 0; }
  for (const e of m.ev) handleEv(e);
  const s = m.p.find(p => p.i === myId);
  if (s) {
    g.meS = s;
    const P = g.pred;
    if (s.s === 0) {
      const ox = P.x, oz = P.z, was = P.st === 0;
      Object.assign(P, { x: s.x, z: s.z, dc: s.dc, dt: s.dt, sn: s.sn, carry: s.c, st: 0, pc: s.pc || 0, chm: s.ch || 0, tw: s.w || 0 });
      g.pending = g.pending.filter(i => i.q > m.ack);
      for (const i of g.pending) stepPlayer(g.world, P, i, CFG.INPUT_DT);
      P.warp = null;
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
  // 칭호 판정
  const tk = g.tk || (g.tk = { jailed: 0, jails: 0, last: false });
  if (e.k === 'catch' && e.d === myId && g.sthBefore > 0) tGive('hidden');               // 숨은 꿈: 은신 중에 잡기
  if (e.k === 'jail' && e.a === myId && ++tk.jailed >= 3) tGive('jail');                  // 감옥 단골: 한 판 3번
  if (e.k === 'jail' && e.d === myId) tk.jails++;                                         // 작은 꿈 (끝날 때 판정)
  if (e.k === 'free' && e.a === myId && e.struggle && TI && TI.inc('strug') >= 10) tGive('strug'); // 몸부림 장인
  if (e.k === 'burn' && e.d === myId && TI && TI.inc('burn') >= 5) tGive('hot');          // 앗뜨거!
  if (e.k === 'last' && e.a === myId) tk.last = true;
  if (e.k === 'esc' && e.a === myId && tk.last) tGive('alone');                           // 홀로 남은 앨리스
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
      setTimeout(() => { const per = trPer(g); if (game === g && per > 0) say(g.role === 'dream' ? `흔적이 모일수록 꿈은 짙어진다 — 속도 +${(n * per * 100).toFixed(1).replace(/\.0$/, '')}%` : '…꿈이 조금 더 빨라졌다', g.role === 'dream' ? '#ff7070' : '#c8a0a0', 3); }, 900);
      say(`${tr.suit} ${josa(nameOf(e.by), '이', '가')} ${josa(tr.name, '을', '를')} 찾았다 (${n}/5)`, tr.color === '#b49b2e' ? '#e0c860' : tr.color === '#4a64c8' ? '#9fb0ff' : tr.color === '#3e8a4c' ? '#8fd29a' : '#ff7a7a', 5);
      break;
    }
    case 'door':
      sfx.choir(); fx.glitch = .6;
      say(g.role === 'dream' ? '하늘에 문이 열렸다. 앨리스들이 빠져나가려 한다!' : '하늘에 문이 열렸다! 빛기둥으로 달려가!', '#ffffff', 7);
      if (g.stealth && g.role === 'dream') setTimeout(() => { if (game === g) say(`어둠이 짙어졌다 — ${device === 'phone' ? '「은신」' : 'F'}로 10초 동안 기척을 숨길 수 있다 (한 번)`, '#c0a0ff', 6); }, 1500);
      break;
    case 'sth':
      if (e.d === myId) { fx.glitch = .9; sfx.reverse(); vib(60); g.sthFlash = performance.now(); say('기척을 지웠다 — 10초 동안 앨리스가 너를 느끼지 못한다', '#c0a0ff', 3.5); }
      else if (g.role === 'dream') say(`${josa(nameOf(e.d), '이', '가')} 기척을 지웠다 (10초)`, '#c0a0ff', 3);
      else { sfx.reverse(); fx.glitch = .5; say('…어딘가에서 꿈의 기척이 사라졌다', '#c0a0c0', 4.5); }
      break;
    case 'sthEnd':
      if (e.d === myId) say('기척이 돌아왔다', '#a89e90', 2.5);
      break;
    case 'esc':
      sfx.chime();
      say(e.a === myId ? '꿈에서 빠져나왔다.' : `${josa(nameOf(e.a), '이', '가')} 꿈에서 빠져나갔다`, '#ffffff', 5);
      break;
    case 'burn': {
      at(e.x, e.z, 30, sfx.burn);
      if (e.d === myId) { fx.glitch = 1.8; g.burnFlash = 1; say('빛에 타들어 가 튕겨 나갔다… (잠시 움직일 수 없음)', '#ffe0a0', 4); vib([120, 40, 200]); }
      else if (g.role === 'alice') say('빛기둥이 꿈을 튕겨 냈다!', '#fff6d0', 3);
      break;
    }
    case 'cam': {
      const c = w.cams[e.i]; at(c.x, c.z, 30, e.on ? sfx.chime : sfx.clang);
      if (e.on) say(e.by === myId ? `CAM ${String(e.i + 1).padStart(2, '0')} 을(를) 다시 켰다` : `CAM ${String(e.i + 1).padStart(2, '0')} 이(가) ${e.by ? '' : '저절로 '}다시 켜졌다`, '#9fe0ff', 3);
      else say(g.role === 'dream' ? `CAM ${String(e.i + 1).padStart(2, '0')} 을(를) 껐다 (2분 30초 뒤 다시 켜진다)` : `CAM ${String(e.i + 1).padStart(2, '0')} 신호가 끊겼다`, '#e07070', 3);
      if (g.cctv) fx.glitch = .6;
      break;
    }
    case 'warp': {
      if (e.a !== myId) { at(e.x, e.z, 25, sfx.warp); at(e.fx, e.fz, 25, sfx.warp); }
      else if (e.ey != null && Math.hypot(g.pred.x - e.fx, g.pred.z - e.fz) > 1.5) { g.yaw = e.ey; g.smooth.x = g.smooth.z = 0; sfx.warp(); fx.glitch = 1.2; } // 서버에서만 넘어간 경우에도 시점을 맞춘다
      break;
    }
    case 'mb': { const tr = w.traces[e.i]; at(tr.x, tr.z, 45, () => sfx.music((now * 3 | 0) % 5)); break; }
    case 'fate': {
      const F = FATES[e.k]; if (!F) break;
      if (e.a === myId) { g.fcard = { k: e.k, t: performance.now() }; sfx.choir(); fx.glitch = .8; }
      else say(`${F.suit} ${josa(nameOf(e.a), '이', '가')} ${F.who}의 운명을 이어받았다`, F.col, 4);
      break;
    }
    case 'flose': { const F = FATES[e.k]; if (F && e.a === myId) say(`${F.suit} ${F.lose}`, '#a89e90', 3.5); break; }
    case 'fclear': if (e.a === myId) say('갇히는 순간 이어받은 운명이 흩어졌다…', '#a89e90', 3.5); break;
    case 'fu': {
      const F = FATES[e.k]; if (!F) break;
      if (g.role === 'dream') g.pings.push({ x: e.x, z: e.z, t: performance.now(), dur: 3, col: F.col });
      if (e.a === myId) { g.fflash = { text: e.k === 'S' ? '♠ 베었다! 꿈 3초 기절' : e.k === 'C' ? `♥ 홀렸다! 꿈 3초간 느려짐${e.u > 0 ? ` (남은 ${e.u}회)` : ' — 왕관이 바스러졌다'}` : '♦ 노래로 감옥 문을 빨리 열었다', col: F.col, t: performance.now() }; sfx.choir(); fx.glitch = .6; vib(80); }
      if (e.k === 'S') { at(e.x, e.z, 30, sfx.swing); at(e.x, e.z, 30, sfx.clang); at(e.x, e.z, 45, sfx.scream); if (e.d === myId) g.crack = performance.now(); else if (g.role === 'alice' && Math.hypot(g.cam.x - e.x, g.cam.z - e.z) < 22) g.redFlash = 1; if (e.d === myId) { fx.glitch = 1.6; g.burnFlash = .5; vib([120, 40, 200]); say(chicken ? '뿅망치에 맞았다! (3초 기절)' : '붉은 검에 베였다! (3초 기절)', '#ff7070', 3); } else say(`♠ ${josa(nameOf(e.a), '이', '가')} 붉은 검으로 꿈을 베었다!`, '#ff8a8a', 3); }
      else if (e.k === 'C') { at(e.x, e.z, 30, sfx.choir); if (e.d === myId) { fx.glitch = 1; g.charmT = performance.now(); say('여왕의 아름다움에 홀렸다… (3초간 느려짐)', '#8fd29a', 3); } else say(`♥ ${josa(nameOf(e.a), '이', '가')} 꿈을 홀렸다${e.u > 0 ? '' : ' — 왕관이 바스러졌다'}`, '#8fd29a', 3); }
      else if (e.k === 'M') { sfx.song(); fx.glitch = .5; say('♦ 노래가 꿈 전체에 울린다… 갇힌 앨리스들이 따라 부른다', '#9fb0ff', 4.5); }
      break;
    }
    case 'rv': if (e.dr && g.sd && g.mySth > 0) break; // 숨은 꿈: 인원 차가 적으면 은신 중엔 위치 공개를 못 받는다
      if (g.role === 'dream') { for (const [x, z] of e.pts) g.pings.push({ x, z, t: performance.now(), dur: e.dur, col: e.tw ? '#e0c860' : e.lst ? '#ffffff' : '#ff5050' }); if (!e.tw) { sfx.whisper(1); } } else if (e.lst && g.lastId === myId) sfx.whisper(.8); break;
    case 'last': {
      if (!e.a) { if (g.wasLast) say('동료가 돌아왔다 — 더는 혼자가 아니다', '#cfe8d2', 4); g.wasLast = false; break; }
      if (e.a === myId) { g.wasLast = true; g.lastCard = performance.now(); fx.glitch = 1.6; sfx.heart(1); sfx.choir(); vib([100, 60, 100]); }
      else if (g.role === 'dream') say(`마지막 앨리스 ─ ${nameOf(e.a)}. 10초마다 위치가 드러난다`, '#ff6060', 5);
      else say(`${josa(nameOf(e.a), '이', '가')} 마지막 앨리스다…`, '#f0e0c0', 5);
      break;
    }
    case 'rv1': if (g.role === 'dream') { g.track.push({ id: e.a, until: performance.now() + e.dur * 1000 }); say('쌍둥이의 짝이 드러났다 — 지도를 봐라', '#e0c860', 3); } else if (e.a === myId) { sfx.scream(); fx.glitch = 1.4; g.fflash = { text: '「 …같이 가자 」', col: '#e0c860', t: performance.now() }; say('쌍둥이가 붙잡혔다… 꿈이 당신을 보고 있다 (10초)', '#e0c860', 4); } break;
  }
}

function onEnd(m) {
  const g = game; g.ended = { ...m, t: performance.now() }; g.fcard = null;
  if (TI && !g.titled) { // 판이 끝날 때의 칭호
    g.titled = true; const tk = g.tk || { jails: 0 }, mine = (m.scores || []).find(q => q.id === myId);
    if (m.mvp === myId && TI.inc('mvp') >= 30) tGive('fifth');                                            // 다섯 번째 앨리스
    if (g.role === 'dream' && m.win === 'dream' && tk.jails >= 3) tGive('small');                         // 작은 꿈
    if (g.role === 'alice' && m.win === 'alice' && mine && mine.d.esc > 0 && !mine.d.col && !mine.d.assist && !mine.d.res && !mine.d.stun) tGive('free'); // 무임승차
    if (chicken) { TI.flag('zzolM'); TI.checkZzol(); }                                                      // 쫄보킹 (멀티 한 판)
  }
  if (m.mvp) setTimeout(() => sfx.bell(), 900);
  if (document.pointerLockElement) document.exitPointerLock();
  $('endBox').hidden = false;
  const iWin = (m.win === 'alice') === (g.role === 'alice');
  if (iWin) sfx.choir(); else sfx.growl();
}

/* =========================================================
   지도
   ========================================================= */
function buildMap(w) {
  // 한 칸 = 4픽셀로 그려서, 작게 줄여도 얇은 벽이 사라지지 않게
  const MS = 4, c = document.createElement('canvas'); c.width = w.N * MS; c.height = w.N * MS;
  const x = c.getContext('2d'), id = x.createImageData(w.N * MS, w.N * MS), NW = w.N * MS;
  const cols = [[44, 52, 36], [150, 30, 30], [110, 110, 104], [110, 80, 50], [70, 84, 52], [120, 50, 70], [110, 30, 46], [88, 74, 38], [40, 38, 50], [24, 46, 34], [80, 88, 96], [44, 44, 52]];
  for (let i = 0; i < w.N * w.N; i++) {
    let col = cols[w.ground[i]];
    if (w.wall[i]) col = w.wall[i] === WL.BARS ? [160, 160, 160] : w.wall[i] === WL.CURTAIN ? [70, 70, 160] : w.wall[i] === WL.YPAPER ? [230, 214, 140] : w.wall[i] === WL.VELVET ? [160, 40, 60] : w.wall[i] === WL.MIRROR ? [150, 225, 255] : w.wall[i] === WL.PORTAL ? PORTAL_COLS[(w.portals[w.portalAt[i]] || { pair: 0 }).pair % 4] : w.wall[i] === WL.MARBLE ? [228, 240, 232] : w.wall[i] === WL.TVWALL ? [120, 200, 150] : w.wall[i] === WL.SHELF ? [130, 100, 70] : w.wall[i] === WL.ACOUSTIC ? [110, 110, 120] : [190, 190, 180];
    if (w.wall[i] === WL.YPAPER) col = [255, 240, 170];
    const cx0 = (i % w.N) * MS, cz0 = ((i / w.N) | 0) * MS;
    for (let dz = 0; dz < MS; dz++) for (let dx = 0; dx < MS; dx++) { const o = ((cz0 + dz) * NW + cx0 + dx) * 4; id.data[o] = col[0]; id.data[o + 1] = col[1]; id.data[o + 2] = col[2]; id.data[o + 3] = 255; }
  }
  x.putImageData(id, 0, 0);
  for (const t of w.trees) { x.fillStyle = t.seat ? 'rgb(80,20,30)' : 'rgb(20,30,18)'; x.fillRect(t.x * MS - 1.5, t.z * MS - 1.5, 3, 3); }
  return c;
}
const ENTRANCES = [{ x: 40, z: 49.2 }, { x: 30.8, z: 43 }, { x: 49.2, z: 37.5 }];
const prisonName = () => { const m = game && game.world.map; return m === 'theater' ? '무대 아래 감옥' : m === 'tea' ? '긴 식탁 방' : m === 'mirror' ? '거울 감옥' : m === 'studio' ? '녹음 부스' : '성 감옥'; };
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
  if (g.world.cams) g.world.cams.forEach((cm, i) => {
    const on = g.cams && g.cams[i], px = ox + cm.x * k, py = oy + cm.z * k, r = big ? 4 : 2;
    c.save(); c.translate(px, py); c.rotate(cm.yaw); c.fillStyle = on ? '#ff4040' : '#777'; c.beginPath(); c.moveTo(r * 1.6, 0); c.lineTo(-r, -r); c.lineTo(-r, r); c.closePath(); c.fill(); c.restore();
    // 카메라 번호: 화살표 뒤쪽(벽 쪽)에 작은 상자로
    const lx = px - Math.cos(cm.yaw) * (big ? 9 : 5), ly = py - Math.sin(cm.yaw) * (big ? 9 : 5), t = String(i + 1);
    c.font = big ? `bold 10px 'Nanum Gothic Coding', monospace` : `bold 7px 'Nanum Gothic Coding', monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const bw = big ? 10 : 6, bh = big ? 11 : 7;
    c.fillStyle = 'rgba(0,0,0,.8)'; c.fillRect(lx - bw / 2, ly - bh / 2, bw, bh);
    c.fillStyle = on ? '#ffb0b0' : '#bbbbbb'; c.fillText(t, lx, ly + .5);
    c.textBaseline = 'alphabetic';
  });
  if (g.world.monitors && big) for (const m of g.world.monitors) { c.fillStyle = '#9fe0ff'; c.fillRect(ox + m.x * k - 3, oy + m.z * k - 2, 6, 4); }
  if (g.role === 'dream' && g.fate) { // 붉은 길 · 드러난 위치
    c.lineCap = 'round';
    for (const tr of g.trail.values()) {
      if (tr.length < 2) continue;
      c.strokeStyle = chicken ? 'rgba(255,130,180,.85)' : 'rgba(220,30,30,.85)'; c.lineWidth = big ? 2.5 : 1.6;
      c.beginPath(); tr.forEach((q, i) => { const px = ox + q.x * k, py = oy + q.z * k; if (i === 0 || q.br) c.moveTo(px, py); else c.lineTo(px, py); }); c.stroke();
    }
    for (const q of g.pings) { const a = 1 - (tnow - q.t) / (q.dur * 1000), px = ox + q.x * k, py = oy + q.z * k, pr = (big ? 6 : 3.5) + Math.sin(now * 8) * (big ? 2 : 1); c.globalAlpha = clamp(a * 1.5, 0, 1); c.strokeStyle = q.col; c.lineWidth = big ? 2 : 1.2; c.beginPath(); c.arc(px, py, pr, 0, 7); c.stroke(); c.fillStyle = q.col; c.beginPath(); c.arc(px, py, big ? 2.5 : 1.4, 0, 7); c.fill(); }
    for (const q of g.track) { const p = g.players.get(q.id), ip = p && interp(p); if (!ip) continue; c.globalAlpha = 1; c.strokeStyle = '#e0c860'; c.lineWidth = big ? 2 : 1.2; c.beginPath(); c.arc(ox + ip.x * k, oy + ip.z * k, (big ? 6 : 3.5) + Math.sin(now * 10), 0, 7); c.stroke(); }
    c.globalAlpha = 1;
  }
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
  // 내 주변만 크게 (한 칸이 2픽셀 넘게 보이도록)
  const S = 80, ox = 8, oy = 32, N = g.world.N, VR = 16, k = S / (VR * 2), c = ctx, cam = g.cam;
  const OX = ox - (cam.x - VR) * k, OY = oy - (cam.z - VR) * k;
  c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(ox - 2, oy - 2, S + 4, S + 4);
  c.save(); c.beginPath(); c.rect(ox, oy, S, S); c.clip();
  c.fillStyle = '#050403'; c.fillRect(ox, oy, S, S);
  c.imageSmoothingEnabled = false; c.globalAlpha = .85; c.drawImage(g.mapImg, OX, OY, N * k, N * k); c.globalAlpha = 1;
  if (g.fogImg) c.drawImage(g.fogImg, OX, OY, N * k, N * k);
  g.world.traces.forEach((t, i) => { if (g.tr[i] || (g.seen && !g.seen[(t.z | 0) * N + (t.x | 0)])) return; c.fillStyle = t.color === '#4a64c8' ? '#8095ff' : t.color; c.fillRect(OX + t.x * k - 2, OY + t.z * k - 2, 4, 4); });
  if (g.door) { c.fillStyle = '#fff'; c.beginPath(); c.arc(OX + g.door.x * k, OY + g.door.z * k, 2.5 + Math.sin(now * 5), 0, 7); c.fill(); }
  mapMarkers(g, OX, OY, k, false);
  drawPingsMap(g, OX, OY, k, false);
  c.restore();
  c.save(); c.translate(OX + cam.x * k, OY + cam.z * k); c.rotate(cam.yaw);
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
  drawPingsMap(g, ox, oy, k, true);
  ctx.textBaseline = 'middle';
  ctx.save(); ctx.translate(ox + cam.x * k, oy + cam.z * k); ctx.rotate(cam.yaw);
  ctx.fillStyle = g.role === 'dream' ? '#ff5050' : '#ffffff';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-2, 0); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#cfc6b6'; ctx.font = `12px 'Nanum Myeongjo', serif`; ctx.textAlign = 'center';
  ctx.fillText(g.role === 'dream' ? `꿈의 지도 — ${CFG.REVEAL_EVERY}초마다 앨리스가 드러난다` : g.seen ? '가 본 곳만 보인다 — 파란 점: 동료, 빨간 점: 잡힌 동료' : '망가진 꿈의 지도 — 파란 점: 동료, 빨간 점: 잡힌 동료', W / 2, oy - 14);
  ctx.font = `10px 'Nanum Gothic Coding', monospace`; ctx.fillStyle = '#8d8478';
  ctx.fillText(device === 'phone' ? '지도를 누르면 동료에게 손짓 · 지도 버튼으로 닫기' : '지도를 클릭하면 동료에게 손짓 · M 으로 닫기', W / 2, oy + S + 14);
}

/* =========================================================
   매 프레임
   ========================================================= */
function revealFog(g) {
  if (!g.seen) return;
  const w = g.world, N = w.N, cx = g.cam.x, cz = g.cam.z, fc = g.fogImg.getContext('2d');
  for (let a = 0; a < 120; a++) {
    const ang = a / 120 * Math.PI * 2, dx = Math.cos(ang), dz = Math.sin(ang);
    for (let r = 0; r < 9; r += .3) {
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
  if (!chatOpen) { if (keys.arrowleft) g.yaw -= 2.4 * dt * SENS[sens]; if (keys.arrowright) g.yaw += 2.4 * dt * SENS[sens]; }
  // 입력을 30Hz로 쪼개어 예측 이동 + 서버 전송
  g.acc += dt; let n = 0;
  while (g.acc >= CFG.INPUT_DT && n < 6) {
    g.acc -= CFG.INPUT_DT; n++;
    const c = readControls();
    const inp = { q: ++g.seq, f: r2(c.f), s: r2(c.s), y: Math.round(g.yaw * 1000) / 1000, a: c.act ? 1 : 0, d: c.dash ? 1 : 0, ...(c.st ? { k: 1 } : {}) };
    if (c.dash && g.role === 'dream' && g.pred.st === 0 && g.pred.dc <= 0 && !g.pred.carry && !(g.intro > 0)) sfx.dash();
    g.pred.door = g.door;
    if (g.pred.st === 0 && !(g.intro > 0) && !g.ended) { stepPlayer(g.world, g.pred, inp, CFG.INPUT_DT); if (g.pred.warp != null) { g.yaw = g.pred.warp; g.pred.warp = null; g.smooth.x = g.smooth.z = 0; sfx.warp(); fx.glitch = 1.2; } }
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
      if (p.role !== 'dream' || !p.cur || p.cur.o === 0 || p.cur.h > 0) continue;
      const ip = interp(p); if (!ip) continue;
      const d = Math.hypot(ip.x - g.cam.x, ip.z - g.cam.z);
      if (d < nd) { nd = d; ndp = ip; }
    }
  }
  g.nearDream = nd;
  const terror = clamp(1 - (nd - 2) / (g.awake && g.aw === 2 ? 22 : 14), 0, 1);
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
    if (g.role === 'alice') { if (g.pred.last) drone(.15 + terror * .2, 1.3 + terror * .4, .8); else drone(.05 + terror * .22, 1 + terror * .5, .8); }
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
        if (p.role === 'dream') { if (!(p.cur.h > 0 && g.role === 'alice')) at(ip.x, ip.z, g.awake && g.aw === 2 ? 26 : 15, sfx.thud); }
        else at(ip.x, ip.z, g.role === 'dream' ? (p.id === g.lastId ? 18 : 11) : 7, () => sfx.step(1.6));
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
  if (g.fate) fateUpdate(g, dt);
  if (g.stealth && g.role === 'dream') stealthUpdate(g);
  fx.glitch = Math.max(0, fx.glitch - dt * 1.4);
}
// 숨은 꿈: 꿈 모바일 버튼 (운명 버튼 자리)
// 흔적 하나당 꿈 속도 증가치 (판 시작 때 앨리스÷꿈 비율: 1 이하 0, 3 이상 1.8%)
function trPer(g) { let a = 0, d = 0; for (const p of g.players.values()) p.role === 'dream' ? d++ : a++; return .018 * clamp((a / Math.max(1, d) - 1) / 2, 0, 1); }
function stealthState(g) {
  const ms = g.meS;
  if (g.mySth > 0) return { t: '은신 중', s: `${Math.ceil(g.mySth)}초`, ok: false, on: true };
  if (!g.myStc || !g.door || !ms || ms.s !== 0) return null;
  if (g.anySth) return { t: '은신', s: '동료 사용 중', ok: false };
  if (g.hn > 0) return { t: '은신', s: `${Math.ceil(g.hn)}초`, ok: false };
  if (Math.hypot(g.pred.x - g.door.x, g.pred.z - g.door.z) < CFG.BURN_R) return { t: '은신', s: '빛 곁', ok: false };
  return { t: '은신', s: '지금!', ok: true };
}
function stealthUpdate(g) {
  if (device !== 'phone') return;
  const st = stealthState(g), key = st ? `${st.t}|${st.s}|${st.ok ? 1 : 0}` : '';
  if (key !== g.sBtn) {
    const b = $('tFate');
    if (st) { b.hidden = false; $('tFateT').textContent = st.t; $('tFateS').textContent = st.s; b.classList.toggle('off', !st.ok && !st.on); b.style.setProperty('--fc', '#a080e0'); }
    else b.hidden = true;
    g.sBtn = key;
  }
}
function drawStealthHud(g, c, sh, tnow) {
  if (g.role !== 'dream') return;
  if (g.mySth > 0) {
    const k = clamp(g.mySth / 10, 0, 1);
    const rg = c.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .9);
    rg.addColorStop(0, 'rgba(20,0,40,0)'); rg.addColorStop(1, `rgba(30,10,60,${.35 + .2 * Math.sin(tnow / 300) * k})`);
    c.fillStyle = rg; c.fillRect(0, 0, W, H);
    const bw = 120; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(W / 2 - bw / 2 - 1, H - 72, bw + 2, 6); c.fillStyle = '#a080e0'; c.fillRect(W / 2 - bw / 2, H - 71, bw * k, 4);
    sh(`은신 ${g.mySth.toFixed(1)}초 — 빛기둥에 닿거나 앨리스를 잡으면 풀린다`, W / 2, H - 78, '#c0a0ff', `11px 'Nanum Gothic Coding', monospace`, 'center');
  } else if (device !== 'phone') {
    const st = stealthState(g);
    if (st) sh(`[F] 은신 ${st.s}`, 10, 142, st.ok ? '#c0a0ff' : '#8a8090', `11px 'Nanum Gothic Coding', monospace`);
  }
}
function nearDreamTo(g, x, z, r) { let best = null, bd = r; for (const p of g.players.values()) { if (p.role !== 'dream' || !p.cur || p.cur.s !== 0) continue; const ip = interp(p); if (!ip) continue; const d = Math.hypot(ip.x - x, ip.z - z); if (d <= bd) { bd = d; best = p; } } return best; }
function fateUpdate(g, dt) {
  // 오르골의 노랫소리 (모두에게, 가까울수록 크게)
  g.mbT -= dt;
  if (g.mbT <= 0) { g.mbT = .55; for (const p of g.players.values()) { if (!p.cur || p.cur.s !== 0 || !(p.cur.f || '').includes('M')) continue; const ip = p.id === myId ? g.cam : interp(p); if (ip) at(ip.x, ip.z, 30, () => sfx.music((now * 2.3 | 0) % 5)); } }
  // 앨리스 모바일 버튼: 쓸 수 있는 운명이 있을 때만
  if (g.role === 'alice' && device === 'phone') {
    const f = g.myF, ms = g.meS, sw = f.includes('S'), cr = f.includes('C');
    let key = '';
    if (ms && ms.s === 0 && (sw || cr)) {
      const st = fateTarget(g, g.pred, sw ? 2.2 : 6), cd = cr && !sw && g.myFc > 0;
      const title = sw ? '♠ 베기' : `♥ 홀리기 ${(f.match(/C(\d)/) || [0, ''])[1]}`;
      const sub = cd ? `${Math.ceil(g.myFc)}초` : st.ok ? '지금!' : st.why ? (st.why.includes('면역') ? '면역' : '멈춤') : '범위 밖';
      key = `${title}|${sub}|${cd || !st.ok ? 1 : 0}`;
      if (key !== g.fBtn) { const b = $('tFate'); b.hidden = false; $('tFateT').textContent = title; $('tFateS').textContent = sub; b.classList.toggle('off', cd || !st.ok); b.style.setProperty('--fc', FATES[sw ? 'S' : 'C'].col); }
    }
    if (!key && g.fBtn) $('tFate').hidden = true;
    g.fBtn = key;
  }
  // 지난 표시 정리
  const tn = performance.now();
  g.pings = g.pings.filter(q => tn - q.t < q.dur * 1000);
  g.track = g.track.filter(q => tn < q.until);
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
// 칭호 글씨 (다섯 번째 앨리스는 흑백 물결)
function drawTitleTag(c, id, x, y, size = 9) {
  const t = TI && TI.BY[id]; if (!t) return;
  const s = `「${t.name}」`; c.save(); c.font = `700 ${size}px 'Nanum Gothic Coding', monospace`; c.textAlign = 'center';
  c.fillStyle = 'rgba(0,0,0,.85)'; c.fillText(s, x + 1, y + 1);
  if (t.col === 'wave') { const w = c.measureText(s).width, gr = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0), ph = (now * .5) % 1; for (let i = 0; i <= 6; i++) { const p = ((i / 6) + ph) % 1; gr.addColorStop(p, i % 2 ? '#ffffff' : '#141414'); } c.fillStyle = gr; c.strokeStyle = 'rgba(120,120,120,.6)'; c.lineWidth = .6; c.strokeText(s, x, y); }
  else c.fillStyle = t.col;
  c.fillText(s, x, y); c.restore();
}
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
  const F = px => `${px}px 'Nanum Gothic Coding', monospace`;
  // 글자 폭에 맞춰 줄 바꾸기 (띄어쓰기 우선, 너무 길면 글자 단위)
  const wrap = (text, font, maxW) => {
    c.font = font; const out = []; let line = '';
    for (const word of text.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (c.measureText(t).width <= maxW) { line = t; continue; }
      if (line) out.push(line);
      line = '';
      for (const ch of word) { if (c.measureText(line + ch).width > maxW && line) { out.push(line); line = ''; } line += ch; }
    }
    if (line) out.push(line);
    return out;
  };
  sh(dream ? '당신은  작은 꿈' : '당신은  다섯 번째 앨리스', W / 2, 42, dream ? '#ff7070' : '#f0e8d8', `800 20px 'Nanum Myeongjo', serif`);

  // ── 오른쪽: 이번 판 규칙 (켜진 것만, 짧게) ──
  const mapName = { theater: '극장', tea: '노란 방들', mirror: '거울 미궁', studio: '방송국' }[g.world.map] || '숲';
  const rules = [];
  const R = (t, d) => rules.push([t, d]);
  if (g.world.map === 'studio') R('CCTV', dream ? '가까이서 E로 끈다 (2분 30초 뒤 복구)' : '모니터실 책상에서 본다 (보는 동안 무방비)');
  if (g.world.map === 'mirror') R('거울', '빛나는 거울에 닿으면 같은 색 짝 거울로');
  { const per = trPer(g), pc = (per * 100).toFixed(1).replace(/\.0$/, ''); if (per > 0) R('흔적 가속', dream ? `흔적 하나마다 +${pc}% 빨라짐` : `흔적 하나마다 꿈 +${pc}%`); }
  if ([...g.players.values()].filter(p => p.role === 'alice').length >= 2) R('최후의 앨리스', dream ? '모두 갇히고 1명 남으면 10초마다 위치 노출' : '동료가 다 갇히면 빨라지고 위치 노출');
  if (g.awake) R('깨어나는 시간', dream ? '1분 30초마다 30초간: 더 빠르고 앨리스 시야 암흑' : '1분 30초마다 30초간 어둠, 붉은 눈만 보임');
  if (g.stealth) R('숨은 꿈', dream ? `문이 열리면 ${phone ? '「은신」' : 'F'}로 10초 은신 (한 번)` : '문이 열린 뒤 꿈이 기척 없이 올 수 있다');
  if (g.boost) R('인원 보정', dream ? '앨리스가 많을수록 빠름 (가둘수록 원래대로)' : '꿈이 더 빠름 (동료가 갇힐수록 원래대로)');
  if (g.fate) R('운명계승', dream ? '앨리스가 힘을 쓰면 위치가 드러난다' : `흔적 주인의 힘과 저주를 잇는다 (${phone ? '운명' : 'F'})`);
  const two = rules.length > 0;
  const LX = two ? 24 : 60, LW = two ? 178 : W - 120, RX = 216, RW = W - 24 - RX;

  // ── 왼쪽: 목표 ──
  const lc = two ? LX + LW / 2 : W / 2;
  sh('─  목 표  ─', lc, 64, '#8d8478', F(11));
  const goals = dream
    ? [`앨리스를 잡아 ${prisonName()}에 가두세요.`, '갇힌 지 2분이면 썩어 전시대에 걸린다.', '절반 이상 탈출을 막으면 승리.', '빛기둥 곁엔 오래 못 머문다.']
    : [`${mapName} 곳곳의 흔적 5개를 찾으세요.`, '다 모으면 빛기둥 문이 열린다.', '절반 이상 탈출하면 승리!', '잡히면 연타로 몸부림 · 갇힌 동료는 감옥 문에서 구출.'];
  let y = 79;
  for (const gl of goals) for (const l of wrap(gl, F(11), LW)) { sh(l, lc, y, '#d8cfbf', F(11)); y += 13; }

  // ── 왼쪽: 조작 (짧은 칸들을 흘려 배치) ──
  y += 6; sh('─  조 작  ─', lc, y, '#8d8478', F(11)); y += 17;
  const segs = phone
    ? (dream
      ? [[['왼쪽 원'], '이동'], [['화면 끌기'], '시점'], [['잡기'], '잡기 · 가두기'], [['대시'], `돌진 (${g.fate ? 5 : CFG.DASH_CD}초)`], ...(g.stealth ? [[['은신'], '10초 은신']] : []), [['지도'], '지도 · 눌러서 손짓']]
      : [[['왼쪽 원'], '이동'], [['화면 끌기'], '시점'], [['행동'], '꾹: 줍기 · 구출'], [['행동'], '연타: 몸부림'], ...(g.fate ? [[['운명'], '운명 쓰기']] : []), [['지도'], '지도 · 눌러서 손짓']])
    : (dream
      ? [[['W', 'A', 'S', 'D'], '이동'], [['마우스'], '시점'], [['E'], '잡기 · 가두기'], [['Shift'], `돌진 (${g.fate ? 5 : CFG.DASH_CD}초)`], ...(g.stealth ? [[['F'], '은신']] : []), [['M'], '지도'], [['G'], '손짓'], [['B'], '밝기'], [['[', ']'], '감도'], [['Enter'], '채팅']]
      : [[['W', 'A', 'S', 'D'], '이동'], [['마우스'], '시점'], [['E'], '꾹: 줍기 · 구출'], [['E'], '연타: 몸부림'], ...(g.fate ? [[['F'], '운명 쓰기']] : []), [['M'], '지도'], [['G'], '손짓'], [['B'], '밝기'], [['Enter'], '채팅']]);
  // 한 칸의 폭을 재서 줄을 채우고, 넘치면 다음 줄로
  c.font = F(11);
  const segW = ([ks, d]) => ks.reduce((a, k) => a + Math.max(15, c.measureText(k).width + 10) + 3, 0) + 3 + c.measureText(d).width;
  const lines = []; let cur = [], cw = 0;
  for (const sg of segs) { const w0 = segW(sg); if (cur.length && cw + 12 + w0 > LW) { lines.push([cur, cw]); cur = []; cw = 0; } cw += (cur.length ? 12 : 0) + w0; cur.push(sg); }
  if (cur.length) lines.push([cur, cw]);
  const step = Math.min(18, (H - 40 - y) / Math.max(1, lines.length - 1));
  for (const [ln, lw] of lines) {
    let x = two ? LX : W / 2 - lw / 2;
    for (const [ks, d] of ln) {
      for (const k of ks) x += keycap(c, x, y, k, 15) + 3;
      c.font = F(11); sh(d, x + 3, y, '#cfc6b6', F(11), 'left'); c.font = F(11); x += 3 + c.measureText(d).width + 12;
    }
    y += step;
  }

  // ── 오른쪽 칸 그리기 (넘치면 글씨를 줄인다) ──
  if (two) {
    c.strokeStyle = 'rgba(220,210,190,.18)'; c.beginPath(); c.moveTo(208.5, 56); c.lineTo(208.5, H - 40); c.stroke();
    sh('─  이번 판 규칙  ─', RX + RW / 2, 64, '#8d8478', F(11));
    let fs = 11, lay;
    for (; fs >= 8.5; fs -= .5) {
      lay = rules.map(([t, d]) => [t, wrap(d, F(fs - 1), RW - 8)]);
      const hgt = lay.reduce((a, [, ls]) => a + (fs + 2) + ls.length * fs + 4, 0);
      if (79 + hgt <= H - 36) break;
    }
    let ry = 79;
    for (const [t, ls] of lay) {
      sh('★ ' + t, RX, ry, '#9fe0c0', F(fs), 'left'); ry += fs + 2;
      for (const l of ls) { sh(l, RX + 8, ry, '#cfc6b6', F(fs - 1), 'left'); ry += fs; }
      ry += 4;
    }
  }
  sh(phone ? '왼쪽 위 [?] 버튼으로 언제든 다시 볼 수 있어요' : 'Tab 키로 언제든 다시 볼 수 있어요', W / 2, H - 22, '#7a7268', F(11));
  if (count > 0) sh(`${Math.ceil(count)}`, W - 34, 44, '#ffffff', `28px 'VT323', monospace`);
  c.restore();
}
const feeds = [], feedTmp = document.createElement('canvas'); feedTmp.width = W; feedTmp.height = H;
function renderFeed(g) {
  const w = g.world; if (!w.cams) return;
  const ids = [0, 1, 2, 3].map(k => g.cctv.page * 4 + k).filter(i => i < w.cams.length);
  if (!ids.length) return;
  const i = ids[g.cctv.rr++ % ids.length], c = w.cams[i];
  if (!feeds[i]) { const cv2 = document.createElement('canvas'); cv2.width = 200; cv2.height = 150; feeds[i] = cv2; }
  if (!g.cams || !g.cams[i]) return;
  const sway = Math.sin(now * .4 + i) * .35;
  renderWorld(g, { x: c.x + Math.cos(c.yaw) * .2, z: c.z + Math.sin(c.yaw) * .2, yaw: c.yaw + sway, bob: -18 }, true);
  feedTmp.getContext('2d').putImageData(wimg, 0, 0);
  const fc = feeds[i].getContext('2d'); fc.imageSmoothingEnabled = true; fc.drawImage(feedTmp, 0, 0, 200, 150);
  const id = fc.getImageData(0, 0, 200, 150), d = id.data; // 흑백 CCTV
  for (let k = 0; k < d.length; k += 4) { const v = (d[k] * .3 + d[k + 1] * .55 + d[k + 2] * .15) * 1.35 + (Math.random() - .5) * 26; d[k] = v * .9; d[k + 1] = v; d[k + 2] = v * .92; }
  fc.putImageData(id, 0, 0);
}
// 카메라가 어디를 비추는지 (가까운 방 이름 + 방향)
function camPlace(w, cm) {
  const fx = cm.x + Math.cos(cm.yaw) * 4, fz = cm.z + Math.sin(cm.yaw) * 4;
  let best = null, bd = 1e9;
  for (const L of w.labels || []) { const d = Math.hypot(L.x - fx, L.z - fz); if (d < bd) { bd = d; best = L; } }
  const side = (cm.z < 26 ? '북' : cm.z > 54 ? '남' : '') + (cm.x < 26 ? '서' : cm.x > 54 ? '동' : '');
  if (best && bd < 10) return `${best.t} 쪽`;
  return side ? `${side}쪽 복도` : '가운데 복도';
}
function drawCCTV(g) {
  const c = ctx, w = g.world, cams = w.cams || [];
  c.fillStyle = '#050605'; c.fillRect(0, 0, W, H);
  const pw = 186, ph = 120, gx = (W - pw * 2 - 8) / 2, gy = 34;
  for (let k = 0; k < 4; k++) {
    const i = g.cctv.page * 4 + k, x = gx + (k % 2) * (pw + 8), y = gy + (k >> 1) * (ph + 8);
    c.fillStyle = '#0c0f0c'; c.fillRect(x - 2, y - 2, pw + 4, ph + 4);
    if (i >= cams.length) continue;
    if (g.cams && g.cams[i] && feeds[i]) c.drawImage(feeds[i], x, y, pw, ph);
    else { for (let n = 0; n < 260; n++) { const v = Math.random() * 160 | 0; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(x + Math.random() * pw, y + Math.random() * ph, 3, 2); } c.font = `18px 'VT323', monospace`; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('NO SIGNAL', x + pw / 2, y + ph / 2 + 5); }
    c.font = `14px 'VT323', monospace`; c.textAlign = 'left'; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x, y, 56, 14);
    c.fillStyle = '#e8f0e8'; c.fillText(`CAM ${String(i + 1).padStart(2, '0')}`, x + 3, y + 11);
    { const where = camPlace(w, cams[i]); c.font = `10px 'Nanum Gothic Coding', monospace`; const tw = c.measureText(where).width + 8; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x, y + ph - 14, tw, 14); c.fillStyle = '#cfe0cf'; c.fillText(where, x + 4, y + ph - 4); }
    if (g.cams && g.cams[i] && Math.floor(now * 2) % 2) { c.fillStyle = '#e02020'; c.beginPath(); c.arc(x + pw - 8, y + 8, 3, 0, 7); c.fill(); }
  }
  c.font = `12px 'Nanum Gothic Coding', monospace`; c.textAlign = 'center'; c.fillStyle = '#cfd8cf';
  c.fillText(`모니터실 ─ ${g.cctv.page + 1} / ${camPages()}`, W / 2, 22);
  c.fillStyle = '#8a948a';
  c.fillText(device === 'phone' ? '화면 왼쪽·오른쪽 탭: 다른 카메라 · 행동: 닫기' : '← → : 다른 카메라 · E: 닫기', W / 2, H - 12);
  c.fillStyle = 'rgba(200,40,40,.9)'; if (Math.floor(now * 3) % 2) c.fillText('보는 동안 움직일 수 없다', W / 2, H - 26);
}
function drawHud(g, tags) {
  const c = ctx, ms = g.meS, dream = g.role === 'dream', tnow = performance.now();
  c.textBaseline = 'alphabetic';
  const sh = (s, x, y, col, font, al = 'left') => { c.font = font; c.textAlign = al; c.fillStyle = 'rgba(0,0,0,.85)'; c.fillText(s, x + 1, y + 1); c.fillStyle = col; c.fillText(s, x, y); };
  const OSD = `20px 'VT323', monospace`, KR = `12px 'Nanum Gothic Coding', monospace`, KRS = `11px 'Nanum Gothic Coding', monospace`;
  // 꿈: 빛기둥 곁에서 화면이 하얗게 타들어 간다
  if (dream && g.door && ms && ms.s === 0) {
    const d = Math.hypot(g.cam.x - g.door.x, g.cam.z - g.door.z), bt = ms.b || 0;
    if (d < CFG.BURN_R + 1.5) {
      const k = clamp(bt / CFG.BURN_TIME, 0, 1), near = clamp(1 - (d - CFG.BURN_R) / 1.5, 0, 1);
      const rg = c.createRadialGradient(W / 2, H / 2, H * (.55 - k * .45), W / 2, H / 2, H * .85);
      rg.addColorStop(0, 'rgba(255,250,220,0)'); rg.addColorStop(1, `rgba(255,248,220,${.25 * near + .7 * k})`);
      c.fillStyle = rg; c.fillRect(0, 0, W, H);
      if (d < CFG.BURN_R) { if (Math.random() < .2) sfx.sizzle(k); sh(k > .6 ? '빛이 몸을 태운다! 벗어나!' : '빛기둥 곁에선 느려지고 타들어 간다', W / 2, 58, k > .6 ? '#fff0b0' : '#e8dcc0', `12px 'Nanum Gothic Coding', monospace`, 'center'); }
    }
  }
  if (g.burnFlash > 0) { c.fillStyle = `rgba(255,252,235,${g.burnFlash})`; c.fillRect(0, 0, W, H); g.burnFlash = Math.max(0, g.burnFlash - frameDt * 1.5); }
  // 꿈이 가까우면 화면 가장자리가 심장 박동에 맞춰 붉게 조여든다
  if (!chicken && !dream && g.terror > .35 && !g.ended) {
    const k = (g.terror - .35) / .65, beat = .55 + .45 * Math.pow(Math.max(0, Math.sin(now * (4 + k * 6))), 6);
    const rg = c.createRadialGradient(W / 2, H / 2, H * (.62 - k * .25), W / 2, H / 2, H * .9);
    rg.addColorStop(0, 'rgba(120,0,0,0)'); rg.addColorStop(1, `rgba(120,0,0,${(.25 + k * .5) * beat})`);
    c.fillStyle = rg; c.fillRect(0, 0, W, H);
  }
  // 이름표
  c.font = KRS; c.textAlign = 'center';
  drawPingsWorld(g);
  for (const t of tags) { c.globalAlpha = clamp(t.a * 1.4, 0, 1); c.fillStyle = '#000'; c.fillText(t.name, t.x + 1, t.y + 1); c.fillStyle = '#e8e0d0'; c.fillText(t.name, t.x, t.y); drawTitleTag(c, t.title, t.x, t.y - 11); }
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
  drawEffects(g, c, tnow);
  if (g.fate) drawFateHud(g, c, sh, tnow);
  if (g.stealth) drawStealthHud(g, c, sh, tnow);
  // 상황별 안내
  const P = g.pred, w = g.world, actKey = device === 'phone' ? '행동' : 'E';
  const bar = (x, y, wd, v, col) => { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - wd / 2 - 1, y - 1, wd + 2, 6); c.fillStyle = col; c.fillRect(x - wd / 2, y, wd * clamp(v, 0, 1), 4); };
  let prompt = '', pv = -1, pcol = '#e8e0d0';
  if (g.spectate) {
    const sp = g.spectating && g.players.get(g.spectating), spRole = sp ? (sp.role === 'dream' ? '꿈' : '앨리스') : '';
    prompt = `${ms && ms.s === 4 ? '탈출했다' : '전시대에 걸린 채'} — ${sp ? `${sp.name} (${spRole}) 관전 중` : '관전 중'} (${device === 'phone' ? '화면 탭' : '클릭'}: 다음 사람)`;
    if (sp) { const big = `${spRole === '꿈' ? '꿈' : '앨리스'} ─ ${sp.name}`; sh(big, W / 2, 50, spRole === '꿈' ? '#ff6a6a' : '#9fe0ff', `800 16px 'Nanum Myeongjo', serif`, 'center'); }
  } else if (ms && ms.s === 1) {
    prompt = `몸부림쳐라! ${actKey} 연타`; pv = ms.sg; pcol = '#ff6a6a';
  } else if (ms && ms.s === 2) {
    const left = CFG.ROT_TIME - ms.jt;
    sh(`썩기까지 ${fmtTime(left)}`, W / 2, H / 2 + 6, left < 30 ? '#ff4040' : '#e8a0a0', `26px 'VT323', monospace`, 'center');
    prompt = '갇혔다. 동료가 감옥 문 앞에서 구해줘야 한다.'; pv = g.rp[ms.cl] / CFG.RESCUE_TIME;
  } else if (!dream) {
    let best = null;
    w.cells.forEach((cl, i) => { if (!best && Math.hypot(P.x - cl.door.x, P.z - cl.door.z) < CFG.CHANNEL_RANGE && [...g.players.values()].some(p => p.cur && p.cur.s === 2 && p.cur.cl === i)) best = { t: `${actKey} 꾹 — 감옥 문 열기`, v: g.rp[i] / CFG.RESCUE_TIME }; });
    if (!best) w.traces.forEach((t, i) => { if (!best && !g.tr[i] && Math.hypot(P.x - t.x, P.z - t.z) < CFG.CHANNEL_RANGE) best = { t: `${actKey} 꾹 — ${t.suit} ${t.name}${fateWarn(g, i)}`, v: g.tp[i] / t.dur }; });
    if (!best && w.cams && g.cams) w.cams.forEach((c, i) => { if (!best && !g.cams[i] && Math.hypot(P.x - c.x, P.z - c.z) < 1.8) best = { t: `${actKey} 꾹 — CAM ${String(i + 1).padStart(2, '0')} 다시 켜기`, v: (g.cp[i] || 0) / 2.5 }; });
    if (!best && nearMonitor(g)) best = { t: `${actKey} — CCTV 보기`, v: -1 };
    if (best) { prompt = best.t; pv = best.v; }
    else if (g.door) prompt = '하늘의 빛기둥으로 가면 탈출!';
    if (g.fate && ms && ms.s === 0 && (g.myF.includes('S') || g.myF.includes('C'))) {
      const sw = g.myF.includes('S'), fk = device === 'phone' ? '운명 버튼' : 'F', st = fateTarget(g, P, sw ? 2.2 : 6);
      if (!sw && g.myFc > 0) { if (st.ok || st.why || !prompt) { prompt = `♥ 왕관 재사용 대기 — ${Math.ceil(g.myFc)}초`; pv = -1; pcol = '#a89e90'; } }
      else if (st.ok) { prompt = `${fk} — ${sw ? '♠ 붉은 검으로 베기!' : '♥ 왕관으로 홀리기!'}`; pv = -1; pcol = sw ? '#ff7a7a' : '#8fd29a'; }
      else if (st.why) { prompt = `${sw ? '♠' : '♥'} ${st.why}`; pv = -1; pcol = '#a89e90'; }
      else if (!prompt) { prompt = `${fk}: ${sw ? '♠ 베기 — 꿈이 2칸 안에 오면' : '♥ 홀리기 — 꿈이 6칸 안에 보이면'}`; pv = -1; pcol = '#8d8478'; }
    }
    if (g.door) { // 문 방향 표시
      let rel = Math.atan2(g.door.z - g.cam.z, g.door.x - g.cam.x) - g.cam.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const ax = W / 2 + clamp(rel / .9, -1, 1) * (W / 2 - 20);
      c.fillStyle = `rgba(255,255,255,${.5 + .3 * Math.sin(now * 4)})`; c.beginPath(); c.moveTo(ax, 34); c.lineTo(ax - 5, 42); c.lineTo(ax + 5, 42); c.closePath(); c.fill();
    }
  } else {
    if (P.sn > 0) { prompt = '움직일 수 없다…'; pcol = '#ff8080'; }
    else if (P.chm > 0) { prompt = '여왕에게 홀렸다… 몸이 무겁다'; pcol = '#8fd29a'; }
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
      let camNear = -1; if (!canCatch && w.cams && g.cams) w.cams.forEach((c, i) => { if (camNear < 0 && g.cams[i] && Math.hypot(P.x - c.x, P.z - c.z) < 1.8) camNear = i; });
      prompt = canCatch ? `${actKey} — 잡아라!` : camNear >= 0 ? `${actKey} — CAM ${String(camNear + 1).padStart(2, '0')} 끄기` : `${actKey}: 잡기 · ${device === 'phone' ? '대시' : 'Shift'}: 대시`;
      pcol = canCatch ? '#ff6060' : '#a89e90';
    }
    // 대시 쿨타임
    const cd = P.dc / (P.dcd || CFG.DASH_CD);
    c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 4; c.beginPath(); c.arc(W - 30, H - 52, 10, 0, 7); c.stroke();
    c.strokeStyle = cd > 0 ? '#7a5050' : '#ff5050'; c.lineWidth = 2.5; c.beginPath(); c.arc(W - 30, H - 52, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cd)); c.stroke();
    sh('대시', W - 30, H - 34, cd > 0 ? '#7a6a60' : '#ffb0b0', `10px 'Nanum Gothic Coding', monospace`, 'center');
    if (g.sb > 1.001) sh(`속도 +${Math.round((g.sb - 1) * 100)}%`, W - 30, H - 70, '#ff9090', `10px 'Nanum Gothic Coding', monospace`, 'center');
    // 경보 (흔적·감옥을 건드리는 앨리스)
    for (const a of g.alerts) {
      const age = (tnow - a.t) / 1000; if (age > 1.5) continue;
      let rel = Math.atan2(a.z - g.cam.z, a.x - g.cam.x) - g.cam.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const ax = W / 2 + clamp(rel / .9, -1, 1) * (W / 2 - 24);
      c.globalAlpha = 1 - age / 1.5; sh(a.kind === 'cell' ? '!' : '?', ax, 54, '#ff4040', `bold 16px 'VT323', monospace`, 'center');
    }
    c.globalAlpha = 1;
  }
  if (prompt) { const py = device === 'phone' ? 140 : H - 44; sh(prompt, W / 2, py, pcol, KR, 'center'); if (pv >= 0) bar(W / 2, py + 6, 120, pv, pcol); }
  // 시작 안내 (역할 브리핑)
  const briefing = g.intro > 0 || (g.briefOn && !g.ended);
  $('touch').classList.toggle('brief', briefing);
  if (g.intro > 0) drawBrief(c, g, clamp(g.intro / 1.2, 0, 1), g.intro);
  else if (g.briefOn && !g.ended) drawBrief(c, g, 1, 0);
  if (g.cctv) drawCCTV(g);
  if (g.mapOn) drawMap(g, g.cam);
  if (g.ended) {
    const e = g.ended, iWin = (e.win === 'alice') === (g.role === 'alice');
    c.fillStyle = 'rgba(0,0,0,.78)'; c.fillRect(0, 0, W, H);
    sh(e.win === 'alice' ? '앨리스들이 꿈에서 빠져나갔다' : '꿈이 앨리스들을 삼켰다', W / 2, 92, e.win === 'alice' ? '#f0f0ff' : '#ff5050', `800 20px 'Nanum Myeongjo', serif`, 'center');
    sh(iWin ? '승리' : '패배', W / 2, 124, iWin ? '#cfe8d2' : '#e08080', `28px 'VT323', monospace`, 'center');
    const rows = [];
    if (e.esc.length) rows.push(`탈출: ${e.esc.join(', ')}${e.need ? ` (${e.esc.length}/${e.total}${e.win === 'dream' ? ` — ${e.need}명이 필요했다` : ''})` : ''}`);
    if (e.rot.length) rows.push(`성 위에 걸림: ${e.rot.join(', ')}`);
    if (e.jail.length && e.win === 'dream') rows.push(`붙잡힘: ${e.jail.join(', ')}`);
    rows.push(`꿈: ${e.dreams.join(', ')}`);
    rows.push(`찾은 흔적 ${e.traces}/5${e.reason === 'time' ? ' · 시간 초과' : ''}`);
    const sc = e.scores || [], mvp = e.mvp && sc.find(q => q.id === e.mvp);
    let ry = 152;
    if (mvp) { // 다섯 번째 앨리스
      c.fillStyle = '#e8e2d0'; c.fillRect(W / 2 - 92, 136, 184, 24); c.fillStyle = '#1a1414'; c.font = `800 13px 'Nanum Myeongjo', serif`; c.textAlign = 'center'; c.fillText(`「 다섯 번째 앨리스 ─ ${mvp.n} 」`, W / 2, 153); { const mp = g.players.get(mvp.id); if (mp && mp.title) drawTitleTag(c, mp.title, W / 2, 131, 10); }
      const d = mvp.d, parts = [];
      if (d.col) parts.push(`흔적 ${d.col}`); if (d.assist) parts.push(`도움 ${d.assist}`); if (d.res) parts.push(`구출 ${d.res}`); if (d.bear) parts.push(`운명 ${d.bear}`); if (d.stun) parts.push(`베기 ${d.stun}`); if (d.esc) parts.push(`탈출 ${d.esc}`); if (d.caught) parts.push(`잡힘 -${d.caught}`);
      sh(`${mvp.t}점`, W / 2, 174, '#efe6d4', KR, 'center'); sh(parts.join(' · '), W / 2, 189, '#a89e90', `10px 'Nanum Gothic Coding', monospace`, 'center'); ry = 206;
    } else if (e.win === 'dream') { sh('다섯 번째 앨리스는 아직 오지 않았다… 꿈은 다음 앨리스를 기다린다.', W / 2, 150, '#c8a0a0', KRS, 'center'); ry = 170; }
    rows.slice(0, mvp ? 3 : 5).forEach((r, i) => sh(r, W / 2, ry + i * 15, '#a89e90', KRS, 'center'));
    if (sc.length) sh(sc.slice(0, 4).map((q, i) => `${i + 1}. ${q.n} ${q.t}`).join('   '), W / 2, 262, '#8d8478', KRS, 'center');
    sh('잠시 후 로비로 돌아갑니다', W / 2, 280, '#7a7268', KRS, 'center');
  }
  if (performance.now() - g.lastSnap > 1500 && !g.ended) sh('신호 약함…', W / 2, H / 2 - 30, '#ff8080', KR, 'center');
  drawScare(c, g);
}

function fateTarget(g, P, r) { // 운명을 쓸 수 있는 꿈이 있나 (서버와 같은 기준: 거리 · 시야 · 기절/홀림/면역)
  const w = g.world, N = w.N, sees = (x, z) => { const dx = x - P.x, dz = z - P.z, n = Math.ceil(Math.hypot(dx, dz) * 4); for (let k = 1; k < n; k++) { const cx = (P.x + dx * k / n) | 0, cz = (P.z + dz * k / n) | 0; if (cx < 0 || cz < 0 || cx >= N || cz >= N || w.wall[cz * N + cx]) return false; } return true; };
  let why = '', best = 1e9;
  for (const p of g.players.values()) {
    if (p.role !== 'dream' || !p.cur || p.cur.s !== 0) continue;
    const ip = interp(p) || p.cur, d = Math.hypot(ip.x - P.x, ip.z - P.z); if (d > r || !sees(ip.x, ip.z)) continue;
    const c = p.cur;
    if (c.sn > 0) { if (d < best) { best = d; why = '꿈이 이미 멈춰 있다'; } continue; }
    if (c.ch > 0) { if (d < best) { best = d; why = '꿈이 이미 홀려 있다'; } continue; }
    if (c.fi > 0) { if (d < best) { best = d; why = `꿈 면역 — ${Math.ceil(c.fi)}초`; } continue; }
    return { ok: true };
  }
  return { ok: false, why };
}
function awakeTurn(g, from, to) {
  const al = g.role === 'alice';
  if (to === 1) { fx.glitch = 1; if (al) { say('…오르골 소리가 멈췄다', '#ff8080', 3); sfx.reverse(); } else say('곧 깨어난다…', '#ff6060', 3); }
  else if (to === 2) { fx.glitch = 2; sfx.growl(); if (al) { sfx.ear(); say('꿈이 깨어났다. 붉은 눈을 피해라.', '#ff4040', 4); } else say('깨어났다 — 30초 동안 더 빠르다', '#ff4040', 4); drone(.22, .7, 1); }
  else if (to === 0 && from === 2) { fx.glitch = 1.2; say(al ? '빛이 돌아왔다…' : '다시 잠든다', '#cfc6b6', 3); }
}
function drawEffects(g, c, tnow) {
  // 붉은 검: 근처 앨리스는 화면 가장자리가 붉게
  if (g.redFlash > 0) { const rg = c.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .85); rg.addColorStop(0, 'rgba(200,0,0,0)'); rg.addColorStop(1, `rgba(200,0,0,${.6 * g.redFlash})`); c.fillStyle = rg; c.fillRect(0, 0, W, H); g.redFlash = Math.max(0, g.redFlash - frameDt * .9); }
  // 붉은 검에 베인 꿈: 금 간 붉은 화면 3초
  if (g.crack) { const a = (tnow - g.crack) / 1000; if (a > 3) g.crack = 0; else {
    const k = a < .15 ? 1 : 1 - (a - .15) / 2.85; c.fillStyle = chicken ? `rgba(255,150,200,${.35 * k})` : `rgba(140,0,0,${.45 * k})`; c.fillRect(0, 0, W, H);
    c.strokeStyle = `rgba(255,${chicken ? 220 : 230},${chicken ? 240 : 230},${.8 * k})`; c.lineWidth = 1.2; c.beginPath();
    for (let i = 0; i < 9; i++) { let x = W / 2 + Math.cos(i * 2.1) * 6, y = H / 2 + Math.sin(i * 2.1) * 6; c.moveTo(x, y); for (let j = 0; j < 5; j++) { x += Math.cos(i * 2.1 + Math.sin(i * 5 + j) * .6) * (18 + j * 6); y += Math.sin(i * 2.1 + Math.sin(i * 5 + j) * .6) * (18 + j * 6); c.lineTo(x, y); } }
    c.stroke(); } }
  // 왕관에 홀린 꿈: 초록빛 일렁임 + 여왕의 얼굴
  if (g.charmT) { const a = (tnow - g.charmT) / 1000; if (a > 3) g.charmT = 0; else {
    const k = Math.min(1, a * 4) * (1 - Math.max(0, a - 2.4) / .6);
    c.save(); c.globalAlpha = .22 * k; c.fillStyle = '#3c9a5a'; c.fillRect(0, 0, W, H);
    c.globalAlpha = .28 * k; const fx_ = W / 2 + Math.sin(a * 3) * 10, fy = H / 2 - 10;
    c.fillStyle = '#16301f'; c.beginPath(); c.ellipse(fx_, fy - 6, 52, 64, 0, 0, 7); c.fill(); c.fillStyle = '#d8cfbd'; c.beginPath(); c.ellipse(fx_, fy, 34, 44, 0, 0, 7); c.fill();
    c.fillStyle = '#050303'; c.beginPath(); c.ellipse(fx_ - 12, fy - 4, 5, 6, 0, 0, 7); c.ellipse(fx_ + 12, fy - 4, 5, 6, 0, 0, 7); c.fill();
    c.fillStyle = '#b08e2a'; c.beginPath(); c.moveTo(fx_ - 22, fy - 40); c.lineTo(fx_ - 14, fy - 58); c.lineTo(fx_ - 6, fy - 44); c.lineTo(fx_, fy - 62); c.lineTo(fx_ + 6, fy - 44); c.lineTo(fx_ + 14, fy - 58); c.lineTo(fx_ + 22, fy - 40); c.closePath(); c.fill();
    c.restore(); fx.wobble = Math.max(fx.wobble, 2.5 * k); } }
  // 최후의 앨리스
  if (g.lastId === myId && g.meS && g.meS.s <= 1) {
    const c0 = g.lastCard ? (tnow - g.lastCard) / 1000 : 9;
    if (c0 < 3.5) { c.save(); c.globalAlpha = clamp(Math.min(c0 * 3, (3.5 - c0) * 1.5), 0, 1); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, H / 2 - 40, W, 64); c.font = `800 18px 'Nanum Myeongjo', serif`; c.textAlign = 'center'; c.fillStyle = '#f2ece0'; c.fillText('「 당신이 마지막 앨리스다 」', W / 2, H / 2 - 10); c.font = `11px 'Nanum Gothic Coding', monospace`; c.fillStyle = '#d8b0a0'; c.fillText('더 빠르게 · 감옥 문 2배 · 대신 10초마다 꿈이 당신을 본다', W / 2, H / 2 + 12); c.restore(); }
    const rg = c.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * .9); rg.addColorStop(0, 'rgba(255,240,220,0)'); rg.addColorStop(1, `rgba(255,240,220,${.06 + .04 * Math.sin(now * 3)})`); c.fillStyle = rg; c.fillRect(0, 0, W, H);
    c.font = `10px 'Nanum Gothic Coding', monospace`; c.textAlign = 'right'; c.fillStyle = '#000'; c.fillText('마지막 앨리스 +15%', W - 13, 41); c.fillStyle = '#f0e0c0'; c.fillText('마지막 앨리스 +15%', W - 14, 40);
  }
  // 꿈이 깨어난 시간
  if (g.awake && g.aw) {
    const sh_ = (t, y, col) => { c.font = `12px 'Nanum Gothic Coding', monospace`; c.textAlign = 'center'; c.fillStyle = '#000'; c.fillText(t, W / 2 + 1, y + 1); c.fillStyle = col; c.fillText(t, W / 2, y); };
    if (g.aw === 2) {
      if (g.role === 'dream') { c.fillStyle = 'rgba(120,0,0,.12)'; c.fillRect(0, 0, W, H); sh_(`깨어났다 — ${Math.ceil(g.awT)}초`, 44, '#ff5050'); }
      else sh_(`꿈이 깨어 있다 — ${Math.ceil(g.awT)}초`, 44, '#ff6060');
    } else if (g.role === 'alice') { c.fillStyle = `rgba(0,0,0,${.15 + Math.random() * .2})`; c.fillRect(0, 0, W, H); }
  }
}
function fateWarn(g, i) {
  if (!g.fate || g.role !== 'alice') return '';
  const k = TRACE_FATE[i], f = g.myF.replace(/\d/g, '');
  if (k === 'C' && f.includes('S')) return ' (⚠ 붉은 검이 사라짐)';
  if (k === 'S' && f.includes('C')) return ' (⚠ 왕관이 사라짐)';
  if (k !== 'T' && f.length >= 2 && !f.includes(k)) return ` (⚠ ${FATES[f[0]].name}이 사라짐)`;
  return '';
}
function drawFateHud(g, c, sh, tnow) {
  const ms = g.meS, P = g.pred;
  if (g.role === 'alice' && ms && ms.s <= 1) {
    // 왕관의 대가: 시야가 썩어 간다
    if (g.myF.includes('C')) {
      const k = clamp((tnow - g.cT) / 40000, 0, 1) * .85;
      if (!g.rotBlots) g.rotBlots = Array.from({ length: 26 }, (_, i) => { const a = i / 26 * Math.PI * 2 + Math.sin(i * 7) * .3; return { a, r: .6 + (i % 5) * .08, s: 14 + (i * 13) % 22, th: (i * 37 % 100) / 100 }; });
      const rg = c.createRadialGradient(W / 2, H / 2, H * (.62 - k * .3), W / 2, H / 2, H * .85);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, chicken ? `rgba(255,150,190,${.15 + k * .4})` : `rgba(28,24,8,${.2 + k * .6})`);
      c.fillStyle = rg; c.fillRect(0, 0, W, H);
      for (const b of g.rotBlots) { if (k < b.th * .85) continue; const x = W / 2 + Math.cos(b.a) * W * .5 * b.r, y = H / 2 + Math.sin(b.a) * H * .5 * b.r, rr = b.s * (.4 + (k - b.th * .85) * 1.4); c.fillStyle = chicken ? 'rgba(255,140,190,.5)' : 'rgba(40,32,10,.75)'; c.beginPath(); c.ellipse(x, y, rr, rr * .7, b.a, 0, 7); c.fill(); }
    }
    // 이어받은 운명 표시 (미니맵 아래, 작게)
    let y = 128;
    const f = g.myF;
    for (const k of ['S', 'M', 'C', 'T']) {
      if (!f.includes(k)) continue;
      const F = FATES[k], extra = k === 'C' ? ` ×${(f.match(/C(\d)/) || [0, ''])[1]}${g.myFc > 0 ? ` (${Math.ceil(g.myFc)}초)` : ''}` : k === 'T' && P.tw ? ' 함께' : '';
      const key = (k === 'S' || k === 'C') ? (device === 'phone' ? ' [운명]' : ' [F]') : ' (자동)';
      sh(`${F.suit} ${F.name}${extra}${key}`, 10, y, F.col, `11px 'Nanum Gothic Coding', monospace`); y += 13;
    }
  }
  if (g.fflash) { const age = (tnow - g.fflash.t) / 1000; if (age > 1.8) g.fflash = null; else { c.save(); c.globalAlpha = clamp(Math.min(age * 6, (1.8 - age) * 2), 0, 1); sh(g.fflash.text, W / 2, H / 2 - 40, g.fflash.col, `800 16px 'Nanum Myeongjo', serif`, 'center'); c.restore(); } }
  if (g.role === 'dream' && P.chm > 0) { c.fillStyle = chicken ? 'rgba(255,170,210,.18)' : 'rgba(60,140,80,.18)'; c.fillRect(0, 0, W, H); }
  // 운명을 이어받는 순간: 테이프 라벨 카드
  if (g.fcard) {
    const age = (tnow - g.fcard.t) / 1000, F = FATES[g.fcard.k];
    if (age > 4.2 || !F) { g.fcard = null; return; }
    c.save(); c.globalAlpha = clamp(Math.min(age * 4, (4.2 - age) * 2), 0, 1);
    const bw = 300, bh = 92, bx = (W - bw) / 2, by = 70;
    c.fillStyle = 'rgba(0,0,0,.82)'; c.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
    c.fillStyle = '#e8e2d0'; c.fillRect(bx, by, bw, 22);
    c.fillStyle = '#1a1414'; c.font = `800 12px 'Nanum Myeongjo', serif`; c.textAlign = 'center'; c.fillText(`「 ${F.suit} ${F.who}의 운명 ─ ${F.name} 」`, W / 2, by + 15);
    sh(F.story, W / 2, by + 38, '#a89e90', `11px 'Nanum Gothic Coding', monospace`, 'center');
    sh('축복 · ' + F.bless, W / 2, by + 56, F.col, `11px 'Nanum Gothic Coding', monospace`, 'center');
    sh('대가 · ' + F.curse, W / 2, by + 72, '#d08a8a', `10px 'Nanum Gothic Coding', monospace`, 'center');
    c.restore();
  }
}

let last = performance.now();
function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000); last = ts; now += dt; frameDt = dt;
  if (game) {
    try {
      update(dt);
      if (game.cctv) renderFeed(game);
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
{ const rj = sess.get('rejoin', null); if (rj && device && myName && Date.now() - rj.t < 60000 && /^[A-Z]{4}$/.test(rj.code)) { sess.set('rejoin', null); connect(rj.code, false); } }
window.__injoo = { get game() { return game; }, get ws() { return ws; }, get lobby() { return lobby; }, keys, ctl, onMsg: m => onMsg(m), setChicken(v) { chicken = !!v; } };
