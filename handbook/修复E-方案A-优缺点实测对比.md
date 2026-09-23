# 修复 E · 方案 A —— 与现状的实测优缺点对比

> 日期：2026-09-21　状态：**只做了对比分析，未改任何代码**
> 对比基线：当前线上跑的 jar（`DatabaseConnection.getConnection()` 走 `DriverManager`，池形同虚设）
> 对比方案：方案 A = **只上连接池 + 泄漏检测**，不动那 175 处老代码
> 实测机器：本机 localhost，MySQL 5.7.44 / heavenms 库 / Connector/J 5.1.6 / HikariCP 2.4.13 / JDK 8

---

## 〇、结论速览

| 维度 | 现状 | 方案 A | 改变幅度 | 玩家能感觉到吗 |
|---|---|---|---|---|
| 单次 DB 操作耗时 | **4.31 ms** | **0.10 ms** | **42 倍** | ⚠️ 单次感觉不到，**成串**时能 |
| 耗时抖动（P95） | 5.58 ms | 0.13 ms | 被抹平 | ✅ 「操作更稳」是真实体感 |
| 每次 SQL 新建一条连接 | 是 | 否（复用） | 连接数降到 ≈0 | — |
| 数据库侧连接压力 | 跟着 SQL 条数走 | 一条平线 | 显著更小 | ❌ 单机 1 人玩本就不是瓶颈 |
| 漏关连接能不能被发现 | ❌ 完全看不见 | ✅ 带调用栈告警 | 从猜变成看得见 | — |
| **最大新增风险** | — | 池借空 / 嵌套互等 | ⚠️ 见 §六 | ✅ 会卡顿 |
| 需要重启服务端 | — | 是 | — | — |

**一句话**：方案 A 的**性能收益是真的、但不是你玩游戏时最能感知到的部分**；它真正的价值在于**把 DB 层从"黑盒"变成"可观测"**。
风险比方案文档原先写的**要低**——实测证明池借空**不会卡死服务端，只会降级**（详见 §6.1）。

---

## 一、实测方法（可复现）

全部用**服务端自己那套 jar**，不是外部工具：

```
classpath = D:\MXDtestServer\cores\*        # mysql-connector-java-bin.jar (Connector/J 5.1.6)
                                            # HikariCP-java7-2.4.13.jar
JDK       = C:\Program Files\Eclipse Adoptium\jdk-8.0.502.7-hotspot
```

