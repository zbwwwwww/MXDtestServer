# -*- coding: utf-8 -*-
"""为 GM 菜单「召唤怪物-全级别段」准备【真实数据】（不靠记忆猜）：

数据源：
    D:\\MXDtestServer\\wz\\Mob.wz\\<7位补零ID>.img.xml      -> info/level, info/boss, maxHP
    D:\\MXDtestServer\\wz\\String.wz\\Mob.img.xml            -> 中文名

产出：
    D:\\MXDtestServer\\tools\\gm_extra_mobs_all.js
        var MOB_TIERS_ALL = [
            ["Lv.1-10", [[id, "名", lv], ...], ...],
            ...
        ];

只取 **非 BOSS** 的普通怪（BOSS 已由「召唤 BOSS」功能覆盖，混进来会重复且难清）。
每条都做多重校验：ID 存在 / 名字取自 String.wz / GB2312 可编码 / 不是特效临时物件。

★ 第 10 轮起剔除「特效 / 召唤用临时物件」。判据全部来自 wz 的真实字段，不靠名字瞎猜：
    R1 removeAfter 存在            -> 到点自动消失，GM 召唤出来也会自己没了
    R2 maxHP >= 1e6 且 exp == 0 且 hideName=1 -> 血条/展示用体（几千万血，没法打）
    R3 maxHP <= 1                  -> 血量 1 点，纯特效体
    R4 名字写明用途（血条 / 透明怪物 / 宝宝BOSS召唤用 / set0）
    R5 黄金猪猪（活动特效掉落猪，十几个 id 一个名字）
    R6 黑魔法师的XX（剧情召唤物）
    R7 落在 9501000~9501018 这个 debuff 图标号段
  注意：`link` 字段是图形文件引用（正常怪也有），**不能**当特效判据。
"""
import io
import os
import re
import sys

WZ = r'D:\MXDtestServer\wz'
MOB_DIR = os.path.join(WZ, 'Mob.wz')
MOB_STR = os.path.join(WZ, 'String.wz', 'Mob.img.xml')
OUT = r'D:\MXDtestServer\tools\gm_extra_mobs_all.js'

problems = []

# 名字关键词 -> 判据名
NAME_KW = ((u'血条', 'R4'), (u'透明怪物', 'R4'), (u'宝宝BOSS召唤用', 'R4'),
           (u'set0', 'R4'), (u'黄金猪猪', 'R5'), (u'黑魔法师的', 'R6'))
DEBUFF_LO, DEBUFF_HI = 9501000, 9501018
DROP_MAXHP = 1          # R3：血量 <= 1
BIG_HP = 1000000        # R2
APPLY_TO_ALL_SEGS = True   # False = 只清 Lv.1-10 段


def gb_ok(s):
    try:
        s.encode('gb2312')
        return True
    except UnicodeEncodeError:
        return False


def js_str(s):
    return '"%s"' % s.replace('\\', '\\\\').replace('"', '\\"')


INFO_RE = re.compile(r'<imgdir name="info">([\s\S]*?)\n  </imgdir>')


def info_kv(txt):
    """取 Mob.wz 单个文件 info 节点里的所有 int 字段。
    注意两点，都踩过：
      - 血量字段叫 **maxHP**，按 hp 抓永远抓不到（旧代码里那行 hp 正则一直是死的）；
      - info 会嵌 revive / skill 子目录，用 ([\s\S]*?)</imgdir> 会在第一个子目录就截断，
        后面的 removeAfter 就漏了。info 的闭合固定是两空格缩进的 </imgdir>，据此定位。"""
    m = INFO_RE.search(txt)
    if not m:
        return {}
    return dict(re.findall(r'<int name="(\w+)" value="(-?\d+)"\s*/>', m.group(1)))


def junk_why(mid, nm, kv):
    why = []
    if kv.get('removeAfter') is not None:
        why.append('R1 removeAfter=' + kv['removeAfter'])
    hp = int(kv.get('maxHP', -1))
    exp = int(kv.get('exp', -1))
    if hp >= BIG_HP and exp == 0 and kv.get('hideName') == '1':
        why.append('R2 血条体 hp=%d' % hp)
    if 0 <= hp <= DROP_MAXHP:
        why.append('R3 血量%d的特效体' % hp)
    for kw, tag in NAME_KW:
        if kw in nm:
            why.append('%s 名字含「%s」' % (tag, kw))
            break
    if DEBUFF_LO <= mid <= DEBUFF_HI:
        why.append('R7 debuff图标')
    return why


