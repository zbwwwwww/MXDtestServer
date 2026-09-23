# 修复 E —— 让 HikariCP 连接池真正生效

> 状态：**✅ 已执行（2026-09-21 21:21~21:23）** —— 代码已改、两处部署目标已更新、真实环境预检全绿，**只差重启服务端生效**。
> 执行记录（含 `PoolLiveProbe` 实测输出、重启后核对表、回滚法）→ `修复E-方案A-待改代码清单.md` **§七**
> 日期：2026-09-21
> 影响文件：`src\tools\DatabaseConnection.java`（重写建池段）、`src\net\server\Server.java`（加 **2** 行）
> 📊 **配套文档**：`修复E-方案A-优缺点实测对比.md`（方案A 的实测收益/风险数据，本文§三的实施依据）
> 📝 **逐行对照**：`修复E-方案A-待改代码清单.md`（改前/改后完整文件 + 执行步骤，**以它为准**）

---

## 一、根因（已定位到具体代码）

`DatabaseConnection` 里建池的代码是**实例构造函数**：

```java
public DatabaseConnection() {          // DatabaseConnection.java:62
    ...
    if (YamlConfig.config.server.DB_CONNECTION_POOL) {
        ...
        ds = new HikariDataSource(config);   // :94
    }
}
```

而全项目搜 `new DatabaseConnection` —— **零次**。

调用方用的全是静态方法 `DatabaseConnection.getConnection()`（**206 处，分布在 48 个文件**）：

```java
private static HikariDataSource ds;    // 永远是 null

public static Connection getConnection() throws SQLException {
    if (ds != null) { ... }            // 永远进不去
    ... DriverManager.getConnection(...)   // 每次都走这条：新建 TCP + MySQL 握手
}
```

**结论**：`config.yaml:169` 的 `DB_CONNECTION_POOL: true` 形同虚设。每条 SQL 都在新建一条数据库连接，用完丢掉。

git 里只有一个 `init`（squash 导入）提交，**查不到是哪一版把调用删掉的**。上游 HeavenMS 把 DB 工具类改造成纯静态类时漏了这一步。

### 铁证（2026-09-21 补测，静态扫描 + 运行时反射）

**① 全项目 `DatabaseConnection` 的 255 处引用，逐条分类：**

| 出现形式 | 处数 | 会不会创建实例 |
|---|---|---|
| `import tools.DatabaseConnection;` | 47 | ❌ 只是告诉编译器类在哪 |
| `DatabaseConnection.getConnection()` | 206 | ❌ **静态方法调用，不需要实例** |
| 类声明 `public class DatabaseConnection {` | 1 | ❌ 只是定义 |
| 构造器定义 `public DatabaseConnection() {` | 1 | ❌ **定义 ≠ 调用** |
| **`new DatabaseConnection()`** | **0** | — |

全项目反射也已排查：7 处反射调用分别是 `Service.java:34`（`cls.getConstructor().newInstance()`）、
`XMLDomMapleData.java:49`、`EventManager.java:274`（一个同名业务方法）、`AutoJCE.java:27-29`、
以及 `DatabaseConnection.java:64` 的 `Class.forName("com.mysql.jdbc.Driver")` —— **没有任何一处指向 `DatabaseConnection`**。
⇒ 不存在"反射偷偷创建实例"的可能。

**② 运行时实证**（从服务端真正在跑的 jar 加载类，反射读私有静态字段 `ds`）：

```
加载的类来自: file:/D:/MXDtestServer/out/artifacts/HeavenMS_zhoubw_083_jar/HeavenMS-zhoubw_083.jar
【1】只做 Class.forName 之后：ds = null
【2】存在 <clinit>（静态初始化块）= false          ← 没有任何静态赋值代码
【3】调用 getConnection()：拿到 com.mysql.jdbc.JDBC4Connection，执行 SELECT 1 返回 1（连接完全可用）
【4】拿到活连接之后再读一次：ds = null              ← 铁证
【5】构造器只有一个：public tools.DatabaseConnection()
```

