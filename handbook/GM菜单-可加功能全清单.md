# GM 菜单 —— 可加功能全清单（第 7 轮盘点）

> 生成时间：2026-09-22
> 服务端：`D:\MXDtestServer`（HeavenMS 083 汉化版）
> **核对方式**：逐个 `grep` 源码，确认 API **存在且为 public**（附行号），不是凭印象列的。
> 目的：给菜单扩容做候选池，供挑选后再动手。
> ⚠️ 本文档只是清单，**没有改任何代码**。

---

## 一、现状：菜单里已经有的（24 项 + 3 个子菜单）

| # | 功能 | 实现方式 |
|---|---|---|
| 0/1 | 加经验 100 万 / 1 亿 | `cm.gainExp` |
| 2 | 加金币 1 亿 | `cm.gainMeso` |
| 3 | 洗属性点 | `cm.resetStats` |
| 4 | 修改属性点（STR/DEX/INT/LUK） | 子菜单（设定 / 加 AP / 满属性） |
| 5 | 满技能 | `cm.maxJobSkills` |
| 6 | 加人气 +100 | `cm.gainFame` |
| 7 | 修改职业 | `cm.changeJobById` |
| 8 | 学习技能（点选/输入 ID/看清单） | `cm.giveSkill` |
| 9 | 获取物品（点选/输入 ID） | `cm.gainItem` |
| 10 | 扩充背包 | `cm.gainItem`（扩栏道具） |
| 11 | 上 BUFF | `cm.useItem` |
| 12 | 传送地图（猎场 30 / BOSS 11 / 城镇 14） | `cm.warpToMap` |
| 13 | 隐身 / 现身 | `p.Hide` |
| 14 | 去自由市场 | `cm.warp` |
| 15 | 回满 HP / MP | `p.updateHpMp` |
| 16 | 当前地图信息 | `map.getId/getMapName/countMonsters` |
| 17 | 捡取全图物品（另有快捷键） | `p.pickupItem` + `map.getItems` |
| 18 | 吸取全图怪物（另有快捷键） | `MapleMonster.resetMobPosition` |
| 19 | 生成怪物（输入 ID + 数量） | `cm.spawnMonster` |
| 20 | 清空本图怪物（无掉落） | `map.killAllMonsters` |
| 21 | 清空本图怪物（有掉落） | `map.killMonster(mob, chr, true)` |
| 22 | 清理地上掉落物 | `map.clearDrops` |
| 23 | 关闭菜单 | `cm.dispose` |

---

## 二、可加的功能（未在菜单里）—— 共 **47 项**

> 实现层说明：
> **脚本** = 只改 `scripts/npc/gm_menu.js` + `9010000.js`，**不用重编译**，完全关客户端重开即生效。
> **Java** = 要改 `.java` 重编译 + 重启（一般只有"给聊天框加 `!` 指令"才需要）。

### A 类 · 角色养成（9 项）

| # | 功能 | API（已核对） | 层 | 风险 |
|---|---|---|---|---|
| A1 | **自定义加经验**（输入任意数值，不是固定 100 万/1 亿） | `cm.gainExp(int)` `NPCConversationManager:284` | 脚本 | ✅ 低 |
| A2 | **自定义加金币**（输入任意数值） | `cm.gainMeso(int)` `:280` | 脚本 | ✅ 低 |
| A3 | **加技能点 SP**（满技能是"练满"，这是"给点"） | `p.gainSp(int,int,boolean)` `AbstractMapleCharacterObject:703` | 脚本 | ✅ 低 |
| A4 | **自定义加人气**（支持负数，±N 随便调） | `cm.gainFame(int)` `AbstractPlayerInteraction:679` | 脚本 | ✅ 低 |
| A5 | **满精通**（技能精通书／大师级） | `cm.maxMastery()` `NPCConversationManager:388` | 脚本 | ✅ 低 |
| A6 | **取消指定 BUFF**（输入道具 ID） | `cm.cancelItem(int)` `AbstractPlayerInteraction:936` | 脚本 | ✅ 低 |
| A7 | **洗技能**（清空全部已学技能，重新练） | `p.getSkills()` + `p.changeSkillLevel(skill,0,0,-1)` `MapleCharacter:1894` | 脚本 | ⚠️ 中（不可撤销） |
| A8 | **直接设定等级** | `p.setLevel(int)` `MapleCharacter:9262` | 脚本 | ⚠️ 中（**不重算属性**，建议优先用 A1 加经验） |
| A9 | **修改 GM 等级**（开/关管理员权限） | `p.setGMLevel(int)` `MapleCharacter:5640` | 脚本 | ⚠️ 中（**改完要重登才生效**） |

