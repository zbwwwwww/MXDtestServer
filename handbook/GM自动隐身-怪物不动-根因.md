# GM 自动隐身 ⇒ 怪物不动 / 自己看不见 —— 根因与修法

> 日期：2026-09-21（第三轮实测后修订 —— **本轮找到了决定性证据**）
> 起因：实测 F1（全屏捡取）/ F2（吸怪）后报「按 F1 后人物不显示、怪物不动，按左右像瞬移；再按 F1 人物出现但半透明；输入 `!h` 才现身」
>
> ## ★ 定案（第三轮）：F1 这个键被**客户端自己**占用了
>
> 用户把「表情 1」改绑到 **X** 键后，**全屏捡取立刻正常，而且人物不再消失、怪物也正常走动**。
> 同一个 `emote=1`、同一段服务端代码，只换了物理按键 ⇒ 结论唯一：
>
> **⛔ 北冥客户端的 F1 有自己的功能。按 F1 时客户端执行自己的逻辑、根本不发 `FACE_EXPRESSION` 包，
> 服务端收不到 ⇒ GM 功能毫无反应；"人物消失 / 怪物不动 / 像瞬移"是客户端 F1 自己的表现。**
>
> 由此还确认了：**`GmActions.pickUpWholeMap` 的服务端逻辑是正确可用的**（此前两轮"修不好"，
> 一轮是因为测试跑的是旧代码，一轮是因为按键根本没发包）。§一/§二 关于 `USE_AUTOHIDE_GM` 的分析
> 仍然成立但**只是并存的第二个变量**，已一并关掉以消除干扰。
>
> 完整的选键规则 → `handbook\键位-全屏捡取.md` §九。

---

## 一、一句话结论

`USE_AUTOHIDE_GM: true` ⇒ GM 每次进游戏都被服务端设成 `hidden = true`，而：

1. **隐身玩家永远不能被选为「怪物控制器」** ⇒ 怪物没有控制器 ⇒ **怪物不走**（v083 的怪物移动是客户端驱动的）；
2. 服务端在隐身时给自己发 `getGMEffect(0x10, 1)`（GM 隐身效果包）⇒ **客户端把自己的角色画成隐形**；
3. `!h` 能救回来，是因为 `Hide(false)`（现身分支）里有一句**逐只怪重新分配控制器**的循环。

---

## 二、证据链（每条都可复查）

### 2.1 你身上当时确实是 `hidden = true` —— 两条独立铁证

**铁证 A（行为反推 `!h`）**

```java
// GeneralChatHandler.java:90-93
case "h":
    chr.Hide(!chr.isHidden());                       // ← 取反 ⇒ 只有"本来隐身"时才会现身
    chr.dropMessage(5, chr.isHidden() ? "[GM] 已隐身" : "[GM] 已现身");
```

你输入 `!h` 后角色**现身**了 ⇒ 说明那一刻 `isHidden()` 已经是 `true`。

**铁证 B（`hidden` 全项目只有 2 个赋值点，都在 `Hide()` 里）**

grep 全项目 `.hidden =`，命中只有：

```
MapleCharacter.java:925:   this.hidden = false;   // Hide(false) 分支
MapleCharacter.java:940:   this.hidden = true;    // Hide(true) 分支
```

`characters` 表里**没有 `hidden` 列**（查表报 `Unknown column 'hidden'`）⇒ 不可能从数据库读出来，只能是运行时被 `Hide(true)` 设上的。

### 2.2 `hidden` 只可能来自「自动隐身」——其余 4 条通道全部排除

`Hide(...)` / `toggleHide(...)` 的全部调用点（grep 结果）：

