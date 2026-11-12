import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  BARRIER_AT,
  NODES,
  type Band,
  type Frame,
  type Gap,
  type NodeKey,
  type Reading,
} from "./sim-clock";
import { acceptanceTag, type Acceptance } from "./scenarios";
import { formatAmount } from "@/lib/simulation-assumptions";

export type CameraMode = "overview" | "follow";

export type DioramaConfig = {
  readings: Reading[];
  stepMinutes: number;
  journeyEnd: number;
  gaps: Gap[];
  hasTrace: boolean;
  /** Scenario types in rail order; index maps to keys 1-4. */
  scenarios: string[];
  selected: string;
  acceptance: Record<string, Acceptance>;
  blocked: Record<string, boolean>;
  labels: {
    origin: string;
    decision: string;
    receiver: string;
    alt: string;
    inspection: string;
    quarantine: string;
    gap: string;
    blocked: string;
    /** Unit and currency for the per-route tags in compare mode. */
    unit: string;
    currency: string;
    /** Receiver acceptance in words, shown next to the glyph. */
    acc: Record<Acceptance, string>;
  };
  camera: CameraMode;
  compare: boolean;
  reducedMotion: boolean;
};

export type DioramaFrames = { all: Frame[] };

type Palette = {
  bg: THREE.Color;
  panel: THREE.Color;
  panel2: THREE.Color;
  line: THREE.Color;
  text: THREE.Color;
  ground: THREE.Color;
  road: THREE.Color;
  building: THREE.Color;
  roof: THREE.Color;
  pad: THREE.Color;
  padSel: THREE.Color;
  truck: THREE.Color;
  cab: THREE.Color;
  tree: THREE.Color;
  unknown: THREE.Color;
  unknownBg: THREE.Color;
  eligible: THREE.Color;
  blocked: THREE.Color;
  band: Record<Band, THREE.Color>;
};

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const c = (name: string, fallback: string) =>
    new THREE.Color(cs.getPropertyValue(name).trim() || fallback);
  const bg = c("--bg", "#f3f7f9");
  const panel = c("--panel", "#ffffff");
  const panel2 = c("--panel-2", "#e8eff3");
  const text = c("--text", "#0d1a24");
  const mix = (a: THREE.Color, b: THREE.Color, k: number) =>
    a.clone().lerp(b, k);
  const unknown = c("--st-unknown-line", "#8a98a3");
  return {
    bg,
    panel,
    panel2,
    line: c("--line", "#cbd7df"),
    text,
    ground: mix(panel, panel2, 0.55),
    road: mix(panel2, text, 0.16),
    building: mix(panel, text, 0.42),
    roof: mix(panel, text, 0.3),
    pad: mix(mix(panel, panel2, 0.55), text, 0.09),
    padSel: mix(mix(panel, panel2, 0.55), text, 0.32),
    truck: mix(panel, text, 0.55),
    cab: mix(panel, text, 0.72),
    tree: mix(panel, text, 0.26),
    unknown,
    unknownBg: c("--st-unknown-bg", "#e4e9ed"),
    eligible: c("--st-eligible-line", "#5aa0a8"),
    blocked: c("--st-blocked-line", "#cf6a5a"),
    band: {
      cold: c("--temp-cold", "#2563b8"),
      cool: c("--temp-cool", "#5db4e0"),
      warm: c("--temp-warm", "#d98a14"),
      hot: c("--temp-hot", "#d4401f"),
      unknown,
    },
  };
}

function paint(geo: THREE.BufferGeometry, color: THREE.Color) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}
function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: THREE.Color,
  rotY = 0,
) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return paint(g, color);
}
function cyl(
  r: number,
  h: number,
  x: number,
  y: number,
  z: number,
  color: THREE.Color,
  sides = 14,
  rotX = 0,
) {
  const g = new THREE.CylinderGeometry(r, r, h, sides);
  if (rotX) g.rotateX(rotX);
  g.translate(x, y, z);
  return paint(g, color);
}
function strip(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  width: number,
  y: number,
  height: number,
  color: THREE.Color,
) {
  const len = Math.hypot(bx - ax, bz - az);
  return box(
    len,
    height,
    width,
    (ax + bx) / 2,
    y,
    (az + bz) / 2,
    color,
    -Math.atan2(bz - az, bx - ax),
  );
}

type Truck = {
  group: THREE.Group;
  /** Flat ring on the road while the truck waits out its delay. */
  ring: THREE.Mesh;
  reefer: THREE.Mesh;
  reeferMat: THREE.MeshLambertMaterial;
  bodyMat: THREE.MeshLambertMaterial;
};

