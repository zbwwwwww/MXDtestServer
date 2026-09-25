/*
 * GM 功能菜单（第 5 轮改版：主菜单扁平化）
 *
 * 入口1（聊天指令）: !run gm_menu
 * 入口2（点 NPC）  : 射手村「冒险岛管理员」(9010000)
 *
 * ⚠️ gm_menu.js 与 9010000.js 必须【字节级一致】，改一个必须同步另一个！
 * ⚠️ 本文件必须存为 UTF-8（服务端已改成显式按 UTF-8 读脚本，2026-09-21 修正）
 * ⚠️ 字符串里的中文必须 GB2312 可编码（封包硬编码 GB2312），别用 emoji
 *
 * ★ 新增功能的规范（2026-09-21 定）：新功能一律【直接加到主菜单末尾】，
 *   #L 编号顺延，不再另开"更多功能"这类二级入口。
 *
 * 用到的 cm / 对象方法都在服务端源码里核对过【存在且 public】：
 *   cm  : sendSimple / sendGetText / getText / gainExp / gainMeso / gainItem(int,short) /
 *         resetStats / dropMessage / warp / dispose / maxJobSkills / changeJobById /
 *         giveSkill(int,int) / warpToMap / gainFame(int) / useItem(int) /
 *         spawnMonster(int,int,int) / getMonsterLifeFactory(int) / getMap() / getPlayer()
 *   chr : pickupItem(MapleMapObject) / updateHpMp(int,int) / getCurrentMaxHp() / getCurrentMaxMp() /
 *         gainSlots(int,int) / getSlots(int) / getPosition() / getLevel() / getJob() /
 *         getHp() / getMp() / Hide(boolean) / isHidden() / isGM() /
 *         getStr() / getDex() / getInt() / getLuk() / getRemainingAp() /
 *         gainAp(int,boolean) / assignStrDexIntLuk(int,int,int,int)
 *   map : getItems() / getAllMonsters() / killAllMonsters() / killMonster(mob,chr,bool) /
 *         clearDrops() / countMonsters() / countAlivePlayers() / getMapName() / getId()
 *   mob : resetMobPosition(Point)
 *
 * 设计要点：
 *   - 顶层菜单选完功能【不关闭对话框】，执行完自动回到主菜单；只有点「关闭菜单」才 dispose
 *   - 需要选择/输入的子流程保留二级：修改职业（大系→职业→手输）、传送地图（类别→地图）、
 *     扩充背包（选栏位）；其余全部直接在主菜单一层完成
 *   - 快捷键（服务端 Java 层实现，见 FaceExpressionHandler）：
 *       F1 = 全屏捡取    F2 = 吸怪
 *
 * 设计要点（2026-09-22 第 6 轮：技能 / 物品改成可点列表）：
 *   - 「学习技能」「获取物品」都是一屏就能看到东西的列表，不用再点一下才出提示：
 *       技能：主菜单 → 选职业组（一屏 13 组）→ 点某一行技能 = 直接练满
 *       物品：主菜单 → 选部位组（一屏 11 组）→ 点某一行物品 = 直接获得
 *     （客户端一个对话框不能同时有「可点列表」和「输入框」，所以手动输入是列表里的
 *       最后一项，点进去才是输入框 —— 这是客户端限制，不是设计选型）
 *   - 列表里一行只放一个 ID + 中文名；行数多时客户端自带滚动条
 *   - 学完 / 拿完【留在原地】继续点，不弹回主菜单；每组都有「返回」和「主菜单」
 *   - 技能窗口只显示【当前职业链】内的技能：★=能显示、○=跨职业看不到（学了也白学，
 *     服务端确实学会了，但客户端 UI 不列出来）—— 菜单里会明确标出来
 *
 * 设计要点（2026-09-22 第 8 轮：新增 10 项 + 一键清背包）：
 *   - 新入口一律【追加到主菜单末尾】，#L 编号顺延，「关闭菜单」保持在最后（现为 #L32#）
 *   - 主菜单已经 31 项，客户端对话框放不下会自带滚动条；需要多步的仍然单独开一屏
 *   - 一键清背包【按栏位分类】，清理前必须二次确认；只清背包栏，绝不动身上装备
 *     （EQUIP 与 EQUIPPED 在服务端是两个独立数组，清 EQUIP 不会脱装备）
 *   - 「按名字搜物品」用的是服务端现成 API getAllItems()，脚本里不存名字表
 *
 * status 编号表（改代码时对着看）：
 *   0  主菜单（初次进入）
 *   1  主菜单选择
 *   2  输入：职业编号          3  技能菜单（选职业组）
 *   4  输入：地图ID            5  大系选择
 *   6  职业选择                7  物品菜单（选部位组）
 *   8  输入：刷怪              9  输入：BUFF 道具ID
 *   10 背包栏位选择            11 属性点菜单
 *   12 输入：四项属性          13 输入：剩余 AP
 *   14 输入：满属性值          15 传送地图菜单
 *   16 地图列表选择
 *   30 技能列表（点一行=练满） 31 输入：技能ID（手动）  32 我学到的技能清单
 *   70 物品列表（点一行=获得） 71 输入：物品ID+数量（手动）
 *   ---- 第 8 轮（2026-09-22）新增 ----
 *   33 输入：经验数值          34 输入：金币数值
 *   35 BOSS 档位选择           36 BOSS 列表（点一行=召唤）
 *   37 特效 / 播报菜单         38 输入：公告文字
 *   39 屏幕特效列表            40 地图特效列表
 *   41 输入：倒计时秒数        42 输入：称号文字
 *   43 背包管理菜单            44 清理二次确认
 *   45 输入：物品名/ID 搜索    46 搜索结果列表
 *   47 召唤怪物-点名列表（101~131，点一行=召唤 / 全部召唤）
 *   48 伤害倍率菜单（×1/×10/×100/×1000，服务端放大实际扣血）
 *   49 召唤怪物-全级别段（选等级段）
 *   50 召唤怪物-某一段内的怪物列表（点一行=召唤一只 / 本段全部召唤 / 换段）
 */

var status = 0;
var family = null;
var curList = null;      /* 当前正在展示的地图列表（HUNT_MAPS / BOSS_MAPS / TOWN_MAPS_ALL） */
var curGroup = 0;        /* 当前正在展示的技能组 / 物品组下标（SKILL_GROUPS / ITEM_GROUPS） */
var curOrder = null;     /* 技能组的显示顺序（本职业链排前面），选择时按下标取 */
var curTier = 0;         /* 当前展示的 BOSS 档位下标（BOSS_TIERS） */
var curMobTier = 0;      /* 当前展示的「召唤怪物-全级别段」档位下标（MOB_TIERS_ALL） */
var curMobPage = 0;      /* 该档位段内列表翻到的页（0 起）；MOB_TIERS_ALL 最大的段有 161 只，不分页得滚半天 */
var MOB_PAGE = 40;       /* 段内列表每页最多显示几只；末三行固定占用 #L 的 MOB_PAGE / +1 / +2 */
var pendingBagType = 0;  /* 待确认清理的背包栏位（0 = 全部，不含装饰栏） */
var curHits = null;      /* 「按名字搜物品」的结果：[[id, 名字], ...] */
var curHitsKw = "";      /* 上一次搜索用的关键字（回显用） */

/* 五大职业系 */
var FAMILIES = ["战士", "法师", "弓手", "飞侠", "海盗"];

/* 每个系的全部子职业：[职业编号, 中文名]
   编号取自服务端 client/MapleJob.java 的枚举，超出的编号会被判为无效 */
var JOBS = {
    "战士": [[100, "战士"], [110, "剑客"], [111, "勇士"], [112, "英雄"],
             [120, "准骑士"], [121, "骑士"], [122, "圣骑士"],
             [130, "枪战士"], [131, "龙骑士"], [132, "黑骑士"]],
    "法师": [[200, "法师"], [210, "火毒法师"], [211, "火毒巫师"], [212, "火毒魔导师"],
             [220, "冰雷法师"], [221, "冰雷巫师"], [222, "冰雷魔导师"],
             [230, "牧师"], [231, "祭司"], [232, "主教"]],
    "弓手": [[300, "弓手"], [310, "猎人"], [311, "游侠"], [312, "神射手"],
             [320, "弩弓手"], [321, "狙击手"], [322, "神弩手"]],
    "飞侠": [[400, "飞侠"], [410, "刺客"], [411, "隐士"], [412, "夜行者"],
             [420, "侠客"], [421, "独行客"], [422, "无影人"]],
    "海盗": [[500, "海盗"], [510, "拳手"], [511, "斗士"], [512, "冲锋队长"],
             [520, "枪手"], [521, "神枪手"], [522, "船长"]]
};

/* 背包栏位类型：[gainSlots 的类型编号, 名字] */
var BAG_TYPES = [[1, "装备栏"], [2, "消耗栏"], [3, "设置栏"], [4, "其他栏"], [5, "装饰栏"]];

/* 一次扩充多少格 */
var BAG_SLOTS_PER_USE = 8;

/* 一次最多刷多少只怪（手滑保护） */
var MAX_SPAWN = 50;

/* 属性点上限，取自 config.yaml 的 MAX_AP */
var MAX_STAT = 32767;

/* 属性每项最低值（服务端 assignStrDexIntLuk 的硬性下限） */
var MIN_STAT = 4;

/* 一次最多处理多少个技能ID / 多少组物品（防手滑） */
var MAX_BATCH = 60;

/* 获取物品时，单组数量上限（gainItem 的数量是 short，别超） */
var MAX_ITEM_QTY = 30000;

/* 一次最多给多少个物品（防止刷爆背包） */
var MAX_ITEM_GROUPS = 20;

/* ================= 地图清单 =================
 * 数据来源：对 wz 全量提取 —— Map.wz/Map/* 的 life 节点拿到每张图的怪物 ID，
 * 再查 Mob.wz/<7位补零ID>.img.xml 的 info/level 得到最高怪等级。共扫了 5262 张图 / 1562 只怪。
 * 结论：本版本常规怪最高 131 级（时间领主-忘却之路4/5），再往上都是 BOSS / 活动图。
 *      ⇒ 所以"150 级以上的练级图"在这个版本里不存在，猎场清单已经铺开到 Lv.100~131 全档。
 * 格式：[地图ID, 显示名, 最高怪等级]（等级 0 = 不显示等级，用于城镇）
 * 地图名已全部过滤为 GB2312 可编码（wz 里大量地图名是韩文，直接进脚本会乱码）
 * 注：这里存放的是合并后的「Lv.100 以上练级场」（原高等级猎场 + Lv.100+ 图，见下）
 */
/* 第 12 轮：BOSS 挑战图改为 wz 全量扫描，行结构变成 [地图ID, 地图名, BOSS数, BOSS名单]
 * 判据（都在 tools/gen_boss_maps.py 里，别凭感觉改）：
 *   1. Map.wz 的 life 节点里刷的怪，在 Mob.wz 里 info/boss != 0（wz 官方的 BOSS 标记）
 *   2. 地图要有 portal（有落脚点，不然传送过去是一片虚空）
 *   3. 地图名能编进 GB2312（封包是 GB2312，韩文地图名进去就乱码）
 * 行尾的 BOSS 名单是给菜单直接看的 —— 传送过去有没有 BOSS，点开就知道。
 */
var BOSS_MAPS = /*@BOSS_MAPS_ALL@*/;

/* 地图列表每页显示几条（BOSS 挑战图有 800+ 张，一次全铺开客户端要卡） */
var MAP_PAGE = 40;

/* 当前页码（换档位时归零） */
var MAP_PAGE_NO = 0;

/* 当前列表的标题，翻页时重新渲染要用 */
var curTitle = "";

/* ================= 技能 / 物品数据 =================
 * 技能组：[职业编号, 组名, [[技能ID, 中文名], ...]]
 *   职业编号 = 0 表示"跨职业组"（永远不会显示在技能窗口里）
 *   数据来源：handbook/GM提示文本-待粘贴.txt + 客户端 String.wz/Skill.img（542 条名表）
 * 物品组：[组名, [[物品ID, 显示名, 单次数量], ...]]
 *   装备显示名带 ★ = 150 级以上 或 GM 专用（维泽特帽）；消耗品单次数量 100/500 这种
 *   物品名来自服务端 String.wz/Eqp.img、客户端 String.wz/Consume.img
 */
var SKILL_GROUPS = [
/*@SKILL_GROUPS@*/
];

/* 全量技能名（"id:名;id:名;..."），给「我学到的技能清单」查名字用 */
var SKILL_NAME_TXT = /*@SKILL_NAME_TXT@*/;

var ITEM_GROUPS = [
/*@ITEM_GROUPS@*/
];

/* ================= 第 8 轮新增数据 ================= */

/* 可召唤 BOSS：3 档 x 12 只
 * 数据来源：服务端 Mob.wz 全量导出（读 info/boss=1，共 477 只）后手工精选，
 *           每条都回查核对过 ID / 名字 / 等级 / 最大HP，不是凭印象写的。
 * 格式：[BOSS ID, 中文名, 等级, 最大HP]
 * 召唤用 map.spawnMonsterOnGroundBelow(id, x, y)：它会自己找下方平台贴地，
 * 所以不用手工算坐标，也不会出现悬空怪。
 */
