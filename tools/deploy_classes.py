"""
把指定的几个 .java 编译进【服务端实际加载的目录】 out\\production\\SERVER083。

为什么要单独写：IDEA 以 Run/Debug 启动服务端时，classpath 是
    D:\\MXDtestServer\\out\\production\\SERVER083
而不是 out\\artifacts\\...\\HeavenMS-zhoubw_083.jar。
mxd_build.py 的 check 只写临时目录、full 只更新 jar，两者都改不到这个目录。

用法：
    py deploy_classes.py                # 编译默认的改动文件
    py deploy_classes.py 文件1 文件2 ...
"""
import os
import subprocess
import sys

JDK = r'C:\Program Files\Eclipse Adoptium\jdk-8.0.502.7-hotspot\bin'
JAVAC = os.path.join(JDK, 'javac.exe')

SRV = r'D:\MXDtestServer'
CORES = os.path.join(SRV, 'cores')
OUT = os.path.join(SRV, r'out\production\SERVER083')

FILES = [
    r'src\server\GmActions.java',
    r'src\net\server\channel\handlers\FaceExpressionHandler.java',
    r'src\net\server\channel\handlers\ItemPickupHandler.java',
]


def main(files):
    if not os.path.isdir(OUT):
        print('❌ 目标目录不存在:', OUT)
        return 1

    cp = OUT + os.pathsep + CORES + r'\*'
    args = [JAVAC, '-g', '-encoding', 'UTF-8', '-nowarn', '-d', OUT, '-cp', cp] + files

    print('javac -> %s' % OUT)
    for f in files:
        print('   ', f)

    p = subprocess.run(args, cwd=SRV, capture_output=True)
    out = p.stdout.decode('gbk', 'replace')
    err = p.stderr.decode('gbk', 'replace')

    if out.strip():
        print('---- stdout ----')
        print(out.strip())
    if err.strip():
        print('---- stderr ----')
        print(err.strip())

    bad = [l for l in (out + err).splitlines() if 'error:' in l or '错误:' in l]
    if p.returncode == 0 and not bad:
        print('\n✅ 已编译进运行目录，重启服务端后生效')
        return 0

    print('\n❌ 编译失败 (exit=%d)' % p.returncode)
    return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:] or FILES))
