"""Import a pinned english-vocabulary checkout/download (see README) into shards."""
import argparse
import collections
import json
import re
from pathlib import Path
from build_usage import ROOT, words

SOURCES = ['六级', '考研', '四级', '高中']
REVISION = '731240a848dca14e2cf17510f384312b788863c1'


def build(directory):
    vocab = set(words('words-all.html')) | set(words('kaoyan-words-all.html'))
    result = {}
    for source, name in enumerate(SOURCES):
        for line, raw in enumerate((directory / (name + '.jsonl')).read_text().splitlines(), 1):
            entry = json.loads(raw)
            word = entry['word'].lower().strip()
            if word not in vocab:
                continue
            target = result.setdefault(word, {'phrases': [], 'examples': []})
            for field, upstream, enkey in [('phrases', 'phrases', 'phrase'),
                                            ('examples', 'sentences', 'sentence')]:
                for pair in entry.get(upstream, []):
                    en = ' '.join(pair.get(enkey, '').split())
                    zh = ' '.join(pair.get('translation', '').split())
                    # Exclude fragments, unusually long sentences and suspicious markup.
                    if not en or not zh or re.search(r'<[^>]+>|_{2,}', en + zh):
                        continue
                    if field == 'examples' and (not 15 <= len(en) <= 320 or en.startswith(('...', '…'))):
                        continue
                    if field == 'phrases' and (len(en.split()) < 2 or len(en) > 70):
                        continue
                    if any(p[0].casefold() == en.casefold() for p in target[field]):
                        continue
                    if len(target[field]) < (6 if field == 'phrases' else 4):
                        target[field].append([en, zh, source, line])
    shards = collections.defaultdict(dict)
    for word, entry in sorted(result.items()):
        if entry['phrases'] or entry['examples']:
            shards[word[0] if 'a' <= word[0] <= 'z' else 'other'][word] = entry
    out = ROOT / 'assets/usage-extra'
    out.mkdir(exist_ok=True)
    for letter in 'abcdefghijklmnopqrstuvwxyz':
        (out / (letter + '.json')).write_text(json.dumps(shards[letter], ensure_ascii=False, separators=(',', ':'))+'\n')
    (out / 'other.json').write_text(json.dumps(shards['other'], ensure_ascii=False, separators=(',', ':'))+'\n')
    (ROOT / 'assets/english-vocabulary-LICENSE.txt').write_bytes((directory / 'LICENSE').read_bytes())
    print('Imported', sum(map(len, shards.values())), 'words')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    build(parser.parse_args().directory)
