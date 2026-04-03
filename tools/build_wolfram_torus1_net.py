#!/usr/bin/env python3
"""
Build 01-FOLD JSON for Wolfram toroidal polyhedron #1 from
FiveToroidalPolyhedraAndTheirNets (9 quads, genus 1).

Outputs nets/torus-wolfram-1-net.json with per-connection foldAngleRad.
"""
from __future__ import annotations

import itertools
import json
import math
from collections import defaultdict, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EPS = 1e-2

# 3D solid vertices (0-based)
V = [
    [-2.0, 3.464102, 1.732051],
    [-2.0, 3.464102, -1.732051],
    [-2.0, -3.464102, -1.732051],
    [-2.0, -3.464102, 1.732051],
    [-3.5, 6.062178, 0.0],
    [-3.5, -6.062178, 0.0],
    [4.0, 0.0, -1.732051],
    [4.0, 0.0, 1.732051],
    [7.0, 0.0, 0.0],
]

FACES = [
    [0, 1, 2, 3],
    [1, 4, 5, 2],
    [4, 0, 3, 5],
    [3, 2, 6, 7],
    [2, 5, 8, 6],
    [5, 3, 7, 8],
    [7, 6, 1, 0],
    [6, 8, 4, 1],
    [8, 7, 0, 4],
]

RAW_POLYS = [
    [[0, 0], [-5.196152, 4.582576], [-7.48744, 1.984499], [-2.291288, -2.598076]],
    [[0, 0], [3.464102, 0], [-5.629165, 8.019507], [-5.196152, 4.582576]],
    [[-5.629165, 8.019507], [3.464102, 0], [3.031089, 3.436932], [-2.165064, 8.019507]],
    [[-5.196152, 11.456439], [0, 16.039015], [-2.291288, 18.637091], [-7.48744, 14.054515]],
    [[-5.629165, 8.019507], [3.464102, 16.039015], [0, 16.039015], [-5.196152, 11.456439]],
    [[-5.629165, 8.019507], [-2.165064, 8.019507], [3.031089, 12.602083], [3.464102, 16.039015]],
    [[10.717064, 6.587453], [6.81995, 0.859233], [9.68406, -1.089324], [13.581174, 4.638895]],
    [[10.284052, 10.024384], [3.464102, 0], [6.81995, 0.859233], [10.717064, 6.587453]],
    [[3.031089, 3.436932], [3.464102, 0], [10.284052, 10.024384], [6.928203, 9.165151]],
]


def sub(a, b):
    return [a[i] - b[i] for i in range(3)]


def cross(a, b):
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]


def dot(a, b):
    return sum(a[i] * b[i] for i in range(3))


def norm(a):
    return math.sqrt(dot(a, a))


def normalize(a):
    n = norm(a)
    if n < 1e-12:
        return a
    return [a[i] / n for i in range(3)]


def face_normal_3d(face_idx: int) -> list[float]:
    verts = FACES[face_idx]
    p0 = V[verts[0]]
    p1 = V[verts[1]]
    p2 = V[verts[2]]
    e1 = sub(p1, p0)
    e2 = sub(p2, p0)
    return normalize(cross(e1, e2))


def dihedral_angle_rad(face_child: int, face_parent: int, v_i: int, v_j: int) -> float:
    """
    Signed fold angle consistent with 01-FOLD: same magnitude as supplement of
    interior dihedral; sign fixed by orienting the hinge (lower global vertex first)
    so atan2 is stable per edge.
    """
    if v_i > v_j:
        v_i, v_j = v_j, v_i
    n_a = face_normal_3d(face_child)
    n_b = face_normal_3d(face_parent)
    edge = sub(V[v_j], V[v_i])
    e = normalize(edge)
    m = cross(n_a, e)
    x = dot(n_a, n_b)
    y = dot(m, n_b)
    return math.atan2(y, x)


def edge_key(i: int, j: int) -> tuple[int, int]:
    return (i, j) if i < j else (j, i)


def pdist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def poly_shared_edge_len(poly_a, poly_b) -> float | None:
    """If the two quads share a full edge in the plane, return its length."""
    for ka in range(4):
        a0, a1 = poly_a[ka], poly_a[(ka + 1) % 4]
        for kb in range(4):
            b0, b1 = poly_b[kb], poly_b[(kb + 1) % 4]
            if pdist(a0, b0) < EPS and pdist(a1, b1) < EPS:
                return round(pdist(a0, a1), 4)
            if pdist(a0, b1) < EPS and pdist(a1, b0) < EPS:
                return round(pdist(a0, a1), 4)
    return None


