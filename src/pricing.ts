import { findBoard, findSheet } from "./materials.ts";
import type { Bom, Config, Cost, CostLine } from "./types.ts";

/** Pick the smallest stock length >= required, or the longest if none fits. */
function pickStockLength(requiredM: number, stockM: number[]): number {
  const sorted = [...stockM].sort((a, b) => a - b);
  for (const s of sorted) if (s >= requiredM) return s;
  // piece is longer than longest stock → use longest, count two pieces
  return sorted[sorted.length - 1];
}

/** Group frame pieces by board type and count stock lengths needed. */
function frameLines(bom: Bom, cfg: Config): CostLine[] {
  const byBoard = new Map<string, { pieces: number[] }>();
  for (const p of bom.frame) {
    const g = byBoard.get(p.boardId) ?? { pieces: [] };
    g.pieces.push(p.lengthM);
    byBoard.set(p.boardId, g);
  }

  const lines: CostLine[] = [];
  for (const [boardId, { pieces }] of byBoard) {
    const board = findBoard(boardId);
    // Bin-pack each piece into a stock length. If a piece is longer than the
    // longest stock, split into ceil(len / longest) pieces.
    const longest = Math.max(...cfg.stockBoardLengthsM);
    const stockCounts = new Map<number, number>();
    let totalRequiredM = 0;
    for (const pieceM of pieces) {
      totalRequiredM += pieceM;
      if (pieceM <= longest) {
        const stock = pickStockLength(pieceM, cfg.stockBoardLengthsM);
        stockCounts.set(stock, (stockCounts.get(stock) ?? 0) + 1);
      } else {
        const n = Math.ceil(pieceM / longest);
        stockCounts.set(longest, (stockCounts.get(longest) ?? 0) + n);
      }
    }
    // Apply waste factor as extra stock lengths of the most common size.
    const wasteExtraM = (totalRequiredM * cfg.wastePct) / 100;
    if (wasteExtraM > 0) {
      const wasteStock = pickStockLength(Math.min(wasteExtraM, longest), cfg.stockBoardLengthsM);
      const wasteUnits = Math.ceil(wasteExtraM / wasteStock);
      stockCounts.set(wasteStock, (stockCounts.get(wasteStock) ?? 0) + wasteUnits);
    }

    for (const [stock, count] of [...stockCounts].sort((a, b) => a[0] - b[0])) {
      const unitPrice = board.pricePerMetreZar * stock;
      lines.push({
        group: "Frame",
        label: `${board.label} — ${stock.toFixed(1)} m length`,
        qty: count,
        unit: "ea",
        unitPriceZar: unitPrice,
        subtotalZar: unitPrice * count,
        note: `${pieces.length} pieces, ${totalRequiredM.toFixed(2)} m raw + ${cfg.wastePct}% waste`,
      });
    }
  }
  return lines;
}

/** Group cladding by sheet material; convert area → sheets. */
function claddingLines(bom: Bom, cfg: Config): CostLine[] {
  const byMat = new Map<string, { areaM2: number; panels: number }>();
  for (const p of bom.cladding) {
    const g = byMat.get(p.materialId) ?? { areaM2: 0, panels: 0 };
    g.areaM2 += p.billedAreaM2;
    g.panels += 1;
    byMat.set(p.materialId, g);
  }
  const lines: CostLine[] = [];
  for (const [matId, { areaM2, panels }] of byMat) {
    const sheet = findSheet(matId);
    const sheetArea = (sheet.widthMm * sheet.lengthMm) / 1_000_000;
    const wasteFactor = 1 + cfg.wastePct / 100;
    const sheets = Math.ceil((areaM2 * wasteFactor) / sheetArea);
    const isFascia = matId === cfg.fasciaMaterialId && matId !== cfg.claddingMaterialId;
    lines.push({
      group: isFascia ? "Fascia" : "Cladding",
      label: sheet.label,
      qty: sheets,
      unit: "sheets",
      unitPriceZar: sheet.pricePerSheetZar,
      subtotalZar: sheets * sheet.pricePerSheetZar,
      note: `${panels} panel(s), ${areaM2.toFixed(2)} m² + ${cfg.wastePct}% waste, sheet = ${sheetArea.toFixed(2)} m²`,
    });
  }
  return lines;
}

export function priceBom(bom: Bom, cfg: Config): Cost {
  const lines: CostLine[] = [...frameLines(bom, cfg), ...claddingLines(bom, cfg)];
  const materialsZar = lines.reduce((s, l) => s + l.subtotalZar, 0);

  const fastenersZar = (materialsZar * cfg.fastenersPct) / 100;
  const finishZar = (materialsZar * cfg.finishPct) / 100;
  const labourZar = (materialsZar * cfg.labourPct) / 100;

  if (cfg.fastenersPct > 0) {
    lines.push({
      group: "Extras",
      label: `Fasteners, brackets, glue (${cfg.fastenersPct}% of materials)`,
      qty: 1,
      unit: "lot",
      unitPriceZar: fastenersZar,
      subtotalZar: fastenersZar,
    });
  }
  if (cfg.finishPct > 0) {
    lines.push({
      group: "Extras",
      label: `Finish — sealer / paint / fire retardant (${cfg.finishPct}%)`,
      qty: 1,
      unit: "lot",
      unitPriceZar: finishZar,
      subtotalZar: finishZar,
    });
  }
  if (cfg.labourPct > 0) {
    lines.push({
      group: "Extras",
      label: `Labour (${cfg.labourPct}% of materials)`,
      qty: 1,
      unit: "lot",
      unitPriceZar: labourZar,
      subtotalZar: labourZar,
    });
  }

  const totalZar = lines.reduce((s, l) => s + l.subtotalZar, 0);
  return { lines, materialsZar, fastenersZar, finishZar, labourZar, totalZar };
}

export function fmtZar(n: number): string {
  return "R " + n.toLocaleString("en-ZA", { maximumFractionDigits: 0 });
}
