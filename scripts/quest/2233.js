
function end(mode, type, selection) {
    var playerFame = qm.getPlayer().getFamilyEntry().getReputation();
    if (playerFame > 1000) {  // script found thanks to kvmba
        qm.forceCompleteQuest();
        qm.gainExp(6000);
        qm.sendNext("你在学院已经崭露头角！");
    } else {
        qm.sendNext("你还没有建立斐赫声名？继续前进年轻人。");
    }
    qm.dispose();
}