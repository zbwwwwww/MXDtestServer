# GM 指令扩展清单（HeavenMS 083 汉化版）

> 生成时间：2026-09-20
> 服务端：`D:\MXDtestServer`
> 依据：直接读源码核对每个 API 的**存在性与可见性**（public / private），不是猜测。
> 核对到的类：`AbstractPlayerInteraction`(156 个 public 方法)、`NPCConversationManager`(111 个)、
> `MapleMap`(303 个)、`MapleCharacter`(上百个)、`AbstractMapleCharacterObject`(37 个)、
> `MapleClient`、`MapleMonster`、`ItemPickupHandler`。

---

## 一、先说结论

| 你问的 | 能做吗 | 难度 | 要不要重编译 |
|---|---|---|---|
| **全屏捡物品** | ✅ **能做，而且很简单** | ★ | ❌ 纯脚本，不用编译 |
| **吸怪（把怪拉到自己脚下）** | ✅ **有现成 API，但要实测一次** | ★★ | ❌ 纯脚本；万一不生效才需要 Java 兜底 |

**两个关键发现：**

1. **`MapleCharacter.pickupItem(MapleMapObject)` 是 public 的**（`MapleCharacter.java:2062`）
   —— 这就是客户端按 Z 键捡东西走的**同一条代码**，归属判定、进背包、广播全帮你处理好了。
   配合 `MapleMap.getItems()`（`:1267`，public，返回全图 ITEM 对象列表），全屏捡物就是**一句循环**。

2. **`MapleMonster.resetMobPosition(Point)` 是 public 的**（`MapleMonster.java:1325`）
   —— 服务端原生就有"把怪挪到指定坐标并广播给所有客户端"的方法。
   ⚠️ 但全项目搜索显示它**零调用方**（还有个 `refreshMobPosition()` 也是零调用），
   意味着这个方法从没被实际跑过，**能不能在客户端画面上生效必须实测**（原因见第四章）。

---

## 二、两条实现路线（决定你要不要重编译）

| | 路线 A：脚本层（推荐先用） | 路线 B：Java 层 |
|---|---|---|
| **改哪里** | `scripts/npc/gm_menu.js` + `9010000.js` | `net\server\channel\handlers\GeneralChatHandler.java` |
| **怎么用** | 点 NPC「冒险岛管理员」逐级点选；数值型功能用输入框 | 聊天框敲 `!xxx 参数` |
| **生效方式** | **完全关闭客户端再重开**（脚本引擎按客户端缓存） | **IDEA Build + 重启服务端** |
| **代价** | 零编译风险 | 629 个文件编译约 30 秒 |
| **优点** | 改坏了随时回滚，不影响服务端 | 打数字快，支持带参数 |

> ⚠️ **重要**：现在菜单里已有的 `!exp` / `!meso` / `!item` / `!warp` / `!job` / `!skill` 都是
> **路线 B（Java）** 实现的。所以想加**聊天指令**就一定要重编译一次；
> 只想加**菜单点选**则完全不用编译。

---

## 三、可加指令全清单

### A 类 · 角色养成

| 指令 | 效果 | 实现层 | 用到的 API（已核对存在且 public） | 风险 |
|---|---|---|---|---|
| `!exp <n>` | 加经验 | Java（已有） | `MapleCharacter.gainExp` | ✅ |
| `!meso <n>` | 加金币 | Java（已有） | `gainMeso` | ✅ |
| `!job <id>` | 转职 | Java（已有） | `changeJob` / `changeJobById` | ✅ |
| `!skill <id>` `!maxskill` | 给技能 / 满技能 | Java（已有） | `giveSkill` / `maxJobSkills` | ✅ |
| **`!heal`** | **回满血蓝** | 脚本 | `updateHpMp(getCurrentMaxHp(), getCurrentMaxMp())`<br>（`AbstractMapleCharacterObject:412-430`） | ✅ 低 |
| `!fame <n>` | 加人气 | 脚本 | `cm.gainFame(n)`（`AbstractPlayerInteraction:679`） | ✅ 低 |
| `!str/!dex/!int/!luk <n>` | 加主属性 | 脚本 | `assignStr/assignDex/assignInt/assignLuk(int)` | ⚠️ 不消耗 AP，受属性上限 |
| `!ap <n>` / `!sp <n>` | 给能力点 / 技能点 | 脚本 | `gainAp(int,boolean)` / `gainSp(int,int,boolean)` | ✅ 低 |
| `!level <n>` | 直接设等级 | Java | `setLevel(int)` | ⚠️ 不重算属性，建议改用 `!exp` |
| `!gmlv <n>` | 改 GM 等级 | 脚本 | `setGMLevel(int)` | ⚠️ 改完要重登才生效 |
| `!hide` | 隐身/现身 | 已有（菜单） | `Hide(boolean)` / `isHidden()` | ✅ |

