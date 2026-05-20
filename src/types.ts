export type Variant = "flat" | "tilted";

export interface BoardSize {
  id: string;
  label: string;
  thicknessMm: number;
  widthMm: number;
  pricePerMetreZar: number;
}

export interface SheetMaterial {
  id: string;
  label: string;
  thicknessMm: number;
  widthMm: number;
  lengthMm: number;
  pricePerSheetZar: number;
}

export interface Config {
  variant: Variant;
  tiltDeg: number;

  scale: number;
  frontWidthM: number;
  frontHeightM: number;
  rearWidthM: number;
  rearHeightM: number;
  depthM: number;
  screenRatio: number;
  bezelMinM: number;

  frameBoardId: string;
  screenSurroundBoardId: string;
  baseBoardId: string;
  claddingMaterialId: string;
  fasciaMaterialId: string;

  includeBase: boolean;
  includeFascia: boolean;
  includeRearPanel: boolean;
  includeFloorPanel: boolean;
  includeMount: boolean;
  /** Height of the mount box (ground to box top). */
  mountHeightM: number;
  /** Width of the mount box at its front edge. */
  mountFrontWidthM: number;
  /** Width of the mount box at its back edge. */
  mountBackWidthM: number;

  humanShown: boolean;
  humanHeightM: number;

  /** Names of cladding panels to hide from render and BoM. */
  hiddenPanels: string[];

  wastePct: number;
  fastenersPct: number;
  finishPct: number;
  labourPct: number;

  stockBoardLengthsM: number[];
}

export interface FrameBoard {
  name: string;
  boardId: string;
  lengthM: number;
  start: [number, number, number];
  end: [number, number, number];
}

export interface CladdingPanel {
  name: string;
  materialId: string;
  /** Polygon vertices in world space (CCW when viewed from `normal`). */
  poly: [number, number, number][];
  /** Outward normal, for visual orientation. */
  normal: [number, number, number];
  /** Square hole (world space center) for the screen on the front panel. */
  hole?: { center: [number, number, number]; uAxis: [number, number, number]; vAxis: [number, number, number]; sideM: number };
  areaM2: number;
  /** Area used for cost (full bounding rect on front panel; equals areaM2 elsewhere). */
  billedAreaM2: number;
  /** Hidden panels are kept in the BoM listing so the UI can offer a visibility
   *  toggle, but they are excluded from render and pricing. */
  hidden?: boolean;
}

export interface Bom {
  frame: FrameBoard[];
  cladding: CladdingPanel[];
  screenSideM: number;
  corners: { fbl: [number, number, number]; fbr: [number, number, number]; ftl: [number, number, number]; ftr: [number, number, number]; rbl: [number, number, number]; rbr: [number, number, number]; rtl: [number, number, number]; rtr: [number, number, number] };
}

export interface CostLine {
  group: "Frame" | "Cladding" | "Fascia" | "Base" | "Extras";
  label: string;
  qty: number;
  unit: string;
  unitPriceZar: number;
  subtotalZar: number;
  note?: string;
}

export interface Cost {
  lines: CostLine[];
  materialsZar: number;
  fastenersZar: number;
  finishZar: number;
  labourZar: number;
  totalZar: number;
}
