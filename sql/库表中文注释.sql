-- ============================================================================
--  heavenms 库 —— 表 / 字段 中文注释脚本
--  作用：给每张表加中文表注释，给每个字段加中文列注释
--  性质：只改「注释」这一项元数据；不改字段类型、默认值、索引、数据内容
--  执行：mysql -uzhoubw -p**** --default-character-set=utf8 heavenms < 本文件
-- ============================================================================

-- 【必读 1】先关掉 sql_mode 的零日期检查：
--   accounts 表含 '0000-00-00' 这类零日期默认值，而服务器 sql_mode 带 NO_ZERO_DATE，
--   不关会直接报 "Invalid default value for 'tempban'"。下面这句只影响当前会话。
SET SESSION sql_mode = '';

-- 【必读 2】建议先备份表结构（只导结构，很快）：
--   mysqldump -uzhoubw -p**** --no-data --skip-comments heavenms > heavenms_schema_backup.sql

-- 【必读 3】执行前请先停掉服务端。本库数据量很小，执行预计几秒~几十秒。

SET NAMES utf8;

-- ============================================================================
--  共 76 张表、568 个字段
-- ============================================================================

ALTER TABLE `accounts`
  COMMENT = '账号表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '账号ID',
  MODIFY COLUMN `name` varchar(13) NOT NULL DEFAULT '' COMMENT '账号名（登录名）',
  MODIFY COLUMN `password` varchar(128) NOT NULL DEFAULT '' COMMENT '密码哈希（bcrypt，不可写明文）',
  MODIFY COLUMN `pin` varchar(10) NOT NULL DEFAULT '' COMMENT '第二密码（PIN）',
  MODIFY COLUMN `pic` varchar(26) NOT NULL DEFAULT '' COMMENT '图片密码（PIC）',
  MODIFY COLUMN `loggedin` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否在线（0离线/1在线）',
  MODIFY COLUMN `lastlogin` timestamp NULL DEFAULT NULL COMMENT '最后登录时间',
  MODIFY COLUMN `createdat` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '账号创建时间',
  MODIFY COLUMN `birthday` date NOT NULL DEFAULT '0000-00-00' COMMENT '生日（用于找回密码/PIN）',
  MODIFY COLUMN `banned` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否永久封号（0否/1是）',
  MODIFY COLUMN `banreason` text COMMENT '封禁原因',
  MODIFY COLUMN `macs` tinytext COMMENT '该账号使用过的MAC地址',
  MODIFY COLUMN `nxCredit` int(11) DEFAULT NULL COMMENT 'NX点数（现金点）',
  MODIFY COLUMN `maplePoint` int(11) DEFAULT NULL COMMENT '枫叶点数（抵用券）',
  MODIFY COLUMN `nxPrepaid` int(11) DEFAULT NULL COMMENT '预付费NX点数',
  MODIFY COLUMN `characterslots` tinyint(2) NOT NULL DEFAULT '6' COMMENT '角色栏位数',
  MODIFY COLUMN `gender` tinyint(2) NOT NULL DEFAULT '10' COMMENT '账号性别（10男/11女）',
  MODIFY COLUMN `tempban` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' COMMENT '临时封禁到期时间',
  MODIFY COLUMN `greason` tinyint(4) NOT NULL DEFAULT '0' COMMENT '封禁原因编号',
  MODIFY COLUMN `tos` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已同意服务条款（0否/1是）',
  MODIFY COLUMN `sitelogged` text COMMENT '官网登录记录',
  MODIFY COLUMN `webadmin` int(1) DEFAULT '0' COMMENT '官网管理权限等级',
  MODIFY COLUMN `nick` varchar(20) DEFAULT NULL COMMENT '昵称',
  MODIFY COLUMN `mute` int(1) DEFAULT '0' COMMENT '是否禁言（0否/1是）',
  MODIFY COLUMN `email` varchar(45) DEFAULT NULL COMMENT '电子邮箱',
  MODIFY COLUMN `ip` text COMMENT '最近登录IP记录',
  MODIFY COLUMN `rewardpoints` int(11) NOT NULL DEFAULT '0' COMMENT '奖励点数',
  MODIFY COLUMN `votepoints` int(11) NOT NULL DEFAULT '0' COMMENT '投票点数',
  MODIFY COLUMN `hwid` varchar(12) NOT NULL DEFAULT '' COMMENT '机器码（HWID）',
  MODIFY COLUMN `language` int(1) NOT NULL DEFAULT '2' COMMENT '客户端语言（0英文/1韩文/2中文）';

ALTER TABLE `alliance`
  COMMENT = '家族同盟（联盟）表',
  MODIFY COLUMN `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '同盟ID',
  MODIFY COLUMN `name` varchar(13) NOT NULL COMMENT '同盟名称',
  MODIFY COLUMN `capacity` int(10) unsigned NOT NULL DEFAULT '2' COMMENT '可容纳公会上限',
  MODIFY COLUMN `notice` varchar(20) NOT NULL DEFAULT '' COMMENT '同盟公告',
  MODIFY COLUMN `rank1` varchar(11) NOT NULL DEFAULT 'Master' COMMENT '职位名-1级（会长）',
  MODIFY COLUMN `rank2` varchar(11) NOT NULL DEFAULT 'Jr. Master' COMMENT '职位名-2级',
  MODIFY COLUMN `rank3` varchar(11) NOT NULL DEFAULT 'Member' COMMENT '职位名-3级',
  MODIFY COLUMN `rank4` varchar(11) NOT NULL DEFAULT 'Member' COMMENT '职位名-4级',
  MODIFY COLUMN `rank5` varchar(11) NOT NULL DEFAULT 'Member' COMMENT '职位名-5级';

ALTER TABLE `allianceguilds`
  COMMENT = '同盟-公会关联表',
  MODIFY COLUMN `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `allianceid` int(10) NOT NULL DEFAULT '-1' COMMENT '所属同盟ID',
  MODIFY COLUMN `guildid` int(10) NOT NULL DEFAULT '-1' COMMENT '公会ID';

ALTER TABLE `area_info`
  COMMENT = '角色区域信息表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `charid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `area` int(11) NOT NULL COMMENT '区域编号',
  MODIFY COLUMN `info` varchar(200) NOT NULL COMMENT '区域内的记录值（如已获得的卡片/已触发的事件）';

ALTER TABLE `bbs_replies`
  COMMENT = '公会BBS回帖表',
  MODIFY COLUMN `replyid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '回帖ID',
  MODIFY COLUMN `threadid` int(10) unsigned NOT NULL COMMENT '所属帖子ID',
  MODIFY COLUMN `postercid` int(10) unsigned NOT NULL COMMENT '回帖者角色ID',
  MODIFY COLUMN `timestamp` bigint(20) unsigned NOT NULL COMMENT '回帖时间戳（毫秒）',
  MODIFY COLUMN `content` varchar(26) NOT NULL DEFAULT '' COMMENT '回帖内容';

ALTER TABLE `bbs_threads`
  COMMENT = '公会BBS帖子表',
  MODIFY COLUMN `threadid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '帖子ID',
  MODIFY COLUMN `postercid` int(10) unsigned NOT NULL COMMENT '发帖者角色ID',
  MODIFY COLUMN `name` varchar(26) NOT NULL DEFAULT '' COMMENT '帖子标题',
  MODIFY COLUMN `timestamp` bigint(20) unsigned NOT NULL COMMENT '发帖时间戳（毫秒）',
  MODIFY COLUMN `icon` smallint(5) unsigned NOT NULL COMMENT '帖子图标编号',
  MODIFY COLUMN `replycount` smallint(5) unsigned NOT NULL DEFAULT '0' COMMENT '回复数',
  MODIFY COLUMN `startpost` text NOT NULL COMMENT '主贴内容',
  MODIFY COLUMN `guildid` int(10) unsigned NOT NULL COMMENT '所属公会ID',
  MODIFY COLUMN `localthreadid` int(10) unsigned NOT NULL COMMENT '公会内部帖子编号';

ALTER TABLE `bosslog_daily`
  COMMENT = 'BOSS挑战记录表（每日）',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `characterid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `bosstype` enum('ZAKUM','HORNTAIL','PINKBEAN','SCARGA','PAPULATUS') NOT NULL COMMENT 'BOSS类型（ZAKUM扎昆/HORNTAIL闇黑龙王/PINKBEAN粉红比恩/SCARGA斯卡戈/PAPULATUS帕普拉图斯）',
  MODIFY COLUMN `attempttime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '挑战时间';