### B 类 · 物品与背包

| 指令 | 效果 | 实现层 | API | 风险 |
|---|---|---|---|---|
| `!item <id> [qty]` | 给物品 | Java（已有） | `gainItem` | ✅ |
| **`!slots <类型> <数量>`** | **扩背包（1装备2消耗3设置4其他5装饰）** | 脚本 | `gainSlots(int type, int slots)` | ✅ 低 |
| `!buff <道具ID>` | 直接上 buff（**不消耗道具**） | 脚本 | `cm.useItem(id)`（`:931`） | ✅ 低 |
| `!unbuff <道具ID>` | 取消该 buff | 脚本 | `cm.cancelItem(id)`（`:936`） | ✅ 低 |
| `!eqp <装备ID>` | 给装备并立刻穿上 | 脚本 | `cm.gainAndEquip(itemid, slot)` | ✅ 低 |
| `!clean <物品ID>` | 把某物品全部清掉 | 脚本 | `cm.removeAll(int id)` | ✅ |
| `!gacha` | 抽一次转蛋机 | 脚本 | `cm.doGachapon()` | ✅ |
| `!drop <物品ID> [数量]` | 丢物到地上 | Java | `MapleMap.spawnItemDrop(...)` | ⚠️ 需构造 Item 对象 |

### C 类 · 战斗 / 怪物

| 指令 | 效果 | 实现层 | API | 风险 |
|---|---|---|---|---|
| **`!killall`** | **杀光全图怪（无掉落）** | 脚本 | `map.killAllMonsters()` | ✅ 低 |
| `!killall drop` | 杀光全图怪（**会掉落**） | 脚本 | 遍历 + `MapleMap.killMonster(mob, chr, true)` | ✅ 低 |
| `!kill <怪物ID>` | 杀光本图某种怪 | 脚本 | `map.killMonsterWithDrops(int mobId)` | ✅ 低 |
| **`!spawn <怪物ID> [数量]`** | **刷怪** | 脚本 | `cm.spawnMonster(id, x, y)`（`:988`） | ⚠️ 无效 ID 会报错，需空值保护 |
| `!mobinfo <怪物ID>` | 看怪物 HP/EXP/等级 | 脚本 | `cm.getMonsterLifeFactory(id)` → `getStats()` | ✅ 低 |
| **`!vac`** | **吸怪（把全图怪拉到自己脚下）** | 脚本 | `MapleMonster.resetMobPosition(Point)` | ⚠️ **需实测** |
| **`!loot`** | **全屏捡物品** | 脚本 | `chr.pickupItem(MapleMapObject)` + `map.getItems()` | ✅ 低 |
| `!cleardrops` | 清掉地上所有掉落物 | 脚本 | `map.clearDrops()` | ✅ 低 |
| `!toggleDrops` | 开关本图掉落 | 脚本 | `map.toggleDrops()` | ✅ 低 |
| `!respawn` | 强制全图怪物重生 | 脚本 | `map.instanceMapForceRespawn()` | ⚠️ 可能刷出大量怪 |
| `!mobcount` | 数当前图还有多少怪 | 脚本 | `map.countMonsters()` / `countAlivePlayers()` | ✅ |

### D 类 · 地图与传送