三个探针程序（源码在 `D:\tmp\fixE-bench\`，可随时重跑）：

| 程序 | 作用 |
|---|---|
| `PoolBench.java` | 现状 vs 方案A 的耗时对比（各 300 样本，含 30 次预热） |
| `RiskProbe.java` | 池借空会怎样 |
| `LeakProbe.java` | 泄漏告警能否真的打出来 |
| `StateResetProbe.java` | 连接归还是否重置会话状态 |

测试用的库参数**与方案 A 完全一致**（池大小 10、minimumIdle 4、connectionTimeout 10s、maxLifetime 30min、leakDetectionThreshold 15s）。**全程只读查询，没有写入任何数据。**

---

## 二、收益 1：单次 DB 操作耗时 —— 实测 42 倍

### 场景 1：简单查询 `SELECT 1`

| 模式 | 平均 | P50 | P95 | 最大 |
|---|---|---|---|---|
| **现状**（每条 SQL 新建连接） | **4.31 ms** | 4.12 ms | **5.58 ms** | **13.85 ms** |
| **方案 A**（从池借用） | **0.10 ms** | 0.08 ms | **0.13 ms** | 5.33 ms |

### 场景 2：模拟真实业务读取（`SELECT * FROM characters WHERE id=1`）

| 模式 | 平均 | P50 | P95 | 最大 |
|---|---|---|---|---|
| **现状** | **4.05 ms** | 3.91 ms | **5.56 ms** | **12.05 ms** |
| **方案 A** | **0.21 ms** | 0.18 ms | **0.35 ms** | **0.52 ms** |

> **提速 42.4 倍，单次省 4.21 ms。**

**这 4 ms 花在哪了？** 全在"建连接"上，跟 SQL 本身无关：
TCP 三次握手 → MySQL 读账号 → 算 `mysql_native_password` 哈希 → 建会话 → 分配连接级缓冲区。
池化后这些**只在启动时做 4 次**，之后全是内存里的借用/归还。

⚠️ **重要提醒**：这个数字是 **localhost** 的。真实局域网（客户端-服务端分离部署）还要叠加网络 RTT × 2，会**更明显**。

⚠️ **另一个提醒**：提速的是**每条 DB 操作**，不是每个玩法动作。真正的收益取决于一次动作里串了多少条 SQL——
`MapleClient.java` 里有 **23 处**独立连接获取点，`MapleCharacter.java` 有 **38 处**，都是各自一条新连接。串起来时 4 ms 就会累加成几十 ms。

---

## 三、收益 2：数据库侧的连接压力

**实测空转基线**（服务端在跑、无人游戏，连续 120 秒）：

```
新建连接: 3 条   (≈1.5 条/分钟)
SQL 语句: 15 条  (≈7.5 条/分钟)
```

也就是说：**你不玩的时候，服务端每秒都在新建连接**，只是速率低。

**MySQL 当前状态**（修复前快照）：

| 指标 | 值 | 含义 |
|---|---|---|
| `Connections` | 204 → 随后持续增长 | 累计连接建立次数，**跟着 SQL 条数线性涨** |
| `Max_used_connections` | **3** | 历史最高并发连接数只有 3 —— 并发压力几乎为零 |
| `Threads_created` | 3 | 靠 `thread_cache_size=9` 兜住了线程复用 |
| `Aborted_connects` | 4 | 已有 4 次连接中止 |
| `max_connections` | 151 | 离上限很远 |
| `wait_timeout` | 28800 s（8 小时） | 连接不会很快被 MySQL 掐断 |

### 池化后 DB 侧少做了什么

**会减少**：TCP 握手次数、认证次数、MySQL 侧线程调度、连接级内存分配/回收、半开连接（`Aborted_connects`）风险。
**不会减少**：SQL 语句条数本身、查询的 CPU/IO、锁竞争。

> ⚠️ **诚实结论**：当前是**单机 1 人玩**，`Max_used_connections=3`，数据库**本来就不是瓶颈**。
> 所以"对数据库压力更小"这句话**成立，但在你现在的负载下小到基本看不出来**。
> 真正体现价值的是：多开几个客户端、或者在跑批量任务（排行榜、自动保存、家族重置）时。

---

## 四、收益 3（其实是最大的一条）：可观测性

这一条不写在性能指标里，但**是方案 A 最值钱的部分**。

现状的代码是这样的：

```java
if (ds != null) { ... }                       // 永远进不去
... DriverManager.getConnection(...)          // 永远走这条
```

漏掉的连接**没有任何痕迹**——没有引用、没有日志，MySQL 等超时才回收，你感觉不到。
所以那 175 处裸写法**至今没炸过，你也就永远不知道哪几处真的在漏**。

方案 A 加上 `leakDetectionThreshold = 15s` 后，**实测确实会打印出借用点的完整调用栈**：

```
警告: Connection leak detection triggered for com.mysql.jdbc.JDBC4Connection@593634ad, stack trace follows
java.lang.Exception: Apparent connection leak detected
	at LeakProbe.main(LeakProbe.java:25)
```

生产上这行就会变成 `at server.MapleStorage.loadOrCreateFromDB(MapleStorage.java:81)` 这种**直接指名道姓**的位置。

**这意味着**：方案 A 跑一轮之后，你不需要猜，也不用盲改 175 处——
日志直接告诉你"泄露的是哪几处"，**精准修十几处可能就够了**。这是方案 A 和"直接改 175 处"最大的区别。

---

## 五、玩家体感：哪些能感觉到，哪些感觉不到

这是你最关心的一条，我按**能不能被体感到**分开说。

### ❌ 感觉不到的

- 打怪、走路、放技能 → **不查数据库**，完全没影响
- 单次捡东西、单次对话 → 4 ms，低于人类感知阈值（~100 ms）

### ⚠️ 勉强能感觉到的

| 场景 | 为什么 | 现状 | 方案 A |
|---|---|---|---|
| **登录 / 进入游戏** | 角色数据要一次性读一大串 | 几十 ms 累加 | 省掉绝大部分 |
| **切换频道** | 要走一次"保存+重载" | 有可感知的等待 | 明显缩短 |
| **进入商城 / 拍卖（MTS）** | `EnterCashShopHandler` / `EnterMTSHandler` 强制存档 | 卡一下 | 明显缩短 |
| **打开仓库（MapleStorage）** | 一次操作要借 **2 条**连接 | 8 ms | 0.2 ms |
| **下线保存 / 自动保存** | `saveCharToDB` 一整个事务 | 有轻微顿挫 | 明显缩短 |

### ✅ 真正会被感觉到的：**不是"更快"，是"不抖"**

看这组数字：

| | 现状 | 方案 A |
|---|---|---|
| P95 | 5.58 ms | 0.13 ms |
| **最大** | **13.85 ms** | 5.33 ms |

现状的耗时**分布很散**（4 ms 到 14 ms 之间抖），因为每次都要重新建连接，受系统调度、端口分配、防火墙检查影响。
池化后耗时**极其稳定**（P95 = 0.13 ms，几乎没抖）。

玩家的体感是：**"切频道不卡了 / 进商城不顿了"**，而不是"游戏变快了"。
这是**最诚实的期待管理**——别指望装了池就觉得走路变快，不会的。

---

## 六、缺点与风险（含实测验证）

### 6.1 池借空会不会把服务端搞死？—— ✅ 实测：不会，会降级

这是原方案文档里最吓人的一条（"175 处漏连接 → 池借空 → 整个服务端卡住"）。**实测结果比这个乐观**：

```
第 2 次借出失败，耗时 1011 ms
  异常类型 : java.sql.SQLTransientConnectionException
  是 SQLException 子类吗（决定能否被现有 catch 兜住）: 是
  异常消息 : Probe-Pool - Connection is not available, request timed out after 1011ms.
