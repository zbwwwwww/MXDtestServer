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
import client.MapleFamilyEntitlement;
import client.MapleFamilyEntry;
import config.YamlConfig;
import net.AbstractMaplePacketHandler;
import net.server.Server;
import net.server.coordinator.world.MapleInviteCoordinator;
import net.server.coordinator.world.MapleInviteCoordinator.InviteType;
import net.server.world.World;
import server.maps.FieldLimit;
import server.maps.MapleMap;
import tools.MaplePacketCreator;
import tools.data.input.SeekableLittleEndianAccessor;

import java.util.Timer;
import java.util.TimerTask;

/**
 *
 * @author Moogra
 * @author Ubaware
 */
public final class FamilyUseHandler extends AbstractMaplePacketHandler {
    @Override
    public void handlePacket(SeekableLittleEndianAccessor slea, MapleClient c) {
        if(!YamlConfig.config.server.USE_FAMILY_SYSTEM) {
            return;
        }
        MapleFamilyEntitlement type = MapleFamilyEntitlement.values()[slea.readInt()];
        int cost = type.getRepCost();
        MapleFamilyEntry entry = c.getPlayer().getFamilyEntry();
        if(entry.getReputation() < cost || entry.isEntitlementUsed(type)) {
            return; // shouldn't even be able to request it
        }
        c.announce(MaplePacketCreator.getFamilyInfo(entry));
        MapleCharacter victim;
        if(type == MapleFamilyEntitlement.FAMILY_REUINION || type == MapleFamilyEntitlement.SUMMON_FAMILY) {
            victim = c.getChannelServer().getPlayerStorage().getCharacterByName(slea.readMapleAsciiString());
            if(victim != null && victim != c.getPlayer()) {
                if(victim.getFamily() == c.getPlayer().getFamily()) {
                    MapleMap targetMap = victim.getMap();
                    MapleMap ownMap = c.getPlayer().getMap();
                    if(targetMap != null) {
                        if(type == MapleFamilyEntitlement.FAMILY_REUINION) {
                            if(!FieldLimit.CANNOTMIGRATE.check(ownMap.getFieldLimit()) && !FieldLimit.CANNOTVIPROCK.check(targetMap.getFieldLimit())
                                    && (targetMap.getForcedReturnId() == 999999999 || targetMap.getId() < 100000000) && targetMap.getEventInstance() == null) {
                                
                                c.getPlayer().changeMap(victim.getMap(), victim.getMap().getPortal(0));
                                useEntitlement(entry, type);
                            } else {
                                c.announce(MaplePacketCreator.sendFamilyMessage(75, 0)); // wrong message, but close enough. (client should check this first anyway)
                                return;
                            }
                        } else {
                            if(!FieldLimit.CANNOTMIGRATE.check(targetMap.getFieldLimit()) && !FieldLimit.CANNOTVIPROCK.check(ownMap.getFieldLimit()) 
                                    && (ownMap.getForcedReturnId() == 999999999 || ownMap.getId() < 100000000) && ownMap.getEventInstance() == null) {
                                
                                if(MapleInviteCoordinator.hasInvite(InviteType.FAMILY_SUMMON, victim.getId())) {
                                    c.announce(MaplePacketCreator.sendFamilyMessage(74, 0));
                                    return;
                                }
                                MapleInviteCoordinator.createInvite(InviteType.FAMILY_SUMMON, c.getPlayer(), victim, victim.getId(), c.getPlayer().getMap());
                                victim.announce(MaplePacketCreator.sendFamilySummonRequest(c.getPlayer().getFamily().getName(), c.getPlayer().getName()));
                                useEntitlement(entry, type);
                            } else {
                                c.announce(MaplePacketCreator.sendFamilyMessage(75, 0));
                                return;
                            }
                        }
                    }
                } else {
                    c.announce(MaplePacketCreator.sendFamilyMessage(67, 0));
                }
            }
        } else if(type == MapleFamilyEntitlement.FAMILY_BONDING) {
            //not implemented
        } else {
            boolean party = false;
            boolean isExp = false;

            int rate = 2;
            int duration = 15;

            switch(type) {
                case PARTY_EXP_2_30MIN:
                    party = true;
                    isExp = true;
                    rate = 3;
                    duration = 30;
                    break;
                case PARTY_DROP_2_30MIN:
                    party = true;
                    rate = 3;
                    duration = 30;
                    break;
                case SELF_DROP_2_30MIN:
                    rate = 3;
                    duration = 30;
                    break;
                case SELF_DROP_2:
                    rate = 3;
                    break;
                case SELF_DROP_1_5:
                    break;
                case SELF_EXP_2_30MIN:
                    isExp = true;
                    rate = 3;
                    duration = 30;
                case SELF_EXP_2:
                    isExp = true;
                    rate = 3;
                case SELF_EXP_1_5:
                    isExp = true;
                default:
                    break;
            }

            if (isExp) {
                if (c.getPlayer().getEventTrigger(50000) == 0){
                    c.getPlayer().incExpRate(rate);
                    c.getPlayer().setEventTrigger(50000, 1);
                    c.getPlayer().dropMessage(5, "开启学院经验加成");
                    // 定时任务，开启n分钟后的加成到时取消
                    Timer timer = new Timer();
                    timer.schedule(new TimerTask() {
                        @Override
                        public void run() {
                            c.getPlayer().resetRate();
                            c.getPlayer().dropMessage(5, "学院经验加成时间结束");
                            c.getPlayer().setEventTrigger(50000, 0);
                        }
                    }, duration * 1000 * 60);

                } else {
                    c.getPlayer().dropMessage(5, "学院经验加成已开启");
                }

            } else {
                if (c.getPlayer().getEventTrigger(50001) == 0) {
                    c.getPlayer().incDropRate(rate);
                    c.getPlayer().setEventTrigger(50001, 1);
                    c.getPlayer().dropMessage(5, "开启学院爆率加成");
                    // 定时任务，开启n分钟后的加成到时取消
                    Timer timer = new Timer();
                    timer.schedule(new TimerTask() {
                        @Override
                        public void run() {
                            c.getPlayer().resetRate();
                            c.getPlayer().dropMessage(5, "学院爆率加成时间结束");
                            c.getPlayer().setEventTrigger(50001, 0);
                        }
                    }, duration * 1000 * 60);

                } else {
                    c.getPlayer().dropMessage(5, "学院爆率加成已开启");
                }
            }
        }
    }
    
    private void useEntitlement(MapleFamilyEntry entry, MapleFamilyEntitlement entitlement) {
        if(entry.useEntitlement(entitlement)) {
            entry.gainReputation(-entitlement.getRepCost(), false);
            entry.getChr().announce(MaplePacketCreator.getFamilyInfo(entry));
        }
    }
}