| 指令 | 效果 | 实现层 | API | 风险 |
|---|---|---|---|---|
| `!warp <地图ID>` | 传送 | Java（已有） | `warpToMap` | ✅ |
| `!allwarp <地图ID>` | **把全图所有人一起传走** | 脚本 | `map.warpEveryone(int)` | ✅ |
| `!goto <角色名>` | 传送到某玩家身边 | Java | `getCharacterByName` + `changeMap(map,pos)` | ✅ |
| `!warphere <角色名>` | 把某玩家拉到自己这里 | Java | 同上 | ✅ |
| `!npc <NPCID>` | 原地生成一个 NPC | 脚本 | `cm.spawnNpc(npcId, pos, map)` | ⚠️ 生成的 NPC 重登即消失 |
| `!shop <商店ID>` | 打开指定商店 | 脚本 | `cm.openShopNPC(id)` | ✅ |
| `!return` | 回城（回本图 return map） | 脚本 | `map.getReturnMap()` + `changeMap` | ✅ |
| `!resetmap` | 重置当前地图对象 | 脚本 | `map.resetMapObjects()` | ⚠️ 会清掉场内状态 |
| `!spawnpoint` | 输出本图刷怪点 | 脚本 | `map.reportMonsterSpawnPoints(chr)` | ✅ 调试用 |

### E 类 · 播报与视觉

| 指令 | 效果 | 实现层 | API | 风险 |
|---|---|---|---|---|
| `!notice <文字>` | 蓝框提示（只有自己看到） | 脚本 | `cm.playerMessage(0/1, msg)` | ✅ |
| `!mapnotice <文字>` | 全图滚动公告 | 脚本 | `map.broadcastStringMessage(int, msg)` | ✅ |
| `!effect <路径>` | 播放屏幕特效 | 脚本 | `cm.showEffect(path)` / `cm.mapEffect(path)` | ✅ |
| `!music <曲子名>` | 换 BGM | 脚本 | `cm.changeMusic(name)`（`:683`） | ✅ |
| `!clock <秒>` | 地图倒计时 | 脚本 | `cm.mapClock(int)` | ✅ |
| `!title <文字>` | 头顶称号 | 脚本 | `cm.earnTitle(msg)` | ✅ |
| `!hint <文字>` | 屏幕上方提示条 | 脚本 | `cm.showInfoText(msg)` | ✅ |

### F 类 · 管理 / 调试

| 指令 | 效果 | 实现层 | API | 风险 |
|---|---|---|---|---|
| `!whoami` | 看自己状态（等级/职业/地图/HP） | 脚本 | `cm.getPlayer()` 各 getter | ✅ |
| `!mapinfo` | 当前地图 ID、名字、怪数、人数 | 脚本 | `map.getId()` / `getMapName()` / `countMonsters()` | ✅ |
| `!count` | 在线人数 | 脚本 | — | ✅ |
| `!ban <角色名>` | 封号 | **只能改 DB / 封硬件** | `MapleClient.banHWID()` / `banMacs()`；账号封禁需写 SQL | ⚠️ 慎用 |
| `!reload` | 热重载掉落/商店 | ❌ **做不到** | `clearDrops()` / `reloadShops()` 存在但**零调用方**，无热重载入口 | — |

---

## 四、专项：`!loot` 全屏捡物品（✅ 完全可行）

### 实现（**纯脚本，无需重编译**）

```js
var chr = cm.getPlayer();
var map = chr.getMap();
var items = map.getItems();      // List<MapleMapObject>，全是 MapleMapItem
var n = 0;
for (var i = 0; i < items.size(); i++) {
    chr.pickupItem(items.get(i));   // 和客户端按 Z 键走同一条代码
    n++;
}
cm.dropMessage(5, "[GM] 已捡取 " + n + " 件地上物品");
```

### 为什么这样是安全的

`MapleCharacter.pickupItem(MapleMapObject ob, int petIndex)`（`MapleCharacter.java:2069`）内部已经处理了：
- 归属判定 `mapitem.canBePickedBy(this)`（别人打的东西不会被你抢走）
- 金币的地图特殊规则、组队分钱
- `MapleInventoryManipulator.addFromDrop(...)` 进背包 + 空间不足提示
- 广播 `removeItemFromMap` 让物品在画面上消失

