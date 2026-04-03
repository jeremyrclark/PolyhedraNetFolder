#!/usr/bin/env python3
"""
Wattenhofer / Aboufadel-style net folding (see Chalkdust 2018 + folding_solids).

Idea: choose hinge dihedrals so that every solid vertex's net copies weld to one
3D point — nonlinear least squares on the residual vectors (P_j - mean_g).

Forward model matches ``generate_catalan_nets.simulate_full_fold``: for each stage
k = 2..F, rotate the subtree rooted at face k about the parent hinge axis in
*current* world space (Rodrigues), using expanded corner coordinates so each
face corner keeps its own 2D position until folded.

Requires: numpy, scipy

This is offline / build-time; the browser can reuse the exported foldAngleRad +
foldSign from JSON. A future JS port could use the same residual with a
derivative-free optimizer for custom nets.
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import TYPE_CHECKING

import numpy as np

try:
    from scipy.optimize import least_squares
except ImportError:
    least_squares = None  # type: ignore[misc, assignment]

if TYPE_CHECKING:
    from collections.abc import Sequence


def rotate_points_about_axis(
    pts: np.ndarray,
    axis_point: np.ndarray,
    axis_dir: np.ndarray,
    angle: float,
) -> np.ndarray:
    kvec = np.asarray(axis_dir, dtype=float).reshape(3)
    kvec = kvec / (np.linalg.norm(kvec) + 1e-15)
    rel = pts - axis_point.reshape(1, 3)
    c = math.cos(angle)
    s = math.sin(angle)
    cross = np.cross(np.tile(kvec, (len(pts), 1)), rel)
    dot = np.sum(rel * kvec, axis=1, keepdims=True)
    rot = rel * c + cross * s + dot * (1.0 - c) * kvec
    return rot + axis_point.reshape(1, 3)


def collect_subtree_rooted_at(root: int, children: dict[int, list[int]]) -> set[int]:
    out = {root}
    stack = [root]
    while stack:
        u = stack.pop()
        for v in children.get(u, []):
            if v not in out:
                out.add(v)
                stack.append(v)
    return out


def build_expanded_corner_layout(
    face_list_bfs: list[int],
    flat_polys: dict[int, np.ndarray],
    face_orders: dict[int, list[int]],
) -> tuple[np.ndarray, np.ndarray, list[int], list[int]]:
    """
    Returns:
      xz: (Ncorn, 2) per-corner flat coords
      global_vid: (Ncorn,) solid vertex index
      corner_app_face: (Ncorn,) app face id 1..F
      first_corner: list[int] length F, cumulative start index per face (0-based fi)
    """
    corners: list[np.ndarray] = []
    gv_list: list[int] = []
    corner_app: list[int] = []
    first_corner: list[int] = []
    acc = 0
    for fi in range(len(face_list_bfs)):
        aid = fi + 1
        first_corner.append(acc)
        order = face_orders[aid]
        xz = flat_polys[aid]
        for k, gv in enumerate(order):
            corners.append(np.asarray(xz[k], dtype=float))
            gv_list.append(int(gv))
            corner_app.append(aid)
            acc += 1
    xz_arr = np.stack(corners) if corners else np.zeros((0, 2))
    return (
        xz_arr,
        np.array(gv_list, dtype=int),
        corner_app,
        first_corner,
    )


def forward_corner_positions(
    signed_thetas: np.ndarray,
    conns_data: list[dict],
    face_list_bfs: list[int],
    xz: np.ndarray,
    global_vid: np.ndarray,
    corner_app_face: list[int],
    first_corner: list[int],
) -> np.ndarray:
    """3D world position for each corner after sequential folds (app order 2..F)."""
    nc = xz.shape[0]
    P = np.zeros((nc, 3))
    P[:, 0] = xz[:, 0]
    P[:, 2] = xz[:, 1]

    n_app = len(face_list_bfs)
    children: dict[int, list[int]] = defaultdict(list)
    for c in conns_data:
        children[int(c["to"])].append(int(c["from"]))
    by_from = {int(c["from"]): c for c in conns_data}

    corner_in_subtree = np.zeros(nc, dtype=bool)

    for k in range(2, n_app + 1):
        c = by_from[k]
        p = int(c["to"])
        fp = p - 1
        pr, ps = int(c["toEdge"][0]), int(c["toEdge"][1])
        jpr = first_corner[fp] + pr
        jps = first_corner[fp] + ps
        axis_pt = (P[jpr] + P[jps]) * 0.5
        axis = P[jpr] - P[jps]
        if float(np.linalg.norm(axis)) < 1e-14:
            continue
        ang = float(signed_thetas[k - 2])
        subtree = collect_subtree_rooted_at(k, children)
        for j in range(nc):
            corner_in_subtree[j] = corner_app_face[j] in subtree
        if np.any(corner_in_subtree):
            idx = np.where(corner_in_subtree)[0]
            P[idx] = rotate_points_about_axis(P[idx], axis_pt, axis, ang)
    return P


def weld_residuals_from_positions(P: np.ndarray, global_vid: np.ndarray) -> np.ndarray:
    """Stack (P_j - centroid_g) for each solid vertex g with >= 2 corners."""
    blocks: list[np.ndarray] = []
    mg = int(np.max(global_vid)) if global_vid.size else -1
    for g in range(mg + 1):
        js = np.where(global_vid == g)[0]
        if js.size < 2:
            continue
        mu = P[js].mean(axis=0)
        for j in js:
            blocks.append(P[int(j)] - mu)
    if not blocks:
        return np.zeros(0)
    return np.concatenate(blocks)


def wattenhofer_weld_residuals(
    signed_thetas: np.ndarray,
    conns_data: list[dict],
    face_list_bfs: list[int],
    xz: np.ndarray,
    global_vid: np.ndarray,
    corner_app_face: list[int],
    first_corner: list[int],
    anchor: np.ndarray | None,
    anchor_weight: float,
) -> np.ndarray:
    P = forward_corner_positions(
        signed_thetas,
        conns_data,
        face_list_bfs,
        xz,
        global_vid,
        corner_app_face,
        first_corner,
    )
    w = weld_residuals_from_positions(P, global_vid)
    if anchor is not None and anchor_weight > 0:
        diff = (signed_thetas - anchor) * math.sqrt(anchor_weight)
        w = np.concatenate([w, diff])
    return w


def optimize_fold_angles_wattenhofer(
    conns_data: list[dict],
    flat_polys: dict[int, np.ndarray],
    face_orders: dict[int, list[int]],
    face_list_bfs: list[int],
    V: np.ndarray,
    faces: list[list[int]],
    oc: np.ndarray,
    *,
    anchor_weight: float = 0.08,
    max_nfev: int | None = None,
) -> tuple[np.ndarray, float, float] | None:
    """
    Returns (signed_thetas_opt, final_weld_norm, initial_weld_norm) or None.

    Soft anchors pull toward canonical |acos(n·n)| with sign from greedy conns.
    """
    if least_squares is None:
        return None

    xz, global_vid, corner_app_face, first_corner = build_expanded_corner_layout(
        face_list_bfs, flat_polys, face_orders
    )
    nh = len(conns_data)
    if nh < 1 or xz.shape[0] < 4:
        return None

    # Import dihedral helper from sibling module
    import importlib.util
    from pathlib import Path

    gen_path = Path(__file__).resolve().parent / "generate_catalan_nets.py"
    spec = importlib.util.spec_from_file_location("gen_cat", gen_path)
    if spec is None or spec.loader is None:
        return None
    gen = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gen)

    theta0 = np.array(
        [
            float(c["foldAngleRad"]) * int(c.get("foldSign", 1))
            for c in conns_data
        ],
        dtype=float,
    )
    mag = np.array(
        [
            gen.dihedral_fold_angle(
                V,
                faces,
                face_list_bfs[int(c["from"]) - 1],
                face_list_bfs[int(c["to"]) - 1],
                oc,
            )
            for c in conns_data
        ],
        dtype=float,
    )
    s0 = np.sign(theta0)
    s0[s0 == 0.0] = 1.0
    anchor = mag * s0

    if max_nfev is None:
        max_nfev = max(400, nh * 120)

    def fun(x: np.ndarray) -> np.ndarray:
        return wattenhofer_weld_residuals(
            x,
            conns_data,
            face_list_bfs,
            xz,
            global_vid,
            corner_app_face,
            first_corner,
            anchor,
            anchor_weight,
        )

    lo = np.full(nh, -math.pi + 1e-3)
    hi = np.full(nh, math.pi - 1e-3)
    P0 = forward_corner_positions(
        theta0, conns_data, face_list_bfs, xz, global_vid, corner_app_face, first_corner
    )
    w0b = weld_residuals_from_positions(P0, global_vid)
    w0 = float(np.linalg.norm(w0b)) if w0b.size else 0.0

    try:
        res = least_squares(
            fun,
            theta0,
            method="trf",
            bounds=(lo, hi),
            ftol=1e-10,
            xtol=1e-10,
            gtol=1e-10,
            max_nfev=max_nfev,
            verbose=0,
        )
    except Exception:
        return None

    th = res.x
    P = forward_corner_positions(
        th, conns_data, face_list_bfs, xz, global_vid, corner_app_face, first_corner
    )
    weld_only = weld_residuals_from_positions(P, global_vid)
    weld_norm = float(np.linalg.norm(weld_only)) if weld_only.size else 0.0
    return th, weld_norm, w0


def apply_optimized_thetas_to_conns(conns_data: list[dict], signed_thetas: np.ndarray) -> None:
    for i, c in enumerate(conns_data):
        t = float(signed_thetas[i])
        c["foldAngleRad"] = float(abs(t))
        c["foldSign"] = 1 if t >= 0.0 else -1
