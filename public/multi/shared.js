// 人柱愛麗絲 : 망가진 꿈 — 서버와 클라이언트가 함께 쓰는 규칙
// 같은 시드(seed)로 같은 맵을 만들고, 같은 이동 함수로 움직여서 기기 간 차이를 없앤다.

export const CFG = {
  N: 80,                 // 맵 한 변 (칸)
  INPUT_DT: 1 / 30,      // 입력 한 번이 차지하는 시간
  TICK_MS: 50,           // 서버 갱신 간격 (20Hz)
  ALICE_SPEED: 3.3,      // 앨리스가 조금 더 빠르다
  DREAM_SPEED: 3.0,
  CARRY_MUL: 0.85,       // 앨리스를 들고 있을 때 꿈의 속도 배율
  DASH_SPEED: 9.5,
  DASH_TIME: 0.4,
  DASH_CD: 6,            // 꿈의 대시: 6초에 한 번
  R: 0.28,               // 몸 반지름
  CATCH_RANGE: 1.4,
  DEPOSIT_RANGE: 2.8,
  CHANNEL_RANGE: 1.7,
  ROT_TIME: 120,         // 감옥 2분이면 썩어서 성 위에 걸린다
  RESCUE_TIME: 3,
  IMMUNE: 3,
  STUN: 2.5,
  STRUGGLE_ADD: 0.028,   // 몸부림 한 번에 차는 양
  STRUGGLE_DECAY: 0.13,  // 1초마다 빠지는 양
  STRUGGLE_GAP: 3,       // 연타 인정 간격 (입력 3번 = 0.1초) — 매크로 방지
  GAME_TIME: 780,        // 13분
  INTRO: 5,
  ESCAPE_R: 2.4,
  MAX_PLAYERS: 8,
  MAX_DREAMS: 3,
  REVEAL_EVERY: 30,     // 꿈의 지도에 앨리스 위치가 드러나는 주기 (초)
  REVEAL_SHOW: 6        // 드러난 위치가 지도에 남아 있는 시간 (초)
};

export const GR = { FOREST: 0, RED: 1, STONE: 2, BOARD: 3, GRASS: 4, RUG: 5 };
export const WL = { NONE: 0, WALL: 1, TOWER: 2, CELL: 3, BARS: 4, CURTAIN: 5 };
export const WALL_H = [0, 1.7, 2.6, 1.4, 0, 2.2];

export const TRACE_INFO = [
  { kind: 'sword',    suit: '♠', color: '#b42121', name: '붉은 앨리스의 검',     dur: 3 },
  { kind: 'musicbox', suit: '♦', color: '#4a64c8', name: '푸른 앨리스의 오르골', dur: 5 },
  { kind: 'crown',    suit: '♥', color: '#3e8a4c', name: '초록 앨리스의 왕관',   dur: 4 },
  { kind: 'card',     suit: '♣', color: '#b49b2e', name: '쌍둥이의 초대장 (하나)', dur: 2 },
  { kind: 'card',     suit: '♣', color: '#b49b2e', name: '쌍둥이의 초대장 (둘)',   dur: 2 }
];

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
  const L = vx * vx + vz * vz;
  let t = L ? (wx * vx + wz * vz) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (ax + vx * t), dz = pz - (az + vz * t);
  return Math.sqrt(dx * dx + dz * dz);
}

