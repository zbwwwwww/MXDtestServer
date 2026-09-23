/*
 * GM 快捷键动作的共用实现。
 *
 * 为什么单独抽一个类：同一件事有两个触发入口，必须走完全相同的代码 ——
 *   1) 按「拾取物品」键（默认 Z）→ ItemPickupHandler → RecvOpcode.ITEM_PICKUP
 *   2) 按表情键 F1 / F2        → FaceExpressionHandler → RecvOpcode.FACE_EXPRESSION
 *
 * 为什么捡物要借道表情键：
 *   客户端按拾取键时会先在自己 800x600 的屏幕范围内找最近的掉落物，
 *   一件都找不到就【根本不发包】，服务端收不到包自然无从下手。
 *   表情键没有这个前置判断，按下去一定发包，所以拿它当"信号键"。
 */
package server;

import client.MapleCharacter;
import client.inventory.Item;
import client.inventory.MapleInventory;
import client.inventory.MapleInventoryType;
import client.inventory.manipulator.MapleInventoryManipulator;
import java.awt.Point;
import java.util.List;
import net.server.Server;
import server.life.MapleMonster;
import server.maps.MapleMap;
import server.maps.MapleMapItem;
import server.maps.MapleMapObject;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import tools.MaplePacketCreator;

/**
 * @author Ronan (原版 pickupItem / resetMobPosition 逻辑)
 */
public final class GmActions {

    /** 一次按键最多捡多少件，防止地上几百件时把客户端/网络打爆。 */
    public static final int MAX_BULK_PICKUP = 200;

    /** 每批捡几件（控制单次发往客户端的封包量，避免一次性几百包导致卡死/掉线）。 */
    public static final int BULK_PICKUP_BATCH = 20;

    /** 批间隔（毫秒）：给客户端处理封包、服务端呼吸的间隔。 */
    public static final int BULK_PICKUP_BATCH_DELAY = 300;

    /** 与 MapleCharacter.pickupItem 内的落地保护保持一致（刚掉的物品要等 400ms）。 */
    private static final long DROP_PICKUP_DELAY = 400L;

    /** 进行中的分批捡取任务（按角色 id 记录），用于挡重入 + 换图/下线时取消。 */
    private static final Map<Integer, ScheduledFuture<?>> bulkPickupFutures = new ConcurrentHashMap<>();

    private GmActions() {
    }

    /**
     * 全屏捡取的统计结果。
     *
     * 为什么要有这个类：以前只返回一个 int，捡不到时只能给一句"地上没有可捡的东西"，
     * 把「背包满」「刚掉落」「归属别人」全部伪装成「地上没东西」，排查时无从下手。
     * 现在每种跳过原因各记一个计数，消息里直接写出来。
     */
    public static final class PickupReport {

        /** 地上掉落物总数（只统计 MapleMapItem）。 */
        public int total;

        /** 真正进了背包的件数（以 mapitem.isPickedUp() 为准，不虚报）。 */
        public int picked;

        /** 背包放不下被跳过。 */
        public int noSpace;

        /** 刚落地，还在 400ms 保护期。 */
        public int justDropped;

        /** 归属别人。 */
        public int notOwner;

        /** 前置任务不满足的限定掉落。 */
        public int questLocked;

        /** 已被捡走 / 空壳。 */
        public int alreadyGone;

        /** 通知了 pickupItem 但它内部拒绝了（唯一物品、脚本道具等）。 */
        public int rejected;

        /** 其中金币堆的堆数（仅用于说明）。 */
        public int meso;

        public String toMessage() {
            if (total == 0) {
                return "[GM] 全屏捡取：地上没有掉落物（0 件）";
            }

            StringBuilder sb = new StringBuilder(112);
            sb.append("[GM] 全屏捡取：地上 ").append(total)
              .append(" 件，拾取 ").append(picked).append(" 件");

            if (picked >= total) {
                return sb.toString();
            }

            sb.append("，跳过：背包满 ").append(noSpace)
              .append("，刚掉落 ").append(justDropped)
              .append("，归属他人 ").append(notOwner);
            if (questLocked > 0) {
                sb.append("，任务限定 ").append(questLocked);
            }
            if (alreadyGone > 0) {
                sb.append("，已捡走 ").append(alreadyGone);
            }
            if (rejected > 0) {
                sb.append("，被拒 ").append(rejected);
            }
            if (picked >= MAX_BULK_PICKUP) {
                sb.append("（已达单次上限 ").append(MAX_BULK_PICKUP).append(" 件，再按一次继续）");
            }
            return sb.toString();
        }
    }