ALTER TABLE `bosslog_weekly`
  COMMENT = 'BOSS挑战记录表（每周）',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `characterid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `bosstype` enum('ZAKUM','HORNTAIL','PINKBEAN','SCARGA','PAPULATUS') NOT NULL COMMENT 'BOSS类型（ZAKUM扎昆/HORNTAIL闇黑龙王/PINKBEAN粉红比恩/SCARGA斯卡戈/PAPULATUS帕普拉图斯）',
  MODIFY COLUMN `attempttime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '挑战时间';

ALTER TABLE `buddies`
  COMMENT = '好友表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `characterid` int(11) NOT NULL COMMENT '角色ID（好友列表拥有者）',
  MODIFY COLUMN `buddyid` int(11) NOT NULL COMMENT '好友的角色ID',
  MODIFY COLUMN `pending` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否待对方确认（1=已申请未通过）',
  MODIFY COLUMN `group` varchar(17) DEFAULT '0' COMMENT '好友分组名';

ALTER TABLE `characters`
  COMMENT = '角色表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '角色ID',
  MODIFY COLUMN `accountid` int(11) NOT NULL DEFAULT '0' COMMENT '所属账号ID',
  MODIFY COLUMN `world` int(11) NOT NULL DEFAULT '0' COMMENT '所在世界（区）编号',
  MODIFY COLUMN `name` varchar(13) NOT NULL DEFAULT '' COMMENT '角色名',
  MODIFY COLUMN `level` int(11) NOT NULL DEFAULT '1' COMMENT '等级',
  MODIFY COLUMN `exp` int(11) NOT NULL DEFAULT '0' COMMENT '当前经验值',
  MODIFY COLUMN `gachaexp` int(11) NOT NULL DEFAULT '0' COMMENT '扭蛋机经验值',
  MODIFY COLUMN `str` int(11) NOT NULL DEFAULT '12' COMMENT '力量（基础值，不含装备）',
  MODIFY COLUMN `dex` int(11) NOT NULL DEFAULT '5' COMMENT '敏捷（基础值，不含装备）',
  MODIFY COLUMN `luk` int(11) NOT NULL DEFAULT '4' COMMENT '运气（基础值，不含装备）',
  MODIFY COLUMN `int` int(11) NOT NULL DEFAULT '4' COMMENT '智力（基础值，不含装备）',
  MODIFY COLUMN `hp` int(11) NOT NULL DEFAULT '50' COMMENT '当前HP（剩余血量）',
  MODIFY COLUMN `mp` int(11) NOT NULL DEFAULT '5' COMMENT '当前MP（剩余蓝量）',
  MODIFY COLUMN `maxhp` int(11) NOT NULL DEFAULT '50' COMMENT '基础最大HP（不含装备加成，有效上限30000）',
  MODIFY COLUMN `maxmp` int(11) NOT NULL DEFAULT '5' COMMENT '基础最大MP（不含装备加成，有效上限30000）',
  MODIFY COLUMN `meso` int(11) NOT NULL DEFAULT '0' COMMENT '金币数量',
  MODIFY COLUMN `hpMpUsed` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '已投入到HP/MP上的能力点（AP）数',
  MODIFY COLUMN `job` int(11) NOT NULL DEFAULT '0' COMMENT '职业ID',
  MODIFY COLUMN `skincolor` int(11) NOT NULL DEFAULT '0' COMMENT '肤色编号',
  MODIFY COLUMN `gender` int(11) NOT NULL DEFAULT '0' COMMENT '性别（0男/1女）',
  MODIFY COLUMN `fame` int(11) NOT NULL DEFAULT '0' COMMENT '人气值',
  MODIFY COLUMN `fquest` int(11) NOT NULL DEFAULT '0' COMMENT '任务获得的人气值',
  MODIFY COLUMN `hair` int(11) NOT NULL DEFAULT '0' COMMENT '发型ID',
  MODIFY COLUMN `face` int(11) NOT NULL DEFAULT '0' COMMENT '脸型ID',
  MODIFY COLUMN `ap` int(11) NOT NULL DEFAULT '0' COMMENT '剩余可用能力点（AP）',
  MODIFY COLUMN `sp` varchar(128) NOT NULL DEFAULT '0,0,0,0,0,0,0,0,0,0' COMMENT '剩余技能点（SP），10 个逗号分隔的数值',
  MODIFY COLUMN `map` int(11) NOT NULL DEFAULT '0' COMMENT '当前所在地图ID',
  MODIFY COLUMN `spawnpoint` int(11) NOT NULL DEFAULT '0' COMMENT '出生点编号',
  MODIFY COLUMN `gm` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'GM等级（0=普通玩家）',
  MODIFY COLUMN `party` int(11) NOT NULL DEFAULT '0' COMMENT '所属组队ID（0=无）',
  MODIFY COLUMN `buddyCapacity` int(11) NOT NULL DEFAULT '25' COMMENT '好友列表上限',
  MODIFY COLUMN `createdate` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '角色创建时间',
  MODIFY COLUMN `rank` int(10) unsigned NOT NULL DEFAULT '1' COMMENT '等级排名名次',
  MODIFY COLUMN `rankMove` int(11) NOT NULL DEFAULT '0' COMMENT '等级排名变化（正数=上升）',
  MODIFY COLUMN `jobRank` int(10) unsigned NOT NULL DEFAULT '1' COMMENT '职业排名名次',
  MODIFY COLUMN `jobRankMove` int(11) NOT NULL DEFAULT '0' COMMENT '职业排名变化',
  MODIFY COLUMN `guildid` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '所属公会ID（0=无）',
  MODIFY COLUMN `guildrank` int(10) unsigned NOT NULL DEFAULT '5' COMMENT '公会职位等级（1会长~5普通成员）',
  MODIFY COLUMN `messengerid` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '所属聊天群（Messenger）ID',
  MODIFY COLUMN `messengerposition` int(10) unsigned NOT NULL DEFAULT '4' COMMENT '聊天群中的位置',
  MODIFY COLUMN `mountlevel` int(9) NOT NULL DEFAULT '1' COMMENT '骑宠等级',
  MODIFY COLUMN `mountexp` int(9) NOT NULL DEFAULT '0' COMMENT '骑宠经验',
  MODIFY COLUMN `mounttiredness` int(9) NOT NULL DEFAULT '0' COMMENT '骑宠疲劳度',
  MODIFY COLUMN `omokwins` int(11) NOT NULL DEFAULT '0' COMMENT '五子棋胜利数',
  MODIFY COLUMN `omoklosses` int(11) NOT NULL DEFAULT '0' COMMENT '五子棋失败数',
  MODIFY COLUMN `omokties` int(11) NOT NULL DEFAULT '0' COMMENT '五子棋平局数',
  MODIFY COLUMN `matchcardwins` int(11) NOT NULL DEFAULT '0' COMMENT '翻牌记忆游戏胜利数',
  MODIFY COLUMN `matchcardlosses` int(11) NOT NULL DEFAULT '0' COMMENT '翻牌记忆游戏失败数',
  MODIFY COLUMN `matchcardties` int(11) NOT NULL DEFAULT '0' COMMENT '翻牌记忆游戏平局数',
  MODIFY COLUMN `MerchantMesos` int(11) DEFAULT '0' COMMENT '雇佣商人中存放的金币',
  MODIFY COLUMN `HasMerchant` tinyint(1) DEFAULT '0' COMMENT '是否正在使用雇佣商人（0否/1是）',
  MODIFY COLUMN `equipslots` int(11) NOT NULL DEFAULT '24' COMMENT '装备栏格数',
  MODIFY COLUMN `useslots` int(11) NOT NULL DEFAULT '24' COMMENT '消耗栏格数',
  MODIFY COLUMN `setupslots` int(11) NOT NULL DEFAULT '24' COMMENT '设置栏格数',
  MODIFY COLUMN `etcslots` int(11) NOT NULL DEFAULT '24' COMMENT '其他栏格数',
  MODIFY COLUMN `familyId` int(11) NOT NULL DEFAULT '-1' COMMENT '所属家族ID（-1=无）',
  MODIFY COLUMN `monsterbookcover` int(11) NOT NULL DEFAULT '0' COMMENT '怪物图鉴封面卡ID',
  MODIFY COLUMN `allianceRank` int(10) NOT NULL DEFAULT '5' COMMENT '同盟内职位等级',
  MODIFY COLUMN `vanquisherStage` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '征服者（Vanquisher）关卡进度',
  MODIFY COLUMN `ariantPoints` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '阿里安特竞技场积分',
  MODIFY COLUMN `dojoPoints` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '武陵道场积分',
  MODIFY COLUMN `lastDojoStage` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '上次武陵道场通关层数',
  MODIFY COLUMN `finishedDojoTutorial` tinyint(1) unsigned NOT NULL DEFAULT '0' COMMENT '是否完成道场教学（0否/1是）',
  MODIFY COLUMN `vanquisherKills` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '征服者模式累计击杀数',
  MODIFY COLUMN `summonValue` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '召唤兽相关数值（服务端未使用，遗留字段）',
  MODIFY COLUMN `partnerId` int(11) NOT NULL DEFAULT '0' COMMENT '结婚对象角色ID（0=未婚）',
  MODIFY COLUMN `marriageItemId` int(11) NOT NULL DEFAULT '0' COMMENT '结婚用戒指物品ID',
  MODIFY COLUMN `reborns` int(5) NOT NULL DEFAULT '0' COMMENT '转生次数',
  MODIFY COLUMN `PQPoints` int(11) NOT NULL DEFAULT '0' COMMENT '组队任务点数（服务端未使用，遗留字段）',
  MODIFY COLUMN `dataString` varchar(64) NOT NULL DEFAULT '' COMMENT '自定义标记串（记录已完成的组队任务等，按字母拼接）',
  MODIFY COLUMN `lastLogoutTime` timestamp NOT NULL DEFAULT '2015-01-01 05:00:00' COMMENT '最后登出时间',
  MODIFY COLUMN `lastExpGainTime` timestamp NOT NULL DEFAULT '2015-01-01 05:00:00' COMMENT '最后一次获得经验的时间',
  MODIFY COLUMN `partySearch` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否接受组队搜索邀请（0否/1是）',
  MODIFY COLUMN `jailexpire` bigint(20) NOT NULL DEFAULT '0' COMMENT '监狱禁闭到期时间戳（0=未禁闭）';

