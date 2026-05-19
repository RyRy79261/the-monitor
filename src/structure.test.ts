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

  it("keeps frame piece lengths invariant under pure tilt", () => {
    const cfg = defaultConfig();
    cfg.tiltDeg = 0;
    const flat = buildBom(cfg);
    cfg.tiltDeg = 20;
    const tilted = buildBom(cfg);
    for (let i = 0; i < flat.frame.length; i++) {
      expect(tilted.frame[i].lengthM).toBeCloseTo(flat.frame[i].lengthM, 6);
    }
  });

  it("lowest body corner rests on the mount top at mountHeightM", () => {
    const cfg = defaultConfig();
    cfg.variant = "tilted";
    cfg.tiltDeg = 25;
    cfg.includeMount = true;
    const { corners } = buildBom(cfg);
    const minBottomY = Math.min(corners.fbl[1], corners.fbr[1], corners.rbl[1], corners.rbr[1]);
    expect(minBottomY).toBeCloseTo(cfg.mountHeightM, 6);
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

  it("mount footprint is smaller than the body's bottom face by the inset", () => {
    const cfg = defaultConfig();
    cfg.includeMount = true;
    cfg.mountInsetM = 0.5;
    const bom = buildBom(cfg);
    const mountPosts = bom.frame.filter((p) => p.name.startsWith("Mount post"));
    expect(mountPosts.length).toBe(4);
    // Mount X extent should be (min(fW,rW) - 2*inset) / 2 = (1.6 - 1.0) / 2 = 0.3.
    const expectedHalfW = (Math.min(cfg.frontWidthM, cfg.rearWidthM) - 2 * cfg.mountInsetM) / 2;
    const mountXs = mountPosts.flatMap((p) => [p.start[0], p.end[0]]);
    const mountMaxAbsX = Math.max(...mountXs.map(Math.abs));
    expect(mountMaxAbsX).toBeCloseTo(expectedHalfW, 6);
    // Mount posts run from ground (y=0) up to mountHeightM.
    for (const post of mountPosts) {
      const ys = [post.start[1], post.end[1]].sort((a, b) => a - b);
      expect(ys[0]).toBeCloseTo(0, 6);
      expect(ys[1]).toBeCloseTo(cfg.mountHeightM, 6);
    }
  });
});