/* 注意：占位符本身就是完整的数组字面量（含最外层 []），别再套一层 */
var BOSS_TIERS = /*@BOSS_TIERS@*/;

/* 召唤怪物-点名（101~131 级普通怪）：[怪物ID, 中文名, 等级]
 * 数据来源：服务端 Mob.wz 全量导出（info/level 在 101~131）+ String.wz/Mob.img 中文名
 *           本版本 101~131 共 80 只，其中 42 只 BOSS 已有独立「召唤 BOSS」功能，
 *           默认只放普通怪（38 只）；要连 BOSS 一起点名，改 gen 脚本 INCLUDE_BOSS 重生成。
 * 召唤用 map.spawnMonsterOnGroundBelow：自动贴地、自由行动（不冻结）。 */
var MOB_POINTS_101_131 = /*@MOB_POINTS@*/;

/* ================= 第 9 轮新增数据（全级别段召唤 / 传送地图扩充） =================
 * 注意：下面三个占位符本身就是完整的数组字面量（含最外层 []），别再套一层。
 */

/* 城镇全表（含常用 + wz 全量精选）：[地图ID, 显示名, 等级]
 * 第 11 轮起：原来手写的 14 个「常用城镇」已并入这里，与 gen_maps_extra.py 从 wz 出的
 *            90 张精选取并集去重，菜单里只剩这一份城镇列表。
 * 数据来源：Map.wz/Map/* 逐张读 town=1 且本图不带怪（maxlv==0）→ 真城镇 508 张，
 *           再按 streetName 分组、滤掉店铺/活动/重复图，每区留 2 张，得 90 张。
 * 等级列全填 0 = 显示时不带「Lv.」前缀。地图名已过滤为 GB2312 / 纯汉字可编码。 */
var TOWN_MAPS_ALL = /*@TOWN_MAPS_ALL@*/;

/* Lv.100 以上练级场：[地图ID, 显示名, 最高怪等级]
 * 第 10 轮起：原「高等级猎场」(handbook 精选 30 张) 与 gen_maps_extra.py 出的 Lv.100+ 图
 *            (46 张) 已合并进 HUNT_MAPS，按怪等级从高到低排，菜单里一条看全。
 *            ⇒ 本文件不再有单独的 HUNT_MAPS_HIGH，传送菜单里也不再有「高等级猎场」这一档。
 * 数据来源：Map.wz/Map/* 顶层 life 节点里的怪物等级 >= 100 的图，覆盖 Lv.100~200
 *           （本版本常规怪上限 131，再往上基本都是 BOSS / 活动图）。 */
var HUNT_MAPS = [
/*@HUNT_MAPS@*/
];

/* 召唤怪物-全级别段：[[段名, [[怪物ID, 中文名, 等级], ...]], ...]
 * 数据来源：服务端 Mob.wz 全量导出（1562 只）+ String.wz/Mob.img 中文名，
 *           剔除 info/boss != 0 的 BOSS 后剩 1067 只，按 info/level 切成 13 段（Lv.1-10 ~ Lv.121 以上）。
 *           召唤用 map.spawnMonsterOnGroundBelow：自动贴地、自由行动（不冻结）。 */
var MOB_TIERS_ALL = /*@MOB_TIERS_ALL@*/;

/* 屏幕特效（showEffect -> ENVIRONMENT_CHANGE mode=3）
 * 取值全部来自服务端源码 / 官方脚本里【已经在用】的字符串（grep 到 9 个），
 * 不是猜的，客户端一定有对应资源。 */
var SCREEN_EFFECTS = [
    ["组队任务 通关", "quest/party/clear"],
    ["组队任务 失败", "quest/party/wrong_kor"],
    ["椰子 胜利", "event/coconut/victory"],
    ["椰子 失败", "event/coconut/lose"],
    ["道场 通过", "dojang/end/clear"],
    ["道场 开始", "dojang/start/stage"],
    ["竞技场 胜利", "quest/carnival/win"],
    ["竞技场 失败", "quest/carnival/lose"],
    ["太空 开始", "event/space/start"]
];

/* 地图特效（mapEffect -> FIELD_EFFECT，全图可见）
 * "@this" 是特殊标记：脚本会换成 "maplemap/enter/<当前地图ID>"，
 * 也就是"播放进入这张图时的入场动画"。 */
var MAP_EFFECTS = [
    ["进入当前地图（入场动画）", "@this"],
    ["龙族对话 1", "evan/dragonTalk00"],
    ["龙族对话 2", "evan/dragonTalk01"],
    ["反抗者 引导", "resistance/tutorialGuide"]
];

/* 自定义加经验 / 加金币的单次上限（防手滑 + 防 int 溢出） */
var MAX_CUSTOM_EXP = 500000000;
var MAX_CUSTOM_MESO = 500000000;

/* 地图倒计时的可输入上限（秒） */
var MAX_CLOCK_SEC = 3600;

/* 背包清理：清理时不碰的栏位。
 * 装饰栏（5）里常是现金道具/宠物装备，误清损失大，所以「全部清理」把它排除。 */
var SAFE_BAG_TYPES = [5];

/* 「按名字搜物品」一次最多列多少条匹配结果 */
var MAX_SEARCH_HITS = 40;

/* ================= 菜单文本 ================= */

/* 菜单文字的排版规矩（09-25 定死，以后改菜单别破）：
 *   1) 每个可点选项一律写成 "#b#L<n>#文字#k#l\r\n"
 *      —— 结尾的 #l 才是「选项结束」；少了它，后面那行普通文字也会被算进这个
 *         选项的可点区域，现象就是「分区标题和上一行功能一起亮」。
 *      —— #b 统一染蓝，#k 把颜色还原，所以蓝的只有选项本行。
 *   2) 分区标题 / 说明行一律 "#k--- 数值 ---\r\n"，靠 #k 不被染蓝。
 *   3) 别拿 #n 当选项收尾：#n 是在选项内部换行，同样会撑大可点区域。
 *   4) 不要用 #r（红色），整份菜单只有蓝色一种点击色。
 *   5) 【09-25 下午补】光靠 #l 还不够：客户端里一个选项的高亮/点击方块会往下多占
 *      一行，所以「分区标题」这类普通文字行【绝对不能紧贴在上一个选项下面】，
 *      否则标题会被上一行的方块盖住，看着就是"标题和上一行功能重叠/一起亮"。
 *      → 凡是选项行下面紧跟普通文字行的，中间必须插一个空行：
 *          s += "#b#Lx#功能#k#l\r\n";
 *          s += "\r\n";                       ← 空行，去被上一行的方块吃掉
 *          s += "#k--- 分区标题 ---\r\n";
 *      全仓库官方脚本里，"#l" 行后面紧跟普通文字行的情况是 0 例（全是选项），
 *      说明官方也躲着这个坑走。插空行的活儿用 tools/fix_header_gap3.py（已跑过）。
 * 官方 NPC 脚本就是这个写法，例：1300013.js  "#bKing Pepe#k and #bYeti Brothers#k.#l"
 * 校验脚本：tools/check_menu_style.py
 */

/* 主菜单（32 项）。每个功能都在这层，不再有「更多功能」二级入口。
   ⚠️ 新增功能一律【加到末尾】，「关闭菜单」永远是最后一项（现为 #L32#）。
      编号一经发布就不要插队改号 —— 改号会让 dispatch 里的 selection 判断全部错位。 */
function mainMenu() {
    var map = cm.getMap();
    var s = "#e[GM 功能菜单]#n  " + map.getMapName() + "（" + map.getId() + "）\r\n";
    s += "#k--- 数值 ---\r\n";
    s += "#b#L0#加经验 100 万#k#l\r\n";
    s += "#b#L1#加经验 1 亿（直接升级）#k#l\r\n";
    s += "#b#L2#加金币 1 亿#k#l\r\n";
    s += "#b#L3#洗属性点（重置为初始属性）#k#l\r\n";
    s += "#b#L4##b修改属性点（自定 STR/DEX/INT/LUK）#k#l\r\n";
    s += "#b#L5#满技能（本职业全部技能练满）#k#l\r\n";
    s += "#b#L6#加人气 +100#k#l\r\n";
    s += "\r\n";
    s += "#k--- 职业 ---\r\n";
    s += "#b#L7#修改职业（点选 / 输入编号）#k#l\r\n";
    s += "#b#L8#学习技能（点选 / 输入ID）#k#l\r\n";
    s += "\r\n";
    s += "#k--- 物品 / 背包 ---\r\n";
    s += "#b#L9##b获取物品（点选 / 输入ID）#k#l\r\n";
    s += "#b#L10#扩充背包（选栏位类型）#k#l\r\n";
    s += "#b#L11#上 BUFF（输入道具ID，不消耗）#k#l\r\n";
    s += "\r\n";
    s += "#k--- 移动 / 角色 ---\r\n";
    s += "#b#L12#传送地图（猎场 / BOSS / 城镇）#k#l\r\n";
    s += "#b#L13#隐身 / 现身#k#l\r\n";
    s += "#b#L14#去自由市场#k#l\r\n";
    s += "#b#L15#回满 HP / MP#k#l\r\n";
    s += "#b#L16#当前地图信息#k#l\r\n";
    s += "\r\n";
    s += "#k--- 怪物 / 地面 ---\r\n";
    s += "#b#L17#捡取全图物品（全屏捡物）#k#l\r\n";
    s += "#b#L18#吸取全图怪物（全拉到脚下）#k#l\r\n";
    s += "#b#L19#生成怪物（输入 ID + 数量）#k#l\r\n";
    s += "#b#L20#清空本图怪物（无掉落）#k#l\r\n";
    s += "#b#L21#清空本图怪物（有掉落）#k#l\r\n";
    s += "#b#L22#清理地上掉落物#k#l\r\n";
    s += "\r\n";
    s += "#k--- 新增 ---\r\n";
    s += "#b#L23#加经验（自定义数值）#k#l\r\n";
    s += "#b#L24#加金币（自定义数值）#k#l\r\n";
    s += "#b#L25#召唤 BOSS（点选，" + countBoss() + " 只）#k#l\r\n";
    s += "#b#L26#特效 / 播报（公告 / 特效 / 倒计时 / 称号）#k#l\r\n";
    s += "#b#L27#背包管理（一键按栏位清理）#k#l\r\n";
    s += "#b#L29#伤害倍率（当前 ×" + cm.getPlayer().getDmgMultiplier() + "）#k#l\r\n";
    s += "#b#L30#攻击速度爆发（速效激发 x-8 最快档，约 9 小时）#k#l\r\n";
    var _totMob = 0;
    for (var _mi = 0; _mi < MOB_TIERS_ALL.length; _mi++) {
        _totMob += MOB_TIERS_ALL[_mi][1].length;
    }
    s += "#b#L31#召唤怪物-全级别段（" + MOB_TIERS_ALL.length + " 段 / " + _totMob + " 只）#k#l\r\n";
    s += "#b#L32#关闭菜单#k#l";
    return s;
}

/* 回到主菜单（所有功能执行完都走这里，不再 dispose） */
function topMenu() {
    status = 1;
    curList = null;
    cm.sendSimple(mainMenu());
}

/* 大系选择菜单 */
function familyMenu() {
    var s = "#e[修改职业 - 选择职业大系]#n\r\n";
    for (var i = 0; i < FAMILIES.length; i++) {
        s += "#b#L" + i + "#" + FAMILIES[i] + "系（" + JOBS[FAMILIES[i]].length + " 个职业）#k#l\r\n";
    }
    s += "#b#L" + FAMILIES.length + "#b直接输入职业编号#k#l\r\n";
    s += "#b#L" + (FAMILIES.length + 1) + "##b返回主菜单#k#l";
    return s;
}

/* 某个大系下的职业列表菜单 */
function jobMenu(fam) {
    var list = JOBS[fam];
    var s = "#e[修改职业 - " + fam + "系]#n\r\n";
    for (var i = 0; i < list.length; i++) {
        s += "#b#L" + i + "#" + list[i][0] + "  " + list[i][1] + "（" + jobTier(list[i][0]) + "）#k#l\r\n";
    }
    s += "#b#L" + list.length + "##b返回大系选择#k#l";
    return s;
}

/* 属性点菜单 */
function attrMenu() {
    var chr = cm.getPlayer();
    var s = "#e[修改属性点]#n   剩余AP：" + chr.getRemainingAp() + "\r\n";
    s += "#k当前：力 " + chr.getStr() + " / 敏 " + chr.getDex() +
         " / 智 " + chr.getInt() + " / 运 " + chr.getLuk() + "\r\n";
    s += "#b#L0#直接设定四项数值（力 敏 智 运）#k#l\r\n";
    s += "#b#L1#增加剩余 AP#k#l\r\n";
    s += "#b#L2#一键满属性（四项设成同一个值）#k#l\r\n";
    s += "#b#L3##b返回主菜单#k#l";
    return s;
}

