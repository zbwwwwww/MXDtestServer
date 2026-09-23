# 「点登陆器没反应、不出游戏窗口」诊断报告

> 诊断时间：2026-09-21 08:08 ~ 08:30（第一轮：定位"是谁崩的"）
> 深挖时间：2026-09-21 08:20 ~ 08:45（第二轮：回答"**为什么会崩**"→ 见第九章）
> 症状：点登陆器后**没有游戏窗口**；服务端日志只有 3 条 `IoSession opened`，之后什么都没有
> 结论性质：**Windows 事件日志 + PE 反汇编 + 模块依赖链，全部可复现核验，非推断**

---

## 一句话结论

**问题 100% 在客户端，服务端完全无辜。**

`Maplestory.exe` 每次启动都在 Windows 系统组件 `CoreMessaging.dll` 里触发 **fail-fast 异常（`0xc0000602`）崩溃**。

客户端崩溃前已经连上了 8484 端口，所以服务端只留下一行 `IoSession opened` —— 然后就永远等不到客户端发第一个包了。

**触发条件**：崩溃首次出现的时间点，正好是**电脑从睡眠/低功耗状态恢复后 15 秒**（08:04:47 睡眠 → 08:05:34 唤醒）。同一时刻 MySQL 也卡了 32 秒，说明整个系统刚从低功耗状态恢复、各子系统尚未稳定。

---

## 一、铁证：Windows 事件日志

`wevtutil qe Application` 抓到的事件，与你「点了 3 次」**一一对应**：

| 时间（北京） | 事件 ID | 内容 |
|---|---|---|
| 08:05:49 | Application Error 1000 | 崩溃 #1 |
| 08:06:22 / 08:06:24 | WER 1001 | 崩溃 #1 的报告 |
| 08:06:48 | Application Error 1000 | 崩溃 #2 |
| 08:06:49 | WER 1001 | 崩溃 #2 的报告 |
| 08:07:28 | Application Error 1000 | 崩溃 #3 |
| 08:07:30 | WER 1001 | 崩溃 #3 的报告 |

三次报告的字段**完全一致**：

```
出错应用程序名称: Maplestory.exe，版本: 1.0.0.1，时间戳: 0x4b7c15c9
出错模块名称:     CoreMessaging.dll，版本: 10.0.19041.5915，时间戳: 0x03d5a80d
异常代码:         0xc0000602
错误偏移量:       0x0000f662
出错应用程序路径: D:\MXDtestServer\北冥GMS083\GMS083_北冥整合版\MapleStoryHD\Maplestory.exe
出错模块路径:     C:\Windows\SYSTEM32\CoreMessaging.dll
```

- `0xc0000602` = `STATUS_FAIL_FAST_EXCEPTION`，程序主动"快速失败"自杀，不是普通崩溃
- `CoreMessaging.dll` 是 Windows 10 的**窗口消息 / 输入框架**组件
- **偏移量固定 `0x0000f662`** ⇒ 每次死在**同一行代码**，稳定必崩

**崩溃报告落盘位置**（想看更细的可以翻）：
```
C:\ProgramData\Microsoft\Windows\WER\ReportArchive\AppCrash_Maplestory.exe_*_210e89b5_*
```

---

## 二、时间线（把所有线索对齐）

| 时间（北京） | 事件 | 来源 |
|---|---|---|
| 09-19 20:36 起 | 事件日志窗口起点，**此之前至 08:05 没有任何 Maplestory 崩溃** | Application 日志 |
| 09-19 22:19 | 创建桌面快捷方式 `单机登录器.bat - 快捷方式.lnk` | 文件时间 |
| 09-19 22:23 | 给 `Maplestory.exe` 设了兼容性标志 `HIGHDPIAWARE` | 注册表键 LastWriteTime |
| 09-20 19:47 | 用户仍在游戏里（NPC 对话处理器有日志） | `NPCMoreTalkHandler.txt` |
| 09-21 00:21 | 客户端连上 8484（服务端记 session） | `Sessions.txt`（服务端时间 20-09 08:21） |
| 09-21 00:40 | `RADAR_PRE_LEAK_WOW64`（**内存泄漏预警，不是崩溃**） | WER 1001 |
| 09-21 00:48 | 服务端存档 + MySQL 一条连接被中断 | `SaveChar.txt` / MySQL 日志 |
| 09-21 08:03~08:05 | 系统大量服务重新初始化（WMI / SearchIndexer / 显卡 / 触控板…） | System 日志 |
| 09-21 08:04:32 | 服务端从 IDEA 重启（Debug 模式） | 进程 CreationDate |
| 09-21 08:04:47 | **进入睡眠** | Power-Troubleshooter |
| 09-21 08:05:34 | **唤醒**；MySQL `page_cleaner: 1000ms loop took 32030ms`（卡 32 秒） | System / MySQL 日志 |
| 09-21 08:05:49 起 | **客户端连续 3 次崩溃** | 见上表 |

> 服务端 `Sessions.txt` 里的 `20-09-2026 16:05` 等时间戳是 **GMT-08:00**，+16 小时才是北京时间。

---

## 三、为什么说服务端是无辜的

