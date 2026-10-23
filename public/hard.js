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
    lantern: o.lantern == null ? 3.2 : o.lantern, lanternC: o.lanternC || [1, .86, .66], decals: [], stars: null
  };
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
    if (cam && e.lantern > 0) { const d = Math.hypot(x - cam.x, z - cam.z); if (d < e.lantern) { const k = 1 - d / e.lantern, v = k * k * .9; r += v * e.lanternC[0]; gg += v * e.lanternC[1]; b += v * e.lanternC[2]; } }
    for (const L of e.dyn) { const d = Math.hypot(x - L.x, z - L.z); if (d < L.r) { const k = 1 - d / L.r, v = k * k * L.i; r += v * L.c[0]; gg += v * L.c[1]; b += v * L.c[2]; } }
    return [r, gg, b];
  };

  // 화면 그리기. sprites: [{spr,x,z,w,h,y0,glow,tint,shake}]
  e.render = (cam, sprites) => {
    const pix = e.pix, zbuf = e.zbuf, zcol = e.zcol, fogD = e.fogD, fogC = e.fogC, fogS = 1;
    const dirX = Math.cos(cam.yaw), dirZ = Math.sin(cam.yaw), plX = -dirZ * FOVP, plZ = dirX * FOVP;
    const hor = (H / 2 + (cam.bob || 0)) | 0;
    const fogT = d => { const t = clamp((d - fogS) / (fogD - fogS), 0, 1); return t * t * (3 - 2 * t); };
    const LM = e.lightMul * e.flick, lmR = e.lmR, lmG = e.lmG, lmB = e.lmB, amb = e.amb, lan = e.lantern, lc = e.lanternC, dyn = e.dyn;
    const camX = cam.x, camZ = cam.z;
    const litAt = (x, z, out) => {
      let r = amb, gg = amb, b = amb;
      const lx = (x * LR) | 0, lz = (z * LR) | 0;
      if (lx >= 0 && lz >= 0 && lx < LN && lz < LN) { const i = lz * LN + lx; r += lmR[i] * LM; gg += lmG[i] * LM; b += lmB[i] * LM; }
      if (lan > 0) { const dx = x - camX, dz = z - camZ, d2 = dx * dx + dz * dz; if (d2 < lan * lan) { const k = 1 - Math.sqrt(d2) / lan, v = k * k * .9; r += v * lc[0]; gg += v * lc[1]; b += v * lc[2]; } }
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
        const lr = lt[0] * m, lg = lt[1] * m, lb = lt[2] * m;
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
      if (Wd.emis) { const kk = .4 * kf + .6; for (let y = y0; y <= y1; y++) { const vh = (bot - y) / lh, m = .85 + .15 * Math.sin(vh * 9 + now() * 3) + (hash(x, y) & 15) / 255; pix[y * W + x] = pack((base[0] * m * kk) | 0, (base[1] * m * kk) | 0, (base[2] * m * kk) | 0); } continue; }
      const patch = hash(mx * 3 + 1, mz * 7 + 3);
      for (let y = y0; y <= y1; y++) {
        const vh = (bot - y) / lh;
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
    for (const s of sprites) { const [tx, ty] = proj(s.x, s.z); if (ty > .12 && ty < fogD + 2) list.push({ s, tx, ty }); }
    list.sort((a, b) => b.ty - a.ty);
    for (const { s, tx, ty } of list) {
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
          if (spr.e[k]) { pix[y * W + x] = pack(r, gg, b); continue; }
          if (tint) { r = lerp(r, tint[0], tint[3]); gg = lerp(gg, tint[1], tint[3]); b = lerp(b, tint[2], tint[3]); }
          pix[y * W + x] = pack((r * lr * kf + fogC[0] * ft) | 0, (gg * lg * kf + fogC[1] * ft) | 0, (b * lb * kf + fogC[2] * ft) | 0);
        }
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
  if (document.pointerLockElement === api.cv) lockedLook += ev.movementX * .0028;
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
  cam.yaw += turn * 2.4 * dt + lockedLook; lockedLook = 0;
  if (o.lock) { f = 0; s = 0; }
  const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
  const dirX = Math.cos(cam.yaw), dirZ = Math.sin(cam.yaw);
  const vx = (dirX * f - dirZ * s) * sp * dt, vz = (dirZ * f + dirX * s) * sp * dt;
  return { vx, vz, moving: Math.hypot(f, s) > .15, turned: turn !== 0 };
}
// 드래그로 시점 (터치 · 잠기지 않은 마우스)
function fpPointer(cam, t, x) {
  if (t === 'down') { lastMX = x; if (!TOUCH && document.pointerLockElement !== api.cv && api.cv.requestPointerLock) { try { const r = api.cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} } }
  else if (t === 'move' && ptr.down && lastMX != null && document.pointerLockElement !== api.cv) { cam.yaw += (x - lastMX) / W * (TOUCH ? 3.4 : 2.6); lastMX = x; }
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
  const FT = [{ col: [26, 30, 20] }, { col: [70, 54, 38] }, { col: [92, 12, 12], tex: 'blood' }, { col: [30, 34, 24] }];
  const e = Engine({ N, WT: [null, { col: [30, 40, 26], tex: 'hedge', h: 2.6 }], FT, fogD: 9.5, fogC: [5, 6, 8], amb: .24, lantern: 3, lanternC: [.75, .72, .68] });
  // 길: 휘어지며 숲을 가로지른다
  const path = [];
  { let x = 8, z = N - 8, a = -Math.PI / 2 + .3, len = 0;
    path.push({ x, z });
    while (len < 118) {
      const tx = N - 10, tz = 10, want = Math.atan2(tz - z, tx - x);
      a += angDiff(want - a) * .06 + (R() - .5) * .5;
      if (x < 7) a += .2; if (x > N - 7) a -= .2; if (z < 7) a += .2; if (z > N - 7) a -= .2;
      x += Math.cos(a) * 1; z += Math.sin(a) * 1; x = clamp(x, 5, N - 5); z = clamp(z, 5, N - 5); len++;
      path.push({ x, z });
      if (Math.hypot(tx - x, tz - z) < 2) break;
    } }
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
  for (let i = 10; i < PL - 6; i += 9 + (R() * 3 | 0)) { const p = path[i]; foes.push({ x: p.x + (R() - .5) * .4, z: p.z + (R() - .5) * .4, alive: true, fall: 0, i, mode: 'stand', said: false, sp: .7 }); }
  // 숲에서 튀어나오는 것 (갑툭튀)
  const ambush = [Math.floor(PL * .3), Math.floor(PL * .55), Math.floor(PL * .78)].map(i => ({ i, done: false }));
  const LINES = ['…길을 비켜줄게.', '아파.', '왜 베었어?', '우리도 앨리스였어.', '촛불을 따라가.', '길이 점점 빨개지네.', '벗어나면 안 돼.', '너도 곧 여기 서게 될 거야.', '돌아갈 길은 없어.', '…안녕, 나.', '거의 다 왔어.', '끝까지 가.', '…'];
  const cam = { x: path[0].x, z: path[0].z, yaw: Math.atan2(path[3].z - path[0].z, path[3].x - path[0].x), bob: 0 };
  let prog = 0, slashT = 9, flash = 0, phase = 'walk', endT = 0, bob = 0, stepAcc = 0, warnT = 0, offT = 0, horde = null, warned = false, kills = 0, scareT = 0, idleT = 0, slashed = false, moved = false, hintSaid = false, firstSeen = false;
  const drops = [];
  const S = {
    game: true, fp: true, touch: 'h3d', act: '베기',
    dbg: { cam, path, get prog() { return prog; }, set prog(v) { prog = v; }, get kills() { return kills; }, get phase() { return phase; }, foes },
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
          if (fd < 6.5 && f.mode === 'stand') { f.mode = 'come'; sfx.whisper(1.4, 0); }
          if (f.mode === 'come' || f.mode === 'rush') {
            const sp = (f.mode === 'rush' ? 2.6 : f.sp + kills * .02) * dt;
            const ox = f.x, oz = f.z; const p = { x: f.x, z: f.z }; e.move(p, (cam.x - f.x) / fd * sp, (cam.z - f.z) / fd * sp, .2); f.x = p.x; f.z = p.z; if (ox === f.x && oz === f.z && fd > 1) { f.x += (cam.x - f.x) / fd * sp; f.z += (cam.z - f.z) / fd * sp; }
          }
          if (fd < .72) { api.die(f.mode === 'rush' ? '숲에서 무언가가 튀어나왔다.' : '그것이 당신을 붙잡았다.', HCh1); return; }
        }
        for (const a of ambush) {
          if (a.done || prog < a.i) continue;
          a.done = true;
          const p = path[Math.min(PL, a.i + 3)], q = path[Math.min(PL, a.i + 4)], ang = Math.atan2(q.z - p.z, q.x - p.x), side = Math.random() < .5 ? 1 : -1;
          const f = { x: p.x - Math.sin(ang) * 2.3 * side, z: p.z + Math.cos(ang) * 2.3 * side, alive: true, fall: 0, i: 0, mode: 'rush', said: true, sp: 2.6 };
          foes.push(f); bigScare(); scareT = .12; say('옆에서—!', 1.4);
        }
        // 힌트: 막혔을 때만
        if (!moved && idleT > 4.5) api.hint(TOUCH ? '◀ 왼쪽 원으로 걷기 ▶' : '▶ W / ↑  걷기   ·   마우스·← →  둘러보기');
        else if (!slashed && foes.some(f => f.alive && Math.hypot(f.x - cam.x, f.z - cam.z) < 3.2)) api.hint(TOUCH ? '● 베기 버튼' : '● SPACE / 클릭  베기');
        else if (wv > .2) api.hint('촛불이 있는 곳으로 돌아가');
        else api.hint(null);
        if (prog >= PL - 2 && Math.hypot(cam.x - path[PL].x, cam.z - path[PL].z) < 1.6) { phase = 'end'; endT = 0; api.hint(null); drone(.22, 1.4, 6); exitLock(); }
      } else if (phase === 'horde') {
        horde.t += dt;
        for (const f of horde.list) { const fd = Math.hypot(f.x - cam.x, f.z - cam.z); if (fd > .6) { f.x += (cam.x - f.x) / fd * f.sp * dt; f.z += (cam.z - f.z) / fd * f.sp * dt; } }
        e.lightMul = Math.max(0, e.lightMul - dt * 1.5);
        if (horde.t > 1.15 && !horde.dead) { horde.dead = true; api.die('촛불 길을 벗어났다.\n숲이 당신을 삼켰다.', HCh1); }
      } else {
        endT += dt;
        for (const t of e.trees) { const d = Math.hypot(t.x - cam.x, t.z - cam.z); if (d < 6 && d > .8) { t.x += (cam.x - t.x) * dt * .06; t.z += (cam.z - t.z) * dt * .06; } }
        e.indexTrees();
        e.lightMul = Math.max(.2, 1 - endT * .08);
        if (endT > .4 && endT - dt <= .4) say('길이 끝났다. 촛불이 하나씩 꺼진다.', 2.8);
        if (endT > 3.4 && endT - dt <= 3.4) { say('나무들이 다가온다.', 2.6); sfx.whisper(2, -.6); sfx.whisper(2, .6); }
        if (endT > 6.4 && endT - dt <= 6.4) say('돌아갈 길은… 온통 붉었다.', 3);
        cam.yaw += dt * .25;
        fx.wobble = .6 + endT * .3;
        if (endT > 10) go(Card(T.e1, () => api.startChapter(2), { drone: .04 }));
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
      for (const c of candles) sprites.push({ spr: (c.out || (phase === 'end' && c.i < prog - (endT * 6))) ? SP.candleOut : SP.candle, x: c.x, z: c.z, w: .12, h: .36, y0: 0 });
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
      if (scareT > 0) scareOverlay(scareT, .22, true);
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
  const e = Engine({ N, indoor: true, WT, FT, wallH: 1.3, fogD: 15, fogC: [4, 4, 9], amb: .34, ceilC: [24, 22, 46], lantern: 3.4, lanternC: [.7, .72, .85] });
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
  e.lights.push({ x: 20, z: 7.2, r: 6.5, i: 1.5, c: [.75, .82, 1] });
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
  const inView = m => { const dx = m.x - cam.x, dz = m.z - cam.z, d = Math.hypot(dx, dz); if (d > 13) return false; const rel = Math.abs(angDiff(Math.atan2(dz, dx) - cam.yaw)); return rel < .66 && e.los(cam.x, cam.z, m.x, m.z); };
  const NOTES = [392, 466.16, 523.25, 622.25, 698.46], LENS = [5, 6, 7];
  const seq = []; for (let i = 0; i < 7; i++) { let n; do { n = Math.random() * 5 | 0; } while (i > 0 && n === seq[i - 1]); seq.push(n); }
  const KW = 60, KG = 10, KX = (W - (5 * KW + 4 * KG)) / 2, KY = TOUCH ? 206 : 222, KH = TOUCH ? 52 : 34;
  let phase = 'walk', bob = 0, stepAcc = 0, noticed = false, idle = 0, turned = false, round = 0, pp = 'pause', pt = -.4, idx = 0, miss = 0, lit = -1, litT = 0, rear = 0, ft = 0, shot = false, white = 0, autoT = 0, scareT = 0, lastLook = 0;
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
      if (phase !== 'perf' || pp !== 'input') return; play(n);
      if (seq[idx] === n) {
        idx++;
        if (idx >= LENS[round]) { round++; if (round >= LENS.length) { phase = 'finale'; ft = 0; this.makeCrowd(); } else { pp = 'pause'; pt = 0; say(`제 ${round + 1} 소절`, 2); } }
      } else {
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
    draw() {
      const ch = chicken();
      if (phase === 'finale' && ft >= 4.2) {
        g.fillStyle = ch ? '#120d22' : '#000'; g.fillRect(-20, -20, W + 40, H + 40);
        const b = clamp((ft - 6) / 5, 0, 1); if (b > 0) drawRose(b, ch);
        if (white > 0) { g.fillStyle = `rgba(255,255,255,${white})`; g.fillRect(0, 0, W, H); }
        return;
      }
      if (rear > 0) { const rc = { x: cam.x, z: cam.z, yaw: cam.yaw + Math.PI, bob: 0 }; e.render(rc, this.sprites()); g.fillStyle = 'rgba(120,0,0,.18)'; g.fillRect(0, 0, W, H); txt('▶ 뒤', 20, 52, { size: 11, color: '#ff8080', font: MONO, align: 'left' }); return; }
      e.render(cam, this.sprites());
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
  let phase = opt.chase ? 'chase' : 'collect', bob = 0, stepAcc = 0, carried = [], placed = 0, pt = 0, idle = 0, slashT = 9, hasSword = false, knightDead = false, knightSaid = false, shutT = 0, scareT = 0, peek = -1, flash = 0;
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
    get noJoy() { return phase === 'feast' || phase === 'turn' || phase === 'shut'; },
    dbg: { cam, guests, items, get phase() { return phase; }, set phase(v) { phase = v; }, get placed() { return placed; }, pickAll() { for (const it of items) if (!it.got) { it.got = true; carried.push(it); } } },
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
    key(k) { if (k === ' ' || k === 'Enter' || k === 'x' || k === 'j') this.slash(); },
    pointer(t, x) { fpPointer(cam, t, x); if (t === 'down' && !TOUCH && document.pointerLockElement === api.cv) this.slash(); },
    update(dt) {
      slashT += dt; flash = Math.max(0, flash - dt * 2); scareT = Math.max(0, scareT - dt);
      e.flick = .92 + Math.sin(now() * 9) * .04 + Math.sin(now() * 23) * .02;
      flowT -= dt; if (flowT <= 0) { flowT = .25; flow(); }
      const lockMove = phase === 'feast' || phase === 'turn' || phase === 'shut';
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
        if (knightDead && cam.z > 44.4) { phase = 'shut'; pt = 0; api.hint(null); exitLock(); }
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
    draw() {
      const ch = chicken(), list = [];
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

return { HCh1, HCh2, HCh4, Engine, buildSprites, canvasSprite, fpControls, fpPointer, exitLock, scareOverlay, bigScare, SP, rng, E2, P2, ghostOn };
};
})();