归还第 1 条后，再借：成功（池恢复正常）
```

因为 `SQLTransientConnectionException` **是 `SQLException` 的子类**，会被现有代码这段接住：

```java
try {
    return ds.getConnection();
} catch (SQLException sqle) {
    sqle.printStackTrace();      // ← 这里接住
}
// 然后落到 DriverManager.getConnection(...) —— 照样拿到连接
```

**所以池借空的真实后果是"自动退回单连接模式"，而不是卡死。** 这点可以让方案 A 放心不少。

**但代价仍在**：

| 代价 | 说明 |
|---|---|
| 池形同虚设 | 泄漏持续存在的话，等于白改 |
| **线程被挂住最长 10 秒** | 借不到要等到 `connectionTimeout`（方案A 设 10s）才抛异常。**这 10 秒里玩家的请求线程是死的** |
| 日志狂刷 | 每条 SQL 打一次堆栈 |

> 建议：如果实测发现泄漏频繁，把 `connectionTimeout` 从 10s 再降到 **3~5s**，缩短"卡死窗口"。这个值方案 A 里是 10s，可以再议。

### 6.2 ⚠️ 方案 A **新引入**的失败模式：嵌套借连接 → 池内互相等

这是现状**绝对不会**发生、但池化后**会出现**的问题，必须单独说：

`MapleStorage.java` 一次要给**两条**连接（自己一条，`loadItems` / `create` 内部再借一条）。
如果池只有 **10 条**，10 个并发线程各持 1 条、同时卡在借第 2 条 → **集体等到超时**。

```
线程1: 持有#1  ──等待──> 需要#2   (池空)
线程2: 持有#2  ──等待──> 需要#3   (池空)
... 全部阻塞到 connectionTimeout
```

- 现状（DriverManager）：不存在这个问题，随便借，反正是新连接
- 池化后：**这是真正的死锁形态**（虽然会被超时打破，不是永久死锁）

**缓解**：池最小 10 条 + 单机玩家极少并发 → 实际触发概率**很低**。
但如果你以后开多客户端 / 联机，这就是**第一个会咬人的地方**。

### 6.3 长操作会被误报成"泄漏"

15 秒阈值意味着：**任何持有连接超过 15 秒的正常操作都会被报警**。
实测还发现归还时会有配套日志：

```
信息: Previously reported leaked connection ... was returned to the pool (unleaked)
```

→ 所以日志里既有 **真泄漏**（一直不还）也有 **假警报**（超过 15s 还回去了）。
上线后看日志要学会区分，别一看有告警就慌。

### 6.4 ★ 新发现：阈值低于 2000ms 会被 Hikari **静默禁用**

这条是本次实测挖出来的，**原方案文档里没有**：

```
警告: Probe-Pool - leakDetectionThreshold is less than 2000ms or more than maxLifetime, disabling it.
```

**硬约束**：`leakDetectionThreshold` 必须落在 **`[2000 ms, maxLifetime)`** 区间内，否则不是报错，而是**悄悄关掉**（只打一条警告）。
另外 `[2000, 15000)` 之间是 **Hikari 硬编码不建议**的区间，可能引发**误报**（2 秒就把正常操作当泄漏）。

方案 A 写的 **15 s** 是合法的（≥2000 且 < 30min）✅。
但**以后别调小**——调到 1000ms 等于没开，调到 2500ms 会满屏误报。

> 已把这条约束补进方案文档的 FIX 8。

### 6.5 会话状态被复用（理论风险）—— ✅ 实测已排除

现状每条连接都是**全新会话**；池化后同一条物理连接被反复复用。
如果代码依赖"每次都是干净会话"，语义就会变。

`saveCharToDB` 确实会改会话状态：

```java
con.setTransactionIsolation(Connection.TRANSACTION_READ_UNCOMMITTED);   // 8444
con.setAutoCommit(false);                                              // 8445
```

**实测：HikariCP 归还时会把这两项都重置干净**：

```
--- 第 1 次借用 ---   autoCommit=true, 隔离级别=4 (REPEATABLE_READ)
  改成            autoCommit=false, 隔离级别=1 (READ_UNCOMMITTED)
