import subprocess
import sys
import time
import os

python_exe = r"C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe"
cwd = r"D:\ai open presu lomba\jwis system\jwis\backend"

# Kill anything listening on 8001
try:
    import psutil
    current_pid = os.getpid()
    for conn in psutil.net_connections():
        if conn.laddr.port == 8001:
            pid = conn.pid
            if pid and pid != current_pid:
                psutil.Process(pid).kill()
                print(f"Killed existing process on 8001 (PID {pid})")
except Exception as e:
    print(f"Error checking connections: {e}")

time.sleep(1)

# Spawn uvicorn directly, detached, no shell=True
p = subprocess.Popen(
    [python_exe, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"],
    cwd=cwd,
    stdout=open(os.path.join(cwd, "boot_error.log"), "w"),
    stderr=subprocess.STDOUT,
    creationflags=0x00000008  # DETACHED_PROCESS
)

print(f"Spawned server directly. PID: {p.pid}")
