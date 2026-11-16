"""Windows-only, verified Job Object limits on a new disposable Chrome tree.

The memory limit is aggregate committed process memory, not physical machine RAM.
CPU affinity limits available logical processors; it does not emulate a CPU model.
"""
import ctypes as c
import argparse
from ctypes import wintypes as w
import json
import os
from pathlib import Path
import socket
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.tools/browserstack'
OUT = RUNTIME / 'results'
PROFILE_MODULE = 'lms'
K = c.WinDLL('kernel32', use_last_error=True)
SIZE = c.c_size_t
HANDLE = w.HANDLE


class Basic(c.Structure):
    _fields_ = [('process_time', c.c_int64), ('job_time', c.c_int64), ('flags', w.DWORD),
                ('min_working', SIZE), ('max_working', SIZE), ('active', w.DWORD),
                ('affinity', SIZE), ('priority', w.DWORD), ('scheduling', w.DWORD)]


class IO(c.Structure):
    _fields_ = [(name, c.c_uint64) for name in ('read_ops', 'write_ops', 'other_ops', 'read_bytes', 'write_bytes', 'other_bytes')]


class Limits(c.Structure):
    _fields_ = [('basic', Basic), ('io', IO), ('process_memory', SIZE), ('job_memory', SIZE),
                ('peak_process_memory', SIZE), ('peak_job_memory', SIZE)]


class Startup(c.Structure):
    _fields_ = [('cb', w.DWORD), ('reserved', w.LPWSTR), ('desktop', w.LPWSTR), ('title', w.LPWSTR),
                ('x', w.DWORD), ('y', w.DWORD), ('width', w.DWORD), ('height', w.DWORD),
                ('xchars', w.DWORD), ('ychars', w.DWORD), ('fill', w.DWORD), ('flags', w.DWORD),
                ('show', w.WORD), ('reserved_size', w.WORD), ('reserved2', c.POINTER(c.c_byte)),
                ('stdin', HANDLE), ('stdout', HANDLE), ('stderr', HANDLE)]


class Process(c.Structure):
    _fields_ = [('process', HANDLE), ('thread', HANDLE), ('pid', w.DWORD), ('tid', w.DWORD)]


for name, args, result in [
    ('CreateJobObjectW', [c.c_void_p, w.LPCWSTR], HANDLE),
    ('GetCurrentProcess', [], HANDLE),
    ('GetProcessAffinityMask', [HANDLE, c.POINTER(SIZE), c.POINTER(SIZE)], w.BOOL),
    ('SetInformationJobObject', [HANDLE, c.c_int, c.c_void_p, w.DWORD], w.BOOL),
    ('QueryInformationJobObject', [HANDLE, c.c_int, c.c_void_p, w.DWORD, c.c_void_p], w.BOOL),
    ('AssignProcessToJobObject', [HANDLE, HANDLE], w.BOOL),
    ('CreateProcessW', [w.LPCWSTR, w.LPWSTR, c.c_void_p, c.c_void_p, w.BOOL, w.DWORD, c.c_void_p, w.LPCWSTR, c.POINTER(Startup), c.POINTER(Process)], w.BOOL),
    ('ResumeThread', [HANDLE], w.DWORD),
    ('TerminateProcess', [HANDLE, w.UINT], w.BOOL),
    ('CloseHandle', [HANDLE], w.BOOL),
]:
    fn = getattr(K, name)
    fn.argtypes = args
    fn.restype = result


def check(ok):
    if not ok:
        raise c.WinError(c.get_last_error())


