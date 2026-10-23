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
  INTRO: 10,
  ESCAPE_R: 2.4,
  MAX_PLAYERS: 8,
  MAX_DREAMS: 7,         // 꿈은 (전체 인원 - 1)명까지
  REVEAL_EVERY: 30,     // 꿈의 지도에 앨리스 위치가 드러나는 주기 (초)
  REVEAL_SHOW: 6        // 드러난 위치가 지도에 남아 있는 시간 (초)
};

export const GR = { FOREST: 0, RED: 1, STONE: 2, BOARD: 3, GRASS: 4, RUG: 5, CARPET: 6, YCARPET: 7, DARK: 8, MARBLE: 9 };
export const WL = { NONE: 0, WALL: 1, TOWER: 2, CELL: 3, BARS: 4, CURTAIN: 5, VELVET: 6, YPAPER: 7, PILLAR: 8, MARBLE: 9, MIRROR: 10, PORTAL: 11 };
export const WALL_H = [0, 1.7, 2.6, 1.4, 0, 2.2, 2.4, 1.6, 1.6, 2.1, 2.1, 2.1];
export const MAPS = ['forest', 'theater', 'tea', 'mirror'];
export const MAP_NAMES = { random: '랜덤', forest: '숲', theater: '푸른 앨리스의 극장', tea: '노란 앨리스의 다과회 실', mirror: '초록 여왕의 거울 미궁' };
export const PORTAL_COLS = [[120, 255, 170], [150, 190, 255], [255, 210, 120], [235, 140, 255]];

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

export function genWorld(seed, map) {
  if (map === 'theater') return genTheater(seed);
  if (map === 'tea') return genTea(seed);
  if (map === 'mirror') return genMirror(seed);
  return genForest(seed);
}

// 공통: 성 감옥처럼 창살 달린 감옥 세 칸 (북쪽이 안쪽, 남쪽이 문)
function buildCells(N, wall, setW, zBars, xs, sepWall) {
  const cells = [];
  for (const [x0, x1] of xs) {
    for (let x = x0; x <= x1; x++) setW(x, zBars, WL.BARS);
    cells.push({ x: (x0 + x1 + 1) / 2, z: zBars - 1.5, door: { x: (x0 + x1 + 1) / 2, z: zBars + 1.4 } });
  }
  for (let i = 0; i <= xs.length; i++) { const x = i < xs.length ? xs[i][0] - 1 : xs[xs.length - 1][1] + 1; for (let z = zBars - 4; z <= zBars; z++) setW(x, z, sepWall); }
  return cells;
}
function finishTrees(N, list) {
  const treeCells = new Array(N * N);
  for (const t of list) { const ci = (t.z | 0) * N + (t.x | 0); (treeCells[ci] || (treeCells[ci] = [])).push(t); }
  return treeCells;
}

