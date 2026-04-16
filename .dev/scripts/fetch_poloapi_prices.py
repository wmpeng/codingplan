#!/usr/bin/env python3

from collections import OrderedDict

from relay_prices_common import build_group_ratio_platform, run_platform_cli


PLATFORM_ID = "poloapi"


def build_platform():
    mapping = OrderedDict(
        {
            "Opus-4.6": ["claude-opus-4-6", "claude-opus-4.6"],
            "Sonnet-4.6": ["claude-sonnet-4-6", "claude-sonnet-4.6"],
            "GPT-5.4": ["gpt-5.4"],
            "GPT-5.3-Codex": ["gpt-5.3-codex"],
            "Gemini-3.1-Pro": ["gemini-3.1-pro-preview"],
            "Gemini-3-Flash": ["gemini-3-flash-preview"],
            "GLM-5.1": ["glm-5.1"],
            "GLM-5": ["glm-5"],
            "MiniMax-M2.7": ["MiniMax-M2.7"],
            "MiniMax-M2.5": ["MiniMax-M2.5"],
            "Kimi-K2.5": ["Kimi-K2.5", "kimi-k2.5"],
            "DeepSeek-V3.2": ["deepseek-v3.2"],
            "Qwen-3.6-Plus": ["qwen3.6-plus"],
            "Qwen-3.5": ["qwen3.5-plus", "qwen3.5-flash"],
            "Doubao-Seed-2.0-Code": ["doubao-seed-2.0-code-preview", "doubao-seed-2.0-code"],
        }
    )
    return build_group_ratio_platform(
        "https://xy.poloapi.com/api/pricing",
        "https://xy.poloapi.com/pricing",
        "充值汇率 1:1：平台充值 1 人民 = 1 美金额度。",
        mapping,
        skip_source_note_for={"GPT-5.4", "GPT-5.3-Codex", "GLM-5", "GLM-5.1", "DeepSeek-V3.2", "Kimi-K2.5"},
        always_source_note_for={"Qwen-3.5"},
    )


def main():
    run_platform_cli(PLATFORM_ID, build_platform, "Fetch PoloAPI relay pricing")


if __name__ == "__main__":
    main()