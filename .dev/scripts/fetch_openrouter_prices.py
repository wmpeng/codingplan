#!/usr/bin/env python3

from collections import OrderedDict

from relay_prices_common import build_token_pricing_platform, rounded_note, run_platform_cli


PLATFORM_ID = "openrouter"


def build_platform():
    mapping = OrderedDict(
        {
            "Opus-4.6": "anthropic/claude-opus-4.6",
            "Sonnet-4.6": "anthropic/claude-sonnet-4.6",
            "GPT-5.4": "openai/gpt-5.4",
            "GPT-5.3-Codex": "openai/gpt-5.3-codex",
            "Gemini-3.1-Pro": "google/gemini-3.1-pro-preview",
            "Gemini-3-Flash": "google/gemini-3-flash-preview",
            "GLM-5.1": "z-ai/glm-5.1",
            "GLM-5": "z-ai/glm-5",
            "MiniMax-M2.7": "minimax/minimax-m2.7",
            "MiniMax-M2.5": "minimax/minimax-m2.5",
            "Kimi-K2.5": "moonshotai/kimi-k2.5",
            "DeepSeek-V3.2": "deepseek/deepseek-v3.2",
            "Qwen-3.6-Plus": "qwen/qwen3.6-plus",
            "Doubao-Seed-2.0-Code": "bytedance/doubao-seed-2.0-code",
        }
    )

    def note_builder(_standard_name, _source_id, raw_input, _raw_output):
        return rounded_note(raw_input, "$")

    return build_token_pricing_platform(
        "https://openrouter.ai/api/v1/models",
        mapping,
        "$",
        note_builder=note_builder,
    )


def main():
    run_platform_cli(PLATFORM_ID, build_platform, "Fetch OpenRouter relay pricing")


if __name__ == "__main__":
    main()