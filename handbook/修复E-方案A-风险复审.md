# 修复 E · 方案 A —— 风险复审报告（第二轮）

> 日期：2026-09-21 13:40
> 性质：**复审，仍未动代码**。对 `修复E-方案A-待改代码清单.md` 做一次对抗性检查。
> 检查目标：**找出"池化之后才会出现、DriverManager 模式下永远不会发生"的问题。**
> 方法：静态扫描全项目 + 反汇编服务端实际 jar + 跑 4 个只读/自毁式探针实测。

---

## 〇、结论摘要

| 类别 | 数量 | 说明 |
|---|---|---|
| 🔴 **建议修订方案** | **3** | 静态块异常外泄、`initPool()` 插入时机、MySQL 重启后的失败窗口 |
| 🟡 **知情即可，不改代码** | **3** | 长事务误报、驱动不支持 networkTimeout、3 行冗余配置 |
| 🟢 **已排查，确认无风险** | **5** | 见 §四，全部有证据 |

**一句话**：方案 A 的主干是稳的，但**有 2 处细节需要改**（都是"改一行位置/加一层 try"级别的），另有 1 个池化固有的行为变化要接受。

---

## 一、🔴 坑 1：静态块抛异常 = 服务端 DB 层彻底不可用（建议改）

### 问题

清单文档 §2.2 的代码里，`try/catch(Throwable)` 只包住了**建池那一段**：

```java
public static synchronized void initPool() {
    if (ds != null) return;

    if (!YamlConfig.config.server.DB_CONNECTION_POOL) return;   // ← 这行在 try 外面！
    if (!YamlConfig.config.worlds...) ...
    try { Class.forName("com.mysql.jdbc.Driver"); } catch (ClassNotFoundException e) { ... }  // ← 也在外面
    try { ... 建池 ... } catch (Throwable t) { ds = null; ... }   // ← 只有这里被保护
}
```

而 `initPool()` 被放在 `static { }` 里执行。**静态块抛出的异常，JVM 会永久记住**：

> 第一次初始化失败 ⇒ 抛 `ExceptionInInitializerError` ⇒ 之后**任何**对 `DatabaseConnection` 的访问都会直接抛 `NoClassDefFoundError`，**类永远不会再尝试初始化**。

### 后果对比

| | 现在（构造器模式） | 方案 A 原样（静态块） |
|---|---|---|
| 构造器/静态块抛异常 | **不可能**（没人 `new`，从不执行） | **可能**，且一旦抛出就是**永久性** DB 不可用 |
| cwd 不对读不到 config.yaml | `RuntimeException` 从 `Server.init()` 抛出 → 可见的启动失败 | `YamlConfig` 初始化失败 → 异常穿透静态块 → `ExceptionInInitializerError` → 之后**所有** DB 调用 `NoClassDefFoundError` |

⚠️ **这是"从能跑变成彻底不可用"的降级**，虽然只在环境异常时触发。而 `YamlConfig.fromFile("config.yaml")` 用的是**相对路径**（`YamlConfig.java:13`，这正是铁律"cwd 必须是 `D:\MXDtestServer`"的根因），触发条件并不苛刻。

### 修法（1 行位置改动）

```java
// 原来的：
static {
    initPool();
}

// 改成：
static {
    try {
        initPool();
    } catch (Throwable t) {                     // 静态块绝不能向外抛
        ds = null;
        System.out.println("[SEVERE] DatabaseConnection static initializer failed, "
                + "falling back to one connection per query. Reason: " + t.getMessage());
        t.printStackTrace();
    }
}
```

**原则**：`static {}` 里只允许出现"不可能失败"或"失败也不影响继续运行"的代码。这里保证"无论发生什么，`ds` 都是 null，`getConnection()` 退回 DriverManager" —— 即**永远不比现状差**。

---

## 二、🔴 坑 2：`initPool()` 插在 `TimeZone.setDefault()` 之前（建议改位置）

### 问题

清单文档把 `DatabaseConnection.initPool();` 放在 `Server.init()` 的 `println` 之后：

