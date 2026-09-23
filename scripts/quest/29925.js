
var status = -1;

function start(mode, type, selection) {;
	if (qm.getPlayer().getLevel() >= 30 && parseInt(qm.getPlayer().getJob().getId() / 100) == 21) {
	    qm.forceStartQuest()
	    if(!qm.haveItem(1142130,1)) {
            if(qm.canHold(1142130)){
                qm.sendOk("恭喜少侠武功增进，老夫将赠与勋章一枚");
                qm.gainItem(1142130,1);
                qm.forceCompleteQuest();
            } else {
                qm.sendOk("无法获得神器，请少侠检查行囊空间");
            }
	    } else {
            qm.sendOk("武功修炼，内外运尔，集天地之灵气，子可为之。");
            qm.forceCompleteQuest();
	    }
	}
	qm.dispose();
}

function end(mode, type, selection) {
	if (qm.getPlayer().getLevel() >= 30 && parseInt(qm.getPlayer().getJob().getId() / 100) == 21) {
	    if(!qm.haveItem(1142130,1)) {
            if(qm.canHold(1142130)){
                qm.sendOk("恭喜少侠武功增进，老夫将赠与勋章一枚");
                qm.gainItem(1142130,1);
                qm.forceCompleteQuest();
            } else {
                qm.sendOk("无法获得神器，请少侠检查行囊空间");
            }
	    } else {
            qm.sendOk("武功修炼，内外运尔，集天地之灵气，子可为之。");
            qm.forceCompleteQuest();
	    }
	}
	qm.dispose();
}