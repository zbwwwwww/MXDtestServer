# -*- coding: utf-8 -*-
"""
把 GM 菜单某一屏的「源码写法」和「客户端实际显示」并排打出来。

用法：python tools/preview_menu_layout.py [函数名]
  · 只取该函数体内 s += ...; 的语句，按出现顺序渲染
  · 空行语句 s += "\r\n"; 渲染成 <空行>，方便看"选项 -> 空行 -> 标题"的层次
默认看 mainMenu()。
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
GEN = r"D:\MXDtestServer\scripts\npc\gm_menu.js"

FUNC = sys.argv[1] if len(sys.argv) > 1 else 'mainMenu'

src = io.open(GEN, encoding='utf-8').read().split('\n')

# 抓函数体
try:
    i = next(k for k, l in enumerate(src) if l.startswith('function %s(' % FUNC))
except StopIteration:
    print('找不到函数', FUNC)
    sys.exit(1)
body = []
for l in src[i + 1:]:
    if re.match(r'^\}', l):
        break
    if 's += ' in l and ';' in l:
        body.append(l.strip())
    elif body:
        # 跨行拼接：接着攒
        body[-1] = body[-1] + ' ' + l.strip()
body = [re.sub(r'\s+', ' ', b) for b in body if b]

TAG = re.compile(r'#[a-zA-Z]')
BLANK = re.compile(r'^s \+= "\\r\\n";$')
OPT = re.compile(r'#L\d+#')

out = []
out.append('GM 菜单排版预览 —— 函数 %s' % FUNC)
out.append('来源：scripts/npc/gm_menu.js')
out.append('=' * 72)
for b in body:
    m = re.match(r's \+= (.*);$', b)
    expr = m.group(1) if m else b
    if BLANK.match(b):
        out.append('  [源码] %s' % b)
        out.append('  [显示] <空行>        ← 隔在上一行和分区标题之间')
        out.append('')
        continue
    # 客户端显示：只取字符串字面量拼起来，再剥掉标签
    lits = re.findall(r'"((?:[^"\\]|\\.)*)"', expr)
    disp = ''.join(lits)
    disp = TAG.sub('', disp)                       # 去掉 #b #k #l #n #e ...
    disp = disp.replace('\\r\\n', '').replace('\\n', '').replace('#', '')
    disp = disp.replace('　', '  ').strip()
    mopt = re.search(r'#L(\d+)#', b)
    kind = '选项' if OPT.search(b) else '文字'
    if mopt:
        disp = '[%s] %s' % (mopt.group(1), re.sub(r'^\d+\s*', '', disp))
    out.append('  [源码] %s' % b)
    out.append('  [显示] (%s) %s' % (kind, disp))
    out.append('')

txt = '\n'.join(out)
p = os.path.join(r'D:\MXDtestServer\saves',
                 'gm_menu_layout_%s_%s.txt' % (FUNC, os.path.basename(GEN)[:-3]))
with io.open(p, 'w', encoding='utf-8', newline='') as f:
    f.write(txt)
print(p)
print(len(txt), '字符')