def net_tree_edges() -> list[tuple[int, int, float]]:
    """Undirected edges between polygons that share a hinge in the 2D layout (spanning tree)."""
    n = len(RAW_POLYS)
    out: list[tuple[int, int, float]] = []
    for i in range(n):
        for j in range(i + 1, n):
            sl = poly_shared_edge_len(RAW_POLYS[i], RAW_POLYS[j])
            if sl is not None:
                out.append((i, j, sl))
    return out


def faces_share_edge_len(fa: int, fb: int) -> float | None:
    verts_a, verts_b = FACES[fa], FACES[fb]
    for ka in range(4):
        a0, a1 = verts_a[ka], verts_a[(ka + 1) % 4]
        ek = edge_key(a0, a1)
        for kb in range(4):
            b0, b1 = verts_b[kb], verts_b[(kb + 1) % 4]
            if edge_key(b0, b1) == ek:
                return round(norm(sub(V[a0], V[a1])), 4)
    return None


def match_polys_to_faces() -> list[int]:
    """
    inv[poly_i] = solid face index for that net polygon.
    Every 2D tree edge must coincide with a 3D edge of the same length.
    """
    nf = len(FACES)
    tree = net_tree_edges()
    if len(tree) != nf - 1:
        raise RuntimeError(f"Expected {nf - 1} net edges, got {len(tree)}")

    for inv in itertools.permutations(range(nf), nf):
        # inv[pi] = face index for polygon pi
        ok = True
        for pa, pb, L in tree:
            fa, fb = inv[pa], inv[pb]
            if fa == fb:
                ok = False
                break
            g = faces_share_edge_len(fa, fb)
            if g is None or abs(g - L) > 0.08:
                ok = False
                break
        if ok:
            # face fi uses polygon poly_perm[fi]
            poly_perm = [0] * nf
            for pi in range(nf):
                poly_perm[inv[pi]] = pi
            return poly_perm
    raise RuntimeError("No bijection matches net tree to 3D solid edges")


def orientations_for_face(fi: int, poly) -> list[list[int]]:
    """corner_gid[k] = global vertex index at poly corner k (CCW in 2D)."""
    fv = FACES[fi]
    lf = [round(norm(sub(V[fv[i]], V[fv[(i + 1) % 4]])), 3) for i in range(4)]
    out: list[list[int]] = []
    for rot in range(4):
        for rev in (False, True):
            seq = [(rot + (i if not rev else -i)) % 4 for i in range(4)]
            ok = True
            for i in range(4):
                a, b = seq[i], seq[(i + 1) % 4]
                le = round(pdist(poly[a], poly[b]), 3)
                if abs(le - lf[i]) > 0.06:
                    ok = False
                    break
            if not ok:
                continue
            g = [0] * 4
            for i in range(4):
                g[seq[i]] = fv[i]
            out.append(g)
    return out


def net_adjacency() -> dict[int, list[int]]:
    """Neighbors in the 2D net (spanning tree edges)."""
    n = len(RAW_POLYS)
    adj: dict[int, list[int]] = {i: [] for i in range(n)}
    for i in range(n):
        for j in range(i + 1, n):
            if poly_shared_edge_len(RAW_POLYS[i], RAW_POLYS[j]) is not None:
                adj[i].append(j)
                adj[j].append(i)
    return adj


def find_shared_poly_edge(poly_a, poly_b):
    """Return (ka, kb, ja, jb, rev) for shared boundary segment."""
    for ka in range(4):
        kb = (ka + 1) % 4
        a0, a1 = poly_a[ka], poly_a[kb]
        for ja in range(4):
            jb = (ja + 1) % 4
            b0, b1 = poly_b[ja], poly_b[jb]
            if pdist(a0, b0) < EPS and pdist(a1, b1) < EPS:
                return ka, kb, ja, jb, False
            if pdist(a0, b1) < EPS and pdist(a1, b0) < EPS:
                return ka, kb, ja, jb, True
    return None


