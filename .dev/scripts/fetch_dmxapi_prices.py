#!/usr/bin/env python3

from collections import OrderedDict

from relay_prices_common import fetch_json, fmt_money, ordered_platform, run_platform_cli


PLATFORM_ID = "dmxapi"


def build_platform():
    payload = fetch_json("https://rmb.dmxapi.cn/?api=model_prices")
    if isinstance(payload, dict) and isinstance(payload.get("data"), dict):
        items = payload["data"]
    else:
        items = payload
    mapping = OrderedDict(
        {
            "Opus-4.6": ["claude-opus-4.6", "Opus-4.6"],
            "Sonnet-4.6": ["claude-sonnet-4.6", "Sonnet-4.6"],
            "GPT-5.4": ["gpt-5.4"],
            "GPT-5.3-Codex": ["gpt-5.3-codex"],
            "Gemini-3.1-Pro": ["gemini-3.1-pro-preview"],
            "Gemini-3-Flash": ["gemini-3-flash-preview"],
            "GLM-5.1": ["glm-5.1"],
            "GLM-5": ["glm-5"],
            "MiniMax-M2.7": ["MiniMax-M2.7", "minimax-m2.7"],
            "MiniMax-M2.5": ["MiniMax-M2.5", "minimax-m2.5"],
            "Kimi-K2.5": ["kimi-k2.5"],
            "DeepSeek-V3.2": ["DeepSeek-V3.2", "deepseek-v3.2"],
            "Qwen-3.6-Plus": ["qwen3.6-plus", "Qwen-3.6-Plus"],
            "Qwen-3.5": ["qwen3.5-plus", "Qwen-3.5-Plus"],
            "Doubao-Seed-2.0-Code": ["doubao-seed-2.0-code-preview", "doubao-seed-2.0-code"],
        }
    )
    out = []
    for standard_name, candidates in mapping.items():
        for source_id in candidates:
            item = items.get(source_id)
            if not isinstance(item, dict):
                continue
            if item.get("input_price") is None or item.get("output_price") is None:
                continue
            note = ""
            if standard_name in {"Qwen-3.5", "Doubao-Seed-2.0-Code"}:
                note = f"对应 {source_id}"
            out.append(
                {
                    "name": standard_name,
                    "inputPer1M": fmt_money(item["input_price"], "￥"),
                    "outputPer1M": fmt_money(item["output_price"], "￥"),
                    "note": note,
                }
            )
            break
    return ordered_platform(out)


def main():
    run_platform_cli(PLATFORM_ID, build_platform, "Fetch DMXAPI relay pricing")


if __name__ == "__main__":
    main()