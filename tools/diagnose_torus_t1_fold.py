#!/usr/bin/env python3
"""
Compare torus-wolfram-1-net.json hinge data to the Wolfram solid (t1).

Answers: are magnitudes right (π − interior dihedral) vs wrong? Is sign separate?

Run from repo root:  python3 tools/diagnose_torus_t1_fold.py
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_wolfram_torus1_net as t1


def interior_and_supplement(child_fi: int, parent_fi: int) -> tuple[float, float]:
    """Interior dihedral φ (0..π) and paper fold supplement π−φ (convex convention)."""
    nc = t1.face_normal_3d(child_fi)
    np = t1.face_normal_3d(parent_fi)
    d = max(-1.0, min(1.0, -t1.dot(nc, np)))
    phi = math.acos(d)
    return phi, math.pi - phi


def main() -> None:
    net_disk = json.loads((ROOT / "nets" / "torus-wolfram-1-net.json").read_text(encoding="utf-8"))
    net_gen, meta = t1.build_wolfram_torus_1_data()
    bfs = meta["bfs_order"]

    def app_to_solid_idx(app_id: int) -> int:
        return bfs[app_id - 1]

    print("=== Magnitude check: |foldAngleRad| vs π − interior_dihedral ===")
    print("(01-FOLD Platonic/Archimedean comment: rotation from flat ≈ π − interior.)\n")
    print(f"{'st':>3} {'from':>4} {'to':>4} {'|json|':>10} {'π−φ':>10} {'|diff|':>10}  json_sign")
    print("-" * 60)

    for i, c in enumerate(net_disk["connections"], start=1):
        fc = app_to_solid_idx(int(c["from"]))
        fp = app_to_solid_idx(int(c["to"]))
        phi, supp = interior_and_supplement(fc, fp)
        ja = float(c["foldAngleRad"])
        mag = abs(ja)
        print(
            f"{i:3d} {c['from']:4d} {c['to']:4d} {mag:10.6f} {supp:10.6f} {abs(mag - supp):10.2e}  "
            f"{'+' if ja >= 0 else '-'}"
        )

    print("\n=== Regenerated vs on-disk JSON (should match if net is current) ===")
    for a, b in zip(net_disk["connections"], net_gen["connections"], strict=True):
        if a["foldAngleRad"] != b["foldAngleRad"] or a["from"] != b["from"]:
            print("MISMATCH", a, b)
            break
    else:
        print("On-disk JSON matches generator.")

    print(
        "\n=== Interpretation ===\n"
        "If |json| ≈ π−φ for every row, magnitudes are consistent with the solid.\n"
        "Then remaining error is mostly **direction**: quaternion sign vs hinge axis in the app.\n"
        "Try per-hinge **foldSign**: -1 in JSON flips rotation (see script.js forcedFoldSign).\n"
        "Or negate **foldAngleRad** for one hinge at a time to see which edges are wrong.\n"
    )


if __name__ == "__main__":
    main()
