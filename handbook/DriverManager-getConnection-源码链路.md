# `DriverManager.getConnection(...)` 源码链路全解

> 日期：2026-09-21
> 目的：回答「它里面怎么建连接？会不会给 `ds` 赋值？」
> 源码来源：**从本机 `C:\Program Files\Eclipse Adoptium\jdk-8.0.502.7-hotspot\src.zip` 解出的真实源码**
> （`java/sql/DriverManager.java`，共 728 行），不是网上抄的版本。
> 驱动侧结论用 `javap` 反汇编 `cores\mysql-connector-java-bin.jar` 得到。
> 复现脚本：`D:\tmp\fixE-bench\dump_dm*.py`、`dump_driver.py`

---

## 〇、先回答两个问题

| 问题 | 答案 |
|---|---|
| 它里面怎么建立连接？ | 它**自己不建**。它只做两件事：① 把 `user`/`password` 塞进 `Properties`；② **遍历注册的驱动列表**，把活交给第一个 `acceptsURL()` 认这个 URL 的驱动。真正的 TCP + MySQL 握手发生在驱动层。 |
| **会给 `ds` 赋值吗？** | **绝对不会，而且做不到。** 见 §四的三条理由。 |

---

## 一、第一层：项目代码（`DatabaseConnection.java:21~44`）

```java
21    public static Connection getConnection() throws SQLException {
22        if(ds != null) {                                    // ← 永远进不去（ds 恒为 null）
23            try {
24                return ds.getConnection();                  // ← 池借连接，从未执行过
25            } catch (SQLException sqle) {
26                sqle.printStackTrace();                     // ← 「池借空就降级」的接住点
27            }
28        }
29
30        int denies = 0;
31        while(true) {   // There is no way it can pass with a null out of here?
32            try {
33                return DriverManager.getConnection(          // ★ 每次都走这里
34                    YamlConfig.config.server.DB_URL,
35                    YamlConfig.config.server.DB_USER,
36                    YamlConfig.config.server.DB_PASS);
37            } catch (SQLException sqle) {
38                denies++;
39                if(denies == 3) {
40                    // Give up, throw exception. Nothing good will come from this.
41                    FilePrinter.printError(FilePrinter.SQL_EXCEPTION,
42                        "SQL Driver refused to give a connection after " + denies
43                        + " tries. Problem: " + sqle.getMessage());
44                    throw sqle;
45                }
46            }
47        }
48    }
```

### 逐段解读

| 行 | 做什么 | 备注 |
|---|---|---|
| 22–28 | 先试着从池里拿 | **因为 `ds` 恒为 `null`，这 7 行是死代码** |
| 26 | `sbqe.printStackTrace()` 后**不 return、不 throw** | 控制流继续往下走 ⇒ 池借空时**自动降级**到 DriverManager。这就是实测到的"降级而非卡死"的代码依据 |
| 30 | `denies` 重试计数 | 最多试 **3 次** |
| 31 | `while(true)` | 只在第 3 次失败时从 44 行 `throw` 出去，所以不会死循环 |
| 33–36 | 调 JDK 的 `DriverManager.getConnection(url, user, pass)` | 每调一次 = 新建一条物理连接 |
| 38–46 | 失败就重试，**中间没有 sleep** | 紧凑重试；MySQL 没起来时会快速失败 3 次然后抛异常 |

> ⚠️ 作者注释 *"There is no way it can pass with a null out of here?"* 说明他的意图是"这个方法保证不返回 null"——
> 但 `while(true)` 一旦在 `catch` 里抛出去，其实是会抛异常的。注释和实际行为不完全一致。
> 结合 `DB_URL` 里的 `autoReconnect=true`，**一次失败实测要等约 18 秒**（10s connectionTimeout + 驱动内部重试）。

---

## 二、第二层：JDK 的 `DriverManager`（`java/sql/DriverManager.java`）

### 2.1 入口重载（第 236~248 行）—— 它只是"打包参数"

```java
236    public static Connection getConnection(String url,
237        String user, String password) throws SQLException {
238        java.util.Properties info = new java.util.Properties();
239
240        if (user != null) {
241            info.put("user", user);
242        }
243        if (password != null) {
244            info.put("password", password);
245        }
246
247        return (getConnection(url, info, Reflection.getCallerClass()));
248    }
```

**它一行都没连数据库**。只是把账号密码从"参数"变成"Properties"，然后转发。
（`Reflection.getCallerClass()` 是为了做调用方权限检查 / 选对 ClassLoader。）

### 2.2 真正干活的方法（第 632~690 行）—— 核心就 30 行

