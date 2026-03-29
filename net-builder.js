/**
 * Net builder: starter shapes, irregular library, SVG parse, saved custom presets (localStorage).
 * Designed so Electron can swap storage for filesystem later.
 */

const STORAGE_KEY = "polyhedraNetFolder.customPresets.v1";

/** Schläfli symbol → regular base face side count (first face type of the solid). */
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

/** Named irregular polygons in flat net xz coordinates ([x,z] each). */
export const IRREGULAR_POLYGON_LIBRARY = {
    kite_quad: {
        name: "Kite quadrilateral",
        vertices: [
            [0, 0],
            [3, 0],
            [2.7, 2.5],
            [-0.2, 2.8],
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

export function buildStarterNet({ kind, schlafliKey, irregularKey, color }) {
    const col = color || "#c9b8e8";
    if (kind === "schlafli") {
        const n = SCHLAFLI_BASE_SIDES[schlafliKey];
        if (!n)
            throw new Error("Unknown Schläfli symbol for starter face.");
        return {
            description: `Custom net (Schläfli base ${schlafliKey})`,
            baseFace: { noSides: n, color: col },
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
 * Append a flap to netData. newFaceSpec: { noSides } | { vertices }.
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
    const hm = options.hingeMatchLength;
    const hingeOk =
        hm != null && Number.isFinite(hm) && hm > 0;
    if (newFaceSpec.vertices) {
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
    } else {
        conn.noSides = newFaceSpec.noSides;
        const refL = options.referenceSideLength;
        if (
            hingeOk &&
            refL != null &&
            Number.isFinite(refL) &&
            refL > 0
        ) {
            conn.vertexScale = hm / refL;
        }
    }
    const usedKey = edgeKey(parentId, parentEdge.v0, parentEdge.v1);
    return { connection: conn, nextFrom, usedKey };
}

export function edgeKey(faceId, a, b) {
    return `${faceId}:${Math.min(a, b)}:${Math.max(a, b)}`;
}