function makeTruck(p: Palette): Truck {
  const parts = [
    box(2.1, 0.16, 0.74, 0, 0.3, 0, p.cab),
    box(0.62, 0.56, 0.72, 0.95, 0.62, 0, p.cab),
    box(0.06, 0.24, 0.6, 1.27, 0.7, 0, p.panel),
  ];
  for (const x of [-0.65, 0.05, 0.95])
    for (const z of [-0.4, 0.4])
      parts.push(cyl(0.19, 0.14, x, 0.19, z, p.text, 10, Math.PI / 2));
  const body = mergeGeometries(parts, false)!;
  const bodyMat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    transparent: true,
  });
  const bodyMesh = new THREE.Mesh(body, bodyMat);
  bodyMesh.castShadow = true;
  const reeferMat = new THREE.MeshLambertMaterial({
    color: p.unknown,
    transparent: true,
  });
  const reefer = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.86, 0.8),
    reeferMat,
  );
  reefer.position.set(-0.3, 0.82, 0);
  reefer.castShadow = true;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.08, 40),
    new THREE.MeshBasicMaterial({
      color: p.text,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.09, 0);
  ring.visible = false;
  const group = new THREE.Group();
  group.add(bodyMesh, reefer, ring);
  return { group, ring, reefer, reeferMat, bodyMat };
}

type Marker = { el: HTMLSpanElement; point: THREE.Vector3 };

const ISO_YAW = 0.62;
const ISO_ELEV = 0.6;
const MAX_STEPS = 64;
const MAX_GAPS = 6;
const ANIM_MS = 1000;

export type Diorama = {
  setConfig: (c: DioramaConfig) => void;
  setFrames: (f: DioramaFrames) => void;
  /** Show the previous result faded for about a second after a factor change. */
  pulseGhost: () => void;
  refreshTheme: () => void;
  dispose: () => void;
};

