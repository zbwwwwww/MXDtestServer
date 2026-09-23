# 攻击速度 - Booster 参数与 GM 爆发（2026-09-23）

## 机制（谁决定攻速）

| 层 | 决定者 | 能改吗 |
|---|---|---|
| 武器本体攻速档位 | **客户端 wz** 的武器 `attackSpeed`（2~9，越小越快） | ❌ 客户端 PKG1 加密 |
| 加速 buff（Booster 类） | 服务端 Skill.wz 的 `x`（快几档）+ `time`（秒） | ✅ 本次已改 |
| 服务端节流 | 无，客户端打多快服务端收多快 | — |

客户端合计攻速有下限（约"快 2 档"），`x` 给过头会被客户端钳制。

## Booster 技能数据格式（Skill.wz，按职业分文件如 512.img.xml）

```
<imgdir name="5121009">        ← 技能 id
  <imgdir name="level">
    <imgdir name="20">          ← 等级
      <int name="time" value="300"/>   ← 持续【秒】
      <int name="x" value="-2"/>       ← 加速档位（负数=快 N 档）
```

⚠️ 两个坑：
1. **时长双单位**：服务端 `MapleStatEffect` 对技能 `time × 1000` 存 **int（毫秒）**——time 超 ~214 万秒会溢出变负瞬失效。
2. **海盗系 buff（速效激发 5121009 / 冲击 / DASH）封包走 `givePirateBuff`，时长是 `writeShort`（16 位）**——超过 32767 秒被截断。安全值 **32700 秒（约 9 小时）**。

## 本次改动（5121009 速效激发，全员通用）

- `x`：全 20 级 → **-8**（2026-09-23 08:07 由 -4 追加到 -8：客户端攻速合计钳制在最快档 2，x-8 保证任何武器速度 2~9 都触底，这就是可改的最快值）
- `time`：各级 → **32700 秒**（≈9 小时，到期 GM 菜单一键续）
- 文件：`wz/Skill.wz/512.img.xml`（只动 `<imgdir name="5121009">` 块，imgdir 深度配对定位）
- 备份：`512.img.xml.bak_20260923`
- 探针验证 ✅：`D:\tmp\probe\Probe5121009.java`（绝对路径读 wz，输出 lv1/lv20 x=-4 time=32700）
- 定点脚本：`D:\tmp\patch_5121009.py`（改别处 booster 技能可复用改 id）

## GM 菜单入口

主菜单 `#L30#攻击速度爆发（速效激发 x-4，约 9 小时）`：
`SkillFactory.getSkill(5121009).getEffect(20).applyTo(player)` —— 无需学技能、不耗蓝、无需重启，随时重复点。

## 生效方式

- wz 改动 → **必须重启服务端**
- 菜单脚本 → 完全关客户端重开

## 备选（未采用）

- `config.yaml USE_BUFF_EVERLASTING: true`：所有玩家 buff 永久化（影响面大，没开）
- 别的 booster（剑强化 1101004 等）：非海盗系走普通 giveBuff，时长可给 int 最大 ≈24.8 天；如需"真永久"可换用
