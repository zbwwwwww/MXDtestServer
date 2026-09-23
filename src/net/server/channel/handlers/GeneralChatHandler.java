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
package net.server.channel.handlers;

import client.MapleCharacter;
import client.MapleClient;
import client.MapleJob;
import client.Skill;
import client.SkillFactory;
import client.inventory.manipulator.MapleInventoryManipulator;
import config.YamlConfig;
import constants.game.GameConstants;
import net.AbstractMaplePacketHandler;
import scripting.npc.NPCScriptManager;
import tools.LogHelper;
import tools.MaplePacketCreator;
import tools.data.input.SeekableLittleEndianAccessor;

public final class GeneralChatHandler extends AbstractMaplePacketHandler {
    @Override
    public void handlePacket(SeekableLittleEndianAccessor slea, MapleClient c) {
        String s = slea.readMapleAsciiString();
        MapleCharacter chr = c.getPlayer();

        char heading = s.charAt(0);
        if (heading == '!') {
            // 客户端不认 / 开头的 GM 指令（会当成普通聊天发过来），所以在服务端兜底解析
            handleGmCommand(s, chr, c);
            return;
        }
        if (heading != '/') {
            int show = slea.readByte();
            if (chr.getMap().isMuted() && !chr.isGM()) {
                chr.dropMessage(5, "The map you are in is currently muted. Please try again later.");
                return;
            }

            if (!chr.isHidden()) {
                chr.getMap().broadcastMessage(MaplePacketCreator.getChatText(chr.getId(), s, chr.getWhiteChat(), show));
                if (YamlConfig.config.server.USE_ENABLE_CHAT_LOG) {
                    LogHelper.logChat(c, "General", s);
                }
            } else {
                chr.getMap().broadcastGMMessage(MaplePacketCreator.getChatText(chr.getId(), s, chr.getWhiteChat(), show));
                if (YamlConfig.config.server.USE_ENABLE_CHAT_LOG) {
                    LogHelper.logChat(c, "GM General", s);
                }
            }
        }
    }

    private static void handleGmCommand(String msg, MapleCharacter chr, MapleClient c) {
        if (chr == null || !chr.isGM()) {
            return;
        }

        String[] parts = msg.substring(1).trim().split("\\s+");
        if (parts.length == 0 || parts[0].isEmpty()) {
            return;
        }

        String cmd = parts[0].toLowerCase();
        try {
            switch (cmd) {
                case "help":
                    chr.dropMessage(5, "[GM] !h 隐身/现身 | !exp <经验> | !meso <金币> | !item <物品ID> [数量]");
                    chr.dropMessage(5, "[GM] !warp <地图ID> | !job <职业ID> | !skill <技能ID> [等级] | !maxskill 满本职业技能");
                    chr.dropMessage(5, "[GM] !run <脚本名> 打开脚本菜单（!run gm_menu）");
                    break;

                case "h":
                    chr.Hide(!chr.isHidden());
                    chr.dropMessage(5, chr.isHidden() ? "[GM] 已隐身" : "[GM] 已现身");
                    break;

                case "exp": {
                    int exp = Integer.parseInt(parts[1]);
                    chr.setExp(exp);
                    chr.dropMessage(5, "[GM] 经验已设为 " + exp);
                    break;
                }

                case "meso": {
                    int meso = Integer.parseInt(parts[1]);
                    chr.gainMeso(meso);
                    chr.dropMessage(5, "[GM] 已获得 " + meso + " 金币");
                    break;
                }

                case "item": {
                    int itemId = Integer.parseInt(parts[1]);
                    short qty = (short) (parts.length > 2 ? Integer.parseInt(parts[2]) : 1);
                    if (MapleInventoryManipulator.addById(c, itemId, qty)) {
                        chr.dropMessage(5, "[GM] 已获得物品 " + itemId + " x" + qty);
                    } else {
                        chr.dropMessage(5, "[GM] 物品ID无效，或背包已满");
                    }
                    break;
                }

                case "warp": {
                    int mapId = Integer.parseInt(parts[1]);
                    if (chr.warpTo(mapId)) {
                        chr.dropMessage(5, "[GM] 已传送到地图 " + mapId);
                    } else {
                        chr.dropMessage(5, "[GM] 地图ID不存在: " + mapId);
                    }
                    break;
                }

                case "job": {
                    int jobId = Integer.parseInt(parts[1]);
                    MapleJob job = MapleJob.getById(jobId);
                    if (job == null) {
                        chr.dropMessage(5, "[GM] 职业编号无效: " + jobId + "（可用范围 100 ~ 522）");
                        break;
                    }
                    int oldJobId = chr.getJob().getId();
                    chr.changeJob(job);
                    String jobNameCn = GameConstants.getJobNameCn(jobId);
                    chr.dropMessage(5, "[GM] 已转职：" + (jobNameCn.isEmpty() ? ("职业" + jobId) : (jobNameCn + " (" + jobId + ")")));
                    // 战士/法师/弓手/飞侠/海盗 分别是 1~5 系，跨系转职旧技能会留在技能栏
                    if (oldJobId != 0 && (oldJobId / 100) % 10 != (jobId / 100) % 10) {
                        chr.dropMessage(5, "[GM] 跨系转职：旧职业技能还留在技能栏，用不了也删不掉");
                    }
                    chr.dropMessage(5, "[GM] 想要满技能？输入 !maxskill");
                    break;
                }

                case "skill": {
                    int skillId = Integer.parseInt(parts[1]);
                    int wantLevel = (parts.length > 2) ? Integer.parseInt(parts[2]) : -1;
                    Skill skill = SkillFactory.getSkill(skillId);
                    if (skill == null || skill.getMaxLevel() <= 0) {
                        chr.dropMessage(5, "[GM] 技能ID无效: " + skillId);
                        break;
                    }
                    int maxLevel = skill.getMaxLevel();
                    int newLevel = (wantLevel <= 0) ? maxLevel : Math.min(wantLevel, maxLevel);
                    chr.changeSkillLevel(skill, (byte) newLevel, maxLevel, -1);
                    chr.dropMessage(5, "[GM] 技能 " + skillId + " 已设为 " + newLevel + "/" + maxLevel + " 级");
                    break;
                }

                case "maxskill": {
                    int n = chr.maxJobSkills();
                    chr.dropMessage(5, (n > 0)
                            ? "[GM] 已把本职业 " + n + " 个技能练满"
                            : "[GM] 当前职业没有可练的技能（初心者无职业技能）");
                    break;
                }

                case "run": {
                    // 借用 NPC 脚本引擎：把 scripts/npc/<脚本名>.js 当一次 NPC 对话跑起来
                    if (parts.length < 2) {
                        chr.dropMessage(5, "[GM] 用法: !run <脚本名>");
                        break;
                    }
                    if (!NPCScriptManager.getInstance().start(c, 9010000, parts[1], chr)) {
                        chr.dropMessage(5, "[GM] 找不到脚本 scripts/npc/" + parts[1] + ".js");
                    }
                    break;
                }

                default:
                    chr.dropMessage(5, "[GM] 未知指令，输入 !help 查看");
                    break;
            }
        } catch (Exception e) {
            chr.dropMessage(5, "[GM] 指令格式错误，输入 !help 查看");
        }
    }
}