export function mountDiorama(host: HTMLElement): Diorama {
  const startedAt = performance.now();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-10, 10, 7, -7, 0.1, 120);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.0);
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(-9, 14, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -13;
  sun.shadow.camera.right = 13;
  sun.shadow.camera.top = 13;
  sun.shadow.camera.bottom = -13;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0008;
  sun.shadow.radius = 3;
  scene.add(hemi, sun);

  let cfg: DioramaConfig | null = null;
  let frames: DioramaFrames | null = null;
  let pal = readPalette();
  let world: THREE.Group | null = null;
  let disposed = false;
  let lastSig = "";
  let onScreen = true;
  let raf = 0;
  let lastDraw = 0;
  let ghostStart = -Infinity;
  const cam = { zoom: 1.55, cx: -4, cz: 0.4, snap: true };
  const markers: Record<string, Marker> = {};
  let markerLayer: HTMLDivElement | null = null;

  // Dynamic handles, rebuilt with the world.
  let trucks: Truck[] = [];
  let pads: Record<string, THREE.Mesh> = {};
  let flags: Record<string, THREE.Mesh> = {};
  let overlays: THREE.Mesh[] = [];
  let barriers: THREE.Mesh[] = [];
  let ribbon: THREE.Mesh | null = null;
  let ribbonGeo: THREE.BufferGeometry | null = null;
  let gapPlanes: {
    mesh: THREE.Mesh;
    edges: THREE.LineSegments;
    tex: THREE.CanvasTexture | null;
  }[] = [];

  const O = NODES.origin;
  const D = NODES.decision;
  const destKeys: NodeKey[] = ["receiver", "inspection", "alt", "quarantine"];
  const approachLen = D.x - O.x;
  /** The ribbon stands just behind the road so the truck stays readable in front of it. */
  const RIB_Z = D.z - 1.05;

  function disposeWorld() {
    if (!world) return;
    scene.remove(world);
    world.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) {
        (Array.isArray(mat) ? mat : [mat]).forEach((x) => {
          (x as THREE.MeshBasicMaterial).map?.dispose();
          x.dispose();
        });
      }
    });
    world = null;
  }

  function buildWorld() {
    disposeWorld();
    pal = readPalette();
    const g = new THREE.Group();
    world = g;

    // Terrain: slab, plinth, plaza, roads. Receives shadows.
    const terrain: THREE.BufferGeometry[] = [
      box(19.6, 0.2, 17, 0.1, -0.62, 1.1, pal.line),
      box(19.0, 0.5, 16.4, 0.1, -0.27, 1.1, pal.ground),
      cyl(1.35, 0.05, D.x, 0.03, D.z, pal.panel2, 28),
      strip(O.x - 1.2, O.z, D.x, D.z, 1.0, 0.02, 0.04, pal.road),
    ];
    for (const k of destKeys) {
      const n = NODES[k];
      terrain.push(strip(D.x, D.z, n.x, n.z, 0.8, 0.02, 0.04, pal.road));
    }
    terrain.push(box(2.6, 0.05, 2.2, O.x - 0.4, 0.03, O.z - 3.1, pal.panel2));
    const terrainMesh = new THREE.Mesh(
      mergeGeometries(terrain, false)!,
      new THREE.MeshLambertMaterial({ vertexColors: true }),
    );
    terrainMesh.receiveShadow = true;
    g.add(terrainMesh);

    // Structures: ink-grey buildings, signpost, trees. Cast shadows.
    const s: THREE.BufferGeometry[] = [];
    // Origin depot
    s.push(box(3.0, 1.2, 1.7, O.x - 0.4, 0.6, O.z - 3.1, pal.building));
    s.push(box(3.2, 0.12, 1.9, O.x - 0.4, 1.26, O.z - 3.1, pal.roof));
    s.push(box(0.9, 0.7, 0.06, O.x - 0.4, 0.38, O.z - 2.22, pal.truck));
    // Decision signpost
    s.push(cyl(0.05, 1.7, D.x - 0.9, 0.85, D.z - 0.9, pal.text, 8));
    s.push(box(1.0, 0.34, 0.07, D.x - 0.9, 1.6, D.z - 0.9, pal.truck));
    // Receiver store
    const R = NODES.receiver;
    s.push(box(2.3, 1.5, 1.6, R.x + 0.3, 0.75, R.z - 2.0, pal.building));
    s.push(box(2.5, 0.14, 1.8, R.x + 0.3, 1.57, R.z - 2.0, pal.roof));
    s.push(box(0.8, 0.9, 0.06, R.x + 0.3, 0.45, R.z - 1.18, pal.truck));
    // Alternative receiver (smaller)
    const A = NODES.alt;
    s.push(box(1.9, 1.15, 1.4, A.x + 0.2, 0.58, A.z - 1.9, pal.building));
    s.push(box(2.1, 0.12, 1.6, A.x + 0.2, 1.21, A.z - 1.9, pal.roof));
    s.push(box(0.7, 0.7, 0.06, A.x + 0.2, 0.35, A.z - 1.18, pal.truck));
    // Inspection facility: open canopy on posts, beside the pad so the truck stays visible
    const H = NODES.inspection;
    const hx = H.x + 2.9;
    const hz = H.z - 0.4;
    for (const dx of [-1, 1])
      for (const dz of [-0.6, 0.6])
        s.push(box(0.1, 1.1, 0.1, hx + dx, 0.55, hz + dz, pal.truck));
    s.push(box(2.5, 0.14, 1.6, hx, 1.17, hz, pal.roof));
    s.push(box(1.2, 0.5, 0.6, hx, 0.27, hz, pal.building));
    // Quarantine: containers and fence
    const Q = NODES.quarantine;
    for (const dx of [-0.65, 0.65])
      s.push(box(1.1, 0.9, 1.9, Q.x - 2.2 + dx, 0.45, Q.z + 0.1, pal.building));
    s.push(box(3.2, 0.5, 0.06, Q.x - 2.2, 0.25, Q.z + 1.3, pal.truck));
    s.push(box(3.2, 0.5, 0.06, Q.x - 2.2, 0.25, Q.z - 1.1, pal.truck));
    // A few low-poly trees to give the diorama scale
    const treeSpots: [number, number][] = [
      [-8.4, 2.6],
      [-5.2, 2.9],
      [2.4, -2.6],
      [1.2, 3.2],
      [8.6, 3.0],
      [3.2, -6.4],
      [8.4, -3.6],
      [-4.0, -4.4],
    ];
    for (const [x, z] of treeSpots) {
      s.push(cyl(0.07, 0.4, x, 0.2, z, pal.text, 6));
      const cone = new THREE.ConeGeometry(0.42, 1.0, 6);
      cone.translate(x, 0.85, z);
      s.push(paint(cone, pal.tree));
    }
    const structures = new THREE.Mesh(
      mergeGeometries(s, false)!,
      new THREE.MeshLambertMaterial({ vertexColors: true }),
    );
    structures.castShadow = true;
    structures.receiveShadow = true;
    g.add(structures);

    // Destination pads and acceptance flags (dynamic colour).
    pads = {};
    flags = {};
    for (const k of destKeys) {
      const n = NODES[k];
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.1, 2.3),
        new THREE.MeshLambertMaterial({ color: pal.pad }),
      );
      pad.position.set(n.x, 0.06, n.z);
      pad.receiveShadow = true;
      g.add(pad);
      pads[k] = pad;
      const flag = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.3, 0.05),
        new THREE.MeshLambertMaterial({ color: pal.unknown }),
      );
      flag.position.set(n.x + 1.0, 1.75, n.z - 0.9);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6),
        new THREE.MeshLambertMaterial({ color: pal.text }),
      );
      pole.position.set(n.x + 0.75, 1.35, n.z - 0.9);
      g.add(pole);
      flag.position.set(n.x + 1.0, 1.75, n.z - 0.9);
      g.add(flag);
      flags[k] = flag;
    }

    // Branch overlays: dark ink strips showing the four ways out.
    overlays = destKeys.map((k) => {
      const n = NODES[k];
      const len = Math.hypot(n.x - D.x, n.z - D.z);
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.02, 0.34),
        new THREE.MeshBasicMaterial({
          color: pal.text,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      m.position.set((D.x + n.x) / 2, 0.065, (D.z + n.z) / 2);
      m.rotation.y = -Math.atan2(n.z - D.z, n.x - D.x);
      g.add(m);
      return m;
    });
    barriers = destKeys.map((k) => {
      const n = NODES[k];
      const at = BARRIER_AT + 0.1;
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.9, 1.5),
        new THREE.MeshLambertMaterial({ color: pal.blocked }),
      );
      m.position.set(D.x + (n.x - D.x) * at, 0.45, D.z + (n.z - D.z) * at);
      m.rotation.y = -Math.atan2(n.z - D.z, n.x - D.x);
      m.visible = false;
      m.castShadow = true;
      g.add(m);
      return m;
    });

    // Thermal ribbon: one dynamic mesh.
    ribbonGeo = new THREE.BufferGeometry();
    ribbonGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(MAX_STEPS * 36 * 3), 3),
    );
    ribbonGeo.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(MAX_STEPS * 36 * 3), 3),
    );
    ribbonGeo.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(MAX_STEPS * 36 * 3), 3),
    );
    ribbonGeo.setDrawRange(0, 0);
    ribbon = new THREE.Mesh(
      ribbonGeo,
      new THREE.MeshLambertMaterial({ vertexColors: true }),
    );
    ribbon.castShadow = true;
    ribbon.frustumCulled = false;
    g.add(ribbon);

    // Hatched ghost frames for gaps.
    gapPlanes = [];
    const hatch = document.createElement("canvas");
    hatch.width = hatch.height = 64;
    const hc = hatch.getContext("2d");
    if (hc) {
      hc.fillStyle = `#${pal.unknownBg.getHexString()}`;
      hc.globalAlpha = 0.5;
      hc.fillRect(0, 0, 64, 64);
      hc.globalAlpha = 1;
      hc.strokeStyle = `#${pal.unknown.getHexString()}`;
      hc.lineWidth = 6;
      for (let i = -64; i < 128; i += 21) {
        hc.beginPath();
        hc.moveTo(i, 64);
        hc.lineTo(i + 64, 0);
        hc.stroke();
      }
    }
    for (let i = 0; i < MAX_GAPS; i++) {
      const tex = hc ? new THREE.CanvasTexture(hatch) : null;
      if (tex) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
      }
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 2.2),
        new THREE.MeshBasicMaterial({
          map: tex,
          color: tex ? 0xffffff : pal.unknown,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      mesh.visible = false;
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 2.2)),
        new THREE.LineBasicMaterial({ color: pal.unknown }),
      );
      edges.visible = false;
      g.add(mesh, edges);
      gapPlanes.push({ mesh, edges, tex });
    }

    // Trucks: 4 scenario trucks plus one what-if ghost.
    trucks = [];
    for (let i = 0; i < 5; i++) {
      const t = makeTruck(pal);
      t.group.scale.setScalar(1.2);
      t.group.visible = false;
      g.add(t.group);
      trucks.push(t);
    }
    scene.add(g);
    scene.background = null;
    requestFrame();
  }

  function ensureMarkers() {
    if (markerLayer) return;
    markerLayer = document.createElement("div");
    markerLayer.className = "marker-layer";
    markerLayer.setAttribute("aria-hidden", "true");
    host.appendChild(markerLayer);
    const make = (key: string, point: THREE.Vector3) => {
      const el = document.createElement("span");
      el.className = "network-marker network-secondary";
      markerLayer!.appendChild(el);
      markers[key] = { el, point };
    };
    make("origin", new THREE.Vector3(O.x - 0.4, 1.9, O.z - 3.0));
    make("decision", new THREE.Vector3(D.x, 2.2, D.z));
    make(
      "receiver",
      new THREE.Vector3(NODES.receiver.x + 0.3, 2.3, NODES.receiver.z - 2.0),
    );
    make("alt", new THREE.Vector3(NODES.alt.x + 0.2, 2.0, NODES.alt.z - 1.9));
    make(
      "inspection",
      new THREE.Vector3(NODES.inspection.x, 1.9, NODES.inspection.z + 0.4),
    );
    make(
      "quarantine",
      new THREE.Vector3(
        NODES.quarantine.x - 2.2,
        1.6,
        NODES.quarantine.z + 0.1,
      ),
    );
    make("gap", new THREE.Vector3(0, 1.9, O.z));
    for (let i = 0; i < 4; i++) make(`truck${i}`, new THREE.Vector3());
  }

  function applyLabels() {
    if (!cfg) return;
    ensureMarkers();
    const sel = cfg.scenarios.indexOf(cfg.selected);
    const selDest = destKeys[sel] ?? "receiver";
    const text: Record<string, string> = {
      origin: cfg.labels.origin,
      decision: cfg.labels.decision,
      receiver: cfg.labels.receiver,
      alt: cfg.labels.alt,
      inspection: cfg.labels.inspection,
      quarantine: cfg.labels.quarantine,
    };
    const accOf = (type: string) => cfg!.acceptance[type] ?? "UNKNOWN";
    // Receiver acceptance is an assumption: show it on the receiving nodes.
    text.receiver = acceptanceTag(
      accOf("CONTINUE_DELIVERY"),
      text.receiver,
      cfg.labels.acc,
    );
    text.alt = acceptanceTag(
      accOf("CONDITIONAL_REROUTE"),
      text.alt,
      cfg.labels.acc,
    );
    for (const [key, m] of Object.entries(markers)) {
      if (key in text) {
        m.el.textContent = text[key];
        const strong =
          key === "origin" ||
          key === "decision" ||
          key === selDest ||
          cfg.compare;
        m.el.className =
          "network-marker " + (strong ? "network-name" : "network-secondary");
      }
    }
    // Pads, flags.
    destKeys.forEach((k, i) => {
      const type = cfg!.scenarios[i];
      const isSel = i === sel;
      (pads[k]?.material as THREE.MeshLambertMaterial | undefined)?.color.copy(
        isSel ? pal.padSel : pal.pad,
      );
      const a = accOf(type);
      const flagMat = flags[k]?.material as
        THREE.MeshLambertMaterial | undefined;
      flagMat?.color.copy(
        a === "ACCEPTED"
          ? pal.eligible
          : a === "REJECTED"
            ? pal.blocked
            : pal.unknown,
      );
    });
    requestFrame();
  }

  function ribbonColor(band: Band) {
    return pal.band[band];
  }

  function pushBox(
    pos: Float32Array,
    nor: Float32Array,
    col: Float32Array,
    at: number,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    c: THREE.Color,
  ) {
    // 6 faces x 2 triangles x 3 vertices
    const faces: [number[][], number[]][] = [
      [
        [
          [x0, y0, z1],
          [x1, y0, z1],
          [x1, y1, z1],
          [x0, y1, z1],
        ],
        [0, 0, 1],
      ],
      [
        [
          [x1, y0, z0],
          [x0, y0, z0],
          [x0, y1, z0],
          [x1, y1, z0],
        ],
        [0, 0, -1],
      ],
      [
        [
          [x0, y1, z1],
          [x1, y1, z1],
          [x1, y1, z0],
          [x0, y1, z0],
        ],
        [0, 1, 0],
      ],
      [
        [
          [x0, y0, z0],
          [x1, y0, z0],
          [x1, y0, z1],
          [x0, y0, z1],
        ],
        [0, -1, 0],
      ],
      [
        [
          [x1, y0, z1],
          [x1, y0, z0],
          [x1, y1, z0],
          [x1, y1, z1],
        ],
        [1, 0, 0],
      ],
      [
        [
          [x0, y0, z0],
          [x0, y0, z1],
          [x0, y1, z1],
          [x0, y1, z0],
        ],
        [-1, 0, 0],
      ],
    ];
    let v = at;
    for (const [q, n] of faces) {
      for (const i of [0, 1, 2, 0, 2, 3]) {
        pos.set(q[i], v * 3);
        nor.set(n, v * 3);
        col[v * 3] = c.r;
        col[v * 3 + 1] = c.g;
        col[v * 3 + 2] = c.b;
        v += 1;
      }
    }
    return v;
  }

  function updateRibbon(f: Frame) {
    if (!cfg || !ribbonGeo) return;
    const pos = ribbonGeo.attributes.position.array as Float32Array;
    const nor = ribbonGeo.attributes.normal.array as Float32Array;
    const col = ribbonGeo.attributes.color.array as Float32Array;
    let v = 0;
    const rear =
      f.phase === "journey"
        ? Math.max(0, f.truck.progress - 1.05 / approachLen)
        : 1;
    const toX = (s: number) => O.x + (D.x - O.x) * s;
    const n = cfg.readings.length;
    if (cfg.hasTrace) {
      for (let i = 0; i < Math.min(n - 1, MAX_STEPS); i++) {
        const value = cfg.readings[i];
        if (value === null || value === undefined) continue;
        const s0 = (i * cfg.stepMinutes) / cfg.journeyEnd;
        const s1 = ((i + 1) * cfg.stepMinutes) / cfg.journeyEnd;
        const e = Math.min(s1, rear);
        if (e <= s0) continue;
        const h = 0.3 + Math.min(14, Math.max(0, value)) * 0.22;
        const band: Band =
          value < 4 ? "cold" : value < 6 ? "cool" : value < 8 ? "warm" : "hot";
        v = pushBox(
          pos,
          nor,
          col,
          v,
          toX(s0),
          toX(e),
          0.04,
          h,
          RIB_Z - 0.16,
          RIB_Z + 0.16,
          ribbonColor(band),
        );
      }
    }
    ribbonGeo.setDrawRange(0, v);
    ribbonGeo.attributes.position.needsUpdate = true;
    ribbonGeo.attributes.normal.needsUpdate = true;
    ribbonGeo.attributes.color.needsUpdate = true;
    ribbonGeo.computeBoundingSphere();

    // Gap frames
    gapPlanes.forEach((gp, i) => {
      const gap = cfg!.hasTrace ? cfg!.gaps[i] : undefined;
      if (!gap) {
        gp.mesh.visible = false;
        gp.edges.visible = false;
        return;
      }
      const s0 = gap.fromMin / cfg!.journeyEnd;
      const s1 = gap.untilMin / cfg!.journeyEnd;
      const e = Math.min(s1, rear);
      const vis = e > s0 + 1e-6;
      gp.mesh.visible = vis;
      gp.edges.visible = vis;
      if (!vis) return;
      const len = (e - s0) * approachLen;
      const cx = toX(s0) + len / 2;
      gp.mesh.scale.set(len, 1, 1);
      gp.mesh.position.set(cx, 1.1, RIB_Z);
      gp.edges.scale.set(len, 1, 1);
      gp.edges.position.set(cx, 1.1, RIB_Z);
      if (gp.tex) gp.tex.repeat.set(len / 0.9, 2.2 / 0.9);
    });
  }

  function applyFrames() {
    if (!cfg || !frames || !world) return;
    const fr = frames;
    const selIdx = Math.max(0, cfg.scenarios.indexOf(cfg.selected));
    const main = fr.all[selIdx] ?? fr.all[0];
    if (!main) return;
    updateRibbon(main);

    const branching = main.phase === "branch" || main.phase === "arrived";
    const showAll = cfg.compare && branching;
    trucks.slice(0, 4).forEach((t, i) => {
      const f = fr.all[i];
      const visible = f ? (showAll ? true : i === selIdx) : false;
      t.group.visible = visible;
      if (!visible || !f) return;
      t.group.position.set(f.truck.x, 0, f.truck.z);
      t.group.rotation.y = -f.truck.heading;
      const band: Band = f.temperatureState === "observed" ? f.band : "unknown";
      t.reeferMat.color.copy(pal.band[band]);
      const op = i === selIdx ? 1 : 0.55;
      t.reeferMat.opacity = op;
      t.bodyMat.opacity = op;
      t.ring.visible = f.dwelling;
    });

    // Branch overlays emphasise the four ways out from the decision point.
    overlays.forEach((o, i) => {
      const m = o.material as THREE.MeshBasicMaterial;
      m.opacity =
        main.phase === "journey"
          ? 0
          : main.phase === "decision"
            ? i === selIdx
              ? 0.9
              : 0.5
            : i === selIdx || showAll
              ? 0.7
              : 0.14;
    });
    barriers.forEach((b, i) => {
      const f = fr.all[i];
      b.visible = !!f && f.blockedAtBarrier && (showAll || i === selIdx);
    });

    // What-if ghost: previous result fades over ~1 s at the selected destination.
    const gt = trucks[4];
    const age = performance.now() - ghostStart;
    if (age < ANIM_MS && branching && !cfg.reducedMotion) {
      const fade = 0.4 * (1 - age / ANIM_MS);
      const dest = NODES[main.destination];
      gt.group.visible = true;
      gt.group.position.set(dest.x - 0.2, 0, dest.z + 0.9);
      gt.group.rotation.y = -main.truck.heading;
      gt.reeferMat.color.copy(pal.unknown);
      gt.reeferMat.opacity = fade;
      gt.bodyMat.opacity = fade;
    } else gt.group.visible = false;

    // Markers
    const m = markers;
    if (m.gap) {
      let shown = -1;
      cfg.gaps.forEach((_, i) => {
        if (gapPlanes[i]?.mesh.visible) shown = i;
      });
      const g = shown >= 0 ? cfg.gaps[shown] : undefined;
      m.gap.el.className = "network-marker gap-label";
      if (g) {
        const mid = (g.fromMin + g.untilMin) / 2 / cfg.journeyEnd;
        m.gap.point.set(O.x + (D.x - O.x) * mid, 2.7, RIB_Z);
        m.gap.el.textContent = `${cfg.labels.gap} ${g.label}`;
      }
      m.gap.el.dataset.on = g ? "1" : "0";
    }
    for (let i = 0; i < 4; i++) {
      const mk = m[`truck${i}`];
      const f = fr.all[i];
      if (!mk || !f) continue;
      const on = showAll;
      mk.el.dataset.on = on ? "1" : "0";
      // Trucks that share a spot (all four at the decision point) stack their tags.
      let stack = 0;
      for (let j = 0; j < i; j++) {
        const o = fr.all[j];
        if (o && Math.hypot(o.truck.x - f.truck.x, o.truck.z - f.truck.z) < 1.6)
          stack += 1;
      }
      mk.point.set(f.truck.x, 3.1 + stack * 0.62, f.truck.z);
      mk.el.className =
        "network-marker truck-tag" + (i === selIdx ? " is-selected" : "");
      // Each route shows its own delay clock and running total.
      const parts = [
        String(i + 1),
        f.costTicker === null
          ? "–"
          : `${formatAmount(f.costTicker)} ${cfg.labels.currency}`,
        f.delayMinutes === null ? "–" : `${f.delayMinutes} ${cfg.labels.unit}`,
      ];
      mk.el.textContent = f.blockedAtBarrier
        ? `${i + 1} × ${cfg.labels.blocked}`
        : parts.join(" · ");
    }
  }

  function desiredCamera(): { zoom: number; cx: number; cz: number } {
    const f =
      frames?.all[Math.max(0, cfg?.scenarios.indexOf(cfg.selected) ?? 0)];
    if (!cfg || !f) return { zoom: 1, cx: 0.2, cz: 1 };
    if (cfg.camera === "follow")
      return { zoom: 2.4, cx: f.truck.x, cz: f.truck.z };
    if (f.phase === "journey")
      return {
        zoom: 1.2,
        cx: Math.max(-4, Math.min(1, f.truck.x * 0.5 - 0.5)),
        cz: 0.2,
      };
    return { zoom: 1, cx: 0.2, cz: 1.0 };
  }

  function placeCamera(w: number, h: number) {
    const aspect = w / Math.max(1, h);
    const base = Math.max(7.5, (aspect < 1.4 ? 10.4 : 12.4) / aspect);
    const half = base / cam.zoom;
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    const dir = new THREE.Vector3(
      Math.sin(ISO_YAW) * Math.cos(ISO_ELEV),
      Math.sin(ISO_ELEV),
      Math.cos(ISO_YAW) * Math.cos(ISO_ELEV),
    );
    camera.position.set(cam.cx, 0, cam.cz).addScaledVector(dir, 40);
    camera.lookAt(cam.cx, 0, cam.cz);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  let size = { w: 0, h: 0 };
  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === size.w && h === size.h) return;
    size = { w, h };
    renderer.setSize(w, h);
  }

  const proj = new THREE.Vector3();
  function draw(now: number) {
    raf = 0;
    if (disposed || !world) return;
    const t0 = performance.now();
    resize();
    if (size.w < 2 || size.h < 2) return;
    const dt = lastDraw ? Math.min(0.1, (now - lastDraw) / 1000) : 0.016;
    lastDraw = now;

    const want = desiredCamera();
    let moving = false;
    if (cam.snap || cfg?.reducedMotion) {
      Object.assign(cam, want, { snap: false });
    } else {
      const k = 1 - Math.exp(-dt * 4.5);
      for (const key of ["zoom", "cx", "cz"] as const) {
        const d = want[key] - cam[key];
        if (Math.abs(d) > 0.003) {
          cam[key] += d * k;
          moving = true;
        } else cam[key] = want[key];
      }
    }
    applyFrames();
    placeCamera(size.w, size.h);
    renderer.render(scene, camera);

    // HTML markers follow their 3D anchors, clamped inside the canvas and kept
    // clear of the HUD cards and controls (anything marked data-keepout).
    const hostBox = host.getBoundingClientRect();
    const keep = Array.from(
      host.parentElement?.querySelectorAll<HTMLElement>("[data-keepout]") ?? [],
    )
      .map((k) => k.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        l: r.left - hostBox.left,
        r: r.right - hostBox.left,
        t: r.top - hostBox.top,
        b: r.bottom - hostBox.top,
      }));
    for (const m of Object.values(markers)) {
      proj.copy(m.point).project(camera);
      const hw = m.el.offsetWidth / 2 + 4;
      const hh = m.el.offsetHeight / 2 + 4;
      const x = Math.min(
        size.w - hw,
        Math.max(hw, (proj.x * 0.5 + 0.5) * size.w),
      );
      let y = Math.min(
        size.h - hh,
        Math.max(hh, (-proj.y * 0.5 + 0.5) * size.h),
      );
      for (const k of keep) {
        if (x + hw <= k.l || x - hw >= k.r || y + hh <= k.t || y - hh >= k.b)
          continue;
        const down = k.b + hh + 2;
        const up = k.t - hh - 2;
        const canDown = down <= size.h - hh;
        const canUp = up >= hh;
        if (canDown && (!canUp || down - y <= y - up)) y = down;
        else if (canUp) y = up;
      }
      m.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
    }
    host.dataset.drawCalls = String(renderer.info.render.calls);
    host.dataset.triangles = String(renderer.info.render.triangles);
    host.dataset.renderMs = String(Math.round(performance.now() - t0));

    const fading = performance.now() - ghostStart < ANIM_MS;
    if (moving || fading) requestFrame();
    else lastDraw = 0;
  }

  function requestFrame() {
    if (raf || disposed || !onScreen || document.hidden) return;
    raf = requestAnimationFrame(draw);
  }

  // Test hooks: the render loop is paused while offscreen or in a hidden tab.
  const syncState = () => {
    host.dataset.paused = String(!onScreen || document.hidden);
  };
  const io = new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    syncState();
    if (onScreen) requestFrame();
    else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });
  io.observe(host);
  const ro = new ResizeObserver(() => requestFrame());
  ro.observe(host);
  const onVisibility = () => {
    syncState();
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else requestFrame();
  };
  document.addEventListener("visibilitychange", onVisibility);

  buildWorld();
  host.dataset.dpr = String(renderer.getPixelRatio());
  syncState();
  host.dataset.initMs = String(Math.round(performance.now() - startedAt));

  return {
    setConfig(c) {
      const sig = JSON.stringify([
        c.readings,
        c.selected,
        c.acceptance,
        c.blocked,
        c.labels,
        c.compare,
        c.camera,
        c.reducedMotion,
        c.hasTrace,
      ]);
      const cameraChanged = !cfg || cfg.camera !== c.camera;
      cfg = c;
      if (cameraChanged && c.reducedMotion) cam.snap = true;
      if (sig === lastSig) return;
      lastSig = sig;
      applyLabels();
    },
    setFrames(f) {
      frames = f;
      requestFrame();
    },
    pulseGhost() {
      ghostStart = performance.now();
      requestFrame();
    },
    refreshTheme() {
      lastSig = "";
      buildWorld();
      applyLabels();
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      disposeWorld();
      markerLayer?.remove();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
