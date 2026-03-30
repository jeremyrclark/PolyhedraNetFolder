// Polyhedra Net Folder — script v1.60

// --- Imports ---
import * as THREE from "three";
import { TrackballControls } from "./js/TrackballControls.js";
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
/** Uniform pyramid stellation caps (Mode: uniform-caps). */
let stellationCapsGroup = null;
/** Extruded panels from stellation diagram region picks (reference face). */
let stellationDiagramSelectionGroup = null;
/** @type {Set<string>} region centroid keys for stable selection across redraws */
const stellDiagramSelectedKeys = new Set();
/** Last diagram pick state (inverse transform + 3D frame). */
let stellDiagramPickState = null;
let stellDiagramPointerInside = false;
let stellDiagramLastPointerClientX = 0;
let stellDiagramLastPointerClientY = 0;
let stellDiagramViewZoom = 1;
let stellDiagramViewPanU = 0;
let stellDiagramViewPanV = 0;
let stellDiagramViewLastPolyKey = null;
let stellDiagramPanActive = false;
let stellDiagramPanPointerId = null;
let stellDiagramPanLastCssX = 0;
let stellDiagramPanLastCssY = 0;
let stellDiagramSuppressNextClick = false;
let stellDiagramPanHadMotion = false;
let stellDiagramPanUsedAltLeft = false;

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
let instantFoldButton;
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
/** After a successful edge attach: repeat via double-click on another edge. */
let builderLastQuickAttach = null;
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
let createBaseBlockEl = null;
let buildCustomNetBtnEl = null;
/** True after entering builder via "Build net" until rebuild / exit / load. */
let builderSessionFromScratch = false;
/** Appearance: main net in gold PBR for export / preview. */
let trophyPreviewGoldActive = false;

const TROPHY_STORAGE_KEY = "polyhedraNetFolder.trophies.v1";
/**
 * Strip stays hidden until this is "1", set when a trophy is newly awarded.
 * Legacy: one-time unlock for saves that had trophies before this flag existed (see migration key).
 */
const TROPHY_STRIP_UNLOCKED_KEY = "polyhedraNetFolder.trophyStripUnlocked.v1";
const TROPHY_STRIP_LEGACY_UNLOCK_MIGRATED_KEY =
    "polyhedraNetFolder.trophyStripLegacyUnlockMigrated.v1";

/**
 * Preset JSON under nets/ for each library polyhedron key.
 * Optional trophy PNGs: `trophies/<same basename as json>.png` (e.g. cube-top.png) or `trophies/<poly key>.png` (e.g. 4.4.4.png).
 */
const POLY_KEY_TO_PRESET_NET_FILE = {
    "3.3.3": "tetrahedron-top.json",
    "4.4.4": "cube-top.json",
    "3.3.3.3": "octahedron-top.json",
    "5.5.5": "dodecahedron-top.json",
    "3.3.3.3.3": "icosahedron-top.json",
    "3.6.6": "truncated-tetrahedron-top.json",
    "3.8.8": "truncated-cube-top.json",
    "4.6.6": "truncated-octahedron-top.json",
    "3.10.10": "truncated-dodecahedron-top.json",
    "5.6.6": "truncated-icosahedron-top.json",
    "3.4.3.4": "cuboctahedron-top.json",
    "4.6.8": "truncated-cuboctahedron-top.json",
    "3.5.3.5": "icosidodecahedron-top.json",
    "3.4.4.4": "rhombicuboctahedron-top.json",
    "3.4.5.4": "small-rhombicosidodecahedron-top.json",
    "4.6.10": "truncated-icosidodecahedron-top.json",
    "3.3.3.3.4": "snub-cube-top.json",
    "3.3.3.3.5": "snub-dodecahedron-top.json",
    "rhombic-dodecahedron": "rhombic-dodecahedron-net.json",
};

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

function colorCoordinatedBySidesEnabled() {
    const el = document.getElementById("colorBySidesCheckbox");
    return el ? el.checked : true;
}

/** Muted natural palette by polygon side count (display only when coordinated mode is on). */
const POLYGON_SIDE_COLOR_CSS = {
    3: "#c9a45c",
    4: "#9b87b8",
    5: "#6e9183",
    6: "#b88a72",
    7: "#7a8eb2",
    8: "#8f8374",
    9: "#a89b5c",
    10: "#9c7688",
    11: "#5c8585",
    12: "#c49a6c",
};

function colorCssForPolygonSides(n) {
    if (!Number.isFinite(n) || n < 3) return "#9a9aa8";
    if (POLYGON_SIDE_COLOR_CSS[n]) return POLYGON_SIDE_COLOR_CSS[n];
    const clamped = Math.min(Math.max(Math.round(n), 3), 12);
    return POLYGON_SIDE_COLOR_CSS[clamped] ?? "#9a9aa8";
}

function resolveDisplayColorHex(colorFromNet, sideCount) {
    if (colorCoordinatedBySidesEnabled() && sideCount >= 3) {
        return parseColor(colorCssForPolygonSides(sideCount));
    }
    return parseColor(colorFromNet);
}

function getVertexConfigKeyForNetData(netData) {
    try {
        const faceCounts = {};
        const baseCount = getFaceVertexCountFromSpec(netData.baseFace);
        if (baseCount == null) return null;
        faceCounts[baseCount.toString()] = 1;
        if (!netData.connections || !Array.isArray(netData.connections))
            return null;
        for (let index = 0; index < netData.connections.length; index++) {
            const conn = netData.connections[index];
            const nv = getFaceVertexCountFromSpec(conn);
            if (nv == null) return null;
            const k = nv.toString();
            faceCounts[k] = (faceCounts[k] || 0) + 1;
        }
        const signature = getFaceCountSignature(faceCounts);
        return faceCountSigToVertexConfigKey[signature] ?? null;
    } catch {
        return null;
    }
}

function trophyShortName(polyKey) {
    const raw = POLYHEDRON_DATA[polyKey]?.name || polyKey;
    const s = String(raw).replace(/\s*\([^)]*\)\s*/g, "").trim();
    return s || raw;
}

/** Poly key → which static 3D-style SVG to show. */
function trophyVisualKind(polyKey) {
    const m = {
        "4.4.4": "cube",
        "3.3.3": "tetra",
        "3.3.3.3": "octa",
        "5.5.5": "dodeca",
        "3.3.3.3.3": "ico",
    };
    return m[polyKey] || "arch";
}

/** Isometric gold solids (static SVG, no animation). */
function trophySvgMarkupForKey(polyKey, uniqueIndex) {
    const kind = trophyVisualKind(polyKey);
    const gid = `tg${uniqueIndex}`;
    const gTop = `<linearGradient id="${gid}-t" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fff8e0"/><stop offset="45%" stop-color="#e8c547"/><stop offset="100%" stop-color="#8a6a18"/></linearGradient>`;
    const gL = `<linearGradient id="${gid}-l" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#f2d56e"/><stop offset="100%" stop-color="#9a7214"/></linearGradient>`;
    const gR = `<linearGradient id="${gid}-r" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#d4af37"/><stop offset="100%" stop-color="#5c4208"/></linearGradient>`;
    const gMid = `<linearGradient id="${gid}-m" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stop-color="#fcefb4"/><stop offset="100%" stop-color="#a67c1a"/></linearGradient>`;

    if (kind === "cube") {
        return `<svg class="trophy-svg" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${gTop}${gL}${gR}</defs><path fill="url(#${gid}-t)" d="M24 5l15 9v1l-15 8-15-8V14z"/><path fill="url(#${gid}-l)" d="M9 15l15 8v20l-15-9V15z"/><path fill="url(#${gid}-r)" d="M24 23l15-8v18l-15 9V23z"/></svg>`;
    }
    if (kind === "tetra") {
        return `<svg class="trophy-svg" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${gTop}${gL}${gR}</defs><path fill="url(#${gid}-l)" d="M24 7L8 40L24 26L24 7z"/><path fill="url(#${gid}-r)" d="M24 7L40 40L24 26L24 7z"/><path fill="url(#${gid}-t)" d="M8 40h32L24 26L8 40z"/></svg>`;
    }
    if (kind === "octa" || kind === "ico") {
        return `<svg class="trophy-svg" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${gTop}${gL}${gR}</defs><path fill="url(#${gid}-t)" d="M24 5L10 22h28L24 5z"/><path fill="url(#${gid}-l)" d="M10 22l14 21V22H10z"/><path fill="url(#${gid}-r)" d="M38 22H24v21l14-21z"/></svg>`;
    }
    if (kind === "dodeca") {
        return `<svg class="trophy-svg" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${gTop}${gMid}</defs><path fill="url(#${gid}-m)" opacity="0.88" d="M24 36l-12-7-2-13 10-10h8l10 10-2 13-12 7z" transform="translate(0 1)"/><path fill="url(#${gid}-t)" d="M24 7l14 10-1 12-13 8-13-8-1-12 14-10z"/></svg>`;
    }
    return `<svg class="trophy-svg" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${gTop}${gL}${gR}${gMid}</defs><path fill="url(#${gid}-t)" d="M24 6l13 7v10l-13 8-13-8V13z"/><path fill="url(#${gid}-l)" d="M11 13l13 8v17l-13-7V13z"/><path fill="url(#${gid}-r)" d="M24 21l13-8v14l-13 7V21z"/><path fill="url(#${gid}-m)" opacity="0.72" d="M24 21v17l13-7V13l-13 8z"/></svg>`;
}

function renderTrophyStrip() {
    const strip = document.getElementById("trophyStrip");
    if (!strip) return;
    let keys = [];
    try {
        keys = JSON.parse(localStorage.getItem(TROPHY_STORAGE_KEY) || "[]");
    } catch {
        keys = [];
    }
    if (!Array.isArray(keys) || keys.length === 0) {
        strip.replaceChildren();
        strip.hidden = true;
        return;
    }
    let stripUnlocked = false;
    try {
        let u = localStorage.getItem(TROPHY_STRIP_UNLOCKED_KEY);
        if (u === null && keys.length > 0) {
            if (
                localStorage.getItem(TROPHY_STRIP_LEGACY_UNLOCK_MIGRATED_KEY) ===
                null
            ) {
                localStorage.setItem(TROPHY_STRIP_UNLOCKED_KEY, "1");
                localStorage.setItem(
                    TROPHY_STRIP_LEGACY_UNLOCK_MIGRATED_KEY,
                    "1",
                );
                u = "1";
            }
        }
        stripUnlocked = u === "1";
    } catch {
        stripUnlocked = false;
    }
    if (!stripUnlocked) {
        strip.replaceChildren();
        strip.hidden = true;
        return;
    }
    strip.hidden = false;
    strip.replaceChildren();
    const sorted = [...keys].filter((k) => POLYHEDRON_DATA[k]);
    sorted.sort((a, b) =>
        trophyShortName(a).localeCompare(trophyShortName(b), undefined, {
            sensitivity: "base",
        }),
    );
    for (let i = 0; i < sorted.length; i++) {
        const key = sorted[i];
        const item = document.createElement("div");
        item.className = "trophy-item";
        const medal = document.createElement("div");
        medal.className = "trophy-medal";
        medal.setAttribute("aria-hidden", "true");
        const thumb = document.createElement("img");
        thumb.className = "trophy-thumb-img";
        thumb.alt = "";
        thumb.decoding = "async";
        thumb.width = 44;
        thumb.height = 44;
        medal.appendChild(thumb);
        scheduleTrophyThumb(key, thumb);
        const lab = document.createElement("span");
        lab.className = "trophy-name";
        lab.textContent = trophyShortName(key);
        item.appendChild(lab);
        item.appendChild(medal);
        strip.appendChild(item);
    }
}

/**
 * @returns {boolean} true if this key was newly added to the collection
 */