```java
631    //  Worker method called by the public getConnection() methods.
632    private static Connection getConnection(
633        String url, java.util.Properties info, Class<?> caller) throws SQLException {
...
640        ClassLoader callerCL = caller != null ? caller.getClassLoader() : null;
641        synchronized(DriverManager.class) {
643            if (callerCL == null) {
644                callerCL = Thread.currentThread().getContextClassLoader();
645            }
646        }
647
648        if(url == null) {
649            throw new SQLException("The url cannot be null", "08001");
650        }
651
652        println("DriverManager.getConnection(\"" + url + "\")");
653
654        // Walk through the loaded registeredDrivers attempting to make a connection.
655        // Remember the first exception that gets raised so we can reraise it.
656        SQLException reason = null;
657
658        for(DriverInfo aDriver : registeredDrivers) {          // ★ 遍历驱动列表
661            if(isDriverAllowed(aDriver.driver, callerCL)) {
662                try {
663                    println("    trying " + aDriver.driver.getClass().getName());
664                    Connection con = aDriver.driver.connect(url, info);   // ★ 真正的建连
665                    if (con != null) {
666                        // Success!
667                        println("getConnection returning " + aDriver.driver.getClass().getName());
668                        return (con);                                          // ← 返回给项目
669                    }
670                } catch (SQLException ex) {
671                    if (reason == null) {
672                        reason = ex;                       // 记住第一个异常，稍后重抛
673                    }
674                }
675
676            } else {
677                println("    skipping: " + aDriver.getClass().getName());
678            }
679        }
680
682        // if we got here nobody could connect.
683        if (reason != null)    {
684            println("getConnection failed: " + reason);
685            throw reason;
686        }
687
688        println("getConnection: no suitable driver found for "+ url);
689        throw new SQLException("No suitable driver found for "+ url, "08001");
690    }
```

**逻辑就是三句话**：
1. 遍历 `registeredDrivers`（一个 `CopyOnWriteArrayList<DriverInfo>`，第 85 行声明）
2. 找到第一个 `driver.connect(url, info) != null` 的就 `return`
3. 全都不行 → 抛 `SQLException`（有历史的抛历史的，没有的抛 `No suitable driver found`）

**注意：方法签名里根本没有 `DatabaseConnection`，也没有 `ds`。** 它只收到 `url` / `info` / `caller` 三个东西。
返回值是一条 `Connection`，**由调用方（项目代码）自己决定要不要存下来** —— 而项目代码是直接 `return` 掉，没存。

### 2.3 驱动列表是怎么被填满的？—— JDK 的 `static {}` 块（第 100~103 行）

```java
100    static {
101        loadInitialDrivers();
102        println("JDBC DriverManager initialized");
103    }
```

`loadInitialDrivers()`（第 567~610 行）的关键部分：

```java
583        AccessController.doPrivileged(new PrivilegedAction<Void>() {
584            public Void run() {
586                ServiceLoader<Driver> loadedDrivers = ServiceLoader.load(Driver.class);
587                Iterator<Driver> driversIterator = loadedDrivers.iterator();
...
602                    while(driversIterator.hasNext()) {
603                        driversIterator.next();          // ← 实例化驱动，触发它自己的 static 块
604                    }
...
610        });
```

> ★ **这个 `static {}` 块是整件事最妙的对照**：
> JDK 作者把"初始化动作"放在**静态初始化块**里，所以**类一被加载就必定执行**，不可能忘。
> 而项目的 `DatabaseConnection` 把"初始化动作"放在了**实例构造器**里 —— 结果没人 `new` 它，池就永远建不起来。
> **FIX 1（把构造器改成 `static {}`）本质上是把项目代码改回 JDK 这种写法。**

---

## 三、第三层：JDBC 驱动内部（`javap` 反汇编证据）

`getConnection` 第 664 行那个 `aDriver.driver.connect(url, info)` 往下走：

### 3.1 `com.mysql.jdbc.Driver` 的完整反汇编（只有 30 字节）

```java
public class com.mysql.jdbc.Driver extends com.mysql.jdbc.NonRegisteringDriver implements java.sql.Driver {
  public com.mysql.jdbc.Driver() throws java.sql.SQLException;
       0: aload_0
       1: invokespecial  // Method com/mysql/jdbc/NonRegisteringDriver."<init>":()V
       4: return

  static {};
       0: new            // class com/mysql/jdbc/Driver
       4: invokespecial  // Method "<init>":()V
       7: invokestatic   // Method java/sql/DriverManager.registerDriver:(Ljava/sql/Driver;)V   ★
      10: goto 24
      13: astore_0
      14: new java/lang/RuntimeException
      18: ldc  "Can't register driver!"
      23: athrow
      24: return
}
```

**这就是 `Class.forName("com.mysql.jdbc.Driver")` 这句"祖传咒语"的原理**：
驱动类自己的 `static {}` 块里调 `DriverManager.registerDriver(new Driver())`，把自己塞进注册表。

> 而本项目的 `Class.forName` 那行**在构造器里，从没执行过** —— 驱动能注册上，
> 是因为 `mysql-connector-java-bin.jar` 内含 `META-INF/services/java.sql.Driver`（内容 `com.mysql.jdbc.Driver`），
> JDK 的 `ServiceLoader` 在 §2.3 那里自动把它实例化并注册了。**两条路殊途同归，所以看不出问题。**

### 3.2 建连链条（方法确实存在，来自 `javap -p`）