**这是服务端自己的正规入口，不是 hack。**

### 已知的 3 个"正常现象"（不是 bug）

1. **刚掉的物品捡不到**：`pickupItem` 有一行 `System.currentTimeMillis() - mapitem.getDropTime() < 400`
   —— 掉落 **400 毫秒内**的物品会被拒绝。所以杀完怪立刻敲 `!loot` 可能漏掉几件，
   **隔半秒再敲一次**就好。或者脚本里对同一批物品循环两遍。
2. **背包满了会逐件失败**，收到"物品栏空间不足"提示，属正常。
3. **捡多了会轻微卡顿**：每捡一件会发一次 `enableActions` 包。几十件无感，几百件会有半秒卡。

---

## 五、专项：`!vac` 吸怪（⚠️ 有 API，但要实测）

### 首选方案（纯脚本，一行核心逻辑）

```js
var chr = cm.getPlayer();
var pos = chr.getPosition();
var mobs = chr.getMap().getAllMonsters();   // List<MapleMonster>
for (var i = 0; i < mobs.size(); i++) {
    mobs.get(i).resetMobPosition(pos);      // MapleMonster.java:1325
}
```

`resetMobPosition` 内部做的事：
```java
public void resetMobPosition(Point newPoint) {
    aggroRemoveController();
    setPosition(newPoint);
    map.broadcastMessage(MaplePacketCreator.moveMonster(..., this.getPosition(), ...));  // 广播给客户端
    map.moveMonster(this, this.getPosition());
    aggroUpdateController();
}
```
看起来正是"把怪挪走并让客户端看到"的正确做法。

### ⚠️ 但必须实测，原因是这个

**这份代码里怪物的移动是「客户端驱动」的**：
`MoveLifeHandler.java:171` 的逻辑是「**客户端**上报怪物移动 → 服务端转发给同一张图的其他玩家」。
也就是说，怪的坐标在很大程度由**控制这只怪的客户端**说了算。

而 `resetMobPosition` / `refreshMobPosition` **全项目零调用方** —— 从没被跑过，
所以"服务端单方面挪位置，客户端会不会跟着跳"是**未经验证**的。

### 如果首选方案不生效，两条兜底

| 方案 | 做法 | 层 | 代价 |
|---|---|---|---|
| **B** | 先广播 `killMonster(oid, 动画)` 让客户端删掉这只怪，再 `map.spawnMonsterOnGroundBelow(mob, pos)` 重新生成在新位置（怪物实例复用，**HP 不会重置**） | 脚本 | ⚠️ 会闪一下死亡动画 |
| **C** | 在 `MapleCharacter` 加一个 `vacMonsters()`，直接构造 `MOVE_MONSTER` 包把怪从当前位置拉到你的位置 | Java | 需重编译，约 15 行 |

### 另一个理解：「让全图怪都来追我」

如果你要的不是"把怪拉过来"，而是"让怪主动追我"，源码里有
`MapleMonster.aggroSwitchController(MapleCharacter, boolean)`（`:1915`）。
但**实际上不需要**：怪物本来就有自动仇恨机制，你走到它附近它自己会来。
这个方法主要用于换"控制器"，单人游戏没意义，不建议用。

---

## 六、推荐第一批（10 个，全部脚本层）

按"实用度 × 实现难度"排序，**全部可以在 `gm_menu.js` 里做，不用重编译**：

| # | 功能 | 菜单入口 | 说明 |
|---|---|---|---|
| 1 | **全屏捡物** | 「捡取全图物品」 | 一键捡光，配合刷怪效率翻倍 |
| 2 | **吸怪** | 「吸取全图怪物」 | 先按第五章方案 A 测，不生效换 B |
| 3 | **回满血蓝** | 「回满 HP/MP」 | 之前说做不到，是我漏看了基类的 `updateHpMp` |
| 4 | 杀光全图怪 | 「清空当前地图怪物」 | 可选带/不带掉落 |
| 5 | 刷怪 | 「生成怪物（输入ID+数量）」 | 需要输入框 |
| 6 | 清地上垃圾 | 「清理地上掉落物」 | 刷完不捡的直接清掉 |
| 7 | 一键 buff | 「上 BUFF（输入道具ID）」 | `cm.useItem`，不消耗道具 |
| 8 | 扩背包 | 「扩充背包（输入栏位类型）」 | 装备/消耗/设置/其他/装饰 |
| 9 | 加人气 | 「加人气 +100」 | 顺手 |
| 10 | 地图信息 | 「当前地图信息」 | 显示地图名/怪数/人数 |

