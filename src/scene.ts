import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { findBoard } from "./materials.ts";
import type { Bom, CladdingPanel, FrameBoard } from "./types.ts";

const WOOD_FRAME = 0xb98a4a;
const WOOD_CLAD = 0xd9b377;
const WOOD_FASCIA = 0x8c5a2a;
const SCREEN = 0x0a0d0f;
const SCREEN_GLOW = 0x6fa67a;
const GROUND = 0xc9a36b;

export class CrtScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private buildGroup = new THREE.Group();
  private human: THREE.Group;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1d18);
    this.scene.fog = new THREE.Fog(0x1a1d18, 18, 60);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
    this.camera.position.set(5, 3, 6);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 1, -0.5);
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 40;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;

    // Lighting — bright sun + warm fill
    const sun = new THREE.DirectionalLight(0xfff1c8, 2.2);
    sun.position.set(6, 10, 4);
    sun.castShadow = true;
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8;
    sun.shadow.camera.bottom = -8;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xddeeff, 0x9c7b48, 0.7));

    // Desert ground
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(40, 64),
      new THREE.MeshStandardMaterial({ color: GROUND, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(20, 20, 0x4a4538, 0x3a3528);
    (grid.material as THREE.Material).opacity = 0.35;
    (grid.material as THREE.Material).transparent = true;
    grid.position.y = 0.001;
    this.scene.add(grid);

    this.scene.add(this.buildGroup);

    this.human = makeHumanScale();
    this.scene.add(this.human);

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    resize();
    new ResizeObserver(resize).observe(canvas);

    const tick = () => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    tick();
  }

  setHumanVisible(v: boolean) {
    this.human.visible = v;
  }

  setHumanHeight(heightM: number) {
    // The base figure is sized for ~1.75 m tall; scale the group uniformly.
    const k = Math.max(0.1, heightM) / 1.75;
    this.human.scale.setScalar(k);
  }

  render(bom: Bom) {
    // Clear previous geometry — dispose to free GPU memory.
    while (this.buildGroup.children.length) {
      const c = this.buildGroup.children.pop()!;
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
        else if (mat) mat.dispose();
      });
    }
    for (const board of bom.frame) this.buildGroup.add(makeBoardMesh(board));
    for (const panel of bom.cladding) this.buildGroup.add(makePanelMesh(panel));
    this.buildGroup.add(makeScreenMesh(bom));
    // Re-position the human standing 0.8m forward of the front face, off to the side.
    this.human.position.set(bom.corners.fbr[0] + 0.6, 0, bom.corners.fbr[2] + 0.8);
  }
}

function makeBoardMesh(board: FrameBoard): THREE.Mesh {
  const b = findBoard(board.boardId);
  const t = b.thicknessMm / 1000;
  const w = b.widthMm / 1000;
  const L = Math.max(0.01, board.lengthM);

  const geom = new THREE.BoxGeometry(t, L, w);
  const mat = new THREE.MeshStandardMaterial({ color: WOOD_FRAME, roughness: 0.85 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const start = new THREE.Vector3(...board.start);
  const end = new THREE.Vector3(...board.end);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const dir = end.clone().sub(start).normalize();
  mesh.position.copy(mid);
  // Align local +Y to direction.
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  mesh.quaternion.copy(quat);
  return mesh;
}

function makePanelMesh(panel: CladdingPanel): THREE.Object3D {
  // Build a 2D shape in panel-local coordinates, then position/orient it in 3D.
  if (panel.poly.length < 3) return new THREE.Group();

  const origin = new THREE.Vector3(...panel.poly[0]);
  const n = new THREE.Vector3(...panel.normal).normalize();
  // u axis along first edge
  const u = new THREE.Vector3(...panel.poly[1]).sub(origin).normalize();
  // v axis = n × u (right-handed in panel-local space)
  const v = new THREE.Vector3().crossVectors(n, u).normalize();

  const to2D = (p3: [number, number, number]): THREE.Vector2 => {
    const p = new THREE.Vector3(...p3).sub(origin);
    return new THREE.Vector2(p.dot(u), p.dot(v));
  };

  const shape = new THREE.Shape(panel.poly.map(to2D));

  if (panel.hole) {
    const centre2 = to2D(panel.hole.center);
    const s = panel.hole.sideM / 2;
    const hole = new THREE.Path();
    hole.moveTo(centre2.x - s, centre2.y - s);
    hole.lineTo(centre2.x + s, centre2.y - s);
    hole.lineTo(centre2.x + s, centre2.y + s);
    hole.lineTo(centre2.x - s, centre2.y + s);
    hole.lineTo(centre2.x - s, centre2.y - s);
    shape.holes.push(hole);
  }

  const isFascia = panel.name.includes("fascia");
  const thickness = isFascia ? 0.022 : 0.012;
  const geom = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });

  const mat = new THREE.MeshStandardMaterial({
    color: isFascia ? WOOD_FASCIA : WOOD_CLAD,
    roughness: 0.78,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Cladding extrudes inward (along -normal) so it sits behind the frame edge;
  // fascia sits PROUD of the front face, extruding outward.
  const extrudeAxis = isFascia ? n.clone() : n.clone().negate();
  const m = new THREE.Matrix4().makeBasis(u, v, extrudeAxis);
  mesh.applyMatrix4(m);
  const placement = origin.clone();
  if (isFascia) placement.addScaledVector(n, 0.002);
  mesh.position.copy(placement);
  return mesh;
}

function makeScreenMesh(bom: Bom): THREE.Object3D {
  const { fbl, fbr, ftl, ftr } = bom.corners;
  const centre = new THREE.Vector3(
    (fbl[0] + fbr[0] + ftl[0] + ftr[0]) / 4,
    (fbl[1] + fbr[1] + ftl[1] + ftr[1]) / 4,
    (fbl[2] + fbr[2] + ftl[2] + ftr[2]) / 4,
  );
  const u = new THREE.Vector3(...fbr).sub(new THREE.Vector3(...fbl)).normalize();
  const v = new THREE.Vector3(...ftl).sub(new THREE.Vector3(...fbl)).normalize();
  const n = new THREE.Vector3().crossVectors(u, v).normalize();

  const s = bom.screenSideM;
  const geom = new THREE.PlaneGeometry(s, s);
  const mat = new THREE.MeshStandardMaterial({
    color: SCREEN,
    emissive: SCREEN_GLOW,
    emissiveIntensity: 0.35,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, mat);
  const basis = new THREE.Matrix4().makeBasis(u, v, n);
  mesh.applyMatrix4(basis);
  // Sit just in front of the front-panel plane so it's visible through the cutout.
  mesh.position.copy(centre).addScaledVector(n, 0.005);
  return mesh;
}

/** Schematic 1.75 m tall human figure for scale reference. */
function makeHumanScale(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.7, 0.22), mat);
  torso.position.y = 1.05;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.22), mat);
  legs.position.y = 0.425;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), mat);
  head.position.y = 1.55;
  [torso, legs, head].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  });
  return g;
}
