# -*- coding: utf-8 -*-
"""为 GM 菜单「BOSS 挑战图」准备【真实数据】（不靠记忆猜）：

数据源：
    D:\\MXDtestServer\\wz\\Map.wz\\Map\\Map*\\<9位地图ID>.img.xml   -> life 节点里(type,id)刷的怪
    D:\\MXDtestServer\\wz\\Mob.wz\\<7位>.img.xml                 -> info/boss 标记
    D:\\MXDtestServer\\wz\\String.wz\\Map.img.xml                -> 地图名
    D:\\MXDtestServer\\wz\\String.wz\\Mob.img.xml                -> BOSS 名

★ 三条硬判据（都是实测踩出来的，别改）：
  1. life 子项里 **id 是 <string> 不是 <int>** —— 按 int 抓永远 0 条（第一轮就栽在这）。
  2. wz 的 **level 字段对 BOSS 全是垃圾值（Lv1~7）**，拿 level>=100 筛会把 477 只 BOSS
     几乎全滤掉。只能用 **info/boss != 0** 这个官方标记。
  3. 光有 boss 怪还不够：地图要有 **portal**（落脚点），否则 warp 过去是一片虚空/卡住。

产出的每张图都带 BOSS 名单，菜单里能直接显示"这张图刷的是哪只 BOSS"。

产出：
    D:\\MXDtestServer\\tools\\gm_extra_boss_maps.js
        var BOSS_MAPS_ALL = [
            [mapid, "地图名", boss数, "BOSS名1 / BOSS名2"], ...
        ];
"""
import datetime
import html
import io
import os
import re
import sys

WZ = r'D:\MXDtestServer\wz'
MAP_BASE = os.path.join(WZ, 'Map.wz', 'Map')
MOB_DIR = os.path.join(WZ, 'Mob.wz')
STR_MAP = os.path.join(WZ, 'String.wz', 'Map.img.xml')
STR_MOB = os.path.join(WZ, 'String.wz', 'Mob.img.xml')
OUT = r'D:\MXDtestServer\tools\gm_extra_boss_maps.js'
REPORT = r'D:\MXDtestServer\saves\boss_maps_scan_%s.txt'

problems = []

# ---- 会被排除的 ID 段（脚本占位图 / 事件临时图，进去也没意义） -------------------
BAD_PREFIX = ('9700313', '8891000', '77777777', '99999999')


def gb_ok(s):
    try:
        s.encode('gb2312')
        return True
    except UnicodeEncodeError:
        return False


def js_str(s):
    return '"%s"' % s.replace('\\', '\\\\').replace('"', '\\"')


# ==================================================== 1. 名字表
mstr = io.open(STR_MAP, encoding='utf-8', errors='replace').read()
# 地图名：tab 缩进 + `value="x" />`（斜杠前有空格）
mnames = {}
for m in re.finditer(r'<imgdir name="(\d+)">\s*<string name="streetName"[^>]*>\s*'
                     r'<string name="mapName" value="([^"]*)"\s*/>', mstr):
    mnames[int(m.group(1))] = m.group(2)
print('String.wz/Map 名字 %d 条' % len(mnames))
if len(mnames) < 3000:
    problems.append('地图名只有 %d 条，像是没解析全' % len(mnames))

mobstr = io.open(STR_MOB, encoding='utf-8', errors='replace').read()
bname = {}
for m in re.finditer(r'<imgdir name="(\d{7})">\s*<string name="name" value="([^"]*)"\s*/>', mobstr):
    bname[int(m.group(1))] = m.group(2)
print('String.wz/Mob 名字 %d 条' % len(bname))

# ==================================================== 2. BOSS 怪集合（info/boss != 0）
boss_mobs = {}
for fn in sorted(os.listdir(MOB_DIR)):
    if not re.match(r'^\d{7}\.img\.xml$', fn):
        continue
    mid = int(fn[:7])
    t = io.open(os.path.join(MOB_DIR, fn), encoding='utf-8', errors='replace').read()
    mb = re.search(r'<int name="boss" value="(-?\d+)"', t)
    if mb and int(mb.group(1)) != 0:
        boss_mobs[mid] = True
print('Mob.wz 里 boss!=0 的怪：%d 只' % len(boss_mobs))
if len(boss_mobs) < 300:
    problems.append('BOSS 怪只有 %d 只，像是没解包全' % len(boss_mobs))

# ==================================================== 3. 扫地图
LIFE_RE = re.compile(r'<imgdir name="life">([\s\S]*?)\n  </imgdir>')


def has_portal(t):
    return '<imgdir name="portal">' in t


raw = []
n_life = 0
n_portal = 0
for d in sorted(os.listdir(MAP_BASE)):
    p = os.path.join(MAP_BASE, d)
    if not os.path.isdir(p):
        continue
    for f in sorted(os.listdir(p)):
        if not f.endswith('.img.xml'):
            continue
        mid = int(f[:-8])
        t = io.open(os.path.join(p, f), encoding='utf-8', errors='replace').read()
        if not has_portal(t):
            continue
        n_portal += 1
        m = LIFE_RE.search(t)
        if not m:
            continue
        n_life += 1
        body = m.group(1)
        pairs = re.findall(r'<string name="type" value="(\w+)"/>\s*'
                           r'<string name="id" value="(-?\d+)"', body)
        bs = [int(i) for ty, i in pairs if ty == 'm' and int(i) in boss_mobs]
        if bs:
            raw.append((mid, bs))