ALTER TABLE `cooldowns`
  COMMENT = '技能冷却记录表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `charid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `SkillID` int(11) NOT NULL COMMENT '技能ID',
  MODIFY COLUMN `length` bigint(20) unsigned NOT NULL COMMENT '冷却时长（毫秒）',
  MODIFY COLUMN `StartTime` bigint(20) unsigned NOT NULL COMMENT '冷却开始时间戳（毫秒）';

ALTER TABLE `drop_data`
  COMMENT = '怪物掉落表',
  MODIFY COLUMN `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `dropperid` int(11) NOT NULL COMMENT '掉落者怪物ID',
  MODIFY COLUMN `itemid` int(11) NOT NULL DEFAULT '0' COMMENT '掉落物品ID（0 表示掉金币）',
  MODIFY COLUMN `minimum_quantity` int(11) NOT NULL DEFAULT '1' COMMENT '掉落数量下限',
  MODIFY COLUMN `maximum_quantity` int(11) NOT NULL DEFAULT '1' COMMENT '掉落数量上限',
  MODIFY COLUMN `questid` int(11) NOT NULL DEFAULT '0' COMMENT '关联任务ID（0=普通掉落；非0=只有接了该任务的玩家才掉）',
  MODIFY COLUMN `chance` int(11) NOT NULL DEFAULT '0' COMMENT '掉落概率（百万分比，越大越容易掉；百分比 = chance/10000）';

ALTER TABLE `drop_data_global`
  COMMENT = '全局掉落表（按大陆）',
  MODIFY COLUMN `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `continent` tinyint(1) NOT NULL DEFAULT '-1' COMMENT '生效大陆编号（-1=所有地图）',
  MODIFY COLUMN `itemid` int(11) NOT NULL DEFAULT '0' COMMENT '掉落物品ID（0 表示掉金币）',
  MODIFY COLUMN `minimum_quantity` int(11) NOT NULL DEFAULT '1' COMMENT '掉落数量下限',
  MODIFY COLUMN `maximum_quantity` int(11) NOT NULL DEFAULT '1' COMMENT '掉落数量上限',
  MODIFY COLUMN `questid` int(11) NOT NULL DEFAULT '0' COMMENT '关联任务ID（0=普通掉落；非0=只有接了该任务的玩家才掉）',
  MODIFY COLUMN `chance` int(11) NOT NULL DEFAULT '0' COMMENT '掉落概率（百万分比，越大越容易掉；百分比 = chance/10000）',
  MODIFY COLUMN `comments` varchar(45) DEFAULT NULL COMMENT '备注（仅供人看，不影响逻辑）';

ALTER TABLE `dueyitems`
  COMMENT = '快递包裹内含物品表',
  MODIFY COLUMN `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `PackageId` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '所属包裹ID（对应 dueypackages.PackageId）',
  MODIFY COLUMN `inventoryitemid` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '物品ID（对应 inventoryitems.inventoryitemid）';

ALTER TABLE `dueypackages`
  COMMENT = '快递包裹表',
  MODIFY COLUMN `PackageId` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '包裹ID',
  MODIFY COLUMN `ReceiverId` int(10) unsigned NOT NULL COMMENT '收件人角色ID',
  MODIFY COLUMN `SenderName` varchar(13) NOT NULL COMMENT '寄件人角色名',
  MODIFY COLUMN `Mesos` int(10) unsigned DEFAULT '0' COMMENT '随包裹附带的金币',
  MODIFY COLUMN `TimeStamp` timestamp NOT NULL DEFAULT '2015-01-01 05:00:00' COMMENT '寄出时间',
  MODIFY COLUMN `Message` varchar(200) DEFAULT NULL COMMENT '附言内容',
  MODIFY COLUMN `Checked` tinyint(1) unsigned DEFAULT '1' COMMENT '是否已领取（0未领/1已领）',
  MODIFY COLUMN `Type` tinyint(1) unsigned DEFAULT '0' COMMENT '包裹类型（0普通/1结婚戒指等）';

ALTER TABLE `eventstats`
  COMMENT = '活动统计表',
  MODIFY COLUMN `characterid` int(11) unsigned NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `name` varchar(11) NOT NULL DEFAULT '0' COMMENT '统计项名称',
  MODIFY COLUMN `info` int(11) NOT NULL COMMENT '统计数值';

ALTER TABLE `famelog`
  COMMENT = '人气值变动记录表',
  MODIFY COLUMN `famelogid` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `characterid` int(11) NOT NULL DEFAULT '0' COMMENT '点人气的角色ID（发起者）',
  MODIFY COLUMN `characterid_to` int(11) NOT NULL DEFAULT '0' COMMENT '被点人气的角色ID（对象）',
  MODIFY COLUMN `when` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间';

ALTER TABLE `family_character`
  COMMENT = '家族成员表',
  MODIFY COLUMN `cid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `familyid` int(11) NOT NULL COMMENT '所属家族ID',
  MODIFY COLUMN `seniorid` int(11) NOT NULL COMMENT '上级（前辈）角色ID',
  MODIFY COLUMN `reputation` int(11) NOT NULL DEFAULT '0' COMMENT '当前声望值',
  MODIFY COLUMN `todaysrep` int(11) NOT NULL DEFAULT '0' COMMENT '今日已获得的声望值',
  MODIFY COLUMN `totalreputation` int(11) NOT NULL DEFAULT '0' COMMENT '累计总声望值',
  MODIFY COLUMN `reptosenior` int(11) NOT NULL DEFAULT '0' COMMENT '已上交给前辈的声望值',
  MODIFY COLUMN `precepts` varchar(200) DEFAULT NULL COMMENT '家族格言',
  MODIFY COLUMN `lastresettime` bigint(20) NOT NULL DEFAULT '0' COMMENT '上次重置时间戳';

ALTER TABLE `family_entitlement`
  COMMENT = '家族特权领取记录表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `charid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `entitlementid` int(11) NOT NULL COMMENT '已领取的家族特权ID',
  MODIFY COLUMN `timestamp` bigint(20) NOT NULL DEFAULT '0' COMMENT '领取时间戳';