**建议再顺带加一个「更多功能」二级菜单**，把上面这些装进去，
顶层菜单保持现在这 11 项不变（避免一级菜单太长）。

### ✅ 实施状态：全部 10 项 + 二级菜单已落地（2026-09-21）

已写进 `scripts/npc/gm_menu.js`（并**字节级同步**到 `9010000.js`，md5 `22264203a56a8bcbd2af18a60b107285`，21748 bytes）。

| # | 功能 | 菜单索引 | 脚本实现 |
|---|---|---|---|
| 1 | 全屏捡物 | 更多功能 `#L0#` | 遍历 `map.getItems()` 逐个 `chr.pickupItem()`，单件失败不影响其它 |
| 2 | 吸怪 | `#L1#` | `getAllMonsters()` + `mob.resetMobPosition(chr.getPosition())`，带成功/失败计数 |
| 3 | 回满血蓝 | `#L2#` | `chr.updateHpMp(getCurrentMaxHp(), getCurrentMaxMp())` |
| 4 | 清怪 | `#L3#` 无掉落 / `#L4#` 有掉落 | false→`map.killAllMonsters()`；true→逐个 `map.killMonster(mob,chr,true)` |
| 5 | 刷怪 | `#L5#` | 输入框解析 `怪物ID 数量`，先 `getMonsterLifeFactory` 判空，上限 50 只 |
| 6 | 清地上垃圾 | `#L6#` | `map.clearDrops()` |
| 7 | 一键 buff | `#L7#` | `cm.useItem(itemId)`（不消耗道具），try/catch 兜非增益道具 |
| 8 | 扩背包 | `#L8#` | 二级选栏位 → `chr.gainSlots(type, 8)`，返回 false = 已到上限 |
| 9 | 加人气 | `#L9#` | `cm.gainFame(100)` |
| 10 | 地图信息 | `#L10#` | 地图名/ID、怪数、人数、地上物品数、自己等级职业血蓝 |
| — | 更多功能二级菜单 | 顶层 `#L10#` 进入，`#L11#` 返回主菜单 | 顶层菜单变为 12 项（`#L0#`~`#L11#`），原 10 项位置不变 |

设计细节：**做完任一副功能后回到「更多功能」菜单**（而不是 dispose），方便连着点；顶层「关闭菜单」由原 `#L10#` 变为 `#L11#`。

**测试结果**：两套独立测试全绿
- node/V8 版 `D:\tmp\test-gmmenu.js` — **61 项全过**
- **Nashorn 版** `D:\tmp\test-nashorn.js`（用 JDK 8 自带 `jjs.exe`，= 服务端同款引擎）— **48 项全过**

**唯一待实测项**：吸怪（`resetMobPosition` 全项目零调用方，且怪物移动是客户端驱动 `MoveLifeHandler:171`）。要在真实客户端里试，如果客户端不跟随，改走第五章方案 B。

### ✅ 第二轮：交互优化（2026-09-21 晚）

用户实测第一批后提了 6 点，逐条落地：

