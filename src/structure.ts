import type { Bom, CladdingPanel, Config, FrameBoard } from "./types.ts";

type V3 = [number, number, number];

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Rotate a point around the X axis (through origin) by `rad` radians. */
function rotX(p: V3, rad: number): V3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}

/** Polygon area via Newell's formula in 3D. */
function polygonArea3D(poly: V3[]): number {
  let n: V3 = [0, 0, 0];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    n = add(n, [
      (a[1] - b[1]) * (a[2] + b[2]),
      (a[2] - b[2]) * (a[0] + b[0]),
      (a[0] - b[0]) * (a[1] + b[1]),
    ]);
  }
  return 0.5 * len(n);
}

/** Effective dimensions (after uniform scale). */
function dims(cfg: Config) {
  const k = cfg.scale;
  return {
    fW: cfg.frontWidthM * k,
    fH: cfg.frontHeightM * k,
    rW: cfg.rearWidthM * k,
    rH: cfg.rearHeightM * k,
    d: cfg.depthM * k,
    bezelMin: cfg.bezelMinM * k,
  };
}

export function computeScreenSide(cfg: Config): number {
  const { fW, fH, bezelMin } = dims(cfg);
  const maxSide = Math.max(0.05, Math.min(fW, fH) - 2 * bezelMin);
  const desired = Math.min(fW, fH) * cfg.screenRatio;
  return Math.max(0.05, Math.min(maxSide, desired));
}

/**
 * Build the geometry + BOM (frame board pieces and cladding panels) for the
 * current configuration. All coordinates are in metres, world space.
 *
 * Coordinate system:
 *  - +X right (across the front face)
 *  - +Y up
 *  - +Z forward (towards the viewer, away from the screen)
 *  - Front face lives on the Z = 0 plane (untilted), bottom-front edge on the ground
 *  - The body tapers backward (rear face is in -Z)
 */