def assign_corners(poly_perm: list[int]) -> list[list[int]]:
    """
    Backtrack orientations so each 2D net edge joins matching global vertices.
    poly_perm[fi] = polygon index for solid face fi.
    """
    nf = len(FACES)
    adj_poly = net_adjacency()
    poly_of_face = poly_perm
    face_of_poly = [0] * nf
    for fi in range(nf):
        face_of_poly[poly_of_face[fi]] = fi

    def pick_next(cg: list[list[int] | None]) -> int | None:
        if all(c is None for c in cg):
            return 0
        best_fi = None
        best_n = -1
        for fi in range(nf):
            if cg[fi] is not None:
                continue
            nbr_assigned = 0
            for nb_pi in adj_poly[poly_of_face[fi]]:
                if cg[face_of_poly[nb_pi]] is not None:
                    nbr_assigned += 1
            if nbr_assigned > best_n:
                best_n = nbr_assigned
                best_fi = fi
        return best_fi

    def consistent_with_neighbors(fi: int, cand: list[int], cg: list[list[int] | None]) -> bool:
        poly_pi = poly_of_face[fi]
        poly = RAW_POLYS[poly_pi]
        for nb_pi in adj_poly[poly_pi]:
            nfi = face_of_poly[nb_pi]
            gnb = cg[nfi]
            if gnb is None:
                continue
            sh = find_shared_poly_edge(poly, RAW_POLYS[nb_pi])
            if sh is None:
                return False
            ka, kb, ja, jb, rev = sh
            if not rev:
                va, vb = gnb[ja], gnb[jb]
            else:
                va, vb = gnb[jb], gnb[ja]
            if not (
                (cand[ka] == va and cand[kb] == vb)
                or (cand[ka] == vb and cand[kb] == va)
            ):
                return False
        return True

    def backtrack(cg: list[list[int] | None]) -> bool:
        if all(cg[i] is not None for i in range(nf)):
            return True
        fi = pick_next(cg)
        if fi is None:
            return False
        poly_pi = poly_of_face[fi]
        poly = RAW_POLYS[poly_pi]
        for cand in orientations_for_face(fi, poly):
            if not consistent_with_neighbors(fi, cand, cg):
                continue
            cg[fi] = cand
            if backtrack(cg):
                return True
            cg[fi] = None
        return False

    cg: list[list[int] | None] = [None] * nf
    if not backtrack(cg):
        raise RuntimeError("Could not assign corners (backtrack)")
    return [cg[i] for i in range(nf)]  # type: ignore


def local_edge_from_global(face_idx: int, corner_gid: list[list[int]], va: int, vb: int) -> tuple[int, int]:
    cv = corner_gid[face_idx]
    ia, ib = cv.index(va), cv.index(vb)
    if (ib - ia) % 4 == 1:
        return ia, ib
    if (ia - ib) % 4 == 1:
        return ib, ia
    raise RuntimeError(f"Bad edge {va}-{vb} on face {face_idx}")


