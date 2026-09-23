# -*- coding: utf-8 -*-
"""生成 101~131 级「点名召唤」怪物清单。

数据源（都是本服现成的 XML，纯读不写）：
  - 等级  : D:\MXDtestServer\wz\Mob.wz\<7位>.img.xml  的 info/level
  - 中文名: D:\MXDtestServer\wz\String.wz\Mob.img.xml  的 <imgdir id><string name=name>
  - BOSS  : Mob.wz 的 info/boss == 1（决定是否剔除）

产出：D:\tmp\gm_extra_mobs_101_131.js
  var MOB_POINTS_101_131 = [ [id, "中文名", level], ... ];
  按 level 升序、同 level 按 id 升序。
"""
import os
import re
import io

MOB_WZ = r"D:\MXDtestServer\wz\Mob.wz"
STRING_WZ = r"D:\MXDtestServer\wz\String.wz\Mob.img.xml"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gm_extra_mobs_101_131.js")

LEVEL_MIN, LEVEL_MAX = 101, 131
INCLUDE_BOSS = False          # True = 连 BOSS 一起点名；False = 只放普通怪（默认，避免挤爆地图）

# ---------- 1. 名字表 ----------
name_txt = io.open(STRING_WZ, encoding="utf-8", errors="replace").read()
names = {}
for m in re.finditer(r'<imgdir name="(\d+)">\s*<string name="name" value="([^"]*)"', name_txt, re.S):
    names[int(m.group(1))] = m.group(2)

# ---------- 2. 遍历 Mob.wz 取等级 + boss 标志 ----------
def gb_ok(s):
    try:
        s.encode("gb2312")
        return True
    except UnicodeEncodeError:
        return False

rows = []
boss_count = 0
for fn in os.listdir(MOB_WZ):
    if not fn.endswith(".img.xml"):
        continue
    mid = int(fn[:-len(".img.xml")])          # 去前导零
    t = io.open(os.path.join(MOB_WZ, fn), encoding="utf-8", errors="replace").read()
    lm = re.search(r'<int name="level" value="(\d+)"', t)
    if not lm:
        continue
    lv = int(lm.group(1))
    if lv < LEVEL_MIN or lv > LEVEL_MAX:
        continue
    bm = re.search(r'<int name="boss" value="(\d+)"', t)
    is_boss = (bm is not None and int(bm.group(1)) != 0)
    if is_boss:
        boss_count += 1
        if not INCLUDE_BOSS:
            continue                        # 默认剔除 BOSS（已有独立召唤BOSS功能）
    nm = names.get(mid)
    if not nm:
        nm = "怪物%d" % mid
    if not gb_ok(nm):
        nm = "怪物%d" % mid               # 名字编不了 GB2312 就降级成 ID 标签
    rows.append((mid, nm, lv, is_boss))

# 排序：level 升序，同 level 按 id 升序
rows.sort(key=lambda r: (r[2], r[0]))

non_boss = [r for r in rows if not r[3]]
print("Lv.%d~%d 怪物总数: %d（其中 BOSS %d，非 BOSS %d；本清单纳入 %d 只）" % (
    LEVEL_MIN, LEVEL_MAX, boss_count + len(non_boss), boss_count, len(non_boss), len(rows)))

# ---------- 3. 写数据文件 ----------
lines = []
for mid, nm, lv, is_boss in rows:
    lines.append('    [%d, "%s", %d],' % (mid, nm, lv))
body = "\n".join(lines)
if body.endswith(","):
    body = body[:-1]
js = "var MOB_POINTS_101_131 = [\n" + body + "\n];\n"
io.open(OUT, "w", encoding="utf-8").write(js)
print("已写出:", OUT, "条目:", len(rows))
print("前 5 条示例:")
for r in rows[:5]:
    print("   ", r[0], r[1], "Lv." + str(r[2]), "(BOSS)" if r[3] else "")