ALTER TABLE `fredstorage`
  COMMENT = '弗里德寄存（每日便签）表',
  MODIFY COLUMN `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `cid` int(10) unsigned NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `daynotes` int(4) unsigned NOT NULL COMMENT '当日可写便签数（已使用数量）',
  MODIFY COLUMN `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间';

ALTER TABLE `gifts`
  COMMENT = '商城赠礼表',
  MODIFY COLUMN `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `to` int(11) NOT NULL COMMENT '收礼人角色ID',
  MODIFY COLUMN `from` varchar(13) NOT NULL COMMENT '送礼人角色名',
  MODIFY COLUMN `message` tinytext NOT NULL COMMENT '赠礼附言',
  MODIFY COLUMN `sn` int(10) unsigned NOT NULL COMMENT '商品序号（SN）',
  MODIFY COLUMN `ringid` int(10) NOT NULL COMMENT '关联戒指ID';

ALTER TABLE `guilds`
  COMMENT = '公会表',
  MODIFY COLUMN `guildid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '公会ID',
  MODIFY COLUMN `leader` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '会长角色ID',
  MODIFY COLUMN `GP` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '公会点数（GP）',
  MODIFY COLUMN `logo` int(10) unsigned DEFAULT NULL COMMENT '公会标志编号',
  MODIFY COLUMN `logoColor` smallint(5) unsigned NOT NULL DEFAULT '0' COMMENT '公会标志颜色',
  MODIFY COLUMN `name` varchar(45) NOT NULL COMMENT '公会名称',
  MODIFY COLUMN `rank1title` varchar(45) NOT NULL DEFAULT 'Master' COMMENT '职位名-1级（会长）',
  MODIFY COLUMN `rank2title` varchar(45) NOT NULL DEFAULT 'Jr. Master' COMMENT '职位名-2级（副会长）',
  MODIFY COLUMN `rank3title` varchar(45) NOT NULL DEFAULT 'Member' COMMENT '职位名-3级',
  MODIFY COLUMN `rank4title` varchar(45) NOT NULL DEFAULT 'Member' COMMENT '职位名-4级',
  MODIFY COLUMN `rank5title` varchar(45) NOT NULL DEFAULT 'Member' COMMENT '职位名-5级（普通成员）',
  MODIFY COLUMN `capacity` int(10) unsigned NOT NULL DEFAULT '10' COMMENT '公会人数上限',
  MODIFY COLUMN `logoBG` int(10) unsigned DEFAULT NULL COMMENT '公会标志背景编号',
  MODIFY COLUMN `logoBGColor` smallint(5) unsigned NOT NULL DEFAULT '0' COMMENT '公会标志背景颜色',
  MODIFY COLUMN `notice` varchar(101) DEFAULT NULL COMMENT '公会公告',
  MODIFY COLUMN `signature` int(11) NOT NULL DEFAULT '0' COMMENT '公会签名样式',
  MODIFY COLUMN `allianceId` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '所属同盟ID（0=无）';

ALTER TABLE `huodong`
  COMMENT = '活动记录表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `charid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `huodongid` int(11) NOT NULL COMMENT '活动ID',
  MODIFY COLUMN `status` int(11) NOT NULL DEFAULT '0' COMMENT '活动进度状态',
  MODIFY COLUMN `expiration` bigint(20) NOT NULL DEFAULT '-1' COMMENT '过期时间戳（-1=永久）';

ALTER TABLE `hwidaccounts`
  COMMENT = '账号-机器码关联表',
  MODIFY COLUMN `accountid` int(11) NOT NULL DEFAULT '0' COMMENT '账号ID',
  MODIFY COLUMN `hwid` varchar(40) NOT NULL DEFAULT '' COMMENT '机器码（HWID）',
  MODIFY COLUMN `relevance` tinyint(2) NOT NULL DEFAULT '0' COMMENT '关联度（该机器码的匹配/出现次数）',
  MODIFY COLUMN `expiresat` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录过期时间';

ALTER TABLE `hwidbans`
  COMMENT = '机器码封禁表',
  MODIFY COLUMN `hwidbanid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `hwid` varchar(30) NOT NULL COMMENT '被封禁的机器码';

ALTER TABLE `inventoryequipment`
  COMMENT = '装备附加属性表',
  MODIFY COLUMN `inventoryequipmentid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '装备属性记录ID',
  MODIFY COLUMN `inventoryitemid` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '物品ID（对应 inventoryitems.inventoryitemid）',
  MODIFY COLUMN `upgradeslots` int(11) NOT NULL DEFAULT '0' COMMENT '剩余可升级次数（白字卷轴格）',
  MODIFY COLUMN `level` int(11) NOT NULL DEFAULT '0' COMMENT '已升级（已砸卷轴）次数',
  MODIFY COLUMN `str` int(11) NOT NULL DEFAULT '0' COMMENT '附加力量',
  MODIFY COLUMN `dex` int(11) NOT NULL DEFAULT '0' COMMENT '附加敏捷',
  MODIFY COLUMN `int` int(11) NOT NULL DEFAULT '0' COMMENT '附加智力',
  MODIFY COLUMN `luk` int(11) NOT NULL DEFAULT '0' COMMENT '附加运气',
  MODIFY COLUMN `hp` int(11) NOT NULL DEFAULT '0' COMMENT '附加HP',
  MODIFY COLUMN `mp` int(11) NOT NULL DEFAULT '0' COMMENT '附加MP',
  MODIFY COLUMN `watk` int(11) NOT NULL DEFAULT '0' COMMENT '附加物理攻击力',
  MODIFY COLUMN `matk` int(11) NOT NULL DEFAULT '0' COMMENT '附加魔法攻击力',
  MODIFY COLUMN `wdef` int(11) NOT NULL DEFAULT '0' COMMENT '附加物理防御力',
  MODIFY COLUMN `mdef` int(11) NOT NULL DEFAULT '0' COMMENT '附加魔法防御力',
  MODIFY COLUMN `acc` int(11) NOT NULL DEFAULT '0' COMMENT '附加命中率',
  MODIFY COLUMN `avoid` int(11) NOT NULL DEFAULT '0' COMMENT '附加回避率',
  MODIFY COLUMN `hands` int(11) NOT NULL DEFAULT '0' COMMENT '附加手技',
  MODIFY COLUMN `speed` int(11) NOT NULL DEFAULT '0' COMMENT '附加移动速度',
  MODIFY COLUMN `jump` int(11) NOT NULL DEFAULT '0' COMMENT '附加跳跃力',
  MODIFY COLUMN `locked` int(11) NOT NULL DEFAULT '0' COMMENT '是否已锁定（不可交易/丢弃）',
  MODIFY COLUMN `vicious` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '宿命（黄金锤）剩余可用次数',
  MODIFY COLUMN `itemlevel` int(11) NOT NULL DEFAULT '1' COMMENT '装备自身等级（成长型装备）',
  MODIFY COLUMN `itemexp` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '装备自身经验',
  MODIFY COLUMN `ringid` int(11) NOT NULL DEFAULT '-1' COMMENT '关联戒指ID（-1=无）';

ALTER TABLE `inventoryitems`
  COMMENT = '背包物品表',
  MODIFY COLUMN `inventoryitemid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '物品唯一ID',
  MODIFY COLUMN `type` tinyint(3) unsigned NOT NULL COMMENT '物品大类（1装备/2消耗/3设置/4其他/5现金），查询时用于筛选',
  MODIFY COLUMN `characterid` int(11) DEFAULT NULL COMMENT '所属角色ID（存仓库时为NULL）',
  MODIFY COLUMN `accountid` int(11) DEFAULT NULL COMMENT '所属账号ID',
  MODIFY COLUMN `itemid` int(11) NOT NULL DEFAULT '0' COMMENT '物品ID（对应 wz 物品编号）',
  MODIFY COLUMN `inventorytype` int(11) NOT NULL DEFAULT '0' COMMENT '所在背包槽位类型（-1已穿戴/1装备/2消耗/3设置/4其他/5现金）',
  MODIFY COLUMN `position` int(11) NOT NULL DEFAULT '0' COMMENT '背包格子位置',
  MODIFY COLUMN `quantity` int(11) NOT NULL DEFAULT '0' COMMENT '数量',
  MODIFY COLUMN `owner` tinytext NOT NULL COMMENT '拾取者（归属角色名）',
  MODIFY COLUMN `petid` int(11) NOT NULL DEFAULT '-1' COMMENT '关联宠物ID（-1=无）',
  MODIFY COLUMN `flag` int(11) NOT NULL COMMENT '物品标记（不可交易/账号绑定等位标记）',
  MODIFY COLUMN `expiration` bigint(20) NOT NULL DEFAULT '-1' COMMENT '过期时间戳（-1=永久）',
  MODIFY COLUMN `giftFrom` varchar(26) NOT NULL COMMENT '赠送来源（送礼人角色名）';

ALTER TABLE `inventorymerchant`
  COMMENT = '雇佣商人（玩家商店）物品表',
  MODIFY COLUMN `inventorymerchantid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `inventoryitemid` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '物品ID（对应 inventoryitems.inventoryitemid）',
  MODIFY COLUMN `characterid` int(11) DEFAULT NULL COMMENT '店主角色ID',
  MODIFY COLUMN `bundles` int(10) NOT NULL DEFAULT '0' COMMENT '打包出售的数量';