```
com.mysql.jdbc.NonRegisteringDriver
    public java.sql.Connection connect(java.lang.String, java.util.Properties)
    public java.util.Properties parseURL(java.lang.String, java.util.Properties)
    public boolean acceptsURL(java.lang.String)          ← getConnection 第 661 行选驱动就靠它

com.mysql.jdbc.ConnectionImpl
    protected void createNewIO(boolean) throws java.sql.SQLException      ← 真正建连接
    protected com.mysql.jdbc.MysqlIO getIO()
    private com.mysql.jdbc.MysqlIO io;

com.mysql.jdbc.MysqlIO
    void doHandshake(java.lang.String, java.lang.String, java.lang.String)  ← MySQL 协议握手
    void secureAuth411(Buffer, int, String, String, String, boolean)        ← 密码哈希认证
    private void secureAuth(Buffer, int, String, String, String, boolean)
```

完整链条：

```
DatabaseConnection.getConnection()                      【项目】
 └─ DriverManager.getConnection(url, user, pass)        【JDK】打包 Properties
     └─ DriverManager.getConnection(url, info, caller)  【JDK】for 循环遍历驱动
         └─ NonRegisteringDriver.connect(url, props)    【驱动】parseURL
             └─ new ConnectionImpl(...)                 【驱动】
                 └─ ConnectionImpl.createNewIO(false)   【驱动】
                     └─ MysqlIO.doHandshake(...)        【驱动】
                         └─ secureAuth411(...)          【驱动】scramble 密码
                             └─ Socket → 127.0.0.1:3306
                                 → MySQL 服务端握手 → 认证 → 建会话
```

**实测这整条链走完 = 4.31 ms**（会话/连接一次一建），池化后 = 0.10 ms。

---

## 四、它会给 `ds` 赋值吗？—— 不会，而且**做不到**

### 理由 1：`ds` 不在它的可见范围内（最根本的一条）

`ds` 是 `tools.DatabaseConnection` 的 **`private static`** 字段。
`DriverManager` 在 **`rt.jar` 的 `java.sql` 包**里 —— JDK 的类**编译期就依赖不到应用自己的 `tools` 包**（依赖方向是反的）。
它连 `DatabaseConnection` 这个类的名字都不知道，更不可能去写它的私有字段。

**证据**：`DriverManager.java` 的全部 import 只有这些，没有 `tools`，也没有任何项目类：

```java
import java.util.Iterator;
import java.util.ServiceLoader;
import java.security.AccessController;
import java.security.PrivilegedAction;
import java.util.concurrent.CopyOnWriteArrayList;
import sun.reflect.CallerSensitive;
import sun.reflect.Reflection;
```

### 理由 2：它在数据流上也拿不到 `ds`

看 §2.2 的方法签名，`getConnection` 收到的只有 `String url`、`Properties info`、`Class<?> caller`。
`ds` 从来没被当成参数传进去过。**没有引用 ⇒ 不可能赋值。**

### 理由 3：源码里 `ds` 一次都没出现

扫描整份 `DriverManager.java`（728 行）：
**包含 `ds =` 的行数 = 0**。

### 那 `ds` 到底有几处赋值点？—— 只有 2 处，且都在同一个地方

`DatabaseConnection.java`：

```java
19    private static HikariDataSource ds;          // ① 声明（默认值 null）

62    public DatabaseConnection() {                // ② 唯一可能让它变成非 null 的地方
64        Class.forName("com.mysql.jdbc.Driver");  //    这行也是死代码
70        ds = null;                               //    ← 第 1 处赋值
72        if(YamlConfig.config.server.DB_CONNECTION_POOL) {
...
94            ds = new HikariDataSource(config);   //    ← 第 2 处赋值（池在这里被创建）
95        }
96    }
```

**两处赋值全在 `public DatabaseConnection()` 里，而全项目 `new DatabaseConnection()` 出现 0 次。**
所以 `ds` 从 JVM 给静态字段的默认值 `null` 开始，一路到最后都还是 `null`。

### 交叉验证：反射实测（见 `修复E-HikariCP连接池方案.md` §一）

```
【3】getConnection() → com.mysql.jdbc.JDBC4Connection，SELECT 1 返回 1（连接完全可用）
【4】拿到活连接之后再读一次 ds = null      ← 铁证
```

**成功拿到一条活连接，`ds` 依然是 `null`** —— 说明这条连接完全没经过池，是 `DriverManager` 现建的。

---

## 五、一句话总结

```
DriverManager.getConnection(...) 是一个「查表 + 转交」的分发器：
  它不认识你的类，只认识 url 和 Properties；
  它把活交给 MySQL 驱动，驱动再吐回一条 Connection；
  它既不缓存、也不复用、更不会去碰你的任何字段。
```

所以：
- **`ds` 只能由项目自己的代码赋值** —— 而那份代码在构造器里，构造器从未执行
- **`if (ds != null)` 永远为假** —— 每次 SQL 都落到 `while(true)` 那条 `DriverManager` 路径，新建一条连接
- **修法（FIX 1）**：把 `public DatabaseConnection()` 改成 `static { }`，让它像 JDK 的 `DriverManager` 那样，**类一加载就必定执行**
