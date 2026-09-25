# -*- coding: utf-8 -*-
"""
把 GM 菜单脚本的整体样式统一：

1. 每个可点选项都以 #l 收尾（官方脚本的规范写法）。
   原来用 \\r\\n / #n 收尾，选项 뒤 的整段文字（含后面那行普通文字）都会被算进
   这个选项的可点区域 —— 这就是「大标题和上一行功能栏目一起亮」的根因。
2. 所有可点选项统一染蓝：在 #L 前面补 #b（把个别的 #r 红色去掉）。
3. 所有普通文字行（分区标题、说明行）统一用 #k 打头，把前面的 #b 染蓝还原掉，
   这样「蓝的只有能点的行，黑的是标题 / 说明」。

用法：python fix_menu_style.py   会先备份原模板为 *.bak_style
"""
import io
import os
import re
import shutil

TPL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gm_menu.template.js')
BACKUP = TPL.replace('.template.js', '.template.js.bak_style')

LIT = re.compile(r'"((?:[^"\\]|\\.)*)"')


def ensure_b(line):
    """确保这一行里第一个 #L 前面有 #b。"""
    pos = line.find('#L')
    if pos < 0:
        return line
    head = line[:pos]
    if re.search(r'#+[br]$', head):
        return line
    return head + '#b' + line[pos:]


def repl(inner):
    """把选项文字尾部改成 #l（必要时先剥掉会撑大可点区域的 #n）。"""
    sp = re.match(r'^(.*?)( +)$', inner)          # 结尾留空格：换行后仍缩进
    if sp:
        base, spaces = sp.group(1), sp.group(2)
        if base.endswith('#n'):
            base = base[:-2]
        if base.endswith('\\r\\n'):
            return base[:-4] + '#l\\r\\n' + spaces
        return base + '#l\\r\\n' + spaces

    m = re.match(r'^(.*?)#n(?:(\\r\\n)|(\\n)|)$', inner)   # ...#n / ...#n\r\n
    if m:
        tail = m.group(2) or m.group(3) or ''
        return m.group(1) + '#l' + tail

    if inner.endswith('\\r\\n'):
        return inner[:-4] + '#l\\r\\n'
    if inner.endswith('\\n'):
        return inner[:-2] + '#l\\n'
    return inner + '#l'


def close_item(line):
    ms = list(LIT.finditer(line))
    if not ms:
        return line, False
    last = ms[-1]
    inner = last.group(1)
    new = repl(inner)
    if new == inner:
        return line, False
    s, e = last.span(1)
    return line[:s] + new + line[e:], True


def prefix_k(line):
    m = re.match(r'^(\s*s \+= )"(?!#k)(?!#e\[)([^"]*)"', line)
    if not m:
        return line
    pos = m.start(1) + len(m.group(1)) + 1        # 开引号之后
    return line[:pos] + '#k' + line[pos:]


def main():
    with io.open(TPL, encoding='utf-8', newline='') as f:
        src = f.read()
    first = not os.path.exists(BACKUP)
    if first:
        shutil.copy2(TPL, BACKUP)
        print('已备份原模板 -> %s' % os.path.basename(BACKUP))

    lines = src.split('\n')
    out = []
    warn = []
    for ln, line in enumerate(lines, 1):
        if re.search(r's \+= ', line):
            # 跨行语句（本行以 + 结尾，后面还有续行）交人工处理，别自动改
            if line.rstrip().endswith('+'):
                out.append(line)
                warn.append(('跨行语句，跳过', ln, line.strip()))
                continue
            if '#L' in line:
                line = line.replace('##r', '#b')       # 红色返回按钮 -> 蓝色
                line = ensure_b(line)
                line, hit = close_item(line)
                if not hit:
                    warn.append(('没找到收尾', ln, line.strip()))
            else:
                new = prefix_k(line)
                line = new if new != line else line
        out.append(line)

    new_src = '\n'.join(out)
    if new_src != src:
        with io.open(TPL, 'w', encoding='utf-8', newline='') as f:
            f.write(new_src)

    print('完成。以下行请人工核对：')
    for w, ln, txt in warn:
        print('  [%s] 第 %d 行: %s' % (w, ln, txt[:110]))


if __name__ == '__main__':
    main()
