/**
 * Net builder: starter shapes, irregular library, SVG parse, saved custom presets (localStorage).
 * Designed so Electron can swap storage for filesystem later.
 */

const STORAGE_KEY = "polyhedraNetFolder.customPresets.v1";

/**
 * Legacy lookup: full polyhedral Schläfli string → first face side count.
 * Free-form text now uses {@link parseSchlafliSymbol}; kept for presets / reference.
 */
export const SCHLAFLI_BASE_SIDES = {
    "{3,3}": 3,
    "{4,3}": 4,
    "{3,4}": 3,
    "{5,3}": 5,
    "{3,5}": 3,
    "{3,4,3,4}": 4,
    "{3,5,3,5}": 5,
    "{3,3,3,3,4}": 3,
    "{3,3,3,3,5}": 3,
};

const SCHLAFLI_MAX_N = 48;

function gcdU(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
        const t = y;
        y = x % y;
        x = t;
    }
    return x || 1;
}

/** Strip optional outer { … } and trim. */
export function normalizeSchlafliInput(raw) {
    if (raw == null || typeof raw !== "string") return "";
    let t = raw.trim();
    if (t.startsWith("{") && t.endsWith("}")) {
        t = t.slice(1, -1).trim();
    }
    return t;
}

/**
 * Vertices [[x,z],…] for regular star polygon {n/m} in xz, first edge length = edgeLength.
 * Winding matches the main app’s regular n-gon (first vertex at bottom-ish).
 */
export function starPolygonVerticesXZ(n, m, edgeLength) {
    const g = gcdU(n, m);
    if (g !== 1) {
        throw new Error(`{${n}/${m}}: n and m must be coprime.`);
    }
    if (n < 3 || n > SCHLAFLI_MAX_N) {
        throw new Error(`n must be between 3 and ${SCHLAFLI_MAX_N}.`);
    }
    if (m < 1 || 2 * m >= n) {
        throw new Error("For a star polygon use 1 ≤ m < n/2 (e.g. 5/2, 7/3).");
    }
    const sinChord = Math.sin((Math.PI * m) / n);
    if (sinChord < 1e-9) {
        throw new Error("Degenerate star polygon.");
    }
    const R = edgeLength / (2 * sinChord);
    const angleStep = (2 * Math.PI) / n;
    const startAngle = -Math.PI / 2 - Math.PI / n;
    const verts = [];
    for (let k = 0; k < n; k++) {
        const idx = (k * m) % n;
        const ang = startAngle + idx * angleStep;
        verts.push([R * Math.cos(ang), R * Math.sin(ang)]);
    }
    return verts;
}

/**
 * Parse Schläfli-style text into a base face:
 * - Integer n → regular n-gon ({@link noSides}).
 * - n/m → regular star polygon vertices (first edge length = edgeLength).
 * - Polyhedral `{p,q,…}` → first entry only: p or p/q as above.
 *
 * @param {string} raw - e.g. "6", "{5/2}", "7/3", "{4,3}"
 * @param {number} edgeLength - chord length for the first edge (hinge / unit scale)
 * @returns {{ noSides: number } | { vertices: number[][] }}
 */
export function schlafliTextToFaceSpec(raw, edgeLength) {
    const inner = normalizeSchlafliInput(raw);
    if (!inner) {
        throw new Error("Enter a Schläfli symbol (e.g. 6 or 5/2).");
    }
    const firstToken = inner.split(",")[0].trim();
    if (!firstToken) {
        throw new Error("Enter a Schläfli symbol (e.g. 6 or 5/2).");
    }
    const frac = firstToken.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (frac) {
        const n = parseInt(frac[1], 10);
        const m = parseInt(frac[2], 10);
        if (
            !Number.isFinite(edgeLength) ||
            edgeLength <= 0
        ) {
            throw new Error("Invalid edge length for star polygon.");
        }
        const vertices = starPolygonVerticesXZ(n, m, edgeLength);
        return { vertices };
    }
    const intOnly = firstToken.match(/^(\d+)$/);
    if (intOnly) {
        const n = parseInt(intOnly[1], 10);
        if (n < 3 || n > SCHLAFLI_MAX_N) {
            throw new Error(
                `Side count must be between 3 and ${SCHLAFLI_MAX_N}.`,
            );
        }
        return { noSides: n };
    }
    throw new Error(
        `Could not parse "${raw}". Try an integer (6), a star n/m (5/2), or polyhedral {4,3}.`,
    );
}