```java
757    public void init() {
758        System.out.println("HeavenMS v" + ServerConstants.VERSION + " starting up.\r\n");
759
760        DatabaseConnection.initPool();                 // ← 清单里放这
761
762        if (YamlConfig.config.server.SHUTDOWNHOOK) ...
763        TimeZone.setDefault(TimeZone.getTimeZone(YamlConfig.config.server.TIMEZONE));   // ← 时区在这才设好
764
765        Connection c = null;
766        try {
767            c = DatabaseConnection.getConnection();   // ← 原来第一次用 DB 在这
```

`config.yaml:308` 是 **`TIMEZONE: GMT-8`**（这也是"服务端日志比北京时间慢 16 小时"的根因）。

而原来的时序是：**先设时区（763），再建数据库连接（767）**。
清单把建池提到 760 ⇒ **池的物理连接会在"系统默认时区（GMT+8）"下建立**，之后才切到 GMT-8。

⚠️ Connector/J 在**连接建立时**会确定与时区相关的内部状态（`serverTimezone` 的处理），`lastlogin` 又是时间敏感字段。**池连接与 DriverManager 连接可能因此出现时区基准不一致** —— 而这正好会撞上项目里"日志时间 +16 小时"这类已经比较敏感的地方。

### 修法（改插入点）

```java
762        if (YamlConfig.config.server.SHUTDOWNHOOK) ...
763        TimeZone.setDefault(TimeZone.getTimeZone(YamlConfig.config.server.TIMEZONE));
764
765        DatabaseConnection.initPool();   // ← 改到这里：时区已就绪，且早于原来第一次 getConnection
766
767        Connection c = null;
768        try {
769            c = DatabaseConnection.getConnection();
```

**效果**：与修改前的时序**完全一致**（时区 → 建池 → 用连接），零行为差异。

---

## 三、🔴 坑 3：MySQL 重启后，头几个请求会失败一次（池化固有，接受）

### 实测（探针 `KillProbe`，从 MySQL 端 `KILL` 掉池里的连接，模拟 MySQL 停/重启）

```
【1】池借出连接 A, CONNECTION_ID = 923
【2】A 已归还池（此时它是好连接）
【3】已从 MySQL 端 KILL 923 -> 池里躺着一条死连接

--- 立即借（<500ms 内）---
   立即查询 -> 失败 CommunicationsException: Communications link failure   (耗时 3 ms)
--- 等 900ms 后再借 ---
   等待后查询 -> OK, 耗时 907 ms
--- 再来一次，确认池已恢复 ---
   再次查询 -> OK, 耗时 1 ms

池状态: active=0 idle=2 total=2 waiting=0
```

同时日志里出现：
```
警告: KillProbe-Pool - Connection com.mysql.jdbc.JDBC4Connection@593634ad
      marked as broken because of SQLSTATE(08S01), ErrorCode(0)
```

### 怎么理解这组数据

| 行为 | 结论 |
|---|---|
| ✅ **池能自愈** | Hikari 把坏连接**标记 broken 并丢弃**，随后自动重建；`idle=2` 说明它把 `minimumIdle` 补回来了 |
| ✅ 恢复很快 | 900ms 后借就是好的（那条 907ms 主要是我的 `sleep`） |
| ⚠️ **500ms 窗口内不验证** | Hikari 有个 `aliveBypassWindow`（500ms）：连接在 500ms 内被用过就**认为它还活着、直接借出**，不做校验 |
| ⚠️ **失败抛给业务方** | 这条坏连接被交出去后，**在 `executeQuery()` 时才炸**（`CommunicationsException`），不是 `getConnection()` 阶段 |

### 为什么这是"池化新引入的"

**DriverManager 模式每次都是全新连接 ⇒ 不可能借到一条死连接。**
池化后连接被反复复用 ⇒ "MySQL 重启导致池里的连接全死"变成一个新场景。

**影响**：单机下 MySQL 重启后，玩家**第一次操作（登录/存档）可能报一次错**，之后自动恢复。

### 处理