| # | 调用点 | 本次是否可能触发 |
|---|---|---|
| 1 | `GeneralChatHandler.java:91`（聊天框 `!h`） | ❌ 按 F1 之前你没打过 `!h` |
| 2 | `AdminCommandHandler.java:106` | ❌ 没有管理员封包 |
| 3 | `scripts\npc\gm_menu.js:654`、`9010000.js:654`（菜单 `#L9# 隐身 / 现身`） | ❌ 本次没开菜单 |
| 4 | `MapleStatEffect.java:929`（GM 隐身技能 `9001004`/`9101004`） | ❌ 见下 |
| 5 | **`PlayerLoggedinHandler.java:263` `toggleHide(true)`** | ✅ **就是这个** |

**第 4 条的排除依据（查库实测）**

- `skills` 表：角色 1 **没有学** `9001004` / `9101004`（查询返回空）；
- `keymap` 表：F1~F7 全部是 `type=6`（表情）、`action=100~106`，**没有任何技能绑定**。

⇒ `MapleStatEffect:929` 的 `sourceid == GM.HIDE || == SuperGM.HIDE` 分支不可能被触发。

**第 5 条的依据（配置 + 代码）**

```yaml
# config.yaml:224
USE_AUTOHIDE_GM: true    #When enabled, GMs are automatically hidden when joining.
```

```java
// PlayerLoggedinHandler.java:260-265（每次进游戏都会执行）
c.announce(MaplePacketCreator.getCharInfo(player));
if (!player.isHidden()) {
    if (player.isGM() && YamlConfig.config.server.USE_AUTOHIDE_GM) {
        player.toggleHide(true);          // ← 进游戏即隐身
    }
}
```

角色 `ceshi` 的 `gm = 6` ⇒ `isGM()`（`gmLevel > 1`）通过 ⇒ **每次登录都自动隐身**。

### 2.3 隐身 ⇒ 怪物不走（"怪物不动"的真正原因）

```java
// MapleMonster.java:1852-1853
for (MapleCharacter chr : getMap().getAllPlayers()) {
    if (!chr.isHidden()) {                 // ← 隐身的玩家被直接跳过
        int ctrlMonsSize = chr.getNumControlledMonsters();
        ...
```

v083 的怪物移动是**客户端驱动**的：服务端把怪"托付"给某个玩家的客户端，由该客户端上报 `MOVE_LIFE`，服务端再广播给其他人。**控制器挑不出来 ⇒ 怪物就停在原地。**

配套的还有 `Hide(true)` 分支最后那句：

```java
// MapleCharacter.java:947
this.releaseControlledMonsters();     // → 每只怪 aggroRedirectController()
                                      //   = aggroRemoveController() + aggroUpdateController()
                                      //   摘掉旧控制器后重挑，而此时你已是 hidden ⇒ 挑不到 ⇒ 怪物全成"无主"
```

### 2.4 隐身 ⇒ 你自己看不见自己

```java
// MapleCharacter.java:939-947（Hide(true) 分支）
this.hidden = true;
announce(MaplePacketCreator.getGMEffect(0x10, (byte) 1));   // ← 给自己发 GM 隐身效果包
if (!login) {
    getMap().broadcastNONGMMessage(this, MaplePacketCreator.removePlayerFromMap(getId()), false);
}
List<Pair<MapleBuffStat, Integer>> ldsstat = ... (DARKSIGHT, 0);
getMap().broadcastGMMessage(this, MaplePacketCreator.giveForeignBuff(id, ldsstat), false);
this.releaseControlledMonsters();
```

`getGMEffect(0x10, 1)` 走的是 `SendOpcode.ADMIN_RESULT`（`MaplePacketCreator.java:6989`），客户端据此把**本地角色**画成 GM 隐身态（不绘制 / 半透明）。

### 2.5 `!h` 为什么一按就全好了

```java
// MapleCharacter.java:924-938（Hide(false) 分支）
this.hidden = false;
announce(MaplePacketCreator.getGMEffect(0x10, (byte) 0));            // 撤销隐身效果
... broadcastGMMessage(cancelForeignBuff(id, [DARKSIGHT])) ...       // 取消隐身 buff
getMap().broadcastSpawnPlayerMapObjectMessage(this, this, false);     // 让客户端重建角色对象 ⇒ 立刻可见
for (MapleMapObject mo : this.getMap().getMonsters()) {
    ((MapleMonster) mo).aggroUpdateController();                      // 逐只怪重挑控制器 ⇒ 怪物立刻恢复走动
}
```