def run(cores, mib):
    record = {'logical_cpu_limit': cores, 'committed_memory_limit_mib': mib, 'status': 'blocked'}
    job = None
    proc = Process()
    try:
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]  # Separate unused port for each owned browser.
        available, system = SIZE(), SIZE()
        check(K.GetProcessAffinityMask(K.GetCurrentProcess(), c.byref(available), c.byref(system)))
        bits = [1 << n for n in range(c.sizeof(SIZE)*8) if available.value & (1 << n)]
        if len(bits) < cores:
            raise RuntimeError('Host has insufficient available logical processors')
        job = K.CreateJobObjectW(None, None)
        check(job)
        limits = Limits()
        limits.basic.flags = 0x10 | 0x200 | 0x2000  # affinity, aggregate memory, kill on close
        limits.basic.affinity = sum(bits[:cores])
        limits.job_memory = mib * 1024 * 1024
        check(K.SetInformationJobObject(job, 9, c.byref(limits), c.sizeof(limits)))
        profile = RUNTIME / f'chrome-resource-{cores}-{mib}-{time.time_ns()}'
        command = subprocess.list2cmdline([
            'C:/Program Files/Google/Chrome/Application/chrome.exe', '--headless=new',
            '--remote-debugging-address=127.0.0.1', f'--remote-debugging-port={port}',
            f'--user-data-dir={profile}', '--no-first-run', '--no-default-browser-check',
            '--disable-background-networking', 'about:blank'])
        startup = Startup()
        startup.cb = c.sizeof(startup)
        check(K.CreateProcessW(None, c.create_unicode_buffer(command), None, None, False,
                               0x4 | 0x08000000, None, str(ROOT), c.byref(startup), c.byref(proc)))
        check(K.AssignProcessToJobObject(job, proc.process))
        actual = Limits()
        check(K.QueryInformationJobObject(job, 9, c.byref(actual), c.sizeof(actual), None))
        assert actual.job_memory == limits.job_memory and actual.basic.affinity == limits.basic.affinity
        assert actual.basic.flags & (0x10 | 0x200) == (0x10 | 0x200)
        record['verified_job_limits'] = {'affinity_mask': actual.basic.affinity, 'committed_memory_bytes': actual.job_memory}
        if K.ResumeThread(proc.thread) == 0xffffffff:
            raise c.WinError(c.get_last_error())
        process_mask, system_mask = SIZE(), SIZE()
        check(K.GetProcessAffinityMask(proc.process, c.byref(process_mask), c.byref(system_mask)))
        assert process_mask.value == limits.basic.affinity
        record['verified_process_affinity_mask'] = process_mask.value
        deadline = time.monotonic() + 25
        while True:
            try:
                with socket.create_connection(('127.0.0.1', port), timeout=0.5):
                    break
            except OSError:
                if time.monotonic() > deadline:
                    raise RuntimeError('Constrained Chrome did not start within 25 seconds')
                time.sleep(0.25)
        prefix = 'core-finance-' if PROFILE_MODULE == 'core-finance' else ''
        output = OUT / f'{prefix}resource-{cores}-{mib}.json'
        output.unlink(missing_ok=True)
        runner = 'resource-core-finance.cjs' if PROFILE_MODULE == 'core-finance' else 'resource-smoke.cjs'
        child = subprocess.run(['node', str(Path(__file__).with_name(runner)), str(output), str(port)],
                               cwd=ROOT, capture_output=True, text=True, timeout=150)
        if output.exists():
            record.update(json.loads(output.read_text()))
        else:
            raise RuntimeError(f'Smoke runner exited {child.returncode} without a result')
        check(K.QueryInformationJobObject(job, 9, c.byref(actual), c.sizeof(actual), None))
        record['peak_job_committed_memory_mib'] = round(actual.peak_job_memory / 1024**2, 2)
    except Exception as error:
        record['error'] = str(error)
    finally:
        if proc.process:
            K.TerminateProcess(proc.process, 0)
        if job:
            K.CloseHandle(job)  # Kills only this newly created process tree.
        for handle in (proc.thread, proc.process):
            if handle:
                K.CloseHandle(handle)
    return record


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--module', choices=['lms', 'core-finance'], default='lms')
    PROFILE_MODULE = parser.parse_args().module
    OUT.mkdir(parents=True, exist_ok=True)
    fixture_env = dict(os.environ, DB_CONNECTION='sqlite', DB_DATABASE=(ROOT/'.tools/k6/k6-lms.sqlite').as_posix(),
                       DB_URL='', APP_ENV='k6', APP_DEBUG='false', CACHE_STORE='file',
                       LARAVEL_STORAGE_PATH=(ROOT/'.tools/k6/storage').as_posix())
    if PROFILE_MODULE == 'lms':
        subprocess.run(['php', str(Path(__file__).with_name('seed-resource.php'))], env=fixture_env, cwd=ROOT, check=True)
    host_query = subprocess.run(['powershell', '-NoProfile', '-Command',
        "$cpu=Get-CimInstance Win32_Processor | Select-Object -First 1; "
        "$ram=(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory; "
        "@{cpu_model=$cpu.Name; logical_processors=$cpu.NumberOfLogicalProcessors; physical_ram_bytes=$ram} | ConvertTo-Json -Compress"],
        capture_output=True, text=True, timeout=20)
    host = json.loads(host_query.stdout) if host_query.returncode == 0 else {'metadata': 'Unavailable'}
    results = []
    for cores, memory in [(1, 512), (2, 1024), (4, 2048)]:
        result = run(cores, memory)
        results.append(result)
        print(f'{cores} logical CPU / {memory} MiB commit cap: {result["status"]}', flush=True)
        result_name = 'resources-core-finance.json' if PROFILE_MODULE == 'core-finance' else 'resources.json'
        (OUT / result_name).write_text(json.dumps({
            'scope': 'Local Windows Chrome process tree; verified CPU affinity and aggregate committed-memory caps. Not physical RAM or CPU-model emulation; backend unconstrained.',
            'host': host, 'tested_at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'results': results}, indent=2))
    raise SystemExit(1 if any(result['status'] != 'passed' for result in results) else 0)