/* 传送菜单 */
function warpMenu() {
    var s = "#e[传送地图]#n\r\n";
    s += "#b#L0#输入地图ID#k#l\r\n";
    s += "#b#L1#BOSS 挑战图（" + BOSS_MAPS.length + " 个）#k#l\r\n";
    s += "#b#L2#全部城镇（" + TOWN_MAPS_ALL.length + " 个，含常用的 14 个 + wz 全量精选）#k#l\r\n";
    s += "#b#L3#Lv.100 以上练级场（" + HUNT_MAPS.length + " 个，怪 Lv.100~200）#k#l\r\n";
    s += "#b#L4##b返回主菜单#k#l";
    return s;
}

/* 传送菜单各档位的标题（下标 = warpMenu 里的 #L 编号） */
var WARP_TITLES = ["", "BOSS 挑战图", "全部城镇", "Lv.100 以上练级场"];

/* 地图列表菜单（curList 决定内容，按 MAP_PAGE 分页）
 * 行号规则：本页第 n 项 = #L n；还有下一页时 #L MAP_PAGE = 下一页；永远 #L MAP_PAGE+1 = 返回。
 * 注意：地图行最多占 0 ~ MAP_PAGE-1，别和"下一页/返回"撞号。 */
function spotMenu(title) {
    curTitle = title;
    var s = "#e[" + title + "]#n\r\n";
    var start = MAP_PAGE_NO * MAP_PAGE;
    var n = curList.length;
    var end = Math.min(start + MAP_PAGE, n);
    for (var i = start; i < end; i++) {
        var row = curList[i];
        var txt;
        if (row.length > 3) {
            /* BOSS 图：把这张图刷的 BOSS 直接写出来，传送过去有没有 BOSS 一眼可见 */
            txt = row[1] + "（" + row[3] + "）";
        } else {
            txt = (row[2] > 0 ? ("Lv." + row[2] + " ") : "") + row[1] + " (" + row[0] + ")";
        }
        s += "#b#L" + (i - start) + "#" + txt + "#k#l\r\n";
    }
    if (end < n) {
        var pages = Math.ceil(n / MAP_PAGE);
        s += "#b#L" + MAP_PAGE + "#下一页（第 " + (MAP_PAGE_NO + 1) + " / " + pages + " 页）#k#l\r\n";
    }
    s += "#b#L" + (MAP_PAGE + 1) + "##b返回传送菜单#k#l";
    return s;
}

/* 当前页的起止下标，翻页/传送时用它把 selection 换算成真实下标 */
function spotRange() {
    var start = MAP_PAGE_NO * MAP_PAGE;
    return [start, Math.min(start + MAP_PAGE, curList.length)];
}

function bagMenu() {
    var s = "#e[扩充背包]#n  每次 +" + BAG_SLOTS_PER_USE + " 格\r\n";
    for (var i = 0; i < BAG_TYPES.length; i++) {
        s += "#b#L" + i + "#" + BAG_TYPES[i][1] + "（现在 " + cm.getPlayer().getSlots(BAG_TYPES[i][0]) + " 格）#k#l\r\n";
    }
    s += "#b#L" + BAG_TYPES.length + "##b返回主菜单#k#l";
    return s;
}

/* ================= 工具函数 ================= */

function start() {
    status = 0;
    family = null;
    curList = null;
    action(1, 0, 0);
}

function toInt(s) {
    if (s == null) {
        return -1;
    }
    var n = parseInt(String(s).replace(/\s+/g, ""), 10);
    if (isNaN(n) || n < 0) {
        return -1;
    }
    return n;
}

/* 把 "1 2 3 4" / "1,2,3,4" / "1，2，3，4" 之类解析成整数数组；含非法项返回 null */
function parseInts(text) {
    if (text == null) {
        return null;
    }
    var t = String(text).replace(/[，,、；;\/|]/g, " ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    if (t == "") {
        return null;
    }
    var parts = t.split(" ");
    var out = [];
    for (var i = 0; i < parts.length; i++) {
        var v = parseInt(parts[i], 10);
        if (isNaN(v) || v < 0) {
            return null;
        }
        out.push(v);
    }
    return out;
}

/* 解析刷怪输入："怪物ID 数量" */
function parseSpawn(text) {
    var a = parseInts(text);
    var id = (a != null && a.length > 0) ? a[0] : -1;
    var cnt = (a != null && a.length > 1) ? a[1] : 1;
    if (cnt < 1) {
        cnt = 1;
    }
    if (cnt > MAX_SPAWN) {
        cnt = MAX_SPAWN;
    }
    return [id, cnt];
}

/* 解析「获取物品」输入：多组用逗号分隔，组内是 "物品ID 数量"（数量可省略 = 1）
 *   例：2000005 100            → 红药水 ×100
 *       1142009 1, 1382049 1   → 两件装备各 1
 *   返回 [[id, qty], ...]；完全解析不了返回 null */
function parseItemInput(text) {
    if (text == null) {
        return null;
    }
    var t = String(text).replace(/[，、；;\/|]/g, ",").replace(/,+/g, ",").replace(/^\s+|\s+$/g, "");
    if (t == "") {
        return null;
    }
    var groups = t.split(",");
    var out = [];
    for (var i = 0; i < groups.length && out.length < MAX_ITEM_GROUPS; i++) {
        var a = parseInts(groups[i]);
        if (a == null || a.length == 0 || a[0] <= 0) {
            continue;
        }
        var id = a[0];
        var qty = (a.length > 1 && a[1] > 0) ? a[1] : 1;
        if (qty > MAX_ITEM_QTY) {
            qty = MAX_ITEM_QTY;
        }
        out.push([id, qty]);
    }
    return (out.length == 0) ? null : out;
}

/* 编号 → 中文职业名，查不到返回空串 */
function jobName(id) {
    for (var i = 0; i < FAMILIES.length; i++) {
        var list = JOBS[FAMILIES[i]];
        for (var j = 0; j < list.length; j++) {
            if (list[j][0] == id) {
                return list[j][1];
            }
        }
    }
    return "";
}

/* 判断是几转：100/200 是一转，110 是二转，111 三转，112 四转 */
function jobTier(id) {
    if (id % 100 == 0) {
        return "一转";
    }
    if (id % 10 == 0) {
        return "二转";
    }
    if (id % 10 == 1) {
        return "三转";
    }
    return "四转";
}

/* ================= 职业 ================= */

function doChangeJob(jobId) {
    var oldJob = 0;
    try {
        oldJob = cm.getPlayer().getJob().getId();
    } catch (e) {
        oldJob = 0;
    }

    if (!cm.changeJobById(jobId)) {
        cm.dropMessage(5, "[GM] 职业编号无效：" + jobId + "（可用范围 100 ~ 522）");
        return;
    }

    var name = jobName(jobId);
    var label = (name == "") ? ("职业" + jobId) : (name + " (" + jobId + ")");
    cm.dropMessage(5, "[GM] 已转职：" + label);

    /* 战士/法师/弓手/飞侠/海盗 分别是 1~5 系，跨系转职旧技能会留在技能栏 */
    var oldNiche = Math.floor(oldJob / 100) % 10;
    var newNiche = Math.floor(jobId / 100) % 10;
    if (oldJob != 0 && oldNiche != newNiche) {
        cm.dropMessage(5, "[GM] 跨系转职：旧职业技能还留在技能栏，用不了也删不掉");
    }

    cm.dropMessage(5, "[GM] 转职后技能会重置，回主菜单点「满技能」即可补满");
}

/* ================= 技能 / 物品：通用工具 ================= */

function inArray(arr, v) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] == v) {
            return true;
        }
    }
    return false;
}

/* 当前职业编号 */
function myJobId() {
    try {
        return cm.getPlayer().getJob().getId();
    } catch (e) {
        return 0;
    }
}

/* 职业链（与服务端 SkillFactory.getJobChain 同一套算法）：
 * 客户端技能窗口里能看到的，就是这个链条里的职业技能 */
function jobChainOf(jobId) {
    var ret = [];
    if (jobId < 100) {
        return ret;
    }
    var c;
    if (Math.floor(jobId / 1000) == 1) {                             /* 骑士团 */
        c = [1000, jobId - (jobId % 100), jobId];
    } else if (Math.floor(jobId / 100) == 21 || Math.floor(jobId / 100) == 22) {
        var r = Math.floor(jobId / 100) * 100;                       /* 战神 / 龙神 */
        c = [r, r + 10, jobId];
    } else {                                                         /* 冒险家 */
        var first = Math.floor(jobId / 100) * 100;
        var second = first + (Math.floor(jobId / 10) % 10) * 10;
        c = [first, second, second + 1, jobId];
    }
    for (var i = 0; i < c.length; i++) {
        if (c[i] >= 100 && c[i] <= jobId && !inArray(ret, c[i])) {
            ret.push(c[i]);
        }
    }
    return ret;
}

/* 职业编号 -> "黑骑士(132)" */
function jobLabel(jobId) {
    var n = jobName(jobId);
    return (n == "") ? ("职业" + jobId) : (n + "(" + jobId + ")");
}

/* 技能名："id:名;id:名;..." 懒解析成 map，查不到给 (未知技能) */
var _skillNames = null;

function skillName(id) {
    if (_skillNames == null) {
        _skillNames = {};
        var arr = SKILL_NAME_TXT.split(";");
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] == "") {
                continue;
            }
            var p = arr[i].indexOf(":");
            if (p <= 0) {
                continue;
            }
            _skillNames[parseInt(arr[i].substring(0, p), 10)] = arr[i].substring(p + 1);
        }
    }
    var nm = _skillNames[id];
    return (nm == undefined) ? "(未知技能)" : nm;
}

/* ================= 技能：菜单 ================= */

/* 技能菜单（选职业组）。本职业链的组排前面 */
function skillGroupMenu() {
    var jobId = myJobId();
    var chain = jobChainOf(jobId);
    var s = "#e[学习技能]#n　当前职业：" + jobName(jobId) + "（" + jobId + "）\r\n";
    s += "#k点一行 = 展开该职业的技能列表，再点技能 = 直接练满\r\n";
    s += "#k★ = 本职业链（技能窗口能看到）　○ = 跨职业（窗口看不到）\r\n";
    s += "#k本表收的是各职业【四转】技能 + 轻功；本职业 1~4 转全技能请用主菜单「满技能」\r\n\r\n";

    curOrder = orderedSkillGroups();
    for (var i = 0; i < curOrder.length; i++) {
        var g = SKILL_GROUPS[curOrder[i]];
        s += "#b#L" + i + "#" + ((g[0] > 0 && inArray(chain, g[0])) ? "★ " : "○ ") +
             g[1] + "　" + g[2].length + " 个#l\r\n";
    }
    var n = curOrder.length;
    s += "#b#L" + n + "##b手动输入技能ID#k#l\r\n";
    s += "#b#L" + (n + 1) + "##b我学到的技能清单#k#l\r\n";
    s += "#b#L" + (n + 2) + "#b返回主菜单#k#l";
    status = 3;
    cm.sendSimple(s);
}

/* 技能组的显示顺序：当前职业 -> 前置职业 -> 其它职业 -> 跨职业 */
function orderedSkillGroups() {
    var chain = jobChainOf(myJobId());
    var head = [];
    for (var i = chain.length - 1; i >= 0; i--) {
        for (var g = 0; g < SKILL_GROUPS.length; g++) {
            if (SKILL_GROUPS[g][0] == chain[i]) {
                head.push(g);
                break;
            }
        }
    }
    var tail = [];
    for (var j = 0; j < SKILL_GROUPS.length; j++) {
        if (!inArray(head, j)) {
            tail.push(j);
        }
    }
    return head.concat(tail);
}

/* 某职业的技能列表：一行一个，点了就练满 */
function skillListMenu(gi) {
    curGroup = gi;
    var g = SKILL_GROUPS[gi];
    var chain = jobChainOf(myJobId());
    var s = "#e[学习技能 - " + g[1] + "]#n　共 " + g[2].length + " 个\r\n";
    if (g[0] > 0) {
        s += inArray(chain, g[0]) ? "★ 这组在你当前职业链内，技能窗口能看到\r\n"
                                  : "○ 这组是别的职业的，学会了技能窗口也不显示（要先转职）\r\n";
    } else {
        s += "#k○ 跨职业常用技能，客户端技能窗口不显示（服务端照样生效）\r\n";
    }
    s += "#k#e点一行 = 直接练满#n\r\n\r\n";
    for (var i = 0; i < g[2].length; i++) {
        s += "#b#L" + i + "#" + g[2][i][0] + " " + g[2][i][1] + "#k#l\r\n";
    }
    var n = g[2].length;
    s += "#b#L" + n + "##b本组全部练满（" + n + " 个）#k#l\r\n";
    s += "#b#L" + (n + 1) + "##b手动输入技能ID#k#l\r\n";
    s += "#b#L" + (n + 2) + "#b返回技能菜单#k#l";
    status = 30;
    cm.sendSimple(s);
}

