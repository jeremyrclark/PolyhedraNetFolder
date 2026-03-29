// Polyhedra Net Folder — script v1.38

// --- Imports ---
import * as THREE from "three";
import { OrbitControls } from "./js/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import * as NetBuilder from "./net-builder.js";

// --- Global Variables ---
let scene;
let camera;
let renderer;
let controls;
const pivots = {};
const allVertices = {}; // Stores calculated initial world vertices for net layout
let f1Mesh = null;
const normalHelpers = {}; // Stores references to ArrowHelper objects

// --- Configuration ---
const sideLength = 3;
const TRANSLUCENT_FACE_OPACITY = 0.48;
let NUM_ANIMATION_STAGES = 0; // Initialized to 0, set when net is loaded
let currentAnimationDuration = 500; // Default speed

// --- Animation State ---
let isFolded = false;
let isAnimating = false;
let isPaused = false;
let animationStartTime = 0;
let pausedElapsedTime = 0;
let currentAnimationStage = 0;
let startQuaternions = {}; // Use let for reset
let targetQuaternions = {}; // Use let for reset
let pivotsInCurrentStage = [];

// --- DOM Elements ---
let foldButton;
let pauseButton;
let speedSlider;
let speedValueSpan;
let toggleNormalsCheckbox;
let netFileInput;
let infoDisplay;
let exportObjButton;
let exportPngButton;
let exportSvgButton;
let darkCanvasCheckbox;
let renderModeSlider;
let exitBuilderBtn = null;
let ambientLight;
let hemiLight;
let directionalLight;
let fillLight;
let shadowGround = null;

/** Net builder: interactive CREATE mode */
let edgePickGroup = null;
let isNetBuilderActive = false;
let builderNetData = null;
const builderUsedEdgeKeys = new Set();
let builderHoveredPick = null;
let builderPendingEdge = null;
const pointerNDC = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let builderHintEl = null;
let createKindSelect;
let createRegularSides;
let createSchlafliInput;
let attachSchlafliInput;
let createIrregularSelect;
let createSvgTextarea;
let createColorInput;
let builderPanelEl;
let builderAttachPanel;
let attachNewFaceKind;
let attachRegularSides;
let attachIrregularSelect;
let attachColorInput;
let saveNetFeedbackEl = null;
let saveNetFeedbackTimer = null;
/** Unsaved builder edits (lost on exit / load unless saved to Saved nets). */
let builderDirty = false;
let builderSelectedFaceId = null;
let editFaceKindSelect = null;
let editFaceRegularSidesSelect = null;
let editFaceSchlafliInputEl = null;
let editFaceIrregularSelectEl = null;
let editFaceColorInputEl = null;
let builderFacePanelEl = null;

const RENDER_MODES = ["wireframe", "translucent", "flat", "rendered"];
let currentRenderModeIndex = 2;

// --- Data Tables ---

// Color Name Lookup
const COLOR_NAME_TO_HEX = {
    red: 0xff0000,
    yellow: 0xffff00,
    green: 0x00ff00,
    blue: 0x0000ff,
    cyan: 0x00ffff,
    magenta: 0xff00ff,
    pink: 0xffc0cb,
    purple: 0x800080,
    teal: 0x008080,
    orange: 0xffa500,
    lime: 0x00ff00,
    indigo: 0x4b0082,
    violet: 0xee82ee,
    gold: 0xffd700,
    silver: 0xc0c0c0,
    gray: 0x808080,
    grey: 0x808080,
    white: 0xffffff,
    black: 0x000000,
};

// *** UPDATED Polyhedron data table - Formatted ***
const POLYHEDRON_DATA = {
    // --- Platonic Solids ---
    "3.3.3": {
        name: "Tetrahedron",
        faceCounts: {
            3: 4,
        },
        foldAngles: {
            "3-3": Math.acos(-1 / 3),
        },
    },
    "4.4.4": {
        name: "Cube (Hexahedron)",
        faceCounts: {
            4: 6,
        },
        foldAngles: {
            "4-4": Math.PI / 2,
        },
    },
    "3.3.3.3": {
        name: "Octahedron",
        faceCounts: {
            3: 8,
        },
        foldAngles: {
            "3-3": Math.acos(1 / 3),
        },
    },
    "5.5.5": {
        name: "Dodecahedron",
        faceCounts: {
            5: 12,
        },
        foldAngles: {
            "5-5": Math.acos(Math.sqrt(5) / 5),
        },
    },
    "3.3.3.3.3": {
        name: "Icosahedron",
        faceCounts: {
            3: 20,
        },
        foldAngles: {
            "3-3": Math.acos(Math.sqrt(5) / 3),
        },
    },
    // --- Archimedean Solids ---
    "3.6.6": {
        name: "Truncated Tetrahedron",
        faceCounts: {
            3: 4,
            6: 4,
        },
        foldAngles: {
            "3-6": Math.acos(1 / 3),
            "6-3": Math.acos(1 / 3),
            "6-6": Math.acos(-1 / 3),
        },
    },
    "3.8.8": {
        name: "Truncated Cube",
        faceCounts: {
            3: 8,
            8: 6,
        },
        foldAngles: {
            "3-8": Math.acos(Math.sqrt(3) / 3),
            "8-3": Math.acos(Math.sqrt(3) / 3),
            "8-8": Math.PI / 2,
        },
    },
    "4.6.6": {
        name: "Truncated Octahedron",
        faceCounts: {
            4: 6,
            6: 8,
        },
        foldAngles: {
            "4-6": Math.acos(1 / Math.sqrt(3)),
            "6-4": Math.acos(1 / Math.sqrt(3)),
            "6-6": Math.acos(1 / 3),
        },
    },
    "3.10.10": {
        name: "Truncated Dodecahedron",
        faceCounts: {
            3: 20,
            10: 12,
        },
        foldAngles: {
            "3-10": 0.6524, // ~37.38
            "10-3": 0.6524, // ~37.38
            "10-10": Math.acos(Math.sqrt(5) / 5)
        },
    },
    "5.6.6": {
        name: "Truncated Icosahedron",
        faceCounts: {
            5: 12,
            6: 20,
        },
        foldAngles: {
            "5-6": Math.acos(Math.sqrt((5 + 2 * Math.sqrt(5)) / 15)),
            "6-5": Math.acos(Math.sqrt((5 + 2 * Math.sqrt(5)) / 15)),
            "6-6": Math.acos(Math.sqrt(5) / 3)
        },
    },
    "3.4.3.4": {
        name: "Cuboctahedron",
        faceCounts: {
            3: 8,
            4: 6,
        },
        foldAngles: {
            "3-4": Math.acos(1 / Math.sqrt(3)),
            "4-3": Math.acos(1 / Math.sqrt(3)),
        },
    },
    "4.6.8": {
        name: "Truncated Cuboctahedron",
        faceCounts: {
            4: 12,
            6: 8,
            8: 6,
        },
        foldAngles: {
            "6-4": 0.6155, // ~35.26
            "4-6": 0.6155, // ~35.26
            "8-4": 0.7854, // 45
            "4-8": 0.7854, // 45
            "8-6": Math.acos(Math.sqrt(3) / 3),
            "6-8": Math.acos(Math.sqrt(3) / 3),
        },
    },
    "3.5.3.5": {
        name: "Icosidodecahedron",
        faceCounts: {
            3: 20,
            5: 12,
        },
        foldAngles: {
            "3-5": 0.6524, // ~37.37
            "5-3": 0.6524, // ~37.37
        },
    },
    "3.4.4.4": {
        name: "Rhombicuboctahedron",
        faceCounts: {
            3: 8,
            4: 18,
        },
        foldAngles: {
            "3-4": Math.acos(Math.sqrt(2 / 3)),
            "4-3": Math.acos(Math.sqrt(2 / 3)),
            "4-4": Math.PI / 4,
        },
    },
    "3.4.5.4": {
        name: "Rhombicosidodecahedron",
        faceCounts: {
            3: 20,
            4: 30,
            5: 12,
        },
        foldAngles: {
            "3-4": Math.acos(Math.sqrt((3 + Math.sqrt(5)) / 6)),
            "4-3": Math.acos(Math.sqrt((3 + Math.sqrt(5)) / 6)),
            "4-5": Math.acos(Math.sqrt((5 + Math.sqrt(5)) / 10)),
            "5-4": Math.acos(Math.sqrt((5 + Math.sqrt(5)) / 10)),
            "4-4": Math.acos((1 + Math.sqrt(5)) / (2 * Math.sqrt(3))),
        },
    },
    "4.6.10": {
	name: "Truncated Icosidodecahedron",
	faceCounts: {
            4: 30,
            6: 20,
            10: 12,
	},
	foldAngles: {
            "4-6":  Math.acos((Math.sqrt(3) + Math.sqrt(15)) / 6), 
            "6-4":  Math.acos((Math.sqrt(3) + Math.sqrt(15)) / 6), 
            "4-10": Math.acos(Math.sqrt((5 + Math.sqrt(5)) / 10)),
            "10-4": Math.acos(Math.sqrt((5 + Math.sqrt(5)) / 10)),
            "10-6": Math.acos(Math.sqrt((5 + (2 * Math.sqrt(5))) / 15)),
            "6-10": Math.acos(Math.sqrt((5 + (2 * Math.sqrt(5))) / 15)),
	},
    },
    "3.3.3.3.4": {
        name: "Snub Cube",
        faceCounts: {
            3: 32,
            4: 6,
        },
        foldAngles: {
            "3-3": 0.4672, // ~26.77 deg
            "3-4": 0.6462, // ~37.02 deg
            "4-3": 0.6462,
        },
    },
    "3.3.3.3.5": {
        name: "Snub Dodecahedron",
        faceCounts: {
            3: 80,
            5: 12,
        },
        foldAngles: {
            "3-3": 0.2762, // ~15.82 deg
            "3-5": 0.4725, // ~27.07 deg
            "5-3": 0.4725,
        },
    },
    "rhombic-dodecahedron": {
        name: "Rhombic Dodecahedron",
        faceCounts: {
            4: 12,
        },
        foldAngles: {
            // Interior dihedral 120° (2π/3); rotation from flat = π − dihedral = π/3
            "4-4": Math.PI / 3,
        },
    },
};

// Helper function to generate a canonical face count signature string
function getFaceCountSignature(counts) {
    return Object.keys(counts)
        .map((key) => parseInt(key))
        .sort((a, b) => a - b)
        .map((key) => `${key}:${counts[key.toString()]}`)
        .join("_");
}

// Reverse lookup table: Signature -> Vertex Config Key
const faceCountSigToVertexConfigKey = {};
for (const key in POLYHEDRON_DATA) {
    const data = POLYHEDRON_DATA[key];
    if (data.faceCounts) {
        const signature = getFaceCountSignature(data.faceCounts);
        faceCountSigToVertexConfigKey[signature] = key;
    }
}
// console.log("Face Count Signatures Map:", faceCountSigToVertexConfigKey);

// Global variable to store fold angles for the currently loaded net
let currentFoldAngles = null;
let currentNetName = "No Net Loaded";
/** ~54.74° — used for missing library keys and for trial folds without a fold table. */
const EXPERIMENTAL_FOLD_ANGLE_RAD = Math.acos(1 / Math.sqrt(3));

const TRIAL_FAIL_FLAVORS = [
    "Those hinges were guesses — not a closed solid.",
    "Nice try! The net doesn’t want to become a polyhedron yet.",
    "Almost dramatic… but that’s not how this one folds.",
    "Wrong recipe. Adjust the net and challenge it again.",
    "The fold table is missing for a reason — keep experimenting.",
    "Physics says *maybe later*. Tweak and run another trial.",
    "Still a flat story. Add or move a face, then retry.",
    "No trophy this round — tap Unfold when you're ready.",
];

let trialFoldRunCount = 0;
let trialFoldPauseActive = false;
let trialBuzzerAudioContext = null;
/** Last net JSON loaded successfully (presets / file); not used while relying on builderNetData in builder. */
let lastLoadedNetData = null;

// --- Helper Functions --- (Unchanged)

/**
 * Parses various color inputs (names, #hex, 0xhex, numbers)
 * into a numerical hex value for Three.js materials.
 * Includes a workaround for missing '#' prefixes on 6-digit hex strings.
 * @param {string | number} colorInput - The color input.
 * @returns {number} The numerical hex value (e.g., 0xFF0000).
 */
function parseColor(colorInput) {
    const defaultColorHex = 0xaaaaaa; // Default gray as a number
    console.log(
        `[DEBUG] parseColor received input: "${colorInput}" (type: ${typeof colorInput})`,
    );

    if (colorInput === null || colorInput === undefined) {
        console.warn(
            `Received null or undefined color input. Using default gray.`,
        );
        return defaultColorHex;
    }

    let processedColorInput = colorInput; // Work with a copy/potentially modified version

    // --- WORKAROUND: Add '#' prefix if missing from likely hex string ---
    if (
        typeof processedColorInput === "string" &&
        processedColorInput.length === 6 && // Is it 6 chars long?
        !processedColorInput.startsWith("#") && // Doesn't already start with #?
        !processedColorInput.startsWith("0x") && // Doesn't start with 0x?
        /^[0-9A-Fa-f]{6}$/i.test(processedColorInput)
    ) {
        // Contains only hex chars (case-insensitive)?
        console.log(
            `[DEBUG] Adding '#' prefix to suspected hex string: "${processedColorInput}"`,
        );
        processedColorInput = "#" + processedColorInput; // Add the prefix
    }
    // --- End Workaround ---

    try {
        // Use THREE.Color constructor with the original or potentially corrected input
        const color = new THREE.Color(processedColorInput);
        const hexValue = color.getHex();
        // Optional: Log success only if prefix was added or input was different
        // if (processedColorInput !== colorInput) {
        console.log(
            `[DEBUG] parseColor successfully parsed "<span class="math-inline">\{processedColorInput\}" to hex\: 0x</span>{hexValue.toString(16)}`,
        );
        // }
        return hexValue;
    } catch (error) {
        // Log error using the processed input for clarity
        console.warn(
            `Invalid color input "<span class="math-inline">\{processedColorInput\}" \(original\: "</span>{colorInput}"). Using default gray. Error: ${error.message}`,
        );
        return defaultColorHex;
    }
}

