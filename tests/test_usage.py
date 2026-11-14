import hashlib
import json
import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from build_usage import Sentences, words


class UsageTests(unittest.TestCase):
    def test_html_extraction_ignores_options_and_incomplete_pairs(self):
        p = Sentences()
        p.feed('<article id="source"><p class="en">Not a sentence pair</p>'
               '<div class="sent"><p class="en">We <b>learn</b> &amp; grow.</p>'
               '<p class="zh">我们学习与成长。</p></div>'
               '<div class="sent"><p class="en">Missing translation.</p></div></article>')
        self.assertEqual(p.rows, [['source', 'We learn & grow.', '我们学习与成长。']])

    def test_examples_have_real_local_sources_and_unique_text(self):
        cache = {}
        for kind in ('cet', 'ky'):
            d = json.loads((ROOT / f'assets/usage-{kind}.json').read_text())
            for word, ids in d['index'].items():
                self.assertTrue(1 <= len(ids) <= 6, word)
                texts = []
                for i in ids:
                    path, anchor, en, zh = d['sentences'][i]
                    self.assertTrue(en and zh)
                    if path not in cache:
                        cache[path] = (ROOT / path).read_text()
                    self.assertIn('id="'+anchor+'"', cache[path], (word, path, anchor))
                    texts.append(' '.join(en.lower().split()))
                self.assertEqual(len(texts), len(set(texts)), word)

    def test_imported_shards_and_coverage(self):
        extra = {}
        for path in (ROOT / 'assets/usage-extra').glob('*.json'):
            for word, entry in json.loads(path.read_text()).items():
                self.assertNotIn(word, extra)
                extra[word] = entry
                for field, limit in [('phrases', 6), ('examples', 4)]:
                    self.assertLessEqual(len(entry[field]), limit)
                    for en, zh, book, line in entry[field]:
                        self.assertTrue(en and zh and 0 <= book <= 3 and line > 0)
        report = json.loads((ROOT / 'assets/usage-coverage.json').read_text())
        for kind, page in [('cet', 'words-all.html'), ('ky', 'kaoyan-words-all.html')]:
            r = report[kind]
            self.assertEqual(r['total'], len(words(page)))
            self.assertEqual(r['with_content'] + len(r['missing']), r['total'])
            self.assertGreater(r['with_content'] / r['total'], .98)
            self.assertGreater(r['with_multiple_examples'] / r['total'], .80)
            old = json.loads(subprocess.check_output(['git', 'show', f'HEAD:assets/usage-{kind}.json'], cwd=ROOT))
            new = json.loads((ROOT / f'assets/usage-{kind}.json').read_text())
            self.assertTrue(set(old['index']) <= set(new['index']))

    def test_rebuild_is_reproducible(self):
        paths = list((ROOT / 'assets').glob('usage-*.json'))
        before = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
        subprocess.run([sys.executable, str(ROOT / 'scripts/build_usage.py')], check=True, capture_output=True)
        self.assertEqual(before, {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths})


if __name__ == '__main__':
    unittest.main()
