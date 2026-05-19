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
    // Base contributes 4 perimeter rails + N joists when includeBase = true.
    const shellPieces = bom.frame.filter((p) => !p.name.startsWith("Base")).length;
    expect(shellPieces).toBe(16);
  });

  it("produces frame board lengths matching the configured dimensions", () => {
    const cfg = defaultConfig();
    cfg.scale = 1;
    cfg.variant = "flat";
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
    cfg.variant = "flat";
    const flat = buildBom(cfg);
    cfg.variant = "tilted";
    cfg.tiltDeg = 20;
    const tilted = buildBom(cfg);
    for (let i = 0; i < flat.frame.length; i++) {
      expect(tilted.frame[i].lengthM).toBeCloseTo(flat.frame[i].lengthM, 6);
    }
  });

  it("front-bottom edge sits on the ground at y = 0", () => {
    const cfg = defaultConfig();
    cfg.variant = "tilted";
    cfg.tiltDeg = 25;
    const { corners } = buildBom(cfg);
    expect(corners.fbl[1]).toBeCloseTo(0, 6);
    expect(corners.fbr[1]).toBeCloseTo(0, 6);
  });
});
