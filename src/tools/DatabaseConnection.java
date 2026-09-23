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
    // 全项目 0 处 new DatabaseConnection()，那个构造器从来没被执行过 ⇒ ds 永远是 null ⇒
    // getConnection() 里的 if (ds != null) 分支永远进不去 ⇒ 每条 SQL 都在 DriverManager 新建连接，
    // 池形同虚设（config.yaml 的 DB_CONNECTION_POOL: true 等于没生效）。
    // 改成静态块：由 JVM 在「首次访问本类」时自动执行，不可能再被忘记调用。
    // ⚠️ 静态块抛出的异常会被 JVM 永久记住（之后任何访问本类都直接 NoClassDefFoundError，
    //    类不会再尝试初始化），所以它「绝不外抛」—— 最坏也只是 ds = null、退回 DriverManager，
    //    即永远不比改之前差。
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
     * [FIX 9] 幂等建池。static 块调用它；Server.init() 也显式调用它。
     * 为什么必须幂等 + 必须由 init() 再调一次：静态块一辈子只执行一次，而服务端「重启」走的是
     * 同一台 JVM 里重新 init()（Server.java:1782 getInstance().init()）—— 类不会重新加载、
     * 静态块也不会再跑。若 closePool() 之后没有显式重建，ds 就永远是 null，又退回静默失效。
     */
    public static synchronized void initPool() {
        if (ds != null) return;                                  // 已经建好 —— 直接返回（幂等）
        if (!YamlConfig.config.server.DB_CONNECTION_POOL) return;

        try {
            Class.forName("com.mysql.jdbc.Driver"); // touch the mysql driver
        } catch (ClassNotFoundException e) {
            System.out.println("[SEVERE] SQL Driver Not Found. Consider death by clams.");
            e.printStackTrace();
            // 不 return：驱动也可能由 META-INF/services 自动注册（cores\mysql-connector-java-bin.jar 内含），
            // 与原来构造器的行为保持一致 —— 继续尝试建池。
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

            config.setPoolName("HeavenMS-Pool");                  // [FIX 4a] 让日志里一眼认出是谁
            config.setConnectionTimeout(10 * 1000);                // [FIX 4b] ★真改动：原 30s（那正好等于 Hikari 默认值，等于从没设过）。
                                                                   //   借不到连接会把请求线程挂死半分钟；池化后连接复用，
                                                                   //   DB_URL 里的 connectTimeout/socketTimeout 是驱动层、管不到「借池」
            config.setValidationTimeout(5 * 1000);                 // 显式声明，与 Hikari 默认值相同（5s）
            config.setMaximumPoolSize(poolSize);
            config.setMinimumIdle(Math.min(4, poolSize));          // [FIX 5] ★真改动：原代码没设 ⇒ 默认 = maximumPoolSize（启动瞬间就建满）
            config.setIdleTimeout(10 * 60 * 1000L);                // 显式声明，与 Hikari 默认值相同（10min）
            config.setMaxLifetime(30 * 60 * 1000L);                // 显式声明，与 Hikari 默认值相同（30min）
            config.setConnectionTestQuery("SELECT 1");             // [FIX 7] 新增：Connector/J 5.1.6（2007 年）的 isValid() 不可靠，绕开它
            config.setLeakDetectionThreshold(15 * 1000L);          // [FIX 8] 新增：借出超 15s 未还 → 打出借用点的完整调用栈
                                                                   //   ⚠️ 硬约束：必须 ∈ [2000ms, maxLifetime)，否则 Hikari 静默禁用它；
                                                                   //   [2000, 15000) 是官方不建议区间（正常长操作会误报）。15s 是合法下限，别往下调。

            config.addDataSourceProperty("cachePrepStmts", true);
            config.addDataSourceProperty("prepStmtCacheSize", 25);
            config.addDataSourceProperty("prepStmtCacheSqlLimit", 2048);

            ds = new HikariDataSource(config);
            System.out.println("[DB] HikariCP connection pool started. pool size " + poolSize + ".");
        } catch (Throwable t) {                                   // [FIX 3] 兜底：建池失败也不能拖垮启动
            ds = null;                                            //   退回改之前的行为（每条 SQL 新建连接）
            System.out.println("[SEVERE] HikariCP pool failed to start, falling back to one connection per query. Reason: " + t.getMessage());
            t.printStackTrace();
        }
    }

    /** [FIX 9] 关服收池，避免 Hikari 管家线程与连接残留。 */
    public static synchronized void closePool() {
        HikariDataSource pool = ds;
        ds = null;                       // 先断引用：之后来的请求直接退回 DriverManager，不会拿到一个正在关闭的池
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
                // 外在表现和「池正常工作」几乎一样（只差几毫秒），根本发现不了。
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
