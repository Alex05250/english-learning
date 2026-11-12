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

  /* ── 闪卡组件 ── */
  function createFlash(root, deck, opts) {
    opts = opts || {};
    let ci = 0, flip = false, pool = deck.slice(), drawTimer = 0;
    const roundWeak = new Set();          // 本轮标过「不熟」的词，供「重测」用
    let tx = 0, ty = 0, tt = 0, tapLock = 0;
    const $ = s => root.querySelector(s);
    const card = $('#fcard');
    const stage = $('.fstage') || card;

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
      draw();
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
      clearTimeout(drawTimer); drawTimer = setTimeout(draw, 60);
    }
    card.onclick = () => { if (Date.now() < tapLock) return; flip = !flip; card.classList.toggle('flip', flip); };
    card.onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); card.onclick(); } };
    $('#fYes').onclick = () => advance(true);
    $('#fNo').onclick = () => advance(false);
    $('#fShuffle').onclick = () => { pool.sort(() => Math.random() - .5); roundWeak.clear(); syncRetest(); ci = 0; flip = false; card.classList.remove('flip'); draw(); };

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
      syncRetest(); draw();
    };
    function syncRetest() {
      retest.textContent = roundWeak.size ? '重测（' + roundWeak.size + '）' : '重测';
      retest.title = roundWeak.size
        ? '重测本轮标过「不熟」的 ' + roundWeak.size + ' 个词'
        : '本轮没有标「不熟」的词，点一下从第 1 张重来';
    }
    syncRetest();

    /* 键盘 ←→（仅在当前闪卡面板可见时生效） */
    function onKey(e) {
      if (!root.classList.contains('on')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      go(e.key === 'ArrowRight' ? 1 : -1);
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
    if ($('#fClose')) $('#fClose').onclick = () => root.classList.remove('on');
    function reset() {
      pool = (opts.weakActive ? deck.filter(r => !daySet(r[0]).has(r[2])) : deck.slice()).slice();
      if (!pool.length) pool = deck.slice();
      roundWeak.clear(); syncRetest();
      ci = 0; flip = false; card.classList.remove('flip');
      draw();
    }
    if ($('#fWeak')) $('#fWeak').onclick = () => {
      opts.weakActive = !opts.weakActive;
      $('#fWeak').textContent = opts.weakActive ? '练全部' : '只练未熟';
      reset();
    };
    draw();
    return {
      redraw: draw, reset,
      open() { ci = 0; flip = false; card.classList.remove('flip'); draw(); }
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
(function(){var s=document.createElement('script');s.src=new URL('word-usage.js?v=20261112a',document.currentScript.src).href;document.head.appendChild(s);}());
