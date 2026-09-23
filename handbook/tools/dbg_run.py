import ctypes, struct, os, time
from ctypes import wintypes

k = ctypes.WinDLL('kernel32', use_last_error=True)
import sys
C = sys.argv[2] if len(sys.argv) > 2 else r'D:\MXDtestServer\北冥GMS083\GMS083_北冥整合版\MapleStoryHD'
EXE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(C, 'Maplestory.exe')

DEBUG_ONLY_THIS_PROCESS = 0x00000002
DBG_CONTINUE = 0x00010002

EV_CREATE_PROCESS = 3
EV_EXIT_PROCESS = 5
EV_LOAD_DLL = 6
EV_UNLOAD_DLL = 7
EV_EXCEPTION = 1
EV_CREATE_THREAD = 2
EV_EXIT_THREAD = 4
EV_OUTPUT_DEBUG_STRING = 8
EV_RIP = 9

NAMES = {1: 'EXCEPTION', 2: 'CREATE_THREAD', 3: 'CREATE_PROCESS', 4: 'EXIT_THREAD',
         5: 'EXIT_PROCESS', 6: 'LOAD_DLL', 7: 'UNLOAD_DLL', 8: 'OUTPUT_DEBUG_STRING', 9: 'RIP'}

EXCNAME = {
    0x80000003: 'STATUS_BREAKPOINT (int3, 正常)',
    0x4000001F: 'STATUS_WX86_BREAKPOINT (WOW64 断点, 正常)',
    0xC0000602: '★ STATUS_FAIL_FAST_EXCEPTION —— 主动自杀',
    0xC0000005: 'STATUS_ACCESS_VIOLATION 访问违例',
    0xC000001D: 'STATUS_ILLEGAL_INSTRUCTION',
    0xC0000094: 'STATUS_INTEGER_DIVIDE_BY_ZERO',
    0xC00000FD: 'STATUS_STACK_OVERFLOW',
    0xC0000135: 'STATUS_DLL_NOT_FOUND',
    0xC0000139: 'STATUS_ENTRYPOINT_NOT_FOUND',
    0xE06D7363: 'C++ 异常',
    0xC0000409: 'STATUS_STACK_BUFFER_OVERRUN (__fastfail)',
}


class STARTUPINFOW(ctypes.Structure):
    _fields_ = [('cb', wintypes.DWORD), ('lpReserved', wintypes.LPWSTR),
                ('lpDesktop', wintypes.LPWSTR), ('lpTitle', wintypes.LPWSTR),
                ('dwX', wintypes.DWORD), ('dwY', wintypes.DWORD),
                ('dwXSize', wintypes.DWORD), ('dwYSize', wintypes.DWORD),
                ('dwXCountChars', wintypes.DWORD), ('dwYCountChars', wintypes.DWORD),
                ('dwFillAttribute', wintypes.DWORD), ('dwFlags', wintypes.DWORD),
                ('wShowWindow', wintypes.WORD), ('cbReserved2', wintypes.WORD),
                ('lpReserved2', ctypes.c_void_p), ('hStdInput', wintypes.HANDLE),
                ('hStdOutput', wintypes.HANDLE), ('hStdError', wintypes.HANDLE)]


class PROCESS_INFORMATION(ctypes.Structure):
    _fields_ = [('hProcess', wintypes.HANDLE), ('hThread', wintypes.HANDLE),
                ('dwProcessId', wintypes.DWORD), ('dwThreadId', wintypes.DWORD)]


def dll_name(hfile):
    if not hfile:
        return '?'
    b = ctypes.create_unicode_buffer(1024)
    n = k.GetFinalPathNameByHandleW(hfile, b, 1024, 0)
    return b.value.replace('\\\\?\\', '') if n else '?'


si = STARTUPINFOW()
si.cb = ctypes.sizeof(si)
pi = PROCESS_INFORMATION()
cmd = ctypes.create_unicode_buffer('"%s" 127.0.0.1 8484' % EXE)
os.environ['__COMPAT_LAYER'] = 'RunAsInvoker'

print('=' * 78)
print('迷你调试器 v2：全部放行，直到进程退出，记录每个异常')
print('=' * 78)
ok = k.CreateProcessW(EXE, cmd, None, None, False, DEBUG_ONLY_THIS_PROCESS,
                      None, C, ctypes.byref(si), ctypes.byref(pi))
if not ok:
    print('   CreateProcess 失败 err =', ctypes.get_last_error())
    raise SystemExit(1)
PID = pi.dwProcessId
print('   已启动 pid =', PID)

buf = ctypes.create_string_buffer(1024)
mods = []
excs = []
exit_code = None
t0 = time.time()
events = 0
deadline = t0 + (int(sys.argv[3]) if len(sys.argv) > 3 else 90)
quiet = 0

