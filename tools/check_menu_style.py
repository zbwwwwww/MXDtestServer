# -*- coding: utf-8 -*-
"""校验 gm_menu.template.js：可点选项是否都以 #l 收尾、颜色标签是否统一。"""
import io
import os
import re
import sys

TPL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gm_menu.template.js')
src = io.open(TPL, encoding='utf-8', newline='').read()
lines = src.split('\n')

bad_L = []
bad_n = []
blue = 0
black = 0
hdr = 0

for ln, line in enumerate(lines, 1):
    if '#L' not in line:
        continue
    if '#' in line and '#l' not in line:
        bad_L.append((ln, line.strip()))
    # 选项内部残留 #n（会把可点区域撑大一行）
    for m in re.finditer(r'#L', line):
        tail = line[m.end():]
        k = tail.find('#L')
        seg = tail if k < 0 else tail[:k]
        if '#n' in seg and not re.search(r'#l', seg):
            bad_n.append((ln, seg[:80]))

for ln, line in enumerate(lines, 1):
    if 's += "' not in line:
        continue
    m = re.match(r'^\s*s \+= "(#b[^"]*)"', line)
    if m:
        blue += 1
    if '#k' in line and 's += "' in line:
        hdr += 1

print('选项行(带 #L) %d 条：' % len([1 for l in lines if '#L' in l]))
print('  ★ 没有 #l 收尾的：%d 条' % len(bad_L))
for ln, t in bad_L[:20]:
    print('     第 %d 行  %s' % (ln, t[:120]))
print('  ★ 选项内部残留 #n 的：%d 条' % len(bad_n))
for ln, t in bad_n[:20]:
    print('     第 %d 行  [%s]' % (ln, t))
print()
print('整行 #b 开头的选项字面量：%d' % blue)
print('带 #k 的普通文字行：%d' % hdr)

if bad_L or bad_n:
    sys.exit(1)
print()
print('通过：所有可点选项都以 #l 收尾，且选项内部没有会撑大可点区域的 #n。')
