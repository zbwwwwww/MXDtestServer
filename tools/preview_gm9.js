/* 打印 GM 菜单排版，人工看一眼（编号不写死，跟着数组长度走）。 */
var SENT = [];
var cm = {
    getPlayer: function () {
        return {
            getDmgMultiplier: function () { return 1; },
            getPosition: function () { return { x: 300, y: 100 }; },
            isGM: function () { return true; }
        };
    },
    sendSimple: function (t) { SENT.push(t); },
    sendGetText: function () {},
    dropMessage: function () { }, dispose: function () { }, warp: function () { },
    getMap: function () {
        return {
            getMapName: function () { return 'x'; }, getId: function () { return 0; },
            spawnMonsterOnGroundBelow: function () { }
        };
    }
};
var status = 0, selection = 0;
load('D:/MXDtestServer/scripts/npc/gm_menu.js');

function dump(title, txt) {
    print('===== ' + title + ' =====');
    var lines = txt.split('\r\n');
    for (var i = 0; i < lines.length; i++) { print(lines[i]); }
    print('');
}

/* ---- 传送菜单 ---- */
status = 1; selection = 12;
action(1, 0, selection);
dump('传送菜单 warpMenu', SENT[SENT.length - 1]);

/* ---- 各档列表（编号跟着下标走，不写死）---- */
var WARPS = [
    ['BOSS 挑战图', BOSS_MAPS, 1],
    ['全部城镇（常用已并入）', TOWN_MAPS_ALL, 2],
    ['Lv.100 以上练级场（猎场已并入）', HUNT_MAPS, 3]
];
for (var w = 0; w < WARPS.length; w++) {
    status = 15; SENT = [];
    action(1, 0, WARPS[w][2]);
    var rows = SENT[0].split('\r\n');
    print('===== ' + WARPS[w][0] + '（共 ' + rows.length + ' 行，前 8 行 + 末 3 行） =====');
    for (var i = 0; i < 8 && i < rows.length; i++) print(rows[i]);
    print('   ...');
    for (var j = Math.max(0, rows.length - 3); j < rows.length; j++) print(rows[j]);
    print('');
}

/* ---- 召唤怪物-选段 ---- */
status = 1; selection = 31; SENT = [];
action(1, 0, selection);
dump('召唤怪物-选等级段', SENT[0]);

/* ---- 段内列表（挑一只怪最多的段看，分页效果最明显）---- */
var bigSeg = 0, bigN = 0;
for (var s = 0; s < MOB_TIERS_ALL.length; s++) {
    if (MOB_TIERS_ALL[s][1].length > bigN) { bigN = MOB_TIERS_ALL[s][1].length; bigSeg = s; }
}
status = 49; selection = bigSeg; SENT = [];
action(1, 0, selection);
var pg = SENT[0].split('\r\n');
print('===== 段「' + MOB_TIERS_ALL[bigSeg][0] + '」（共 ' + bigN + ' 只 / ' +
      Math.ceil(bigN / MOB_PAGE) + ' 页，首页前 8 行 + 末 4 行） =====');
for (var i2 = 0; i2 < 8 && i2 < pg.length; i2++) print(pg[i2]);
print('   ...');
for (var j2 = Math.max(0, pg.length - 4); j2 < pg.length; j2++) print(pg[j2]);
print('');

/* ---- 主菜单尾部 ---- */
var mm = mainMenu().split('\r\n');
print('===== 主菜单尾部 6 行 =====');
for (var k = Math.max(0, mm.length - 6); k < mm.length; k++) print(mm[k]);