### B 类 · 物品与背包（7 项）

| # | 功能 | API（已核对） | 层 | 风险 |
|---|---|---|---|---|
| B1 | **给装备并立刻穿上** | `cm.gainAndEquip(itemid, slot)` `AbstractPlayerInteraction:964` | 脚本 | ✅ 低 |
| B2 | **清掉背包里某物品**（输入 ID） | `cm.removeAll(int)` `:890` | 脚本 | ✅ 低 |
| B3 | **转蛋机抽一次** | `cm.doGachapon()` `NPCConversationManager:446` | 脚本 | ✅ 低 |
| B4 | **一键换装**（预设整套装备，逐件 gainAndEquip） | 组合 B1 | 脚本 | ✅ 低 |
| B5 | **查物品中文名**（输入 ID → 名字） | `MapleItemInformationProvider.getName(int)` `:1176` | 脚本¹ | ✅ 低 |
| B6 | **丢物到地上**（脚下生成掉落物） | `map.spawnItemDrop(...)` `MapleMap:2222` | Java | ⚠️ 中（要自己构造 `Item` 对象） |
| B7 | **批量给一组物品**（按名字搜 ID 再给） | `getName` + `cm.gainItem` | 脚本¹ | ✅ 低 |

> ¹ 脚本层可用 `Packages.server.MapleItemInformationProvider.getInstance()` 直连 —— 官方脚本已有先例（如 `scripts/npc/1012100.js:37` 用了 `Packages.server.life.MaplePlayerNPC`）。

### C 类 · 战斗 / 怪物（7 项）

| # | 功能 | API（已核对） | 层 | 风险 |
|---|---|---|---|---|
| C1 | **杀本图指定种类的怪**（有掉落） | `map.killMonsterWithDrops(int mobId)` `MapleMap:1514` | 脚本 | ✅ 低 |
| C2 | **开关本图掉落** | `map.toggleDrops()` `:249` | 脚本 | ✅ 低 |
| C3 | **强制全图怪物重生**（把刷怪点全部立刻填满） | `map.instanceMapForceRespawn()` `:3622` | 脚本 | ⚠️ 中（可能瞬间刷出一堆） |
| C4 | **怪物信息查询**（HP / EXP / 等级 / 是否 BOSS / 中文名） | `cm.getMonsterLifeFactory(id).getStats()` `AbstractPlayerInteraction:994` + `MapleMonsterStats:64/72/88/116` + `MapleMonsterInformationProvider.getMobNameFromId` `:298` | 脚本¹ | ✅ 低 |
| C5 | **查怪物掉落表**（输入怪 ID → 掉落清单） | `MapleMonsterInformationProvider.retrieveDrop(int)` `:180` | 脚本¹ | ✅ 低 |
| C6 | **召唤 BOSS（预设快捷列表）** | `cm.spawnMonster(id, x, y)` `:988` | 脚本 | ✅ 低 |
| C7 | **批量刷同种怪 N 只**（现有"生成怪物"已支持数量，可升级为图标点选） | 同上 | 脚本 | ✅ 低 |

### D 类 · 地图 / 传送 / NPC（8 项）