// Gets current world vertices
function getMeshWorldVertices(faceIndex) {
    let mesh;
    if (faceIndex === 1) mesh = f1Mesh;
    else if (pivots[faceIndex]?.children.length > 0)
        mesh = pivots[faceIndex].children[0];
    else return null;
    if (!mesh?.geometry?.attributes?.position) return null;
    const positions = mesh.geometry.attributes.position;
    const uniqueVerts = new Map();
    const tempVec = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
        tempVec.fromBufferAttribute(positions, i);
        const key = `${tempVec.x.toFixed(5)},${tempVec.y.toFixed(5)},${tempVec.z.toFixed(5)}`;
        if (!uniqueVerts.has(key)) uniqueVerts.set(key, tempVec.clone());
    }
    const uniqueLocalVertices = Array.from(uniqueVerts.values());
    mesh.updateWorldMatrix(true, false);
    const worldVertices = uniqueLocalVertices.map((v) =>
        v.clone().applyMatrix4(mesh.matrixWorld),
    );
    if (allVertices[faceIndex])
        worldVertices.numSides = allVertices[faceIndex].numSides;
    return worldVertices;
}

/**
 * Average world position of all mesh vertices except one face (the flap being folded).
 * Used to pick fold sign so the flap closes toward the rest of the net.
 */
function computeBulkCentroidWorldExcludingFace(excludeFaceId) {
    const sum = new THREE.Vector3();
    let count = 0;
    const addFace = (fid) => {
        if (fid === excludeFaceId) return;
        const wv = getMeshWorldVertices(fid);
        if (!wv) return;
        for (let i = 0; i < wv.length; i++) {
            const v = wv[i];
            if (v instanceof THREE.Vector3) {
                sum.add(v);
                count++;
            }
        }
    };
    addFace(1);
    for (const key of Object.keys(pivots)) {
        const fid = parseInt(key, 10);
        if (!Number.isNaN(fid)) addFace(fid);
    }
    return count > 0 ? sum.divideScalar(count) : null;
}

// Calculates world normal
function calculateWorldNormal(worldVerts) {
    if (!worldVerts || worldVerts.length < 3) return new THREE.Vector3(0, 1, 0);
    const [vA, vB, vC] = worldVerts;
    if (
        !(
            vA instanceof THREE.Vector3 &&
            vB instanceof THREE.Vector3 &&
            vC instanceof THREE.Vector3
        )
    )
        return new THREE.Vector3(0, 1, 0);
    const edge1 = new THREE.Vector3().subVectors(vB, vA);
    const edge2 = new THREE.Vector3().subVectors(vC, vA);
    return new THREE.Vector3().crossVectors(edge1, edge2).normalize();
}

// Calculates world centroid
function calculateWorldCentroid(worldVerts) {
    const center = new THREE.Vector3();
    let count = 0;
    if (!worldVerts) return center;
    for (let i = 0; i < worldVerts.length; ++i) {
        if (worldVerts[i] instanceof THREE.Vector3) {
            center.add(worldVerts[i]);
            count++;
        }
    }
    return count > 0 ? center.divideScalar(count) : center.set(0, 0, 0);
}

// Calculates local normal for helper
function calculateLocalNormal(localVerts) {
    if (!localVerts || localVerts.length < 3) return new THREE.Vector3(0, 1, 0);
    const [vA, vB, vC] = localVerts;
    if (
        !(
            vA instanceof THREE.Vector3 &&
            vB instanceof THREE.Vector3 &&
            vC instanceof THREE.Vector3
        )
    )
        return new THREE.Vector3(0, 1, 0);
    const edge1 = new THREE.Vector3().subVectors(vB, vA);
    const edge2 = new THREE.Vector3().subVectors(vC, vA);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
    if (normal.y < -0.1) normal.negate();
    return normal;
}

// Calculates local center for helper
function calculateLocalCenter(localVerts) {
    const center = new THREE.Vector3();
    let count = 0;
    if (!localVerts) return center;
    localVerts.forEach((v) => {
        if (v instanceof THREE.Vector3) {
            center.add(v);
            count++;
        }
    });
    return count > 0 ? center.divideScalar(count) : center;
}

// Calculates hypothetical vertices
function calculateHypotheticalWorldVertices(faceIndex, angle) {
    const pivot = pivots[faceIndex];
    const mesh = pivot?.children[0];
    const parent = pivot?.parent;
    if (!pivot || !mesh || !mesh.geometry || !parent) return null;
    const positions = mesh.geometry.attributes.position;
    const uniqueVerts = new Map();
    const tempVec = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
        tempVec.fromBufferAttribute(positions, i);
        const key = `${tempVec.x.toFixed(5)},${tempVec.y.toFixed(5)},${tempVec.z.toFixed(5)}`;
        if (!uniqueVerts.has(key)) uniqueVerts.set(key, tempVec.clone());
    }
    const uniqueLocalVertices = Array.from(uniqueVerts.values());
    if (uniqueLocalVertices.length < 3) return null;
    const hypotheticalLocalQuat = new THREE.Quaternion().setFromAxisAngle(
        pivot.userData.axis,
        angle,
    );
    parent.updateWorldMatrix(true, true);
    const hypotheticalPivotWorldMatrix = parent.matrixWorld.clone();
    const pivotLocalTransform = new THREE.Matrix4().compose(
        pivot.position,
        hypotheticalLocalQuat,
        pivot.scale,
    );
    hypotheticalPivotWorldMatrix.multiply(pivotLocalTransform);
    const worldVertices = uniqueLocalVertices.map((v) =>
        v.clone().applyMatrix4(hypotheticalPivotWorldMatrix),
    );
    if (allVertices[faceIndex])
        worldVertices.numSides = allVertices[faceIndex].numSides;
    const validWorldVertices = worldVertices.filter(
        (v) => v instanceof THREE.Vector3,
    );
    return validWorldVertices.length >= 3 ? validWorldVertices : null;
}

