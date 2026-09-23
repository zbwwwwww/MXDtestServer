/*
	This file is part of the OdinMS Maple Story Server
    Copyright (C) 2008 Patrick Huy <patrick.huy@frz.cc>
		       Matthias Butz <matze@odinms.de>
		       Jan Christian Meyer <vimes@odinms.de>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation version 3 as published by
    the Free Software Foundation. You may not use, modify or distribute
    this program under any other version of the GNU Affero General Public
    License.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
/* Fredrick NPC (9030000)
 * @author kevintjuh93
 */

var status;

function start() {
    status = -1;
    action(1, 0, 0);
}

function action(mode, type, selection) {
    if (mode == 1) {
        status++;
    } else {
        cm.dispose();
        return;
    }

	if (status == 0){
        var selStr = "这位客官，有何贵干?";
        selStr += "\r\n#L0" + "# 物品领回服务请按1。#l";
        selStr += "\r\n#L1" + "# 点一下拿走加倍卡。#l";
        selStr += "\r\n#L2" + "# 十亿金币，成为江城首富！#l";
        selStr += "\r\n#L3" + "# 属于你的极品好装备，点一下就可以拥有！#l";
        cm.sendSimple(selStr);
	} else if (status == 1) {
        if (selection == 0) {
            if (!cm.hasMerchant() && cm.hasMerchantItems()) {
                cm.showFredrick();
                cm.dispose();
            } else {
                if (cm.hasMerchant()) {
                    cm.sendOk("You have a Merchant open.");
                    cm.dispose();
                } else {
                    cm.sendOk("You don't have any items or mesos to be retrieved.");
                    cm.dispose();
                }
            }
        } else if (selection == 1) {
            if(cm.getPlayer().getEventTrigger(10000) == 0){
                cm.sendOk("这是你的三倍经验卡和双倍爆率卡。");
                cm.gainItem(5360000, 1, true, true);
                cm.gainItem(5211060, 1, true, true);
                cm.getPlayer().setEventTrigger(10000, 1)
            } else {
                cm.sendOk("客官本次福利已领取。");
            }
        } else if (selection == 2) {
            if(cm.getPlayer().getEventTrigger(10001) == 0){
                cm.sendOk("这是送给你的1亿块，打工是不可能打工的。");
                cm.gainMeso(100000000);
                cm.getPlayer().setEventTrigger(10001, 1)
            } else {
                cm.sendOk("客官本次福利已领取。");
            }
        } else if (selection == 3) {
            cm.sendOk("这是玩家装备补偿，还在收集装备信息...请客观等待消息");
        }
        cm.dispose();
	}
}