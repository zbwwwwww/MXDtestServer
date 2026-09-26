# -*- coding: utf-8 -*-
"""
v2（2026-09-22）：技能 / 物品菜单改成【分组 + 每行一个、可点击】的数据结构。

数据来源（全部是之前验证过的真实数据，不靠记忆猜）：
  技能  : handbook/GM提示文本-待粘贴.txt（12 个职业的四转技能 + 轻功）
          技能中文名用 fixE-bench/skill_names_all.tsv（从客户端 String.wz/Skill.img 导出，542 条）
  物品  : handbook/装备ID-中文名-120级以上.md（132 件，含等级/部位）
          消耗品名用 fixE-bench/consume_probe.txt（从客户端 String.wz/Consume.img 探出）

产出：scripts/npc/gm_menu.js 与 scripts/npc/9010000.js（同一份字节）
校验：GB2312 全量 + 技能名交叉核对 + 技能归属职业核对 + 条目数核对
"""
import ast
import io
import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
TPL = os.path.join(_HERE, "gm_menu.template.js")
OUT1 = r"D:\MXDtestServer\scripts\npc\gm_menu.js"
OUT2 = r"D:\MXDtestServer\scripts\npc\9010000.js"
EQP_MD = r"D:\MXDtestServer\handbook\装备ID-中文名-120级以上.md"
HINT_TXT = r"D:\MXDtestServer\handbook\GM提示文本-待粘贴.txt"
SKILL_TSV = os.path.join(_HERE, "fixE-bench", "skill_names_all.tsv")
HUNT_TXT = r"D:\MXDtestServer\handbook\猎场清单-补充-待粘贴.txt"
BOSS_TIERS_JS = os.path.join(_HERE, "gm_extra_boss.js")      # 第 8 轮：可召唤 BOSS（gen_extra_data.py 产出）
TOWNS_JS = os.path.join(_HERE, "gm_extra_towns.js")              # 城镇全表（gen_maps_extra.py 产出）
HUNT_HIGH_JS = os.path.join(_HERE, "gm_extra_hunts_high.js")     # Lv.100+ 练级场（gen_maps_extra.py 产出）
MOB_ALL_JS = os.path.join(_HERE, "gm_extra_mobs_all.js")         # 召唤怪物-全级别段（gen_mob_all.py 产出）
BOSS_MAP_JS = os.path.join(_HERE, "gm_extra_boss_maps.js")       # BOSS 挑战图全表（gen_boss_maps.py 产出，第 12 轮）

problems = []
notes = []


def gb_ok(s):
    try:
        s.encode('gb2312')
        return True
    except UnicodeEncodeError:
        return False


def js_str(s):
    return '"%s"' % s.replace('\\', '\\\\').replace('"', '\\"')


# ==================================================== 0. 技能名表（542 条）
skill_name = {}
for line in io.open(SKILL_TSV, encoding='utf-8').read().splitlines():
    m = re.match(r'^(\d+)\t(.+?)\s*$', line)
    if m:
        skill_name[int(m.group(1))] = m.group(2)

if len(skill_name) != 542:
    problems.append('技能名表条数 = %d（期望 542）' % len(skill_name))

bad_name = sorted(k for k, v in skill_name.items() if not gb_ok(v))
if bad_name:
    problems.append('技能名里有 GB2312 编不了的：%s' % bad_name[:10])

# 生成 "id:名;id:名;..." 紧凑串（脚本里懒解析成 map）
name_pairs = []
for sid in sorted(skill_name):
    name_pairs.append('%d:%s' % (sid, skill_name[sid]))
SKILL_NAME_TXT = ';'.join(name_pairs) + ';'

# ==================================================== 1. 技能分组（12 职业 + 跨职业）
hint = io.open(HINT_TXT, encoding='utf-8').read().split('\n')
start = next(n for n, l in enumerate(hint) if l.startswith('■ 各职业四转技能'))
job_lines = []
for l in hint[start + 1:]:
    if l.startswith('■ 飞侠'):
        break
    if l.strip():
        job_lines.append(l.rstrip())

if len(job_lines) != 12:
    problems.append('四转技能行数 = %d（期望 12）' % len(job_lines))

