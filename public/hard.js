// 人柱愛麗絲 — 하드 모드 (1인칭 3D 장들)
// index.html 의 게임 본체가 window.InjooHard(api) 를 불러 장 함수들을 받아간다.
(function () {
'use strict';
window.InjooHard = function (api) {
const { W, H, g, keys, ptr, sfx, osc, nz, fx, setFx, drone, say, go, Card, T, txt, ell, poly, cuteGhost, drawFace, heart, vib, MONO, SERIF } = api;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const chicken = () => api.chicken();
const now = () => api.now();
const TOUCH = api.TOUCH;
const angDiff = a => Math.atan2(Math.sin(a), Math.cos(a));
const pack = (r, gg, b) => (0xff000000 | ((b < 0 ? 0 : b > 255 ? 255 : b) << 16) | ((gg < 0 ? 0 : gg > 255 ? 255 : gg) << 8) | (r < 0 ? 0 : r > 255 ? 255 : r)) >>> 0;
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return (h ^ (h >>> 16)) & 255; };
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/* =========================================================
   스프라이트: 캔버스로 그린 그림을 픽셀 배열로
   ========================================================= */
function canvasSprite(w, h, draw, emis, sc = 1) {
  w *= sc; h *= sc;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.setTransform(sc, 0, 0, sc, 0, 0); draw(x, w / sc, h / sc);
  const d = x.getImageData(0, 0, w, h).data;
  const n = w * h, R = new Uint8Array(n), G = new Uint8Array(n), B = new Uint8Array(n), A = new Uint8Array(n), E = new Uint8Array(n);
  for (let i = 0; i < n; i++) { if (d[i * 4 + 3] > 110) { R[i] = d[i * 4]; G[i] = d[i * 4 + 1]; B[i] = d[i * 4 + 2]; A[i] = 1; } }
  if (emis) {
    x.clearRect(0, 0, w / sc, h / sc); emis(x, w / sc, h / sc);
    const e = x.getImageData(0, 0, w, h).data;
    for (let i = 0; i < n; i++) if (e[i * 4 + 3] > 110) { R[i] = e[i * 4]; G[i] = e[i * 4 + 1]; B[i] = e[i * 4 + 2]; A[i] = 1; E[i] = 1; }
  }
  return { w, h, r: R, g: G, b: B, a: A, e: E };
}
const E2 = (x, cx, cy, rx, ry, col) => { x.beginPath(); x.ellipse(cx, cy, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2); x.fillStyle = col; x.fill(); };
const P2 = (x, pts, col) => { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); x.fillStyle = col; x.fill(); };
function ghostOn(x, cx, cy, r, o = {}) {
  x.beginPath(); x.arc(cx, cy, r, Math.PI, 0); x.lineTo(cx + r, cy + r * 1.1);
  for (let i = 0; i < 4; i++) { const x1 = cx + r - (i + .5) * r / 2, x2 = cx + r - (i + 1) * r / 2; x.quadraticCurveTo(x1, cy + r * 1.45, x2, cy + r * 1.1); }
  x.closePath(); x.fillStyle = o.col || '#f6f3ff'; x.fill();
  E2(x, cx - r * .35, cy - r * .05, r * .11, r * .15, '#2a2233'); E2(x, cx + r * .35, cy - r * .05, r * .11, r * .15, '#2a2233');
  E2(x, cx - r * .58, cy + r * .2, r * .16, r * .09, '#ff8cb0'); E2(x, cx + r * .58, cy + r * .2, r * .16, r * .09, '#ff8cb0');
  if (o.boo) E2(x, cx, cy + r * .32, r * .12, r * .16, '#2a2233');
  else { x.strokeStyle = '#2a2233'; x.lineWidth = Math.max(1, r * .07); x.beginPath(); x.arc(cx, cy + r * .14, r * .13, .15 * Math.PI, .85 * Math.PI); x.stroke(); }
  if (o.bow) { P2(x, [cx, cy - r * .9, cx - r * .5, cy - r * 1.2, cx - r * .45, cy - r * .65], '#ff7fa8'); P2(x, [cx, cy - r * .9, cx + r * .5, cy - r * 1.2, cx + r * .45, cy - r * .65], '#ff7fa8'); }
}

const SP = {};
function buildSprites() {
  if (SP.ok) return; SP.ok = true;
  // 숲의 그것: 키 크고 창백한, 머리카락에 얼굴이 가려진
  const dress = (x, wide) => {
    const hem = [];
    for (let i = 0; i <= 8; i++) hem.push(lerp(wide ? 2 : 4, wide ? 22 : 20, i / 8), 60 + ((i * 7) % 5));
    x.beginPath(); x.moveTo(8, 19); x.lineTo(16, 19); x.lineTo(wide ? 22 : 20, 60);
    for (let i = hem.length - 2; i >= 0; i -= 2) x.lineTo(hem[i], hem[i + 1]);
    x.closePath(); x.fillStyle = '#88857c'; x.fill();
    x.strokeStyle = '#6a675f'; x.lineWidth = .6;
    for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(9 + i * 1.5, 22); x.lineTo(6 + i * 3, 61); x.stroke(); }
    E2(x, 10, 40, 3, 5, 'rgba(70,52,34,.55)'); E2(x, 15, 52, 4, 3, 'rgba(70,52,34,.5)'); E2(x, 13, 30, 2, 3, 'rgba(90,10,10,.5)');
  };
  const hair = (x, gap) => {
    x.fillStyle = '#060505';
    x.beginPath(); x.ellipse(12.5, 7, 6.5, 5, 0, Math.PI, 0); x.fill();
    const strands = [[5.5, 31], [7, 27], [8.5, 22], [10, 15], [15, 16], [16.5, 24], [18, 29], [19.5, 33]];
    for (const [sx, len] of strands) { if (gap && sx > 9 && sx < 12) continue; x.beginPath(); x.moveTo(sx - 1.4, 5); x.lineTo(sx + 1.4, 5); x.lineTo(sx + .6 + Math.sin(sx) * .8, len); x.lineTo(sx - .8 + Math.sin(sx) * .8, len); x.closePath(); x.fill(); }
  };
  SP.husk = canvasSprite(24, 64, x => {
    dress(x, false);
    x.strokeStyle = '#a49f94'; x.lineWidth = 1.3; x.lineCap = 'round';
    x.beginPath(); x.moveTo(8, 20); x.quadraticCurveTo(5, 34, 5.5, 47); x.moveTo(16, 20); x.quadraticCurveTo(19, 34, 18.5, 48); x.stroke();
    x.lineWidth = .45; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(5.5, 47); x.lineTo(4.3 + i * .8, 52 + (i % 2)); x.moveTo(18.5, 48); x.lineTo(17.3 + i * .8, 53 + (i % 2)); x.stroke(); }
    x.fillStyle = '#a49f94'; x.fillRect(11.3, 14, 1.6, 6);
    x.save(); x.translate(12.5, 10); x.rotate(.18); E2(x, 0, 0, 5, 6.6, '#bcb7aa'); x.restore();
    E2(x, 10.5, 9.5, 1.6, 2.2, '#050404'); x.fillStyle = '#1a0606'; x.fillRect(10, 14, 4.5, .9); x.fillStyle = '#6a0808'; x.fillRect(11, 14.6, .8, 5); x.fillRect(13, 14.6, .7, 3);
    hair(x, true);
  }, x => { E2(x, 10.5, 9.8, .55, .55, '#ffffff'); }, 3);
  SP.huskR = canvasSprite(24, 64, x => { // 덮치는 순간
    dress(x, true);
    x.strokeStyle = '#a49f94'; x.lineWidth = 1.4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(8, 20); x.quadraticCurveTo(2, 18, 1, 9); x.moveTo(16, 20); x.quadraticCurveTo(22, 18, 23, 9); x.stroke();
    x.lineWidth = .45; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(1, 9); x.lineTo(-.4 + i * .9, 4 + (i % 2)); x.moveTo(23, 9); x.lineTo(21.6 + i * .9, 4 + (i % 2)); x.stroke(); }
    x.fillStyle = '#a49f94'; x.fillRect(11.3, 15, 1.6, 5);
    E2(x, 12, 10, 5.6, 7.4, '#c9c4b6');
    E2(x, 9.6, 8, 2, 2.6, '#000'); E2(x, 14.4, 8, 2, 2.6, '#000');
    E2(x, 12, 14, 2.6, 4.4, '#120202'); x.fillStyle = '#ddd5c0'; for (let i = -2; i <= 2; i++) { x.fillRect(12 + i * 1 - .3, 10, .6, 1); x.fillRect(12 + i * 1 - .3, 17.3, .6, 1); }
    x.fillStyle = '#6a0808'; x.fillRect(9.4, 10, .6, 6); x.fillRect(14.2, 10, .6, 8);
    x.fillStyle = '#060505'; x.beginPath(); x.ellipse(12, 4, 7, 3.5, 0, Math.PI, 0); x.fill();
    for (const sx of [3, 5, 19, 21]) { x.beginPath(); x.moveTo(sx, 3); x.lineTo(sx + 2, 3); x.lineTo(sx + (sx < 12 ? -3 : 3), 22); x.closePath(); x.fill(); }
  }, x => { E2(x, 9.6, 8.2, .6, .6, '#fff'); E2(x, 14.4, 8.2, .6, .6, '#fff'); }, 3);
  SP.huskDead = canvasSprite(32, 16, x => { E2(x, 16, 13, 15, 3, '#5a0505'); P2(x, [4, 12, 26, 9, 28, 13, 6, 15], '#7f7d76'); E2(x, 26, 10, 4, 3, '#a7a398'); x.fillStyle = '#070606'; x.fillRect(24, 7, 7, 3); }, null, 2);
  SP.ghost = canvasSprite(40, 48, x => ghostOn(x, 20, 18, 16), null, 2);
  SP.ghostBoo = canvasSprite(40, 48, x => ghostOn(x, 20, 18, 16, { boo: true }), null, 2);
  SP.ghostDead = canvasSprite(32, 16, x => { for (let i = 0; i < 4; i++) { E2(x, 6 + i * 7, 9 + (i % 2) * 2, 3, 3, '#ff8cb0'); E2(x, 9 + i * 7, 9 + (i % 2) * 2, 3, 3, '#ff8cb0'); P2(x, [3 + i * 7, 10 + (i % 2) * 2, 12 + i * 7, 10 + (i % 2) * 2, 7.5 + i * 7, 15 + (i % 2) * 2], '#ff8cb0'); } });
  SP.candle = canvasSprite(8, 24, x => { x.fillStyle = '#d8ccb0'; x.fillRect(2, 10, 4, 14); x.fillStyle = '#b8ac90'; x.fillRect(5, 10, 1, 14); x.fillStyle = '#e8dcc0'; x.fillRect(2, 12, 1, 4); },
    x => { P2(x, [4, 2, 6, 7, 4, 10, 2, 7], '#ffbe55'); E2(x, 4, 7, 1, 1.6, '#fff4c8'); });
  SP.candleOut = canvasSprite(8, 24, x => { x.fillStyle = '#9c927c'; x.fillRect(2, 10, 4, 14); x.fillStyle = '#222'; x.fillRect(4, 8, 1, 2); });
  SP.altar = canvasSprite(48, 40, x => {
    x.fillStyle = '#2a2420'; x.fillRect(4, 24, 40, 16); x.fillStyle = '#3a322c'; x.fillRect(2, 22, 44, 4);
    x.fillStyle = '#9a9aa6'; x.fillRect(23, 0, 3, 22); x.fillStyle = '#5a3a20'; x.fillRect(18, 2, 13, 3); x.fillStyle = '#7a0a0a'; x.fillRect(23, 8, 3, 6);
  }, x => { x.fillStyle = '#c01818'; x.fillRect(23, 14, 3, 8); });
}

/* =========================================================
   레이캐스터 엔진
   ========================================================= */
const FOVP = 0.66;
function Engine(o) {
  const N = o.N, e = {
    N, wall: new Uint8Array(N * N), floor: new Uint8Array(N * N), block: new Uint8Array(N * N),
    WT: o.WT, FT: o.FT, indoor: !!o.indoor, fogD: o.fogD || 9, fogC: o.fogC || [6, 6, 9], amb: o.amb == null ? .35 : o.amb,
    ceilC: o.ceilC || [20, 16, 18], wallH: o.wallH || 1, trees: [], treeCells: null, lights: [], dyn: [], lightMul: 1, flick: 1,
    lantern: o.lantern == null ? 3.2 : o.lantern, lanternC: o.lanternC || [1, .86, .66], decals: [], stars: null, pics: new Map()
  };
  // 벽에 거는 그림 (창문·거울·초상화…). face: 'x-' 'x+' 'z-' 'z+' = 그 면의 바깥쪽. cells 는 보는 사람 기준 왼쪽→오른쪽.
  const FACE = { 'x-': 0, 'x+': 1, 'z-': 2, 'z+': 3 };
  e.addPic = (cells, face, pic) => { pic.n = cells.length; cells.forEach(([cx, cz], i) => e.pics.set((cz * N + cx) * 4 + FACE[face], { p: pic, i })); return pic; };
  const LR = 2, LN = N * LR;
  e.LR = LR; e.lmR = new Float32Array(LN * LN); e.lmG = new Float32Array(LN * LN); e.lmB = new Float32Array(LN * LN);
  e.img = new ImageData(W, H); e.pix = new Uint32Array(e.img.data.buffer);
  e.cvs = document.createElement('canvas'); e.cvs.width = W; e.cvs.height = H; e.cx = e.cvs.getContext('2d');
  e.zbuf = new Float32Array(W); e.zcol = new Float32Array(W);
  if (!e.indoor) e.stars = Array.from({ length: 80 }, () => ({ a: Math.random() * Math.PI * 2, h: .2 + Math.random() * .8, b: 70 + Math.random() * 130 }));
  e.inb = (x, z) => x >= 0 && z >= 0 && x < N && z < N;
  e.addTree = (x, z, r, s) => e.trees.push({ x, z, r, s: s == null ? Math.random() : s });
  e.indexTrees = () => { e.treeCells = new Array(N * N); for (const t of e.trees) { const k = (t.z | 0) * N + (t.x | 0); (e.treeCells[k] || (e.treeCells[k] = [])).push(t); } };
  e.bake = () => {
    e.lmR.fill(0); e.lmG.fill(0); e.lmB.fill(0);
    for (const L of e.lights) {
      if (L.off) continue;
      const r = L.r, x0 = Math.max(0, ((L.x - r) * LR) | 0), x1 = Math.min(LN - 1, ((L.x + r) * LR) | 0), z0 = Math.max(0, ((L.z - r) * LR) | 0), z1 = Math.min(LN - 1, ((L.z + r) * LR) | 0);
      for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) {
        const d = Math.hypot((xx + .5) / LR - L.x, (zz + .5) / LR - L.z); if (d >= r) continue;
        const k = (1 - d / r); const v = k * k * L.i, i = zz * LN + xx;
        e.lmR[i] += v * L.c[0]; e.lmG[i] += v * L.c[1]; e.lmB[i] += v * L.c[2];
      }
    }
  };
  e.solid = (x, z) => { const ix = x | 0, iz = z | 0; if (!e.inb(ix, iz)) return true; const k = iz * N + ix; return e.wall[k] > 0 || e.block[k] > 0; };
  e.treeHit = (x, z, r) => {
    if (!e.treeCells) return null;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const cx = (x | 0) + dx, cz = (z | 0) + dz; if (!e.inb(cx, cz)) continue;
      const l = e.treeCells[cz * N + cx]; if (!l) continue;
      for (const t of l) { const d = Math.hypot(x - t.x, z - t.z); if (d < r + t.r) return t; }
    }
    return null;
  };
  e.move = (p, dx, dz, r = .24) => {
    const tryAt = (x, z) => !(e.solid(x - r, z - r) || e.solid(x + r, z - r) || e.solid(x - r, z + r) || e.solid(x + r, z + r));
    if (tryAt(p.x + dx, p.z)) p.x += dx;
    if (tryAt(p.x, p.z + dz)) p.z += dz;
    const t = e.treeHit(p.x, p.z, r);
    if (t) { const d = Math.hypot(p.x - t.x, p.z - t.z) || .01, push = r + t.r - d; const nx = p.x + (p.x - t.x) / d * push, nz = p.z + (p.z - t.z) / d * push; if (tryAt(nx, nz)) { p.x = nx; p.z = nz; } }
  };
  e.los = (x0, z0, x1, z1) => { const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d * 4); for (let i = 1; i < n; i++) { const t = i / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t); if (e.wall[(z | 0) * N + (x | 0)]) return false; } return true; };
  e.lightAt = (x, z, cam) => {
    let r = e.amb, gg = e.amb, b = e.amb;
    const lx = (x * LR) | 0, lz = (z * LR) | 0;
    if (lx >= 0 && lz >= 0 && lx < LN && lz < LN) { const i = lz * LN + lx, m = e.lightMul * e.flick; r += e.lmR[i] * m; gg += e.lmG[i] * m; b += e.lmB[i] * m; }
    if (cam && e.lantern > 0) { const d = Math.hypot(x - cam.x, z - cam.z); if (d < e.lantern) { const k = 1 - d / e.lantern, v = k * k * (e.lanternI || .9); r += v * e.lanternC[0]; gg += v * e.lanternC[1]; b += v * e.lanternC[2]; } }
    for (const L of e.dyn) { const d = Math.hypot(x - L.x, z - L.z); if (d < L.r) { const k = 1 - d / L.r, v = k * k * L.i; r += v * L.c[0]; gg += v * L.c[1]; b += v * L.c[2]; } }
    return [r, gg, b];
  };

  // 화면 그리기. sprites: [{spr,x,z,w,h,y0,glow,tint,shake}]
  e.render = (cam, sprites) => {
    const pix = e.pix, zbuf = e.zbuf, zcol = e.zcol, fogD = e.fogD, fogC = e.fogC, fogS = 1;
    const dirX = Math.cos(cam.yaw), dirZ = Math.sin(cam.yaw), plX = -dirZ * FOVP, plZ = dirX * FOVP;
    const hor = (H / 2 + (cam.bob || 0)) | 0;
    const fogT = d => { const t = clamp((d - fogS) / (fogD - fogS), 0, 1); return t * t * (3 - 2 * t); };
    const lanI = e.lanternI || .9, EM = e.spot ? e.emisB || (e.emisB = new Uint8Array(W * H)) : null; if (EM) EM.fill(0);
    const LM = e.lightMul * e.flick, lmR = e.lmR, lmG = e.lmG, lmB = e.lmB, amb = e.amb, lan = e.lantern, lc = e.lanternC, dyn = e.dyn;
    const camX = cam.x, camZ = cam.z;
    const litAt = (x, z, out) => {
      let r = amb, gg = amb, b = amb;
      const lx = (x * LR) | 0, lz = (z * LR) | 0;
      if (lx >= 0 && lz >= 0 && lx < LN && lz < LN) { const i = lz * LN + lx; r += lmR[i] * LM; gg += lmG[i] * LM; b += lmB[i] * LM; }
      if (lan > 0) { const dx = x - camX, dz = z - camZ, d2 = dx * dx + dz * dz; if (d2 < lan * lan) { const k = 1 - Math.sqrt(d2) / lan, v = k * k * lanI; r += v * lc[0]; gg += v * lc[1]; b += v * lc[2]; } }
      for (let q = 0; q < dyn.length; q++) { const L = dyn[q], dx = x - L.x, dz = z - L.z, d2 = dx * dx + dz * dz; if (d2 < L.r * L.r) { const k = 1 - Math.sqrt(d2) / L.r, v = k * k * L.i; r += v * L.c[0]; gg += v * L.c[1]; b += v * L.c[2]; } }
      out[0] = r; out[1] = gg; out[2] = b;
    };
    const lt = [0, 0, 0];
    // 하늘 / 천장
    const fogPack = pack(fogC[0], fogC[1], fogC[2]);
    const rd0x = dirX - plX, rd0z = dirZ - plZ, rd1x = dirX + plX, rd1z = dirZ + plZ;
    if (!e.indoor) {
      for (let y = 0; y <= hor && y < H; y++) { const t = y / Math.max(1, hor); pix.fill(pack(lerp(2, fogC[0] + 6, t) | 0, lerp(2, fogC[1] + 5, t) | 0, lerp(6, fogC[2] + 10, t) | 0), y * W, y * W + W); }
      for (const s of e.stars) { const rel = angDiff(s.a - cam.yaw); if (Math.abs(rel) > .6) continue; const x = (W / 2 + Math.tan(rel) / FOVP * W / 2) | 0, y = (hor - s.h * hor) | 0; if (x >= 0 && x < W && y >= 0 && y < hor) pix[y * W + x] = pack(s.b, s.b, s.b + 20); }
    }
    // 바닥 (+ 실내면 천장)
    const FT = e.FT, CC = e.ceilC, floorA = e.floor, decals = e.decals;
    for (let y = Math.max(0, hor + 1); y < H; y++) {
      const rowDist = (.5 * H) / (y - hor);
      const yc = 2 * hor - y;
      if (rowDist > fogD) { pix.fill(fogPack, y * W, y * W + W); if (e.indoor && yc >= 0 && yc < H) pix.fill(fogPack, yc * W, yc * W + W); continue; }
      const ft = fogT(rowDist), kf = 1 - ft;
      const sx = rowDist * (rd1x - rd0x) / W, sz = rowDist * (rd1z - rd0z) / W;
      let fx_ = camX + rowDist * rd0x, fz_ = camZ + rowDist * rd0z;
      const row = y * W, rowc = yc * W;
      for (let x = 0; x < W; x++, fx_ += sx, fz_ += sz) {
        const ix = fx_ | 0, iz = fz_ | 0;
        const t = (ix >= 0 && iz >= 0 && ix < N && iz < N) ? floorA[iz * N + ix] : 0;
        const F = FT[t] || FT[0];
        let r = F.col[0], gg = F.col[1], b = F.col[2];
        const n = hash((fx_ * 4) | 0, (fz_ * 4) | 0);
        let m = .8 + n / 255 * .35;
        if (F.tex === 'tile' && ((fx_ % 1) < .05 || (fz_ % 1) < .05)) m *= .55;
        else if (F.tex === 'board' && (fx_ * 3 % 1) < .08) m *= .5;
        else if (F.tex === 'check') { if ((((fx_ * 1) | 0) + ((fz_ * 1) | 0)) & 1) m *= .45; }
        else if (F.tex === 'carpet') { const u = (fx_ * 2) % 1, v = (fz_ * 2) % 1; if (Math.abs(u - .5) < .08 || Math.abs(v - .5) < .08) m *= 1.25; }
        else if (F.tex === 'blood') { const s = hash((fx_ * 2) | 0, (fz_ * 2) | 0); if (s > 120) { r = 96; gg = 8; b = 10; } }
        if (F.decal != null) { const D = decals[F.decal]; if (D) { const u = ((fx_ - D.x) / D.w * D.iw) | 0, v = ((fz_ - D.z) / D.h * D.ih) | 0; if (u >= 0 && v >= 0 && u < D.iw && v < D.ih) { const k = (v * D.iw + u) * 4; if (D.d[k + 3] > 100) { r = D.d[k]; gg = D.d[k + 1]; b = D.d[k + 2]; } } } }
        litAt(fx_, fz_, lt);
        let lr = lt[0] * m, lg = lt[1] * m, lb = lt[2] * m;
        if (F.glow) { const gw = F.glow * m; if (lr < gw) lr = gw; if (lg < gw) lg = gw; if (lb < gw) lb = gw; }
        pix[row + x] = pack((r * lr * kf + fogC[0] * ft) | 0, (gg * lg * kf + fogC[1] * ft) | 0, (b * lb * kf + fogC[2] * ft) | 0);
        if (e.indoor && yc >= 0 && yc < H) {
          const cm = .85 + (n & 31) / 255;
          pix[rowc + x] = pack((CC[0] * lt[0] * .7 * cm * kf + fogC[0] * ft) | 0, (CC[1] * lt[1] * .7 * cm * kf + fogC[1] * ft) | 0, (CC[2] * lt[2] * .7 * cm * kf + fogC[2] * ft) | 0);
        }
      }
    }
    if (e.indoor) for (let y = 0; y <= Math.min(H - 1, 2 * hor - H); y++) pix.fill(fogPack, y * W, y * W + W);
    // 벽 (DDA)
    const WT = e.WT, wallA = e.wall, wallH = e.wallH;
    for (let x = 0; x < W; x++) {
      const cx = 2 * x / W - 1, rdx = dirX + plX * cx, rdz = dirZ + plZ * cx;
      let mx = camX | 0, mz = camZ | 0;
      const ddx = Math.abs(1 / (rdx || 1e-9)), ddz = Math.abs(1 / (rdz || 1e-9));
      let stx, stz, sdx, sdz;
      if (rdx < 0) { stx = -1; sdx = (camX - mx) * ddx; } else { stx = 1; sdx = (mx + 1 - camX) * ddx; }
      if (rdz < 0) { stz = -1; sdz = (camZ - mz) * ddz; } else { stz = 1; sdz = (mz + 1 - camZ) * ddz; }
      let hit = 0, side = 0;
      for (let k = 0; k < 80; k++) {
        if (sdx < sdz) { sdx += ddx; mx += stx; side = 0; } else { sdz += ddz; mz += stz; side = 1; }
        if (mx < 0 || mz < 0 || mx >= N || mz >= N) break;
        const t = wallA[mz * N + mx]; if (t) { hit = t; break; }
        if ((side ? sdz - ddz : sdx - ddx) > fogD + 1) break;
      }
      if (!hit) { zbuf[x] = 99; continue; }
      const perp = side ? sdz - ddz : sdx - ddx;
      if (perp > fogD + .5) { zbuf[x] = 99; continue; }
      zbuf[x] = perp;
      const Wd = WT[hit], lh = H / perp, wh = Wd.h || wallH;
      const bot = hor + .5 * lh, top = bot - wh * lh;
      let wx = side ? camX + perp * rdx : camZ + perp * rdz; wx -= Math.floor(wx);
      const ft = fogT(perp), kf = 1 - ft, sh = side ? .72 : 1;
      const hx = camX + perp * rdx - (side ? 0 : stx * .02), hz = camZ + perp * rdz - (side ? stz * .02 : 0);
      litAt(hx, hz, lt);
      const base = Wd.col, tex = Wd.tex;
      const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H - 1, Math.floor(bot));
      if (Wd.emis) { const kk = .4 * kf + .6; for (let y = y0; y <= y1; y++) { const vh = (bot - y) / lh, m = .85 + .15 * Math.sin(vh * 9 + now() * 3) + (hash(x, y) & 15) / 255; pix[y * W + x] = pack((base[0] * m * kk) | 0, (base[1] * m * kk) | 0, (base[2] * m * kk) | 0); if (EM) EM[y * W + x] = 1; } continue; }
      const patch = hash(mx * 3 + 1, mz * 7 + 3);
      const fi = side ? (stz > 0 ? 2 : 3) : (stx > 0 ? 0 : 1), pc = e.pics.size ? e.pics.get((mz * N + mx) * 4 + fi) : null;
      let pu = 0, PS = null, PP = null;
      if (pc) { PP = pc.p; PS = PP.spr; const uu = (fi === 1 || fi === 2) ? 1 - wx : wx; pu = Math.min(PS.w - 1, ((pc.i + uu) / PP.n * PS.w) | 0); }
      for (let y = y0; y <= y1; y++) {
        const vh = (bot - y) / lh;
        if (PS && vh >= PP.yb && vh <= PP.yt) {
          const pv = Math.min(PS.h - 1, ((PP.yt - vh) / (PP.yt - PP.yb) * PS.h) | 0), k = pv * PS.w + pu;
          if (PS.a[k]) {
            if (PS.e[k]) { const kk = .45 * kf + .55; pix[y * W + x] = pack((PS.r[k] * kk) | 0, (PS.g[k] * kk) | 0, (PS.b[k] * kk) | 0); if (EM) EM[y * W + x] = 1; continue; }
            let l0 = lt[0], l1 = lt[1], l2 = lt[2]; if (PP.glow) { l0 = Math.max(l0, PP.glow); l1 = Math.max(l1, PP.glow); l2 = Math.max(l2, PP.glow); }
            pix[y * W + x] = pack((PS.r[k] * sh * l0 * kf + fogC[0] * ft) | 0, (PS.g[k] * sh * l1 * kf + fogC[1] * ft) | 0, (PS.b[k] * sh * l2 * kf + fogC[2] * ft) | 0); continue;
          }
        }
        let m = sh, r = base[0], gg = base[1], b = base[2];
        if (tex === 'curtain') m *= .6 + .4 * Math.sin(wx * 22 + Math.sin(vh * 3) * .5);
        else if (tex === 'wood') { if ((wx * 4) % 1 < .06) m *= .5; if (vh < .12) m *= .6; if (Math.abs(vh - wh * .45) < .03) m *= .6; }
        else if (tex === 'hedge') { const q = hash((wx * 14) | 0, (vh * 14) | 0 + mx * 13 + mz); m *= .55 + q / 255 * .6; }
        else if (tex === 'bars') { if ((wx * 6) % 1 > .2 && vh > .05 && vh < wh - .05) { continue; } m *= .9; }
        else if (tex === 'door') { if (Math.abs(wx - .5) < .02 || wx < .06 || wx > .94 || vh > wh * .92) m *= .5; if (Math.abs(wx - .8) < .04 && Math.abs(vh - .5) < .04) { r = 200; gg = 170; b = 70; } }
        else if (tex === 'paper') { if (((wx * 5) | 0) % 2 === 0) m *= .82; if (vh < .25) { r *= .6; gg *= .55; b *= .5; } }
        else if (tex === 'shelf') { const sv = (vh * 4) % 1; if (sv < .1) m *= .45; else { const bk = hash((wx * 9) | 0 + mx * 7, (vh * 4) | 0 + mz * 3); r = 40 + (bk & 63); gg = 20 + ((bk >> 2) & 31); b = 18 + ((bk >> 3) & 31); m *= .9; } }
        else {
          const rw = Math.floor(vh * 4), off = (rw & 1) * .5;
          if ((vh * 4) % 1 < .1 || ((wx * 2 + off) % 1) < .06) m *= .55;
          if (hash(rw + mx * 5, ((wx * 2 + off) | 0) + mz * 11) < 40) m *= .7;
          if (patch < 60 && vh > wh * .7) m *= .6;
        }
        pix[y * W + x] = pack((r * m * lt[0] * kf + fogC[0] * ft) | 0, (gg * m * lt[1] * kf + fogC[1] * ft) | 0, (b * m * lt[2] * kf + fogC[2] * ft) | 0);
      }
    }
    // 스프라이트 투영
    const inv = 1 / (plX * dirZ - dirX * plZ);
    const proj = (sx_, sz_) => { const dx = sx_ - camX, dz = sz_ - camZ; return [inv * (dirZ * dx - dirX * dz), inv * (-plZ * dx + plX * dz)]; };
    zcol.set(zbuf);
    // 나무 기둥
    if (e.treeCells) {
      const trees = [], R = Math.ceil(fogD) + 1, cix = camX | 0, ciz = camZ | 0;
      for (let cz = ciz - R; cz <= ciz + R; cz++) for (let cx2 = cix - R; cx2 <= cix + R; cx2++) {
        if (cx2 < 0 || cz < 0 || cx2 >= N || cz >= N) continue;
        const l = e.treeCells[cz * N + cx2]; if (!l) continue;
        for (const t of l) { const [tx, ty] = proj(t.x, t.z); if (ty > .1 && ty < fogD + 1) trees.push({ t, tx, ty }); }
      }
      trees.sort((a, b) => a.ty - b.ty);
      for (const { t, tx, ty } of trees) {
        const scale = H / ty, sx = W / 2 * (1 + tx / ty), wpx = 2 * t.r * scale;
        const x0 = Math.floor(sx - wpx / 2), x1 = Math.floor(sx + wpx / 2);
        if (x1 < 0 || x0 >= W) continue;
        const bot = Math.min(H - 1, Math.floor(hor + .5 * scale)), top = Math.max(0, Math.ceil(hor + .5 * scale - 7 * scale));
        const ft = fogT(ty), kf = 1 - ft, cb = 30 + t.s * 34;
        litAt(t.x - (t.x - camX) / (ty + .01) * t.r, t.z - (t.z - camZ) / (ty + .01) * t.r, lt);
        for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
          if (ty >= zcol[x]) continue;
          zcol[x] = ty;
          const u = (x - (sx - wpx / 2)) / wpx, edge = 1 - Math.abs(u - .5) * 1.3;
          for (let y = top; y <= bot; y++) {
            const bark = (hash(x - x0 + ((t.s * 99) | 0), (y / scale * 6) | 0) & 31) / 160;
            const m = edge * (.85 + bark) * (u > .62 ? .55 : 1);
            pix[y * W + x] = pack((cb * m * lt[0] * kf + fogC[0] * ft) | 0, (cb * .92 * m * lt[1] * kf + fogC[1] * ft) | 0, (cb * .82 * m * lt[2] * kf + fogC[2] * ft) | 0);
          }
        }
      }
    }
    const list = [];
    for (const s of sprites) { const [tx, ty] = s.q ? proj((s.q.x1 + s.q.x2) / 2, (s.q.z1 + s.q.z2) / 2) : proj(s.x, s.z); if ((ty > .12 || s.q) && ty < fogD + 2) list.push({ s, tx, ty }); }
    list.sort((a, b) => b.ty - a.ty);
    const drawQuad = s => {
      const q = s.q, spr = s.spr, NEAR = .06;
      let x1 = q.x1, z1 = q.z1, x2 = q.x2, z2 = q.z2, u1 = 0, u2 = 1;
      let [tx1, ty1] = proj(x1, z1), [tx2, ty2] = proj(x2, z2);
      if (ty1 < NEAR && ty2 < NEAR) return;
      if (ty1 < NEAR) { const t = (NEAR - ty1) / (ty2 - ty1); x1 += (x2 - x1) * t; z1 += (z2 - z1) * t; u1 = t; [tx1, ty1] = proj(x1, z1); }
      else if (ty2 < NEAR) { const t = (NEAR - ty2) / (ty1 - ty2); x2 += (x1 - x2) * t; z2 += (z1 - z2) * t; u2 = 1 - t; [tx2, ty2] = proj(x2, z2); }
      const sx1 = W / 2 * (1 + tx1 / ty1), sx2 = W / 2 * (1 + tx2 / ty2);
      if (sx2 <= sx1 + .01) return; // 뒷면
      const iz1 = 1 / ty1, iz2 = 1 / ty2, uz1 = u1 * iz1, uz2 = u2 * iz2;
      litAt((q.x1 + q.x2) / 2 + (q.nx || 0) * .05, (q.z1 + q.z2) / 2 + (q.nz || 0) * .05, lt);
      const shd = q.sh || 1, lr = lt[0] * shd, lg = lt[1] * shd, lb = lt[2] * shd;
      for (let x = Math.max(0, Math.ceil(sx1)); x <= Math.min(W - 1, Math.floor(sx2)); x++) {
        const k0 = (x + .5 - sx1) / (sx2 - sx1), iz = iz1 + (iz2 - iz1) * k0, d = 1 / iz;
        if (d >= zbuf[x]) continue;
        let pu = (((uz1 + (uz2 - uz1) * k0) * d) * spr.w) | 0; if (pu < 0) pu = 0; if (pu >= spr.w) pu = spr.w - 1;
        const scale = H / d, bot = hor + (.5 - q.yb) * scale, top = hor + (.5 - q.yt) * scale, hpx = bot - top;
        const ft = fogT(d), kf = 1 - ft;
        for (let y = Math.max(0, Math.ceil(top)); y <= Math.min(H - 1, Math.floor(bot)); y++) {
          let pv = ((y - top) / hpx * spr.h) | 0; if (pv >= spr.h) pv = spr.h - 1;
          const k = pv * spr.w + pu; if (!spr.a[k]) continue;
          if (spr.e[k]) { pix[y * W + x] = pack(spr.r[k], spr.g[k], spr.b[k]); if (EM) EM[y * W + x] = 1; continue; }
          pix[y * W + x] = pack((spr.r[k] * lr * kf + fogC[0] * ft) | 0, (spr.g[k] * lg * kf + fogC[1] * ft) | 0, (spr.b[k] * lb * kf + fogC[2] * ft) | 0);
        }
      }
    };
    for (const { s, tx, ty } of list) {
      if (s.q) { drawQuad(s); continue; }
      const spr = s.spr, tyS = Math.max(ty, .3), scale = H / tyS, sx = W / 2 * (1 + tx / ty) + (s.shake ? (Math.random() - .5) * s.shake : 0);
      const hpx = s.h * scale, wpx = s.w * scale;
      const bot = hor + (.5 - (s.y0 || 0)) * scale, top = bot - hpx;
      const x0 = Math.floor(sx - wpx / 2), x1 = Math.floor(sx + wpx / 2);
      if (x1 < 0 || x0 >= W) continue;
      const ft = fogT(ty) * (s.glow ? .4 : 1), kf = 1 - ft;
      litAt(s.x, s.z, lt);
      let lr = lt[0], lg = lt[1], lb = lt[2];
      if (s.glow) { lr = Math.max(lr, s.glow); lg = Math.max(lg, s.glow); lb = Math.max(lb, s.glow); }
      const tint = s.tint;
      const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H - 1, Math.floor(bot));
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
        if (ty >= zcol[x]) continue;
        let pu = ((x - (sx - wpx / 2)) / wpx * spr.w) | 0; if (pu >= spr.w) pu = spr.w - 1; if (s.flip) pu = spr.w - 1 - pu;
        for (let y = y0; y <= y1; y++) {
          let pv = ((y - top) / hpx * spr.h) | 0; if (pv >= spr.h) pv = spr.h - 1;
          const k = pv * spr.w + pu;
          if (!spr.a[k]) continue;
          let r = spr.r[k], gg = spr.g[k], b = spr.b[k];
          if (spr.e[k]) { pix[y * W + x] = pack(r, gg, b); if (EM) EM[y * W + x] = 1; continue; }
          if (tint) { r = lerp(r, tint[0], tint[3]); gg = lerp(gg, tint[1], tint[3]); b = lerp(b, tint[2], tint[3]); }
          pix[y * W + x] = pack((r * lr * kf + fogC[0] * ft) | 0, (gg * lg * kf + fogC[1] * ft) | 0, (b * lb * kf + fogC[2] * ft) | 0);
        }
      }
    }
    // 손전등: 화면 가운데 원만 밝고 나머지는 어둠 (스스로 빛나는 것은 그대로)
    if (e.spot) {
      const sp = e.spot, key = (sp.r | 0) + ':' + (sp.soft | 0) + ':' + sp.out + ':' + (sp.cy | 0);
      if (e.maskKey !== key) {
        e.maskKey = key; const M = e.mask || (e.mask = new Float32Array(W * H)), cy = sp.cy == null ? H / 2 : sp.cy;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const d = Math.hypot((x - W / 2) * .92, (y - cy) * 1.08), c = clamp(1 - (d - sp.r) / sp.soft, 0, 1), cc = c * c * (3 - 2 * c);
          const spill = clamp(1 - d / (sp.r + sp.soft * 3.2), 0, 1) * .22;
          M[y * W + x] = sp.out + (1 - sp.out) * Math.max(cc, spill);
        }
      }
      const M = e.mask, fk = sp.k == null ? 1 : sp.k;
      for (let i = 0; i < W * H; i++) {
        if (EM[i]) continue;
        const m = sp.out + (M[i] - sp.out) * fk; if (m >= .999) continue;
        const v = pix[i]; pix[i] = (0xff000000 | (((v >>> 16 & 255) * m) << 16) | (((v >>> 8 & 255) * m) << 8) | ((v & 255) * m)) >>> 0;
      }
    }
    e.cx.putImageData(e.img, 0, 0);
    g.drawImage(e.cvs, 0, 0);
    e.proj = proj;
  };
  // 화면 좌표로 (HUD용)
  e.toScreen = (cam, x, z, y = 0) => {
    const dirX = Math.cos(cam.yaw), dirZ = Math.sin(cam.yaw), plX = -dirZ * FOVP, plZ = dirX * FOVP;
    const inv = 1 / (plX * dirZ - dirX * plZ), dx = x - cam.x, dz = z - cam.z;
    const tx = inv * (dirZ * dx - dirX * dz), ty = inv * (-plZ * dx + plX * dz);
    if (ty <= .1) return null;
    return { x: W / 2 * (1 + tx / ty), y: H / 2 + (cam.bob || 0) + (.5 - y) * H / ty, d: ty };
  };
  return e;
}