这一句正是"**按 `!h` 之后人物现身、怪物也活过来**"的直接原因 —— 和你的观察逐条对得上。

### 2.6 为什么 F2 看着"没问题"、F1 才暴露

| | 机制 | 你看到的现象 |
|---|---|---|
| **F2 吸怪** | `resetMobPosition` 是**服务端直接广播 `moveMonster`**，与"控制器"无关 | 怪照样被拉到脚下，**看起来成功**；但你是 hidden，拉完依旧没有控制器 ⇒ 停住不动 |
| **F1 全屏捡取** | 那次按 F1 **一件都没捡起来**（见 §2.7），只发了一条提示包 | 所以 F1 在服务端几乎没做任何事 ⇒ **它跟隐身无关**。你是在按 F1 的时候**第一次认真看屏幕**，才发现角色早已是隐身态 |

⇒ **F1 不是元凶，也不是"报警器"**；真正的开关是"进游戏自动隐身"。之所以感觉"按了 F1 才出问题"，只是因为那一刻你才去看屏幕。

### 2.7 F1「没捡到东西」——两轮实测，第一轮的结论已被推翻

> ⚠️ **本文第一版在这里写的是「消耗栏 + 其他栏都满了 ⇒ checkSpace 静默跳过」。这个结论是错的。**
> 第二轮实测把它推翻了，保留记录以免重复踩。

**第一轮的观察（当时成立但不充分）**

第一轮查库时，角色 1 的槽位上限是 `equipslots=112 / useslots=32 / setupslots=32 / etcslots=32`，
而 USE 占 32、ETC 占 32 ⇒ 看起来是"满了"。于是把原因归到 `checkSpace` 上。

**第二轮直接否掉它**（用户执行了方案一：先 `!h`、扩充背包、丢物品、再按 F1）

| 项 | 第一轮 | 第二轮 | 结论 |
|---|---|---|---|
| `useslots` 上限 | 32 | **104** | 已扩充 |
| `etcslots` 上限 | 32 | **112** | 已扩充 |
| `equipslots` 上限 | 112 | **120** | 已扩充 |
| USE 实际占用 | 32 | 32 | 空间极充裕 |
| ETC 实际占用 | 32 | 32 | 空间极充裕 |
| 物品总数 | 102 | 102 | 不变 |
| **按 F1 结果** | 0 件 | **仍然 0 件** | ⇒ **跟背包空间无关** |

配套证据：

- `logs\...\error\game\packethandler\` 里**没有** `net.server.channel.handlers.FaceExpressionHandler.txt`
  ⇒ F1 的处理器**跑完了、没抛异常**（这套日志是按处理器类名分文件写的，抛了就一定有文件）。
- 服务端本次启动后**没有重启过**（PID 16792，08:04 启动至 19:3x），所以 F1/F2 两次测试跑的是同一份代码。

⇒ 结论：**包到了、代码跑了、返回 0**。问题在 `pickUpWholeMap` 的过滤条件里，
而当时那版代码**只返回一个 int**，把「背包满 / 刚掉落 / 归属他人 / 任务限定」全部伪装成
「地上没有可捡的东西」，所以从现象无法定位。**这是可观测性缺失，不是玄学。**

**为此改成了自证版**（见 §三·改动明细）：每种跳过原因各记一个计数，消息里直接写出来。

### 2.7.1 顺手修掉的两个真 bug（都在我自己的代码里）

**bug 1：`picked++` 无条件自增 ⇒ 虚报件数**

```java
// 旧
chr.pickupItem(mapitem);
picked++;                       // ← 不管 pickupItem 内部有没有真的拿走
```

`pickupItem` 内部还有若干早退分支（400ms 保护、唯一物品、任务限定、锁冲突），
物品没进背包但计数照样 +1，会出现「提示说捡了 3 件、背包里其实没有」。
判据应为 `mapitem.isPickedUp()`（只有真被 `pickItemDrop` 拿走才会置 true）。

**bug 2：400ms 落地保护用了两只不同的时钟 ⇒ 可能把刚掉的物品全部误判成"保护期内"**

```java
// MapleMapItem.dropTime 是这么写进去的（MapleMap:1133 / 1157 / 2234）
mdrop.setDropTime(Server.getInstance().getCurrentTime());   // ← 服务端"集中时间"，非墙钟

