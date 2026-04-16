#!/usr/bin/env python3

import argparse
from collections import OrderedDict

from fetch_dmxapi_prices import build_platform as build_dmxapi
from fetch_llmhub_prices import build_platform as build_llmhub
from fetch_n1n_prices import build_platform as build_n1n
from fetch_ofox_prices import build_platform as build_ofox
from fetch_openrouter_prices import build_platform as build_openrouter
from fetch_poe_prices import build_platform as build_poe
from fetch_poloapi_prices import build_platform as build_poloapi
from fetch_siliconflow_prices import build_platform as build_siliconflow
from relay_prices_common import DEFAULT_RELAYS_PATH, PLATFORM_ORDER, TODAY, dump_json, write_platforms_to_relays


BUILDERS = OrderedDict(
    {
        "openrouter": build_openrouter,
        "siliconflow": build_siliconflow,
        "poloapi": build_poloapi,
        "ofox": build_ofox,
        "n1n": build_n1n,
        "dmxapi": build_dmxapi,
        "llmhub": build_llmhub,
        "poe": build_poe,
    }
)


def build_all(platform_ids=None):
    selected_ids = platform_ids or PLATFORM_ORDER
    platforms = OrderedDict()
    for platform_id in selected_ids:
        platforms[platform_id] = BUILDERS[platform_id]()
    return OrderedDict({"generatedAt": TODAY, "platforms": platforms})


def main():
    parser = argparse.ArgumentParser(description="Fetch relay pricing with standard model names.")
    parser.add_argument(
        "--platform",
        choices=PLATFORM_ORDER,
        action="append",
        help="Only fetch specific platform(s). Can be used multiple times.",
    )
    parser.add_argument("--compact", action="store_true", help="Output compact JSON")
    parser.add_argument(
        "--write",
        nargs="?",
        const=DEFAULT_RELAYS_PATH,
        metavar="PATH",
        help=f"Write fetched data back to relays.json (default: {DEFAULT_RELAYS_PATH})",
    )
    args = parser.parse_args()

    data = build_all(args.platform)
    if args.write:
        write_platforms_to_relays(args.write, data["platforms"])
    dump_json(data, compact=args.compact)


if __name__ == "__main__":
    main()