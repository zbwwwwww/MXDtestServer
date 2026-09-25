/* 第 9 轮端到端路径测试：真的走一遍 action(1,0,N)，确认菜单里发出的 #L 编号
 * 和 dispatch 里判断的 selection 是同一套编号（错位的话在客户端就是"点了没反应／跳错层"）。
 * 铁律：编号一律从数组长度算相对值，绝不写死。
 * 段内列表是分页的，所以这里额外覆盖「翻页 → 翻页后召唤第一只」这条最容易错的路径。 */

var SENT = [];
var SPAWNED = [];
var MESSAGES = [];
var WARPED = [];      // 第 12 轮：记录传送去了哪张图（要验证 BOSS 图真的能传）

var cm = {
    getPlayer: function () {
        return {
            getDmgMultiplier: function () { return 1; },
            getPosition: function () { return { x: 300, y: 100 }; },
            isGM: function () { return true; }
        };
    },
    sendSimple: function (txt) { SENT.push(txt); },
    sendGetText: function (txt) { SENT.push(txt); },
    dropMessage: function (c, msg) { MESSAGES.push(msg); },
    dispose: function () { },
    /* GM 菜单是 cm.warpToMap(id)（不是 cm.warp），传送目的地记下来给断言用 */
    warpToMap: function (mapId) { WARPED.push(mapId); return true; },
    getMap: function () {
        return {
            getMapName: function () { return '测试地图'; },
            getId: function () { return 100000000; },
            spawnMonsterOnGroundBelow: function (id, x, y) { SPAWNED.push(id + '@' + x + ',' + y); }
        };
    }
};
var status = 0, selection = 0;
var BAD = 0;

function pick(txt) {           // 取出这一屏里出现的最大 #L 编号
    var mx = -1, m;
    var re = /#L(\d+)#/g;
    while ((m = re.exec(txt)) !== null) { mx = Math.max(mx, parseInt(m[1], 10)); }
    return mx;
}

/* 取出这一屏里指定编号那一行的文字（用来验证「翻页后第一行是谁」） */
function rowOf(txt, idx) {
    var re = new RegExp('#L' + idx + '#([^\\r\\n]*)');
    var m = re.exec(txt);
    return m ? m[1] : null;
}

function reset() { SENT = []; SPAWNED = []; MESSAGES = []; WARPED = []; }
function fail(n, msg) { print('!! [' + n + '] ' + msg); BAD++; }