function sanitizeForFilename(name) {
    const s = String(name || "polyhedron")
        .trim()
        .replace(/[^\w\-]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return s || "polyhedron";
}

function getExportableFaceMeshes() {
    const meshes = [];
    if (f1Mesh?.geometry?.attributes?.position) {
        meshes.push({ index: 1, mesh: f1Mesh });
    }
    const pivotIndices = Object.keys(pivots)
        .map((k) => parseInt(k, 10))
        .filter((n) => !Number.isNaN(n))
        .sort((a, b) => a - b);
    for (const idx of pivotIndices) {
        const pivot = pivots[idx];
        if (!pivot) continue;
        for (let c = 0; c < pivot.children.length; c++) {
            const child = pivot.children[c];
            if (child.isMesh && child.geometry?.attributes?.position) {
                meshes.push({ index: idx, mesh: child });
                break;
            }
        }
    }
    return meshes;
}

/** Quantized position key for welding; matches precision used in getMeshWorldVertices. */
function weldPositionKey(v) {
    return `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`;
}

function buildOBJString() {
    scene.updateMatrixWorld(true);
    const entries = getExportableFaceMeshes();
    if (entries.length === 0) return "";

    const weldedPositions = [];
    const keyToWeldedIndex = new Map();
    const faceTriangles = [];

    const tempVec = new THREE.Vector3();

    function weldVertex() {
        const key = weldPositionKey(tempVec);
        let idx = keyToWeldedIndex.get(key);
        if (idx === undefined) {
            idx = weldedPositions.length;
            keyToWeldedIndex.set(key, idx);
            weldedPositions.push({
                x: tempVec.x,
                y: tempVec.y,
                z: tempVec.z,
            });
        }
        return idx;
    }

    for (const { index, mesh } of entries) {
        const pos = mesh.geometry.attributes.position;
        const count = pos.count;
        for (let i = 0; i < count; i += 3) {
            tempVec.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
            const ia = weldVertex();
            tempVec.fromBufferAttribute(pos, i + 1).applyMatrix4(mesh.matrixWorld);
            const ib = weldVertex();
            tempVec.fromBufferAttribute(pos, i + 2).applyMatrix4(mesh.matrixWorld);
            const ic = weldVertex();
            faceTriangles.push({ faceIndex: index, a: ia, b: ib, c: ic });
        }
    }

    const lines = [];
    const safeObjName = sanitizeForFilename(currentNetName);
    lines.push("# Wavefront OBJ exported from Folding Polyhedron Net");
    lines.push("# Vertices welded by 5-decimal quantization (see weldPositionKey).");
    lines.push(`o ${safeObjName}`);

    for (let i = 0; i < weldedPositions.length; i++) {
        const p = weldedPositions[i];
        lines.push(
            `v ${p.x.toFixed(6)} ${p.y.toFixed(6)} ${p.z.toFixed(6)}`,
        );
    }

    let lastFaceGroup = null;
    for (const tri of faceTriangles) {
        if (tri.faceIndex !== lastFaceGroup) {
            lines.push(`g face_${tri.faceIndex}`);
            lastFaceGroup = tri.faceIndex;
        }
        lines.push(
            `f ${tri.a + 1} ${tri.b + 1} ${tri.c + 1}`,
        );
    }

    return lines.join("\n");
}

function exportOBJ() {
    if (!f1Mesh) {
        alert("Load a net first.");
        return;
    }
    const obj = buildOBJString();
    if (!obj) {
        alert("Nothing to export.");
        return;
    }
    const blob = new Blob([obj], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeForFilename(currentNetName)}.obj`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** Snapshot visibility of scene overlays for export; pair is [object, visible]. */
function snapshotExportOverlayVisibility() {
    const pairs = [];
    const push = (o) => {
        if (o) pairs.push([o, o.visible]);
    };
    push(scene?.getObjectByName("crosshairAxesHelper"));
    push(shadowGround);
    push(edgePickGroup);
    Object.values(normalHelpers).forEach((g) => push(g));
    return pairs;
}

function hideExportOverlays(pairs) {
    for (let i = 0; i < pairs.length; i++) {
        const o = pairs[i][0];
        if (o) o.visible = false;
    }
}

function restoreExportOverlayVisibility(pairs) {
    for (let i = 0; i < pairs.length; i++) {
        const o = pairs[i][0];
        const v = pairs[i][1];
        if (o) o.visible = v;
    }
}

function meshFaceFillHex(mesh) {
    const h = mesh.userData?.faceColorHex;
    if (h == null) return "#bbbbbb";
    return `#${new THREE.Color(h).getHexString()}`;
}

function exportPNGTransparent() {
    if (!f1Mesh || !renderer || !scene || !camera) {
        alert("Load a net first.");
        return;
    }
    const dom = renderer.domElement;
    const scale = 2;
    const w = Math.min(4096, Math.max(256, Math.round(dom.clientWidth * scale)));
    const h = Math.min(4096, Math.max(256, Math.round(dom.clientHeight * scale)));

    const overlaySnap = snapshotExportOverlayVisibility();
    hideExportOverlays(overlaySnap);

    const prevBg = scene.background;
    scene.background = null;

    const oldAspect = camera.aspect;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const exportRenderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
    });
    exportRenderer.setPixelRatio(1);
    exportRenderer.setSize(w, h);
    exportRenderer.outputColorSpace = THREE.SRGBColorSpace;
    exportRenderer.toneMapping = renderer.toneMapping;
    exportRenderer.toneMappingExposure = renderer.toneMappingExposure;
    exportRenderer.shadowMap.enabled = renderer.shadowMap.enabled;
    exportRenderer.setClearColor(0x000000, 0);

    exportRenderer.render(scene, camera);

    camera.aspect = oldAspect;
    camera.updateProjectionMatrix();
    scene.background = prevBg;
    restoreExportOverlayVisibility(overlaySnap);

    exportRenderer.domElement.toBlob(
        (blob) => {
            exportRenderer.dispose();
            if (!blob) {
                alert("PNG export failed.");
                return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${sanitizeForFilename(currentNetName)}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
        "image/png",
    );
}

function buildSVGStringFromCurrentView() {
    scene.updateMatrixWorld(true);
    const entries = getExportableFaceMeshes();
    if (entries.length === 0) return "";

    const canvasW = 1200;
    const canvasH = Math.round(1200 / (camera.aspect || 1));

    const tempV = new THREE.Vector3();
    const paths = [];
    const xs = [];
    const ys = [];

    for (const { mesh } of entries) {
        const fill = meshFaceFillHex(mesh);
        const pos = mesh.geometry.attributes.position;
        if (!pos) continue;
        for (let i = 0; i < pos.count; i += 3) {
            const ring = [];
            for (let j = 0; j < 3; j++) {
                tempV.fromBufferAttribute(pos, i + j).applyMatrix4(mesh.matrixWorld);
                tempV.project(camera);
                const x = (tempV.x * 0.5 + 0.5) * canvasW;
                const y = (-tempV.y * 0.5 + 0.5) * canvasH;
                ring.push({ x, y });
                xs.push(x);
                ys.push(y);
            }
            paths.push({ fill, ring });
        }
    }

    if (xs.length === 0) return "";

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < xs.length; i++) {
        minX = Math.min(minX, xs[i]);
        minY = Math.min(minY, ys[i]);
        maxX = Math.max(maxX, xs[i]);
        maxY = Math.max(maxY, ys[i]);
    }
    const pad = 20;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    const vbW = Math.max(1, maxX - minX);
    const vbH = Math.max(1, maxY - minY);

    const fmt = (n) => Number(n.toFixed(2));
    const pathD = (ring) => {
        const p0 = ring[0];
        let d = `M ${fmt(p0.x - minX)} ${fmt(p0.y - minY)}`;
        for (let k = 1; k < ring.length; k++) {
            const p = ring[k];
            d += ` L ${fmt(p.x - minX)} ${fmt(p.y - minY)}`;
        }
        return `${d} Z`;
    };

    const escAttr = (s) =>
        String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

    const title = escAttr(sanitizeForFilename(currentNetName));
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(vbW)} ${fmt(vbH)}" width="${fmt(vbW)}" height="${fmt(vbH)}">`;
    svg += `<title>${title}</title>`;
    for (let p = 0; p < paths.length; p++) {
        const { fill, ring } = paths[p];
        svg += `<path d="${pathD(ring)}" fill="${escAttr(fill)}" fill-opacity="0.92" stroke="#242428" stroke-width="1.25" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    }
    svg += `</svg>`;
    return svg;
}

function exportSVGView() {
    if (!f1Mesh || !camera) {
        alert("Load a net first.");
        return;
    }
    const svg = buildSVGStringFromCurrentView();
    if (!svg) {
        alert("Nothing to export.");
        return;
    }
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeForFilename(currentNetName)}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function getCurrentNetDataSnapshot() {
    if (isNetBuilderActive && builderNetData) {
        return JSON.parse(JSON.stringify(builderNetData));
    }
    if (lastLoadedNetData) {
        return JSON.parse(JSON.stringify(lastLoadedNetData));
    }
    return null;
}

function exportNetJSON() {
    const data = getCurrentNetDataSnapshot();
    if (!data) {
        alert("Load or create a net first.");
        return;
    }
    const json = `${JSON.stringify(data, null, 2)}\n`;
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeForFilename(currentNetName)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function setCreateSectionExpanded(expanded) {
    const sec = document.getElementById("createSection");
    const btn = document.getElementById("toggleCreateSectionBtn");
    if (!sec || !btn) return;
    sec.hidden = !expanded;
    btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    btn.textContent = expanded ? "Hide Create" : "Create a net";
}

function showSaveNetFeedback(message) {
    if (!saveNetFeedbackEl) return;
    saveNetFeedbackEl.hidden = false;
    saveNetFeedbackEl.textContent = message;
    clearTimeout(saveNetFeedbackTimer);
    saveNetFeedbackTimer = window.setTimeout(() => {
        saveNetFeedbackEl.textContent = "";
        saveNetFeedbackEl.hidden = true;
    }, 4500);
}

/**
 * XYZ crosshairs: full lines through the origin (±size per axis).
 * Vertex colors match Three.js AxesHelper (red / green / blue with slight gradient along +half).
 */
function createCrosshairAxesHelper(size = 5) {
    const L = size;
    const positions = new Float32Array([
        -L,
        0,
        0,
        L,
        0,
        0,
        0,
        -L,
        0,
        0,
        L,
        0,
        0,
        0,
        -L,
        0,
        0,
        L,
    ]);
    const colors = new Float32Array([
        1, 0, 0, 1, 0.6, 0, 0, 1, 0, 0.6, 1, 0, 0, 0, 1, 0, 0.6, 1,
    ]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
    );
    geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        toneMapped: false,
    });
    const lines = new THREE.LineSegments(geom, mat);
    lines.name = "crosshairAxesHelper";
    return lines;
}

// --- Initialization Function ---
function init() {
    // Basic scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141418);
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.set(0, 20, 20);
    camera.lookAt(0, 0, 0);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById("container").appendChild(renderer.domElement);
    setupImageBasedLighting();
    addShadowGround();
    ambientLight = new THREE.AmbientLight(0xffffff, 0.44);
    scene.add(ambientLight);
    hemiLight = new THREE.HemisphereLight(0xffffff, 0x9aa0b0, 0.5);
    hemiLight.position.set(0, 1, 0);
    scene.add(hemiLight);
    directionalLight = new THREE.DirectionalLight(0xffffff, 1.14);
    directionalLight.position.set(8, 18, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(2048, 2048);
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 90;
    directionalLight.shadow.camera.left = -32;
    directionalLight.shadow.camera.right = 32;
    directionalLight.shadow.camera.top = 32;
    directionalLight.shadow.camera.bottom = -32;
    directionalLight.shadow.bias = -0.0002;
    directionalLight.shadow.normalBias = 0.02;
    scene.add(directionalLight);
    fillLight = new THREE.DirectionalLight(0xf0f2ff, 0.4);
    fillLight.position.set(-10, 6, -12);
    scene.add(fillLight);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 0, 0);
    // Full 360° orbit around Y; keep polar angle shy of 0/π to avoid gimbal-style sticking at zenith/nadir
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = 0.02;
    controls.maxPolarAngle = Math.PI - 0.02;
    scene.add(createCrosshairAxesHelper(5));
    edgePickGroup = new THREE.Group();
    edgePickGroup.name = "edgePickGroup";
    scene.add(edgePickGroup);

    // Get DOM Elements
    foldButton = document.getElementById("foldButton");
    pauseButton = document.getElementById("pauseButton");
    speedSlider = document.getElementById("speedSlider");
    speedValueSpan = document.getElementById("speedValue");
    toggleNormalsCheckbox = document.getElementById("toggleNormals");
    netFileInput = document.getElementById("netFile");
    infoDisplay = document.getElementById("info");
    exportObjButton = document.getElementById("exportObjButton");
    exportPngButton = document.getElementById("exportPngButton");
    exportSvgButton = document.getElementById("exportSvgButton");
    darkCanvasCheckbox = document.getElementById("darkCanvas");
    renderModeSlider = document.getElementById("renderModeSlider");
    exitBuilderBtn = document.getElementById("exitBuilderBtn");

    // Initial UI setup
    speedSlider.value = currentAnimationDuration;
    speedValueSpan.textContent = `${currentAnimationDuration} ms`;
    pauseButton.disabled = true;
    toggleNormalsCheckbox.checked = false;
    darkCanvasCheckbox.checked = true;
    applyCanvasTheme(true);
    darkCanvasCheckbox.setAttribute("aria-checked", "true");
    if (renderModeSlider) {
        renderModeSlider.value = String(currentRenderModeIndex);
        renderModeSlider.addEventListener("input", (e) => {
            applyRenderMode(Number(e.target.value));
        });
    }
    updateRenderModeStopsHighlight();
    infoDisplay.textContent = "Load a net file"; // Initial title

    // --- NO Default Net Load ---

    // Add Event Listeners
    window.addEventListener("resize", onWindowResize);
    foldButton.addEventListener("click", toggleFold);
    pauseButton.addEventListener("click", togglePause);
    speedSlider.addEventListener("input", (event) => {
        currentAnimationDuration = parseInt(event.target.value, 10);
        speedValueSpan.textContent = `${currentAnimationDuration} ms`;
    });
    toggleNormalsCheckbox.addEventListener(
        "change",
        toggleNormalHelpersVisibility,
    );
    darkCanvasCheckbox.addEventListener("change", () => {
        applyCanvasTheme(darkCanvasCheckbox.checked);
        darkCanvasCheckbox.setAttribute(
            "aria-checked",
            darkCanvasCheckbox.checked ? "true" : "false",
        );
    });
    netFileInput.addEventListener("change", handleFileSelect);
    exportObjButton?.addEventListener("click", exportOBJ);
    exportPngButton?.addEventListener("click", exportPNGTransparent);
    exportSvgButton?.addEventListener("click", exportSVGView);

    builderHintEl = document.getElementById("builderEdgeHint");
    createKindSelect = document.getElementById("createKindSelect");
    createRegularSides = document.getElementById("createRegularSides");
    createSchlafliInput = document.getElementById("createSchlafliInput");
    attachSchlafliInput = document.getElementById("attachSchlafliInput");
    createIrregularSelect = document.getElementById("createIrregularSelect");
    createSvgTextarea = document.getElementById("createSvgTextarea");
    createColorInput = document.getElementById("createColorInput");
    builderPanelEl = document.getElementById("builderPanel");
    builderAttachPanel = document.getElementById("builderAttachPanel");
    attachNewFaceKind = document.getElementById("attachNewFaceKind");
    attachRegularSides = document.getElementById("attachRegularSides");
    attachIrregularSelect = document.getElementById("attachIrregularSelect");
    attachColorInput = document.getElementById("attachColorInput");
    saveNetFeedbackEl = document.getElementById("saveNetFeedback");

    if (createIrregularSelect) {
        createIrregularSelect.innerHTML = "";
        for (const key of Object.keys(NetBuilder.IRREGULAR_POLYGON_LIBRARY)) {
            const item = NetBuilder.IRREGULAR_POLYGON_LIBRARY[key];
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = item.name;
            createIrregularSelect.appendChild(opt);
        }
    }
    if (attachIrregularSelect) {
        attachIrregularSelect.innerHTML = "";
        for (const key of Object.keys(NetBuilder.IRREGULAR_POLYGON_LIBRARY)) {
            const item = NetBuilder.IRREGULAR_POLYGON_LIBRARY[key];
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = item.name;
            attachIrregularSelect.appendChild(opt);
        }
    }

    builderFacePanelEl = document.getElementById("builderFacePanel");
    editFaceKindSelect = document.getElementById("editFaceKindSelect");
    editFaceRegularSidesSelect = document.getElementById(
        "editFaceRegularSidesSelect",
    );
    editFaceSchlafliInputEl = document.getElementById("editFaceSchlafliInput");
    editFaceIrregularSelectEl = document.getElementById(
        "editFaceIrregularSelect",
    );
    editFaceColorInputEl = document.getElementById("editFaceColorInput");
    if (editFaceIrregularSelectEl) {
        editFaceIrregularSelectEl.innerHTML = "";
        for (const key of Object.keys(NetBuilder.IRREGULAR_POLYGON_LIBRARY)) {
            const item = NetBuilder.IRREGULAR_POLYGON_LIBRARY[key];
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = item.name;
            editFaceIrregularSelectEl.appendChild(opt);
        }
    }
    function syncEditFaceKindRows() {
        const v = editFaceKindSelect?.value || "regular";
        setPanelRowHidden("editRowRegular", v !== "regular");
        setPanelRowHidden("editRowSchlafli", v !== "schlafli");
        setPanelRowHidden("editRowIrregular", v !== "irregular");
    }
    editFaceKindSelect?.addEventListener("change", syncEditFaceKindRows);
    syncEditFaceKindRows();

    document
        .getElementById("builderDeleteFaceBtn")
        ?.addEventListener("click", deleteSelectedBuilderFace);
    document
        .getElementById("applyReplaceFaceBtn")
        ?.addEventListener("click", applyReplaceSelectedFaceShape);

    function setPanelRowHidden(id, hide) {
        const el = document.getElementById(id);
        if (!el) return;
        el.toggleAttribute("hidden", hide);
        el.setAttribute("aria-hidden", hide ? "true" : "false");
    }
    function syncCreateSubpanels() {
        const k = createKindSelect?.value || "regular";
        setPanelRowHidden("createRowRegular", k !== "regular");
        setPanelRowHidden("createRowSchlafli", k !== "schlafli");
        setPanelRowHidden("createRowIrregular", k !== "irregular");
        setPanelRowHidden("createRowSvg", k !== "svg");
    }
    createKindSelect?.addEventListener("change", syncCreateSubpanels);
    syncCreateSubpanels();

    document.getElementById("buildCustomNetBtn")?.addEventListener("click", () => {
        try {
            if (
                isNetBuilderActive &&
                builderDirty &&
                !confirmDiscardBuilderWork("Starting a new net.")
            ) {
                return;
            }
            const color = createColorInput?.value || "#c9b8e8";
            const kind = createKindSelect?.value || "regular";
            let data;
            if (kind === "regular") {
                const n = parseInt(createRegularSides?.value || "4", 10);
                data = NetBuilder.buildStarterNet({
                    kind: "regular",
                    schlafliKey: String(n),
                    color,
                });
            } else if (kind === "schlafli") {
                const sym = (createSchlafliInput?.value || "").trim();
                if (!sym) {
                    throw new Error(
                        "Enter a Schläfli symbol (e.g. 6, 5/2, or {4,3}).",
                    );
                }
                data = NetBuilder.buildStarterNet({
                    kind: "schlafli",
                    schlafliKey: sym,
                    color,
                    edgeLength: sideLength,
                });
            } else if (kind === "irregular") {
                data = NetBuilder.buildStarterNet({
                    kind: "irregular",
                    irregularKey: createIrregularSelect?.value || "kite_quad",
                    color,
                });
            } else if (kind === "svg") {
                const verts = NetBuilder.parseSvgPolygonToNetVertices(
                    createSvgTextarea?.value || "",
                );
                if (!verts)
                    throw new Error(
                        "Could not parse SVG (use <polygon points=\"...\"> or a simple closed <path d=\"M...Z\">).",
                    );
                data = {
                    description: "Custom net (from SVG)",
                    baseFace: { vertices: verts, color },
                    connections: [],
                };
            }
            enterNetBuilderFromData(data);
        } catch (err) {
            alert(err.message || String(err));
        }
    });

    document.getElementById("loadNetFileBtn")?.addEventListener("click", () => {
        netFileInput?.click();
    });

    document.getElementById("toggleCreateSectionBtn")?.addEventListener("click", () => {
        const sec = document.getElementById("createSection");
        const next = Boolean(sec?.hidden);
        setCreateSectionExpanded(next);
    });

    document.getElementById("editLoadedNetBtn")?.addEventListener("click", () => {
        if (isNetBuilderActive) return;
        const data = getCurrentNetDataSnapshot();
        if (!data) {
            alert(
                "Nothing to edit yet. Load a .json file, pick a preset, or choose a saved net first.",
            );
            return;
        }
        if (!confirmDiscardBuilderWork("Opening the current net in the editor.")) {
            return;
        }
        enterNetBuilderFromData(data);
    });

    document.getElementById("exportNetJsonBtn")?.addEventListener("click", exportNetJSON);

    document.getElementById("saveNetToListBtn")?.addEventListener("click", () => {
        const data = getCurrentNetDataSnapshot();
        if (!data) {
            alert(
                "Nothing to save yet. Build a net in the custom editor, load a .json file, or pick a preset first — then use Save to list.",
            );
            return;
        }
        const name = window.prompt("Name for this net in Saved nets:", "");
        if (name == null) return;
        const trimmed = String(name).trim();
        if (!trimmed) {
            alert("Enter a name to save.");
            return;
        }
        const presets = NetBuilder.loadCustomPresetsFromStorage();
        presets.push({
            id: NetBuilder.makePresetId(),
            name: trimmed,
            netData: data,
            savedAt: Date.now(),
        });
        try {
            NetBuilder.saveCustomPresetsToStorage(presets);
        } catch (err) {
            alert(
                `Could not write Saved nets (${err?.message || String(err)}). Try a normal (non-private) window if storage is blocked.`,
            );
            return;
        }
        if (isNetBuilderActive) builderDirty = false;
        refreshSavedNetsSelect();
        showSaveNetFeedback(`Saved “${trimmed}” to Saved nets.`);
        console.log(`Saved net preset: ${trimmed} (${presets.length} total)`);
    });

    exitBuilderBtn?.addEventListener("click", () => {
        if (!isNetBuilderActive) return;
        if (
            builderDirty &&
            !confirm(
                "Exit builder? Unsaved changes will be lost unless you saved this net under Saved nets.",
            )
        ) {
            return;
        }
        exitNetBuilder();
        clearSceneGeometry();
        lastLoadedNetData = null;
        if (infoDisplay) infoDisplay.textContent = "Load a net file";
        currentFoldAngles = null;
        refreshFoldControlState();
    });

    attachNewFaceKind?.addEventListener("change", () => {
        const v = attachNewFaceKind.value;
        setPanelRowHidden("attachRowRegular", v !== "regular");
        setPanelRowHidden("attachRowSchlafli", v !== "schlafli");
        setPanelRowHidden("attachRowIrregular", v !== "irregular");
    });
    attachNewFaceKind?.dispatchEvent(new Event("change"));

    document.getElementById("attachConfirmBtn")?.addEventListener("click", () => {
        if (!builderPendingEdge || !builderNetData) return;
        const color = attachColorInput?.value || "#b8a9d9";
        let spec;
        try {
            spec = buildFaceSpecFromAttachLikeInputs(
                attachNewFaceKind,
                attachRegularSides,
                attachSchlafliInput,
                attachIrregularSelect,
            );
        } catch (err) {
            alert(err.message || String(err));
            return;
        }
        try {
            const fid = builderPendingEdge.faceId;
            const pVerts = allVertices[fid];
            const ia = builderPendingEdge.v0;
            const ib = builderPendingEdge.v1;
            if (
                !pVerts ||
                !pVerts[ia] ||
                !pVerts[ib] ||
                !(pVerts[ia] instanceof THREE.Vector3)
            ) {
                alert(
                    "Could not measure the clicked edge. Load the net again or exit and re-enter the builder.",
                );
                return;
            }
            const hingeLen = pVerts[ia].distanceTo(pVerts[ib]);
            if (hingeLen < 1e-6) {
                alert("That edge is too short to attach to.");
                return;
            }
            const { connection } = NetBuilder.appendFlapToNet(
                builderNetData,
                {
                    parentFaceId: fid,
                    v0: ia,
                    v1: ib,
                },
                spec,
                color,
                {
                    hingeMatchLength: hingeLen,
                    referenceSideLength: sideLength,
                },
            );
            builderNetData.connections.push(connection);
            builderPendingEdge = null;
            if (builderAttachPanel) builderAttachPanel.hidden = true;
            clearBuilderFaceSelection();
            hydrateUsedEdgesFromNet(builderNetData);
            loadAndProcessNet(builderNetData, {
                allowUnknownSignature: true,
            });
            builderDirty = true;
        } catch (err) {
            alert(err.message || String(err));
        }
    });

    document.getElementById("attachCancelBtn")?.addEventListener("click", () => {
        builderPendingEdge = null;
        if (builderAttachPanel) builderAttachPanel.hidden = true;
    });

    window.addEventListener("keydown", (e) => {
        if (!isNetBuilderActive) return;
        if (e.key === "Escape") {
            if (builderAttachPanel && !builderAttachPanel.hidden) {
                builderPendingEdge = null;
                builderAttachPanel.hidden = true;
                e.preventDefault();
            }
            return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
            if (builderSelectedFaceId == null) return;
            const t = e.target;
            const tag = t && t.tagName;
            if (
                tag === "INPUT" ||
                tag === "TEXTAREA" ||
                tag === "SELECT" ||
                (t && t.isContentEditable)
            ) {
                return;
            }
            e.preventDefault();
            deleteSelectedBuilderFace();
        }
    });

    renderer.domElement.addEventListener("mousemove", (ev) => {
        updateBuilderPickHover(ev.clientX, ev.clientY);
    });
    renderer.domElement.addEventListener("mouseleave", () => {
        updateBuilderPickHover(-1e9, -1e9);
    });
    renderer.domElement.addEventListener("click", (ev) => {
        if (!isNetBuilderActive) return;
        if (isFolded || isAnimating) return;
        if (builderHoveredPick?.userData?.pick) {
            clearBuilderFaceSelection();
            const p = builderHoveredPick.userData.pick;
            builderPendingEdge = p;
            const info = document.getElementById("attachEdgeInfo");
            if (info)
                info.textContent = `Face ${p.faceId} · vertices ${p.v0}–${p.v1}`;
            if (builderAttachPanel) builderAttachPanel.hidden = false;
            return;
        }
        const hit = pickBuilderFaceMesh(ev.clientX, ev.clientY);
        if (hit?.userData?.faceId != null) {
            builderPendingEdge = null;
            if (builderAttachPanel) builderAttachPanel.hidden = true;
            setBuilderSelectedFace(hit.userData.faceId);
        } else {
            clearBuilderFaceSelection();
        }
    });

    refreshSavedNetsSelect();
    refreshFoldControlState();

    // Start animation loop
    animate();
}

// --- Function to Load Net Data from JSON ---
function loadAndProcessNet(netData, options = {}) {
    const allowUnknownSignature = options.allowUnknownSignature === true;
    isFolded = false;
    isAnimating = false;
    isPaused = false;
    currentAnimationStage = 0;
    foldButton.textContent = "Fold";
    pauseButton.disabled = true;

    try {
        const faceCounts = {};
        const baseCount = getFaceVertexCountFromSpec(netData.baseFace);
        if (baseCount == null) {
            throw new Error(
                "Invalid net data: baseFace needs noSides >= 3 or vertices with length >= 3",
            );
        }
        faceCounts[baseCount.toString()] = 1;
        if (!netData.connections || !Array.isArray(netData.connections))
            throw new Error(
                "Invalid net data: Missing/invalid connections array",
            );
        netData.connections.forEach((conn, index) => {
            const nv = getFaceVertexCountFromSpec(conn);
            if (nv == null) {
                throw new Error(
                    `Invalid connection at index ${index}: need noSides >= 3 or vertices with length >= 3`,
                );
            }
            const key = nv.toString();
            faceCounts[key] = (faceCounts[key] || 0) + 1;
        });
        const signature = getFaceCountSignature(faceCounts);
        const vertexConfigKey = faceCountSigToVertexConfigKey[signature];
        if (!vertexConfigKey) {
            if (!allowUnknownSignature) {
                throw new Error(
                    `Unknown polyhedron signature: ${signature}. This pattern is not in the fold-angle library yet.`,
                );
            }
            console.warn(
                `[Custom net] Signature "${signature}" has no fold table — trial Fold uses guessed angles; click Unfold after.`,
            );
            currentFoldAngles = null;
            currentNetName = netData.description || "Custom net";
        } else {
            const polyhedronInfo = POLYHEDRON_DATA[vertexConfigKey];
            if (!polyhedronInfo?.foldAngles)
                throw new Error(
                    `Fold angle data not found for config: ${vertexConfigKey}`,
                );
            currentFoldAngles = polyhedronInfo.foldAngles;
            currentNetName =
                polyhedronInfo.name || netData.description || "Loaded Net";
        }

        NUM_ANIMATION_STAGES = netData.connections.length;
        resetTrialFoldGameState();

        createNetFromData(netData);
        lastLoadedNetData = JSON.parse(JSON.stringify(netData));

        setInfoLayoutStatus();
    } catch (error) {
        console.error("Failed to process net data:", error);
        alert(`Error processing net data: ${error.message}. Check console.`);
        clearSceneGeometry();
        lastLoadedNetData = null;
        if (infoDisplay) infoDisplay.textContent = `Error Loading Net`;
        currentFoldAngles = null;
        NUM_ANIMATION_STAGES = 0;
        refreshFoldControlState();
    }
}

// --- Event handler for file input ---
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
        alert("Please select a valid .json file.");
        event.target.value = "";
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const netData = JSON.parse(e.target.result);
            console.log(`Processing loaded file: ${file.name}`);
            if (!confirmDiscardBuilderWork("Loading a JSON file.")) {
                event.target.value = "";
                return;
            }
            exitNetBuilder();
            loadAndProcessNet(netData, { allowUnknownSignature: true });
        } catch (error) {
            console.error("Error loading net JSON file:", error);
            alert(`Could not load net file: ${error.message}`);
        } finally {
            event.target.value = "";
        }
    };
    reader.onerror = (e) => {
        console.error("Error reading file:", e);
        alert("Error reading file.");
        event.target.value = "";
    };
    reader.readAsText(file);
}

// --- Function to clear existing net geometry ---
function clearSceneGeometry() {
    console.log("Clearing existing net geometry...");
    Object.keys(pivots).forEach((key) => {
        const pivot = pivots[key];
        if (!pivot) return;
        while (pivot.children.length > 0) {
            const child = pivot.children[0];
            disposeObjectTree(child);
            pivot.remove(child);
        }
        if (pivot.parent) pivot.parent.remove(pivot);
        delete pivots[key];
    });
    if (f1Mesh) {
        while (f1Mesh.children.length > 0) {
            const child = f1Mesh.children[0];
            disposeObjectTree(child);
            f1Mesh.remove(child);
        }
        scene.remove(f1Mesh);
        disposeObjectTree(f1Mesh);
        f1Mesh = null;
    }
    Object.keys(allVertices).forEach((key) => delete allVertices[key]);
    Object.keys(normalHelpers).forEach((key) => delete normalHelpers[key]);
    if (edgePickGroup) {
        while (edgePickGroup.children.length > 0) {
            const c = edgePickGroup.children[0];
            disposeObjectTree(c);
            edgePickGroup.remove(c);
        }
    }
    builderHoveredPick = null;
    resetTrialFoldGameState();
    // Reset animation state variables
    isFolded = false;
    isAnimating = false;
    isPaused = false;
    currentAnimationStage = 0;
    pivotsInCurrentStage = [];
    startQuaternions = {};
    targetQuaternions = {};
    if (foldButton) foldButton.textContent = "Fold";
    if (pauseButton) pauseButton.disabled = true;
    console.log("Clear complete.");
    refreshFoldControlState();
}

function pickTrialFailFlavor(runNumber) {
    const i = Math.max(0, runNumber - 1) % TRIAL_FAIL_FLAVORS.length;
    return TRIAL_FAIL_FLAVORS[i];
}

function clearTrialJuiceVisuals() {
    document.getElementById("container")?.classList.remove("trial-rumble");
    if (infoDisplay) infoDisplay.classList.remove("trial-juice");
}

function resetTrialFoldGameState() {
    trialFoldRunCount = 0;
    trialFoldPauseActive = false;
    clearTrialJuiceVisuals();
}

function triggerTrialRumble() {
    const el = document.getElementById("container");
    if (!el) return;
    el.classList.remove("trial-rumble");
    el.offsetWidth;
    el.classList.add("trial-rumble");
    el.addEventListener(
        "animationend",
        () => el.classList.remove("trial-rumble"),
        { once: true },
    );
}

/** Short “game show wrong” buzzer (Web Audio — no asset file). */
function playTrialFailBuzzer() {
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!trialBuzzerAudioContext) trialBuzzerAudioContext = new AC();
        const ctx = trialBuzzerAudioContext;
        void ctx.resume();
        const t0 = ctx.currentTime + 0.012;
        const master = ctx.createGain();
        master.gain.value = 0.13;
        master.connect(ctx.destination);

        function squareBeep(t, dur, f0, f1) {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "square";
            o.frequency.setValueAtTime(f0, t);
            o.frequency.linearRampToValueAtTime(f1, t + dur);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.32, t + 0.008);
            g.gain.linearRampToValueAtTime(0.0001, t + dur);
            o.connect(g);
            g.connect(master);
            o.start(t);
            o.stop(t + dur + 0.025);
        }

        function sawBuzz(t, dur) {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sawtooth";
            o.frequency.setValueAtTime(280, t);
            o.frequency.exponentialRampToValueAtTime(65, t + dur);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.38, t + 0.012);
            g.gain.linearRampToValueAtTime(0.0001, t + dur);
            o.connect(g);
            g.connect(master);
            o.start(t);
            o.stop(t + dur + 0.03);
        }

        squareBeep(t0, 0.085, 660, 520);
        squareBeep(t0 + 0.11, 0.085, 660, 520);
        sawBuzz(t0 + 0.24, 0.42);
    } catch {
        /* autoplay or API blocked */
    }
}

/**
 * After trial fold finishes: hold the pose until the user clicks Unfold (rumble + buzzer + flavor text).
 */
function beginTrialReboundPause() {
    trialFoldRunCount += 1;
    trialFoldPauseActive = true;
    isAnimating = false;
    isPaused = false;
    if (pauseButton) {
        pauseButton.disabled = true;
        pauseButton.textContent = "Pause";
    }
    const flavor = pickTrialFailFlavor(trialFoldRunCount);
    if (infoDisplay) {
        infoDisplay.textContent = `Trial #${trialFoldRunCount}: ${flavor} — click Unfold when ready.`;
        infoDisplay.classList.remove("trial-juice");
        infoDisplay.offsetWidth;
        infoDisplay.classList.add("trial-juice");
    }
    triggerTrialRumble();
    playTrialFailBuzzer();
    refreshFoldControlState();
    syncBuilderEdgePicksVisibility();
}

