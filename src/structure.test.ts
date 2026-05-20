import { describe, expect, it } from "vitest";
import { defaultConfig } from "./materials.ts";
import { buildBom, computeScreenSide } from "./structure.ts";

describe("computeScreenSide", () => {
  it("respects the screenRatio when bezel permits", () => {
    const cfg = defaultConfig();
    cfg.frontWidthM = 2.0;
    cfg.frontHeightM = 2.0;
    cfg.bezelMinM = 0.05;
    cfg.screenRatio = 0.5;
    expect(computeScreenSide(cfg)).toBeCloseTo(1.0, 6);
  });

  it("clamps to the bezel-enforced maximum", () => {
    const cfg = defaultConfig();
    cfg.frontWidthM = 2.0;
    cfg.frontHeightM = 2.0;
    cfg.bezelMinM = 0.2;
    cfg.screenRatio = 0.99; // would want 1.98m but bezel caps it
    expect(computeScreenSide(cfg)).toBeCloseTo(1.6, 6);
  });

  it("scales with the uniform scale factor", () => {
    const cfg = defaultConfig();
    cfg.scale = 2;
    const doubled = computeScreenSide(cfg);
    cfg.scale = 1;
    const base = computeScreenSide(cfg);
    expect(doubled).toBeCloseTo(base * 2, 6);
  });
});