try {
    load('D:/MXDtestServer/scripts/npc/gm_menu.js');
    print('loaded');

    // ================= 传送菜单 warpMenu =================
    // 入口是主菜单的 #L12（不是 15，那是「回满 HP/MP」）
    status = 1; selection = 12; reset();
    action(1, 0, selection);
    var wm = SENT[SENT.length - 1];
    var wmMax = pick(wm);
    print('[1] warpMenu 最大 #L = ' + wmMax + '（应为 4：0~3 档 + 4 返回）');
    if (wmMax != 4) fail(1, 'warpMenu 编号不是 4，实际 ' + wmMax);
    // 第 10 轮：猎场已并入练级场；第 11 轮：常用城镇已并入全部城镇
    if (wm.indexOf('高等级猎场') >= 0) fail(1, 'warpMenu 还在叫「高等级猎场」（应已并入练级场）');
    if (wm.indexOf('常用城镇') >= 0) fail(1, 'warpMenu 还在有独立的「常用城镇」这一档（应已并入全部城镇）');
    if (typeof HUNT_MAPS_HIGH !== 'undefined') fail(1, 'HUNT_MAPS_HIGH 变量还在（应已删除）');
    if (typeof TOWN_MAPS !== 'undefined') fail(1, 'TOWN_MAPS 变量还在（应已删除）');
    if (wm.indexOf('#L4#') < 0) fail(1, 'warpMenu 缺「返回主菜单」');

    /* 传送地图的三个档位现在都分页了：每页 MAP_PAGE 条 +
     *   #L MAP_PAGE      = 下一页（最后一张图时不出现）
     *   #L MAP_PAGE + 1  = 返回传送菜单（永远在） */
    var PAGE_BTN = MAP_PAGE;
    var BACK_BTN = MAP_PAGE + 1;

    /* 进某一档，返回这一屏的文本；顺带校验 curList / status */
    function openWarp(sel, list, tag, expectName) {
        status = 15; selection = sel; reset();
        action(1, 0, sel);
        if (SENT.length != 1) fail(2, tag + ' 发了 ' + SENT.length + ' 个包');
        if (status != 16) fail(2, tag + ' 之后 status 应为 16，实际 ' + status);
        if (curList != list) fail(2, tag + ' 的 curList 没指向正确的列表');
        return SENT[0];
    }

    // ================= BOSS 挑战图（第 12 轮：wz 全量扫描）=================
    var bTxt = openWarp(1, BOSS_MAPS, '[6]', 'BOSS 挑战图');
    var bossPages = Math.ceil(BOSS_MAPS.length / MAP_PAGE);
    print('[6] BOSS 挑战图 ' + BOSS_MAPS.length + ' 张 / ' + bossPages + ' 页 / ' +
          '首页最大 #L=' + pick(bTxt) + '（应为 ' + BACK_BTN + '）');
    if (BOSS_MAPS.length < 800) fail(6, 'BOSS 图只有 ' + BOSS_MAPS.length + ' 张，扫全了？');
    if (pick(bTxt) != BACK_BTN) fail(6, 'BOSS 列表首页最大 #L 应为 ' + BACK_BTN);
    // 每张图都带 BOSS 名单 —— 这正是「传过去有没有 BOSS」的可视化证据
    var noBoss = 0, badRow = 0;
    for (var bi = 0; bi < BOSS_MAPS.length; bi++) {
        var r = BOSS_MAPS[bi];
        if (r.length != 4 || typeof r[3] != 'string' || !r[3]) badRow++;
        if (r[2] <= 0) noBoss++;
    }
    if (badRow) fail(6, '有 ' + badRow + ' 行 BOSS 图缺 BOSS 名单');
    if (noBoss) fail(6, '有 ' + noBoss + ' 行的 BOSS 数量为 0');
    print('[6b] 全部 ' + BOSS_MAPS.length + ' 张都带 BOSS 名单：是');
    // 首页第 0 行必须显示这张图刷的 BOSS 名
    var r0 = rowOf(bTxt, 0);
    if (r0 === null || r0.indexOf(BOSS_MAPS[0][3]) < 0) {
        fail(6, 'BOSS 列表第一行没显示 BOSS 名单：' + r0);
    }

    // ---- 翻页：第 2 页第一行必须是第 MAP_PAGE+1 张，不能串号 ----
    status = 16; selection = PAGE_BTN; reset();
    action(1, 0, PAGE_BTN);
    if (MAP_PAGE_NO != 1) fail(6, '翻页后 MAP_PAGE_NO 应为 1，实际 ' + MAP_PAGE_NO);
    var r1 = rowOf(SENT[0], 0);
    print('[6c] 翻到第 2 页，第一行「' + r1 + '」应含第 ' + (MAP_PAGE + 1) +
          ' 张「' + BOSS_MAPS[MAP_PAGE][1] + '」');
    if (r1 === null || r1.indexOf(BOSS_MAPS[MAP_PAGE][1]) < 0) {
        fail(6, '翻页后第一行不是第 ' + (MAP_PAGE + 1) + ' 张（串号了）');
    }
    // ---- 翻页后点第一行，必须传送到那一张 ----
    status = 16; selection = 0; reset();
    action(1, 0, 0);
    if (WARPED.length != 1) fail(6, '翻页后点第一行没传送（或传了 ' + WARPED.length + ' 次）');
    else if (WARPED[0] != BOSS_MAPS[MAP_PAGE][0]) {
        fail(6, '翻页后传送到了 ' + WARPED[0] + '，应为 ' + BOSS_MAPS[MAP_PAGE][0]);
    }

    // ================= 全部城镇（第 11 轮起是 #L2，已含常用 14 个）=================
    var tTxt = openWarp(2, TOWN_MAPS_ALL, '[2]', '全部城镇');
    print('[2] 全部城镇最大 #L = ' + pick(tTxt) + '（分页后应为 ' + BACK_BTN + '）');
    if (pick(tTxt) != BACK_BTN) fail(2, '分页后列表最大 #L 不是 ' + BACK_BTN);
    if (TOWN_MAPS_ALL.length < 90) fail(2, '城镇只有 ' + TOWN_MAPS_ALL.length + ' 张');
    // 第 2 页第一行应该是第 41 张，别串号
    var t41 = rowOf(tTxt, 0);
    status = 16; selection = PAGE_BTN; reset();
    action(1, 0, PAGE_BTN);
    if (rowOf(SENT[0], 0) === null ||
        rowOf(SENT[0], 0).indexOf(TOWN_MAPS_ALL[MAP_PAGE][1]) < 0) {
        fail(2, '城镇翻页后第一行串号了');
    }

    // ================= Lv.100+ 练级场（第 10 轮起：猎场已并入这一档）=================
    var hTxt = openWarp(3, HUNT_MAPS, '[3]', '练级场');
    print('[3] 练级场最大 #L = ' + pick(hTxt) + '（分页后应为 ' + BACK_BTN + '）');
    if (pick(hTxt) != BACK_BTN) fail(3, '分页后列表最大 #L 不是 ' + BACK_BTN);
    if (HUNT_MAPS.length < 57) fail(3, '练级场只有 ' + HUNT_MAPS.length + ' 张，合并不全');

    // ---- 返回按钮（#L MAP_PAGE+1）应回到 warpMenu ----
    status = 16; reset();
    action(1, 0, BACK_BTN);
    if (SENT.length != 1 || SENT[0] != wm) fail(4, '「返回传送菜单」没回到 warpMenu');
    if (status != 15) fail(4, '返回后 status 应为 15，实际 ' + status);
    if (MAP_PAGE_NO != 0) fail(4, '返回后页码没归零，实际 ' + MAP_PAGE_NO);
    // 最后一页没有「下一页」按钮，只有「返回」—— 一路点「下一页」翻到末页
    MAP_PAGE_NO = 0;
    status = 15; selection = 1; reset();
    action(1, 0, 1);
    var guard = 0;
    while (MAP_PAGE_NO < bossPages - 1 && guard++ < 200) {
        status = 16; selection = PAGE_BTN; reset();
        action(1, 0, PAGE_BTN);
    }
    if (MAP_PAGE_NO != bossPages - 1) {
        fail(7, '一路点「下一页」没走到末页（停在第 ' + (MAP_PAGE_NO + 1) + ' / ' + bossPages + ' 页）');
    }
    var lastMax = pick(SENT[0]);
    print('[7] 末页最大 #L = ' + lastMax + '（应只有返回按钮 ' + BACK_BTN + '）');
    if (lastMax != BACK_BTN) fail(7, '末页不该有「下一页」，实际最大 #L=' + lastMax);
    if (rowOf(SENT[0], PAGE_BTN) !== null) fail(7, '末页还留着「下一页」按钮');
    MAP_PAGE_NO = 0;

    // ================= 召唤怪物-选段 =================
    status = 1; selection = 31; reset();
    action(1, 0, selection);
    var tierMax = pick(SENT[0]);
    print('[4] 选段菜单最大 #L = ' + tierMax + '（应为 ' + MOB_TIERS_ALL.length + '）');
    if (tierMax != MOB_TIERS_ALL.length) fail(5, '选段菜单编号与 MOB_TIERS_ALL 长度不符');
    if (status != 49) fail(5, 'status 应为 49，实际 ' + status);

    // ================= 段内分页 =================
    status = 49; selection = 0; reset();
    action(1, 0, 0);                              // 进 Lv.1-10 段
    var seg = MOB_TIERS_ALL[0];
    var n = seg[1].length;
    var totalPage = Math.ceil(n / MOB_PAGE);
    var pageMax = pick(SENT[0]);
    print('[5] 段「' + seg[0] + '」共 ' + n + ' 只 / ' + totalPage + ' 页；' +
          '首页最大 #L = ' + pageMax + '（应为 ' + (MOB_PAGE + 2) + '）');
    if (pageMax != MOB_PAGE + 2) fail(6, '首页末三行编号应为 ' + (MOB_PAGE + 2) + '，实际 ' + pageMax);
    if (status != 50) fail(6, 'status 应为 50，实际 ' + status);
    // 首页怪物行只应出现前 MOB_PAGE 只（注意 #L40#/#L41#/#L42# 是末三行按钮，不算怪物行）
    for (var p = 0; p < n; p++) {
        if (p >= MOB_PAGE && SENT[0].indexOf('#L' + p + '#' + seg[1][p][1]) >= 0) {
            fail(6, '首页不该出现第 ' + p + ' 行：' + seg[1][p][1]);
            break;
        }
    }

    // 逐只召唤（首页第一只）
    status = 50; reset();
    action(1, 0, 0);
    if (SPAWNED.length != 1) fail(7, '点第一只应召唤 1 只，实际 ' + SPAWNED.length);
    if (SPAWNED[0].indexOf(String(seg[1][0][0])) < 0) fail(7, '召唤的怪不对：' + SPAWNED[0]);
    print('[6] 逐只召唤 OK -> ' + SPAWNED[0] + ' / "' + MESSAGES[0] + '"');

    // ---------- 翻页后召唤：最容易错位的一条路径 ----------
    status = 50; reset();
    action(1, 0, MOB_PAGE);                       // 首页的「下一页」
    if (curMobPage != 1) fail(8, '翻页后 curMobPage 应为 1，实际 ' + curMobPage);
    if (status != 50) fail(8, '翻页后应留在 status 50');
    var page2FirstId = seg[1][MOB_PAGE][0];
    var page2FirstName = seg[1][MOB_PAGE][1];
    // 第 2 页第一行应带这一只（用 #L0# + 名字 定位，别拿 ID 去整串里搜）
    if (SENT[0].indexOf('#L0#' + page2FirstName) < 0) {
        fail(8, '第 2 页里找不到该页第一只 ' + page2FirstName);
    }
    print('[7] 翻到第 2 页 OK（curMobPage=' + curMobPage + '）');

    status = 50; reset();
    action(1, 0, 0);                              // 第 2 页第一只
    if (SPAWNED.length != 1) fail(9, '第 2 页点第一只应召唤 1 只，实际 ' + SPAWNED.length);
    if (SPAWNED[0].indexOf(String(page2FirstId)) < 0) {
        fail(9, '翻页后召唤串号了：本页第一只应是 ' + page2FirstId + '，实际 ' + SPAWNED[0]);
    }
    print('[8] 翻页后召唤 OK -> ' + SPAWNED[0] + '（没有串到上一页去）');

    // ---------- 末页：这一项的「下一页」应变成「本段全部召唤」 ----------
    curMobPage = totalPage - 1;
    status = 50; reset();
    action(1, 0, MOB_PAGE);
    var lastPageTxt = SENT[SENT.length - 1];
    if (lastPageTxt.indexOf('本段全部召唤') < 0) fail(10, '末页应出现「本段全部召唤」');
    if (lastPageTxt.indexOf('下一页') >= 0) fail(10, '末页不该再有「下一页」');
    print('[9] 末页按钮切换 OK（下一页 -> 本段全部召唤）');

    status = 50; reset();
    action(1, 0, MOB_PAGE);                       // 末页点「全部召唤」
    print('[10] 整段召唤 -> SPAWNED ' + SPAWNED.length + ' 只 / "' + MESSAGES[0] + '"');
    if (SPAWNED.length != n) fail(11, '整段召唤应刷出 ' + n + ' 只，实际 ' + SPAWNED.length);

    // ---------- 换段 / 返回 ----------
    status = 50; reset();
    action(1, 0, MOB_PAGE + 1);
    if (status != 49) fail(12, '点换段后 status 应为 49，实际 ' + status);
    if (curMobPage != 0) fail(12, '换段后页号应归零，实际 ' + curMobPage);
    print('[11] 换段 OK -> status ' + status + ' / 页号归零');

    curMobPage = 2;
    status = 50; reset();
    action(1, 0, MOB_PAGE + 2);
    if (status != 1) fail(13, '点返回后 status 应为 1，实际 ' + status);
    print('[12] 返回主菜单 OK -> status 1');

    // ================= 每一段的编号边界都自洽 =================
    var bad = 0, badPage = 0;
    for (var k = 0; k < MOB_TIERS_ALL.length; k++) {
        curMobPage = 0;
        status = 49; reset();
        action(1, 0, k);
        var mx = pick(SENT[0]);
        var cnt = MOB_TIERS_ALL[k][1].length;
        if (mx != MOB_PAGE + 2) { bad++; print('!! 段 ' + k + ' 编号 ' + mx + ' != ' + (MOB_PAGE + 2)); }
        // 顺带核对该段总页数
        var tp = Math.ceil(cnt / MOB_PAGE);
        if (SENT[0].indexOf('/' + tp + ' 页') < 0) { badPage++; print('!! 段 ' + k + ' 页数标注不对'); }
    }
    print('[13] ' + MOB_TIERS_ALL.length + ' 段编号自洽性：编号异常 ' + bad + ' / 页数异常 ' + badPage);
    if (bad > 0 || badPage > 0) fail(14, '有段的编号或页数标注不对');

    print(BAD === 0 ? 'E2E_DONE 全部通过' : 'E2E_DONE 但有 ' + BAD + ' 处失败');
} catch (e) {
    print('E2E_FAIL: ' + e);
}