# ==================================================== 1. 怪物名（String.wz/Mob.img.xml）
names = {}
for m in re.finditer(r'<imgdir name="(\d{7})">\s*<string name="name" value="([^"]*)"',
                     io.open(MOB_STR, encoding='utf-8', errors='replace').read()):
    names[int(m.group(1))] = m.group(2)
print('String.wz/Mob.img.xml 读到 %d 个名字' % len(names))
if len(names) < 1000:
    problems.append('怪物名只有 %d 条，像是没解析全' % len(names))

# 抽查几条，防偏移
for probe_id in (9300003, 8800002, 2220000):
    if probe_id in names:
        print('   抽查 %d -> %s' % (probe_id, names[probe_id]))

# ==================================================== 2. 怪物属性（Mob.wz/*.img.xml）
mobs = {}          # id -> (level, boss)
mob_files = sorted(f for f in os.listdir(MOB_DIR) if re.match(r'^\d{7}\.img\.xml$', f))
print('Mob.wz 共 %d 个文件' % len(mob_files))
if len(mob_files) < 1400:
    problems.append('Mob.wz 文件数只有 %d，像是没解包全' % len(mob_files))

for fn in mob_files:
    mid = int(fn[:7])
    try:
        txt = io.open(os.path.join(MOB_DIR, fn), encoding='utf-8', errors='replace').read()
    except Exception as e:
        problems.append('读 %s 失败：%s' % (fn, e))
        continue
    # level / boss 仍按「文件里第一个」的老规矩取：这两个字段的取法一改，
    # 怪就会在段之间迁移（实测 6 只因此挪段），属于本轮之外，先不动。
    mlv = re.search(r'<int name="level" value="(-?\d+)"', txt)
    mboss = re.search(r'<int name="boss" value="(-?\d+)"', txt)
    if not mlv:
        continue
    mobs[mid] = (int(mlv.group(1)),
                 int(mboss.group(1)) if mboss else 0)

normals = [m for m in mobs if mobs[m][1] == 0]
print('读到 %d 只怪，其中普通怪（非BOSS）%d 只' % (len(mobs), len(normals)))
if len(normals) < 800:
    problems.append('普通怪只有 %d 只，数量不对' % len(normals))

# ==================================================== 3. 按等级分段
# 段位：左闭右开，最后一段闭区间到 999
SEGS = [(1, 10), (11, 20), (21, 30), (31, 40), (41, 50), (51, 60),
        (61, 70), (71, 80), (81, 90), (91, 100), (101, 110), (111, 120), (121, 999)]

skipped_noname = []
skipped_gb = []
skipped_junk = []
junk_report = []    # (段名, id, 名字, 判据)

tiers = []
for lo, hi in SEGS:
    rows = []
    for mid in sorted(normals, key=lambda x: (mobs[x][0], x)):
        lv = mobs[mid][0]
        if not (lo <= lv <= hi):
            continue
        nm = names.get(mid)
        if nm is None or not nm.strip():
            # 少数怪（多是 6 位 ID 的脚本怪）在 String.wz 里没名字，跳过即可
            skipped_noname.append((mid, lv))
            continue
        nm = nm.strip()
        if not gb_ok(nm):
            # 繁体/生僻字在 GB2312 里编不了（封包会乱码），跳过该条
            skipped_gb.append((mid, lv, nm))
            continue
        # 特效 / 召唤用临时物件：留在菜单里只会占地方，还召唤完自己消失
        why = []
        if APPLY_TO_ALL_SEGS or lo == 1:
            why = junk_why(mid, nm, info_kv(io.open(
                os.path.join(MOB_DIR, '%07d.img.xml' % mid),
                encoding='utf-8', errors='replace').read()))
        if why:
            skipped_junk.append((mid, nm, why))
            junk_report.append(('Lv.%d-%d' % (lo, hi) if hi < 999 else 'Lv.%d 以上' % lo,
                                mid, nm, why))
            continue
        rows.append((mid, nm, lv))
    if not rows:
        problems.append('段 Lv.%d-%s 一只怪都没有（不该出现，检查 SEGS）' % (lo, hi))
        continue
    label = 'Lv.%d-%d' % (lo, hi) if hi < 999 else 'Lv.%d 以上' % lo
    tiers.append((label, rows))