**刚成功拿到了可用的数据库连接，而 `ds` 依然是 `null`** —— 直接证明连接不是池给的，
`if (ds != null)` 分支永远为假，因为给它赋值的唯一代码在构造器里、构造器从未被执行。
（探针源码：`D:\tmp\fixE-bench\WhyNullProbe.java`，可重跑）

**③ 顺带发现的第二处死代码**：构造器里那行 `Class.forName("com.mysql.jdbc.Driver")`（注释 *touch the mysql driver*）
**也从未执行过**。驱动之所以还能用，是因为 `cores\mysql-connector-java-bin.jar` 内含
`META-INF/services/java.sql.Driver`（内容 `com.mysql.jdbc.Driver`），由 JDBC 4 的 ServiceLoader 自动注册。
⇒ 这行同样是死代码，删掉也不影响。

**④ 为什么这个 bug 能藏这么久**：`@author Ronan - some connection pool to this beautiful code` 说明池确实是他加的，
他大概只验证了"能不能连上"。而**池没生效和池生效，外在表现几乎一样**（都能拿到连接、都能正常跑 SQL），
只差 4 ms。这种"静默失效"没有报错、没有警告、功能全正常 —— 是最难发现的一类 bug。

---

## 二、依赖其实是齐的（不用装东西）

| 依赖 | 实际文件 | 结论 |
|---|---|---|
| 连接池 | `cores\HikariCP-java7-2.4.13.jar` | ✅ Java 7+，适配 JDK 8 |
| 日志 | `cores\slf4j-api-1.7.21.jar` + `slf4j-jdk14-1.7.5.jar` | ✅ HikariCP 的 slf4j 依赖在，不会 `NoClassDefFoundError` |
| 驱动 | `cores\mysql-connector-java-bin.jar` = **Connector/J 5.1.6**（2007 年） | ✅ 有 `com.mysql.jdbc.Driver` |

已用 `javap` 逐个确认要用到的 API 在 2.4.13 里都存在：
`setMaximumPoolSize` / `setMinimumIdle` / `setConnectionTimeout` / `setIdleTimeout` / `setMaxLifetime` /
`setLeakDetectionThreshold` / `setConnectionTestQuery` / `setPoolName` / `setValidationTimeout` / `addDataSourceProperty`

---

## 三、改法：9 处，把建池搬进静态初始化块

核心思路 —— **静态块在首次访问本类时由 JVM 自动执行，不可能再被"忘记调用"**，所以不需要在 `main()` 里加任何初始化调用。
>
> 📝 下面这段是**思路示意**；实际改法把建池逻辑抽成了幂等的 `initPool()`（为了兜住服务端重启），
> **完整改前/改后文件见 `修复E-方案A-待改代码清单.md` §2.2，以它为准。**

```java
private static HikariDataSource ds;

static {                                    // [FIX 1] 原来是 public DatabaseConnection()
    try { Class.forName("com.mysql.jdbc.Driver"); } catch (...) { ... }

    if (YamlConfig.config.server.DB_CONNECTION_POOL) {
        try {
            HikariConfig config = new HikariConfig();
            config.setJdbcUrl(...); config.setUsername(...); config.setPassword(...);

            int poolSize = (int) Math.ceil(0.00202020202 * getNumberOfAccounts() + 9.797979798);
            if (poolSize < 10) poolSize = 10; else if (poolSize > 30) poolSize = 30;

            config.setPoolName("HeavenMS-Pool");
            config.setConnectionTimeout(10 * 1000);        // [FIX 4] 原 30s
            config.setValidationTimeout(5 * 1000);
            config.setMaximumPoolSize(poolSize);
            config.setMinimumIdle(Math.min(4, poolSize));  // [FIX 5] 新增
            config.setIdleTimeout(10 * 60 * 1000L);
            config.setMaxLifetime(30 * 60 * 1000L);        // [FIX 6] 新增
            config.setConnectionTestQuery("SELECT 1");     // [FIX 7] 新增
            config.setLeakDetectionThreshold(15 * 1000L);  // [FIX 8] 新增

            config.addDataSourceProperty("cachePrepStmts", true);
            config.addDataSourceProperty("prepStmtCacheSize", 25);
            config.addDataSourceProperty("prepStmtCacheSqlLimit", 2048);

            ds = new HikariDataSource(config);
            System.out.println("[DB] HikariCP connection pool started. pool size " + poolSize + ".");
        } catch (Throwable t) {                            // [FIX 3] 兜底
            ds = null;                                     //   退回改之前的行为，不拖垮启动
            System.out.println("[SEVERE] HikariCP pool failed to start, falling back to one connection per query. Reason: " + t.getMessage());
            t.printStackTrace();
        }
    }
}
```

