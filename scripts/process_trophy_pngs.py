#!/usr/bin/env python3
"""
Crop trophy renders to content bounds and normalize scale into square PNGs.
Treats low-alpha and flat dark neutral pixels (black / charcoal) as background.
"""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np
from PIL import Image

# Source glob prefix -> output filename under trophies/ (must match tryFetchManualTrophyPng)
ASSET_TO_OUT = [
    ("Dodecahedron-d74049e9", "dodecahedron-top.png"),
    ("Tetrahedron-29ed3cb6", "tetrahedron-top.png"),
    ("Octahedron-57fa92f9", "octahedron-top.png"),
    ("Icosahedron-4abd4da3", "icosahedron-top.png"),
    ("Rhombic_Dodecahedron-40dd48b8", "rhombic-dodecahedron-net.png"),
    ("Cuboctahedron-48694535", "cuboctahedron-top.png"),
    ("Icosidodecahedron-4ffd7d99", "icosidodecahedron-top.png"),
    ("Truncated_Dodecahedron-18c4bf23", "truncated-dodecahedron-top.png"),
    ("Truncated_Icosidodecahedron-0b5f8142", "truncated-icosidodecahedron-top.png"),
    ("Truncated_Cube-1f4ceb3f", "truncated-cube-top.png"),
    ("Cube_Hexahedron-f03c12f9", "cube-top.png"),
    ("Truncated_Octahedron-b90cd37c", "truncated-octahedron-top.png"),
    ("Truncated_Tetrahedron-9d362770", "truncated-tetrahedron-top.png"),
    ("Rhombicuboctahedron-fcd75092", "rhombicuboctahedron-top.png"),
    ("Rhombicosidodecahedron-276a54d5", "small-rhombicosidodecahedron-top.png"),
    ("Snub_Cube-19585a44", "snub-cube-top.png"),
    ("Truncated_Icosahedron-a18b72db", "truncated-icosahedron-top.png"),
    ("Snub_Dodecahedron-2fd3cd44", "snub-dodecahedron-top.png"),
    ("Truncated_Cuboctahedron-77dafcc9", "truncated-cuboctahedron-top.png"),
]

OUT_SIZE = 256
MAX_FILL = 220  # max side of shape inside OUT_SIZE
ALPHA_CUT = 12
BG_CHROMA_MAX = 14
BG_BRIGHT_MAX = 52
# Stricter than crop: zero alpha on near-black neutrals (opaque #000 export background)
KNOCKOUT_MX = 28
KNOCKOUT_CHROMA = 12


def find_source(assets_dir: Path, prefix: str) -> Path | None:
    for p in assets_dir.iterdir():
        if not p.is_file() or p.suffix.lower() != ".png":
            continue
        if p.name.startswith(prefix):
            return p
    return None


def content_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    arr = np.asarray(im.convert("RGBA"))
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    chroma = mx - mn
    neutral_dark = (chroma <= BG_CHROMA_MAX) & (mx <= BG_BRIGHT_MAX)
    is_bg = (a <= ALPHA_CUT) | (neutral_dark & (a > 0))
    fg = ~is_bg
    rows = np.any(fg, axis=1)
    cols = np.any(fg, axis=0)
    if not np.any(rows):
        h, w = arr.shape[:2]
        return 0, 0, w, h
    ys = np.flatnonzero(rows)
    xs = np.flatnonzero(cols)
    y0, y1 = int(ys[0]), int(ys[-1]) + 1
    x0, x1 = int(xs[0]), int(xs[-1]) + 1
    return x0, y0, x1, y1


def process_one(src: Path, dst: Path) -> None:
    im = Image.open(src)
    bbox = content_bbox(im)
    pad = 2
    x0 = max(0, bbox[0] - pad)
    y0 = max(0, bbox[1] - pad)
    x1 = min(im.width, bbox[2] + pad)
    y1 = min(im.height, bbox[3] + pad)
    cropped = im.crop((x0, y0, x1, y1)).convert("RGBA")
    cw, ch = cropped.size
    scale = min(MAX_FILL / cw, MAX_FILL / ch)
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0))
    ox = (OUT_SIZE - nw) // 2
    oy = (OUT_SIZE - nh) // 2
    canvas.paste(resized, (ox, oy), resized)
    data = np.asarray(canvas, dtype=np.uint8).copy()
    r, g, b, a = data[..., 0], data[..., 1], data[..., 2], data[..., 3]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    chroma = mx - mn
    knockout = ((mx <= KNOCKOUT_MX) & (chroma <= KNOCKOUT_CHROMA)) | (a <= ALPHA_CUT)
    data[knockout, 3] = 0
    canvas = Image.fromarray(data, mode="RGBA")
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst, "PNG", optimize=True)
    print(f"OK {dst.name} <- {src.name}")


def main() -> None:
    repo = Path(__file__).resolve().parents[1]
    default_assets = Path(
        os.environ.get(
            "TROPHY_ASSETS_DIR",
            str(
                Path.home()
                / ".cursor/projects/Users-jeremyclark-Documents-github-PolyhedraNetFolder/assets"
            ),
        )
    )
    assets_dir = default_assets
    if not assets_dir.is_dir():
        print(f"Missing assets dir: {assets_dir}")
        raise SystemExit(1)
    out_dir = repo / "trophies"
    for prefix, out_name in ASSET_TO_OUT:
        src = find_source(assets_dir, prefix)
        if not src:
            print(f"SKIP (not found): {prefix}")
            continue
        process_one(src, out_dir / out_name)
    print(f"Done -> {out_dir}")


if __name__ == "__main__":
    main()
