# 人柱愛麗絲 (인주앨리스) — 작업 메모

아날로그 호러 웹게임. 비상업 개인 프로젝트. 저장소 keymoon130-ai/injoo-alice, main 푸시 → Cloudflare Workers Builds가 horroralice.keymoon130.workers.dev 로 자동 배포.

## 작업 규칙 (사용자)
- 기능은 먼저 제안해서 컨펌받고, 사용자가 "제작/만들어/ㄱㄱ" 할 때까지 만들지 말 것. 버그는 원인부터 보고.
- 뇌절 금지. 한국어로 간결하게.
- 앞으로 방향: 멀티 요소 추가 X → 탐험의 즐거움과 편의성. 원작 설정에 맞고 밸런스를 해치지 않게.
- 확정 전 작업물이 트리에 있으면 main 말고 wip 브랜치로.
- 커밋: `git -c user.name=Claude -c user.email=noreply@anthropic.com commit`, 푸시 후 check-runs가 success인지 확인.

## 구조
- `public/index.html` — 스토리 모드(일반 1~5장, 메뉴, 사진첩 AlbumScene, 칭호 TitlesScene, 엔딩). `hard.js?v=` 로드
- `public/hard.js` — 하드 모드 + 레이캐스터 엔진(벽 그림·빌보드·고정 방향 쿼드 `s.q`), 5장 LivingRoom(리모컨→TV→붉은 눈→꿈 점프스케어), 필름 카메라 `withCamera`(장당 12장, 심령사진 c1a~c4c)
- `public/titles.js` — 칭호 17종 공용(window.InjooTitles): give/inc/flag/equip/mountPanel
- `public/multi/` — 멀티(비대칭: 꿈 vs 앨리스). `shared.js`(PROTO·맵·규칙, GAME_TIME 420초), `game.js`(화면·재접속·칭호·손짓 'sign'), `index.html`
- `server/worker.js` — Room Durable Object(권위 서버, 20Hz). 메시지: title, sign(같은 편 손짓), ping(지연 측정)
- localStorage: 스토리 `injoo_*`, 멀티 `injoo_m_*`, 칭호 `injoo_titles/injoo_tc/injoo_title`, 사진 `injoo_photos`, 푸른 편지 코드 `injoo_bluecode`
- 스크립트 `?v=` 캐시버스터와 멀티 PROTO는 고칠 때 같이 올릴 것 (PROTO 바뀌면 접속자 자동 새로고침)

## 결정된 규칙 (멀티)
- 게임 7분. 몸부림(E연타)은 지금 그대로. 추가 모드(은신·운명계승·부스트 등)는 방장이 켜고 끔.
- 최후의 앨리스 보너스: 다른 앨리스가 전부 잡혀 들어갔을 때만 (탈출자 있으면 X).
- CCTV 16대, 꺼져도 150초 뒤 자동 복구. 대기실 연결 끊김 15초 유예, 게임 중 60초 재접속.

## 테스트
- `npx wrangler dev --port 8787` + Playwright(`/opt/npm-tools/node_modules/playwright`). 서버 끌 때 같은 명령 안에서 pkill 쓰면 셸이 죽으니 따로 실행.
