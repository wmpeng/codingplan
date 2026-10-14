"""Stage tracked public files and remove only explicitly retired COS objects."""
import argparse
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / ".github/retired-public-files.json"


def public_key(key):
    if not isinstance(key, str) or not key or key.startswith(("/", "-")) or "\\" in key:
        raise ValueError(f"Invalid public file: {key!r}")
    parts = key.split("/")
    if any(not part or part.startswith(".") or any(c in part for c in "*?[]\r\n\0") for part in parts):
        raise ValueError(f"Invalid public file: {key!r}")
    if parts[0] == "dev" or PurePosixPath(key).as_posix() != key:
        raise ValueError(f"Invalid public file: {key!r}")
    return key


def retired_keys(root=ROOT, manifest=MANIFEST):
    keys = json.loads(manifest.read_text(encoding="utf-8"))
    if not isinstance(keys, list) or not keys:
        raise ValueError("Retired files must be a nonempty list")
    # Validate every key before any cloud mutation. Reintroduced files stay live.
    keys = [public_key(key) for key in keys]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate retired file")
    return [key for key in keys if not (root / key).exists()]


def stage_public(destination, root=ROOT):
    destination = destination.resolve()
    if destination == root or destination.is_relative_to(root):
        raise ValueError("Stage directory must be outside the repository")
    destination.mkdir(parents=True, exist_ok=False)
    paths = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode("utf-8").split("\0")
    count = 0
    for key in paths:
        if not key or any(part.startswith(".") for part in key.split("/")) or key.startswith("dev/"):
            continue
        public_key(key)
        source = root / key
        if source.is_symlink() or not source.is_file():
            raise ValueError(f"Not a regular public file: {key}")
        target = destination / key
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        count += 1
    return count


def cleanup(keys):
    for key in keys:
        print(f"Retire {key}", flush=True)
        # No recursive delete and no bucket-wide upload --delete.
        subprocess.run(["coscmd", "delete", "-f", key], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="Validate and print the cleanup plan without cloud access")
    mode.add_argument("--stage", type=Path, help="Copy tracked public files to a new directory")
    mode.add_argument("--apply", action="store_true", help="Delete the validated, retired objects from configured COS")
    args = parser.parse_args()
    keys = retired_keys()
    if args.stage:
        print(f"Staged {stage_public(args.stage)} public files")
    elif args.apply:
        cleanup(keys)
    else:
        print("\n".join(keys))
    print(f"Retired public objects: {len(keys)}")


if __name__ == "__main__":
    main()