function awardPolyhedronTrophyIfNew(polyKey) {
    if (!polyKey || !POLYHEDRON_DATA[polyKey]) return false;
    let keys = [];
    try {
        keys = JSON.parse(localStorage.getItem(TROPHY_STORAGE_KEY) || "[]");
    } catch {
        keys = [];
    }
    if (!Array.isArray(keys)) keys = [];
    if (keys.includes(polyKey)) return false;
    keys.push(polyKey);
    try {
        localStorage.setItem(TROPHY_STORAGE_KEY, JSON.stringify(keys));
        localStorage.setItem(TROPHY_STRIP_UNLOCKED_KEY, "1");
    } catch (e) {
        console.warn("Trophy save failed:", e);
        return false;
    }
    renderTrophyStrip();
    return true;
}

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
let foldSuccessAudioContext = null;
/** Last net JSON loaded successfully (presets / file); not used while relying on builderNetData in builder. */
let lastLoadedNetData = null;
let trophyThumbRenderer = null;
let trophyThumbScene = null;
const trophyThumbCache = new Map();
const trophyThumbInflight = new Map();
/** Bump when trophy image pipeline changes (clears stale cached data URLs). */
function trophyThumbCacheKey(polyKey) {
    return `v6:${polyKey}`;
}
/** Known-solid key for scratch-built net; trophy + chime after a full library fold completes. */
let pendingScratchTrophyKey = null;

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
 * Average world position of mesh vertices except one face (the flap being folded).
 * Used to pick fold sign so the flap closes toward the rest of the net.
 * When maxIncludedFaceId is set, only faces with id <= maxIncludedFaceId are used so
 * vertices still in the flat (not-yet-folded) sheet do not dominate the centroid —
 * that skewed mid-sequence sign choice for nets like the snub cube.
 */