// 而旧代码这样比
long now = System.currentTimeMillis();                      // ← 墙钟
if (now - mapitem.getDropTime() < DROP_PICKUP_DELAY) continue;
```

`Server.getCurrentTime()` 返回的是 `Server.serverCurrentTime`：由 `CharacterDiseaseTask`
每 `UPDATE_INTERVAL`(777ms) 累加一次，并由 `TimerManager.purge()`（周期 = `PURGING_INTERVAL`）
用墙钟重新对齐（`forceUpdateCurrentTime()`）。

**只要这只时钟比墙钟快哪怕一点点，`now − dropTime` 就会偏小，**
**"刚落地"的物品会被判成还在保护期而全部跳过** —— 丢完东西立刻按 F1，正好命中这个窗口。
修法：比较时改用同一只时钟 `Server.getInstance().getCurrentTime()`。

### 2.7.2 另一个认知更正：Z 键不走原版拾取

`ItemPickupHandler.java:58` 对 GM 是**直接调 `pickUpWholeMap`** 的：

```java
if (!GM_ONLY_BULK_PICKUP || chr.isGM()) {
    ... GmActions.pickUpWholeMap(chr) ...   // ← GM 按 Z 也走全屏捡取
    return;
}
```

所以 **GM 按 Z 和按 F1 是同一段代码**，Z 也不会弹「背包已满」
（旧代码在 picked==0 时只发 `enableActions`）。此前"Z 键会弹背包已满"的说法同样作废。

两者唯一的区别在**客户端**：按 Z 时客户端先在自己 800×600 屏内找最近掉落物，
**一件都没有就根本不发包**；按 F1 没有这个前置判断。这就是当初选 F1 当信号键的原因。


### 2.8 附：为什么"按左右像法师瞬移"

角色处于 GM 隐身渲染态时客户端不画行走动画，你看到的是**镜头跟随的位移**；另外 `config.yaml:242 USE_ENFORCE_ADMIN_ACCOUNT: true` 会给 GM 账号开放客户端侧的特权（注释里明写包含 **FLY 飞行**）。两者叠加，体感就像瞬移。**都与 F1 无关。**

---

### 2.9 第四轮实测（09-21 20:00）：②独立存在，但**改动还没生效**

用户按上面那条判定法做了一次干净测试 —— **不按 F1、不打 `!h`，直接登录**：

> 登录后就是隐身状态，且怪物不动，需要打 `!h` 才会现身。

这同时回答了两件事：

**（1）②（`USE_AUTOHIDE_GM` 自动隐身）是独立存在的**

不是"F1 的附带现象"。只要 `USE_AUTOHIDE_GM` 是 `true`，**每次登录都必然隐身**，与按不按 F1 无关。

**（2）但这次的隐身不是"配置没改"，而是「改了没生效」—— 时间戳对不上**

| 事件 | 时间 |
|---|---|
| 服务端进程 **PID 16792 启动**（IDEA Debug，此刻把 `USE_AUTOHIDE_GM=true` 读进内存） | 09-21 **08:04:32** |
| `config.yaml` 改成 `false` | 09-21 **19:39:52** |
| 新 class 部署进 `out\production\SERVER083`（jar 19:46:49 同步） | 09-21 **19:46:45** |
| 用户登录复测（**仍然隐身**） | 09-21 **20:00** |

两处改动**都在进程启动之后**，而：

- `config.yaml` **只在服务端启动时读一次**，之后文件怎么改都与内存无关；
- JVM **不会重新加载 class**，`out\production` 里换成新文件也影响不了已运行的进程。

⇒ **进程内存里至今仍是 `USE_AUTOHIDE_GM = true`**，所以 20:00 登录照旧隐身。**这不是新故障，是"未重启"的正常表现。**

**★ 由此得到一条通用判据（已写进 `MEMORY.md` 铁律 2）**

> 怀疑"改了没生效"时，**先比「进程启动时间」和「文件 mtime」**，别先怀疑代码：
> `Get-CimInstance Win32_Process -Filter "name='java.exe'"` 看 `CreationDate`；
> 文件时间看 `os.path.getmtime()`。**进程启动早于改动 ⇒ 一定没生效，不需要再查别的。**

---

## 三、修法（已执行，等你重启验证）

### 1) 配置：关掉 GM 自动隐身 —— ✅ 已改（2026-09-21 19:4x）

```yaml
# config.yaml:224
- USE_AUTOHIDE_GM: true              #When enabled, GMs are automatically hidden when joining.
+ USE_AUTOHIDE_GM: false             #关掉：GM 进游戏不再自动隐身
```

- **效果**：怪物正常走动、角色正常显示。想隐身时仍可手动：GM 菜单 `#L9# 隐身 / 现身`，或聊天框 `!h`。
- ⚠️ `config.yaml` **只在服务端启动时读一次** ⇒ 改完必须**重启服务端**才生效。
  → 已被写进文件，回退只需把 `false` 改回 `true`（一行）。