/* =========================================================
   1인칭 조작 (공통)
   ========================================================= */
let lockedLook = 0, lastMX = null;
api.cv.addEventListener('mousemove', ev => {
  const s = api.scene(); if (!s || !s.fp || api.paused()) return;
  if (document.pointerLockElement === api.cv) lockedLook += ev.movementX * .0028 * api.sens();
});
function fpControls(cam, dt, o = {}) {
  const sp = o.speed || 2.2;
  let f = 0, s = 0, turn = 0;
  if (keys.w || keys.ArrowUp) f += 1;
  if (keys.s || keys.ArrowDown) f -= 1;
  if (keys.a) s -= 1;
  if (keys.d) s += 1;
  if (keys.ArrowLeft || keys.q) turn -= 1;
  if (keys.ArrowRight || keys.e) turn += 1;
  const J = api.joy; f += -J.y; s += J.x;
  f = clamp(f, -1, 1); s = clamp(s, -1, 1);
  cam.yaw += turn * 2.4 * dt * api.sens() + lockedLook; lockedLook = 0;
  if (o.lock) { f = 0; s = 0; }
  const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
  const dirX = Math.cos(cam.yaw), dirZ = Math.sin(cam.yaw);
  const vx = (dirX * f - dirZ * s) * sp * dt, vz = (dirZ * f + dirX * s) * sp * dt;
  return { vx, vz, moving: Math.hypot(f, s) > .15, turned: turn !== 0 };
}
// 드래그로 시점 (터치 · 잠기지 않은 마우스)
function fpPointer(cam, t, x) {
  if (t === 'down') { lastMX = x; if (!TOUCH && document.pointerLockElement !== api.cv && api.cv.requestPointerLock) { try { const r = api.cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} } }
  else if (t === 'move' && ptr.down && lastMX != null && document.pointerLockElement !== api.cv) { cam.yaw += (x - lastMX) / W * (TOUCH ? 3.4 : 2.6) * api.sens(); lastMX = x; }
  else if (t === 'up') lastMX = null;
}
function exitLock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (_) {} }

// 화면 앞에서 갑자기 튀어나오는 얼굴 (장 안에서 쓰는 짧은 점프스케어)
function scareOverlay(t, dur, big) {
  if (t <= 0) return;
  const k = 1 - t / dur;
  if (chicken()) { g.fillStyle = `rgba(255,200,220,${.5 * (t / dur)})`; g.fillRect(0, 0, W, H); cuteGhost(W / 2, H / 2 + 10, 50 + k * 30, { face: 'boo' }); txt('까꿍!', W / 2, 70, { size: 26, color: '#ff5c8a', w: 800, shadow: false }); return; }
  g.fillStyle = `rgba(40,0,0,${.75 * Math.min(1, t / dur * 2)})`; g.fillRect(0, 0, W, H);
  drawFace(W / 2 + (Math.random() - .5) * 12, H / 2 + 20 + (Math.random() - .5) * 12, (big ? .95 : .6) + k * .7, now(), true);
}
function bigScare() { sfx.screech(); if (!chicken()) { osc('sawtooth', 1200, .9, { vol: .2, f2: 300 }); nz(1, { type: 'bandpass', f: 2600, q: .7, vol: .5, a: .003 }); osc('sine', 46, .9, { vol: .7, f2: 26, a: .003 }); } vib([240, 50, 320]); fx.glitch = 2; fx.shake = api.reduced ? 3 : 14; }

/* =========================================================
   하드 1장 : 붉은 길 — 촛불 길을 따라 숲을 베어 나간다
   ========================================================= */
function HCh1() {
  buildSprites();
  const N = 72, R = rng((Math.random() * 1e9) | 0);
  const FT = [{ col: [26, 30, 20] }, { col: [70, 54, 38] }, { col: [92, 12, 12], tex: 'blood' }, { col: [30, 34, 24] }, { col: [120, 10, 12], tex: 'blood', glow: .55 }];
  const e = Engine({ N, WT: [null, { col: [30, 40, 26], tex: 'hedge', h: 2.6 }], FT, fogD: 9.5, fogC: [5, 6, 8], amb: .24, lantern: 3, lanternC: [.75, .72, .68] });
  // 길: 휘어지며 숲을 가로지른다
  // 목적지에 닿고, 길끼리 5칸 이상 떨어진(샛길처럼 보이지 않는) 모양이 나올 때까지 다시 뽑는다
  let path = [];
  for (let tries = 0; tries < 300; tries++) {
    const P = []; let x = 8, z = N - 8, a = -Math.PI / 2 + .3, len = 0, reached = false;
    P.push({ x, z });
    while (len < 118) {
      const tx = N - 10, tz = 10, want = Math.atan2(tz - z, tx - x);
      a += angDiff(want - a) * (tries > 150 ? .1 : .06) + (R() - .5) * .5;
      if (x < 7) a += .2; if (x > N - 7) a -= .2; if (z < 7) a += .2; if (z > N - 7) a -= .2;
      x += Math.cos(a) * 1; z += Math.sin(a) * 1; x = clamp(x, 5, N - 5); z = clamp(z, 5, N - 5); len++;
      P.push({ x, z });
      if (Math.hypot(tx - x, tz - z) < 2) { reached = true; break; }
    }
    path = P;
    if (!reached) continue;
    let ok = true;
    for (let i = 0; i < P.length && ok; i++) for (let j = i + 12; j < P.length; j++) if (Math.hypot(P[i].x - P[j].x, P[i].z - P[j].z) < 5) { ok = false; break; }
    if (ok) break;
  }
  const PL = path.length - 1;
  // 길까지의 거리 지도
  const LR = 2, DN = N * LR, dist = new Float32Array(DN * DN), near = new Uint16Array(DN * DN);
  for (let zz = 0; zz < DN; zz++) for (let xx = 0; xx < DN; xx++) {
    const px = (xx + .5) / LR, pz = (zz + .5) / LR; let best = 1e9, bi = 0;
    for (let i = 0; i < path.length; i++) { const d = (path[i].x - px) ** 2 + (path[i].z - pz) ** 2; if (d < best) { best = d; bi = i; } }
    dist[zz * DN + xx] = Math.sqrt(best); near[zz * DN + xx] = bi;
  }
  const dAt = (x, z) => { const xx = clamp((x * LR) | 0, 0, DN - 1), zz = clamp((z * LR) | 0, 0, DN - 1); return dist[zz * DN + xx]; };
  const iAt = (x, z) => { const xx = clamp((x * LR) | 0, 0, DN - 1), zz = clamp((z * LR) | 0, 0, DN - 1); return near[zz * DN + xx]; };
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const k = z * N + x;
    if (x < 2 || z < 2 || x >= N - 2 || z >= N - 2) { e.wall[k] = 1; continue; }
    const d = dAt(x + .5, z + .5);
    e.floor[k] = d < 1 ? 1 : (hash(x, z) < 40 ? 3 : 0);
  }
  for (let i = 0; i < 2600; i++) {
    const x = 2.5 + R() * (N - 5), z = 2.5 + R() * (N - 5), d = dAt(x, z);
    if (d < 1.7) continue;
    if (d < 3.5 && R() < .55) continue;
    if (e.treeHit(x, z, .5)) continue;
    e.addTree(x, z, .18 + R() * .26);
    if (!e.treeCells) { /* 인덱스는 끝에 */ }
  }
  e.indexTrees();
  const pathTiles = []; for (let k = 0; k < N * N; k++) if (e.floor[k] === 1) pathTiles.push(k);
  let endS = null;
  // 촛불
  const candles = [];
  for (let i = 3, side = 1; i < PL - 2; i += 2, side = -side) {
    const p = path[i], q = path[i + 1], a = Math.atan2(q.z - p.z, q.x - p.x);
    const c = { x: p.x - Math.sin(a) * .95 * side, z: p.z + Math.cos(a) * .95 * side, i, out: false };
    candles.push(c);
    e.lights.push({ x: c.x, z: c.z, r: 3.3, i: .85, c: [1, .62, .3], cand: c });
  }
  e.bake();
  // 그것들: 길을 막고 서 있다
  const foes = [];
  for (let i = 10; i < PL - 6; i += 9 + (R() * 3 | 0)) { const p = path[i]; foes.push({ x: p.x + (R() - .5) * .4, z: p.z + (R() - .5) * .4, alive: true, fall: 0, i, fi: i, mode: 'stand', said: false, sp: .7 }); }
  // 숲에서 튀어나오는 것 (갑툭튀)
  const ambush = []; // 옆에서 튀어나오는 괴물은 뺐다 (숲으로 들어가면 나오는 괴물 떼만 남김)
  const LINES = ['…길을 비켜줄게.', '아파.', '왜 베었어?', '우리도 앨리스였어.', '촛불을 따라가.', '길이 점점 빨개지네.', '벗어나면 안 돼.', '너도 곧 여기 서게 될 거야.', '돌아갈 길은 없어.', '…안녕, 나.', '거의 다 왔어.', '끝까지 가.', '…'];
  const cam = { x: path[0].x, z: path[0].z, yaw: Math.atan2(path[3].z - path[0].z, path[3].x - path[0].x), bob: 0 };
  let warnAt = null, prog = 0, slashT = 9, flash = 0, phase = 'walk', endT = 0, bob = 0, stepAcc = 0, warnT = 0, offT = 0, horde = null, warned = false, kills = 0, scareT = 0, idleT = 0, slashed = false, moved = false, hintSaid = false, firstSeen = false;
  const drops = [];
  const S = {
    game: true, fp: true, touch: 'h3d', act: '베기',
    dbg: { cam, path, get prog() { return prog; }, set prog(v) { prog = v; }, get kills() { return kills; }, get phase() { return phase; }, foes, e },
    enter() { setFx({ noise: .12, wobble: .55 }); drone(.09, .95, 3); api.stopOpening(3.5); say('촛불이 길을 밝히고 있다.', 3); },
    exit() { exitLock(); api.hint(null); },
    slash() {
      if (phase !== 'walk' || slashT < .32) return; slashT = 0; slashed = true; sfx.slash();
      let best = null, bd = 9;
      for (const f of foes) {
        if (!f.alive) continue;
        const d = Math.hypot(f.x - cam.x, f.z - cam.z); if (d > 2.1) continue;
        const rel = Math.abs(angDiff(Math.atan2(f.z - cam.z, f.x - cam.x) - cam.yaw)); if (rel > .6) continue;
        if (d < bd) { bd = d; best = f; }
      }
      if (best) {
        best.alive = false; kills++; flash = 1; fx.glitch = .8; fx.shake = api.reduced ? 2 : 6; sfx.hit(); vib(45);
        // 피로 길을 붉게
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const x = (best.x | 0) + dx, z = (best.z | 0) + dz; if (e.inb(x, z) && e.floor[z * N + x] === 1 && Math.hypot(dx, dz) < 2.3) e.floor[z * N + x] = 2; }
        const n = 8 + Math.random() * 10; for (let k = 0; k < n; k++) drops.push({ x: Math.random() * W, y: Math.random() * H * .7, r: 1 + Math.random() * 4, v: 4 + Math.random() * 12, life: 3 + Math.random() * 3 });
        if (!best.said) { best.said = true; say(LINES[Math.min(LINES.length - 1, kills - 1)], 2.4); }
      }
    },
    key(k) { if (k === ' ' || k === 'Enter' || k === 'x' || k === 'j') this.slash(); },
    pointer(t, x) { fpPointer(cam, t, x); if (t === 'down' && !TOUCH && document.pointerLockElement === api.cv) this.slash(); },
    update(dt) {
      slashT += dt; flash = Math.max(0, flash - dt * 2.2); scareT = Math.max(0, scareT - dt);
      for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.y += (chicken() ? -d.v * .8 : d.v) * dt; d.life -= dt; if (d.life <= 0) drops.splice(i, 1); }
      for (const f of foes) if (!f.alive) f.fall = Math.min(1, f.fall + dt * 2);
      e.flick = .9 + Math.sin(now() * 13) * .04 + Math.sin(now() * 31) * .03;
      if (Math.random() < dt * .1) sfx.snap();
      if (phase === 'walk') {
        const c = fpControls(cam, dt, { speed: 2.1 });
        if (c.moving) { moved = true; e.move(cam, c.vx, c.vz, .22); bob += dt * 7; stepAcc += dt; if (stepAcc > .48) { stepAcc = 0; sfx.step(); } }
        cam.bob = Math.sin(bob) * (c.moving ? 2 : 0);
        idleT = c.moving ? 0 : idleT + dt;
        // 진행도
        const d = dAt(cam.x, cam.z), pi = iAt(cam.x, cam.z);
        if (d < 1.6 && pi > prog && pi - prog < 8) prog = pi;
        // 다음 촛불을 더 밝게
        const nc = candles.find(cd => cd.i > prog + 1);
        e.dyn = nc ? [{ x: nc.x, z: nc.z, r: 2.2, i: .5 + .25 * Math.sin(now() * 5), c: [1, .7, .35] }] : [];
        // 길을 벗어나면
        const wv = clamp((d - 1.9) / 1.5, 0, 1);
        e.lightMul = 1 - wv * .75;
        if (wv > 0) { warnT -= dt; if (warnT <= 0) { warnT = 1.6 - wv; sfx.whisper(1.2, (Math.random() - .5) * 1.6); } if (!warned) { warned = true; say('촛불이… 꺼져 간다.', 2.4); } fx.noise = .12 + wv * .25; }
        else fx.noise = .12;
        offT = d > 3.4 ? offT + dt : Math.max(0, offT - dt * 2);
        if (d > 5 || offT > .7) { this.unleash(); return; }
        // 그것들
        for (const f of foes) {
          if (!f.alive) continue;
          const fd = Math.hypot(f.x - cam.x, f.z - cam.z);
          if (!firstSeen && fd < 7) { firstSeen = true; }
          // 길 위에서, 내 앞쪽 가까이 있을 때만 깨어난다 (숲을 가로질러 오지 않음)
          if (f.mode === 'stand' && fd < 6.5 && f.fi - pi > -2 && f.fi - pi < 9) { f.mode = 'come'; sfx.whisper(1.4, 0); }
          if (f.mode === 'come') {
            const sp = (f.sp + kills * .02) * dt;
            let tx = cam.x, tz = cam.z;
            if (Math.abs(f.fi - pi) > 1 || d > 1.3) { // 촛불 길을 따라 한 칸씩
              const nx = path[f.fi]; if (Math.hypot(nx.x - f.x, nx.z - f.z) < .25 && f.fi !== pi) f.fi += f.fi > pi ? -1 : 1;
              tx = path[f.fi].x; tz = path[f.fi].z;
              if (Math.abs(f.fi - pi) <= 1) { tx = cam.x; tz = cam.z; }
            }
            const td = Math.hypot(tx - f.x, tz - f.z) || 1, mv = Math.min(td, sp);
            f.x += (tx - f.x) / td * mv; f.z += (tz - f.z) / td * mv;
          }
          if (fd < .72) { api.die(f.mode === 'rush' ? '숲에서 무언가가 튀어나왔다.' : '그것이 당신을 붙잡았다.', HCh1); return; }
        }
        for (const a of ambush) {
          if (a.done || prog < a.i || foes.some(f => f.alive && f.mode === 'rush')) continue;
          if (a.warn < 0) { // 먼저 덤불이 바스락거리고, 어느 쪽인지 알려준다
            a.warn = 0; const side = Math.random() < .5 ? 1 : -1;
            const p = path[Math.min(PL, a.i + 5)], q = path[Math.min(PL, a.i + 6)], ang = Math.atan2(q.z - p.z, q.x - p.x);
            a.pos = { x: p.x - Math.sin(ang) * 2.4 * side, z: p.z + Math.cos(ang) * 2.4 * side };
            const rel = angDiff(Math.atan2(a.pos.z - cam.z, a.pos.x - cam.x) - cam.yaw);
            const where = Math.abs(rel) > 2.1 ? '뒤' : Math.abs(rel) < .5 ? '앞' : rel > 0 ? '오른쪽' : '왼쪽';
            const pan = clamp(Math.sin(rel), -1, 1) * .9;
            for (let k = 0; k < 4; k++) nz(.25, { type: 'bandpass', f: 900 + Math.random() * 900, q: 1.5, vol: .22, pan, delay: k * .18 });
            sfx.whisper(1, pan); vib(30);
            say(`…${where}에서 무언가 바스락거린다.`, 1.8);
            warnAt = a;
            continue;
          }
          a.warn += dt; if (a.warn < 1.3) continue;
          a.done = true; warnAt = null;
          const f = { x: a.pos.x, z: a.pos.z, alive: true, fall: 0, i: 0, mode: 'rush', said: true, sp: 1.9, wait: .6 };
          foes.push(f); bigScare(); scareT = .12; say('온다—!', 1.4);
        }
        // 힌트: 막혔을 때만
        if (!moved && idleT > 4.5) api.hint(TOUCH ? '◀ 왼쪽 원으로 걷기 ▶' : '▶ W / ↑  걷기   ·   마우스·← →  둘러보기');
        else if (!slashed && foes.some(f => f.alive && Math.hypot(f.x - cam.x, f.z - cam.z) < 3.2)) api.hint(TOUCH ? '● 베기 버튼' : '● SPACE / 클릭  베기');
        else if (wv > .2) api.hint('촛불이 있는 곳으로 돌아가');
        else api.hint(null);
        if (prog >= PL * .8 && Math.hypot(cam.x - path[PL].x, cam.z - path[PL].z) < 1.8) {
          phase = 'end'; endT = 0; api.hint(null); drone(.22, 1.4, 6); exitLock();
          const back = path[Math.max(0, PL - 12)];
          endS = { yaw0: cam.yaw, turn: angDiff(Math.atan2(back.z - cam.z, back.x - cam.x) - cam.yaw), fog0: e.fogD, fogC0: e.fogC.slice(), left: pathTiles.slice(), shown: false };        }
      } else if (phase === 'horde') {
        horde.t += dt;
        for (const f of horde.list) { const fd = Math.hypot(f.x - cam.x, f.z - cam.z); if (fd > .6) { f.x += (cam.x - f.x) / fd * f.sp * dt; f.z += (cam.z - f.z) / fd * f.sp * dt; } }
        e.lightMul = Math.max(0, e.lightMul - dt * 1.5);
        if (horde.t > 1.15 && !horde.dead) { horde.dead = true; api.die('촛불 길을 벗어났다.\n숲이 당신을 삼켰다.', HCh1); }
      } else {
        endT += dt;
        const at = t0 => endT > t0 && endT - dt <= t0;
        // 보이지 않는 곳부터 길을 붉게 — 돌아보기 전엔 아무도 모른다
        if (!endS.shown && endS.left.length) {
          const dX = Math.cos(cam.yaw), dZ = Math.sin(cam.yaw);
          endS.left = endS.left.filter(k => {
            const x = k % N + .5, z = (k / N | 0) + .5, vx = x - cam.x, vz = z - cam.z, d = Math.hypot(vx, vz);
            if (d < .9 || (vx * dX + vz * dZ) / (d || 1) < .62) { e.floor[k] = 4; return false; }
            return true;
          });
        }
        // 등 뒤로 천천히 — 강제로 돌아본다
        const tk = clamp((endT - 2.6) / 3.6, 0, 1), ez = tk * tk * (3 - 2 * tk);
        cam.yaw = endS.yaw0 + endS.turn * ez;
        if (endT > 2.6 && endT < 6.2) { fx.shake = Math.max(fx.shake || 0, .6); }
        if (at(.4)) say('길이 끝났다.', 2.2);
        if (at(2.4)) { say('…등 뒤가 조용하다.', 2.4); sfx.whisper(1.6, 0); }
        if (at(2.5)) { for (const k of endS.left) e.floor[k] = 4; endS.left = []; fx.glitch = 1.2; nz(.22, { type: 'highpass', f: 2400, vol: .3, a: .002 }); } // 테이프가 한 번 튄다
        if (at(6.2)) { // 드러남
          endS.shown = true; for (const k of endS.left) e.floor[k] = 4; endS.left = [];
          osc('sine', 52, 2.6, { vol: .55, f2: 30, a: .01 }); nz(1.6, { type: 'lowpass', f: 300, vol: .35, a: .02 }); osc('sawtooth', 110, 2.2, { vol: .06, f2: 92 });
          fx.glitch = .9; vib([60, 40, 120]);
        }
        if (at(6.6)) say('돌아갈 길은… 온통 붉었다.', 3.2);
        if (endS.shown) { const fk = clamp((endT - 6.2) / 1.6, 0, 1); e.fogD = endS.fog0 + fk * 9; e.fogC = [endS.fogC0[0] + fk * 14 | 0, endS.fogC0[1] | 0, endS.fogC0[2] - fk * 4 | 0]; }
        if (at(9.4)) { say('촛불이 하나씩 꺼진다.', 2.4); }
        if (at(11.6)) { say('나무들이 다가온다.', 2.4); sfx.whisper(2, -.6); sfx.whisper(2, .6); }
        if (endT > 11.6) { for (const t of e.trees) { const d = Math.hypot(t.x - cam.x, t.z - cam.z); if (d < 7 && d > .8) { t.x += (cam.x - t.x) * dt * .09; t.z += (cam.z - t.z) * dt * .09; } } e.indexTrees(); }
        e.lightMul = endT < 9.4 ? 1 : Math.max(.15, 1 - (endT - 9.4) * .2);
        fx.wobble = .6 + Math.max(0, endT - 6) * .25;
        if (endT > 15) { e.fogD = endS.fog0; e.fogC = endS.fogC0; go(Card(T.e1, () => api.startChapter(2), { drone: .04 })); }
      }
    },
    unleash() {
      phase = 'horde'; api.hint(null); exitLock();
      const list = [];
      const ff = { x: cam.x + Math.cos(cam.yaw) * 1.25, z: cam.z + Math.sin(cam.yaw) * 1.25, sp: .6, rush: true };
      list.push(ff);
      for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, r = 2.4 + Math.random() * 4; list.push({ x: cam.x + Math.cos(a) * r, z: cam.z + Math.sin(a) * r, sp: 2 + Math.random() * 2, rush: true }); }
      horde = { t: 0, list, dead: false };
      for (const c of candles) c.out = true;
      bigScare(); scareT = .22; sfx.laugh(); drone(.3, 1.8, .2);
    },
    draw() {
      const sprites = [];
      const ch = chicken();
      for (const c of candles) sprites.push({ spr: (c.out || (phase === 'end' && endT > 9.4 && c.i > PL - (endT - 9.4) * 14)) ? SP.candleOut : SP.candle, x: c.x, z: c.z, w: .12, h: .36, y0: 0 });
      for (const f of foes) {
        if (f.alive) sprites.push({ spr: ch ? SP.ghost : (f.mode === 'rush' || Math.hypot(f.x - cam.x, f.z - cam.z) < 2 ? SP.huskR : SP.husk), x: f.x, z: f.z, w: ch ? .8 : .6, h: ch ? .95 : 1.75, y0: ch ? .35 : 0, shake: Math.hypot(f.x - cam.x, f.z - cam.z) < 4 ? 3 : 0 });
        else sprites.push({ spr: ch ? SP.ghostDead : SP.huskDead, x: f.x, z: f.z, w: .9 * f.fall, h: .45 * f.fall, y0: 0 });
      }
      if (horde) for (const f of horde.list) sprites.push({ spr: ch ? SP.ghostBoo : SP.huskR, x: f.x, z: f.z, w: ch ? .8 : .62, h: ch ? .95 : 1.8, y0: ch ? .35 : 0, shake: 5, glow: ch ? .8 : .45 });
      sprites.push({ spr: SP.altar, x: path[PL].x, z: path[PL].z, w: 1.1, h: .9, y0: 0 });
      e.render(cam, sprites);
      if (phase !== 'end') { // 검
        g.save(); g.translate(W * .86, H + 18 + Math.sin(bob) * 3);
        let a = -.35; if (slashT < .25) a = -.35 - Math.sin(slashT / .25 * Math.PI) * 1.3;
        g.rotate(a);
        const red = Math.min(1, kills / 10);
        poly([-5, 0, 5, 0, 3, -150, 0, -163, -3, -150], ch ? '#f6c3da' : `rgb(${118 + red * 70 | 0},${118 - red * 60 | 0},${124 - red * 70 | 0})`);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-1, -150, 1, 148);
        g.fillStyle = '#1a1512'; g.fillRect(-18, -3, 36, 7); g.fillStyle = '#2a1c14'; g.fillRect(-4, 4, 8, 26);
        g.restore();
        if (slashT < .18) { g.strokeStyle = `rgba(255,240,240,${.55 * (1 - slashT / .18)})`; g.lineWidth = 3; g.beginPath(); g.arc(W * .86, H + 18, 150, -Math.PI / 2 - 1.55, -Math.PI / 2 - .3); g.stroke(); }
      }
      for (const d of drops) { if (ch) { heart(d.x, d.y, d.r * 2, `rgba(255,120,170,${Math.min(1, d.life) * .9})`); continue; } ell(d.x, d.y, d.r * .8, d.r * 1.3, `rgba(120,0,0,${Math.min(1, d.life) * .85})`); }
      if (flash > 0) { g.fillStyle = ch ? `rgba(255,170,210,${flash * .35})` : `rgba(150,0,0,${flash * .45})`; g.fillRect(0, 0, W, H); }
      if (warnAt && phase === 'walk') { // 화면 가장자리에 방향 표시
        const rel = angDiff(Math.atan2(warnAt.pos.z - cam.z, warnAt.pos.x - cam.x) - cam.yaw);
        const pulse = .35 + .35 * Math.sin(now() * 14), col = ch ? '255,140,190' : '200,20,20';
        if (Math.abs(rel) > 2.1) { const gr = g.createLinearGradient(0, H, 0, H - 70); gr.addColorStop(0, `rgba(${col},${pulse})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(0, H - 70, W, 70); txt('▼ 뒤', W / 2, H - 52, { size: 13, color: '#ffb0b0', font: MONO }); }
        else if (Math.abs(rel) >= .5) { const right = rel > 0, x0 = right ? W : 0, gr = g.createLinearGradient(x0, 0, right ? W - 70 : 70, 0); gr.addColorStop(0, `rgba(${col},${pulse})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(right ? W - 70 : 0, 0, 70, H); txt(right ? '오른쪽 ▶' : '◀ 왼쪽', right ? W - 40 : 40, H / 2, { size: 13, color: '#ffb0b0', font: MONO }); }
        else { txt('▲ 앞', W / 2, 70, { size: 13, color: '#ffb0b0', font: MONO }); }
      }
      if (scareT > 0) scareOverlay(scareT, .22, true);
      if (phase === 'end' && endT > 2.44 && endT < 2.68) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
      if (phase === 'horde') { g.fillStyle = `rgba(0,0,0,${clamp(horde.t * .5, 0, .6)})`; g.fillRect(0, 0, W, H); }
    }
  };
  return S;
}


