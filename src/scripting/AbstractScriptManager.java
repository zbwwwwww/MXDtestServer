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
package scripting;

import client.MapleClient;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

import javax.script.*;

import constants.net.ServerConstants;
import jdk.nashorn.api.scripting.NashornScriptEngine;
import tools.FilePrinter;

/**
 *
 * @author Matze
 */
public abstract class AbstractScriptManager {
    private ScriptEngineFactory sef;

    protected AbstractScriptManager() {
        sef = new ScriptEngineManager().getEngineByName("javascript").getFactory();
    }

    protected NashornScriptEngine getScriptEngine(String path) {
        path = "scripts/" + path;
        File scriptFile = new File(path);
        if (!scriptFile.exists()) {
            return null;
        }
        NashornScriptEngine engine = (NashornScriptEngine) sef.getScriptEngine();
        // 脚本一律按 UTF-8 读：原来用 FileReader（平台默认编码，本机是 GBK），
        // 而 scripts 目录下所有含中文的脚本都是 UTF-8，导致中文在客户端全部乱码。
        try (InputStreamReader fr = new InputStreamReader(new FileInputStream(scriptFile), StandardCharsets.UTF_8)) {
            if (ServerConstants.JAVA_8){
                engine.eval("load('nashorn:mozilla_compat.js');" + System.lineSeparator());
            }
            engine.eval(fr);
        } catch (final ScriptException | IOException t) {
            FilePrinter.printError(FilePrinter.INVOCABLE + path.substring(12), t, path);
            return null;
        }

        return engine;
    }

    protected NashornScriptEngine getScriptEngine(String path, MapleClient c) {
        NashornScriptEngine engine = c.getScriptEngine("scripts/" + path);
        if (engine == null) {
            engine = getScriptEngine(path);
            c.setScriptEngine(path, engine);
        }

        return engine;
    }

    protected void resetContext(String path, MapleClient c) {
        c.removeScriptEngine("scripts/" + path);
    }
}
