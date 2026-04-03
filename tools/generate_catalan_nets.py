#!/usr/bin/env python3
"""
Generate Catalan solid net JSON files for Polyhedra Net Folder from dmccooey.com
polyhedra text data (vertices + faces). For snub duals, builds the dual of LsnubCube /
LsnubDodecahedron (laevo) to obtain pentagonal icositetrahedron / pentagonal hexecontahedron.

Run from repo root:
  python3 tools/generate_catalan_nets.py
  python3 tools/generate_catalan_nets.py --only TriakisTetrahedron

Requires: numpy, brotli (urllib in stdlib). Optional: scipy for Wattenhofer
weld polish after discrete fold refinement.
"""
from __future__ import annotations

import argparse
import gzip
import json
import math
import re
import urllib.request
from collections import defaultdict, deque

try:
    import brotli  # type: ignore
except ImportError:
    brotli = None
from pathlib import Path

import numpy as np

BASE = "https://dmccooey.com/polyhedra"
OUT_DIR = Path(__file__).resolve().parent.parent / "nets"

# (remote stem, output filename stem without -net, display name, polyKey)
CATALAN_SOURCES: list[tuple[str, str, str, str]] = [
    ("TriakisTetrahedron", "triakis-tetrahedron", "Triakis Tetrahedron", "triakis-tetrahedron"),
    ("TriakisOctahedron", "triakis-octahedron", "Triakis Octahedron", "triakis-octahedron"),
    ("TetrakisHexahedron", "tetrakis-hexahedron", "Tetrakis Hexahedron", "tetrakis-hexahedron"),
    (
        "DeltoidalIcositetrahedron",
        "deltoidal-icositetrahedron",
        "Deltoidal Icositetrahedron",
        "deltoidal-icositetrahedron",
    ),
    ("DisdyakisDodecahedron", "disdyakis-dodecahedron", "Disdyakis Dodecahedron", "disdyakis-dodecahedron"),
    ("RhombicTriacontahedron", "rhombic-triacontahedron", "Rhombic Triacontahedron", "rhombic-triacontahedron"),
    ("TriakisIcosahedron", "triakis-icosahedron", "Triakis Icosahedron", "triakis-icosahedron"),
    ("PentakisDodecahedron", "pentakis-dodecahedron", "Pentakis Dodecahedron", "pentakis-dodecahedron"),
    (
        "DeltoidalHexecontahedron",
        "deltoidal-hexecontahedron",
        "Deltoidal Hexecontahedron",
        "deltoidal-hexecontahedron",
    ),
    (
        "DisdyakisTriacontahedron",
        "disdyakis-triacontahedron",
        "Disdyakis Triacontahedron",
        "disdyakis-triacontahedron",
    ),
]

DUAL_SOURCES: list[tuple[str, str, str, str]] = [
    (
        "LsnubCube",
        "pentagonal-icositetrahedron-laevo",
        "Pentagonal Icositetrahedron (laevo)",
        "pentagonal-icositetrahedron-laevo",
    ),
    (
        "LsnubDodecahedron",
        "pentagonal-hexecontahedron-laevo",
        "Pentagonal Hexecontahedron (laevo)",
        "pentagonal-hexecontahedron-laevo",
    ),
]


