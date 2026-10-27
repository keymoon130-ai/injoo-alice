// 人柱愛麗絲 — 칭호 (스토리·멀티 공용). 이 기기의 기록으로 판정한다.
(function () {
  'use strict';
  const LIST = [
    { id: 'zzol', how: '쫄보 모드로 일반 엔딩과 하드 엔딩까지 보고, 멀티도 한 판 끝까지 하기', name: '쫄보킹', col: '#ff8fc0' },
    { id: 'red', how: '하드 1장에서 44번 죽기', pk: 'd1', pn: 44, name: '붉게물든자', col: '#e02a2a' },
    { id: 'blue', how: '하드 2장 극장 좌석에 숨겨진 비밀 편지를 읽고, 적힌 네 자리를 오르골로 연주하기', name: '푸른음악가', col: '#6a8cff' },
    { id: 'green', how: '하드 3장 시작 후 10초 동안 가만히 있으면 열리는 비밀 창에 오늘 날짜(MMDD) 적기', name: '녹색아가씨', col: '#3fbf6a' },
    { id: 'twin', how: '하드 4장 다과회장의 빈 손님 자리에 앉기', name: '노란 쌍둥이', col: '#e8c840' },
    { id: 'fifth', how: '멀티에서 MVP(다섯 번째 앨리스)로 30번 뽑히기', pk: 'mvp', pn: 30, name: '다섯 번째 앨리스', col: 'wave' },
    { id: 'alone', how: '멀티에서 최후의 앨리스가 되어 혼자 탈출하기', name: '홀로 남은 앨리스', col: '#c8ccd6' },
    { id: 'hidden', how: '멀티에서 꿈으로 은신 중에 앨리스 잡기 (숨은 꿈 모드)', name: '숨은 꿈', col: '#a878ec' },
    { id: 'small', how: '멀티에서 꿈으로 한 판에 앨리스 3명 이상 가두고 이기기', name: '작은 꿈', col: '#c0283a' },
    { id: 'vhs', how: '엔딩 4개(일반 · 하드 배드 · 하드 진엔딩 · 숨은 테이프) 모두 보기', name: 'VHS 수집가', col: '#e8b848' },
    { id: 'free', how: '멀티에서 앨리스가 이긴 판에, 탈출 말고는 점수 하나 없이 탈출하기', name: '무임승차', col: '#9c9c9c' },
    { id: 'jail', how: '멀티 한 판에서 감옥에 3번 이상 갇히기', name: '감옥 단골', col: '#cc8440' },
    { id: 'strug', how: '멀티에서 잡힌 뒤 몸부림으로 10번 빠져나오기', pk: 'strug', pn: 10, name: '몸부림 장인', col: '#f0e090' },
    { id: 'hot', how: '멀티에서 꿈으로 빛기둥에 5번 튕겨 나가기', pk: 'burn', pn: 5, name: '앗뜨거!', col: '#fff3b0' },
    { id: 'fool', how: '하드 3장에서 틀린 지목으로 「아니야.」 30번 듣기', pk: 'no3', pn: 30, name: '바보야?', col: '#3aa860' },
    { id: 'remote', how: '최종장에서 리모컨 찾는 데 3분 넘게 걸리기', name: '리모컨 어디 갔어', col: '#8e8e8e' }
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
    // 장착 (스토리·멀티 공용)
    equipped() { const v = get('title', null); return v && BY[v] && T.has(v) ? v : null; },
    equip(id) { set('title', id && BY[id] ? id : null); try { window.dispatchEvent(new CustomEvent('injoo-title-eq', { detail: id || null })); } catch (e) {} },
    // 칭호 고르는 칸: 얻은 건 이름과 색, 못 얻은 건 색만 ???. 올려 두면(폰은 누르면) 조건이 뜬다
    mountPanel(el) {
      if (!document.getElementById('injooTtlCss')) {
        const st = document.createElement('style'); st.id = 'injooTtlCss';
        st.textContent = `.ttlp{display:flex;flex-wrap:wrap;gap:5px;position:relative}
.ttlp .chip{font:700 11px 'Nanum Gothic Coding',monospace;padding:4px 7px;border-radius:3px;border:1px solid currentColor;background:rgba(10,8,9,.85);cursor:pointer;white-space:nowrap;line-height:1.2}
.ttlp .chip.lock{opacity:.55;cursor:help;border-style:dashed}
.ttlp .chip.on{box-shadow:0 0 0 2px currentColor inset,0 0 10px currentColor}
.ttlp .chip.none{color:#9a9088}
.ttlp .wave{background:linear-gradient(90deg,#111,#fff,#111,#fff,#111);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent!important;-webkit-text-stroke:.45px #8a8a8a;border-color:#bbb;animation:ttlwave2 2.6s linear infinite}
.ttlp .chip.wave{background-color:transparent}
@keyframes ttlwave2{from{background-position:0 0}to{background-position:-200% 0}}
.ttlp .tip{position:absolute;z-index:30;left:0;max-width:240px;padding:7px 9px;border:1px solid #6a6056;border-radius:3px;background:#0c0a0b;color:#e8e0d0;font:11px/1.45 'Nanum Gothic Coding',monospace;pointer-events:none;white-space:normal;box-shadow:0 4px 14px rgba(0,0,0,.6)}
.ttlp .tip b{display:block;margin-bottom:3px}
.ttlp .cnt{width:100%;font:10px 'Nanum Gothic Coding',monospace;color:#8d8478}`;
        document.head.append(st);
      }
      el.classList.add('ttlp');
      const draw = () => {
        el.textContent = '';
        let eq = T.equipped(), n = 0; const chips = [];
        const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true;
        const showTip = (chip, t) => {
          tip.textContent = '';
          const b = document.createElement('b'); b.textContent = t ? (T.has(t.id) ? t.name : '???') : '칭호 떼기'; if (t && t.col !== 'wave') b.style.color = t.col; tip.append(b);
          tip.append(document.createTextNode(t ? t.how + (t.pk ? ` (${Math.min(T.count(t.pk), t.pn)} / ${t.pn})` : '') + (T.has(t.id) ? (eq === t.id ? ' · 장착 중' : ' · 누르면 장착') : ' · 아직 못 얻었어요') : '이름 옆에 칭호를 달지 않아요'));
          tip.hidden = false;
          const r = chip.getBoundingClientRect(), pr = el.getBoundingClientRect(), sc = pr.width / el.offsetWidth || 1;
          const x = Math.max(0, Math.min((r.left - pr.left) / sc, el.offsetWidth - 240)), y = (r.top - pr.top) / sc;
          tip.style.left = x + 'px'; tip.style.top = ''; tip.style.bottom = (el.offsetHeight - y + 4) + 'px';
        };
        const add = t => {
          const c = document.createElement('button'); c.type = 'button';
          const own = t && T.has(t.id); if (own) n++;
          c.className = 'chip' + (!t ? ' none' : '') + (t && !own ? ' lock' : '') + (t && t.col === 'wave' ? ' wave' : '') + ((t ? eq === t.id : !eq) ? ' on' : '');
          if (t && t.col !== 'wave') c.style.color = t.col;
          c.textContent = !t ? '없음' : own ? t.name : '???';
          c.addEventListener('mouseenter', () => showTip(c, t)); c.addEventListener('mouseleave', () => { tip.hidden = true; });
          c.addEventListener('click', () => {
            if (!t || own) { T.equip(t ? t.id : null); eq = t ? t.id : null; for (const [cc, tt] of chips) cc.classList.toggle('on', tt ? eq === tt.id : !eq); }
            showTip(c, t); clearTimeout(tip._tt); tip._tt = setTimeout(() => { tip.hidden = true; }, 2600);
          });
          chips.push([c, t]); el.append(c);
        };
        add(null); for (const t of LIST) add(t);
        const cnt = document.createElement('div'); cnt.className = 'cnt'; cnt.textContent = `모은 칭호 ${n} / ${LIST.length}`; el.append(cnt);
        el.append(tip);
      };
      draw();
      window.addEventListener('injoo-title', draw);
      return { redraw: draw };
    },
    // 푸른음악가의 편지 숫자 (사람마다 한 번 정해진다, 오르골 건반 1~5)
    blueCode() { let c = get('bluecode', ''); if (!/^[1-5]{4}$/.test(c) || c === '4444') { do { c = ''; for (let i = 0; i < 4; i++) c += 1 + (Math.random() * 5 | 0); } while (c === '4444'); set('bluecode', c); } return c; }
  };
  window.InjooTitles = T;
})();