/* =========================================================
   하드 2장 : 푸른 노래 — 텅 빈 극장, 보지 않을 때만 움직이는 관객
   ========================================================= */
function buildTheaterSprites() {
  if (SP.th) return; SP.th = true;
  const seat = (x, who) => {
    x.fillStyle = '#1a0d10'; x.fillRect(3, 16, 2, 4); x.fillRect(11, 16, 2, 4);
    if (who === 'man') { E2(x, 8, 4.2, 3.2, 3.8, '#c2ab88'); x.fillStyle = '#9a8566'; x.fillRect(6.6, 7.5, 2.8, 2); E2(x, 8, 11, 6.4, 3.4, '#b09a78'); }
    if (who === 'hair') { E2(x, 8, 4.4, 3.3, 3.9, '#141012'); E2(x, 8, 11, 6.2, 3.2, '#2a2430'); }
    x.fillStyle = '#5a1420'; x.beginPath(); x.moveTo(1, 18); x.lineTo(1, 8); x.quadraticCurveTo(8, 4, 15, 8); x.lineTo(15, 18); x.closePath(); x.fill();
    x.fillStyle = '#3e0c16'; x.fillRect(1, 15, 14, 3);
    x.strokeStyle = '#a88a3a'; x.lineWidth = .6; x.beginPath(); x.moveTo(1, 18); x.lineTo(1, 8); x.quadraticCurveTo(8, 4, 15, 8); x.lineTo(15, 18); x.stroke();
  };
  SP.seat = canvasSprite(16, 20, x => seat(x), null, 2);
  SP.seatMan = canvasSprite(16, 20, x => seat(x, 'man'), null, 2);
  SP.seatHair = canvasSprite(16, 20, x => seat(x, 'hair'), null, 2);
  const mann = (x, turn) => {
    const sk = '#c9b28c', dk = '#7d6a4e';
    x.fillStyle = sk; P2(x, [9, 20, 15, 20, 16, 34, 8, 34], sk);
    P2(x, [8, 34, 16, 34, 15, 38, 9, 38], dk);
    x.strokeStyle = sk; x.lineWidth = 2.2; x.lineCap = 'round';
    x.beginPath(); x.moveTo(10.5, 38); x.lineTo(10, 62); x.moveTo(13.5, 38); x.lineTo(14, 62); x.stroke();
    if (turn) { x.beginPath(); x.moveTo(9, 21); x.lineTo(4, 30); x.lineTo(3, 22); x.moveTo(15, 21); x.lineTo(20, 30); x.lineTo(21, 22); x.stroke(); }
    else { x.beginPath(); x.moveTo(9, 21); x.lineTo(7, 33); x.lineTo(7.5, 43); x.moveTo(15, 21); x.lineTo(17, 33); x.lineTo(16.5, 43); x.stroke(); }
    for (const [jx, jy] of [[10.3, 49], [13.7, 49], [9, 21], [15, 21]]) E2(x, jx, jy, 1.3, 1.3, dk);
    x.fillStyle = sk; x.fillRect(11.2, 16, 1.6, 4);
    x.save(); x.translate(12, 10); x.rotate(turn ? -.35 : .12); E2(x, 0, 0, 4.4, 5.8, '#d6c09a'); E2(x, -1.6, -.6, 1.3, 1.7, '#100a08'); E2(x, 1.6, -.6, 1.3, 1.7, '#100a08');
    if (turn) { x.fillStyle = '#100a08'; x.fillRect(-1.6, 2.4, 3.2, 1.1); x.fillStyle = '#6a0808'; x.fillRect(-1.9, .6, .5, 4); x.fillRect(1.5, .6, .5, 5); }
    x.strokeStyle = 'rgba(80,60,40,.6)'; x.lineWidth = .4; x.beginPath(); x.moveTo(0, -5.5); x.lineTo(.4, -1); x.stroke(); x.restore();
  };
  SP.mann = canvasSprite(24, 64, x => mann(x, false), x => { E2(x, 10.6, 9.4, .45, .45, '#e8e4ff'); E2(x, 13.6, 9.6, .45, .45, '#e8e4ff'); }, 3);
  SP.mannT = canvasSprite(24, 64, x => mann(x, true), x => { E2(x, 10.3, 9.9, .5, .5, '#ffffff'); E2(x, 13.4, 8.7, .5, .5, '#ffffff'); }, 3);
  SP.piano = canvasSprite(48, 34, x => {
    x.fillStyle = '#050407'; x.beginPath(); x.moveTo(2, 14); x.lineTo(46, 14); x.quadraticCurveTo(46, 4, 30, 6); x.quadraticCurveTo(14, 2, 2, 8); x.closePath(); x.fill();
    x.fillStyle = '#0b0a10'; x.fillRect(2, 14, 44, 8); x.fillStyle = '#e9e4d8'; x.fillRect(4, 15, 40, 4);
    x.fillStyle = '#111'; for (let i = 0; i < 20; i++) x.fillRect(5 + i * 2, 15, .4, 4); for (let i = 0; i < 20; i++) if (i % 7 !== 2 && i % 7 !== 6) x.fillRect(5.6 + i * 2, 15, 1.1, 2.4);
    x.fillStyle = '#050407'; x.fillRect(5, 22, 2, 12); x.fillRect(41, 22, 2, 12); x.fillRect(23, 22, 2, 10);
    x.fillStyle = '#3a2618'; x.fillRect(19, 1, 10, 5); x.fillStyle = '#2a1a12'; x.fillRect(19, 4, 10, 2);
  }, x => { x.fillStyle = '#e6c25a'; x.fillRect(19, 3, 10, .7); P2(x, [23, 1, 25, 1, 24, -2], '#dfe2f0'); }, 2);
  SP.cGhost = canvasSprite(40, 48, x => ghostOn(x, 20, 18, 16, { col: '#e9f0ff' }), null, 2);
  SP.cGhostT = canvasSprite(40, 48, x => ghostOn(x, 20, 18, 16, { col: '#ffe4ef', boo: true }), null, 2);
}
function drawRose(b, ch) {
  g.strokeStyle = '#1a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2, 160); g.quadraticCurveTo(W / 2 + 8, 210, W / 2 - 2, 260 * b + 160 * (1 - b)); g.stroke();
  for (let L = 0; L < 5; L++) {
    const lb = clamp(b * 1.6 - L * .18, 0, 1); if (!lb) continue;
    const rr = (6 + L * 7) * lb, n = 5 + L;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + L * .7 + now() * .05; ell(W / 2 + Math.cos(a) * rr * .6, 150 + Math.sin(a) * rr * .45, rr * .55, rr * .38, ch ? `rgb(${255 - L * 18},${130 + L * 12},${180 + L * 8})` : `rgb(${120 - L * 14},8,${14 + L * 6})`); }
  }
  ell(W / 2, 150, 6 * b, 5 * b, '#2a0206');
}
function HCh2() {
  buildSprites(); buildTheaterSprites();
  const N = 40;
  const FT = [{ col: [40, 22, 30], tex: 'carpet' }, { col: [70, 50, 32], tex: 'board' }, { col: [30, 30, 40] }];
  const WT = [null, { col: [44, 46, 70] }, { col: [40, 38, 120], tex: 'curtain', h: 1.6 }, { col: [66, 46, 32], tex: 'wood', h: 1.3 }];
  const e = Engine({ N, indoor: true, WT, FT, wallH: 1.3, fogD: 31, fogC: [3, 3, 7], amb: .27, ceilC: [24, 22, 46], lantern: 3.4, lanternC: [.7, .72, .85] });
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const k = z * N + x;
    if (x < 3 || x > 36 || z < 3 || z > 37) { e.wall[k] = (z < 3 && x >= 3 && x <= 36) ? 2 : 3; continue; }
    e.floor[k] = z < 10 ? 1 : 0;
    if (z === 37) e.wall[k] = 3;
  }
  for (let x = 3; x <= 36; x++) e.wall[2 * N + x] = 2;
  // 무대 양옆 막
  for (let z = 3; z < 9; z++) { e.wall[z * N + 3] = 2; e.wall[z * N + 36] = 2; }
  const seats = [];
  for (let row = 0; row < 10; row++) {
    const z = 13 + row * 2;
    for (const [x0, x1] of [[6, 17], [23, 34]]) for (let x = x0; x <= x1; x++) {
      e.block[z * N + x] = 1;
      const r = hash(x * 3, z * 5);
      seats.push({ x: x + .5, z: z + .5, who: r < 120 ? 'man' : r < 170 ? 'hair' : null });
    }
  }
  // 조명: 무대 스포트라이트 + 벽 등
  e.lights.push({ x: 20.5, z: 7.0, r: 2.8, i: 2.4, c: [.8, .86, 1] }); // 오르골 하나만 비추는 핀 조명
  for (let z = 12; z <= 34; z += 5) { e.lights.push({ x: 4, z, r: 4, i: .8, c: [.55, .6, 1] }); e.lights.push({ x: 35.5, z, r: 4, i: .8, c: [.55, .6, 1] }); }
  for (let z = 14; z <= 34; z += 6) e.lights.push({ x: 20.5, z, r: 3.5, i: .45, c: [.7, .6, .7] });
  e.bake();
  const cam = { x: 20.5, z: 35.2, yaw: -Math.PI / 2, bob: 0 };
  // 깨어 있는 관객
  const aw = [];
  const addAw = (x, z) => aw.push({ x, z, moved: 0, seenAt: null, creak: 0 });
  addAw(20.5, 24.5); addAw(4.6, 30); addAw(35.4, 21); addAw(35.4, 35.5);
  // 흐름장 (플레이어를 향한 최단 경로)
  const fdist = new Int16Array(N * N); let flowT = 0;
  const pass = k => !e.wall[k] && !e.block[k];
  function flow() {
    fdist.fill(-1); const q = []; const s0 = (cam.z | 0) * N + (cam.x | 0); fdist[s0] = 0; q.push(s0);
    for (let h = 0; h < q.length; h++) { const k = q[h], x = k % N, z = (k / N) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (!e.inb(nx, nz)) continue; const nk = nz * N + nx; if (fdist[nk] >= 0 || !pass(nk)) continue; fdist[nk] = fdist[k] + 1; q.push(nk); } }
  }
  function stepTo(m, sp) {
    const x = m.x | 0, z = m.z | 0, k = z * N + x;
    let tx = cam.x, tz = cam.z;
    if (fdist[k] > 1) { let best = fdist[k], bk = -1; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (!e.inb(nx, nz)) continue; const nk = nz * N + nx; if (fdist[nk] >= 0 && fdist[nk] < best) { best = fdist[nk]; bk = nk; } } if (bk >= 0) { tx = bk % N + .5; tz = ((bk / N) | 0) + .5; } }
    const d = Math.hypot(tx - m.x, tz - m.z) || 1, mv = Math.min(d, sp);
    m.x += (tx - m.x) / d * mv; m.z += (tz - m.z) / d * mv; m.moved += mv;
  }
  const inView = m => { const dx = m.x - cam.x, dz = m.z - cam.z, d = Math.hypot(dx, dz); if (d > 31) return false; const rel = Math.abs(angDiff(Math.atan2(dz, dx) - cam.yaw)); return rel < .66 && e.los(cam.x, cam.z, m.x, m.z); };
  const NOTES = [392, 466.16, 523.25, 622.25, 698.46], LENS = [5, 6, 7];
  const seq = []; for (let i = 0; i < 7; i++) { let n; do { n = Math.random() * 5 | 0; } while (i > 0 && n === seq[i - 1]); seq.push(n); }
  const KW = 60, KG = 10, KX = (W - (5 * KW + 4 * KG)) / 2, KY = TOUCH ? 206 : 222, KH = TOUCH ? 52 : 34;
  let four = 0, pendMiss = 0, phase = 'walk', bob = 0, stepAcc = 0, noticed = false, idle = 0, turned = false, round = 0, pp = 'pause', pt = -.4, idx = 0, miss = 0, lit = -1, litT = 0, rear = 0, ft = 0, shot = false, white = 0, autoT = 0, scareT = 0, lastLook = 0;
  const crowd = [];
  function play(n, extra = 0) { const cents = (Math.random() - .5) * (round * 30 + miss * 60 + extra); sfx.music(NOTES[n], cents); lit = n; litT = .3; }
  const creak = (pan = 0) => { nz(.5, { type: 'bandpass', f: 380 + Math.random() * 200, f2: 220, q: 6, vol: .22, a: .05, pan }); osc('sawtooth', 90 + Math.random() * 40, .35, { vol: .05, f2: 60, pan }); };
  const S = {
    game: true, fp: true, touch: 'h3d', act: '연주', noAct: true,
    get noJoy() { return phase !== 'walk'; },
    dbg: { cam, aw, get phase() { return phase; }, set phase(v) { phase = v; }, startPerf: () => S.startPerf(), get round() { return round; }, seq },
    enter() { setFx({ noise: .11, ca: 1.3, wobble: .45 }); drone(.05, .8, 2); say('무대 위에서 오르골이 울리고 있다.', 3); },
    exit() { exitLock(); api.hint(null); },
    startPerf() {
      phase = 'perf'; pp = 'pause'; pt = -.6; idx = 0; exitLock(); api.hint(null);
      cam.x = 20.5; cam.z = 9.6; cam.yaw = -Math.PI / 2; cam.bob = 0;
      for (const m of aw) { const d = Math.hypot(m.x - cam.x, m.z - cam.z); if (d < 6) { m.x = cam.x + (m.x - cam.x) / (d || 1) * 6; m.z = Math.min(36, cam.z + 6); } }
      // 앞줄 관객들이 소리 없이 일어선다
      let n = 0; for (const s of seats) { if (s.who && s.z < 20 && n < 6 && Math.random() < .5) { s.who = null; addAw(s.x, s.z + 1); n++; } }
      say('제 1 소절', 2); setTimeout(() => creak(-.6), 900); setTimeout(() => creak(.6), 1500);
    },
    press(n) {
      if (phase !== 'perf' || pp === 'dead') return;
      // 숨겨진 길: 4를 네 번 → 오르골이 열린다 (틀린 4는 잠깐 미뤄 두었다가 판정)
      if (n === 3) { four++; if (four >= 4) { pendMiss = 0; this.openBox(); return; } } else { four = 0; if (pendMiss > 0) { pendMiss = 0; this.miss(); if (pp === 'dead') return; } }
      if (pp !== 'input') { if (n === 3) sfx.music(NOTES[3]); return; }
      play(n);
      if (seq[idx] !== n && n === 3) { pendMiss = .9; return; }
      if (seq[idx] === n) {
        idx++;
        if (idx >= LENS[round]) { round++; if (round >= LENS.length) { phase = 'finale'; ft = 0; this.makeCrowd(); } else { pp = 'pause'; pt = 0; say(`제 ${round + 1} 소절`, 2); } }
      } else this.miss();
    },
    openBox() {
      phase = 'box'; pt = 0; api.hint(null); drone(0, 1, .6); sfx.bell();
      osc('sine', 1568, 2, { vol: .12 }); osc('sine', 2093, 2, { vol: .06, delay: .15 });
      say('…오르골 뚜껑이 저절로 열렸다.', 2.6);
    },
    miss() {
      {
        miss++; sfx.laugh(); vib([60, 40, 60]); fx.glitch = 1.2; fx.shake = api.reduced ? 1 : 5;
        for (const m of aw) { const d = Math.hypot(m.x - cam.x, m.z - cam.z); const nd = Math.max(2.2, d * .45); m.x = cam.x + (m.x - cam.x) / d * nd; m.z = cam.z + (m.z - cam.z) / d * nd; m.t = 1; }
        rear = .85; sfx.screech();
        if (miss >= 3) { setTimeout(() => api.die('노래가 멈췄다. 관객들이 바로 뒤에 서 있었다.', HCh2), 700); pp = 'dead'; return; }
        say(['틀렸어. 모두가 너를 보고 있어.', '다시. 처음부터. 더 가까이.'][miss - 1], 2.4); pp = 'pause'; pt = -.6;
      }
    },
    makeCrowd() { for (let i = 0; i < 22; i++) { const a = Math.PI / 2 + (i / 21 - .5) * 2.4, r = 1.6 + (i % 3) * .8; crowd.push({ x: cam.x + Math.cos(a) * r, z: cam.z + Math.sin(a) * r }); } },
    key(k) { const n = '12345'.indexOf(k); if (n >= 0) this.press(n); },
    pointer(t, x, y) {
      if (phase === 'walk') { fpPointer(cam, t, x); return; }
      if (t !== 'down' || phase !== 'perf') return;
      for (let i = 0; i < 5; i++) { const kx = KX + i * (KW + KG); if (x >= kx - 4 && x <= kx + KW + 4 && y >= KY - 16 && y <= KY + KH + 12) this.press(i); }
    },
    update(dt) {
      litT -= dt; if (litT <= 0) lit = -1; rear = Math.max(0, rear - dt); white = Math.max(0, white - dt * 1.4); scareT = Math.max(0, scareT - dt);
      e.flick = .94 + Math.sin(now() * 7) * .03;
      flowT -= dt; if (flowT <= 0) { flowT = .3; flow(); }
      if (pendMiss > 0) { pendMiss -= dt; if (pendMiss <= 0) { four = 0; this.miss(); } }
      if (phase === 'walk') {
        const c = fpControls(cam, dt, { speed: 2 });
        if (c.moving) { e.move(cam, c.vx, c.vz, .22); bob += dt * 7; stepAcc += dt; if (stepAcc > .5) { stepAcc = 0; sfx.step(); } }
        cam.bob = Math.sin(bob) * (c.moving ? 1.6 : 0);
        idle = c.moving ? 0 : idle + dt;
        const yawNow = cam.yaw; if (Math.abs(angDiff(yawNow - lastLook)) > 1.2) { turned = true; } if (this.t < .2) lastLook = yawNow;
        for (const m of aw) {
          const vis = inView(m), d = Math.hypot(m.x - cam.x, m.z - cam.z);
          if (!vis) { const before = m.moved; stepTo(m, .85 * dt); m.creak -= dt; if (d < 7 && m.creak <= 0) { m.creak = 1.2 + Math.random(); creak(clamp(Math.sin(angDiff(Math.atan2(m.z - cam.z, m.x - cam.x) - cam.yaw)), -1, 1) * .8); } if (m.seenAt == null) m.seenAt = before; }
          else if (m.seenAt != null) { if (m.moved - m.seenAt > 1.4 && !noticed) { noticed = true; say('…방금 저 자리에 있었나?', 2.8); sfx.sting(); } m.seenAt = null; }
          if (d < .85) { api.die('뒤에 서 있던 관객이 어깨를 붙잡았다.', HCh2); return; }
        }
        if (idle > 5 && this.t < 30) api.hint(TOUCH ? '◀ 왼쪽 원으로 걷기 · 화면을 끌어 둘러보기 ▶' : '▶ W / ↑  걷기   ·   마우스·← →  둘러보기');
        else if (!noticed && !turned && this.t > 14) api.hint(TOUCH ? '↻ 화면을 끌어 뒤를 돌아봐' : '↻ 뒤를 돌아봐');
        else api.hint(null);
        if (cam.z < 10.4 && Math.abs(cam.x - 20.5) < 2.4) this.startPerf();
      } else if (phase === 'perf') {
        for (const m of aw) { stepTo(m, .1 * dt); if (Math.hypot(m.x - cam.x, m.z - cam.z) < 1.05 && pp !== 'dead') { pp = 'dead'; api.die('연주를 멈출 수 없었다. 관객이 너무 가까웠다.', HCh2); return; } }
        if (Math.random() < dt * .25) creak((Math.random() - .5) * 1.6);
        if (pp === 'pause') { pt += dt; if (pt > 1.2) { pp = 'listen'; pt = 0; idx = 0; } }
        else if (pp === 'listen') { pt += dt; const gap = .52 - round * .05; if (idx < LENS[round] && pt >= idx * gap) { play(seq[idx]); idx++; } else if (idx >= LENS[round] && pt >= idx * gap + .15) { pp = 'input'; idx = 0; pt = 0; } }
        else if (pp === 'input') { pt += dt; if (pt > 6 && idx === 0) api.hint(TOUCH ? '♪ 빛났던 건반을 순서대로 눌러' : '♪ 1 2 3 4 5 — 빛났던 순서대로'); }
        if (pp !== 'input') api.hint(null);
      } else if (phase === 'box') {
        pt += dt;
        if (pt > 1.2 && pt - dt <= 1.2) { [1046, 988, 880, 784, 659].forEach((f, i) => osc('sine', f, 1.2, { vol: .1, delay: i * .32 })); }
        if (pt > 3.4 && pt - dt <= 3.4) { sfx.sting(); say('안에 비디오테이프가 들어 있다.', 2.6); }
        if (pt > 5.6 && pt - dt <= 5.6) { api.gotTape(); sfx.clunk && sfx.clunk(); say('「 앨리스 ─ 0 」 테이프를 주웠다.', 2.8); vib(60); }
        if (pt > 8.6) go(Card(T.e2, () => api.startChapter(3), { drone: .03 }));
      } else if (phase === 'finale') {
        ft += dt; api.hint(null);
        if (ft < 3) { autoT -= dt; if (autoT <= 0) { play(Math.random() * 5 | 0, ft * 140); autoT = .4 - ft * .1; } nz(.3, { type: 'bandpass', f: 1800, q: .5, vol: .05 + ft * .05 }); }
        if (ft > 2.4 && ft < 4) cam.yaw = lerp(-Math.PI / 2, Math.PI / 2, clamp((ft - 2.4) / 1.2, 0, 1));
        if (ft > 4.2 && !shot) { shot = true; sfx.gun(); vib(400); white = chicken() ? .5 : 1; drone(0, 1, .05); fx.glitch = 2; fx.shake = api.reduced ? 3 : 14; }
        if (ft > 7 && ft - dt <= 7) say('노래는 끝나지 않았다.', 2.6);
        if (ft > 10 && ft - dt <= 10) say('부를 사람이 사라졌을 뿐.', 3);
        if (ft > 13.5) go(Card(T.e2, () => api.startChapter(3), { drone: .03 }));
      }
    },
    sprites() {
      const ch = chicken(), list = [];
      for (const s of seats) list.push({ spr: s.who === 'man' ? SP.seatMan : s.who === 'hair' ? SP.seatHair : SP.seat, x: s.x, z: s.z, w: .8, h: 1, y0: 0 });
      for (const m of aw) list.push({ spr: ch ? (m.t ? SP.cGhostT : SP.cGhost) : (m.t ? SP.mannT : SP.mann), x: m.x, z: m.z, w: ch ? .8 : .6, h: ch ? .95 : 1.7, y0: ch ? .35 : 0, glow: rear > 0 ? .8 : 0 });
      for (const m of crowd) list.push({ spr: ch ? SP.cGhostT : SP.mannT, x: m.x, z: m.z, w: ch ? .8 : .6, h: ch ? .95 : 1.7, y0: ch ? .35 : 0 });
      list.push({ spr: SP.piano, x: 20.5, z: 6.6, w: 2.2, h: 1.1, y0: 0, glow: phase === 'walk' ? .55 : 0 });
      return list;
    },
    beam(c) { // 천장에서 오르골로 떨어지는 한 줄기 빛
      const bx = 20.5, bz = 6.6, dx = bx - c.x, dz = bz - c.z, dX = Math.cos(c.yaw), dZ = Math.sin(c.yaw);
      const ty = dx * dX + dz * dZ; if (ty < .4) return;
      const tx = (-dZ * dx + dX * dz) / FOVP, sx = W / 2 * (1 + tx / ty);
      const sc = H / ty, hor = H / 2 + (c.bob || 0), yb = hor + .5 * sc, yt = hor - 2.4 * sc;
      const cx_ = clamp(sx | 0, 0, W - 1); if (e.zcol && ty > e.zcol[cx_] + .5 && sx > 0 && sx < W) return;
      const fl = (.85 + Math.sin(now() * 9) * .05 + (Math.random() < .03 ? -.3 : 0)) * (1 + clamp((ty - 6) / 14, 0, 1) * 1.8), wt = Math.max(1.5, .12 * sc), wb = Math.max(9, .95 * sc);
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createLinearGradient(0, yt, 0, yb); gr.addColorStop(0, `rgba(150,170,255,${.02 * fl})`); gr.addColorStop(.75, `rgba(170,185,255,${.1 * fl})`); gr.addColorStop(1, `rgba(200,210,255,${.16 * fl})`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(sx - wt, yt); g.lineTo(sx + wt, yt); g.lineTo(sx + wb, yb); g.lineTo(sx - wb, yb); g.closePath(); g.fill();
      const pg = g.createRadialGradient(sx, yb, 1, sx, yb, wb * 1.2); pg.addColorStop(0, `rgba(190,205,255,${.22 * fl})`); pg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = pg; g.save(); g.translate(sx, yb); g.scale(1, .28); g.beginPath(); g.arc(0, 0, wb * 1.2, 0, 7); g.restore(); g.fill();
      g.restore();
    },
    draw() {
      const ch = chicken();
      if (phase === 'box') {
        g.fillStyle = '#04050c'; g.fillRect(-20, -20, W + 40, H + 40);
        const lg = g.createRadialGradient(200, 150, 10, 200, 150, 200); lg.addColorStop(0, 'rgba(140,165,255,.25)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = lg; g.fillRect(0, 0, W, H);
        // 오르골 상자 (가까이서)
        g.fillStyle = '#3a2618'; g.fillRect(110, 170, 180, 80); g.fillStyle = '#2a1a12'; g.fillRect(110, 236, 180, 14);
        g.fillStyle = '#c9a33a'; g.fillRect(110, 184, 180, 2); g.fillRect(196, 196, 8, 10);
        const open = clamp(pt / 1.2, 0, 1);
        g.save(); g.translate(110, 170); g.scale(1, 1 - open * 1.7); g.fillStyle = '#4a3020'; g.fillRect(0, -22, 180, 22); g.fillStyle = '#c9a33a'; g.fillRect(0, -2, 180, 2); g.restore();
        if (open > .5) { g.fillStyle = '#5a0e18'; g.fillRect(118, 172, 164, 60); }
        // 테이프가 떠오른다
        const up = clamp((pt - 2) / 2, 0, 1);
        if (up > 0) {
          const ty = 210 - up * 90;
          g.save(); g.translate(200, ty); g.rotate(-.04 + Math.sin(now() * 2) * .02);
          g.fillStyle = '#0c0c0e'; g.fillRect(-70, -40, 140, 80); g.fillStyle = '#1c1c20'; g.fillRect(-64, -34, 128, 68);
          g.fillStyle = '#060608'; g.beginPath(); g.arc(-30, 6, 13, 0, 7); g.arc(30, 6, 13, 0, 7); g.fill();
          g.fillStyle = '#e8e2d0'; g.fillRect(-58, -31, 116, 24);
          g.font = "800 12px 'Nanum Myeongjo', serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1a1414'; g.fillText('「 앨리스 ─ 0 」', 0, -19);
          g.restore();
          if (pt > 3.4) { g.fillStyle = `rgba(200,210,255,${.08 + .06 * Math.sin(now() * 4)})`; g.fillRect(0, 0, W, H); }
        }
        if (pt > 5.6) { g.fillStyle = `rgba(0,0,0,${clamp((pt - 7) / 1.4, 0, 1)})`; g.fillRect(0, 0, W, H); }
        return;
      }
      if (phase === 'finale' && ft >= 4.2) {
        g.fillStyle = ch ? '#120d22' : '#000'; g.fillRect(-20, -20, W + 40, H + 40);
        const b = clamp((ft - 6) / 5, 0, 1); if (b > 0) drawRose(b, ch);
        if (white > 0) { g.fillStyle = `rgba(255,255,255,${white})`; g.fillRect(0, 0, W, H); }
        return;
      }
      if (rear > 0) { const rc = { x: cam.x, z: cam.z, yaw: cam.yaw + Math.PI, bob: 0 }; e.render(rc, this.sprites()); this.beam(rc); g.fillStyle = 'rgba(120,0,0,.18)'; g.fillRect(0, 0, W, H); txt('▶ 뒤', 20, 52, { size: 11, color: '#ff8080', font: MONO, align: 'left' }); return; }
      e.render(cam, this.sprites());
      this.beam(cam);
      if (phase === 'perf') {
        const v = g.createLinearGradient(0, H * .55, 0, H); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.75)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 5; i++) {
          const kx = KX + i * (KW + KG), on = lit === i;
          g.fillStyle = on ? '#9fb4ff' : '#141a36'; g.fillRect(kx, KY, KW, KH);
          g.fillStyle = on ? '#e4eaff' : '#2a3462'; g.fillRect(kx, KY, KW, 2);
          txt(String(i + 1), kx + KW / 2, KY + KH / 2 + 6, { size: 16, color: on ? '#0b1030' : '#6c7ab8', font: api.OSDF || MONO, shadow: false });
        }
        const label = pp === 'listen' ? '듣는 중…' : pp === 'input' ? `${idx} / ${LENS[round]}` : '';
        if (label) txt(label, W / 2, KY - 22, { size: 12, color: '#a9b4e6', font: MONO });
        txt('♦'.repeat(round) + '◇'.repeat(Math.max(0, 3 - round)), W / 2, 62, { size: 11, color: '#4a5aa0', font: SERIF });
        const near = Math.min(...aw.map(m => Math.hypot(m.x - cam.x, m.z - cam.z)));
        if (!ch && near < 5) { const k = clamp(1 - (near - 1) / 4, 0, 1); g.fillStyle = `rgba(0,0,0,${k * .35 * (.6 + .4 * Math.sin(now() * 6))})`; g.fillRect(0, 0, W, H); }
      }
      if (white > 0) { g.fillStyle = `rgba(255,255,255,${white})`; g.fillRect(0, 0, W, H); }
    }
  };
  return S;
}


