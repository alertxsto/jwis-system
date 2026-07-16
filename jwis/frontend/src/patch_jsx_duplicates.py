from pathlib import Path

# Fix AppShell.jsx
appshell_path = Path(r"D:\ai open presu lomba\jwis system\jwis\frontend\src\layout\AppShell.jsx")
if appshell_path.exists():
    txt = appshell_path.read_text(encoding="utf-8")
    old_str = 'className="side-system-state" className="mt-24"'
    new_str = 'className="side-system-state mt-24"'
    if old_str in txt:
        txt = txt.replace(old_str, new_str)
        appshell_path.write_text(txt, encoding="utf-8")
        print("Fixed AppShell.jsx")
    else:
        print("AppShell.jsx already clean or string not found")

# Fix main.jsx
main_path = Path(r"D:\ai open presu lomba\jwis system\jwis\frontend\src\main.jsx")
if main_path.exists():
    txt = main_path.read_text(encoding="utf-8")
    replacements = [
        ('className="table-wrap" className="mt-16"', 'className="table-wrap mt-16"'),
        ('className="approval-evidence-list" className="mt-16"', 'className="approval-evidence-list mt-16"'),
        ('className="bar" className="mt-10"', 'className="bar mt-10"'),
    ]
    changed = False
    for old, new in replacements:
        if old in txt:
            txt = txt.replace(old, new)
            changed = True
    if changed:
        main_path.write_text(txt, encoding="utf-8")
        print("Fixed main.jsx")
    else:
        print("main.jsx already clean")