/** True when the net has flaps but no fold-angle table (trial fold; user Unfolds manually). */
function canTrialFoldLayout() {
    return Boolean(f1Mesh && !currentFoldAngles && NUM_ANIMATION_STAGES >= 1);
}

/** Status line for nets without a fold table (and hint when trial fold is possible). */
function setInfoLayoutStatus() {
    if (!infoDisplay || !f1Mesh) return;
    if (currentFoldAngles) {
        infoDisplay.textContent = `Folding: ${currentNetName}`;
        return;
    }
    const runs =
        trialFoldRunCount > 0
            ? ` · ${trialFoldRunCount} trial run${trialFoldRunCount === 1 ? "" : "s"}`
            : "";
    infoDisplay.textContent =
        NUM_ANIMATION_STAGES >= 1
            ? `Layout: ${currentNetName}${runs} · no fold table — try Fold for a trial (guessed angles), then Unfold`
            : `Layout: ${currentNetName} · folding unavailable`;
}

/** Enable “Edit net” when a net is on screen and we are not already in the builder. */
function refreshEditNetButtonState() {
    const editBtn = document.getElementById("editLoadedNetBtn");
    if (!editBtn) return;
    const snap = getCurrentNetDataSnapshot();
    const canEdit = Boolean(
        f1Mesh && snap && !isNetBuilderActive && !isAnimating,
    );
    editBtn.disabled = !canEdit;
    if (canEdit) {
        editBtn.title =
            "Open this net in the custom editor to attach, delete, or reshape faces.";
    } else if (isNetBuilderActive) {
        editBtn.title =
            "You are already editing — use Exit when done, or expand Create below.";
    } else if (isAnimating) {
        editBtn.title = "Wait for folding or unfolding to finish.";
    } else {
        editBtn.title = "Load a preset, a JSON file, or build a net first.";
    }
}