/** Named irregular polygons in flat net xz coordinates ([x,z] each). */
export const IRREGULAR_POLYGON_LIBRARY = {
    isosceles_triangle: {
        name: "Isosceles triangle",
        vertices: [
            [0, 0],
            [4, 0],
            [2, 3],
        ],
    },
    scalene_triangle: {
        name: "Scalene triangle",
        vertices: [
            [0, 0],
            [5, 0],
            [1.2, 2.8],
        ],
    },
    trapezoid: {
        name: "Trapezoid",
        vertices: [
            [0, 0],
            [4, 0],
            [3.2, 2],
            [0.8, 2],
        ],
    },
    rhombus: {
        name: "Rhombus",
        vertices: [
            [0, 0],
            [3, 0],
            [4.72, 2.46],
            [1.72, 2.46],
        ],
    },
    kite_symmetric: {
        name: "Kite",
        vertices: [
            [0, -0.85],
            [2.5, 0],
            [0, 2.9],
            [-2.5, 0],
        ],
    },
    kite_quad: {
        name: "Kite quadrilateral",
        vertices: [
            [0, 0],
            [3, 0],
            [2.7, 2.5],
            [-0.2, 2.8],
        ],
    },
    irregular_quad: {
        name: "Irregular quadrilateral",
        vertices: [
            [0, 0],
            [3.5, 0.25],
            [2.9, 2.5],
            [-0.3, 1.7],
        ],
    },
    house_pent: {
        name: "House pentagon",
        vertices: [
            [0, 0],
            [3, 0],
            [3, 1.8],
            [1.5, 3.2],
            [0, 1.8],
        ],
    },
    irregular_pentagon: {
        name: "Irregular pentagon",
        vertices: [
            [0, 0],
            [3.2, 0],
            [3.8, 1.6],
            [1.4, 3],
            [-0.6, 1.1],
        ],
    },
    skinny_hex: {
        name: "Elongated hexagon",
        vertices: [
            [0, 0],
            [1.5, 0],
            [2.2, 1.3],
            [1.5, 2.6],
            [0, 2.6],
            [-0.7, 1.3],
        ],
    },
    irregular_hexagon: {
        name: "Irregular hexagon",
        vertices: [
            [0, 0],
            [2.6, 0],
            [3.6, 1.1],
            [3, 2.7],
            [0.9, 3.2],
            [-0.9, 1.4],
        ],
    },
};

export function loadCustomPresetsFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

export function saveCustomPresetsToStorage(presets) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function makePresetId() {
    return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parse minimal SVG containing <polygon points="..."/> or a single <path d="M...Z"/>.
 * Returns vertices as [[x,z],...] with y=0, or null.
 */
export function parseSvgPolygonToNetVertices(svgText) {
    if (!svgText || typeof svgText !== "string") return null;
    const trimmed = svgText.trim();
    const poly = trimmed.match(
        /<polygon[^>]*points\s*=\s*["']([^"']+)["']/i,
    );
    if (poly) {
        return parsePointsString(poly[1]);
    }
    const path = trimmed.match(/<path[^>]*d\s*=\s*["']([^"']+)["']/i);
    if (path) {
        return parsePathDToVertices(path[1]);
    }
    return null;
}

function parsePointsString(str) {
    const nums = str
        .trim()
        .split(/[\s,]+/)
        .map((s) => parseFloat(s))
        .filter((n) => Number.isFinite(n));
    if (nums.length < 6 || nums.length % 2 !== 0) return null;
    const out = [];
    for (let i = 0; i < nums.length; i += 2) {
        out.push([nums[i], nums[i + 1]]);
    }
    if (out.length < 3) return null;
    return dedupeClosePoints(out);
}

function parsePathDToVertices(d) {
    const tokens = d.match(/[MLZmlz]|[+-]?\d*\.?\d+(?:e[+-]?\d+)?/gi);
    if (!tokens || tokens.length < 4) return null;
    const pts = [];
    let i = 0;
    let cmd = null;
    let cx = 0;
    let cy = 0;
    while (i < tokens.length) {
        const t = tokens[i];
        if (/^[MLZmlz]$/.test(t)) {
            cmd = t.toUpperCase();
            i++;
            continue;
        }
        if (cmd === "M" || cmd === "L") {
            const x = parseFloat(tokens[i]);
            const y = parseFloat(tokens[i + 1]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            cx = x;
            cy = y;
            pts.push([x, y]);
            i += 2;
            cmd = "L";
        } else if (cmd === "Z") {
            break;
        } else {
            i++;
        }
    }
    if (pts.length < 3) return null;
    return dedupeClosePoints(pts);
}

function dedupeClosePoints(pts) {
    const eps = 1e-4;
    const out = [];
    for (const p of pts) {
        const last = out[out.length - 1];
        if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > eps) {
            out.push(p);
        }
    }
    if (out.length >= 3) {
        const a = out[0];
        const b = out[out.length - 1];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= eps) out.pop();
    }
    return out.length >= 3 ? out : null;
}