- **不改代码**（HikariCP 2.4.13 没有公开这个窗口的配置项，`aliveBypassWindowMs` 是内部常量）。
- **操作习惯上规避**：**先起 MySQL、再起服务端**；如果单独重启了 MySQL，**顺手也重启一下服务端**（或接受第一次操作失败一次）。
- 这一点要写进使用说明。

---

## 四、🟡 知情即可（不改代码）

### 坑 4：`RankingLoginTask` 是全项目最长的连接持有者

`RankingLoginTask.java`：

```java
private Connection con;                       // :39  字段持有（但每次 run 重新赋值）

public void run() {
    con = DatabaseConnection.getConnection();
    con.setAutoCommit(false);                 // :86  开事务
    if (USE_REFRESH_RANK_MOVE) { resetMoveRank(true); resetMoveRank(false); }   // 两次全表 UPDATE
    for (int j = 0; j < worldsSize; j++) {
        updateRanking(-1, j);                  // 全服总体排名
        for (int i = 0; i <= MapleJob.getMax(); i++) {
            updateRanking(i, j);               // 每个职业各来一遍，逐行 UPDATE
        }
        con.commit();
    }
    con.setAutoCommit(true);
    con.close();                               // :103
}
```

- 调度间隔：`config.yaml:180 RANKING_INTERVAL: 3600000` = **每小时一次**
- **当前规模实测无风险**：`inventoryitems` 仅 **97 行**、`characters` 更少（未进表行数前 12），事务耗时是毫秒级
- ⚠️ 但如果**以后角色数量涨到几百**，每小时会出现一次 `Apparent connection leak detected` 的**误报**
- **处置**：FIX 8 保持 15s；**若日志出现告警，先看是不是这个任务**（第二小时才出现的、带 `RankingLoginTask.run` 栈的告警 = 正常）

### 坑 5：`MapleCharacter` 里有一个跨 358 行的长事务

`MapleCharacter.java:8445` `setAutoCommit(false)` → `:8803` `setAutoCommit(true)`，注释写着
`// only commit after finishing all "con" usages, thanks Zygon`。单条连接持有整个存档流程。
单机数据少 ⇒ 快；背包/技能/任务很多时是 FIX 8 的**第二个潜在误报源**。

### 坑 6：Connector/J 5.1.6 **不支持 `networkTimeout`**

实测日志（启动时必然出现，**不是错误，别慌**）：

```
信息: KillProbe-Pool - Driver does not support get/set network timeout for connections.
      (com.mysql.jdbc.JDBC4Connection.getNetworkTimeout()I)
```

⇒ Hikari **无法强制中断"执行中卡住的 SQL"**。`connectionTimeout` 只管**借连接**阶段。
好消息：URL 里的 **`socketTimeout=15000` 池化后依然有效**（那是读超时），能兜住"查询卡住"的场景
—— 注意这跟 `connectTimeout` 不一样，那个池化后基本不再触发（见方案文档 §三 FIX 4 注）。

---

## 五、🟡 顺手纠正：清单里有 3 行"改动"其实等于没改

反汇编 `HikariConfig` 的 `static {}` 拿到默认值：

```
ldc2_w  // long 30l   ->  CONNECTION_TIMEOUT  (30 秒)
ldc2_w  // long 5l    ->  VALIDATION_TIMEOUT  (5 秒)
ldc2_w  // long 10l   ->  IDLE_TIMEOUT        (10 分钟)
ldc2_w  // long 30l   ->  MAX_LIFETIME        (30 分钟)
```

对照清单的代码：

| 清单里的行 | 设的值 | Hikari 默认值 | 是否产生行为变化 |
|---|---|---|---|
| `setValidationTimeout(5*1000)` (FIX 4c) | 5 s | **5 s** | ❌ 等于没改 |
| `setIdleTimeout(10*60*1000L)` (FIX 4d) | 10 min | **10 min** | ❌ 等于没改 |
| `setMaxLifetime(30*60*1000L)` (FIX 6) | 30 min | **30 min** | ❌ 等于没改 |
| `setConnectionTimeout(10*1000)` (FIX 4b) | 10 s | 30 s | ✅ **真改动** |
| `setMinimumIdle(min(4, poolSize))` (FIX 5) | 4 | `-1`（= maxPoolSize 10） | ✅ **真改动** |