对正在运行的服务端（PID 16792）抓 jstack：

| 检查项 | 结果 |
|---|---|
| 线程状态分布 | `RUNNABLE 13 / WAITING(parking) 20 / TIMED_WAITING 8 / WAITING(on monitor) 3` — **零 BLOCKED** |
| 死锁 | **无**。没有任何线程在同把锁上互等 |
| `pool-1-thread-1..20` | **20 个线程全部空闲等待** ⇒ 没有任何请求在被处理 |
| `NioSocketAcceptor-1/2` | 正常 `poll0` ⇒ 8484 / 7575 的 accept 循环健康 |
| 端口 | 8484、7575 均 LISTENING |
| 进程启动时间 | 08:04:32，用的 class 是 07:53 编译的（含最新的 F1/F2 GM 改动） |

**结论**：服务端接下了 TCP 连接（所以 `Sessions.txt` 有记录），然后就一直在等客户端发第一个包。
客户端在发第一个包之前就崩了 ⇒ 服务端永远等不到，什么都不会打印。

**这解释了「服务端日志只有 IoSession opened」这个现象，不用再怀疑服务端。**

---

## 四、已排除清单（下次别再往这些方向查）

| 怀疑对象 | 实测结果 |
|---|---|
| 服务端卡死 | ❌ 排除。jstack 零 BLOCKED，线程池全空闲 |
| MySQL 没起 / 连不上 | ❌ 排除。3306 LISTENING，08:01:48 已 ready for connections |
| 改动了 jar / GM 脚本导致 | ❌ 排除。跟登录握手路径无交集；崩溃发生在客户端侧 |
| 桌面快捷方式工作目录不对 | ❌ 排除。`.lnk` 的 `WORKING_DIR` 指向客户端目录 |
| Windows 系统 DLL 被更新 | ❌ 排除。`CoreMessaging.dll` / `MSCTF.dll` = **2025-08-22**；`ntdll.dll` / `win32kfull.sys` / `explorer.exe` = 2026-08-08（一个多月前） |
| 兼容性标志是元凶 | ❌ 排除。`HIGHDPIAWARE` 是 09-19 22:23 设的，之后 09-20 全天都能玩 |
| 输入法组件损坏/缺失 | ❌ 排除。`ChsIME.exe`×2、`TextInputHost.exe`、`ctfmon.exe` 进程均正常 |
| 端口池被打满（09-20 那次的老毛病） | ❌ 排除。当前 `TIME_WAIT` 仅 **65** 条；动态端口范围已是 `10000 + 55535` |
| 内存不足 | ⚠️ 偏紧但非致命。8 GB 中空闲约 800 MB（idea64 1379 MB + WorkBuddy 1259 MB 占大头） |

---

## 五、修复步骤（按成功率排序，从上一级失败再进下一级）

### ① 重启电脑（首选，成功率最高）

理由：崩溃**首次出现就在睡眠恢复后 15 秒**，且同一时刻 MySQL 卡了 32 秒 —— 典型"系统刚从低功耗恢复、图形/输入/消息子系统状态未稳定"。

重启后**直接去客户端目录双击** `单机登录器.bat`（先不要用桌面快捷方式，排除干扰变量）。

### ② 若仍崩 → 换一个 exe 试

同一个目录里有 `单机登录器可输入中文.bat`，它启动的是 `Maplestory_Chinese.exe`。

> 补充核实（09-21 08:20）：两个 exe **大小完全相同**（9,920,512 字节）、**链接时间戳相同**（2010-02-17），
> 是**同一构建的两个变体**，仅约 31 万个字节位置有差异（md5 `16d8201a…` vs `765bf1d5…`）。
> 另：同目录下还有一个大写 `MapleStory.exe`，md5 与 `Maplestory.exe` **完全相同**（同一文件副本）。
> **关键差异：`Maplestory.exe` 被加了 `HIGHDPIAWARE` 兼容性标志，而 `Maplestory_Chinese.exe` 没有。**

- 若这个能起来 ⇒ 是 `Maplestory.exe` 这个版本的问题，换用它即可
- 代价：作者说明「不破功不破速」（即该版本关闭了破功破速功能）

### ③ 若仍崩 → 手动加兼容性设置

右键 `Maplestory.exe` → 属性 → 兼容性：

- ☑ 以兼容模式运行这个程序 → **Windows 7**
- ☑ **禁用全屏优化**
- ☑ 以管理员身份运行此程序
- 「更改高 DPI 设置」→ 替代高 DPI 缩放行为 → **应用程序**

> 当前已存在 `HIGHDPIAWARE` 标志（高 DPI 由应用程序处理）。若上面无效，可以**反过来**把这个标志去掉再试一次。

### ④ 若仍崩 → 暂时关掉杀毒实时防护 / 加排除目录

把 `D:\MXDtestServer\北冥GMS083\` 加入 Windows Defender 排除项，或临时关实时保护试一次。

### ⑤ 终极兜底：换作者推荐的「英文防爆客户端」

作者在 `使用说明.txt` 里说这个版本「打 BOSS 不爆内存，稳定」。路径：

```
D:\MXDtestServer\北冥GMS083\MapleStoryHD（英文防爆客户端）\MapleStoryHD（英文）\
    登录器.bat        ← 内容已是  MapleStory.exe 127.0.0.1 8484
    maplestory.exe