export function buildStarterNet({
    kind,
    schlafliKey,
    irregularKey,
    color,
    edgeLength = 3,
}) {
    const col = color || "#c9b8e8";
    const L =
        edgeLength != null && Number.isFinite(edgeLength) && edgeLength > 0
            ? edgeLength
            : 3;
    if (kind === "schlafli") {
        const label = String(schlafliKey ?? "").trim() || "Schläfli";
        const spec = schlafliTextToFaceSpec(label, L);
        if (spec.noSides != null) {
            return {
                description: `Custom net (Schläfli ${label})`,
                baseFace: { noSides: spec.noSides, color: col },
                connections: [],
            };
        }
        return {
            description: `Custom net (Schläfli ${label})`,
            baseFace: {
                vertices: spec.vertices.map((p) => [...p]),
                color: col,
            },
            connections: [],
        };
    }
    if (kind === "irregular") {
        const lib = IRREGULAR_POLYGON_LIBRARY[irregularKey];
        if (!lib) throw new Error("Unknown irregular template.");
        return {
            description: `Custom net (${lib.name})`,
            baseFace: { vertices: lib.vertices.map((p) => [...p]), color: col },
            connections: [],
        };
    }
    if (kind === "regular") {
        const n = Number(schlafliKey);
        if (n < 3 || n > 12) throw new Error("Sides must be 3–12.");
        return {
            description: `Custom net (${n}-gon)`,
            baseFace: { noSides: n, color: col },
            connections: [],
        };
    }
    throw new Error("Invalid starter kind.");
}

/**
 * Append a flap to netData. newFaceSpec: { noSides } | { vertices } | { schlafliText }.
 * parentEdge: { parentFaceId, v0, v1 } vertex indices on parent polygon (in allVertices order).
 */
export function getFaceSideCount(netData, faceId) {
    if (faceId === 1) {
        if (netData.baseFace?.vertices)
            return netData.baseFace.vertices.length;
        return netData.baseFace?.noSides ?? null;
    }
    const c = (netData.connections || []).find((x) => x.from === faceId);
    if (!c) return null;
    if (c.vertices) return c.vertices.length;
    return c.noSides;
}

/**
 * @param {object} [options]
 * @param {number} [options.hingeMatchLength] — parent hinge edge length in net space; scales the new face so edge 0–1 matches.
 * @param {number} [options.referenceSideLength] — app base edge length (same L as resolveNetFaceVertices); required with hingeMatchLength for regular n-gons.
 */
export function appendFlapToNet(
    netData,
    parentEdge,
    newFaceSpec,
    color,
    options = {},
) {
    const conns = netData.connections || [];
    const nextFrom = 2 + conns.length;
    const parentId = parentEdge.parentFaceId;
    const parentSides = getFaceSideCount(netData, parentId);
    if (parentSides == null || parentSides < 3) {
        throw new Error("Could not determine parent face size.");
    }
    const a = parentEdge.v0;
    const b = parentEdge.v1;
    if (a < 0 || b < 0 || a >= parentSides || b >= parentSides) {
        throw new Error("Invalid parent edge indices.");
    }
    const adjacent =
        b === (a + 1) % parentSides || a === (b + 1) % parentSides;
    if (!adjacent) throw new Error("Vertices must be adjacent on the face.");
    const conn = {
        from: nextFrom,
        to: parentId,
        fromEdge: [0, 1],
        toEdge: [a, b],
        color: color || "#b8a9d9",
    };
    applyFlapShapeSpecToConnection(conn, newFaceSpec, options);
    const usedKey = edgeKey(parentId, parentEdge.v0, parentEdge.v1);
    return { connection: conn, nextFrom, usedKey };
}

