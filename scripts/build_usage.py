"""Rebuild multi-example indexes from the site's existing bilingual exam pages.
Run from any directory: python scripts/build_usage.py
No network requests or third-party dependencies are needed.
"""
import collections
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIMIT = 6


def load(path):
    return json.loads((ROOT / path).read_text())


def words(page):
    text = (ROOT / page).read_text()
    rows = json.loads(re.search(r'window.ALL_ITEMS\s*=\s*(\[.*?\]);', text, re.S)[1])
    return {row[2].lower(): row[4] for row in rows}


class Sentences(HTMLParser):
    """Read only complete .sent English/Chinese pairs, preserving source anchors."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.pair = None
        self.field = None
        self.rows = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in {'br', 'img', 'meta', 'link', 'input', 'hr', 'source', 'wbr'}:
            return
        self.stack.append((tag, attrs))
        classes = attrs.get('class', '').split()
        if 'sent' in classes and self.pair is None:
            self.pair = {'depth': len(self.stack), 'en': '', 'zh': '',
                         'id': next((a['id'] for _, a in reversed(self.stack) if 'id' in a), '')}
        if self.pair and tag == 'p':
            self.field = 'en' if 'en' in classes else 'zh' if 'zh' in classes else None

    def handle_data(self, data):
        if self.pair and self.field:
            self.pair[self.field] += data

    def handle_endtag(self, tag):
        if not any(t == tag for t, _ in self.stack):
            return
        while self.stack:
            t, _ = self.stack.pop()
            if self.pair and len(self.stack) < self.pair['depth']:
                p = self.pair
                en, zh = (' '.join(p[k].split()) for k in ('en', 'zh'))
                if en and zh and p['id'] and not re.search(r'_{2,}|\[\d+\]', en):
                    self.rows.append([p['id'], en, zh])
                self.pair = None
                self.field = None
            if t == tag:
                break
        if tag == 'p':
            self.field = None


def tokens(text):
    return re.findall(r"[a-z]+(?:['’-][a-z]+)*", text.lower())


def build():
    corpora = []
    for folder in ('exams', 'kaoyan-exams'):
        for page in sorted((ROOT / folder).glob('*.html')):
            parser = Sentences()
            parser.feed(page.read_text())
            corpora.extend([[str(page.relative_to(ROOT)), *row] for row in parser.rows])
    # Exact whole-word matching: avoid stemming 'university' into 'universe', etc.
    inverted = collections.defaultdict(list)
    for i, row in enumerate(corpora):
        for token in set(tokens(row[2])):
            inverted[token].append(i)
    report = {}
    extra = {}
    for shard in sorted((ROOT / 'assets/usage-extra').glob('*.json')):
        extra.update(json.loads(shard.read_text()))
    common, dictionary, reviewed = (load('assets/' + x + '.json') for x in
                                     ('common-usage', 'dictionary-phrases', 'tatoeba-reviewed'))
    for kind, page, folder in [('cet', 'words-all.html', 'exams/'),
                                ('ky', 'kaoyan-words-all.html', 'kaoyan-exams/')]:
        vocab = words(page)
        previous = load('assets/usage-' + kind + '.json')
        sentences, index, lookup = [], {}, {}
        for word in vocab:
            candidates = [corpora[i] for i in inverted.get(word, [])]
            # Preserve previously selected examples, including inflected forms.
            old = previous['index'].get(word, [])
            for i in ([old] if isinstance(old, int) else old):
                candidates.append(previous['sentences'][i])
            candidates.sort(key=lambda r: (not r[0].startswith(folder),
                                          not 35 <= len(r[2]) <= 220, len(r[2]), r[0], r[1]))
            chosen, seen, sources = [], set(), collections.Counter()
            # Prefer different papers first, then fill remaining slots.
            for cap in (1, LIMIT):
                for row in candidates:
                    key = ' '.join(row[2].lower().split())
                    if key in seen or sources[row[0]] >= cap or len(chosen) >= LIMIT:
                        continue
                    seen.add(key)
                    sources[row[0]] += 1
                    chosen.append(row)
            if chosen:
                ids = []
                for row in chosen:
                    key = tuple(row)
                    if key not in lookup:
                        lookup[key] = len(sentences)
                        sentences.append(row)
                    ids.append(lookup[key])
                index[word] = ids
        data = dict(sentences=sentences, index=index, phrases=previous['phrases'])
        (ROOT / ('assets/usage-' + kind + '.json')).write_text(
            json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
        missing, thin = [], []
        for w in vocab:
            entry = common.get(w, {})
            examples = [sentences[i][2] for i in index.get(w, [])]
            examples += [e['en'] for e in reviewed.get(w, [])]
            supplement = extra.get(w, {})
            examples += [e[0] for e in supplement.get('examples', [])]
            if entry.get('example'):
                examples.append(entry['example'][0])
            example_count = len({' '.join(e.casefold().split()) for e in examples})
            phrase_count = len(entry.get('collocations', [])) + len(dictionary.get(w, [])) + len(data['phrases'].get(w, [])) + len(entry.get('usages', []))
            phrase_count += len(supplement.get('phrases', []))
            if not example_count and not phrase_count:
                missing.append(w)
            if example_count < 2:
                thin.append(w)
        report[kind] = dict(total=len(vocab), with_content=len(vocab)-len(missing),
                            with_exam_examples=len(index),
                            with_multiple_exam_examples=sum(len(v) >= 2 for v in index.values()),
                            with_multiple_examples=len(vocab)-len(thin),
                            missing=sorted(missing), fewer_than_two_examples=sorted(thin))
    (ROOT / 'assets/usage-coverage.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    for k, v in report.items():
        print(k, {a: b for a, b in v.items() if not isinstance(b, list)})


if __name__ == '__main__':
    build()