/* ---------------- 푸른 앨리스의 극장 ---------------- */
function genTheater(seed) {
  const N = CFG.N, r = mulberry32(seed >>> 0);
  const ground = new Uint8Array(N * N).fill(GR.CARPET), wall = new Uint8Array(N * N).fill(WL.VELVET);
  const I = (x, z) => z * N + x;
  const setW = (x, z, t) => { if (x >= 0 && z >= 0 && x < N && z < N) wall[I(x, z)] = t; };
  const setG = (x, z, t) => { if (x >= 0 && z >= 0 && x < N && z < N) ground[I(x, z)] = t; };
  const carve = (x0, z0, x1, z1, g) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { setW(x, z, 0); if (g != null) setG(x, z, g); } };
  carve(10, 23, 70, 60, GR.CARPET);       // 객석
  carve(14, 13, 66, 22, GR.BOARD);        // 무대
  carve(10, 9, 70, 11, GR.DARK);          // 무대 뒤 복도
  carve(15, 12, 16, 12, GR.DARK); carve(64, 12, 65, 12, GR.DARK);     // 무대 옆 통로
  for (let x = 17; x <= 63; x++) setW(x, 12, WL.CURTAIN);
  carve(31, 3, 47, 8, GR.STONE);          // 무대 아래 감옥
  const cells = buildCells(N, wall, setW, 8, [[33, 35], [37, 39], [41, 43]], WL.WALL);
  for (let x = 31; x <= 47; x++) if (x < 32 || x > 44) setW(x, 8, WL.WALL);
  carve(3, 2, 9, 9, GR.RUG); carve(71, 2, 77, 9, GR.RUG);           // 분장실
  carve(3, 10, 8, 66, GR.DARK); carve(72, 10, 77, 66, GR.DARK);      // 양옆 발코니 복도
  for (const z of [10]) { carve(9, z, 9, z + 1, GR.DARK); carve(71, z, 71, z + 1, GR.DARK); }
  for (const z of [29, 30, 44, 45, 56, 57]) { setW(9, z, 0); setG(9, z, GR.DARK); setW(71, z, 0); setG(71, z, GR.DARK); }
  carve(10, 62, 70, 77, GR.RUG);          // 로비
  for (const [x0, x1] of [[19, 22], [38, 42], [58, 61]]) carve(x0, 61, x1, 61, GR.CARPET);
  for (const z of [63, 64]) { setW(9, z, 0); setG(9, z, GR.DARK); setW(71, z, 0); setG(71, z, GR.DARK); }
  for (const x of [20, 30, 50, 60]) for (const z of [66, 72]) setW(x, z, WL.PILLAR);
  // 객석 의자 (부딪히지만 앉은 높이라 시야는 막지 않는다)
  const seats = [], mann = [];
  for (let z = 27; z <= 56; z += 2) for (const [x0, x1] of [[13, 36], [44, 67]]) for (let x = x0; x <= x1; x++) {
    const sx = x + .5, sz = z + .5; seats.push({ x: sx, z: sz, r: .38, s: 0, seat: true });
    if (r() < .14) mann.push({ x: sx, z: sz - .05 });
  }
  const traces = [
    { x: 6, z: 5 }, { x: 40, z: 24.6 }, { x: 74, z: 5 }, { x: 16, z: 73 }, { x: 64, z: 73 }
  ].map((p, i) => ({ id: i, ...TRACE_INFO[i], x: p.x + (r() - .5) * .8, z: p.z + (r() - .5) * .4 }));
  const props = [];
  for (const m of mann) props.push({ kind: 'mann', x: m.x, z: m.z });
  for (const s of seats) props.push({ kind: 'seat', x: s.x, z: s.z });
  const displays = []; for (const dx of [-14, 14, -18, 18, -22, 22, -10, 10]) displays.push({ x: 40 + dx, z: 21.4 });
  for (const d of displays) props.push({ kind: 'pole', x: d.x, z: d.z });
  for (let x = 33; x <= 43; x++) if (wall[I(x, 8)] === WL.BARS) props.push({ kind: 'bars', x: x + .5, z: 8.5 });
  const spawnA = [[20, 70], [30, 75], [50, 75], [60, 70], [5.5, 30], [74.5, 30], [5.5, 50], [74.5, 50]].map(([x, z]) => ({ x, z }));
  const spawnD = [{ x: 38, z: 17 }, { x: 42, z: 17 }, { x: 40, z: 20 }, { x: 34, z: 15 }, { x: 46, z: 15 }, { x: 30, z: 18 }, { x: 50, z: 18 }];
  const doorCands = [{ x: 40, z: 17 }, { x: 40, z: 74 }, { x: 5.5, z: 62 }, { x: 74.5, z: 62 }];
  return { seed, N, map: 'theater', indoor: true, ground, wall, trees: seats, treeCells: finishTrees(N, seats), cells, displays, traces, props, spawnA, spawnD, doorCands, path: [],
    labels: [{ t: '무대', x: 40, z: 17 }, { t: '감옥 (무대 아래)', x: 39, z: 5.5 }, { t: '객석', x: 40, z: 42 }, { t: '로비', x: 40, z: 70 }, { t: '분장실', x: 6, z: 5 }, { t: '분장실', x: 74, z: 5 }] };
}