while time.time() < deadline:
    if not k.WaitForDebugEvent(ctypes.byref(buf), 15000):
        print('   (15 秒无调试事件，退出等待)')
        break
    events += 1
    code, dpid, dtid = struct.unpack_from('<III', buf, 0)
    off = 16
    quiet += 1

    if code == EV_CREATE_PROCESS:
        hFile = struct.unpack_from('<Q', buf, off)[0]
        lpBase = struct.unpack_from('<Q', buf, off + 24)[0]
        nm = dll_name(hFile)
        mods.append((lpBase, nm))
        print('   [CREATE_PROCESS] base=0x%08X  %s' % (lpBase, nm))

    elif code == EV_LOAD_DLL:
        hFile = struct.unpack_from('<Q', buf, off)[0]
        lpBase = struct.unpack_from('<Q', buf, off + 8)[0]
        nm = dll_name(hFile)
        mods.append((lpBase, nm))
        print('   [LOAD_DLL]       base=0x%08X  %s' % (lpBase, nm))

    elif code == EV_UNLOAD_DLL:
        lpBase = struct.unpack_from('<Q', buf, off)[0]
        gone = [m for m in mods if m[0] == lpBase]
        mods = [m for m in mods if m[0] != lpBase]
        if gone:
            print('   [UNLOAD_DLL]     %s' % gone[0][1])

    elif code == EV_EXCEPTION:
        exc_code, exc_flags = struct.unpack_from('<II', buf, off)
        exc_addr = struct.unpack_from('<Q', buf, off + 16)[0]
        nparams = struct.unpack_from('<I', buf, off + 24)[0]
        params = struct.unpack_from('<15Q', buf, off + 32)
        hit = None
        for b, n in sorted(mods):
            if b and b <= exc_addr:
                hit = (b, n)
        excs.append((exc_code, exc_addr, hit, exc_flags, tuple(params[:max(nparams, 0)])))
        print()
        print('   [异常 #%d] +%.2fs  code=0x%08X  flags=0x%08X  addr=0x%08X' % (
            len(excs), time.time() - t0, exc_code, exc_flags, exc_addr & 0xFFFFFFFF))
        print('       %s' % EXCNAME.get(exc_code, '(未知异常码)'))
        print('       参数: %s' % ['0x%X' % p for p in params[:max(nparams, 0)]])
        if hit:
            print('       落在: %s  +0x%X' % (hit[1], exc_addr - hit[0]))

    elif code == EV_EXIT_PROCESS:
        exit_code = struct.unpack_from('<I', buf, off)[0]
        print()
        print('   [EXIT_PROCESS] 退出码 = %d (0x%08X)' % (exit_code, exit_code))
        k.ContinueDebugEvent(dpid, dtid, DBG_CONTINUE)
        break

    elif code == EV_OUTPUT_DEBUG_STRING:
        print('   [OUTPUT_DEBUG_STRING]')

    else:
        quiet -= 1

    k.ContinueDebugEvent(dpid, dtid, DBG_CONTINUE)

print()
print('=' * 78)
print('汇总')
print('=' * 78)
print('   调试事件数 = %d   总用时 %.1f 秒' % (events, time.time() - t0))
print('   退出码 = %s' % (('0x%08X (%d)' % (exit_code, exit_code)) if exit_code is not None else '未退出/超时'))
print()
print('   异常序列（共 %d 条）:' % len(excs))
for i, (c, a, h, fl, pp) in enumerate(excs, 1):
    print('      #%d  0x%08X  addr=0x%08X  %s  %s' % (
        i, c, a & 0xFFFFFFFF, EXCNAME.get(c, ''), ('%s +0x%X' % (h[1], a - h[0])) if h else ''))
fatal = [e for e in excs if e[0] not in (0x80000003, 0x4000001F)]
print()
if fatal:
    c, a, h, fl, pp = fatal[-1]
    print('   ★ 终止性异常 = 0x%08X  (%s)' % (c, EXCNAME.get(c, '')))
    print('   ★ 异常地址   = 0x%08X' % (a & 0xFFFFFFFF))
    print('   ★ 参数       = %s' % ['0x%X' % p for p in pp])
    if h:
        print('   ★ 出错模块   = %s  模块内偏移 +0x%X' % (h[1], a - h[0]))
else:
    print('   无终止性异常')

print()
print('   崩溃时已加载模块 %d 个:' % len(mods))
for b, n in mods:
    print('      base=0x%08X  %s' % (b & 0xFFFFFFFF, n))

try:
    k.CloseHandle(pi.hProcess); k.CloseHandle(pi.hThread)
except Exception:
    pass
