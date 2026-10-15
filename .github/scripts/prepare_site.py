"""Copy only public website artifacts into an otherwise empty upload directory."""
from pathlib import Path
import argparse
import shutil

ROOT_FILES = {
    "index.html", "platform-compare.html", "favicon.ico", "robots.txt", "sitemap.xml",
    "README.md", "LICENSE", "config.json", "model-comparison-presets.json",
    "platforms.json", "plans.json", "models.json", "plan-models.json",
}
PUBLIC_DIRS = {
    "styles", "scripts", "assets", "vendor", "articles", "platforms", "plans",
    "models", "pricing", "updates", "monitor",
}
STATIC_EXTENSIONS = {
    ".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
    ".ico", ".woff", ".woff2", ".ttf", ".otf", ".avif",
}


def public_artifact(relative):
    if any(part.startswith(".") for part in relative.parts):
        return False
    if len(relative.parts) == 1:
        return relative.name in ROOT_FILES or (
            relative.name.startswith("baidu_verify_codeva-") and relative.suffix == ".html"
        )
    if relative.parts[0] not in PUBLIC_DIRS:
        return False
    if relative.name.endswith((".test.js", ".test.cjs", ".local.js")):
        return False
    # The monitor's public runtime configuration is the only nested JSON currently served.
    return relative.suffix.lower() in STATIC_EXTENSIONS or relative.as_posix() == "monitor/monitor-config.json"


def prepare(source, destination):
    source, destination = source.resolve(), destination.resolve()
    if destination == source or destination.is_relative_to(source) or source.is_relative_to(destination):
        raise ValueError("upload directory must be separate from the source checkout")
    destination.mkdir(parents=True, exist_ok=True)
    if any(destination.iterdir()):
        raise ValueError("upload directory must be empty")
    missing = [name for name in ROOT_FILES if not (source / name).is_file()]
    if missing:
        raise ValueError(f"missing public artifacts: {sorted(missing)}")
    count = 0
    for path in sorted(source.rglob("*")):
        relative = path.relative_to(source)
        if not public_artifact(relative):
            continue
        if path.is_symlink():
            raise ValueError(f"symbolic links cannot be published: {relative}")
        if path.is_file():
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
            count += 1
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    print(f"Prepared {prepare(args.source, args.destination)} public files")
