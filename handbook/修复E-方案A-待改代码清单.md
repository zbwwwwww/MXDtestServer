# 修复 E · 方案 A —— 待改代码清单（改前 / 改后对照）

> 状态：**✅ 已执行（2026-09-21 21:21~21:23），两处部署目标均已更新，只差重启服务端生效**。执行记录见 **§七**。
> 日期：2026-09-21
> 影响文件：**2 个**，共 **3 处**改动
> - `src\tools\DatabaseConnection.java` —— 重写建池段（1 处）
> - `src\net\server\Server.java` —— 加 2 行（`init()` 1 行 + `shutdownInternal()` 1 行）
> 配套：`修复E-方案A-优缺点实测对比.md`（收益/风险数据）、`修复E-HikariCP连接池方案.md`（机制与根因）

---

## 〇、总览

| 文件 | 位置 | 改动 | 性质 |
|---|---|---|---|
| `DatabaseConnection.java` | `:62` `public DatabaseConnection()` | 改成 `static{}` + 拆出 `initPool()` | 结构性（根治） |
| `DatabaseConnection.java` | `:70` `ds = null;` | 删掉（改由 `initPool()` 起点的 `if (ds != null) return;` 承担） | 清理 |
| `DatabaseConnection.java` | `:25` `catch` 里 `printStackTrace()` | 改成写 `SqlExceptions.txt` 日志 | 可观测性 |
| `DatabaseConnection.java` | `:87~94` config 段 | 补 5 个参数 + 1 个兜底 try/catch | 稳定性 |
| `DatabaseConnection.java` | 类末尾 | 新增 `initPool()` / `closePool()` 两个方法 | 新增 |
| `Server.java` | `:758` 之后 | 加 `DatabaseConnection.initPool();` | 新增 1 行 |
| `Server.java` | `:1765` 之后 | 加 `DatabaseConnection.closePool();` | 新增 1 行 |

**不改**：`getConnection()` 的 `while(true)` 重试逻辑、`getNumberOfAccounts()`、`import`（`HikariConfig`/`HikariDataSource` 已在）、`config.yaml`、`DB_URL` 参数。

---

## 一、⚠️ 先说一个必须处理的坑（决定 `Server.java` 要改 2 行而不是 1 行）

`Server.java:757` 的 `init()` 里，**第 767 行就是 `DatabaseConnection.getConnection()`**：

```java
public void init() {
    System.out.println("HeavenMS v" + ServerConstants.VERSION + " starting up.\r\n");
    ...
    Connection c = null;
    try {
        c = DatabaseConnection.getConnection();     // ← :767 这里就会触发 DatabaseConnection 的静态块
```

这会带来两个后果：

1. **好的方面**：静态块在 `init()` 的第 767 行就被触发了，**建池时机早于所有业务逻辑**，不用担心 "池还没好就被用"。
2. **⚠️ 危险的方面**：服务端重启走的是 `Server.java:1782` 的 `getInstance().init()` —— **同一台 JVM 内重新跑一遍 init()，但 `DatabaseConnection` 这个类不会被卸载也不会重新加载**，所以：

   > **静态块一辈子只执行一次。重启后它不会再跑，池就永远建不回来了。**

   而这正是原方案 `Server.java` 只加 1 行的隐患：如果关服时把池关了（`ds = null`），重启后 `ds` 永远是 null，**退化成"没有池"的静默状态** —— 和我们一开始要修的 bug 一模一样，还多赔了一次改动。

**解法**（就是多出来的那 1 行）：

- 建池逻辑从静态块里抽成独立的 `public static synchronized void initPool()`，**带幂等保护**（`ds != null` 就直接 return）；
- 静态块只负责**调一次** `initPool()`；
- 在 `Server.init()` 开头**再显式调一次** `initPool()` —— 首次启动时它是空转（静态块已经建好了），重启时它负责**重建**。

这样静态块解决"没人调用"，显式调用解决"只执行一次"，两边都堵上了。

---

## 二、文件 1：`src\tools\DatabaseConnection.java`

### 2.1 改前（现状，97 行完整对照）

