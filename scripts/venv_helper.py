#!/usr/bin/env python3
"""
Cross-platform virtual environment helper.

Provides two modes of use:
  1. Path finding — get the venv Python path for subprocess calls
  2. Activation — re-exec the current script under the venv Python

Usage (path finding):
    from venv_helper import find_venv_python
    venv_py = find_venv_python()  # Returns path or None

Usage (activation):
    from venv_helper import ensure_venv
    ensure_venv()  # Re-execs if not in venv; no-op if already active
    # Everything below runs under the venv Python

CLI:
    python scripts/venv_helper.py --print-path   # Prints venv Python path to stdout
"""

import os
import sys
import subprocess


def find_project_root():
    """Walk up from this script's directory to find the project root (contains pyproject.toml or package.json)."""
    current = os.path.dirname(os.path.abspath(__file__))
    while True:
        if (os.path.isfile(os.path.join(current, "pyproject.toml")) or
            os.path.isfile(os.path.join(current, "package.json")) or
            os.path.isfile(os.path.join(current, "requirements.txt"))):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            break
        current = parent
    # Fallback: assume scripts/ is one level below root
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def find_venv_python(project_root=None):
    """
    Find the venv Python executable, cross-platform.

    Checks venv/ and .venv/ directories in the project root.
    Returns the absolute path to the Python binary, or None if not found.
    """
    if project_root is None:
        project_root = find_project_root()
    candidates = [
        os.path.join(project_root, "venv", "Scripts", "python.exe"),  # Windows
        os.path.join(project_root, "venv", "bin", "python"),          # Linux/macOS
        os.path.join(project_root, ".venv", "Scripts", "python.exe"), # Windows alt
        os.path.join(project_root, ".venv", "bin", "python"),         # Linux/macOS alt
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


def ensure_venv():
    """
    Ensure the current process is running under the project's venv Python.

    If already running inside the project venv, returns immediately.
    Otherwise, re-launches the current script using the venv Python and exits
    with that process's return code.

    Call this at the top of any script before importing venv-installed packages.
    """
    project_root = find_project_root()
    venv_python = find_venv_python(project_root)

    if venv_python is None:
        # No venv found - just use system Python (graceful degradation)
        return

    venv_python_resolved = os.path.realpath(venv_python)
    current_resolved = os.path.realpath(sys.executable)

    if current_resolved == venv_python_resolved:
        return  # Already running under the project venv

    # Re-exec under the venv Python
    result = subprocess.run([venv_python] + sys.argv)
    sys.exit(result.returncode)


if __name__ == "__main__":
    if "--print-path" in sys.argv:
        path = find_venv_python()
        if path is None:
            print("ERROR: No venv found", file=sys.stderr)
            sys.exit(1)
        print(path)
    else:
        print("Usage: python venv_helper.py --print-path")
        sys.exit(1)
