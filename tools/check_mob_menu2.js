/* 第 9 轮冒烟测试：验证「传送地图扩充」与「召唤怪物-全级别段」两块新代码。
 * 只做加载 + 结构校验（顶层只声明函数与变量，不会真的调 cm）。
 * 注意：任何编号都不要用字面量写死，一律从数组长度算出来，避免数据一变测试就失真。 */
// 最小 cm 桩：mainMenu() 里会读 getDmgMultiplier，没有桩就会 ReferenceError。
var cm = {
    getPlayer: function () { return { getDmgMultiplier: function () { return 1; } }; },
    sendSimple: function () {},
    dropMessage: function () {},
    // countBoss() 会读 cm.getMap().getMapName()/getId()，返回一个哑地图对象顶住
    getMap: function () {
        return {
            getMapName: function () { return '测试地图'; },
            getId: function () { return 100000000; }
        };
    },
    dispose: function () {}
};
var status = 0, selection = 0;

try {
    load('D:/MXDtestServer/scripts/npc/gm_menu.js');
    print('SYNTAX_OK gm_menu.js');

    // ---------- 1. 三块新数据 ----------
    print('TOWN_MAPS_ALL = ' + TOWN_MAPS_ALL.length + '  (期望 > 0)');
    print('HUNT_MAPS  = ' + HUNT_MAPS.length + '  (期望 > 0)');
    print('MOB_TIERS_ALL   = ' + MOB_TIERS_ALL.length + '  (期望 > 0)');
    if (TOWN_MAPS_ALL.length < 20) print('!! TOWN_MAPS_ALL 太少，传送扩充可能没生效');
    if (HUNT_MAPS.length < 20) print('!! HUNT_MAPS 太少，练级场可能没生效');
    if (MOB_TIERS_ALL.length < 5) print('!! MOB_TIERS_ALL 太少，全级别段可能没生效');

    // ---------- 2. HUNT_MAPS 的等级列必须都 >= 100 ----------
    var lowCnt = 0, maxLv = 0, minLv = 99999;
    for (var i = 0; i < HUNT_MAPS.length; i++) {
        var lv = HUNT_MAPS[i][2];
        if (lv < 100) lowCnt++;
        if (lv > maxLv) maxLv = lv;
        if (lv < minLv) minLv = lv;
    }
    print('HUNT_MAPS 等级区间 = ' + minLv + ' ~ ' + maxLv + ' / 不足 100 级的 = ' + lowCnt);
    if (lowCnt > 0) print('!! 有练级场等级不足 Lv.100');

    // ---------- 3. 城镇表：等级列全为 0（显示时不带 Lv. 前缀） ----------
    var badTown = 0;
    for (var t = 0; t < TOWN_MAPS_ALL.length; t++) {
        if (TOWN_MAPS_ALL[t][2] != 0) badTown++;
    }
    print('TOWN_MAPS_ALL 等级列非 0 的条数 = ' + badTown + '  (期望 0)');
    if (badTown > 0) print('!! 城镇条目等级列应为 0');

    // ---------- 4. MOB_TIERS_ALL 结构：每段 [段名, 行列表]，行 = [id, 名, lv] ----------
    var total = 0, badRow = 0, badSeg = 0, lvMin = 99999, lvMax = 0;
    for (var s = 0; s < MOB_TIERS_ALL.length; s++) {
        var seg = MOB_TIERS_ALL[s];
        if (!seg || seg.length != 2 || seg[1].length == 0) {
            badSeg++;
            print('!! 第 ' + s + ' 段结构不对：' + seg);
            continue;
        }
        total += seg[1].length;
        for (var r = 0; r < seg[1].length; r++) {
            var row = seg[1][r];
            if (!row || row.length != 3 || typeof row[0] != 'number' || typeof row[2] != 'number') {
                badRow++;
                print('!! ' + seg[0] + ' 第 ' + r + ' 行结构不对：' + row);
                break;
            }
            if (row[2] < lvMin) lvMin = row[2];
            if (row[2] > lvMax) lvMax = row[2];
        }
    }
    print('MOB_TIERS_ALL 共 ' + total + ' 只 / 等级 ' + lvMin + '~' + lvMax +
          ' / 段结构异常 ' + badSeg + ' / 行结构异常 ' + badRow);
    if (badSeg > 0 || badRow > 0) print('!! 全级别段数据结构有异常');

    // ---------- 5. 新函数都在 ----------
    ['mobTierMenu', 'mobTierListMenu', 'summonMobTierOne', 'summonMobTierAll',
     'warpMenu', 'spotMenu'].forEach(function (fn) {
        print('has ' + fn + ' = ' + (typeof eval(fn)));
    });

    // ---------- 6. dispatch 里的新分支 ----------
    var src = (typeof action === 'function') ? action.toString() : '';
    print('dispatch status==49(选段)  = ' + (src.indexOf('status == 49') >= 0));
    print('dispatch status==50(段内)  = ' + (src.indexOf('status == 50') >= 0));
    print('dispatch selection==31(召唤全段) = ' + (src.indexOf('mobTierMenu()') >= 0));
    print('dispatch selection==32(关闭)     = ' + (src.indexOf('selection == 32') >= 0));
    print('WARP_TITLES 长度 = ' + WARP_TITLES.length);

    // ---------- 7. 主菜单里新入口确实挂上了 ----------
    print('mainMenu 含「全级别段」字样 = ' +
          (mainMenu().indexOf('召唤怪物-全级别段') >= 0));
    // 传送菜单里两个新档位
    var wm = warpMenu();
    print('warpMenu 含「全部城镇」   = ' + (wm.indexOf('全部城镇') >= 0));
    print('warpMenu 含「100 以上」   = ' + (wm.indexOf('Lv.100 以上练级场') >= 0));

    print('SMOKE_DONE');
} catch (e) {
    print('LOAD_FAIL: ' + e);
    if (typeof e === 'object' && e !== null && e.rhinoException) print(e.rhinoException);
}