```java
package tools;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.DriverManager;
import java.sql.SQLException;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import config.YamlConfig;

/**
 * @author Frz (Big Daddy)
 * @author The Real Spookster - some modifications to this beautiful code
 * @author Ronan - some connection pool to this beautiful code
 */
public class DatabaseConnection {
    private static HikariDataSource ds;                                  // ← 永远是 null

    public static Connection getConnection() throws SQLException {
        if(ds != null) {                                                 // ← 永远进不去
            try {
                return ds.getConnection();
            } catch (SQLException sqle) {
                sqle.printStackTrace();                                  // ← 静默
            }
        }

        int denies = 0;
        while(true) {   // There is no way it can pass with a null out of here?
            try {
                return DriverManager.getConnection(YamlConfig.config.server.DB_URL, YamlConfig.config.server.DB_USER, YamlConfig.config.server.DB_PASS);
            } catch (SQLException sqle) {
                denies++;

                if(denies == 3) {
                    // Give up, throw exception. Nothing good will come from this.
                    FilePrinter.printError(FilePrinter.SQL_EXCEPTION, "SQL Driver refused to give a connection after " + denies + " tries. Problem: " + sqle.getMessage());
                    throw sqle;
                }
            }
        }
    }

    private static int getNumberOfAccounts() {                           // ← 不动
        try {
            Connection con = DriverManager.getConnection(YamlConfig.config.server.DB_URL, YamlConfig.config.server.DB_USER, YamlConfig.config.server.DB_PASS);
            try (PreparedStatement ps = con.prepareStatement("SELECT count(*) FROM accounts")) {
                try (ResultSet rs = ps.executeQuery()) {
                    rs.next();
                    return rs.getInt(1);
                }
            } finally {
                con.close();
            }
        } catch(SQLException sqle) {
            return 20;
        }
    }

    public DatabaseConnection() {                                        // ← :62 没人 new，从不执行
        try {
            Class.forName("com.mysql.jdbc.Driver"); // touch the mysql driver
        } catch (ClassNotFoundException e) {
            System.out.println("[SEVERE] SQL Driver Not Found. Consider death by clams.");
            e.printStackTrace();
        }

        ds = null;                                                       // ← :70

        if(YamlConfig.config.server.DB_CONNECTION_POOL) {
            // Connection Pool on database ftw!

            HikariConfig config = new HikariConfig();
            config.setJdbcUrl(YamlConfig.config.server.DB_URL);

            config.setUsername(YamlConfig.config.server.DB_USER);
            config.setPassword(YamlConfig.config.server.DB_PASS);

            // Make sure pool size is comfortable for the worst case scenario.
            // Under 100 accounts? Make it 10. Over 10000 accounts? Make it 30.
            int poolSize = (int)Math.ceil(0.00202020202 * getNumberOfAccounts() + 9.797979798);
            if(poolSize < 10) poolSize = 10;
            else if(poolSize > 30) poolSize = 30;

            config.setConnectionTimeout(30 * 1000);
            config.setMaximumPoolSize(poolSize);

            config.addDataSourceProperty("cachePrepStmts", true);
            config.addDataSourceProperty("prepStmtCacheSize", 25);
            config.addDataSourceProperty("prepStmtCacheSqlLimit", 2048);

            ds = new HikariDataSource(config);
        }
    }
}
```

### 2.2 改后（完整新文件，共 8 处标注）

