#!/usr/bin/env python3
"""
Fold a 2D polygon net into a 3D polyhedron by solving for hinge dihedral angles.

Model
-----
- Vertices live in R^2 with global indices; each face is a CCW loop of indices.
- Adjacent faces share an undirected edge (two vertex indices).
- Pick a spanning tree on the face adjacency graph. Along each tree edge we
  introduce one scalar dihedral angle (rotation about the common edge in 3D).
- Root face stays in z = 0 using its 2D coordinates as (x, y, 0).

For a given set of dihedrals, rigid transforms M_f (4x4) are propagated from the
root so each face maps its net coordinates (x, y, 0) into R^3. Weld errors are
the differences between 3D positions of the same global vertex computed from
any two incident faces.

PolyhedraNetFolder (viewer vs this solver)
------------------------------------------
The viewer lays nets in the xz plane (y = 0). Pass the same numeric pairs as
``vertices2d``: first column = x, second = z (lifted to (x, z, 0) in code).

**Kinematic mismatch:** ``face_world_matrices*`` builds each child transform as
``R_dih @ R_align`` about the parent-welded edge, with a fixed +Z leaf normal
before folding. The app (``script.js`` / ``createNetFromData``) uses a **nested
pivot** tree: each hinge stores ``userData.axis`` in pivot-local space and
applies ``setFromAxisAngle(axis, foldSign * foldAngleRad)`` after a **different**
in-plane flap alignment. Angles that weld vertices under *this* model are **not**
the same numbers as ``foldAngleRad`` / ``foldSign`` in net JSON — a tetrahedron
net can show ~0 weld error in the viewer while ``weld_residuals_expanded`` here
stays large at the same scalar thetas. Unifying the two would mean either
changing the viewer to match these face matrices, or deriving a mapping from
solver thetas to pivot quaternions (non-trivial).

**ExpandedNet:** Catalan-style layouts reuse the same solid vertex index on
multiple faces at **different** 2D positions; use ``ExpandedNet`` +
``fold_net_with_hinges_expanded`` so weld terms compare the right corner copies.

Requires: numpy, scipy (see tools/requirements-catalan.txt).

Caveats
-------
- The fully flat configuration (all dihedrals 0) often satisfies weld closure for
  a developable net but is not a closed polyhedron. Use ``anchor_dihedrals`` or
  ``nonflat_hints`` to steer the solver toward a popped-up shape.
- This is a local nonlinear least-squares problem; good initial guesses matter.

Example
-------
  python tools/fold_net.py
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Iterable, Sequence

import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation as SciRotation


# ---------------------------------------------------------------------------
# Small linear-algebra helpers
# ---------------------------------------------------------------------------


def _hom(p: np.ndarray) -> np.ndarray:
    p = np.asarray(p, dtype=float).reshape(-1)
    if p.size == 2:
        return np.array([p[0], p[1], 0.0, 1.0])
    if p.size == 3:
        return np.array([p[0], p[1], p[2], 1.0])
    raise ValueError("point must be 2D or 3D")


def _apply_affine(M: np.ndarray, p: np.ndarray) -> np.ndarray:
    return (M @ _hom(p))[:3]


def _unit(v: np.ndarray) -> np.ndarray:
    v = np.asarray(v, dtype=float).reshape(-1)
    n = np.linalg.norm(v)
    if n < 1e-15:
        raise ValueError("zero-length vector")
    return v / n


def _face_normal_from_indices(
    verts2d: np.ndarray, face: Sequence[int]
) -> np.ndarray:
    """Unnormalized normal of face lifted to z=0 (points +Z for CCW in xy)."""
    idx = list(face)
    if len(idx) < 3:
        raise ValueError("face needs at least 3 vertices")
    c = np.zeros(3)
    o = verts2d[idx[0]]
    for i in range(1, len(idx) - 1):
        a = verts2d[idx[i]] - o
        b = verts2d[idx[i + 1]] - o
        a3 = np.array([a[0], a[1], 0.0])
        b3 = np.array([b[0], b[1], 0.0])
        c += np.cross(a3, b3)
    return c


def rotation_from_edge_and_normals(
    q_a: np.ndarray,
    q_b: np.ndarray,
    p_a: np.ndarray,
    p_b: np.ndarray,
    n_target: np.ndarray,
) -> np.ndarray:
    """
    Rigid rotation R (3x3) such that:
      R @ (q_k - q_a) + p_a maps the edge direction to parent edge direction
      and maps flat normal +Z to n_target.
    """
    u = _unit(q_b - q_a)
    v = _unit(p_b - p_a)
    n_target = _unit(n_target)
    ez = np.array([0.0, 0.0, 1.0])
    w_ch = np.cross(ez, u)
    if np.linalg.norm(w_ch) < 1e-12:
        w_ch = np.array([0.0, 1.0, 0.0])
    w_ch = _unit(w_ch)
    n_ch = np.cross(u, w_ch)
    if np.linalg.norm(n_ch) < 1e-12:
        n_ch = ez
    else:
        n_ch = _unit(n_ch)

    w_pa = np.cross(n_target, v)
    if np.linalg.norm(w_pa) < 1e-12:
        raise ValueError("degenerate parent edge/normal")
    w_pa = _unit(w_pa)
    n_pa = _unit(np.cross(v, w_pa))

    A = np.column_stack([u, w_ch, n_ch])
    B = np.column_stack([v, w_pa, n_pa])
    R = B @ np.linalg.inv(A)
    # Project to SO(3)
    U, _, Vt = np.linalg.svd(R)
    R = U @ Vt
    if np.linalg.det(R) < 0:
        U[:, -1] *= -1.0
        R = U @ Vt
    return R


def rodrigues(axis: np.ndarray, angle: float) -> np.ndarray:
    axis = _unit(axis)
    return SciRotation.from_rotvec(axis * angle).as_matrix()


# ---------------------------------------------------------------------------
# Net topology
# ---------------------------------------------------------------------------


@dataclass
class Net:
    """2D coordinates (N,2) and faces as CCW loops of vertex indices."""

    vertices2d: np.ndarray
    faces: list[list[int]]

    def __post_init__(self) -> None:
        self.vertices2d = np.asarray(self.vertices2d, dtype=float)
        if self.vertices2d.ndim != 2 or self.vertices2d.shape[1] != 2:
            raise ValueError("vertices2d must be shape (N, 2)")


@dataclass
class Hinge:
    face_parent: int
    face_child: int
    a: int
    b: int


def _undirected_edge(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


def build_face_adjacency(net: Net) -> dict[tuple[int, int], list[int]]:
    edge_faces: dict[tuple[int, int], list[int]] = defaultdict(list)
    for fi, face in enumerate(net.faces):
        m = len(face)
        for j in range(m):
            e = _undirected_edge(face[j], face[(j + 1) % m])
            edge_faces[e].append(fi)
    for e, fl in edge_faces.items():
        if len(fl) > 2:
            raise ValueError(f"edge {e} belongs to more than two faces: {fl}")
    return edge_faces


def build_spanning_tree(
    net: Net, edge_faces: dict[tuple[int, int], list[int]], root: int = 0
) -> tuple[list[Hinge], list[tuple[int, int]]]:
    """Return tree hinges (parent->child) and chords (extra adjacency edges)."""
    n_faces = len(net.faces)
    adj: list[list[int]] = [[] for _ in range(n_faces)]
    edge_by_pair: dict[tuple[int, int], tuple[int, int]] = {}
    for e, fl in edge_faces.items():
        if len(fl) != 2:
            continue
        i, j = fl[0], fl[1]
        edge_by_pair[(i, j)] = e
        edge_by_pair[(j, i)] = e
        adj[i].append(j)
        adj[j].append(i)

    for i in range(n_faces):
        adj[i].sort()

    visited = [False] * n_faces
    parent: list[int | None] = [None] * n_faces
    hinges: list[Hinge] = []
    q: deque[int] = deque([root])
    visited[root] = True
    while q:
        f = q.popleft()
        for g in adj[f]:
            if not visited[g]:
                visited[g] = True
                parent[g] = f
                ea, eb = edge_by_pair[(f, g)]
                hinges.append(Hinge(face_parent=f, face_child=g, a=ea, b=eb))
                q.append(g)
    if not all(visited):
        raise ValueError("face adjacency graph is not connected")

    tree_edge_set = {_undirected_edge(h.a, h.b) for h in hinges}
    chords: list[tuple[int, int]] = []
    for e in edge_faces:
        if len(edge_faces[e]) != 2:
            continue
        if e not in tree_edge_set:
            chords.append(e)
    return hinges, chords


def faces_incident_on_vertex(net: Net) -> list[list[int]]:
    incident: list[list[int]] = [[] for _ in range(len(net.vertices2d))]
    for fi, face in enumerate(net.faces):
        for v in face:
            incident[v].append(fi)
    for v in range(len(incident)):
        incident[v] = sorted(set(incident[v]))
    return incident


# ---------------------------------------------------------------------------
# Transforms from dihedral tree parameters
# ---------------------------------------------------------------------------


def face_world_matrices(
    net: Net,
    hinges: Sequence[Hinge],
    thetas: Sequence[float],
    root: int = 0,
) -> list[np.ndarray]:
    if len(hinges) != len(thetas):
        raise ValueError("len(thetas) must match number of tree hinges")

    n = len(net.faces)
    M: list[np.ndarray | None] = [None] * n
    M[root] = np.eye(4)

    hinge_by_child = {h.face_child: (hi, h) for hi, h in enumerate(hinges)}

    children: list[list[int]] = [[] for _ in range(n)]
    for hi, h in enumerate(hinges):
        children[h.face_parent].append(h.face_child)

    order: list[int] = []
    dq: deque[int] = deque([root])
    while dq:
        f = dq.popleft()
        order.append(f)
        for c in sorted(children[f]):
            dq.append(c)

    verts3 = np.zeros((len(net.vertices2d), 3))
    verts3[:, :2] = net.vertices2d

    for f in order:
        if M[f] is None:
            continue
        Rf = M[f][:3, :3]
        n_f = Rf @ np.array([0.0, 0.0, 1.0])

        for c in sorted(children[f]):
            hi, h = hinge_by_child[c]
            theta = thetas[hi]

            q_a = verts3[h.a]
            q_b = verts3[h.b]
            p_a = _apply_affine(M[f], q_a[:2])
            p_b = _apply_affine(M[f], q_b[:2])

            R_align = rotation_from_edge_and_normals(q_a, q_b, p_a, p_b, n_f)
            axis = p_b - p_a
            R_dih = rodrigues(axis, theta)
            R_child = R_dih @ R_align
            t_child = p_a - R_child @ q_a
            Mc = np.eye(4)
            Mc[:3, :3] = R_child
            Mc[:3, 3] = t_child
            M[c] = Mc

    if any(m is None for m in M):
        raise RuntimeError("failed to assign all face transforms")
    return [m.copy() for m in M]  # type: ignore[return-value]


def weld_residuals(
    net: Net,
    hinges: Sequence[Hinge],
    thetas: Iterable[float],
    incident_faces: Sequence[Sequence[int]],
    *,
    root: int = 0,
    anchor_dihedrals: dict[int, float] | None = None,
    anchor_weight: float = 10.0,
    nonflat_hints: Sequence[tuple[int, float]] | None = None,
    nonflat_weight: float = 0.5,
) -> np.ndarray:
    thetas_arr = np.asarray(list(thetas), dtype=float)
    Ms = face_world_matrices(net, hinges, thetas_arr, root=root)
    blocks: list[np.ndarray] = []

    for v, flist in enumerate(incident_faces):
        if len(flist) < 2:
            continue
        p0 = _apply_affine(Ms[flist[0]], net.vertices2d[v])
        for f in flist[1:]:
            p = _apply_affine(Ms[f], net.vertices2d[v])
            blocks.append(p - p0)

    if anchor_dihedrals:
        for idx, target in anchor_dihedrals.items():
            blocks.append(np.array([anchor_weight * (thetas_arr[idx] - target)]))

    if nonflat_hints:
        for idx, target in nonflat_hints:
            blocks.append(np.array([nonflat_weight * (thetas_arr[idx] - target)]))

    if not blocks:
        return np.zeros(0)
    return np.concatenate(blocks)


@dataclass
class FoldResult:
    hinges: list[Hinge]
    thetas: np.ndarray
    face_transforms: list[np.ndarray]
    vertices3d_computed: np.ndarray
    success: bool
    message: str
    cost: float


def fold_net(
    net: Net,
    *,
    theta0: Sequence[float] | None = None,
    anchor_dihedrals: dict[int, float] | None = None,
    anchor_weight: float = 10.0,
    nonflat_hints: Sequence[tuple[int, float]] | None = None,
    nonflat_weight: float = 0.5,
    root_face: int = 0,
    verbose: int = 0,
) -> FoldResult:
    """
    Solve for hinge dihedrals that best weld vertices in 3D.

    anchor_dihedrals: map tree-hinge index -> angle in radians (soft constraint).
    nonflat_hints: optional (hinge_index, angle_rad) soft targets to leave the flat sheet.
    """
    edge_faces = build_face_adjacency(net)
    hinges, _chords = build_spanning_tree(net, edge_faces, root=root_face)
    nh = len(hinges)
    if theta0 is None:
        x0 = np.zeros(nh)
    else:
        x0 = np.asarray(theta0, dtype=float).reshape(-1)
        if x0.shape[0] != nh:
            raise ValueError(f"theta0 length {x0.shape[0]} != num hinges {nh}")

    incident = faces_incident_on_vertex(net)

    def fun(x: np.ndarray) -> np.ndarray:
        return weld_residuals(
            net,
            hinges,
            x,
            incident,
            root=root_face,
            anchor_dihedrals=anchor_dihedrals,
            anchor_weight=anchor_weight,
            nonflat_hints=nonflat_hints,
            nonflat_weight=nonflat_weight,
        )

    r0 = fun(x0)
    if r0.size == 0:
        raise ValueError("no residuals (isolated vertices only?)")

    res = least_squares(
        fun,
        x0,
        method="lm" if r0.size > x0.size else "trf",
        verbose=verbose,
        ftol=1e-12,
        xtol=1e-12,
        gtol=1e-12,
    )

    th = res.x
    Ms = face_world_matrices(net, hinges, th, root=root_face)
    verts_acc = np.zeros((len(net.vertices2d), 3))
    counts = np.zeros(len(net.vertices2d))
    for v in range(len(net.vertices2d)):
        for f in incident[v]:
            verts_acc[v] += _apply_affine(Ms[f], net.vertices2d[v])
            counts[v] += 1.0
    counts = np.maximum(counts, 1.0)
    verts3d = verts_acc / counts.reshape(-1, 1)

    return FoldResult(
        hinges=hinges,
        thetas=th,
        face_transforms=Ms,
        vertices3d_computed=verts3d,
        success=res.success,
        message=res.message,
        cost=float(res.cost),
    )


def fold_net_with_hinges(
    net: Net,
    hinges: Sequence[Hinge],
    *,
    theta0: Sequence[float] | None = None,
    anchor_dihedrals: dict[int, float] | None = None,
    anchor_weight: float = 3.0,
    nonflat_hints: Sequence[tuple[int, float]] | None = None,
    nonflat_weight: float = 0.25,
    root_face: int = 0,
    verbose: int = 0,
) -> FoldResult:
    """
    Like ``fold_net`` but uses a fixed spanning tree (hinges must list each
    non-root face exactly once as ``face_child``).
    """
    nh = len(hinges)
    if nh != len(net.faces) - 1:
        raise ValueError("hinges count must be #faces - 1")
    children: dict[int, list[int]] = defaultdict(list)
    for h in hinges:
        children[h.face_parent].append(h.face_child)
    seen_child: set[int] = set()
    for h in hinges:
        if h.face_child in seen_child:
            raise ValueError(f"duplicate child face {h.face_child} in hinges")
        seen_child.add(h.face_child)
    for fi in range(len(net.faces)):
        if fi == root_face:
            continue
        if fi not in seen_child:
            raise ValueError(f"face {fi} not a child of any hinge")

    if theta0 is None:
        x0 = np.zeros(nh)
    else:
        x0 = np.asarray(theta0, dtype=float).reshape(-1)
        if x0.shape[0] != nh:
            raise ValueError(f"theta0 length {x0.shape[0]} != num hinges {nh}")

    incident = faces_incident_on_vertex(net)

    def fun(x: np.ndarray) -> np.ndarray:
        return weld_residuals(
            net,
            hinges,
            x,
            incident,
            root=root_face,
            anchor_dihedrals=anchor_dihedrals,
            anchor_weight=anchor_weight,
            nonflat_hints=nonflat_hints,
            nonflat_weight=nonflat_weight,
        )

    r0 = fun(x0)
    if r0.size == 0:
        raise ValueError("no residuals (isolated vertices only?)")

    lo = np.full(nh, -np.pi + 1e-3)
    hi = np.full(nh, np.pi - 1e-3)
    res = least_squares(
        fun,
        x0,
        method="trf",
        bounds=(lo, hi),
        verbose=verbose,
        ftol=1e-10,
        xtol=1e-10,
        gtol=1e-10,
        max_nfev=max(200, nh * 80),
    )

    th = res.x
    Ms = face_world_matrices(net, hinges, th, root=root_face)
    verts_acc = np.zeros((len(net.vertices2d), 3))
    counts = np.zeros(len(net.vertices2d))
    for v in range(len(net.vertices2d)):
        for f in incident[v]:
            verts_acc[v] += _apply_affine(Ms[f], net.vertices2d[v])
            counts[v] += 1.0
    counts = np.maximum(counts, 1.0)
    verts3d = verts_acc / counts.reshape(-1, 1)

    return FoldResult(
        hinges=list(hinges),
        thetas=th,
        face_transforms=Ms,
        vertices3d_computed=verts3d,
        success=res.success,
        message=res.message,
        cost=float(res.cost),
    )


# ---------------------------------------------------------------------------
# Expanded net: one 2D point per face corner (same solid vertex may appear at
# different places in the flat layout). Weld residuals tie corners sharing
# ``global_vid`` to one 3D position.
# ---------------------------------------------------------------------------


@dataclass
class ExpandedNet:
    vertices2d: np.ndarray  # (Ncorn, 2)
    faces: list[list[int]]  # corner indices per face
    global_vid: np.ndarray  # (Ncorn,) solid vertex id
    corner_face: np.ndarray  # (Ncorn,) face index owning each corner


def build_incident_by_global(en: ExpandedNet) -> list[list[int]]:
    mg = int(np.max(en.global_vid))
    incident: list[list[int]] = [[] for _ in range(mg + 1)]
    for j, g in enumerate(en.global_vid.astype(int).tolist()):
        incident[g].append(j)
    return incident


def face_world_matrices_expanded(
    en: ExpandedNet,
    hinges: Sequence[Hinge],
    thetas: Sequence[float],
    root: int = 0,
) -> list[np.ndarray]:
    if len(hinges) != len(thetas):
        raise ValueError("len(thetas) must match number of tree hinges")

    n = len(en.faces)
    M: list[np.ndarray | None] = [None] * n
    M[root] = np.eye(4)

    hinge_by_child = {h.face_child: (hi, h) for hi, h in enumerate(hinges)}

    children: list[list[int]] = [[] for _ in range(n)]
    for hi, h in enumerate(hinges):
        children[h.face_parent].append(h.face_child)

    order: list[int] = []
    dq: deque[int] = deque([root])
    while dq:
        f = dq.popleft()
        order.append(f)
        for c in sorted(children[f]):
            dq.append(c)

    nc = len(en.vertices2d)
    verts3 = np.zeros((nc, 3))
    verts3[:, :2] = en.vertices2d

    for f in order:
        if M[f] is None:
            continue
        Rf = M[f][:3, :3]
        n_f = Rf @ np.array([0.0, 0.0, 1.0])

        for c in sorted(children[f]):
            hi, h = hinge_by_child[c]
            theta = thetas[hi]

            q_a = verts3[h.a]
            q_b = verts3[h.b]
            p_a = _apply_affine(M[f], q_a[:2])
            p_b = _apply_affine(M[f], q_b[:2])

            R_align = rotation_from_edge_and_normals(q_a, q_b, p_a, p_b, n_f)
            axis = p_b - p_a
            R_dih = rodrigues(axis, theta)
            R_child = R_dih @ R_align
            t_child = p_a - R_child @ q_a
            Mc = np.eye(4)
            Mc[:3, :3] = R_child
            Mc[:3, 3] = t_child
            M[c] = Mc

    if any(m is None for m in M):
        raise RuntimeError("failed to assign all face transforms")
    return [m.copy() for m in M]  # type: ignore[return-value]


def weld_residuals_expanded(
    en: ExpandedNet,
    hinges: Sequence[Hinge],
    thetas: Iterable[float],
    incident_by_global: Sequence[Sequence[int]],
    *,
    root: int = 0,
    anchor_dihedrals: dict[int, float] | None = None,
    anchor_weight: float = 3.0,
    nonflat_hints: Sequence[tuple[int, float]] | None = None,
    nonflat_weight: float = 0.25,
) -> np.ndarray:
    thetas_arr = np.asarray(list(thetas), dtype=float)
    Ms = face_world_matrices_expanded(en, hinges, thetas_arr, root=root)
    blocks: list[np.ndarray] = []

    for js in incident_by_global:
        if len(js) < 2:
            continue
        j0 = int(js[0])
        f0 = int(en.corner_face[j0])
        p0 = _apply_affine(Ms[f0], en.vertices2d[j0])
        for j in js[1:]:
            j = int(j)
            f = int(en.corner_face[j])
            p = _apply_affine(Ms[f], en.vertices2d[j])
            blocks.append(p - p0)

    if anchor_dihedrals:
        for idx, target in anchor_dihedrals.items():
            blocks.append(np.array([anchor_weight * (thetas_arr[idx] - target)]))

    if nonflat_hints:
        for idx, target in nonflat_hints:
            blocks.append(np.array([nonflat_weight * (thetas_arr[idx] - target)]))

    if not blocks:
        return np.zeros(0)
    return np.concatenate(blocks)


def _vertices3d_averaged_by_global(
    en: ExpandedNet, Ms: Sequence[np.ndarray]
) -> np.ndarray:
    mg = int(np.max(en.global_vid))
    acc = np.zeros((mg + 1, 3))
    cnt = np.zeros(mg + 1)
    for j in range(len(en.vertices2d)):
        g = int(en.global_vid[j])
        f = int(en.corner_face[j])
        acc[g] += _apply_affine(Ms[f], en.vertices2d[j])
        cnt[g] += 1.0
    cnt = np.maximum(cnt, 1.0)
    return acc / cnt.reshape(-1, 1)


def fold_net_with_hinges_expanded(
    en: ExpandedNet,
    hinges: Sequence[Hinge],
    *,
    theta0: Sequence[float] | None = None,
    anchor_dihedrals: dict[int, float] | None = None,
    anchor_weight: float = 3.0,
    nonflat_hints: Sequence[tuple[int, float]] | None = None,
    nonflat_weight: float = 0.25,
    root_face: int = 0,
    verbose: int = 0,
) -> FoldResult:
    nh = len(hinges)
    if theta0 is None:
        x0 = np.zeros(nh)
    else:
        x0 = np.asarray(theta0, dtype=float).reshape(-1)
        if x0.shape[0] != nh:
            raise ValueError(f"theta0 length {x0.shape[0]} != num hinges {nh}")

    incident = build_incident_by_global(en)

    def fun(x: np.ndarray) -> np.ndarray:
        return weld_residuals_expanded(
            en,
            hinges,
            x,
            incident,
            root=root_face,
            anchor_dihedrals=anchor_dihedrals,
            anchor_weight=anchor_weight,
            nonflat_hints=nonflat_hints,
            nonflat_weight=nonflat_weight,
        )

    r0 = fun(x0)
    if r0.size == 0:
        raise ValueError("no residuals")

    lo = np.full(nh, -np.pi + 1e-3)
    hi = np.full(nh, np.pi - 1e-3)
    res = least_squares(
        fun,
        x0,
        method="trf",
        bounds=(lo, hi),
        verbose=verbose,
        ftol=1e-10,
        xtol=1e-10,
        gtol=1e-10,
        max_nfev=max(200, nh * 80),
    )

    th = res.x
    Ms = face_world_matrices_expanded(en, hinges, th, root=root_face)
    verts3d = _vertices3d_averaged_by_global(en, Ms)

    return FoldResult(
        hinges=list(hinges),
        thetas=th,
        face_transforms=Ms,
        vertices3d_computed=verts3d,
        success=res.success,
        message=res.message,
        cost=float(res.cost),
    )


# ---------------------------------------------------------------------------
# Example: six-square cube cross (side length 1), CCW faces in the plane
# ---------------------------------------------------------------------------


def cube_net_cross() -> Net:
    """Standard + layout: center, right, top, left, bottom, back (lid)."""
    verts = np.array(
        [
            [0.0, 0.0],
            [1.0, 0.0],
            [1.0, 1.0],
            [0.0, 1.0],
            [2.0, 0.0],
            [2.0, 1.0],
            [1.0, 2.0],
            [0.0, 2.0],
            [1.0, -1.0],
            [0.0, -1.0],
            [-1.0, 0.0],
            [-1.0, 1.0],
            [1.0, 3.0],
            [0.0, 3.0],
        ]
    )
    faces = [
        [0, 1, 2, 3],
        [1, 4, 5, 2],
        [3, 2, 6, 7],
        [11, 10, 0, 3],
        [9, 8, 1, 0],
        [7, 6, 12, 13],
    ]
    return Net(vertices2d=verts, faces=faces)


def _demo() -> None:
    net = cube_net_cross()
    edge_faces = build_face_adjacency(net)
    hinges, chords = build_spanning_tree(net, edge_faces, root=0)
    print("Hinges from spanning tree (parent -> child, edge a-b):")
    for i, h in enumerate(hinges):
        print(f"  [{i}] face {h.face_parent} -> {h.face_child}, edge ({h.a},{h.b})")
    if chords:
        print("Chord edges (cycles):", chords)

    hints = [(k, np.pi / 2) for k in range(len(hinges))]
    out = fold_net(
        net,
        theta0=np.full(len(hinges), 0.2),
        nonflat_hints=hints,
        nonflat_weight=0.05,
        verbose=0,
    )
    print(f"Solver: success={out.success}, {out.message}, cost={out.cost:.3e}")
    print("Dihedrals (deg):", np.degrees(out.thetas).round(2))
    r = weld_residuals(
        net, hinges, out.thetas, faces_incident_on_vertex(net), root=0
    )
    print("Weld residual L2 norm:", float(np.linalg.norm(r)))


if __name__ == "__main__":
    _demo()