    /**
     * 全屏捡取（分批异步版）。
     *
     * 为什么改成批：旧版在一个按键处理里同步循环最多 200 件，每件都给客户端发背包更新包，
     * 一次性几百个包会把旧客户端打崩；同步循环太久还会让服务端把玩家踢下线。
     * 现在一次按键发起一个 TimerManager 周期任务：每批只捡 BULK_PICKUP_BATCH 件、
     * 间隔 BULK_PICKUP_BATCH_DELAY ms，客户端每批只收少量包，服务端也不再长时间阻塞。
     *
     * 复用 MapleCharacter.pickupItem：归属 / 进背包 / 队伍分钱 / 宠物 / 任务 / 脚本道具链路全部沿用原逻辑，不抢别人掉落。
     * 玩家换图或下线时任务自动停止（见 run() 内的地图 id 校验）。
     */
    public static void pickUpWholeMap(MapleCharacter chr) {
        // 已在捡取中 → 挡重入，避免连按 A 起多个任务
        ScheduledFuture<?> prev = bulkPickupFutures.get(chr.getId());
        if (prev != null && !prev.isDone()) {
            chr.dropMessage(5, "[GM] 全屏捡取进行中，请稍候…");
            return;
        }

        final int targetMapId = chr.getMapId();
        final PickupReport rep = new PickupReport();

        chr.dropMessage(5, "[GM] 全屏捡取开始（分批进行，地图物品多也不会卡）…");

        Runnable task = new Runnable() {
            @Override
            public void run() {
                try {
                    // 玩家已不在目标地图（换图）或已下线 → 停止，避免在旧图继续捡 / NPE
                    if (chr.getMapId() != targetMapId || !chr.isLoggedin() || chr.getClient() == null) {
                        stop(null);
                        return;
                    }
                    int done = pickBatch(chr, rep, BULK_PICKUP_BATCH);
                    if (done < BULK_PICKUP_BATCH) {
                        stop(null);                              // 本批没捡满 = 地图上已无可捡的
                    } else if (rep.picked >= MAX_BULK_PICKUP) {
                        stop("[GM] 全屏捡取：已达单次上限 " + MAX_BULK_PICKUP + " 件，再按一次继续");
                    }
                    // 否则定时器会在 BULK_PICKUP_BATCH_DELAY 后再次调度本任务
                } catch (Throwable t) {
                    stop("[GM] 全屏捡取因异常停止");
                }
            }

            private void stop(String msg) {
                ScheduledFuture<?> f = bulkPickupFutures.remove(chr.getId());
                if (f != null) {
                    f.cancel(false);
                }
                StringBuilder sb = new StringBuilder();
                if (msg != null) {
                    sb.append(msg);
                } else {
                    sb.append("[GM] 全屏捡取：完成");
                }
                sb.append("（已捡 ").append(rep.picked).append(" 件");
                if (rep.noSpace > 0) sb.append("，背包满 ").append(rep.noSpace);
                if (rep.justDropped > 0) sb.append("，刚掉落 ").append(rep.justDropped);
                if (rep.notOwner > 0) sb.append("，归属他人 ").append(rep.notOwner);
                if (rep.alreadyGone > 0) sb.append("，已捡走 ").append(rep.alreadyGone);
                if (rep.rejected > 0) sb.append("，被拒 ").append(rep.rejected);
                sb.append("）");
                chr.dropMessage(5, sb.toString());
                // 一件都没捡到时（地图本就没东西 / 全被过滤），发 enableActions 让客户端恢复可操作
                if (rep.picked == 0 && chr.getClient() != null) {
                    chr.getClient().announce(MaplePacketCreator.enableActions());
                }
            }
        };

        ScheduledFuture<?> f = TimerManager.getInstance().register(task, BULK_PICKUP_BATCH_DELAY, BULK_PICKUP_BATCH_DELAY);
        bulkPickupFutures.put(chr.getId(), f);
    }

    /**
     * 同步捡一批（最多 limit 件），返回本批成功进背包的件数。
     * 统计逻辑沿用旧版：归属 / 落地保护 / 背包空间 / 任务限定全部照判，不抢别人、不虚报。
     */
    private static int pickBatch(MapleCharacter chr, PickupReport rep, int limit) {
        MapleMap map = chr.getMap();
        List<MapleMapObject> mapItems = map.getItems();     // 内部已做一次拷贝，循环中删对象不会 CME
        if (mapItems.isEmpty()) {
            return 0;
        }

        long now = Server.getInstance().getCurrentTime();
        MapleItemInformationProvider ii = MapleItemInformationProvider.getInstance();

        int done = 0;
        for (MapleMapObject obj : mapItems) {
            if (done >= limit) {
                break;
            }
            if (!(obj instanceof MapleMapItem)) {
                continue;
            }

            MapleMapItem mapitem = (MapleMapItem) obj;
            rep.total++;
            if (mapitem.isPickedUp()) {
                rep.alreadyGone++;
                continue;                                   // 已被捡走
            }
            if (!mapitem.canBePickedBy(chr)) {
                rep.notOwner++;
                continue;                                   // 归属别人
            }
            if (now - mapitem.getDropTime() < DROP_PICKUP_DELAY) {
                rep.justDropped++;
                continue;                                   // 刚落地，原逻辑也会拒绝
            }

            if (mapitem.getMeso() > 0) {
                rep.meso++;
            } else {
                Item mItem = mapitem.getItem();
                if (mItem == null) {
                    rep.alreadyGone++;
                    continue;
                }

                boolean noSpaceNeeded = (mapitem.getItemId() == 4031865 || mapitem.getItemId() == 4031866 || ii.isConsumeOnPickup(mapitem.getItemId()));
                if (!noSpaceNeeded) {
                    String owner = mItem.getOwner();
                    if (owner == null) {
                        owner = "";
                    }
                    // 背包放不下 / 唯一物品已拥有 → 跳过，避免刷一屏「背包已满」
                    if (!MapleInventoryManipulator.checkSpace(chr.getClient(), mapitem.getItemId(), mItem.getQuantity(), owner)) {
                        rep.noSpace++;
                        continue;
                    }
                }

                // 前置任务不满足的限定掉落，捡了也会被拒（pickupItem 里会弹「无法拾取」）
                if (!chr.needQuestItem(mapitem.getQuest(), mapitem.getItemId())) {
                    rep.questLocked++;
                    continue;
                }
            }

            chr.pickupItem(mapitem);
            if (mapitem.isPickedUp()) {
                rep.picked++;                               // 只有真被拿走才算捡到
            } else {
                rep.rejected++;                             // 通知了但被内部逻辑拒绝，不虚报件数
            }
            done++;
        }

        return done;
    }

