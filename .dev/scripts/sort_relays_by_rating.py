#!/usr/bin/env python3
"""将 codingplan/relays.json 中的平台条目按 matrix.rating.stars（综合评价）降序排序。"""

import argparse
import json
from pathlib import Path

DEFAULT_RELAYS_PATH = str(Path(__file__).resolve().parents[2] / "relays.json")


def _rating_stars(entry):
    try:
        return int(entry["matrix"]["rating"]["stars"])
    except (KeyError, TypeError, ValueError):
        return None


def sort_relays_entries(data):
    """返回按综合评价降序的新列表；同分保持输入中的相对顺序（不修改原列表）。"""

    def sort_key(indexed):
        idx, entry = indexed
        stars = _rating_stars(entry)
        primary = -stars if stars is not None else 999
        return (primary, idx)

    return [entry for _, entry in sorted(enumerate(data), key=sort_key)]


def main():
    parser = argparse.ArgumentParser(description="按 matrix.rating.stars 降序排序 relays.json 顶层数组")
    parser.add_argument(
        "path",
        nargs="?",
        default=DEFAULT_RELAYS_PATH,
        help=f"relays.json 路径（默认：{DEFAULT_RELAYS_PATH}）",
    )
    parser.add_argument(
        "--output",
        "-o",
        metavar="PATH",
        help="写入路径（默认与读取的 path 相同）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只打印排序后的 id / stars，不写文件",
    )
    args = parser.parse_args()

    path = Path(args.path)
    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw)
    if not isinstance(data, list):
        raise SystemExit("relays.json 根节点应为数组")

    sorted_data = sort_relays_entries(data)
    for entry in sorted_data:
        sid = entry.get("id", "?")
        stars = _rating_stars(entry)
        stars_s = str(stars) if stars is not None else "（缺）"
        print(f"{stars_s}\t{sid}")

    if not args.dry_run:
        out_path = Path(args.output) if args.output else path
        out_path.write_text(json.dumps(sorted_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\n已写入：{out_path}")


if __name__ == "__main__":
    main()