| # | 需求 | 结论 / 做法 |
|---|---|---|
| 1 | 按 Z 时身边没物品也要能全屏捡 | ❌ **Z 键做不到**（客户端屏内没物品就不发包）。改为**新增 F1 = 全屏捡取**；Z 键原行为保留。机制见 `键位-全屏捡取.md` |
| 2 | 吸怪也绑个键 | ✅ **F2 = 吸怪** |
| 3 | 主菜单选完功能不要关闭 | ✅ 所有分支执行完 `topMenu()` 重新弹主菜单；只有「关闭菜单」才 `dispose()` |
| 4 | 想随意改属性点 | ✅ 新增顶层「修改属性点」，三种形式：**直接设定四项数值** / **加剩余 AP** / **一键满属性** |
| 5 | 传送地图要列出高级怪地图 | ✅ 传送改成三级菜单，内置 **18 个高等级猎场 + 10 个 BOSS 图 + 14 个城镇**，每项带 Lv 和地图 ID。完整数据见 `传送地图清单.md` |
| 6 | 二级菜单要能返回 | ✅ 大系菜单加「返回主菜单」；「学习技能」改成菜单（输入ID / 返回）；传送每级都有返回；属性菜单也有返回 |

**新的顶层菜单（13 项，`#L0#`~`#L12#`）**

```
L0  加经验 100 万          L7  学习技能
L1  加经验 1 亿            L8  传送地图
L2  加金币 1 亿            L9  隐身 / 现身
L3  洗属性点              L10 去自由市场
L4  修改属性点  ←新增      L11 更多功能
L5  满技能                L12 关闭菜单
L6  修改职业
```

**属性点用的 API**（都是 public，纯脚本可调，上限 `config.yaml` 的 `MAX_AP: 32767`）

| 方法 | 说明 |
|---|---|
| `chr.getStr()/getDex()/getInt()/getLuk()` | 读当前四项 |
| `chr.getRemainingAp()` | 读剩余 AP |
| `chr.gainAp(n, false)` | 加剩余 AP |
| `chr.assignStrDexIntLuk(Δ力,Δ敏,Δ智,Δ运)` | 一次性分配；总增量 > 剩余 AP 会返回 false；每项必须落在 `[4, MAX_AP]` |

脚本里的组合顺序：**先 `gainAp(需要补足的量)` → 再 `assignStrDexIntLuk(差值)`**，
所以能做到"输入 4 个数字一步到位"。降属性时负的差值会把点退回剩余 AP。

**热键改动（Java 层）**：新增 `src/server/GmActions.java` 存放共用实现，
`ItemPickupHandler`（Z）与 `FaceExpressionHandler`（F1/F2）都调它。

**测试**：Nashorn（jjs，服务端同款引擎）跑 `D:\tmp\test-nashorn.js` → **82 项全过**。

> ⚠️ **以上「第二轮」是历史记录，主菜单早就不是 13 项了**（本节的 "L0~L12" 与"唯一待实测项：吸怪"都已过时——吸怪 09-21 已验收通过）。**现状**：
> 主菜单 **29 项**（第 5 轮扁平化 24 项 → 第 8 轮新增 5 项）+ 技能/物品 **分组点选**（第 6 轮）
> + 「我学到的技能清单」+ 第 8 轮的 **自定义经验/金币、召唤 BOSS、特效播报、背包管理、按名字搜物品**。
> 权威内容看 `GM菜单改版-方案.md`（§八 = 第 6 轮，**§九 = 第 8 轮**）与 `scripts\npc\gm_menu.js` 头部的 status 编号表 +
> `D:\tmp\test_gm_menu.js`（当前 **168 项全过**）。

### ✅ 第三批：第 8 轮（2026-09-22）——本节清单里的 A1/A2/B7/C6/E1/E2/E3/E5/E6 全部落地

| 编号 | 指令 | 落地形态 | 备注 |
|---|---|---|---|
| A1 | `!exp <n>` 自定义 | 主菜单 `#L23#` 输入框 | 上限 5 亿 |
| A2 | `!meso <n>` 自定义 | 主菜单 `#L24#` 输入框 | 上限 5 亿 |
| B7 | 按名字给物品 | 物品菜单 `#L12#` 搜索 | 走 `getAllItems()`，不在脚本里塞名字表 |
| C6 | 召唤 BOSS | 主菜单 `#L25#` 3 档 × 12 只 | `spawnMonsterOnGroundBelow` + 失败退回脚下 |
| E1 | 全图滚动公告 | 特效/播报 `#L0#` | `broadcastStringMessage(4, ...)` |
| E2 | 屏幕特效 | 特效/播报 `#L1#` 9 种 | `cm.showEffect`，只自己可见 |
| E3 | 地图特效 | 特效/播报 `#L2#` 4 种 | `map.broadcastMessage(mapEffect(path))`，全图 |
| E5 | 地图倒计时 | 特效/播报 `#L3#` | `cm.mapClock`，1~3600 秒 |
| E6 | 头顶称号 | 特效/播报 `#L4#` | `cm.earnTitle` |
| — | **一键清背包** | 主菜单 `#L27#` 按栏位 | 5 栏 + 全部（不含装饰栏），二次确认 |