export function genWorld(seed) {
  const N = CFG.N, r = mulberry32(seed >>> 0);
  const ground = new Uint8Array(N * N), wall = new Uint8Array(N * N);
  const I = (x, z) => z * N + x;
  const setW = (x, z, t) => { if (x >= 0 && z >= 0 && x < N && z < N) wall[I(x, z)] = t; };
  const setG = (x, z, t) => { if (x >= 0 && z >= 0 && x < N && z < N) ground[I(x, z)] = t; };

  // ---- 무너져가는 성 (가운데) ----
  const C0 = 31, C1 = 48;
  for (let z = C0; z <= C1; z++) for (let x = C0; x <= C1; x++) {
    setG(x, z, GR.STONE);
    if (x === C0 || x === C1 || z === C0 || z === C1) setW(x, z, WL.WALL);
  }
  for (const [tx, tz] of [[C0, C0], [C1 - 1, C0], [C0, C1 - 1], [C1 - 1, C1 - 1]])
    for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) setW(tx + dx, tz + dz, WL.TOWER);
  setW(39, C1, 0); setW(40, C1, 0);           // 정문 (남쪽)
  setW(C0, 42, 0); setW(C0, 43, 0);           // 무너진 서쪽 벽
  setW(C1, 37, 0);                            // 무너진 동쪽 틈
  // 감옥 (북쪽 안쪽)
  const cells = [];
  for (const [x0, x1] of [[33, 35], [37, 39], [41, 43]]) {
    for (let x = x0; x <= x1; x++) setW(x, 35, WL.BARS);
    cells.push({ x: (x0 + x1 + 1) / 2, z: 33.5, door: { x: (x0 + x1 + 1) / 2, z: 36.4 } });
  }
  for (const x of [32, 36, 40, 44]) for (let z = 32; z <= 35; z++) if (wall[I(x, z)] !== WL.TOWER) setW(x, z, WL.CELL);
  // 무너진 벽 조각
  for (const [x, z] of [[36, 41], [37, 41], [44, 40], [44, 41], [35, 45], [42, 45], [43, 45]]) setW(x, z, WL.CELL);
  // 성 위 전시대 (썩은 앨리스가 걸리는 곳)
  const displays = [];
  for (const dx of [-2.6, 2.6, -3.8, 3.8, -5, 5, -6.2, 6.2]) displays.push({ x: 40 + dx, z: 50.3 });

  // ---- 공터와 지형 ----
  const clearings = [];
  const clear = (x, z, rad, g) => {
    clearings.push({ x, z, r: rad });
    for (let iz = Math.floor(z - rad); iz <= Math.ceil(z + rad); iz++)
      for (let ix = Math.floor(x - rad); ix <= Math.ceil(x + rad); ix++)
        if (g != null && Math.hypot(ix + .5 - x, iz + .5 - z) <= rad) setG(ix, iz, g);
  };
  clear(13, 13, 4.5, GR.GRASS);     // 붉은 앨리스의 공터
  clear(13, 67, 4, GR.GRASS);       // 쌍둥이가 헤맨 공터
  clear(40, 52.5, 3.5, null);       // 성문 앞
  const doorCands = [{ x: 40, z: 4.5 }, { x: 4.5, z: 40 }, { x: 75.5, z: 40 }, { x: 40, z: 75.5 }];
  for (const d of doorCands) clear(d.x, d.z, 3.5, GR.GRASS);
  // 무대 (푸른 앨리스)
  for (let z = 9; z <= 17; z++) for (let x = 61; x <= 73; x++) setG(x, z, GR.BOARD);
  for (let x = 61; x <= 73; x++) setW(x, 8, WL.CURTAIN);
  clearings.push({ x: 67, z: 13, r: 7.5 });
  // 다과회 (쌍둥이)
  for (let z = 64; z <= 70; z++) for (let x = 63; x <= 71; x++) setG(x, z, GR.RUG);
  clearings.push({ x: 67, z: 67, r: 6.5 });
  // 붉은 길: 성의 무너진 서쪽 벽 → 검이 꽂힌 공터
  const path = [[30.5, 42.5], [24, 38], [18, 31], [12, 24], [13, 14]];
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    for (let k = 0; k < path.length - 1; k++)
      if (segDist(x + .5, z + .5, path[k][0], path[k][1], path[k + 1][0], path[k + 1][1]) < 0.95) { if (ground[I(x, z)] === GR.FOREST) ground[I(x, z)] = GR.RED; break; }
  }

  // ---- 흔적 ----
  const j = () => (r() - .5) * 1.6;
  const traces = [
    { x: 13 + j(), z: 13 + j() },
    { x: 67 + j() * 1.5, z: 12.5 + j() * .6 },
    { x: 45.6, z: 45.3 },
    { x: 65 + r() * 4, z: 67 },
    { x: 13 + j(), z: 67 + j() }
  ].map((p, i) => ({ id: i, ...TRACE_INFO[i], x: p.x, z: p.z }));

  // ---- 소품 ----
  const props = [];
  for (let k = 0; k < 6; k++) props.push({ kind: 'table', x: 64.5 + k, z: 67 });
  for (let k = 0; k < 6; k++) { props.push({ kind: 'chair', x: 64.5 + k, z: 65.9 }); props.push({ kind: 'chair', x: 64.5 + k, z: 68.1 }); }
  for (const d of displays) props.push({ kind: 'pole', x: d.x, z: d.z });
  for (let x = 33; x <= 43; x++) if (wall[I(x, 35)] === WL.BARS) props.push({ kind: 'bars', x: x + .5, z: 35.5 });

  // ---- 시작 위치 ----
  const spawnA = [[22, 74], [30, 76], [50, 76], [58, 74], [74, 58], [6, 52], [74, 26], [26, 6]].map(([x, z]) => ({ x, z }));
  const spawnD = [{ x: 39.5, z: 52 }, { x: 41, z: 53 }, { x: 38.5, z: 53.5 }];
  for (const s of spawnA) clearings.push({ x: s.x, z: s.z, r: 1.6 });

  // ---- 나무 ----
  const trees = [], treeCells = new Array(N * N);
  const near = (x, z, d) => {
    const ix = x | 0, iz = z | 0;
    for (let cz = iz - 2; cz <= iz + 2; cz++) for (let cx = ix - 2; cx <= ix + 2; cx++) {
      if (cx < 0 || cz < 0 || cx >= N || cz >= N) continue;
      const l = treeCells[cz * N + cx]; if (!l) continue;
      for (const t of l) if ((t.x - x) ** 2 + (t.z - z) ** 2 < d * d) return true;
    }
    return false;
  };
  for (let k = 0; k < 6000; k++) {
    const x = .8 + r() * (N - 1.6), z = .8 + r() * (N - 1.6);
    if (x > 28.5 && x < 51.5 && z > 28.5 && z < 51.5) continue;
    if (ground[I(x | 0, z | 0)] !== GR.FOREST) continue;
    let bad = false;
    for (const c of clearings) if (Math.hypot(x - c.x, z - c.z) < c.r + .6) { bad = true; break; }
    if (bad) continue;
    for (let q = 0; q < path.length - 1 && !bad; q++) if (segDist(x, z, path[q][0], path[q][1], path[q + 1][0], path[q + 1][1]) < 1.7) bad = true;
    if (bad || near(x, z, 1.12)) continue;
    const t = { x, z, r: .17 + r() * .2, s: r() };
    trees.push(t);
    const ci = (z | 0) * N + (x | 0);
    (treeCells[ci] || (treeCells[ci] = [])).push(t);
  }

  return { seed, N, ground, wall, trees, treeCells, cells, displays, traces, props, spawnA, spawnD, doorCands, castle: { x0: C0, z0: C0, x1: C1 + 1, z1: C1 + 1, cx: 40, cz: 40 }, path };
}

