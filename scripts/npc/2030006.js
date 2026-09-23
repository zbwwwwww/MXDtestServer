/*
    This file is part of the HeavenMS MapleStory Server
    Copyleft (L) 2016 - 2019 RonanLana

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
/* Holy Stone
	Holy Ground at the Snowfield (211040401)
	3rd job advancement - Question trial.
 */

var questionTree = [
        //Questions Related to CHARACTERS
        ["在冒险岛中，从Lv1升到Lv2需要多少经验值？", ["20", "是15", "4", "12", "16"], 1],
        ["各职业一转时，下列哪项要求是错误的？", ["Magician - Level 8", "Pirate - 20 DEX or more", "Archer - 25 DEX or more", "飞侠 - 敏捷不低于20", "Swordman - 35 STR or more"], 3],
        ["被怪物攻击时特别的异常状态没有被正确说明的是哪一项？", ["Sealed - skills become disabled", "Undead - turns undead & halved recovery amounts", "虚弱-移动速度降低", "Cursed - EXP received are decreased", "Stunned - cannot move"], 2],
        ["各职业一转时，下列哪项要求是正确的？", ["Pirate - 25 LUK", "Magician - Level 10", "Thief - 25 LUK", "Warrior - 30 STR", "弓箭手 - 25敏捷"], 4],

        //Questions Related to ITEMS
        ["下列怪物中，哪组怪物与打倒他所能得到的战利品是正确的对应关系？", ["Royal cactus - Needle", "Wild Boar - Boar fang", "Lazy Buffy - Buffy hat", "Chipmunk - Nut", "蝙蝠 - 蝙蝠翅膀"], 4],
        ["下列怪物中，哪组怪物与打倒他所能得到的战利品是错误的对应关系", ["Greatest Oldies - Greatest oldies", "食人花 - 食人花的叶子", "Ghost stump - Seedling", "Sparker - Seal tooth", "Miner Zombie - Zombie's lost tooth"], 1],
        //["In GM Event, how many FRUIT CAKE you can get as reward?", ["20", "200", "5", "25", "100"], 2],
        ["下列药品中，哪组药品与功能是正确的对应关系？", ["Warrior Elixir - Attack +5 for 3 minutes", "Pure Water - Recover 700 MP", "Cake - Recover 150 HP & MP", "Salad - Recover 300 MP", "披萨饼 - 回复400 HP"], 4],
        ["下列药品中，哪组药品与功能是错误的对应关系？", ["Mana Elixir - Recover 300 MP", "Tonic - Cures state of weakness", "Apple - Recover 30 HP", "清晨之露 - 回复3000 MP", "Ramen - Recover 1000 HP"], 3],

        //Questions Related to MONSTERS
        ["绿蘑菇，木妖，蓝水灵，斧木妖，三眼章鱼中级别最高的怪物是哪一个？", ["Tree Stump", "Bubbling", "斧木妖", "Octopus", "Green Mushroom"], 2],
        ["往返于魔法密林/天空之城的船上会出现哪个怪物？", ["Werewolf", "Slime", "蝙蝠魔", "Zakum", "Star Pixie"], 2],
        ["在彩虹岛没有出现的怪物是？", ["Shroom", "Blue Snail", "Slime", "Red Snail", "猪猪"], 4],    // to get conformant with website answers, thanks to Vcoc
        ["在金银岛没有出现的怪物是？", ["Evil Eye", "石球", "Jr. Balrog", "Ghost Stump", "Snail"], 1],
        ["在冰封雪域没有出现的怪物是？", ["Dark Yeti", "黑鳄鱼", "Yeti & Pepe", "Bain", "Coolie Zombie"], 1],
        ["以下哪种怪物会飞?", ["巫婆", "Ligator", "Cold Eye", "Meerkat", "Alishar"], 0],
        ["在神秘岛没有出现的怪物是？", ["Lunar Pixie", "Lioner", "Cellion", "鳄鱼", "Hector"], 3],
        ["在彩虹岛没有出现的怪物是？", ["Snail", "Shroom", "独眼兽", "Orange Mushroom", "Blue Snail"], 2],

        //Questions Related to QUESTS
        ["唤醒麦吉不需要的材料是哪一个？", ["Flaming Feather", "Old Gladius", "Piece of Ice", "Ancient Scroll", "妖精之翼"], 4],
        ["以下哪项任务是可以重复完成的?", ["Mystery of Niora Hospital", "Rightful Donation Culture", "The Ghost Whereabout", "艾温的玻璃鞋", "Maya and the Weird Medicine"], 3],
        ["以下哪项不是二转职业", ["巫师", "Cleric", "Assassin", "Gunslinger", "Fighter"], 0],
        ["以下哪项任务要求的等级最高？", ["Cupid's Courier", "Lost in the Ocean", "阿尔卡斯特和黑暗水晶", "Eliminating the Drumming Bunny", "War of Pang Pang"], 2],

        //Questions Related to TOWN/NPC
        ["金银岛没有的村落是？", ["Florina Beach or Nautilus", "彩虹村", "Kerning City & Square", "Perion or Ellinia", "Sleepywood"], 1],
        ["你在彩虹岛遇到的第一个NPC是谁？", ["Sera", "希娜", "Lucas", "Roger", "Shanks"], 1],
        ["在冰封雪域看不到的NPC是？", ["Vogen", "索菲亚", "Pedro", "Master Sergeant Fox", "Rumi"], 1],
        ["在冰封雪域看不到的NPC是？", ["Hidden Rock", "Glibber", "Jeff", "Holy Stone", "保姆珥玛"], 4],
        ["在勇士部落看不到的NPC是？", ["Ayan", "Sophia", "Mr. Smith", "易德", "Manji"], 3],
        ["在射手村看不到的NPC是？", ["特奥", "Vicious", "Mia", "Doofus", "Casey"], 0],
        ["在魔法密林看不到的NPC是？", ["Mr. Park", "Mar the Fairy", "露饵", "Ria", "Shane"], 2],
        ["在废弃都市看不到的NPC是？", ["Dr. Faymus", "Mong from Kong", "Ervine", "鲁克", "Nella"], 3],
        ["哪个NPC与宠物无关?", ["Doofus", "比休斯", "Patricia", "Weaver", "Cloy"], 1],
        ["废弃都市中，离家出走的少年阿列克斯的父亲是谁？", ["长老斯坦", "JM From tha Streetz", "Dr. Faymus", "Vicious", "Luke"], 0],
        ["哪个NPC不属于天空之城阿尔法小队？", ["Staff Sergeant Charlie", "Sergeant Bravo", "Corporal Easy", "Master Sergeant Fox", "彼特"], 4],
        ["在二转过程中，收集30个黑色珠子给转职教官后可以得到什么？", ["Old Ring", "Memory Powder", "Fairy Dust", "英雄证书", "Scroll of Secrets"], 3],
        ["为了给射手村的玛雅治病，需要给她什么？", ["Apple", "Power Elixir", "奇怪的药", "Chrysanthemum", "Orange Juice"], 2],
        ["以下与合成或冶炼工作没有关系的NPC是？", ["Neve", "Serryl", "Shane", "Francois", "JM From tha Streetz"], 2],
        ["在彩虹岛看不到的NPC是？", ["Bari", "特奥", "Pio", "Sid", "Maria"], 1],
        ["在导航室的监视器里能看到谁和Kyrin在一起？", ["Lucas", "金博士", "Chief Stan", "Scadur", "Professor Foxwit"], 1],
        ["你知道射手村的赫丽娜吗？他的眼睛是什么颜色？", ["Blue", "绿色", "Brown", "Red", "Black"], 1],
        ["勇士部落武术教练的帽子上有多少根羽毛？", ["7", "8", "3", "是13", "16"], 3],
        ["魔法密林汉斯持有的宝珠是什么颜色?", ["White", "Orange", "蓝色", "Purple", "Green"], 2]
    ];

