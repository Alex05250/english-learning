/* CET-6 词汇站 · 共享运行层 */
(function (global) {
  'use strict';
  const LS = n => 'cet6-day-' + n;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ── 进度存取：key 与原版一致 cet6-day-N ── */
  const doneCache = new Map();
  function daySet(d) {
    if (!doneCache.has(d)) {
      let o = {};
      try { o = JSON.parse(localStorage.getItem(LS(d)) || '{}') || {}; } catch (e) { o = {}; }
      doneCache.set(d, new Set(Object.keys(o).filter(k => o[k])));
    }
    return doneCache.get(d);
  }
  function saveDay(d) {
    const s = daySet(d);
    if (!s.size) { try { localStorage.removeItem(LS(d)); } catch (e) {} return; }
    const o = {};
    s.forEach(w => { o[w] = true; });
    try { localStorage.setItem(LS(d), JSON.stringify(o)); } catch (e) {}
  }
  function toggle(d, w, on) {
    const s = daySet(d);
    const next = (on === undefined) ? !s.has(w) : !!on;
    next ? s.add(w) : s.delete(w);
    saveDay(d);
    return next;
  }
  function countDay(d) { return daySet(d).size; }
  /* 清空某天全部打勾，返回被清掉的词，供撤销 */
  function clearDay(d) {
    const s = daySet(d), had = Array.from(s);
    s.clear();
    saveDay(d);
    return had;
  }
  /* 批量补回打勾（撤销用） */
  function addWords(d, words) {
    const s = daySet(d);
    (words || []).forEach(w => s.add(w));
    saveDay(d);
    return s.size;
  }

  /* ── 数字滚动 ── */
  function countTo(el, to, dur) {
    dur = dur || 620;
    const from = parseInt(el.textContent, 10) || 0;
    if (from === to || reduce) { el.textContent = to; return; }
    const t0 = performance.now();
    (function step(t) {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ── 词条渲染：item = [n, w, ipa, [[pos, ...defs], ...], aid?] ── */
  function rowHtml(day, item, i, opts) {
    opts = opts || {};
    const [n, w, ipa, senses, aid] = item;
    const on = daySet(day).has(w);
    const sensesHtml = senses.map(s => {
      const pos = s[0], defs = s.slice(1);
      const body = defs.length
        ? defs.map(esc).join('<span class="sep">·</span>')
        : '<span style="color:var(--faint)">—</span>';
      return `<div class="sline"><span class="pos">${esc(pos)}</span><span class="defs">${body}</span></div>`;
    }).join('');
    const aidHtml = (opts.showAid && aid) ? `<div class="aid">${esc(aid)}</div>` : '';
    return `<div class="wrow${on ? ' done' : ''}${opts.blur ? ' hide' : ''}" style="--i:${Math.min(i || 0, 26)}" data-w="${esc(w)}">
      <div>
        <div class="head"><span class="w">${esc(w)}</span><span class="ipa">${esc(ipa)}</span></div>
        <div class="senses">${sensesHtml}</div>${aidHtml}
      </div>
      <button class="mark" data-d="${day}" data-w="${esc(w)}" aria-label="标记已会">✓</button>
    </div>`;
  }

  /* ── 闪卡：键盘操作 + 位置持久化 ── */
  const flashKey = n => 'cet6-card-' + n;
  /* 桌面浏览器：细指针 + 悬停能力，且视口够宽；手机/平板不弹键盘提示 */
  const desktop = () => !!(matchMedia('(hover:hover) and (pointer:fine)').matches && innerWidth >= 900);

  function createFlash(root, deck, opts) {
    opts = opts || {};
    const storeKey = opts.store ? flashKey(opts.store) : '';
    const byWord = new Map();
    deck.forEach(r => { if (!byWord.has(r[2])) byWord.set(r[2], r); });
    const fatDeck = deck.length > 400;    // 总复习大盘：只记位置，不记洗牌顺序

    let ci = 0, flip = false, pool = deck.slice(), drawTimer = 0, resumed = null;
    let roundWeak = new Set();            // 本轮标过「不熟」的词，供「重测」用
    let tx = 0, ty = 0, tt = 0, tapLock = 0;
    const $ = s => root.querySelector(s);
    const card = $('#fcard');
    const stage = $('.fstage') || card;

    /* ── 关掉再进来接着背：位置 / 不熟 / 只练未熟 / 洗牌顺序 ── */
    function readState() {
      if (!storeKey) return null;
      try {
        const o = JSON.parse(localStorage.getItem(storeKey) || 'null');
        return o && typeof o === 'object' ? o : null;
      } catch (e) { return null; }
    }
    function saveState() {
      if (!storeKey) return;
      const o = { v: 1, i: pool.length ? ci % pool.length : 0, weak: opts.weakActive ? 1 : 0, rw: Array.from(roundWeak) };
      if (!fatDeck) o.pool = pool.map(r => r[2]);
      try { localStorage.setItem(storeKey, JSON.stringify(o)); } catch (e) {}
    }
    function restoreState() {
      const st = readState();
      if (!st) return;
      if (st.weak && $('#fWeak')) { opts.weakActive = true; $('#fWeak').textContent = '练全部'; }
      if (!fatDeck && Array.isArray(st.pool) && st.pool.length) {
        const p = st.pool.map(w => byWord.get(w)).filter(Boolean);
        if (p.length) pool = p;
      } else if (opts.weakActive) {
        const p = deck.filter(r => !daySet(r[0]).has(r[2]));
        if (p.length) pool = p;
      }
      roundWeak = new Set((Array.isArray(st.rw) ? st.rw : []).filter(w => byWord.has(w)));
      const i = Math.max(0, parseInt(st.i, 10) || 0);
      ci = pool.length ? Math.min(i, pool.length - 1) : 0;
      syncRetest();
      if (ci > 0 || roundWeak.size) resumed = { pos: ci + 1, total: pool.length };
    }
    addEventListener('pagehide', saveState);

    /* 翻页导航：‹ 上一张 | 3 / 186 | 下一张 ›（按钮 / ←→ / 左右滑动三通道） */
    const nav = document.createElement('div');
    nav.className = 'fnav';
    nav.innerHTML = '<button class="fnbtn" type="button" data-d="-1" aria-label="上一张">‹ 上一张</button>'
      + '<button class="fnbtn" type="button" data-d="1" aria-label="下一张">下一张 ›</button>';
    const prevB = nav.querySelector('[data-d="-1"]'), nextB = nav.querySelector('[data-d="1"]');
    const meta = $('#fmeta');
    if (meta && meta.parentNode) {
      meta.parentNode.insertBefore(nav, meta);
      meta.setAttribute('aria-live', 'polite');
      nav.insertBefore(meta, nextB);
    }

    function sync() {
      const n = pool.length;
      prevB.disabled = nextB.disabled = n < 2;
      nav.style.display = n ? '' : 'none';
    }

    function go(delta) {
      if (pool.length < 2) return;
      clearTimeout(drawTimer);
      ci = ((ci % pool.length) + delta + pool.length) % pool.length;
      flip = false; card.classList.remove('flip');
      draw(); saveState();
      if (!reduce) { card.classList.remove('fswap'); void card.offsetWidth; card.classList.add('fswap'); }
    }
    prevB.onclick = () => go(-1);
    nextB.onclick = () => go(1);
    function draw() {
      if (!pool.length) {
        $('#fw').textContent = '没有词';
        $('#fmeta').textContent = '';
        $('#fi').textContent = '';
        $('#bw').textContent = '';
        $('#bi').textContent = '';
        $('#bm').textContent = '';
        sync();
        return;
      }
      const r = pool[ci % pool.length];
      const [d, n, w, ipa, senses] = r;
      const sub = (ipa || '') + '　·　Day ' + String(d).padStart(2, '0');
      $('#fw').textContent = w; $('#fi').textContent = sub;
      $('#bw').textContent = w; $('#bi').textContent = sub;
      $('#bm').textContent = senses.map(s => s[0] + ' ' + s.slice(1).join('、')).join('\n');
      $('#fmeta').textContent = (ci % pool.length + 1) + ' / ' + pool.length + (opts.label ? '　' + opts.label() : '');
      sync();
    }
    function advance(known) {
      const r = pool[ci % pool.length];
      if (r) {
        toggle(r[0], r[2], known);
        if (opts.onChange) opts.onChange(r[0]);
        if (known) roundWeak.delete(r[2]); else roundWeak.add(r[2]);
        syncRetest();
      }
      ci++; flip = false; card.classList.remove('flip');
      saveState();
      clearTimeout(drawTimer); drawTimer = setTimeout(draw, 60);
    }
    function flipCard() { if (!pool.length) return; flip = !flip; card.classList.toggle('flip', flip); }
    card.onclick = () => { if (Date.now() < tapLock) return; flipCard(); };
    $('#fYes').onclick = () => advance(true);
    $('#fNo').onclick = () => advance(false);
    $('#fShuffle').onclick = () => {
      const a = pool.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      pool = a; roundWeak.clear(); syncRetest();
      ci = 0; flip = false; card.classList.remove('flip');
      draw(); saveState();
    };

    /* 重测：本轮标过「不熟」的词重刷一遍；本轮没有不熟就从第 1 张整轮重来 */
    const retest = document.createElement('button');
    retest.type = 'button';
    retest.className = 'pill';
    retest.id = 'fRetest';
    retest.setAttribute('aria-label', '重测');
    $('#fShuffle').after(retest);
    retest.onclick = () => {
      if (roundWeak.size) pool = deck.filter(r => roundWeak.has(r[2])).slice();
      else pool = deck.slice();
      if (!pool.length) pool = deck.slice();
      roundWeak.clear();
      if (opts.weakActive) { opts.weakActive = false; if ($('#fWeak')) $('#fWeak').textContent = '只练未熟'; }
      ci = 0; flip = false; card.classList.remove('flip');
      syncRetest(); draw(); saveState();
    };
    function syncRetest() {
      retest.textContent = roundWeak.size ? '重测（' + roundWeak.size + '）' : '重测';
      retest.title = roundWeak.size
        ? '重测本轮标过「不熟」的 ' + roundWeak.size + ' 个词'
        : '本轮没有标「不熟」的词，点一下从第 1 张重来';
    }
    syncRetest();

    /* 键盘：← → 翻页，空格翻面，1 不熟，2 已会，S 洗牌，R 重测，? 再唤提示
       仅在当前闪卡面板可见时生效；输入框里打字不抢键 */
    function onKey(e) {
      if (!root.classList.contains('on')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      const k = e.key;
      if (k === 'Escape') {
        hideCoach();
        if ($('#fClose')) { root.classList.remove('on'); saveState(); }
        return;
      }
      if (k === '?') { e.preventDefault(); showCoach(resumed); return; }
      if (k === 'ArrowLeft') { e.preventDefault(); go(-1); return; }
      if (k === 'ArrowRight') { e.preventDefault(); go(1); return; }
      if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
        // 回车留给已获得焦点的按钮，其余一律翻面；空格始终翻面（按钮的回车/空格默认行为被拦掉）
        if (k === 'Enter' && t && t.closest && t.closest('button')) return;
        e.preventDefault(); flipCard(); return;
      }
      if (k === '1' || k === 'j' || k === 'J') { e.preventDefault(); advance(false); return; }
      if (k === '2' || k === 'k' || k === 'K') { e.preventDefault(); advance(true); return; }
      if (k === 's' || k === 'S') { e.preventDefault(); $('#fShuffle').click(); return; }
      if (k === 'r' || k === 'R') { e.preventDefault(); retest.click(); return; }
    }
    document.addEventListener('keydown', onKey);

    /* 左右滑动：横向位移 ≥46px、明显大于纵向、900ms 内 */
    stage.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) { tx = ty = 0; return; }
      tx = e.touches[0].clientX; ty = e.touches[0].clientY; tt = Date.now();
    }, { passive: true });
    stage.addEventListener('touchcancel', () => { tx = ty = 0; }, { passive: true });
    stage.addEventListener('touchend', e => {
      const t = e.changedTouches && e.changedTouches[0];
      if (!t || (!tx && !ty)) { tx = ty = 0; return; }
      const dx = t.clientX - tx, dy = t.clientY - ty, dt = Date.now() - tt;
      tx = ty = 0;
      if (dt > 900 || Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      tapLock = Date.now() + 420;
      go(dx < 0 ? 1 : -1);
    }, { passive: true });
    /* ── 桌面端键盘教练：进入卡片弹一次、5 秒自收；按 ? 可再唤出 ── */
    const COACH_MS = 5000;
    let coach = null, coachTimer = 0, coachLeave = 0, hinted = false;

    function buildCoach() {
      const el = document.createElement('div');
      el.className = 'kbcoach';
      el.setAttribute('role', 'status');
      el.innerHTML = '<div class="kbc-row">'
        + '<span class="kbc-key" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="1.8" y="5.6" width="20.4" height="12.8" rx="3"/>'
        + '<path d="M5.6 9.6h.01M9.2 9.6h.01M12.8 9.6h.01M16.4 9.6h.01M5.6 12.8h.01M9.2 12.8h.01M12.8 12.8h.01M16.4 12.8h.01M8.2 16h7.6"/></svg></span>'
        + '<div class="kbc-body"><p class="kbc-t">用键盘背单词</p>'
        + '<p class="kbc-sub"><span><kbd>←</kbd><kbd>→</kbd>上一张 · 下一张</span>'
        + '<span><kbd>空格</kbd>翻面</span><span><kbd>1</kbd>不熟</span><span><kbd>2</kbd>已会</span></p>'
        + '<p class="kbc-resume" hidden></p></div>'
        + '<button class="kbc-x" type="button" aria-label="关闭键盘提示">知道了</button>'
        + '</div><i class="kbc-bar" aria-hidden="true"></i>';
      document.body.appendChild(el);
      el.querySelector('.kbc-x').onclick = hideCoach;
      return el;
    }

    function hideCoach() {
      clearTimeout(coachTimer);
      if (!coach || !coach.classList.contains('on')) return;
      coach.classList.add('leaving');
      coach.classList.remove('on');
      clearTimeout(coachLeave);
      coachLeave = setTimeout(() => { if (coach) coach.classList.remove('leaving'); }, 340);
    }

    function showCoach(info) {
      if (!desktop()) return;
      if (!coach) coach = buildCoach();
      const note = coach.querySelector('.kbc-resume');
      note.hidden = !info;
      if (info) note.textContent = '上次停在第 ' + info.pos + ' / ' + info.total + ' 张，已经接上';
      // 重放：进度条归位再走 5 秒，浮层重新入场
      const bar = coach.querySelector('.kbc-bar');
      bar.style.transition = 'none';
      bar.style.transform = 'scaleX(1)';
      coach.classList.remove('on');
      void coach.offsetWidth;
      bar.style.transition = 'transform ' + COACH_MS + 'ms linear';
      bar.style.transform = 'scaleX(0)';
      coach.classList.add('on');
      clearTimeout(coachTimer);
      coachTimer = setTimeout(hideCoach, COACH_MS);
    }

    /* 每次进卡片面板只自动提示一次，打扰可控 */
    function hint() {
      if (hinted || !desktop()) return;
      hinted = true;
      showCoach(resumed);
    }

    if ($('#fClose')) $('#fClose').onclick = () => { root.classList.remove('on'); saveState(); };
    function reset() {
      pool = (opts.weakActive ? deck.filter(r => !daySet(r[0]).has(r[2])) : deck.slice()).slice();
      if (!pool.length) pool = deck.slice();
      roundWeak.clear(); syncRetest();
      ci = 0; flip = false; card.classList.remove('flip');
      draw(); saveState();
    }
    if ($('#fWeak')) $('#fWeak').onclick = () => {
      opts.weakActive = !opts.weakActive;
      $('#fWeak').textContent = opts.weakActive ? '练全部' : '只练未熟';
      reset();
    };
    if (desktop() && $('#fh')) $('#fh').textContent = '空格翻面 · ← → 翻页 · 1 不熟 · 2 已会';
    restoreState();
    draw();
    return {
      redraw: draw, reset, hint, save: saveState,
      open() {
        // 索引页的搜索框可能还留着焦点，不清掉会把 1 / 2 / 空格 都吃掉
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        flip = false; card.classList.remove('flip'); draw(); hint();
      }
    };
  }

  /* ── 卡片错峰入场 ── */
  function revealCards(sel) {
    const cards = [].slice.call(document.querySelectorAll(sel));
    // 兜底：观察器不可用或回调被裁掉时，卡片绝不能停在 opacity:0
    setTimeout(() => cards.forEach(c => c.classList.add('in')), 900);
    if (reduce || !('IntersectionObserver' in window)) { cards.forEach(c => c.classList.add('in')); return; }
    const io = new IntersectionObserver(es => {
      es.forEach(en => {
        if (!en.isIntersecting) return;
        const i = cards.indexOf(en.target);
        setTimeout(() => en.target.classList.add('in'), Math.min(i, 22) * 38);
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -40px 0px' });
    cards.forEach(c => io.observe(c));
  }

  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function onScroll() {
    document.body.classList.toggle('scrolled', scrollY > 6);
    document.body.classList.toggle('deep', scrollY > 480);
  }

  /* 回到顶部：吸顶导航右上角的 ↑ */
  const toTop = document.getElementById('toTop');
  if (toTop) toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));

  global.W = { LS, esc, reduce, sleep, daySet, saveDay, toggle, countDay, clearDay, addWords, countTo, rowHtml, createFlash, revealCards };
})(window);

/* 真题例句：异步加载，失败时原词表仍可正常使用 */
(function(){var s=document.createElement('script');s.src=new URL('word-usage.js?v=20261114a',document.currentScript.src).href;document.head.appendChild(s);}());