ALTER TABLE `ipbans`
  COMMENT = 'IP封禁表',
  MODIFY COLUMN `ipbanid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `ip` varchar(40) NOT NULL DEFAULT '' COMMENT '被封禁的IP地址',
  MODIFY COLUMN `aid` varchar(40) DEFAULT NULL COMMENT '关联账号信息（备注）';

ALTER TABLE `keymap`
  COMMENT = '按键设置表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `characterid` int(11) NOT NULL DEFAULT '0' COMMENT '角色ID',
  MODIFY COLUMN `key` int(11) NOT NULL DEFAULT '0' COMMENT '按键代码',
  MODIFY COLUMN `type` int(11) NOT NULL DEFAULT '0' COMMENT '按键类型（0未绑定/1技能/2道具/3表情/4基础动作/5宏/6菜单）',
  MODIFY COLUMN `action` int(11) NOT NULL DEFAULT '0' COMMENT '绑定的动作或技能/道具ID';

ALTER TABLE `macbans`
  COMMENT = 'MAC地址封禁表',
  MODIFY COLUMN `macbanid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `mac` varchar(30) NOT NULL COMMENT '被封禁的MAC地址',
  MODIFY COLUMN `aid` varchar(40) DEFAULT NULL COMMENT '关联账号信息（备注）';

ALTER TABLE `macfilters`
  COMMENT = 'MAC地址白名单表',
  MODIFY COLUMN `macfilterid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `filter` varchar(30) NOT NULL COMMENT '允许登录的MAC地址前缀';

ALTER TABLE `makercreatedata`
  COMMENT = '匠人制作配方表',
  MODIFY COLUMN `id` tinyint(3) unsigned NOT NULL COMMENT '自增主键',
  MODIFY COLUMN `itemid` int(11) NOT NULL COMMENT '可制作出的物品ID',
  MODIFY COLUMN `req_level` tinyint(3) unsigned NOT NULL COMMENT '需求角色等级',
  MODIFY COLUMN `req_maker_level` tinyint(3) unsigned NOT NULL COMMENT '需求匠人（制作）等级',
  MODIFY COLUMN `req_meso` int(11) NOT NULL COMMENT '需求金币',
  MODIFY COLUMN `req_item` int(11) NOT NULL COMMENT '需求材料物品ID',
  MODIFY COLUMN `req_equip` int(11) NOT NULL COMMENT '需求装备ID',
  MODIFY COLUMN `catalyst` int(11) NOT NULL COMMENT '可选催化剂物品ID',
  MODIFY COLUMN `quantity` smallint(6) NOT NULL COMMENT '产出数量',
  MODIFY COLUMN `tuc` tinyint(3) NOT NULL COMMENT '产出装备的可升级次数';

ALTER TABLE `makerreagentdata`
  COMMENT = '匠人催化剂属性表',
  MODIFY COLUMN `itemid` int(11) NOT NULL COMMENT '催化剂物品ID',
  MODIFY COLUMN `stat` varchar(20) NOT NULL COMMENT '影响的属性名（如 STR/DEX/INT/LUK/WATK）',
  MODIFY COLUMN `value` smallint(6) NOT NULL COMMENT '属性增加/减少值';

ALTER TABLE `makerrecipedata`
  COMMENT = '匠人制作材料需求表',
  MODIFY COLUMN `itemid` int(11) NOT NULL COMMENT '物品ID',
  MODIFY COLUMN `req_item` int(11) NOT NULL COMMENT '需求材料物品ID',
  MODIFY COLUMN `count` smallint(6) NOT NULL COMMENT '需求数量';

ALTER TABLE `makerrewarddata`
  COMMENT = '匠人制作产出奖励表',
  MODIFY COLUMN `itemid` int(11) NOT NULL COMMENT '物品ID',
  MODIFY COLUMN `rewardid` int(11) NOT NULL COMMENT '奖励物品ID',
  MODIFY COLUMN `quantity` smallint(6) NOT NULL COMMENT '奖励数量',
  MODIFY COLUMN `prob` tinyint(3) unsigned NOT NULL DEFAULT '100' COMMENT '触发概率（百分比）';

ALTER TABLE `marriages`
  COMMENT = '结婚记录表',
  MODIFY COLUMN `marriageid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '婚姻记录ID',
  MODIFY COLUMN `husbandid` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '丈夫角色ID',
  MODIFY COLUMN `wifeid` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '妻子角色ID';

ALTER TABLE `medalmaps`
  COMMENT = '勋章地图记录表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `characterid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `queststatusid` int(11) unsigned NOT NULL COMMENT '关联的任务状态ID',
  MODIFY COLUMN `mapid` int(11) NOT NULL COMMENT '已解锁/已记录的地图ID';

ALTER TABLE `monsterbook`
  COMMENT = '怪物图鉴收集表',
  MODIFY COLUMN `charid` int(11) unsigned NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `cardid` int(11) NOT NULL COMMENT '怪物卡ID',
  MODIFY COLUMN `level` int(1) DEFAULT '1' COMMENT '卡片等级';

ALTER TABLE `monstercarddata`
  COMMENT = '怪物卡与怪物对应表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `cardid` int(11) NOT NULL DEFAULT '0' COMMENT '怪物卡ID',
  MODIFY COLUMN `mobid` int(11) NOT NULL DEFAULT '0' COMMENT '对应的怪物ID';

ALTER TABLE `mts_cart`
  COMMENT = 'MTS（拍卖行）收藏夹表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `cid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `itemid` int(11) NOT NULL COMMENT '收藏的物品ID';