### 改动清单

| # | 改动 | 为什么 |
|---|---|---|
| FIX 1 | `static {}` 替代实例构造函数建池 | 根治"没人调用" |
| FIX 2 | `getConnection()` 里池借不到连接时**明确报警** | 原代码 `printStackTrace()` 之后静默退回 `DriverManager`，池被借空这件事完全看不见 |
| FIX 3 | 建池失败 → `[SEVERE]` 日志 + `ds = null` | MySQL 没起时服务端照样能启动，行为不比现在差 |
| FIX 4 | `connectionTimeout` 30s → 10s | 借不到连接会把请求线程挂死半分钟 |
| FIX 5 | 新增 `minimumIdle = Math.min(4, poolSize)` | 原代码没设 → Hikari 默认 `minimumIdle = maximumPoolSize`，等于启动就建满 10 条 |
| FIX 6 | 新增 `maxLifetime = 30min` | 主动淘汰旧连接，别用到一半被 MySQL 的 `wait_timeout` 掐断 |
| FIX 7 | 新增 `connectionTestQuery = "SELECT 1"` | **Connector/J 5.1.6 太老，JDBC4 的 `isValid()` 不可靠**；显式给校验语句，绕开 `isValid()` |
| FIX 8 | 新增 `leakDetectionThreshold = 15s` | 借出超过 15s 没还就写日志（带申请连接的调用栈）—— 把"哪段代码漏关连接"从猜变成能看见 |

> ⚠️ **FIX 8 的硬约束（2026-09-21 实测补充）**：`leakDetectionThreshold` 必须落在 **`[2000 ms, maxLifetime)`** 区间内，
> 否则 Hikari **不报错、而是静默禁用它**，只在启动时打一条警告：
> `leakDetectionThreshold is less than 2000ms or more than maxLifetime, disabling it.`
> 另外 `[2000, 15000)` 之间是 Hikari 明确不建议的区间，**容易把正常的长操作误报成泄漏**。
> 所以 **15s 是合法且推荐的下限值，以后不要往下调**（调成 1000ms 等于没开检测）。
> 实测佐证见 `修复E-方案A-优缺点实测对比.md` §6.4。

