#!/usr/bin/env python3

from collections import OrderedDict
from decimal import Decimal

from relay_prices_common import fetch_json, fmt_money, join_notes, ordered_platform, q, run_platform_cli


PLATFORM_ID = "llmhub"


def build_platform():
    status = fetch_json("https://www.llmhub.com.cn/api/status")["data"]
    data = fetch_json("https://www.llmhub.com.cn/api/pricing")["data"]
    items = {item["model_name"]: item for item in data}
    quota_per_unit = q(status["quota_per_unit"])
    price = q(status["price"])
    mapping = OrderedDict(
        {
            "Opus-4.6": ["claude-opus-4.6"],
            "Sonnet-4.6": ["claude-sonnet-4.6"],
            "GPT-5.4": ["gpt-5.4"],
            "GPT-5.3-Codex": ["gpt-5.3-codex"],
            "Gemini-3.1-Pro": ["gemini-3.1-pro-preview"],
            "Gemini-3-Flash": ["gemini-3-flash-preview"],
            "GLM-5.1": ["glm-5.1"],
            "GLM-5": ["glm-5"],
            "MiniMax-M2.7": ["minimax-m2.7"],
            "MiniMax-M2.5": ["minimax-m2.5"],
            "Kimi-K2.5": ["kimi-k2.5"],
            "DeepSeek-V3.2": ["deepseek-v3.2"],
            "Qwen-3.6-Plus": ["qwen3.6-plus"],
            "Qwen-3.5": ["qwen3.5-plus"],
            "Doubao-Seed-2.0-Code": ["doubao-seed-2.0-code-preview", "doubao-seed-2.0-code"],
        }
    )
    out = []
    for standard_name, candidates in mapping.items():
        for source_id in candidates:
            item = items.get(source_id)
            if not item:
                continue
            raw_input = Decimal("1000000") * q(item["model_ratio"]) / quota_per_unit * price
            raw_output = raw_input * q(item["completion_ratio"])
            note = "按 https://www.llmhub.com.cn/pricing 与公开接口换算成人民币"
            if standard_name in {"Qwen-3.5", "Doubao-Seed-2.0-Code"}:
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
    return ordered_platform(out)


def main():
    run_platform_cli(PLATFORM_ID, build_platform, "Fetch LLM Hub relay pricing")


if __name__ == "__main__":
    main()