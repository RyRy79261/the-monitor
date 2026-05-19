# The Monitor — wood structure estimator

A live 3D configurator + ZAR price estimator for a walk-in,
CRT-monitor-shaped wooden lounge structure. Built for an AfrikaBurn
proposal.

## What it does

- Live 3D scene (three.js) of a CRT-monitor-shaped shell sitting on the
  desert floor, with a 1.75 m human figure for scale.
- Two variants:
  - **Flat** — front face vertical, like a CRT sitting upright.
  - **Tilted** — the whole shell leans backward around the
    front-bottom edge by a configurable angle. The lounge floor stays
    level on the ground.
- Configurable dimensions: uniform scale, front width/height, rear
  width/height, depth front→rear, screen size as a fraction of the
  front face (screen is always square), minimum bezel.
- Configurable lumber and sheet stock per element (frame, screen
  surround, base, cladding, fascia).
- Live BOM grouped by material with stock-length bin-packing for
  lumber and sheet-count rounding for cladding.
- Loadings for waste %, fasteners %, finish %, labour %.
- Editable unit prices (ZAR) in the side panel — overrides apply to
  the in-memory state for the session.
- Export BOM as CSV or JSON; print-friendly quote view.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static bundle in dist/
npm run typecheck
```

## Pricing model

Materials are South African pine PAR (planed all round) for the frame
and shutterply / SA pine plywood / OSB for cladding. Default unit
prices in `src/materials.ts` are indicative retail at major SA
hardware suppliers (Builders, Cashbuild, etc.) — **treat them as
estimates, not quotes**. Get a fresh quote from your local yard
before committing to a budget.

**Frame** — each frame piece is packed into the smallest stock length
that fits (defaults: 1.8 / 2.4 / 3.0 / 3.6 / 4.2 / 4.8 / 5.4 / 6.0 m).
Pieces longer than the longest stock are split. A waste loading is
added on top as extra stock lengths.

**Cladding** — total panel area × (1 + waste%) divided by sheet area
(2.44 × 1.22 m for standard sheets), rounded up. The front panel is
billed for its full rectangle area — the screen cutout offcut
typically can't be reused.

**Loadings** — applied as % of materials subtotal:

- Fasteners, brackets, glue (default 6%)
- Finish: sealer / paint / fire retardant (default 8%, **note**: an
  AfrikaBurn structure may need fire retardant — check current rules)
- Labour (default 0% — set this if you're costing built-by-someone
  pricing)

## Geometry model

The shell is a rectangular frustum: front face is a rectangle on the
Z = 0 plane with its bottom edge on the ground; rear face is a
smaller rectangle vertically centred on the front, offset back by
`depth`. The 12 edge boards (4 front, 4 rear, 4 corner struts)
provide the structural skeleton. A 4-board screen surround on the
front face frames a square opening centred on the front rectangle.

In tilted mode, the whole shell rotates around the X axis (the
front-bottom edge stays on the ground) by `tiltDeg`. The optional
lounge base / floor frame stays level on the ground regardless of
tilt — i.e. the floor inside is always flat.

## Project layout

```
src/
  main.ts       # entry point, change loop
  scene.ts      # three.js scene, frame & panel meshes, screen, human
  structure.ts  # geometry + BOM (frame pieces + cladding panels)
  pricing.ts    # bin-packing for lumber, sheet rounding, loadings
  ui.ts         # control panel + BOM table + export buttons
  materials.ts  # SA pine board sizes + sheet defaults + default config
  types.ts      # shared types
  styles.css
index.html
```

## Things deliberately not modelled

- Door / entry cutout (the screen opening is the entry).
- Internal lounge furniture, cushions, lighting, soft goods.
- Foundation, sand anchoring, guy lines.
- Transport, on-site labour for setup and strike.
- Permits and AfrikaBurn DMV / theme camp registration fees.

Add these as flat line items in your proposal alongside the BOM total
this tool produces.
