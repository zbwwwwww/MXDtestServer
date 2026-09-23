@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   MXD 083 服务端   HeavenMS-zhoubw_083
echo ============================================
echo.

java -version >nul 2>&1
if errorlevel 1 (
    echo [错误] 没找到 java 命令。请先安装 JDK 8 并加入 PATH。
    echo.
    pause
    exit /b 1
)

echo 工作目录: %CD%
echo '正在启动，看到 "Listening on port 8484" 就是启动成功。'
echo '这个窗口要一直开着，关掉就等于停服。'


java -jar "out\artifacts\HeavenMS_zhoubw_083_jar\HeavenMS-zhoubw_083.jar"

echo.
echo [服务端已退出]  按任意键关闭
pause >nul