> 📌 **FIX 4 为什么必须写在 Java 里，不能挪进 `config.yaml` 的 DB_URL（2026-09-21 反汇编补充）**
>
> `config.yaml:165` 里其实**已经有** `connectTimeout=5000&socketTimeout=15000&autoReconnect=true`，但它们和池层的
> `connectionTimeout` **不是一回事，也不可能互相替代**：
>
> | 参数 | 归属 | 管什么 | 生效点（反汇编确证） |
> |---|---|---|---|
> | `connectTimeout=5000` | Connector/J **驱动** | **TCP 建连**（socket connect） | `com.mysql.jdbc.StandardSocketFactory`（常量池含 `connectTimeout`、异常文本 `Can't specify "connectTimeout" on JVMs older than 1.4`） |
> | `socketTimeout=15000` | Connector/J **驱动** | **读数据**超时 | `com.mysql.jdbc.MysqlIO` 的 `Socket.setSoTimeout(I)` |
> | `connectionTimeout=10s` | HikariCP **池** | **从池里借一条连接最多等多久** | `HikariPool.getConnection()` → `getConnection(connectionTimeout)` → `createTimeoutException()`（常量池含 `Timeout failure`） |
>
> **关键点**：池生效后连接是复用的，正常路径**根本不新建 TCP** ⇒ URL 里那两个驱动参数**基本不再被触发**。
> 而"池里没空闲连接、要排队等多久"这件事，**URL 里没有任何参数可写** —— 驱动层根本不知道"池"的存在
> （`parseURL` 只认它自己的属性，池是驱动的**上游**）。所以 FIX 4 只能改在 Java 侧。
> 反汇编脚本：`D:\tmp\fixE-bench\probe_params.py` / `probe_params2.py`，输出 `param_out.txt` / `param_out2.txt`。
>
> ⚠️ **顺带挖出的连带副作用**：`PoolBase.setLoginTimeout(DataSource)`（字节码 `:1214~1242`）在建池时执行
> `dataSource.setLoginTimeout(Math.max(1, (int)TimeUnit.MILLISECONDS.toSeconds(500 + connectionTimeout)))`，
> 而 `DriverDataSource.setLoginTimeout(int)` 的实现只有一句 **`DriverManager.setLoginTimeout(int)` —— 全局静态**。
> ⇒ `connectionTimeout = 10000` 会顺带把**整个 JVM 的 DriverManager 登录超时设成 10 秒**
> （`(10000+500)/1000 = 10`），连带影响 `getNumberOfAccounts()` 和池借空后的 fallback 路径。
> 现在是"池没生效 ⇒ 这方法从没执行过 ⇒ loginTimeout 还是默认 0 = 无上限"。
> **判断：是好事**（本来可能挂更久），但属于附带的行为变化，必须知道。本机只有一个数据源，无冲突风险。
> 另注：`setConnectionTimeout` 有硬约束 —— **小于 250ms 直接抛 `IllegalArgumentException`**（`HikariConfig` 字节码确证）。
| FIX 9 | 新增 `public static synchronized void initPool()`（幂等建池） + `closePool()`（关服收池） | 建池逻辑独立出来，让重启路径能重建 |
| FIX 10 | `Server.init()` 开头调 `initPool()`；`Server.shutdownInternal()` 收尾调 `closePool()` | ⚠️ 见下方说明 —— **必须 2 行，不是 1 行** |

`Server.java` 加 **2** 行：

```java
// ① init() 开头（:758 println 之后）
DatabaseConnection.initPool();      // ← 新增。幂等：首发时空转（静态块已建好），重启时负责重建

// ② shutdownInternal() 收尾（acceptor = null; 之后）
DatabaseConnection.closePool();     // ← 新增。关服收池
if (!restart) { ... System.exit(0); }
```

> ⚠️ **为什么是 2 行而不是 1 行（2026-09-21 复查发现）**：
> `Server.java:767` 就是 `DatabaseConnection.getConnection()`，它会触发静态块建池 —— 所以**首次启动没问题**。
> 但服务端重启走的是 `:1782 getInstance().init()`，这只是**在同一台 JVM 里重跑一遍 init()**：
> **类不会重新加载，静态块也一辈子只执行一次**。
> 于是如果 `closePool()` 把 `ds` 置了 null、而 `init()` 里不显式重建，**重启后 `ds` 永远是 null** ——
> 退化成一模一样的静默失效，还白改一轮。
> 所以 `initPool()` 必须**幂等**（`ds != null` 就 return），并由 `init()` 显式调用一次兜住重启。
> 另外 `closePool()` 放在 `if (!restart)` **外面**（重启也收）：关服不留残留，重启则由紧接着的 `init()` 重建，全程无窗口。