- 想还原成原版行为：改回 `true` 即可，一行。

### 2) 代码：把"捡不到"变成可自证 —— ✅ 已改并编译

| 文件 | 改动（**含 09-21 21:46 的收官清理**） |
|---|---|
| `server\GmActions.java` | 新增 `PickupReport`（逐项计数：背包满 / 刚掉落 / 归属他人 / 任务限定 / 已捡走 / 被拒）；`pickUpWholeMap` 返回它；`picked` 改判 `mapitem.isPickedUp()`；400ms 比较改用 `Server.getInstance().getCurrentTime()`（与 `dropTime` 同一只时钟）；`diagnose(chr)` 自检**保留但已不绑任何入口** |
| `net\...\FaceExpressionHandler.java` | 只保留 **2 个功能绑定**（表情 1 = 全屏捡取、表情 2 = 吸怪）+ 隐身附加提示。⛔ **临时件已全部删除**：`GM_EMOTE_ECHO` 探针、`EMOTE_DIAG` 常量与「表情 3 自检」分支 |
| `net\...\ItemPickupHandler.java` | 同步用 `PickupReport`（GM 按 Z 也是这条路径） |

部署方式（重要）：服务端由 IDEA Run/Debug 启动，classpath 里是
**`D:\MXDtestServer\out\production\SERVER083`**，不是 jar。
所以改动必须编译进这个目录，否则**等于没改**（`D:\tmp\deploy_classes.py`）。
jar 也同步补了（`D:\tmp\patch_jar.py`），供 `start-server.bat` 方式启动时使用。

### 3) 验证步骤（**排查期**的判读表，保留备用）

> ⚠️ 下面的 `emote=N` 回显来自排查期的临时探针 `GM_EMOTE_ECHO`，**该探针已于 09-21 21:46 删除**
> （现在按功能键不会再回显 `emote=N`）。其余几行的判读**依然成立**，尤其"毫无提示 = 客户端吞包"。
> 需要时把探针加回去即可：在 `handlePacket` 的 `if (chr != null && chr.isGM())` 里加一行
> `chr.dropMessage(6, "[GM] 收到表情值 emote=" + emote);`。

