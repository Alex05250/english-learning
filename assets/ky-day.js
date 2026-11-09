/* 考研大纲词汇站 · 单天页：词表 / 闪卡 / 测验 / 回顾 */
(function () {
  'use strict';
  const D = window.KY_DATA;                 // [day, start, end, count, [reviewDay,...], items, reviewMeta]
  const [DAY, START, END, COUNT, REVIEW, ITEMS, RMETA] = D;
  const $ = s => document.querySelector(s);
  const pad = n => String(n).padStart(2, '0');

  /* ── 进度 ── */
  function refresh(animate) {
    const k = K.countDay(DAY);
    animate ? K.countTo($('#dDone'), k) : ($('#dDone').textContent = k);
    $('#dBar').style.width = (100 * k / COUNT).toFixed(1) + '%';
    $('#dPct').textContent = Math.round(100 * k / COUNT) + '%';
    document.querySelectorAll('details.group').forEach(g => {
      const gd = +g.dataset.g, part = ITEMS.slice(gd * 46, gd * 46 + 46);
      const n = part.filter(it => K.daySet(DAY).has(it[1])).length;
      const meta = g.querySelector('.gmeta');
      if (meta) meta.textContent = `${n}/${part.length} 已会`;
      const bar = g.querySelector('.gbar i');
      if (bar) bar.style.width = (100 * n / part.length).toFixed(0) + '%';
    });
    document.querySelectorAll('.rcard').forEach(c => {
      const d = +c.dataset.d, total = +c.dataset.n, k2 = K.countDay(d);
      c.querySelector('.rnum b').textContent = k2;
      c.querySelector('.rbar i').style.width = (100 * k2 / total).toFixed(1) + '%';
      c.classList.toggle('full', k2 === total);
    });
    clearBtn.disabled = !k;
    if (weakOnly) stat();
  }

  /* ── 词表 ── */
  const GROUP = 46;
  let blurred = false, weakOnly = false, savedOpen = null;
  const built = new Set();

  const groupEls = () => [].slice.call(document.querySelectorAll('#groups details.group'));
  const groupOf = g => document.querySelector('#groups details.group[data-g="' + g + '"]');
  const weakLeft = () => Math.max(0, ITEMS.length - K.countDay(DAY));

  /* 只建/重建某一组的行：懒加载与「只看不熟」共用 */
  function fillGroup(g) {
    const el = groupOf(g);
    if (!el || built.has(g)) return;
    const set = K.daySet(DAY);
    const all = ITEMS.slice(g * GROUP, g * GROUP + GROUP);
    const part = weakOnly ? all.filter(it => !set.has(it[1])) : all;
    el.querySelector('[data-host]').innerHTML =
      part.map((it, i) => K.rowHtml(DAY, it, i, { blur: blurred })).join('');
    built.add(g);
  }

  function buildGroups() {
    const host = $('#groups');
    const set = K.daySet(DAY);
    built.clear();
    const parts = [];
    for (let i = 0; i < ITEMS.length; i += GROUP) {
      const g = i / GROUP, all = ITEMS.slice(i, i + GROUP);
      const left = all.filter(it => !set.has(it[1])).length;
      if (weakOnly && !left) continue;                       // 过滤态：整组都熟了就不渲染
      const n = all.length - left, w = (100 * n / all.length).toFixed(0);
      parts.push('<details class="group" data-g="' + g + '"' + (weakOnly ? ' open' : '') + '>'
        + '<summary><span class="gname">第 ' + (g + 1) + ' 组</span>'
        + '<span class="gmeta">' + n + '/' + all.length + ' 已会</span>'
        + '<span class="gbar"><i style="width:' + w + '%"></i></span>'
        + '<span class="chev">▶</span></summary>'
        + '<div class="rows" style="padding:0" data-host="' + g + '"></div>'
        + '</details>');
    }
    host.innerHTML = parts.join('');
    groupEls().forEach(el => {
      el.addEventListener('toggle', () => { if (el.open) fillGroup(+el.dataset.g); });
    });
    if (weakOnly) {
      groupEls().forEach(el => fillGroup(+el.dataset.g));     // 过滤态全部展开，省一次点击
    } else if (savedOpen) {
      savedOpen.forEach(([g, open]) => { const el = groupOf(g); if (el) el.open = open; });
      savedOpen = null;
    } else {
      const first = groupEls()[0];
      if (first) { first.open = true; fillGroup(+first.dataset.g); }
    }
    setEmpty();
  }

  $('#blurBtn').onclick = () => {
    blurred = !blurred;
    $('#blurBtn').textContent = blurred ? '显示释义' : '遮住释义';
    document.querySelectorAll('.wrow').forEach(r => {
      r.classList.toggle('hide', blurred);
      r.classList.remove('show');
    });
  };

  /* ── 只看不熟：过滤词表，只留未打勾的词 ── */
  const filtBtn = $('#filtBtn');
  const fstat = $('#fstat');
  let swapT = 0;

  function stat() {
    const b = fstat && fstat.querySelector('b');
    if (b) b.textContent = weakLeft();
  }

  function setEmpty() {
    $('#fempty').hidden = !(weakOnly && weakLeft() === 0);
  }

  /* 整段列表先淡出、重建后再淡入，避免切换过滤时内容硬跳 */
  function swapList() {
    const host = $('#groups');
    clearTimeout(swapT);
    if (K.reduce) { buildGroups(); refresh(true); return; }
    host.classList.add('swapping');
    swapT = setTimeout(() => {
      buildGroups();
      refresh(true);
      swapT = setTimeout(() => host.classList.remove('swapping'), 40);
    }, 170);
  }

  filtBtn.onclick = () => {
    weakOnly = !weakOnly;
    filtBtn.setAttribute('aria-pressed', String(weakOnly));
    fstat.classList.toggle('on', weakOnly);
    if (weakOnly) savedOpen = groupEls().map(el => [+el.dataset.g, el.open]);
    stat();
    swapList();
  };
  $('#feOff').onclick = () => filtBtn.click();

  /* 过滤态下打勾：该行淡出收合，所在组空了整组收合 */
  function dropRow(row, word) {
    const grp = row.closest('details.group');
    const g = grp ? +grp.dataset.g : -1;
    const finish = () => {
      row.remove();
      const el = groupOf(g);
      if (el && !el.querySelector('.wrow')) dropGroup(el);
      setEmpty();
    };
    if (K.reduce) {
      finish();
    } else {
      row.style.animation = 'none';
      row.style.height = row.offsetHeight + 'px';
      row.style.overflow = 'hidden';
      row.style.pointerEvents = 'none';   // 收合途中不再接受点击，避免同一行被连续切换
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
      K.toggle(DAY, word, false);
      swapList();
    });
  }

  function dropGroup(el) {
    if (K.reduce) { el.remove(); return; }
    el.style.height = el.offsetHeight + 'px';
    el.style.overflow = 'hidden';
    el.classList.add('is-collapsing');
    void el.offsetHeight;
    requestAnimationFrame(() => {
      el.style.height = '0px';
      el.classList.add('is-gone');
    });
    setTimeout(() => el.remove(), 340);
  }

  /* ── 清空打勾（带回撤销）── */
  const clearBtn = $('#clearBtn');
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

  function paintTicks() {
    const set = K.daySet(DAY);
    document.querySelectorAll('#groups .wrow').forEach(r => {
      r.classList.toggle('done', set.has(r.dataset.w));
    });
  }

  /* 过滤态下批量改动 = 列表内容整体变化，直接重建；否则只刷打勾态 */
  function afterBulk() {
    if (weakOnly) buildGroups(); else paintTicks();
  }

  clearBtn.onclick = () => {
    const had = K.clearDay(DAY);
    if (!had.length) return;
    afterBulk();
    flash.reset();
    refresh(true);
    toast('已清空本页 ' + had.length + ' 个勾', '撤销', () => {
      K.addWords(DAY, had);
      afterBulk();
      flash.reset();
      refresh(true);
    });
  };

  document.addEventListener('click', e => {
    const b = e.target.closest('.mark'); if (!b) return;
    const row = b.closest('.wrow');
    const on = K.toggle(DAY, b.dataset.w);
    row.classList.toggle('done', on);
    refresh(true);
    if (weakOnly && on) dropRow(row, b.dataset.w);
  });
  document.addEventListener('click', e => {
    const r = e.target.closest('.wrow.hide');
    if (r && !e.target.closest('button')) r.classList.toggle('show');
  });

  /* ── 闪卡 ── */
  const deck = ITEMS.map(it => [DAY, it[0], it[1], it[2], it[3]]);
  const flash = K.createFlash($('#p-card'), deck, { onChange: () => refresh(true) });

  /* ── 测验：覆盖当天全部词，一题一个词，随机顺序 ── */
  let qs = [], qi = 0, navTimer = 0;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };

  const shortDef = it => {
    const s = it[3][0];
    const txt = s.slice(1).slice(0, 2).join('、');
    return (s[0] ? s[0] + ' ' : '') + (txt || '—');
  };

  const qbar = document.createElement('div');
  qbar.className = 'qbar';
  qbar.innerHTML = '<i></i>';
  $('#qmeta').before(qbar);
  const qfill = qbar.firstChild;

  /* 上一题 / 下一题：手动翻页会取消自动跳转 */
  const qnav = document.createElement('div');
  qnav.className = 'qnav';
  qnav.innerHTML = '<button class="qbtn" type="button" id="qPrev" aria-label="上一题">‹ 上一题</button>'
    + '<span class="qpos" id="qpos" aria-live="polite"></span>'
    + '<button class="qbtn" type="button" id="qNext" aria-label="下一题">下一题 ›</button>';
  $('#opts').after(qnav);
  const qPrev = qnav.querySelector('#qPrev'), qNext = qnav.querySelector('#qNext'), qPos = qnav.querySelector('#qpos');
  qPrev.onclick = () => jump(-1);
  qNext.onclick = () => jump(1);

  function jump(delta) {
    clearTimeout(navTimer);
    if (!qs.length) return;
    if (delta > 0 && qi >= qs.length - 1) { qi = qs.length; drawQuiz(); return; }
    qi = Math.max(0, qi + delta);
    drawQuiz();
  }

  document.addEventListener('keydown', e => {
    if (!$('#p-quiz').classList.contains('on')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    jump(e.key === 'ArrowRight' ? 1 : -1);
  });

  let wrongBtn = null;
  function clearWrongBtn() { if (wrongBtn) { wrongBtn.remove(); wrongBtn = null; } }

  function buildQuiz(subset) {
    const src = (subset && subset.length) ? subset : ITEMS;
    qs = shuffle(src.slice()).map(it => {
      const ans = shortDef(it);
      let cands = ITEMS.filter(x => x[1] !== it[1] && shortDef(x) !== ans);
      if (cands.length < 3) cands = ITEMS.filter(x => x[1] !== it[1]);
      return { it, opts: shuffle([it].concat(shuffle(cands.slice()).slice(0, 3))), picked: null, ok: false };
    });
    qi = 0;
    clearTimeout(navTimer);
    $('#qAgain').style.display = 'none';
    $('#qAgain').textContent = '重测全部 ' + ITEMS.length + ' 词';
    clearWrongBtn();
    drawQuiz();
  }

  const hits = () => qs.filter(q => q.ok).length;

  function paintAnswer(q) {
    $('#opts').querySelectorAll('.opt').forEach(b => {
      if (b.dataset.w === q.it[1]) b.classList.add('right');
      else if (b.dataset.w === q.picked) b.classList.add('wrong');
    });
  }

  function answer(q, btn) {
    if (q.picked) return;
    const right = btn.dataset.w === q.it[1];
    q.picked = btn.dataset.w; q.ok = right;
    K.toggle(DAY, q.it[1], right);
    refresh(true);
    paintAnswer(q);
    $('#opts').querySelectorAll('.opt').forEach(x => x.disabled = true);
    $('#qmeta').textContent = `第 ${qi + 1} / ${qs.length} 题　·　得分 ${hits()}`;
    clearTimeout(navTimer);
    navTimer = setTimeout(() => jump(1), right ? 300 : 1000);
  }

  function drawQuiz() {
    if (!qs.length) return;
    qfill.style.width = (100 * Math.min(qi + 1, qs.length) / qs.length) + '%';
    if (qi >= qs.length) { finishQuiz(); return; }
    const { it, opts, picked } = qs[qi];
    $('#qmeta').textContent = `第 ${qi + 1} / ${qs.length} 题　·　得分 ${hits()}`;
    $('#qword').textContent = it[1];
    $('#qipa').textContent = it[2];
    $('#opts').innerHTML = opts.map(o =>
      `<button class="opt" data-w="${K.esc(o[1])}"${picked ? ' disabled' : ''}>${K.esc(shortDef(o))}</button>`).join('');
    $('#score').textContent = '';
    $('#opts').querySelectorAll('.opt').forEach(btn => {
      btn.onclick = () => answer(qs[qi], btn);
    });
    if (picked) paintAnswer(qs[qi]);
    qPrev.disabled = qi === 0;
    qNext.disabled = false;
    qNext.textContent = qi === qs.length - 1 ? '看结果 ›' : '下一题 ›';
    qPos.textContent = (qi + 1) + ' / ' + qs.length;
  }

  function finishQuiz() {
    clearTimeout(navTimer);
    clearWrongBtn();
    qfill.style.width = '100%';
    const ok = hits();
    const bad = qs.filter(q => q.picked && !q.ok).map(q => q.it);
    const missed = qs.filter(q => !q.picked).map(q => q.it);
    const todo = bad.concat(missed);
    $('#qmeta').textContent = `全部 ${qs.length} 题完成`;
    $('#qword').textContent = ok + ' / ' + qs.length + ' 正确';
    $('#qipa').textContent = '';
    $('#opts').innerHTML = '';
    qPrev.disabled = false;
    qNext.disabled = true;
    qNext.textContent = '已到结果';
    qPos.textContent = '结果';
    if (!todo.length) {
      $('#score').textContent = '全部一次答对，这一天可以收工了。';
    } else {
      let h = `答对 <b>${ok}</b>，答错 <b>${bad.length}</b>`;
      if (missed.length) h += `，未答 <b>${missed.length}</b>`;
      h += `。<br>待巩固：<span class="miss">${todo.slice(0, 14).map(x => K.esc(x[1])).join('、')}</span>${todo.length > 14 ? ` 等 ${todo.length} 个` : ''}`;
      h += '<br>点「重测错词与未答」再过一遍，或者去「卡片自测」。';
      $('#score').innerHTML = h;
      wrongBtn = document.createElement('button');
      wrongBtn.className = 'pill again';
      wrongBtn.textContent = '重测错词与未答（' + todo.length + '）';
      wrongBtn.onclick = () => buildQuiz(todo);
      $('#qAgain').after(wrongBtn);
    }
    $('#qAgain').style.display = '';
  }
  $('#qAgain').onclick = () => buildQuiz();

  /* ── 回顾：按 D-1 / D-3 / D-7 / D-15 排 ── */
  function buildReview() {
    const host = $('#review');
    if (!RMETA || !RMETA.length) {
      host.innerHTML = '<div class="aidbox"><div class="ws">今天是第 1 天，没有要回顾的旧词。先把今天的 92 个过一遍。</div></div>';
      return;
    }
    host.innerHTML = RMETA.map(([d, s, e, c, gap]) => `
      <a class="rcard" href="day${pad(d)}.html" data-d="${d}" data-n="${c}">
        <div class="rtop"><span class="rd">Day ${pad(d)}</span><span class="rgap">${gap} 天前</span></div>
        <div class="rnum"><b>0</b><s>/${c}</s></div>
        <div class="rbar"><i></i></div>
        <span class="rgo">去回顾<svg class="arw" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>
      </a>`).join('');
  }

  /* ── 标签切换 ── */
  const panels = { list: $('#p-list'), card: $('#p-card'), quiz: $('#p-quiz'), review: $('#p-review') };
  document.querySelectorAll('.tabs button').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      Object.keys(panels).forEach(k => panels[k].classList.toggle('on', k === b.dataset.t));
      if (b.dataset.t === 'card') flash.redraw();
      if (b.dataset.t === 'quiz' && !qs.length) buildQuiz();
      if (b.dataset.t === 'review') refresh(false);
      if (b.dataset.t === 'list' && weakOnly) buildGroups();
      scrollTo({ top: 0, behavior: 'smooth' });
    };
  });

  /* ── 启动 ── */
  buildGroups();
  buildReview();
  refresh(true);
})();
