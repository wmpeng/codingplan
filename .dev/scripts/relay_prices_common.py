#!/usr/bin/env python3

import argparse
import json
import ssl
import urllib.request
from collections import OrderedDict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path


HEADERS = {"User-Agent": "Mozilla/5.0"}
SSL_CONTEXT = ssl._create_unverified_context()
TODAY = date.today().strftime("%Y.%m.%d")
TARGET_ORDER = [
    "Opus-4.6",
    "Sonnet-4.6",
    "GPT-5.4",
    "GPT-5.3-Codex",
    "Gemini-3.1-Pro",
    "Gemini-3-Flash",
    "GLM-5.1",
    "GLM-5",
    "MiniMax-M2.7",
    "MiniMax-M2.5",
    "Kimi-K2.5",
    "DeepSeek-V3.2",
    "Qwen-3.6-Plus",
    "Qwen-3.5",
    "Doubao-Seed-2.0-Code",
]
PLATFORM_ORDER = [
    "openrouter",
    "siliconflow",
    "poloapi",
    "ofox",
    "n1n",
    "dmxapi",
    "llmhub",
    "poe",
]
DEFAULT_RELAYS_PATH = str(Path(__file__).resolve().parents[2] / "relays.json")


def fetch_text(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30, context=SSL_CONTEXT) as resp:
        return resp.read().decode("utf-8", "ignore")


def fetch_json(url):
    return json.loads(fetch_text(url))


def q(value):
    return Decimal(str(value))


def q2(value):
    return q(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def fmt_money(value, currency):
    return f"{currency}{q2(value)}"


def rounded_note(raw_value, currency):
    raw = q(raw_value)
    rounded = q2(raw)
    if raw == rounded:
        return ""
    prefix = "$" if currency == "$" else "￥"
    return f"四舍五入，原始输入价 {prefix}{raw.normalize()}/M"


def join_notes(*parts):
    return "；".join([part for part in parts if part])


def normalize_candidates(candidates):
    if isinstance(candidates, str):
        return [candidates]
    return list(candidates)


def ordered_platform(models, notes_extra=None):
    ordered = []
    by_name = {item["name"]: item for item in models}
    for name in TARGET_ORDER:
        if name in by_name:
            ordered.append(by_name[name])
    return {
        "updatedAt": TODAY,
        "keyModels": ordered,
        "notesExtra": notes_extra or [],
    }


def build_token_pricing_platform(url, mapping, currency, note_builder=None):
    data = fetch_json(url)["data"]
    models = {item["id"]: item for item in data}
    out = []
    for standard_name, candidates in mapping.items():
        for source_id in normalize_candidates(candidates):
            item = models.get(source_id)
            if not item:
                continue
            pricing = item.get("pricing") or {}
            if pricing.get("prompt") is None or pricing.get("completion") is None:
                continue
            raw_input = q(pricing["prompt"]) * 1000000
            raw_output = q(pricing["completion"]) * 1000000
            note = ""
            if note_builder:
                note = note_builder(standard_name, source_id, raw_input, raw_output)
            out.append(
                {
                    "name": standard_name,
                    "inputPer1M": fmt_money(raw_input, currency),
                    "outputPer1M": fmt_money(raw_output, currency),
                    "note": note,
                }
            )
            break
    return ordered_platform(out)


def build_group_ratio_platform(
    url,
    pricing_page,
    notes_line,
    mapping,
    skip_source_note_for=None,
    always_source_note_for=None,
):
    payload = fetch_json(url)
    items = {item["model_name"]: item for item in payload["data"]}
    group_ratio = {name: q(value) for name, value in payload["group_ratio"].items()}
    skip_source_note_for = set(skip_source_note_for or [])
    always_source_note_for = set(always_source_note_for or [])
    out = []
    for standard_name, candidates in mapping.items():
        for source_id in normalize_candidates(candidates):
            item = items.get(source_id)
            if not item:
                continue
            valid_groups = [(group_ratio[group], group) for group in item.get("enable_groups", []) if group in group_ratio]
            if not valid_groups:
                continue
            min_ratio, min_group = min(valid_groups)
            raw_input = q(item["model_ratio"]) * 2 * min_ratio
            raw_output = raw_input * q(item["completion_ratio"])
            note = f"按 {pricing_page} 展示规则换算；最低可用分组为「{min_group}」，倍率 {min_ratio.normalize()}"
            should_note_source = standard_name in always_source_note_for or (
                source_id != standard_name and standard_name not in skip_source_note_for
            )
            if should_note_source:
                note = join_notes(f"对应 {source_id}", note)
            out.append(
                {
                    "name": standard_name,
                    "inputPer1M": fmt_money(raw_input, "￥"),
                    "outputPer1M": fmt_money(raw_output, "￥"),
                    "note": note,
                }
            )
            break
    return ordered_platform(out, notes_extra=[notes_line])


def merge_notes(existing_notes, notes_extra):
    lines = existing_notes.splitlines() if existing_notes else []
    for extra_line in notes_extra:
        if extra_line and extra_line not in lines:
            lines.append(extra_line)
    return "\n".join(lines)


def write_platforms_to_relays(relays_path, platforms):
    path = Path(relays_path)
    data = json.loads(path.read_text(encoding="utf-8"))
    updated = set()
    for entry in data:
        platform_id = entry.get("id")
        platform_data = platforms.get(platform_id)
        if not platform_data:
            continue
        entry["updatedAt"] = platform_data["updatedAt"]
        detail = entry.setdefault("detail", {})
        detail["keyModels"] = platform_data["keyModels"]
        detail["notes"] = merge_notes(detail.get("notes", ""), platform_data.get("notesExtra", []))
        updated.add(platform_id)
    missing = [platform_id for platform_id in platforms if platform_id not in updated]
    if missing:
        raise KeyError(f"relays.json 中未找到平台: {', '.join(missing)}")
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return str(path)


def dump_json(data, compact=False):
    if compact:
        print(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
        return
    print(json.dumps(data, ensure_ascii=False, indent=2))


def run_platform_cli(platform_id, builder, description):
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--compact", action="store_true", help="Output compact JSON")
    parser.add_argument(
        "--write",
        nargs="?",
        const=DEFAULT_RELAYS_PATH,
        metavar="PATH",
        help=f"Write {platform_id} back to relays.json (default: {DEFAULT_RELAYS_PATH})",
    )
    args = parser.parse_args()
    data = builder()
    if args.write:
        write_platforms_to_relays(args.write, {platform_id: data})
    dump_json(data, compact=args.compact)