---

## 四、必须先说的风险：175 处老代码漏关连接

全项目连接获取点统计：

| 写法 | 处数 | 说明 |
|---|---|---|
| `try (Connection con = ...)` 自动关闭 | **31** | 安全 |
| `Connection con = ...; ... con.close();` 裸写法 | **175** | **中间任何一步抛异常，`con.close()` 就到不了，连接漏掉** |

高频文件：`MapleCharacter.java` 38 处（7 处安全）、`MapleClient.java` 23 处（0）、`MTSHandler.java` 12 处（0）、`DueyProcessor.java` 9 处（0）。

**为什么现在没炸**：DriverManager 模式下每条连接都是新建的，漏掉就没引用，MySQL 那边等到超时才回收，你感觉不到。

**池生效后会怎样**：泄漏的连接不还给池 → 池里只有 10 条 → 借空之后请求拿不到池连接。

> ✅ **2026-09-21 实测更正（好消息）**：借空时抛的是 `java.sql.SQLTransientConnectionException`，
> 它是 **`SQLException` 的子类**，会被 `getConnection()` 现有的 `catch (SQLException)` 接住，
> 然后**自动退回 `DriverManager` 单连接模式**。
> 所以真实后果是「**降级**」而不是「**整个服务端卡住**」——本文原先写得偏严重。
> 但代价是：池形同虚设 + **该请求线程要挂到 `connectionTimeout`（10s）才抛异常** + 日志狂刷。
> 实测细节见 `修复E-方案A-优缺点实测对比.md` §6.1。

> ⚠️ **池化新引入的失败模式**：嵌套借连接（如 `MapleStorage` 一次要 2 条）在池只有 10 条、
> 且 10 个线程同时各持 1 条等第 2 条时会**集体互相等待**到超时。DriverManager 模式下不存在此问题。
> 单机单人玩触发概率很低，但**多开/联机时会第一个咬人**。见实测对比文档 §6.2。

实际例子（`MapleStorage.java:81`）：

```java
public static MapleStorage loadOrCreateFromDB(int id, int world) {
    Connection con = DatabaseConnection.getConnection();     // ← 借出去
    PreparedStatement ps = con.prepareStatement("SELECT ...");
    ResultSet rs = ps.executeQuery();
    if (rs.next()) {
        ret = new MapleStorage(...);
        for (Pair<Item, MapleInventoryType> item : ItemFactory.STORAGE.loadItems(ret.id, false)) {  // ← 内部再借一条！
            ...
        }
    } else {
        ret = create(id, world);      // ← 这里也再借一条，而且 create() 内部还会递归回本方法
    }
    rs.close(); ps.close(); con.close();   // ← 前面任何一处抛异常，这行都到不了
    return ret;
}
```

这一段一次要占 **2 条连接**，而且异常路径必漏。

### 建议的处理顺序：先上池 + 泄漏检测，**别急着改 175 处**

1. `leakDetectionThreshold` 会把真实泄漏的调用栈打进日志 —— 先看你实际玩的时候到底漏不漏、漏在哪几处
2. 盲改 175 处 = 大范围动老代码，**引入回归的风险比问题本身大**
3. 真抓出来，大概率集中在几个高频入口，精准修十几处就够

### ★ 已精准修掉第 1 处：`MapleGuild.<init>`（2026-09-21 23:42，第 1 个真实命中）

`leakDetectionThreshold` 上线后立刻抓到了第一条真实告警（用户关闭客户端时复现）：

```
警告: Connection leak detection triggered for com.mysql.jdbc.JDBC4Connection@22a71081
  at tools.DatabaseConnection.getConnection(DatabaseConnection.java:110)
  at net.server.guild.MapleGuild.<init>(MapleGuild.java:75)          ← 借出点
  at net.server.Server.getGuild(Server.java:1015)
  at client.MapleCharacter.getGuild(MapleCharacter.java:5145)
  at client.MapleClient.disconnectInternal(MapleClient.java:974)
```