/** Fold / trial fold when the net has at least one flap connection. */
function refreshFoldControlState() {
    try {
        if (!foldButton) return;
        const hasNet = Boolean(f1Mesh);
        const canFoldOrTrial =
            Boolean(currentFoldAngles) || canTrialFoldLayout();
        if (!hasNet) {
            foldButton.disabled = true;
            foldButton.title =
                "Load a preset, a JSON file, or create a net from the Net panel.";
            foldButton.textContent = "Fold";
            return;
        }
        if (!canFoldOrTrial) {
            foldButton.disabled = true;
            foldButton.title =
                "Add attached faces in the builder (or load a net with connections) to try folding.";
            foldButton.textContent = "Fold";
            return;
        }
        if (trialFoldPauseActive) {
            foldButton.disabled = false;
            foldButton.textContent = "Unfold";
            foldButton.title =
                "Return to the flat net (guessed fold didn’t match any known solid).";
            if (pauseButton) pauseButton.disabled = true;
            return;
        }
        foldButton.disabled = false;
        foldButton.title = canTrialFoldLayout()
            ? "Trial fold: guessed angles for every hinge; when it stops, click Unfold to flatten (no fold table for this layout)."
            : "";
        const foldingForward =
            isAnimating &&
            currentAnimationStage > 0 &&
            currentAnimationStage <= NUM_ANIMATION_STAGES;
        const unfoldingAnim = isAnimating && currentAnimationStage < 0;
        let showUnfoldLabel = isFolded;
        if (foldingForward) showUnfoldLabel = true;
        if (unfoldingAnim) showUnfoldLabel = false;
        foldButton.textContent = showUnfoldLabel ? "Unfold" : "Fold";
    } finally {
        refreshEditNetButtonState();
    }
}

// --- Geometry & Base Vertex Functions ---

/**
 * Vertex count for signature / validation: irregular faces use vertices.length,
 * regular faces use noSides.
 * @param {object} spec - baseFace or connection object
 * @returns {number | null}
 */
function getFaceVertexCountFromSpec(spec) {
    if (spec == null) return null;
    if (Array.isArray(spec.vertices) && spec.vertices.length >= 3) {
        return spec.vertices.length;
    }
    const n = spec.noSides;
    if (typeof n === "number" && n >= 3) return n;
    return null;
}

/**
 * Parse net JSON vertices into THREE.Vector3 in net space.
 * Each point is [x, z] (y = 0) or [x, y, z]. Winding should be consistent (e.g. CCW in xz when viewed from +y).
 */
function parseNetVerticesRaw(verticesRaw) {
    if (!Array.isArray(verticesRaw) || verticesRaw.length < 3) {
        throw new Error("vertices must be an array of at least 3 points.");
    }
    const out = [];
    for (let i = 0; i < verticesRaw.length; i++) {
        const p = verticesRaw[i];
        if (!Array.isArray(p) || p.length < 2) {
            throw new Error(`vertices[${i}] must be [x, z] or [x, y, z].`);
        }
        const x = Number(p[0]);
        const y = p.length === 2 ? 0 : Number(p[1]);
        const z = p.length === 2 ? Number(p[1]) : Number(p[2]);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
            throw new Error(`vertices[${i}] contains non-finite numbers.`);
        }
        out.push(new THREE.Vector3(x, y, z));
    }
    return out;
}

/**
 * Build face vertex ring in the flat net: either explicit irregular vertices or a regular n-gon with side length L.
 * Irregular vertices should lie in the xz plane (y ≈ 0); folding alignment uses xz projections.
 * Optional per-face vertexScale multiplies coordinates after parsing.
 */
function resolveNetFaceVertices(faceSpec, L) {
    if (Array.isArray(faceSpec.vertices) && faceSpec.vertices.length >= 3) {
        const verts = parseNetVerticesRaw(faceSpec.vertices);
        const scaleRaw = faceSpec.vertexScale;
        const scale =
            scaleRaw != null && Number.isFinite(Number(scaleRaw))
                ? Number(scaleRaw)
                : 1;
        if (scale !== 1) {
            for (let vi = 0; vi < verts.length; vi++) {
                verts[vi].multiplyScalar(scale);
            }
        }
        let maxAbsY = 0;
        for (let vi = 0; vi < verts.length; vi++) {
            maxAbsY = Math.max(maxAbsY, Math.abs(verts[vi].y));
        }
        if (maxAbsY > 1e-4) {
            console.warn(
                "Net face uses non-zero y; folding math assumes the flat net lies in the xz plane (y ≈ 0).",
            );
        }
        verts.numSides = verts.length;
        if (faceSpec.isStarPolygon) verts.isStarPolygon = true;
        return verts;
    }
    const n = faceSpec.noSides;
    if (typeof n === "number" && n >= 3) {
        const verts = calculateBaseRegularPolygonVertices(n, L);
        verts.numSides = n;
        const scaleRaw = faceSpec.vertexScale;
        const scale =
            scaleRaw != null && Number.isFinite(Number(scaleRaw))
                ? Number(scaleRaw)
                : 1;
        if (scale !== 1) {
            for (let vi = 0; vi < verts.length; vi++) {
                verts[vi].multiplyScalar(scale);
            }
        }
        return verts;
    }
    throw new Error(
        "Face must define either vertices (length >= 3) or noSides (>= 3).",
    );
}

function calculateBaseRegularPolygonVertices(numSides, sideLength) {
    const vertices = [];
    if (numSides < 3) return vertices;
    const R = sideLength / (2 * Math.sin(Math.PI / numSides));
    const angleStep = (2 * Math.PI) / numSides;
    const startAngle = -Math.PI / 2 - Math.PI / numSides;
    for (let i = 0; i < numSides; i++) {
        const angle = startAngle + i * angleStep;
        const x = R * Math.cos(angle);
        const z = R * Math.sin(angle);
        vertices.push(
            new THREE.Vector3(
                Math.abs(x) < 1e-9 ? 0 : x,
                0,
                Math.abs(z) < 1e-9 ? 0 : z,
            ),
        );
    }
    return vertices;
}

/** 2D cross (ax,az) × (bx,bz) — positive means b is to the left of a in xz (CCW from +y). */
function crossXZ(ax, az, bx, bz) {
    return ax * bz - az * bx;
}

/**
 * Reflect polygon vertices in the xz plane across the line through r and s (y unchanged).
 * Points on the line stay fixed — correct for hinge edges after placement.
 */
function reflectNetFaceAcrossEdgeXZ(vertices, r, s) {
    const mx = (r.x + s.x) * 0.5;
    const mz = (r.z + s.z) * 0.5;
    let ux = s.x - r.x;
    let uz = s.z - r.z;
    const len = Math.hypot(ux, uz);
    if (len < 1e-9) return;
    ux /= len;
    uz /= len;
    for (let vi = 0; vi < vertices.length; vi++) {
        const v = vertices[vi];
        const vx = v.x - mx;
        const vz = v.z - mz;
        const along = vx * ux + vz * uz;
        const px = mx + along * ux;
        const pz = mz + along * uz;
        v.x = 2 * px - v.x;
        v.z = 2 * pz - v.z;
    }
}

/**
 * Signed side of point (px,pz) relative to directed edge r→s in xz (interior of CCW polygons is positive).
 */
function sideOfEdgeXZ(px, pz, r, vx, vz) {
    return crossXZ(vx, vz, px - r.x, pz - r.z);
}

/**
 * If the new face lies on the same side of the hinge as the parent interior, mirror it across the hinge
 * so the flap opens into the exterior (fixes e.g. triangle-on-triangle with fromEdge [0,1]).
 */
function unfoldFlipFlapIfOverlappingParent(
    flapVertices,
    k,
    parentVertices,
    parentNumSides,
    rIdx,
    sIdx,
    Fr,
    Fs,
) {
    const Vx = Fs.x - Fr.x;
    const Vz = Fs.z - Fr.z;
    if (Vx * Vx + Vz * Vz < 1e-12) return;

    let pcx = 0;
    let pcz = 0;
    for (let vi = 0; vi < parentNumSides; vi++) {
        pcx += parentVertices[vi].x;
        pcz += parentVertices[vi].z;
    }
    pcx /= parentNumSides;
    pcz /= parentNumSides;
    let parentSide = sideOfEdgeXZ(pcx, pcz, Fr, Vx, Vz);
    if (Math.abs(parentSide) < 1e-8) {
        for (let vi = 0; vi < parentNumSides; vi++) {
            if (vi === rIdx || vi === sIdx) continue;
            parentSide = sideOfEdgeXZ(
                parentVertices[vi].x,
                parentVertices[vi].z,
                Fr,
                Vx,
                Vz,
            );
            break;
        }
    }

    let ncx = 0;
    let ncz = 0;
    for (let vi = 0; vi < k; vi++) {
        ncx += flapVertices[vi].x;
        ncz += flapVertices[vi].z;
    }
    ncx /= k;
    ncz /= k;
    const newSide = sideOfEdgeXZ(ncx, ncz, Fr, Vx, Vz);

    if (
        Math.abs(parentSide) >= 1e-8 &&
        Math.abs(newSide) >= 1e-8 &&
        parentSide * newSide > 0
    ) {
        reflectNetFaceAcrossEdgeXZ(flapVertices, Fr, Fs);
    }
}

/**
 * Triangle mesh for a simple polygon ring. Convex n-gons use a fan from v0.
 * Schläfli star polygons ({@link vertices.isStarPolygon}) self-intersect; fan from v0
 * fills the wrong region — use a fan from the vertex centroid (circumcenter for regular stars).
 */
function createRegularPolygonGeometry(vertices) {
    const geometry = new THREE.BufferGeometry();
    if (!vertices || vertices.length < 3) return geometry;
    const numSides = vertices.length;
    const positions = [];
    if (vertices.isStarPolygon) {
        const O = calculateLocalCenter(vertices);
        for (let i = 0; i < numSides; i++) {
            const a = vertices[i];
            const b = vertices[(i + 1) % numSides];
            positions.push(O.x, O.y, O.z);
            positions.push(b.x, b.y, b.z);
            positions.push(a.x, a.y, a.z);
        }
    } else {
        const v0 = vertices[0];
        for (let i = 1; i <= numSides - 2; i++) {
            positions.push(v0.x, v0.y, v0.z);
            positions.push(
                vertices[i + 1].x,
                vertices[i + 1].y,
                vertices[i + 1].z,
            );
            positions.push(vertices[i].x, vertices[i].y, vertices[i].z);
        }
    }
    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.computeVertexNormals();
    return geometry;
}

/** Dispose geometries and materials on obj and all descendants. */
function disposeObjectTree(obj) {
    obj.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
            const m = o.material;
            if (Array.isArray(m)) m.forEach((x) => x.dispose());
            else m.dispose();
        }
    });
}

/**
 * Outlines the polygon boundary (skips coplanar triangulation edges via thresholdAngle).
 * Attached under mesh so it follows folds.
 */
function getOutlineEdgeColorHex() {
    return document.documentElement.getAttribute("data-theme") === "dark"
        ? 0xa8a8b8
        : 0x3a3a45;
}

/** Polygon boundary outline for the selected face in net builder (high contrast). */
const BUILDER_SELECTED_FACE_OUTLINE_HEX = 0xffaa22;

const BUILDER_SELECTION_OVERLAY_NAME = "builderSelectionHighlight";

function addFaceOutlineEdges(mesh, geometry) {
    const edges = new THREE.EdgesGeometry(geometry, 22);
    const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: getOutlineEdgeColorHex() }),
    );
    line.userData.isFacePolygonOutline = true;
    mesh.add(line);
}

function getFaceOutlineColorForMesh(faceMesh) {
    const mode = RENDER_MODES[currentRenderModeIndex] || "flat";
    const dark =
        document.documentElement.getAttribute("data-theme") === "dark";
    const fid = faceMesh?.userData?.faceId;
    const sel =
        isNetBuilderActive &&
        fid != null &&
        fid === builderSelectedFaceId;
    if (sel) return BUILDER_SELECTED_FACE_OUTLINE_HEX;
    if (mode === "wireframe") return dark ? 0xd0d0de : 0x5a5a68;
    return getOutlineEdgeColorHex();
}

function removeBuilderFaceSelectionOverlays() {
    forEachFaceMesh((mesh) => {
        const h = mesh.getObjectByName(BUILDER_SELECTION_OVERLAY_NAME);
        if (h) {
            if (h.geometry) h.geometry.dispose();
            if (h.material) h.material.dispose();
            mesh.remove(h);
        }
    });
}

/** Bright orange film on the selected face (line outlines stay ~1px in WebGL). */
function syncBuilderFaceSelectionOverlay() {
    if (!isNetBuilderActive || builderSelectedFaceId == null) return;
    forEachFaceMesh((mesh) => {
        if (mesh.userData.faceId !== builderSelectedFaceId) return;
        const geom = mesh.geometry;
        if (!geom?.attributes?.position) return;
        const g = geom.clone();
        const mat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.58,
            depthWrite: false,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4,
            toneMapped: false,
        });
        const hm = new THREE.Mesh(g, mat);
        hm.name = BUILDER_SELECTION_OVERLAY_NAME;
        hm.userData.isBuilderSelectionOverlay = true;
        hm.renderOrder = (mesh.renderOrder || 0) + 3;
        hm.raycast = function () {};
        mesh.add(hm);
    });
}

function forEachFaceMesh(fn) {
    if (f1Mesh?.userData?.faceColorHex != null) fn(f1Mesh);
    Object.values(pivots).forEach((pivot) => {
        if (!pivot) return;
        for (let c = 0; c < pivot.children.length; c++) {
            const child = pivot.children[c];
            if (
                child.isMesh &&
                child.userData?.faceColorHex != null &&
                child.geometry
            ) {
                fn(child);
                break;
            }
        }
    });
}

