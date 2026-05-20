import { defaultConfig } from "./materials.ts";
import { priceBom } from "./pricing.ts";
import { CrtScene } from "./scene.ts";
import { buildBom } from "./structure.ts";
import { createUI } from "./ui.ts";

const cfg = defaultConfig();
const canvas = document.getElementById("scene") as HTMLCanvasElement;
const scene = new CrtScene(canvas);

let queued = false;
function recompute() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    const bom = buildBom(cfg);
    const cost = priceBom(bom, cfg);
    scene.setHumanVisible(cfg.humanShown);
    scene.setHumanHeight(cfg.humanHeightM);
    scene.render(bom);
    ui.refresh(bom, cost);
  });
}

const ui = createUI(cfg, recompute);
ui.mount();
recompute();
