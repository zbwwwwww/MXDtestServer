# -*- coding: utf-8 -*-
"""探查官方 NPC 脚本里：#L 选项用什么收尾、标题行怎么写、颜色怎么重置。"""
import io
import os
import re
from collections import Counter

ROOT = r'D:\MXDtestServer\scripts'
NL = '\\r\\n'          # 源码字面量里看到的 \r\n
TAGS = Counter()

samples = []
mid_samples = []

for root, dirs, fs in os.walk(ROOT):
    for fn in fs:
        if not fn.endswith('.js'):
            continue
        p = os.path.join(root, fn)
        try:
            t = io.open(p, encoding='utf-8', errors='replace').read()
        except Exception:
            continue
        for m in re.finditer(r'sendSimple\(\s*"((?:[^"\\\n]|\\.){0,1600}?)"\s*\)', t):
            s = m.group(1)
            for mm in re.finditer(re.escape(NL) + '#L', s):
                prev = s[:mm.start()]
                tag = '无'
                for tg in ('#l', '#n', '#e', '#k', '#b'):
                    if prev.endswith(tg):
                        tag = tg
                        break
                TAGS[tag] += 1
                if tag == '#l':
                    rest = s[mm.end():]
                    nx = rest.find(NL + '#L')
                    mid = rest[:nx] if nx >= 0 else ''
                    if mid.strip():
                        mid_samples.append((fn, prev[-50:], mid))

print('【#L 选项收尾标签统计】')
for k, v in TAGS.most_common():
    print('   %-4s %d' % (k, v))

print()
print('【下一个 #L 之前夹着「非 #L 说明行」的样本】')
n = 0
for f, prev, mid in mid_samples:
    if mid.startswith('#'):
        continue
    print('=== %s' % f)
    print('    上一行尾 ...%s' % prev)
    print('    中间行   [%s]' % mid)
    n += 1
    if n >= 6:
        break
if n == 0:
    print('   （官方脚本里没有这种写法）')

print()
print('【收尾用 #l、且下一个 #L 之前夹着说明行的样本 %d 条】' % len(mid_samples))
n = 0
for f, prev, mid in mid_samples:
    print('=== %s' % f)
    print('    上一行尾 ...%s' % prev)
    print('    中间行   [%s]' % mid)
    n += 1
    if n >= 8:
        break
if n == 0:
    print('   （没抓到）')