```java
package tools;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.DriverManager;
import java.sql.SQLException;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import config.YamlConfig;

/**
 * @author Frz (Big Daddy)
 * @author The Real Spookster - some modifications to this beautiful code
 * @author Ronan - some connection pool to this beautiful code
 */
public class DatabaseConnection {
    private static HikariDataSource ds;

    // [FIX 1] 原来是 public DatabaseConnection()。
    // 静态块由 JVM 在"首次访问本类"时自动执行 —— 不可能再被忘记调用。
    // ⚠️ 复审修订①：静态块抛出的异常会被 JVM 永久记住（之后任何访问本类都直接 NoClassDefFoundError），
    //    所以必须保证它「永不外抛」—— 最坏也只是 ds = null、退回 DriverManager，绝不比现状差。
    static {
        try {
            initPool();
        } catch (Throwable t) {
            ds = null;
            System.out.println("[SEVERE] DatabaseConnection static initializer failed, falling back to one connection per query. Reason: " + t.getMessage());
            t.printStackTrace();
        }
    }

    /**
     * [FIX 9] 幂等建池。static 块调用它；Server.init() 也调用它。
     * 必须幂等，因为静态块一辈子只跑一次，而服务端重启走的是同一台 JVM 里重新 init()。
     */
    public static synchronized void initPool() {
        if (ds != null) return;                              // 已经建好 —— 直接返回
        if (!YamlConfig.config.server.DB_CONNECTION_POOL) return;

        try {
            Class.forName("com.mysql.jdbc.Driver"); // touch the mysql driver
        } catch (ClassNotFoundException e) {
            System.out.println("[SEVERE] SQL Driver Not Found. Consider death by clams.");
            e.printStackTrace();
        }

        try {
            HikariConfig config = new HikariConfig();
            config.setJdbcUrl(YamlConfig.config.server.DB_URL);
            config.setUsername(YamlConfig.config.server.DB_USER);
            config.setPassword(YamlConfig.config.server.DB_PASS);

            // Make sure pool size is comfortable for the worst case scenario.
            // Under 100 accounts? Make it 10. Over 10000 accounts? Make it 30.
            int poolSize = (int)Math.ceil(0.00202020202 * getNumberOfAccounts() + 9.797979798);
            if(poolSize < 10) poolSize = 10;
            else if(poolSize > 30) poolSize = 30;

            config.setPoolName("HeavenMS-Pool");                 // [FIX 4a] 日志里一眼认出是谁
            config.setConnectionTimeout(10 * 1000);              // [FIX 4b] ★真改动：原 30s，借不到别挂死半分钟
            config.setValidationTimeout(5 * 1000);               // [FIX 4c] ⚠️= Hikari 默认值，仅显式声明
            config.setMaximumPoolSize(poolSize);
            config.setMinimumIdle(Math.min(4, poolSize));        // [FIX 5] ★真改动：原代码没设，默认=最大池
            config.setIdleTimeout(10 * 60 * 1000L);              // [FIX 4d] ⚠️= Hikari 默认值，仅显式声明
            config.setMaxLifetime(30 * 60 * 1000L);              // [FIX 6]  ⚠️= Hikari 默认值，仅显式声明
            config.setConnectionTestQuery("SELECT 1");           // [FIX 7] 新增，5.1.6 的 isValid() 不可靠
            config.setLeakDetectionThreshold(15 * 1000L);        // [FIX 8] 新增，借出超 15s 未还就打调用栈

            config.addDataSourceProperty("cachePrepStmts", true);
            config.addDataSourceProperty("prepStmtCacheSize", 25);
            config.addDataSourceProperty("prepStmtCacheSqlLimit", 2048);

            ds = new HikariDataSource(config);
            System.out.println("[DB] HikariCP connection pool started. pool size " + poolSize + ".");
        } catch (Throwable t) {                                  // [FIX 3] 兜底：建池失败也不能拖垮启动
            ds = null;                                           //   退回改之前的行为
            System.out.println("[SEVERE] HikariCP pool failed to start, falling back to one connection per query. Reason: " + t.getMessage());
            t.printStackTrace();
        }
    }

    /** [FIX 9] 关服收池，避免 Hikari 管家线程与连接残留。 */
    public static synchronized void closePool() {
        HikariDataSource pool = ds;
        ds = null;                       // 先断引用：之后来的请求直接退回 DriverManager，
                                         // 不会拿到一个正在关闭的池
        if (pool != null) {
            pool.close();
            System.out.println("[DB] HikariCP connection pool closed.");
        }
    }

    public static Connection getConnection() throws SQLException {
        if(ds != null) {
            try {
                return ds.getConnection();
            } catch (SQLException sqle) {
                // [FIX 2] 原来是无声的 sqle.printStackTrace()。
                // 池借不到连接（多半是借空了 / 池已关）必须留痕 —— 否则会静默退回单连接模式，
                // 外在表现和"池正常工作"几乎一样（只差几毫秒），根本发现不了。
                FilePrinter.printError(FilePrinter.SQL_EXCEPTION,
                        "Connection pool refused to lend a connection (" + sqle.getClass().getSimpleName()
                        + "): " + sqle.getMessage() + " -- falling back to a brand new connection.");
            }
        }

        int denies = 0;
        while(true) {   // There is no way it can pass with a null out of here?
            try {
                return DriverManager.getConnection(YamlConfig.config.server.DB_URL, YamlConfig.config.server.DB_USER, YamlConfig.config.server.DB_PASS);
            } catch (SQLException sqle) {
                denies++;

                if(denies == 3) {
                    // Give up, throw exception. Nothing good will come from this.
                    FilePrinter.printError(FilePrinter.SQL_EXCEPTION, "SQL Driver refused to give a connection after " + denies + " tries. Problem: " + sqle.getMessage());
                    throw sqle;
                }
            }
        }
    }

    private static int getNumberOfAccounts() {   // 原样不动（它必须用 DriverManager：池还没建好，不能递归调自己）
        try {
            Connection con = DriverManager.getConnection(YamlConfig.config.server.DB_URL, YamlConfig.config.server.DB_USER, YamlConfig.config.server.DB_PASS);
            try (PreparedStatement ps = con.prepareStatement("SELECT count(*) FROM accounts")) {
                try (ResultSet rs = ps.executeQuery()) {
                    rs.next();
                    return rs.getInt(1);
                }
            } finally {
                con.close();
            }
        } catch(SQLException sqle) {
            return 20;
        }
    }
}
```