describe("buildBom", () => {
  it("emits the expected count of structural frame pieces", () => {
    const cfg = defaultConfig();
    const bom = buildBom(cfg);
    // 4 front + 4 rear + 4 struts + 4 screen surround = 16 shell pieces.
    // Base and Mount contribute their own pieces when enabled.
    const shellPieces = bom.frame.filter(
      (p) => !p.name.startsWith("Base") && !p.name.startsWith("Mount"),
    ).length;
    expect(shellPieces).toBe(16);
  });

  it("produces frame board lengths matching the configured dimensions", () => {
    const cfg = defaultConfig();
    cfg.scale = 1;
    cfg.variant = "flat";
    cfg.tiltDeg = 0;
    const bom = buildBom(cfg);
    const bottom = bom.frame.find((p) => p.name === "Front bottom rail")!;
    const left = bom.frame.find((p) => p.name === "Front left stud")!;
    expect(bottom.lengthM).toBeCloseTo(cfg.frontWidthM, 6);
    expect(left.lengthM).toBeCloseTo(cfg.frontHeightM, 6);
  });

  it("omits base pieces when includeBase is false", () => {
    const cfg = defaultConfig();
    cfg.includeBase = false;
    const bom = buildBom(cfg);
    expect(bom.frame.some((p) => p.name.startsWith("Base"))).toBe(false);
  });

  it("omits the rear and floor panels when toggles are off", () => {
    const cfg = defaultConfig();
    cfg.includeRearPanel = false;
    cfg.includeFloorPanel = false;
    const bom = buildBom(cfg);
    expect(bom.cladding.some((p) => p.name === "Rear panel")).toBe(false);
    expect(bom.cladding.some((p) => p.name === "Bottom panel")).toBe(false);
  });

  it("keeps shell + base frame lengths invariant under pure tilt", () => {
    // Mount pieces conform to the tilted body bottom plane, so their lengths
    // change with tilt. Everything else (shell edges, base joists) is rigid
    // under rotation.
    const cfg = defaultConfig();
    cfg.tiltDeg = 0;
    const flat = buildBom(cfg).frame.filter((p) => !p.name.startsWith("Mount"));
    cfg.tiltDeg = 20;
    const tilted = buildBom(cfg).frame.filter((p) => !p.name.startsWith("Mount"));
    expect(tilted.length).toBe(flat.length);
    for (let i = 0; i < flat.length; i++) {
      expect(tilted[i].lengthM).toBeCloseTo(flat[i].lengthM, 6);
    }
  });

  it("mount box height equals mountHeightM and the body rests on the box top", () => {
    const cfg = defaultConfig();
    cfg.variant = "tilted";
    cfg.tiltDeg = 25;
    cfg.includeMount = true;
    const bom = buildBom(cfg);
    const topRails = bom.frame.filter((p) => p.name.startsWith("Mount top"));
    expect(topRails.length).toBe(4);
    for (const rail of topRails) {
      expect(rail.start[1]).toBeCloseTo(cfg.mountHeightM, 6);
      expect(rail.end[1]).toBeCloseTo(cfg.mountHeightM, 6);
    }
    // The body's lowest bottom corner rests exactly on the box top.
    const { corners } = bom;
    const minBottomY = Math.min(corners.fbl[1], corners.fbr[1], corners.rbl[1], corners.rbr[1]);
    expect(minBottomY).toBeCloseTo(cfg.mountHeightM, 6);
  });

  it("front and back box widths are independent and centred on x = 0", () => {
    const cfg = defaultConfig();
    cfg.includeMount = true;
    cfg.mountFrontWidthM = 2.2;
    cfg.mountBackWidthM = 1.0;
    const bom = buildBom(cfg);
    const front = bom.frame.find((p) => p.name === "Mount sill front")!;
    const rear = bom.frame.find((p) => p.name === "Mount sill rear")!;
    expect(Math.abs(front.start[0] - front.end[0])).toBeCloseTo(2.2, 6);
    expect(Math.abs(rear.start[0] - rear.end[0])).toBeCloseTo(1.0, 6);
    // Centred: the two x-coords of each rail are mirror images.
    expect(front.start[0]).toBeCloseTo(-front.end[0], 6);
    expect(rear.start[0]).toBeCloseTo(-rear.end[0], 6);
  });

  it("all four support poles are vertical and cap on the body top plane", () => {
    const cfg = defaultConfig();
    cfg.variant = "tilted";
    cfg.tiltDeg = 20;
    cfg.includeMount = true;
    const bom = buildBom(cfg);
    const { ftl, ftr, rtl } = bom.corners;
    const sub = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const cross = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const nTop = cross(sub(ftr, ftl), sub(rtl, ftl));
    const posts = bom.frame.filter((p) => p.name.startsWith("Mount support"));
    expect(posts.length).toBe(4);
    for (const post of posts) {
      const top = post.start[1] > post.end[1] ? post.start : post.end;
      const bottom = post.start[1] > post.end[1] ? post.end : post.start;
      // Vertical: x and z constant.
      expect(top[0]).toBeCloseTo(bottom[0], 6);
      expect(top[2]).toBeCloseTo(bottom[2], 6);
      // Runs from the ground up to the body top plane.
      expect(bottom[1]).toBeCloseTo(0, 6);
      const dot = nTop[0] * (top[0] - ftl[0]) + nTop[1] * (top[1] - ftl[1]) + nTop[2] * (top[2] - ftl[2]);
      expect(Math.abs(dot)).toBeLessThan(1e-6);
    }
  });

  it("respects hiddenPanels — listed panels are flagged and excluded from pricing", () => {
    const cfg = defaultConfig();
    cfg.hiddenPanels = ["Top panel", "Mount front panel"];
    const bom = buildBom(cfg);
    const top = bom.cladding.find((p) => p.name === "Top panel");
    const mountFront = bom.cladding.find((p) => p.name === "Mount front panel");
    expect(top?.hidden).toBe(true);
    expect(mountFront?.hidden).toBe(true);
    const left = bom.cladding.find((p) => p.name === "Left panel");
    expect(left?.hidden).toBeFalsy();
  });

  it("front-bottom edge sits on the ground when no mount and no tilt", () => {
    const cfg = defaultConfig();
    cfg.variant = "flat";
    cfg.tiltDeg = 0;
    cfg.includeMount = false;
    const { corners } = buildBom(cfg);
    expect(corners.fbl[1]).toBeCloseTo(0, 6);
    expect(corners.fbr[1]).toBeCloseTo(0, 6);
  });

  it("tilts backward so the top of the front face moves toward -Z", () => {
    const cfg = defaultConfig();
    cfg.variant = "tilted";
    cfg.tiltDeg = 20;
    cfg.includeMount = false;
    const { corners } = buildBom(cfg);
    // Top-front corner (initially at z=0) should rotate to negative Z when the
    // shell tilts backward away from the viewer.
    expect(corners.ftl[2]).toBeLessThan(-0.1);
    expect(corners.ftr[2]).toBeLessThan(-0.1);
  });

  it("tilt applies even when variant is flat (slider is the source of truth)", () => {
    const cfg = defaultConfig();
    cfg.variant = "flat";
    cfg.tiltDeg = 15;
    cfg.includeMount = false;
    const { corners } = buildBom(cfg);
    expect(corners.ftl[2]).toBeLessThan(-0.1);
  });

  it("every mount sill rail sits flat on the ground", () => {
    const cfg = defaultConfig();
    cfg.variant = "tilted";
    cfg.tiltDeg = 18;
    cfg.includeMount = true;
    const sill = buildBom(cfg).frame.filter((p) => p.name.startsWith("Mount sill"));
    expect(sill.length).toBe(4);
    for (const rail of sill) {
      expect(rail.start[1]).toBeCloseTo(0, 6);
      expect(rail.end[1]).toBeCloseTo(0, 6);
    }
  });
});