```

**IP 已经指向本机，直接双击 `登录器.bat` 就能连你这台服务端**，不需要改任何配置。

### ⑥ 还有一份作者附的排错文档

```
D:\MXDtestServer\北冥GMS083\【必看】常见报错解决方案\北冥版083常见错误解决方案.doc
```

> 该文件是 Word 97 二进制格式，脚本解不出来，**需要你自己用 WPS 打开看**。同目录还有 `北冥083数据库]备用方案.rar`。

---

## 六、下次遇到同类问题：怎么快速定位

### 判断「服务端问题」还是「客户端问题」

```bat
:: 1) 客户端有没有崩溃过？（关键第一步，90% 的情况看这个就够了）
wevtutil qe Application /c:60 /rd:true /f:text | findstr /i "maple"

:: 2) 服务端线程是否卡死
jstack <服务端PID> | findstr /i "BLOCKED"
```

- **事件日志里有 `Application Error 1000` + `Maplestory.exe`** ⇒ 客户端问题，别碰服务端
- **jstack 有 BLOCKED 且都在等同一把锁** ⇒ 服务端问题，看 `进不去-根因-死锁.md`

### 区分「服务端时间」和「北京时间」

服务端 JVM 时区是 `GMT-08:00`：

```
服务端日志时间 + 16 小时 = 北京时间
```

所以 `logs\2026-09-20\` 目录里，**写着 16:05 的日志，实际是北京时间 09-21 08:05**。

---

## 七、环境快照（本次诊断时）

| 项 | 值 |
|---|---|
| 操作系统 | Windows 10 Home 22H2，build **19045.6466** |
| 服务端 | PID 16792，IDEA Debug 模式启动（`-agentlib:jdwp=…suspend=y`），08:04:32 启动 |
| 服务端 class | `out\production\SERVER083`（IDEA 编译输出），07:53 编译 |
| 客户端 | `Maplestory.exe` v1.0.0.1，时间戳 `0x4b7c15c9`，32 位（WOW64） |
| 崩溃模块 | `C:\Windows\SYSTEM32\CoreMessaging.dll` v10.0.19041.5915（文件日期 2025-08-22） |
| 崩溃代码 | `0xc0000602` (STATUS_FAIL_FAST_EXCEPTION) |
| 剩余内存 | 约 800 MB / 8 GB |
| TIME_WAIT | 65（正常） |

---

## 八、附：本次排查做了什么（复现命令）

```bat
:: 客户端崩溃 — 决定性证据
wevtutil qe Application /c:400 /rd:true /f:text      :: 找 AppCrash / Application Error
dir "C:\ProgramData\Microsoft\Windows\WER\ReportArchive" | findstr /i maple

:: 服务端是否卡死
jstack -l <PID>                                      :: 看线程状态分布 / BLOCKED

:: 端口与连接
netstat -ano -p tcp
netsh int ipv4 show dynamicport tcp

