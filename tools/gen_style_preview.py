# -*- coding: utf-8 -*-
"""把 GM 菜单几张主菜单的「原始字符串 + 客户端实际显示」打成一份对照文件。"""
import io
import os
import re
import shutil
import time

SRC = r'D:\MXDtestServer\scripts\npc\gm_menu.js'
SAVE = os.path.join(r'D:\MXDtestServer\saves',
                    'gm_menu_style_preview_' + time.strftime('%Y%m%d_%H%M%S') + '.txt')

LEGEND = [
    ('#b', '蓝色开始（颜色会往后继承，直到被 #k 重置）'),
    ('#k', '还原默认颜色'),
    ('#l', '★ 可点选项【结束】。少了它，后面直到下一个 #L 的文字都算进这一行的点击区域'),
    ('#n', '换行。写在选项里会把点击区域多撑一行，不能当收尾'),
    ('#r', '红色（本菜单已禁用）'),
    ('#e', '强调 / 标题'),
    ('#L<n>#', '可点选项开始，n 就是客户端回传的 selection'),
]


def render(text):
    """把标签剥掉，得到客户端大概长什么样（#L 序号换成 [n]）。"""
    t = text.replace('\r\n', '\n')
    out = []
    for line in t.split('\n'):
        probe = re.sub(r'^#+[a-zA-Z]*', '', line)     # 先剥掉行首的颜色/格式标签
        m = re.match(r'^#L(\d+)#(.*)$', probe)
        if m:
            body = re.sub(r'#k?#l$', '', m.group(2))
            body = re.sub(r'#b|#k|#n|#e|#r', '', body)
            out.append('[%s] %s' % (m.group(1), body))
        else:
            body = re.sub(r'#b|#k|#n|#e|#r', '', line)
            out.append(body)
    return '\n'.join(out)


def grab(fn_body):
    """从成品脚本里抠出某个函数的 s += 拼装部分（不执行，纯文本提取）。"""
    i = fn_body.find('s += ')
    return fn_body[i:].split('\n')


def main():
    src = io.open(SRC, encoding='utf-8').read()

    # 抠出 mainMenu 函数体
    m = re.search(r'function mainMenu\(\) \{(.*?)\n\}\n', src, re.S)
    mm = grab(m.group(1))
    # 抠出 warpMenu
    m2 = re.search(r'function warpMenu\(\) \{(.*?)\n\}\n', src, re.S)
    wm = grab(m2.group(1))

    lines = []
    lines.append('GM 菜单排版改版对照 —— 09-25 第 13 轮')
    lines.append('生成时间：' + time.strftime('%Y-%m-%d %H:%M:%S'))
    lines.append('成品：scripts/npc/gm_menu.js（与 9010000.js 字节一致）')
    lines.append('')
    lines.append('=' * 78)
    lines.append('标签说明')
    lines.append('=' * 78)
    for tag, desc in LEGEND:
        lines.append('  %-8s %s' % (tag, desc))
    lines.append('')

    # 把源码里的 XXX.length 换成成品里的真实条数，预览才好看
    counts = {}
    pat = re.compile(r'var (\w+) = \(?\s*(\[[\s\S]*?\n\])\s*\)?\s*;')
    for var, body in pat.findall(src):
        n = len([1 for l in body.split('\n') if re.match(r'^\s*\[\d+,', l)])
        if n:
            counts[var] = n
    counts.setdefault('BOSS_MAPS', 864)   # 有时扫描不到，用最后一次生成值兜底
    counts['MOB_POINTS_101_131'] = counts.get('MOB_POINTS_101_131', 38)

    def fill(text):
        for var, n in counts.items():
            text = text.replace(var + '.length', str(n))
        return text

    for title, body in (('主菜单 mainMenu()', mm), ('传送菜单 warpMenu()', wm)):
        lines.append('=' * 78)
        lines.append(title)
        lines.append('=' * 78)
        for row in body:
            s = fill(row.strip())
            if not s.startswith('s += '):
                continue
            lit = re.findall(r'"((?:[^"\\]|\\.)*)"', s)
            if not lit:
                continue
            raw = ''.join(lit).replace('\\r\\n', '\n').replace('\\n', '\n')
            raw = fill(raw)
            if not raw.strip():
                continue
            lines.append('--- 源码 ---')
            lines.append('    ' + s)
            lines.append('--- 客户端显示（#b 蓝 / #k 默认色 / #l 每行结束）---')
            for r in render(raw).split('\n'):
                lines.append('    ' + r if r else '')
            lines.append('')

    out = '\n'.join(lines)
    io.open(SAVE, 'w', encoding='utf-8').write(out)
    print(SAVE)
    print('%d 字符' % len(out))


if __name__ == '__main__':
    main()
