/* 全部词表页共享运行层（复用 W / K 的本地进度、闪卡与例句逻辑） */
(function () {
  'use strict';
  const cfg = window.ALL_CONFIG || {};
  const core = cfg.core === 'K' ? window.K : window.W;
  const ITEMS = window.ALL_ITEMS || [];
  const TOTAL = ITEMS.length;
  const BATCH = 120;
  const $ = s => document.querySelector(s);
  const pad = n => String(n).padStart(2, '0');

  let stateFilter = 'all';   // all | weak | done
  let weakOnly = false;
  let sortAZ = false;
  let blurred = false;
  let query = '';
  let filteredIndices = [];
  let rendered = 0;
  let swapT = 0;

  const INDEXED = ITEMS.map((r, idx) => ({
    idx,
    day: r[0],
    w: r[2],
    lower: r[2].toLowerCase(),
    blob: (r[2] + ' ' + (r[5] || '') + ' ' + r[4].map(s => s.slice(1).join(' ')).join(' ')).toLowerCase()
  }));
  const AZ_ORDER = INDEXED.slice().sort((a, b) => a.lower.localeCompare(b.lower)).map(x => x.idx);

  function isDone(idx) {
    const r = ITEMS[idx];
    return core.daySet(r[0]).has(r[2]);
  }

  function refreshProgress(animate) {
    let done = 0;
    for (let i = 0; i < TOTAL; i++) if (isDone(i)) done++;
    animate ? core.countTo($('#mDone'), done) : ($('#mDone').textContent = done);
    $('#mPct').textContent = (TOTAL ? (100 * done / TOTAL).toFixed(1) : '0.0') + '%';
    $('#mBar').style.width = (TOTAL ? (100 * done / TOTAL).toFixed(2) : '0') + '%';
    $('#mLeft').textContent = TOTAL - done;
  }

  function computeFiltered() {
    const q = query.trim().toLowerCase();
    const order = sortAZ ? AZ_ORDER : null;
    const out = [];
    for (let p = 0; p < TOTAL; p++) {
      const idx = order ? order[p] : p;
      const done = isDone(idx);
      if (weakOnly && done) continue;
      if (stateFilter === 'weak' && done) continue;
      if (stateFilter === 'done' && !done) continue;
      if (q && !INDEXED[idx].blob.includes(q)) continue;
      out.push(idx);
    }
    filteredIndices = out;
  }

  function hl(text, q) {
    if (!q) return core.esc(text);
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return core.esc(text);
    return core.esc(text.slice(0, i)) + '<mark>' + core.esc(text.slice(i, i + q.length)) + '</mark>' + core.esc(text.slice(i + q.length));
  }

  function rowHtml(idx, animOrder) {
    const r = ITEMS[idx];
    const [day, , w, ipa, senses, aid] = r;
    const q = query.trim().toLowerCase();
    const on = core.daySet(day).has(w);
    const sensesHtml = senses.map(s => {
      const pos = s[0], defs = s.slice(1);
      const body = defs.length
        ? defs.map(d => hl(d, q)).join('<span class="sep">·</span>')
        : '<span style="color:var(--faint)">—</span>';
      return `<div class="sline"><span class="pos">${core.esc(pos)}</span><span class="defs">${body}</span></div>`;
    }).join('');
    const aidHtml = aid ? `<div class="aid">${hl(aid, q)}</div>` : '';
    const dayHref = cfg.dayPrefix + pad(day) + '.html';
    return `<div class="wrow${on ? ' done' : ''}${blurred ? ' hide' : ''}" style="--i:${Math.min(animOrder || 0, 26)}" data-d="${day}" data-w="${core.esc(w)}" data-idx="${idx}">
      <div>
        <div class="head"><span class="w">${hl(w, q)}</span><span class="ipa">${core.esc(ipa)}</span></div>
        <div class="senses">${sensesHtml}</div>${aidHtml}
        <div class="src-tags"><a class="src-tag" href="${dayHref}">Day ${pad(day)} →</a></div>
      </div>
      <button class="mark" data-d="${day}" data-w="${core.esc(w)}" data-idx="${idx}" aria-label="标记已会">✓</button>
    </div>`;
  }

  function updateStats() {
    const b = $('#fstat b');
    if (b) b.textContent = filteredIndices.length;
    const empty = $('#fempty');
    if (!filteredIndices.length) {
      empty.hidden = false;
      if (query.trim()) {
        $('#emptyTitle').textContent = '没有匹配的词';
        $('#emptyDesc').textContent = `未找到包含「${query.trim()}」的词条，试试换个关键词。`;
        $('#feOff').textContent = '清空搜索';
      } else if (stateFilter === 'done') {
        $('#emptyTitle').textContent = '还没有已会词汇';
        $('#emptyDesc').textContent = '先回到全部词表，把认识的词勾选出来。';
        $('#feOff').textContent = '看全部词';
      } else {
        $('#emptyTitle').textContent = '这一批词都打勾了';
        $('#emptyDesc').textContent = '当前筛选下没有待巩固的不熟词。';
        $('#feOff').textContent = '看全部词';
      }
    } else {
      empty.hidden = true;
    }
  }

  function syncLoadbar() {
    const left = filteredIndices.length - rendered;
    const bar = $('#loadbar');
    if (left <= 0) { bar.hidden = true; return; }
    bar.hidden = false;
    $('#loadMoreBtn').textContent = `加载更多（还剩 ${left} 词）`;
    $('#loadAllBtn').hidden = left > 1200;
  }

  function appendBatch(count) {
    const host = $('#groups');
    const nextEnd = Math.min(filteredIndices.length, rendered + (count || BATCH));
    if (nextEnd <= rendered) { syncLoadbar(); return; }
    const chunk = [];
    for (let i = rendered; i < nextEnd; i++) {
      chunk.push(rowHtml(filteredIndices[i], i - rendered));
    }
    host.insertAdjacentHTML('beforeend', chunk.join(''));
    rendered = nextEnd;
    syncLoadbar();
  }

  function rebuildList() {
    computeFiltered();
    $('#groups').innerHTML = '';
    rendered = 0;
    updateStats();
    appendBatch(BATCH);
  }

  function swapList() {
    const host = $('#groups');
    clearTimeout(swapT);
    if (core.reduce) { rebuildList(); return; }
    host.classList.add('swapping');
    swapT = setTimeout(() => {
      rebuildList();
      swapT = setTimeout(() => host.classList.remove('swapping'), 40);
    }, 150);
  }

  $('#loadMoreBtn').onclick = () => appendBatch(BATCH);
  $('#loadAllBtn').onclick = () => appendBatch(filteredIndices.length - rendered);

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting) && rendered < filteredIndices.length) {
        appendBatch(BATCH);
      }
    }, { rootMargin: '600px 0px' });
    io.observe($('#sentinel'));
  }

  /* ── 轻提示（撤销）── */
  const toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.setAttribute('role', 'status');
  toastEl.innerHTML = '<span class="tmsg"></span><button class="tact" type="button"></button>';
  document.body.appendChild(toastEl);
  let toastTimer = 0;
  function hideToast() { toastEl.classList.remove('on'); }
  function toast(msg, actLabel, act) {
    toastEl.querySelector('.tmsg').textContent = msg;
    const b = toastEl.querySelector('.tact');
    b.textContent = actLabel || '';
    b.hidden = !actLabel;
    b.onclick = () => { hideToast(); if (act) act(); };
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, actLabel ? 7000 : 2600);
  }

  function dropRow(row, idx) {
    const r = ITEMS[idx];
    const [day, , word] = r;
    const finish = () => {
      row.remove();
      filteredIndices = filteredIndices.filter(x => x !== idx);
      rendered = Math.max(0, rendered - 1);
      updateStats();
      syncLoadbar();
      if (rendered < 40 && rendered < filteredIndices.length) appendBatch(BATCH);
    };
    if (core.reduce) {
      finish();
    } else {
      row.style.animation = 'none';
      row.style.height = row.offsetHeight + 'px';
      row.style.overflow = 'hidden';
      row.style.pointerEvents = 'none';
      row.classList.add('is-collapsing');
      void row.offsetHeight;
      requestAnimationFrame(() => {
        row.style.height = '0px';
        row.style.paddingTop = '0px';
        row.style.paddingBottom = '0px';
        row.classList.add('is-gone');
      });
      setTimeout(finish, 340);
    }
    toast('「' + word + '」已标为已会', '撤销', () => {
      core.toggle(day, word, false);
      refreshProgress(true);
      swapList();
    });
  }

  /* ── 事件绑定 ── */
  document.addEventListener('click', e => {
    const b = e.target.closest('.mark');
    if (!b) return;
    const d = +b.dataset.d, w = b.dataset.w, idx = +b.dataset.idx;
    const row = b.closest('.wrow');
    const on = core.toggle(d, w);
    row.classList.toggle('done', on);
    refreshProgress(true);
    if ((weakOnly || stateFilter === 'weak') && on) dropRow(row, idx);
    else if (stateFilter === 'done' && !on) dropRow(row, idx);
  });

  document.addEventListener('click', e => {
    const r = e.target.closest('.wrow.hide');
    if (r && !e.target.closest('button, a')) r.classList.toggle('show');
  });

  $('#q').addEventListener('input', e => {
    query = e.target.value;
    rebuildList();
  });

  document.querySelectorAll('#filters button').forEach(b => {
    b.onclick = () => {
      stateFilter = b.dataset.f;
      document.querySelectorAll('#filters button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      swapList();
    };
  });

  $('#filtBtn').onclick = () => {
    weakOnly = !weakOnly;
    $('#filtBtn').setAttribute('aria-pressed', String(weakOnly));
    swapList();
  };

  $('#feOff').onclick = () => {
    if (query.trim()) {
      query = '';
      $('#q').value = '';
      rebuildList();
      return;
    }
    if (weakOnly) {
      weakOnly = false;
      $('#filtBtn').setAttribute('aria-pressed', 'false');
    }
    stateFilter = 'all';
    document.querySelectorAll('#filters button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.f === 'all')));
    swapList();
  };

  $('#sortBtn').onclick = () => {
    sortAZ = !sortAZ;
    $('#sortBtn').setAttribute('aria-pressed', String(sortAZ));
    $('#sortBtn').textContent = sortAZ ? '默认顺序' : 'A–Z 排序';
    swapList();
  };

  $('#blurBtn').onclick = () => {
    blurred = !blurred;
    $('#blurBtn').textContent = blurred ? '显示释义' : '遮住释义';
    document.querySelectorAll('.wrow').forEach(r => {
      r.classList.toggle('hide', blurred);
      r.classList.remove('show');
    });
  };

  /* ── 闪卡 ── */
  let flash = null;
  function syncTicks() {
    document.querySelectorAll('#groups .wrow').forEach(r => {
      r.classList.toggle('done', core.daySet(+r.dataset.d).has(r.dataset.w));
    });
  }
  function openFlash() {
    if (!flash) {
      const deck = ITEMS.map(r => [r[0], r[1], r[2], r[3], r[4]]);
      flash = core.createFlash($('#flash'), deck, {
        onChange: () => { refreshProgress(true); syncTicks(); }
      });
    } else {
      flash.open();
    }
    $('#flash').classList.add('on');
  }
  function closeFlash() {
    $('#flash').classList.remove('on');
    document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-selected', String(x.dataset.mode === 'list')));
    if (weakOnly || stateFilter !== 'all') rebuildList();
  }
  $('#fClose').addEventListener('click', closeFlash);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#flash').classList.contains('on')) closeFlash();
  });
  $('#openFlashBtn').onclick = () => {
    document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-selected', String(x.dataset.mode === 'flash')));
    openFlash();
  };
  document.querySelectorAll('.seg button').forEach(b => b.onclick = () => {
    document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    if (b.dataset.mode === 'flash') openFlash();
  });

  /* ── 启动 ── */
  rebuildList();
  refreshProgress(true);
})();