/* 技能手动输入（客户端一个对话框只能"列表"或"输入框"二选一，所以单开一屏） */
function skillInputMenu() {
    var jobId = myJobId();
    var eg = "";
    for (var i = 0; i < SKILL_GROUPS.length && eg == ""; i++) {
        if (SKILL_GROUPS[i][0] == jobId) {
            for (var j = 0; j < SKILL_GROUPS[i][2].length && j < 3; j++) {
                eg += ((j > 0) ? " " : "") + SKILL_GROUPS[i][2][j][0];
            }
        }
    }
    if (eg == "") {
        eg = "1321000 1321001";
    }
    var s = "#e[学习技能 - 手动输入]#n\r\n";
    s += "#k输入技能ID后点确定，直接练到满级\r\n";
    s += "#k可一次多个，用空格或逗号分隔\r\n\r\n";
    s += "#k例：" + eg + "\r\n";
    s += "#k不属于本职业的技能学了也不显示在技能窗口，但服务端生效";
    status = 31;
    cm.sendGetText(s);
}

/* 我学到的技能清单（技能窗口里看不到的也列出来，标 ○） */
function mySkillMenu() {
    var p = cm.getPlayer();
    var m = p.getSkills();
    var keys = m.keySet().toArray();
    var ids = [];
    for (var i = 0; i < keys.length; i++) {
        ids.push(keys[i].getId());
    }
    ids.sort(function (a, b) { return a - b; });

    var chain = jobChainOf(myJobId());
    var vis = [], hid = [], com = [];
    for (var j = 0; j < ids.length; j++) {
        var jid = Math.floor(ids[j] / 10000);
        if (jid == 0) {
            com.push(ids[j]);            /* 通用 / 初心者技能：客户端不一定有 0.img */
        } else if (inArray(chain, jid)) {
            vis.push(ids[j]);
        } else {
            hid.push(ids[j]);
        }
    }

    var s = "#e[我学到的技能]#n　共 " + ids.length + " 个\r\n";
    s += "#k★ = 本职业链（技能窗口能看到）　☆ = 通用/初心者技能　○ = 跨职业，不显示\r\n\r\n";
    var k;
    if (vis.length == 0) {
        s += "#k（当前没有技能窗口能显示的技能）\r\n";
    }
    for (k = 0; k < vis.length; k++) {
        s += "#k★ " + vis[k] + " " + skillName(vis[k]) + "  Lv." + p.getSkillLevel(vis[k]) + "\r\n";
    }
    for (k = 0; k < com.length; k++) {
        s += "#k☆ " + com[k] + " " + skillName(com[k]) + "  Lv." + p.getSkillLevel(com[k]) + "\r\n";
    }
    for (k = 0; k < hid.length; k++) {
        s += "#k○ " + hid[k] + " " + skillName(hid[k]) + "  Lv." + p.getSkillLevel(hid[k]) + "\r\n";
    }
    s += "\r\n#b#L0#b返回技能菜单#k#l";
    status = 32;
    cm.sendSimple(s);
}

/* 练满一个技能；跨职业的补一句提醒 */
function learnOne(id) {
    if (!cm.giveSkill(id, 0)) {
        cm.dropMessage(5, "[GM] 技能ID无效：" + id);
        return;
    }
    cm.dropMessage(5, "[GM] 已练满 " + id + " " + skillName(id));
    var jid = Math.floor(id / 10000);
    if (jid != 0 && !inArray(jobChainOf(myJobId()), jid)) {
        cm.dropMessage(5, "[GM] 注意：" + id + " 属于 " + jobLabel(jid) +
                          "，不在你当前职业链内，技能窗口不会显示（服务端已学会）");
    }
}

/* 练满一整组 */
function learnGroup(gi) {
    var g = SKILL_GROUPS[gi];
    var ok = 0, bad = [];
    for (var i = 0; i < g[2].length; i++) {
        if (cm.giveSkill(g[2][i][0], 0)) {
            ok++;
        } else {
            bad.push(g[2][i][0]);
        }
    }
    cm.dropMessage(5, "[GM] " + g[1] + "：已练满 " + ok + "/" + g[2].length + " 个" +
                      (bad.length > 0 ? "，失败 " + bad.join(" ") : ""));
    if (g[0] > 0 && !inArray(jobChainOf(myJobId()), g[0])) {
        cm.dropMessage(5, "[GM] 注意：" + g[1] + " 是别的职业，技能窗口不会显示（要先「修改职业」）");
    }
}

/* 手动输入技能ID：可多个（空格/逗号分隔），每个都练到满级
 * cm.giveSkill(id, 0) → 服务端源码里 level<=0 就是练到技能上限 */
function learnSkills(text) {
    var ids = parseInts(text);
    if (ids == null || ids.length == 0) {
        cm.dropMessage(5, "[GM] 请输入技能ID，多个用空格分隔。例：1321000 1321001 1321002");
        return;
    }
    if (ids.length > MAX_BATCH) {
        ids = ids.slice(0, MAX_BATCH);
    }

    var ok = 0;
    var bad = [];
    for (var i = 0; i < ids.length; i++) {
        if (cm.giveSkill(ids[i], 0)) {
            ok++;
        } else {
            bad.push(ids[i]);
        }
    }

    cm.dropMessage(5, "[GM] 技能已练满：" + ok + " 个" + (ids.length - ok > 0 ? "，失败 " + (ids.length - ok) + " 个" : ""));
    if (bad.length > 0) {
        cm.dropMessage(5, "[GM] 这些ID无效（不是技能ID）：" + bad.join(" "));
    }
}

/* ================= 物品：菜单 ================= */

function itemGroupMenu() {
    var s = "#e[获取物品]#n\r\n";
    s += "#k点一行 = 展开该部位的物品列表，再点物品 = 直接获得\r\n";
    s += "#k一次要多个 / 要别的ID：用最下面「手动输入」\r\n\r\n";
    for (var i = 0; i < ITEM_GROUPS.length; i++) {
        var g = ITEM_GROUPS[i];
        var star = 0;
        for (var j = 0; j < g[1].length; j++) {
            if (g[1][j][1].indexOf("★") == 0) {
                star++;
            }
        }
        s += "#b#L" + i + "#[" + g[0] + "] " + g[1].length + " 项" +
             (star > 0 ? "（含 " + star + " 项 150+）" : "") + "#l\r\n";
    }
    var n = ITEM_GROUPS.length;
    s += "#b#L" + n + "##b手动输入物品ID（可带数量）#k#l\r\n";
    s += "#b#L" + (n + 1) + "##b按名字搜索物品（输入中文关键字）#k#l\r\n";
    s += "#b#L" + (n + 2) + "#b返回主菜单#k#l";
    status = 7;
    cm.sendSimple(s);
}

/* 某部位的物品列表：一行一个，点了就获得（数量按数据里的单次数量） */
function itemListMenu(gi) {
    curGroup = gi;
    var g = ITEM_GROUPS[gi];
    var s = "#e[获取物品 - " + g[0] + "]#n　共 " + g[1].length + " 项\r\n";
    s += "#k#e点一行 = 直接获得#n（★ = 150 级以上 / GM 专用）\r\n\r\n";
    for (var i = 0; i < g[1].length; i++) {
        s += "#b#L" + i + "#" + g[1][i][0] + " " + g[1][i][1] +
             (g[1][i][2] > 1 ? "（每次 " + g[1][i][2] + " 个）" : "") + "#l\r\n";
    }
    var n = g[1].length;
    s += "#b#L" + n + "##b手动输入物品ID（可带数量）#k#l\r\n";
    s += "#b#L" + (n + 1) + "#b返回物品菜单#k#l";
    status = 70;
    cm.sendSimple(s);
}

/* 物品手动输入（同技能：列表和输入框不能同屏） */
function itemInputMenu() {
    var s = "#e[获取物品 - 手动输入]#n\r\n";
    s += "#k格式：物品ID 数量，数量不写就默认 1 个\r\n";
    s += "#k多组用逗号隔开\r\n\r\n";
    s += "#k例：2000005 100（超级药水 100 个）\r\n";
    s += "#k例：1142009 1, 1382049 1\r\n";
    s += "#k例：4001006 1（ID 随便填，只要 wz 里有）";
    status = 71;
    cm.sendGetText(s);
}

/* 物品名：先从分组数据里找，找不到返回空串 */
function itemLabel(id) {
    for (var i = 0; i < ITEM_GROUPS.length; i++) {
        for (var j = 0; j < ITEM_GROUPS[i][1].length; j++) {
            if (ITEM_GROUPS[i][1][j][0] == id) {
                return ITEM_GROUPS[i][1][j][1];
            }
        }
    }
    return "";
}

/* 获取单件（点列表用），qty = 单次数量 */
function gainOne(id, qty) {
    try {
        cm.gainItem(id, qty);
        cm.dropMessage(5, "[GM] 已获得 " + id + " " + itemLabel(id) + " x" + qty);
    } catch (e) {
        cm.dropMessage(5, "[GM] 获得失败（背包满 / ID 不存在）：" + id);
    }
}

/* 手动输入：cm.gainItem(int id, short quantity)（AbstractPlayerInteraction:571） */
function gainItems(text) {
    var list = parseItemInput(text);
    if (list == null) {
        cm.dropMessage(5, "[GM] 格式：物品ID 数量（多件用逗号分隔）。例：2000005 100 或 1142009 1, 1382049 1");
        return;
    }

    var ok = 0;
    for (var i = 0; i < list.length; i++) {
        var id = list[i][0];
        var qty = list[i][1];
        try {
            cm.gainItem(id, qty);
            ok++;
        } catch (e) {
            /* 单件失败（背包满/ID 非法）不影响其它 */
        }
    }

    var msg = "[GM] 已发放 " + ok + "/" + list.length + " 组物品：";
    for (var j = 0; j < list.length; j++) {
        msg += list[j][0] + "x" + list[j][1] + " ";
    }
    cm.dropMessage(5, msg);
    if (ok < list.length) {
        cm.dropMessage(5, "[GM] 没发成功的通常是：背包格子不够 / 物品ID不存在");
    }
}

/* ================= 属性点 ================= */

/* 直接设定四项数值。不够的 AP 自动补，降属性会把点退回剩余 AP。 */
function setStats(vals) {
    var chr = cm.getPlayer();

    for (var i = 0; i < 4; i++) {
        if (vals[i] < MIN_STAT || vals[i] > MAX_STAT) {
            cm.dropMessage(5, "[GM] 每项必须在 " + MIN_STAT + " ~ " + MAX_STAT + " 之间");
            return;
        }
    }

    var cur = [chr.getStr(), chr.getDex(), chr.getInt(), chr.getLuk()];
    var d = [vals[0] - cur[0], vals[1] - cur[1], vals[2] - cur[2], vals[3] - cur[3]];

    var need = 0;
    for (var j = 0; j < 4; j++) {
        if (d[j] > 0) {
            need += d[j];
        }
    }
    if (need > 0) {
        chr.gainAp(need, false);        /* 先把 AP 补足，否则 assign 会因 AP 不够直接失败 */
    }

    if (!chr.assignStrDexIntLuk(d[0], d[1], d[2], d[3])) {
        cm.dropMessage(5, "[GM] 设置失败：超出 " + MAX_STAT + " 上限，或 AP 不足");
        return;
    }

    cm.dropMessage(5, "[GM] 属性已设置：力 " + chr.getStr() + " / 敏 " + chr.getDex() +
                      " / 智 " + chr.getInt() + " / 运 " + chr.getLuk() +
                      "   剩余AP " + chr.getRemainingAp());
}

/* 加剩余 AP */
function addAp(n) {
    var chr = cm.getPlayer();
    chr.gainAp(n, false);
    cm.dropMessage(5, "[GM] 剩余AP +" + n + "，现在 " + chr.getRemainingAp() +
                      "（去客户端属性面板自己分配）");
}

/* 一键满属性：四项设成同一个值 */
function maxStats(v) {
    setStats([v, v, v, v]);
}

/* ================= 传送 ================= */

function doWarp(mapId, label) {
    if (cm.warpToMap(mapId)) {
        cm.dropMessage(5, "[GM] 已传送到 " + label + "（" + mapId + "）");
    } else {
        cm.dropMessage(5, "[GM] 地图ID不存在：" + mapId);
    }
}

/* ================= 怪物 / 地面 ================= */

/* 全屏捡物：和客户端按 Z 键捡东西走同一条代码，归属判定/进背包/广播全都有 */
function pickUpAll() {
    var chr = cm.getPlayer();
    var map = chr.getMap();
    var before = map.getItems().size();
    if (before == 0) {
        cm.dropMessage(5, "[GM] 地上没有可捡的东西");
        return;
    }

    var items = map.getItems();
    for (var i = 0; i < items.size(); i++) {
        try {
            chr.pickupItem(items.get(i));
        } catch (e) {
            /* 单件失败（刚掉的/放不下的）不影响其它 */
        }
    }

    var after = map.getItems().size();
    cm.dropMessage(5, "[GM] 全屏捡取：地上 " + before + " 件 → 剩 " + after + " 件（捡起 " + (before - after) + " 件）");
    if (after > 0) {
        cm.dropMessage(5, "[GM] 没捡起的通常是：刚掉不到 0.4 秒的 / 背包放不下的 / 不是你的掉落");
    }
}

