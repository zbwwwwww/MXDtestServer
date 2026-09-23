# -*- coding: utf-8 -*-
"""
定点修改 wz/Skill.wz/512.img.xml 里 5121009（速效激发）的 level 数据：
  x:    各级原值(-1/-2) -> -4   （试探客户端攻速上限）
  time: 各级秒数 -> 32700（约 9 小时；海盗系 buff 封包时长为 writeShort，上限 32767，菜单可随时一键续）
铁律 8 全套：只动 5121009 块、逐条计数、xml 解析校验、CRLF/无 BOM、先备份。
"""
import io, os, re, shutil
import xml.etree.ElementTree as ET

P = r"D:\MXDtestServer\wz\Skill.wz\512.img.xml"
BAK = P + ".bak_20260923"

raw = open(P, "rb").read()
print("原大小:", len(raw), "| BOM:", raw[:3] == b"\xef\xbb\xbf", "| CRLF:", b"\r\n" in raw)

if not os.path.exists(BAK):
    shutil.copy2(P, BAK)
    print("已备份 ->", BAK)

txt = raw.decode("utf-8")

# ---- 定位 5121009 块（imgdir 配对解析）----
m0 = re.search(r'<imgdir name="5121009">', txt)
assert m0, "找不到 5121009"
start = m0.start()
# 找同缩进的下一个 imgdir 开标签 或 块的闭合：按 depth 扫描
depth = 0
i = start
end = None
for tag in re.finditer(r'<(/?)imgdir\b[^>]*?(/?)>', txt[start:]):
    closing, selfclose = tag.group(1), tag.group(2)
    if selfclose:
        continue
    if closing:
        depth -= 1
        if depth == 0:
            end = start + tag.end()
            break
    else:
        depth += 1
assert end, "没找到闭合"
block = txt[start:end]
print("块长度:", len(block))

# ---- 块内替换（x 统一改 -8：任何武器速度(2~9)加上都触底客户端最快档 2）----
new_block, n_x = re.subn(r'(<int name="x" value=")-?\d+(")', r"\g<1>-8\g<2>", block)
new_block, n_t = re.subn(r'(<int name="time" value=")\d+(")', r"\g<1>32700\g<2>", new_block)
print("x 替换数:", n_x, "| time 替换数:", n_t)
assert n_x == 20 and n_t == 20, "替换数异常（预期各 20 级）"

ml = re.search(r'<int name="maxLevel" value="(\d+)"', block)
print("maxLevel:", ml.group(1) if ml else "?", "（替换数应与 level 数一致）")

new_txt = txt[:start] + new_block + txt[end:]

# ---- 校验：xml 可解析 + CRLF/无 BOM 保持 ----
ET.fromstring(new_txt.encode("utf-8"))
out = new_txt.encode("utf-8")
assert b"\xef\xbb\xbf" != out[:3]
assert (b"\r\n" in out) == (b"\r\n" in raw)
open(P, "wb").write(out)
print("写回成功，新大小:", len(out))

# ---- 回读验证 ----
t2 = open(P, "rb").read().decode("utf-8")
b2 = t2[start:start + len(new_block)]
assert b2 == new_block
print("回读一致 ✅")
