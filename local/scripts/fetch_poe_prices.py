#!/usr/bin/env python3

from collections import OrderedDict

from relay_prices_common import build_token_pricing_platform, join_notes, rounded_note, run_platform_cli


PLATFORM_ID = "poe"


def build_platform():
    mapping = OrderedDict(
        {
            "Opus-4.6": ["claude-opus-4.6"],
            "Sonnet-4.6": ["claude-sonnet-4.6"],
            "GPT-5.4": ["gpt-5.4"],
            "GPT-5.3-Codex": ["gpt-5.3-codex"],
            "Gemini-3.1-Pro": ["gemini-3.1-pro", "gemini-3.1-pro-preview"],
            "Gemini-3-Flash": ["gemini-3-flash", "gemini-3-flash-preview"],
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

    def note_builder(standard_name, source_id, raw_input, _raw_output):
        mapped_note = ""
        if standard_name == "Gemini-3.1-Pro" and source_id != "gemini-3.1-pro-preview":
            mapped_note = f"对应 {source_id}"
        elif standard_name == "Gemini-3-Flash" and source_id != "gemini-3-flash-preview":
            mapped_note = f"对应 {source_id}"
        elif standard_name == "Qwen-3.5":
            mapped_note = f"对应 {source_id}"
        return join_notes(mapped_note, rounded_note(raw_input, "$"))

    return build_token_pricing_platform(
        "https://api.poe.com/v1/models",
        mapping,
        "$",
        note_builder=note_builder,
    )


def main():
    run_platform_cli(PLATFORM_ID, build_platform, "Fetch Poe relay pricing")


if __name__ == "__main__":
    main()