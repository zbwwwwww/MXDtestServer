/*
 This file is part of the OdinMS Maple Story Server
 Copyright (C) 2008 Patrick Huy <patrick.huy@frz.cc>
 Matthias Butz <matze@odinms.de>
 Jan Christian Meyer <vimes@odinms.de>

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as
 published by the Free Software Foundation version 3 of the
 License. You may not use this file except in compliance with the
 License. A copy of the GNU Affero General Public License should be
 with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
package net.server.channel.handlers;

import net.AbstractMaplePacketHandler;
import server.GmActions;
import server.maps.MapleMapObject;
import tools.FilePrinter;
import tools.MaplePacketCreator;
import tools.data.input.SeekableLittleEndianAccessor;
import client.MapleCharacter;
import client.MapleClient;

import java.awt.Point;

/**
 * 拾取物品请求（客户端按「拾取物品」键 / 默认 Z 时上报，RecvOpcode.ITEM_PICKUP = 0xCA = 202）。
 *
 * [GM 全屏捡取]
 * GM 角色按一次拾取键 = 把当前地图上所有「可捡」的物品一次性捡完（纯服务端行为，客户端零改动）。
 * 之所以成立：客户端自己做了 800x600 的屏范围校验 —— 屏外的物品客户端压根不会发这个包，
 * 所以「按 Z 就只可能捡屏内」在客户端侧已经天然保证；服务端再把它扩成整图即可。
 *
 * ⚠️ 这条路有个客户端限制绕不过去：屏幕内【一件物品都没有】时，客户端不会发这个包，
 *    所以按 Z 什么也不会发生。想要「身边没物品也能一键捡全图」，请把「表情 1」绑到
 *    【不带功能键】的普通键上（实测 X 可用；⛔ 千万别绑 F1，见 FaceExpressionHandler 的选键铁律
 *    与 handbook\键位-全屏捡取.md §九）。
 *
 * 非 GM 角色保持原版行为（只捡客户端上报的那一件，超距离记为作弊）。
 * 想对所有人开放：把 GM_ONLY_BULK_PICKUP 改成 false 即可（即不再判断 isGM）。
 *
 * @author Matze
 * @author Ronan
 */
public final class ItemPickupHandler extends AbstractMaplePacketHandler {

    /** true = 只有 GM 按拾取键才全屏捡取（普通角色保持原版）。 */
    private static final boolean GM_ONLY_BULK_PICKUP = true;

    @Override
    public final void handlePacket(final SeekableLittleEndianAccessor slea, final MapleClient c) {
        slea.readInt(); //Timestamp
        slea.readByte();
        slea.readPos(); //cpos
        int oid = slea.readInt();
        MapleCharacter chr = c.getPlayer();

        if (!GM_ONLY_BULK_PICKUP || chr.isGM()) {
            GmActions.PickupReport rep = GmActions.pickUpWholeMap(chr);
            chr.dropMessage(6, rep.toMessage());
            if (rep.picked == 0) {
                c.announce(MaplePacketCreator.enableActions());
            }
            return;
        }

        MapleMapObject ob = chr.getMap().getMapObject(oid);
        if(ob == null) return;
        
        Point charPos = chr.getPosition();
        Point obPos = ob.getPosition();
        if (Math.abs(charPos.getX() - obPos.getX()) > 800 || Math.abs(charPos.getY() - obPos.getY()) > 600) {
            FilePrinter.printError(FilePrinter.EXPLOITS + c.getPlayer().getName() + ".txt", c.getPlayer().getName() + " tried to pick up an item too far away. Mapid: " + chr.getMapId() + " Player pos: " + charPos + " Object pos: " + obPos);
            return;
        }
        
        chr.pickupItem(ob);
    }
}