| # | 功能 | API（已核对） | 层 | 风险 |
|---|---|---|---|---|
| D1 | **全图所有人一起传送** | `map.warpEveryone(int)` `MapleMap:3931` | 脚本 | ✅ 低 |
| D2 | **回到本图"回城点"** | `map.getReturnMap()` `:287` / `getReturnMapId()` `:294` | 脚本 | ✅ 低 |
| D3 | **打开指定商店**（输入商店/ NPC ID） | `cm.openShopNPC(int)` `NPCConversationManager:377` | 脚本 | ✅ 低 |
| D4 | **原地生成一个 NPC** | `cm.spawnNpc(id, pos, map)` `AbstractPlayerInteraction:975` | 脚本 | ⚠️ 中（**重登即消失**，不落库） |
| D5 | **重置当前地图**（清场内对象/状态） | `cm.resetMap(int)` `NPCConversationManager:328` / `map.resetMapObjects()` `:4084` | 脚本 | ⚠️ 中（会清掉场内状态，副本慎用） |
| D6 | **传送到指定坐标**（精确落点，不是传送点） | `cm.warp(map, pos)` 变体 `:123-135` | 脚本 | ⚠️ 中（坐标若落空会卡住） |
| D7 | **传送到某玩家身边** | `PlayerStorage.getCharacterByName` `:67` + `changeMap` | Java | ⚠️ 中（要遍历/找角色） |
| D8 | **把某玩家拉到我这里** | 同上 | Java | ⚠️ 中 |

### E 类 · 视觉 / 播报 / 外观（10 项）

| # | 功能 | API（已核对） | 层 | 风险 |
|---|---|---|---|---|
| E1 | **全图滚动公告**（所有人可见） | `map.broadcastStringMessage(int, String)` `MapleMap:3024` | 脚本 | ✅ 低 |
| E2 | **屏幕特效**（升级光柱等） | `cm.showEffect(String)` `:1032` | 脚本 | ✅ 低 |
| E3 | **地图特效**（全图可见） | `cm.mapEffect(String)` `:703` | 脚本 | ✅ 低 |
| E4 | **换 BGM** | `cm.changeMusic(String)` `:683` | 脚本 | ✅ 低 |
| E5 | **地图倒计时** | `cm.mapClock(int)` `NPCConversationManager:1018` | 脚本 | ✅ 低 |
| E6 | **头顶称号** | `cm.earnTitle(String)` `:1057` | 脚本 | ✅ 低 |
| E7 | **屏幕提示条** | `cm.showInfoText(String)` `:1061` | 脚本 | ✅ 低 |
| E8 | **播放音效** | `cm.playSound(String)` `:1079` | 脚本 | ✅ 低 |
| E9 | **环境/天气特效** | `cm.environmentChange(String,int)` `:1083` | 脚本 | ✅ 低 |
| E10 | **捏脸：换发型 / 脸型 / 肤色 / 性别** | `cm.sendStyle` `NPCConversationManager:208`、`cm.setHair/setFace` `:293/299`、`p.setSkinColor` `MapleCharacter:9386`、`p.setGender` `:8988` | 脚本 | ✅ 低 |

### F 类 · 查询 / 调试 / 管理（6 项）

| # | 功能 | API（已核对） | 层 | 风险 |
|---|---|---|---|---|
| F1 | **我的完整状态**（等级/职业/地图/HP/MP/AP/SP/人气） | `cm.getPlayer()` 各 getter + `getRemainingAp` `AbstractMapleCharacterObject:113` | 脚本 | ✅ 低 |
| F2 | **在线人数** | `getClient().getChannelServer().getPlayerStorage().getSize()` `PlayerStorage:118` | Java | ✅ 低 |
| F3 | **本图刷怪点报告**（调试：看有几个点、坐标） | `map.reportMonsterSpawnPoints(chr)` `MapleMap:3245` | 脚本 | ✅ 低 |
| F4 | **ID 反查中文名**（输入 ID → 技能/地图/物品/怪物名） | 内置表 + `getName` / `getMobNameFromId` | 脚本¹ | ✅ 低 |
| F5 | **打开 UI 面板**（装备/技能/背包/属性…） | `cm.openUI(byte)` `:1065` | 脚本 | ✅ 低 |
| F6 | **查看任务状态 / 强制完成任务** | `cm.getQuestStatus(int)` `:378`、`cm.forceCompleteQuest(int)` `:252` | 脚本 | ⚠️ 中（强刷任务可能卡剧情） |

---

## 三、做不到 / 不建议做的（别浪费时间）