function createFaceMaterial(colorHex, mode) {
    const env = scene?.environment || null;
    switch (mode) {
        case "wireframe":
            return new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.1,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
        case "translucent":
            return new THREE.MeshStandardMaterial({
                color: colorHex,
                side: THREE.DoubleSide,
                roughness: 0.55,
                metalness: 0,
                flatShading: true,
                transparent: true,
                opacity: TRANSLUCENT_FACE_OPACITY,
                depthWrite: false,
            });
        case "rendered":
            return new THREE.MeshPhysicalMaterial({
                color: colorHex,
                side: THREE.DoubleSide,
                roughness: 0.28,
                metalness: 0.14,
                clearcoat: 0.45,
                clearcoatRoughness: 0.22,
                envMap: env,
                envMapIntensity: 1.1,
            });
        case "flat":
        default:
            return new THREE.MeshStandardMaterial({
                color: colorHex,
                side: THREE.DoubleSide,
                roughness: 0.52,
                metalness: 0,
                flatShading: true,
            });
    }
}

function disposeFaceMeshMaterial(mesh) {
    if (mesh?.material) {
        mesh.material.dispose();
        mesh.material = null;
    }
}

function syncLightingToThemeAndMode() {
    if (!ambientLight || !hemiLight || !directionalLight || !fillLight) return;
    const dark =
        document.documentElement.getAttribute("data-theme") === "dark";
    const mode = RENDER_MODES[currentRenderModeIndex] || "flat";
    if (mode === "rendered") {
        directionalLight.castShadow = true;
        if (dark) {
            ambientLight.intensity = 0.15;
            hemiLight.intensity = 0.28;
            directionalLight.intensity = 1.68;
            fillLight.intensity = 0.52;
        } else {
            ambientLight.intensity = 0.22;
            hemiLight.intensity = 0.36;
            directionalLight.intensity = 1.52;
            fillLight.intensity = 0.45;
        }
    } else {
        directionalLight.castShadow = false;
        if (dark) {
            ambientLight.intensity = 0.44;
            hemiLight.intensity = 0.5;
            directionalLight.intensity = 1.14;
            fillLight.intensity = 0.4;
        } else {
            ambientLight.intensity = 0.38;
            hemiLight.intensity = 0.42;
            directionalLight.intensity = 1.05;
            fillLight.intensity = 0.32;
        }
    }
}

function updateEdgeLinesForRenderMode() {
    const mode = RENDER_MODES[currentRenderModeIndex] || "flat";
    const dark =
        document.documentElement.getAttribute("data-theme") === "dark";
    const paint = (root) => {
        root?.traverse?.((o) => {
            if (!o.isLineSegments || !o.material) return;
            if (
                o.userData.isFacePolygonOutline &&
                o.parent &&
                o.parent.userData?.faceId != null
            ) {
                if (mode === "rendered") {
                    o.visible = false;
                    return;
                }
                o.visible = true;
                o.material.color.setHex(getFaceOutlineColorForMesh(o.parent));
                o.material.transparent = false;
                o.material.opacity = 1;
                o.material.needsUpdate = true;
                return;
            }
            if (mode === "rendered") {
                o.visible = false;
                return;
            }
            o.visible = true;
            if (mode === "wireframe") {
                o.material.color.setHex(dark ? 0xd0d0de : 0x5a5a68);
            } else {
                o.material.color.setHex(getOutlineEdgeColorHex());
            }
            o.material.transparent = false;
            o.material.opacity = 1;
            o.material.needsUpdate = true;
        });
    };
    paint(f1Mesh);
    Object.values(pivots).forEach((p) => p && paint(p));
}

function applyRenderModeVisualLayers() {
    const mode = RENDER_MODES[currentRenderModeIndex] || "flat";
    if (renderModeSlider)
        renderModeSlider.value = String(currentRenderModeIndex);
    updateRenderModeStopsHighlight();
    if (shadowGround) shadowGround.visible = mode === "rendered";
    if (renderer)
        renderer.toneMappingExposure = mode === "rendered" ? 1.1 : 1.0;
    syncLightingToThemeAndMode();
    forEachFaceMesh((mesh) => {
        mesh.castShadow = mode === "rendered";
        mesh.receiveShadow = mode === "rendered";
    });
    updateEdgeLinesForRenderMode();
}

function applyRenderMode(index) {
    currentRenderModeIndex = Math.max(0, Math.min(3, Number(index) || 0));
    const mode = RENDER_MODES[currentRenderModeIndex];
    forEachFaceMesh((mesh) => {
        disposeFaceMeshMaterial(mesh);
        mesh.material = createFaceMaterial(mesh.userData.faceColorHex, mode);
    });
    applyRenderModeVisualLayers();
    refreshBuilderFaceSelectionHighlight();
}

function applyCanvasTheme(useDark) {
    document.documentElement.setAttribute(
        "data-theme",
        useDark ? "dark" : "light",
    );
    if (scene)
        scene.background = new THREE.Color(useDark ? 0x141418 : 0xffffff);
    syncLightingToThemeAndMode();
    updateEdgeLinesForRenderMode();
}

function setupImageBasedLighting() {
    if (!renderer || !scene) return;
    try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        const roomEnv = new RoomEnvironment();
        const rt = pmrem.fromScene(roomEnv, 0.04);
        scene.environment = rt.texture;
        pmrem.dispose();
        roomEnv.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                const m = o.material;
                if (Array.isArray(m)) m.forEach((x) => x.dispose());
                else m.dispose();
            }
        });
    } catch (e) {
        console.warn("IBL setup failed:", e);
    }
}

function addShadowGround() {
    const g = new THREE.PlaneGeometry(140, 140);
    const m = new THREE.ShadowMaterial({ opacity: 0.28 });
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -14;
    mesh.receiveShadow = true;
    mesh.visible = false;
    scene.add(mesh);
    shadowGround = mesh;
}

function updateRenderModeStopsHighlight() {
    document.querySelectorAll("[data-mode-stop]").forEach((el) => {
        el.classList.toggle(
            "active",
            Number(el.dataset.modeStop) === currentRenderModeIndex,
        );
    });
}

function confirmDiscardBuilderWork(contextMsg) {
    if (!isNetBuilderActive || !builderDirty) return true;
    return confirm(
        `${contextMsg}\n\nYour current builder net will be lost unless you saved it under Saved nets. Continue?`,
    );
}

/**
 * White crease lines on the black cone + twin rails along the shaft so the arrow
 * reads on light backgrounds (outline on the black geometry, not a second “shell” arrow).
 */
function addFaceNormalArrowEdgeStroke(arrowHelper, headLen) {
    const outlineColor = 0xffffff;
    const edgeMat = new THREE.LineBasicMaterial({
        color: outlineColor,
        toneMapped: false,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });

    const cone = arrowHelper.cone;
    const coneEdges = new THREE.EdgesGeometry(cone.geometry, 22);
    const coneStroke = new THREE.LineSegments(coneEdges, edgeMat.clone());
    coneStroke.name = "normalConeEdgeStroke";
    cone.add(coneStroke);

    const railW = Math.max(0.012, headLen * 0.07);
    const railGeom = new THREE.BufferGeometry();
    railGeom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            [
                -railW, 0, 0, -railW, 1, 0, railW, 0, 0, railW, 1, 0,
            ],
            3,
        ),
    );
    const railStroke = new THREE.LineSegments(railGeom, edgeMat.clone());
    railStroke.name = "normalShaftEdgeStroke";
    arrowHelper.line.add(railStroke);
}

/** Black normal arrow with white edge stroke on the black shaft and cone (no halo arrow). */
function createFaceNormalArrowGroup(dir, origin, shaftLen, headLen, headRad) {
    const g = new THREE.Group();
    const core = new THREE.ArrowHelper(
        dir.clone(),
        origin.clone(),
        shaftLen,
        0x000000,
        headLen,
        headRad,
    );
    core.traverse((o) => {
        if (o.material) {
            o.material.toneMapped = false;
            o.material.depthTest = true;
        }
    });
    addFaceNormalArrowEdgeStroke(core, headLen);
    g.add(core);
    return g;
}

// --- Net Creation function --- Accepts netData from JSON
function createNetFromData(netData) {
    console.log("Creating net geometry from loaded data...");
    const L = sideLength;
    clearSceneGeometry();

    try {
        const baseFaceColorValue = parseColor(netData.baseFace.color);
        allVertices[1] = resolveNetFaceVertices(netData.baseFace, L);
        const baseGeom = createRegularPolygonGeometry(allVertices[1]);
        if (
            !baseGeom.attributes.position ||
            baseGeom.attributes.position.count === 0
        )
            throw new Error("Base geometry creation failed.");
        f1Mesh = new THREE.Mesh(
            baseGeom,
            createFaceMaterial(
                baseFaceColorValue,
                RENDER_MODES[currentRenderModeIndex],
            ),
        );
        f1Mesh.userData.faceColorHex = baseFaceColorValue;
        f1Mesh.userData.faceId = 1;
        addFaceOutlineEdges(f1Mesh, baseGeom);
        scene.add(f1Mesh);

        const f1LocalCenter = calculateLocalCenter(allVertices[1]);
        const f1LocalNormal = calculateLocalNormal(allVertices[1]);
        const arrowGroup1 = createFaceNormalArrowGroup(
            f1LocalNormal,
            f1LocalCenter,
            L / 2,
            L / 4,
            L / 8,
        );
        f1Mesh.add(arrowGroup1);
        normalHelpers[1] = arrowGroup1;

        const connections = netData.connections;
        const tempVec1 = new THREE.Vector3();
        const tempVec2 = new THREE.Vector3();
        const Q = new THREE.Vector3();
        const tempMatrix = new THREE.Matrix4();
        const tempQuatInv = new THREE.Quaternion();
        const tempWorldPos = new THREE.Vector3();

        for (const conn of connections) {
            const i = conn.from;
            const j = conn.to;
            const colorInput = conn.color;
            if (typeof i !== "number" || typeof j !== "number" || j < 0) {
                console.warn(
                    `Skipping invalid connection definition (missing or invalid type/value):`,
                    conn,
                );
                continue;
            }

            let Fi_base_vertices;
            try {
                Fi_base_vertices = resolveNetFaceVertices(conn, L);
            } catch (err) {
                console.warn(`Skipping F${i}: ${err.message}`);
                continue;
            }
            const k = Fi_base_vertices.numSides;
            if (k < 3) {
                console.warn(
                    `Skipping invalid connection definition (missing or invalid type/value):`,
                    conn,
                );
                continue;
            }

            let parentVertices = j === 1 ? allVertices[1] : allVertices[j];
            if (!parentVertices?.numSides) {
                console.error(
                    `Net Gen Error: Parent F${j} vertices not found for F${i}`,
                );
                continue;
            }

            const Fi_M_vertex_index = conn.fromEdge[0];
            const Fi_N_vertex_index = conn.fromEdge[1];
            if (
                Fi_M_vertex_index === undefined ||
                Fi_M_vertex_index < 0 ||
                Fi_M_vertex_index >= k ||
                Fi_N_vertex_index === undefined ||
                Fi_N_vertex_index < 0 ||
                Fi_N_vertex_index >= k
            ) {
                console.warn(
                    `Skipping F${i}: Invalid fromEdge indices ${conn.fromEdge}`,
                );
                continue;
            }
            const W = tempVec1.subVectors(
                Fi_base_vertices[Fi_N_vertex_index],
                Fi_base_vertices[Fi_M_vertex_index],
            );

            const parentNumSides = parentVertices.numSides;
            const Fj_R_vertex_index = conn.toEdge[0];
            const Fj_S_vertex_index = conn.toEdge[1];
            if (
                Fj_R_vertex_index === undefined ||
                Fj_R_vertex_index < 0 ||
                Fj_R_vertex_index >= parentNumSides ||
                Fj_S_vertex_index === undefined ||
                Fj_S_vertex_index < 0 ||
                Fj_S_vertex_index >= parentNumSides
            ) {
                console.warn(
                    `Skipping F${i}: Invalid toEdge indices ${conn.toEdge} for parent F${j}`,
                );
                continue;
            }
            const Fj_R_vertex = parentVertices[Fj_R_vertex_index];
            const Fj_S_vertex = parentVertices[Fj_S_vertex_index];
            if (!Fj_R_vertex || !Fj_S_vertex) {
                console.error(
                    `Net Gen Error: Parent F${j} R/S vertices missing for F${i}`,
                );
                continue;
            }
            const V = tempVec2.subVectors(Fj_S_vertex, Fj_R_vertex);

            const dot = W.x * V.x + W.z * V.z;
            const det = W.x * V.z - W.z * V.x;
            let alpha = Math.atan2(det, dot);
            if (W.lengthSq() < 1e-9 || V.lengthSq() < 1e-9) alpha = 0;

            const cosA = Math.cos(alpha);
            const sinA = Math.sin(alpha);
            const Fi_rotated_vertices = Fi_base_vertices.map(
                (v) =>
                    new THREE.Vector3(
                        v.x * cosA - v.z * sinA,
                        0,
                        v.x * sinA + v.z * cosA,
                    ),
            );
            const Fi_M_rotated_vertex = Fi_rotated_vertices[Fi_M_vertex_index];
            Q.subVectors(Fj_R_vertex, Fi_M_rotated_vertex);
            const Fi_final_world_vertices = Fi_rotated_vertices.map((v) =>
                v.clone().add(Q),
            );

            unfoldFlipFlapIfOverlappingParent(
                Fi_final_world_vertices,
                k,
                parentVertices,
                parentNumSides,
                Fj_R_vertex_index,
                Fj_S_vertex_index,
                Fj_R_vertex,
                Fj_S_vertex,
            );

            allVertices[i] = Fi_final_world_vertices;
            allVertices[i].numSides = k;
            if (Fi_base_vertices.isStarPolygon) {
                allVertices[i].isStarPolygon = true;
            }
            allVertices[i].conn = {
                R_idx: Fi_M_vertex_index,
                S_idx: Fi_N_vertex_index,
            };

            if (allVertices[i]) {
                const fi_worldVertices = allVertices[i];
                let parentObject = j === 1 ? scene : pivots[j];
                if (!parentObject) {
                    console.error(
                        `Net Gen Error: Parent object not found for F${i}`,
                    );
                    continue;
                }
                const fj_R_target = Fj_R_vertex;
                const fj_S_target = Fj_S_vertex;
                const edgeMidpointWorld = fj_R_target
                    .clone()
                    .add(fj_S_target)
                    .multiplyScalar(0.5);
                const edgeAxisWorld = fj_R_target
                    .clone()
                    .sub(fj_S_target)
                    .normalize();
                const pivot = new THREE.Group();
                pivots[i] = pivot;
                parentObject.updateWorldMatrix(true, true);
                tempMatrix.copy(parentObject.matrixWorld).invert();
                pivot.position.copy(edgeMidpointWorld).applyMatrix4(tempMatrix);
                tempQuatInv
                    .copy(
                        parentObject.getWorldQuaternion(new THREE.Quaternion()),
                    )
                    .invert();
                pivot.userData.axis = edgeAxisWorld
                    .clone()
                    .applyQuaternion(tempQuatInv);
                pivot.quaternion.identity();
                parentObject.add(pivot);
                pivot.getWorldPosition(tempWorldPos);
                const pivotWorldQuaternionInv = pivot
                    .getWorldQuaternion(new THREE.Quaternion())
                    .invert();
                const fi_localVertices = fi_worldVertices.map((worldVert) =>
                    worldVert
                        .clone()
                        .sub(tempWorldPos)
                        .applyQuaternion(pivotWorldQuaternionInv),
                );
                const geometry = createRegularPolygonGeometry(fi_localVertices);
                if (
                    !geometry.attributes.position ||
                    geometry.attributes.position.count === 0
                )
                    throw new Error(`Geometry creation failed for F${i}`);
                const colorValue = parseColor(colorInput);
                const faceMesh = new THREE.Mesh(
                    geometry,
                    createFaceMaterial(
                        colorValue,
                        RENDER_MODES[currentRenderModeIndex],
                    ),
                );
                faceMesh.userData.faceColorHex = colorValue;
                faceMesh.userData.faceId = i;
                faceMesh.position.set(0, 0, 0);
                addFaceOutlineEdges(faceMesh, geometry);
                pivot.add(faceMesh);
                const localCenter = calculateLocalCenter(fi_localVertices);
                const localNormal = calculateLocalNormal(fi_localVertices);
                const arrowGroup = createFaceNormalArrowGroup(
                    localNormal,
                    localCenter,
                    L / 2,
                    L / 4,
                    L / 8,
                );
                pivot.add(arrowGroup);
                normalHelpers[i] = arrowGroup;
            }
        }
        console.log("Finished creating net geometry.");

        if (toggleNormalsCheckbox)
            setNormalHelpersVisibility(toggleNormalsCheckbox.checked);
        else setNormalHelpersVisibility(false);
        applyRenderModeVisualLayers();
        if (isNetBuilderActive) rebuildEdgePickMeshes();
        refreshFoldControlState();
    } catch (error) {
        console.error("Error during net creation:", error);
        alert(
            "An error occurred while creating the net geometry. Check console.",
        );
        clearSceneGeometry();
    }
}