def _norm_name(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def _row_matches_only(
    row: tuple[str, str, str, str], needle: str
) -> bool:
    stem, file_stem, disp, pkey = row
    n = _norm_name(needle)
    return n in {
        _norm_name(stem),
        _norm_name(file_stem),
        _norm_name(disp),
        _norm_name(pkey),
    }


def fetch(name: str) -> str:
    """dmccooey.com serves text/plain with Content-Encoding: br (Brotli)."""
    url = f"{BASE}/{name}.txt"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "PolyhedraNetFolder-generator/1.0"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
        enc = (r.headers.get("Content-Encoding") or "").strip().lower()
        if enc == "br":
            if brotli is None:
                raise RuntimeError(
                    "Install brotli to fetch dmccooey data: "
                    "python3 -m venv .venv && .venv/bin/pip install brotli numpy"
                )
            raw = brotli.decompress(raw)
        elif enc == "gzip" or (len(raw) >= 2 and raw[0] == 0x1F and raw[1] == 0x8B):
            raw = gzip.decompress(raw)
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            if len(raw) >= 2 and raw[0] == 0x1F and raw[1] == 0x8B:
                return gzip.decompress(raw).decode("utf-8")
            raise


def eval_dmccooey_expr(expr: str, env: dict) -> float:
    expr = expr.strip()
    # Normalize cbrt for older Python if needed
    if "cbrt(" in expr:
        expr = re.sub(r"cbrt\(", "math.cbrt(", expr)
    return float(eval(expr, {"__builtins__": {}}, env))


def parse_dmccooey(text: str) -> tuple[np.ndarray, list[list[int]]]:
    consts: dict[str, float] = {}
    verts_list: list[np.ndarray] = []

    env = {"sqrt": math.sqrt, "math": math}
    if hasattr(math, "cbrt"):
        env["cbrt"] = math.cbrt
    else:
        env["cbrt"] = lambda x: float(x) ** (1.0 / 3.0)

    for line in text.splitlines():
        line = line.strip()
        m = re.match(r"^C(\d+)\s*=\s*([-+0-9.eE]+)", line)
        if m:
            key = "C" + m.group(1)
            if key not in consts:
                consts[key] = float(m.group(2))
            continue
        m = re.match(r"^C(\d+)\s*=\s*(.+)$", line)
        if m:
            key = "C" + m.group(1)
            if key in consts:
                continue
            try:
                consts[key] = eval_dmccooey_expr(m.group(2), {**env, **consts})
            except Exception:
                pass
            continue
        m = re.match(r"^V(\d+)\s*=\s*\(\s*([^)]+)\)", line)
        if m:
            body = m.group(2)
            parts = [p.strip() for p in body.split(",")]
            coords = []
            for p in parts:
                if re.match(r"^[-+0-9.eE]+$", p):
                    coords.append(float(p))
                else:
                    coords.append(float(eval_dmccooey_expr(p, {**env, **consts})))
            vi = int(m.group(1))
            while len(verts_list) <= vi:
                verts_list.append(np.zeros(3))
            verts_list[vi] = np.array(coords, dtype=float)

    faces: list[list[int]] = []
    in_faces = False
    for line in text.splitlines():
        if line.strip().startswith("Faces:"):
            in_faces = True
            continue
        if not in_faces:
            continue
        line = line.strip()
        if not line.startswith("{"):
            continue
        inner = line[line.find("{") + 1 : line.rfind("}")]
        nums = [int(x) for x in inner.replace(",", " ").split()]
        if len(nums) >= 3:
            faces.append(nums)

    V = np.vstack(verts_list)
    return V, faces


def polygon_normal_newell(pts: np.ndarray) -> np.ndarray:
    n = np.zeros(3)
    m = len(pts)
    for i in range(m):
        p0 = pts[i]
        p1 = pts[(i + 1) % m]
        n[0] += (p0[1] - p1[1]) * (p0[2] + p1[2])
        n[1] += (p0[2] - p1[2]) * (p0[0] + p1[0])
        n[2] += (p0[0] - p1[0]) * (p0[1] + p1[1])
    ln = np.linalg.norm(n)
    if ln < 1e-14:
        return np.array([0.0, 1.0, 0.0])
    return n / ln


def face_normal_outward(V: np.ndarray, face: list[int], oc: np.ndarray) -> np.ndarray:
    pts = V[np.array(face)]
    n = polygon_normal_newell(pts)
    fc = pts.mean(axis=0)
    if np.dot(n, fc - oc) < 0:
        n = -n
    return n


def rot_align_n_to_y(n: np.ndarray) -> np.ndarray:
    n = n / (np.linalg.norm(n) + 1e-15)
    y = np.array([0.0, 1.0, 0.0])
    v = np.cross(n, y)
    s = np.linalg.norm(v)
    if s < 1e-12:
        if n[1] > 0:
            return np.eye(3)
        return np.diag([1.0, -1.0, 1.0])
    v /= s
    c = float(np.clip(np.dot(n, y), -1.0, 1.0))
    ang = math.acos(c)
    K = np.array(
        [[0.0, -v[2], v[1]], [v[2], 0.0, -v[0]], [-v[1], v[0], 0.0]]
    )
    return np.eye(3) + math.sin(ang) * K + (1.0 - math.cos(ang)) * (K @ K)


def flatten_face_to_xz(V: np.ndarray, face: list[int], oc: np.ndarray) -> tuple[np.ndarray, list[int]]:
    """Return (N,2) xz coords in net winding order, and possibly reversed global vertex ids."""
    pts = V[np.array(face)]
    n = polygon_normal_newell(pts)
    fc = pts.mean(axis=0)
    order = list(face)
    if np.dot(n, fc - oc) < 0:
        n = -n
        pts = pts[::-1].copy()
        order = order[::-1]
    R = rot_align_n_to_y(n)
    c = pts.mean(axis=0)
    rel = pts - c
    rot = (R @ rel.T).T
    xz = np.stack([rot[:, 0], rot[:, 2]], axis=1)
    return xz, order


def cyclic_sort_faces_at_vertex(
    vi: int, fids: list[int], V: np.ndarray, centroids: np.ndarray, oc: np.ndarray
) -> list[int]:
    p = V[vi]
    nref = oc - p
    nref = nref / (np.linalg.norm(nref) + 1e-15)
    tmp = np.array([0.0, 0.0, 1.0]) if abs(nref[2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    u = np.cross(nref, tmp)
    u = u / (np.linalg.norm(u) + 1e-15)
    v = np.cross(nref, u)
    angs = []
    for fi in fids:
        c = centroids[fi] - p
        c = c - np.dot(c, nref) * nref
        angs.append((math.atan2(float(np.dot(c, v)), float(np.dot(c, u))), fi))
    angs.sort(key=lambda t: t[0])
    return [fi for _, fi in angs]


def dual_polyhedron(V: np.ndarray, faces: list[list[int]]) -> tuple[np.ndarray, list[list[int]]]:
    oc = V.mean(axis=0)
    centroids = np.array([V[np.array(f)].mean(axis=0) for f in faces])

    v2f: dict[int, list[int]] = defaultdict(list)
    for fi, f in enumerate(faces):
        for vi in f:
            v2f[vi].append(fi)

    dual_faces: list[list[int]] = []
    for vi in range(len(V)):
        if vi not in v2f:
            continue
        fids = v2f[vi]
        if len(fids) < 3:
            continue
        cyc = cyclic_sort_faces_at_vertex(vi, fids, V, centroids, oc)
        dual_faces.append(cyc)

    return centroids, dual_faces


def edge_key(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


def build_edge_to_faces(faces: list[list[int]]) -> dict[tuple[int, int], list[tuple[int, int]]]:
    """Map undirected edge -> [(face_idx, start_index_of_edge_in_face), ...]."""
    m: dict[tuple[int, int], list[tuple[int, int]]] = defaultdict(list)
    for fi, f in enumerate(faces):
        k = len(f)
        for i in range(k):
            a, b = f[i], f[(i + 1) % k]
            m[edge_key(a, b)].append((fi, i))
    return m


def find_shared_edge(
    fi: int, fj: int, faces: list[list[int]]
) -> tuple[tuple[int, int], int, int] | None:
    """Return ((va,vb), idx_on_fi, idx_on_fj) for shared edge."""
    verts_i = faces[fi]
    set_j = set(faces[fj])
    ki = len(verts_i)
    for i in range(ki):
        a, b = verts_i[i], verts_i[(i + 1) % ki]
        if a in set_j and b in set_j:
            jlist = faces[fj]
            kj = len(jlist)
            for j in range(kj):
                if jlist[j] == a and jlist[(j + 1) % kj] == b:
                    return (a, b), i, j
                if jlist[j] == b and jlist[(j + 1) % kj] == a:
                    return (a, b), i, j
    return None


def dihedral_fold_angle(
    V: np.ndarray, faces: list[list[int]], fi: int, fj: int, oc: np.ndarray
) -> float:
    n1 = face_normal_outward(V, faces[fi], oc)
    n2 = face_normal_outward(V, faces[fj], oc)
    d = float(np.clip(np.dot(n1, n2), -1.0, 1.0))
    return float(math.acos(d))


def polygon_from_xz_points(xz: np.ndarray) -> np.ndarray:
    """(N,2) xz -> (N,3) xyz with y=0."""
    return np.stack([xz[:, 0], np.zeros(len(xz)), xz[:, 1]], axis=1)


def rotate_points_about_axis(
    pts: np.ndarray,
    axis_point: np.ndarray,
    axis_dir: np.ndarray,
    angle: float,
) -> np.ndarray:
    """Rodrigues rotation around 3D line."""
    k = axis_dir / (np.linalg.norm(axis_dir) + 1e-15)
    rel = pts - axis_point
    c = math.cos(angle)
    s = math.sin(angle)
    cross = np.cross(np.tile(k, (len(pts), 1)), rel)
    dot = np.sum(rel * k, axis=1, keepdims=True)
    rot = rel * c + cross * s + dot * (1.0 - c) * k
    return rot + axis_point


def collect_subtree_rooted_at(root: int, children: dict[int, list[int]]) -> set[int]:
    """Faces whose pivot subtree is rooted at ``root`` (matches Three.js fold order)."""
    out = {root}
    stack = [root]
    while stack:
        u = stack.pop()
        for v in children.get(u, []):
            if v not in out:
                out.add(v)
                stack.append(v)
    return out


def copy_world_vertices(
    world: dict[int, np.ndarray],
) -> dict[int, np.ndarray]:
    return {k: v.copy() for k, v in world.items()}


def rotate_subtree_vertices(
    world: dict[int, np.ndarray],
    subtree: set[int],
    axis_pt: np.ndarray,
    axis_dir: np.ndarray,
    angle: float,
) -> None:
    kvec = np.asarray(axis_dir, dtype=float)
    kvec = kvec / (np.linalg.norm(kvec) + 1e-15)
    for fid in subtree:
        world[fid] = rotate_points_about_axis(world[fid], axis_pt, kvec, angle)


def pairwise_centroid_metric(
    world: dict[int, np.ndarray],
    app_ids: range,
    V: np.ndarray,
    faces: list[list[int]],
    face_list_bfs: list[int],
    uniform_scale: float,
) -> float:
    """
    Compare pairwise centroid distances to canonical (invariant to rigid motion).
    Lower is better.
    """
    cents: dict[int, np.ndarray] = {}
    cand: dict[int, np.ndarray] = {}
    for a in app_ids:
        fi = face_list_bfs[a - 1]
        cents[a] = world[a].mean(axis=0)
        cand[a] = V[np.array(faces[fi])].mean(axis=0) * uniform_scale
    ids = sorted(app_ids)
    err = 0.0
    for i, a in enumerate(ids):
        for b in ids[i + 1 :]:
            ds = float(np.linalg.norm(cents[a] - cents[b]))
            dc = float(np.linalg.norm(cand[a] - cand[b]))
            err += (ds - dc) ** 2
    return err


def assign_fold_signs_by_sequential_simulation(
    conns_data: list[dict],
    flat_polys: dict[int, np.ndarray],
    V: np.ndarray,
    faces: list[list[int]],
    face_list_bfs: list[int],
    uniform_scale: float,
) -> None:
    """
    After parents fold, hinge axes move in world space. Pick each foldSign by
    simulating the same fold tree as the app and minimizing centroid-distance error.
    Mutates each dict in ``conns_data`` to set ``foldSign``.
    """
    n_app = len(face_list_bfs)
    children: dict[int, list[int]] = defaultdict(list)
    for c in conns_data:
        children[c["to"]].append(c["from"])

    world: dict[int, np.ndarray] = {
        aid: polygon_from_xz_points(flat_polys[aid]) for aid in flat_polys
    }
    by_from = {c["from"]: c for c in conns_data}

    for k in range(2, n_app + 1):
        c = by_from[k]
        p = int(c["to"])
        pr, ps = int(c["toEdge"][0]), int(c["toEdge"][1])
        fold_rad = float(c["foldAngleRad"])
        wp = world[p]
        Rm = wp[pr].astype(float)
        Sm = wp[ps].astype(float)
        axis = Rm - Sm
        if float(np.linalg.norm(axis)) < 1e-12:
            c["foldSign"] = 1
            continue
        axis_pt = (Rm + Sm) * 0.5
        subtree = collect_subtree_rooted_at(k, children)

        best_sign = 1
        best_err = float("inf")
        for sgn in (-1, 1):
            trial = copy_world_vertices(world)
            rotate_subtree_vertices(trial, subtree, axis_pt, axis, sgn * fold_rad)
            err = pairwise_centroid_metric(
                trial, range(1, k + 1), V, faces, face_list_bfs, uniform_scale
            )
            if err < best_err:
                best_err = err
                best_sign = sgn
        c["foldSign"] = best_sign
        rotate_subtree_vertices(world, subtree, axis_pt, axis, best_sign * fold_rad)


def simulate_full_fold(
    flat_polys: dict[int, np.ndarray],
    conns_data: list[dict],
    face_list_bfs: list[int],
    base_angles: list[float],
    use_supplement: list[bool],
    signs: list[int],
) -> dict[int, np.ndarray]:
    """
    Full rigid fold in hinge order 2..F (same as the app).  ``base_angles[i]`` is the
    canonical acos(n1·n2); rotation magnitude is base or π-base per ``use_supplement``.
    """
    n_app = len(face_list_bfs)
    children: dict[int, list[int]] = defaultdict(list)
    for c in conns_data:
        children[int(c["to"])].append(int(c["from"]))
    by_from = {int(c["from"]): c for c in conns_data}
    world: dict[int, np.ndarray] = {
        aid: polygon_from_xz_points(np.asarray(flat_polys[aid], dtype=float).copy())
        for aid in flat_polys
    }
    for k in range(2, n_app + 1):
        c = by_from[k]
        p = int(c["to"])
        pr, ps = int(c["toEdge"][0]), int(c["toEdge"][1])
        idx = k - 2
        th = float(base_angles[idx])
        if use_supplement[idx]:
            th = float(math.pi - th)
        ang = float(signs[idx]) * th
        wp = world[p]
        Rm = wp[pr].astype(float)
        Sm = wp[ps].astype(float)
        axis = Rm - Sm
        if float(np.linalg.norm(axis)) < 1e-12:
            continue
        axis_pt = (Rm + Sm) * 0.5
        subtree = collect_subtree_rooted_at(k, children)
        rotate_subtree_vertices(world, subtree, axis_pt, axis, ang)
    return world


def full_fold_centroid_pairwise_error(
    flat_polys: dict[int, np.ndarray],
    conns_data: list[dict],
    face_list_bfs: list[int],
    base_angles: list[float],
    use_supplement: list[bool],
    signs: list[int],
    V: np.ndarray,
    faces: list[list[int]],
    uniform_scale: float,
) -> float:
    n_app = len(face_list_bfs)
    world = simulate_full_fold(
        flat_polys,
        conns_data,
        face_list_bfs,
        base_angles,
        use_supplement,
        signs,
    )
    return pairwise_centroid_metric(
        world, range(1, n_app + 1), V, faces, face_list_bfs, uniform_scale
    )


def _coordinate_descent_fold_params(
    conns_data: list[dict],
    flat_polys: dict[int, np.ndarray],
    face_list_bfs: list[int],
    base_angles: list[float],
    use_sup: list[bool],
    signs: list[int],
    V: np.ndarray,
    faces: list[list[int]],
    uniform_scale: float,
    max_passes: int = 12,
) -> tuple[float, list[bool], list[int]]:
    n_conn = len(base_angles)

    def err() -> float:
        return full_fold_centroid_pairwise_error(
            flat_polys,
            conns_data,
            face_list_bfs,
            base_angles,
            use_sup,
            signs,
            V,
            faces,
            uniform_scale,
        )

    best_global = err()
    for _ in range(max_passes):
        if best_global < 1e-8:
            break
        improved = False
        for i in range(n_conn):
            best_local = float("inf")
            best_su_i, best_sg_i = use_sup[i], signs[i]
            for su in (False, True):
                for sg in (-1, 1):
                    use_sup[i] = su
                    signs[i] = sg
                    e = err()
                    if e < best_local:
                        best_local = e
                        best_su_i, best_sg_i = su, sg
            use_sup[i] = best_su_i
            signs[i] = best_sg_i
            if best_local + 1e-12 < best_global:
                best_global = best_local
                improved = True
        if not improved:
            break
    return best_global, use_sup, signs


def refine_fold_parameters_coordinate_descent(
    conns_data: list[dict],
    flat_polys: dict[int, np.ndarray],
    V: np.ndarray,
    faces: list[list[int]],
    face_list_bfs: list[int],
    uniform_scale: float,
    max_passes: int = 12,
) -> None:
    """
    Discrete search: per hinge use canonical ψ = acos(n·n) or supplement π−ψ, and sign ±1,
    minimizing full-fold pairwise centroid distances vs canonical geometry.
    Random restarts avoid poor local minima from greedy sequential sign assignment.
    Mutates ``foldAngleRad`` (final positive magnitude) and ``foldSign``.
    """
    import random

    random.seed(42)

    n_conn = len(conns_data)
    if n_conn < 1:
        return
    base_angles = [float(c["foldAngleRad"]) for c in conns_data]
    seed_signs = [1 if int(c.get("foldSign", 1)) >= 0 else -1 for c in conns_data]

    # Fewer restarts for large nets (duals can have 60 faces).
    n_restarts = max(4, min(14, 180 // max(n_conn, 1)))
    best_err: float = float("inf")
    best_use: list[bool] = []
    best_sg: list[int] = []

    for r in range(n_restarts + 1):
        if r == 0:
            use_sup = [False] * n_conn
            signs = seed_signs[:]
        else:
            use_sup = [random.choice((False, True)) for _ in range(n_conn)]
            signs = [random.choice((-1, 1)) for _ in range(n_conn)]
        use_sup_c = use_sup[:]
        signs_c = signs[:]
        e, uf, sf = _coordinate_descent_fold_params(
            conns_data,
            flat_polys,
            face_list_bfs,
            base_angles,
            use_sup_c,
            signs_c,
            V,
            faces,
            uniform_scale,
            max_passes=max_passes,
        )
        if e < best_err:
            best_err, best_use, best_sg = e, uf, sf

    for i, c in enumerate(conns_data):
        mag = base_angles[i]
        if best_use[i]:
            mag = float(math.pi - mag)
        c["foldAngleRad"] = mag
        c["foldSign"] = int(best_sg[i])


def try_wattenhofer_weld_polish(
    conns_data: list[dict],
    flat_polys: dict[int, np.ndarray],
    face_orders: dict[int, list[int]],
    face_list_bfs: list[int],
    V: np.ndarray,
    faces: list[list[int]],
    oc: np.ndarray,
    *,
    weld_rel_tol: float = 1.05,
) -> None:
    """
    Continuous least-squares weld (Wattenhofer-style) on top of discrete refine.
    Mutates ``foldAngleRad`` / ``foldSign`` when scipy is available and weld norm
    does not worsen beyond ``weld_rel_tol`` times the initial weld norm.
    """
    try:
        import sys

        td = str(Path(__file__).resolve().parent)
        if td not in sys.path:
            sys.path.insert(0, td)
        import wattenhofer_fold_opt as wh
    except ImportError:
        return
    out = wh.optimize_fold_angles_wattenhofer(
        conns_data,
        flat_polys,
        face_orders,
        face_list_bfs,
        V,
        faces,
        oc,
    )
    if out is None:
        return
    th, wn, w0 = out
    if w0 < 1e-14:
        if wn < 1e-10:
            wh.apply_optimized_thetas_to_conns(conns_data, th)
        return
    if wn <= w0 * weld_rel_tol + 1e-12:
        wh.apply_optimized_thetas_to_conns(conns_data, th)


def side_of_edge(px, pz, rx, rz, vx, vz):
    return vx * (pz - rz) - vz * (px - rx)


def reflect_across_edge(pts: np.ndarray, fr: np.ndarray, fs: np.ndarray) -> None:
    mx = (fr[0] + fs[0]) * 0.5
    mz = (fr[1] + fs[1]) * 0.5
    ux = fs[0] - fr[0]
    uz = fs[1] - fr[1]
    ln = math.hypot(ux, uz)
    if ln < 1e-12:
        return
    ux /= ln
    uz /= ln
    for i in range(len(pts)):
        vx = pts[i, 0] - mx
        vz = pts[i, 1] - mz
        along = vx * ux + vz * uz
        px = mx + along * ux
        pz = mz + along * uz
        pts[i, 0] = 2 * px - pts[i, 0]
        pts[i, 1] = 2 * pz - pts[i, 1]


def unfold_flip_if_overlap(
    flap: np.ndarray,
    parent: np.ndarray,
    r_idx: int,
    s_idx: int,
    fr: np.ndarray,
    fs: np.ndarray,
) -> None:
    vx = fs[0] - fr[0]
    vz = fs[1] - fr[1]
    if vx * vx + vz * vz < 1e-12:
        return
    pcx = float(parent[:, 0].mean())
    pcz = float(parent[:, 1].mean())
    parent_side = side_of_edge(pcx, pcz, fr[0], fr[1], vx, vz)
    if abs(parent_side) < 1e-8:
        for vi in range(len(parent)):
            if vi in (r_idx, s_idx):
                continue
            parent_side = side_of_edge(
                parent[vi, 0], parent[vi, 1], fr[0], fr[1], vx, vz
            )
            break
    ncx = float(flap[:, 0].mean())
    ncz = float(flap[:, 1].mean())
    new_side = side_of_edge(ncx, ncz, fr[0], fr[1], vx, vz)
    if (
        abs(parent_side) >= 1e-8
        and abs(new_side) >= 1e-8
        and parent_side * new_side > 0
    ):
        reflect_across_edge(flap, fr, fs)


def place_flap(
    parent_xz: np.ndarray,
    child_template_xz: np.ndarray,
    pr: int,
    ps: int,
    ci: int,
    cj: int,
) -> np.ndarray:
    W = child_template_xz[cj] - child_template_xz[ci]
    Vvec = parent_xz[ps] - parent_xz[pr]
    dot = W[0] * Vvec[0] + W[1] * Vvec[1]
    det = W[0] * Vvec[1] - W[1] * Vvec[0]
    alpha = math.atan2(det, dot)
    ca, sa = math.cos(alpha), math.sin(alpha)
    rot = np.stack(
        [
            child_template_xz[:, 0] * ca - child_template_xz[:, 1] * sa,
            child_template_xz[:, 0] * sa + child_template_xz[:, 1] * ca,
        ],
        axis=1,
    )
    Fi_m = rot[ci]
    Q = parent_xz[pr] - Fi_m
    out = rot + Q
    fr, fs = parent_xz[pr], parent_xz[ps]
    unfold_flip_if_overlap(out, parent_xz, pr, ps, fr, fs)
    return out


def bfs_order_faces(n_faces: int, adj: dict[int, set[int]]) -> list[int]:
    order = [0]
    seen = {0}
    q = deque([0])
    while q:
        u = q.popleft()
        for v in sorted(adj[u]):
            if v not in seen:
                seen.add(v)
                order.append(v)
                q.append(v)
    if len(order) != n_faces:
        for i in range(n_faces):
            if i not in seen:
                order.append(i)
    return order


def fix_parent_chain_for_net(
    V: np.ndarray, faces: list[list[int]], poly_key: str
) -> dict:
    """Build net with BFS parent assignment; fix edge matching bugs."""
    oc = V.mean(axis=0)
    n_faces = len(faces)
    edge_map = build_edge_to_faces(faces)
    adj: dict[int, set[int]] = defaultdict(set)
    for _e, lst in edge_map.items():
        if len(lst) == 2:
            a, b = lst[0][0], lst[1][0]
            adj[a].add(b)
            adj[b].add(a)

    bfs_order = bfs_order_faces(n_faces, adj)
    face_list_bfs = bfs_order

    flat_polys: dict[int, np.ndarray] = {}
    face_orders: dict[int, list[int]] = {}

    base_fi = face_list_bfs[0]
    xz0, ord0 = flatten_face_to_xz(V, faces[base_fi], oc)
    scale = 3.0 / max(np.max(np.abs(xz0)) + 1e-9, 1.0)
    xz0 = xz0 * scale
    flat_polys[1] = xz0
    face_orders[1] = ord0

    conns_data: list[dict] = []

    for slot, fi in enumerate(face_list_bfs[1:], start=2):
        parent_fi = None
        for pj in face_list_bfs:
            if pj == fi:
                break
            if find_shared_edge(fi, pj, faces) is not None:
                parent_fi = pj
                break
        if parent_fi is None:
            raise RuntimeError(f"No parent for face {fi}")

        p_app = face_list_bfs.index(parent_fi) + 1
        c_app = slot

        sh = find_shared_edge(fi, parent_fi, faces)
        if sh is None:
            raise RuntimeError("shared edge")
        (_va, _vb), i_on_child, i_on_parent = sh

        child_template, cord = flatten_face_to_xz(V, faces[fi], oc)
        child_template = child_template * scale

        parent_xz = flat_polys[p_app]
        p_order = face_orders[p_app]
        va, vb = faces[parent_fi][i_on_parent], faces[parent_fi][
            (i_on_parent + 1) % len(faces[parent_fi])
        ]
        pr = p_order.index(va)
        ps = p_order.index(vb)

        cord_list = cord
        va_c, vb_c = faces[fi][i_on_child], faces[fi][(i_on_child + 1) % len(faces[fi])]
        ci = cord_list.index(va_c)
        cj = cord_list.index(vb_c)

        placed = place_flap(parent_xz, child_template, pr, ps, ci, cj)
        flat_polys[c_app] = placed
        face_orders[c_app] = cord_list

        fold_rad = dihedral_fold_angle(V, faces, fi, parent_fi, oc)

        verts_json = [[float(x), float(z)] for x, z in placed]
        conns_data.append(
            {
                "from": c_app,
                "to": p_app,
                "fromEdge": [ci, cj],
                "toEdge": [pr, ps],
                "color": "#B8A9D9",
                "vertices": verts_json,
                "foldAngleRad": fold_rad,
            }
        )

    assign_fold_signs_by_sequential_simulation(
        conns_data,
        flat_polys,
        V,
        faces,
        face_list_bfs,
        scale,
    )
    refine_fold_parameters_coordinate_descent(
        conns_data,
        flat_polys,
        V,
        faces,
        face_list_bfs,
        scale,
    )
    try_wattenhofer_weld_polish(
        conns_data,
        flat_polys,
        face_orders,
        face_list_bfs,
        V,
        faces,
        oc,
    )

    base_verts = [[float(x), float(z)] for x, z in flat_polys[1]]
    return {
        "description": f"{poly_key} (generated)",
        "polyKey": poly_key,
        "baseFace": {"vertices": base_verts, "color": "#9B8FC9"},
        "connections": conns_data,
    }


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Generate Catalan solid net JSON files from dmccooey.com data.",
    )
    ap.add_argument(
        "--only",
        metavar="NAME",
        help=(
            "Generate a single solid only. Match remote stem (e.g. TriakisTetrahedron), "
            "output stem (triakis-tetrahedron), polyKey, or display name."
        ),
    )
    args = ap.parse_args()
    only = (args.only or "").strip()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    catalan_rows = CATALAN_SOURCES
    dual_rows = DUAL_SOURCES
    if only:
        catalan_rows = [r for r in CATALAN_SOURCES if _row_matches_only(r, only)]
        dual_rows = [r for r in DUAL_SOURCES if _row_matches_only(r, only)]
        if not catalan_rows and not dual_rows:
            known = [r[0] for r in CATALAN_SOURCES] + [r[0] for r in DUAL_SOURCES]
            raise SystemExit(
                f"--only {only!r} did not match any source. "
                f"Examples: TriakisTetrahedron, triakis-tetrahedron. Known stems: {', '.join(known)}"
            )

    for stem, file_stem, disp, pkey in catalan_rows:
        print(stem)
        text = fetch(stem)
        V, faces = parse_dmccooey(text)
        data = fix_parent_chain_for_net(V, faces, pkey)
        data["description"] = f"{disp} — Catalan solid; net from dmccooey.com/{stem}.txt (BFS + per-edge fold angles)"
        out = OUT_DIR / f"{file_stem}-net.json"
        out.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print("  ->", out.name)

    for stem, file_stem, disp, pkey in dual_rows:
        print(stem, "(dual)")
        text = fetch(stem)
        V, faces = parse_dmccooey(text)
        Vd, Fd = dual_polyhedron(V, faces)
        data = fix_parent_chain_for_net(Vd, Fd, pkey)
        data["description"] = (
            f"{disp} — Catalan solid (dual of {stem}); net generated in-repo"
        )
        out = OUT_DIR / f"{file_stem}-net.json"
        out.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print("  ->", out.name)


if __name__ == "__main__":
    main()
