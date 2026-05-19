import { BOARDS, SHEETS } from "./materials.ts";
import { fmtZar } from "./pricing.ts";
import type { Bom, Config, Cost } from "./types.ts";

type OnChange = () => void;

export interface UI {
  mount(): void;
  refresh(bom: Bom, cost: Cost): void;
}

interface NumOpts {
  label: string;
  key: keyof Config;
  min: number;
  max: number;
  step: number;
  unit?: string;
  fmt?: (n: number) => string;
}

export function createUI(cfg: Config, onChange: OnChange): UI {
  const panel = document.getElementById("panel") as HTMLElement;
  const bomEl = document.getElementById("bom") as HTMLElement;
  const totalEl = document.getElementById("total") as HTMLElement;
  const overlayEl = document.getElementById("overlay") as HTMLElement;

  const numericRow = (o: NumOpts): HTMLElement => {
    const row = document.createElement("div");
    row.className = "row full";

    const head = document.createElement("div");
    head.className = "row";
    const lab = document.createElement("label");
    lab.textContent = o.label;
    const val = document.createElement("div");
    val.className = "val";
    const renderVal = (v: number) =>
      (val.textContent = o.fmt ? o.fmt(v) : `${v.toFixed(o.step < 1 ? 2 : 0)}${o.unit ?? ""}`);
    head.append(lab, val);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(o.min);
    input.max = String(o.max);
    input.step = String(o.step);
    input.value = String(cfg[o.key]);
    renderVal(cfg[o.key] as number);
    input.oninput = () => {
      (cfg[o.key] as unknown as number) = parseFloat(input.value);
      renderVal(cfg[o.key] as number);
      onChange();
    };

    row.append(head, input);
    return row;
  };

  const selectRow = <K extends keyof Config>(
    label: string,
    key: K,
    options: { value: string; label: string }[],
  ): HTMLElement => {
    const row = document.createElement("div");
    row.className = "row";
    const lab = document.createElement("label");
    lab.textContent = label;
    const sel = document.createElement("select");
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      if (cfg[key] === o.value) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.onchange = () => {
      (cfg[key] as unknown as string) = sel.value;
      onChange();
    };
    row.append(lab, sel);
    return row;
  };

  const toggleRow = <K extends keyof Config>(label: string, key: K): HTMLElement => {
    const row = document.createElement("div");
    row.className = "row toggle";
    const lab = document.createElement("label");
    lab.textContent = label;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = cfg[key] as unknown as boolean;
    cb.onchange = () => {
      (cfg[key] as unknown as boolean) = cb.checked;
      onChange();
    };
    row.append(lab, cb);
    return row;
  };

  const sectionTitle = (t: string) => {
    const h = document.createElement("h3");
    h.textContent = t;
    return h;
  };

  const mount = () => {
    panel.innerHTML = "";

    panel.append(sectionTitle("Variant"));
    const pick = document.createElement("div");
    pick.className = "variant-pick";
    const flatBtn = document.createElement("button");
    flatBtn.textContent = "FLAT";
    const tiltBtn = document.createElement("button");
    tiltBtn.textContent = "TILTED";
    const updateBtns = () => {
      flatBtn.classList.toggle("active", cfg.variant === "flat");
      tiltBtn.classList.toggle("active", cfg.variant === "tilted");
    };
    flatBtn.onclick = () => {
      cfg.variant = "flat";
      updateBtns();
      onChange();
    };
    tiltBtn.onclick = () => {
      cfg.variant = "tilted";
      updateBtns();
      onChange();
    };
    updateBtns();
    pick.append(flatBtn, tiltBtn);
    panel.append(pick);
    panel.append(numericRow({ label: "Tilt back", key: "tiltDeg", min: 0, max: 35, step: 1, unit: "°" }));

    panel.append(sectionTitle("Dimensions (m)"));
    panel.append(numericRow({ label: "Uniform scale", key: "scale", min: 0.5, max: 2.5, step: 0.05, unit: "×" }));
    panel.append(numericRow({ label: "Front width", key: "frontWidthM", min: 1.0, max: 5.0, step: 0.05, unit: " m" }));
    panel.append(numericRow({ label: "Front height", key: "frontHeightM", min: 1.0, max: 4.0, step: 0.05, unit: " m" }));
    panel.append(numericRow({ label: "Rear width", key: "rearWidthM", min: 0.4, max: 4.0, step: 0.05, unit: " m" }));
    panel.append(numericRow({ label: "Rear height", key: "rearHeightM", min: 0.4, max: 3.5, step: 0.05, unit: " m" }));
    panel.append(numericRow({ label: "Depth (front→rear)", key: "depthM", min: 0.5, max: 4.0, step: 0.05, unit: " m" }));

    panel.append(sectionTitle("Screen"));
    panel.append(numericRow({ label: "Screen size (ratio of face)", key: "screenRatio", min: 0.3, max: 0.95, step: 0.01 }));
    panel.append(numericRow({ label: "Min bezel", key: "bezelMinM", min: 0.04, max: 0.4, step: 0.01, unit: " m" }));

    panel.append(sectionTitle("Lumber & sheet stock"));
    const boardOpts = BOARDS.map((b) => ({ value: b.id, label: b.label }));
    const sheetOpts = SHEETS.map((s) => ({ value: s.id, label: s.label }));
    panel.append(selectRow("Frame lumber", "frameBoardId", boardOpts));
    panel.append(selectRow("Screen surround", "screenSurroundBoardId", boardOpts));
    panel.append(selectRow("Base / floor lumber", "baseBoardId", boardOpts));
    panel.append(selectRow("Cladding", "claddingMaterialId", sheetOpts));
    panel.append(selectRow("Fascia (bezel)", "fasciaMaterialId", sheetOpts));

    panel.append(sectionTitle("Inclusions"));
    panel.append(toggleRow("Lounge base / floor frame", "includeBase"));
    panel.append(toggleRow("Front fascia (bezel)", "includeFascia"));
    panel.append(toggleRow("Rear cladding panel", "includeRearPanel"));
    panel.append(toggleRow("Bottom cladding panel", "includeFloorPanel"));
    panel.append(toggleRow("Pedestal mount", "includeMount"));

    panel.append(sectionTitle("Mount / pedestal"));
    panel.append(numericRow({ label: "Mount height", key: "mountHeightM", min: 0.05, max: 0.6, step: 0.01, unit: " m" }));
    panel.append(numericRow({ label: "Mount width (frac of rear)", key: "mountWidthFrac", min: 0.2, max: 0.9, step: 0.05 }));
    panel.append(numericRow({ label: "Mount depth (frac of body)", key: "mountDepthFrac", min: 0.2, max: 0.9, step: 0.05 }));

    panel.append(sectionTitle("Cost loadings (%)"));
    panel.append(numericRow({ label: "Waste / offcuts", key: "wastePct", min: 0, max: 40, step: 1, unit: "%" }));
    panel.append(numericRow({ label: "Fasteners & glue", key: "fastenersPct", min: 0, max: 25, step: 1, unit: "%" }));
    panel.append(numericRow({ label: "Finish (sealer/paint/FR)", key: "finishPct", min: 0, max: 40, step: 1, unit: "%" }));
    panel.append(numericRow({ label: "Labour", key: "labourPct", min: 0, max: 100, step: 5, unit: "%" }));

    panel.append(sectionTitle("Editable unit prices (ZAR)"));
    panel.append(buildPriceTable(onChange));
  };

  const refresh = (bom: Bom, cost: Cost) => {
    totalEl.textContent = fmtZar(cost.totalZar);

    const front = bom.corners.ftr[1] - bom.corners.fbr[1];
    const wide = bom.corners.fbr[0] - bom.corners.fbl[0];
    overlayEl.textContent =
      `front  ${wide.toFixed(2)} × ${front.toFixed(2)} m\n` +
      `screen ${bom.screenSideM.toFixed(2)} × ${bom.screenSideM.toFixed(2)} m\n` +
      `total  ${fmtZar(cost.totalZar)}`;

    bomEl.innerHTML = "";
    const actions = document.createElement("div");
    actions.className = "bom-actions";
    const csv = document.createElement("button");
    csv.textContent = "EXPORT CSV";
    csv.onclick = () => downloadCsv(bom, cost);
    const json = document.createElement("button");
    json.textContent = "EXPORT JSON";
    json.onclick = () => downloadJson(cfg, bom, cost);
    const print = document.createElement("button");
    print.textContent = "PRINT QUOTE";
    print.onclick = () => window.print();
    actions.append(csv, json, print);
    bomEl.append(actions);

    const title = document.createElement("h3");
    title.textContent = "Bill of materials";
    bomEl.append(title);

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML =
      "<tr><th>Group</th><th>Item</th><th class='num'>Qty</th><th>Unit</th><th class='num'>Unit (R)</th><th class='num'>Subtotal (R)</th><th>Notes</th></tr>";
    table.append(thead);
    const tbody = document.createElement("tbody");
    let subMat = 0;
    for (const line of cost.lines) {
      if (line.group !== "Extras") subMat += line.subtotalZar;
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td>${line.group}</td><td>${line.label}</td>` +
        `<td class='num'>${line.qty}</td><td>${line.unit}</td>` +
        `<td class='num'>${line.unitPriceZar.toFixed(0)}</td>` +
        `<td class='num'>${line.subtotalZar.toFixed(0)}</td>` +
        `<td>${line.note ?? ""}</td>`;
      tbody.append(tr);
    }
    const subRow = document.createElement("tr");
    subRow.className = "subtotal";
    subRow.innerHTML = `<td colspan='5'>Materials subtotal</td><td class='num'>${subMat.toFixed(0)}</td><td></td>`;
    tbody.append(subRow);
    const grand = document.createElement("tr");
    grand.className = "grand";
    grand.innerHTML = `<td colspan='5'>TOTAL</td><td class='num'>${cost.totalZar.toFixed(0)}</td><td></td>`;
    tbody.append(grand);
    table.append(tbody);
    bomEl.append(table);
  };

  return { mount, refresh };
}

function buildPriceTable(onChange: OnChange): HTMLElement {
  const wrap = document.createElement("div");

  const boardTable = document.createElement("table");
  boardTable.className = "price-table";
  boardTable.innerHTML = "<thead><tr><th>Lumber</th><th>R/m</th></tr></thead>";
  const btb = document.createElement("tbody");
  for (const b of BOARDS) {
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    td1.textContent = b.label;
    const td2 = document.createElement("td");
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.step = "1";
    inp.value = String(b.pricePerMetreZar);
    inp.oninput = () => {
      const v = parseFloat(inp.value);
      if (Number.isFinite(v) && v >= 0) {
        b.pricePerMetreZar = v;
        onChange();
      }
    };
    td2.append(inp);
    tr.append(td1, td2);
    btb.append(tr);
  }
  boardTable.append(btb);

  const sheetTable = document.createElement("table");
  sheetTable.className = "price-table";
  sheetTable.innerHTML = "<thead><tr><th>Sheet</th><th>R/sheet</th></tr></thead>";
  const stb = document.createElement("tbody");
  for (const s of SHEETS) {
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    td1.textContent = s.label;
    const td2 = document.createElement("td");
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.step = "10";
    inp.value = String(s.pricePerSheetZar);
    inp.oninput = () => {
      const v = parseFloat(inp.value);
      if (Number.isFinite(v) && v >= 0) {
        s.pricePerSheetZar = v;
        onChange();
      }
    };
    td2.append(inp);
    tr.append(td1, td2);
    stb.append(tr);
  }
  sheetTable.append(stb);

  wrap.append(boardTable, sheetTable);
  return wrap;
}

function downloadCsv(_bom: Bom, cost: Cost) {
  const rows = [
    ["Group", "Item", "Qty", "Unit", "Unit Price (R)", "Subtotal (R)", "Notes"],
    ...cost.lines.map((l) => [
      l.group,
      l.label,
      String(l.qty),
      l.unit,
      l.unitPriceZar.toFixed(2),
      l.subtotalZar.toFixed(2),
      l.note ?? "",
    ]),
    [],
    ["", "", "", "", "TOTAL", cost.totalZar.toFixed(2), ""],
  ];
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  triggerDownload("the-monitor-bom.csv", "text/csv", csv);
}

function downloadJson(cfg: Config, bom: Bom, cost: Cost) {
  const out = {
    generatedAt: new Date().toISOString(),
    config: cfg,
    screenSideM: bom.screenSideM,
    corners: bom.corners,
    frame: bom.frame.map((f) => ({ name: f.name, boardId: f.boardId, lengthM: +f.lengthM.toFixed(3) })),
    cladding: bom.cladding.map((c) => ({ name: c.name, materialId: c.materialId, areaM2: +c.areaM2.toFixed(3), billedAreaM2: +c.billedAreaM2.toFixed(3) })),
    cost,
  };
  triggerDownload("the-monitor-bom.json", "application/json", JSON.stringify(out, null, 2));
}

function triggerDownload(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
