/*
	This file is part of the OdinMS Maple Story Server
    Copyright (C) 2008 Patrick Huy <patrick.huy@frz.cc>
		       Matthias Butz <matze@odinms.de>
		       Jan Christian Meyer <vimes@odinms.de>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation version 3 of the
    License. You may obtain a copy of the License at
    <http://www.gnu.org/licenses/>

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
import constants.inventory.ItemConstants;
import net.AbstractMaplePacketHandler;
import server.GmActions;
import tools.data.input.SeekableLittleEndianAccessor;

/**
 * 表情动作请求（客户端按 F1~F7 / 用现金表情道具时上报，RecvOpcode.FACE_EXPRESSION）。
 *
 * [GM 快捷键]
 * 表情键的特点是【按下去一定发包】，没有客户端前置判断，所以很适合拿来当 GM 功能的热键。
 * 这里把两个表情值征用为 GM 功能键（非 GM 角色不受影响，照常做表情）：
 *
 *   表情 1 → 全屏捡取（把整张图可捡的物品一次捡完）
 *   表情 2 → 吸怪    （把整张图的怪拉到自己脚下）
 *
 * ★★★ 选键铁律（2026-09-21 实测定案）★★★
 *   这里绑定的是「表情值」而不是物理按键 —— 具体按哪个键由**客户端键位设置**决定。
 *   ⛔ **不要绑到 F1！** 北冥客户端把 F1 自己占用了：按 F1 客户端执行自己的逻辑
 *      （表现为人物消失、怪物静止不动），**根本不发 FACE_EXPRESSION 包**，
 *      服务端收不到 ⇒ GM 功能毫无反应，而现象看起来像"这个键把人物弄隐身了"。
 *   ✅ **实测可用的键：X**（把「表情 1」改绑到 X 后全屏捡取立刻正常，也不再出现人物消失/怪不动）。
 *   ⇒ 给 GM 功能选键时优先挑客户端没占用的普通键（X / C / V 之类），别用功能键。
 *
 * 为什么全屏捡取不直接用 Z：客户端按 Z 时会在自己 800x600 屏内先找最近掉落物，
 * 一件都没有就【不发包】，服务端收不到包就没法执行。表情键没有这个前置判断。
 *
 * 拦截后直接 return，不调 chr.changeFaceExpression() ⇒ 不会广播 ⇒ 别人看不到你"做表情"。
 *
 * 想换表情值就改下面两个常量（1~7 对应「表情 1」~「表情 7」）。
 */
public final class FaceExpressionHandler extends AbstractMaplePacketHandler {

    /** 表情 1 = 全屏捡取（**实测建议绑到 X 键，别绑 F1**）。 */
    private static final int EMOTE_BULK_PICKUP = 1;

    /** 表情 2 = 吸怪。 */
    private static final int EMOTE_VACUUM = 2;

    @Override
    public final void handlePacket(SeekableLittleEndianAccessor slea, MapleClient c) {
        MapleCharacter chr = c.getPlayer();
        int emote = slea.readInt();

        // [GM 快捷键] 借表情键当信号键：只对 GM 生效，非 GM 照原样做表情
        if (chr != null && chr.isGM()) {
            if (emote == EMOTE_BULK_PICKUP) {
                GmActions.pickUpWholeMap(chr);
                warnIfHidden(chr);
                return;
            }
            if (emote == EMOTE_VACUUM) {
                boolean on = GmActions.toggleVacuum(chr);
                chr.dropMessage(6, on
                        ? "[GM] 吸怪模式：开（自动吸住全图怪，击杀后新怪自动补吸；离图自动关）"
                        : "[GM] 吸怪模式：关（已解除定怪）");
                warnIfHidden(chr);
                return;
            }
        }

        if (emote > 7) {
            int itemid = 5159992 + emote;   // thanks RajanGrewal (Darter) for reporting unchecked emote itemid
            if (!ItemConstants.isFaceExpression(itemid) || chr.getInventory(ItemConstants.getInventoryType(itemid)).findById(itemid) == null) {
                return;
            }
        } else if (emote < 1) {
            return;
        }
        
        if(c.tryacquireClient()) {
            try {   // expecting players never intends to wear the emote 0 (default face, that changes back after 5sec timeout)
                if (chr.isLoggedinWorld()) {
                    chr.changeFaceExpression(emote);
                }
            } finally {
                c.releaseClient();
            }
        }
    }

    /**
     * 隐身状态下服务端不会把玩家选为「怪物控制器」，而 v083 怪物移动是客户端驱动的
     * ⇒ 怪物会静止不动。这里主动提示一句，省得又以为是按键坏了。
     */
    private static void warnIfHidden(MapleCharacter chr) {
        if (chr.isHidden()) {
            chr.dropMessage(6, "[GM] 注意：你处于隐身状态，怪物不会走动。输入 !h 现身即可恢复。");
        }
    }
}
