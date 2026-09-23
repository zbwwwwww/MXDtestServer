package constants.string;

import client.MapleCharacter;

/**
 *
 * @author Drago (Dragohe4rt)
 */
public class LanguageConstants {
    
    enum Language {
        LANG_ENG(2);
        
        int lang;
        
        private Language(int lang) {
            this.lang = lang;
        }
        
        private int getValue() {
            return this.lang;
        }
        
    }
    
    public static String CPQBlue[] = new String[3];
    public static String CPQError[] = new String[3];
    public static String CPQEntry[] = new String[3];
    public static String CPQFindError[] = new String[3];
    public static String CPQRed[] = new String[3];
    public static String CPQPlayerExit[] = new String[3];
    public static String CPQEntryLobby[] = new String[3];
    public static String CPQPickRoom[] = new String[3];
    public static String CPQExtendTime[] = new String[3];
    public static String CPQLeaderNotFound[] = new String[3];
    public static String CPQChallengeRoomAnswer[] = new String[3];
    public static String CPQChallengeRoomSent[] = new String[3];
    public static String CPQChallengeRoomDenied[] = new String[3];
    
    static {
        int lang;

        lang = Language.LANG_ENG.getValue();
        LanguageConstants.CPQBlue[lang] = "Maple Blue";
        LanguageConstants.CPQRed[lang] = "Maple Red";
        LanguageConstants.CPQPlayerExit[lang] = " left the Carnival of Monsters.";
        LanguageConstants.CPQExtendTime[lang] = "The time has been extended.";
        LanguageConstants.CPQLeaderNotFound[lang] = "Could not find the Leader.";
        LanguageConstants.CPQError[lang] = "There was a problem. Please re-create a room.";
        LanguageConstants.CPQPickRoom[lang] = "Sign up for the Monster Festival!\r\n";
        LanguageConstants.CPQChallengeRoomAnswer[lang] = "The group is currently facing a challenge.";
        LanguageConstants.CPQChallengeRoomSent[lang] = "A challenge has been sent to the group in the room. Please wait a while.";
        LanguageConstants.CPQChallengeRoomDenied[lang] = "The group in the room canceled your challenge.";
        LanguageConstants.CPQFindError[lang] = "We could not find a group in this room.\r\nProbably the group was scrapped inside the room!";
        LanguageConstants.CPQEntryLobby[lang] = "You will now receive challenges from other groups. If you do not accept a challenge within 3 minutes, you will be taken out.";
        LanguageConstants.CPQEntry[lang] = "You can select \"Summon Monsters\", \"Ability\", or \"Protector\" as your tactic during the Monster Carnival. Use Tab and F1 ~ F12 for quick access!";

    }

    public static String getMessage(MapleCharacter chr, String[] message) {
        return message[chr.getLanguage()];
    }
}