if not tiers:
    problems.append('一段都没生成')

# ==================================================== 3.5 按名字去重：同名怪只保留 ID 最小的那只
# 正式怪 ID 偏小（3xxxxx/4xxxxx），变体怪（PQ/PC/GL/JP版）ID 偏大（9xxxxx），
# 保留 ID 最小 = 保留最标准的版本。
dedup_dropped = []
dedup_tiers = []
for label, rows in tiers:
    seen_names = {}
    for row in rows:
        mid, nm, lv = row
        if nm in seen_names:
            old_row = seen_names[nm]
            if mid < old_row[0]:
                dedup_dropped.append((label, old_row[0], old_row[1], old_row[2]))
                seen_names[nm] = row
            else:
                dedup_dropped.append((label, mid, nm, lv))
        else:
            seen_names[nm] = row
    dedup_tiers.append((label, sorted(seen_names.values(), key=lambda r: (r[2], r[0]))))
tiers = dedup_tiers
print('')
print('按名字去重：剔除 %d 只同名变体怪' % len(dedup_dropped))
for seg, mid, nm, lv in dedup_dropped[:30]:
    print('   %-14s %-9s Lv.%-3d %s' % (seg, mid, lv, nm))

# ==================================================== 4. 写 JS
lines = []
total = 0
for label, rows in tiers:
    lines.append('    [%s, [' % js_str(label))
    for k, (mid, nm, lv) in enumerate(rows):
        comma = ',' if k < len(rows) - 1 else ''
        lines.append('        [%d, %s, %d]%s' % (mid, js_str(nm), lv, comma))
        total += 1
    lines.append('    ]],')
if lines:
    lines[-1] = lines[-1].rstrip(',')

js = 'var MOB_TIERS_ALL = [\n' + '\n'.join(lines) + '\n];\n'
io.open(OUT, 'w', encoding='utf-8').write(js)

# ==================================================== 5. 汇报
print('')
print('软跳过：%d 只因无名字 / %d 只因名字 GB2312 编不了' % (len(skipped_noname), len(skipped_gb)))
for mid, lv, nm in skipped_gb[:10]:
    print('   GB跳过 %d Lv.%d %s' % (mid, lv, nm))
if len(skipped_noname):
    print('   无名字 ID：%s' % ', '.join(str(m) for m, _l in skipped_noname[:20]))
print('')
print('剔除特效/召唤临时物件 %d 只：' % len(skipped_junk))
cur = None
for mid, nm, why in skipped_junk:
    if cur is None:
        cur = nm
    print('   %-9s %-14s %s' % (mid, nm, '; '.join(why)))
print('')
print('MOB_TIERS_ALL：%d 段 / %d 只' % (len(tiers), total))
for label, rows in tiers:
    print('   %-14s %3d 只' % (label, len(rows)))
print('JS 大小 %.1f KB -> %s' % (len(js.encode('utf-8')) / 1024.0, OUT))
# 剔除清单落盘，方便回滚（哪只不该删，直接把 ID 加回白名单重跑即可）
import datetime
_stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
_junk_path = r'D:\MXDtestServer\saves\mob_junk_dropped_%s.txt' % _stamp
os.makedirs(os.path.dirname(_junk_path), exist_ok=True)
with io.open(_junk_path, 'w', encoding='utf-8') as f:
    f.write('剔除的「特效/召唤用临时物件」清单  %s\n' % _stamp)
    f.write('合计 %d 只。要回滚：把这些 ID 从段里加回去，或把 APPLY_TO_ALL_SEGS 改 False。\n\n'
            % len(junk_report))
    for seg, mid, nm, why in junk_report:
        f.write('%-14s %-9s %-16s %s\n' % (seg, mid, nm, '; '.join(why)))
print('')
print('完整剔除清单（便于回滚）：%s（%d 只）' % (_junk_path, len(junk_report)))

if problems:
    print('')
    print('!! 有问题：')
    for p in problems[:40]:
        print('   ', p)
    raise SystemExit(2)
print('OK')