export function solid(w, x, z) {
  const N = w.N;
  if (x < 0 || z < 0 || x >= N || z >= N) return true;
  return w.wall[(z | 0) * N + (x | 0)] !== 0;
}

export function collide(w, p) {
  const R = CFG.R, N = w.N;
  const ix = p.x | 0, iz = p.z | 0;
  for (let cz = iz - 1; cz <= iz + 1; cz++) for (let cx = ix - 1; cx <= ix + 1; cx++) {
    if (cx < 0 || cz < 0 || cx >= N || cz >= N) continue;
    const list = w.treeCells[cz * N + cx];
    if (list) for (const t of list) {
      const dx = p.x - t.x, dz = p.z - t.z, d2 = dx * dx + dz * dz, m = R + t.r;
      if (d2 < m * m) { const d = Math.sqrt(d2) || 1e-4; p.x = t.x + dx / d * m; p.z = t.z + dz / d * m; }
    }
    if (w.wall[cz * N + cx]) {
      const nx = Math.max(cx, Math.min(p.x, cx + 1)), nz = Math.max(cz, Math.min(p.z, cz + 1));
      const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
      if (d2 < R * R && d2 > 1e-10) { const d = Math.sqrt(d2); p.x = nx + dx / d * R; p.z = nz + dz / d * R; }
    }
  }
  if (p.x < .5) p.x = .5; if (p.z < .5) p.z = .5;
  if (p.x > N - .5) p.x = N - .5; if (p.z > N - .5) p.z = N - .5;
}

// p: { x, z, yaw, role, st(0=자유), dc(대시 쿨), dt(대시 남은 시간), sn(기절), carry }
// inp: { f(앞뒤), s(옆), y(시선), d(대시 누름) }
export function stepPlayer(w, p, inp, dt) {
  if (p.st !== 0) return;
  p.yaw = +inp.y || 0;
  if (p.role === 'dream') {
    if (p.dc > 0) p.dc = Math.max(0, p.dc - dt);
    if (p.sn > 0) { p.sn = Math.max(0, p.sn - dt); p.m = 0; return; }
    if (inp.d && p.dc <= 0 && !p.carry) { p.dt = CFG.DASH_TIME; p.dc = CFG.DASH_CD; }
  }
  let f = +inp.f || 0, s = +inp.s || 0;
  const l = Math.hypot(f, s); if (l > 1) { f /= l; s /= l; }
  let sp = p.role === 'dream' ? CFG.DREAM_SPEED * (p.carry ? CFG.CARRY_MUL : 1) : CFG.ALICE_SPEED;
  if (p.dt > 0) { p.dt = Math.max(0, p.dt - dt); sp = CFG.DASH_SPEED; if (l < .1) { f = 1; s = 0; } }
  const co = Math.cos(p.yaw), si = Math.sin(p.yaw);
  const vx = (f * co - s * si) * sp, vz = (f * si + s * co) * sp;
  p.m = (Math.abs(vx) + Math.abs(vz)) > .1 ? 1 : 0;
  const n = Math.max(1, Math.ceil(Math.hypot(vx, vz) * dt / .12));
  for (let i = 0; i < n; i++) { p.x += vx * dt / n; p.z += vz * dt / n; collide(w, p); }
}