| 想加的功能 | 结论 | 原因 |
|---|---|---|
| 热重载掉落表 / 商店 | ❌ **做不到** | `clearDrops()`、重载类方法**存在但零调用方**，服务端数据永久缓存，无热重载入口 |
| 账号封禁（封号） | ⚠️ **只能走 DB** | `MapleClient` 只有 `banHWID()` `:389` / `banMacs()` `:415` —— **没有账号封禁 API**，封账号得直接写 SQL 改 `accounts` |
| 给聊天框加 `!` 指令 | ⚠️ **要重编译** | `GeneralChatHandler` 是 Java 层，每次加指令都要 Build + 重启 |
| 改客户端 wz（改物品图标/技能描述） | ❌ **服务端做不到** | 那是客户端 `Data\*.wz` 的事，要改客户端文件 |
| 一键"秒杀全屏 BOSS" | ⚠️ 有坑 | BOSS 常有 `isBoss()` 保护 / 阶段血量，直接 `killMonster` 可能触发异常爆装 |

---

## 四、动手前必须知道的一个界面约束

> **一个 NPC 对话框不能同时有"可点列表"和"输入框"**（`sendSimple` 与 `sendGetText` 互斥，客户端协议限制）。

所以凡是**要输参数**的功能（A1 自定义经验、A2 自定义金币、A6 取消 BUFF、B2 清物品、C1 杀指定怪、C4 查怪、D3 商店…），都得按第 6 轮的做法：**单独开一屏输入框**，在列表最下方留一个「手动输入」入口。

---

## 五、如果要我加，推荐批次

**第一批（推荐，10 项）—— 全是脚本层、零编译、低风险、日常最常用：**

| 序 | 功能 | 为什么先加 |
|---|---|---|
| 1 | A1 自定义加经验 | 现有只有 100 万/1 亿两档，不够用 |
| 2 | A2 自定义加金币 | 同上 |
| 3 | A4 自定义加人气 | 现在写死 +100 |
| 4 | B1 给装备并立刻穿上 | 现在给了还得自己去背包穿 |
| 5 | C1 杀本图指定怪（有掉落） | 刷特定素材用 |
| 6 | C4 怪物信息查询 | 看怪 HP/EXP/等级，决定去哪练 |
| 7 | E1 全图公告 | 好玩、也能测播报 |
| 8 | E10 捏脸（发型/脸型/肤色/性别） | 纯外观，风险最低 |
| 9 | F1 我的完整状态 | 一个面板看全，替代零散查看 |
| 10 | C5 查怪物掉落表 | 配合 C4，练级打宝都靠它 |

**第二批（进阶）**：A3 加 SP、A5 满精通、A6 取消 BUFF、B2 清物品、B3 转蛋机、C2 开关掉落、C3 强制重生、D1 全图传送、D2 回城、D3 开商店、E2~E9 特效全家桶、F3 刷怪点报告

**第三批（谨慎）**：A7 洗技能、A8 直接设等级、A9 改 GM 等级、B6 丢物到地上、D4 生成 NPC、D5 重置地图、D7/D8 找玩家、F6 任务操作

---

## 附：核对用到的源码位置（便于复查）

| 类 | 文件 | 用途 |
|---|---|---|
| `AbstractPlayerInteraction` | `src/scripting/AbstractPlayerInteraction.java` | 脚本能直接调的 `cm.*`（156 个 public 方法） |
| `NPCConversationManager` | `src/scripting/npc/NPCConversationManager.java` | 同上（111 个） |
| `MapleCharacter` / `AbstractMapleCharacterObject` | `src/client/` | `p.*` 角色属性/技能操作 |
| `MapleMap` | `src/server/maps/MapleMap.java` | 地图/怪物/掉落/播报 |
| `MapleMonster` / `MapleMonsterStats` | `src/server/life/` | 怪物坐标、属性 |
| `MapleMonsterInformationProvider` | `src/server/life/` | 怪物名、掉落表 |
| `MapleItemInformationProvider` | `src/server/` | 物品中文名 |
| `PlayerStorage` | `src/net/server/` | 找角色、在线人数 |
| `GeneralChatHandler` | `src/net/server/channel/handlers/` | 聊天框 `!` 指令（Java 层） |