**建议：保留这 3 行，但把注释改成"显式声明（与 Hikari 默认值相同）"** ——
好处是将来 Hikari 改默认值时行为不会漂移；坏处是别让人误以为它们带来了收益。**不要再把它们当成"优化项"宣传。**

> 附带纠正：原代码的 `setConnectionTimeout(30 * 1000)` 同样等于默认值 —— 也就是说**原作者那行也没起过作用**。

---

## 六、🟢 已排查、确认无风险（都有证据，别再重复怀疑）

| # | 怀疑项 | 结论 | 证据 |
|---|---|---|---|
| 1 | `LAST_INSERT_ID()` 跨请求残留 | ✅ **无** | 全项目 grep `LAST_INSERT_ID\|last_insert_id` **0 命中**。（池化后连接复用，这是最经典的坑——本项目恰好没用它） |
| 2 | 临时表 / 会话级锁残留 | ✅ **无** | grep `CREATE TEMPORARY\|TEMPORARY TABLE\|CREATE TABLE\|GET_LOCK\|RELEASE_LOCK` **0 命中** |
| 3 | `MapleHiredMerchant.java:33 import com.mysql.jdbc.Statement` | ✅ **虚惊** | 只用于引用常量 `Statement.RETURN_GENERATED_KEYS` —— 它是 `static final int`，**javac 编译期内联成字面量 `1`**，运行时不会加载驱动类、也没有任何强转。（换成 Hikari 的 `HikariProxyPreparedStatement` 完全不受影响） |
| 4 | Connection 被字段长期持有 → 池借空 + 泄漏告警 | ✅ **无** | 全项目只有 1 处字段：`RankingLoginTask.java:39 private Connection con;`，但它**每次 `run()` 都重新赋值**，且**正常路径 `:103 close()`、异常路径 `:110 close()` 都归还**。不是长期持有 |
| 5 | 类初始化循环依赖（`DatabaseConnection.static` ↔ `YamlConfig.static`） | ✅ **无** | `YamlConfig.java` 只有 `public static final YamlConfig config = fromFile("config.yaml")`，**没有 static 块、不引用 `DatabaseConnection`**；`Server.java` 的 `instance` 初始化为 null、无 static 块 ⇒ 单向依赖，不会死锁 |

---

## 七、给清单文档的具体修订建议（共 3 处）

| # | 位置 | 现状 | 建议改成 |
|---|---|---|---|
| 1 | `DatabaseConnection.java` 的 `static {}` | `static { initPool(); }` | `static { try { initPool(); } catch (Throwable t) { ds = null; ... } }` —— **静态块绝不外抛** |
| 2 | `Server.java` `init()` 的插入点 | `println` 之后（`:760`） | 移到 `TimeZone.setDefault(...)` **之后**（`:765`，原 `getConnection` 之前）—— **时区时序与现状一致** |
| 3 | 注释口径 | 把 `validationTimeout`/`idleTimeout`/`maxLifetime` 当"新增优化" | 改标"**显式声明，与 Hikari 默认值相同**" |

**其余（FIX 1/2/3/4b/5/7/8/9/10）保持不变，可以按原清单执行。**

---

## 八、探针与证据文件索引

| 文件 | 用途 |
|---|---|
| `D:\tmp\fixE-bench\KillProbe.java` / `run_kill.py` | 杀掉池内连接，验证自愈行为（本次核心实测） |
| `D:\tmp\fixE-bench\kill_result.txt` | 实测输出 |
| `D:\tmp\fixE-bench\probe_defaults.py` / `defaults.txt` | 反汇编取 Hikari 默认值 |
| `D:\tmp\fixE-bench\probe_params.py` / `probe_params2.py` | 三层超时归属（FIX 4 的依据） |
| `D:\tmp\fixE-bench\tables.txt` | 库表规模统计（评估长事务风险） |