/* =========================================================
   하드 4장 : 노란 쌍둥이 — 다과회, 일제히 돌아보는 손님들, 추격, 붉은 검사
   ========================================================= */
const ITEMS = [
  { id: 'tea', name: '찻잎 통', x: 15.5, z: 5.5 },
  { id: 'cake', name: '케이크', x: 31.5, z: 10.5 },
  { id: 'sugar', name: '각설탕 그릇', x: 4.5, z: 17.5 },
  { id: 'jam', name: '딸기잼', x: 43.5, z: 28.5 },
  { id: 'milk', name: '우유병', x: 16.5, z: 37.5 }
];
function buildTeaSprites() {
  if (SP.tea) return; SP.tea = true;
  const COLS = ['#2a1e2e', '#1e2630', '#30261a', '#2a1418', '#1c2a20'];
  const guest = (x, col, stare, hairCol) => {
    E2(x, 10, 26, 9, 8, col); x.fillStyle = col; x.fillRect(2, 18, 16, 10);
    if (stare) {
      E2(x, 10, 9, 5.4, 6.4, '#c9c0b0');
      E2(x, 7.8, 8.4, 1.8, 2.3, '#000'); E2(x, 12.2, 8.4, 1.8, 2.3, '#000');
      x.fillStyle = '#6a0606'; x.fillRect(7, 12.5, 6, 1.4); x.fillRect(7.5, 13.5, .7, 4); x.fillRect(11.4, 13.5, .7, 5);
      x.fillStyle = hairCol; x.beginPath(); x.ellipse(10, 5, 6, 3.6, 0, Math.PI, 0); x.fill(); x.fillRect(4, 4, 2, 9); x.fillRect(14, 4, 2, 9);
      x.strokeStyle = '#c9c0b0'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(3, 20); x.lineTo(5, 15); x.moveTo(17, 20); x.lineTo(15, 15); x.stroke();
    } else {
      E2(x, 10, 12, 5.2, 5.6, hairCol);
      x.fillStyle = '#9a9286'; x.fillRect(8.5, 16, 3, 2);
      x.strokeStyle = '#a49c8f'; x.lineWidth = 1.3; x.beginPath(); x.moveTo(4, 22); x.lineTo(8, 17); x.moveTo(16, 22); x.lineTo(12, 17); x.stroke();
    }
  };
  SP.guestEat = COLS.map((c, i) => canvasSprite(20, 34, x => guest(x, c, false, i % 2 ? '#2a2010' : '#0c0a0a'), null, 3));
  SP.guestStare = COLS.map((c, i) => canvasSprite(20, 34, x => guest(x, c, true, i % 2 ? '#2a2010' : '#0c0a0a'), x => { E2(x, 7.8, 8.6, .5, .5, '#fff'); E2(x, 12.2, 8.6, .5, .5, '#fff'); }, 3));
  SP.guestRun = COLS.map((c, i) => canvasSprite(24, 64, x => {
    P2(x, [7, 20, 17, 20, 20, 50, 4, 50], c);
    x.strokeStyle = '#a49c8f'; x.lineWidth = 1.6; x.lineCap = 'round';
    x.beginPath(); x.moveTo(7, 22); x.lineTo(1, 30); x.moveTo(17, 22); x.lineTo(23, 30); x.moveTo(9, 50); x.lineTo(8, 63); x.moveTo(15, 50); x.lineTo(16, 63); x.stroke();
    x.fillStyle = '#c9c0b0'; x.fillRect(11, 15, 2, 5);
    E2(x, 12, 10, 5.4, 6.6, '#c9c0b0'); E2(x, 9.8, 9, 1.9, 2.4, '#000'); E2(x, 14.2, 9, 1.9, 2.4, '#000');
    E2(x, 12, 14.5, 2.2, 2.6, '#1a0202'); x.fillStyle = '#6a0606'; x.fillRect(10, 15, 4, 5);
    x.fillStyle = i % 2 ? '#2a2010' : '#0c0a0a'; x.beginPath(); x.ellipse(12, 6, 6, 3.6, 0, Math.PI, 0); x.fill();
  }, x => { E2(x, 9.8, 9.2, .55, .55, '#fff'); E2(x, 14.2, 9.2, .55, .55, '#fff'); }, 3));
  SP.cGuest = canvasSprite(40, 48, x => ghostOn(x, 20, 20, 15, { col: '#fff4d8' }), null, 2);
  SP.cGuestT = canvasSprite(40, 48, x => ghostOn(x, 20, 20, 15, { col: '#ffe0ec', boo: true }), null, 2);
  SP.table = canvasSprite(16, 12, x => { x.fillStyle = '#2a1a10'; x.fillRect(1, 5, 2, 7); x.fillRect(13, 5, 2, 7); x.fillStyle = '#d8d0c0'; x.fillRect(0, 2, 16, 5); x.fillStyle = '#b8b0a0'; for (let i = 0; i < 8; i++) E2(x, 1 + i * 2, 7, 1, 1, '#b8b0a0'); }, null, 2);
  const itemDraw = {
    tea: x => { x.fillStyle = '#3a6a4a'; x.fillRect(4, 4, 8, 11); x.fillStyle = '#c8a040'; x.fillRect(4, 3, 8, 2); x.fillRect(4, 9, 8, 1); },
    cake: x => { x.fillStyle = '#f0e6d6'; x.fillRect(2, 8, 12, 7); x.fillStyle = '#e8a0b0'; x.fillRect(2, 7, 12, 2); E2(x, 8, 5.5, 1.6, 1.6, '#c01818'); },
    sugar: x => { E2(x, 8, 12, 6, 3, '#d0d8e8'); x.fillStyle = '#fafafa'; x.fillRect(5, 8, 2.4, 2.4); x.fillRect(8, 7, 2.4, 2.4); x.fillRect(9, 9.5, 2.4, 2.4); },
    jam: x => { x.fillStyle = '#9a1020'; x.fillRect(4, 6, 8, 9); x.fillStyle = '#e8e0d0'; x.fillRect(4, 4, 8, 3); x.fillStyle = '#e8c070'; x.fillRect(5, 9, 6, 3); },
    milk: x => { x.fillStyle = '#f2f2f2'; x.fillRect(5, 5, 6, 10); x.fillRect(6, 2, 4, 3); x.fillStyle = '#3a6ab0'; x.fillRect(5, 9, 6, 2); }
  };
  SP.item = {}; SP.plate = {}; SP.plateFull = {};
  for (const it of ITEMS) {
    SP.item[it.id] = canvasSprite(16, 16, itemDraw[it.id], x => { E2(x, 12, 4, .8, .8, '#fffbe0'); }, 3);
    SP.plate[it.id] = canvasSprite(16, 16, x => { E2(x, 8, 14, 7, 2, '#e8e2d6'); x.save(); x.globalAlpha = 1; itemDraw[it.id](x); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#0c0a0a'; x.fillRect(0, 0, 16, 12.5); x.restore(); E2(x, 8, 14, 7, 2, '#e8e2d6'); }, null, 3);
    SP.plateFull[it.id] = canvasSprite(16, 16, x => { E2(x, 8, 14, 7, 2, '#e8e2d6'); itemDraw[it.id](x); }, null, 3);
  }
  SP.knight = canvasSprite(24, 40, x => {
    P2(x, [6, 18, 18, 18, 22, 40, 2, 40], '#8a1414');
    x.fillStyle = '#5a0a0a'; x.fillRect(11, 18, 2, 22);
    E2(x, 12, 10, 5.2, 6, '#d8ccb8');
    x.fillStyle = '#c8a050'; x.beginPath(); x.ellipse(12, 7, 6.4, 5, 0, Math.PI, 0); x.fill(); x.fillRect(5.6, 6, 2.4, 18); x.fillRect(16, 6, 2.4, 18);
    E2(x, 10, 10.5, 1, .5, '#2a1010'); E2(x, 14, 10.5, 1, .5, '#2a1010'); x.fillStyle = '#6a0606'; x.fillRect(9.6, 11, .6, 4); x.fillRect(13.8, 11, .6, 5);
    x.strokeStyle = '#d8ccb8'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(7, 20); x.lineTo(5, 30); x.moveTo(17, 20); x.lineTo(19, 30); x.stroke();
  }, null, 3);
  SP.cKnight = canvasSprite(40, 48, x => ghostOn(x, 20, 20, 15, { col: '#ffd3e3', bow: true }), null, 2);
  SP.knightBack = canvasSprite(24, 64, x => { // 등을 보인 붉은 검사 (서 있는 모습)
    P2(x, [7, 20, 17, 20, 21, 60, 3, 60], '#8a1414');
    x.fillStyle = '#5a0a0a'; x.fillRect(11.2, 20, 1.6, 40);
    x.fillStyle = '#d8ccb8'; x.fillRect(10.8, 15, 2.4, 5);
    x.fillStyle = '#c8a050'; E2(x, 12, 9, 5.6, 6.4, '#c8a050'); x.fillRect(6.4, 9, 11.2, 22); P2(x, [6.4, 31, 17.6, 31, 15, 36, 9, 36], '#c8a050');
    x.strokeStyle = '#d8ccb8'; x.lineWidth = 1.6; x.lineCap = 'round'; x.beginPath(); x.moveTo(7, 22); x.lineTo(3, 34); x.moveTo(17, 22); x.lineTo(21, 30); x.stroke();
    x.strokeStyle = '#c0c0cc'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(21, 30); x.lineTo(23.5, 4); x.stroke();
    x.fillStyle = '#d8ccb8'; x.fillRect(9.5, 60, 2, 4); x.fillRect(12.5, 60, 2, 4);
  }, x => { x.fillStyle = '#ff3030'; x.fillRect(22.4, 10, .8, 6); }, 3);
  SP.knightFront = canvasSprite(24, 64, x => { // 돌아본 붉은 검사
    P2(x, [7, 20, 17, 20, 21, 60, 3, 60], '#8a1414');
    x.fillStyle = '#5a0a0a'; x.fillRect(11.2, 20, 1.6, 40);
    x.fillStyle = '#d8ccb8'; x.fillRect(10.8, 15, 2.4, 5);
    E2(x, 12, 10, 5, 6, '#d8ccb8');
    x.fillStyle = '#c8a050'; x.beginPath(); x.ellipse(12, 7, 6.2, 4.8, 0, Math.PI, 0); x.fill(); x.fillRect(5.8, 6, 2.4, 24); x.fillRect(15.8, 6, 2.4, 24);
    E2(x, 10, 10.4, 1, .9, '#2a1010'); E2(x, 14, 10.4, 1, .9, '#2a1010');
    x.strokeStyle = '#7a3020'; x.lineWidth = .6; x.beginPath(); x.arc(12, 12.6, 1.6, .15 * Math.PI, .85 * Math.PI); x.stroke();
    x.fillStyle = '#6a0606'; x.fillRect(8.6, 13, .6, 4);
    x.strokeStyle = '#d8ccb8'; x.lineWidth = 1.6; x.lineCap = 'round'; x.beginPath(); x.moveTo(7, 22); x.lineTo(4, 36); x.moveTo(17, 22); x.lineTo(20, 36); x.stroke();
    x.strokeStyle = '#c0c0cc'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(20, 36); x.lineTo(21, 62); x.stroke();
    x.fillStyle = '#d8ccb8'; x.fillRect(9.5, 60, 2, 4); x.fillRect(12.5, 60, 2, 4);
  }, x => { x.fillStyle = '#ff3030'; x.fillRect(20.4, 46, .8, 6); }, 3);
  SP.guestDead = canvasSprite(32, 16, x => { E2(x, 16, 13, 15, 3, '#5a0505'); P2(x, [3, 12, 25, 9, 27, 13, 5, 15], '#2a1e2e'); E2(x, 26, 10, 4, 3.4, '#c9c0b0'); x.fillStyle = '#000'; x.fillRect(25, 9, 1.4, 1.4); x.fillRect(27.4, 9, 1.4, 1.4); }, null, 2);
  SP.bars = canvasSprite(24, 40, x => { x.fillStyle = '#4a4440'; x.fillRect(0, 0, 24, 2); x.fillRect(0, 38, 24, 2); for (let i = 0; i < 7; i++) x.fillRect(1 + i * 3.6, 0, 1.2, 40); }, null, 2);
  SP.sword = canvasSprite(32, 8, x => { x.fillStyle = '#c0c0cc'; x.fillRect(2, 3, 22, 2); x.fillStyle = '#7a0a0a'; x.fillRect(10, 3, 10, 2); x.fillStyle = '#4a3020'; x.fillRect(24, 1, 2, 6); x.fillRect(26, 3, 5, 2); }, x => { x.fillStyle = '#ff3030'; x.fillRect(4, 3.5, 2, 1); }, 2);
}
function HCh4(opt = {}) {
  buildSprites(); buildTeaSprites();
  const N = 48;
  const FT = [{ col: [52, 46, 40], tex: 'tile' }, { col: [80, 70, 44], tex: 'check' }, { col: [64, 44, 30], tex: 'board' }, { col: [40, 38, 36], tex: 'tile' }, { col: [92, 12, 12], tex: 'blood' }, { col: [40, 38, 36], decal: 0 }];
  const WT = [null, { col: [70, 62, 54] }, { col: [96, 74, 54], tex: 'paper', h: 1.4 }, { col: [70, 46, 30], tex: 'shelf', h: 1.4 }, { col: [90, 84, 80], tex: 'bars' }, { col: [255, 248, 230], emis: true }, { col: [56, 36, 26], tex: 'door' }];
  const e = Engine({ N, indoor: true, WT, FT, wallH: 1.4, fogD: 12, fogC: [6, 5, 4], amb: .3, ceilC: [40, 30, 24], lantern: 3.2, lanternC: [.8, .72, .6] });
  e.wall.fill(1);
  const carve = (x0, z0, x1, z1, fl, wt) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { e.wall[z * N + x] = 0; e.floor[z * N + x] = fl; } };
  carve(14, 16, 33, 29, 1);      // 큰 홀
  carve(14, 4, 33, 12, 2);       // 부엌
  carve(23, 13, 24, 15, 0);      // 부엌 통로
  carve(3, 16, 10, 29, 0);       // 식료품 창고
  carve(11, 22, 13, 23, 0);
  carve(37, 16, 44, 29, 2);      // 서재
  carve(34, 25, 36, 26, 0);
  carve(23, 30, 24, 33, 0);      // 남쪽 통로
  carve(16, 34, 31, 38, 3);      // 지하 저장고
  carve(23, 39, 24, 45, 3);      // 출구 복도
  for (let z = 16; z <= 29; z++) { e.wall[z * N + 13] = e.wall[z * N + 13] || 2; e.wall[z * N + 34] = e.wall[z * N + 34] || 2; }
  for (let z = 16; z <= 29; z++) for (const x of [36, 45]) e.wall[z * N + x] = 3;
  e.wall[22 * N + 13] = 0; e.wall[23 * N + 13] = 0; e.wall[25 * N + 34] = 0; e.wall[26 * N + 34] = 0;
  e.wall[25 * N + 36] = 0; e.wall[26 * N + 36] = 0;
  const GATE = [39 * N + 23, 39 * N + 24];
  for (const k of GATE) e.wall[k] = 4;
  e.wall[46 * N + 23] = 5; e.wall[46 * N + 24] = 5;
  // 바닥의 피 글씨 (복도를 따라 걸어올 때 똑바로 읽히도록 180도 돌려 그린다)
  { const c = document.createElement('canvas'); c.width = 96; c.height = 120; const x = c.getContext('2d');
    x.translate(96, 120); x.rotate(Math.PI); x.fillStyle = '#7a0808'; x.font = "800 40px 'Nanum Myeongjo', serif"; x.textAlign = 'center';
    x.fillText('죽여야', 48, 50); x.fillText('해', 48, 100);
    for (let i = 0; i < 9; i++) x.fillRect(12 + i * 9, 102, 2, 5 + (i * 7) % 12);
    e.decals[0] = { x: 23, z: 39.6, w: 2, h: 2.5, iw: 96, ih: 120, d: x.getImageData(0, 0, 96, 120).data };
    for (const k of [40 * N + 23, 40 * N + 24, 41 * N + 23, 41 * N + 24, 39 * N + 23, 39 * N + 24]) e.floor[k] = 5; }
  // 식탁과 손님
  for (let x = 17; x <= 30; x++) { e.block[22 * N + x] = 1; e.block[23 * N + x] = 1; }
  const guests = [];
  let gi = 0;
  for (let x = 18; x <= 30; x += 2) { guests.push({ x: x + .5, z: 21.2, sx: x + .5, sz: 21.2, v: gi++ % 5 }); guests.push({ x: x - .5, z: 24.8, sx: x - .5, sz: 24.8, v: gi++ % 5 }); }
  const plates = ITEMS.map((it, i) => ({ it, x: 19.5 + i * 2.5, z: i % 2 ? 23.6 : 22.4, full: false }));
  const items = ITEMS.map(it => ({ ...it, got: false }));
  // 조명
  for (let x = 17; x <= 31; x += 4) e.lights.push({ x, z: 23, r: 4.5, i: .9, c: [1, .8, .5] });
  e.lights.push({ x: 23.5, z: 8, r: 7, i: .7, c: [1, .85, .6] }, { x: 6.5, z: 22, r: 6, i: .55, c: [.9, .8, .6] }, { x: 40.5, z: 22, r: 6, i: .55, c: [.9, .8, .6] }, { x: 23.5, z: 36, r: 6, i: .5, c: [.7, .7, .8] });
  const itemLights = items.map(it => { const L = { x: it.x, z: it.z, r: 2, i: .7, c: [1, .95, .7] }; e.lights.push(L); return L; });
  const exitLight = { x: 23.5, z: 45, r: 5, i: 1.4, c: [1, .95, .85], off: true }; e.lights.push(exitLight);
  e.bake();
  const cam = { x: 23.5, z: 26.6, yaw: -Math.PI / 2, bob: 0 };
  let slow = 1, knightOut = null, knightTurn = false, cutT = 0, whiteT = 0; const slashes = [];
  let waitT = 0, phase = opt.chase ? 'chase' : 'collect', bob = 0, stepAcc = 0, carried = [], placed = 0, pt = 0, idle = 0, slashT = 9, hasSword = false, knightDead = false, knightSaid = false, shutT = 0, scareT = 0, peek = -1, flash = 0;
  if (opt.chase) { items.forEach(i => { i.got = true; }); plates.forEach(p => p.full = true); placed = 5; for (const L of itemLights) L.off = true; for (const k of GATE) e.wall[k] = 0; exitLight.off = false; e.bake(); cam.x = 23.5; cam.z = 26.6; cam.yaw = Math.PI / 2; pt = 0; for (const gu of guests) gu.up = true; }
  const fdist = new Int16Array(N * N); let flowT = 0;
  function flow() {
    fdist.fill(-1); const q = []; const s0 = (cam.z | 0) * N + (cam.x | 0); fdist[s0] = 0; q.push(s0);
    for (let h = 0; h < q.length; h++) { const k = q[h], x = k % N, z = (k / N) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (!e.inb(nx, nz)) continue; const nk = nz * N + nx; if (fdist[nk] >= 0 || e.wall[nk] || e.block[nk]) continue; fdist[nk] = fdist[k] + 1; q.push(nk); } }
  }
  function chaseStep(m, sp) {
    const x = m.x | 0, z = m.z | 0, k = z * N + x;
    let tx = cam.x, tz = cam.z;
    if (fdist[k] > 1) { let best = fdist[k], bk = -1; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (!e.inb(nx, nz)) continue; const nk = nz * N + nx; if (fdist[nk] >= 0 && fdist[nk] < best) { best = fdist[nk]; bk = nk; } } if (bk >= 0) { tx = bk % N + .5; tz = ((bk / N) | 0) + .5; } }
    else if (fdist[k] < 0) { // 식탁 위 등 막힌 칸이면 가장 가까운 열린 칸으로
      for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0], [0, -2], [0, 2]]) { const nk = (z + dz) * N + x + dx; if (e.inb(x + dx, z + dz) && fdist[nk] >= 0) { tx = x + dx + .5; tz = z + dz + .5; break; } }
    }
    const d = Math.hypot(tx - m.x, tz - m.z) || 1, mv = Math.min(d, sp);
    m.x += (tx - m.x) / d * mv; m.z += (tz - m.z) / d * mv;
  }
  const knight = { x: 23.5, z: 43.5 };
  if (true) { e.block[43 * N + 23] = 1; e.block[43 * N + 24] = 1; }
  const sword = { x: 23.9, z: 42.2 };
  const chew = () => { nz(.12, { type: 'lowpass', f: 400 + Math.random() * 300, vol: .1, pan: (Math.random() - .5) * 1.4 }); if (Math.random() < .3) osc('sine', 2400 + Math.random() * 800, .25, { vol: .04, pan: (Math.random() - .5) * 1.4 }); };
  const S = {
    game: true, fp: true, touch: 'h3d',
    get act() { return phase === 'knight' ? '베기' : '행동'; },
    get noAct() { return phase !== 'knight'; },
    get noJoy() { return phase === 'feast' || phase === 'turn' || phase === 'shut' || phase === 'rescue'; },
    dbg: { cam, guests, items, rescue: () => S.rescue(), get phase() { return phase; }, set phase(v) { phase = v; }, get placed() { return placed; }, pickAll() { for (const it of items) if (!it.got) { it.got = true; carried.push(it); } } },
    enter() { setFx({ noise: .11, wobble: .6, ca: 1.3 }); drone(.06, 1.05, 2); if (opt.chase) { say('도망쳐.', 2); drone(.16, 1.5, .5); } else say('다과회 준비가 덜 끝났다.', 3); },
    exit() { exitLock(); api.hint(null); },
    slash() {
      if (phase !== 'knight' || slashT < .35) return; slashT = 0; sfx.slash();
      if (!hasSword || knightDead) return;
      if (Math.hypot(knight.x - cam.x, knight.z - cam.z) > 1.9) return;
      knightDead = true; flash = 1; fx.glitch = 1.5; fx.shake = api.reduced ? 2 : 9; sfx.hit(); vib([80, 40, 200]);
      if (!chicken()) { osc('sawtooth', 700, .9, { vol: .16, f2: 300 }); nz(.8, { type: 'bandpass', f: 1600, q: 2, vol: .2 }); }
      e.block[43 * N + 23] = 0; e.block[43 * N + 24] = 0;
      for (const k of [43 * N + 23, 43 * N + 24, 42 * N + 23, 42 * N + 24, 44 * N + 23]) e.floor[k] = 4;
      say(chicken() ? '…펑! 하트가 되어 흩어졌다.' : '붉은 검사는 웃는 얼굴로 쓰러졌다.', 3);
    },
    rescue() {
      phase = 'rescue'; pt = 0; api.hint(null); exitLock(); hasSword = false; drone(.24, 1.7, .4);
      say('…등 뒤에서 무언가 소리를 낸다.', 1.6);
      // 손님들을 복도 뒤쪽에 늘어세운다
      guests.forEach((gu, i) => { gu.up = true; gu.dead = 0; gu.x = 23 + (i % 3) * .5 + (Math.random() - .5) * .3; gu.z = 37.6 - (i / 3 | 0) * .9 - Math.random() * .4; gu.jerk = Math.random(); });
      for (const k of GATE) e.wall[k] = 0; e.bake();
    },
    key(k) { if (phase === 'rescue') return; if (k === ' ' || k === 'Enter' || k === 'x' || k === 'j') this.slash(); },
    pointer(t, x) { if (phase === 'rescue') return; fpPointer(cam, t, x); if (t === 'down' && !TOUCH && document.pointerLockElement === api.cv) this.slash(); },
    update(dt) {
      slashT += dt; flash = Math.max(0, flash - dt * 2); scareT = Math.max(0, scareT - dt);
      if (phase === 'rescue') { this.cine(dt * slow); return; }
      e.flick = .92 + Math.sin(now() * 9) * .04 + Math.sin(now() * 23) * .02;
      flowT -= dt; if (flowT <= 0) { flowT = .25; flow(); }
      const lockMove = phase === 'feast' || phase === 'turn' || phase === 'shut' || phase === 'rescue';
      const c = fpControls(cam, dt, { speed: phase === 'chase' || phase === 'knight' ? 2.7 : 2.1, lock: lockMove });
      if (c.moving) { e.move(cam, c.vx, c.vz, .22); bob += dt * (phase === 'chase' ? 10 : 7); stepAcc += dt; if (stepAcc > (phase === 'chase' ? .33 : .48)) { stepAcc = 0; sfx.step(); } }
      cam.bob = Math.sin(bob) * (c.moving ? 2 : 0);
      idle = c.moving ? 0 : idle + dt;
      if (phase === 'collect') {
        for (const it of items) if (!it.got && Math.hypot(it.x - cam.x, it.z - cam.z) < .9) { it.got = true; carried.push(it); itemLights[items.indexOf(it)].off = true; e.bake(); sfx.sting(); say(`${it.name}을(를) 집었다.`, 2.2); }
        if (carried.length && Math.abs(cam.z - 23) < 2.4 && cam.x > 16 && cam.x < 31.5) {
          for (const it of carried) { const p = plates.find(pl => pl.it.id === it.id); if (p) p.full = true; placed++; }
          sfx.bell(); say(placed >= 5 ? '다과회 준비가 끝났다.' : `접시 ${placed} / 5`, 2.4); carried = [];
          if (placed >= 5) { phase = 'feast'; pt = 0; exitLock(); api.hint(null); cam.x = 23.5; cam.z = 27.6; cam.yaw = -Math.PI / 2; say('손님들이 먹기 시작했다.', 2.4); }
        }
        // 안 볼 때 한 손님이 고개를 든다
        if (peek < 0 && Math.random() < dt * .08) { const i = Math.random() * guests.length | 0, gu = guests[i]; const rel = Math.abs(angDiff(Math.atan2(gu.z - cam.z, gu.x - cam.x) - cam.yaw)); if (rel > 1) peek = i; }
        if (peek >= 0) { const gu = guests[peek]; const rel = Math.abs(angDiff(Math.atan2(gu.z - cam.z, gu.x - cam.x) - cam.yaw)); if (rel < .5) { gu.seen = (gu.seen || 0) + dt; if (gu.seen > .7) { gu.seen = 0; peek = -1; } } }
        if (idle > 5 && this.t < 25) api.hint(TOUCH ? '◀ 왼쪽 원으로 걷기 · 화면 끌어 둘러보기 ▶' : '▶ W A S D  걷기   ·   마우스·← →  둘러보기');
        else if (this.t > 50 && placed === 0 && !carried.length) api.hint('빛나는 재료를 찾아 식탁 접시에');
        else if (carried.length && this.t > 30) api.hint('주운 재료를 식탁으로');
        else api.hint(null);
      } else if (phase === 'feast') {
        pt += dt;
        if (pt < 6) { if (Math.random() < dt * 9) chew(); }
        if (pt > 6 && pt - dt <= 6) { drone(0, 1, .3); }
        if (pt > 7.6) { phase = 'turn'; pt = 0; bigScare(); scareT = 0; say('「 손님이 한 명 더 있네. 」', 3); drone(.2, 1.6, .3); for (const gu of guests) gu.stare = true; }
      } else if (phase === 'turn') {
        pt += dt;
        if (pt > 2.6) { phase = 'chase'; pt = 0; for (const gu of guests) gu.up = true; for (const k of GATE) e.wall[k] = 0; exitLight.off = false; e.bake(); sfx.laugh(); say('도망쳐!', 2); }
      } else if (phase === 'chase') {
        pt += dt;
        const sp = pt < 1 ? 0 : clamp(.9 + (pt - 1) * .35, .9, 2.25);
        for (const gu of guests) { chaseStep(gu, sp * (.85 + (gu.v % 3) * .08) * dt); if (pt > 1 && Math.hypot(gu.x - cam.x, gu.z - cam.z) < .7) { api.die('손님들이 당신을 식탁에 앉혔다.', () => HCh4({ chase: true })); return; } }
        if (Math.random() < dt * 1.2) sfx.whisper(1, (Math.random() - .5) * 1.6);
        if (idle > 3) api.hint(TOUCH ? '▼ 아래쪽, 붉은 빛 쪽으로 달려' : '▼ 남쪽 문 → 붉은 빛 쪽으로 달려'); else api.hint(null);
        if (cam.z > 38.6) { phase = 'knight'; pt = 0; api.hint(null); say('복도 끝에 누군가 갇혀 있다.', 2.4); setTimeout(() => { if (phase === 'knight' && !knightSaid) say('바닥에 피로 쓰여 있다 — 「 죽여야 해 」', 3); }, 2400); }
      } else if (phase === 'knight') {
        pt += dt;
        for (const gu of guests) { if (gu.z < 37 || Math.hypot(gu.x - cam.x, gu.z - cam.z) > 4.5) chaseStep(gu, .9 * dt); }
        if (!hasSword && Math.hypot(sword.x - cam.x, sword.z - cam.z) < .8) { hasSword = true; sfx.sting(); say('붉은 검을 주웠다.', 2); }
        if (!knightSaid && Math.hypot(knight.x - cam.x, knight.z - cam.z) < 2.6) { knightSaid = true; setTimeout(() => say('「 …나를 죽여. 그래야 문이 열려. 」', 3.4), 400); sfx.whisper(2, 0); }
        if (!knightDead && pt > 6) api.hint(!hasSword ? '바닥의 검을 주워' : TOUCH ? '● 베기 버튼' : '● SPACE / 클릭  베기'); else api.hint(null);
        if (knightDead && cam.z > 44.4) { phase = 'shut'; pt = 0; api.hint(null); exitLock(); api.setRoute('bad'); }
        // 죽이지 않고 검사 앞에서 가만히 기다리면 → 진엔딩
        if (!knightDead && knightSaid && Math.hypot(knight.x - cam.x, knight.z - cam.z) < 2.6 && !c.moving && slashT > 1) { waitT += dt; if (waitT > 3) this.rescue(); }
        else waitT = 0;
      } else if (phase === 'shut') {
        pt += dt;
        if (pt > .25 && pt - dt <= .25) { e.wall[46 * N + 23] = 6; e.wall[46 * N + 24] = 6; exitLight.off = true; e.bake(); osc('sine', 50, 1.2, { vol: .9, f2: 28, a: .003 }); nz(.8, { type: 'lowpass', f: 900, f2: 100, vol: .9, a: .003 }); fx.shake = api.reduced ? 3 : 12; vib(300); say('문이 닫혔다.', 2.4); drone(.22, .7, 1);
          guests.forEach((gu, i) => { const a = -Math.PI / 2 + ((i % 7) / 6 - .5) * 1.1, r = 2.2 + (i / 7 | 0) * .9; gu.x = clamp(cam.x + Math.cos(a) * r * .35, 23.2, 24.8); gu.z = cam.z + Math.sin(a) * r; gu.up = true; }); }
        e.lightMul = Math.max(.4, 1 - pt * .2);
        if (pt > 1.8) { const tgt = Math.PI * 1.5; cam.yaw += angDiff(tgt - cam.yaw) * Math.min(1, dt * 2.5); }
        if (pt > 3.5) for (const gu of guests) { const d = Math.hypot(gu.x - cam.x, gu.z - cam.z); if (d > 1.1) chaseStep(gu, .5 * dt); }
        if (pt > 3.2 && pt - dt <= 3.2) { say('「 이제 네가 여기 앉을 차례야. 」', 3); sfx.whisper(2.4, -.8); sfx.whisper(2.4, .8); }
        if (pt > 6.4 && pt - dt <= 6.4) { bigScare(); scareT = 1.3; }
        if (pt > 8.2) go(Card(T.e4, () => api.startChapter(5), { drone: .05, pitch: .8 }));
      }
    },
    cine(dt) {
      pt += dt; const t = pt;
      const ch = chicken();
      e.flick = .9 + Math.sin(now() * 11) * .06;
      // 1) 강제로 뒤를 돌아본다
      if (t < 1.1) { cam.yaw += angDiff(-Math.PI / 2 - cam.yaw) * Math.min(1, dt * 4); cam.x += (23.5 - cam.x) * dt * 2; cam.z += (42.2 - cam.z) * dt * 2; }
      if (t > .9 && t - dt <= .9) { bigScare(); scareT = 0; say(ch ? '「 놀자 놀자 놀자 」' : '「 손님은 도망가면 안 돼. 」', 2.2); }
      // 2) 손님들이 기괴하게 꺾이며 다가온다
      if (t > 1 && t < 4.3) {
        for (const gu of guests) {
          if (gu.dead) continue;
          gu.jerk += dt;
          if (gu.jerk > .22 + (gu.v % 3) * .05) { gu.jerk = 0; const d = Math.hypot(cam.x - gu.x, cam.z - gu.z); if (d > 2.35) { const st = Math.min(d - 2.3, .28 + Math.random() * .3); gu.x += (cam.x - gu.x) / d * st + (Math.random() - .5) * .15; gu.z += (cam.z - gu.z) / d * st; } gu.flip = Math.random() < .5; gu.tw = .12; if (Math.random() < .5) nz(.08, { type: 'bandpass', f: 600 + Math.random() * 900, q: 3, vol: .18, pan: (gu.x - cam.x) * .5 }); }
          gu.tw = Math.max(0, (gu.tw || 0) - dt);
          gu.x = clamp(gu.x, 23.15, 24.85);
        }
        if (Math.random() < dt * 4) sfx.whisper(.6, (Math.random() - .5) * 1.8);
        fx.noise = .12 + (t - 1) * .06; fx.wobble = .6 + (t - 1) * .5;
      }
      // 3) 철창이 부서지고 붉은 검사가 등장
      if (t > 4.3 && t - dt <= 4.3) {
        flash = 1.2; fx.glitch = 2.4; fx.shake = api.reduced ? 3 : 16; vib([60, 30, 220]);
        osc('square', 160, .6, { vol: .4, f2: 60 }); nz(.7, { type: 'highpass', f: 2200, vol: .8, a: .002 }); osc('sine', 980, 1.4, { vol: .2 }); osc('sine', 46, 1, { vol: .8, f2: 26, a: .003 });
        knightOut = { x: cam.x, z: cam.z - 1.5 }; fx.noise = .1; fx.wobble = .6; say(ch ? '「 비켜! 」' : '「 ─ 비켜. 」', 1.6);
      }
      // 4) 하나씩 베어 넘긴다 (느리게 흐르는 시간)
      if (knightOut && t > 4.8 && t < 9.2) {
        cutT -= dt;
        const alive = guests.filter(gu => !gu.dead).sort((a, b) => Math.hypot(a.x - cam.x, a.z - cam.z) - Math.hypot(b.x - cam.x, b.z - cam.z));
        if (cutT <= 0 && alive.length) {
          const gu = alive[0]; gu.dead = 1; cutT = t < 6 ? .55 : .26;
          knightOut.x += (gu.x - knightOut.x) * .6; knightOut.z = clamp(gu.z + .7, knightOut.z - 1.2, cam.z - 1.4);
          slashes.push({ t: 0, a: Math.random() * Math.PI, x: 140 + Math.random() * 120, y: 110 + Math.random() * 60 });
          flash = Math.max(flash, .55); fx.shake = api.reduced ? 1 : 6; sfx.slash(); sfx.hit(); vib(30);
          if (!ch) nz(.4, { type: 'lowpass', f: 700, f2: 150, vol: .35 });
          for (const k of [(gu.z | 0) * N + (gu.x | 0)]) e.floor[k] = 4;
        }
        slow = .55;
      }
      for (const sl of slashes) sl.t += dt;
      if (t > 9.2 && t - dt <= 9.2) { slow = 1; drone(.05, .9, 2); }
      if (t > 9.6 && t - dt <= 9.6) { knightTurn = true; say('「 …이번엔 내가 길을 막을게. 」', 3); }
      if (t > 12.8 && t - dt <= 12.8) say('「 가. 」', 2);
      // 5) 문이 열리고 빛 속으로
      if (t > 14) { cam.yaw += angDiff(Math.PI / 2 - cam.yaw) * Math.min(1, dt * 2.5); }
      if (t > 14 && t - dt <= 14) { exitLight.off = false; exitLight.i = 2.2; e.bake(); sfx.choir ? sfx.choir() : sfx.bell(); sfx.bell(); }
      if (t > 15.5) { cam.z = Math.min(45.6, cam.z + dt * 1.1); cam.bob = Math.sin(t * 7) * 1.2; }
      if (t > 15.5) whiteT = Math.min(1, (t - 15.5) / 3);
      if (t > 19.4) { api.setRoute('true'); go(Card(T.e4t || T.e4, () => api.startChapter(5), { drone: .02, pitch: 1.1 })); }
    },
    draw() {
      const ch = chicken(), list = [];
      if (phase === 'rescue') {
        for (const gu of guests) {
          if (gu.dead) list.push({ spr: ch ? SP.ghostDead : SP.guestDead, x: gu.x, z: gu.z, w: .9, h: .45, y0: 0 });
          else list.push({ spr: ch ? SP.cGuestT : SP.guestRun[gu.v], x: gu.x, z: gu.z, w: ch ? .8 : .62, h: ch ? .95 : 1.75, y0: (ch ? .35 : 0) + (gu.tw ? .04 : 0), shake: gu.tw ? 6 : 1, flip: gu.flip });
        }
        if (knightOut) list.push({ spr: ch ? SP.cKnight : (knightTurn ? SP.knightFront : SP.knightBack), x: knightOut.x, z: knightOut.z, w: ch ? .8 : .66, h: ch ? .95 : 1.72, y0: ch ? .35 : 0, glow: .5 });
        else { list.push({ spr: ch ? SP.cKnight : SP.knight, x: knight.x, z: knight.z + .2, w: ch ? .8 : .7, h: ch ? .95 : 1.15, y0: ch ? .3 : 0 }); list.push({ spr: SP.bars, x: knight.x, z: knight.z - .2, w: 1.9, h: 1.35, y0: 0 }); }
        e.render(cam, list);
        for (const sl of slashes) { if (sl.t > .3) continue; const k = 1 - sl.t / .3; g.save(); g.translate(sl.x, sl.y); g.rotate(sl.a); g.strokeStyle = ch ? `rgba(255,190,220,${k})` : `rgba(255,236,236,${k})`; g.lineWidth = 3 * k + 1; g.beginPath(); g.moveTo(-160, 0); g.lineTo(160, 0); g.stroke(); g.strokeStyle = ch ? `rgba(255,120,170,${k * .8})` : `rgba(200,0,0,${k * .8})`; g.lineWidth = 7 * k; g.beginPath(); g.moveTo(-120, 3); g.lineTo(120, 3); g.stroke(); g.restore(); }
        if (pt > 4.8 && pt < 9.2) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, 26); g.fillRect(0, H - 26, W, 26); }
        if (flash > 0) { g.fillStyle = ch ? `rgba(255,190,220,${Math.min(1, flash) * .6})` : `rgba(255,${120 * Math.min(1, flash) | 0},${120 * Math.min(1, flash) | 0},${Math.min(1, flash) * .6})`; g.fillRect(0, 0, W, H); }
        if (whiteT > 0) { g.fillStyle = `rgba(255,252,240,${whiteT})`; g.fillRect(0, 0, W, H); }
        return;
      }
      for (let x = 17; x <= 30; x++) list.push({ spr: SP.table, x: x + .5, z: 23, w: 1.05, h: .62, y0: 0 });
      for (const p of plates) list.push({ spr: p.full ? SP.plateFull[p.it.id] : SP.plate[p.it.id], x: p.x, z: p.z, w: .36, h: .36, y0: .55 });
      for (const it of items) if (!it.got) list.push({ spr: SP.item[it.id], x: it.x, z: it.z, w: .4, h: .4, y0: .3 + Math.sin(now() * 2 + it.x) * .04, glow: .9 });
      guests.forEach((gu, i) => {
        if (gu.up) list.push({ spr: ch ? SP.cGuestT : SP.guestRun[gu.v], x: gu.x, z: gu.z, w: ch ? .8 : .62, h: ch ? .95 : 1.75, y0: ch ? .35 : 0, shake: phase === 'chase' && !ch ? 1.5 : 0, glow: phase === 'shut' ? .55 : 0 });
        else {
          const stare = gu.stare || i === peek;
          const bobY = phase === 'feast' ? Math.abs(Math.sin(now() * 6 + i)) * .04 : 0;
          list.push({ spr: ch ? (stare ? SP.cGuestT : SP.cGuest) : (stare ? SP.guestStare[gu.v] : SP.guestEat[gu.v]), x: gu.x, z: gu.z, w: ch ? .75 : .62, h: ch ? .9 : 1.05, y0: (ch ? .3 : .02) - bobY });
        }
      });
      if (!knightDead) { list.push({ spr: ch ? SP.cKnight : SP.knight, x: knight.x, z: knight.z + .2, w: ch ? .8 : .7, h: ch ? .95 : 1.15, y0: ch ? .3 : 0 }); list.push({ spr: SP.bars, x: knight.x, z: knight.z - .2, w: 1.9, h: 1.35, y0: 0 }); }
      if (!hasSword && (phase === 'knight' || phase === 'chase')) list.push({ spr: SP.sword, x: sword.x, z: sword.z, w: .8, h: .2, y0: 0, glow: .7 });
      e.render(cam, list);
      if (hasSword && phase === 'knight') {
        g.save(); g.translate(W * .86, H + 18 + Math.sin(bob) * 3);
        let a = -.35; if (slashT < .25) a = -.35 - Math.sin(slashT / .25 * Math.PI) * 1.3;
        g.rotate(a); poly([-5, 0, 5, 0, 3, -140, 0, -152, -3, -140], ch ? '#f6c3da' : '#b84040'); g.fillStyle = '#1a1512'; g.fillRect(-18, -3, 36, 7); g.fillStyle = '#5a1010'; g.fillRect(-4, 4, 8, 26);
        g.restore();
      }
      if (carried.length) { let x = W - 16; for (const it of carried) { const s = SP.item[it.id]; x -= 18; ell(x + 8, 52, 8, 8, 'rgba(0,0,0,.5)'); txt('●', x + 8, 56, { size: 10, color: '#e8d8a0', font: MONO }); } }
      if (flash > 0) { g.fillStyle = ch ? `rgba(255,170,210,${flash * .45})` : `rgba(160,0,0,${flash * .55})`; g.fillRect(0, 0, W, H); }
      if (phase === 'shut') { g.fillStyle = `rgba(0,0,0,${clamp((pt - .25) * .25, 0, .55)})`; g.fillRect(0, 0, W, H); }
      if (scareT > 0) scareOverlay(scareT, 1.3, true);
    }
  };
  return S;
}


