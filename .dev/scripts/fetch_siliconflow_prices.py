#!/usr/bin/env python3

import re
from collections import OrderedDict

from relay_prices_common import fetch_text, fmt_money, ordered_platform, run_platform_cli


PLATFORM_ID = "siliconflow"


def build_platform():
    html = fetch_text("https://siliconflow.cn/models")
    mapping = OrderedDict(
        {
            "GLM-5.1": ("Pro/zai-org/GLM-5.1</div>", ""),
            "GLM-5": ("Pro/zai-org/GLM-5</div>", ""),
            "MiniMax-M2.5": ("Pro/MiniMaxAI/MiniMax-M2.5</div>", ""),
            "Kimi-K2.5": ("Pro/moonshotai/Kimi-K2.5</div>", ""),
            "DeepSeek-V3.2": ("deepseek-ai/DeepSeek-V3.2</div>", ""),
            "Qwen-3.5": ("Qwen/Qwen3.5-397B-A17B</div>", "对应 Qwen/Qwen3.5-397B-A17B"),
        }
    )
    out = []
    for standard_name, (marker, extra_note) in mapping.items():
        index = html.find(marker)
        if index == -1:
            continue
        snippet = html[index : index + 5000]
        match = re.search(
            r"输入:\s*<span[^>]*>￥<!-- -->?([^<]+)</span>\s*/ M Tokens</div><div>输出:\s*<span[^>]*>￥<!-- -->?([^<]+)</span>",
            snippet,
            re.S,
        )
        if not match:
            continue
        out.append(
            {
                "name": standard_name,
                "inputPer1M": fmt_money(match.group(1), "￥"),
                "outputPer1M": fmt_money(match.group(2), "￥"),
                "note": extra_note,
            }
        )
    return ordered_platform(out)


def main():
    run_platform_cli(PLATFORM_ID, build_platform, "Fetch SiliconFlow relay pricing")


if __name__ == "__main__":
    main()