/* 吸怪：把全图怪物挪到自己脚下（resetMobPosition 是服务端原生方法，但全项目零调用，属首次实测） */
function vacMobs() {
    var chr = cm.getPlayer();
    var mobs = chr.getMap().getAllMonsters();
    if (mobs.size() == 0) {
        cm.dropMessage(5, "[GM] 本图没有怪物");
        return;
    }

    var pos = chr.getPosition();
    var ok = 0;
    var fail = 0;
    for (var i = 0; i < mobs.size(); i++) {
        try {
            mobs.get(i).resetMobPosition(pos);
            ok++;
        } catch (e) {
            fail++;
        }
    }
    cm.dropMessage(5, "[GM] 吸怪：已把 " + ok + " 只怪拉到脚下" + (fail > 0 ? "（" + fail + " 只失败）" : ""));
}

/* 回满血蓝：注意别用 healHpMp()，那是一句 updateHpMp(30000)，不是"回满" */
function healFull() {
    var chr = cm.getPlayer();
    var hp = chr.getCurrentMaxHp();
    var mp = chr.getCurrentMaxMp();
    chr.updateHpMp(hp, mp);
    cm.dropMessage(5, "[GM] 已回满：HP " + chr.getHp() + "/" + hp + "  MP " + chr.getMp() + "/" + mp);
}

/* 清空本图怪物。withDrop=true 时逐个杀（掉落归自己），false 时直接抹掉不出掉落 */
function killAllMobs(withDrop) {
    var chr = cm.getPlayer();
    var map = chr.getMap();
    var before = map.countMonsters();
    if (before == 0) {
        cm.dropMessage(5, "[GM] 本图没有怪物");
        return;
    }

    if (withDrop) {
        var mobs = map.getAllMonsters();
        for (var i = 0; i < mobs.size(); i++) {
            try {
                map.killMonster(mobs.get(i), chr, true);
            } catch (e) {
            }
        }
    } else {
        map.killAllMonsters();
    }
    cm.dropMessage(5, "[GM] 已清空本图怪物：" + before + " 只" + (withDrop ? "（有掉落）" : "（无掉落）"));
}

/* 刷怪：先校验怪物ID（getMonsterLifeFactory 对不存在的 ID 返回 null） */
function spawnMobs(text) {
    var r = parseSpawn(text);
    var mobId = r[0];
    var count = r[1];

    if (mobId < 0) {
        cm.dropMessage(5, "[GM] 格式：怪物ID 数量，例如 100100 5（只填 ID 就刷 1 只）");
        return;
    }

    var mob = cm.getMonsterLifeFactory(mobId);
    if (mob == null) {
        cm.dropMessage(5, "[GM] 怪物ID不存在：" + mobId);
        return;
    }
    var name = mob.getName();

    var chr = cm.getPlayer();
    var pos = chr.getPosition();
    var px = Math.floor(pos.getX());
    var py = Math.floor(pos.getY());

    var ok = 0;
    for (var i = 0; i < count; i++) {
        try {
            cm.spawnMonster(mobId, px, py);
            ok++;
        } catch (e) {
        }
    }
    cm.dropMessage(5, "[GM] 已生成 " + ok + "/" + count + " 只「" + name + "」（ID " + mobId + "）");
}

/* 清理地上掉落物 */
function clearGround() {
    var map = cm.getPlayer().getMap();
    var before = map.getItems().size();
    if (before == 0) {
        cm.dropMessage(5, "[GM] 地上没有掉落物");
        return;
    }
    map.clearDrops();
    cm.dropMessage(5, "[GM] 已清理地上 " + before + " 件掉落物");
}

/* 上 BUFF：直接用道具效果，不消耗道具（cm.useItem） */
function applyBuff(text) {
    var itemId = toInt(text);
    if (itemId < 0) {
        cm.dropMessage(5, "[GM] 请输入数字道具ID，例如 2000005（红色药水）");
        return;
    }
    try {
        cm.useItem(itemId);
        cm.dropMessage(5, "[GM] 已上 BUFF（道具 " + itemId + "，未消耗）");
    } catch (e) {
        cm.dropMessage(5, "[GM] 道具 " + itemId + " 不是可用的增益道具");
    }
}

/* 扩充背包：gainSlots(类型, 格数) */
function addBagSlots(bagType) {
    var chr = cm.getPlayer();
    var name = "背包";
    for (var i = 0; i < BAG_TYPES.length; i++) {
        if (BAG_TYPES[i][0] == bagType) {
            name = BAG_TYPES[i][1];
        }
    }

    if (chr.gainSlots(bagType, BAG_SLOTS_PER_USE)) {
        cm.dropMessage(5, "[GM] " + name + " 已扩充，现在 " + chr.getSlots(bagType) + " 格");
    } else {
        cm.dropMessage(5, "[GM] " + name + " 已经到上限了（现在 " + chr.getSlots(bagType) + " 格）");
    }
}

/* 加人气 */
function gainFame100() {
    cm.gainFame(100);
    cm.dropMessage(5, "[GM] 人气 +100");
}

/* 当前地图信息 */
function mapInfo() {
    var chr = cm.getPlayer();
    var map = chr.getMap();
    var jn = jobName(chr.getJob().getId());
    cm.dropMessage(5, "[GM] 地图：" + map.getMapName() + "（ID " + map.getId() + "）");
    cm.dropMessage(5, "[GM] 怪物 " + map.countMonsters() + " 只 ｜ 玩家 " + map.countAlivePlayers() + " 人 ｜ 地上物品 " + map.getItems().size() + " 件");
    cm.dropMessage(5, "[GM] 自己：Lv." + chr.getLevel() + " " + (jn == "" ? ("职业" + chr.getJob().getId()) : jn) +
                      "  HP " + chr.getHp() + "/" + chr.getCurrentMaxHp() + "  MP " + chr.getMp() + "/" + chr.getCurrentMaxMp());
}

/* ================= 第 8 轮新增功能（2026-09-22）================= */

/* ---- 小工具 ---- */

function trimText(s) {
    if (s == null) {
        return "";
    }
    return String(s).replace(/^\s+|\s+$/g, "");
}

/* 解析一个正整数；非法返回 -1；max > 0 时封顶 */
function parsePositive(text, max) {
    if (text == null) {
        return -1;
    }
    var t = String(text).replace(/[^0-9]/g, "");
    if (t == "") {
        return -1;
    }
    var n = parseInt(t, 10);
    if (isNaN(n) || n <= 0) {
        return -1;
    }
    if (max > 0 && n > max) {
        n = max;
    }
    return n;
}

/* 字符串能否被 GB2312 编码。
 * 服务端封包硬编码 GB2312，编不了的字符会让整个对话框发不出去，
 * 所以凡是"把用户数据拼进对话框"的地方都要先过这一关。
 * 做法：编码再解回来比一比，不一致就是编不了（不可编码的会被换成 ?）。 */
function gb2312Safe(s) {
    try {
        var b = new Packages.java.lang.String(s).getBytes("GB2312");
        var back = new Packages.java.lang.String(b, "GB2312");
        return String(back) == String(s);
    } catch (e) {
        return false;
    }
}

function countBoss() {
    var n = 0;
    for (var i = 0; i < BOSS_TIERS.length; i++) {
        n += BOSS_TIERS[i][1].length;
    }
    return n;
}

/* ---- A1 / A2：自定义加经验、加金币 ---- */

function gainExpCustom(text) {
    var n = parsePositive(text, MAX_CUSTOM_EXP);
    if (n < 0) {
        cm.dropMessage(5, "[GM] 请输入正整数（要加的经验），例：5000000");
        return;
    }
    cm.gainExp(n);
    cm.dropMessage(5, "[GM] 经验 +" + n);
}

function gainMesoCustom(text) {
    var n = parsePositive(text, MAX_CUSTOM_MESO);
    if (n < 0) {
        cm.dropMessage(5, "[GM] 请输入正整数（要加的金币），例：3000000");
        return;
    }
    cm.gainMeso(n);
    cm.dropMessage(5, "[GM] 金币 +" + n);
}

/* ---- C6：召唤 BOSS ---- */

function bossTierMenu() {
    var s = "#e[召唤 BOSS]#n\r\n";
    s += "#k选一档 -> 再点某一行 = 在你面前召唤它\r\n";
    s += "#k会自动贴地，不会出现悬空怪\r\n\r\n";
    for (var i = 0; i < BOSS_TIERS.length; i++) {
        s += "#b#L" + i + "#" + BOSS_TIERS[i][0] + "（" + BOSS_TIERS[i][1].length + " 只）#k#l\r\n";
    }
    s += "#b#L" + BOSS_TIERS.length + "##b返回主菜单#k#l";
    status = 35;
    cm.sendSimple(s);
}

function bossListMenu(ti) {
    var g = BOSS_TIERS[ti];
    if (g == null) {
        bossTierMenu();
        return;
    }
    var s = "#e[召唤 BOSS - " + g[0] + "]#n\r\n";
    s += "#k点一行 = 直接召唤（可以接着点）\r\n\r\n";
    for (var i = 0; i < g[1].length; i++) {
        var b = g[1][i];
        s += "#b#L" + i + "#" + b[1] + "  Lv." + b[2] + "（HP " + b[3] + "）#k#l\r\n";
    }
    s += "#b#L" + g[1].length + "##b换一档#k#l\r\n";
    s += "#b#L" + (g[1].length + 1) + "#b返回主菜单#k#l";
    status = 36;
    cm.sendSimple(s);
}

function summonBoss(idx) {
    var g = BOSS_TIERS[curTier];
    if (g == null) {
        return;
    }
    var b = g[1][idx];
    if (b == null) {
        return;
    }

    var map = cm.getMap();
    var pos = cm.getPlayer().getPosition();

    /* 扎昆走分段副本逻辑：先 8 臂 -> 第一形态 -> 第二形态 -> 最终形态 */
    if (b[0] == 8800000) {
        summonZakum(pos);
        return;
    }

    var ok = false;

    /* spawnMonsterOnGroundBelow 内部用 calcPointBelow 找下方平台，
       找不到平台时服务端那边会 NPE，所以先试前方偏移点，失败退回玩家脚下
       （玩家自己站的坐标一定有平台） */
    try {
        map.spawnMonsterOnGroundBelow(b[0], pos.x + 60, pos.y);
        ok = true;
    } catch (e1) {
        try {
            map.spawnMonsterOnGroundBelow(b[0], pos.x, pos.y);
            ok = true;
        } catch (e2) {
            ok = false;
        }
    }

    if (ok) {
        cm.dropMessage(5, "[GM] 已召唤 " + b[1] + "（" + b[0] + " Lv." + b[2] + "）");
    } else {
        cm.dropMessage(5, "[GM] 召唤失败：这里找不到可落脚的平台，站到平地中间再试");
    }
}

/* ---- 召唤扎昆（分段副本，复刻正常扎昆流程）---- */

function summonZakum(pos) {
    var map = cm.getMap();
    var chr = cm.getPlayer();

    /* 1) 刷 8 条手臂：先清手臂，主体 8800000 才能打（Java 端 MapleMap.damageMonster 自动锁定） */
    for (var i = 8800003; i <= 8800010; i++) {
        try {
            map.spawnMonsterOnGroundBelow(i, pos.x + 60, pos.y);
        } catch (e1) {
            try {
                map.spawnMonsterOnGroundBelow(i, pos.x, pos.y);
            } catch (e2) {}
        }
    }

    /* 预先创建二、三形态对象（闭包捕获，在监听回调里 spawn，避免依赖 NPC 会话存活） */
    var m1 = cm.getMonsterLifeFactory(8800001);
    var m2 = cm.getMonsterLifeFactory(8800002);

    /* 2) 第一形态 8800000（封印体，8 臂清完 Java 端自动变真） */
    var m0 = cm.getMonsterLifeFactory(8800000);
    var spawned = false;
    try {
        map.spawnMonsterOnGroundBelow(m0, new Packages.java.awt.Point(pos.x, pos.y));
        spawned = true;
    } catch (e) {
        spawned = false;
    }

    if (!spawned) {
        cm.dropMessage(5, "[GM] 扎昆召唤失败：这里找不到可落脚的平台，站到平地中间再试");
        return;
    }

    /* 3) 阶段监听：8800000 死 -> 8800001；8800001 死 -> 8800002；8800002 死 -> 通关广播 */
    m0.addListener(new Packages.server.life.MonsterListener() {
        monsterKilled: function(aniTime) {
            chr.getMap().spawnMonsterOnGroundBelow(m1, new Packages.java.awt.Point(pos.x, pos.y));
            try { chr.dropMessage(5, "[GM] 扎昆第二形态出现！"); } catch (e) {}
            m1.addListener(new Packages.server.life.MonsterListener() {
                monsterKilled: function(aniTime) {
                    chr.getMap().spawnMonsterOnGroundBelow(m2, new Packages.java.awt.Point(pos.x, pos.y));
                    try { chr.dropMessage(5, "[GM] 扎昆最终形态出现！"); } catch (e) {}
                    m2.addListener(new Packages.server.life.MonsterListener() {
                        monsterKilled: function(aniTime) {
                            chr.getMap().broadcastZakumVictory();
                        },
                        monsterDamaged: function(from, trueDmg) {},
                        monsterHealed: function(trueHeal) {}
                    });
                },
                monsterDamaged: function(from, trueDmg) {},
                monsterHealed: function(trueHeal) {}
            });
        },
        monsterDamaged: function(from, trueDmg) {},
        monsterHealed: function(trueHeal) {}
    });

    cm.dropMessage(5, "[GM] 已召唤扎昆（分段副本）：先清 8 条手臂，再依次击败 3 个形态");
}