### 2.3 逐处说明

| 标注 | 改动 | 为什么 |
|---|---|---|
| **FIX 1** | `public DatabaseConnection()` → `static { initPool(); }` | **根治**。构造器要人 `new` 才会跑，全项目 0 处 `new`；静态块由 JVM 自动执行 |
| **FIX 2** | `catch` 里 `printStackTrace()` → `FilePrinter.printError(...)` | 池借空后原来**没有任何痕迹**，日志里看不出池已经废了 |
| **FIX 3** | 建池整段包 `try/catch(Throwable)` → 失败则 `ds = null` + `[SEVERE]` | MySQL 没起时服务端照样能启动，**不比现在差** |
| **FIX 4** | ✅ **真改动**：`connectionTimeout` 30s→**10s**、加 `poolName`；⚠️ `validationTimeout` / `idleTimeout` **与 Hikari 默认值相同**（反汇编证实），只是显式声明 | 借不到连接会把请求线程挂死半分钟；`poolName` 让日志可辨 |
| **FIX 5** | 新增 `minimumIdle = Math.min(4, poolSize)` | 原代码没设 ⇒ Hikari 默认 `minimumIdle = maximumPoolSize`，**启动瞬间就建满 10 条** |
| **FIX 6** | 新增 `maxLifetime = 30min`（⚠️ **与 Hikari 默认值相同**，反汇编证实；保留只为"将来默认值若变化时行为不漂移"） | 主动淘汰旧连接，别用到一半被 MySQL `wait_timeout` 掐断 |
| **FIX 7** | 新增 `connectionTestQuery = "SELECT 1"` | **Connector/J 5.1.6（2007 年）的 `isValid()` 不可靠**，显式给校验语句绕开它 |
| **FIX 8** | 新增 `leakDetectionThreshold = 15s` | 借出超 15s 未还 → 日志里打出**借用点的完整调用栈**（`MapleStorage.java:81` 这种）。这是"别盲改 175 处"的依据 |
| **FIX 9** | 新增 `initPool()` / `closePool()` | 幂等建池（兜住重启）、关服收池 |