def build_wolfram_torus_1_data():
    """
    Build net dict + topology metadata (for JSON export and diagnostics).
    Returns (net_dict, meta) where meta has bfs_order, tree_edges, etc.
    """
    poly_perm = match_polys_to_faces()
    corner_gid = assign_corners(poly_perm)
    for fi in range(len(FACES)):
        if set(corner_gid[fi]) != set(FACES[fi]):
            raise RuntimeError(f"face {fi} vertex set mismatch")

    # Hinges must be exactly the edges present in the 2D net layout (8 for 9
    # quads). Using all 18 solid–solid adjacencies (BFS on the 3D mesh) adds
    # “virtual” hinges along cut edges and collapses the layout — overlapping
    # faces at fold 0. See nets = {m1,...} in the Wolfram .nb (same as m1 here).
    nf = len(FACES)
    face_of_poly = [0] * nf
    for fi in range(nf):
        face_of_poly[poly_perm[fi]] = fi
    adj_poly = net_adjacency()
    undirected: list[tuple[int, int, int, int]] = []
    for pa in range(nf):
        for pb in adj_poly[pa]:
            if pa >= pb:
                continue
            fa, fb = face_of_poly[pa], face_of_poly[pb]
            sh = find_shared_poly_edge(RAW_POLYS[pa], RAW_POLYS[pb])
            if sh is None:
                continue
            ka, kb, ja, jb, rev = sh
            va_a, va_b = corner_gid[fa][ka], corner_gid[fa][kb]
            vb_a, vb_b = corner_gid[fb][ja], corner_gid[fb][jb]
            if rev:
                vb_a, vb_b = vb_b, vb_a
            if {va_a, va_b} != {vb_a, vb_b}:
                raise RuntimeError(
                    f"Net edge poly {pa}-{pb}: corner map mismatch {va_a},{va_b} vs {vb_a},{vb_b}"
                )
            va, vb = va_a, va_b
            undirected.append((fa, fb, va, vb))

    if len(undirected) != nf - 1:
        raise RuntimeError(f"Expected {nf - 1} net hinges, found {len(undirected)}")

    adj_f: dict[int, list[tuple[int, int, int]]] = defaultdict(list)
    for fa, fb, va, vb in undirected:
        adj_f[fa].append((fb, va, vb))
        adj_f[fb].append((fa, va, vb))

    parent: dict[int, int | None] = {0: None}
    tree_edges: list[tuple[int, int, int, int]] = []
    queue = [0]
    seen = {0}
    while queue:
        fi = queue.pop(0)
        # Stable BFS: same order as face-id remap below.
        for fb, va, vb in sorted(adj_f[fi], key=lambda t: t[0]):
            if fb in seen:
                continue
            seen.add(fb)
            parent[fb] = fi
            tree_edges.append((fb, fi, va, vb))
            queue.append(fb)

    if len(seen) != nf:
        raise RuntimeError("Net hinge graph not connected")

    # 01-FOLD ties animation stage s to face id (s+1): getPivotsForStage /
    # applyFoldPlayhead. So the k-th folded flap must have from == k+1, with
    # parent faces already folded (smaller ids). Remap solid indices to BFS order.
    bfs_order: list[int] = []
    qb = deque([0])
    seen_b: set[int] = {0}
    while qb:
        u = qb.popleft()
        bfs_order.append(u)
        for fb, _, _ in sorted(adj_f[u], key=lambda t: t[0]):
            if fb not in seen_b:
                seen_b.add(fb)
                qb.append(fb)
    if len(bfs_order) != nf:
        raise RuntimeError("BFS order mismatch")
    old_to_new_app: dict[int, int] = {
        old: pos + 1 for pos, old in enumerate(bfs_order)
    }

    connections = []
    for gj, fi, va, vb in tree_edges:
        c_lo = local_edge_from_global(gj, corner_gid, va, vb)
        p_lo = local_edge_from_global(fi, corner_gid, va, vb)
        ang = dihedral_angle_rad(gj, fi, va, vb)
        connections.append(
            {
                "from": old_to_new_app[gj],
                "to": old_to_new_app[fi],
                "vertices": [[p[0], p[1]] for p in RAW_POLYS[poly_perm[gj]]],
                "color": "#c9b8a8",
                "fromEdge": list(c_lo),
                "toEdge": list(p_lo),
                "foldAngleRad": round(ang, 6),
            }
        )

    connections.sort(key=lambda c: c["from"])

    base_poly = RAW_POLYS[poly_perm[0]]
    net = {
        "description": "Toroidal polyhedron 1 (9 quads) — Wolfram FiveToroidalPolyhedraAndTheirNets. Face ids 2–9 follow net BFS so stage k folds face k+1.",
        "source": "https://demonstrations.wolfram.com/FiveToroidalPolyhedraAndTheirNets/",
        "baseFace": {
            "vertices": [[p[0], p[1]] for p in base_poly],
            "color": "#d4c4b4",
        },
        "connections": connections,
    }
    meta = {
        "poly_perm": poly_perm,
        "corner_gid": corner_gid,
        "bfs_order": bfs_order,
        "old_to_new_app": old_to_new_app,
        "tree_edges": list(tree_edges),
    }
    return net, meta


def main():
    net, meta = build_wolfram_torus_1_data()
    print("Poly perm:", meta["poly_perm"])
    print("BFS solid face index order (0-based):", meta["bfs_order"])
    out = ROOT / "nets" / "torus-wolfram-1-net.json"
    out.write_text(json.dumps(net, indent=2) + "\n", encoding="utf-8")
    print("Wrote", out)
    for c in net["connections"]:
        print(c["from"], "->", c["to"], "angle", c["foldAngleRad"])


if __name__ == "__main__":
    main()