/* ---- 召唤怪物-全级别段（Lv.1-10 ~ Lv.121 以上，共 13 段）----
 * 按等级段整体铺开，每一段都能「点一行召唤一只」，也能「一次性整段拉来」。 */

/* 选等级段 */
function mobTierMenu() {
    var s = "#e[召唤怪物 - 选择等级段]#n\r\n";
    var tot = 0;
    var j;
    for (j = 0; j < MOB_TIERS_ALL.length; j++) {
        tot += MOB_TIERS_ALL[j][1].length;
    }
    s += "#k共 " + MOB_TIERS_ALL.length + " 段 / " + tot + " 只普通怪（BOSS 已剔除）\r\n";
    s += "#k点一段进去，可以逐只点名，也可以一次整段拉来\r\n\r\n";
    for (j = 0; j < MOB_TIERS_ALL.length; j++) {
        s += "#b#L" + j + "#" + MOB_TIERS_ALL[j][0] + "（" + MOB_TIERS_ALL[j][1].length + " 只）#k#l\r\n";
    }
    s += "#b#L" + MOB_TIERS_ALL.length + "#b返回主菜单#k#l";
    curMobPage = 0;                         /* 换档时页号归零 */
    status = 49;
    cm.sendSimple(s);
}

/* 段内列表：点一行召唤一只；末尾三行 = 本段全部召唤 / 换段 / 回主菜单 */
function mobTierListMenu(ti) {
    if (ti < 0 || ti >= MOB_TIERS_ALL.length) {
        mobTierMenu();
        return;
    }
    curMobTier = ti;
    var g = MOB_TIERS_ALL[ti];
    var list = g[1];
    var n = list.length;
    var totalPage = Math.ceil(n / MOB_PAGE);
    if (curMobPage >= totalPage) {
        curMobPage = totalPage - 1;
    }
    if (curMobPage < 0) {
        curMobPage = 0;
    }
    var from = curMobPage * MOB_PAGE;
    var to = from + MOB_PAGE;
    if (to > n) {
        to = n;
    }
    var hasNext = curMobPage + 1 < totalPage;
    var i;
    var s = "#e[召唤怪物 - " + g[0] + "  " + (curMobPage + 1) + "/" + totalPage +
            " 页（第 " + (from + 1) + "~" + to + " 只）]#n\r\n";
    s += "#k点一行 = 召唤 1 只到面前（自由行动，不冻结），可接着点\r\n";
    s += "#k地图容量满了的话超出的不现身（不报错）\r\n\r\n";
    /* 第一行固定：本段全部召唤（一进来就能点） */
    s += "#b#L0##b本段全部召唤（" + n + " 只）#k#l\r\n";
    for (i = from; i < to; i++) {
        s += "#b#L" + (i - from + 1) + "#" + list[i][1] + "  Lv." + list[i][2] + "#k#l\r\n";
    }
    /* 末三行编号：MOB_PAGE+1=下一页（如有），MOB_PAGE+2=换段，MOB_PAGE+3=返回。
     * 怪行占 #L1 ~ #L(MOB_PAGE)，#L0 固定给"全部召唤"，不撞号。 */
    if (hasNext) {
        s += "#b#L" + (MOB_PAGE + 1) + "##b下一页（第 " + (curMobPage + 2) + "/" + totalPage + " 页）#k#l\r\n";
    }
    s += "#b#L" + (MOB_PAGE + 2) + "##b换一个等级段#k#l\r\n";
    s += "#b#L" + (MOB_PAGE + 3) + "#b返回主菜单#k#l";
    status = 50;
    cm.sendSimple(s);
}

/* 召唤段内第 idx 只，留在原地可以接着点 */
function summonMobTierOne(idx) {
    var g = MOB_TIERS_ALL[curMobTier];
    if (g == null) {
        return;
    }
    var m = g[1][idx];
    if (m == null) {
        return;
    }
    var map = cm.getMap();
    var pos = cm.getPlayer().getPosition();
    var ok = false;
    try {
        map.spawnMonsterOnGroundBelow(m[0], pos.x + 60, pos.y);
        ok = true;
    } catch (e1) {
        try {
            map.spawnMonsterOnGroundBelow(m[0], pos.x, pos.y);
            ok = true;
        } catch (e2) {
            ok = false;
        }
    }
    if (ok) {
        cm.dropMessage(5, "[GM] 已召唤 " + m[1] + "（" + m[0] + " Lv." + m[2] + "）");
    } else {
        cm.dropMessage(5, "[GM] 召唤失败：这里找不到可落脚的平台，站到平地中间再试");
    }
}

/* 整段召唤：横向错开避免叠在同一格；单只失败不影响其它 */
function summonMobTierAll() {
    var g = MOB_TIERS_ALL[curMobTier];
    if (g == null) {
        return;
    }
    var list = g[1];
    var n = list.length;
    var map = cm.getMap();
    var pos = cm.getPlayer().getPosition();
    var ok = 0;
    var i;
    for (i = 0; i < n; i++) {
        var m = list[i];
        try {
            try {
                map.spawnMonsterOnGroundBelow(m[0], pos.x + 60 + (i % 12) * 24, pos.y);
            } catch (e1) {
                map.spawnMonsterOnGroundBelow(m[0], pos.x, pos.y);
            }
            ok++;
        } catch (e2) {
            /* 单只失败不影响其它 */
        }
    }
    cm.dropMessage(5, "[GM] " + g[0] + "：已尝试召唤 " + ok + "/" + n +
                      " 只（地图容量满时部分不现身，属正常）");
}

/* ================= 伤害倍率（GM） =================
 * 客户端单段显示封顶约 13.33 亿（客户端墙，改不了）。
 * 服务端在扣血前把客户端发来的伤害乘以倍率：实际掉血变 N 倍，显示数字不变。
 * 倍率存角色内存（MapleCharacter.dmgMultiplier），重新登录回 ×1。 */
function dmgMultMenu() {
    var cur = cm.getPlayer().getDmgMultiplier();
    var s = "#e[伤害倍率]#n  当前：#r×" + cur + "#n\r\n\r\n";
    s += "#k实际扣血 = 客户端伤害 × 倍率（显示仍封顶 13.33 亿）\r\n";
    s += "#k服务端会钳到 21.47 亿，任何怪都是一击必杀\r\n\r\n";
    s += "#b#L0#×1（关闭放大）#k#l\r\n";
    s += "#b#L1#×10#k#l\r\n";
    s += "#b#L2#×100#k#l\r\n";
    s += "#b#L3#×1000#k#l\r\n";
    s += "#b#L4##b返回主菜单#k#l";
    status = 48;
    cm.sendSimple(s);
}

function applyDmgMult(sel) {
    var mults = [1, 10, 100, 1000];
    if (sel >= 0 && sel <= 3) {
        cm.getPlayer().setDmgMultiplier(mults[sel]);
        cm.dropMessage(5, "[GM] 伤害倍率已切换：×" + mults[sel] + "（重新登录后恢复 ×1）");
    }
}

/* ================= 攻击速度爆发（GM） =================
 * 直接给角色上一发满级「速效激发」(5121009)，无需学技能、不耗蓝。
 * wz 已改：x=-8（任何武器速度 2~9 加上都触底客户端最快档 2）、time=32700 秒（约 9 小时）。
 * 不需要重启就能重复点；buff 到期后再点一次即可续。 */
function atkSpeedBuff() {
    var eff = Packages.client.SkillFactory.getSkill(5121009).getEffect(20);
    if (eff != null) {
        eff.applyTo(cm.getPlayer());
        cm.dropMessage(5, "[GM] 攻击速度爆发已生效：速效激发 满级（约 9 小时，到期再点一次续）");
    } else {
        cm.dropMessage(5, "[GM] 攻速 buff 获取失败：服务端没读到 5121009 满级数据");
    }
    topMenu();
}

/* ---- E1 / E2 / E3 / E5 / E6：特效与播报 ---- */

function fxMenu() {
    var s = "#e[特效 / 播报]#n\r\n\r\n";
    s += "#b#L0#全图滚动公告（输入文字）#k#l\r\n";
    s += "#b#L1#屏幕特效（" + SCREEN_EFFECTS.length + " 种，只有自己看到）#k#l\r\n";
    s += "#b#L2#地图特效（" + MAP_EFFECTS.length + " 种，全图可见）#k#l\r\n";
    s += "#b#L3#地图倒计时（输入秒数）#k#l\r\n";
    s += "#b#L4#头顶称号（输入文字）#k#l\r\n";
    s += "#b#L5##b返回主菜单#k#l";
    status = 37;
    cm.sendSimple(s);
}

function screenFxMenu() {
    var s = "#e[屏幕特效]#n\r\n只有自己看得到\r\n\r\n";
    for (var i = 0; i < SCREEN_EFFECTS.length; i++) {
        s += "#b#L" + i + "#" + SCREEN_EFFECTS[i][0] + "#k#l\r\n";
    }
    s += "#b#L" + SCREEN_EFFECTS.length + "##b返回#k#l";
    status = 39;
    cm.sendSimple(s);
}

function mapFxMenu() {
    var s = "#e[地图特效]#n\r\n全图所有人可见（FIELD_EFFECT）\r\n\r\n";
    for (var i = 0; i < MAP_EFFECTS.length; i++) {
        s += "#b#L" + i + "#" + MAP_EFFECTS[i][0] + "#k#l\r\n";
    }
    s += "#b#L" + MAP_EFFECTS.length + "##b返回#k#l";
    status = 40;
    cm.sendSimple(s);
}

function doScreenFx(i) {
    var e = SCREEN_EFFECTS[i];
    if (e == null) {
        return;
    }
    cm.showEffect(e[1]);
    cm.dropMessage(5, "[GM] 屏幕特效：" + e[0]);
}

function doMapFx(i) {
    var e = MAP_EFFECTS[i];
    if (e == null) {
        return;
    }
    var path = e[1];
    if (path == "@this") {
        /* "进入当前地图"的入场动画：用本图 ID 现拼 */
        path = "maplemap/enter/" + cm.getMap().getId();
    }
    /* cm.mapEffect 只发给自己；要全图可见必须走地图广播 */
    cm.getMap().broadcastMessage(Packages.tools.MaplePacketCreator.mapEffect(path));
    cm.dropMessage(5, "[GM] 地图特效（全图）：" + e[0]);
}

/* 全图滚动公告：serverNotice type 4 = 屏幕上方滚动 */
function broadcastNotice(text) {
    var t = trimText(text);
    if (t == "") {
        cm.dropMessage(5, "[GM] 公告内容不能为空");
        return;
    }
    if (t.length > 80) {
        t = t.substring(0, 80);
    }
    cm.getMap().broadcastStringMessage(4, "[GM] " + t);
    cm.dropMessage(5, "[GM] 公告已发出（本图所有人可见）");
}

function setClockCustom(text) {
    var n = parsePositive(text, MAX_CLOCK_SEC);
    if (n < 0) {
        cm.dropMessage(5, "[GM] 请输入秒数（1-" + MAX_CLOCK_SEC + "），例：300 = 5 分钟");
        return;
    }
    cm.mapClock(n);
    cm.dropMessage(5, "[GM] 地图倒计时已设为 " + n + " 秒");
}

function setTitleCustom(text) {
    var t = trimText(text);
    if (t == "") {
        cm.dropMessage(5, "[GM] 称号文字不能为空");
        return;
    }
    if (t.length > 40) {
        t = t.substring(0, 40);
    }
    cm.earnTitle(t);
    cm.dropMessage(5, "[GM] 称号已显示：" + t);
}

/* ---- 一键清背包（按栏位分类）---- */

function bagTypeName(t) {
    for (var i = 0; i < BAG_TYPES.length; i++) {
        if (BAG_TYPES[i][0] == t) {
            return BAG_TYPES[i][1];
        }
    }
    return "未知栏位";
}

function countBagItems(typeNo) {
    var inv = cm.getInventory(typeNo);
    if (inv == null) {
        return 0;
    }
    return inv.list().size();
}

/* 统计这次要清掉多少件；bt = 0 表示"全部（不含装饰栏）" */
function countClearTargets(bt) {
    var total = 0;
    for (var i = 0; i < BAG_TYPES.length; i++) {
        var t = BAG_TYPES[i][0];
        if (bt == 0) {
            if (inArray(SAFE_BAG_TYPES, t)) {
                continue;
            }
        } else if (t != bt) {
            continue;
        }
        total += countBagItems(t);
    }
    return total;
}

function bagManageMenu() {
    var s = "#e[背包管理]#n\r\n";
    s += "#k点一行 = 清理该栏位（会先让你确认一次）\r\n";
    s += "#k只清【背包栏】；身上穿着的装备不受影响\r\n\r\n";
    for (var i = 0; i < BAG_TYPES.length; i++) {
        s += "#b#L" + i + "#清理" + BAG_TYPES[i][1] + "（现有 " + countBagItems(BAG_TYPES[i][0]) + " 件）#k#l\r\n";
    }
    s += "#b#L" + BAG_TYPES.length + "#b清理全部（不含装饰栏）#k#l\r\n";
    s += "#b#L" + (BAG_TYPES.length + 1) + "##b返回主菜单#k#l";
    status = 43;
    cm.sendSimple(s);
}

