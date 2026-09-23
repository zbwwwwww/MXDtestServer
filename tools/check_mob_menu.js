// 仅做语法/加载校验：顶层只声明函数与变量，不会调用 cm，等价于完整编译校验
try {
    load('D:/MXDtestServer/scripts/npc/gm_menu.js');
    print('SYNTAX_OK gm_menu.js');
    print('MOB_POINTS_101_131 length = ' + MOB_POINTS_101_131.length);
    print('has mobPointMenu       = ' + (typeof mobPointMenu));
    print('has summonMobPoint     = ' + (typeof summonMobPoint));
    print('has summonMobPointsAll = ' + (typeof summonMobPointsAll));
    // 抽一个函数体字符串，确认 dispatch 里 status==47 / selection==28 分支存在
    var src = (typeof action === 'function') ? action.toString() : '';
    print('dispatch has status==47 = ' + (src.indexOf('status == 47') >= 0));
    print('dispatch has selection==28(mob) = ' + (src.indexOf('mobPointMenu()') >= 0));
    print('dispatch has selection==29(dispose) = ' + (src.indexOf('selection == 29') >= 0));
} catch (e) {
    print('LOAD_FAIL: ' + e);
}