print('有 portal 的图 %d，其中有 life 的 %d' % (n_portal, n_life))
print('life 里带 BOSS 怪、且能落脚的图：%d 张' % len(raw))

# ==================================================== 4. 逐条校验
rows = []
drop = []
for mid, bs in raw:
    # wz 里的地图名带 XML 实体（「地铁一号线&lt;第4地区&gt;」），不还原的话
    # 菜单里显示的就是字面量 &lt;/&gt;，跟其它清单的显示风格也不一致
    nm = html.unescape((mnames.get(mid) or '')).strip()
    if not nm:
        drop.append((mid, '(String.wz 里没名字)'))
        continue
    if not gb_ok(nm):
        drop.append((mid, '地图名 GB2312 编不了：%s' % nm))
        continue
    if str(mid).startswith(BAD_PREFIX):
        drop.append((mid, '占位/事件图 ID 段'))
        continue
    if '----------' in nm or nm.startswith('-'):
        drop.append((mid, '名字是占位符：%s' % nm))
        continue
    # BOSS 名单去重：同一个名字可能对应多个怪物 ID（如「守西瓜虎精」有两个号），
    # 不去重的话菜单会显示成「守西瓜虎精 / 守西瓜虎精」
    seen, seen_nm, blist = set(), set(), []
    for b in bs:
        bn = (bname.get(b) or '').strip()
        if b in seen or not bn or bn in seen_nm:
            continue
        seen.add(b)
        seen_nm.add(bn)
        blist.append(bn)
    if not blist:
        drop.append((mid, 'BOSS 怪在 String.wz 里没名字'))
        continue
    # 菜单一行不能太长：最多显示 2 只 BOSS，剩下的用「等 N」带过，总数放第 3 列
    if len(blist) > 2:
        label = ' / '.join(blist[:2]) + ' 等'
    else:
        label = ' / '.join(blist)
    rows.append((mid, nm, len(blist), label))

rows.sort()
print('通过校验：%d 张（丢弃 %d 张）' % (len(rows), len(drop)))
if len(rows) < 100:
    problems.append('BOSS 图只有 %d 张，过滤条件过严，检查上面丢弃原因' % len(rows))

# 表内 ID 唯一（菜单靠下标定位，重复 = 点一次跳两张）
if len(set(r[0] for r in rows)) != len(rows):
    problems.append('结果里有重复的地图 ID')

# ==================================================== 5. 写 JS
lines = []
for mid, nm, cnt, blist in rows:
    lines.append('    [%d, %s, %d, %s]' % (mid, js_str(nm), cnt, js_str(blist)))
js = 'var BOSS_MAPS_ALL = [\n' + ',\n'.join(lines) + '\n];\n'
io.open(OUT, 'w', encoding='utf-8').write(js)

# ==================================================== 6. 报告
stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
rp = REPORT % stamp
os.makedirs(os.path.dirname(rp), exist_ok=True)
with io.open(rp, 'w', encoding='utf-8') as f:
    f.write('BOSS 挑战图扫描报告  %s\n' % stamp)
    f.write('判据：life 里有 boss!=0 的怪，且地图有 portal，且地图名 GB2312 可编码\n\n')
    f.write('=== 保留 %d 张 ===\n' % len(rows))
    for mid, nm, cnt, blist in rows:
        f.write('%d\t%s\t(%d BOSS) %s\n' % (mid, nm, cnt, blist))
    f.write('\n=== 丢弃 %d 张 ===\n' % len(drop))
    for mid, why in drop:
        f.write('%d\t%s\n' % (mid, why))

# ==================================================== 7. 汇总
from collections import Counter
c = Counter()
for _m, _n, _cnt, blist in rows:
    for one in blist.split(' / '):
        c[one] += 1
print('')
print('BOSS 图 %d 张 / JS %.1f KB -> %s' % (len(rows),
                                            len(js.encode('utf-8')) / 1024.0, OUT))
print('报告：%s' % rp)
print('')
print('图里出现次数最多的 BOSS：')
for k, v in c.most_common(25):
    print('   %-20s %3d 张' % (k, v))

# 抽查：确认这几张图真的有 BOSS（用户最在意的点）
probe_ids = (103000900, 103000901, 105040314, 101000103, 674030300, 914030000,
             914020000, 220000000, 280000000, 105070002)
_names = dict((r[0], r[3]) for r in rows)
print('')
print('抽查原手写 BOSS 清单里的图现在去哪了：')
for pid in probe_ids:
    if pid in _names:
        print('   %-9d 在清单里（%s）' % (pid, _names[pid]))
    else:
        print('   %-9d ★ 不在清单里 —— 该图 life 里没有 boss 标记的怪' % pid)

if problems:
    print('')
    print('!! 有问题：')
    for p in problems[:40]:
        print('   ', p)
    raise SystemExit(2)
print('OK')