> ⚠️ **FIX 8 的硬约束（实测）**：`leakDetectionThreshold` 必须落在 `[2000ms, maxLifetime)` 之间，否则 Hikari **不报错、直接静默禁用**，只在启动时打一条警告。`[2000, 15000)` 是官方不建议的区间（容易误报正常长操作）。**15s 是合法且推荐的下限，以后不要往下调。**
>
> 📌 **FIX 4 为什么不能改在 `config.yaml` 的 DB_URL 里（2026-09-21 反汇编确证）**
> `DB_URL` 里已经有 `connectTimeout=5000&socketTimeout=15000`，但那是**驱动层**参数（TCP 建连 / 读数据），
> 和池层的 `connectionTimeout`（**借一条连接最多等多久**）是三个不同层次，不能互相替代：
> - 池生效后连接复用，正常**不新建 TCP** ⇒ URL 那两个参数**基本不再触发**；
> - 而"池里没空闲连接要等多久"这件事，**URL 里没有参数可写** —— 驱动不知道"池"的存在。
>
> ⚠️ **连带副作用（必须知道）**：`PoolBase.setLoginTimeout()` 在建池时会调
> `DriverManager.setLoginTimeout((500 + connectionTimeout)/1000)` —— 这是**全局静态**设置。
> 所以 `connectionTimeout=10000` 会把整个 JVM 的 DriverManager 登录超时改成 10 秒，
> 顺带影响 `getNumberOfAccounts()` 与池借空后的 fallback 路径（现在是默认 0 = 无上限）。
> **属好事，但要知道。** 详见 `修复E-HikariCP连接池方案.md` §三 FIX 4 注。
> 另：`setConnectionTimeout` **< 250ms 会直接抛 `IllegalArgumentException`**，别往下调。
>
> ⚠️ **不用加 import**：`FilePrinter` 和 `DatabaseConnection` 同在 `tools` 包；`HikariConfig`/`HikariDataSource` 第 8~9 行已 import。

---

## 三、文件 2：`src\net\server\Server.java`（只加 2 行）

`import tools.DatabaseConnection;` **第 97 行已经存在** —— 不用加 import。

### 3.1 第 1 行：`init()`（第 765 行之后 —— ⚠️ 复审修订②，位置变了）

**改前**
```java
757    public void init() {
758        System.out.println("HeavenMS v" + ServerConstants.VERSION + " starting up.\r\n");
759
760        if (YamlConfig.config.server.SHUTDOWNHOOK)
```

**改后**
```java
757    public void init() {
758        System.out.println("HeavenMS v" + ServerConstants.VERSION + " starting up.\r\n");
759
760        if (YamlConfig.config.server.SHUTDOWNHOOK)
761            Runtime.getRuntime().addShutdownHook(new Thread(shutdown(false)));
762
763        TimeZone.setDefault(TimeZone.getTimeZone(YamlConfig.config.server.TIMEZONE));
764
765        DatabaseConnection.initPool();   // ← 新增：幂等（位置见下方说明）
766
767        Connection c = null;
768        try {
769            c = DatabaseConnection.getConnection();
```

> ⚠️ **修订原因（复审修订②）**：原清单放在 `println` 之后（`:760`），但那在 `TimeZone.setDefault()` **之前**。
> `config.yaml:308` 是 `TIMEZONE: GMT-8`，而原代码第一次建 DB 连接是在设好时区**之后**（`:767`）。
> 把建池提前 ⇒ 池的物理连接会在"系统默认时区（GMT+8）"下建立，可能造成**池连接与 DriverManager 连接的时区基准不一致**
> （`lastlogin` 是时间敏感字段，项目本来就有"+16 小时"的时区坑）。**必须放在设时区之后。**

**为什么是这个位置**：① 必须在 `getConnection()` 之前（池先就位）；② 必须在 `TimeZone.setDefault()` 之后（时序与现状一致）。
⇒ **时区 → 建池 → 用连接，与修改前完全同序，零行为差异。**

### 3.2 第 2 行：`shutdownInternal()` 收尾（第 1765 行之后）

**改前**
```java
1763        System.out.println("Worlds + Channels are offline.");
1764        acceptor.unbind();
1765        acceptor = null;
1766        if (!restart) {  // shutdown hook deadlocks if System.exit() ... thanks MIKE for pointing that out
1767            new Thread(new Runnable() {
```

**改后**
```java
1763        System.out.println("Worlds + Channels are offline.");
1764        acceptor.unbind();
1765        acceptor = null;
1766
1767        DatabaseConnection.closePool();   // ← 新增：关服收池（重启路径下，紧接着的 init() 会重新建起来）
1768
1769        if (!restart) {  // shutdown hook deadlocks if System.exit() ... thanks MIKE for pointing that out
1770            new Thread(new Runnable() {
```

