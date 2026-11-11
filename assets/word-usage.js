(function () {
  'use strict';
  const scriptURL = document.currentScript.src;
  const isKY = /(^|\/)kaoyan(?:\/|-words\.html)/.test(location.pathname);
  if (!document.getElementById('groups') && !document.getElementById('hits')) return;
  const css = document.createElement('style');
  css.textContent = '.usage-toggle{margin:9px 0 0;padding:0;border:0;background:none;color:var(--faint,#86868b);font:inherit;font-size:12px;cursor:pointer}.usage-toggle:hover{color:var(--text,#1d1d1f)}.usage-body{margin:8px 0 3px;padding:10px 12px;border-left:2px solid #d2d2d7;color:var(--text,#1d1d1f);font-size:13px;line-height:1.6}.usage-body p{margin:0 0 5px}.usage-body .usage-zh{color:var(--faint,#86868b)}.usage-body a{color:inherit;font-size:11px;text-decoration:underline;text-underline-offset:3px}.wrow.hide:not(.show) .usage-body{filter:blur(5px);user-select:none}';
  document.head.appendChild(css);
  function start(data) {
    function decorate(root) {
      const rows = root.matches && root.matches('.wrow') ? [root] : [];
      if (root.querySelectorAll) rows.push(...root.querySelectorAll('.wrow'));
      rows.forEach(row => {
        if (row.dataset.usageReady) return;
        row.dataset.usageReady = '1';
        const word = (row.dataset.w || '').toLowerCase();
        const item = Object.prototype.hasOwnProperty.call(data.index, word) ? data.sentences[data.index[word]] : null;
        const phrases = (data.phrases && data.phrases[word]) || [];
        if (!item && !phrases.length) return;
        const holder = row.querySelector('.senses');
        if (!holder) return;
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'usage-toggle';
        button.textContent = '真题用法  +'; button.setAttribute('aria-expanded', 'false');
        const box = document.createElement('div'); box.className = 'usage-body'; box.hidden = true;
        function sourceLink(path, id) {
          const source = document.createElement('a');
          const match = path.match(/(\d{4})(?:-(\d{2})-set(\d))?\.html$/);
          source.textContent = match && match[2] ? match[1] + ' 年 ' + Number(match[2]) + ' 月六级 · 第 ' + match[3] + ' 套 ↗' : (match ? match[1] + ' 年考研英语一 ↗' : '查看原文 ↗');
          source.href = new URL('../' + path + (id ? '#' + id : ''), scriptURL).href;
          source.target = '_blank'; source.rel = 'noopener noreferrer';
          source.addEventListener('click', e => e.stopPropagation());
          return source;
        }
        phrases.forEach(phrase => {
          const line = document.createElement('p');
          line.textContent = phrase[0] + '  ·  ' + phrase[1] + '  ';
          line.append(sourceLink(phrase[2], phrase[3]));
          box.append(line);
        });
        if (item) {
          const en = document.createElement('p'); en.lang = 'en'; en.textContent = item[2];
          const zh = document.createElement('p'); zh.className = 'usage-zh'; zh.textContent = item[3];
          box.append(en, zh, sourceLink(item[0], item[1]));
        }
        button.addEventListener('click', e => {
          e.stopPropagation();
          const open = box.hidden;
          box.hidden = !open; button.setAttribute('aria-expanded', String(open));
          button.textContent = open ? '收起用法  −' : '真题用法  +';
        });
        holder.after(button, box);
      });
    }
    decorate(document);
    new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType === 1 && !n.classList.contains('usage-body') && !n.classList.contains('usage-toggle')) decorate(n);
    }))).observe(document.body, {childList:true, subtree:true});
  }
  fetch(new URL(isKY ? 'usage-ky.json' : 'usage-cet.json', scriptURL))
    .then(r => { if (!r.ok) throw new Error('usage data unavailable'); return r.json(); })
    .then(start).catch(() => {});
})();