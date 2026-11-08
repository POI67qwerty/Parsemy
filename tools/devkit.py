#!/usr/bin/env python3
"""Small, dependency-free helpers for auditing and validating City Grid Studio."""
from __future__ import annotations
import argparse
import collections
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SKIP = {"node_modules", ".git", ".cache", "dist", "build", "coverage"}
SCRIPT_SUFFIXES = {".js", ".py", ".sh"}
QUICK_TESTS = [
    "tests/render-optimization-pixels.js",
    "tests/selection-cache.js",
    "tests/fisheye-geometry-cache.js",
    "tests/fisheye-bvh-pixels.js",
    "tests/recessed-floor-independence.js",
    "tests/outliner-cache-pixels.js",
    "tests/clipboard-line-opacity.js",
    "tests/ped-signal-lower-support.js",
]
PIXEL_TESTS = ["tests/architecture-pixels.js", "tests/corner-facade-pixels.js"]


def script_files():
    return sorted(p for p in ROOT.rglob("*") if p.is_file() and p.suffix in SCRIPT_SUFFIXES
                  and not any(part in SKIP for part in p.relative_to(ROOT).parts))


def inventory(_args):
    files = script_files()
    buckets = collections.defaultdict(list)
    for p in files:
        buckets[p.suffix].append(p)
    print(f"Root: {ROOT}")
    print(f"Scripts: {len(files)} total")
    for ext, paths in sorted(buckets.items()):
        loc = sum(len(p.read_text(errors="replace").splitlines()) for p in paths)
        print(f"  {ext}: {len(paths)} files, {loc:,} lines")
    print("\nProduction scripts:")
    for p in sorted(ROOT.glob("*.js")):
        print(f"  {p.name:32} {len(p.read_text(errors='replace').splitlines()):5} lines")


def duplicates(args):
    files = sorted(ROOT.glob("*.js"))
    funcs = collections.defaultdict(list)
    blocks = collections.defaultdict(list)
    for p in files:
        lines = p.read_text(errors="replace").splitlines()
        text = "\n".join(lines)
        for m in re.finditer(r"(?m)^\s*(?:async\s+)?function\s+([\w$]+)\s*\(", text):
            funcs[m.group(1)].append((p.name, text[:m.start()].count("\n") + 1))
        n = args.block_lines
        for i in range(max(0, len(lines) - n + 1)):
            raw = lines[i:i+n]
            if sum(bool(s.strip()) for s in raw) < n - 2:
                continue
            key = "\n".join(re.sub(r"\s+", " ", s.strip()) for s in raw)
            blocks[key].append((p.name, i+1))
    print("Repeated function names (review scope/meaning before refactoring):")
    found = False
    for name, places in sorted(funcs.items()):
        if len(places) > 1:
            found = True
            print(f"  {name}: " + ", ".join(f"{f}:{line}" for f, line in places))
    if not found:
        print("  none")
    print(f"\nExact normalized blocks ({args.block_lines} lines) shared across files:")
    found = False
    for places in blocks.values():
        distinct = sorted(set(places))
        if len({f for f, _ in distinct}) > 1:
            found = True
            print("  " + ", ".join(f"{f}:{line}" for f, line in distinct))
    if not found:
        print("  none")
    print("\nThese are leads, not automatic proof of a defect or safe deduplication.")


def find_tests(args):
    terms = [x.lower() for x in args.terms]
    tests = sorted((ROOT / "tests").glob("*.js"))
    matches = []
    for p in tests:
        name = p.name.lower()
        text = p.read_text(errors="replace").lower()
        hits = [term for term in terms if term in name or term in text]
        if hits:
            matches.append((p, hits))
    if not matches:
        print("No matching tests found.")
        return 1
    for p, hits in matches:
        print(f"{p.relative_to(ROOT)}\t[{', '.join(dict.fromkeys(hits))}]")
    print(f"\n{len(matches)} test file(s)")
    return 0


def run_paths(paths):
    failures = []
    for item in paths:
        p = (ROOT / item).resolve()
        if not p.is_file() or ROOT not in p.parents:
            print(f"SKIP/ERROR: invalid or missing path: {item}", file=sys.stderr)
            failures.append(item)
            continue
        print(f"\n=== {p.relative_to(ROOT)} ===", flush=True)
        result = subprocess.run(["bash", "tests/run.sh", str(p.relative_to(ROOT))], cwd=ROOT)
        if result.returncode:
            failures.append(item)
    print(f"\nSummary: {len(paths)-len(failures)}/{len(paths)} passed")
    if failures:
        print("Failed: " + ", ".join(failures))
        return 1
    return 0


def run(args):
    return run_paths(args.tests)


def quick(args):
    tests = QUICK_TESTS + (PIXEL_TESTS if args.pixels else [])
    if args.build:
        result = subprocess.run(["bash", "build.sh"], cwd=ROOT)
        if result.returncode:
            return result.returncode
    return run_paths(tests)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("inventory", help="count scripts and production LOC")
    p.set_defaults(func=inventory)
    p = sub.add_parser("duplicates", help="find repeated function names/code blocks")
    p.add_argument("--block-lines", type=int, default=8)
    p.set_defaults(func=duplicates)
    p = sub.add_parser("find-tests", help="search test names and contents by keyword")
    p.add_argument("terms", nargs="+", help="one or more search terms")
    p.set_defaults(func=find_tests)
    p = sub.add_parser("run", help="run explicit tests in sequence and summarize failures")
    p.add_argument("tests", nargs="+", help="paths relative to project root")
    p.set_defaults(func=run)
    p = sub.add_parser("quick", help="build and run focused rendering/geometry/cache regressions")
    p.add_argument("--build", action="store_true", help="run build.sh first")
    p.add_argument("--pixels", action="store_true", help="also include pixel baselines")
    p.set_defaults(func=quick)
    args = parser.parse_args()
    try:
        result = args.func(args)
        return result if isinstance(result, int) else 0
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