**为什么放在 `if (!restart)` 外面（即重启也收）**：两条路都干净。
- 关服：`closePool()` 收池 → 线程池/Socket 不残留；
- 重启：`closePool()` 后立刻走 `:1782 getInstance().init()` → 里面第 1 行新增的 `initPool()` 重建 → 全程无窗口，不会出现"池关了但没人重建"。

> 如果不加第 1 行、只加第 2 行，**重启后池就永久失效了**（静态块不会再执行）。这是这个方案里最容易踩的坑。

---

## 四、执行步骤（确认后我会照着走，每步汇报）

| # | 步骤 | 命令 / 动作 | 备注 |
|---|---|---|---|
| 1 | **备份 jar** | `copy saves\HeavenMS-zhoubw_083.jar saves\HeavenMS-zhoubw_083.jar.bak-20260921` | 回滚用 |
| 2 | **停服务端** | 关掉服务端窗口 / 停 PID | **必须先停**——jar 被 JVM 当 classpath 打开着，边跑边 `jar uf` 会写坏 |
| 3 | 改 2 个源文件 | 按本文第二、三节 | |
| 4 | **重编译** | JDK 8 `javac -g -encoding UTF-8 -cp "cores\*" -d <输出>` 只编这 2 个类 | ⚠️ 铁律：跑的是 jar 不是 src |
| 5 | **打包** | `jar uf saves\HeavenMS-zhoubw_083.jar tools/DatabaseConnection.class net/server/Server.class` | 只更新这 2 个 class |
| 6 | **启服务端** | cwd 必须 `D:\MXDtestServer`（相对路径依赖） | |
| 7 | **看日志** | 出现 `HeavenMS-Pool - Starting...` 和 `[DB] HikariCP connection pool started. pool size 10.` | **这就是池生效的标志** |
| 8 | 进游戏跑一轮 | 进图 / 切频道 / 仓库 / 商城 | 观察 `logs\2026-09-21\game\SqlExceptions.txt` 有没有新的池告警 |

**回滚**：把 `.bak-20260921` 改回 `HeavenMS-zhoubw_083.jar`，重启服务端即可（源码改动可留着，或一并还原）。

---

## 五、这次改动**不碰**什么（划边界）

- ❌ 那 175 处裸 `con.close()` —— 等 FIX 8 的日志指路，单独一轮精准修十几处，不盲改
- ❌ `DB_URL` 的编码参数（现在能正常存中文名）、`autoReconnect=true`（留着，单独评估）
- ❌ `getConnection()` 的 `while(true)` 三次重试逻辑
- ❌ `getNumberOfAccounts()` 用 `DriverManager` 的写法（**是故意的**：池还没建好，不能递归调自己）
- ❌ `config.yaml`（`DB_CONNECTION_POOL: true` 保持不动，关掉就退回单连接模式）
- ❌ 其他任何 Java 文件、脚本、wz、数据库

---

## 六、已知代价（来自实测，提前认下）

| 代价 | 程度 |
|---|---|
| 池借空时该请求线程要挂到 `connectionTimeout`（10s）才抛异常 | 单机几乎不可能触发（池 10 条） |
| 嵌套借连接互等（如 `MapleStorage` 一次要 2 条） | 单机概率极低，**多开/联机第一个咬人** |
| 持有连接 >15s 的正常操作会被 FIX 8 报成"疑似泄漏" | 会有 `unleaked` 日志，要学会区分（归还时自动解除） |
| 改完必须 **停服 → 编译 → 打包 → 重启** | 无热重载，铁律 |

---

## 七、执行记录（2026-09-21 21:21 ~ 21:23）

### 7.1 改动落地情况

