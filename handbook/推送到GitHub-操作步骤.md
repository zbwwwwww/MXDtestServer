# 推送到 GitHub —— 操作步骤与注意事项

> 面向本项目（`D:\MXDtestServer`）把仓库推到 GitHub。
> 最后更新：2026-09-23

---

## 一、推送前体检（结论）

| 检查项 | 实测 | 是否合规 |
|---|---|---|
| 当前工作区快照（排除 `北冥GMS083/`、`out/`、`logs/`、`saves/`） | **652.9 MB** | ✅ |
| 快照内最大单文件 | **3.1 MB**（`wz/Etc.wz/Commodity.img.xml`） | ✅ GitHub 单文件硬限 100 MB |
| **现有 git 历史** | **12.1 GB**，70727 个 blob，**11 个文件 > 100 MB**（最大 `北冥GMS083/GMS083_北冥整合版.zip` = **3.39 GB**） | ❌ **push 会被直接拒绝** |

**根因**：历史里早期几次提交把整个客户端（6.5 GB）和编译产物 `out/`、`logs/` 都收进了版本库（当时没有 `.gitignore`）。GitHub 是**按对象而非按分支**校验大小的——只要历史里存在 >100 MB 的对象，push 就会失败：

```
remote: error: File 北冥GMS083/... is 1175.00 MB; this exceeds GitHub's file size limit of 100.00 MB
```

所以**必须先把这些大对象从历史里拿掉**，三选一（见第二节）。

---

## 二、处理历史（三选一）

| 方案 | 做法 | 优点 | 代价 |
|---|---|---|---|
| **A. 重建单提交仓库（推荐）** | 备份旧 `.git` → 删掉 → `git init` → 一次提交 | 最简单、一次成功；仓库只含干净快照 | 丢失现有 6 条提交历史（内容都在当前快照里，旧 `.git` 保留可随时回查） |
| B. 重写历史（git filter-repo / BFG） | 从全部历史中剔除 `北冥GMS083/`、`out/`、`logs/` | 保留提交历史 | 需装额外工具；对 12 GB 仓库操作，耗时 10–30 分钟 |
| C. 只推干净快照到新分支 | `git checkout --orphan main` → 提交 → 推该分支 | 不动本地历史，操作轻 | 远端仓库只有一条提交，本地 master 历史仍在（易混淆） |

> **推荐 A**：目标是"给别人能拉下来就玩"，历史里那 6 条提交（含 GB 级客户端）本来就不该出现在远端。旧 `.git` 改名为 `.git.old` 保留，等确认远端没问题再删。

---

## 三、执行（方案 A 的完整命令）

> ✅ **已于 2026-09-23 执行完成**：
> - 旧 `.git`（含 12 GB 历史）已备份为 `.git.old_with_client/`，并加入 `.gitignore`（注意：曾一度被 `git add -A` 误收，已 `git rm --cached` + amend 修正——以后凡是往 `.git*` 外的目录放备份，先确认 ignore）
> - 新仓库：`main` 分支，单提交 `16705378`；待推送对象 23493 个、共 **641.2 MB**，**无任何 >50 MB 文件**（最大 3.0 MB），符合 GitHub 全部限制
> - 剩余步骤 = 第四节（GitHub 网页建仓）+ 第五节（remote add + push），见下文命令

### 1. 备份旧仓库（可回滚）

```bash
cd /d/MXDtestServer
mv .git .git.old_with_client
```

### 2. 重建干净仓库（工作区已由 `.gitignore` 过滤）

```bash
git init -b main
git add .
git commit -m "init: HeavenMS-zhoubw_083 单机服务端（含 GM 扩展、文档与工具链）"
```

> 提交前可自查体量：`git count-objects -vH`（关注 `size-pack`），或确认 `git status --porcelain` 里没有 `北冥GMS083/`。

### 3. 在 GitHub 网页创建空仓库

1. 打开 https://github.com/new
2. Repository name 自定（如 `heavenms-083-server`）
3. **不要**勾选 `Add a README file` / `.gitignore` / `license`（本地已有，避免冲突）
4. 选 Public 或 Private（Private 也能给指定人访问）
5. 创建后复制仓库地址，形如 `https://github.com/<用户名>/<仓库名>.git`

### 4. 关联远端并推送

```bash
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

- 首次会弹出凭据窗口：**用户名 + Personal Access Token（PAT）**，不能用账号密码
- PAT 生成：GitHub → 右上头像 → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token，勾选 **`repo`** 权限，复制保存（只显示一次）
- 也可改用 SSH：`git remote set-url origin git@github.com:<用户名>/<仓库名>.git`（需先配好 SSH key）

### 5. 推送后核对

```bash
git remote -v            # 确认远端地址
git log --oneline -3     # 确认提交
```

刷新 GitHub 页面，确认文件数与大小正常（仓库 Settings 里能看到体积，应约 650 MB）。

---

## 四、常见报错与对策

| 报错 | 原因 | 对策 |
|---|---|---|
| `File ... exceeds GitHub's file size limit of 100.00 MB` | 历史或当前提交含大文件 | 用第二节方案 A/B 处理后再推 |
| `RPC failed; HTTP 413` / 推送中断 | 一次性传输体积大（~650 MB） | 换 SSH 或提高 `git config http.postBuffer 524288000`；网络差可挂代理，或分次推（先推代码再单独推 wz） |
| `Failed to connect to github.com` | 网络受限 | 配代理：`git config --global http.proxy http://127.0.0.1:<端口>` |
| `fetch first` / `non-fast-forward` | 远端已有内容（建仓库时勾了 README） | `git pull --rebase origin main` 后重推，或删远端仓库重建 |
| `LF will be replaced by CRLF` | Windows 换行符转换提示 | 只是警告，不影响内容，可忽略 |
| 仓库超过 1 GB 收到 GitHub 提醒 | 仓库偏大 | 本项目约 650 MB，正常不会触发；若后续 wz 继续膨胀可考虑把 `wz/` 也改为外部下载 |

---

## 五、日常更新流程（推完之后）

```bash
cd /d/MXDtestServer
git status               # 看改了什么
git add -A
git commit -m "说明"
git push
```

> 铁律提醒：`gm_menu.js` 与 `9010000.js` 必须字节级一致（用 `tools/gen_gm_menu.py` 重新生成），提交前建议在 `tools/` 里跑一遍生成器确认产物无意外差异。

---

## 六、相关文档

- `README.md` —— 环境要求、启动步骤、GM 功能、改动清单
- `.gitignore` —— 已排除客户端 / 编译产物 / 存档 / 备份 / 日志
- `handbook/开发避坑清单.md` —— 改代码生效规则（双产物、重启、脚本重开客户端）