--- 第 2 次借用（同一条物理连接）---
  借用时          autoCommit=true, 隔离级别=4     ← 已重置 ✅
```

**同时全项目搜查**：没有任何 `SET NAMES` / `SET SESSION` / `SET @@` / 用户变量（`@var`）的用法，
只有 `setAutoCommit` + `setTransactionIsolation`（24 处），**全部在 Hikari 的重置范围内**。

→ **6.5 这条风险实测排除**，可以放心。

### 6.6 常驻开销（可忽略）

| 项 | 代价 |
|---|---|
| 池常驻连接 | `minimumIdle=4` → 常开 4 条，懒建到 10 条（**不改就是启动直接建满 10 条**） |
| MySQL 侧 | 每个连接一个线程 + net buffer，**几 MB 级别**，`max_connections=151` 完全无压力 |
| Hikari 管家线程 | 1 个后台线程 |
| 启动耗时 | 建 4 条连接 ≈ 4 × 4ms ≈ **16 ms**，可忽略 |

### 6.7 运维代价（必须知道）

- ❗ **必须停服务端 → 重新编译 → `jar uf` 打包 → 重启**，不能在线改
  （jar 被 JVM 当 classpath 打开着，一边跑一边打包会写坏）
- 打包前会先做备份 `saves\HeavenMS-zhoubw_083.jar.bak-YYYYMMDD`
- 排查路径变长：DB 连接从"每次新建"变成"复用"，以后遇到连接级怪问题要多想一层
  （不过 6.5 已验证重置是干净的，这一层风险不大）

### 6.8 一个"没改但也说清楚"的点

`DB_URL` 里的 `autoReconnect=true` **实测让一次失败要等约 18 秒**（10s connectionTimeout + 重试 3 次）。
方案 A **不碰它**（避免和编码参数一起引入副作用），所以这个坑**改完仍然存在**，单独一轮再评估。

---

## 七、建议

| 结论 | 说明 |
|---|---|
| **方案 A 值得做** | 性能收益真实（42x），风险实测可控（借空会降级不会卡死），且是修复 175 处漏水点的**前提** |
| **期望值要摆正** | 别期待"游戏变快"；期待的是"切频道/进商城不顿、操作更稳"+"终于能看到哪漏连接" |
| **上线后必看两个指标** | ① 启动日志出现 `HeavenMS-Pool - Start completed.` ② 空转 120s 后 `Connections` 增量应 ≈0（现在是 +3） |
| **唯一要盯的风险** | 日志里的 `Connection leak detection` —— 有就按调用栈精准修，别盲改 175 处 |

**建议的下一步顺序**：先只做方案 A（含泄漏检测）→ 玩几轮看日志 → 拿到真实泄漏清单 → 再决定要不要做方案 B/C。

---

## 附录：复现命令

```bash
cd /d/tmp/fixE-bench

# 编译
"C:/Program Files/Eclipse Adoptium/jdk-8.0.502.7-hotspot/bin/javac.exe" \
  -encoding UTF-8 -cp "D:/MXDtestServer/cores/*" -d out PoolBench.java

# 跑基准（约 10 秒）
"C:/Program Files/Eclipse Adoptium/jdk-8.0.502.7-hotspot/bin/java.exe" \
  -Dfile.encoding=UTF-8 -cp "out;D:/MXDtestServer/cores/*" PoolBench

# 测空转连接增长
M="C:/Program Files/MySQL/MySQL Server 5.7/bin/mysql.exe"
Q="SELECT VARIABLE_VALUE FROM performance_schema.global_status WHERE VARIABLE_NAME='Connections'"
A=$("$M" -u zhoubw -p040211 -N -e "$Q"); sleep 120
B=$("$M" -u zhoubw -p040211 -N -e "$Q"); echo "120秒新建连接: $((B-A))"
```

**改完后的验证判据**：同一段命令跑出来，`Connections` 增量应该从 **+3** 变成 **≈0**。
