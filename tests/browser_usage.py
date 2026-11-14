"""Browser smoke tests: python tests/browser_usage.py (requires Playwright Chromium)."""
import functools
import http.server
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for width in (1280, 390):
            page = browser.new_page(viewport={'width': width, 'height': 900})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            for path in ('words-all.html', 'kaoyan-words-all.html', 'words/day01.html', 'kaoyan/day01.html'):
                requests = []
                page.on('request', lambda r, requests=requests: requests.append(r.url))
                page.goto(base + '/' + path)
                first = page.locator('.usage-toggle').first
                first.wait_for()
                assert not any('/usage-extra/' in url for url in requests), 'shards loaded too early'
                assert page.locator('.usage-body .usage-example').count() == 0
                first.click()
                box = page.locator('.usage-body').first
                box.get_by_text('更多义项与用法：', exact=False).wait_for()
                assert box.locator('.usage-example').count() >= 2, path
                assert len([url for url in requests if '/usage-extra/' in url]) == 1
                count = box.locator('.usage-example').count()
                first.click()
                assert not box.is_visible()
                first.click()
                assert box.locator('.usage-example').count() == count
                # Dynamic rows (search/pagination) and missing-content fallback.
                page.evaluate("""() => {const row=document.createElement('div');row.className='wrow';row.dataset.w='zzzz-missing';row.innerHTML='<div class="senses"></div>';document.querySelector('#groups, #hits').append(row);}""")
                missing = page.locator('.wrow[data-w="zzzz-missing"]')
                missing.locator('.usage-toggle').click()
                missing.get_by_text('此词的本地用法与例句尚待补充', exact=False).wait_for()
                assert missing.locator('a').count() == 2
                assert not errors, errors
                print(width, path, 'PASS', count, 'examples')
            page.close()
        # Failed shard requests still show local content and dictionary links.
        page = browser.new_page()
        page.route('**/usage-extra/*.json*', lambda route: route.abort())
        page.goto(base + '/words/day01.html')
        page.locator('.usage-toggle').first.click()
        box = page.locator('.usage-body').first
        box.get_by_text('更多义项与用法：', exact=False).wait_for()
        assert box.locator('.usage-example').count() > 0
        print('network fallback PASS')
        browser.close()
finally:
    server.shutdown()