function bagClearConfirm(bt) {
    var total = countClearTargets(bt);
    var what = (bt == 0) ? "全部栏位（不含装饰栏）" : bagTypeName(bt);

    var s = "#e[确认清理背包]#n\r\n\r\n";
    s += "#k目标：" + what + "\r\n";
    s += "#k将清掉 " + total + " 件物品\r\n\r\n";

    pendingBagType = bt;
    status = 44;

    if (total == 0) {
        s += "#k这一栏本来就是空的，没什么可清。\r\n\r\n";
        s += "#b#L1##b返回#k#l";
        cm.sendSimple(s);
        return;
    }

    s += "#k#r此操作不可撤销，请再确认一次#n\r\n\r\n";
    s += "#b#L0#b确认清理 " + total + " 件#k#l\r\n";
    s += "#b#L1##b取消，返回#k#l";
    cm.sendSimple(s);
}

/* 真正执行清理。
 * 用 MapleInventoryManipulator.removeFromSlot 按【槽位】删，好处有三：
 *   1) 它是官方标准删除入口，会同步内存并下发 modifyInventory 包，客户端立刻刷新
 *   2) 按槽位删而不是按物品ID删，所以不会误伤"身上穿着的同 ID 装备"
 *      （服务端的 EQUIP 栏与 EQUIPPED 栏是两套独立数组，这里只动 EQUIP）
 *   3) 遍历前先把 list() 快照成数组，避免边遍历边改抛 ConcurrentModificationException
 */
function doClearBag(bt) {
    var client = cm.getClient();
    var MIT = Packages.client.inventory.MapleInventoryType;
    var MIM = Packages.client.inventory.manipulator.MapleInventoryManipulator;
    var total = 0;

    for (var i = 0; i < BAG_TYPES.length; i++) {
        var t = BAG_TYPES[i][0];
        if (bt == 0) {
            if (inArray(SAFE_BAG_TYPES, t)) {
                continue;
            }
        } else if (t != bt) {
            continue;
        }

        var invType = MIT.getByType(t);
        if (invType == null) {
            continue;
        }
        var inv = cm.getInventory(invType);
        if (inv == null) {
            continue;
        }

        if (invType == MIT.EQUIPPED) {
            continue; // 安全护栏：绝不脱身上装备（服务端 removeAllItems 也有同样的 guard）
        }

        var before = inv.list().size();
        // 一次性批量删除 + 只发一个 modifyInventory 包，客户端轻松消化，不再卡
        MIM.removeAllItems(client, invType, false);
        var after = cm.getInventory(invType).list().size();
        total += (before - after);
    }

    cm.dropMessage(5, "[GM] 背包清理完成：清掉 " + total + " 件");
}

/* ---- B7：按名字搜物品 ---- */

/* 全量物品名表：用服务端现成 API，不占脚本体积。
 * getAllItems() 每次调用都会重新读 6 个 String.img 并建表（约 2 万条），
 * 所以只取一次缓存起来（脚本 engine 按 MapleClient 缓存，变量会留着）。 */
var _allItems = null;

function allItemPairs() {
    if (_allItems == null) {
        var src = Packages.server.MapleItemInformationProvider.getInstance().getAllItems();
        var arr = [];
        for (var i = 0; i < src.size(); i++) {
            var pr = src.get(i);
            arr.push([parseInt(String(pr.getLeft()), 10), String(pr.getRight())]);
        }
        _allItems = arr;
    }
    return _allItems;
}

function itemSearchMenu() {
    var s = "#e[按名字搜物品]#n\r\n";
    s += "#k输入物品名字的一段中文，例：超级 / 药水 / 卷轴\r\n";
    s += "#k也可以直接输入物品ID（纯数字），那就直接给你\r\n\r\n";
    s += "#k名字表来自服务端全量物品库：现金/消耗/装备/材料/设置/宠物";
    status = 45;
    cm.sendGetText(s);
}

function searchAndList(kw) {
    var all = allItemPairs();
    curHits = [];
    curHitsKw = kw;

    for (var i = 0; i < all.length && curHits.length < MAX_SEARCH_HITS; i++) {
        var nm = all[i][1];
        if (nm.indexOf(kw) >= 0 && gb2312Safe(nm)) {
            curHits.push([all[i][0], nm]);
        }
    }
    itemSearchList();
}

function itemSearchList() {
    var s = "#e[搜索结果：" + curHitsKw + "]#n\r\n";
    if (curHits == null || curHits.length == 0) {
        s += "#k没有匹配的物品。\r\n";
        s += "#k换个短一点的关键字试试，或者直接用「获取物品」输入 ID。\r\n\r\n";
        s += "#b#L0##b重新搜索#k#l\r\n";
        s += "#b#L1##b返回主菜单#k#l";
        status = 46;
        cm.sendSimple(s);
        return;
    }
    s += "#k共 " + curHits.length + " 条（一次最多列 " + MAX_SEARCH_HITS + " 条）\r\n";
    s += "#k点一行 = 直接获得 1 个\r\n\r\n";
    for (var i = 0; i < curHits.length; i++) {
        s += "#b#L" + i + "#" + curHits[i][0] + " " + curHits[i][1] + "#k#l\r\n";
    }
    s += "#b#L" + curHits.length + "##b重新搜索#k#l\r\n";
    s += "#b#L" + (curHits.length + 1) + "#b返回主菜单#k#l";
    status = 46;
    cm.sendSimple(s);
}

function giveSearchedItem(idx) {
    if (curHits == null || curHits[idx] == null) {
        return;
    }
    var h = curHits[idx];
    try {
        cm.gainItem(h[0], 1);
        cm.dropMessage(5, "[GM] 已获得 " + h[0] + " " + h[1]);
    } catch (e) {
        cm.dropMessage(5, "[GM] 发放失败（背包满或ID非法）：" + h[0]);
    }
}

/* ================= 入口 ================= */