/**
 * Set noSides / vertices / vertexScale on an existing connection object (mutates).
 * Used when attaching a new flap and when replacing an attached face's shape.
 */
export function applyFlapShapeSpecToConnection(conn, newFaceSpec, options = {}) {
    const hm = options.hingeMatchLength;
    const hingeOk = hm != null && Number.isFinite(hm) && hm > 0;
    const refL = options.referenceSideLength ?? 3;
    const edgeLenForShape = hingeOk ? hm : refL;

    delete conn.noSides;
    delete conn.vertices;
    delete conn.vertexScale;

    if (newFaceSpec.schlafliText != null) {
        const spec = schlafliTextToFaceSpec(
            String(newFaceSpec.schlafliText),
            edgeLenForShape,
        );
        if (spec.noSides != null) {
            conn.noSides = spec.noSides;
            if (
                hingeOk &&
                refL != null &&
                Number.isFinite(refL) &&
                refL > 0
            ) {
                conn.vertexScale = hm / refL;
            }
        } else {
            conn.vertices = spec.vertices.map((p) => [...p]);
        }
    } else if (newFaceSpec.vertices) {
        conn.vertices = newFaceSpec.vertices.map((p) => [...p]);
        if (hingeOk) {
            const v0 = conn.vertices[0];
            const v1 = conn.vertices[1];
            const x0 = v0[0];
            const z0 = v0.length === 2 ? v0[1] : v0[2];
            const x1 = v1[0];
            const z1 = v1.length === 2 ? v1[1] : v1[2];
            const d = Math.hypot(x1 - x0, z1 - z0);
            if (d > 1e-9) {
                const s = hm / d;
                for (const p of conn.vertices) {
                    if (p.length === 2) {
                        p[0] *= s;
                        p[1] *= s;
                    } else {
                        p[0] *= s;
                        p[1] *= s;
                        p[2] *= s;
                    }
                }
            }
        }
    } else if (newFaceSpec.noSides != null) {
        conn.noSides = newFaceSpec.noSides;
        if (
            hingeOk &&
            refL != null &&
            Number.isFinite(refL) &&
            refL > 0
        ) {
            conn.vertexScale = hm / refL;
        }
    } else {
        throw new Error(
            "Invalid new face: need Schläfli text, vertices, or noSides.",
        );
    }
}

function childFaceIdsAttachedTo(netData, parentFaceId) {
    const out = [];
    for (const c of netData.connections || []) {
        if (c.to === parentFaceId) out.push(c.from);
    }
    return out;
}

/** All faces in the subtree rooted at rootFaceId (including root). */
export function collectSubtreeFaceIds(netData, rootFaceId) {
    const out = new Set([rootFaceId]);
    const stack = [rootFaceId];
    while (stack.length) {
        const p = stack.pop();
        for (const cid of childFaceIdsAttachedTo(netData, p)) {
            if (!out.has(cid)) {
                out.add(cid);
                stack.push(cid);
            }
        }
    }
    return out;
}

/** Descendants only (faces attached below parentFaceId, not parent itself). */
export function collectDescendantFaceIds(netData, parentFaceId) {
    const out = new Set();
    const stack = [...childFaceIdsAttachedTo(netData, parentFaceId)];
    while (stack.length) {
        const id = stack.pop();
        if (out.has(id)) continue;
        out.add(id);
        for (const cid of childFaceIdsAttachedTo(netData, id)) stack.push(cid);
    }
    return out;
}

/**
 * Renumber faces to consecutive 1…N (base = 1, BFS order). Keeps connection order valid for loaders.
 */