/* =========================================================
   히든 테이프 「 앨리스 ─ 0 」 : 가정용 캠코더 영상
   ========================================================= */
let tapeFont = false;
try { const ff = new FontFace('GaeguTape', "url('fonts/gaegu-tape.woff2')", { weight: '700' }); ff.load().then(f => { document.fonts.add(f); tapeFont = true; }).catch(() => {}); } catch (_) {}
function crayon(x, y, str, size, col, rot = 0, o = {}) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.font = o.hand && tapeFont ? `700 ${size * 1.25}px GaeguTape, 'Nanum Gothic Coding', sans-serif` : `${o.w || 800} ${size}px 'Nanum Myeongjo', serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const reps = o.hand ? 2 : 4;
  for (let i = 0; i < reps; i++) { g.globalAlpha = (o.a == null ? 1 : o.a) * (o.hand ? (i ? .45 : .95) : (.35 + i * .12)); g.fillStyle = col; g.fillText(str, (hash(i, size | 0) / 255 - .5) * 1.6, (hash(size | 0, i + 3) / 255 - .5) * 1.6); }
  g.restore();
}
function crayLine(pts, col, w = 2) {
  g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let k = 0; k < 2; k++) { g.lineWidth = w * (k ? .6 : 1); g.globalAlpha = k ? .5 : .85; g.beginPath(); pts.forEach(([x, y], i) => { const jx = x + (hash(i * 7 + k, x | 0) / 255 - .5) * 1.2, jy = y + (hash(i * 3 + k, y | 0) / 255 - .5) * 1.2; i ? g.lineTo(jx, jy) : g.moveTo(jx, jy); }); g.stroke(); }
  g.globalAlpha = 1;
}
// 아이가 그린 그림 (종이 한 장)
function kidDrawing(x, y, w, h, rot) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = '#ece4cf'; g.fillRect(-w / 2, -h / 2, w, h);
  g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(-w / 2, h / 2 - 3, w, 3);
  const X = u => -w / 2 + u * w, Y = v => -h / 2 + v * h;
  for (let i = 0; i < 4; i++) crayLine([[X(.08 + i * .07), Y(.8)], [X(.12 + i * .07), Y(.45)], [X(.16 + i * .07), Y(.8)]], '#2f8a3a', 2);       // 숲
  crayLine([[X(.4), Y(.8)], [X(.4), Y(.45)], [X(.52), Y(.32)], [X(.64), Y(.45)], [X(.64), Y(.8)]], '#3a5ac8', 2);                          // 극장
  crayLine([[X(.44), Y(.62)], [X(.6), Y(.62)]], '#3a5ac8', 1.5);
  crayLine([[X(.72), Y(.8)], [X(.72), Y(.4)], [X(.76), Y(.4)], [X(.76), Y(.46)], [X(.8), Y(.46)], [X(.8), Y(.4)], [X(.84), Y(.4)], [X(.84), Y(.8)]], '#6a6a6a', 2); // 성
  crayLine([[X(.66), Y(.9)], [X(.92), Y(.9)]], '#d4a020', 2.5); crayLine([[X(.7), Y(.9)], [X(.7), Y(.98)]], '#d4a020', 2); crayLine([[X(.88), Y(.9)], [X(.88), Y(.98)]], '#d4a020', 2); // 다과회 식탁
  crayLine([[X(.86), Y(.1)], [X(.9), Y(.2)], [X(.82), Y(.2)], [X(.86), Y(.1)]], '#e0c020', 2);                                               // 해
  // 작은 꿈: 아이 옆에 서 있는 까만 것
  g.fillStyle = '#141014'; g.beginPath(); g.ellipse(X(.3), Y(.62), w * .045, h * .16, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.fillRect(X(.29), Y(.55), 1.5, 1.5); g.fillRect(X(.31), Y(.55), 1.5, 1.5);
  // 아이 자신
  crayLine([[X(.22), Y(.5)], [X(.22), Y(.72)]], '#d04080', 2); g.strokeStyle = '#a05030'; g.lineWidth = 1.2; g.beginPath(); g.arc(X(.22), Y(.46), w * .025, 0, 7); g.stroke();
  crayon(X(.31), Y(.32), '작은꿈', h * .1, '#141014', -.08, { w: 400, hand: true });
  g.restore();
}
function room(mode, t) {
  // mode: day / dusk / night / morning
  const night = mode === 'night';
  const wall = night ? '#121a2a' : mode === 'morning' ? '#c9bea2' : mode === 'dusk' ? '#a89878' : '#d2c6a6';
  g.fillStyle = wall; g.fillRect(-20, -20, W + 40, 214);
  // 벽지 꽃무늬
  g.fillStyle = night ? 'rgba(120,140,190,.12)' : 'rgba(150,90,90,.18)';
  for (let y = 10; y < 190; y += 22) for (let x = (y / 22 % 2) * 14; x < W; x += 28) { g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); g.fillRect(x - .5, y + 2, 1, 5); }
  // 창문
  g.fillStyle = night ? '#060a14' : '#2a2018'; g.fillRect(28, 40, 86, 96);
  const sky = night ? '#0a1430' : mode === 'dusk' ? '#c87848' : '#bcd8ec';
  g.fillStyle = sky; g.fillRect(33, 45, 76, 86);
  if (night) { g.fillStyle = '#d8dce8'; g.beginPath(); g.arc(90, 64, 7, 0, 7); g.fill(); }
  g.fillStyle = night ? '#060a14' : '#2a2018'; g.fillRect(69, 45, 3, 86); g.fillRect(33, 86, 76, 3);
  g.fillStyle = night ? '#2a2440' : '#d88aa0'; g.fillRect(20, 34, 16, 112); g.fillRect(106, 34, 16, 112);
  // 벽장
  g.fillStyle = night ? '#1a1410' : '#6a4a30'; g.fillRect(250, 34, 100, 160);
  g.fillStyle = night ? '#0e0a08' : '#4a321e'; g.fillRect(254, 38, 92, 152);
  // 바닥
  const fl = g.createLinearGradient(0, 194, 0, H); fl.addColorStop(0, night ? '#151018' : '#7a5a3a'); fl.addColorStop(1, night ? '#08060a' : '#4a3420');
  g.fillStyle = fl; g.fillRect(-20, 194, W + 40, 120);
  g.strokeStyle = night ? 'rgba(0,0,0,.5)' : 'rgba(40,24,12,.5)'; g.lineWidth = 1;
  for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(W / 2 + i * 26, 194); g.lineTo(W / 2 + i * 70, H); g.stroke(); }
  // 침대
  g.fillStyle = night ? '#22202c' : '#e8e0d0'; g.fillRect(140, 150, 96, 34); g.fillStyle = night ? '#2a2236' : '#e0a0b8'; g.fillRect(140, 160, 96, 30);
  g.fillStyle = night ? '#1a1418' : '#8a6040'; g.fillRect(136, 128, 6, 70); g.fillRect(236, 140, 6, 58);
  g.fillStyle = night ? '#2a2a34' : '#f4f0e6'; g.beginPath(); g.ellipse(160, 154, 16, 7, 0, 0, 7); g.fill();
  // 곰인형
  g.fillStyle = night ? '#2a2018' : '#a07040'; g.beginPath(); g.arc(222, 150, 7, 0, 7); g.fill(); g.beginPath(); g.arc(222, 140, 5, 0, 7); g.fill();
  g.beginPath(); g.arc(218, 136, 2, 0, 7); g.arc(226, 136, 2, 0, 7); g.fill();
}
function girl(x, y, s, o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const dress = o.dress || '#e07090', hair = o.hair || '#3a2414', skin = '#f0d0b0';
  if (o.sit) { g.fillStyle = dress; g.beginPath(); g.ellipse(0, 10, 22, 12, 0, 0, 7); g.fill(); g.fillRect(-12, -18, 24, 28); }
  else { g.fillStyle = dress; g.beginPath(); g.moveTo(-12, -20); g.lineTo(12, -20); g.lineTo(18, 24); g.lineTo(-18, 24); g.closePath(); g.fill(); g.fillStyle = skin; g.fillRect(-9, 24, 5, 22); g.fillRect(4, 24, 5, 22); }
  g.fillStyle = skin; g.fillRect(-3, -24, 6, 6);
  g.fillStyle = hair; g.beginPath(); g.arc(0, -36, 14, Math.PI, 0); g.fill(); g.fillRect(-14, -36, 28, o.long ? 30 : 16);
  g.fillStyle = skin; g.beginPath(); g.ellipse(0, -34, 10.5, 12, 0, 0, 7); g.fill();
  g.fillStyle = hair; g.fillRect(-11, -46, 22, 7);
  if (o.back) { g.fillStyle = hair; g.beginPath(); g.ellipse(0, -34, 11, 12.5, 0, 0, 7); g.fill(); }
  else { g.fillStyle = '#1a1010'; g.fillRect(-5, -34, 2.4, 2.6); g.fillRect(3, -34, 2.4, 2.6); g.strokeStyle = '#a04a40'; g.lineWidth = 1; g.beginPath(); o.sad ? g.arc(0, -24, 3, 1.15 * Math.PI, 1.85 * Math.PI) : g.arc(0, -29, 3, .15 * Math.PI, .85 * Math.PI); g.stroke(); g.fillStyle = 'rgba(230,120,120,.35)'; g.fillRect(-9, -30, 4, 2); g.fillRect(5, -30, 4, 2); }
  g.restore();
}
function camOSD(rec, date, time, night) {
  g.font = `16px ${api.OSDF}`; g.textBaseline = 'top'; g.textAlign = 'left';
  const sh = (s, x, y, col, al = 'left') => { g.textAlign = al; g.fillStyle = 'rgba(0,0,0,.7)'; g.fillText(s, x + 1, y + 1); g.fillStyle = col; g.fillText(s, x, y); };
  if (rec && Math.floor(now() * 1.5) % 2) { g.fillStyle = '#e02020'; g.beginPath(); g.arc(18, 18, 4, 0, 7); g.fill(); }
  if (rec) sh('REC', 26, 11, '#f0f0f0');
  sh(night ? 'NIGHT' : 'AUTO', W - 14, 11, '#f0f0f0', 'right');
  sh(date, W - 14, H - 44, '#f6f0c0', 'right'); sh(time, W - 14, H - 28, '#f6f0c0', 'right');
  g.strokeStyle = 'rgba(240,240,240,.55)'; g.lineWidth = 1.2;
  for (const [cx, cy, dx, dy] of [[10, 34, 1, 1], [W - 10, 34, -1, 1], [10, H - 54, 1, -1], [W - 10, H - 54, -1, -1]]) { g.beginPath(); g.moveTo(cx, cy + dy * 12); g.lineTo(cx, cy); g.lineTo(cx + dx * 12, cy); g.stroke(); }
}
function TapeScene(next) {
  const name = api.playerName() || '이름 없는 아이';
  const T0 = 1.6, S2 = 24, S3 = 39, S4 = 57, S5 = 68, END = 80;
  // 소리 없이 자막으로만: [ ] 는 소리 묘사, 나머지는 대사. 한 글자씩 타자 치듯 나온다.
  const subsAt = [
    [T0 + .3, '[ 테이프 돌아가는 소리 ]', 1.6, 'cc'],
    [T0 + 2, '찍고 있어? …안녕!', 2.4], [T0 + 4.5, '이거 봐, 내가 그렸어.', 2.4],
    [T0 + 7.1, '여기는 숲이고, 이건 노래하는 극장이고…', 3], [T0 + 10.3, '이건 성. 여기서 다과회를 해.', 2.8],
    [T0 + 13.4, '그리고 이건…', 1.6], [T0 + 15.1, '내 친구, 작은 꿈이야.', 2.6, 'warm'],
    [T0 + 17.9, '꿈이는 내가 안 꿔 주면 없어진대.', 2.6], [T0 + 20.2, '그래서 매일 꿔 줘.', 1.8, 'warm'],
    [S2 + .4, '[ 4년 뒤 ]', 1.6, 'cc'],
    [S2 + 2.2, '엄마, 그만 찍어.', 2.2], [S2 + 4.8, '…이제 그런 거 안 믿어.', 2.4], [S2 + 7.4, '나 열한 살이야.', 2], [S2 + 10.2, '…안녕.', 2.4, 'quiet'],
    [S3 + 1.5, '[ 아무도 없다 ]', 3, 'cc'], [S3 + 6, '[ 삐걱 ]', 1.8, 'cc'],
    [S3 + 9, '[ 무언가 종이를 긁는 소리 ]', 3, 'cc'], [S3 + 12.6, '…꿔 줘.', 2, 'other'], [S3 + 14.8, '꿔 줘 꿔 줘 꿔 줘 꿔 줘', 2.4, 'other'],
    [S4 + 1.2, '[ 방에 아무도 없다 ]', 2.6, 'cc'], [S4 + 5.4, '[ 멀리서 부르는 소리 ]', 2.6, 'cc'],
    [S5 + 2.5, '[ 테이프 한 개 ]', 2.4, 'cc'], [S5 + 6.4, '…다음은 너야.', 3, 'other']
  ];
  const cap = { text: '', kind: '', t0: 0, dur: 0 };
  function drawCap(t) {
    const age = t - cap.t0; if (!cap.text || age > cap.dur + .3) return;
    const n = cap.kind === 'cc' ? cap.text.length : Math.min(cap.text.length, Math.floor(age * 16));
    const str = cap.text.slice(0, n);
    const a = clamp(Math.min(age * 4, (cap.dur + .3 - age) * 3), 0, 1);
    g.save(); g.globalAlpha = a;
    g.font = `${cap.kind === 'cc' ? 400 : 700} ${cap.kind === 'cc' ? 12 : 14}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(cap.text).width + 16, y = H - 62 + (cap.kind === 'other' ? (Math.random() - .5) * 2 : 0);
    g.fillStyle = 'rgba(0,0,0,.78)'; g.fillRect(W / 2 - w / 2, y - 11, w, 22);
    g.fillStyle = cap.kind === 'cc' ? '#bdb7a8' : cap.kind === 'other' ? (chicken() ? '#ff9ec4' : '#e02424') : cap.kind === 'warm' ? '#ffe9b0' : cap.kind === 'quiet' ? '#a8a4a0' : '#f4f0e6';
    g.fillText(str, W / 2 + (cap.kind === 'other' ? (Math.random() - .5) * 2 : 0), y);
    g.restore();
  }
  let si = 0, scratchT = 0, humT = 0, ambT = 0, tickT = 0, seg = -1;
  const S = {
    noPause: true,
    enter() { api.osd.on = false; setFx({ noise: .16, wobble: 1.2, ca: 1.6, flicker: .06, track: .5 }); drone(0, 1, .5); api.stopTrack && api.stopTrack(.5); sfx.rew(); },
    exit() { api.osd.on = true; },
    update(dt) {
      const t = this.t;
      while (si < subsAt.length && t >= subsAt[si][0]) { const q = subsAt[si]; cap.text = q[1]; cap.dur = q[2]; cap.kind = q[3] || ''; cap.t0 = q[0]; if (cap.kind === 'other') { fx.glitch = .8; } else sfx.tick(); si++; }
      // ---- 소리로 분위기: 캠코더 모터, 방 안의 소리 ----
      humT -= dt; if (t > T0 && humT <= 0) { humT = .9; nz(1.1, { type: 'bandpass', f: 180, q: 2, vol: .035, a: .3 }); nz(1.1, { type: 'highpass', f: 5200, vol: .012, a: .3 }); }
      const sg = t < T0 ? 0 : t < S2 ? 1 : t < S3 ? 2 : t < S4 ? 3 : t < S5 ? 4 : 5;
      if (sg !== seg) { seg = sg; sfx.clunk(); nz(.25, { type: 'bandpass', f: 2600, q: .6, vol: .16, a: .003 }); if (sg === 3) drone(.03, .55, 3); if (sg === 4) drone(0, 1, .5); if (sg === 5) drone(.05, .5, 4); }
      ambT -= dt;
      if (sg === 1) { // 낮: 오르골, 새소리, 아이의 크레용
        if (Math.random() < dt * .55) sfx.music([523.25, 587.33, 659.25, 783.99, 880][Math.random() * 5 | 0], 10);
        if (ambT <= 0) { ambT = 1.4 + Math.random() * 2; const f = 2600 + Math.random() * 900; for (let i = 0; i < 3; i++) osc('sine', f, .09, { vol: .025, f2: f * 1.25, delay: i * .12, pan: -.6 }); }
        if (Math.random() < dt * 1.2) nz(.09, { type: 'bandpass', f: 3000, q: 3, vol: .03, pan: .1 });
      }
      if (sg === 2) { // 해 질 녘: 시계, 바람
        tickT -= dt; if (tickT <= 0) { tickT = 1; osc('square', 2200, .015, { vol: .012, pan: .6 }); }
        if (ambT <= 0) { ambT = 3; nz(3, { type: 'bandpass', f: 500, f2: 300, q: .8, vol: .05, a: 1.2, pan: -.7 }); }
        if (t > S2 + 6 && t < S2 + 9 && Math.random() < dt * 3) nz(.1, { type: 'lowpass', f: 900, vol: .07 });      // 종이 넣는 소리
        if (t > S2 + 10.5 && t - dt <= S2 + 10.5) { nz(.4, { type: 'bandpass', f: 380, f2: 200, q: 5, vol: .2 }); }   // 벽장 문
        if (t > S2 + 11.9 && t - dt <= S2 + 11.9) { osc('sine', 80, .3, { vol: .3, f2: 50 }); nz(.2, { type: 'lowpass', f: 800, vol: .3 }); }
      }
      if (sg === 3) { // 밤: 귀뚜라미 → 침묵, 삐걱, 긁는 소리, 숨소리
        const k = t - S3;
        if (k < 5 && ambT <= 0) { ambT = .7; for (let i = 0; i < 4; i++) osc('sine', 4300, .04, { vol: .02, delay: i * .07, pan: .7 }); }
        if (k > 6 && k - dt <= 6) { nz(1.6, { type: 'bandpass', f: 420, f2: 230, q: 7, vol: .22, a: .4, pan: .6 }); osc('sawtooth', 70, 1.4, { vol: .04, f2: 55, pan: .6 }); }
        if (k > 12 && k - dt <= 12) sfx.breath();
        if (k > 14.6 && k - dt <= 14.6) { sfx.whisper(2.2, .5); fx.glitch = 1; }
        if (k > 17.2 && k - dt <= 17.2) { sfx.stat(.6); }
      }
      if (sg === 4) { // 아침: 새소리, 멀리서 부르는 소리
        const k = t - S4;
        if (ambT <= 0) { ambT = 2 + Math.random() * 2; const f = 2400 + Math.random() * 1200; for (let i = 0; i < 2; i++) osc('sine', f, .1, { vol: .02, f2: f * 1.3, delay: i * .15, pan: -.7 }); }
        if (k > 5.4 && k - dt <= 5.4) { osc('sine', 330, .7, { vol: .05, f2: 290, pan: -.9 }); osc('sine', 330, .9, { vol: .04, f2: 280, delay: .9, pan: -.9 }); }
      }
      if (sg === 5) {
        const k = t - S5;
        if (k > 6.2 && k - dt <= 6.2) { sfx.whisper(2.4, 0); osc('sine', 46, 2, { vol: .3, f2: 30 }); }
        if (k > 9 && k - dt <= 9) { osc('square', 60, .2, { vol: .2, f2: 40 }); }
      }
      if (t >= S3 && t < S4) {
        scratchT -= dt;
        if (t > S3 + 5 && scratchT <= 0) { scratchT = .15 + Math.random() * .4; nz(.12 + Math.random() * .2, { type: 'bandpass', f: 2200 + Math.random() * 1600, q: 4, vol: .08 + (t - S3) / 20 * .12, pan: .5 }); }
        if (t > S3 + 1 && t - dt <= S3 + 1) drone(.05, .6, 4);
      }
      if (t > S4 && t - dt <= S4) { drone(0, 1, .2); sfx.stat(.3); }
      if (t > S5 + 9 && t - dt <= S5 + 9) { sfx.stat(.8); fx.glitch = 2; }
      if (t >= S3 && t < S4 - .2) fx.noise = .22; else fx.noise = .16;
      if (t > END) next ? next() : go(api.Title());
    },
    key() {}, pointer() {},
    draw() { this.drawScene(); drawCap(this.t); },
    drawScene() {
      const t = this.t;
      if (t < T0) { // 재생 시작
        g.fillStyle = '#1430a6'; g.fillRect(-20, -20, W + 40, H + 40);
        txt('▶ PLAY   앨리스 ─ 0', W / 2, 150, { size: 18, color: '#eef1ff', font: MONO });
        for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(220,220,240,${.2 + Math.random() * .3})`; g.fillRect(0, Math.random() * H, W, 2 + Math.random() * 6); }
        return;
      }
      if (t < S2) { // 1987, 아이가 그림을 보여 준다
        const k = t - T0, zoom = 1 + clamp((k - 10) / 6, 0, 1) * .25;
        g.save(); g.translate(W / 2, H / 2); g.scale(zoom, zoom); g.translate(-W / 2 + Math.sin(k * .7) * 3, -H / 2 + Math.cos(k * .9) * 2);
        room('day', k);
        girl(200, 232, 1.75, { sit: true });
        g.fillStyle = '#f0d0b0'; g.fillRect(118, 218, 10, 14); g.fillRect(272, 218, 10, 14);
        kidDrawing(200 + Math.sin(k * 1.3) * 2, 232, 150, 88, -.04 + Math.sin(k) * .02);
        g.restore();
        camOSD(true, 'JUN.14 1987', `PM 3:${String(12 + (k / 60 | 0)).padStart(2, '0')}`);
        return;
      }
      if (t < S3) { // 1991, 그림을 상자에 넣고 벽장을 닫는다
        const k = t - S2;
        room('dusk', k);
        const gx = k < 7 ? 180 : lerp(180, 300, clamp((k - 7) / 3, 0, 1));
        // 상자
        const bx = k < 7 ? 160 : gx - 20, by = k < 7 ? 232 : 214;
        g.fillStyle = '#9a7448'; g.fillRect(bx - 34, by - 22, 68, 40); g.fillStyle = '#7a5a34'; g.fillRect(bx - 34, by - 22, 68, 6);
        if (k < 6) for (let i = 0; i < 3; i++) { g.fillStyle = '#ece4cf'; g.save(); g.translate(bx - 18 + i * 16, by - 26); g.rotate(-.2 + i * .2); g.fillRect(-10, -12, 20, 16); crayLine([[-6, 0], [-2, -8], [2, 0]], '#2f8a3a', 1.5); g.restore(); }
        crayon(bx, by - 2, '꿈', 10, '#2a2a2a', 0, { w: 400 });
        girl(gx + 14, 196, 1.45, { dress: '#4a5a7a', long: true, sad: true, back: k > 7 });
        // 벽장 문 닫힘
        const close = clamp((k - 10.5) / 1.4, 0, 1);
        if (k > 10) { g.fillStyle = '#5a3e26'; g.fillRect(254, 38, 92 * close, 152); g.fillStyle = '#c8a050'; if (close > .9) g.fillRect(338, 112, 3, 6); }
        camOSD(true, 'MAR.02 1991', 'PM 6:41');
        if (k > 13) { g.fillStyle = `rgba(0,0,0,${clamp((k - 13) / 2, 0, 1)})`; g.fillRect(0, 0, W, H); }
        return;
      }
      if (t < S4) { // 밤, 켜 둔 채 잊힌 캠코더
        const k = t - S3;
        room('night', k);
        const open = clamp((k - 4) / 12, 0, .75);
        g.fillStyle = '#020102'; g.fillRect(254, 38, 92, 152);
        g.fillStyle = '#2a1e14'; g.fillRect(254, 38, 92 * (1 - open), 152);
        if (k > 11 && !chicken()) { const a = clamp((k - 11) / 2, 0, 1) * (.6 + .4 * Math.sin(k * 3)); g.fillStyle = `rgba(240,240,255,${a})`; g.fillRect(320, 92, 2, 2); g.fillRect(330, 92, 2, 2); }
        if (k > 11 && chicken()) { g.globalAlpha = clamp((k - 11) / 2, 0, 1) * .8; cuteGhost(325, 110, 12, {}); g.globalAlpha = 1; }
        if (k > 13.5) { g.fillStyle = '#141014'; for (let i = 0; i < 3; i++) g.fillRect(300 + i * 4, 182 + i * 2, 18, 2); }
        g.fillStyle = 'rgba(40,90,60,.22)'; g.fillRect(0, 0, W, H);
        camOSD(true, 'MAR.02 1991', `AM 3:${String(3 + (k / 4 | 0)).padStart(2, '0')}`, true);
        if (k > 17.2) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
        return;
      }
      if (t < S5) { // 아침, 벽 가득 "잊지 마"
        const k = t - S4;
        room('morning', k);
        g.fillStyle = '#5a3e26'; g.fillRect(254, 38, 92, 152);
        const cols = ['#b01818', '#141014', '#2a3a9a', '#b01818', '#6a1a6a'];
        const n = Math.min(26, 6 + k * 4);
        for (let i = 0; i < n; i++) { const x = 30 + (i * 67 % 340) + (hash(i, 3) / 255 - .5) * 30, y = 20 + ((i * 37) % 170) + (hash(i, 9) / 255 - .5) * 16, sz = 16 + hash(i, 5) % 20; crayon(x, y, '잊지 마', sz, cols[i % 5], (hash(i, 7) / 255 - .5) * .6, { a: .9, hand: true }); }
        for (let i = 0; i < 4; i++) { g.save(); g.translate(60 + i * 70, 250 + (i % 2) * 18); g.rotate(-.3 + i * .25); g.fillStyle = '#ece4cf'; g.fillRect(-16, -11, 32, 22); crayLine([[-10, 6], [-4, -6], [2, 6]], '#2f8a3a', 1.5); g.restore(); }
        camOSD(true, 'MAR.03 1991', 'AM 7:12');
        return;
      }
      // 벽장 속, 상자 위의 테이프
      const k = t - S5;
      g.fillStyle = '#0c0806'; g.fillRect(-20, -20, W + 40, H + 40);
      const lg = g.createRadialGradient(200, 160, 10, 200, 160, 220); lg.addColorStop(0, 'rgba(200,170,120,.35)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = lg; g.fillRect(0, 0, W, H);
      g.fillStyle = '#7a5a34'; g.fillRect(40, 70, 320, 230); g.fillStyle = '#6a4c2a'; g.fillRect(40, 70, 320, 10);
      crayon(90, 110, '꿈', 18, '#2a2a2a', -.1, { w: 400 });
      const zoom = 1 + clamp(k / 8, 0, 1) * .18;
      g.save(); g.translate(200, 180); g.scale(zoom, zoom); g.rotate(-.05);
      g.fillStyle = '#0c0c0e'; g.fillRect(-110, -62, 220, 124);
      g.fillStyle = '#1c1c20'; g.fillRect(-100, -54, 200, 108);
      g.fillStyle = '#060608'; g.beginPath(); g.arc(-48, 6, 20, 0, 7); g.arc(48, 6, 20, 0, 7); g.fill();
      g.fillStyle = '#e8e2d0'; g.fillRect(-92, -50, 184, 40);
      g.strokeStyle = '#b8b0a0'; g.lineWidth = .5; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-88, -42 + i * 9); g.lineTo(88, -42 + i * 9); g.stroke(); }
      g.font = "800 17px 'Nanum Myeongjo', serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1a1414'; g.fillText('「 앨리스 ─ 5 」', 0, -37);
      g.restore();
      g.save(); g.translate(200, 180); g.scale(zoom, zoom); g.rotate(-.05);
      crayon(0, -19, name, 13, '#a01414', .02, { w: 400 });
      g.restore();
      if (k < 9) camOSD(true, 'MAR.03 1991', 'AM 7:14');
      else { g.font = `20px ${api.OSDF}`; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = '#f2f2ee'; g.fillText('PAUSE ▮▮', 14, 10); }
      if (k > 9) { fx.wobble = 2; fx.noise = .3; }
    }
  };
  return S;
}


/* =========================================================
   하드 3장 : 초록 여왕의 방 — 틀린 것을 찾아라
   ========================================================= */
function HCh3() {
  buildSprites();
  const N = 14, TT = 90;
  const FT = [{ col: [58, 40, 28], tex: 'board' }, { col: [34, 58, 38], tex: 'carpet' }];
  const WT = [null, { col: [74, 78, 64] }, { col: [70, 46, 28], tex: 'wood', h: 1.25 }];
  const e = Engine({ N, indoor: true, WT, FT, wallH: 1.4, fogD: 14, fogC: [2, 1, 1], amb: .1, ceilC: [30, 24, 20], lantern: 6.5, lanternC: [1, .96, .88] });
  e.lanternI = 2.7; e.spot = { r: 62, soft: 34, out: .2, k: 1 };
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const k = z * N + x;
    if (x < 2 || x > 11 || z < 2 || z > 9) { e.wall[k] = 1; continue; }
    e.floor[k] = (x >= 4 && x <= 9 && z >= 4 && z <= 7) ? 1 : 0;
  }
  e.wall[7 * N + 2] = 2; e.wall[8 * N + 2] = 2; // 옷장
  const TB = { x: 6.5, z: 5.5 }, BED = { x: 11.0, z: 9.0 };
  e.block[5 * N + 6] = 1;
  for (const [x, z] of [[10, 8], [11, 8], [10, 9], [11, 9]]) e.block[z * N + x] = 1;
  e.lights.push({ x: 6.5, z: 5.5, r: 2.2, i: .6, c: [1, .7, .4] }); // 탁자 위 촛불만 조금
  e.lights.push({ x: 3.9, z: 2.5, r: 2.4, i: .55, c: [1, .12, .1] }, { x: 9.9, z: 2.5, r: 2.4, i: .55, c: [1, .12, .1] });
  e.lights.push({ x: 6.5, z: 9.4, r: 1.8, i: .5, c: [1, .1, .08] });
  e.bake();
  const ch0 = chicken();

  /* ---- 그림들 ---- */
  const winEmis = (x, face, open) => {
    const gr = x.createLinearGradient(0, 6, 0, 56); gr.addColorStop(0, '#2a0404'); gr.addColorStop(.55, '#5c0b0b'); gr.addColorStop(1, '#160202');
    x.fillStyle = gr; x.fillRect(6, 6, 52, 50);
    E2(x, 46, 17, 5, 5, '#b01c1c'); E2(x, 47, 16, 4, 4, '#c83030');
    x.fillStyle = 'rgba(14,1,1,.9)'; x.fillRect(6, 30, 52, 2); x.fillRect(12, 38, 40, 1); x.fillRect(6, 46, 30, 1);
    for (let i = 0; i < 6; i++) { x.fillStyle = '#100202'; x.fillRect(8 + i * 9, 50 - (i % 3) * 3, 3, 10); } // 먼 첨탑
    if (face) {
      if (ch0) { x.save(); x.translate(20, 22); x.rotate(Math.PI); ghostOn(x, 0, 0, 7, { col: '#ffd6e6' }); x.restore(); }
      else {
        x.fillStyle = '#4a3e38'; x.fillRect(16.5, 6, 5, 7); // 목 (위로 매달림)
        x.fillStyle = '#0a0606'; for (let i = 0; i < 12; i++) x.fillRect(9.5 + i * 1.6, 28, 1.2, 12 + ((i * 7) % 6) * 2.4); // 늘어진 머리카락
        E2(x, 19, 22, 9, 11, '#a89a8c'); E2(x, 19, 23, 7.5, 9.5, '#b8aa9a');
        x.strokeStyle = '#1a0606'; x.lineWidth = 1.2; x.beginPath(); x.arc(19, 15.5, 4.2, 1.1 * Math.PI, 1.9 * Math.PI); x.stroke(); // 뒤집힌 미소
        if (open > .3) { E2(x, 15.5, 26, 2.4, 2.8 * open, '#050202'); E2(x, 22.5, 26, 2.4, 2.8 * open, '#050202'); E2(x, 15.5, 26.6, .6, .6, '#f0e8d8'); E2(x, 22.5, 26.6, .6, .6, '#f0e8d8'); }
        else { x.fillStyle = '#2a1a16'; x.fillRect(13.5, 26, 4, 1); x.fillRect(20.5, 26, 4, 1); }
        x.fillStyle = 'rgba(60,4,4,.7)'; x.fillRect(15, 27, .8, 3); x.fillRect(22.2, 27, .8, 2);
      }
    }
    x.fillStyle = '#1a1614'; x.fillRect(30, 6, 4, 50); x.fillRect(6, 29, 52, 3); // 창살
  };
  const winSpr = (face, open) => canvasSprite(64, 60, x => { x.fillStyle = '#2c2824'; x.fillRect(0, 0, 64, 60); x.fillStyle = '#3a3530'; x.fillRect(2, 54, 60, 6); }, x => winEmis(x, face, open));
  const WIN_A = e.addPic([[3, 1], [4, 1]], 'z+', { spr: winSpr(true, 0), yb: .45, yt: 1.2 });
  e.addPic([[9, 1], [10, 1]], 'z+', { spr: winSpr(false, 0), yb: .45, yt: 1.2 });
  // 초상화
  // 초상화 — 2D 3장과 같은 그림. 뒤틀림도 그때처럼: 눈이 움찔거리며 흘러내리고 피눈물이 길어진다
  const portrait = (k, tw) => canvasSprite(48, 58, x => {
    x.scale(1, 58 / 66);
    const j = tw > 0 ? 1 : 0, sh = j ? (Math.random() - .5) * (1 + k * 2) : 0;
    x.fillStyle = '#4e3f16'; x.fillRect(0, 0, 48, 66); x.fillStyle = '#6a5620'; x.fillRect(1, 1, 46, 1); x.fillStyle = '#1b1712'; x.fillRect(4, 4, 40, 58);
    x.save(); x.beginPath(); x.rect(4, 4, 40, 58); x.clip(); x.translate(sh, 0);
    if (ch0) {
      ghostOn(x, 24, 32, 12, { col: '#dff5e6', boo: j && k > .4 });
      x.fillStyle = '#8cc4ff'; x.fillRect(19, 33, 1.2, 4 + k * 10); x.fillRect(28.5, 33, 1.2, 3 + k * 12);
    } else {
      E2(x, 24, 52, 18, 18, '#16301f'); E2(x, 24, 30, 12, 15, '#c4bba7');
      x.fillStyle = '#16301f'; x.fillRect(10, 14, 28, 8); x.fillRect(9, 18, 5, 30); x.fillRect(34, 18, 5, 30);
      const jt = j ? (Math.random() - .5) * (3 + k * 3) : 0, ey = j ? 1.5 + k * 2.5 : k * 1.2;
      E2(x, 19 + jt, 29 + ey, 2.6, 3, '#050303'); E2(x, 29 + jt, 29 + ey, 2.6, 3, '#050303');
      if (j) { E2(x, 19 + jt, 29 + ey, .8, .8, '#e8e0d0'); E2(x, 29 + jt, 29 + ey, .8, .8, '#e8e0d0'); }
      x.fillStyle = '#6a0b0b'; x.fillRect(18, 31 + ey, 1.5, 10 + k * 18); x.fillRect(28.5, 31 + ey, 1.5, 7 + k * 22);
    }
    x.restore();
  }, null, 2);
  const PORT = e.addPic([[7, 1]], 'z+', { spr: portrait(0, 0), yb: .1, yt: 1.3 });
  // 거울
  const mirSpr = (front, fade) => canvasSprite(64, 72, x => {
    E2(x, 32, 36, 30, 35, '#6a5418'); E2(x, 32, 36, 27, 32, '#a08a3a'); E2(x, 32, 36, 25.5, 30.5, '#5a4818');
    x.save(); x.beginPath(); x.ellipse(32, 36, 24, 29, 0, 0, 7); x.clip();
    const gr = x.createLinearGradient(0, 6, 0, 66); gr.addColorStop(0, '#3a4448'); gr.addColorStop(1, '#141a1c'); x.fillStyle = gr; x.fillRect(0, 0, 64, 72);
    x.fillStyle = '#20282a'; x.fillRect(0, 52, 64, 20); x.fillStyle = 'rgba(200,220,230,.08)'; P2(x, [14, 8, 22, 8, 10, 60, 6, 60], 'rgba(200,220,230,.07)');
    if (fade < 1) {
      x.globalAlpha = 1 - fade;
      if (ch0) ghostOn(x, 32, 38, 10, { col: '#dcfae6', boo: front });
      else {
        P2(x, [27, 37, 37, 37, 39, 46, 46, 68, 18, 68, 25, 46], '#1d4a28'); E2(x, 32, 38, 6.5, 2.6, '#1d4a28'); x.fillStyle = '#143a1e'; x.fillRect(31, 46, 2, 22);
        x.fillStyle = '#cfc5b2'; x.fillRect(30.5, 33, 3, 4);
        if (!front) { E2(x, 32, 28, 4.6, 5.6, '#0a0c0a'); P2(x, [27.4, 28, 36.6, 28, 37.5, 47, 26.5, 47], '#0a0c0a'); for (let i = 0; i < 5; i++) x.fillRect(27 + i * 2.2, 44, 1, 4 + (i % 2) * 2); }
        else {
          E2(x, 32, 28, 5, 6, '#0a0c0a'); E2(x, 32, 29, 3.6, 4.8, '#b8b0a0');
          E2(x, 30.6, 28.4, 1, 1.5, '#050303'); E2(x, 33.4, 28.4, 1, 1.5, '#050303');
          x.strokeStyle = '#3a0a0a'; x.lineWidth = .6; x.beginPath(); x.arc(32, 30.6, 1.8, .15 * Math.PI, .85 * Math.PI); x.stroke();
          x.fillStyle = '#0a0c0a'; x.fillRect(27, 28, 1.6, 18); x.fillRect(35.4, 28, 1.6, 18);
        }
      }
      x.globalAlpha = 1;
    }
    x.restore();
  }, null);
  const MIR = e.addPic([[12, 5], [12, 6]], 'x-', { spr: mirSpr(false, 0), yb: .05, yt: 1.25, glow: .22 });
  // 괘종시계 (멀쩡하다 — 미끼)
  const clockSpr = t => canvasSprite(24, 60, x => {
    x.fillStyle = '#3a2416'; x.fillRect(3, 0, 18, 60); x.fillStyle = '#2a180e'; x.fillRect(3, 0, 18, 2); x.fillRect(3, 58, 18, 2);
    E2(x, 12, 13, 8, 8, '#a08a3a'); E2(x, 12, 13, 7, 7, '#d8cfb8');
    x.fillStyle = '#1a1210'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.fillRect(12 + Math.cos(a) * 5.6 - .4, 13 + Math.sin(a) * 5.6 - .4, .8, .8); }
    const hm = (t / 60) % 1, hh = (t / 720) % 1;
    x.strokeStyle = '#1a1210'; x.lineWidth = .8; x.beginPath(); x.moveTo(12, 13); x.lineTo(12 + Math.sin(hm * 7 - 0) * 5, 13 - Math.cos(hm * 7) * 5); x.moveTo(12, 13); x.lineTo(12 + Math.sin(hh * 7 + 2) * 3.2, 13 - Math.cos(hh * 7 + 2) * 3.2); x.stroke();
    x.fillStyle = '#120a06'; x.fillRect(7, 25, 10, 28);
    const sw = Math.sin(t * Math.PI) * 3; x.strokeStyle = '#8a7224'; x.lineWidth = .6; x.beginPath(); x.moveTo(12, 26); x.lineTo(12 + sw, 46); x.stroke(); E2(x, 12 + sw, 47, 2.2, 2.2, '#b09030');
  }, null, 2);
  const CLK = e.addPic([[1, 4]], 'x+', { spr: clockSpr(0), yb: .2, yt: 1.25 });
  // 문 (조금 열려 있다)
  e.addPic([[6, 10]], 'z-', { spr: canvasSprite(32, 56, x => { x.fillStyle = '#3a2416'; x.fillRect(0, 0, 32, 56); x.fillStyle = '#2a180e'; x.fillRect(2, 2, 20, 54); x.fillStyle = '#4a3020'; x.fillRect(4, 6, 16, 18); x.fillRect(4, 30, 16, 22); E2(x, 19, 30, 1.2, 1.2, '#a08a3a'); },
    x => { const gr = x.createLinearGradient(0, 0, 0, 56); gr.addColorStop(0, '#2a0303'); gr.addColorStop(1, '#5a0808'); x.fillStyle = gr; x.fillRect(23, 2, 7, 54); x.fillStyle = '#120202'; x.fillRect(23, 2, 1, 54); }, 2), yb: 0, yt: 1.15 });
  // 옷장 (틈 사이의 눈)
  const wardSpr = (look, shut) => canvasSprite(48, 60, x => {
    x.fillStyle = '#4a3020'; x.fillRect(0, 0, 48, 60); x.fillStyle = '#3a2416'; x.fillRect(2, 2, 21, 56); x.fillRect(25, 2, 21, 56);
    x.fillStyle = '#5a3a26'; x.fillRect(5, 6, 15, 20); x.fillRect(5, 32, 15, 22); x.fillRect(28, 6, 15, 20); x.fillRect(28, 32, 15, 22);
    E2(x, 21, 30, .9, .9, '#a08a3a'); E2(x, 27, 30, .9, .9, '#a08a3a');
    x.fillStyle = '#040303'; x.fillRect(22.6, 2, shut ? 1 : 3, 56);
  }, shut || ch0 ? null : x => { E2(x, 24.1, 24, 1.4, 1, '#a49c8c'); E2(x, 24.1 + look * .6, 24, .6, .7, '#050303'); x.fillStyle = 'rgba(80,8,8,.9)'; x.fillRect(23.4, 24.9, 1.4, .4); }, 2);
  const WARD = e.addPic([[2, 8], [2, 7]], 'x+', { spr: wardSpr(0, false), yb: 0, yt: 1.25 });
  // 빌보드 소품
  const SPx = {
    bed: canvasSprite(48, 26, x => { x.fillStyle = '#2a180e'; x.fillRect(0, 0, 48, 12); x.fillStyle = '#3a2416'; x.fillRect(2, 2, 44, 3); x.fillStyle = '#cfc6b4'; x.fillRect(1, 10, 46, 8); E2(x, 12, 11, 7, 3, '#e4dccb'); x.fillStyle = '#2c4a30'; x.fillRect(1, 14, 46, 8); x.fillStyle = '#2a180e'; x.fillRect(1, 22, 3, 4); x.fillRect(44, 22, 3, 4); }, null, 2),
    lump: canvasSprite(32, 12, x => { E2(x, 16, 12, 15, 11, '#33553a'); E2(x, 10, 6, 6, 4, '#3f6446'); E2(x, 22, 9, 6, 3, '#2a4630'); }, null, 2),
    table: canvasSprite(32, 20, x => { x.fillStyle = '#2a1a10'; x.fillRect(3, 6, 3, 14); x.fillRect(26, 6, 3, 14); x.fillStyle = '#244a2c'; x.fillRect(0, 2, 32, 7); x.fillStyle = '#1a3a20'; for (let i = 0; i < 8; i++) x.fillRect(i * 4, 9, 2, 2); }, null, 2),
    crown: canvasSprite(12, 8, x => { P2(x, [0, 8, 0, 2, 3, 5, 6, 0, 9, 5, 12, 2, 12, 8], '#b08e2a'); }, x => { E2(x, 6, 5.5, 1, 1, '#2aa860'); }, 3),
    candleInv: canvasSprite(8, 24, x => { x.fillStyle = '#d8ccb0'; x.fillRect(2, 2, 4, 13); x.fillStyle = '#b8ac90'; x.fillRect(5, 2, 1, 13); x.fillStyle = '#e8dcc0'; x.fillRect(2, 0, 1, 3); x.fillRect(5, 0, 1, 2); x.fillStyle = '#5a4a30'; x.fillRect(2, 22, 4, 2); },
      x => { P2(x, [4, 22, 6, 17, 4, 14.5, 2, 17], '#ffbe55'); E2(x, 4, 17.2, 1, 1.6, '#fff4c8'); }),
    candleInvOut: canvasSprite(8, 24, x => { x.fillStyle = '#9c927c'; x.fillRect(2, 2, 4, 13); x.fillStyle = '#222'; x.fillRect(4, 15, 1, 2); x.fillStyle = '#5a4a30'; x.fillRect(2, 22, 4, 2); })
  };
  /* ---- 틀린 것 ---- */
  const right = () => ({ x: -Math.sin(cam.yaw), z: Math.cos(cam.yaw) });
  const TG = [
    { id: 'mirror', x: 11.9, z: 6.0, r: .95, line: '거울 속에 내가 없다. 대신… 누군가 서 있다.' },
    { id: 'window', x: 4.0, z: 2.1, r: .8, line: '창밖에 거꾸로 매달린 얼굴이… 웃었다.' },
    { id: 'wardrobe', x: 3.1, z: 8.0, r: .55, line: '옷장 틈의 눈이 천천히 감겼다.' },
    { id: 'candle', get x() { return TB.x + right().x * -.1; }, get z() { return TB.z + right().z * -.1; }, r: .3, line: '불꽃이… 아래로 타고 있었다.' },
    { id: 'bed', x: BED.x, z: BED.z, r: .85, line: '이불 아래의 숨소리가 멈췄다.' }
  ];
  for (const t of TG) { t.f = false; t.ft = 0; }
  const byId = id => TG.find(t => t.id === id);
  const cam = { x: 5.0, z: 8.4, yaw: -1.15, bob: 0 };
  const blot = Array.from({ length: 30 }, () => { const edge = Math.random() < .5; return { x: Math.random() * W, y: edge ? Math.random() * 60 : H - 70 + Math.random() * 70, r: 5 + Math.random() * 18, th: Math.random() }; });
  let phase = 'search', time = TT, bob = 0, stepAcc = 0, idle = 0, moved = false, selN = 0, found = 0, scareT = 0, scareDone = false, winLook = 0, buzzT = 0, flickT = 0, tapX = 0, tapT = 0;
  let leadT = 0, tw = 0, twitT = 0, route = null, ri = 0, portT = 0, clkT = 0, dark = 0, lumpH = 1;
  const inView = (x, z, lim = .55) => { const dx = x - cam.x, dz = z - cam.z, d = Math.hypot(dx, dz); return Math.abs(angDiff(Math.atan2(dz, dx) - cam.yaw)) < lim && e.los(cam.x, cam.z, x - dx / d * .12, z - dz / d * .12); };
  function bfs(tx, tz) { // 방 안 최단 경로 (칸 중심)
    const prev = new Int16Array(N * N).fill(-1), s0 = (cam.z | 0) * N + (cam.x | 0), goal = (tz | 0) * N + (tx | 0), q = [s0]; prev[s0] = s0;
    for (let h = 0; h < q.length; h++) { const k = q[h]; if (k === goal) break; const x = k % N, z = (k / N) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nk = (z + dz) * N + x + dx; if (prev[nk] >= 0 || e.wall[nk] || e.block[nk]) continue; prev[nk] = k; q.push(nk); } }
    const path = []; let k = goal; if (prev[k] < 0) return [{ x: tx, z: tz }];
    while (k !== s0) { path.unshift({ x: k % N + .5, z: ((k / N) | 0) + .5 }); k = prev[k]; }
    path[path.length - 1] = { x: tx, z: tz }; return path;
  }
  function torch() { // 손에 든 손전등 (오른쪽 아래)
    const by = Math.sin(bob) * 2.2 + (phase === 'lead' ? Math.sin(bob * .5) * 1.5 : 0);
    g.save(); g.translate(W * .86, H + 20 + by); g.rotate(-.55); g.scale(1.1, 1.1);
    const gr = g.createLinearGradient(-15, 0, 15, 0); gr.addColorStop(0, '#0c0b0a'); gr.addColorStop(.45, '#3a3632'); gr.addColorStop(1, '#100f0e');
    g.fillStyle = gr; g.fillRect(-11, -70, 22, 90); g.fillRect(-15, -92, 30, 26);
    g.fillStyle = '#4a4642'; g.fillRect(-15, -92, 30, 3); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(-6, -66, 3, 80);
    const lit = e.spot.k > .5; g.fillStyle = lit ? 'rgba(255,250,230,.55)' : 'rgba(60,60,60,.5)'; g.fillRect(-12, -94, 24, 2);
    g.restore();
  }
  const S = {
    game: true, fp: true, touch: 'h3d', act: '지목',
    get noJoy() { return phase !== 'search'; }, get noAct() { return phase !== 'search'; },
    dbg: { cam, TG, get phase() { return phase; }, get time() { return time; }, set time(v) { time = v; }, findAll() { for (const t of TG) if (!t.f) { t.f = true; t.ft = now(); found++; } phase = 'lead'; leadT = 0; } },
    enter() { setFx({ noise: .12, wobble: .5, ca: 1.2 }); drone(.06, .9, 2); say('초록 여왕의 방. 무언가… 틀렸다.', 3); },
    exit() { exitLock(); api.hint(null); },
    select() {
      if (phase !== 'search') return; selN++;
      let best = null, bs = 1e9;
      for (const t of TG) {
        if (t.f) continue;
        const dx = t.x - cam.x, dz = t.z - cam.z, d = Math.hypot(dx, dz); if (d > 6.5) continue;
        const a = Math.abs(angDiff(Math.atan2(dz, dx) - cam.yaw)), lim = Math.atan2(t.r, d) + .04; if (a > lim) continue;
        if (!e.los(cam.x, cam.z, t.x - dx / d * .15, t.z - dz / d * .15)) continue;
        if (a / lim < bs) { bs = a / lim; best = t; }
      }
      if (best) {
        best.f = true; best.ft = now(); found++; fx.glitch = 1; sfx.sting(); sfx.whisper(1.2, clamp(Math.sin(angDiff(Math.atan2(best.z - cam.z, best.x - cam.x) - cam.yaw)), -1, 1) * .8); vib(50);
        say(best.line, 2.8); api.hint(null);
        if (best.id === 'wardrobe') nz(.25, { type: 'lowpass', f: 300, vol: .4, a: .003 });
        if (found >= TG.length) { phase = 'lead'; leadT = 0; exitLock(); drone(.14, .7, 3); }
        return;
      }
      time -= 6; say('아니야.', 1.4); scareT = .55; bigScare();
    },
    key(k) { if (k === ' ' || k === 'Enter' || k === 'x' || k === 'j') this.select(); },
    pointer(t, x) {
      if (phase !== 'search') return; fpPointer(cam, t, x);
      if (TOUCH) return;
      if (t === 'down') { if (document.pointerLockElement === api.cv) this.select(); else { tapX = x; tapT = now(); } }
      else if (t === 'up' && tapT && now() - tapT < .3 && Math.abs(x - tapX) < 8 && this.lockTried) { tapT = 0; this.select(); }
      if (t === 'up') this.lockTried = true;
    },
    update(dt) {
      scareT = Math.max(0, scareT - dt);
      e.flick = .9 + Math.sin(now() * 11) * .04 + Math.sin(now() * 27) * .03;
      const rot = phase === 'search' ? 1 - time / TT : 1;
      // 시계는 멀쩡히 간다
      clkT -= dt; if (clkT <= 0) { clkT = .12; CLK.spr = clockSpr(now()); }
      // 창밖의 얼굴: 오래 볼수록 눈을 뜬다
      const wt = byId('window');
      if (!wt.f) { if (inView(4, 2.1, .5)) winLook += dt; else winLook = Math.max(0, winLook - dt * .5); }
      { const gone = wt.f && now() - wt.ft > 2.2, wo = wt.f ? 1 : clamp((winLook - 1.6) / 1.2, 0, 1), key = gone ? 'g' : (Math.round(wo * 5) / 5).toFixed(1);
        if (key !== WIN_A.key) { WIN_A.key = key; WIN_A.spr = winSpr(!gone, wo); } }
      // 거울 속 여인
      const mt = byId('mirror'); if (mt.f) { const k = now() - mt.ft, fade = clamp((k - 2) / 1.5, 0, 1); if (!MIR.done) { MIR.spr = mirSpr(true, fade); if (fade >= 1) MIR.done = true; } }
      // 옷장 틈의 눈은 나를 따라 본다
      const wd = byId('wardrobe');
      { const lk = wd.f ? 'shut' : (clamp((cam.z - 8) * .6, -1, 1)).toFixed(1); if (lk !== WARD.lk) { WARD.lk = lk; WARD.spr = wardSpr(+lk || 0, wd.f); } }
      // 이불의 숨
      const bd = byId('bed'); lumpH = bd.f ? Math.max(.2, lumpH - dt * .4) : 1 + Math.sin(now() * 2.2) * .28;
      if (!bd.f && !ch0 && Math.hypot(BED.x - cam.x, BED.z - cam.z) < 3 && Math.random() < dt * .6) nz(.9, { type: 'lowpass', f: 380, vol: .05, a: .4 });
      if (phase === 'search') {
        time -= dt;
        const c = fpControls(cam, dt, { speed: 1.8 });
        if (c.moving) { moved = true; e.move(cam, c.vx, c.vz, .22); bob += dt * 6.5; stepAcc += dt; if (stepAcc > .52) { stepAcc = 0; sfx.step(); } }
        cam.bob = Math.sin(bob) * (c.moving ? 1.5 : 0);
        idle = c.moving ? 0 : idle + dt;
        const bat = clamp(time / TT, 0, 1); e.lantern = 4.2 + 2.3 * bat; e.lightMul = 1 - rot * .3;
        e.spot.r = 40 + 24 * bat; flickT -= dt; if (flickT <= 0 && Math.random() < dt * (rot > .6 ? 2.5 : rot > .35 ? .6 : 0)) { flickT = .05 + Math.random() * .25 * rot; sfx.stat && sfx.stat(.03); }
        e.spot.k = flickT > 0 ? (Math.random() < .5 ? .05 : .4) : 1;
        buzzT -= dt; if (buzzT <= 0 && !ch0) { buzzT = 1.6 - rot * 1.1 + Math.random(); osc('sawtooth', 190 + Math.random() * 60, .5 + Math.random() * .5, { vol: .012 + rot * .03, f2: 170 + Math.random() * 80, pan: (Math.random() - .5) * 1.8 }); }
        if (!scareDone && time < TT * .55) { scareDone = true; scareT = .4; bigScare(); say('…누가 있어?', 1.6); }
        if (time < TT * .3 && Math.random() < dt * .4) { fx.glitch = .6; sfx.stat && sfx.stat(.08); }
        if (time <= 0) { api.die('촛불이 꺼졌다. 여왕이 당신을 찾아냈다.', HCh3); return; }
        if (!moved && idle > 5) api.hint(TOUCH ? '◀ 왼쪽 원으로 걷기 · 화면을 끌어 둘러보기 ▶' : '▶ W / ↑  걷기   ·   마우스·← →  둘러보기');
        else if (selN === 0 && this.t > 22) api.hint(TOUCH ? '☞ 이상한 것을 화면 가운데에 두고 「지목」' : '☞ 이상한 것을 화면 가운데에 두고 SPACE / 클릭');
        else api.hint(null);
      } else if (phase === 'lead') {
        leadT += dt; api.hint(null); e.spot.k = 1; e.spot.r = 58;
        if (leadT > .2 && leadT - dt <= .2) setTimeout(() => say('내 몸이 어딘가로 이끈다…', 3.2), 1200);
        if (leadT > 1.6) {
          if (!route) { route = bfs(7.5, 3.7); ri = 0; }
          const wp = route[ri];
          if (wp) {
            const dx = wp.x - cam.x, dz = wp.z - cam.z, d = Math.hypot(dx, dz), want = Math.atan2(dz, dx);
            cam.yaw += angDiff(want - cam.yaw) * Math.min(1, dt * 2.4);
            if (Math.abs(angDiff(want - cam.yaw)) < .6) { const sp = Math.min(d, .8 * dt); cam.x += dx / (d || 1) * sp; cam.z += dz / (d || 1) * sp; bob += dt * 4.5; stepAcc += dt; if (stepAcc > .7) { stepAcc = 0; sfx.step(); } }
            cam.bob = Math.sin(bob) * 1.2;
            if (d < .06) ri++;
          } else {
            cam.bob *= .9; cam.yaw += angDiff(-Math.PI / 2 - cam.yaw) * Math.min(1, dt * 2);
            if (Math.abs(angDiff(-Math.PI / 2 - cam.yaw)) < .015) { cam.yaw = -Math.PI / 2; phase = 'twist'; tw = 0; drone(.22, 1.3, 5); }
          }
        }
      } else if (phase === 'twist') {
        tw += dt;
        const k = clamp((tw - .6) / 6.2, 0, 1);
        twitT = Math.max(0, twitT - dt); if (twitT <= 0 && Math.random() < dt * (1.2 + k * 7)) { twitT = .12 + Math.random() * (.15 + k * .35); if (!ch0) sfx.whisper(.6, (Math.random() - .5) * .8); fx.glitch = Math.max(fx.glitch || 0, .3 + k * .5); }
        portT -= dt; if (portT <= 0) { portT = .05; PORT.spr = portrait(k, twitT); }
        PORT.glow = .35 + Math.random() * .1 * k; e.dyn = [{ x: 7.5, z: 2.4, r: 2, i: .5, c: [.75, .85, .8] }];
        const zk = clamp(tw / 8.2, 0, 1); cam.z = lerp(3.7, 3.0, zk * zk * (3 - 2 * zk)); cam.bob = 0;
        if (!ch0 && Math.random() < dt * (2 + k * 8)) nz(.2, { type: 'bandpass', f: 300 + Math.random() * 500, q: 3, vol: .06 + k * .1, pan: (Math.random() - .5) * .6 });
        if (Math.random() < dt * (1 + k * 3)) sfx.whisper(1, (Math.random() - .5) * 1.6);
        fx.wobble = .5 + k * .8; fx.noise = .12 + k * .1;
        if (tw > 4.6 && tw - dt <= 4.6) say('「 나는 아직… 아름다워? 」', 3);
        if (tw > 8.4 && tw - dt <= 8.4) { bigScare(); dark = 1; }
        if (tw > 10.2) go(Card(T.e3, () => api.startChapter(4), { drone: .03 }));
      }
    },
    draw() {
      const ch = chicken();
      if (dark) { g.fillStyle = '#000'; g.fillRect(-20, -20, W + 40, H + 40); if (Math.random() < .5) { g.fillStyle = 'rgba(200,200,200,.05)'; g.fillRect(0, Math.random() * H, W, 2); } return; }
      const sprites = [], R = right();
      sprites.push({ spr: SPx.table, x: TB.x, z: TB.z, w: 1.1, h: .55, y0: 0 });
      const ct = byId('candle');
      [-.28, -.1, .08].forEach((o, i) => {
        const inv = i === 1, sp = inv ? (ct.f ? SPx.candleInvOut : SPx.candleInv) : SP.candle;
        sprites.push({ spr: sp, x: TB.x + R.x * o - Math.cos(cam.yaw) * .02, z: TB.z + R.z * o - Math.sin(cam.yaw) * .02, w: .08, h: .26, y0: .5 });
      });
      sprites.push({ spr: SPx.crown, x: TB.x + R.x * .3 - Math.cos(cam.yaw) * .02, z: TB.z + R.z * .3 - Math.sin(cam.yaw) * .02, w: .22, h: .14, y0: .53 });
      sprites.push({ spr: SPx.bed, x: BED.x, z: BED.z, w: 2, h: .7, y0: 0 });
      { const dx = cam.x - BED.x, dz = cam.z - BED.z, d = Math.hypot(dx, dz) || 1; sprites.push({ spr: SPx.lump, x: BED.x + dx / d * .06, z: BED.z + dz / d * .06, w: 1.3, h: .26 * lumpH, y0: .3 }); }
      if (phase !== 'twist') e.dyn = ct.f ? [] : [{ x: TB.x, z: TB.z, r: 1.6, i: .25, c: [1, .7, .4] }];
      e.render(cam, sprites);
      if (phase === 'search') {
        const rot = 1 - time / TT;
        if (!ch) for (const b of blot) if (rot > b.th) ell(b.x, b.y, b.r * (.5 + (rot - b.th)), b.r * .7 * (.5 + (rot - b.th)), 'rgba(30,22,8,.45)');
        torch();
      }
      if (phase === 'lead') torch();
      if (phase === 'twist') { const k = clamp((tw - .6) / 6.2, 0, 1); g.fillStyle = `rgba(0,0,0,${k * .15})`; g.fillRect(0, 0, W, H); const v = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 230); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${.4 + k * .5})`); g.fillStyle = v; g.fillRect(0, 0, W, H); }
      if (scareT > 0) scareOverlay(scareT, .55, true);
    }
  };
  return S;
}

