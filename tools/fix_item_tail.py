# -*- coding: utf-8 -*-
"""删掉选项行尾遗留的空格（换行已有，空格纯属多余）。"""
import io
import os

TPL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gm_menu.template.js')
s = io.open(TPL, encoding='utf-8', newline='').read()

OLD = '#k#l\\r\\n   "'          # 源码里的字面量：#k#l + 反斜杠r反斜杠n + 空格 + 引号
NEW = '#k#l\\r\\n"'
n = s.count(OLD)
s = s.replace(OLD, NEW)
io.open(TPL, 'w', encoding='utf-8', newline='').write(s)
print('清理尾随空格 %d 处' % n)