| 你看到 | 说明 |
|---|---|
| ~~`[GM] 自检：…`~~ | 原「表情 3」功能，**已撤**；`GmActions.diagnose()` 还在，需要时一行挂回 |
| 弹出 `[GM] 收到表情值 emote=1`（需临时挂回探针） | ✅ 键位映射正确，包到了服务端 |
| **按键什么提示都没有** | 客户端根本没发 `FACE_EXPRESSION` ⇒ **该键被客户端自身占用**（F1 就是这样） |
| 弹出 `地上 N 件，拾取 0 件，跳过：…` | 包到了、被过滤了。**冒号后面直接写明是谁拦的**，照那个字段修 |
| 弹出 `地上 0 件` | 掉落物不在服务端这张图上（客户端显示≠服务端数据） |

---

## 四、以后再遇到"怪物不动 / 自己看不见"的 30 秒判据

1. 打 `!h`。若返回"`[GM] 已现身`" ⇒ **你本来就是隐藏的** ⇒ 就是本文这个坑。
2. 打完 `!h` 怪物立刻开始走 ⇒ 100% 确认是隐身导致，**不是**地图没刷怪 / 服务端卡住。
3. 想确认服务端有没有卡：控制台出现 `Channel 1: Listening on port 7575` 才算真正启动完成；卡住用 `jstack.exe <PID>` 找 `BLOCKED`。

---

## 五、实测验收记录

### 第一轮（09-21 白天）

| 项目 | 结果 |
|---|---|
| F2 吸怪 | ✅ 怪物被拉到脚下（注：`resetMobPosition` 是服务端直接广播，与控制器无关，所以即使隐身也生效） |
| F1 全屏捡取 | ❌ 一件都没捡到（**当轮归因"背包满"，第二轮被推翻**，见 §2.7） |
| 「人物不显示 / 怪物不动 / 只能 `!h` 现身」 | ❌ 不是 F1 的错 —— 是 `USE_AUTOHIDE_GM: true` 的自动隐身（§一~§二） |
| 服务端异常日志 | ✅ 无新增（最后写入停在 09-21 08:00，早于服务端 08:04 启动）⇒ F1/F2 都没抛异常 |

### 第二轮（09-21 19:2x，执行"方案一"后）

| 项目 | 结果 |
|---|---|
| 背包已扩充 | ✅ `useslots` 32→**104**、`etcslots` 32→**112**、`equipslots` 112→**120**，实际占用仍是 32/32/32 |
| F1 全屏捡取 | ❌ **仍然 0 件** ⇒ 空间不是原因（推翻第一轮结论） |
| 「人物隐身 / 怪物静止」 | ❌ 仍然复现 ⇒ 与 §一/§二 的判断一致（自动隐身未关） |
| 服务端异常日志 | ✅ `packethandler\` 下**没有** `FaceExpressionHandler.txt` ⇒ 处理器跑完了没抛异常 |
| **关键新事实** | 服务端（PID 16792）**自 08:04 启动后没重启过**，而它加载的是 `out\production\SERVER083` —— **第二轮测试跑的还是旧代码**（`out\production` 里没有我 09-21 白天改的东西） |

### 第三轮（已执行完毕，结论见 `键位-全屏捡取.md` §九）

| 步骤 | 结果 |
|---|---|
| ~~F3~~ | 该临时键**已撤**（09-21 21:46） |
| F2 | ✅ 通过 —— 怪物被拉到脚下 |
| 「表情 1」绑到普通键（X / A） | ✅ 通过 —— 东西全捡起来，且**不再出现人物消失 / 怪不动** |

⛔ **F1 本身不可用**（客户端占用，根本不发包）⇒ 这就是"两轮都捡不到"的真因，
**不是**背包满、**不是**过滤条件、**也不是** `USE_AUTOHIDE_GM`。

### 重测步骤

1. **重启服务端**（IDEA 里 Stop 再 Run；⚠️ 按 F1/F2 前先清掉所有断点，否则服务端会被冻住）；
2. 进游戏，先按 **F3** 看自检；
3. 跑到有怪有掉落的地图，往地上丢几件东西，**等 2 秒以上**再按 F1；
4. 把聊天框里那几行原样发我。

