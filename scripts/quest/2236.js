var status = -1;

function end(mode, type, selection) {
    if (mode == -1) {
        qm.dispose();
    } else {
        if(mode == 0 && type > 0) {
            qm.dispose();
            return;
        }

        if (mode == 1)
            status++;
        else
            status--;

        if (status == 0) {
            qm.sendOk("妖魔作乱，我辈当诛，邪祟已被镇压，少侠请收好你的奖励。");
        } else if (status == 1) {
            qm.forceCompleteQuest();
            qm.gainExp(6000);
            qm.dispose();
        }
    }
}