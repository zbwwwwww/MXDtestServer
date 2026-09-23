function end(mode, type, selection) {
    qm.forceCompleteQuest();
    qm.gainExp(9950);
    qm.sendOk("太可怕了，英雄你太厉害了");
    qm.dispose();
}