function computeBulkCentroidWorldExcludingFace(
    excludeFaceId,
    maxIncludedFaceId = null,
) {
    const sum = new THREE.Vector3();
    let count = 0;
    const addFace = (fid) => {
        if (fid === excludeFaceId) return;
        if (
            maxIncludedFaceId != null &&
            maxIncludedFaceId >= 1 &&
            fid > maxIncludedFaceId
        )
            return;
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

/**
 * Face meshes expose buffer vertices in arbitrary order; the first three are not
 * always non-collinear. Pick the triple with largest triangle area (stable plane).
 * @param {THREE.Vector3[] | null} worldVerts
 * @returns {THREE.Vector3}
 */
function calculateWorldNormalRobust(worldVerts) {
    if (!worldVerts || worldVerts.length < 3)
        return new THREE.Vector3(0, 1, 0);
    const verts = worldVerts.filter((v) => v instanceof THREE.Vector3);
    if (verts.length < 3) return new THREE.Vector3(0, 1, 0);
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const c = new THREE.Vector3();
    let bestLenSq = 0;
    const best = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < verts.length; i++) {
        for (let j = i + 1; j < verts.length; j++) {
            for (let k = j + 1; k < verts.length; k++) {
                e1.subVectors(verts[j], verts[i]);
                e2.subVectors(verts[k], verts[i]);
                c.crossVectors(e1, e2);
                const l2 = c.lengthSq();
                if (l2 > bestLenSq) {
                    bestLenSq = l2;
                    best.copy(c);
                }
            }
        }
    }
    return bestLenSq > 1e-24 ? best.normalize() : new THREE.Vector3(0, 1, 0);
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
    exportRenderer.shadowMap.type = renderer.shadowMap.type;
    exportRenderer.setClearColor(0x000000, 0);

    /** PNG has no canvas-gray backdrop; PBR shadows read as pure black. Lift exposure + fill slightly for export only. */
    const mode = RENDER_MODES[currentRenderModeIndex] || "flat";
    const liftPbrExport = mode === "rendered" || trophyPreviewGoldActive;
    const lightRestores = [];
    if (liftPbrExport) {
        exportRenderer.toneMappingExposure *= 1.38;
        const bumpLight = (L, mult) => {
            if (!L) return;
            const o = L.intensity;
            L.intensity *= mult;
            lightRestores.push(() => {
                L.intensity = o;
            });
        };
        bumpLight(ambientLight, 1.32);
        bumpLight(hemiLight, 1.32);
        bumpLight(fillLight, 1.7);
        bumpLight(directionalLight, 1.06);
    }

    exportRenderer.render(scene, camera);

    for (let i = lightRestores.length - 1; i >= 0; i--) lightRestores[i]();

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = false;
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
    directionalLight.castShadow = false;
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
    controls = new TrackballControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.rotateSpeed = 1.2;
    controls.dynamicDampingFactor = 0.12;
    controls.panSpeed = 0.45;
    scene.add(createCrosshairAxesHelper(5));
    edgePickGroup = new THREE.Group();
    edgePickGroup.name = "edgePickGroup";
    scene.add(edgePickGroup);

    // Get DOM Elements
    foldButton = document.getElementById("foldButton");
    instantFoldButton = document.getElementById("instantFoldButton");
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
    createBaseBlockEl = document.getElementById("createBaseBlock");
    buildCustomNetBtnEl = document.getElementById("buildCustomNetBtn");

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

    document.getElementById("colorBySidesCheckbox")?.addEventListener("change", () => {
        if (lastLoadedNetData) {
            loadAndProcessNet(JSON.parse(JSON.stringify(lastLoadedNetData)), {
                allowUnknownSignature: true,
            });
        }
    });

    // Trophy preview (gold PBR) — disabled in UI; re-enable by restoring the Appearance checkbox + handler.
    // document.getElementById("trophyPreviewGoldCheckbox")?.addEventListener("change", (e) => {
    //     applyTrophyPreviewGold(Boolean(e.target.checked));
    // });

    renderTrophyStrip();

    // --- NO Default Net Load ---

    // Add Event Listeners
    window.addEventListener("resize", onWindowResize);
    foldButton.addEventListener("click", toggleFold);
    pauseButton.addEventListener("click", togglePause);
    instantFoldButton?.addEventListener("click", instantFoldToClosed);
    document.getElementById("stellationPresetSelect")?.addEventListener(
        "change",
        (e) => {
            const v = e.target.value;
            if (
                v !== "off" &&
                v !== "diagram" &&
                v !== "uniform-caps"
            )
                e.target.value = "off";
            refreshStellationSectionState();
        },
    );
    document
        .getElementById("stellationCapHeightSlider")
        ?.addEventListener("input", () => {
            refreshStellationCapHeightLabel();
            rebuildStellationUniformCapsIfNeeded();
        });
    const stellDiagCanvas = document.getElementById("stellationDiagramCanvas");
    stellDiagCanvas?.addEventListener("click", onStellationDiagramCanvasClick);
    stellDiagCanvas?.addEventListener(
        "pointerdown",
        onStellationDiagramCanvasPointerDown,
    );
    stellDiagCanvas?.addEventListener(
        "pointermove",
        onStellationDiagramCanvasPointerMove,
    );
    stellDiagCanvas?.addEventListener(
        "pointerup",
        onStellationDiagramCanvasPointerUp,
    );
    stellDiagCanvas?.addEventListener(
        "pointercancel",
        onStellationDiagramCanvasPointerUp,
    );
    stellDiagCanvas?.addEventListener(
        "pointerleave",
        onStellationDiagramCanvasPointerLeave,
    );
    stellDiagCanvas?.addEventListener("wheel", onStellationDiagramCanvasWheel, {
        passive: false,
    });
    document
        .getElementById("stellDiagramClearSelectionBtn")
        ?.addEventListener("click", () => {
            stellDiagramSelectedKeys.clear();
            redrawStellationDiagram();
            disposeStellationDiagramSelection3D();
        });
    refreshStellationSectionState();
    speedSlider.addEventListener("input", (event) => {
        const raw = parseInt(event.target.value, 10);
        const min = Number(speedSlider.min) || 10;
        const max = Number(speedSlider.max) || 4000;
        currentAnimationDuration = Math.min(
            max,
            Math.max(min, Number.isFinite(raw) ? raw : min),
        );
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
    document
        .getElementById("translucentStellationsCheckbox")
        ?.addEventListener("change", () => {
            rebuildStellationUniformCapsIfNeeded();
            rebuildStellationDiagramSelection3D();
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
            if (isNetBuilderActive && createBaseBlockEl?.hidden) {
                if (
                    builderDirty &&
                    !confirmDiscardBuilderWork("Rebuilding the net base.")
                ) {
                    return;
                }
                builderSessionFromScratch = false;
                pendingScratchTrophyKey = null;
                if (createBaseBlockEl) createBaseBlockEl.hidden = false;
                if (buildCustomNetBtnEl) buildCustomNetBtnEl.textContent = "Build net";
                exitNetBuilder();
                clearSceneGeometry();
                lastLoadedNetData = null;
                if (infoDisplay) infoDisplay.textContent = "Load a net file";
                currentFoldAngles = null;
                NUM_ANIMATION_STAGES = 0;
                refreshFoldControlState();
                return;
            }
            if (
                isNetBuilderActive &&
                builderDirty &&
                !confirmDiscardBuilderWork("Starting a new net.")
            ) {
                return;
            }
            const kind = createKindSelect?.value || "regular";
            let color = createColorInput?.value || "#c9b8e8";
            if (colorCoordinatedBySidesEnabled()) {
                if (kind === "regular") {
                    const n = parseInt(createRegularSides?.value || "4", 10);
                    color = colorCssForPolygonSides(n);
                } else if (kind === "irregular") {
                    const ik = createIrregularSelect?.value || "kite_quad";
                    const lib = NetBuilder.IRREGULAR_POLYGON_LIBRARY[ik];
                    const len = lib?.vertices?.length ?? 4;
                    color = colorCssForPolygonSides(len);
                } else if (kind === "schlafli") {
                    const sym = (createSchlafliInput?.value || "").trim();
                    if (!sym) {
                        throw new Error(
                            "Enter a Schläfli symbol (e.g. 6, 5/2, or {4,3}).",
                        );
                    }
                    const sp = NetBuilder.schlafliTextToFaceSpec(sym, sideLength);
                    const pc =
                        peekSideCountFromSpec(sp, sideLength) ??
                        getFaceVertexCountFromSpec(sp) ??
                        6;
                    color = colorCssForPolygonSides(pc);
                } else if (kind === "svg") {
                    const verts = NetBuilder.parseSvgPolygonToNetVertices(
                        createSvgTextarea?.value || "",
                    );
                    if (!verts)
                        throw new Error(
                            "Could not parse SVG (use <polygon points=\"...\"> or a simple closed <path d=\"M...Z\">).",
                        );
                    color = colorCssForPolygonSides(verts.length);
                }
            }
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
            enterNetBuilderFromData(data, { fromScratchBuild: true });
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

    attachNewFaceKind?.addEventListener("change", () => {
        const v = attachNewFaceKind.value;
        setPanelRowHidden("attachRowRegular", v !== "regular");
        setPanelRowHidden("attachRowSchlafli", v !== "schlafli");
        setPanelRowHidden("attachRowIrregular", v !== "irregular");
    });
    attachNewFaceKind?.dispatchEvent(new Event("change"));

    document.getElementById("attachConfirmBtn")?.addEventListener("click", () => {
        if (!builderPendingEdge || !builderNetData) return;
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
        const sideN =
            peekSideCountFromSpec(spec, sideLength) ??
            getFaceVertexCountFromSpec(spec) ??
            4;
        const color = colorCoordinatedBySidesEnabled()
            ? colorCssForPolygonSides(sideN)
            : attachColorInput?.value || "#b8a9d9";
        if (tryAppendFlapToEdge(builderPendingEdge, spec, color)) {
            builderPendingEdge = null;
            if (builderAttachPanel) builderAttachPanel.hidden = true;
            builderLastQuickAttach = {
                spec: cloneFaceSpecForRepeat(spec),
                color,
            };
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

    renderer.domElement.addEventListener("dblclick", (ev) => {
        if (!isNetBuilderActive || !builderNetData) return;
        if (isFolded || isAnimating) return;
        if (!builderLastQuickAttach) return;
        const pick = pickEdgePickAtClient(ev.clientX, ev.clientY);
        if (!pick) return;
        ev.preventDefault();
        const spec = builderLastQuickAttach.spec;
        const sideN =
            peekSideCountFromSpec(spec, sideLength) ??
            getFaceVertexCountFromSpec(spec) ??
            4;
        const qColor = colorCoordinatedBySidesEnabled()
            ? colorCssForPolygonSides(sideN)
            : builderLastQuickAttach.color;
        if (tryAppendFlapToEdge(pick, spec, qColor)) {
            builderPendingEdge = null;
            if (builderAttachPanel) builderAttachPanel.hidden = true;
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
    /** Trophies only when folding nets earned outside the preset dropdown (scratch build or JSON file). */
    const trophyEligible = options.trophyEligible === true;
    isFolded = false;
    isAnimating = false;
    isPaused = false;
    currentAnimationStage = 0;
    foldButton.textContent = "Animated Fold";
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
                `[Custom net] Signature "${signature}" has no fold table — trial Animated Fold uses guessed angles; click Unfold after.`,
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

        const trophyPendingKey = getVertexConfigKeyForNetData(netData);
        pendingScratchTrophyKey = trophyEligible ? trophyPendingKey : null;

        setInfoLayoutStatus();
        if (trophyPreviewGoldActive) applyTrophyPreviewGold(true);
    } catch (error) {
        console.error("Failed to process net data:", error);
        alert(`Error processing net data: ${error.message}. Check console.`);
        clearSceneGeometry();
        lastLoadedNetData = null;
        pendingScratchTrophyKey = null;
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
            loadAndProcessNet(netData, {
                allowUnknownSignature: true,
                trophyEligible: true,
            });
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
    disposeStellationCaps();
    disposeStellationDiagramSelection3D();
    stellDiagramSelectedKeys.clear();
    stellDiagramPickState = null;
    stellDiagramPointerInside = false;
    stellDiagramViewZoom = 1;
    stellDiagramViewPanU = 0;
    stellDiagramViewPanV = 0;
    stellDiagramViewLastPolyKey = null;
    stellDiagramPanActive = false;
    stellDiagramPanPointerId = null;
    const _stellDiagCv = document.getElementById("stellationDiagramCanvas");
    if (_stellDiagCv) _stellDiagCv.style.cursor = "";
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
    if (foldButton) foldButton.textContent = "Animated Fold";
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
/** Short major arpeggio when a scratch-built net completes a library fold. */
function playFoldSuccessChime() {
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!foldSuccessAudioContext) foldSuccessAudioContext = new AC();
        const ctx = foldSuccessAudioContext;
        void ctx.resume();
        const t0 = ctx.currentTime + 0.02;
        const master = ctx.createGain();
        master.gain.value = 0.11;
        master.connect(ctx.destination);
        const freqs = [523.25, 659.25, 783.99, 1046.5];
        for (let i = 0; i < freqs.length; i++) {
            const f = freqs[i];
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine";
            o.frequency.value = f;
            const st = t0 + i * 0.075;
            g.gain.setValueAtTime(0, st);
            g.gain.linearRampToValueAtTime(0.4, st + 0.018);
            g.gain.exponentialRampToValueAtTime(0.0008, st + 0.42);
            o.connect(g);
            g.connect(master);
            o.start(st);
            o.stop(st + 0.48);
        }
    } catch {
        /* autoplay or API blocked */
    }
}

function tryScratchFoldTrophyReward() {
    if (!pendingScratchTrophyKey || !currentFoldAngles) return;
    const data = builderNetData || lastLoadedNetData;
    if (!data) return;
    const k = getVertexConfigKeyForNetData(data);
    if (k !== pendingScratchTrophyKey) return;
    const newlyAdded = awardPolyhedronTrophyIfNew(k);
    if (newlyAdded) playFoldSuccessChime();
}

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
            ? `Layout: ${currentNetName}${runs} · no fold table — try Animated Fold for a trial (guessed angles), then Unfold`
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
        const instantTitleWhenReady =
            "Jump to the fully folded shape in one step (no hinge animation).";
        const setInstantFoldUi = (disabled, title) => {
            if (!instantFoldButton) return;
            instantFoldButton.disabled = disabled;
            instantFoldButton.title = title;
        };
        if (!hasNet) {
            foldButton.disabled = true;
            foldButton.title =
                "Load a preset, a JSON file, or create a net from the Net panel.";
            foldButton.textContent = "Animated Fold";
            setInstantFoldUi(true, "");
            return;
        }
        if (!canFoldOrTrial) {
            foldButton.disabled = true;
            foldButton.title =
                "Add attached faces in the builder (or load a net with connections) to try folding.";
            foldButton.textContent = "Animated Fold";
            setInstantFoldUi(true, "");
            return;
        }
        if (trialFoldPauseActive) {
            foldButton.disabled = false;
            foldButton.textContent = "Unfold";
            foldButton.title =
                "Return to the flat net (guessed fold didn’t match any known solid).";
            if (pauseButton) pauseButton.disabled = true;
            setInstantFoldUi(
                true,
                "Not available during trial pause — use Unfold first.",
            );
            return;
        }
        foldButton.disabled = false;
        foldButton.title = canTrialFoldLayout()
            ? "Animated trial fold: guessed angles for every hinge; when it stops, click Unfold to flatten (no fold table for this layout)."
            : "";
        const foldingForward =
            isAnimating &&
            currentAnimationStage > 0 &&
            currentAnimationStage <= NUM_ANIMATION_STAGES;
        const unfoldingAnim = isAnimating && currentAnimationStage < 0;
        let showUnfoldLabel = isFolded;
        if (foldingForward) showUnfoldLabel = true;
        if (unfoldingAnim) showUnfoldLabel = false;
        foldButton.textContent = showUnfoldLabel ? "Unfold" : "Animated Fold";

        const allowInstant =
            !isAnimating && !isFolded;
        if (allowInstant) {
            setInstantFoldUi(false, instantTitleWhenReady);
        } else if (isFolded) {
            setInstantFoldUi(
                true,
                "Already folded. Use Unfold to return to the flat net.",
            );
        } else {
            setInstantFoldUi(
                true,
                "Wait for the current animation to finish or press Pause.",
            );
        }
    } finally {
        refreshEditNetButtonState();
        refreshStellationSectionState();
    }
}

/** Dodecahedron / icosahedron: classical stellation catalogs (Miller-style theory). */
const STELLATION_ICOSA_DODECA_KEYS = new Set(["3.3.3.3.3", "5.5.5"]);
/** Face-plane trace diagram: regular dodeca / icosa + rhombic dodecahedron (12 rhombi). */
const STELLATION_DIAGRAM_POLY_KEYS = new Set([
    "3.3.3.3.3",
    "5.5.5",
    "rhombic-dodecahedron",
]);
/** Replicate diagram picks as 3D panels on every equivalent face (face-transitive facets). */
const STELLATION_DIAGRAM_REPLICATE_ALL_FACES_KEYS = new Set([
    "3.3.3.3.3",
    "5.5.5",
    "rhombic-dodecahedron",
]);
/** Snub Archimedean: some stellation art, not the classic Miller zoo. */
const STELLATION_SNUB_KEYS = new Set(["3.3.3.3.4", "3.3.3.3.5"]);

function refreshStellationSectionState() {
    const sec = document.getElementById("stellationSection");
    const sel = document.getElementById("stellationPresetSelect");
    const hint = document.getElementById("stellationPolyHint");
    const lockMsg = document.getElementById("stellationLockedNote");
    if (!sec) return;

    const hasNet = Boolean(f1Mesh);
    const folded = isFolded;
    const busy = isAnimating;
    const unlock = hasNet && folded && !busy;

    const stellationPolyKey =
        unlock && lastLoadedNetData
            ? getVertexConfigKeyForNetData(lastLoadedNetData)
            : null;

    sec.classList.toggle("stellation-section--locked", !unlock);
    sec.setAttribute("aria-disabled", unlock ? "false" : "true");

    if (sel) {
        sel.disabled = !unlock;
        if (!unlock) sel.value = "off";
        else if (
            sel.value === "diagram" &&
            (!stellationPolyKey ||
                !STELLATION_DIAGRAM_POLY_KEYS.has(stellationPolyKey))
        )
            sel.value = "off";
    }

    if (lockMsg) {
        lockMsg.hidden = unlock;
        if (!unlock) {
            if (!hasNet) lockMsg.textContent = "Load a net first.";
            else if (busy)
                lockMsg.textContent =
                    "Wait for folding or unfolding to finish.";
            else if (!folded)
                lockMsg.textContent =
                    "Fully fold the solid to enable stellation tools.";
        }
    }

    if (hint) {
        if (!unlock) {
            hint.textContent = "";
            hint.hidden = true;
        } else {
            let t = "";
            if (
                stellationPolyKey &&
                STELLATION_ICOSA_DODECA_KEYS.has(stellationPolyKey)
            ) {
                t =
                    "This solid supports the richest classical stellation families (e.g. icosahedral Miller set, Kepler–Poinsot relatives). Use Stellation diagram to see where other face planes cut one reference face.";
            } else if (stellationPolyKey && STELLATION_SNUB_KEYS.has(stellationPolyKey)) {
                t =
                    "Snub solids have less standard stellation theory than the dodecahedron / icosahedron; sculptural modes may fit better.";
            } else if (stellationPolyKey === "rhombic-dodecahedron") {
                t =
                    "Rhombic dodecahedron (Catalan): twelve congruent rhombic faces. Use Stellation diagram to see where the other face planes cut one rhombus—the same face-plane trace idea as for the Platonic solids, though the classical Miller catalog is dodeca/icosa-centric.";
            } else if (stellationPolyKey) {
                t =
                    "Classical stellation is most storied on the dodecahedron and icosahedron; other solids often have no standard catalog. Uniform pyramids on every face still works for any folded net.";
            }
            hint.textContent = t;
            hint.hidden = !t;
        }
    }

    const wrap = document.getElementById("stellationDiagramWrap");
    const cap = document.getElementById("stellationDiagramCaption");
    const selVal = sel?.value ?? "off";
    const showDiagram =
        unlock &&
        selVal === "diagram" &&
        stellationPolyKey &&
        STELLATION_DIAGRAM_POLY_KEYS.has(stellationPolyKey);
    if (wrap) wrap.hidden = !showDiagram;
    if (cap) {
        if (showDiagram) {
            const pickHint =
                " Click a region to toggle it (pointer over selectable cells). Wheel zooms toward the cursor; middle-drag or Alt+drag pans. The same pick is mirrored on every equivalent face in 3D. Clear removes all picks.";
            if (stellationPolyKey === "5.5.5") {
                cap.textContent =
                    "Classical-style diagram (see Wikipedia: Stellation diagram): traces of every other face plane in this plane, framed for the outer star pattern." +
                    pickHint;
            } else if (stellationPolyKey === "rhombic-dodecahedron") {
                cap.textContent =
                    "One rhombic face: traces of the other eleven face planes (wide framing)." +
                    pickHint;
            } else {
                cap.textContent =
                    "Icosahedron face-plane traces (wide framing)." + pickHint;
            }
        } else cap.textContent = "";
    }
    if (showDiagram) redrawStellationDiagram();
    else {
        clearStellationDiagramCanvas();
        disposeStellationDiagramSelection3D();
        stellDiagramSelectedKeys.clear();
        stellDiagramPickState = null;
        stellDiagramPointerInside = false;
        stellDiagramViewZoom = 1;
        stellDiagramViewPanU = 0;
        stellDiagramViewPanV = 0;
        stellDiagramViewLastPolyKey = null;
        stellDiagramPanActive = false;
        stellDiagramPanPointerId = null;
        stellDiagramSuppressNextClick = false;
        const dc = document.getElementById("stellationDiagramCanvas");
        if (dc) dc.style.cursor = "";
    }

    const capsRow = document.getElementById("stellationCapsRow");
    const showCaps = unlock && selVal === "uniform-caps";
    if (capsRow) capsRow.hidden = !showCaps;
    if (showCaps) {
        refreshStellationCapHeightLabel();
        rebuildStellationUniformCapsIfNeeded();
    } else disposeStellationCaps();
}

function refreshStellationCapHeightLabel() {
    const slider = document.getElementById("stellationCapHeightSlider");
    const span = document.getElementById("stellationCapHeightValue");
    if (!slider || !span) return;
    const v = parseInt(slider.value, 10);
    span.textContent = `${Number.isFinite(v) ? v : 0}%`;
}

function disposeStellationCaps() {
    if (!stellationCapsGroup || !scene) return;
    stellationCapsGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
    });
    scene.remove(stellationCapsGroup);
    stellationCapsGroup = null;
}

function getFaceColorHexForStellation(faceId) {
    if (faceId === 1 && f1Mesh?.userData?.faceColorHex != null)
        return f1Mesh.userData.faceColorHex;
    const pivot = pivots[faceId];
    if (!pivot) return 0x888888;
    for (let i = 0; i < pivot.children.length; i++) {
        const ch = pivot.children[i];
        if (ch.isMesh && ch.userData?.faceColorHex != null)
            return ch.userData.faceColorHex;
    }
    return 0x888888;
}

/**
 * Cyclic order of coplanar boundary vertices, CCW when viewed along outward normal.
 * @param {THREE.Vector3[]} worldVerts
 * @param {THREE.Vector3} outwardNormal unit
 */
function orderFaceBoundaryVerticesWorld(worldVerts, outwardNormal) {
    const n = outwardNormal.clone().normalize();
    const c = calculateWorldCentroid(worldVerts);
    const t1 = new THREE.Vector3();
    const t2 = new THREE.Vector3();
    let e0 = t1.subVectors(worldVerts[0], c);
    e0.sub(t2.copy(n).multiplyScalar(e0.dot(n)));
    if (e0.lengthSq() < 1e-12) {
        e0.subVectors(worldVerts[1], c);
        e0.sub(t2.copy(n).multiplyScalar(e0.dot(n)));
    }
    e0.normalize();
    const e1 = new THREE.Vector3().crossVectors(n, e0).normalize();
    const scored = worldVerts.map((w) => {
        const d = new THREE.Vector3().subVectors(w, c);
        return {
            w,
            ang: Math.atan2(d.dot(e1), d.dot(e0)),
        };
    });
    scored.sort((a, b) => a.ang - b.ang);
    return scored.map((s) => s.w);
}

function meanEdgeLengthOrdered(orderedVerts) {
    const n = orderedVerts.length;
    if (n < 2) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) {
        sum += orderedVerts[i].distanceTo(orderedVerts[(i + 1) % n]);
    }
    return sum / n;
}

function computeStellationGlobalMeanEdgeLength() {
    const interior = computeSolidCentroidWorld();
    const t = new THREE.Vector3();
    let total = 0;
    let count = 0;
    for (const key of Object.keys(allVertices)) {
        const fid = parseInt(key, 10);
        if (Number.isNaN(fid)) continue;
        const wv = getMeshWorldVertices(fid);
        if (!wv || wv.length < 3) continue;
        let nrm = calculateWorldNormalRobust(wv);
        const cen = calculateWorldCentroid(wv);
        if (interior && nrm.dot(t.copy(cen).sub(interior)) < 0) nrm = nrm.clone().negate();
        const ordered = orderFaceBoundaryVerticesWorld(wv, nrm);
        total += meanEdgeLengthOrdered(ordered);
        count++;
    }
    return count > 0 ? total / count : sideLength;
}

function rebuildStellationUniformCapsIfNeeded() {
    const sel = document.getElementById("stellationPresetSelect")?.value;
    if (
        sel !== "uniform-caps" ||
        !isFolded ||
        isAnimating ||
        !scene ||
        !f1Mesh
    ) {
        disposeStellationCaps();
        return;
    }
    const slider = document.getElementById("stellationCapHeightSlider");
    const pctRaw = parseInt(slider?.value, 10);
    const pct = Math.min(
        100,
        Math.max(0, Number.isFinite(pctRaw) ? pctRaw : 0),
    );
    const relativeHeight = pct / 100;
    disposeStellationCaps();
    if (relativeHeight < 1e-5) return;

    const mode = RENDER_MODES[currentRenderModeIndex] || "flat";
    const interior = computeSolidCentroidWorld();
    const t = new THREE.Vector3();
    const globalMeanEdge = computeStellationGlobalMeanEdgeLength();
    const capHeight = relativeHeight * globalMeanEdge;

    stellationCapsGroup = new THREE.Group();
    stellationCapsGroup.name = "stellationUniformCaps";

    for (const key of Object.keys(allVertices)) {
        const fid = parseInt(key, 10);
        if (Number.isNaN(fid)) continue;
        const wv = getMeshWorldVertices(fid);
        if (!wv || wv.length < 3) continue;

        let nrm = calculateWorldNormalRobust(wv);
        const cen = calculateWorldCentroid(wv);
        if (interior && nrm.dot(t.copy(cen).sub(interior)) < 0) nrm = nrm.clone().negate();

        const ordered = orderFaceBoundaryVerticesWorld(wv, nrm);
        const apex = nrm.clone().multiplyScalar(capHeight).add(cen);
        const nv = ordered.length;
        const pos = [];
        for (let i = 0; i < nv; i++) {
            const a = ordered[i];
            const b = ordered[(i + 1) % nv];
            pos.push(apex.x, apex.y, apex.z, a.x, a.y, a.z, b.x, b.y, b.z);
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(pos, 3),
        );
        geom.computeVertexNormals();

        const colorHex = getFaceColorHexForStellation(fid);
        const mat = createFaceMaterial(colorHex, mode);
        applyTranslucentStellationSurfaceMaterial(mat);
        const mesh = new THREE.Mesh(geom, mat);
        mesh.userData.isStellationCap = true;
        mesh.userData.faceId = fid;
        stellationCapsGroup.add(mesh);
    }

    scene.add(stellationCapsGroup);
}

/** Average of face centroids in world space (lightweight solid interior point). */
function computeSolidCentroidWorld() {
    const sum = new THREE.Vector3();
    let n = 0;
    for (const key of Object.keys(allVertices)) {
        const fid = parseInt(key, 10);
        if (Number.isNaN(fid)) continue;
        const wv = getMeshWorldVertices(fid);
        if (!wv || wv.length < 3) continue;
        sum.add(calculateWorldCentroid(wv));
        n++;
    }
    return n > 0 ? sum.divideScalar(n) : null;
}

/**
 * Line of intersection of two planes (Three.js: normal·x + constant = 0).
 * @param {THREE.Plane} planeA
 * @param {THREE.Plane} planeB
 * @param {THREE.Vector3} outOrigin
 * @param {THREE.Vector3} outDir unit direction along the line
 * @returns {boolean}
 */
function intersectPlanesLine(planeA, planeB, outOrigin, outDir) {
    const n1 = planeA.normal;
    const n2 = planeB.normal;
    const d1 = -planeA.constant;
    const d2 = -planeB.constant;
    outDir.crossVectors(n1, n2);
    const lenSq = outDir.lengthSq();
    if (lenSq < 1e-20) return false;
    const t1 = _stellTmpA.crossVectors(n2, outDir).multiplyScalar(d1);
    const t2 = _stellTmpB.crossVectors(outDir, n1).multiplyScalar(d2);
    outOrigin.copy(t1).add(t2).divideScalar(lenSq);
    outDir.normalize();
    return true;
}

const _stellTmpA = new THREE.Vector3();
const _stellTmpB = new THREE.Vector3();
const _stellTmpC = new THREE.Vector3();
const _stellTmpD = new THREE.Vector3();
const _stellProjOnPlane = new THREE.Vector3();

/**
 * Clip infinite 2D line P = O + t D against convex polygon (CCW), return t interval or null.
 * @param {{ u: number, v: number }} O
 * @param {{ u: number, v: number }} D
 * @param {{ u: number, v: number }[]} poly
 */
function clipInfiniteLineToConvexPolygon2D(O, D, poly) {
    const cross2 = (ex, ey, px, py) => ex * py - ey * px;
    let tMin = -Infinity;
    let tMax = Infinity;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        const A = poly[i];
        const B = poly[(i + 1) % n];
        const ex = B.u - A.u;
        const ey = B.v - A.v;
        const w = cross2(ex, ey, O.u - A.u, O.v - A.v);
        const c = cross2(ex, ey, D.u, D.v);
        if (Math.abs(c) < 1e-9) {
            if (w < 0) return null;
            continue;
        }
        const t = -w / c;
        if (c > 0) tMin = Math.max(tMin, t);
        else tMax = Math.min(tMax, t);
    }
    if (tMin > tMax) return null;
    return { t0: tMin, t1: tMax };
}

function makeFacePlaneWorld(faceId, interiorHint) {
    const wv = getMeshWorldVertices(faceId);
    if (!wv || wv.length < 3) return null;
    const c = calculateWorldCentroid(wv);
    let n = calculateWorldNormalRobust(wv);
    const interior = interiorHint ?? computeSolidCentroidWorld();
    if (interior && n.dot(_stellTmpC.copy(c).sub(interior)) < 0) n.negate();
    const plane = new THREE.Plane();
    plane.setFromNormalAndCoplanarPoint(n, c);
    return plane;
}

function findReferenceFaceIdForStellationDiagram(expectedSides) {
    for (const key of Object.keys(allVertices)) {
        const fid = parseInt(key, 10);
        if (Number.isNaN(fid)) continue;
        const spec = allVertices[key];
        const ns = spec?.numSides ?? spec?.length;
        if (ns !== expectedSides) continue;
        const wv = getMeshWorldVertices(fid);
        if (wv && wv.length >= 3) return fid;
    }
    return null;
}

function orderConvexFacePolygon2D(refVerts, refCentroid, refNormal) {
    const e0 = _stellTmpC.subVectors(refVerts[1], refVerts[0]);
    e0.sub(_stellTmpA.copy(refNormal).multiplyScalar(e0.dot(refNormal)));
    if (e0.lengthSq() < 1e-12) {
        e0.subVectors(refVerts[2], refVerts[0]);
        e0.sub(_stellTmpA.copy(refNormal).multiplyScalar(e0.dot(refNormal)));
    }
    e0.normalize();
    const v0 = _stellTmpD.crossVectors(refNormal, e0).normalize();
    const pts = refVerts.map((w) => {
        const d = new THREE.Vector3().subVectors(w, refCentroid);
        return { u: d.dot(e0), v: d.dot(v0) };
    });
    let cx = 0;
    let cy = 0;
    for (const p of pts) {
        cx += p.u;
        cy += p.v;
    }
    cx /= pts.length;
    cy /= pts.length;
    const withAng = pts.map((p) => ({
        u: p.u,
        v: p.v,
        ang: Math.atan2(p.v - cy, p.u - cx),
    }));
    withAng.sort((a, b) => a.ang - b.ang);
    const poly = withAng.map(({ u, v }) => ({ u, v }));
    let area = 0;
    const m = poly.length;
    for (let i = 0; i < m; i++) {
        const p = poly[i];
        const q = poly[(i + 1) % m];
        area += p.u * q.v - p.v * q.u;
    }
    if (area < 0) poly.reverse();
    return { poly2d: poly, uAxis: e0.clone(), vAxis: _stellTmpD.clone() };
}

function listFaceIdsWithNSides(expectedSides) {
    const out = [];
    for (const key of Object.keys(allVertices)) {
        const fid = parseInt(key, 10);
        if (Number.isNaN(fid)) continue;
        const spec = allVertices[key];
        const ns = spec?.numSides ?? spec?.length;
        if (ns !== expectedSides) continue;
        const wv = getMeshWorldVertices(fid);
        if (wv && wv.length >= 3) out.push(fid);
    }
    out.sort((a, b) => a - b);
    return out;
}

function stellBoundaryWorldFromPoly2d(c, uAxis, vAxis, poly2d) {
    const n = poly2d.length;
    const arr = new Array(n);
    for (let i = 0; i < n; i++) {
        const p = poly2d[i];
        arr[i] = new THREE.Vector3()
            .copy(uAxis)
            .multiplyScalar(p.u)
            .add(_stellTmpA.copy(vAxis).multiplyScalar(p.v))
            .add(c);
    }
    return arr;
}

function stellComputeFrameForStellationFace(faceId, interior) {
    const wv = getMeshWorldVertices(faceId);
    if (!wv || wv.length < 3) return null;
    const c = calculateWorldCentroid(wv);
    let n = calculateWorldNormalRobust(wv);
    if (interior && n.dot(_stellTmpA.copy(c).sub(interior)) < 0) n.negate();
    const { poly2d, uAxis, vAxis } = orderConvexFacePolygon2D(wv, c, n);
    return { faceId, c, n, uAxis, vAxis, poly2d };
}

/**
 * Rigid map taking reference face boundary W (CCW) onto target boundary T; returns
 * quaternion q with x' = cT + q * (x - c0) for x on the reference plane.
 */
function stellQuaternionMapReferenceFaceBoundaryToTarget(W, n0, c0, T, nT, cT) {
    const n = W.length;
    if (n < 2 || T.length !== n) return null;
    const qAlignN = new THREE.Quaternion();
    const qTwist = new THREE.Quaternion();
    const qComb = new THREE.Quaternion();
    const qBest = new THREE.Quaternion();
    let bestErr = Infinity;
    const eW = new THREE.Vector3();
    const eT = new THREE.Vector3();
    const eWp = new THREE.Vector3();
    const test = new THREE.Vector3();
    const cTmp = new THREE.Vector3();

    for (let s = 0; s < n; s++) {
        qAlignN.setFromUnitVectors(n0, nT);
        eW.subVectors(W[1], W[0]).normalize();
        eT.subVectors(T[(s + 1) % n], T[s]).normalize();
        eWp.copy(eW).applyQuaternion(qAlignN);
        const twist = Math.atan2(
            cTmp.copy(eWp).cross(eT).dot(nT),
            THREE.MathUtils.clamp(eWp.dot(eT), -1, 1),
        );
        qTwist.setFromAxisAngle(nT, twist);
        qComb.copy(qTwist).multiply(qAlignN);
        let err = 0;
        for (let i = 0; i < n; i++) {
            test.copy(W[i]).sub(c0).applyQuaternion(qComb).add(cT);
            err += test.distanceToSquared(T[(i + s) % n]);
        }
        if (err < bestErr) {
            bestErr = err;
            qBest.copy(qComb);
        }
    }
    return { q: qBest.clone(), err: bestErr };
}

/**
 * Classical stellation diagrams clip infinite traces to a bounded window around the
 * face (see e.g. Coxeter / Miller figures and
 * https://en.wikipedia.org/wiki/Stellation_diagram ).
 * @param {{ u: number, v: number }[]} facePoly2d
 * @param {number} marginFactor — half-size of axis-aligned clip vs max radius to centroid
 */
function makeStellationDiagramClipWindow2D(facePoly2d, marginFactor) {
    let cx = 0;
    let cy = 0;
    const n = facePoly2d.length;
    for (let i = 0; i < n; i++) {
        cx += facePoly2d[i].u;
        cy += facePoly2d[i].v;
    }
    cx /= n;
    cy /= n;
    let r = 0;
    for (let i = 0; i < n; i++) {
        const p = facePoly2d[i];
        r = Math.max(r, Math.hypot(p.u - cx, p.v - cy));
    }
    r = Math.max(r, 1e-9);
    const h = r * marginFactor;
    return [
        { u: cx - h, v: cy - h },
        { u: cx + h, v: cy - h },
        { u: cx + h, v: cy + h },
        { u: cx - h, v: cy + h },
    ];
}

const STELL_EPS = 1e-9;
const STELL_KEY_PREC = 6;

function stellPtKey(u, v) {
    return `${u.toFixed(STELL_KEY_PREC)},${v.toFixed(STELL_KEY_PREC)}`;
}

function stellSegIntersectInterior(a0, a1, b0, b1) {
    const rx = a1.u - a0.u;
    const ry = a1.v - a0.v;
    const sx = b1.u - b0.u;
    const sy = b1.v - b0.v;
    const denom = rx * sy - ry * sx;
    if (Math.abs(denom) < 1e-14) return null;
    const qpx = b0.u - a0.u;
    const qpy = b0.v - a0.v;
    const t = (qpx * sy - qpy * sx) / denom;
    const uu = (qpx * ry - qpy * rx) / denom;
    if (t > STELL_EPS && t < 1 - STELL_EPS && uu > STELL_EPS && uu < 1 - STELL_EPS)
        return t;
    return null;
}

function stellSubdivideSegmentArray(rawSegs) {
    const out = [];
    for (let i = 0; i < rawSegs.length; i++) {
        const seg = rawSegs[i];
        const cuts = new Set([0, 1]);
        for (let j = 0; j < rawSegs.length; j++) {
            if (i === j) continue;
            const t = stellSegIntersectInterior(
                seg.p0,
                seg.p1,
                rawSegs[j].p0,
                rawSegs[j].p1,
            );
            if (t != null) cuts.add(t);
        }
        const arr = [...cuts].sort((a, b) => a - b);
        for (let k = 0; k < arr.length - 1; k++) {
            const t0 = arr[k];
            const t1 = arr[k + 1];
            if (t1 - t0 < STELL_EPS) continue;
            const p0 = {
                u: seg.p0.u + t0 * (seg.p1.u - seg.p0.u),
                v: seg.p0.v + t0 * (seg.p1.v - seg.p0.v),
            };
            const p1 = {
                u: seg.p0.u + t1 * (seg.p1.u - seg.p0.u),
                v: seg.p0.v + t1 * (seg.p1.v - seg.p0.v),
            };
            const du = p1.u - p0.u;
            const dv = p1.v - p0.v;
            if (du * du + dv * dv > STELL_EPS * STELL_EPS) out.push({ p0, p1 });
        }
    }
    return out;
}

function stellDedupeUndirectedEdges(segs) {
    const seen = new Set();
    const uniq = [];
    for (const s of segs) {
        const k0 = stellPtKey(s.p0.u, s.p0.v);
        const k1 = stellPtKey(s.p1.u, s.p1.v);
        const a = k0 < k1 ? k0 : k1;
        const b = k0 < k1 ? k1 : k0;
        const key = `${a}|${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        uniq.push(s);
    }
    return uniq;
}

function stellBuildAdjacency(segs) {
    const pos = new Map();
    const addPt = (p) => {
        const k = stellPtKey(p.u, p.v);
        if (!pos.has(k)) pos.set(k, { u: p.u, v: p.v, key: k });
        return k;
    };
    const adj = new Map();
    const link = (ka, kb) => {
        if (!adj.has(ka)) adj.set(ka, []);
        if (!adj.has(kb)) adj.set(kb, []);
        if (!adj.get(ka).includes(kb)) adj.get(ka).push(kb);
        if (!adj.get(kb).includes(ka)) adj.get(kb).push(ka);
    };
    for (const s of segs) {
        const ka = addPt(s.p0);
        const kb = addPt(s.p1);
        link(ka, kb);
    }
    return { adj, pos };
}

function stellNextVertexLeftFace(uKey, vKey, adj, pos) {
    const V = pos.get(vKey);
    const nks = adj.get(vKey);
    if (!nks || nks.length < 2) return null;
    const sorted = nks.slice().sort((ka, kb) => {
        const A = pos.get(ka);
        const B = pos.get(kb);
        return (
            Math.atan2(A.v - V.v, A.u - V.u) -
            Math.atan2(B.v - V.v, B.u - V.u)
        );
    });
    const idx = sorted.indexOf(uKey);
    if (idx < 0) return null;
    const ni = (idx - 1 + sorted.length) % sorted.length;
    return sorted[ni];
}

function stellPolygonSignedArea(verts) {
    let a = 0;
    const n = verts.length;
    for (let i = 0; i < n; i++) {
        const p = verts[i];
        const q = verts[(i + 1) % n];
        a += p.u * q.v - p.v * q.u;
    }
    return a * 0.5;
}

function stellFaceSignature(verts) {
    const keys = verts.map((p) => stellPtKey(p.u, p.v));
    let best = keys.join(",");
    const m = keys.length;
    for (let s = 1; s < m; s++) {
        const rot = [...keys.slice(s), ...keys.slice(0, s)].join(",");
        if (rot < best) best = rot;
    }
    const rev = [...keys].reverse();
    let bestR = rev.join(",");
    for (let s = 1; s < m; s++) {
        const rot = [...rev.slice(s), ...rev.slice(0, s)].join(",");
        if (rot < bestR) bestR = rot;
    }
    return best < bestR ? best : bestR;
}

/**
 * Unique selection id per cell: sorted vertex list at 14 decimals. Cycle signatures
 * from stellFaceSignature can still collide when distinct corners share the same 6-dec
 * stellPtKey (e.g. two triangles in one rhombus on the rhombic dodecahedron diagram).
 */
function stellRegionStableSelectionKey(poly) {
    return poly
        .map((p) => `${p.u.toFixed(14)},${p.v.toFixed(14)}`)
        .sort()
        .join(";");
}

function stellEnumerateFaces(adj, pos) {
    const used = new Set();
    const badStart = new Set();
    const faces = [];
    const seenSig = new Set();
    for (const uKey of adj.keys()) {
        for (const vKey of adj.get(uKey)) {
            const start = `${uKey}|${vKey}`;
            if (used.has(start) || badStart.has(start)) continue;
            const poly = [];
            const trial = [];
            let u = uKey;
            let v = vKey;
            let guard = 0;
            let closed = false;
            while (guard++ < 8000) {
                const d = `${u}|${v}`;
                if (used.has(d)) break;
                trial.push(d);
                const P = pos.get(v);
                poly.push({ u: P.u, v: P.v });
                const w = stellNextVertexLeftFace(u, v, adj, pos);
                if (!w) break;
                u = v;
                v = w;
                if (u === uKey && v === vKey) {
                    closed = true;
                    break;
                }
            }
            if (closed && poly.length >= 3) {
                const sig = stellFaceSignature(poly);
                if (!seenSig.has(sig)) {
                    seenSig.add(sig);
                    faces.push(poly);
                }
                for (const t of trial) used.add(t);
            } else {
                badStart.add(start);
            }
        }
    }
    return faces;
}

function stellPointInPolygon(u, v, poly) {
    let inside = false;
    const n = poly.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const pi = poly[i];
        const pj = poly[j];
        const intersect =
            pi.v > v !== pj.v > v &&
            u <
                ((pj.u - pi.u) * (v - pi.v)) / (pj.v - pi.v + STELL_EPS) +
                    pi.u;
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Build elementary regions from face outline, clip window, and trace segments.
 * @returns {{ regions: { id: number, verts: {u:number,v:number}[], centroidKey: string }[], clipArea: number }}
 * (centroidKey is stellRegionStableSelectionKey — sorted high-precision vertices, not a centroid.)
 */
function buildStellationDiagramRegions(poly2d, clipPoly2d, traceSegments) {
    const raw = [];
    const addLoop = (loop) => {
        const m = loop.length;
        for (let i = 0; i < m; i++) {
            const a = loop[i];
            const b = loop[(i + 1) % m];
            raw.push({ p0: { u: a.u, v: a.v }, p1: { u: b.u, v: b.v } });
        }
    };
    addLoop(poly2d);
    addLoop(clipPoly2d);
    for (const s of traceSegments) {
        raw.push({
            p0: { u: s.u0, v: s.v0 },
            p1: { u: s.u1, v: s.v1 },
        });
    }
    const subdiv = stellSubdivideSegmentArray(raw);
    const dedup = stellDedupeUndirectedEdges(subdiv);
    const { adj, pos } = stellBuildAdjacency(dedup);
    const rawFaces = stellEnumerateFaces(adj, pos);
    const clipArea = Math.abs(stellPolygonSignedArea(clipPoly2d));
    const regions = [];
    let id = 0;
    for (const f of rawFaces) {
        const area = Math.abs(stellPolygonSignedArea(f));
        if (area < clipArea * 1e-10) continue;
        if (area > clipArea * 0.985) continue;
        const centroidKey = stellRegionStableSelectionKey(f);
        regions.push({ id: id++, verts: f, centroidKey });
    }
    regions.sort((a, b) => a.centroidKey.localeCompare(b.centroidKey));
    regions.forEach((r, i) => {
        r.id = i;
    });
    return { regions, clipArea };
}

function stellRemapDiagramSelectionToNewRegions(newRegions) {
    if (!stellDiagramSelectedKeys.size || !newRegions?.length) return;
    const oldKeys = [...stellDiagramSelectedKeys];
    stellDiagramSelectedKeys.clear();
    for (const ok of oldKeys) {
        let matched = false;
        for (const r of newRegions) {
            if (r.centroidKey === ok) {
                stellDiagramSelectedKeys.add(ok);
                matched = true;
                break;
            }
        }
        if (matched) continue;
        const parts = ok.split(",");
        if (parts.length === 2) {
            const ou = Number(parts[0]);
            const ov = Number(parts[1]);
            if (Number.isFinite(ou) && Number.isFinite(ov)) {
                for (const r of newRegions) {
                    if (stellPointInPolygon(ou, ov, r.verts)) {
                        stellDiagramSelectedKeys.add(r.centroidKey);
                        break;
                    }
                }
            }
            continue;
        }
        for (const r of newRegions) {
            if (stellFaceSignature(r.verts) === ok) {
                stellDiagramSelectedKeys.add(r.centroidKey);
                break;
            }
        }
    }
}

function disposeStellationDiagramSelection3D() {
    if (!stellationDiagramSelectionGroup || !scene) return;
    stellationDiagramSelectionGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
    });
    scene.remove(stellationDiagramSelectionGroup);
    stellationDiagramSelectionGroup = null;
}

/** Flat panels on each face plane (no normal extrusion / thickness). */
function addStellationDiagramFlatRegionsForFace(
    group,
    regions,
    selectedKeys,
    refC,
    refU,
    refV,
    q,
    targetC,
    targetN,
    mode,
) {
    const tmpV = new THREE.Vector3();
    for (const r of regions) {
        if (!selectedKeys.has(r.centroidKey)) continue;
        const poly = r.verts;
        const n = poly.length;
        if (n < 3) continue;
        const bases = [];
        for (let i = 0; i < n; i++) {
            const p = poly[i];
            const b = new THREE.Vector3()
                .copy(refU)
                .multiplyScalar(p.u)
                .add(tmpV.copy(refV).multiplyScalar(p.v))
                .add(refC);
            b.sub(refC).applyQuaternion(q).add(targetC);
            bases.push(b);
        }
        const pos = [];
        for (let i = 1; i < n - 1; i++) {
            pos.push(
                bases[0].x,
                bases[0].y,
                bases[0].z,
                bases[i + 1].x,
                bases[i + 1].y,
                bases[i + 1].z,
                bases[i].x,
                bases[i].y,
                bases[i].z,
            );
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(pos, 3),
        );
        geom.computeVertexNormals();
        const mat = createFaceMaterial(0xc9a45c, mode);
        if (mat.emissive !== undefined) {
            mat.emissive = new THREE.Color(0x332208);
            mat.emissiveIntensity = 0.32;
        }
        applyTranslucentStellationSurfaceMaterial(mat);
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = 1;
        mat.polygonOffsetUnits = 1;
        const mesh = new THREE.Mesh(geom, mat);
        mesh.userData.isStellationDiagramPick = true;
        group.add(mesh);
    }
}

function rebuildStellationDiagramSelection3D() {
    disposeStellationDiagramSelection3D();
    const st = stellDiagramPickState;
    if (
        !st ||
        !isFolded ||
        isAnimating ||
        !scene ||
        stellDiagramSelectedKeys.size === 0 ||
        !st.regions?.length
    )
        return;

    const mode = RENDER_MODES[currentRenderModeIndex] || "flat";

    stellationDiagramSelectionGroup = new THREE.Group();
    stellationDiagramSelectionGroup.name = "stellationDiagramSelection";

    const refC = st.refCentroid;
    const refU = st.uAxis;
    const refV = st.vAxis;
    const n0 = st.refNormal;
    const idQ = new THREE.Quaternion();

    const replicate = st.replicateDiagramToAllFaces === true;
    if (!replicate) {
        idQ.identity();
        addStellationDiagramFlatRegionsForFace(
            stellationDiagramSelectionGroup,
            st.regions,
            stellDiagramSelectedKeys,
            refC,
            refU,
            refV,
            idQ,
            refC,
            n0,
            mode,
        );
    } else {
        const polyKey =
            lastLoadedNetData &&
            getVertexConfigKeyForNetData(lastLoadedNetData);
        const expectedSides =
            polyKey === "5.5.5"
                ? 5
                : polyKey === "rhombic-dodecahedron"
                  ? 4
                  : 3;
        const refFaceId =
            st.referenceFaceId ??
            findReferenceFaceIdForStellationDiagram(expectedSides);
        if (refFaceId == null) return;

        const outline = st.refFacePoly2d;
        if (!outline?.length) return;

        const interior = computeSolidCentroidWorld();
        const W = stellBoundaryWorldFromPoly2d(refC, refU, refV, outline);
        const faceIds = listFaceIdsWithNSides(expectedSides);
        const edgeScale = st.meanRefEdge || sideLength;
        const tol =
            W.length * Math.max(1e-10, edgeScale * 0.22) ** 2;

        for (const fid of faceIds) {
            const tgtFrame = stellComputeFrameForStellationFace(
                fid,
                interior,
            );
            if (!tgtFrame) continue;
            const T = stellBoundaryWorldFromPoly2d(
                tgtFrame.c,
                tgtFrame.uAxis,
                tgtFrame.vAxis,
                tgtFrame.poly2d,
            );
            const map = stellQuaternionMapReferenceFaceBoundaryToTarget(
                W,
                n0,
                refC,
                T,
                tgtFrame.n,
                tgtFrame.c,
            );
            if (!map || map.err > tol) continue;
            addStellationDiagramFlatRegionsForFace(
                stellationDiagramSelectionGroup,
                st.regions,
                stellDiagramSelectedKeys,
                refC,
                refU,
                refV,
                map.q,
                tgtFrame.c,
                tgtFrame.n,
                mode,
            );
        }
    }

    if (stellationDiagramSelectionGroup.children.length > 0)
        scene.add(stellationDiagramSelectionGroup);
}

function stellClientToDiagramUV(canvas, offsetX, offsetY, pick) {
    const w = pick.displayCss;
    const s = pick.scale * (pick.viewZoom ?? 1);
    const cx = pick.cx + (pick.viewPanU ?? 0);
    const cy = pick.cy + (pick.viewPanV ?? 0);
    const u = (offsetX - w / 2) / s + cx;
    const v = -(offsetY - w / 2) / s + cy;
    return { u, v };
}

/** @returns {{ id: number, verts: {u:number,v:number}[], centroidKey: string } | null} */
function stellDiagramHitRegionAtClient(canvas, clientX, clientY) {
    if (!canvas || !stellDiagramPickState?.regions?.length) return null;
    const st = stellDiagramPickState;
    const rect = canvas.getBoundingClientRect();
    const wCss = st.displayCss || 280;
    const ox =
        ((clientX - rect.left) / Math.max(rect.width, 1)) * wCss;
    const oy =
        ((clientY - rect.top) / Math.max(rect.height, 1)) * wCss;
    const { u, v } = stellClientToDiagramUV(canvas, ox, oy, st);
    const hits = [];
    for (const r of st.regions) {
        if (stellPointInPolygon(u, v, r.verts)) hits.push(r);
    }
    if (hits.length === 0) return null;
    if (hits.length === 1) return hits[0];
    hits.sort(
        (a, b) =>
            Math.abs(stellPolygonSignedArea(a.verts)) -
            Math.abs(stellPolygonSignedArea(b.verts)),
    );
    return hits[0];
}

function onStellationDiagramCanvasWheel(ev) {
    const canvas = document.getElementById("stellationDiagramCanvas");
    const wrap = document.getElementById("stellationDiagramWrap");
    if (!canvas || !wrap || wrap.hidden) return;
    const st = stellDiagramPickState;
    if (!st?.scale) return;
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const wCss = st.displayCss || 280;
    const ox =
        ((ev.clientX - rect.left) / Math.max(rect.width, 1)) * wCss;
    const oy =
        ((ev.clientY - rect.top) / Math.max(rect.height, 1)) * wCss;
    const z0 = stellDiagramViewZoom;
    const s0 = st.scale * z0;
    const u0 = (ox - wCss / 2) / s0 + st.cx + stellDiagramViewPanU;
    const v0 = -(oy - wCss / 2) / s0 + st.cy + stellDiagramViewPanV;
    const factor = Math.exp(-ev.deltaY * 0.0015);
    const z1 = THREE.MathUtils.clamp(z0 * factor, 0.2, 16);
    stellDiagramViewZoom = z1;
    const s1 = st.scale * z1;
    stellDiagramViewPanU = u0 - st.cx - (ox - wCss / 2) / s1;
    stellDiagramViewPanV = v0 - st.cy + (oy - wCss / 2) / s1;
    redrawStellationDiagram();
}

function onStellationDiagramCanvasPointerDown(ev) {
    const canvas = document.getElementById("stellationDiagramCanvas");
    const wrap = document.getElementById("stellationDiagramWrap");
    if (!canvas || !wrap || wrap.hidden) return;
    const wantPanMiddle = ev.button === 1;
    const wantPanAltLeft = ev.button === 0 && ev.altKey;
    if (!wantPanMiddle && !wantPanAltLeft) return;
    stellDiagramPanActive = true;
    stellDiagramPanPointerId = ev.pointerId;
    stellDiagramPanLastCssX = ev.clientX;
    stellDiagramPanLastCssY = ev.clientY;
    stellDiagramPanHadMotion = false;
    stellDiagramPanUsedAltLeft = wantPanAltLeft;
    canvas.setPointerCapture(ev.pointerId);
    ev.preventDefault();
}

function onStellationDiagramCanvasPointerUp(ev) {
    const canvas = document.getElementById("stellationDiagramCanvas");
    if (!canvas) return;
    if (ev.pointerId !== stellDiagramPanPointerId) return;
    if (stellDiagramPanUsedAltLeft && stellDiagramPanHadMotion) {
        stellDiagramSuppressNextClick = true;
    }
    stellDiagramPanActive = false;
    stellDiagramPanPointerId = null;
    stellDiagramPanUsedAltLeft = false;
    try {
        canvas.releasePointerCapture(ev.pointerId);
    } catch {
        /* ignore */
    }
}

function refreshStellationDiagramCanvasCursor() {
    const canvas = document.getElementById("stellationDiagramCanvas");
    const wrap = document.getElementById("stellationDiagramWrap");
    if (!canvas || !wrap || wrap.hidden) {
        if (canvas) canvas.style.cursor = "";
        return;
    }
    if (
        !stellDiagramPointerInside ||
        !stellDiagramPickState?.regions?.length
    ) {
        canvas.style.cursor = "";
        return;
    }
    const r = stellDiagramHitRegionAtClient(
        canvas,
        stellDiagramLastPointerClientX,
        stellDiagramLastPointerClientY,
    );
    canvas.style.cursor = r ? "pointer" : "";
}

function onStellationDiagramCanvasPointerMove(ev) {
    const canvas = document.getElementById("stellationDiagramCanvas");
    const wrap = document.getElementById("stellationDiagramWrap");
    if (!canvas || !wrap || wrap.hidden) return;
    if (
        stellDiagramPanActive &&
        ev.pointerId === stellDiagramPanPointerId
    ) {
        const st = stellDiagramPickState;
        if (st?.scale) {
            const rect = canvas.getBoundingClientRect();
            const wCss = st.displayCss || 280;
            const dOx =
                ((ev.clientX - stellDiagramPanLastCssX) /
                    Math.max(rect.width, 1)) *
                wCss;
            const dOy =
                ((ev.clientY - stellDiagramPanLastCssY) /
                    Math.max(rect.height, 1)) *
                wCss;
            if (Math.abs(dOx) + Math.abs(dOy) > 0.5) {
                stellDiagramPanHadMotion = true;
            }
            const s = st.scale * stellDiagramViewZoom;
            stellDiagramViewPanU -= dOx / s;
            stellDiagramViewPanV += dOy / s;
            stellDiagramPanLastCssX = ev.clientX;
            stellDiagramPanLastCssY = ev.clientY;
            redrawStellationDiagram();
        }
        return;
    }
    stellDiagramPointerInside = true;
    stellDiagramLastPointerClientX = ev.clientX;
    stellDiagramLastPointerClientY = ev.clientY;
    refreshStellationDiagramCanvasCursor();
}

function onStellationDiagramCanvasPointerLeave() {
    const canvas = document.getElementById("stellationDiagramCanvas");
    if (!stellDiagramPanActive) stellDiagramPointerInside = false;
    if (canvas && !stellDiagramPanActive) canvas.style.cursor = "";
}

function onStellationDiagramCanvasClick(ev) {
    if (stellDiagramSuppressNextClick) {
        stellDiagramSuppressNextClick = false;
        return;
    }
    const canvas = document.getElementById("stellationDiagramCanvas");
    const wrap = document.getElementById("stellationDiagramWrap");
    if (!canvas || !wrap || wrap.hidden || !stellDiagramPickState?.regions)
        return;
    if (ev.button !== 0) return;
    const r = stellDiagramHitRegionAtClient(
        canvas,
        ev.clientX,
        ev.clientY,
    );
    if (!r) return;
    if (stellDiagramSelectedKeys.has(r.centroidKey)) {
        stellDiagramSelectedKeys.delete(r.centroidKey);
    } else {
        stellDiagramSelectedKeys.add(r.centroidKey);
    }
    redrawStellationDiagram();
    rebuildStellationDiagramSelection3D();
}

function clearStellationDiagramCanvas() {
    const canvas = document.getElementById("stellationDiagramCanvas");
    if (!canvas?.getContext) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function redrawStellationDiagram() {
    const wrap = document.getElementById("stellationDiagramWrap");
    const canvas = document.getElementById("stellationDiagramCanvas");
    if (!wrap || wrap.hidden || !canvas?.getContext) return;

    const polyKey =
        lastLoadedNetData &&
        getVertexConfigKeyForNetData(lastLoadedNetData);
    if (!polyKey || !STELLATION_DIAGRAM_POLY_KEYS.has(polyKey)) return;

    if (stellDiagramViewLastPolyKey !== polyKey) {
        stellDiagramViewZoom = 1;
        stellDiagramViewPanU = 0;
        stellDiagramViewPanV = 0;
        stellDiagramViewLastPolyKey = polyKey;
    }

    const expectedSides =
        polyKey === "5.5.5"
            ? 5
            : polyKey === "rhombic-dodecahedron"
              ? 4
              : 3;
    const refFaceId = findReferenceFaceIdForStellationDiagram(expectedSides);
    const refVerts = refFaceId != null ? getMeshWorldVertices(refFaceId) : null;
    if (!refVerts || refVerts.length < 3) return;

    const refCentroid = calculateWorldCentroid(refVerts);
    const refNormal = calculateWorldNormalRobust(refVerts);
    const interior = computeSolidCentroidWorld();
    if (
        interior &&
        refNormal.dot(_stellTmpA.copy(refCentroid).sub(interior)) < 0
    )
        refNormal.negate();

    const refPlane = new THREE.Plane();
    refPlane.setFromNormalAndCoplanarPoint(refNormal, refCentroid);

    const { poly2d, uAxis, vAxis } = orderConvexFacePolygon2D(
        refVerts,
        refCentroid,
        refNormal,
    );

    /* Large enough to include outer stellation “star” lines (classical diagrams extend
     * well past the face; margin is half-size of clip square vs max vertex radius). */
    const margin =
        polyKey === "5.5.5"
            ? 8.25
            : polyKey === "rhombic-dodecahedron"
              ? 8.0
              : 8.75;
    let clipPoly2d = makeStellationDiagramClipWindow2D(poly2d, margin);

    const segments = [];
    const lineOrigin = new THREE.Vector3();
    const lineDir = new THREE.Vector3();

    const collectSegmentsForClip = (clipPoly) => {
        const out = [];
        for (const key of Object.keys(allVertices)) {
            const fid = parseInt(key, 10);
            if (Number.isNaN(fid) || fid === refFaceId) continue;
            const otherPlane = makeFacePlaneWorld(fid, interior);
            if (!otherPlane) continue;
            if (!intersectPlanesLine(refPlane, otherPlane, lineOrigin, lineDir))
                continue;

            _stellProjOnPlane.copy(lineOrigin);
            refPlane.projectPoint(_stellProjOnPlane, lineOrigin);

            const Ou = _stellTmpB.subVectors(lineOrigin, refCentroid);
            const O2 = { u: Ou.dot(uAxis), v: Ou.dot(vAxis) };
            const D2 = {
                u: lineDir.dot(uAxis),
                v: lineDir.dot(vAxis),
            };
            if (Math.abs(D2.u) + Math.abs(D2.v) < 1e-10) continue;

            const clip = clipInfiniteLineToConvexPolygon2D(O2, D2, clipPoly);
            if (!clip) continue;
            out.push({
                u0: O2.u + clip.t0 * D2.u,
                v0: O2.v + clip.t0 * D2.v,
                u1: O2.u + clip.t1 * D2.u,
                v1: O2.v + clip.t1 * D2.v,
            });
        }
        return out;
    };

    segments.push(...collectSegmentsForClip(clipPoly2d));
    if (segments.length === 0) {
        clipPoly2d = [...clipPoly2d].reverse();
        segments.push(...collectSegmentsForClip(clipPoly2d));
    }

    let meanRefEdge = 0;
    for (let i = 0; i < poly2d.length; i++) {
        const p = poly2d[i];
        const q = poly2d[(i + 1) % poly2d.length];
        meanRefEdge += Math.hypot(q.u - p.u, q.v - p.v);
    }
    meanRefEdge =
        poly2d.length > 0 ? meanRefEdge / poly2d.length : sideLength;

    const { regions: diagramRegions } = buildStellationDiagramRegions(
        poly2d,
        clipPoly2d,
        segments,
    );
    if (stellDiagramSelectedKeys.size > 0)
        stellRemapDiagramSelectionToNewRegions(diagramRegions);

    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const stroke = (cs.getPropertyValue("--text-muted") || "#888").trim();
    const pad = 14;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const expand = (u, v) => {
        minX = Math.min(minX, u);
        minY = Math.min(minY, v);
        maxX = Math.max(maxX, u);
        maxY = Math.max(maxY, v);
    };
    for (const p of poly2d) expand(p.u, p.v);
    for (const p of clipPoly2d) expand(p.u, p.v);
    for (const s of segments) {
        expand(s.u0, s.v0);
        expand(s.u1, s.v1);
    }
    if (!Number.isFinite(minX)) return;
    const bw = Math.max(maxX - minX, 1e-6);
    const bh = Math.max(maxY - minY, 1e-6);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const displayCss = Math.min(wrap.clientWidth || 280, 280);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(displayCss * dpr));
    canvas.height = Math.max(1, Math.round(displayCss * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = displayCss;
    const h = displayCss;
    const scale = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
    const sDraw = scale * stellDiagramViewZoom;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(w / 2, h / 2);
    ctx.scale(sDraw, -sDraw);
    ctx.translate(-cx - stellDiagramViewPanU, -cy - stellDiagramViewPanV);

    const accent =
        (cs.getPropertyValue("--text") || "#ccc").trim() || "#ccc";
    for (const r of diagramRegions) {
        if (!stellDiagramSelectedKeys.has(r.centroidKey)) continue;
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        for (let i = 0; i < r.verts.length; i++) {
            const p = r.verts[i];
            if (i === 0) ctx.moveTo(p.u, p.v);
            else ctx.lineTo(p.u, p.v);
        }
        ctx.closePath();
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = stroke;
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    for (let i = 0; i < poly2d.length; i++) {
        const p = poly2d[i];
        if (i === 0) ctx.moveTo(p.u, p.v);
        else ctx.lineTo(p.u, p.v);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = stroke;
    /* lineWidth in (u,v) units; thinner strokes for a lighter diagram look */
    ctx.lineWidth = Math.max(0.65 / sDraw, 0.45 / sDraw);
    ctx.beginPath();
    for (let i = 0; i < poly2d.length; i++) {
        const p = poly2d[i];
        if (i === 0) ctx.moveTo(p.u, p.v);
        else ctx.lineTo(p.u, p.v);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.globalAlpha = 0.88;
    ctx.lineWidth = Math.max(1.05 / sDraw, 0.75 / sDraw);
    for (const s of segments) {
        ctx.beginPath();
        ctx.moveTo(s.u0, s.v0);
        ctx.lineTo(s.u1, s.v1);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    stellDiagramPickState = {
        displayCss: w,
        scale,
        cx,
        cy,
        viewZoom: stellDiagramViewZoom,
        viewPanU: stellDiagramViewPanU,
        viewPanV: stellDiagramViewPanV,
        regions: diagramRegions,
        uAxis: uAxis.clone(),
        vAxis: vAxis.clone(),
        refCentroid: refCentroid.clone(),
        refNormal: refNormal.clone(),
        meanRefEdge,
        referenceFaceId: refFaceId,
        refFacePoly2d: poly2d.map((p) => ({ u: p.u, v: p.v })),
        replicateDiagramToAllFaces:
            STELLATION_DIAGRAM_REPLICATE_ALL_FACES_KEYS.has(polyKey),
    };
    refreshStellationDiagramCanvasCursor();
    rebuildStellationDiagramSelection3D();
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

/**
 * Stellation overlays (diagram picks + uniform caps): see-through vs solid from Appearance.
 * @param {THREE.Material} mat
 */
function applyTranslucentStellationSurfaceMaterial(mat) {
    if (!mat || !("opacity" in mat) || mat.opacity === undefined) return;
    const el = document.getElementById("translucentStellationsCheckbox");
    const wantTranslucent = el ? el.checked : true;
    if (!wantTranslucent) {
        mat.opacity = 1;
        mat.transparent = false;
        if ("depthWrite" in mat) mat.depthWrite = true;
        return;
    }
    mat.transparent = true;
    mat.opacity = Math.min(0.9, (mat.opacity ?? 1) * 0.86);
    if ("depthWrite" in mat) mat.depthWrite = false;
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
    directionalLight.castShadow = false;
    const dark =
        document.documentElement.getAttribute("data-theme") === "dark";
    const mode = RENDER_MODES[currentRenderModeIndex] || "flat";
    if (mode === "rendered") {
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
    if (shadowGround) shadowGround.visible = false;
    if (renderer)
        renderer.toneMappingExposure = mode === "rendered" ? 1.1 : 1.0;
    syncLightingToThemeAndMode();
    forEachFaceMesh((mesh) => {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
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
    if (trophyPreviewGoldActive) applyTrophyPreviewGold(true);
    rebuildStellationUniformCapsIfNeeded();
    rebuildStellationDiagramSelection3D();
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
    redrawStellationDiagram();
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
        allVertices[1] = resolveNetFaceVertices(netData.baseFace, L);
        const baseSideCount = allVertices[1].numSides ?? allVertices[1].length;
        const baseFaceColorValue = resolveDisplayColorHex(
            netData.baseFace.color,
            baseSideCount,
        );
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
                pivot.userData.parentFaceIndex = j;
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
                const colorValue = resolveDisplayColorHex(colorInput, k);
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

function createTrophyThumbnailGoldMaterial() {
    if (scene?.environment) {
        const m = new THREE.MeshStandardMaterial({
            color: 0xffe8b8,
            metalness: 0.82,
            roughness: 0.32,
            envMapIntensity: 1.25,
        });
        m.envMap = scene.environment;
        return m;
    }
    return new THREE.MeshPhongMaterial({
        color: 0xffcf66,
        emissive: 0x4a3208,
        emissiveIntensity: 0.22,
        shininess: 78,
        specular: 0xfff2dd,
    });
}

function createTrophyPreviewGoldMaterial() {
    return createTrophyThumbnailGoldMaterial();
}

/**
 * Same topology as the main net builder: flat unfolded layout from net JSON, gold material, no outlines/normals.
 */
function buildFlatGoldNetGroup(netData) {
    const L = sideLength;
    const container = new THREE.Group();
    const av = {};
    const pv = {};
    const goldMat = createTrophyThumbnailGoldMaterial();
    av[1] = resolveNetFaceVertices(netData.baseFace, L);
    const baseGeom = createRegularPolygonGeometry(av[1]);
    if (!baseGeom.attributes.position || baseGeom.attributes.position.count === 0)
        throw new Error("Trophy base geometry failed.");
    const baseMesh = new THREE.Mesh(baseGeom, goldMat);
    baseMesh.userData.faceId = 1;
    container.add(baseMesh);

    const tempVec1 = new THREE.Vector3();
    const tempVec2 = new THREE.Vector3();
    const Q = new THREE.Vector3();
    const tempMatrix = new THREE.Matrix4();
    const tempQuatInv = new THREE.Quaternion();
    const tempWorldPos = new THREE.Vector3();

    for (const conn of netData.connections || []) {
        const i = conn.from;
        const j = conn.to;
        if (typeof i !== "number" || typeof j !== "number" || j < 0) continue;

        let Fi_base_vertices;
        try {
            Fi_base_vertices = resolveNetFaceVertices(conn, L);
        } catch {
            continue;
        }
        const k = Fi_base_vertices.numSides;
        if (k < 3) continue;

        const parentVertices = j === 1 ? av[1] : av[j];
        if (!parentVertices?.numSides) continue;

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
            continue;
        }
        const Fj_R_vertex = parentVertices[Fj_R_vertex_index];
        const Fj_S_vertex = parentVertices[Fj_S_vertex_index];
        if (!Fj_R_vertex || !Fj_S_vertex) continue;
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

        av[i] = Fi_final_world_vertices;
        av[i].numSides = k;
        if (Fi_base_vertices.isStarPolygon) av[i].isStarPolygon = true;
        av[i].conn = {
            R_idx: Fi_M_vertex_index,
            S_idx: Fi_N_vertex_index,
        };

        const fi_worldVertices = av[i];
        const parentObject = j === 1 ? container : pv[j];
        if (!parentObject) continue;
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
        pv[i] = pivot;
        parentObject.updateWorldMatrix(true, true);
        tempMatrix.copy(parentObject.matrixWorld).invert();
        pivot.position.copy(edgeMidpointWorld).applyMatrix4(tempMatrix);
        tempQuatInv
            .copy(parentObject.getWorldQuaternion(new THREE.Quaternion()))
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
        if (!geometry.attributes.position || geometry.attributes.position.count === 0)
            continue;
        const faceMesh = new THREE.Mesh(geometry, goldMat);
        faceMesh.userData.faceId = i;
        pivot.add(faceMesh);
    }
    return container;
}

function renderTrophyGroupToDataUrl(group) {
    if (!group) return null;
    if (!trophyThumbRenderer) {
        trophyThumbRenderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
        });
        trophyThumbRenderer.setSize(128, 128);
        trophyThumbRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        trophyThumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
        trophyThumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        trophyThumbRenderer.toneMappingExposure = 1.08;
    }
    if (!trophyThumbScene) trophyThumbScene = new THREE.Scene();
    const s = trophyThumbScene;
    while (s.children.length) s.remove(s.children[0]);
    s.environment = scene?.environment || null;
    const amb = new THREE.AmbientLight(0xffffff, 0.52);
    const dir = new THREE.DirectionalLight(0xfff5e6, 1.15);
    dir.position.set(5, 12, 8);
    s.add(amb, dir, group);

    group.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const ext = box.getSize(new THREE.Vector3());
    const radius = Math.max(ext.x, ext.y, ext.z, 0.8) * 0.55;
    const cam = new THREE.PerspectiveCamera(42, 1, 0.08, 800);
    cam.position.set(
        center.x + radius * 1.35,
        center.y + radius * 1.05,
        center.z + radius * 1.35,
    );
    cam.lookAt(center);

    trophyThumbRenderer.render(s, cam);
    const url = trophyThumbRenderer.domElement.toDataURL("image/png");
    s.remove(group);
    s.remove(amb);
    s.remove(dir);
    const mats = new Set();
    group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) mats.add(o.material);
    });
    mats.forEach((m) => m.dispose());
    return url;
}

async function tryFetchManualTrophyPng(polyKey) {
    const j = POLY_KEY_TO_PRESET_NET_FILE[polyKey];
    const candidates = [];
    if (j) candidates.push(`trophies/${j.replace(/\.json$/i, ".png")}`);
    candidates.push(`trophies/${polyKey}.png`);
    for (const url of candidates) {
        try {
            const r = await fetch(url);
            if (!r.ok) continue;
            await r.blob();
            return url;
        } catch {
            /* try next */
        }
    }
    return null;
}

async function getTrophyThumbDataUrl(polyKey) {
    const ck = trophyThumbCacheKey(polyKey);
    if (trophyThumbCache.has(ck)) return trophyThumbCache.get(ck);

    const manualUrl = await tryFetchManualTrophyPng(polyKey);
    if (manualUrl) {
        trophyThumbCache.set(ck, manualUrl);
        return manualUrl;
    }

    const file = POLY_KEY_TO_PRESET_NET_FILE[polyKey];
    if (!file) {
        const svg = trophySvgMarkupForKey(polyKey, 0);
        const u = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        trophyThumbCache.set(ck, u);
        return u;
    }
    try {
        const res = await fetch(`nets/${file}`);
        if (!res.ok) throw new Error(String(res.status));
        const netData = await res.json();
        const g = buildFlatGoldNetGroup(netData);
        const url = renderTrophyGroupToDataUrl(g);
        if (url) trophyThumbCache.set(ck, url);
        return url || "";
    } catch (e) {
        console.warn("Trophy thumbnail fetch/render failed:", polyKey, e);
        const svg = trophySvgMarkupForKey(polyKey, 0);
        const u = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        trophyThumbCache.set(ck, u);
        return u;
    }
}

function scheduleTrophyThumb(polyKey, imgEl) {
    if (!imgEl) return;
    const ck = trophyThumbCacheKey(polyKey);
    if (trophyThumbCache.has(ck)) {
        imgEl.src = trophyThumbCache.get(ck);
        return;
    }
    let p = trophyThumbInflight.get(polyKey);
    if (!p) {
        p = getTrophyThumbDataUrl(polyKey).finally(() => {
            trophyThumbInflight.delete(polyKey);
        });
        trophyThumbInflight.set(polyKey, p);
    }
    p.then((url) => {
        if (url) imgEl.src = url;
    });
}

function applyTrophyPreviewGold(on) {
    trophyPreviewGoldActive = on;
    const cb = document.getElementById("trophyPreviewGoldCheckbox");
    if (cb) cb.checked = on;
    if (!f1Mesh) return;
    if (!on) {
        applyRenderMode(currentRenderModeIndex);
        applyRenderModeVisualLayers();
        return;
    }
    const proto = createTrophyPreviewGoldMaterial();
    forEachFaceMesh((mesh) => {
        disposeFaceMeshMaterial(mesh);
        mesh.material = proto.clone();
    });
    applyRenderModeVisualLayers();
    const mode = RENDER_MODES[currentRenderModeIndex] || "flat";
    if (renderer) renderer.toneMappingExposure = mode === "rendered" ? 1.14 : 1.08;
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
    builderLastQuickAttach = null;
    builderSessionFromScratch = false;
    pendingScratchTrophyKey = null;
    builderUsedEdgeKeys.clear();
    builderDirty = false;
    clearBuilderFaceSelection();
    if (builderPanelEl) builderPanelEl.hidden = true;
    if (builderAttachPanel) builderAttachPanel.hidden = true;
    if (createBaseBlockEl) createBaseBlockEl.hidden = false;
    if (buildCustomNetBtnEl) buildCustomNetBtnEl.textContent = "Build net";
    clearEdgePickGroup();
    setBuilderHintVisible(false, 0, 0);
}

function enterNetBuilderFromData(netData, options = {}) {
    clearBuilderFaceSelection();
    builderNetData = JSON.parse(JSON.stringify(netData));
    builderPendingEdge = null;
    isNetBuilderActive = true;
    builderDirty = options.fromSavedPreset === true ? false : true;
    if (options.fromScratchBuild === true) {
        builderSessionFromScratch = true;
        if (createBaseBlockEl) createBaseBlockEl.hidden = true;
        if (buildCustomNetBtnEl) buildCustomNetBtnEl.textContent = "Rebuild net base";
    } else {
        builderSessionFromScratch = false;
        if (createBaseBlockEl) createBaseBlockEl.hidden = false;
        if (buildCustomNetBtnEl) buildCustomNetBtnEl.textContent = "Build net";
    }
    if (builderPanelEl) builderPanelEl.hidden = false;
    if (builderAttachPanel) builderAttachPanel.hidden = true;
    hydrateUsedEdgesFromNet(builderNetData);
    loadAndProcessNet(builderNetData, {
        allowUnknownSignature: true,
        trophyEligible: options.fromScratchBuild === true,
    });
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

function cloneFaceSpecForRepeat(spec) {
    if (typeof structuredClone === "function") {
        return structuredClone(spec);
    }
    return JSON.parse(JSON.stringify(spec));
}

/**
 * @returns {boolean} true if a flap was appended
 */
function tryAppendFlapToEdge(pick, spec, color) {
    if (!pick || !builderNetData) return false;
    try {
        const fid = pick.faceId;
        const pVerts = allVertices[fid];
        const ia = pick.v0;
        const ib = pick.v1;
        if (
            !pVerts ||
            !pVerts[ia] ||
            !pVerts[ib] ||
            !(pVerts[ia] instanceof THREE.Vector3)
        ) {
            alert(
                "Could not measure the clicked edge. Load the net again or exit and re-enter the builder.",
            );
            return false;
        }
        const hingeLen = pVerts[ia].distanceTo(pVerts[ib]);
        if (hingeLen < 1e-6) {
            alert("That edge is too short to attach to.");
            return false;
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
        clearBuilderFaceSelection();
        hydrateUsedEdgesFromNet(builderNetData);
        loadAndProcessNet(builderNetData, {
            allowUnknownSignature: true,
            trophyEligible: builderSessionFromScratch,
        });
        builderDirty = true;
        return true;
    } catch (err) {
        alert(err.message || String(err));
        return false;
    }
}

function pickEdgePickAtClient(clientX, clientY) {
    if (!renderer || !camera || !edgePickGroup) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(edgePickGroup.children, false);
    if (hits.length === 0) return null;
    const pick = hits[0].object?.userData?.pick;
    return pick || null;
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
        loadAndProcessNet(builderNetData, {
            allowUnknownSignature: true,
            trophyEligible: builderSessionFromScratch,
        });
        builderDirty = true;
    } catch (err) {
        alert(err.message || String(err));
    }
}

function applyReplaceSelectedFaceShape() {
    if (!isNetBuilderActive || builderSelectedFaceId == null || !builderNetData) {
        return;
    }
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
            let color = editFaceColorInputEl?.value || "#b8a9d9";
            if (colorCoordinatedBySidesEnabled() && nextSides != null) {
                color = colorCssForPolygonSides(nextSides);
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
            let color = editFaceColorInputEl?.value || "#b8a9d9";
            if (colorCoordinatedBySidesEnabled() && nextSides != null) {
                color = colorCssForPolygonSides(nextSides);
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
        loadAndProcessNet(builderNetData, {
            allowUnknownSignature: true,
            trophyEligible: builderSessionFromScratch,
        });
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
        if (meta.computeOnly) {
            return;
        }
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
            tryScratchFoldTrophyReward();
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
        const storedParent = pivot.userData.parentFaceIndex;
        const parentKey =
            typeof storedParent === "number" && storedParent >= 1
                ? null
                : Object.keys(pivots).find((key) => pivots[key] === parent);
        const parentIndex =
            typeof storedParent === "number" && storedParent >= 1
                ? storedParent
                : parent === scene
                  ? 1
                  : parentKey
                    ? parseInt(parentKey, 10)
                    : null;
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
            const bulkC = computeBulkCentroidWorldExcludingFace(
                faceIndex,
                faceIndex - 1,
            );
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
    if (meta.computeOnly) {
        return;
    }
    animationStartTime = performance.now();
    pausedElapsedTime = 0;
    isAnimating = true;
    isPaused = false;
    pauseButton.disabled = false;
    pauseButton.textContent = "Pause";
    syncBuilderEdgePicksVisibility();
}

/** Apply every hinge target in order with no tweening (same math as animated fold). */
function instantFoldToClosed() {
    if (!f1Mesh) return;
    if (!currentFoldAngles && NUM_ANIMATION_STAGES < 1) return;
    if (trialFoldPauseActive) return;
    if (isAnimating) return;
    if (isFolded) return;

    if (NUM_ANIMATION_STAGES < 1) {
        isFolded = true;
        refreshFoldControlState();
        syncBuilderEdgePicksVisibility();
        return;
    }

    for (let s = 1; s <= NUM_ANIMATION_STAGES; s++) {
        triggerAnimationStage(s, { computeOnly: true });
        for (const pivotIndex of pivotsInCurrentStage) {
            const t = targetQuaternions[pivotIndex];
            if (t && pivots[pivotIndex]) pivots[pivotIndex].quaternion.copy(t);
        }
        scene.updateMatrixWorld(true);
    }

    isAnimating = false;
    isPaused = false;
    currentAnimationStage = 0;
    pivotsInCurrentStage = [];
    pauseButton.disabled = true;
    pauseButton.textContent = "Pause";
    isFolded = true;
    tryScratchFoldTrophyReward();
    refreshFoldControlState();
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (controls?.handleResize) controls.handleResize();
    redrawStellationDiagram();
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
        loadAndProcessNet(netData, { trophyEligible: false });
    } catch (error) {
        console.error("Error loading preset net:", error);
        alert(`Error loading preset net: ${error.message}`);
    } finally {
        presetNets.value = "";
    }
});

// --- Start Application ---
init();