ALTER TABLE `mts_items`
  COMMENT = 'MTS（拍卖行）寄售物品表',
  MODIFY COLUMN `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `tab` int(11) NOT NULL DEFAULT '0' COMMENT '所在分类页',
  MODIFY COLUMN `type` int(11) NOT NULL DEFAULT '0' COMMENT '登录方式标记（0按角色/1按账号）',
  MODIFY COLUMN `itemid` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '寄售物品ID',
  MODIFY COLUMN `quantity` int(11) NOT NULL DEFAULT '1' COMMENT '数量',
  MODIFY COLUMN `seller` int(11) NOT NULL DEFAULT '0' COMMENT '卖家角色ID',
  MODIFY COLUMN `price` int(11) NOT NULL DEFAULT '0' COMMENT '当前竞价（起始价）',
  MODIFY COLUMN `bid_incre` int(11) DEFAULT '0' COMMENT '每次加价幅度',
  MODIFY COLUMN `buy_now` int(11) DEFAULT '0' COMMENT '一口价',
  MODIFY COLUMN `position` int(11) DEFAULT '0' COMMENT '原背包格子位置',
  MODIFY COLUMN `upgradeslots` int(11) DEFAULT '0' COMMENT '寄售装备的剩余可升级次数（白字卷轴格）',
  MODIFY COLUMN `level` int(11) DEFAULT '0' COMMENT '寄售装备的已升级（已砸卷轴）次数',
  MODIFY COLUMN `itemlevel` int(11) NOT NULL DEFAULT '1' COMMENT '寄售装备的装备自身等级（成长型装备）',
  MODIFY COLUMN `itemexp` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '寄售装备的装备自身经验',
  MODIFY COLUMN `ringid` int(11) NOT NULL DEFAULT '-1' COMMENT '寄售装备的关联戒指ID（-1=无）',
  MODIFY COLUMN `str` int(11) DEFAULT '0' COMMENT '寄售装备的附加力量',
  MODIFY COLUMN `dex` int(11) DEFAULT '0' COMMENT '寄售装备的附加敏捷',
  MODIFY COLUMN `int` int(11) DEFAULT '0' COMMENT '寄售装备的附加智力',
  MODIFY COLUMN `luk` int(11) DEFAULT '0' COMMENT '寄售装备的附加运气',
  MODIFY COLUMN `hp` int(11) DEFAULT '0' COMMENT '寄售装备的附加HP',
  MODIFY COLUMN `mp` int(11) DEFAULT '0' COMMENT '寄售装备的附加MP',
  MODIFY COLUMN `watk` int(11) DEFAULT '0' COMMENT '寄售装备的附加物理攻击力',
  MODIFY COLUMN `matk` int(11) DEFAULT '0' COMMENT '寄售装备的附加魔法攻击力',
  MODIFY COLUMN `wdef` int(11) DEFAULT '0' COMMENT '寄售装备的附加物理防御力',
  MODIFY COLUMN `mdef` int(11) DEFAULT '0' COMMENT '寄售装备的附加魔法防御力',
  MODIFY COLUMN `acc` int(11) DEFAULT '0' COMMENT '寄售装备的附加命中率',
  MODIFY COLUMN `avoid` int(11) DEFAULT '0' COMMENT '寄售装备的附加回避率',
  MODIFY COLUMN `hands` int(11) DEFAULT '0' COMMENT '寄售装备的附加手技',
  MODIFY COLUMN `speed` int(11) DEFAULT '0' COMMENT '寄售装备的附加移动速度',
  MODIFY COLUMN `jump` int(11) DEFAULT '0' COMMENT '寄售装备的附加跳跃力',
  MODIFY COLUMN `locked` int(11) DEFAULT '0' COMMENT '寄售装备的是否已锁定（不可交易/丢弃）',
  MODIFY COLUMN `isequip` int(1) DEFAULT '0' COMMENT '是否为装备（0否/1是）',
  MODIFY COLUMN `owner` varchar(16) DEFAULT '' COMMENT '物品原归属者名',
  MODIFY COLUMN `sellername` varchar(16) NOT NULL COMMENT '卖家角色名',
  MODIFY COLUMN `sell_ends` varchar(16) NOT NULL COMMENT '拍卖结束时间',
  MODIFY COLUMN `transfer` int(2) DEFAULT '0' COMMENT '是否可转移',
  MODIFY COLUMN `vicious` int(2) unsigned NOT NULL DEFAULT '0' COMMENT '寄售装备的宿命（黄金锤）剩余可用次数',
  MODIFY COLUMN `flag` int(2) unsigned NOT NULL DEFAULT '0' COMMENT '物品标记',
  MODIFY COLUMN `expiration` bigint(20) NOT NULL DEFAULT '-1' COMMENT '过期时间戳（-1=永久）',
  MODIFY COLUMN `giftFrom` varchar(26) NOT NULL COMMENT '赠送来源';

ALTER TABLE `namechanges`
  COMMENT = '角色改名记录表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `characterid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `old` varchar(13) NOT NULL COMMENT '原角色名',
  MODIFY COLUMN `new` varchar(13) NOT NULL COMMENT '新角色名',
  MODIFY COLUMN `requestTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  MODIFY COLUMN `completionTime` timestamp NULL DEFAULT NULL COMMENT '完成时间';

ALTER TABLE `newyear`
  COMMENT = '新年贺卡表',
  MODIFY COLUMN `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `senderid` int(10) NOT NULL DEFAULT '-1' COMMENT '发送者角色ID',
  MODIFY COLUMN `sendername` varchar(13) DEFAULT '' COMMENT '发送者角色名',
  MODIFY COLUMN `receiverid` int(10) NOT NULL DEFAULT '-1' COMMENT '接收者角色ID',
  MODIFY COLUMN `receivername` varchar(13) DEFAULT '' COMMENT '接收者角色名',
  MODIFY COLUMN `message` varchar(120) DEFAULT '' COMMENT '贺卡内容',
  MODIFY COLUMN `senderdiscard` tinyint(1) NOT NULL DEFAULT '0' COMMENT '发送者是否已删除',
  MODIFY COLUMN `receiverdiscard` tinyint(1) NOT NULL DEFAULT '0' COMMENT '接收者是否已删除',
  MODIFY COLUMN `received` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否已被接收',
  MODIFY COLUMN `timesent` bigint(20) unsigned NOT NULL COMMENT '发送时间戳',
  MODIFY COLUMN `timereceived` bigint(20) unsigned NOT NULL COMMENT '接收时间戳';

ALTER TABLE `notes`
  COMMENT = '便签（邮件）表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `to` varchar(13) NOT NULL DEFAULT '' COMMENT '收件人角色名',
  MODIFY COLUMN `from` varchar(13) NOT NULL DEFAULT '' COMMENT '发件人角色名',
  MODIFY COLUMN `message` text NOT NULL COMMENT '便签内容',
  MODIFY COLUMN `timestamp` bigint(20) unsigned NOT NULL COMMENT '发送时间戳',
  MODIFY COLUMN `fame` int(11) NOT NULL DEFAULT '0' COMMENT '随便签附带的人气值',
  MODIFY COLUMN `deleted` int(2) NOT NULL DEFAULT '0' COMMENT '是否已删除（0否/1是）';

ALTER TABLE `nxcode`
  COMMENT = 'NX兑换码表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `code` varchar(17) NOT NULL COMMENT '兑换码',
  MODIFY COLUMN `retriever` varchar(13) DEFAULT NULL COMMENT '已兑换的账号名（NULL=未使用）',
  MODIFY COLUMN `expiration` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT '过期时间戳';

ALTER TABLE `nxcode_items`
  COMMENT = '兑换码奖励物品表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `codeid` int(11) NOT NULL COMMENT '所属兑换码记录ID',
  MODIFY COLUMN `type` int(11) NOT NULL DEFAULT '5' COMMENT '物品类型（对应 inventorytype）',
  MODIFY COLUMN `item` int(11) NOT NULL DEFAULT '4000000' COMMENT '奖励物品ID',
  MODIFY COLUMN `quantity` int(11) NOT NULL DEFAULT '1' COMMENT '奖励数量';

ALTER TABLE `nxcoupons`
  COMMENT = 'NX优惠券活动表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `couponid` int(11) NOT NULL DEFAULT '0' COMMENT '优惠券ID',
  MODIFY COLUMN `rate` int(11) NOT NULL DEFAULT '0' COMMENT '优惠倍率（百分比）',
  MODIFY COLUMN `activeday` int(11) NOT NULL DEFAULT '0' COMMENT '生效星期（位掩码，第0位=周日）',
  MODIFY COLUMN `starthour` int(11) NOT NULL DEFAULT '0' COMMENT '生效起始小时',
  MODIFY COLUMN `endhour` int(11) NOT NULL DEFAULT '0' COMMENT '生效结束小时';

ALTER TABLE `petignores`
  COMMENT = '宠物拾取忽略表',
  MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `petid` int(11) unsigned NOT NULL COMMENT '宠物ID',
  MODIFY COLUMN `itemid` int(10) unsigned NOT NULL COMMENT '宠物不拾取的物品ID';

ALTER TABLE `pets`
  COMMENT = '宠物表',
  MODIFY COLUMN `petid` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '宠物ID',
  MODIFY COLUMN `name` varchar(13) DEFAULT NULL COMMENT '宠物名字',
  MODIFY COLUMN `level` int(10) unsigned NOT NULL COMMENT '宠物等级',
  MODIFY COLUMN `closeness` int(10) unsigned NOT NULL COMMENT '亲密度',
  MODIFY COLUMN `fullness` int(10) unsigned NOT NULL COMMENT '饱食度',
  MODIFY COLUMN `summoned` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否处于召唤状态（0否/1是）',
  MODIFY COLUMN `flag` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '宠物标记位';

ALTER TABLE `playerdiseases`
  COMMENT = '角色异常状态表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `charid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `disease` int(11) NOT NULL COMMENT '异常状态ID（中毒/眩晕/封印等）',
  MODIFY COLUMN `mobskillid` int(11) NOT NULL COMMENT '施加该状态的怪物技能ID',
  MODIFY COLUMN `mobskilllv` int(11) NOT NULL COMMENT '怪物技能等级',
  MODIFY COLUMN `length` int(11) NOT NULL DEFAULT '1' COMMENT '剩余持续时长';

