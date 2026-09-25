# -*- coding: utf-8 -*-
"""统计官方脚本里 #k 后面通常接什么，判断 #k 是不是「还原默认颜色」。"""
import io
import os
import re
from collections import defaultdict

ROOT = r'D:\MXDtestServer\scripts'
byk = defaultdict(int)
ex = defaultdict(list)

for root, dirs, fs in os.walk(ROOT):
    for fn in fs:
        if not fn.endswith('.js'):
            continue
        try:
            t = io.open(os.path.join(root, fn), encoding='utf-8', errors='replace').read()
        except Exception:
            continue
        for m in re.finditer(r'sendSimple\(\s*"((?:[^"\\]|\\.){0,1400}?)"', t):
            s = m.group(1)
            if '#k' not in s:
                continue
            i = s.find('#k')
            after = s[i + 2:i + 40]
            if len(after) > 5 and i > 20:
                key = after[:6]
                byk[key] += 1
                if len(ex[key]) < 2:
                    ex[key].append((fn, s[max(0, i - 50):i + 50]))

for k in sorted(byk, key=lambda x: -byk[x])[:14]:
    print('### 后面接 [%s] 共 %d 次' % (k, byk[k]))
    if ex[k]:
        f, seg = ex[k][0]
        print('    %s' % f)
        print('    %r' % seg)