export function buildBom(cfg: Config): Bom {
  const { fW, fH, rW, rH, d } = dims(cfg);

  // Front face corners on Z=0; rear face centred behind, offset to (-d in Z).
  // Vertically centre the rear face on the front face (real CRT silhouette).
  const yC = fH / 2;
  let fbl: V3 = [-fW / 2, 0, 0];
  let fbr: V3 = [+fW / 2, 0, 0];
  let ftl: V3 = [-fW / 2, fH, 0];
  let ftr: V3 = [+fW / 2, fH, 0];
  let rbl: V3 = [-rW / 2, yC - rH / 2, -d];
  let rbr: V3 = [+rW / 2, yC - rH / 2, -d];
  let rtl: V3 = [-rW / 2, yC + rH / 2, -d];
  let rtr: V3 = [+rW / 2, yC + rH / 2, -d];

  // Tilt: rotate the whole shell backward around the front-bottom edge (X axis,
  // y = 0, z = 0). Positive tiltDeg leans the top of the screen AWAY from the
  // viewer (toward -Z), like a CRT angled up for someone sitting in front of it.
  // Applies whenever tiltDeg != 0 — `variant` is just a UI preset that flips
  // the slider between 0 and a default.
  if (cfg.tiltDeg !== 0) {
    const rad = (cfg.tiltDeg * Math.PI) / 180;
    [fbl, fbr, ftl, ftr, rbl, rbr, rtl, rtr] = [fbl, fbr, ftl, ftr, rbl, rbr, rtl, rtr].map((p) => rotX(p, -rad)) as [V3, V3, V3, V3, V3, V3, V3, V3];
  }

  // Mount pedestal: a rectangular box on the ground that rises up to the body.
  // The mount TOP follows the body's (planar) bottom face so the pedestal stays
  // in contact with the body everywhere within its footprint — no gap, even
  // when the body is tilted backward. `mountHeightM` sets the height of the
  // lowest mount post (the body is lifted so that the lowest mount-top corner
  // sits at exactly mountHeightM above the ground).
  const mountInset = Math.max(0, cfg.mountInsetM);
  const mountW = Math.max(0.2, Math.min(fW, rW) - 2 * mountInset);
  const mountD = Math.max(0.2, d - 2 * mountInset);
  const mountCz = -d / 2;
  if (cfg.includeMount && cfg.mountHeightM > 0) {
    // Body bottom plane normal from three of the bottom corners (all 4 are
    // coplanar). Solve for y on the plane at arbitrary (x, z).
    const nB = cross(sub(fbr, fbl), sub(rbl, fbl));
    const planeY = (x: number, z: number): number => {
      if (Math.abs(nB[1]) < 1e-9) return fbl[1];
      return fbl[1] - (nB[0] * (x - fbl[0]) + nB[2] * (z - fbl[2])) / nB[1];
    };
    const xL = -mountW / 2;
    const xR = +mountW / 2;
    const zF = mountCz + mountD / 2;
    const zR = mountCz - mountD / 2;
    const minTop = Math.min(planeY(xL, zF), planeY(xR, zF), planeY(xL, zR), planeY(xR, zR));
    const lift = cfg.mountHeightM - minTop;
    if (lift !== 0) {
      const dy: V3 = [0, lift, 0];
      [fbl, fbr, ftl, ftr, rbl, rbr, rtl, rtr] = [fbl, fbr, ftl, ftr, rbl, rbr, rtl, rtr].map((p) => add(p, dy)) as [V3, V3, V3, V3, V3, V3, V3, V3];
    }
  }

  const frame: FrameBoard[] = [];
  const push = (name: string, boardId: string, a: V3, b: V3) =>
    frame.push({ name, boardId, lengthM: len(sub(b, a)), start: a, end: b });

  // 4 front-face edges
  push("Front bottom rail", cfg.frameBoardId, fbl, fbr);
  push("Front top rail", cfg.frameBoardId, ftl, ftr);
  push("Front left stud", cfg.frameBoardId, fbl, ftl);
  push("Front right stud", cfg.frameBoardId, fbr, ftr);

  // 4 rear-face edges
  push("Rear bottom rail", cfg.frameBoardId, rbl, rbr);
  push("Rear top rail", cfg.frameBoardId, rtl, rtr);
  push("Rear left stud", cfg.frameBoardId, rbl, rtl);
  push("Rear right stud", cfg.frameBoardId, rbr, rtr);

  // 4 edge struts (front corner → matching rear corner)
  push("Edge strut BL", cfg.frameBoardId, fbl, rbl);
  push("Edge strut BR", cfg.frameBoardId, fbr, rbr);
  push("Edge strut TL", cfg.frameBoardId, ftl, rtl);
  push("Edge strut TR", cfg.frameBoardId, ftr, rtr);

  // Screen surround on the front face: 4 boards framing the square opening,
  // centred on the front rectangle.
  const screenSide = computeScreenSide(cfg);
  const frontCentre: V3 = scl(add(add(fbl, fbr), add(ftl, ftr)), 0.25);
  // Build front-face basis: u = right along bottom rail, v = up along left stud.
  const uF = norm(sub(fbr, fbl));
  const vF = norm(sub(ftl, fbl));
  const half = screenSide / 2;
  const sBL = add(add(frontCentre, scl(uF, -half)), scl(vF, -half));
  const sBR = add(add(frontCentre, scl(uF, +half)), scl(vF, -half));
  const sTL = add(add(frontCentre, scl(uF, -half)), scl(vF, +half));
  const sTR = add(add(frontCentre, scl(uF, +half)), scl(vF, +half));
  push("Screen surround bottom", cfg.screenSurroundBoardId, sBL, sBR);
  push("Screen surround top", cfg.screenSurroundBoardId, sTL, sTR);
  push("Screen surround left", cfg.screenSurroundBoardId, sBL, sTL);
  push("Screen surround right", cfg.screenSurroundBoardId, sBR, sTR);

  // Optional lounge base (sits on the ground inside the shell, NOT tilted).
  if (cfg.includeBase) {
    // Footprint = projection of rear face onto the ground, extended forward to
    // the front-bottom edge. Keep it level even when shell is tilted.
    const baseW = Math.min(fW, rW) * 0.95;
    const baseD = d * 0.9;
    const a: V3 = [-baseW / 2, 0, 0];
    const b: V3 = [+baseW / 2, 0, 0];
    const c: V3 = [+baseW / 2, 0, -baseD];
    const e: V3 = [-baseW / 2, 0, -baseD];
    push("Base front rail", cfg.baseBoardId, a, b);
    push("Base rear rail", cfg.baseBoardId, e, c);
    push("Base left rail", cfg.baseBoardId, a, e);
    push("Base right rail", cfg.baseBoardId, b, c);
    // joists every ~0.5m
    const joistSpacing = 0.5;
    const nJoists = Math.max(1, Math.floor(baseW / joistSpacing) - 1);
    for (let i = 1; i <= nJoists; i++) {
      const x = -baseW / 2 + (i * baseW) / (nJoists + 1);
      push(`Base joist ${i}`, cfg.baseBoardId, [x, 0, 0], [x, 0, -baseD]);
    }
  }

  // Cladding panels — 6 faces of the frustum.
  const cladding: CladdingPanel[] = [];
  const addPanel = (
    name: string,
    poly: V3[],
    materialId: string,
    hole?: { center: V3; uAxis: V3; vAxis: V3; sideM: number },
    billedAreaOverride?: number,
  ) => {
    const area = polygonArea3D(poly);
    const e1 = sub(poly[1], poly[0]);
    const e2 = sub(poly[poly.length - 1], poly[0]);
    const n = norm(cross(e1, e2));
    cladding.push({
      name,
      materialId,
      poly,
      normal: n,
      hole,
      areaM2: area,
      billedAreaM2: billedAreaOverride ?? area,
    });
  };

  // Front panel — rectangle with a square hole; cut-out can't usually be
  // reused, so we bill the full rectangle area.
  const frontPoly: V3[] = [fbl, fbr, ftr, ftl];
  const frontArea = polygonArea3D(frontPoly);
  addPanel(
    "Front panel (screen surround)",
    frontPoly,
    cfg.claddingMaterialId,
    { center: frontCentre, uAxis: uF, vAxis: vF, sideM: screenSide },
    frontArea,
  );

  if (cfg.includeRearPanel) {
    // CCW viewed from outside (behind), giving an outward (-Z-ish) normal.
    addPanel("Rear panel", [rbr, rbl, rtl, rtr], cfg.claddingMaterialId);
  }
  addPanel("Top panel", [ftl, ftr, rtr, rtl], cfg.claddingMaterialId);
  if (cfg.includeFloorPanel) {
    addPanel("Bottom panel", [fbl, rbl, rbr, fbr], cfg.claddingMaterialId);
  }
  addPanel("Left panel", [fbl, ftl, rtl, rbl], cfg.claddingMaterialId);
  addPanel("Right panel", [fbr, rbr, rtr, ftr], cfg.claddingMaterialId);

  // Fascia (decorative thick board on the front bezel ring) — counted as
  // additional sheet area equal to the front-panel bezel area, in a heavier
  // sheet stock.
  if (cfg.includeFascia) {
    const bezelArea = Math.max(0, frontArea - screenSide * screenSide);
    cladding.push({
      name: "Front fascia (bezel)",
      materialId: cfg.fasciaMaterialId,
      poly: frontPoly,
      normal: norm(cross(sub(fbr, fbl), sub(ftl, fbl))),
      hole: { center: frontCentre, uAxis: uF, vAxis: vF, sideM: screenSide },
      areaM2: bezelArea,
      billedAreaM2: bezelArea,
    });
  }

  // Mount pedestal — rectangular footprint on the ground. The four corner
  // posts continue all the way up to the body's top plane so they act as full-
  // height structural columns (CRT body braced corner-to-corner). The mount
  // CLADDING terminates at the body-bottom plane via "shoulder" rails — that
  // boundary is where the pedestal stops being visible from outside.
  if (cfg.includeMount && cfg.mountHeightM > 0) {
    const nB = cross(sub(fbr, fbl), sub(rbl, fbl));
    const nT = cross(sub(ftr, ftl), sub(rtl, ftl));
    const planeY = (n: V3, ref: V3) => (x: number, z: number): number => {
      if (Math.abs(n[1]) < 1e-9) return ref[1];
      return ref[1] - (n[0] * (x - ref[0]) + n[2] * (z - ref[2])) / n[1];
    };
    const bottomY = planeY(nB, fbl);
    const topY = planeY(nT, ftl);
    const xL = -mountW / 2;
    const xR = +mountW / 2;
    const zF = mountCz + mountD / 2;
    const zR = mountCz - mountD / 2;

    const mbl: V3 = [xL, 0, zF];
    const mbr: V3 = [xR, 0, zF];
    const mkl: V3 = [xL, 0, zR];
    const mkr: V3 = [xR, 0, zR];
    const mtl: V3 = [xL, bottomY(xL, zF), zF];
    const mtr: V3 = [xR, bottomY(xR, zF), zF];
    const mTkl: V3 = [xL, bottomY(xL, zR), zR];
    const mTkr: V3 = [xR, bottomY(xR, zR), zR];
    const mRoofFL: V3 = [xL, topY(xL, zF), zF];
    const mRoofFR: V3 = [xR, topY(xR, zF), zF];
    const mRoofRL: V3 = [xL, topY(xL, zR), zR];
    const mRoofRR: V3 = [xR, topY(xR, zR), zR];

    // Full-height corner posts (ground → body top)
    push("Mount post FL", cfg.frameBoardId, mbl, mRoofFL);
    push("Mount post FR", cfg.frameBoardId, mbr, mRoofFR);
    push("Mount post RL", cfg.frameBoardId, mkl, mRoofRL);
    push("Mount post RR", cfg.frameBoardId, mkr, mRoofRR);
    // Shoulder rails — at the body-bottom plane, where the pedestal cladding
    // terminates against the body.
    push("Mount shoulder front", cfg.frameBoardId, mtl, mtr);
    push("Mount shoulder rear", cfg.frameBoardId, mTkl, mTkr);
    push("Mount shoulder left", cfg.frameBoardId, mtl, mTkl);
    push("Mount shoulder right", cfg.frameBoardId, mtr, mTkr);
    // Sill rails on the ground
    push("Mount sill front", cfg.frameBoardId, mbl, mbr);
    push("Mount sill rear", cfg.frameBoardId, mkl, mkr);
    push("Mount sill left", cfg.frameBoardId, mbl, mkl);
    push("Mount sill right", cfg.frameBoardId, mbr, mkr);

    addPanel("Mount front panel", [mbl, mbr, mtr, mtl], cfg.claddingMaterialId);
    addPanel("Mount rear panel", [mkr, mkl, mTkl, mTkr], cfg.claddingMaterialId);
    addPanel("Mount left panel", [mkl, mbl, mtl, mTkl], cfg.claddingMaterialId);
    addPanel("Mount right panel", [mbr, mkr, mTkr, mtr], cfg.claddingMaterialId);
  }

  if (cfg.hiddenPanels && cfg.hiddenPanels.length > 0) {
    for (const panel of cladding) {
      if (cfg.hiddenPanels.includes(panel.name)) panel.hidden = true;
    }
  }

  return {
    frame,
    cladding,
    screenSideM: screenSide,
    corners: { fbl, fbr, ftl, ftr, rbl, rbr, rtl, rtr },
  };
}