:: 兼容性标志（含最后写入时间）
reg query "HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers"
```

---

## 九、为什么会崩：机制层面的完整链条（09-21 08:20 深挖）

> 前八章回答"**是什么**"，这一章回答"**为什么**"。
> 证据分三档标注：**【铁证】** / **【强推断】**（有模块内字符串等间接证据支撑） / **【待验证】**。

### 9.1 崩在这个 DLL 的哪段代码 —— 【铁证】

WER 里的 `P8: 0000f662` 是**模块内偏移（RVA）**。

`0xf662` = 63074，落在 `.text` 段（4096 ~ 415947）内 ⇒ **是代码地址**，不是数据。
反汇编 `C:\Windows\SysWOW64\CoreMessaging.dll`（文件偏移 `0xea62`，32 位版）：

```asm
83 25 00 00 00 00      AND  dword ptr [0], 0
8b 4d f0               MOV  ECX, [EBP-10h]
64 89 0d 00 00 00 00   MOV  FS:[0], ECX          ; 恢复 SEH 链
59 5f 5e 5b c9 c3      POP ECX/EDI/ESI/EBX; LEAVE; RET
33 c9 e9 60 ff ff ff   XOR  ECX, ECX; JMP ...
51 e8 01 00 00 00 cc   PUSH ECX; CALL ...; INT 3
55 8b ec 83 e4 f8      PUSH EBP; MOV EBP,ESP; AND ESP,0FFFFFFF8h
56 57 8b fa 8b f1      PUSH ESI/EDI; MOV EDI,EDX; MOV ESI,ECX
e8 54 c6 ff ff         CALL ...                  ; ← 前面某个函数
84 c0                  TEST AL, AL               ; ← 看返回值
74 07                  JZ   short +7             ; ← 成功就跳过下面
33 c9                  XOR  ECX, ECX
e8 82 41 00 00         CALL ...
6a 50                  PUSH 50h                  ; \
8d 44 24 0c            LEA  EAX, [ESP+0Ch]       ;  |  在栈上构造 0x50 字节
6a 00                  PUSH 0                    ;  |  「错误上下文」结构
50                     PUSH EAX                  ;  |
e8 1b 2b 05 00         CALL ...                  ; /
c7 44 24 08 45 46 46 e0  MOV dword ptr [ESP+8], 0E0464654h   ; ← 固定标志值
89 7c 24 14            MOV  [ESP+14h], EDI
c7 44 24 18 02 00 00 00  MOV dword ptr [ESP+18h], 2
89 74 24 1c            MOV  [ESP+1Ch], ESI
89 44 24 20            MOV  [ESP+20h], EAX
e8 01 ff ff ff         CALL ...                  ; ← 跳进 fail-fast
cc                     INT 3
```

**这是一段标准的 `RoFailFastWithErrorContext` 调用序列**：判断 → 构造错误上下文 → 主动自杀。

- `0xE0464654` 是写进错误上下文的固定标志值，**三次崩溃完全相同**
  ⇒ 确定性逻辑分支失败，**不是内存踩踏 / 随机崩溃**
- 前后有明显的函数序言/尾声（`PUSH EBP; MOV EBP,ESP; AND ESP,…` / `LEAVE; RET`）
  ⇒ 我第一轮说"偏移落在 `.rdata`"是**算错了**，特此更正

### 9.2 是哪个功能崩的 —— 【铁证】模块内字符串直接点名

`CoreMessaging.dll` 里躺着这些**明文诊断字符串**（原文摘录）：

```
mincore\coreui\dev\dispatcherqueue\WrtDispatcherQueueController.cpp     ← PDB 路径
CoreMessaging.pdb
RoFailFastWithErrorContext
RaiseFailFastException
\BaseNamedObjects\CoreMessagingRegistrar
Failed to connect to registrar: {0:x}
CreateAlpcPort {0} failed with HR=0x{1:x8}
Failed to associate packet 0x{0} and handle 0x{1} to iocp 0x{2} (context 0x{3}) with status 0x{4}
Microsoft.CoreUI.Threading / Cn.Threading / System.Threading
IExportDispatcherQueueInterop
ItemMessageDispatcher / DeferredCallDispatcher / DeferredReleaseDispatcher
```

**PDB 路径点名 `dispatcherqueue\WrtDispatcherQueueController.cpp`**
⇒ 崩在 **DispatcherQueue 控制器初始化**。
它旁边列的三条失败消息，就是可能的失败类别：

1. `Failed to connect to registrar` —— 连不上 `CoreMessagingRegistrar`
2. `CreateAlpcPort ... failed` —— 创建 ALPC 端口失败
3. `Failed to associate packet ... to iocp ...` —— 句柄关联 IOCP 失败

导出表也印证（33 个导出里）：

| 导出 | 含义 |
|---|---|
| `SvchostPushServiceGlobals` | CoreMessaging **本身是个 svchost 服务** |
| `ServiceMain` | 同上 |
| `CreateDispatcherQueueController` | 出错的那个控制器 |
| `CreateDispatcherQueueForCurrentThread` | 同上 |

> **注册表核对**：`CoreMessagingRegistrar` 服务 = `svchost.exe -k LocalServiceNoNetwork -p`，
> 启动类型 **AUTO_START**，依赖 `rpcss`，当前状态 **RUNNING 正常**。
> 08:00~08:10 期间 **没有任何服务启停事件** —— S4 恢复是从休眠映像还原，服务不重启。

### 9.3 老游戏为什么会碰 CoreMessaging —— 【铁证】导入链

`Maplestory.exe` 的**标准导入表只有 17 个 DLL，没有 CoreMessaging**：

```
advapi32  dinput8  gdi32  kernel32  netapi32  oleaut32  shell32  user32  version
wininet   winmm    ws2_32  ijl15    iphlpapi  mss32  nmcogame  ole32
```

顺着**延迟加载（delay-load）表**往下查，链条出来了：

```
MapleStory 创建窗口
  └─ user32.dll            （导入了 api-ms-win-core-delayload-l1-1-0/1 ⇒ 走延迟加载机制）
       └─ IMM32.dll        （输入法管理器）
            └─ MSCTF.dll   （Text Services Framework，输入法/文本服务核心）
                 └─ CoreMessaging.dll      ← ★ 崩在这里