    /**
     * 吸怪：把当前地图上所有活着的怪物挪到 chr 所在位置，返回成功挪动的只数。
     *
     * resetMobPosition 是服务端原生方法（MapleMonster:1325），内部依次做
     * aggroRemoveController → setPosition → 广播 moveMonster 包 → map.moveMonster
     * → aggroUpdateController，所以挪完怪会重新锁定最近的玩家（也就是你）。
     *
     * 注意：全项目此前零调用方，且怪物位置的最终显示由客户端驱动（MoveLifeHandler）。
     * 也就是说这个包发出去客户端会不会照做，只能实测确认。
     */
    public static int vacuumMonsters(MapleCharacter chr) {
        MapleMap map = chr.getMap();
        List<MapleMonster> mobs = map.getAllMonsters();     // 快照，循环中不会 CME
        if (mobs.isEmpty()) {
            return 0;
        }

        Point pos = chr.getPosition();
        int ok = 0;

        for (MapleMonster mob : mobs) {
            if (mob == null || !mob.isAlive()) {
                continue;
            }
            try {
                mob.resetMobPosition(pos);
                ok++;
            } catch (Exception e) {
                // 单只失败（正在死亡 / 已脱离地图）不影响其它
            }
        }

        return ok;
    }

    /**
     * 吸怪模式开关（替代原来的一次性 vacuumMonsters）。
     * 开 → 把全图活怪拉到脚下并冻结（钉死）；关 → 解除冻结。
     * 开启期间地图新刷的怪（含击杀后的补刷）由 MapleMap.spawnMonster 经 attractIfEnabled 自动吸住，
     * 所以开启后无需再按吸怪键。吸引人离图/断开时由 MapleMap.stopAutoAttract 自动关。
     */
    public static boolean toggleVacuum(MapleCharacter chr) {
        MapleMap map = chr.getMap();
        if (map.isAutoAttract()) {
            map.stopAutoAttract();
            return false;
        }
        Point pos = MapleMap.vacuumTargetPoint(chr.getPosition());
        for (MapleMonster m : map.getAllMonsters()) {
            if (m.isAlive()) {
                m.setFrozen(true);
                m.resetMobPosition(pos);
            }
        }
        map.setAutoAttract(true, chr);
        return true;
    }

    /**
     * GM 自检（诊断用）：把「为什么捡不到 / 怪为什么不动」要看的东西一次报出来。
     *
     * 时钟差 = 真实墙钟 − 服务端集中时间。这个值正常应接近 0；
     * 若明显偏离，说明 dropTime 与 pickupItem 内部用的 400ms 检查不是同一只时钟，
     * 刚掉的物品会被判成"保护期内"而捡不起来。
     *
     * ⚠️ 当前【未绑定任何入口】：原先挂在「表情 3」上，09-21 排查结束后已撤掉那个分支
     * （常驻的按键不该留诊断功能）。需要时在 FaceExpressionHandler 里加一行
     * `chr.dropMessage(6, GmActions.diagnose(chr));` 即可临时挂回，无需改本方法。
     */
    public static String diagnose(MapleCharacter chr) {
        MapleMap map = chr.getMap();

        long wall = System.currentTimeMillis();
        long srv = Server.getInstance().getCurrentTime();

        MapleInventory use = chr.getInventory(MapleInventoryType.USE);
        MapleInventory etc = chr.getInventory(MapleInventoryType.ETC);

        int useUsed = use.getSlotLimit() - use.getNumFreeSlot();
        int etcUsed = etc.getSlotLimit() - etc.getNumFreeSlot();

        return "[GM] 自检：地图 " + map.getId()
                + "，掉落 " + map.getItems().size() + " 件"
                + "，怪 " + map.getAllMonsters().size() + " 只"
                + "，隐身 " + chr.isHidden()
                + "，时钟差 " + (wall - srv) + "ms"
                + "，USE " + useUsed + "/" + use.getSlotLimit()
                + "，ETC " + etcUsed + "/" + etc.getSlotLimit();
    }
}