ALTER TABLE `playernpcs`
  COMMENT = '排名NPC（雕像）表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `name` varchar(13) NOT NULL COMMENT '角色名（显示用）',
  MODIFY COLUMN `hair` int(11) NOT NULL COMMENT '发型ID',
  MODIFY COLUMN `face` int(11) NOT NULL COMMENT '脸型ID',
  MODIFY COLUMN `skin` int(11) NOT NULL COMMENT '肤色编号',
  MODIFY COLUMN `gender` int(11) NOT NULL DEFAULT '0' COMMENT '性别',
  MODIFY COLUMN `x` int(11) NOT NULL COMMENT 'X坐标',
  MODIFY COLUMN `cy` int(11) NOT NULL DEFAULT '0' COMMENT 'Y坐标',
  MODIFY COLUMN `world` int(11) NOT NULL DEFAULT '0' COMMENT '所在世界（区）编号',
  MODIFY COLUMN `map` int(11) NOT NULL DEFAULT '0' COMMENT '所在地图ID',
  MODIFY COLUMN `dir` int(11) NOT NULL DEFAULT '0' COMMENT '朝向（0左/1右）',
  MODIFY COLUMN `scriptid` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '绑定的脚本ID',
  MODIFY COLUMN `fh` int(11) NOT NULL DEFAULT '0' COMMENT '所在平台（foothold）编号',
  MODIFY COLUMN `rx0` int(11) NOT NULL DEFAULT '0' COMMENT '活动范围左边界',
  MODIFY COLUMN `rx1` int(11) NOT NULL DEFAULT '0' COMMENT '活动范围右边界',
  MODIFY COLUMN `worldrank` int(11) NOT NULL DEFAULT '0' COMMENT '世界等级排名名次',
  MODIFY COLUMN `overallrank` int(11) NOT NULL DEFAULT '0' COMMENT '总排名名次',
  MODIFY COLUMN `worldjobrank` int(11) NOT NULL DEFAULT '0' COMMENT '世界职业排名名次',
  MODIFY COLUMN `job` int(11) NOT NULL DEFAULT '0' COMMENT '职业ID';

ALTER TABLE `playernpcs_equip`
  COMMENT = '排名NPC装备表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `npcid` int(11) NOT NULL DEFAULT '0' COMMENT '排名NPC的ID（对应 playernpcs.id）',
  MODIFY COLUMN `equipid` int(11) NOT NULL COMMENT '装备物品ID',
  MODIFY COLUMN `type` int(11) NOT NULL DEFAULT '0' COMMENT '装备部位类型',
  MODIFY COLUMN `equippos` int(11) NOT NULL COMMENT '装备部位位置';

ALTER TABLE `playernpcs_field`
  COMMENT = '排名NPC场地设置表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `world` int(11) NOT NULL COMMENT '世界（区）编号',
  MODIFY COLUMN `map` int(11) NOT NULL COMMENT '地图ID',
  MODIFY COLUMN `step` tinyint(1) NOT NULL DEFAULT '0' COMMENT '雕像所在台阶层级',
  MODIFY COLUMN `podium` smallint(8) NOT NULL DEFAULT '0' COMMENT '雕像所在站台编号';

ALTER TABLE `plife`
  COMMENT = '地图生命体生成点表',
  MODIFY COLUMN `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `world` int(11) NOT NULL DEFAULT '-1' COMMENT '世界（区）编号（-1=全部）',
  MODIFY COLUMN `map` int(11) NOT NULL DEFAULT '0' COMMENT '所在地图ID',
  MODIFY COLUMN `life` int(11) NOT NULL DEFAULT '0' COMMENT '生命体ID（NPC或怪物ID）',
  MODIFY COLUMN `type` varchar(1) NOT NULL DEFAULT 'n' COMMENT '类型（n=NPC / m=怪物）',
  MODIFY COLUMN `cy` int(11) NOT NULL DEFAULT '0' COMMENT 'Y坐标',
  MODIFY COLUMN `f` int(11) NOT NULL DEFAULT '0' COMMENT '朝向',
  MODIFY COLUMN `fh` int(11) NOT NULL DEFAULT '0' COMMENT '所在平台（foothold）编号',
  MODIFY COLUMN `rx0` int(11) NOT NULL DEFAULT '0' COMMENT '活动范围左边界',
  MODIFY COLUMN `rx1` int(11) NOT NULL DEFAULT '0' COMMENT '活动范围右边界',
  MODIFY COLUMN `x` int(11) NOT NULL DEFAULT '0' COMMENT 'X坐标',
  MODIFY COLUMN `y` int(11) NOT NULL DEFAULT '0' COMMENT 'Y坐标',
  MODIFY COLUMN `hide` int(11) NOT NULL DEFAULT '0' COMMENT '是否隐藏（1=不可见）',
  MODIFY COLUMN `mobtime` int(11) NOT NULL DEFAULT '0' COMMENT '刷新间隔（秒；0=只等死亡动画）',
  MODIFY COLUMN `team` int(11) NOT NULL DEFAULT '0' COMMENT '所属队伍（团队副本用）';

ALTER TABLE `questactions`
  COMMENT = '任务动作数据表',
  MODIFY COLUMN `questactionid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `questid` int(11) NOT NULL DEFAULT '0' COMMENT '任务ID',
  MODIFY COLUMN `status` int(11) NOT NULL DEFAULT '0' COMMENT '任务状态',
  MODIFY COLUMN `data` blob NOT NULL COMMENT '动作数据（二进制序列化）';

ALTER TABLE `questprogress`
  COMMENT = '任务进度表',
  MODIFY COLUMN `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `characterid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `queststatusid` int(10) unsigned NOT NULL DEFAULT '0' COMMENT '关联的任务状态ID',
  MODIFY COLUMN `progressid` int(11) NOT NULL DEFAULT '0' COMMENT '进度项编号',
  MODIFY COLUMN `progress` varchar(15) NOT NULL DEFAULT '' COMMENT '进度值';

ALTER TABLE `questrequirements`
  COMMENT = '任务需求数据表',
  MODIFY COLUMN `questrequirementid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `questid` int(11) NOT NULL DEFAULT '0' COMMENT '任务ID',
  MODIFY COLUMN `status` int(11) NOT NULL DEFAULT '0' COMMENT '任务状态',
  MODIFY COLUMN `data` blob NOT NULL COMMENT '需求数据（二进制序列化）';

ALTER TABLE `queststatus`
  COMMENT = '角色任务状态表',
  MODIFY COLUMN `queststatusid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '任务状态ID',
  MODIFY COLUMN `characterid` int(11) NOT NULL DEFAULT '0' COMMENT '角色ID',
  MODIFY COLUMN `quest` int(11) NOT NULL DEFAULT '0' COMMENT '任务ID',
  MODIFY COLUMN `status` int(11) NOT NULL DEFAULT '0' COMMENT '任务状态（0未开始/1进行中/2已完成）',
  MODIFY COLUMN `time` int(11) NOT NULL DEFAULT '0' COMMENT '已投入时间（秒）',
  MODIFY COLUMN `expires` bigint(20) NOT NULL DEFAULT '0' COMMENT '任务过期时间戳',
  MODIFY COLUMN `forfeited` int(11) NOT NULL DEFAULT '0' COMMENT '放弃次数',
  MODIFY COLUMN `completed` int(11) NOT NULL DEFAULT '0' COMMENT '完成次数',
  MODIFY COLUMN `info` tinyint(3) NOT NULL DEFAULT '0' COMMENT '附加信息标志（如是否已领取奖励）';

ALTER TABLE `quickslotkeymapped`
  COMMENT = '快捷栏按键映射表',
  MODIFY COLUMN `accountid` int(11) NOT NULL COMMENT '账号ID',
  MODIFY COLUMN `keymap` bigint(20) NOT NULL DEFAULT '0' COMMENT '快捷栏按键映射（64位压缩存储）';