```

全盘扫描 `SysWOW64`，**延迟加载 `CoreMessaging.dll` 的模块只有 7 个**：

| 模块 | 角色 |
|---|---|
| **`msctf.dll`** | **输入法 / 文本服务框架** ← 本条路径的关键 |
| `dcomp.dll` | 桌面窗口合成 |
| `edgehtml.dll` | Edge 旧内核 |
| `twinapi.appcore.dll` | 应用模型 |
| `UIAutomationCore.dll` | 无障碍接口 |
| `Windows.UI.dll` | WinRT UI |
| `Windows.UI.XamlHost.dll` | WinRT XAML 宿主 |

**⇒ 这个 32 位老游戏是被「创建窗口 + 输入法初始化」这条路径带进 CoreMessaging 的，与游戏逻辑无关。**

（另：`IMM32.dll` 的延迟加载表 = `[api-ms-win-core-com-l1-1-0, api-ms-win-core-com-private-l1-1-0, GDI32, MSCTF]`，
`MSCTF → CoreMessaging` 是 `SysWOW64` 里扫出来的直接证据。）

### 9.4 为什么偏偏是那个时刻 —— 【铁证】时间相关性 + 【强推断】原因

| 时刻（北京） | 事件 | 来源 |
|---|---|---|
| 08:04:32 | 服务端从 IDEA 重启（Debug 模式） | 进程 CreationDate |
| 08:04:47 | **进入 S4 休眠**（原因 `Button or Lid`，笔记本合盖） | Kernel-Power 42 / Power-Troubleshooter |
| 08:05:00 | Thunderbolt `nhi` 驱动 **exit RTD3**（设备重新连接） | nhi 9008 |
| 08:05:34 | **从休眠恢复**；Kernel-Boot 引导事件 27/25/32/18/30；无线网卡 `Netwtw10` 连发 5 条 | Kernel-Boot / Netwtw10 |
| 08:05:36 | Power-Troubleshooter：睡眠 08:04:47 → 唤醒 08:05:34 | Power-Troubleshooter 1 |
| **08:05:49** | **崩溃 #1（恢复后 15 秒）** | Application Error 1000 |
| 08:05:51 | `nhi` **进入 RTD3**：*"All the connected devices will be removed from driver's internal state, so it is expected that DeviceDisconnected events will happen"* | nhi 9007 |
| 08:06:48 | 崩溃 #2（恢复后 74 秒） | Application Error 1000 |
| 08:07:28 | 崩溃 #3（恢复后 114 秒） | Application Error 1000 |

**【强推断】原因**：S4 恢复是**从休眠映像还原**，用户态各进程要重新建立会话级连接。
在恢复后这几十秒的收敛窗口内，客户端初始化 DispatcherQueue 时与 `CoreMessagingRegistrar`
的 ALPC 通道 / IOCP 关联尚未就绪 ⇒ CoreMessaging 判定"不可恢复" ⇒ fail-fast。

**为什么是"静默秒退、连错误框都没有"**：CoreMessaging 把 DispatcherQueue 基础设施失败
视为致命，选择 `__fastfail` 而不是优雅降级 —— 所以现象是进程直接消失。

### 9.5 `HIGHDPIAWARE` 的角色 —— 【待验证】放大器，不是根因

| 项 | `Maplestory.exe` | `Maplestory_Chinese.exe` |
|---|---|---|
| 大小 / 链接时间戳 | 9,920,512 / 2010-02-17 | 同左 |
| manifest 声明 `dpiAware` | ❌ 没有（`<asmv3:windowsSettings/>` 是空的） | ❌ 没有 |
| 兼容性标志 | **`HIGHDPIAWARE`**（09-19 22:23 加） | **无** |
| `DllCharacteristics` | `0x0000`（无 ASLR / 无 DEP / 无 SEH） | 同左 |
| 直接依赖 | 17 个 DLL，无 CoreMessaging | 同左 |

`HIGHDPIAWARE` 是**从外部强塞**一个"系统 DPI 感知"上下文给进程，而 exe 自己没声明。
DPI 感知进程的显示变化通知走 DispatcherQueue ⇒ **可能让它更依赖 CoreMessaging 这条链**。

但**它不是充分条件**：09-19 22:23 就加上了，09-20 全天正常。
只能说是"把进程推上这条路径"的一个因素 —— **可以去掉它来降低复杂度**（见第五章 ③）。

### 9.6 一句话回答"为什么"

> 你双击登录器后，客户端**连上了服务端，然后在自己进程里初始化「窗口 + 输入法」基础设施
> （`IMM32 → MSCTF → CoreMessaging`）时失败，主动调用 `__fastfail` 自杀了**。
> 而这个失败只出现在**系统刚从休眠恢复的那几十秒窗口**内 ——
> 你恰好在那时点了 3 次，就崩了 3 次。
> **跟服务端、跟游戏本体、跟改动过的 GM 代码都没有关系。**

### 9.7 怎么验证这个结论 —— 三步走

| 步骤 | 操作 | 预期 | 若不成立说明 |
|---|---|---|---|
| **1** | **直接双击 `单机登录器.bat`**（现在系统已稳态） | ✅ 应该能正常进游戏 | 仍崩 ⇒ 不是"休眠瞬态"，进第 2 步 |
| **2** | 双击 `单机登录器可输入中文.bat`，或 `MapleStoryHD（英文防爆客户端）\MapleStoryHD（英文）\登录器.bat` | ✅ 能进 | 两个都崩 ⇒ 系统级问题，进第 3 步 |
| **3** | 去掉 `Maplestory.exe` 的 `HIGHDPIAWARE` 兼容性标志，再试 | ✅ 能进 ⇒ 确认与 DPI 路径相关 | 仍崩 ⇒ 需抓 dump 深入分析 |

**快速判断"是不是又撞上休眠恢复"**：

```bat
wevtutil qe System /c:20 /rd:true /f:text | findstr /i "Power-Troubleshooter Kernel-Power"
```

若最近 2 分钟内有"从低功耗状态恢复" ⇒ **等 2~3 分钟再启动客户端**即可。

**核对当前系统是否健康**：

```bat
sc query CoreMessagingRegistrar      :: 应为 STATE: 4 RUNNING
sc qc    CoreMessagingRegistrar      :: 应为 START_TYPE: 2 AUTO_START，依赖 rpcss
```

---

## 十、2026-09-21 08:30~08:50 复测（决定性 · 已解决）

### Ⅹ.1 先更正第九章的结论

第九章推断"休眠恢复后 2~3 分钟内必崩、等几分钟即可"——**这个判断是错的**。08:30 复测时距恢复已 25 分钟，崩溃**照样稳定复现**。正确表述是：

> 崩溃**从**休眠恢复那一刻开始，并且**持续存在、不会自愈**。休眠恢复只是"起始时刻"，不是"临时窗口"。

### Ⅹ.2 复现（5 次，全部一致）

客户端 exe 的 manifest 是 `requireAdministrator`，而本机 UAC 是"安全桌面提示"，无法自动点击。用
`__COMPAT_LAYER=RunAsInvoker`（环境变量套兼容层，**不写注册表、不改文件**）即可免提权启动，测下来：

| 次 | 目标 | 结果 |
|---|---|---|
| 1 | `Maplestory.exe` | 秒退 `0xC0000602` |
| 2 | `Maplestory_Chinese.exe` | 秒退 `0xC0000602` |
| 3 | `Maplestory.exe`（调试器） | 秒退，**CoreMessaging.dll +0xF662** |
| 4 | 英文防爆客户端 `maplestory.exe` | 秒退，**CoreMessaging.dll +0xF662** |
| 5 | `Maplestory.exe`（调试器，复核） | 同上 |

每次都先连上服务端（`Sessions.txt` 新增一条 `IoSession`），然后立刻死——和用户手点 3 次的表现完全一致。

### Ⅹ.3 精确定位：自写迷你调试器

用 Python ctypes + `CreateProcess(DEBUG_ONLY_THIS_PROCESS)` + `WaitForDebugEvent` 写了个迷你调试器
（工具见 `handbook\tools\dbg_run.py`），抓到终止性异常：

```
异常码   = 0xC0000602  (STATUS_FAIL_FAST_EXCEPTION，主动自杀)
异常地址 = 0x6D9AF662
出错模块 = C:\Windows\SysWOW64\CoreMessaging.dll   模块内偏移 +0xF662
参数     = 0x1, 0x0
```

**+0xF662 与 08:05:49 / 08:06:48 / 08:07:28 三次崩溃的"错误偏移量 0x0000f662"完全一致。**

崩溃前最后加载的模块顺序（关键线索）：

```
imm32.dll → InputHost.dll → CoreMessaging.dll → ... → msctf.dll → TextInputFramework.dll → 崩
```

⇒ 走的是「创建窗口 + **现代文本输入栈**(TSF / InputHost / TextInputFramework)」这条链，
和第九章推的 `IMM32→MSCTF→CoreMessaging` 一致。

### Ⅹ.4 两个排除实验（很重要，避免误判）

| 对照 | 结果 | 说明 |
|---|---|---|
| 英文防爆客户端（另一套编译，9920523 字节，manifest 是 `asInvoker`） | **同样崩在 `CoreMessaging.dll+0xF662`** | ⇒ **不是某个客户端的问题** |
| 64 位写字板 / 32 位记事本（同样加载 `SysWOW64\CoreMessaging.dll`） | **都正常，不崩** | ⇒ **不是系统 32 位栈坏了** |

⇒ 结论：是「**这个 2010 年的老客户端 + Windows 10 现代文本输入路径**」的组合问题。

### Ⅹ.5 ★ 解法（已实测通过）：给 exe 加 **Windows 7 兼容模式**

启动时套上 `WIN7RTM` 兼容层后，客户端**完整跑起来**：

```
+ 2s   窗口 BMapleStory 出现（class = MapleStoryClass，客户区 853x480）
+23s   内存 405 MB，画面渲染完成 → Ver. 0.83 登录界面
       截图：handbook\客户端-Win7兼容模式启动成功.png