| 项 | 结果 |
|---|---|
| `src\tools\DatabaseConnection.java` | ✅ 重写（97 行 → 约 155 行）：`static{}` + 幂等 `initPool()` + `closePool()` + 5 个参数 + 兜底 try/catch |
| `src\net\server\Server.java` | ✅ 加 2 行：`:765` `DatabaseConnection.initPool();`（**在 `TimeZone.setDefault` 之后**，复审修订②）、`:1771` `DatabaseConnection.closePool();`（在 `if (!restart)` 外面） |
| 语法编译校验（临时目录） | ✅ rc=0，生成 `Server.class` + `Server$1..$4.class` + `DatabaseConnection.class` **6 个 class**，与 jar 里原有条目集合**完全一致** |
| 部署目标①`out\production\SERVER083`（IDEA 加载） | ✅ 21:21:23~24 全部刷新（`deploy_classes.py`） |
| 部署目标②`out\artifacts\...\HeavenMS-zhoubw_083.jar` | ✅ 21:22:45，条目数 **2029 → 2029（一致）**，6 个 class 时间戳都变 21:22 |
| 备份 | `HeavenMS-zhoubw_083.jar.bak-20260921-pool`（3,677,509 字节，改动前原样） |

> ⚠️ **`saves\` 下没有 jar** —— 本项目实际使用的 jar 只有 `out\artifacts\HeavenMS_zhoubw_083_jar\HeavenMS-zhoubw_083.jar` 这一个（`mxd_build.py` 的 `JARFILE` 也指向它）。备份请到 `out\artifacts\` 找。

### 7.2 ★ 真实环境预检：池能不能建起来（`PoolLiveProbe`，只读）

**用改后新编译的 class**（classpath 把 `out\production\SERVER083` 放在最前）+ 真实 `config.yaml` + 真实 MySQL，在独立 JVM 里跑。原始输出：`D:\tmp\fixE-pool\pool_live.txt`（脚本 `D:\tmp\run_pool_probe.py`）。

| # | 判据 | 实测结果 |
|---|---|---|
| 1 | `Class.forName` 后静态块有没有自动建池 | `ds = com.zaxxer.hikari.HikariDataSource` ✅ |
| 2 | 池参数有没有被正确设上 | `poolName=HeavenMS-Pool` / `max=10` / **`minIdle=4`** / **`connectionTimeout=10000`** / `validationTimeout=5000` / `idleTimeout=600000` / `maxLifetime=1800000` / **`leakDetectionThreshold=15000`** / `connectionTestQuery=SELECT 1` ✅ |
| 3 | `getConnection()` 拿到的是什么 | **`com.zaxxer.hikari.pool.HikariProxyConnection`** ✅ ← **这是"池真的生效"的铁证**（改之前是 `com.mysql.jdbc.JDBC4Connection`）；`SELECT 1` 返回 1 |
| 4 | 复用效果 | 200 次「借+还」共 8.24 ms，**平均 41 微秒/次**（对照 DriverManager 单次 4.31 ms ⇒ 约 **100 倍**） |
| 5 | 池实时状态 | total=1 / idle=1 / active=0 / waiting=0（刚借完即还，正常） |
| 6 | `closePool()` 幂等 | 调 2 次都 `ds = null`，不抛异常 ✅ |
| 7 | **`closePool()` 后 `initPool()` 能否重建** | **能，`ds` 非 null** ✅ ← 服务端「重启」路径（`Server.java:1782 getInstance().init()`）的安全保证 |

启动日志（Hikari 走 slf4j → JUL，直接打控制台）：
```
信息: HeavenMS-Pool - Starting...
信息: HeavenMS-Pool - Driver does not support get/set network timeout for connections. (com.mysql.jdbc.JDBC4Connection.getNetworkTimeout()I)
信息: HeavenMS-Pool - Start completed.
[DB] HikariCP connection pool started. pool size 10.
```
> 第二行是**已知的正常警告**（坑 6：Connector/J 5.1.6 不支持 `networkTimeout`），**不是错误**。
> 启动后应看到 `HeavenMS-Pool - Starting...` 和 `[DB] HikariCP connection pool started. pool size 10.` —— **这两行就是"池生效"的标志**。

### 7.3 重启后请核对（4 项）

| # | 看什么 | 期望 |
|---|---|---|
| 1 | 服务端控制台开头 | 出现 `HeavenMS-Pool - Starting...` + `[DB] HikariCP connection pool started. pool size 10.` |
| 2 | 控制台有没有 `[SEVERE] … falling back` | **不应出现**（出现=池建失败，会退回单连接模式） |
| 3 | 玩一轮（进图/切频道/仓库/商城/存档） | `logs\<日期>\error\game\SqlExceptions.txt` 无新增池告警 |
| 4 | 关注误报 | 若出现 `Apparent connection leak detected`，**先看栈里是不是 `RankingLoginTask.run`**（每小时一次的排行任务，坑 4）或 `MapleCharacter` 的长事务（坑 5）—— 是它们属**已知误报**，不是真泄漏 |

### 7.4 回滚

```
① 停服
② copy "out\artifacts\HeavenMS_zhoubw_083_jar\HeavenMS-zhoubw_083.jar.bak-20260921-pool" 覆盖回 "…\HeavenMS-zhoubw_083.jar"
③ 重启
   ⚠️ IDEA 模式（加载 out\production\SERVER083）光还原 jar 不够，还要把 src 里那 2 个文件还原，
      让 IDEA 重新编译；或直接用 deploy 脚本把旧版 class 写回 OUT 目录
