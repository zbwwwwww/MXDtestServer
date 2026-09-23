r"""
只把「本次改动的几个 .java」编译后打进 jar，不做全量重建。

为什么不用 mxd_build.py full：full 会先 rmtree 临时编译目录（上千个文件），
会被本机沙箱的批量删除保护拦掉。既然 jar 里其它 class 都没变，
只更新这几个条目（jar uf）效果完全等价。

用法：
    py patch_jar.py                            # 用默认文件列表
    py patch_jar.py src\a\B.java src\c\D.java  # 指定要打进 jar 的源文件
"""
import os
import subprocess
import sys
import zipfile

JDK = r'C:\Program Files\Eclipse Adoptium\jdk-8.0.502.7-hotspot\bin'
JAVAC = os.path.join(JDK, 'javac.exe')
JAR = os.path.join(JDK, 'jar.exe')

SRV = r'D:\MXDtestServer'
CORES = os.path.join(SRV, 'cores')
OUTDIR = os.path.join(SRV, r'out\production\SERVER083')
PATCH_DIR = r'D:\tmp\mxd-jarpatch'
JARFILE = os.path.join(SRV, r'out\artifacts\HeavenMS_zhoubw_083_jar\HeavenMS-zhoubw_083.jar')

FILES = [
    r'src\server\GmActions.java',
    r'src\net\server\channel\handlers\FaceExpressionHandler.java',
    r'src\net\server\channel\handlers\ItemPickupHandler.java',
]


def entries(jar):
    with zipfile.ZipFile(jar) as z:
        return len(z.namelist())


def main(files):
    os.makedirs(PATCH_DIR, exist_ok=True)

    print('== 1) 编译到补丁目录 ==')
    for f in files:
        print('   ', f)
    cp = OUTDIR + os.pathsep + CORES + r'\*'
    p = subprocess.run([JAVAC, '-g', '-encoding', 'UTF-8', '-nowarn', '-d', PATCH_DIR, '-cp', cp] + files,
                       cwd=SRV, capture_output=True)
    out = p.stdout.decode('gbk', 'replace')
    err = p.stderr.decode('gbk', 'replace')
    bad = [l for l in (out + err).splitlines() if 'error:' in l or '错误:' in l]
    if p.returncode != 0 or bad:
        print(out.strip())
        print(err.strip())
        print('\n❌ 编译失败')
        return 1
    n = sum(1 for r, d, fs in os.walk(PATCH_DIR) for f in fs if f.endswith('.class'))
    print('   ok，生成 %d 个 class' % n)

    print('== 2) 更新 jar 条目 ==')
    before = entries(JARFILE)
    p = subprocess.run([JAR, 'uf', JARFILE, '.'], cwd=PATCH_DIR, capture_output=True)
    after = entries(JARFILE)
    print('   条目数 %d -> %d %s' % (before, after, '(一致 ✅)' if before == after else '(不一致 ⚠️)'))
    print('   jar 大小: %d bytes' % os.path.getsize(JARFILE))

    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:] or FILES))