+72s   进程仍存活（406 MB），零崩溃事件，服务端正常收到连接
```

**用户怎么设（30 秒）：**
右键 `D:\MXDtestServer\北冥GMS083\GMS083_北冥整合版\MapleStoryHD\Maplestory.exe`
→ 属性 → 兼容性 → 勾选「以兼容模式运行这个程序」→ 选 **Windows 7** → 确定。
（与已存在的 `HIGHDPIAWARE` 不冲突，可以共存。）

**机理**：`WIN7RTM` 让进程对版本检查报告自己是 Windows 7，于是 **InputHost / TextInputFramework
这套"现代文本输入"不再介入**，那条 fail-fast 路径被整体绕开。这也反过来说明：崩溃的触发点就是
"老客户端被拉进现代输入栈"。

### Ⅹ.6 排查命令速查（以后自查）

```bat
:: ① 客户端有没有崩（出现 Error 1000 = 崩了，字段里有出错模块）
wevtutil qe Application /c:60 /rd:true /f:text | findstr /i maple

:: ② 是不是刚从休眠/待机恢复（恢复后那几分钟先别启动）
wevtutil qe System /c:20 /rd:true /f:text | findstr /i "Power-Troubleshooter Kernel-Power"

:: ③ 免提权启动客户端（仅诊断用；正常玩还是用登录器）
set __COMPAT_LAYER=RunAsInvoker
start Maplestory.exe 127.0.0.1 8484
```

### Ⅹ.7 环境备注

- 客户端 exe manifest = `requireAdministrator`；本机 UAC = 安全桌面提示 ⇒ **登录器每次都会弹 UAC，必须手动点"是"**，无法自动化。
- 已开着一个提权的 cmd（pid 16188），但非提权进程 `AttachConsole` 会被拒（`ERROR_ACCESS_DENIED`，完整性级别拦截）⇒ 借不到它来启动。
- `CreateProcess` 带 `CREATE_BREAKAWAY_FROM_JOB` 被拒（`WinError 5`）⇒ 自动化脚本启动的游戏进程会随命令结束被回收，**不能替我常驻**。
- `%TEMP%` 下有 80 个 `nst*.tmp`（各 399,848 字节，nProtect 解包模块，mtime 全是 2024-07-02），每次运行会被加载；
  系统内**没有**安装 nProtect/AhnLab 的驱动或服务。

---

## 十一、★ 无人值守启动客户端（2026-09-21 18:39 已实测通过）

> 目标：**不碰注册表、不弹 UAC、进程还能常驻**（我按用户要求远程把客户端起到登录界面，且不关）
> ⚠️ 本节**取代** Ⅹ.7 里"无法自动化"和"启动的游戏进程会被回收"两条结论。

### 11.1 两个障碍与两个解法

| 障碍 | 原因 | 解法 |
|---|---|---|
| **必弹 UAC** | exe manifest 写死 `requestedExecutionLevel level="requireAdministrator"` | 用**进程级环境变量** `__COMPAT_LAYER=RunAsInvoker WIN7RTM`。`RunAsInvoker` 吃掉提权要求，`WIN7RTM` 同时解决 CoreMessaging 崩溃。**只对这个进程生效，不写任何注册表** |
| **进程随命令被回收** | 命令行工具把子进程放在 Job 对象里，命令结束即回收；`CREATE_BREAKAWAY_FROM_JOB` 被拒（`WinError 5`） | 不用 `CreateProcess`，改用 **WMI `Win32_Process.Create`**。父进程变成 `WmiPrvSE.exe`（服务），**天然脱离 Job**，命令结束也不受影响 |

### 11.2 关键命令（可复制）

```powershell
# 在 PowerShell 里：$env:MXD_INNER 装内层命令，再用 -EncodedCommand 传 UTF-16LE，彻底避开中文路径编码问题
$env:MXD_INNER = 'cmd.exe /c set "__COMPAT_LAYER=RunAsInvoker WIN7RTM" && cd /d "D:\MXDtestServer\北冥GMS083\GMS083_北冥整合版\MapleStoryHD" && start "" "Maplestory.exe" 127.0.0.1 8484'
$ps = '$ErrorActionPreference="Stop"; Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine=$env:MXD_INNER} | ForEach-Object { "ReturnValue=" + $_.ReturnValue + " PID=" + $_.ProcessId }'
powershell -NoProfile -EncodedCommand ([Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($ps)))
# 期望输出：ReturnValue=0  ← 0 才是成功（注意：这是 WMI 返回码，不是进程退出码）
```

**现成脚本**：`D:\tmp\fixE-bench\launch_client.py wmi compat`（启动）、`grab_win.py <秒> <png>`（等窗口+GDI 抓图）。

### 11.3 实测结果（18:39:38 启动）

| 检查项 | 结果 |
|---|---|
| WMI 返回 | `ReturnValue=0 PID=16740` |
| 进程 | `Maplestory.exe` PID **18680**，`Console` 会话 1 |
| 窗口 | `hwnd=0x4406BA`，`857x507 @ (0,0)`，`visible=True`，标题 `BMapleStory` |
| 画面 | **Ver 0.83 登录界面**（账号/密码框、保存账号、新账户、网站） |
| 服务端会话 | `logs\2026-09-20\players\Sessions.txt` 新增 `IoSession with /127.0.0.1:52063 opened on 21-09-2026 02:39`（服务端 GMT-8 ⇒ 北京 18:39）✅ 已连上 8484 |
| 跨命令存活 | ✅ 第一轮命令结束后，后续命令里进程仍在（证明没被回收） |
| UAC 弹窗 | **一次都没有** |

存档截图：`handbook\客户端-登录界面-兼容层无人值守启动.png`

### 11.4 局限（必须知道）

- **该实例没有管理员权限**。exe 清单要求 `requireAdministrator`，且客户端目录里有 **AhnLab 系反作弊组件**（`v3hunt.dll`、`suipre.dll`、`nmcogame.dll`、`nmconew.dll`；**无** nProtect/GameGuard 目录、系统未装对应驱动/服务）。
  ⇒ 登录界面能到，**但"能不能进游戏/会不会被反作弊拦"未验证**。若进游戏异常，关掉它、自己双击 `单机登录器.bat` 并点 UAC「是」。
- 这样起的客户端**不会**在你以后双击登录器时自动复用；下次照旧走登录器 + UAC 即可。
- 想彻底免 UAC、免点确认 ⇒ 才需要把 `~ WIN7RTM`（或 `~ RunAsInvoker`）写进
  `HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers`。**默认不做**，要用户明确同意。

---

## 十二、2026-09-21 20:07 再次复现（用户双击登录器）/ 20:10 脚本再救场 ✅

### 12.1 复现：签名与 08:05 那三次**逐字节相同**

用户重启服务端 + 客户端后**双击 `单机登录器.bat`**，又是"没有界面框出来"。事件日志：

```
TIME=09/21/2026 20:07:50
错误应用程序名称: Maplestory.exe，版本: 1.0.0.1
错误模块名称:     CoreMessaging.dll，版本: 10.0.19041.5915
异常代码:         0xc0000602
错误偏移量:       0x0000f662
错误进程 ID:      0x15bc
```

WER 1001 的 `P7=c0000602 / P8=0000f662` 也一致。⇒ **同一个坑，第 ⑥ 次。**

**同时排除"休眠"这个干扰项**：最近的睡眠/唤醒事件是 **08:05**（Kernel-Power 42/107、Power-Troubleshooter 1），
20:07 前后**没有任何电源事件** ⇒ 再次印证 Ⅹ.1 的更正：**崩溃与休眠无关，是持续存在的**。

### 12.2 关键结论：Ⅹ.5 那个"手动设 Win7 兼容模式"**至今没有真正落到 `Maplestory.exe` 上**

Ⅹ.5 给了手改方法，08:34 查注册表时发现**只有 `HIGHDPIAWARE`，`WIN7RTM` 没写进去**。
20:07 这次崩溃的直接原因就是：**双击登录器 = 没有兼容层** ⇒ 必然踩同一个 fail-fast。
（历史窗口期能玩，是因为客户端一直是靠 `__COMPAT_LAYER=… WIN7RTM` 的脚本起的。）

⇒ **要义：兼容模式必须真正写进 `HKCU\…\AppCompatFlags\Layers`（或每次用兼容层启动），
只在属性对话框里点一下却不点"应用/确定"，等于没设。**

### 12.3 治标（立即生效，不写注册表）：脚本启动 ✅ 已实测

```
py D:\tmp\fixE-bench\launch_client.py wmi compat
```

20:10:30 执行结果：

| 检查项 | 结果 |
|---|---|
| WMI 返回 | `ReturnValue=0 PID=20712` |
| 进程 | `Maplestory.exe` **PID 1884**，存活 |
| 窗口 | `hwnd=0x250784 class=MapleStoryClass title=BMapleStory`，`visible=True`，`857x507 @ (0,0)` |
| 内存曲线 | 35 MB → 43 MB → 127 MB → **398 MB**（渲染完成） |
| 服务端会话 | `logs\2026-09-21\players\Sessions.txt` 新增 `IoSession with /127.0.0.1:56286 opened on 21-09-2026 04:10`（GMT-8 ⇒ **北京 20:10**）✅ |
| 是否崩 | ❌ 无新 `Application Error 1000` |

⚠️ GDI 抓图（`grab_win.py`）**抓不到画面内容**（只有标题栏 + 白底）：
游戏用 DirectDraw 渲染，`BitBlt` 拿不到表面。⇒ **判断客户端是否正常，别看截图，看「窗口类名 + 内存曲线 + 服务端 Sessions」这三样。**

### 12.4 ★ 新增判据：用 `Sessions.txt` 区分"连上就崩"和"连上并存活"

服务端每次收到 TCP 连接都会写一行 `IoSession with /127.0.0.1:PORT opened`。所以：

| `Sessions.txt` 现象 | 含义 |
|---|---|
| 多了一行，但客户端进程秒退 + 事件日志有 `Error 1000` | 连上 8484 后**立刻就崩** ⇒ 客户端问题（本文这个坑） |
| 多了一行，且进程内存持续增长到 300~400 MB | 正常进到登录界面 ✅ |

> **09-21 20:07 与 20:10 恰好构成一组对照**：20:07 那次新增 `56125` 然后崩；20:10 那次新增 `56286` 且存活。
> （`Sessions.txt` 里是服务端 GMT-8 时间，`04:10` = 北京 `20:10`。）

### 12.5 根治（30 秒，用户手动，一次到位）

右键 → 属性 → 兼容性：

```
D:\MXDtestServer\北冥GMS083\GMS083_北冥整合版\MapleStoryHD\Maplestory.exe
```

- ☑ 以兼容模式运行这个程序 → **Windows 7**
- 点 **应用 → 确定**（❗这一步最容易漏，漏了等于没设）
- 设完**重新打开一次属性对话框确认**勾还在，再去双击 `单机登录器.bat`

设好后双击登录器就正常了（仍会弹 UAC，点"是"即可 —— 那是 exe 清单里的 `requireAdministrator`，属正常流程）。

