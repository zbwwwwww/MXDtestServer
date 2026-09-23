# -*- coding: utf-8 -*-
"""扫 wz/Mob.wz 所有怪物的 hp（info/hp），输出血量 TOP 榜 + 中文名（String.wz/Mob.img.xml）"""
import os, re, io, xml.etree.ElementTree as ET

MOB_DIR = r"D:\MXDtestServer\wz\Mob.wz"
STR_MOB = r"D:\MXDtestServer\wz\String.wz\Mob.img.xml"

# 中文名表
names = {}
try:
    tree = ET.parse(STR_MOB)
    for imgdir in tree.getroot().iter("imgdir"):
        mid = imgdir.get("name")
        if mid and mid.isdigit():
            for e in imgdir.iter("string"):
                if e.get("name") == "name":
                    names[mid] = e.get("value")
                    break
except Exception as ex:
    print("!! String.wz 解析失败:", ex)

boss_list = []
rows = []
pat_hp = re.compile(r'<int name="maxHP" value="(\d+)"')
pat_boss = re.compile(r'<int name="boss" value="1"')

for fn in os.listdir(MOB_DIR):
    if not fn.endswith(".img.xml"):
        continue
    mid = fn[:-8]  # 去 .img.xml
    if not mid.isdigit():
        continue
    p = os.path.join(MOB_DIR, fn)
    with io.open(p, "r", encoding="utf-8", errors="replace") as f:
        txt = f.read()
    m = pat_hp.search(txt)
    if not m:
        continue
    hp = int(m.group(1))
    is_boss = bool(pat_boss.search(txt))
    rows.append((hp, int(mid), is_boss))
    if is_boss:
        boss_list.append((hp, int(mid)))

rows.sort(reverse=True)
boss_list.sort(reverse=True)

def name_of(mid):
    return names.get(str(mid), "?")

print("==== 全部怪物 血量 TOP 15 ====")
print("%-10s %-10s %-6s %s" % ("HP", "ID", "BOSS", "名字"))
for hp, mid, is_boss in rows[:15]:
    print("%-12d %-10d %-6s %s" % (hp, mid, "是" if is_boss else "否", name_of(mid)))

print()
print("==== BOSS 怪 血量 TOP 15 ====")
print("%-10s %-10s %s" % ("HP", "ID", "名字"))
for hp, mid in boss_list[:15]:
    print("%-12d %-10d %s" % (hp, mid, name_of(mid)))

print()
print("统计：总怪物数 %d，其中 boss=1 的 %d 只" % (len(rows), len(boss_list)))