**根因**：`src\net\server\guild\MapleGuild.java` 构造器里有两个**早退分支**，`return` 前都没还连接：

| 行 | 分支 | 原代码 | 问题 |
|---|---|---|---|
| `:78-83` | 公会不存在（`!rs.first()`） | `id = -1; ps.close(); rs.close(); return;` | ❌ 无 `con.close()` |
| `:104-108` | 公会查不到成员 | `rs.close(); ps.close(); return;` | ❌ 无 `con.close()` |
| `:115` | 正常走完 | `... con.close();` | ✅ 只有这条关了 |

⇒ 触发条件正是**关闭客户端时的公会加载**，公会字段为空/公会无成员即命中；漏掉的连接要等 **15s** 才被 HikariCP 超时回收。（本次为**良性**：每次只漏 1 条、且有兜底回收）

**修法（比"补两行 close()"更稳）**：改成 **try-with-resources**，让正常结束 / `return` / 抛异常**三条出口**都自动归还：

```java
// 改前
Connection con = null;
try {
    con = DatabaseConnection.getConnection();
    ...
    con.close();               // 只有正常路径能到
} catch (SQLException se) { ... }

// 改后
try (Connection con = DatabaseConnection.getConnection()) {
    ...
    // 原 :115 的 con.close() 已删除（try-with-resources 自动关，避免重复）
} catch (SQLException se) { ... }
```

**部署**：`out\production\SERVER083`（IDEA 加载份）+ jar 双目标已刷新；jar 条目 **2029 → 2029 未变**。⚠️ 需**重启服务端**才生效。

> 剩下 **174** 处裸 `close()` 仍未动 —— 按上面"处理顺序"，继续等日志精准指路，不做盲改。

---

## 五、验证方式

### 已做（MySQL 没起也能做）

