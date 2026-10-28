#!/usr/bin/env python3
"""把遊戲打包成一個單檔 HTML（樣式與腳本全部內嵌），發佈成 claude.ai Artifact 或單檔分發用（做法沿用「寫意」系列）。

    python3 scripts/build-single.py            # 輸出 dist/xieyi-deng.html（無 doctype/html/body 外殼，Artifact 發佈時會自動包一層）
    python3 scripts/build-single.py --page     # 輸出 dist/index.html（完整頁面，可直接雙擊打開；本機驗單檔用這個）
"""
import re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'style.css').read_text(encoding='utf-8')
head = html[html.index('<head>') + 6: html.index('</head>')]
body = html[html.index('<body>') + 6: html.index('</body>')]

font_links = '\n'.join(l.strip() for l in head.splitlines() if 'fonts.g' in l)
body = re.sub(r'<script src="([^"]+)"></script>',
              lambda m: '<script>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '\n</script>', body)
fragment = ('<title>燈下無明</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' + font_links +
            '\n<style>\n' + css + '\n</style>\n' + body.strip() + '\n')

out_dir = root / 'dist'; out_dir.mkdir(exist_ok=True)
if '--page' in sys.argv:
    page = ('<!DOCTYPE html>\n<html lang="zh-TW">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '</head>\n<body>\n' + fragment + '</body>\n</html>\n')
    (out_dir / 'index.html').write_text(page, encoding='utf-8'); print('wrote dist/index.html', len(page.encode()), 'bytes')
else:
    (out_dir / 'xieyi-deng.html').write_text(fragment, encoding='utf-8'); print('wrote dist/xieyi-deng.html', len(fragment.encode()), 'bytes')
