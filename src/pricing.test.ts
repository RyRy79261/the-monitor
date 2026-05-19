import { describe, expect, it } from "vitest";
import { defaultConfig } from "./materials.ts";
import { fmtZar, priceBom } from "./pricing.ts";
import { buildBom } from "./structure.ts";

describe("priceBom", () => {
  it("totals the line subtotals", () => {
    const cfg = defaultConfig();
    const bom = buildBom(cfg);
    const cost = priceBom(bom, cfg);
    const sum = cost.lines.reduce((s, l) => s + l.subtotalZar, 0);
    expect(cost.totalZar).toBeCloseTo(sum, 6);
  });

  it("applies loading percentages on materials subtotal", () => {
    const cfg = defaultConfig();
    cfg.fastenersPct = 10;
    cfg.finishPct = 5;
    cfg.labourPct = 0;
    const bom = buildBom(cfg);
    const cost = priceBom(bom, cfg);
    expect(cost.fastenersZar).toBeCloseTo(cost.materialsZar * 0.1, 6);
    expect(cost.finishZar).toBeCloseTo(cost.materialsZar * 0.05, 6);
    expect(cost.labourZar).toBe(0);
  });

  it("skips loading lines when their percentage is zero", () => {
    const cfg = defaultConfig();
    cfg.fastenersPct = 0;
    cfg.finishPct = 0;
    cfg.labourPct = 0;
    const bom = buildBom(cfg);
    const cost = priceBom(bom, cfg);
    expect(cost.lines.some((l) => l.group === "Extras")).toBe(false);
  });

  it("scales materials cost up with waste %", () => {
    const cfg = defaultConfig();
    cfg.wastePct = 0;
    const noWaste = priceBom(buildBom(cfg), cfg);
    cfg.wastePct = 50;
    const heavy = priceBom(buildBom(cfg), cfg);
    expect(heavy.materialsZar).toBeGreaterThan(noWaste.materialsZar);
  });
});

describe("fmtZar", () => {
  it("prefixes ZAR and rounds to whole rands", () => {
    expect(fmtZar(1234.7)).toMatch(/^R\s/);
    expect(fmtZar(1234.7)).not.toContain(".");
  });

  it("formats zero", () => {
    expect(fmtZar(0)).toMatch(/^R\s*0$/);
  });
});