| 项 | 结果 |
|---|---|
| 方案预览版能否编译 | ✅ `javac -encoding UTF-8` + `-cp cores\*` + JDK 8，无 error（`D:\tmp\fixE-preview\`） |
| 静态块是否被自动触发 | ✅ `Class.forName("tools.DatabaseConnection")` 就触发了建池 |
| 池建不起来时服务端会不会崩 | ✅ 不崩。日志：`[SEVERE] HikariCP pool failed to start, falling back to one connection per query.` |

### 已做（2026-09-21 上午，MySQL 在线补充实测）

用服务端同款 jar（Connector/J 5.1.6 + HikariCP 2.4.13）在 `D:\tmp\fixE-bench\` 跑了 4 个探针，**全部只读**：

| 项 | 结果 |
|---|---|
| 单次 DB 操作耗时 | 现状 **4.31 ms** → 方案A **0.10 ms**（**42 倍**）；真实查 characters 表 4.05 → 0.21 ms |
| 耗时抖动 | P95 **5.58 ms → 0.13 ms**（抖动被抹平，这是玩家唯一能体感到的部分） |
| 池借空会怎样 | ✅ 抛 `SQLTransientConnectionException`（**是 SQLException 子类**）→ 被现有 catch 接住 → 自动退回 DriverManager，**降级不卡死** |
| 泄漏告警能否真打出 | ✅ 能，含**借用点完整调用栈**：`Apparent connection leak detected at ...` |
| `leakDetectionThreshold` 合法区间 | ⚠️ **必须 ∈ [2000ms, maxLifetime)**，否则**静默禁用**（详见 FIX 8 注） |
| 连接归还是否重置会话状态 | ✅ Hikari **会重置** autoCommit 与 transactionIsolation；且全项目无 `SET NAMES/SESSION/@@`/用户变量，**风险排除** |
| 空转基线（修复前） | 120 秒内新建 **3 条**连接、执行 15 条 SQL；MySQL `Max_used_connections=3` |

→ 完整数据与结论见 `修复E-方案A-优缺点实测对比.md`

### 待做（MySQL 已起来，现在就能验）

- 池真建起来后，对比「每条 SQL 新建连接」与「连接复用」的耗时
- 观察启动日志出现 `HeavenMS-Pool - Starting...`（这就是池生效的标志）
- 玩一轮，检查日志有没有 `Connection leak detection` 告警

⚠️ 现在跑着的服务端（PID 16320）载入的是**旧 jar，池还没生效**。改完要重新打包时，**必须先停服务端**——jar 被 JVM 当 classpath 打开着，一边跑一边 `jar uf` 会写坏或写不进去。

### 两个实测发现

- **HikariCP 的日志走 slf4j → `slf4j-jdk14` → JUL，直接打在控制台**，中文 locale 下显示成「信息 / 严重」。启动时会看到 `HeavenMS-Pool - Starting...`，很好确认池有没有生效。
- `DB_URL` 里的 `autoReconnect=true` 让 Connector/J 自己重试 3 次，**实测一次失败要等约 18 秒**（10s connectionTimeout + 重试）。池接管后这条参数已经没用。建议**先别动**（避免和编码参数一起引入副作用），单独一轮再评估。

---

## 六、当前环境状态（动手前要知道）

> 08:03 复查后更正：MySQL 与服务端**都已经在跑**。

| 项 | 状态 |
|---|---|
| MySQL（3306） | ✅ 在跑，PID 19180，监听 `0.0.0.0:3306` + `[::]:3306` |
| 服务端（8484 / 7575） | ✅ 在跑，PID 16320（内存约 131 MB），两个端口都已 LISTENING |
| 备份 | 打包前会做 `saves\HeavenMS-zhoubw_083.jar.bak-YYYYMMDD` |

### MySQL 5.7 起停命令（本机已核实）

MySQL 在本机装成 **Windows 服务**，服务名 **`MySQL57`**，启动类型是**手动**（`DEMAND_START`，开机不自启）：

```
服务名   : MySQL57
可执行   : "C:\Program Files\MySQL\MySQL Server 5.7\bin\mysqld.exe"
配置文件 : --defaults-file="C:\ProgramData\MySQL\MySQL Server 5.7\my.ini"
数据目录 : C:/ProgramData/MySQL/MySQL Server 5.7/Data
端口     : 3306      max_connections: 151
运行账户 : NT AUTHORITY\NetworkService
```

**都要用管理员身份的 CMD / PowerShell：**

```bat
:: 启动
net start MySQL57

:: 停止
net stop MySQL57

:: 看状态
sc query MySQL57
```

`sc start MySQL57` / `sc stop MySQL57` 等价。也可以 `Win+R` → `services.msc` → 找 `MySQL57` 点「启动」。

想让它开机自动起（**属于改动系统配置，需要你确认后我才会动**）：

```bat
sc config MySQL57 start= auto
```

注意 `start=` 后面**必须有一个空格**，`auto` 才是有效值。

⚠️ **MySQL 服务在跑 ≠ 能连上**：服务「已启动」不代表端口一定在监听（初始化失败时服务会自己停）。判断能不能连，用这个最直接：

```bat
mysql.exe -u zhoubw -p040211 -e "SELECT 1"
```

（`mysql.exe` 在 `C:\Program Files\MySQL\MySQL Server 5.7\bin\`）

---

## 七、不碰的东西（明确划边界）

- 不改 `DB_URL` 的编码相关参数（现在能正常存中文名，不冒险）
- 不改 `getNumberOfAccounts()` 的语义（它用 `DriverManager` 是**故意的**：池还没建好，不能递归调自己）
- 不动 `DB_CONNECTION_POOL: false` 的开关语义（关掉就该退回单连接模式）
- 不顺手重构那 175 处（单独一轮，等日志指路）
