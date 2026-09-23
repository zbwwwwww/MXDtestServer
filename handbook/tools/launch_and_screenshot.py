import subprocess, os, sys, time, ctypes, zlib, struct
from ctypes import wintypes

C = r'D:\MXDtestServer\北冥GMS083\GMS083_北冥整合版\MapleStoryHD'
EXE = os.path.join(C, 'Maplestory.exe')
u = ctypes.windll.user32
g32 = ctypes.windll.gdi32
EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)


def find_win():
    res = []

    def cb(hwnd, lparam):
        cls = ctypes.create_unicode_buffer(256)
        u.GetClassNameW(hwnd, cls, 256)
        if cls.value == 'MapleStoryClass':
            r = wintypes.RECT(); u.GetWindowRect(hwnd, ctypes.byref(r))
            p = wintypes.DWORD(); u.GetWindowThreadProcessId(hwnd, ctypes.byref(p))
            res.append((hwnd, r.left, r.top, r.right, r.bottom, bool(u.IsWindowVisible(hwnd)), p.value))
        return True

    u.EnumWindows(EnumWindowsProc(cb), 0)
    return res


def capture(x0, y0, x1, y1, path):
    W, H = x1 - x0, y1 - y0
    hdc = u.GetDC(0)
    mdc = g32.CreateCompatibleDC(hdc)
    bmp = g32.CreateCompatibleBitmap(hdc, W, H)
    g32.SelectObject(mdc, bmp)
    g32.BitBlt(mdc, 0, 0, W, H, hdc, x0, y0, 0x00CC0020)

    class BIH(ctypes.Structure):
        _fields_ = [('biSize', wintypes.DWORD), ('biWidth', wintypes.LONG),
                    ('biHeight', wintypes.LONG), ('biPlanes', wintypes.WORD),
                    ('biBitCount', wintypes.WORD), ('biCompression', wintypes.DWORD),
                    ('biSizeImage', wintypes.DWORD), ('biXPelsPerMeter', wintypes.LONG),
                    ('biYPelsPerMeter', wintypes.LONG), ('biClrUsed', wintypes.DWORD),
                    ('biClrImportant', wintypes.DWORD)]

    bi = BIH()
    bi.biSize = ctypes.sizeof(BIH); bi.biWidth = W; bi.biHeight = -H
    bi.biPlanes = 1; bi.biBitCount = 32; bi.biCompression = 0; bi.biSizeImage = W * H * 4
    buf = ctypes.create_string_buffer(W * H * 4)
    g32.GetDIBits(mdc, bmp, 0, H, buf, ctypes.byref(bi), 0)
    raw = buf.raw

    # 统计非黑像素比例，判断有没有画面
    nz = 0
    for y in range(0, H, 4):
        for xx in range(0, W, 4):
            o = (y * W + xx) * 4
            if raw[o] or raw[o + 1] or raw[o + 2]:
                nz += 1
    total = ((H + 3) // 4) * ((W + 3) // 4)

    scan = bytearray()
    for y in range(H):
        line = raw[y * W * 4:(y + 1) * W * 4]
        rgb = bytearray()
        for xx in range(W):
            rgb += bytes((line[xx * 4 + 2], line[xx * 4 + 1], line[xx * 4]))
        scan.append(0); scan += rgb

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0)) \
        + chunk(b'IDAT', zlib.compress(bytes(scan), 6)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)

    g32.DeleteObject(bmp); g32.DeleteDC(mdc); u.ReleaseDC(0, hdc)
    return len(png), nz / max(total, 1)


print('=' * 78)
print('长时观察：Win7 兼容模式启动，分段截图')
print('=' * 78)
env = dict(os.environ); env['__COMPAT_LAYER'] = 'RunAsInvoker WIN7RTM'
t0 = time.time()
pr = subprocess.Popen([EXE, '127.0.0.1', '8484'], cwd=C, env=env,
                      creationflags=0x00000008 | 0x00000200, close_fds=True)
print('   pid =', pr.pid)

shots = [8, 22, 38, 54, 68]
done = set()
while time.time() - t0 < 72:
    time.sleep(1)
    el = time.time() - t0
    if pr.poll() is not None:
        print('   +%4.0fs ★ 进程退出，退出码 0x%08X' % (el, pr.poll() & 0xFFFFFFFF))
        break
    for s in shots:
        if s not in done and el >= s:
            done.add(s)
            ws = [w for w in find_win() if w[5]]
            o = subprocess.run('tasklist /FI "PID eq %d" /FO CSV /NH' % pr.pid,
                               capture_output=True, text=True, errors='replace', shell=True).stdout
            mem = o.strip().split('","')[4].rstrip('"') if o.count('","') >= 4 else '?'
            if ws:
                hwnd, x0, y0, x1, y1, vis, pid = ws[0]
                u.ShowWindow(hwnd, 9); u.SetForegroundWindow(hwnd)
                time.sleep(0.6)
                p = r'D:\tmp\shot_t%02d.png' % s
                size, ratio = capture(x0, y0, x1, y1, p)
                print('   +%4.0fs 窗口 %dx%d 内存=%s  截图=%d字节 非黑像素=%.1f%%' % (
                    el, x1 - x0, y1 - y0, mem, size, ratio * 100))
            else:
                print('   +%4.0fs 无可见窗口  内存=%s' % (el, mem))
    if pr.poll() is not None:
        break

if pr.poll() is None:
    print('   ✅ 72 秒结束，进程仍在运行')
else:
    print('   ❌ 进程已退出 0x%08X' % (pr.poll() & 0xFFFFFFFF))

o = subprocess.run('tasklist /FI "IMAGENAME eq Maplestory.exe" /FO CSV /NH',
                   capture_output=True, text=True, errors='replace', shell=True).stdout
print('   最终进程:', o.strip()[:120])
print('   服务端 session 末行:', open(r'D:\MXDtestServer\logs\2026-09-20\players\Sessions.txt',
                                    encoding='utf-8', errors='replace').read().splitlines()[-1])
o = subprocess.run('wevtutil qe Application /c:15 /rd:true /f:text', capture_output=True,
                   text=True, errors='replace', shell=True).stdout
print('   最新 15 条应用事件里的 Maplestory:', sum(1 for b in o.split('Event[')[1:] if 'aplestory' in b), '条')
