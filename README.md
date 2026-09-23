# MXD 083 单机私服服务端（HeavenMS-zhoubw_083）

基于 HeavenMS（MapleStory v083）源码改造的**单机**服务端，配套北冥 GMS083 客户端。
在原版基础上做了大量本地化与 GM 功能扩展（详见 [近期改动清单](#八-近期改动清单2026-09-19--09-23)）。

> ⚠️ 仅供本地学习研究使用，请勿用于商业或联机运营。

---

## 一、软硬件环境要求

| 项目 | 要求 | 说明 |
|---|---|---|
| 操作系统 | Windows 10/11 x64 | 客户端仅支持 Windows |
| JDK | **JDK 8**（Adoptium 8.0.502.7-hotspot） | 必须 JDK8，JDK11+ 无法运行（用到了 JDK8 内置 Nashorn 脚本引擎） |
| 数据库 | **MySQL 5.7.44** | 建议 Windows 服务方式安装，服务名 `MySQL57` |
| IDE（可选） | IntelliJ IDEA 2021+ | 源码调试用；直接玩不需要 |
| 客户端 | 北冥 GMS083 整合版 | 仓库不包含，需单独获取（见第九节）；解压到 `北冥GMS083\` 目录 |

---

## 二、目录结构

```
MXDtestServer/
├── src/                  Java 源码（主类 net.server.Server）
├── cores/                依赖 jar（无 Maven，编译/运行时的 classpath）
├── wz/                   服务端 wz 数据（XML 明文：Mob/Item/Skill/String 等）
├── scripts/              NPC/任务/传送门脚本（Nashorn JS，含 gm_menu.js）
├── sql/                  建库初始化 SQL（db_database.sql 为主库）
├── config.yaml           服务端主配置（数据库/端口/游戏参数）
├── start-server.bat      一键启动脚本
├── handbook/             开发与改动文档（避坑清单、机制分析等）
├── tools/                生成/部署管线（菜单生成、wz 补丁、双部署、探针）
├── saves/                DB 备份与存档导出（不入库）
├── out/                  编译产物（不入库，需本地构建）
└── 北冥GMS083/           客户端（不入库，单独分发）
```

---

## 三、数据库准备

1. 启动 MySQL 服务（本机：`net start MySQL57`）
2. 创建数据库并导入初始化 SQL：

```sql
CREATE DATABASE heavenms DEFAULT CHARACTER SET utf8;
USE heavenms;
SOURCE sql/db_database.sql;   -- 主库表结构+基础数据
SOURCE sql/db_drops.sql;      -- 掉落表
SOURCE sql/db_shopupdate.sql; -- 商店
SOURCE sql/db_buchong.sql;    -- 补充数据
SOURCE sql/db_huodong.sql;    -- 活动
```

3. 在 `config.yaml` 中核对连接信息（第 165~167 行），数据库账号密码**请自行创建并配置**：

```yaml
DB_URL: "jdbc:mysql://localhost:3306/heavenms?connectTimeout=5000&socketTimeout=15000&autoReconnect=true"
DB_USER: "<你的数据库用户名>"
DB_PASS: "<你的数据库密码>"
```

> 示例（MySQL root 或自建用户均可，授权即可）：
> ```sql
> CREATE USER 'maple'@'localhost' IDENTIFIED BY '你的密码';
> GRANT ALL PRIVILEGES ON heavenms.* TO 'maple'@'localhost';
> FLUSH PRIVILEGES;
> ```

---

## 四、启动步骤

### 方式 A：脚本一键启动（推荐）

```
1. net start MySQL57                    # 先起数据库（手动服务）
2. 双击 start-server.bat                # 内部执行：
   java -jar "out\artifacts\HeavenMS_zhoubw_083_jar\HeavenMS-zhoubw_083.jar"
3. 看到 "Listening on port 8484" 即启动成功
4. 客户端：北冥GMS083\GMS083_北冥整合版\MapleStoryHD\单机登录器.bat
   （本仓库不含客户端，获取方式见第九节「客户端分发」）
   ⚠️ 千万别点「联机登录器」，那是连外服的
```

- 登录端口 **8484**，游戏频道 **7575**（默认单频道）
- 服务端窗口保持开启，关窗即停服
- 默认 GM 账号：`ceshi`（GM 等级 6）

### 方式 B：IDEA 源码调试

- 主类：`net.server.Server`
- Working directory 必须是**项目根目录** `D:\MXDtestServer`（相对路径读 wz/scripts/config.yaml）
- IDEA 启动加载的是 `out\production\SERVER083`（classes 目录），与 jar 是两份产物，**改 Java 后两边都要更新**（见第八节铁律）

### JVM 参数

- 必须跑在 JDK8 上，无特殊 JVM 参数要求
- 时区已在配置中固定 `TIMEZONE: GMT+8`（北京时间）

---

## 五、关键配置（config.yaml）

| 配置项 | 当前值 | 说明 |
|---|---|---|
| `USE_ENABLE_FULL_RESPAWN` | `true` | 每次补怪把刷怪点填满（怪物密度 100%） |
| `RESPAWN_INTERVAL` | `1000` | 补怪间隔 1 秒 |
| `TIMEZONE` | `GMT+8` | 北京时间（原版 GMT-8，DB 时间字段已回填） |
| `USE_BUFF_MOST_SIGNIFICANT` | `true` | buff 取最高值不互相覆盖 |
| `USE_BUFF_EVERLASTING` | `false` | buff 永久化总开关（未开，用单项长时 buff 代替） |

---

## 六、GM 功能使用

### 入口

- **NPC 菜单**：找 NPC `9010000`（斯麦丽斯）打开 GM 功能菜单（主菜单 32 项，可滚动）
- **`!` 指令**：聊天框输入 GM 命令（Java 层）
- **快捷键**：`A` = 全屏捡物；`F2` = 吸怪模式开/关（⚠️ F1 不要绑定，会顶掉客户端功能）

### 菜单主要功能（节选）

| 类别 | 内容 |
|---|---|
| 数值 | 加等级 / 加经验 / 加金币 / 回满 HP·MP |
| 技能 | 按职业链全学技能（含跨职业标注） |
| 物品 | GM 套装 / S 档超模装备 / 预设物品 / 按名字·ID 搜索获取 / 一键清背包（按栏位，二次确认） |
| 召唤 | 召唤 BOSS（36 只 3 档）/ 召唤怪物-点名 Lv.101~131（38 只普通怪，自由行动） |
| **伤害倍率** | ×1 / ×10 / ×100 / ×1000 切换，服务端放大实际扣血（内存态，重登回 ×1） |
| **攻击速度爆发**（攻速档位功能） | 一键上满级速效激发 buff（x=-8 最快档，约 9 小时，可随时续） |
| 特效/播报 | 全图公告 / 屏幕特效 / 地图特效 / 倒计时 / 头顶称号 |

---

## 七、改代码后如何生效（铁律）

| 改了什么 | 生效方式 |
|---|---|
| NPC 脚本 `scripts/` | 完全关客户端重开（脚本按连接缓存，无热重载） |
| Java 源码 | 重编译 → **两份产物都更新**（`out\production\SERVER083` + artifact jar）→ 重启服务端 |
| `wz/` 数据 | 重启服务端 |
| `config.yaml` | 重启服务端 |
| 数据库（角色在线时） | ⚠️ 必须先退游戏，在线改会被 `saveCharToDB` 回写覆盖 |

脚本约束：JS 必须 UTF-8 编码且**中文 GB2312 可编码**（封包硬编码 GB2312）；`gm_menu.js` 与 `9010000.js` 必须字节级一致（由生成管线统一产出，工具脚本在 `tools/`，用法见第八节）。

---

## 八、近期改动清单（2026-09-19 ~ 09-23）

### 1. GM 菜单系统（全新）
- NPC `9010000` + `scripts/npc/gm_menu.js` 双文件体系，模板 + 生成脚本统一产出，保证 `gm_menu.js`/`9010000.js` 字节一致
- 主菜单 32 项：全学技能、物品获取/搜索、清背包、加经验金币、召唤 BOSS/点名怪、特效播报、伤害倍率、攻速爆发等
- 数据驱动：BOSS 清单、点名怪清单、物品预设全部由 Python 脚本扫 wz 自动生成注入

### 2. 吸怪模式 toggle（绑 F2 键）
- `GmActions.java` 新增 F2 键开关；开启后全图活怪拉到角色**右侧 200 身位**（`VACUUM_OFFSET_X=200`）并冻结，新刷怪自动吸，离图自动关
- 关闭时强制解冻旧怪（`aggroRemoveController` + `aggroUpdateController` 重新交接）

### 3. 全屏捡物（绑 A 键）
- `GmActions.java` + `ItemPickupHandler.java`：一键拾取全图掉落

### 4. GM 帽「维泽特帽」(1002140)
- wz + DB 双改：四维/物攻/魔攻 32767、速度 40、跳跃 35

### 5. 装备拉满
- 角色穿着 7 件 + `inventoryequipment` 表全部 20 件：四维/物攻/魔攻/物防/魔防 8 栏全部 32767
- 备份表 `inventoryequipment_bak_maxall_20260922`

### 6. 多段伤害溢出修复（重要 bug fix）
- `AbstractDealDamageHandler.java`：`totDamageToOneMonster` int 累加溢出变负导致"怪物回血打不死"
- 修复：long 累加 + 钳制 `Integer.MAX_VALUE`；跨怪 `totDamage` 同改 long；COMBO_DRAIN 吸血加钳制
- 修复后单次攻击对单怪 ≥ 21.47 亿 ≥ 083 任何怪 HP，**多段必杀**

### 7. 伤害倍率功能
- `MapleCharacter` 新增 `dmgMultiplier`（内存态）+ GM 菜单 ×1/×10/×100/×1000
- `AbstractDealDamageHandler` 扣血前放大实际伤害，绕过客户端单段显示墙（≈13.33 亿）

### 8. 攻击速度爆发（攻速档位功能）
- `Skill.wz/512.img.xml` 速效激发 5121009 全 20 级：`x`=-8（客户端攻速合计钳制最快档 2，任何武器触底）、`time`=32700 秒
- GM 菜单一键上 buff（`SkillFactory.getSkill(5121009).getEffect(20).applyTo`），无需学技能不耗蓝，到期一键续
- 备份：`512.img.xml.bak_20260923`

### 9. 召唤怪物-点名（Lv.101~131）
- 扫 `Mob.wz` + `String.wz` 自动生成 38 只普通怪清单（剔除 42 只 BOSS，BOSS 走独立召唤）
- `spawnMonsterOnGroundBelow` 贴地召唤，自由行动不冻结；支持单只/全部召唤

### 10. HikariCP 连接池修复
- 连接池改为 `static{}` 初始化 + `initPool()`/`closePool()` 生命周期管理（`Server.java` 接入）

### 11. 服务端配置调整
- `USE_ENABLE_FULL_RESPAWN: true` + `RESPAWN_INTERVAL: 1000`（怪物密度拉满）
- `TIMEZONE: GMT+8`（北京时间，DB 时间字段已回填）

### 12. 文档与工具
- `handbook/` 12+ 篇开发文档：避坑清单、脚本编码与测试、装备属性存哪怎么改、攻击力上限、怪物密度、时区、DB 表说明等
- `tools/` 生成与部署管线（已入库，自包含可复现）：
  - `gen_gm_menu.py` — GM 菜单生成器（模板+数据注入 → `gm_menu.js`/`9010000.js` 字节一致）
  - `gm_menu.template.js` / `gm_extra_boss.js` / `gm_extra_mobs_101_131.js` — 模板与数据文件
  - `gen_mob_points_101_131.py` — 扫 wz 生成点名怪清单；`patch_5121009.py` — 速效激发 wz 定点改参
  - `deploy_classes.py` / `patch_jar.py` — Java 改动双部署（classes 目录 + artifact jar）
  - `scan_mob_hp.py` — 全怪物血量扫描；`probe/Probe5121009.java` — wz 真 Java 探针
  - `fixE-bench/skill_names_all.tsv` — 技能中文名表（生成器依赖）

---

## 九、推送到 Git 的注意事项

- `.gitignore` 已按本项目实际情况配置：**排除客户端（北冥GMS083/，数 GB 二进制）、编译产物（out/）、存档备份（saves/）、各类 .bak**
- **客户端分发（本仓库不包含客户端，请单独获取，获取连接如下）**：客户端共 ~6.5 GB，`.wz` 资源占 6.5 GB，有 9 个文件超过 GitHub 单文件 100 MB 硬限（最大 `Character.wz` ≈1.2 GB）——直接 push 会被拒；只提交 EXE 和登录器.bat 也没用，客户端离开 `.wz` 资源无法运行。推荐做法：
> 📦 **客户端下载**：北冥 GMS083 整合版 —— 百度网盘 `https://pan.baidu.com/s/1BT7UPCUW0g34BTz2ta1qBw` 提取码 `2022`（来源：iopq 藏宝湾「北冥版GMS083一键整合」帖，2022-03）
> 解压后放到项目根目录，保持目录名 `北冥GMS083\`，与 README 第四节路径一致即可。
- `cores/` 内是依赖 jar（无 Maven 仓库坐标，属于必需运行库），建议保留入库；若仓库嫌大可改为网盘分发 + README 说明
- `wz/` 与 `scripts/`、`sql/`、`handbook/`、`src/` 均为文本，正常入库
- 初次提交建议：`git init && git add . && git commit -m "init: HeavenMS-zhoubw_083 单机服务端"`

---

## 十、已知限制 / 常见坑

1. 单段伤害显示封顶 ≈13.33 亿：客户端算伤/显示的墙（PKG1 加密），改不了；服务端实际扣血不受此限制
2. 攻速合计钳制在"最快 2 档"：`x=-8` 保证触底，但不会更快（客户端墙）
3. 怪物 HP 上限 = int 21.47 亿（083 设计如此，最高为品克缤 21 亿）
4. 脚本中文必须 GB2312 可编码，否则封包乱码；不支持 emoji
5. MySQL 未启动时服务端起不来（报连接失败），先 `net start MySQL57`
