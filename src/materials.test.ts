import { describe, expect, it } from "vitest";
import { defaultConfig, findBoard, findSheet } from "./materials.ts";

describe("findBoard", () => {
  it("returns the board with the matching id", () => {
    const b = findBoard("pine_38x76");
    expect(b.id).toBe("pine_38x76");
    expect(b.thicknessMm).toBe(38);
    expect(b.widthMm).toBe(76);
  });

  it("throws on unknown id", () => {
    expect(() => findBoard("not_a_board")).toThrow(/Unknown board id/);
  });
});

describe("findSheet", () => {
  it("returns the sheet with the matching id", () => {
    const s = findSheet("shutter_12");
    expect(s.id).toBe("shutter_12");
    expect(s.lengthMm).toBe(2440);
    expect(s.widthMm).toBe(1220);
  });

  it("throws on unknown id", () => {
    expect(() => findSheet("not_a_sheet")).toThrow(/Unknown sheet id/);
  });
});

describe("defaultConfig", () => {
  it("returns a fresh object each call (callers may mutate)", () => {
    const a = defaultConfig();
    const b = defaultConfig();
    expect(a).not.toBe(b);
    a.frontWidthM = 99;
    expect(b.frontWidthM).not.toBe(99);
  });

  it("references valid material ids", () => {
    const cfg = defaultConfig();
    expect(() => findBoard(cfg.frameBoardId)).not.toThrow();
    expect(() => findBoard(cfg.screenSurroundBoardId)).not.toThrow();
    expect(() => findBoard(cfg.baseBoardId)).not.toThrow();
    expect(() => findSheet(cfg.claddingMaterialId)).not.toThrow();
    expect(() => findSheet(cfg.fasciaMaterialId)).not.toThrow();
  });
});
