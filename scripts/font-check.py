#!/usr/bin/env python3
"""檢查遊戲裡畫得到的字，書法字體「霞鶩文楷 TC」有沒有：沒有的字會掉到別的字型，大小與基線都不一樣，看起來就「不在同一行」。

    python3 scripts/font-check.py        # 要能連 fonts.googleapis.com
"""
import re, pathlib, urllib.request
root = pathlib.Path(__file__).resolve().parent.parent
req = urllib.request.Request('https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC&display=swap', headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'})
css = urllib.request.urlopen(req, timeout=30).read().decode()
cover = set()
for rng in re.findall(r'unicode-range:([^;]+);', css):
    for part in rng.split(','):
        part = part.strip().replace('U+', '')
        if '-' in part:
            a, b = part.split('-'); cover.update(range(int(a, 16), int(b, 16) + 1))
        else: cover.add(int(part, 16))
files = [root / "index.html"] + list((root / "src").glob("*.js"))
missing = {}
for f in files:
    for i, line in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
        code = line.split('//')[0] if f.suffix == '.js' else line   # 註解不算
        for c in code:
            if 0x3400 <= ord(c) <= 0x9FFF and ord(c) not in cover: missing.setdefault(c, []).append(f'{f.name}:{i}')
print('字體涵蓋', len(cover), '個碼位')
if missing:
    for c, where in missing.items(): print('缺字', c, hex(ord(c)), '、'.join(where[:4]))
    raise SystemExit(1)
print('畫面上用到的字都有')