/* =========================================================
   하드 최종장 : 이름을 적으면 화면이 빨간 글씨로 가득 찬다
   ========================================================= */
function RedWords(next) {
  const WORDS = chicken() ? ['놀자', '같이 있자', '가지 마', '심심해', '나랑 놀아', '어디 가', '좋아해', '여기 있어'] : ['죽어', '살려줘', '미안해', '구해줘', '나갈래', '꺼내줘', '아파', '왜', '보지 마', '돌아봐', '잊지 마', '너야', '다음은 너'];
  const words = []; let addT = 0, heartT = 0;
  const name = api.playerName() || '';
  return {
    noPause: true,
    enter() { setFx({ noise: .14, wobble: .9, ca: 1.6 }); drone(.12, .7, 1); sfx.stat(.4); api.osd.on = true; },
    update(dt) {
      const t = this.t;
      addT -= dt; heartT -= dt;
      const rate = .3 / (1 + t * 1.6);
      while (addT <= 0) {
        addT += Math.max(.012, rate);
        const w = Math.random() < .08 && name ? name : WORDS[Math.random() * WORDS.length | 0];
        words.push({ w, x: Math.random() * W, y: 14 + Math.random() * (H - 20), s: 10 + Math.random() * (8 + t * 5), r: (Math.random() - .5) * .5, a: 0, born: t });
        if (words.length > 520) words.shift();
        if (Math.random() < .25) nz(.15, { type: 'bandpass', f: 1600 + Math.random() * 1800, q: 5, vol: .05 + t * .012, pan: (Math.random() - .5) * 1.8 });
      }
      if (heartT <= 0) { heartT = Math.max(.28, 1 - t * .1); sfx.heart(); }
      if (t > 2 && Math.random() < dt * 2) sfx.whisper(1, (Math.random() - .5) * 1.8);
      fx.wobble = .9 + t * .35; fx.noise = .14 + t * .02;
      if (t > 1.5 && t - dt <= 1.5) drone(.22, 1.6, 4);
      if (t > 7.6) go((chicken() ? api.CuteJump : api.Jump)(next, 1.4));
    },
    draw() {
      const t = this.t;
      g.fillStyle = chicken() ? '#1a0a12' : '#050202'; g.fillRect(-20, -20, W + 40, H + 40);
      for (const q of words) {
        const age = t - q.born, a = Math.min(1, age * 4);
        g.save(); g.translate(q.x + (Math.random() - .5) * (1 + t * .4), q.y + (Math.random() - .5) * (1 + t * .4)); g.rotate(q.r);
        g.globalAlpha = a * (.6 + Math.random() * .4);
        g.font = `800 ${q.s}px 'Nanum Myeongjo', serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = chicken() ? (q.w === name ? '#ffffff' : '#ff7fae') : (q.w === name ? '#f2ece0' : (Math.random() < .1 ? '#ff2020' : '#b01010'));
        g.fillText(q.w, 0, 0);
        g.restore();
      }
      if (t > 6.2) { g.fillStyle = `rgba(0,0,0,${clamp((t - 6.2) / 1.3, 0, 1) * .9})`; g.fillRect(0, 0, W, H); }
    }
  };
}

/* =========================================================
   최종장 : 당신의 방 — 스탠드 하나뿐인 거실. 리모컨을 찾아 TV를 켜면
   지지직, 웅… 검은 화면. 꺼진 화면 유리에 비친 내 뒤에서 붉은 눈이 아주 천천히.
   ========================================================= */
function LivingRoom(next, opt = {}) {
  buildSprites();
  const HARDM = !!opt.hard, ch0 = chicken();
  const N = 12;
  const FT = [{ col: [44, 34, 26], tex: 'board' }, { col: [52, 30, 30], tex: 'carpet' }];
  const WT = [null, { col: [62, 56, 46], tex: 'paper' }, { col: [40, 30, 22], tex: 'door' }];
  const e = Engine({ N, indoor: true, WT, FT, wallH: 1.35, fogD: 11, fogC: [0, 0, 0], amb: .035, ceilC: [10, 9, 8], lantern: 1.1, lanternC: [.5, .5, .56] });
  e.lanternI = .3;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { const k = z * N + x; if (x < 2 || x > 9 || z < 2 || z > 9) { e.wall[k] = 1; continue; } e.floor[k] = (x >= 3 && x <= 8 && z >= 4 && z <= 8) ? 1 : 0; }
  e.wall[9 * N + 9] = 0; e.wall[10 * N + 9] = 2; // 현관 쪽 문 (닫혀 있다)
  const LAMP = { x: 2.75, z: 7.6 }, TV = { x: 5.6, z: 2.5 }, SOFA = { x: 4.6, z: 7.9 };
  e.block[2 * N + 5] = 1; e.block[2 * N + 6] = 1; e.block[7 * N + 2] = 1; for (const [bx, bz] of [[3, 7], [4, 7], [5, 7], [3, 8], [4, 8], [5, 8]]) e.block[bz * N + bx] = 1;
  const LAMP_L = { x: LAMP.x, z: LAMP.z, r: 4.2, i: 1.7, c: [1, .72, .42] };
  e.lights.push(LAMP_L, { x: 5.6, z: 3.2, r: 1.8, i: .12, c: [.45, .55, 1] });
  e.bake();
  // 액자 (돌아볼 때마다 바뀌지는 않는다 — 그냥 거기 있다)
  e.addPic([[7, 1]], 'z+', { spr: canvasSprite(28, 36, x => { x.fillStyle = '#3a2a1a'; x.fillRect(0, 0, 28, 36); x.fillStyle = '#16120e'; x.fillRect(3, 3, 22, 30); E2(x, 14, 15, 5, 6, '#2a2620'); x.fillStyle = '#221e18'; x.fillRect(8, 22, 12, 11); }, null, 2), yb: .6, yt: 1.1 });
  e.addPic([[1, 4]], 'x+', { spr: canvasSprite(24, 40, x => { x.fillStyle = '#2a2018'; x.fillRect(0, 0, 24, 40); x.fillStyle = '#0c0a08'; x.fillRect(3, 3, 18, 34); for (let i = 0; i < 4; i++) { x.fillStyle = '#1a1612'; x.fillRect(4, 6 + i * 8, 16, 1); } }, null, 2), yb: .3, yt: 1.2 });

  /* ---- 소품 ---- */
  let tvState = 'off', blink = 0;
  const tvSprs = {};
  const tvSpr = st => tvSprs[st] || (tvSprs[st] = canvasSprite(56, 46, x => {
    x.fillStyle = '#1c1a18'; x.fillRect(0, 0, 56, 46); x.fillStyle = '#2a2724'; x.fillRect(1, 1, 54, 2);
    x.fillStyle = '#121110'; x.fillRect(45, 8, 9, 34); E2(x, 49.5, 14, 2.4, 2.4, '#3a3632'); E2(x, 49.5, 22, 2.4, 2.4, '#3a3632');
    x.fillStyle = '#0a0a0a'; x.fillRect(4, 5, 39, 34);
  }, x => {
    x.save(); x.beginPath(); x.roundRect(5, 6, 37, 32, 5); x.clip();
    if (st === 'off') { const gr = x.createRadialGradient(14, 14, 1, 20, 20, 30); gr.addColorStop(0, '#1d1c1b'); gr.addColorStop(1, '#0b0b0b'); x.fillStyle = gr; x.fillRect(0, 0, 56, 46); E2(x, 10, 26, 3, 2, '#2a1c10'); }
    else if (st.startsWith('static')) { for (let yy = 6; yy < 38; yy++) for (let xx = 5; xx < 42; xx++) { const v = Math.random() * 230 | 0; x.fillStyle = `rgb(${v},${v},${v + 10})`; x.fillRect(xx, yy, 1, 1); } }
    else if (st === 'blue') { x.fillStyle = '#0a0d1c'; x.fillRect(0, 0, 56, 46); x.fillStyle = 'rgba(90,100,170,.35)'; for (let yy = 6; yy < 38; yy += 2) x.fillRect(5, yy, 37, 1); }
    else { x.fillStyle = '#030306'; x.fillRect(0, 0, 56, 46); }
    x.restore();
    E2(x, 49.5, 32, 1, 1, st === 'off' ? '#5a1010' : '#ff3030');
  }, 2));
  const cab = canvasSprite(64, 22, x => { x.fillStyle = '#2a1e14'; x.fillRect(0, 0, 64, 22); x.fillStyle = '#20160e'; x.fillRect(3, 5, 27, 15); x.fillRect(34, 5, 27, 15); x.fillStyle = '#3a2a1c'; x.fillRect(0, 0, 64, 2); E2(x, 28, 12, 1, 1, '#6a5a3a'); E2(x, 36, 12, 1, 1, '#6a5a3a'); }, null, 2);
  const lamp = canvasSprite(16, 48, x => { x.fillStyle = '#1a1612'; x.fillRect(7, 14, 2, 30); x.fillRect(3, 44, 10, 3); }, x => { P2(x, [3, 14, 13, 14, 11, 2, 5, 2], ch0 ? '#ffb0d0' : '#f0c070'); P2(x, [4, 13, 12, 13, 10.5, 4, 5.5, 4], ch0 ? '#ffe0f0' : '#ffe2a8'); }, 2);
  const lampOff = canvasSprite(16, 48, x => { x.fillStyle = '#1a1612'; x.fillRect(7, 14, 2, 30); x.fillRect(3, 44, 10, 3); P2(x, [3, 14, 13, 14, 11, 2, 5, 2], '#3a3226'); }, null, 2);
  const sideT = canvasSprite(24, 18, x => { x.fillStyle = '#2a1e14'; x.fillRect(0, 0, 24, 3); x.fillRect(2, 3, 2, 15); x.fillRect(20, 3, 2, 15); }, null, 2);
  const sofa = canvasSprite(64, 26, x => { x.fillStyle = '#3a2422'; x.fillRect(0, 4, 64, 22); x.fillStyle = '#4a2e2a'; x.fillRect(0, 0, 8, 26); x.fillRect(56, 0, 8, 26); x.fillStyle = '#2e1c1a'; x.fillRect(9, 6, 22, 12); x.fillRect(33, 6, 22, 12); }, null, 2);
  const lowT = canvasSprite(40, 12, x => { x.fillStyle = '#2a1e14'; x.fillRect(0, 0, 40, 3); x.fillRect(2, 3, 3, 9); x.fillRect(35, 3, 3, 9); x.fillStyle = '#d8d0c0'; x.fillRect(8, -1, 6, 2); }, null, 2);
  const plant = canvasSprite(20, 40, x => { x.fillStyle = '#2a1a12'; x.fillRect(6, 30, 8, 10); for (let i = 0; i < 9; i++) { x.fillStyle = i % 2 ? '#1a2a16' : '#22341c'; x.fillRect(9 + Math.sin(i * 2) * 7, 6 + i * 2.6, 6, 2); } }, null, 2);
  const remoteS = canvasSprite(12, 5, x => { x.fillStyle = '#161616'; x.fillRect(0, 0, 12, 5); x.fillStyle = '#2a2a2a'; x.fillRect(2, 1, 6, 1); }, x => { E2(x, 10, 2.5, .8, .8, '#ff4040'); }, 3);
  // 방향이 고정된 가구: TV · 받침장 · 소파 (판 여러 장으로 만든 상자)
  const plain = (w, h, col, dark) => canvasSprite(w, h, x => { x.fillStyle = col; x.fillRect(0, 0, w, h); x.fillStyle = dark; x.fillRect(0, 0, w, 1); x.fillRect(0, h - 1, w, 1); for (let i = 3; i < w; i += 6) x.fillRect(i, 2, 1, h - 4); }, null, 2);
  const cabSide = plain(12, 10, '#24190f', '#160f08'), tvSide = plain(12, 18, '#151310', '#0c0b09');
  const sofaBack = canvasSprite(64, 18, x => { x.fillStyle = '#34201e'; x.fillRect(0, 0, 64, 18); x.fillStyle = '#2a1816'; for (let i = 8; i < 64; i += 16) x.fillRect(i, 2, 1, 15); x.fillRect(0, 0, 64, 2); }, null, 2);
  const sofaFront = canvasSprite(64, 18, x => { x.fillStyle = '#3a2422'; x.fillRect(0, 0, 64, 18); x.fillStyle = '#4a2e2a'; x.fillRect(0, 0, 7, 18); x.fillRect(57, 0, 7, 18); x.fillStyle = '#2e1c1a'; x.fillRect(8, 8, 23, 9); x.fillRect(33, 8, 23, 9); x.fillStyle = '#442a26'; x.fillRect(8, 1, 48, 6); }, null, 2);
  const sofaSide = canvasSprite(20, 18, x => { x.fillStyle = '#4a2e2a'; x.fillRect(0, 0, 20, 18); x.fillStyle = '#3a2422'; x.fillRect(0, 0, 20, 3); }, null, 2);
  const TVZ = 2.5, TVX0 = TV.x - .5, TVX1 = TV.x + .5, CBX0 = TV.x - .55, CBX1 = TV.x + .55;
  const box = (x0, z0, x1, z1, yb, yt, front, side, back) => [
    { spr: front, q: { x1: x0, z1, x2: x1, z2: z1, yb, yt, nz: 1 } },
    ...(back ? [{ spr: back, q: { x1: x1, z1: z0, x2: x0, z2: z0, yb, yt, nz: -1 } }] : []),
    { spr: side, q: { x1: x0, z1: z0, x2: x0, z2: z1, yb, yt, nx: -1, sh: .72 } },
    { spr: side, q: { x1: x1, z1: z1, x2: x1, z2: z0, yb, yt, nx: 1, sh: .72 } }
  ];
  const SPOTS = [{ x: 3.35, z: 6.45 }, { x: 3.15, z: 8.6 }, { x: 4.25, z: 6.75 }];
  const REM = SPOTS[Math.random() * SPOTS.length | 0];

  const cam = { x: 7.6, z: 8.6, yaw: -2.42, bob: 0 };
  const SEAT = { x: TV.x, z: 3.62, yaw: -Math.PI / 2 };
  function walkPath(tx, tz) { // 가구를 피해 칸 중심으로 걷는 길
    const prev = new Int16Array(N * N).fill(-1), s0 = (cam.z | 0) * N + (cam.x | 0), goal = (tz | 0) * N + (tx | 0), q = [s0]; prev[s0] = s0;
    for (let h = 0; h < q.length; h++) { const k = q[h]; if (k === goal) break; const x = k % N, z = (k / N) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nk = (z + dz) * N + x + dx; if (prev[nk] >= 0 || e.wall[nk] || e.block[nk]) continue; prev[nk] = k; q.push(nk); } }
    const path = []; let k = goal; if (prev[k] < 0) return [{ x: tx, z: tz }];
    while (k !== s0) { path.unshift({ x: k % N + .5, z: ((k / N) | 0) + .5 }); k = prev[k]; }
    path[path.length - 1] = { x: tx, z: tz }; return path;
  }
  const angDiff_ = a => Math.atan2(Math.sin(a), Math.cos(a));
  let route = null, ri = 0, pitch = 0, phase = 'search', pt = 0, bob = 0, stepAcc = 0, idle = 0, moved = false, got = false, from = null, humT = 0, breathT = 0, heartT = 0, creakT = 6, tapX = 0, tapT = 0, lastHint = 0;
  const T_REF = HARDM ? 4 : 6, T_RAMP = HARDM ? 25 : 40, T_HOLD = 3;

  // TV 크게 (시점 고정 뒤): 화면의 3분의 2
  const TX = 64, TY = 44, TW = 272, TH = 206, SX = TX + 16, SY = TY + 14, SW = TW - 62, SH = TH - 30;
  // 3D TV가 화면에 그려지는 자리 (엔진과 같은 투영)
  const TVW = 1.0, TVH = TVW * TH / TW, TVY0 = .42;
  function tvRect() {
    const dirX = Math.cos(cam.yaw), dirZ = Math.sin(cam.yaw), plX = -dirZ * FOVP, plZ = dirX * FOVP, inv = 1 / (plX * dirZ - dirX * plZ);
    const dx = TV.x - cam.x, dz = TVZ - cam.z, tx = inv * (dirZ * dx - dirX * dz), ty = inv * (-plZ * dx + plX * dz);
    if (ty < .2) return null;
    const scale = H / Math.max(ty, .3), sx = W / 2 * (1 + tx / ty), hor = (H / 2 + (cam.bob || 0)) | 0, bot = hor + (.5 - TVY0) * scale;
    return { x: sx - TVW * scale / 2, y: bot - TVH * scale, w: TVW * scale };
  }
  function drawTV(c, eyeK, mode) { // TX·TY 기준 좌표로 TV 앞면을 그린다 (3D 판 무늬와 가까이서 보는 화면이 똑같도록)
    c.save();
    c.fillStyle = '#17150f'; c.beginPath(); c.roundRect(TX, TY, TW, TH, 10); c.fill();
    c.fillStyle = '#211e18'; c.fillRect(TX + 4, TY + 3, TW - 8, 3);
    c.fillStyle = '#0e0d0b'; c.fillRect(TX + TW - 40, TY + 20, 30, TH - 40);
    for (const yy of [52, 80]) { E2(c, TX + TW - 25, TY + yy, 7, 7, '#2c2924'); E2(c, TX + TW - 25, TY + yy, 2, 6, '#1a1814'); }
    for (let i = 0; i < 6; i++) c.fillRect(TX + TW - 34, TY + 110 + i * 7, 20, 2);
    E2(c, TX + TW - 25, TY + TH - 26, 2, 2, '#ff3a30');
    const sg = c.createLinearGradient(TX, 0, TX + 50, 0); sg.addColorStop(0, `rgba(255,170,90,${.18 * e.lightMul})`); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(TX, TY, 50, TH);
    c.save(); c.beginPath(); c.roundRect(SX, SY, SW, SH, 22); c.clip();
    const bg = c.createRadialGradient(SX + SW * .45, SY + SH * .45, 10, SX + SW / 2, SY + SH / 2, SW * .7); bg.addColorStop(0, '#0c0d13'); bg.addColorStop(1, '#020203'); c.fillStyle = bg; c.fillRect(SX, SY, SW, SH);
    // 웅… 검은 화면이 반복된다 (아주 옅게 깜빡임)
    if (mode === 'static') { for (let i = 0; i < 900; i++) { const v = Math.random() * 230 | 0; c.fillStyle = `rgb(${v},${v},${v + 10})`; c.fillRect(SX + Math.random() * SW, SY + Math.random() * SH, 4, 3); } c.restore(); c.restore(); return; }
    if (mode !== 'off') { const hb = mode === 'blue' ? 1 : .5 + .5 * Math.sin(now() * 2.2); c.fillStyle = `rgba(40,50,90,${.05 + hb * .07})`; c.fillRect(SX, SY, SW, SH); }
    // 비친 스탠드 불빛
    const lx = SX + SW * .2, ly = SY + SH * .34, lm = e.lightMul;
    if (lm > .05) {
      const lg = c.createRadialGradient(lx, ly, 1, lx, ly, 46); lg.addColorStop(0, ch0 ? `rgba(255,170,210,${.4 * lm})` : `rgba(255,190,110,${.4 * lm})`); lg.addColorStop(.3, `rgba(190,110,50,${.12 * lm})`); lg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = lg; c.fillRect(SX, SY, SW, SH);
      P2(c, [lx - 6, ly + 6, lx + 6, ly + 6, lx + 4, ly - 3, lx - 4, ly - 3], `rgba(255,214,150,${.45 * lm})`);
    }
    // 비친 소파와 내 뒷모습
    c.fillStyle = 'rgba(14,9,9,.95)'; c.fillRect(SX, SY + SH * .74, SW, SH); c.fillRect(SX + 6, SY + SH * .66, 16, SH);
    const mx = SX + SW * .5, my = SY + SH * .62;
    E2(c, mx, my, 21, 26, '#020203');
    c.fillStyle = '#020203'; c.beginPath(); c.moveTo(mx - 56, SY + SH); c.quadraticCurveTo(mx - 48, my + 30, mx, my + 24); c.quadraticCurveTo(mx + 48, my + 30, mx + 56, SY + SH); c.closePath(); c.fill();
    c.strokeStyle = `rgba(255,170,100,${.2 * lm})`; c.lineWidth = 1; c.beginPath(); c.ellipse(mx, my, 21, 26, 0, Math.PI * .75, Math.PI * 1.3); c.stroke();
    // 내 오른쪽 어깨 너머의 눈
    if (eyeK > 0) {
      const ex = mx + 46, ey = my - 18, col = ch0 ? [255, 150, 200] : [255, 50, 36];
      for (const dx of [-6, 6]) {
        const r = 3 + eyeK * 9, gl = c.createRadialGradient(ex + dx, ey, 0, ex + dx, ey, r);
        gl.addColorStop(0, `rgba(${col[0]},${col[1] + eyeK * 40},${col[2] + eyeK * 20},${.12 + eyeK * .6})`); gl.addColorStop(1, 'rgba(120,0,0,0)');
        c.fillStyle = gl; c.fillRect(ex + dx - r, ey - r, r * 2, r * 2);
        E2(c, ex + dx, ey, 1.4 + eyeK * .6, .8 + eyeK * .5, `rgba(${col[0]},${col[1] + eyeK * 120},${col[2] + eyeK * 80},${.2 + eyeK * .8})`);
      }
      if (eyeK > .85) { c.strokeStyle = `rgba(120,10,10,${(eyeK - .85) / .15 * .25})`; c.lineWidth = 1; c.beginPath(); c.ellipse(ex, ey + 6, 22, 26, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    }
    P2(c, [SX + 14, SY + 8, SX + 70, SY + 8, SX + 24, SY + 70, SX + 8, SY + 70], 'rgba(200,210,255,.04)');
    c.fillStyle = 'rgba(0,0,0,.22)'; for (let yy = SY; yy < SY + SH; yy += 2) c.fillRect(SX, yy, SW, 1);
    const vg = c.createRadialGradient(SX + SW / 2, SY + SH / 2, SW * .25, SX + SW / 2, SY + SH / 2, SW * .62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.8)'); c.fillStyle = vg; c.fillRect(SX, SY, SW, SH);
    c.restore();
    c.strokeStyle = '#0a0907'; c.lineWidth = 3; c.beginPath(); c.roundRect(SX, SY, SW, SH, 22); c.stroke();
    c.restore();
  }
  let tvTex = null, tvTexKey = '', tvTexT = 0;
  function tvTexture(mode) { // 3D TV 앞면 (스스로 빛나게 — 어두운 방에서도 TV는 보인다)
    const key = mode + (mode === 'static' ? (now() * 10 | 0) : '');
    if (key !== tvTexKey || (mode !== 'static' && now() - tvTexT > .25)) {
      tvTexKey = key; tvTexT = now();
      tvTex = canvasSprite(TW / 2 | 0, TH / 2 | 0, () => {}, x => { x.scale(.5, .5); x.translate(-TX, -TY); drawTV(x, 0, mode); });
    }
    return tvTex;
  }
  function bigTV(eyeK, mode, alpha = 1) {
    const rc = tvRect(); if (!rc || alpha <= 0) return;
    const k = rc.w / TW;
    g.save(); g.globalAlpha = alpha; g.translate(rc.x - TX * k, rc.y - TY * k); g.scale(k, k);
    drawTV(g, eyeK, mode);
    g.restore();
  }
  // 점프스케어: 멀티의 꿈 — 새까만 둥근 머리, 붉은 눈, 귀까지 찢어진 웃음
  const px = document.createElement('canvas'); px.width = 160; px.height = 120; const p = px.getContext('2d');
  function scareDraw(k) {
    p.clearRect(0, 0, 160, 120);
    const flash = (now() * 18 | 0) % 4 === 0;
    p.fillStyle = flash ? '#e8e0d0' : '#1a0000'; p.fillRect(0, 0, 160, 120);
    const bgr = p.createRadialGradient(80, 60, 20, 80, 60, 100); bgr.addColorStop(0, 'rgba(120,0,0,.2)'); bgr.addColorStop(1, 'rgba(60,0,0,.9)'); p.fillStyle = bgr; p.fillRect(0, 0, 160, 120);
    p.save(); p.translate(82 + (Math.random() - .5) * 3, 64 + (Math.random() - .5) * 3); p.rotate(-.22 + Math.sin(now() * 30) * .03); const sc = .9 + k * .5; p.scale(sc, sc);
    E2(p, 0, 0, 62, 60, '#050406');
    p.strokeStyle = 'rgba(160,0,0,.6)'; p.lineWidth = 2; p.beginPath(); p.ellipse(0, 0, 62, 60, 0, Math.PI * 1.05, Math.PI * 1.6); p.stroke();
    const eye = (x, y, r) => { const gl = p.createRadialGradient(x, y, 0, x, y, r * 2.2); gl.addColorStop(0, 'rgba(255,40,30,.8)'); gl.addColorStop(1, 'rgba(255,0,0,0)'); p.fillStyle = gl; p.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4); E2(p, x, y, r, r * .95, '#ff2418'); E2(p, x, y, r * .7, r * .65, '#ff6a40'); E2(p, x + 1, y, 1.2, 1.2, '#fff'); };
    eye(-22, -18, 9); eye(21, -15, 12);
    const op = 1 + Math.sin(now() * 40) * .08;
    p.beginPath(); p.moveTo(-50, 6); p.bezierCurveTo(-30, 52 * op, 34, 56 * op, 54, 2); p.bezierCurveTo(30, 22, -26, 24, -50, 6); p.fillStyle = '#5a0610'; p.fill();
    p.beginPath(); p.moveTo(-44, 10); p.bezierCurveTo(-26, 46 * op, 30, 50 * op, 48, 7); p.bezierCurveTo(26, 25, -22, 27, -44, 10); p.fillStyle = '#0a0002'; p.fill();
    p.fillStyle = '#e6dcc4';
    for (let i = 0; i < 17; i++) { const t = i / 16, x = -44 + t * 92, top = 10 + Math.sin(t * Math.PI) * 15 - t * 3, bot = 10 + Math.sin(t * Math.PI) * 36 * op - t * 3; const h1 = 4 + ((i * 7) % 5), h2 = 4 + ((i * 3) % 6); p.beginPath(); p.moveTo(x, top); p.lineTo(x + 3, top); p.lineTo(x + 1.5, top + h1); p.fill(); p.beginPath(); p.moveTo(x + 1, bot); p.lineTo(x + 4, bot); p.lineTo(x + 2.5, bot - h2); p.fill(); }
    p.strokeStyle = '#3a0008'; p.lineWidth = 1.2; p.beginPath(); p.moveTo(-50, 6); p.lineTo(-58, -2); p.moveTo(54, 2); p.lineTo(60, -8); p.stroke();
    p.fillStyle = '#4a0008'; p.fillRect(-6, 46, 2, 10 + k * 10); p.fillRect(12, 47, 2, 14 + k * 12);
    p.restore();
    for (const sd of [-1, 1]) { p.save(); p.translate(sd < 0 ? 0 : 160, 100 - k * 10); p.scale(sd, 1); p.fillStyle = '#4a423e'; for (let i = 0; i < 4; i++) { p.save(); p.rotate(-.9 + i * .18); p.fillRect(4, -4, 34 + i * 3 + k * 10, 5); p.restore(); } E2(p, 6, 0, 14, 12, '#3a3430'); p.restore(); }
    g.save(); g.imageSmoothingEnabled = false;
    const s = 1.1, w = W * s, h = H * s;
    g.drawImage(px, (W - w) / 2 + (Math.random() - .5) * 12, (H - h) / 2 + (Math.random() - .5) * 12, w, h);
    g.restore();
  }
  function hum() { humT -= 1; if (ch0) return; osc('sine', 58, 1.4, { vol: .09, a: .3 }); osc('sine', 116.5, 1.4, { vol: .03, a: .3 }); }
  function select() {
    if (phase === 'search') {
      const dx = REM.x - cam.x, dz = REM.z - cam.z, d = Math.hypot(dx, dz);
      const a = Math.abs(angDiff_(Math.atan2(dz, dx) - cam.yaw));
      if (d < 2.1 && a < Math.atan2(.35, d) + .12 && e.los(cam.x, cam.z, REM.x - dx / d * .12, REM.z - dz / d * .12)) {
        got = true; phase = 'remote'; pt = 0; sfx.clunk(); vib(30); api.hint(null);
        say('…TV를 켜자.', 2.4);
      } else if (d < 2.4 && a < .6) say('…여기도 아니야.', 1.2);
    } else if (phase === 'remote') {
      const a = Math.abs(angDiff_(Math.atan2(TV.z - cam.z, TV.x - cam.x) - cam.yaw));
      if (a > .55) { say('TV 쪽을 보고 눌러야 한다.', 1.4); return; }
      phase = 'static'; pt = 0; api.hint(null); exitLock(); sfx.clunk(); sfx.stat(.8);
    }
  }
  return {
    game: true, fp: true, touch: 'h3d',
    get act() { return phase === 'remote' ? '켜기' : '줍기'; },
    get noJoy() { return phase !== 'search' && phase !== 'remote'; }, get noAct() { return phase !== 'search' && phase !== 'remote'; },
    dbg: { cam, get phase() { return phase; }, set phase(v) { phase = v; pt = 0; }, REM },
    enter() { setFx({ noise: .12, wobble: .4, ca: 1 }); drone(.04, .6, 3); if (HARDM) e.lights[0].i = 1.5; },
    exit() { exitLock(); api.hint(null); },
    key(k) { if (k === ' ' || k === 'Enter' || k === 'x' || k === 'j') select(); },
    pointer(t, x) {
      if (phase !== 'search' && phase !== 'remote') return; fpPointer(cam, t, x);
      if (TOUCH) return;
      if (t === 'down') { if (document.pointerLockElement === api.cv) select(); else { tapX = x; tapT = now(); } }
      else if (t === 'up' && tapT && now() - tapT < .3 && Math.abs(x - tapX) < 8) { tapT = 0; select(); }
    },
    update(dt) {
      pt += dt;
      // 하드: 스탠드가 불안하게 깜빡인다
      e.flick = HARDM && phase !== 'dark' ? (Math.random() < dt * 1.5 ? .25 : .92 + Math.sin(now() * 13) * .05) : 1;
      if (phase === 'search' || phase === 'remote') {
        const c = fpControls(cam, dt, { speed: 1.6 });
        if (c.moving) { moved = true; e.move(cam, c.vx, c.vz, .22); bob += dt * 6.5; stepAcc += dt; if (stepAcc > .55) { stepAcc = 0; sfx.step(); } }
        cam.bob = Math.sin(bob) * (c.moving ? 1.4 : 0);
        idle = c.moving ? 0 : idle + dt;
        creakT -= dt; if (creakT <= 0 && !ch0) { creakT = 7 + Math.random() * 9; nz(.5, { type: 'bandpass', f: 300 + Math.random() * 300, q: 6, vol: .05, a: .1, pan: (Math.random() - .5) * 1.8 }); }
        let h = null;
        if (phase === 'search') {
          if (!moved && this.t > 4) h = TOUCH ? '◀ 왼쪽 원으로 걷기 · 화면을 끌어 둘러보기 ▶' : '▶ W / ↑  걷기   ·   마우스·← →  둘러보기';
          else if (this.t > 26) h = TOUCH ? '☞ 스탠드 불빛 근처 · 리모컨을 화면 가운데에 두고 「줍기」' : '☞ 스탠드 불빛 근처 · 리모컨을 가운데에 두고 SPACE / 클릭';
          if (this.t > 1.5 && this.t - dt <= 1.5) say('…리모컨이 어디 있지.', 3);
        } else if (pt > 3) h = TOUCH ? '☞ TV를 보고 「켜기」' : '☞ TV를 보고 SPACE / 클릭';
        if (h !== lastHint) { lastHint = h; api.hint(h); }
      } else if (phase === 'static') {
        tvState = 'static' + ((pt * 12 | 0) % 3);
        if (Math.random() < dt * 6) sfx.stat(.12);
        e.dyn = [{ x: TV.x, z: TV.z + .7, r: 3.4, i: .4 + Math.random() * .25, c: [.7, .8, 1] }];
        if (pt > 2.6) { phase = 'hum'; pt = 0; humT = 0; }
      } else if (phase === 'hum') {
        blink = (pt * 1.1 | 0) % 2; tvState = blink ? 'blue' : 'black';
        e.dyn = blink ? [{ x: TV.x, z: TV.z + .7, r: 2.4, i: .12, c: [.4, .5, .9] }] : [];
        humT += dt; if (humT >= 1) hum();
        if (pt > 2.2) { phase = 'move'; pt = 0; route = walkPath(SEAT.x, SEAT.z); ri = 0; pitch = 0; }
      } else if (phase === 'move') {
        // 터벅터벅 TV 앞까지 걸어가서 선다
        blink = (pt * 1.1 | 0) % 2; tvState = blink ? 'blue' : 'black';
        e.dyn = [{ x: TV.x, z: TV.z + .7, r: 2.6, i: blink ? .14 : .08, c: [.4, .5, .9] }];
        humT += dt; if (humT >= 1) hum();
        const wp = route[ri];
        if (wp) {
          // 눈은 TV에서 떼지 않은 채, 가구를 피해 걸어간다
          const dx = wp.x - cam.x, dz = wp.z - cam.z, d = Math.hypot(dx, dz), want = Math.atan2(TV.z - cam.z, TV.x - cam.x);
          cam.yaw += angDiff_(want - cam.yaw) * Math.min(1, dt * 1.6);
          if (pt > .8) { const sp = Math.min(d, .7 * dt); cam.x += dx / (d || 1) * sp; cam.z += dz / (d || 1) * sp; bob += dt * 4.2; stepAcc += dt; if (stepAcc > .75) { stepAcc = 0; sfx.step(); } }
          cam.bob = Math.sin(bob) * 1.6;
          if (d < .05) ri++;
        } else {
          // 멈춰 서서 TV를 바라본다 (고개를 살짝 들어 화면을 가운데로)
          cam.yaw += angDiff_(SEAT.yaw - cam.yaw) * Math.min(1, dt * 1.5);
          const rc = tvRect(), want = rc ? H / 2 - (rc.y + rc.w * TH / TW / 2) + (cam.bob || 0) : 0;
          pitch += (want - pitch) * Math.min(1, dt * 1.2); cam.bob = pitch;
          if (Math.abs(angDiff_(SEAT.yaw - cam.yaw)) < .01 && Math.abs(want - pitch) < .6) { phase = 'cine'; pt = 0; }
        }
      } else if (phase === 'cine') {
        tvState = 'black';
        // TV 둘레가 어렴풋이 보이게: 화면의 푸른 기운 + 왼쪽에서 번지는 스탠드 빛
        e.dyn = [{ x: TV.x, z: TV.z + .7, r: 2.6, i: .1, c: [.4, .5, .9] }];
        const u = clamp((pt - T_REF) / T_RAMP, 0, 1);
        humT += dt; if (humT >= 1 && u < .97) hum();
        if (u > .2 && !ch0) { breathT -= dt; if (breathT <= 0) { breathT = 3.2 - u * 1.8; nz(1.1, { type: 'bandpass', f: 480, q: .9, vol: .04 + u * .12, a: .5, pan: .85 }); } }
        if (u > .55) { heartT -= dt; if (heartT <= 0) { heartT = 1.2 - u * .55; osc('sine', 55, .16, { vol: .12 + u * .2, f2: 40 }); } }
        if (pt > T_REF + T_RAMP && pt - dt <= T_REF + T_RAMP) drone(0, 1, .4); // 정적
        if (pt > T_REF + T_RAMP + T_HOLD) {
          if (ch0) { go(api.CuteJump(next, 1.3)); return; }
          phase = 'scare'; pt = 0; bigScare(); sfx.screech(); osc('sawtooth', 90, 1.4, { vol: .35, f2: 40, a: .003 }); fx.shake = api.reduced ? 3 : 16;
        }
      } else if (phase === 'scare') {
        fx.glitch = 1; fx.shake = Math.max(fx.shake || 0, api.reduced ? 2 : 10);
        if (pt > 1.5) { phase = 'dark'; pt = 0; drone(0, 1, .1); }
      } else if (phase === 'dark') {
        if (pt > .8 && !this.done) { this.done = true; next(); }
      }
    },
    draw() {
      if (phase === 'scare') { scareDraw(clamp(pt / 1.5, 0, 1)); return; }
      if (phase === 'dark') { g.fillStyle = '#000'; g.fillRect(-20, -20, W + 40, H + 40); return; }
      if (phase === 'search' || phase === 'remote') e.dyn = [];
      const sprites = [
        ...box(CBX0, 2.02, CBX1, TVZ, 0, TVY0, cab, cabSide),
        ...box(TVX0, 2.06, TVX1, TVZ, TVY0, TVY0 + TVH, tvTexture(phase === 'static' ? 'static' : tvState === 'off' ? 'off' : tvState), tvSide),
        { spr: sideT, x: LAMP.x, z: LAMP.z, w: .5, h: .42, y0: 0 },
        { spr: e.flick < .5 ? lampOff : lamp, x: LAMP.x, z: LAMP.z, w: .26, h: .75, y0: .42 },
        ...box(SOFA.x - 1.05, SOFA.z - .3, SOFA.x + 1.05, SOFA.z + .3, 0, .58, sofaBack, sofaSide, sofaFront),
        { spr: lowT, x: 5.4, z: 5.6, w: 1.1, h: .3, y0: 0 },
        { spr: plant, x: 8.6, z: 2.5, w: .45, h: .85, y0: 0 }
      ];
      if (!got) sprites.push({ spr: remoteS, x: REM.x, z: REM.z, w: .24, h: .07, y0: 0 });
      e.render(cam, sprites);
      if (phase === 'remote' || phase === 'static' || phase === 'hum' || (phase === 'move' && pt < 1.2)) { // 손에 든 리모컨
        g.save(); g.translate(W * .8, H + 6 + Math.sin(bob) * 2); g.rotate(-.35);
        ell(6, -6, 26, 16, '#4a3a30');
        g.fillStyle = '#121212'; g.fillRect(-14, -78, 26, 74); g.fillStyle = '#2a2a2a'; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.fillRect(-10 + c * 7, -62 + r * 9, 4, 4);
        g.fillStyle = phase === 'remote' ? '#c02020' : '#ff4040'; g.fillRect(-9, -74, 5, 4);
        g.restore();
      }
      if (phase === 'cine') { // 정면에 멈춰 선 뒤에야 화면 유리에 비친 것이 보이기 시작한다
        const u = clamp((pt - T_REF) / T_RAMP, 0, 1);
        bigTV(Math.pow(u, 2.2), 'black', clamp(pt / 2, 0, 1));
      }
    }
  };
}

return { HCh1, HCh2, HCh3, HCh4, LivingRoom, TapeScene, RedWords, Engine, buildSprites, canvasSprite, fpControls, fpPointer, exitLock, scareOverlay, bigScare, SP, rng, E2, P2, ghostOn };
};
})();