**⚠️ 第 8 轮踩到的坑（写脚本/生成器必看）**：生成器往模板注入数组时，
若模板已写成 `var X = [ /*@X@*/ ];` 而数据自带最外层 `[]`，会**多套一层**导致 `X.length === 1`。
语法合法、编码合法、只数条目的正则校验也过，**只有点菜单才会露馅**。
现在 `gen_gm_menu.py` 用 `ast.literal_eval` 校验"装配前 + 装配后"两次数据结构。详见 §九 9.4。


---

## 七、注意事项与坑（必读）

1. **脚本必须 UTF-8 无 BOM**。脚本引擎用 `FileReader` 按平台默认编码读，
   IDEA 跑带 `-Dfile.encoding=UTF-8` 所以正常；用 `start-server.bat` 跑 jar 时是 GBK，中文会乱码。
2. **`gm_menu.js` 和 `9010000.js` 必须字节级一致** —— 改一个必须同步另一个，否则两个入口行为不同。
3. **改完脚本要完全关闭客户端再重开**（脚本引擎按 `MapleClient` 缓存，退回登录界面没用）。
4. **每个功能都要包在 `try/catch` 里，并且 `catch` 里必须调 `cm.dispose()`**
   —— 否则脚本抛异常会让 `dispose()` 不执行，这个 NPC 就永久点不动了（之前踩过）。
5. **数值型输入要校验**：`cm.sendGetText` 拿到的是字符串，必须 `parseInt` + 判 NaN + 判负数。
6. **`cm.spawnMonster(id, x, y)` 对非法怪物 ID 会返回 null 然后 NPE** —— 加空值保护。
7. **别加 `!reload` 这类指令**：`clearDrops()` / `reloadShops()` 存在但零调用方，
   数据是"读一次永久缓存"，没有任何热重载入口。改 DB / wz / config 一律重启服务端。
8. **GM 等级门槛**：`isGM()` 是 `gmLevel > 1`。菜单脚本已有 `if (!cm.getPlayer().isGM()) { cm.dispose(); return; }` 保护，新增功能也要沿用。

---

## 附：本次核对用到的源码位置

| 内容 | 文件:行 |
|---|---|
| 全屏捡物的核心方法 | `client\MapleCharacter.java:2062` `pickupItem(MapleMapObject)` |
| 捡物的正规调用方（客户端按Z） | `net\server\channel\handlers\ItemPickupHandler.java:56` |
| 地面物品列表 | `server\maps\MapleMap.java:1267` `getItems()` |
| 吸怪的核心方法 | `server\life\MapleMonster.java:1325` `resetMobPosition(Point)` |
| 怪物移动是客户端驱动的证据 | `net\server\channel\handlers\MoveLifeHandler.java:171` |
| 回满血蓝 | `client\AbstractMapleCharacterObject.java:412` `healHpMp()` / `:421` `updateHpMp(int,int)` |
| 杀光全图怪 | `server\maps\MapleMap.java:1562` `killAllMonsters()` |
| 刷怪 | `server\maps\MapleMap.java:1851` `spawnMonsterOnGroundBelow(int,int,int)` |
| 脚本 API 父类 | `scripting\AbstractPlayerInteraction.java`（156 个 public 方法） |
| 现有聊天指令 | `net\server\channel\handlers\GeneralChatHandler.java:84-180` |
| 现有 NPC 菜单 | `scripts\npc\gm_menu.js` / `9010000.js` |
