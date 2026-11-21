import subprocess, sys

def audit(path):
    cmd = [sys.executable, r"C:\Users\radit\.gemini\config\skills\logo-design\scripts\svg_audit.py", path]
    p = subprocess.run(cmd, capture_output=True, text=True)
    print(p.stdout)

if __name__ == "__main__":
    audit(sys.argv[1])
