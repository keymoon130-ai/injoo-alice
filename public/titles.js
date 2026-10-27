// 人柱愛麗絲 — 칭호 (스토리·멀티 공용). 이 기기의 기록으로 판정한다.
(function () {
  'use strict';
  const LIST = [
    { id: 'zzol', name: '쫄보킹', col: '#ff8fc0' },
    { id: 'red', name: '붉게물든자', col: '#e02a2a' },
    { id: 'blue', name: '푸른음악가', col: '#6a8cff' },
    { id: 'green', name: '녹색아가씨', col: '#3fbf6a' },
    { id: 'twin', name: '노란 쌍둥이', col: '#e8c840' },
    { id: 'fifth', name: '다섯 번째 앨리스', col: 'wave' },
    { id: 'alone', name: '홀로 남은 앨리스', col: '#c8ccd6' },
    { id: 'hidden', name: '숨은 꿈', col: '#a878ec' },
    { id: 'small', name: '작은 꿈', col: '#c0283a' },
    { id: 'vhs', name: 'VHS 수집가', col: '#e8b848' },
    { id: 'free', name: '무임승차', col: '#9c9c9c' },
    { id: 'jail', name: '감옥 단골', col: '#cc8440' },
    { id: 'strug', name: '몸부림 장인', col: '#f0e090' },
    { id: 'hot', name: '앗뜨거!', col: '#fff3b0' },
    { id: 'fool', name: '바보야?', col: '#3aa860' },
    { id: 'remote', name: '리모컨 어디 갔어', col: '#8e8e8e' }
  ];
  const BY = {}; for (const t of LIST) BY[t.id] = t;
  const get = (k, d) => { try { const v = localStorage.getItem('injoo_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem('injoo_' + k, JSON.stringify(v)); } catch (e) {} };
  const T = {
    LIST, BY,
    owned() { return get('titles', {}); },
    has(id) { return !!T.owned()[id]; },
    // 새로 얻었으면 true. 화면에 알리도록 이벤트를 쏜다
    give(id) {
      if (!BY[id]) return false;
      const o = T.owned(); if (o[id]) return false;
      o[id] = Date.now(); set('titles', o);
      try { window.dispatchEvent(new CustomEvent('injoo-title', { detail: BY[id] })); } catch (e) {}
      return true;
    },
    count(k) { return get('tc', {})[k] || 0; },
    inc(k, n = 1) { const c = get('tc', {}); c[k] = (c[k] || 0) + n; set('tc', c); return c[k]; },
    flag(k) { const c = get('tc', {}); if (c[k]) return false; c[k] = 1; set('tc', c); return true; },
    // 쫄보킹: 쫄보 모드로 일반 엔딩 · 하드 엔딩 · 멀티 한 판
    checkZzol() { if (T.count('zzolN') && T.count('zzolH') && T.count('zzolM')) T.give('zzol'); },
    // VHS 수집가: 엔딩 4개 전부
    checkVhs(endings) { const e = endings || get('endings', {}); if (e.normal && e.hardBad && e.hardTrue && e.archive) T.give('vhs'); },
    // 푸른음악가의 편지 숫자 (사람마다 한 번 정해진다, 오르골 건반 1~5)
    blueCode() { let c = get('bluecode', ''); if (!/^[1-5]{4}$/.test(c) || c === '4444') { do { c = ''; for (let i = 0; i < 4; i++) c += 1 + (Math.random() * 5 | 0); } while (c === '4444'); set('bluecode', c); } return c; }
  };
  window.InjooTitles = T;
})();