/* ---------------- 노란 앨리스의 다과회 실 (끝없이 이어지는 노란 방) ---------------- */
function genTea(seed) {
  const N = CFG.N, r = mulberry32(seed >>> 0);
  const ground = new Uint8Array(N * N).fill(GR.YCARPET), wall = new Uint8Array(N * N);
  const I = (x, z) => z * N + x;
  const setW = (x, z, t) => { if (x >= 0 && z >= 0 && x < N && z < N) wall[I(x, z)] = t; };
  const setG = (x, z, t) => { if (x >= 0 && z >= 0 && x < N && z < N) ground[I(x, z)] = t; };
  const R = 8, S = 10; // 8x8 개의 방, 한 변 10칸
  for (let i = 0; i < N; i++) { setW(i, 0, WL.YPAPER); setW(i, N - 1, WL.YPAPER); setW(0, i, WL.YPAPER); setW(N - 1, i, WL.YPAPER); }
  for (let k = 1; k < R; k++) for (let i = 0; i < N; i++) { setW(k * S, i, WL.YPAPER); setW(i, k * S, WL.YPAPER); }
  // 미로 (모든 방이 이어지게) + 고리 몇 개
  const vis = new Uint8Array(R * R), open = (ax, az, bx, bz) => {
    const w = 2 + (r() < .35 ? 1 : 0);
    if (ax !== bx) { const x = Math.max(ax, bx) * S, z0 = Math.min(az, bz) * S + 2 + ((r() * (S - 3 - w)) | 0); for (let z = z0; z < z0 + w; z++) setW(x, z, 0); }
    else { const z = Math.max(az, bz) * S, x0 = ax * S + 2 + ((r() * (S - 3 - w)) | 0); for (let x = x0; x < x0 + w; x++) setW(x, z, 0); }
  };
  for (const [x, z] of [[3, 3], [4, 3], [3, 4], [4, 4]]) vis[z * R + x] = 1; // 가운데 감옥 방은 미로에서 뺀다
  const stack = [[0, 0]]; vis[0] = 1;
  while (stack.length) {
    const [cx, cz] = stack[stack.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => [cx + dx, cz + dz]).filter(([x, z]) => x >= 0 && z >= 0 && x < R && z < R && !vis[z * R + x]);
    if (!nb.length) { stack.pop(); continue; }
    const [nx, nz] = nb[(r() * nb.length) | 0]; vis[nz * R + nx] = 1; open(cx, cz, nx, nz); stack.push([nx, nz]);
  }
  const inC = (x, z) => x >= 3 && x <= 4 && z >= 3 && z <= 4;
  for (let k = 0; k < 26; k++) { const x = (r() * R) | 0, z = (r() * R) | 0; if (r() < .5 && x < R - 1) { if (!inC(x, z) && !inC(x + 1, z)) open(x, z, x + 1, z); } else if (z < R - 1 && !inC(x, z) && !inC(x, z + 1)) open(x, z, x, z + 1); }
  // 가운데: 문 없는 방의 긴 식탁 (감옥)
  for (let z = 31; z <= 49; z++) for (let x = 31; x <= 49; x++) { setW(x, z, 0); }
  for (let i = 30; i <= 50; i++) { setW(i, 30, WL.YPAPER); setW(30, i, WL.YPAPER); setW(50, i, WL.YPAPER); setW(i, 50, WL.YPAPER); }
  for (const [x, z] of [[39, 50], [40, 50], [41, 50], [30, 44], [30, 45], [50, 44], [50, 45]]) setW(x, z, 0);
  for (let z = 31; z <= 34; z++) for (let x = 31; x <= 49; x++) setG(x, z, GR.RUG);
  const cells = buildCells(N, wall, setW, 35, [[33, 35], [37, 39], [41, 43]], WL.YPAPER);
  for (let x = 31; x <= 49; x++) if (wall[I(x, 35)] === 0 && (x < 32 || x > 44)) setW(x, 35, WL.YPAPER);
  // 방마다 기둥·가구
  const rooms = [];
  for (let z = 0; z < R; z++) for (let x = 0; x < R; x++) { if (x >= 3 && x <= 4 && z >= 3 && z <= 4) continue; rooms.push({ x: x * S + 5, z: z * S + 5, ix: x, iz: z }); }
  const props = [];
  for (const rm of rooms) {
    const q = r();
    if (q < .22) { setW(rm.x - 1, rm.z - 1, WL.PILLAR); }
    else if (q < .48) { for (let k = 0; k < 4; k++) props.push({ kind: 'table', x: rm.x - 1.5 + k, z: rm.z }); for (let k = 0; k < 4; k++) { props.push({ kind: 'chair', x: rm.x - 1.5 + k, z: rm.z - 1.1 }); props.push({ kind: 'chair', x: rm.x - 1.5 + k, z: rm.z + 1.1 }); } }
    else if (q < .58) props.push({ kind: 'chair', x: rm.x + (r() - .5) * 4, z: rm.z + (r() - .5) * 4 });
  }
  for (let k = 0; k < 6; k++) props.push({ kind: 'table', x: 37.5 + k, z: 32.5 });
  // 흔적: 가운데에서 멀리, 서로 떨어진 방에
  const far = rooms.filter(rm => Math.hypot(rm.x - 40, rm.z - 40) > 18).sort(() => r() - .5);
  const picks = []; for (const rm of far) { if (picks.every(p => Math.hypot(p.x - rm.x, p.z - rm.z) > 22)) picks.push(rm); if (picks.length >= 5) break; }
  while (picks.length < 5) picks.push(far[picks.length]);
  const traces = picks.map((p, i) => ({ id: i, ...TRACE_INFO[i], x: p.x + .5, z: p.z + .5 }));
  for (const t of traces) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (wall[I((t.x | 0) + dx, (t.z | 0) + dz)] === WL.PILLAR) setW((t.x | 0) + dx, (t.z | 0) + dz, 0); }
  const used = new Set(picks);
  const spawnA = rooms.filter(rm => !used.has(rm) && Math.hypot(rm.x - 40, rm.z - 40) > 20).sort(() => r() - .5).slice(0, 8).map(rm => ({ x: rm.x + .5, z: rm.z + 2.5 }));
  for (const sp of spawnA) setW(sp.x | 0, sp.z | 0, 0);
  const spawnD = [{ x: 40, z: 45 }, { x: 37, z: 46 }, { x: 43, z: 46 }, { x: 35, z: 43 }, { x: 45, z: 43 }, { x: 40, z: 48 }, { x: 38, z: 41 }];
  const doorCands = [{ x: 5, z: 5 }, { x: 75, z: 5 }, { x: 5, z: 75 }, { x: 75, z: 75 }];
  const displays = []; for (const dx of [-6, 6, -8, 8, -4, 4, -2, 2]) displays.push({ x: 40 + dx, z: 48.6 });
  for (const d of displays) props.push({ kind: 'pole', x: d.x, z: d.z });
  for (let x = 33; x <= 43; x++) if (wall[I(x, 35)] === WL.BARS) props.push({ kind: 'bars', x: x + .5, z: 35.5 });
  return { seed, N, map: 'tea', indoor: true, fogOfWar: true, ground, wall, trees: [], treeCells: new Array(N * N), cells, displays, traces, props, spawnA, spawnD, doorCands, path: [],
    labels: [{ t: '긴 식탁 (감옥)', x: 39, z: 32.5 }] };
}