var status;
var question;

var questionPool;
var questionPoolCursor;

var questionAnswer;

function start() {
    status = -1;
    action(1, 0, 0);
}

function action(mode, type, selection) {
    if (mode == -1) {
        cm.dispose();
    } else {
        if (mode == 0 && type > 0) {
            cm.dispose();
            return;
        }
        if (mode == 1)
            status++;
        else
            status--;

        if(status == 0) {
            if(cm.getPlayer().gotPartyQuestItem("JBQ") && !cm.haveItem(4031058, 1)) {
                if(cm.haveItem(4005004, 1)) {
                    if(!cm.canHold(4031058)) {
                        cm.sendNext("Have a free ETC slot available before accepting this trial.");
                        cm.dispose();
                    } else {
                        cm.sendNext("Alright... I'll be testing out your wisdom here. Answer all the questions correctly, and you will pass the test BUT, if you even lie to me once, then you'll have to start over again ok, here we go.");
                    }
                } else {
                    cm.sendNext("Bring me a #b#t4005004##k to proceed with the trial.");
                    cm.dispose();
                }
            } else {
                cm.dispose();
            }
        } else if(status == 1) {
            cm.gainItem(4005004, -1);
            instantiateQuestionPool();
            
            question = fetchNextQuestion();
            var questionHead = generateQuestionHeading();
            var questionEntry = questionTree[question][0];
            
            var questionData = generateSelectionMenu(questionTree[question][1], questionTree[question][2]);
            var questionOptions = questionData[0];
            questionAnswer = questionData[1];
            
            cm.sendSimple(questionHead + questionEntry + "\r\n\r\n#b" + questionOptions + "#k");
        } else if(status >= 2 && status <= 5) {
            if(!evaluateAnswer(selection)) {
                cm.sendNext("You have failed the question.");
                cm.dispose();
                return;
            }
            
            question = fetchNextQuestion();
            var questionHead = generateQuestionHeading();
            var questionEntry = questionTree[question][0];
            
            var questionData = generateSelectionMenu(questionTree[question][1], questionTree[question][2]);
            var questionOptions = questionData[0];
            questionAnswer = questionData[1];
            
            cm.sendSimple(questionHead + questionEntry + "\r\n\r\n#b" + questionOptions + "#k");
        } else if(status == 6) {
            if(!evaluateAnswer(selection)) {
                cm.sendNext("You have failed the question.");
                cm.dispose();
                return;
            }
            
            cm.sendOk("Alright. All your answers have been proven as the truth. Your wisdom has been proven.\r\nTake this necklace and go back.");
            cm.gainItem(4031058, 1);
            cm.dispose();
        } else {
            cm.sendOk("Unexpected branch.");
            cm.dispose();
        }
    }
}

function evaluateAnswer(selection) {
    return selection == questionAnswer;
}

function generateQuestionHeading() {
    return "Here's the " + (status) + (status == 1 ? "st" : status == 2 ? "nd" : status == 3 ? "rd" : "th") + " question. ";
}

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

function instantiateQuestionPool() {
    questionPool = [];
    
    for(var i = 0; i < questionTree.length; i++) {
        questionPool.push(i);
    }
    
    shuffleArray(questionPool);
    questionPoolCursor = 0;
}

function fetchNextQuestion() {
    var next = questionPool[questionPoolCursor];
    questionPoolCursor++;
    
    return next;
}

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

function generateSelectionMenu(array, answer) {
    var answerStr = array[answer], answerPos = -1;
    
    shuffle(array);
    
    var menu = "";
    for (var i = 0; i < array.length; i++) {
        menu += "#L" + i + "#" + array[i] + "#l\r\n";
        if (answerStr == array[i]) {
            answerPos = i;
        }
    }
    return [menu, answerPos];
}