function action(mode, type, selection) {
    if (mode == -1 || mode == 0) {
        cm.dispose();
        return;
    }
    if (!cm.getPlayer().isGM()) {
        cm.dispose();
        return;
    }

    try {
        /* ---- 主菜单（初次） ---- */
        if (status == 0) {
            topMenu();
            return;
        }

        /* ---- 主菜单选择（24 项） ---- */
        if (status == 1) {
            if (selection == 0) {
                cm.gainExp(1000000);
                cm.dropMessage(5, "[GM] 经验 +100 万");
            } else if (selection == 1) {
                cm.gainExp(100000000);
                cm.dropMessage(5, "[GM] 经验 +1 亿");
            } else if (selection == 2) {
                cm.gainMeso(100000000);
                cm.dropMessage(5, "[GM] 金币 +1 亿");
            } else if (selection == 3) {
                cm.resetStats();
                cm.dropMessage(5, "[GM] 属性点已重置");
            } else if (selection == 4) {
                status = 11;
                cm.sendSimple(attrMenu());
                return;
            } else if (selection == 5) {
                var n = cm.maxJobSkills();
                if (n > 0) {
                    cm.dropMessage(5, "[GM] 已把本职业 " + n + " 个技能练满");
                } else {
                    cm.dropMessage(5, "[GM] 当前职业没有可练的技能（初心者无职业技能）");
                }
            } else if (selection == 6) {
                gainFame100();
            } else if (selection == 7) {
                status = 5;
                cm.sendSimple(familyMenu());
                return;
            } else if (selection == 8) {
                skillGroupMenu();
                return;
            } else if (selection == 9) {
                itemGroupMenu();
                return;
            } else if (selection == 10) {
                status = 10;
                cm.sendSimple(bagMenu());
                return;
            } else if (selection == 11) {
                status = 9;
                cm.sendGetText("#e[上 BUFF]#n\r\n请输入道具ID（只上效果，不消耗道具）：\r\n" +
                               "例：2000005 红色药水 / 2022000 加速药水");
                return;
            } else if (selection == 12) {
                status = 15;
                cm.sendSimple(warpMenu());
                return;
            } else if (selection == 13) {
                cm.getPlayer().Hide(!cm.getPlayer().isHidden());
                if (cm.getPlayer().isHidden()) {
                    cm.dropMessage(5, "[GM] 已隐身");
                } else {
                    cm.dropMessage(5, "[GM] 已现身");
                }
            } else if (selection == 14) {
                cm.warp(910000000);
                cm.dropMessage(5, "[GM] 已传送到自由市场");
            } else if (selection == 15) {
                healFull();
            } else if (selection == 16) {
                mapInfo();
            } else if (selection == 17) {
                pickUpAll();
            } else if (selection == 18) {
                vacMobs();
            } else if (selection == 19) {
                status = 8;
                cm.sendGetText("#e[生成怪物]#n\r\n请输入：怪物ID 数量\r\n" +
                               "例：100100 5（蜗牛 5 只）\r\n只填 ID 则生成 1 只，最多 " + MAX_SPAWN + " 只");
                return;
            } else if (selection == 20) {
                killAllMobs(false);
            } else if (selection == 21) {
                killAllMobs(true);
            } else if (selection == 22) {
                clearGround();
            } else if (selection == 23) {
                status = 33;
                cm.sendGetText("#e[加经验 - 自定义]#n\r\n请输入要加的经验值（正整数）：\r\n" +
                               "例：5000000（500 万）\r\n单次上限 " + MAX_CUSTOM_EXP);
                return;
            } else if (selection == 24) {
                status = 34;
                cm.sendGetText("#e[加金币 - 自定义]#n\r\n请输入要加的金币数（正整数）：\r\n" +
                               "例：3000000（300 万）\r\n单次上限 " + MAX_CUSTOM_MESO);
                return;
            } else if (selection == 25) {
                bossTierMenu();
                return;
            } else if (selection == 26) {
                fxMenu();
                return;
            } else if (selection == 27) {
                bagManageMenu();
                return;
            } else if (selection == 29) {
                dmgMultMenu();
                return;
            } else if (selection == 30) {
                atkSpeedBuff();
                return;
            } else if (selection == 31) {
                mobTierMenu();
                return;
            } else if (selection == 32) {
                cm.dispose();
                return;
            }
            /* 执行完一个功能后回到主菜单，方便继续点（主动 return 的除外） */
            topMenu();
            return;
        }

        /* ---- 修改职业：选大系 ---- */
        if (status == 5) {
            if (selection < FAMILIES.length) {
                family = FAMILIES[selection];
                status = 6;
                cm.sendSimple(jobMenu(family));
                return;
            }
            if (selection == FAMILIES.length) {
                status = 2;
                cm.sendGetText("#e[修改职业 - 手动输入]#n\r\n请输入职业编号（100 ~ 522）：\r\n" +
                               "例：112 英雄 / 212 火毒魔导师 / 412 夜行者");
                return;
            }
            topMenu();
            return;
        }

        /* ---- 修改职业：选具体职业 ---- */
        if (status == 6) {
            var list = JOBS[family];
            if (selection < list.length) {
                doChangeJob(list[selection][0]);
            } else {
                status = 5;
                cm.sendSimple(familyMenu());
                return;
            }
            topMenu();
            return;
        }

        /* ---- 修改属性点：菜单 ---- */
        if (status == 11) {
            if (selection == 0) {
                status = 12;
                cm.sendGetText("#e[直接设定四项数值]#n\r\n请输入 4 个数字，用空格分隔：\r\n" +
                               "力量 敏捷 智力 幸运\r\n" +
                               "例：1000 200 4 4\r\n" +
                               "范围 " + MIN_STAT + " ~ " + MAX_STAT + "，不够的 AP 会自动补");
                return;
            }
            if (selection == 1) {
                status = 13;
                cm.sendGetText("#e[增加剩余 AP]#n\r\n请输入要增加的 AP 数量：\r\n" +
                               "例：2000（之后去客户端属性面板自己分配）");
                return;
            }
            if (selection == 2) {
                status = 14;
                cm.sendGetText("#e[一键满属性]#n\r\n请把四项洗成同一个值，输入这个值：\r\n" +
                               "例：2000（= 力敏智运全部 2000）");
                return;
            }
            topMenu();
            return;
        }

        /* ---- 扩充背包：选栏位 ---- */
        if (status == 10) {
            if (selection < BAG_TYPES.length) {
                addBagSlots(BAG_TYPES[selection][0]);
            }
            topMenu();
            return;
        }

        /* ---- 传送地图：菜单 ---- */
        if (status == 15) {
            if (selection == 0) {
                status = 4;
                cm.sendGetText("#e[传送地图]#n\r\n请输入地图ID：\r\n" +
                               "射手村 100000000 / 魔法密林 101000000\r\n" +
                               "自由市场 910000000 / 天空之城 200000000");
                return;
            }
            if (selection == 1) {
                curList = BOSS_MAPS;
                MAP_PAGE_NO = 0;
            } else if (selection == 2) {
                curList = TOWN_MAPS_ALL;      /* 第 11 轮起：常用城镇已并入这一档 */
                MAP_PAGE_NO = 0;
            } else if (selection == 3) {
                curList = HUNT_MAPS;          /* 第 10 轮起：猎场已并进这一档 */
                MAP_PAGE_NO = 0;
            } else {
                topMenu();
                return;
            }
            status = 16;
            cm.sendSimple(spotMenu(WARP_TITLES[selection]));
            return;
        }

        /* ---- 传送地图：从列表里选一个（分页） ---- */
        if (status == 16) {
            var rng = spotRange();
            if (selection == MAP_PAGE + 1) {
                /* 返回传送菜单 */
                MAP_PAGE_NO = 0;
                curList = null;
                status = 15;
                cm.sendSimple(warpMenu());
                return;
            }
            if (selection == MAP_PAGE && rng[1] < curList.length) {
                /* 下一页（最后一页没有这个按钮，这里必定还有） */
                MAP_PAGE_NO++;
                status = 16;
                cm.sendSimple(spotMenu(curTitle));
                return;
            }
            if (selection >= 0 && selection < MAP_PAGE && rng[0] + selection < curList.length) {
                doWarp(curList[rng[0] + selection][0], curList[rng[0] + selection][1]);
            } else {
                status = 15;
                curList = null;
                cm.sendSimple(warpMenu());
                return;
            }
            topMenu();
            return;
        }

        /* ---- 输入：职业编号 ---- */
        if (status == 2) {
            var jobId = toInt(cm.getText());
            if (jobId < 0) {
                cm.dropMessage(5, "[GM] 请输入数字职业编号");
            } else {
                doChangeJob(jobId);
            }
            topMenu();
            return;
        }

        /* ---- 技能菜单：选职业组 ---- */
        if (status == 3) {
            var sn = curOrder.length;
            if (selection >= 0 && selection < sn) {
                skillListMenu(curOrder[selection]);
                return;
            }
            if (selection == sn) {              /* 手动输入技能ID */
                skillInputMenu();
                return;
            }
            if (selection == sn + 1) {          /* 我学到的技能清单 */
                mySkillMenu();
                return;
            }
            topMenu();                          /* 返回主菜单 */
            return;
        }

        /* ---- 技能列表：点一行 = 练满；留在原地继续点 ---- */
        if (status == 30) {
            var sg = SKILL_GROUPS[curGroup];
            if (selection >= 0 && selection < sg[2].length) {
                learnOne(sg[2][selection][0]);
                skillListMenu(curGroup);
                return;
            }
            if (selection == sg[2].length) {    /* 本组全部练满 */
                learnGroup(curGroup);
                skillListMenu(curGroup);
                return;
            }
            if (selection == sg[2].length + 1) {    /* 手动输入 */
                skillInputMenu();
                return;
            }
            skillGroupMenu();                   /* 返回技能菜单 */
            return;
        }

        /* ---- 技能：手动输入 ---- */
        if (status == 31) {
            learnSkills(cm.getText());
            skillGroupMenu();
            return;
        }

        /* ---- 我学到的技能清单 ---- */
        if (status == 32) {
            skillGroupMenu();
            return;
        }

        /* ---- 物品菜单：选部位组 ---- */
        if (status == 7) {
            if (selection >= 0 && selection < ITEM_GROUPS.length) {
                itemListMenu(selection);
                return;
            }
            if (selection == ITEM_GROUPS.length) {      /* 手动输入物品ID */
                itemInputMenu();
                return;
            }
            if (selection == ITEM_GROUPS.length + 1) {  /* 按名字搜索（第 8 轮 B7） */
                itemSearchMenu();
                return;
            }
            topMenu();                                  /* 返回主菜单 */
            return;
        }

        /* ---- 物品列表：点一行 = 获得；留在原地继续点 ---- */
        if (status == 70) {
            var ig = ITEM_GROUPS[curGroup];
            if (selection >= 0 && selection < ig[1].length) {
                gainOne(ig[1][selection][0], ig[1][selection][2]);
                itemListMenu(curGroup);
                return;
            }
            if (selection == ig[1].length) {            /* 手动输入 */
                itemInputMenu();
                return;
            }
            itemGroupMenu();                            /* 返回物品菜单 */
            return;
        }

        /* ---- 物品：手动输入 ---- */
        if (status == 71) {
            gainItems(cm.getText());
            itemGroupMenu();
            return;
        }

        /* ---- 输入：地图ID ---- */
        if (status == 4) {
            var mapId = toInt(cm.getText());
            if (mapId < 0) {
                cm.dropMessage(5, "[GM] 请输入数字地图ID");
                topMenu();
                return;
            }
            if (cm.warpToMap(mapId)) {
                cm.dropMessage(5, "[GM] 已传送到地图 " + mapId);
            } else {
                cm.dropMessage(5, "[GM] 地图ID不存在：" + mapId);
            }
            topMenu();
            return;
        }

        /* ---- 输入：四项属性 ---- */
        if (status == 12) {
            var vals = parseInts(cm.getText());
            if (vals == null || vals.length != 4) {
                cm.dropMessage(5, "[GM] 需要 4 个数字：力量 敏捷 智力 幸运，例如 1000 200 4 4");
            } else {
                setStats(vals);
            }
            status = 11;
            cm.sendSimple(attrMenu());
            return;
        }

        /* ---- 输入：增加剩余 AP ---- */
        if (status == 13) {
            var ap = toInt(cm.getText());
            if (ap < 0) {
                cm.dropMessage(5, "[GM] 请输入数字");
            } else {
                addAp(ap);
            }
            status = 11;
            cm.sendSimple(attrMenu());
            return;
        }

        /* ---- 输入：一键满属性值 ---- */
        if (status == 14) {
            var v = toInt(cm.getText());
            if (v < 0) {
                cm.dropMessage(5, "[GM] 请输入数字");
            } else {
                maxStats(v);
            }
            status = 11;
            cm.sendSimple(attrMenu());
            return;
        }

        /* ---- 输入：刷怪 ---- */
        if (status == 8) {
            spawnMobs(cm.getText());
            topMenu();
            return;
        }

        /* ---- 输入：BUFF 道具ID ---- */
        if (status == 9) {
            applyBuff(cm.getText());
            topMenu();
            return;
        }

        /* ============ 第 8 轮新增分支 ============ */

        /* ---- 输入：自定义经验 ---- */
        if (status == 33) {
            gainExpCustom(cm.getText());
            topMenu();
            return;
        }

        /* ---- 输入：自定义金币 ---- */
        if (status == 34) {
            gainMesoCustom(cm.getText());
            topMenu();
            return;
        }

        /* ---- 召唤 BOSS：选档 ---- */
        if (status == 35) {
            if (selection < BOSS_TIERS.length) {
                curTier = selection;
                bossListMenu(selection);
                return;
            }
            topMenu();
            return;
        }

        /* ---- 召唤 BOSS：选某一只 ---- */
        if (status == 36) {
            var tier = BOSS_TIERS[curTier];
            if (tier == null) {
                bossTierMenu();
                return;
            }
            var bl = tier[1];
            if (selection < bl.length) {
                summonBoss(selection);
                bossListMenu(curTier);           /* 留在原地，可以接着点 */
                return;
            }
            if (selection == bl.length) {
                bossTierMenu();                  /* 换一档 */
                return;
            }
            topMenu();
            return;
        }

        /* ---- 召唤怪物-全级别段：选段 / 段内逐只 / 整段召唤 ---- */
        if (status == 49) {
            if (selection >= 0 && selection < MOB_TIERS_ALL.length) {
                mobTierListMenu(selection);
                return;
            }
            topMenu();                       /* 返回主菜单 */
            return;
        }

        if (status == 50) {
            var mg = MOB_TIERS_ALL[curMobTier];
            if (mg != null) {
                var ml = mg[1];
                var totalPage = Math.ceil(ml.length / MOB_PAGE);
                if (selection == 0) {
                    /* 第一行：本段全部召唤 */
                    summonMobTierAll();
                    mobTierListMenu(curMobTier);
                    return;
                }
                if (selection >= 1 && selection <= MOB_PAGE) {
                    /* 怪行 #L1~#L(MOB_PAGE)：真实下标 = 已翻页数*MOB_PAGE + (selection-1) */
                    summonMobTierOne(curMobPage * MOB_PAGE + (selection - 1));
                    mobTierListMenu(curMobTier);
                    return;
                }
                if (selection == MOB_PAGE + 1) {
                    if (curMobPage + 1 < totalPage) {
                        curMobPage++;
                        mobTierListMenu(curMobTier);
                    }
                    return;
                }
                if (selection == MOB_PAGE + 2) {
                    curMobPage = 0;
                    mobTierMenu();
                    return;
                }
                if (selection == MOB_PAGE + 3) {
                    topMenu();
                    return;
                }
            }
            topMenu();
            return;
        }

        /* ---- 伤害倍率：切档 / 返回 ---- */
        if (status == 48) {
            if (selection >= 0 && selection <= 4) {
                applyDmgMult(selection);
                if (selection == 4) {
                    topMenu();
                } else {
                    dmgMultMenu();           /* 切完留在本页，显示新倍率 */
                }
                return;
            }
            topMenu();
            return;
        }

        /* ---- 特效 / 播报菜单 ---- */
        if (status == 37) {
            if (selection == 0) {
                status = 38;
                cm.sendGetText("#e[全图滚动公告]#n\r\n请输入公告内容（本图所有人可见）：\r\n" +
                               "例：本服活动开始啦\r\n最长 80 字");
                return;
            } else if (selection == 1) {
                screenFxMenu();
                return;
            } else if (selection == 2) {
                mapFxMenu();
                return;
            } else if (selection == 3) {
                status = 41;
                cm.sendGetText("#e[地图倒计时]#n\r\n请输入秒数（1-" + MAX_CLOCK_SEC + "）：\r\n" +
                               "例：300 = 5 分钟　60 = 1 分钟");
                return;
            } else if (selection == 4) {
                status = 42;
                cm.sendGetText("#e[头顶称号]#n\r\n请输入要显示的文字：\r\n" +
                               "例：GM 在此\r\n最长 40 字");
                return;
            }
            topMenu();
            return;
        }

        /* ---- 输入：公告文字 ---- */
        if (status == 38) {
            broadcastNotice(cm.getText());
            fxMenu();
            return;
        }

        /* ---- 屏幕特效列表 ---- */
        if (status == 39) {
            if (selection < SCREEN_EFFECTS.length) {
                doScreenFx(selection);
                screenFxMenu();
                return;
            }
            fxMenu();
            return;
        }

        /* ---- 地图特效列表 ---- */
        if (status == 40) {
            if (selection < MAP_EFFECTS.length) {
                doMapFx(selection);
                mapFxMenu();
                return;
            }
            fxMenu();
            return;
        }

        /* ---- 输入：倒计时秒数 ---- */
        if (status == 41) {
            setClockCustom(cm.getText());
            fxMenu();
            return;
        }

        /* ---- 输入：称号文字 ---- */
        if (status == 42) {
            setTitleCustom(cm.getText());
            fxMenu();
            return;
        }

        /* ---- 背包管理菜单 ---- */
        if (status == 43) {
            if (selection < BAG_TYPES.length) {
                bagClearConfirm(BAG_TYPES[selection][0]);
                return;
            }
            if (selection == BAG_TYPES.length) {
                bagClearConfirm(0);              /* 全部栏位（不含装饰栏） */
                return;
            }
            topMenu();
            return;
        }

        /* ---- 清理二次确认 ---- */
        if (status == 44) {
            if (selection == 0) {
                doClearBag(pendingBagType);
                bagManageMenu();
                return;
            }
            bagManageMenu();
            return;
        }

        /* ---- 输入：物品名字/ID ---- */
        if (status == 45) {
            var kw = trimText(cm.getText());
            if (kw == "") {
                cm.dropMessage(5, "[GM] 关键字不能为空");
                topMenu();
                return;
            }
            if (/^[0-9]+$/.test(kw)) {
                /* 纯数字 = 直接当物品 ID 发一个 */
                var sid = parseInt(kw, 10);
                try {
                    cm.gainItem(sid, 1);
                    cm.dropMessage(5, "[GM] 已获得 " + sid + " " + itemLabel(sid) + " x1");
                } catch (e3) {
                    cm.dropMessage(5, "[GM] 发放失败（背包满或ID非法）：" + sid);
                }
                topMenu();
                return;
            }
            searchAndList(kw);
            return;
        }

        /* ---- 搜索结果列表 ---- */
        if (status == 46) {
            if (curHits != null) {
                if (selection < curHits.length) {
                    giveSearchedItem(selection);
                    itemSearchList();            /* 留在原地，可以接着拿 */
                    return;
                }
                if (selection == curHits.length) {
                    itemSearchMenu();            /* 重新搜索 */
                    return;
                }
            }
            topMenu();
            return;
        }

        cm.dispose();
    } catch (e) {
        /* 兜底：异常绝不能从这里逃出去。逃出去 dispose() 就不会执行，
           客户端会挂着一个死掉的 CM，这个 NPC 之后就再也点不动了。 */
        cm.dropMessage(5, "[GM] 执行出错：" + e);
        cm.dispose();
    }
}