/** Invisible until hover; raycaster still hits geometry. Hover = solid green band. */
const BUILDER_EDGE_PICK_RADIUS = 0.085;
const BUILDER_EDGE_PICK_OPACITY_IDLE = 0;
const BUILDER_EDGE_PICK_OPACITY_HOVER = 0.92;

function makeEdgePickMesh(a, b, userData) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-6) return null;
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const r = BUILDER_EDGE_PICK_RADIUS;
    const geom = new THREE.CylinderGeometry(r, r, len, 8);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x66ffcc,
        transparent: true,
        opacity: BUILDER_EDGE_PICK_OPACITY_IDLE,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.clone().normalize(),
    );
    mesh.userData.pick = userData;
    mesh.renderOrder = 900;
    return mesh;
}

function clearEdgePickGroup() {
    if (!edgePickGroup) return;
    while (edgePickGroup.children.length > 0) {
        const c = edgePickGroup.children[0];
        disposeObjectTree(c);
        edgePickGroup.remove(c);
    }
}

function syncBuilderEdgePicksVisibility() {
    if (!edgePickGroup) return;
    const netFlat = !isFolded && !isAnimating;
    edgePickGroup.visible = Boolean(isNetBuilderActive && netFlat);
}

function rebuildEdgePickMeshes() {
    clearEdgePickGroup();
    if (!edgePickGroup || !isNetBuilderActive) return;
    for (const faceKey of Object.keys(allVertices)) {
        const faceId = parseInt(faceKey, 10);
        if (Number.isNaN(faceId)) continue;
        const verts = allVertices[faceKey];
        if (!verts || verts.length < 3) continue;
        const n = verts.numSides || verts.length;
        for (let i = 0; i < n; i++) {
            const v0 = i;
            const v1 = (i + 1) % n;
            const key = NetBuilder.edgeKey(faceId, v0, v1);
            if (builderUsedEdgeKeys.has(key)) continue;
            const a = verts[v0];
            const b = verts[v1];
            if (!(a instanceof THREE.Vector3) || !(b instanceof THREE.Vector3))
                continue;
            const mesh = makeEdgePickMesh(a, b, { faceId, v0, v1, key });
            if (mesh) edgePickGroup.add(mesh);
        }
    }
    syncBuilderEdgePicksVisibility();
}

function setBuilderHintVisible(show, x, y) {
    if (!builderHintEl) return;
    builderHintEl.style.display = show ? "block" : "none";
    if (show) {
        builderHintEl.style.left = `${x + 12}px`;
        builderHintEl.style.top = `${y + 12}px`;
    }
}

function updateBuilderPickHover(clientX, clientY) {
    if (
        !isNetBuilderActive ||
        !edgePickGroup ||
        !renderer
    ) {
        if (builderHoveredPick) {
            builderHoveredPick.material.opacity =
                BUILDER_EDGE_PICK_OPACITY_IDLE;
            builderHoveredPick = null;
        }
        setBuilderHintVisible(false, 0, 0);
        return;
    }
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(edgePickGroup.children, false);
    if (builderHoveredPick) {
        builderHoveredPick.material.opacity =
            BUILDER_EDGE_PICK_OPACITY_IDLE;
        builderHoveredPick = null;
    }
    if (hits.length > 0) {
        builderHoveredPick = hits[0].object;
        builderHoveredPick.material.opacity =
            BUILDER_EDGE_PICK_OPACITY_HOVER;
        setBuilderHintVisible(true, clientX, clientY);
    } else {
        setBuilderHintVisible(false, 0, 0);
    }
}

function exitNetBuilder() {
    isNetBuilderActive = false;
    builderNetData = null;
    builderPendingEdge = null;
    builderUsedEdgeKeys.clear();
    builderDirty = false;
    clearBuilderFaceSelection();
    if (builderPanelEl) builderPanelEl.hidden = true;
    if (builderAttachPanel) builderAttachPanel.hidden = true;
    if (exitBuilderBtn) exitBuilderBtn.disabled = true;
    clearEdgePickGroup();
    setBuilderHintVisible(false, 0, 0);
}

function enterNetBuilderFromData(netData, options = {}) {
    clearBuilderFaceSelection();
    builderNetData = JSON.parse(JSON.stringify(netData));
    builderPendingEdge = null;
    isNetBuilderActive = true;
    builderDirty = options.fromSavedPreset === true ? false : true;
    if (builderPanelEl) builderPanelEl.hidden = false;
    if (builderAttachPanel) builderAttachPanel.hidden = true;
    if (exitBuilderBtn) exitBuilderBtn.disabled = false;
    hydrateUsedEdgesFromNet(builderNetData);
    loadAndProcessNet(builderNetData, { allowUnknownSignature: true });
    setCreateSectionExpanded(true);
}

function hydrateUsedEdgesFromNet(netData) {
    builderUsedEdgeKeys.clear();
    for (const c of netData.connections || []) {
        const a = c.toEdge[0];
        const b = c.toEdge[1];
        builderUsedEdgeKeys.add(NetBuilder.edgeKey(c.to, a, b));
    }
}

function netColorToHexInput(colorInput) {
    const n = parseColor(colorInput);
    return `#${n.toString(16).padStart(6, "0")}`;
}

function buildFaceSpecFromAttachLikeInputs(kindSelect, regSides, schlafli, irrSel) {
    const kind = kindSelect?.value || "regular";
    if (kind === "irregular") {
        const key = irrSel?.value;
        const lib = NetBuilder.IRREGULAR_POLYGON_LIBRARY[key];
        if (!lib) throw new Error("Pick a template polygon.");
        return { vertices: lib.vertices.map((p) => [...p]) };
    }
    if (kind === "schlafli") {
        const sym = (schlafli?.value || "").trim();
        if (!sym) throw new Error("Enter a Schläfli symbol.");
        return { schlafliText: sym };
    }
    const n = parseInt(regSides?.value || "4", 10);
    if (n < 3 || n > 12) {
        throw new Error("Sides must be 3–12 (or use Schläfli for larger n).");
    }
    return { noSides: n };
}

function peekSideCountFromSpec(spec, edgeLenForSchlafli) {
    if (spec.noSides != null) return spec.noSides;
    if (spec.vertices) return spec.vertices.length;
    if (spec.schlafliText != null) {
        const s = NetBuilder.schlafliTextToFaceSpec(
            String(spec.schlafliText),
            edgeLenForSchlafli,
        );
        return s.noSides ?? s.vertices?.length ?? null;
    }
    return null;
}

function getBuilderFacePickMeshes() {
    const out = [];
    forEachFaceMesh((m) => out.push(m));
    return out;
}

function pickBuilderFaceMesh(clientX, clientY) {
    if (!renderer || !camera) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(getBuilderFacePickMeshes(), false);
    for (let i = 0; i < hits.length; i++) {
        const o = hits[i].object;
        if (o?.userData?.faceId != null) return o;
    }
    return null;
}

function refreshBuilderFaceSelectionHighlight() {
    removeBuilderFaceSelectionOverlays();
    const mode = RENDER_MODES[currentRenderModeIndex] || "flat";
    forEachFaceMesh((mesh) => {
        const sid = mesh.userData.faceId;
        const sel =
            isNetBuilderActive &&
            sid != null &&
            sid === builderSelectedFaceId;
        const m = mesh.material;
        if (!m) return;
        if (m.emissive) {
            m.emissive.setHex(sel ? 0xcc5500 : 0x000000);
            m.emissiveIntensity = sel ? 0.75 : 0;
        }
        if (m.color && mode === "wireframe") {
            m.color.setHex(sel ? 0xffaa66 : 0xffffff);
            m.opacity = sel ? 0.45 : 0.1;
        }
        m.needsUpdate = true;
    });
    syncBuilderFaceSelectionOverlay();
    updateEdgeLinesForRenderMode();
}

function syncBuilderDeleteFaceButton() {
    const btn = document.getElementById("builderDeleteFaceBtn");
    if (!btn) return;
    if (builderSelectedFaceId === 1) {
        btn.textContent = "Remove all flaps";
        const n = builderNetData?.connections?.length ?? 0;
        btn.disabled = n === 0;
        btn.title =
            n === 0
                ? "Nothing attached to the base."
                : "Detach every polygon from the base (the base face stays).";
    } else {
        btn.textContent = "Delete face";
        btn.disabled = false;
        btn.title =
            "Delete this polygon and every polygon attached along it.";
    }
}

function syncEditFacePanelFromSelection() {
    if (builderSelectedFaceId == null || !builderNetData) return;
    const fid = builderSelectedFaceId;
    let raw = "#c9b8e8";
    if (fid === 1) {
        raw = builderNetData.baseFace?.color ?? raw;
    } else {
        const c = builderNetData.connections?.find((x) => x.from === fid);
        raw = c?.color ?? raw;
    }
    if (editFaceColorInputEl) editFaceColorInputEl.value = netColorToHexInput(raw);
    syncBuilderDeleteFaceButton();
}

function clearBuilderFaceSelection() {
    builderSelectedFaceId = null;
    if (builderFacePanelEl) builderFacePanelEl.hidden = true;
    refreshBuilderFaceSelectionHighlight();
}

function setBuilderSelectedFace(faceId) {
    builderSelectedFaceId = faceId;
    if (builderFacePanelEl) builderFacePanelEl.hidden = false;
    const label = document.getElementById("builderSelectedFaceLabel");
    if (label) label.textContent = `Face ${faceId}`;
    syncEditFacePanelFromSelection();
    refreshBuilderFaceSelectionHighlight();
}

function deleteSelectedBuilderFace() {
    if (!isNetBuilderActive || builderSelectedFaceId == null || !builderNetData) {
        return;
    }
    const fid = builderSelectedFaceId;
    if (fid === 1) {
        const n = (builderNetData.connections || []).length;
        if (n === 0) return;
        if (
            !confirm(
                "Remove every polygon attached to the base? The base face stays.",
            )
        ) {
            return;
        }
    } else if (
        !confirm(
            `Delete face ${fid} and every polygon attached to it?`,
        )
    ) {
        return;
    }
    try {
        NetBuilder.removeFaceSubtreeFromNet(builderNetData, fid);
        builderPendingEdge = null;
        if (builderAttachPanel) builderAttachPanel.hidden = true;
        clearBuilderFaceSelection();
        hydrateUsedEdgesFromNet(builderNetData);
        loadAndProcessNet(builderNetData, { allowUnknownSignature: true });
        builderDirty = true;
    } catch (err) {
        alert(err.message || String(err));
    }
}

