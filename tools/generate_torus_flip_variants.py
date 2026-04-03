#!/usr/bin/env python3
"""
Write single-hinge sign-flip variants of torus-wolfram-1-net.json for browser testing.

Each file negates foldAngleRad on exactly one connection (others unchanged).
Load via the NET file picker in 01-FOLD (or temporarily add as a preset).

Usage (repo root):
  python3 tools/generate_torus_flip_variants.py
"""
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_wolfram_torus1_net import build_wolfram_torus_1_data

OUT_DIR = ROOT / "nets" / "torus-wolfram-1-variants"


def main() -> None:
    net, _meta = build_wolfram_torus_1_data()
    conns = net["connections"]
    if len(conns) != 8:
        raise SystemExit(f"Expected 8 connections, got {len(conns)}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for i in range(8):
        stage = i + 1
        variant = copy.deepcopy(net)
        c = variant["connections"][i]
        c["foldAngleRad"] = -float(c["foldAngleRad"])
        frm, to = c["from"], c["to"]
        variant["description"] = (
            f"{net['description']} [diagnostic: negated foldAngleRad only for stage {stage}, "
            f"face {frm}→{to}]"
        )
        out_path = OUT_DIR / f"flip-stage-{stage:02d}-face{frm}-to{to}.json"
        out_path.write_text(json.dumps(variant, indent=2) + "\n", encoding="utf-8")
        print("Wrote", out_path.relative_to(ROOT), f"(hinge {stage}: from={frm} to={to})")

    print(f"\nDone. Open 01-FOLD → upload one file from {OUT_DIR.relative_to(ROOT)}/")
    print("Scrub fold to 8/8 and see if closure improves vs the default torus preset.")


if __name__ == "__main__":
    main()