ALTER TABLE `reactordrops`
  COMMENT = '反应堆（采集物）掉落表',
  MODIFY COLUMN `reactordropid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `reactorid` int(11) NOT NULL COMMENT '反应堆（采集物/宝箱）ID',
  MODIFY COLUMN `itemid` int(11) NOT NULL COMMENT '掉落物品ID',
  MODIFY COLUMN `chance` int(11) NOT NULL COMMENT '掉落概率的分母（越小越容易掉：1=必掉，2=50%）',
  MODIFY COLUMN `questid` int(5) NOT NULL DEFAULT '-1' COMMENT '关联任务ID（-1=无限制）';

ALTER TABLE `reports`
  COMMENT = '玩家举报表',
  MODIFY COLUMN `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `reporttime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '举报时间',
  MODIFY COLUMN `reporterid` int(11) NOT NULL COMMENT '举报人角色ID',
  MODIFY COLUMN `victimid` int(11) NOT NULL COMMENT '被举报人角色ID',
  MODIFY COLUMN `reason` tinyint(4) NOT NULL COMMENT '举报原因编号',
  MODIFY COLUMN `chatlog` text NOT NULL COMMENT '相关聊天记录',
  MODIFY COLUMN `description` text NOT NULL COMMENT '举报补充说明';

ALTER TABLE `responses`
  COMMENT = '对话应答表',
  MODIFY COLUMN `chat` text COMMENT '触发关键词',
  MODIFY COLUMN `response` text COMMENT '自动应答内容',
  MODIFY COLUMN `id` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键';

ALTER TABLE `rings`
  COMMENT = '情侣戒指表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '戒指ID',
  MODIFY COLUMN `partnerRingId` int(11) NOT NULL DEFAULT '0' COMMENT '对方那一半戒指ID',
  MODIFY COLUMN `partnerChrId` int(11) NOT NULL DEFAULT '0' COMMENT '对方角色ID',
  MODIFY COLUMN `itemid` int(11) NOT NULL DEFAULT '0' COMMENT '戒指物品ID',
  MODIFY COLUMN `partnername` varchar(255) NOT NULL COMMENT '对方角色名';

ALTER TABLE `savedlocations`
  COMMENT = '角色保存地点表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `characterid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `locationtype` enum('FREE_MARKET','WORLDTOUR','FLORINA','INTRO','SUNDAY_MARKET','MIRROR','EVENT','BOSSPQ','HAPPYVILLE','DEVELOPER','MONSTER_CARNIVAL') NOT NULL COMMENT '地点类型（FREE_MARKET自由市场/WORLDTOUR环游世界/FLORINA花蘑菇森林/INTRO新手村/SUNDAY_MARKET周日市场/MIRROR镜像世界/EVENT活动/BOSSPQ组队任务/HAPPYVILLE快乐小镇/DEVELOPER开发者/MONSTER_CARNIVAL怪物狂欢）',
  MODIFY COLUMN `map` int(11) NOT NULL COMMENT '保存的地图ID',
  MODIFY COLUMN `portal` int(11) NOT NULL COMMENT '保存的传送门编号';

ALTER TABLE `server_queue`
  COMMENT = '服务器消息队列表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `accountid` int(11) NOT NULL DEFAULT '0' COMMENT '目标账号ID',
  MODIFY COLUMN `characterid` int(11) NOT NULL DEFAULT '0' COMMENT '目标角色ID',
  MODIFY COLUMN `type` tinyint(2) NOT NULL DEFAULT '0' COMMENT '消息类型',
  MODIFY COLUMN `value` int(10) NOT NULL DEFAULT '0' COMMENT '附带数值',
  MODIFY COLUMN `message` varchar(128) NOT NULL COMMENT '提示消息内容',
  MODIFY COLUMN `createTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '入队时间';

ALTER TABLE `shopitems`
  COMMENT = '商店商品表',
  MODIFY COLUMN `shopitemid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `shopid` int(10) unsigned NOT NULL COMMENT '所属商店ID（对应 shops.shopid）',
  MODIFY COLUMN `itemid` int(11) NOT NULL COMMENT '出售的物品ID',
  MODIFY COLUMN `price` int(11) NOT NULL COMMENT '售价（金币/点券）',
  MODIFY COLUMN `pitch` int(11) NOT NULL DEFAULT '0' COMMENT '该商品在商店中的页面/位置',
  MODIFY COLUMN `position` int(11) NOT NULL COMMENT '排序号（起始104，每项+4，留空隙方便插入删除）';

ALTER TABLE `shops`
  COMMENT = '商店表',
  MODIFY COLUMN `shopid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '商店ID',
  MODIFY COLUMN `npcid` int(11) NOT NULL DEFAULT '0' COMMENT '挂载该商店的NPC ID';

ALTER TABLE `skillmacros`
  COMMENT = '技能宏表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `characterid` int(11) NOT NULL DEFAULT '0' COMMENT '角色ID',
  MODIFY COLUMN `position` tinyint(1) NOT NULL DEFAULT '0' COMMENT '宏位置（1~5号宏）',
  MODIFY COLUMN `skill1` int(11) NOT NULL DEFAULT '0' COMMENT '第1个技能ID',
  MODIFY COLUMN `skill2` int(11) NOT NULL DEFAULT '0' COMMENT '第2个技能ID',
  MODIFY COLUMN `skill3` int(11) NOT NULL DEFAULT '0' COMMENT '第3个技能ID',
  MODIFY COLUMN `name` varchar(13) DEFAULT NULL COMMENT '宏名称',
  MODIFY COLUMN `shout` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否喊话发布（0否/1是）';

ALTER TABLE `skills`
  COMMENT = '角色技能表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `skillid` int(11) NOT NULL DEFAULT '0' COMMENT '技能ID',
  MODIFY COLUMN `characterid` int(11) NOT NULL DEFAULT '0' COMMENT '角色ID',
  MODIFY COLUMN `skilllevel` int(11) NOT NULL DEFAULT '0' COMMENT '技能等级',
  MODIFY COLUMN `masterlevel` int(11) NOT NULL DEFAULT '0' COMMENT '技能精通上限等级',
  MODIFY COLUMN `expiration` bigint(20) NOT NULL DEFAULT '-1' COMMENT '技能过期时间戳（-1=永久）';

ALTER TABLE `specialcashitems`
  COMMENT = '商城特殊商品表',
  MODIFY COLUMN `id` int(11) NOT NULL COMMENT '商城商品ID',
  MODIFY COLUMN `sn` int(11) NOT NULL COMMENT '商品序号（SN）',
  MODIFY COLUMN `modifier` int(11) NOT NULL COMMENT '修饰位（1024 = 该商品已下架）',
  MODIFY COLUMN `info` int(1) NOT NULL COMMENT '附加信息';

ALTER TABLE `storages`
  COMMENT = '仓库表',
  MODIFY COLUMN `storageid` int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT '仓库ID',
  MODIFY COLUMN `accountid` int(11) NOT NULL DEFAULT '0' COMMENT '所属账号ID',
  MODIFY COLUMN `world` int(2) NOT NULL COMMENT '所在世界（区）编号',
  MODIFY COLUMN `slots` int(11) NOT NULL DEFAULT '0' COMMENT '仓库格数',
  MODIFY COLUMN `meso` int(11) NOT NULL DEFAULT '0' COMMENT '仓库中存放的金币';

ALTER TABLE `trocklocations`
  COMMENT = '传送石记录地点表',
  MODIFY COLUMN `trockid` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `characterid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `mapid` int(11) NOT NULL COMMENT '已记录的地图ID',
  MODIFY COLUMN `vip` int(2) NOT NULL COMMENT '是否VIP记录（0普通5格/1VIP10格）';

ALTER TABLE `wishlists`
  COMMENT = '商城心愿单表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `charid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `sn` int(11) NOT NULL COMMENT '商品序号（SN）';

ALTER TABLE `worldtransfers`
  COMMENT = '转区（世界转移）记录表',
  MODIFY COLUMN `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  MODIFY COLUMN `characterid` int(11) NOT NULL COMMENT '角色ID',
  MODIFY COLUMN `from` tinyint(3) NOT NULL COMMENT '原世界（区）编号',
  MODIFY COLUMN `to` tinyint(3) NOT NULL COMMENT '目标世界（区）编号',
  MODIFY COLUMN `requestTime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  MODIFY COLUMN `completionTime` timestamp NULL DEFAULT NULL COMMENT '完成时间';

ALTER TABLE `wz_names`
  COMMENT = 'wz名称映射表（只读参考）',
  MODIFY COLUMN `kind` varchar(16) NOT NULL COMMENT '类别（mob怪物/eqp装备/consume消耗/etc其他/ins设置/cash点券/map地图/npc/pet宠物）',
  MODIFY COLUMN `id` int(11) NOT NULL COMMENT 'ID',
  MODIFY COLUMN `name` varchar(160) NOT NULL COMMENT '中文名';