function applyReplaceSelectedFaceShape() {
    if (!isNetBuilderActive || builderSelectedFaceId == null || !builderNetData) {
        return;
    }
    const color = editFaceColorInputEl?.value || "#b8a9d9";
    let spec;
    try {
        spec = buildFaceSpecFromAttachLikeInputs(
            editFaceKindSelect,
            editFaceRegularSidesSelect,
            editFaceSchlafliInputEl,
            editFaceIrregularSelectEl,
        );
    } catch (err) {
        alert(err.message || String(err));
        return;
    }
    const fid = builderSelectedFaceId;
    try {
        if (fid === 1) {
            const prevSides = NetBuilder.getFaceSideCount(builderNetData, 1);
            const nextSides = peekSideCountFromSpec(spec, sideLength);
            const nConn = builderNetData.connections?.length ?? 0;
            if (
                prevSides != null &&
                nextSides != null &&
                prevSides !== nextSides &&
                nConn > 0 &&
                !confirm(
                    "Changing the base polygon’s side count removes all attached faces. Continue?",
                )
            ) {
                return;
            }
            NetBuilder.replaceBaseFaceInNet(builderNetData, spec, color, {
                referenceSideLength: sideLength,
            });
        } else {
            const conn = builderNetData.connections.find((c) => c.from === fid);
            if (!conn) throw new Error("Connection missing for selected face.");
            const pv = allVertices[conn.to];
            const ia = conn.toEdge[0];
            const ib = conn.toEdge[1];
            if (!pv?.[ia] || !pv?.[ib]) {
                throw new Error("Could not measure hinge edge; reload the net.");
            }
            const hingeLen = pv[ia].distanceTo(pv[ib]);
            if (hingeLen < 1e-6) throw new Error("Hinge edge is too short.");
            const desc = NetBuilder.collectDescendantFaceIds(
                builderNetData,
                fid,
            );
            const prevSides = NetBuilder.getFaceSideCount(builderNetData, fid);
            const nextSides = peekSideCountFromSpec(spec, hingeLen);
            if (
                desc.size > 0 &&
                prevSides != null &&
                nextSides != null &&
                prevSides !== nextSides &&
                !confirm(
                    "This polygon has faces attached to it. Changing the number of sides removes those attached faces. Continue?",
                )
            ) {
                return;
            }
            NetBuilder.replaceAttachedFaceShapeInNet(
                builderNetData,
                fid,
                spec,
                color,
                {
                    hingeMatchLength: hingeLen,
                    referenceSideLength: sideLength,
                },
            );
        }
        builderPendingEdge = null;
        if (builderAttachPanel) builderAttachPanel.hidden = true;
        clearBuilderFaceSelection();
        hydrateUsedEdgesFromNet(builderNetData);
        loadAndProcessNet(builderNetData, { allowUnknownSignature: true });
        builderDirty = true;
    } catch (err) {
        alert(err.message || String(err));
    }
}

function refreshSavedNetsSelect() {
    const sel = document.getElementById("savedNetsSelect");
    if (!sel) return;
    sel.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "Saved nets";
    sel.appendChild(ph);
    for (const p of NetBuilder.loadCustomPresetsFromStorage()) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        sel.appendChild(opt);
    }
}

// --- Function to set visibility of all normal helpers ---
function setNormalHelpersVisibility(visible) {
    Object.values(normalHelpers).forEach((helper) => {
        if (helper) helper.visible = visible;
    });
}

// --- Event handler for the checkbox ---
function toggleNormalHelpersVisibility() {
    if (toggleNormalsCheckbox)
        setNormalHelpersVisibility(toggleNormalsCheckbox.checked);
}

// --- Button Click Handlers & Animation ---
function getPivotsForStage(stage) {
    const effectiveStage = Math.abs(stage);
    if (effectiveStage >= 1 && effectiveStage <= NUM_ANIMATION_STAGES) {
        const pivotIndex = effectiveStage + 1;
        return pivots[pivotIndex] ? [pivotIndex] : [];
    } else {
        return [];
    }
}

// triggerAnimationStage uses currentFoldAngles when present; otherwise trial fold angles.
function triggerAnimationStage(stage, meta = {}) {
    if (!currentFoldAngles && NUM_ANIMATION_STAGES < 1) {
        console.warn("Cannot trigger animation: no fold angles and no flaps.");
        isAnimating = false;
        return;
    }
    currentAnimationStage = stage;
    pivotsInCurrentStage = getPivotsForStage(stage);
    if (pivotsInCurrentStage.length === 0) {
        isAnimating = false;
        currentAnimationStage = 0;
        pauseButton.disabled = true;
        pauseButton.textContent = "Pause";
        isPaused = false;
        const endStageUnfold = -(NUM_ANIMATION_STAGES + 1);
        if (stage === endStageUnfold) {
            isFolded = false;
            console.log(`Seq unfold complete.`);
            if (!currentFoldAngles) setInfoLayoutStatus();
        } else if (meta.foldSequenceComplete) {
            isFolded = true;
            console.log("Seq fold complete.");
        }
        refreshFoldControlState();
        syncBuilderEdgePicksVisibility();
        return;
    }
    const unfolding = stage < 0;
    const mPointVec1 = new THREE.Vector3(),
        mPointVec2 = new THREE.Vector3(),
        mPointVec3 = new THREE.Vector3();

    for (const pivotIndex of pivotsInCurrentStage) {
        const pivot = pivots[pivotIndex];
        const faceIndex = pivotIndex;
        const faceData = allVertices[faceIndex];
        if (!pivot || !pivot.parent || !faceData) {
            startQuaternions[pivotIndex] = null;
            targetQuaternions[pivotIndex] = null;
            continue;
        }
        const parent = pivot.parent;
        const parentKey = Object.keys(pivots).find(
            (key) => pivots[key] === parent,
        );
        const parentIndex =
            parent === scene ? 1 : parentKey ? parseInt(parentKey, 10) : null;
        const parentData = parentIndex ? allVertices[parentIndex] : null;
        if (
            !pivot.userData.axis ||
            !parentData ||
            !faceData.conn ||
            !parentData.numSides ||
            !faceData.numSides
        ) {
            startQuaternions[pivotIndex] = null;
            targetQuaternions[pivotIndex] = null;
            continue;
        }

        const sides_i = faceData.numSides;
        const sides_j = parentData.numSides;
        let baseTargetAngle;
        if (currentFoldAngles) {
            let baseFoldAngleKey = `${sides_i}-${sides_j}`;
            baseTargetAngle = currentFoldAngles[baseFoldAngleKey];
            if (baseTargetAngle === undefined) {
                baseFoldAngleKey = `${sides_j}-${sides_i}`;
                baseTargetAngle = currentFoldAngles[baseFoldAngleKey];
            }
            if (baseTargetAngle === undefined) {
                console.warn(
                    `Using default fold angle for key ${baseFoldAngleKey}.`,
                );
                baseTargetAngle = EXPERIMENTAL_FOLD_ANGLE_RAD;
            }
        } else {
            baseTargetAngle = EXPERIMENTAL_FOLD_ANGLE_RAD;
        }
        if (unfolding) baseTargetAngle = 0;

        let angleSign = 1;
        if (!unfolding) {
            const parentWorldVertices = getMeshWorldVertices(parentIndex);
            const centerF = parentWorldVertices
                ? calculateWorldCentroid(parentWorldVertices)
                : null;
            const normalF = parentWorldVertices
                ? calculateWorldNormal(parentWorldVertices)
                : null;
            const vertsG_plus = calculateHypotheticalWorldVertices(
                faceIndex,
                baseTargetAngle,
            );
            const centerG_plus = vertsG_plus
                ? calculateWorldCentroid(vertsG_plus)
                : null;
            const normalG_plus = vertsG_plus
                ? calculateWorldNormal(vertsG_plus)
                : null;
            const vertsG_minus = calculateHypotheticalWorldVertices(
                faceIndex,
                -baseTargetAngle,
            );
            const centerG_minus = vertsG_minus
                ? calculateWorldCentroid(vertsG_minus)
                : null;
            const normalG_minus = vertsG_minus
                ? calculateWorldNormal(vertsG_minus)
                : null;
            const M1 =
                centerF && normalF
                    ? mPointVec1.copy(centerF).add(normalF)
                    : null;
            const M2 =
                centerG_plus && normalG_plus
                    ? mPointVec2.copy(centerG_plus).add(normalG_plus)
                    : null;
            const M2_prime =
                centerG_minus && normalG_minus
                    ? mPointVec3.copy(centerG_minus).add(normalG_minus)
                    : null;
            const bulkC = computeBulkCentroidWorldExcludingFace(faceIndex);
            if (bulkC && centerG_plus && centerG_minus) {
                const dBulkPlus = centerG_plus.distanceToSquared(bulkC);
                const dBulkMinus = centerG_minus.distanceToSquared(bulkC);
                if (Math.abs(dBulkPlus - dBulkMinus) > 1e-5) {
                    angleSign = dBulkPlus < dBulkMinus ? 1 : -1;
                } else if (M1 && M2 && M2_prime) {
                    const dSq = M1.distanceToSquared(M2);
                    const dPrimeSq = M1.distanceToSquared(M2_prime);
                    angleSign = dSq > dPrimeSq ? 1 : -1;
                } else {
                    angleSign = 1;
                }
            } else if (M1 && M2 && M2_prime) {
                const dSq = M1.distanceToSquared(M2);
                const dPrimeSq = M1.distanceToSquared(M2_prime);
                angleSign = dSq > dPrimeSq ? 1 : -1;
            } else {
                angleSign = 1;
            }
        }
        const targetAngleValue = angleSign * baseTargetAngle;
        startQuaternions[pivotIndex] = pivot.quaternion.clone();
        targetQuaternions[pivotIndex] = new THREE.Quaternion().setFromAxisAngle(
            pivot.userData.axis,
            targetAngleValue,
        );
    }
    animationStartTime = performance.now();
    pausedElapsedTime = 0;
    isAnimating = true;
    isPaused = false;
    pauseButton.disabled = false;
    pauseButton.textContent = "Pause";
    syncBuilderEdgePicksVisibility();
}

// toggleFold, togglePause, onWindowResize, easeInOutQuad, animate
function toggleFold() {
    if (!f1Mesh) return;
    if (!currentFoldAngles && NUM_ANIMATION_STAGES < 1) return;
    if (trialFoldPauseActive) {
        trialFoldPauseActive = false;
        clearTrialJuiceVisuals();
        if (infoDisplay) {
            infoDisplay.textContent =
                "Unfolding… (still no fold table for this net)";
        }
        triggerAnimationStage(-1);
        refreshFoldControlState();
        syncBuilderEdgePicksVisibility();
        return;
    }
    if (isAnimating && !isPaused) return;
    if (isAnimating && isPaused) {
        togglePause();
        return;
    }
    isPaused = false;
    pauseButton.textContent = "Pause";
    if (!isFolded) {
        if (NUM_ANIMATION_STAGES < 1) {
            isFolded = true;
            refreshFoldControlState();
            syncBuilderEdgePicksVisibility();
            return;
        }
        triggerAnimationStage(1);
    } else {
        if (NUM_ANIMATION_STAGES < 1) {
            isFolded = false;
            refreshFoldControlState();
            syncBuilderEdgePicksVisibility();
            return;
        }
        triggerAnimationStage(-1);
    }
    refreshFoldControlState();
    syncBuilderEdgePicksVisibility();
}
function togglePause() {
    if (!isAnimating) return;
    isPaused = !isPaused;
    if (isPaused) {
        pausedElapsedTime = performance.now() - animationStartTime;
        pauseButton.textContent = "Resume";
    } else {
        animationStartTime = performance.now() - pausedElapsedTime;
        pauseButton.textContent = "Pause";
    }
}
function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function animate(currentTime) {
    requestAnimationFrame(animate);
    if (isAnimating && !isPaused) {
        const elapsedTime = currentTime - animationStartTime;
        let progress = Math.min(elapsedTime / currentAnimationDuration, 1);
        const easedProgress = easeInOutQuad(progress);
        for (const pivotIndex of pivotsInCurrentStage) {
            const pivot = pivots[pivotIndex];
            if (
                pivot &&
                startQuaternions[pivotIndex] &&
                targetQuaternions[pivotIndex]
            )
                pivot.quaternion
                    .copy(startQuaternions[pivotIndex])
                    .slerp(targetQuaternions[pivotIndex], easedProgress);
        }
        if (progress >= 1) {
            for (const pivotIndex of pivotsInCurrentStage) {
                const pivot = pivots[pivotIndex];
                if (pivot && targetQuaternions[pivotIndex])
                    pivot.quaternion.copy(targetQuaternions[pivotIndex]);
            }
            let nextStage = 0;
            if (
                currentAnimationStage > 0 &&
                currentAnimationStage < NUM_ANIMATION_STAGES
            )
                nextStage = currentAnimationStage + 1;
            else if (
                currentAnimationStage < 0 &&
                currentAnimationStage > -NUM_ANIMATION_STAGES
            )
                nextStage = currentAnimationStage - 1;
            else if (currentAnimationStage === NUM_ANIMATION_STAGES)
                nextStage = canTrialFoldLayout() ? -1 : 0; // Trial: rebound instead of "closed"
            else if (currentAnimationStage === -NUM_ANIMATION_STAGES)
                nextStage = -(NUM_ANIMATION_STAGES + 1); // End unfold
            const trialRebound =
                nextStage === -1 &&
                currentAnimationStage === NUM_ANIMATION_STAGES &&
                canTrialFoldLayout();
            if (trialRebound) {
                beginTrialReboundPause();
            } else {
                triggerAnimationStage(nextStage, {
                    foldSequenceComplete:
                        nextStage === 0 &&
                        currentAnimationStage === NUM_ANIMATION_STAGES,
                });
            }
        }
    }
    syncBuilderEdgePicksVisibility();
    controls.update();
    renderer.render(scene, camera);
}

const presetNets = document.getElementById("presetNets");

const savedNetsSelect = document.getElementById("savedNetsSelect");

savedNetsSelect?.addEventListener("change", () => {
    const id = savedNetsSelect.value;
    if (!id) return;
    if (
        isNetBuilderActive &&
        builderDirty &&
        !confirmDiscardBuilderWork("Loading another saved net.")
    ) {
        savedNetsSelect.value = "";
        return;
    }
    const presets = NetBuilder.loadCustomPresetsFromStorage();
    const p = presets.find((x) => x.id === id);
    savedNetsSelect.value = "";
    if (!p) {
        alert("Saved net not found.");
        return;
    }
    enterNetBuilderFromData(p.netData, { fromSavedPreset: true });
});

presetNets.addEventListener("change", async (e) => {
    const netName = e.target.value;
    if (!netName) return;
    if (!confirmDiscardBuilderWork("Loading a preset net.")) {
        presetNets.value = "";
        return;
    }
    exitNetBuilder();
    try {
        const response = await fetch(`nets/${netName}.json`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const netData = await response.json();
        console.log(`Processing preset net: ${netName}`);
        loadAndProcessNet(netData);
    } catch (error) {
        console.error("Error loading preset net:", error);
        alert(`Error loading preset net: ${error.message}`);
    } finally {
        presetNets.value = "";
    }
});

// --- Start Application ---
init();
