(function () {
  'use strict';
  const scriptURL = document.currentScript.src;
  const isKY = /(^|\/)kaoyan(?:\/|-words(?:-all)?\.html)/.test(location.pathname);
  if (!document.getElementById('groups') && !document.getElementById('hits')) return;
  const css = document.createElement('style');
  css.textContent = `
    .usage-toggle{display:inline-flex;align-items:center;gap:7px;margin:10px 0 0;padding:5px 10px;border:1px solid var(--line);border-radius:99px;background:var(--fill);color:var(--sub);font:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:color .2s var(--ease),background .2s var(--ease),border-color .2s var(--ease),transform .2s var(--ease)}
    .usage-toggle:hover,.usage-toggle[aria-expanded=true]{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 35%,transparent);background:color-mix(in srgb,var(--accent) 9%,var(--card))}
    .usage-toggle:active{transform:scale(.97)}.usage-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
    .usage-toggle .usage-icon{font-size:15px;line-height:1;transition:transform .25s var(--ease)}.usage-toggle[aria-expanded=true] .usage-icon{transform:rotate(45deg)}
    .usage-body{margin:10px 0 3px;padding:15px 16px;border:1px solid var(--line);border-radius:14px;background:var(--fill);color:var(--fg);font-size:13px;line-height:1.65;animation:usage-in .3s var(--ease) both}
    .usage-body[hidden]{display:none}.usage-section+.usage-section{border-top:1px solid var(--line);margin-top:14px;padding-top:14px}
    .usage-label{display:block;margin-bottom:8px;color:var(--sub);font-size:11px;font-weight:700;letter-spacing:.04em}.usage-phrase{margin:0 0 8px}.usage-phrase strong{font-weight:650;color:var(--fg)}.usage-translation{color:var(--sub)}
    .usage-example{margin:9px 0 2px;color:var(--fg)}.usage-zh{margin:0;color:var(--sub)}.usage-source{display:inline-block;margin-top:7px;color:var(--accent);font-size:11px;text-decoration:none}.usage-source:hover{text-decoration:underline}.usage-note{margin-top:7px;color:var(--sub);font-size:11px}
    .wrow.hide:not(.show) .usage-body{filter:blur(5px);user-select:none}
    @keyframes usage-in{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}
    @media(prefers-reduced-motion:reduce){.usage-toggle,.usage-toggle .usage-icon{transition:none}.usage-body{animation:none}}
  `;
  document.head.appendChild(css);
  const getJSON = name => fetch(new URL(name + '?v=20261112c', scriptURL)).then(r => { if (!r.ok) throw Error(name); return r.json(); }).catch(() => null);
  Promise.all([getJSON(isKY ? 'usage-ky.json' : 'usage-cet.json'), getJSON('common-usage.json'), getJSON('dictionary-phrases.json'), getJSON('tatoeba-reviewed.json')]).then(([data, common, dictionary, reviewed]) => {
    data = data || {index:{},sentences:[],phrases:{}}; common = common || {}; dictionary = dictionary || {}; reviewed = reviewed || {};
    function sourceLink(path, id) {
      const source = document.createElement('a'); source.className = 'usage-source';
      const match = path.match(/(\d{4})(?:-(\d{2})-set(\d))?\.html$/);
      source.textContent = match && match[2] ? match[1] + ' 年 ' + Number(match[2]) + ' 月六级 · 第 ' + match[3] + ' 套 ↗' : (match ? match[1] + ' 年考研英语一 ↗' : '查看原文 ↗');
      source.href = new URL('../' + path + (id ? '#' + id : ''), scriptURL).href;
      source.target = '_blank'; source.rel = 'noopener noreferrer'; source.addEventListener('click', e => e.stopPropagation());
      return source;
    }
    function element(tag, cls, text) { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; return el; }
    function decorate(root) {
      const rows = root.matches && root.matches('.wrow') ? [root] : [];
      if (root.querySelectorAll) rows.push(...root.querySelectorAll('.wrow'));
      rows.forEach(row => {
        if (row.dataset.usageReady) return;
        const word = (row.dataset.w || '').toLowerCase();
        const item = Object.prototype.hasOwnProperty.call(data.index || {}, word) ? data.sentences[data.index[word]] : null;
        const phrases = (data.phrases && data.phrases[word]) || [];
        const everyday = common[word];
        const dictionaryPhrases = (dictionary[word] || []).filter(pair => !everyday || !everyday.collocations.some(c => c[0].toLowerCase() === pair[0]));
        const checked = reviewed[word] || [];
        if (!item && !phrases.length && !everyday && !dictionaryPhrases.length && !checked.length) return;
        const holder = row.querySelector('.senses'); if (!holder) return;
        row.dataset.usageReady = '1';
        const button = element('button', 'usage-toggle'); button.type = 'button'; button.setAttribute('aria-expanded', 'false');
        button.append(element('span', '', '搭配与例句'), element('span', 'usage-icon', '+'));
        const box = element('div', 'usage-body'); box.hidden = true;
        if (everyday) {
          const section = element('section', 'usage-section'); section.append(element('span', 'usage-label', '常用搭配'));
          everyday.collocations.forEach(([phrase, zh]) => { const line = element('p', 'usage-phrase'); const strong = element('strong', '', phrase); strong.lang = 'en'; line.append(strong, element('span', 'usage-translation', '  ·  ' + zh)); section.append(line); });
          const en = element('p', 'usage-example', everyday.example[0]); en.lang = 'en';
          section.append(en, element('p', 'usage-zh', everyday.example[1]), element('p', 'usage-note', '例句为学习示例，非真题原句'));
          box.append(section);
        }
        if (dictionaryPhrases.length) {
          const section = element('section', 'usage-section'); section.append(element('span', 'usage-label', '词典搭配 · 语料筛选'));
          dictionaryPhrases.forEach(([phrase, zh]) => {
            const line = element('p', 'usage-phrase'); const strong = element('strong', '', phrase); strong.lang = 'en';
            line.append(strong, element('span', 'usage-translation', '  ·  ' + zh)); section.append(line);
          });
          const note = element('p', 'usage-note', '来源：ECDICT；按 Brown 语料出现次数初筛，释义可能随语境变化。 ');
          const link = element('a', 'usage-source', '数据说明 ↗'); link.href = new URL('../dictionary-sources.html', scriptURL).href;
          link.target = '_blank'; link.rel = 'noopener noreferrer'; link.addEventListener('click', e => e.stopPropagation()); note.append(link); section.append(note); box.append(section);
        }
        if (checked.length) {
          const section = element('section', 'usage-section'); section.append(element('span', 'usage-label', '常用搭配 · 双语例句'));
          checked.forEach(entry => {
            const line = element('p', 'usage-phrase'); const strong = element('strong', '', entry.phrase); strong.lang = 'en';
            line.append(strong, element('span', 'usage-translation', '  ·  ' + entry.meaning));
            const en = element('p', 'usage-example', entry.en); en.lang = 'en';
            const note = element('p', 'usage-note', 'Tatoeba 例句（非真题） · ');
            const original = element('a', 'usage-source', '英文原句：' + entry.en_author + ' ↗'); original.href = 'https://tatoeba.org/en/sentences/show/' + entry.en_id;
            const translation = element('a', 'usage-source', '中文译句：' + entry.zh_author + ' ↗'); translation.href = 'https://tatoeba.org/en/sentences/show/' + entry.zh_id;
            [original,translation].forEach(a => { a.target='_blank'; a.rel='noopener noreferrer'; a.addEventListener('click', e => e.stopPropagation()); });
            note.append(original, document.createTextNode('  ·  '), translation);
            section.append(line, en, element('p', 'usage-zh', entry.zh), note);
          });
          box.append(section);
        }
        if (item || phrases.length) {
          const section = element('section', 'usage-section'); section.append(element('span', 'usage-label', '真题用法'));
          phrases.forEach(phrase => { const line = element('p', 'usage-phrase'); line.append(element('strong', '', phrase[0]), element('span', 'usage-translation', '  ·  ' + phrase[1]), document.createElement('br'), sourceLink(phrase[2], phrase[3])); section.append(line); });
          if (item) { const en = element('p', 'usage-example', item[2]); en.lang = 'en'; section.append(en, element('p', 'usage-zh', item[3]), sourceLink(item[0], item[1])); }
          box.append(section);
        }
        button.addEventListener('click', e => { e.stopPropagation(); const open = box.hidden; box.hidden = !open; button.setAttribute('aria-expanded', String(open)); });
        holder.after(button, box);
      });
    }
    decorate(document);
    new MutationObserver(mutations => mutations.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType === 1 && !n.classList.contains('usage-body') && !n.classList.contains('usage-toggle')) decorate(n);
    }))).observe(document.body, {childList:true, subtree:true});
  });
})();
