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

import client.MapleClient;
import client.MapleCharacter;
import net.AbstractMaplePacketHandler;
import server.life.MapleMonster;
import server.maps.MapleMap;
import tools.MaplePacketCreator;
import tools.data.input.SeekableLittleEndianAccessor;

/**
 *
 * @author Jay Estrella
 * @author Ronan
 */
public final class MobDamageMobHandler extends AbstractMaplePacketHandler {
    @Override
    public void handlePacket(SeekableLittleEndianAccessor slea, MapleClient c) {
        int from = slea.readInt();
        slea.readInt();
        int to = slea.readInt();
        boolean magic = slea.readByte() == 0;
        int dmg = slea.readInt();
        MapleCharacter chr = c.getPlayer();
        
        MapleMap map = chr.getMap();
        MapleMonster attacker = map.getMonsterByOid(from);
        MapleMonster damaged = map.getMonsterByOid(to);
        
        if (attacker != null && damaged != null) {
            map.damageMonster(chr, damaged, dmg);
            map.broadcastMessage(chr, MaplePacketCreator.damageMonster(to, dmg), false);
        }
    }
}