/* ---------------- 초록 여왕의 거울 미궁 ---------------- */
function genMirror(seed) {
  const N = CFG.N, r = mulberry32((seed >>> 0) ^ 0x5bd1e995);
  const ground = new Uint8Array(N * N).fill(GR.MARBLE), wall = new Uint8Array(N * N);
  const I = (x, z) => z * N + x;
  const setW = (x, z, t) => { if (x >= 0 && z >= 0 && x < N && z < N) wall[I(x, z)] = t; };
  const setG = (x, z, t) => { if (x >= 0 && z >= 0 && x < N && z < N) ground[I(x, z)] = t; };
  const R = 8, S = 10;
  for (let i = 0; i < N; i++) { setW(i, 0, WL.MARBLE); setW(i, N - 1, WL.MARBLE); setW(0, i, WL.MARBLE); setW(N - 1, i, WL.MARBLE); }
  for (let k = 1; k < R; k++) for (let i = 0; i < N; i++) { setW(k * S, i, WL.MARBLE); setW(i, k * S, WL.MARBLE); }
  const open = (ax, az, bx, bz) => {
    const w = 2 + (r() < .5 ? 1 : 0);
    if (ax !== bx) { const x = Math.max(ax, bx) * S, z0 = Math.min(az, bz) * S + 2 + ((r() * (S - 3 - w)) | 0); for (let z = z0; z < z0 + w; z++) setW(x, z, 0); }
    else { const z = Math.max(az, bz) * S, x0 = ax * S + 2 + ((r() * (S - 3 - w)) | 0); for (let x = x0; x < x0 + w; x++) setW(x, z, 0); }
  };
  const vis = new Uint8Array(R * R); for (const [x, z] of [[3, 3], [4, 3], [3, 4], [4, 4]]) vis[z * R + x] = 1;
  const stack = [[0, 0]]; vis[0] = 1;
  while (stack.length) {
    const [cx, cz] = stack[stack.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => [cx + dx, cz + dz]).filter(([x, z]) => x >= 0 && z >= 0 && x < R && z < R && !vis[z * R + x]);
    if (!nb.length) { stack.pop(); continue; }
    const [nx, nz] = nb[(r() * nb.length) | 0]; vis[nz * R + nx] = 1; open(cx, cz, nx, nz); stack.push([nx, nz]);
  }
  const inC = (x, z) => x >= 3 && x <= 4 && z >= 3 && z <= 4;
  for (let k = 0; k < 34; k++) { const x = (r() * R) | 0, z = (r() * R) | 0; if (r() < .5 && x < R - 1) { if (!inC(x, z) && !inC(x + 1, z)) open(x, z, x + 1, z); } else if (z < R - 1 && !inC(x, z) && !inC(x, z + 1)) open(x, z, x, z + 1); }
  // 가운데: 거울에 갇힌 방
  for (let z = 31; z <= 49; z++) for (let x = 31; x <= 49; x++) setW(x, z, 0);
  for (let i = 30; i <= 50; i++) { setW(i, 30, WL.MARBLE); setW(30, i, WL.MARBLE); setW(50, i, WL.MARBLE); setW(i, 50, WL.MARBLE); }
  for (const [x, z] of [[39, 50], [40, 50], [41, 50], [30, 39], [30, 40], [50, 39], [50, 40]]) setW(x, z, 0);
  for (let z = 31; z <= 34; z++) for (let x = 31; x <= 49; x++) setG(x, z, GR.STONE);
  const cells = buildCells(N, wall, setW, 35, [[33, 35], [37, 39], [41, 43]], WL.MIRROR);
  for (let x = 31; x <= 49; x++) if (wall[I(x, 35)] === 0 && (x < 32 || x > 44)) setW(x, 35, WL.MARBLE);
  // 방마다 거울 기둥
  const rooms = [];
  for (let z = 0; z < R; z++) for (let x = 0; x < R; x++) { if (x >= 3 && x <= 4 && z >= 3 && z <= 4) continue; rooms.push({ x: x * S + 5, z: z * S + 5, ix: x, iz: z }); }
  for (const rm of rooms) {
    const q = r();
    if (q < .35) { const hz = r() < .5; for (let k = -1; k <= 1; k++) setW(rm.x + (hz ? k : 0), rm.z + (hz ? 0 : k), WL.MIRROR); }
    else if (q < .55) { setW(rm.x - 2, rm.z - 2, WL.MIRROR); setW(rm.x + 2, rm.z + 2, WL.MIRROR); }
  }
  // 방을 나누는 벽 일부를 거울로
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    if (wall[I(x, z)] !== WL.MARBLE || (x > 29 && x < 51 && z > 29 && z < 51)) continue;
    if (hash2(x >> 2, z >> 2, seed) < 70) setW(x, z, WL.MIRROR);
  }
  // 빛나는 거울 문 네 쌍: 서로 멀리 떨어진 방의 벽에
  const faces = [];
  const shuffled = rooms.slice().sort(() => r() - .5);
  for (const rm of shuffled) {
    const cand = [];
    for (let k = -3; k <= 3; k++) {
      cand.push({ wx: rm.ix * S, wz: rm.z + k, nx: 1, nz: 0 }, { wx: rm.ix * S + S, wz: rm.z + k, nx: -1, nz: 0 }, { wx: rm.x + k, wz: rm.iz * S, nx: 0, nz: 1 }, { wx: rm.x + k, wz: rm.iz * S + S, nx: 0, nz: -1 });
    }
    const ok = cand.filter(c => c.wx > 0 && c.wz > 0 && c.wx < N - 1 && c.wz < N - 1 && wall[I(c.wx, c.wz)] && !wall[I(c.wx + c.nx, c.wz + c.nz)] && !wall[I(c.wx + c.nx * 2, c.wz + c.nz * 2)]);
    if (!ok.length) continue;
    const c = ok[(r() * ok.length) | 0];
    if (faces.some(f => Math.hypot(f.wx - c.wx, f.wz - c.wz) < 18)) continue;
    faces.push(c); if (faces.length >= 8) break;
  }
  const portals = [];
  for (let k = 0; k + 1 < faces.length; k += 2) {
    for (const [a, b] of [[faces[k], faces[k + 1]], [faces[k + 1], faces[k]]]) {
      setW(a.wx, a.wz, WL.PORTAL);
      portals.push({ wx: a.wx, wz: a.wz, nx: a.nx, nz: a.nz, fx: a.wx + .5 + a.nx * .5, fz: a.wz + .5 + a.nz * .5, ex: b.wx + .5 + b.nx * 1.2, ez: b.wz + .5 + b.nz * 1.2, eyaw: Math.atan2(b.nz, b.nx), pair: k / 2 });
    }
  }
  const portalAt = new Int16Array(N * N).fill(-1); portals.forEach((p, i) => { portalAt[I(p.wx, p.wz)] = i; });
  const far = rooms.filter(rm => Math.hypot(rm.x - 40, rm.z - 40) > 18).sort(() => r() - .5);
  const picks = []; for (const rm of far) { if (picks.every(p => Math.hypot(p.x - rm.x, p.z - rm.z) > 22)) picks.push(rm); if (picks.length >= 5) break; }
  while (picks.length < 5) picks.push(far[picks.length]);
  const traces = picks.map((p, i) => ({ id: i, ...TRACE_INFO[i], x: p.x + .5, z: p.z + 2.5 }));
  const clearAround = (x, z) => { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const k = I((x | 0) + dx, (z | 0) + dz); if (wall[k] === WL.MIRROR && ((x | 0) + dx) % S && ((z | 0) + dz) % S) wall[k] = 0; } };
  for (const t of traces) clearAround(t.x, t.z);
  const used = new Set(picks);
  const spawnA = rooms.filter(rm => !used.has(rm) && Math.hypot(rm.x - 40, rm.z - 40) > 20).sort(() => r() - .5).slice(0, 8).map(rm => ({ x: rm.x + .5, z: rm.z + 3.5 }));
  for (const sp of spawnA) clearAround(sp.x, sp.z);
  const spawnD = [{ x: 40, z: 45 }, { x: 37, z: 46 }, { x: 43, z: 46 }, { x: 35, z: 43 }, { x: 45, z: 43 }, { x: 40, z: 48 }, { x: 38, z: 41 }];
  const doorCands = [{ x: 5, z: 5 }, { x: 75, z: 5 }, { x: 5, z: 75 }, { x: 75, z: 75 }];
  for (const d of doorCands) clearAround(d.x, d.z);
  const props = [];
  const displays = []; for (const dx of [-6, 6, -8, 8, -4, 4, -2, 2]) displays.push({ x: 40 + dx, z: 48.6 });
  for (const d of displays) props.push({ kind: 'pole', x: d.x, z: d.z });
  for (let x = 33; x <= 43; x++) if (wall[I(x, 35)] === WL.BARS) props.push({ kind: 'glass', x: x + .5, z: 35.5 });
  return { seed, N, map: 'mirror', indoor: true, ground, wall, trees: [], treeCells: new Array(N * N), cells, displays, traces, props, spawnA, spawnD, doorCands, path: [],
    portals, portalAt, labels: [{ t: '거울 감옥', x: 39, z: 32.5 }] };
}
function hash2(a, b, s) { let h = (a * 374761393 + b * 668265263 + (s | 0) * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return (h ^ (h >>> 16)) & 255; }

function genForest(seed) {
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

  return { seed, N, map: 'forest', labels: [{ t: '감옥', x: 38.5, z: 33.5 }, { t: '성문', x: 40, z: 50.5 }], ground, wall, trees, treeCells, cells, displays, traces, props, spawnA, spawnD, doorCands, castle: { x0: C0, z0: C0, x1: C1 + 1, z1: C1 + 1, cx: 40, cz: 40 }, path };
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
  // 빛나는 거울 문: 거울에 몸을 대면 짝 거울로 빠져나온다
  if (w.portals) {
    if (p.pc > 0) p.pc = Math.max(0, p.pc - dt);
    else for (const q of w.portals) {
      if (Math.abs(p.x - q.fx) + Math.abs(p.z - q.fz) > 1.2) continue;
      const along = q.nx ? Math.abs(p.z - (q.wz + .5)) : Math.abs(p.x - (q.wx + .5));
      const dist = q.nx ? (p.x - (q.wx + .5 + q.nx * .5)) * q.nx : (p.z - (q.wz + .5 + q.nz * .5)) * q.nz;
      if (along < .55 && dist < CFG.R + .04 && (vx * q.nx + vz * q.nz) < 0) { p.x = q.ex; p.z = q.ez; p.pc = 1.2; p.warp = q.eyaw; collide(w, p); break; }
    }
  }
}