skill_groups = []       # [(job_id, label, [(sid, name), ...])]
for line in job_lines:
    body = line.strip()
    if body.startswith('★'):
        body = body[1:]
    body = body.split('←')[0]                      # 去掉 "← 你当前职业" 注解
    if '：' not in body:
        problems.append('技能行没有全角冒号：%s' % body[:30])
        continue
    label, right = body.split('：', 1)
    label = label.strip()
    mjob = re.search(r'\((\d+)\)', label)
    if not mjob:
        problems.append('技能行职业名里没找到编号：%s' % label)
        continue
    job_id = int(mjob.group(1))

    ids = [(m.start(), m.end(), int(m.group(0))) for m in re.finditer(r'\d{7}', right)]
    pairs = []
    for i, (s0, e0, sid) in enumerate(ids):
        end = ids[i + 1][0] if i + 1 < len(ids) else len(right)
        nm = right[e0:end].strip()
        true_nm = skill_name.get(sid)
        if true_nm is None:
            problems.append('技能 %d 不在 Skill.img 名表里（%s 组）' % (sid, label))
            continue
        if nm and nm != true_nm:
            notes.append('技能名以 wz 为准：%d 提示里写 "%s"、wz 是 "%s"' % (sid, nm, true_nm))
        if sid // 10000 != job_id:
            problems.append('技能 %d 不属于 %d 职业（id//10000=%d）' % (sid, job_id, sid // 10000))
        pairs.append((sid, true_nm))

    if not pairs:
        problems.append('%s 组一个技能都没解析出来' % label)
    skill_groups.append((job_id, label, pairs))

# 跨职业：轻功（三个职业各一份，名字都用 wz 里的 "轻功"）
CROSS = [(4101004, '轻功(刺客)'), (4201003, '轻功(侠客)'), (9001001, '轻功(GM)')]
cross_pairs = []
for sid, label in CROSS:
    if skill_name.get(sid) != '轻功':
        problems.append('轻功核对失败：%d 的 wz 名是 %r' % (sid, skill_name.get(sid)))
    cross_pairs.append((sid, label))
skill_groups.append((0, '跨职业-轻功', cross_pairs))

# ==================================================== 2. 物品分组（132 件装备 + 消耗品）
txt = io.open(EQP_MD, encoding='utf-8').read()
items = []
for m in re.finditer(r'^\|\s*(\d{7})\s*\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$', txt, re.M):
    items.append((int(m.group(1)), int(m.group(2)), m.group(3).strip(), m.group(4).strip()))

if len(items) != 132:
    sys.exit('装备条数不对：%d（期望 132）' % len(items))

CAT_ORDER = ['帽', '套服', '鞋', '手套', '盾', '披风', '饰品', '武器', '骑宠(鞍)', '骑宠(龙)']

by_cat = {}
for iid, lv, cat, name in items:
    by_cat.setdefault(cat, []).append((lv, iid, name))

unknown = set(by_cat) - set(CAT_ORDER)
if unknown:
    sys.exit('出现没归类的中文类别：%s' % unknown)

# ===== 第 9 轮：GM 套装（维泽特系列），作为物品菜单的第一组 =====
# 这 4 件是同一套 GM 外观（Wizet=冒险岛原开发商），拆开只加帽子会很怪，一起放。
# 属性来源：Character.wz 全量扫描（维泽特帽 四维 999×4/防 400，提包 攻 200，西装西裤纯外观）
GM_SET = [
    (1002140, '★维泽特帽(GM帽)', 1),
    (1042003, '维泽特西装', 1),
    (1062007, '维泽特西裤', 1),
    (1322013, '维泽特特殊提包', 1),
]
for _iid, _nm, _q in GM_SET:
    if not gb_ok(_nm):
        problems.append('GM 套装名 GB2312 编不了：%d %s' % (_iid, _nm))

# ===== 第 10 轮：S 档超模装备，作为物品菜单的第二组 =====
# 判定口径见 handbook\装备-超模装备清单.md：
#   四维和 >=40 / 攻击 >=200 / 防御 >=300 / HP >=5000
# 参照分布（全量 13509 件）：四维中位 4、p95=16；攻击 p95=141；防御 p95=114
#   ⇒ 上面这些阈值已经是明确的离群点，不是拍脑袋定的。
# 注意：维泽特帽与第 1 组（GM 套装）是同一件（ID 相同），这里再列一次只是为了"超模榜"完整。
S_TIER = [
    (1002140, '★维泽特帽(GM帽)', 1),      # 四维各 +999（全服唯一）
    (1004637, '★愤怒的扎昆头盔', 1),      # 四维 45x4、防 600、可升级 11 次
    (1003800, '★高贵刺客软帽', 1),        # 命中 240、防 300、可升级 11 次
    (1003604, '★月夜见尊的帽子', 1),      # 命中 250、防 333
    (1052202, '玩具品克缤套服', 1),       # 可升级 12 次（全服最高）
    (1382049, '★朱雀长杖', 1),            # 攻 286（全服最高）
    (1382050, '★玄武长杖', 1),
    (1382051, '★白虎长杖', 1),
    (1382052, '★青龙长杖', 1),
    (1143159, '最爱可妮兔勋章', 1),       # HP +25000（全服最高）
    (1142207, '春花胸针', 1),             # HP +20000
    (1143117, '艾丽卡的守护骑士', 1),     # HP +20000
    (1142609, '耀眼蓝宝石', 1),           # HP +15000
    (1142922, '星期怪物帕克', 1),         # HP +15000
]

# 交叉校验：S 档每件都必须出现在全量扫描结果里，且名字对得上（防手抄错）
_eqscan = {}
for _line in io.open(r'D:\tmp\equip_all.tsv', encoding='utf-8').read().splitlines()[1:]:
    _p = _line.split('\t')
    if len(_p) >= 3 and _p[1].isdigit():
        _eqscan[int(_p[1])] = _p[2]
for _iid, _nm, _q in S_TIER:
    if not gb_ok(_nm):
        problems.append('S 档名 GB2312 编不了：%d %s' % (_iid, _nm))
    if _iid not in _eqscan:
        problems.append('S 档 %d 在 equip_all.tsv 里找不到' % _iid)
    elif _eqscan[_iid] not in _nm.lstrip('★'):
        problems.append('S 档 %d 名字对不上：写的是 %s，wz 是 %s' % (_iid, _nm, _eqscan[_iid]))
if len(S_TIER) != 14:
    sys.exit('S 档条数不对：%d（期望 14）' % len(S_TIER))

item_groups = [('GM套装(维泽特)', GM_SET), ('S档超模装备', S_TIER)]
total_eq = 0
for cat in CAT_ORDER:
    if cat not in by_cat:
        continue
    lst = sorted(by_cat[cat], key=lambda r: (-r[0], r[1]))
    pairs = []
    for lv, iid, name in lst:
        disp = ('★%s' % name) if lv >= 150 else name
        if not gb_ok(disp):
            problems.append('物品名 GB2312 编不了：%d %s' % (iid, disp))
        pairs.append((iid, disp, 1))
    total_eq += len(pairs)
    item_groups.append((cat, pairs))

if total_eq != 132:
    sys.exit('分类汇总后条数不对：%d' % total_eq)

# 消耗品：ID/名字用 consume_probe.txt 里探出来的（真名），数量是"点一下给多少"
CONSUME = [
    (2000000, '红色药水', 100),
    (2000002, '白色药水', 100),
    (2000003, '蓝色药水', 100),
    (2000005, '超级药水', 100),
    (2000006, '活力神水', 100),
    (2022000, '矿泉水', 100),
    (2050004, '万能疗伤药', 50),
    (2030000, '回城卷轴', 50),
    (2040000, '头盔防御卷轴', 10),
    (2040700, '鞋子敏捷度卷轴', 10),
    (2060000, '弓矢', 500),
    (2061000, '弩矢', 500),
    (2070005, '金钱镖', 300),
    (2330005, '穿甲弹', 300),
]
probe = {}
for line in io.open(r"D:\tmp\fixE-bench\consume_probe.txt", encoding='utf-8').read().splitlines():
    m = re.match(r'^(\d+)\t(.+?)\s*$', line)
    if m:
        probe[int(m.group(1))] = m.group(2)
for iid, nm, qty in CONSUME:
    if probe.get(iid) != nm:
        problems.append('消耗品核对失败：%d 写的是 %s，wz 是 %r' % (iid, nm, probe.get(iid)))
item_groups.append(('常用消耗品', [(i, n, q) for i, n, q in CONSUME]))

# ==================================================== 3. 地图清单（沿用旧逻辑）
hunt = io.open(HUNT_TXT, encoding='utf-8').read()
blk = hunt.split('============ 【方案一】推荐版：30 个（现有 18 + 精选新增 12）============')[1]
blk = blk.split('];')[0]
hunt_rows = re.findall(r'\[(\d+),\s*"([^"]+)",\s*(\d+)\]', blk)
if len(hunt_rows) != 30:
    sys.exit('猎场条数不对：%d（期望 30）' % len(hunt_rows))


# ==================================================== 3.5 可召唤 BOSS（第 8 轮）
# 数据由 gen_extra_data.py 从服务端 Mob.wz 全量导出后精选，这里只做装配 + 校验
boss_raw = io.open(BOSS_TIERS_JS, encoding='utf-8').read()
mb = re.search(r'var BOSS_TIERS = (\[[\s\S]*\]);', boss_raw)
if not mb:
    sys.exit('gm_extra_boss.js 里找不到 BOSS_TIERS 数组')
BOSS_TIERS_TXT = mb.group(1)

# 结构守卫：BOSS_TIERS_TXT 必须是【完整的数组字面量】，且顶层正好 3 档、每档 12 只。
# 加这道检查是因为踩过一次坑：模板写成 var BOSS_TIERS = [ /*@BOSS_TIERS@*/ ];，
# 占位符本身带最外层 []，结果被套了两层 -> BOSS_TIERS.length == 1，
# 档位菜单只剩「返回」一项、档名被拼成一整串数据。语法没错、GB2312 也过，
# 只有真正点菜单才会露馅，所以必须在生成阶段拦下来。
try:
    _boss_parsed = ast.literal_eval(BOSS_TIERS_TXT)
except Exception as e:
    problems.append('BOSS_TIERS 不是合法数组字面量：%s' % e)
    _boss_parsed = None
if _boss_parsed is not None:
    if not isinstance(_boss_parsed, list) or len(_boss_parsed) != 3:
        problems.append('BOSS_TIERS 顶层元素数 = %s（期望 3）—— 是不是又被多套了一层 []？'
                        % (len(_boss_parsed) if isinstance(_boss_parsed, list) else type(_boss_parsed).__name__))
    else:
        for _tn, _rows in _boss_parsed:
            if len(_rows) != 12:
                problems.append('BOSS 档「%s」条目数 = %d（期望 12）' % (_tn, len(_rows)))

boss_rows = re.findall(r'\[(\d{7}), "([^"]+)", (\d+), (\d+)\]', BOSS_TIERS_TXT)
boss_tier_names = re.findall(r'^\s{4}\["([^"]+)", \[', BOSS_TIERS_TXT, re.M)
if len(boss_rows) != 36:
    problems.append('BOSS 条目数 = %d（期望 36）' % len(boss_rows))
if len(boss_tier_names) != 3:
    problems.append('BOSS 档数 = %d（期望 3）' % len(boss_tier_names))
for bid, bnm, blv, bhp in boss_rows:
    if not gb_ok(bnm):
        problems.append('BOSS 名 GB2312 编不了：%s %s' % (bid, bnm))
if not gb_ok(BOSS_TIERS_TXT):
    problems.append('BOSS 数据块含 GB2312 编不了的字符')

notes.append('可召唤 BOSS：%d 只 / %d 档（%s）' % (
    len(boss_rows), len(boss_tier_names), '、'.join(boss_tier_names)))



# ==================================================== 3.7 通用数组守卫
# BOSS_TIERS / MOB_POINTS 那两段是逐份写的，这里抽成公共函数给第 9 轮三个新数据块用。
# 存在意义同上：占位符自带最外层 []，模板若写成 var X = [ /*@X@*/ ]; 就会被套两层，
# 语法和 GB2312 都过得去，只有真正点菜单才会露馅，所以必须在生成阶段拦下来。
def load_arr(path, varname):
    """从数据文件抠出数组字面量。文件缺失就直接退出，别留下半截产物。"""
    if not os.path.isfile(path):
        sys.exit('数据文件不存在：%s（先跑对应的 gen_*.py 生成它）' % path)
    txt = io.open(path, encoding='utf-8').read()
    m = re.search(r'var %s = (\[[\s\S]*\]);\s*$' % re.escape(varname), txt)
    if not m:
        sys.exit('%s 里找不到 var %s = [...] 数组' % (path, varname))
    return m.group(1)


def guard_array(txt, label, expect_top=None, row_len=None, deep=None):
    """校验数组字面量：顶层非空 list；可选顶层元素数；可选每行长度；
    deep(顶层元素, 行) 用于 MOB_TIERS_ALL 这种两层结构。"""
    try:
        parsed = ast.literal_eval(txt)
    except Exception as e:
        problems.append('%s 不是合法数组字面量：%s' % (label, e))
        return None
    if not isinstance(parsed, list) or len(parsed) == 0:
        problems.append('%s 顶层不是非空数组（是不是被多套了一层 []？）：%s'
                        % (label, type(parsed).__name__))
        return None
    if expect_top is not None and len(parsed) != expect_top:
        problems.append('%s 顶层元素数 = %d（期望 %d）' % (label, len(parsed), expect_top))
    # deep 模式下顶层是「[段名, 行列表]」，顶层元素本身不是数据行，
    # 所以不能拿 row_len 去量顶层（否则第一行永远是段名，会误报）。
    if row_len and not deep:
        for r in parsed:
            if not (isinstance(r, list) and len(r) == row_len and
                    isinstance(r[0], int) and isinstance(r[row_len - 1], int)):
                problems.append('%s 行结构不对（应为 [%s]）：%r'
                                % (label, ', '.join(['int'] * row_len), r))
                break
    if deep:
        for top, rows in parsed:
            if not (isinstance(rows, list) and len(rows) > 0):
                problems.append('%s 段「%s」里没有怪物行' % (label, top))
                continue
            for r in rows:
                if not (isinstance(r, list) and len(r) == row_len and
                        isinstance(r[0], int) and isinstance(r[row_len - 1], int)):
                    problems.append('%s 行结构不对（应为 [%s]）：%r'
                                    % (label, ', '.join(['id', 'str', 'int']), r))
                    break
    return parsed


# ==================================================== 3.8 传送地图扩充（第 9 轮）
# 城镇全表 / Lv.100+ 练级场：数据都由 gen_maps_extra.py 从服务端 Map.wz 全量导出后精选，
# 这里只做装配 + 校验。
TOWN_EXTRA_TXT = load_arr(TOWNS_JS, 'TOWN_MAPS_EXTRA')
HUNT_HIGH_TXT = load_arr(HUNT_HIGH_JS, 'HUNT_MAPS_HIGH')
# 第 12 轮：BOSS 挑战图不再手写，改成 wz 全量扫描。行结构 [地图ID, 地图名, BOSS数, BOSS名单]，
# 比其它列表多一列（BOSS 名单要显示在菜单里），所以校验规则也不一样。
BOSS_MAP_TXT = load_arr(BOSS_MAP_JS, 'BOSS_MAPS_ALL')

for _lab, _txt in (('TOWN_MAPS_EXTRA', TOWN_EXTRA_TXT), ('HUNT_HIGH', HUNT_HIGH_TXT)):
    guard_array(_txt, _lab, row_len=3)
    if not gb_ok(_txt):
        problems.append('%s 数据块含 GB2312 编不了的字符' % _lab)

_boss_rows = guard_array(BOSS_MAP_TXT, 'BOSS_MAPS_ALL')
for _r in (_boss_rows or []):
    if not (isinstance(_r, list) and len(_r) == 4 and isinstance(_r[0], int)
            and isinstance(_r[1], str) and _r[1] and isinstance(_r[2], int)
            and _r[2] > 0 and isinstance(_r[3], str) and _r[3]):
        problems.append('BOSS 图行结构不对（应为 [int, str, int, str]）：%r' % (_r,))
        break
if _boss_rows and not gb_ok(BOSS_MAP_TXT):
    problems.append('BOSS 图数据块含 GB2312 编不了的字符')
if _boss_rows:
    _bp = sum(1 for _r in _boss_rows if _r[0] in (103000900, 103000901, 105040314, 101000103,
                                                  674030300, 914030000, 914020000))
    print('BOSS 挑战图 %d 张（其中原手写 11 张里的 7 张在列：%d）'
          % (len(_boss_rows), _bp))

town_extra_rows = re.findall(r'\[(\d+), "([^"]+)", (\d+)\]', TOWN_EXTRA_TXT)
hunt_high_rows = re.findall(r'\[(\d+), "([^"]+)", (\d+)\]', HUNT_HIGH_TXT)
if len(town_extra_rows) == 0:
    problems.append('TOWN_MAPS_EXTRA 一条都没解析出来')
if len(hunt_high_rows) == 0:
    problems.append('Lv.100+ 练级场一条都没解析出来')
for _mid, _nm, _lv in town_extra_rows + hunt_high_rows:
    if not gb_ok(_nm):
        problems.append('地图名 GB2312 编不了：%s %s' % (_mid, _nm))
    if len(_mid) != 9:
        problems.append('地图 ID 不是 9 位：%s %s' % (_mid, _nm))

# ---- 第 11 轮：把「常用城镇」并进「全部城镇」----
# 原来手写的 14 个常用城镇是精选清单，wz 全量那 90 张是后来从 Map.wz 挖出来的，
# 两边有重叠。取并集去重后菜单里只剩一份，玩家不用为了「射手村」再去翻 100 行。
# TOWN_ROWS 定义在第 4 节（离这里很远），这里先抽出来，合并完再删掉原定义。
TOWN_ROWS = [
    ('100000000', '射手村', '0'), ('101000000', '魔法密林', '0'),
    ('102000000', '勇士部落', '0'), ('103000000', '废弃都市', '0'),
    ('104000000', '明珠港', '0'), ('120000000', '诺特勒斯号码头', '0'),
    ('200000000', '天空之城', '0'), ('211000000', '冰峰雪域', '0'),
    ('220000000', '玩具城', '0'), ('230000000', '水下世界', '0'),
    ('240000000', '神木村', '0'), ('250000000', '武陵', '0'),
    ('260000000', '阿里安特', '0'), ('910000000', '自由市场', '0'),
]

_town_merged = {}
for _mid, _nm, _lv in [(_m, _n, '0') for _m, _n, _lv in TOWN_ROWS] + town_extra_rows:
    _town_merged[_mid] = _nm
_town_dup = len(TOWN_ROWS) + len(town_extra_rows) - len(_town_merged)
town_all_rows = [(_m, _n, '0') for _m, _n in sorted(
    _town_merged.items(), key=lambda kv: (int(kv[0]) // 1000, kv[0]))]
if len(town_all_rows) < 90:
    problems.append('合并后的城镇只有 %d 张，像是合并逻辑写错了' % len(town_all_rows))
notes.append('城镇合并去重：常用 %d + wz 精选 %d 张，去重 %d 张，实得 %d 张' % (
    len(TOWN_ROWS), len(town_extra_rows), _town_dup, len(town_all_rows)))

# 合并结果里每个 ID 只能出现一次（点菜单靠下标定位，重复行 = 点一次跳两张图）
_seen = set()
for _mid, _nm, _lv in town_all_rows:
    if _mid in _seen:
        problems.append('合并后城镇 ID 重复：%s %s' % (_mid, _nm))
    _seen.add(_mid)

# 地图 ID 在各自表内不能重复（同名两行在点菜单时会撞在一起）。
# 只查「各自表内」—— 拿 hunt_rows + hunt_high_rows 一起查的话，那 19 张重合的图
# 本来就是靠下面的合并消掉的，提前报重复等于自己跟自己打架。
for _lab, _rows in (('城镇全表', town_all_rows),
                    ('猎场清单', hunt_rows), ('Lv.100+ 练级场', hunt_high_rows)):
    _seen = set()
    for _mid, _nm, _lv in _rows:
        if _mid in _seen:
            problems.append('%s 里地图 ID 重复：%s %s' % (_lab, _mid, _nm))
        _seen.add(_mid)

# ---- 第 10 轮：把「高等级猎场」并进「Lv.100 以上练级场」----
# handbook 精选的 30 张和 gen_maps_extra.py 出的 46 张有 19 张是同一张图（两边都选过），
# 取并集、按怪等级从高到低排，菜单里一条看全，「高等级猎场」那一档就此取消。
_merged = {}
for _mid, _nm, _lv in hunt_rows + hunt_high_rows:
    _merged[_mid] = (_nm, int(_lv))
_dup = len(hunt_rows) + len(hunt_high_rows) - len(_merged)
hunt_rows = [(k, v[0], str(v[1]))
             for k, v in sorted(_merged.items(), key=lambda kv: (-kv[1][1], int(kv[0])))]
if len(hunt_rows) < 40:
    problems.append('合并后的练级场只有 %d 张，像是合并逻辑写错了' % len(hunt_rows))
notes.append('练级场合并去重：%d + %d 张，去重 %d 张，实得 %d 张' % (
    len(hunt_rows), len(hunt_high_rows), _dup, len(hunt_rows)))

# 等级列必须真的 >= 100，否则菜单标题就在骗人
_bad_lv = [r for r in hunt_rows if int(r[2]) < 100]
if _bad_lv:
    problems.append('练级场里有 %d 张等级不足 Lv.100：%s'
                    % (len(_bad_lv), ', '.join('%s %s' % (r[0], r[1]) for r in _bad_lv[:5])))

notes.append('城镇全表 %d 张 / Lv.100 以上练级场 %d 张（怪等级 %s~%s）' % (
    len(town_all_rows), len(hunt_rows),
    min([int(r[2]) for r in hunt_rows], default=0),
    max([int(r[2]) for r in hunt_rows], default=0)))

# ==================================================== 3.9 召唤怪物-全级别段（第 9 轮）
# 13 档（Lv.1-10 ~ Lv.121 以上），数据源 gen_mob_all.py（Mob.wz 全量 + 剔除 BOSS）。
MOB_ALL_TXT = load_arr(MOB_ALL_JS, 'MOB_TIERS_ALL')
guard_array(MOB_ALL_TXT, 'MOB_TIERS_ALL', row_len=3, deep=True)
if not gb_ok(MOB_ALL_TXT):
    problems.append('MOB_TIERS_ALL 数据块含 GB2312 编不了的字符')

mob_all_rows = re.findall(r'\[(\d+), "([^"]+)", (\d+)\]', MOB_ALL_TXT)
if len(mob_all_rows) == 0:
    problems.append('MOB_TIERS_ALL 一条都没解析出来')
for _mid, _nm, _lv in mob_all_rows:
    if not gb_ok(_nm):
        problems.append('MOB_TIERS_ALL 怪物名 GB2312 编不了：%s %s' % (_mid, _nm))

# 同一只怪不能在一张菜单里出现两次
_seen_mob = {}
for _mid, _nm, _lv in mob_all_rows:
    if _mid in _seen_mob:
        problems.append('MOB_TIERS_ALL 里怪物 ID 重复：%s %s / %s' % (_mid, _nm, _seen_mob[_mid]))
    _seen_mob[_mid] = _nm

notes.append('召唤怪物-全级别段：%d 档 / %d 只（%s ~ %s）' % (
    len(re.findall(r'^\s{4}\["([^"]+)", \[', MOB_ALL_TXT, re.M)),
    len(mob_all_rows),
    (mob_all_rows[0][1] if mob_all_rows else ''),
    (mob_all_rows[-1][1] if mob_all_rows else '')))


def rows_js(rows, indent='    '):
    out = []
    for i, (a, b, c) in enumerate(rows):
        comma = ',' if i < len(rows) - 1 else ''
        out.append('%s[%s, "%s", %s]%s' % (indent, a, b, c, comma))
    return '\n'.join(out)


# 注 1：TOWN_ROWS（手写的 14 个常用城镇）已移到第 3.8 节，与 wz 精选的 90 张合并成
#       town_all_rows，「常用城镇」这一档因此取消（第 11 轮）。
# 注 2：BOSS_ROWS（手写的 11 张 BOSS 图）已整个删掉（第 12 轮），改由 gen_boss_maps.py
#       从 Map.wz 全量扫描生成 BOSS_MAPS_ALL —— 手写那份没法保证"图里真的有 BOSS"。

# ==================================================== 4. 生成 JS 数据块
def skill_groups_js():
    out = []
    for job_id, label, pairs in skill_groups:
        out.append('    [%d, %s, [' % (job_id, js_str(label)))
        for k, (sid, nm) in enumerate(pairs):
            comma = ',' if k < len(pairs) - 1 else ''
            out.append('        [%d, %s]%s' % (sid, js_str(nm), comma))
        out.append('    ]],')
    if out:
        out[-1] = out[-1].rstrip(',')
    return '\n'.join(out)


def item_groups_js():
    out = []
    for label, rows in item_groups:
        out.append('    [%s, [' % js_str(label))
        for k, (iid, nm, qty) in enumerate(rows):
            comma = ',' if k < len(rows) - 1 else ''
            out.append('        [%d, %s, %d]%s' % (iid, js_str(nm), qty, comma))
        out.append('    ]],')
    if out:
        out[-1] = out[-1].rstrip(',')
    return '\n'.join(out)


def skill_name_txt_js():
    """长串用每行若干个拼起来，避免单行过长"""
    chunks = SKILL_NAME_TXT.split(';')
    lines = []
    buf = ''
    for c in chunks:
        if not c:
            continue
        piece = c + ';'
        if len(buf) + len(piece) > 100:
            lines.append(buf)
            buf = ''
        buf += piece
    if buf:
        lines.append(buf)
    return ' +\n'.join('    %s' % js_str(l) for l in lines)


# ==================================================== 5. 装配模板
tpl = io.open(TPL, encoding='utf-8').read()

SAFE_MAP = {
    '\u26a0\ufe0f': '注意 ',
    '\u26a0': '注意 ',
    '\ufe0f': '',
    '\u2014\u2014': '--',
    '\u2014': '-',
    '\u21d2': '=>',
}
for bad, good in SAFE_MAP.items():
    tpl = tpl.replace(bad, good)

left = sorted({c for c in tpl if not gb_ok(c)})
if left:
    sys.exit('模板里仍有无法自动净化的字符：' + ' '.join('%s(U+%04X)' % (c, ord(c)) for c in left))

REPL = [
    ('/*@HUNT_MAPS@*/', rows_js(hunt_rows)),
    # BOSS 挑战图：数据自带最外层 []，直接用 load_arr 抠出来的整块（模板里是 `= /*@X@*/;`）
    ('/*@BOSS_MAPS_ALL@*/', BOSS_MAP_TXT),
    ('/*@SKILL_GROUPS@*/', skill_groups_js()),
    ('/*@SKILL_NAME_TXT@*/', skill_name_txt_js()),
    ('/*@ITEM_GROUPS@*/', item_groups_js()),
    ('/*@BOSS_TIERS@*/', BOSS_TIERS_TXT),
    # 注意：rows_js() 只产出行内容，不含最外层 [] —— 模板这边是 `= /*@X@*/;`
    # （占位符自带 []），所以必须自己把方括号包上，否则生成出来是 `var X =` 接一串行。
    ('/*@TOWN_MAPS_ALL@*/', '[\n' + rows_js(town_all_rows) + '\n]'),
    ('/*@MOB_TIERS_ALL@*/', MOB_ALL_TXT),
]
for ph, val in REPL:
    if tpl.count(ph) != 1:
        sys.exit('占位符 %s 出现 %d 次（应为 1）' % (ph, tpl.count(ph)))
    tpl = tpl.replace(ph, val)

if '/*@' in tpl:
    sys.exit('还有没替换的占位符')

# 装配后的复检：数据源合法 != 装配结果合法。第 9 轮三个新数组都是两层结构，
# 模板一旦多套一层 []，菜单就只剩「返回」一项，语法和 GB2312 都照样过。
_FINAL_PATS = (
    ('TOWN_MAPS_ALL', r'var TOWN_MAPS_ALL = (\[[\s\S]*?\n\]);', None),
    ('HUNT_MAPS', r'var HUNT_MAPS = (\[[\s\S]*?\n\]);', None),
    ('MOB_TIERS_ALL', r'var MOB_TIERS_ALL = (\[[\s\S]*?\n\]);', 13),
)
for _lab, _pat, _top in _FINAL_PATS:
    _m = re.search(_pat, tpl)
    if not _m:
        problems.append('生成结果里定位不到 %s 字面量' % _lab)
    else:
        guard_array(_m.group(1), '装配后 ' + _lab, expect_top=_top, row_len=3, deep=(_lab == 'MOB_TIERS_ALL'))

# BOSS 图单独校验：4 元素行 [int, str, int, str]，末位是 BOSS 名单字符串，
# 套不进 guard_array 的 row_len 检查（那个要求末位是 int），所以单独来一遍。
_m = re.search(r'var BOSS_MAPS = (\[[\s\S]*?\n\]);', tpl)
if not _m:
    problems.append('生成结果里定位不到 BOSS_MAPS 字面量')
else:
    _bp2 = guard_array(_m.group(1), '装配后 BOSS_MAPS')
    for _r in (_bp2 or []):
        if not (isinstance(_r, list) and len(_r) == 4 and isinstance(_r[0], int)
                and isinstance(_r[1], str) and _r[1]
                and isinstance(_r[2], int) and isinstance(_r[3], str) and _r[3]):
            problems.append('装配后 BOSS_MAPS 的行结构不对（应为 [int, str, int, str]）：%r' % (_r,))
            break

# 装配后的复检：把生成结果里的 BOSS_TIERS 字面量再解析一次。
# 数据源合法 ≠ 装配结果合法（模板多包一层 [] 就是在这一步才会暴露）。
_m_final = re.search(r'var BOSS_TIERS = (\[[\s\S]*?\n\]);', tpl)
if not _m_final:
    problems.append('生成结果里定位不到 BOSS_TIERS 字面量')
else:
    try:
        _fp = ast.literal_eval(_m_final.group(1))
        if not isinstance(_fp, list) or len(_fp) != 3:
            problems.append('装配后 BOSS_TIERS 顶层元素数 = %s（期望 3）—— 模板占位符外面多套了 []'
                            % (len(_fp) if isinstance(_fp, list) else type(_fp).__name__))
    except Exception as e:
        problems.append('装配后 BOSS_TIERS 解析失败：%s' % e)

if not gb_ok(tpl):
    bad = sorted({c for c in tpl if not gb_ok(c)})
    problems.append('文件含 GB2312 编不了的字符：' + ' '.join('%s(U+%04X)' % (c, ord(c)) for c in bad))

if problems:
    print('!! 有问题：')
    for p in problems:
        print('   ', p)
    sys.exit(2)

data = tpl.encode('utf-8')
for path in (OUT1, OUT2):
    with open(path, 'wb') as f:
        f.write(data)

b1 = open(OUT1, 'rb').read()
b2 = open(OUT2, 'rb').read()

print('技能组 %d 个 / 技能 %d 条（含跨职业 %d）' % (
    len(skill_groups), sum(len(g[2]) for g in skill_groups), len(cross_pairs)))
print('物品组 %d 个 / GM套装 %d + S档 %d + 装备 %d 件 + 消耗品 %d 种'
      % (len(item_groups), len(GM_SET), len(S_TIER), total_eq, len(CONSUME)))
print('技能名表 %d 条 / 压缩串 %d 字符' % (len(skill_name), len(SKILL_NAME_TXT)))
print('猎场 %d / BOSS 挑战图 %d' % (len(hunt_rows), len(_boss_rows)))
print('城镇全表 %d（常用+wz精选并集）/ Lv.100+ 练级场 %d / 全级别段怪物 %d 只' % (
    len(town_all_rows), len(hunt_high_rows), len(mob_all_rows)))
print('file bytes  :', len(data))
print('gm_menu.js  :', len(b1), '| 9010000.js:', len(b2), '| 字节一致:', b1 == b2)
print('GB2312 全文校验: 通过')
print('UTF-8 BOM  :', '无' if not data.startswith(b'\xef\xbb\xbf') else '!! 有 BOM')
if notes:
    print('--- 备注 ---')
    for n in notes:
        print('   ', n)
