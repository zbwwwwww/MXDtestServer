import java.io.File;
import provider.MapleData;
import provider.MapleDataProvider;
import provider.MapleDataProviderFactory;
import provider.MapleDataTool;

public class Probe5121009 {
    public static void main(String[] args) {
        MapleDataProvider wz = MapleDataProviderFactory.getDataProvider(new File("D:/MXDtestServer/wz/Skill.wz"));
        MapleData root = wz.getData("512.img");
        if (root == null) { System.out.println("PROBE_FAIL: root null"); return; }
        MapleData skill = root.getChildByPath("skill/5121009");
        if (skill == null) { System.out.println("PROBE_FAIL: skill null"); return; }
        MapleData lv1 = skill.getChildByPath("level/1");
        MapleData lv20 = skill.getChildByPath("level/20");
        System.out.println("lv1  x=" + MapleDataTool.getInt("x", lv1, -99) + " time=" + MapleDataTool.getInt("time", lv1, -99));
        System.out.println("lv20 x=" + MapleDataTool.getInt("x", lv20, -99) + " time=" + MapleDataTool.getInt("time", lv20, -99));
        System.out.println("PROBE_OK");
    }
}