```

### 7.5 本轮没动的东西
`getConnection()` 的 `while(true)` 重试、`getNumberOfAccounts()`、`config.yaml`（`DB_CONNECTION_POOL` 保持 `true`）、`DB_URL`、那 175 处裸 `con.close()`。
~~`FaceExpressionHandler` 里临时的 `GM_EMOTE_ECHO` 探针与 F3 自检分支~~ —— **已在 09-21 21:46 单独一轮撤除**（见 §7.6）。

---

## 八、重启后实测复核（2026-09-21 21:37 重启，21:44 复核）

服务端进程 **PID 4312，启动于 09-21 21:37:46**（晚于 21:22:45 的部署 ✅ ⇒ 加载的确实是新 class）。

### 8.1 `SqlExceptions.txt` —— **符合预期，无新增** ✅

用户体感「玩起来快了点」，按要求核对 SQL 异常：

| 项 | 实测 |
|---|---|
| 文件 | `logs\2026-09-21\error\game\SqlExceptions.txt` |
| 内容 | 2 行，均为 `SQL Driver refused to give a connection after 3 tries. Problem: Could not create connection to database server. Attempted reconnect 3 times. Giving up.` |
| 最后写入时间 | **09-21 08:00:25** |
| 本次重启（21:37:46）之后 | **一个字都没新增** ✅ |

⇒ 那 2 行是**今早还没手工启动 MySQL 时**那次启动尝试留下的（本机 MySQL = 服务端 `MySQL57`，手动启动、开机不自启），
与连接池**无关**。
> 判定依据：时区已改为 GMT+8，当前会话的日志就写在 `logs\2026-09-21\` 下
> （旁证：`players\SaveChar.txt` 21:41:11、`players\Sessions.txt` 21:39:06 均已更新）
> ⇒ 若池有问题，新告警必然**追加进同一个文件**并刷新 mtime。mtime 停在 08:00:25 ⇒ 干净。

### 8.2 池是否真的在跑 —— **MySQL 侧铁证** ✅

改前（DriverManager 模式）闲时 MySQL 里**不会有**本应用的常驻连接；现在：

| 检查 | 实测 |
|---|---|
| `information_schema.processlist` | 9 条 `zhoubw / heavenms`，其中 **8 条 `command=Sleep`**、1 条是本次查询自身 |
| 归属核对（`Get-NetTCPConnection -RemotePort 3306`） | **服务端 PID 4312 持有 5 条**；DBeaver（PID 22700）3 条；其余为 CLI |
| `Threads_connected` / `Max_used_connections` | 9 / 9（≤ `maximumPoolSize=10`，未触顶）✅ |

⇒ **服务端保持着一批长连接不放** = 池生效（与 §7.2 判据 3 的 `HikariProxyConnection` 互证）。
省下的正是每次查询的 TCP 握手 + MySQL 认证开销，与「快了点」的体感一致。

### 8.3 本轮同批撤除的调试件（附）

清理 `FaceExpressionHandler` 与 `GmActions` 里的临时诊断件 → 详见 `handbook\键位-全屏捡取.md` §9.6。
两处部署目标均已刷新（21:46），**jar 条目数 2029 → 2029 未变** ✅，字节级校验确认探针字符串已清除。
