function start() {
    status = -1;
    action(1, 0, 0);
}

function action(mode, type, selection) {
    if (status < 0) {
    	cm.sendNext("你好, 我是#p9010002#. 我猜你应该是来找我领福利的吧，^-^");
    	status++;
    } else if (status == 0) {
        cm.sendOk("本周福利为三倍经验卡和双倍爆率卡，快到自由市场去找弗兰德里吧！");
        cm.dispose();
    }
}