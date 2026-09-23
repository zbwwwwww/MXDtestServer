package server.quest.requirements;

import client.MapleCharacter;
import provider.MapleData;
import provider.MapleDataTool;
import server.quest.MapleQuest;
import server.quest.MapleQuestRequirementType;

/**
 *
 * @author Tyler (Twdtwd)
 */
public class MaxLevelRequirement extends MapleQuestRequirement {
    private int maxLevel;


    public MaxLevelRequirement(MapleQuest quest, MapleData data) {
        super(MapleQuestRequirementType.MAX_LEVEL);
        processData(data);
    }

    /**
     *
     * @param data
     */
    @Override
    public void processData(MapleData data) {
        maxLevel = MapleDataTool.getInt(data);
    }


    @Override
    public boolean check(MapleCharacter chr, Integer npcid) {
        return maxLevel >= chr.getLevel();
    }
}
