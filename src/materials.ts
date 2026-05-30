import type { BoardSize, SheetMaterial, Config } from "./types.ts";

/**
 * Indicative retail ZAR prices for SA pine PAR (planed all round) and sheet
 * goods at major SA hardware suppliers. Cross-checked May 2026 against MS
 * Timbers wholesale, Bob Shop, BUCO and Gumtree retail (incl. 15% VAT, with a
 * ~65% PAR premium over structural S5 where applicable). Region-dependent;
 * editable in the UI for a phoned-in local quote.
 */
export const BOARDS: BoardSize[] = [
  { id: "pine_38x38",  label: "SA pine PAR 38 × 38",  thicknessMm: 38, widthMm: 38,  pricePerMetreZar: 22 },
  { id: "pine_38x50",  label: "SA pine PAR 38 × 50",  thicknessMm: 38, widthMm: 50,  pricePerMetreZar: 29 },
  { id: "pine_38x76",  label: "SA pine PAR 38 × 76",  thicknessMm: 38, widthMm: 76,  pricePerMetreZar: 44 },
  { id: "pine_38x114", label: "SA pine PAR 38 × 114", thicknessMm: 38, widthMm: 114, pricePerMetreZar: 62 },
  { id: "pine_38x152", label: "SA pine PAR 38 × 152", thicknessMm: 38, widthMm: 152, pricePerMetreZar: 87 },
  { id: "pine_50x76",  label: "SA pine PAR 50 × 76",  thicknessMm: 50, widthMm: 76,  pricePerMetreZar: 58 },
  { id: "pine_50x152", label: "SA pine PAR 50 × 152", thicknessMm: 50, widthMm: 152, pricePerMetreZar: 116 },
];

export const SHEETS: SheetMaterial[] = [
  { id: "shutter_12", label: "Shutterply 12 mm (2440 × 1220)", thicknessMm: 12, widthMm: 1220, lengthMm: 2440, pricePerSheetZar: 500 },
  { id: "ply_9",      label: "SA pine ply 9 mm (2440 × 1220)", thicknessMm: 9,  widthMm: 1220, lengthMm: 2440, pricePerSheetZar: 640 },
  { id: "ply_12",     label: "SA pine ply 12 mm (2440 × 1220)", thicknessMm: 12, widthMm: 1220, lengthMm: 2440, pricePerSheetZar: 750 },
  { id: "ply_18",     label: "SA pine ply 18 mm (2440 × 1220)", thicknessMm: 18, widthMm: 1220, lengthMm: 2440, pricePerSheetZar: 1200 },
  { id: "osb_11",     label: "OSB 11 mm (2440 × 1220)",         thicknessMm: 11, widthMm: 1220, lengthMm: 2440, pricePerSheetZar: 510 },
  { id: "hardboard_3", label: "Hardboard 3 mm (2440 × 1220)",   thicknessMm: 3,  widthMm: 1220, lengthMm: 2440, pricePerSheetZar: 230 },
];

export function findBoard(id: string): BoardSize {
  const b = BOARDS.find((x) => x.id === id);
  if (!b) throw new Error(`Unknown board id: ${id}`);
  return b;
}

export function findSheet(id: string): SheetMaterial {
  const s = SHEETS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown sheet id: ${id}`);
  return s;
}

export function defaultConfig(): Config {
  return {
    variant: "flat",
    tiltDeg: 15,

    scale: 1.45,
    frontWidthM: 3.15,
    frontHeightM: 2.65,
    rearWidthM: 2.25,
    rearHeightM: 1.4,
    depthM: 2.6,
    screenRatio: 0.82,
    bezelMinM: 0.04,

    frameBoardId: "pine_38x76",
    screenSurroundBoardId: "pine_38x114",
    baseBoardId: "pine_38x114",
    claddingMaterialId: "shutter_12",
    fasciaMaterialId: "ply_18",

    includeBase: true,
    includeFascia: true,
    includeRearPanel: true,
    includeFloorPanel: true,
    includeMount: true,
    mountHeightM: 0.7,
    mountFrontWidthM: 2.75,
    mountBackWidthM: 1.3,

    humanShown: true,
    humanHeightM: 1.75,

    hiddenPanels: [],

    wastePct: 12,
    fastenersPct: 6,
    finishPct: 8,
    labourPct: 0,

    stockBoardLengthsM: [1.8, 2.4, 3.0, 3.6, 4.2, 4.8, 5.4, 6.0],
  };
}
