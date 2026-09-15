#!/usr/bin/env python3
"""Keep index.html's ?v= cache-busting query strings in sync with file content.

Every local <script src="X.js?v=..."> and <link href="X.css?v=..."> in
index.html gets its ?v= replaced by the first 10 hex chars of the SHA-256
hash of X's current bytes. CDN URLs (http/https) are left untouched.

Usage:
  python scripts/bump_versions.py          # rewrite index.html in place
  python scripts/bump_versions.py --check  # exit 1 if index.html is stale (CI)
"""
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX_HTML = ROOT / "index.html"

# Matches src="foo.js?v=..." or href="foo.css?v=..." for local (non-http) files.
ASSET_RE = re.compile(
    r'((?:src|href)=")((?!https?://)[\w.\-\/]+\.(?:js|css))\?v=[\w.\-]*(")'
)


def content_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


def main() -> int:
    check_only = "--check" in sys.argv
    html = INDEX_HTML.read_text(encoding="utf-8")

    missing: list[str] = []
    changes: list[tuple[str, str, str]] = []

    def replace(match: re.Match) -> str:
        prefix, rel_path, suffix = match.group(1), match.group(2), match.group(3)
        asset_path = ROOT / rel_path
        if not asset_path.exists():
            missing.append(rel_path)
            return match.group(0)
        new_hash = content_hash(asset_path)
        old_full = match.group(0)
        new_full = f"{prefix}{rel_path}?v={new_hash}{suffix}"
        if old_full != new_full:
            changes.append((rel_path, old_full, new_full))
        return new_full

    new_html = ASSET_RE.sub(replace, html)

    if missing:
        print("ERROR: referenced files not found on disk:")
        for m in missing:
            print(f"  - {m}")
        return 2

    if not changes:
        print("All asset versions already match file content. Nothing to do.")
        return 0

    print(f"{len(changes)} asset version(s) out of date:")
    for rel_path, old_full, new_full in changes:
        print(f"  {rel_path}: {old_full} -> {new_full}")

    if check_only:
        print("\n--check: run `python scripts/bump_versions.py` to fix, then commit index.html.")
        return 1

    INDEX_HTML.write_text(new_html, encoding="utf-8")
    print("\nindex.html updated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