export function canonicalizeNetFaceIds(netData) {
    const conns = netData.connections || [];
    const present = new Set([1]);
    for (const c of conns) present.add(c.from);

    const order = [];
    const visited = new Set();
    const queue = [1];
    visited.add(1);
    while (queue.length) {
        const u = queue.shift();
        order.push(u);
        const children = conns
            .filter((c) => c.to === u)
            .map((c) => c.from)
            .sort((a, b) => a - b);
        for (const v of children) {
            if (!visited.has(v)) {
                visited.add(v);
                queue.push(v);
            }
        }
    }

    if (visited.size !== present.size) {
        throw new Error("Net graph is disconnected or has orphan faces; cannot canonicalize.");
    }
    for (const c of conns) {
        if (!visited.has(c.from) || !visited.has(c.to)) {
            throw new Error(
                "Net has invalid parent/child references; cannot canonicalize.",
            );
        }
    }

    const map = new Map();
    for (let i = 0; i < order.length; i++) {
        map.set(order[i], i + 1);
    }

    for (const c of conns) {
        c.from = map.get(c.from);
        c.to = map.get(c.to);
    }
    netData.connections = conns.slice().sort((a, b) => a.from - b.from);
}

/**
 * Remove a face and everything attached to it. Face 1 removes all flaps (connections only).
 * Renumbers remaining faces to consecutive IDs.
 */
export function removeFaceSubtreeFromNet(netData, faceId) {
    if (faceId === 1) {
        netData.connections = [];
        canonicalizeNetFaceIds(netData);
        return;
    }
    const subtree = collectSubtreeFaceIds(netData, faceId);
    netData.connections = (netData.connections || []).filter(
        (c) => !subtree.has(c.from),
    );
    canonicalizeNetFaceIds(netData);
}

/**
 * Apply shape spec to baseFace (mutates baseFace). Clears all connections if side count changes.
 */
export function replaceBaseFaceInNet(netData, newFaceSpec, color, options = {}) {
    const refL = options.referenceSideLength ?? 3;
    const prevSides = getFaceSideCount(netData, 1);
    const base = netData.baseFace;
    if (!base) throw new Error("Missing baseFace.");

    delete base.noSides;
    delete base.vertices;
    delete base.vertexScale;

    if (newFaceSpec.schlafliText != null) {
        const spec = schlafliTextToFaceSpec(
            String(newFaceSpec.schlafliText),
            refL,
        );
        if (spec.noSides != null) {
            base.noSides = spec.noSides;
        } else {
            base.vertices = spec.vertices.map((p) => [...p]);
        }
    } else if (newFaceSpec.vertices) {
        base.vertices = newFaceSpec.vertices.map((p) => [...p]);
    } else if (newFaceSpec.noSides != null) {
        base.noSides = newFaceSpec.noSides;
    } else {
        throw new Error("Invalid base face spec.");
    }

    if (color != null && color !== "") base.color = color;

    const nextSides = getFaceSideCount(netData, 1);
    if (prevSides != null && nextSides != null && prevSides !== nextSides) {
        netData.connections = [];
    }
    canonicalizeNetFaceIds(netData);
}

/**
 * Replace geometry for an attached face (from ≥ 2). Optionally drops descendants if side count changes.
 */
export function replaceAttachedFaceShapeInNet(
    netData,
    faceId,
    newFaceSpec,
    color,
    options = {},
) {
    if (faceId < 2) {
        throw new Error("Use replaceBaseFaceInNet for the base polygon.");
    }
    const conns = netData.connections || [];
    const conn = conns.find((c) => c.from === faceId);
    if (!conn) throw new Error(`No connection for face ${faceId}.`);

    const prevSides = getFaceSideCount(netData, faceId);
    const hm = options.hingeMatchLength;
    const hingeOk = hm != null && Number.isFinite(hm) && hm > 0;
    if (!hingeOk) {
        throw new Error("replaceAttachedFaceShapeInNet requires hingeMatchLength.");
    }

    applyFlapShapeSpecToConnection(conn, newFaceSpec, {
        hingeMatchLength: hm,
        referenceSideLength: options.referenceSideLength ?? 3,
    });
    if (color != null && color !== "") conn.color = color;

    const nextSides = conn.noSides ?? conn.vertices?.length ?? null;
    if (
        prevSides != null &&
        nextSides != null &&
        prevSides !== nextSides &&
        collectDescendantFaceIds(netData, faceId).size > 0
    ) {
        const drop = collectDescendantFaceIds(netData, faceId);
        netData.connections = conns.filter((c) => !drop.has(c.from));
    }
    canonicalizeNetFaceIds(netData);
}

export function edgeKey(faceId, a, b) {
    return `${faceId}:${Math.min(a, b)}:${Math.max(a, b)}`;
}
