// ── Three.js 3D 씬: 지형, 카메라, 피킹, 부대·애니메이션 ─────────

import * as THREE from "three";
import { Stage, Terrain, Unit } from "../core/types";
import { terrainAt } from "../core/grid";
import { JOBS } from "../data/jobs";
import {
  NAMED_IDS,
  buildLeader,
  buildProcEscort,
  collectMaterials,
  escortSprite,
} from "./models";
import {
  GltfInstance,
  SPRITE_ASSET,
  hasAsset,
  heroAssetKey,
  instantiate,
  instantiateProp,
} from "./assets";
import { RAGE_MAX, ULTIMATES } from "../data/ultimates";
import { factionOf } from "../data/factions";

export interface Highlight {
  cells: Set<string>;
  color: number;
  opacity: number;
}

/** 좌표 기반 결정적 의사난수 (0~1) */
function hash(x: number, y: number, n = 0): number {
  const v = Math.sin(x * 127.1 + y * 311.7 + n * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

const GREENS = [0x8fae5e, 0x93b262, 0x89a758, 0x96b566];

// ── 애니메이션 단위 ────────────────────────────────────────────

type Loco = "idle" | "walk";

interface Actor {
  obj: THREE.Object3D; // squad의 자식 (배치 좌표를 가짐)
  inner: THREE.Object3D; // 흔들림/사망 회전을 적용하는 내부 노드
  gltf?: GltfInstance;
  materials: THREE.MeshStandardMaterial[];
  phase: number; // 개체별 위상 (봅 애니 어긋나게)
  loco: Loco;
  dyingT: number; // 0=생존, >0 사망 연출 경과
  isEscort: boolean;
}

interface UnitView {
  root: THREE.Group; // 타일 위치
  squad: THREE.Group; // 방향(yaw) 회전
  ring: THREE.Mesh;
  actors: Actor[];
  escorts: Actor[];
  status: "alive" | "dying" | "dead";
  deathT: number;
  baseYaw: number;
  yaw: number;
  forcedYaw: number | null;
  forcedUntil: number;
  lunge: { t: number; dur: number; dist: number; resolve: () => void } | null;
  hpCanvas: HTMLCanvasElement;
  hpSprite: THREE.Sprite;
  lastHp: number;
}

const shortestAngle = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export class Scene3D {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  domElement: HTMLCanvasElement;

  private raycaster = new THREE.Raycaster();
  private tileMeshes: THREE.Mesh[] = [];
  private tileHeights: number[][] = [];
  private decorGroup = new THREE.Group(); // 나무·바위·성벽 등 (에셋 도착 시 재구성)
  private waterMats: { mat: THREE.MeshBasicMaterial; phase: number }[] = [];
  private highlightGroup = new THREE.Group();
  private highlightSig = "";
  private cursorMesh: THREE.LineLoop;
  private views = new Map<string, UnitView>();
  private clock = new THREE.Clock();
  private time = 0;

  // ── 카메라 컨트롤 상태 ──
  private basePos = new THREE.Vector3();
  private panOffset = new THREE.Vector3();
  private zoomLevel = 1;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private keysDown = new Set<string>();

  constructor(public container: HTMLElement, public stage: Stage) {
    const W = 880;
    const H = 620;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(W, H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.domElement = this.renderer.domElement;
    container.appendChild(this.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x252a24);

    // ── 조명 ──
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x5a6b3a, 1.2));
    const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
    sun.position.set(-6, 12, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const d = Math.max(stage.width, stage.height) * 0.75;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.camera.far = 40;
    this.scene.add(sun);

    // ── 지형 ──
    this.buildTerrain();
    this.scene.add(this.decorGroup);
    this.buildDecor();
    this.scene.add(this.highlightGroup);

    // ── 커서 ──
    const half = 0.5;
    const pts = [
      new THREE.Vector3(-half, 0, -half),
      new THREE.Vector3(half, 0, -half),
      new THREE.Vector3(half, 0, half),
      new THREE.Vector3(-half, 0, half),
    ];
    this.cursorMesh = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xffe14d })
    );
    this.cursorMesh.visible = false;
    this.scene.add(this.cursorMesh);

    // ── 카메라 (아이소메트릭 오소그래픽) ──
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.set(9, 11, 9);
    this.camera.lookAt(0, 0, 0);
    this.fitCamera(W / H);
    this.basePos.copy(this.camera.position);
    this.setupCameraControls();
  }

  // ── 카메라 컨트롤: 휠 줌 / 휠 드래그·키보드 팬 ────────────────

  private applyCamera() {
    this.camera.position.copy(this.basePos).add(this.panOffset);
    this.camera.zoom = this.zoomLevel;
    this.camera.updateProjectionMatrix();
  }

  private clampPan() {
    const lx = this.stage.width * 0.55;
    const lz = this.stage.height * 0.55;
    this.panOffset.x = Math.max(-lx, Math.min(lx, this.panOffset.x));
    this.panOffset.z = Math.max(-lz, Math.min(lz, this.panOffset.z));
    this.panOffset.y = Math.max(-6, Math.min(6, this.panOffset.y));
  }

  /** NDC 좌표가 가리키는 지면(y=0) 위 점 */
  private groundPoint(ndc: THREE.Vector2): THREE.Vector3 | null {
    this.raycaster.setFromCamera(ndc, this.camera);
    const { origin, direction } = this.raycaster.ray;
    if (Math.abs(direction.y) < 1e-6) return null;
    const t = -origin.y / direction.y;
    return origin.clone().addScaledVector(direction, t);
  }

  resetCamera() {
    this.panOffset.set(0, 0, 0);
    this.zoomLevel = 1;
    this.applyCamera();
  }

  /** 코드에서 줌/시점 지정 (디버그·연출용) */
  setView(zoom: number, panX = 0, panZ = 0) {
    this.zoomLevel = Math.max(0.85, Math.min(4, zoom));
    this.panOffset.set(panX, 0, panZ);
    this.clampPan();
    this.applyCamera();
  }

  private panByScreen(dx: number, dy: number) {
    const rect = this.domElement.getBoundingClientRect();
    const worldPerPx =
      (this.camera.right - this.camera.left) / this.zoomLevel / rect.width;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.panOffset.addScaledVector(right, -dx * worldPerPx);
    this.panOffset.addScaledVector(up, dy * worldPerPx);
    this.clampPan();
    this.applyCamera();
  }

  private setupCameraControls() {
    const el = this.domElement;

    // 휠: 커서 위치를 향해 줌
    el.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const before = this.groundPoint(ndc);
        const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
        this.zoomLevel = Math.max(0.85, Math.min(4, this.zoomLevel * factor));
        this.applyCamera();
        this.camera.updateMatrixWorld(true);
        const after = this.groundPoint(ndc);
        if (before && after) {
          this.panOffset.x += before.x - after.x;
          this.panOffset.z += before.z - after.z;
          this.clampPan();
          this.applyCamera();
        }
      },
      { passive: false }
    );

    // 휠 버튼 드래그: 팬
    el.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      this.dragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e: PointerEvent) => {
      if (!this.dragging) return;
      this.panByScreen(e.clientX - this.lastPointer.x, e.clientY - this.lastPointer.y);
      this.lastPointer = { x: e.clientX, y: e.clientY };
    });
    const endDrag = () => (this.dragging = false);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("auxclick", (e) => e.preventDefault());

    // 키보드: WASD / 방향키 팬, Home = 초기화
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        this.keysDown.add(k);
        e.preventDefault();
      }
      if (k === "home") this.resetCamera();
    });
    window.addEventListener("keyup", (e) => this.keysDown.delete(e.key.toLowerCase()));
  }

  private updateKeyPan(dt: number) {
    if (this.keysDown.size === 0) return;
    const speed = 550 * dt; // 화면 px/초
    let dx = 0;
    let dy = 0;
    if (this.keysDown.has("a") || this.keysDown.has("arrowleft")) dx += speed;
    if (this.keysDown.has("d") || this.keysDown.has("arrowright")) dx -= speed;
    if (this.keysDown.has("w") || this.keysDown.has("arrowup")) dy += speed;
    if (this.keysDown.has("s") || this.keysDown.has("arrowdown")) dy -= speed;
    if (dx !== 0 || dy !== 0) this.panByScreen(-dx, -dy);
  }

  worldX(x: number) {
    return x - (this.stage.width - 1) / 2;
  }
  worldZ(y: number) {
    return y - (this.stage.height - 1) / 2;
  }
  tileTop(x: number, y: number) {
    return this.tileHeights[y]?.[x] ?? 0;
  }

  private fitCamera(aspect: number) {
    this.camera.updateMatrixWorld();
    const inv = this.camera.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const w = this.stage.width, h = this.stage.height;
    for (const [x, z] of [[0, 0], [w, 0], [0, h], [w, h]] as const) {
      for (const y of [0, 1.2]) {
        const v = new THREE.Vector3(x - w / 2, y, z - h / 2).applyMatrix4(inv);
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      }
    }
    const pad = 0.4;
    let fw = maxX - minX + pad * 2;
    let fh = maxY - minY + pad * 2;
    if (fw / fh < aspect) fw = fh * aspect;
    else fh = fw / aspect;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    this.camera.left = cx - fw / 2;
    this.camera.right = cx + fw / 2;
    this.camera.top = cy + fh / 2;
    this.camera.bottom = cy - fh / 2;
    this.camera.updateProjectionMatrix();
  }

  // ── 지형 생성 ────────────────────────────────────────────────

  private heightFor(t: Terrain): number {
    if (t === "mountain") return 0.35;
    if (t === "fort") return 0.15;
    if (t === "water") return -0.1;
    return 0;
  }

  private buildTerrain() {
    const { stage } = this;
    const std = (color: number) =>
      new THREE.MeshStandardMaterial({ color, flatShading: true });

    for (let y = 0; y < stage.height; y++) {
      this.tileHeights.push([]);
      for (let x = 0; x < stage.width; x++) {
        const t = terrainAt(stage, x, y);
        const hgt = this.heightFor(t);
        this.tileHeights[y].push(hgt);

        const boxH = hgt + 0.25;
        const color =
          t === "mountain" ? 0x8d7b5f
          : t === "fort" ? 0xa8a08c
          : t === "water" ? 0x2c5580
          : GREENS[Math.floor(hash(x, y) * GREENS.length)];
        const tile = new THREE.Mesh(new THREE.BoxGeometry(0.97, boxH, 0.97), std(color));
        tile.position.set(this.worldX(x), boxH / 2 - 0.25, this.worldZ(y));
        tile.receiveShadow = true;
        tile.userData.tile = { x, y };
        this.scene.add(tile);
        this.tileMeshes.push(tile);

        // 물: 일렁이는 수면 하이라이트
        if (t === "water") {
          const mat = new THREE.MeshBasicMaterial({
            color: 0x6fa8dc,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
          });
          const surf = new THREE.Mesh(new THREE.PlaneGeometry(0.97, 0.97), mat);
          surf.rotation.x = -Math.PI / 2;
          surf.position.set(this.worldX(x), hgt + 0.015, this.worldZ(y));
          this.scene.add(surf);
          this.waterMats.push({ mat, phase: hash(x, y, 99) * Math.PI * 2 });
        }
      }
    }
  }

  /** 지형 데코 생성 (GLTF 프롭 우선, 없으면 절차 폴백) */
  private buildDecor() {
    const { stage } = this;
    for (let y = 0; y < stage.height; y++) {
      for (let x = 0; x < stage.width; x++) {
        const t = terrainAt(stage, x, y);
        if (t === "forest") this.addTrees(x, y);
        if (t === "mountain") this.addRocks(x, y, this.tileTop(x, y));
        if (t === "fort") this.addFortWalls(x, y, this.tileTop(x, y));
        // 평지: 가끔 작은 바위로 심심함 제거 (이동엔 영향 없음)
        if (t === "plain" && hash(x, y, 70) > 0.9) {
          const rock = instantiateProp(hash(x, y, 71) > 0.5 ? "prop:rock_a" : "prop:rock_d");
          if (rock) {
            rock.scale.multiplyScalar(0.55 + hash(x, y, 72) * 0.3);
            const g = new THREE.Group();
            g.add(rock);
            g.position.set(
              this.worldX(x) + (hash(x, y, 73) - 0.5) * 0.6,
              0,
              this.worldZ(y) + (hash(x, y, 74) - 0.5) * 0.6
            );
            g.rotation.y = hash(x, y, 75) * Math.PI * 2;
            this.decorGroup.add(g);
          }
        }
      }
    }
  }

  /** 에셋이 늦게 로드됐을 때 데코를 프롭 버전으로 재구성 */
  refreshDecor() {
    this.decorGroup.clear();
    this.buildDecor();
  }

  private addTrees(x: number, y: number) {
    const std = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true });
    const spots: [number, number][] = [
      [-0.28 + hash(x, y, 1) * 0.12, -0.26],
      [0.26, 0.2 + hash(x, y, 2) * 0.1],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [ox, oz] = spots[i];
      const scale = 0.85 + hash(x, y, 3 + i) * 0.45;
      const g = new THREE.Group();

      const prop = instantiateProp(hash(x, y, 8 + i) > 0.5 ? "prop:tree_a" : "prop:tree_b");
      if (prop) {
        g.add(prop);
      } else {
        // 절차 폴백
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.25, 6), std(0x6b4a2f));
        trunk.position.y = 0.12;
        trunk.castShadow = true;
        g.add(trunk);
        const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.35, 7), std(0x437536));
        c1.position.y = 0.35;
        c1.castShadow = true;
        g.add(c1);
        const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 7), std(0x5d8f43));
        c2.position.y = 0.55;
        c2.castShadow = true;
        g.add(c2);
      }
      g.scale.setScalar(scale);
      g.position.set(this.worldX(x) + ox, 0, this.worldZ(y) + oz);
      g.rotation.y = hash(x, y, 7 + i) * Math.PI * 2;
      this.decorGroup.add(g);
    }
  }

  private addRocks(x: number, y: number, hgt: number) {
    const std = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true });
    const keys = ["prop:rock_a", "prop:rock_b", "prop:rock_d"];
    const spots: [number, number, number][] = [
      [-0.3, -0.3, 0.16],
      [0.3, -0.25, 0.12],
      [0.28, 0.3, 0.14],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [ox, oz, r] = spots[i];
      const prop = instantiateProp(keys[Math.floor(hash(x, y, 55 + i) * keys.length)]);
      if (prop) {
        const g = new THREE.Group();
        g.add(prop);
        g.scale.setScalar(0.9 + hash(x, y, 50 + i) * 0.7);
        g.position.set(this.worldX(x) + ox, hgt, this.worldZ(y) + oz);
        g.rotation.y = hash(x, y, 60 + i) * Math.PI * 2;
        this.decorGroup.add(g);
      } else {
        const rock = new THREE.Mesh(
          new THREE.IcosahedronGeometry(r * (0.8 + hash(x, y, 50 + i) * 0.5), 0),
          std(i % 2 ? 0x6e5f48 : 0x7d6c53)
        );
        rock.position.set(this.worldX(x) + ox, hgt + r * 0.5, this.worldZ(y) + oz);
        rock.rotation.set(hash(x, y, 60 + i) * 3, hash(x, y, 63 + i) * 3, 0);
        rock.castShadow = true;
        rock.receiveShadow = true;
        this.decorGroup.add(rock);
      }
    }
  }

  private addFortWalls(x: number, y: number, hgt: number) {
    const std = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true });
    const wx = this.worldX(x);
    const wz = this.worldZ(y);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.22, 0.12), std(0x8f8674));
    wall.position.set(wx, hgt + 0.11, wz - 0.42);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.decorGroup.add(wall);
    for (let i = 0; i < 4; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), std(0x7a7262));
      tooth.position.set(wx - 0.36 + i * 0.24, hgt + 0.26, wz - 0.42);
      tooth.castShadow = true;
      this.decorGroup.add(tooth);
    }

    // 망루: KayKit 타워 프롭 우선
    const towerProp = instantiateProp("prop:tower");
    if (towerProp) {
      const g = new THREE.Group();
      g.add(towerProp);
      g.position.set(wx - 0.34, hgt, wz - 0.3);
      g.rotation.y = Math.PI / 4;
      this.decorGroup.add(g);
    } else {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.4, 6), std(0x8a8270));
      tower.position.set(wx - 0.38, hgt + 0.2, wz - 0.36);
      tower.castShadow = true;
      this.decorGroup.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.14, 6), std(0x6a4a3a));
      roof.position.set(wx - 0.38, hgt + 0.47, wz - 0.36);
      roof.castShadow = true;
      this.decorGroup.add(roof);
    }

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 4), std(0x5a4a32));
    pole.position.set(wx + 0.38, hgt + 0.4, wz - 0.36);
    this.decorGroup.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xc03030, side: THREE.DoubleSide })
    );
    flag.position.set(wx + 0.28, hgt + 0.54, wz - 0.36);
    this.decorGroup.add(flag);
  }

  // ── 피킹 / 투영 ──────────────────────────────────────────────

  pick(e: MouseEvent): { x: number; y: number } | null {
    const rect = this.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets: THREE.Object3D[] = [...this.tileMeshes];
    for (const v of this.views.values()) if (v.root.visible) targets.push(v.root);
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData.tile) return o.userData.tile;
        if (o.userData.getTile) return o.userData.getTile();
        o = o.parent;
      }
    }
    return null;
  }

  project(x: number, y: number): { px: number; py: number } {
    const v = new THREE.Vector3(this.worldX(x), this.tileTop(x, y) + 0.5, this.worldZ(y));
    v.project(this.camera);
    const rect = this.domElement.getBoundingClientRect();
    return { px: ((v.x + 1) / 2) * rect.width, py: ((1 - v.y) / 2) * rect.height };
  }

  // ── 하이라이트 / 커서 ────────────────────────────────────────

  setHighlights(hs: Highlight[]) {
    const sig = hs.map((h) => h.color + ":" + [...h.cells].sort().join(";")).join("|");
    if (sig === this.highlightSig) return;
    this.highlightSig = sig;
    this.highlightGroup.clear();
    for (const h of hs) {
      const mat = new THREE.MeshBasicMaterial({
        color: h.color,
        transparent: true,
        opacity: h.opacity,
        depthWrite: false,
      });
      for (const k of h.cells) {
        const [x, y] = k.split(",").map(Number);
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), mat);
        plane.rotation.x = -Math.PI / 2;
        plane.position.set(this.worldX(x), this.tileTop(x, y) + 0.012, this.worldZ(y));
        this.highlightGroup.add(plane);
      }
    }
  }

  setCursor(cell: { x: number; y: number } | null) {
    if (!cell) {
      this.cursorMesh.visible = false;
      return;
    }
    this.cursorMesh.visible = true;
    this.cursorMesh.position.set(
      this.worldX(cell.x),
      this.tileTop(cell.x, cell.y) + 0.02,
      this.worldZ(cell.y)
    );
  }

  // ── 부대(뷰) 생성 ────────────────────────────────────────────

  private makeActor(
    obj: THREE.Object3D,
    gltf: GltfInstance | undefined,
    isEscort: boolean
  ): Actor {
    // inner: 봅/사망 회전용 래퍼
    const inner = new THREE.Group();
    while (obj.children.length) inner.add(obj.children[0]);
    obj.add(inner);
    return {
      obj,
      inner,
      gltf,
      materials: gltf ? gltf.materials : collectMaterials(obj),
      phase: Math.random() * Math.PI * 2,
      loco: "idle",
      dyingT: 0,
      isEscort,
    };
  }

  /** AI 생성 영웅 > 병종 GLTF > 절차 모델 순으로 선택 */
  private buildMember(u: Unit, role: "leader" | "escort"): Actor {
    const sprite = role === "leader" ? JOBS[u.job].sprite : escortSprite(u);

    const holder = new THREE.Group();
    let gltf: GltfInstance | undefined;

    // 1) AI 생성 영웅 모델 (리더 전용)
    const heroKey = role === "leader" ? heroAssetKey(u.id) : null;
    if (heroKey) {
      gltf = instantiate(heroKey)!;
      holder.add(gltf.root);
    } else {
      // 2) 병종 GLTF (전용 캐릭터·도사 리더 제외)
      const useGltf =
        !(role === "leader" && (NAMED_IDS.has(u.id) || sprite === "taoist")) &&
        hasAsset(SPRITE_ASSET[sprite]);
      if (useGltf) {
        gltf = instantiate(SPRITE_ASSET[sprite])!;
        holder.add(gltf.root);
      } else {
        // 3) 절차 모델
        holder.add(role === "leader" ? buildLeader(u) : buildProcEscort(u));
      }
    }
    return this.makeActor(holder, gltf, role === "escort");
  }

  private buildView(u: Unit): UnitView {
    const mounted = JOBS[u.job].mounted;
    const squad = new THREE.Group();

    const leader = this.buildMember(u, "leader");
    leader.obj.position.x = 0.08;
    squad.add(leader.obj);

    const escorts: Actor[] = [];
    for (const dz of [-0.25, 0.25]) {
      const e = this.buildMember(u, "escort");
      e.obj.scale.setScalar(mounted ? 0.62 : 0.7);
      e.obj.position.set(mounted ? -0.26 : -0.24, 0, dz);
      squad.add(e.obj);
      escorts.push(e);
    }

    const baseYaw = u.side === "enemy" ? Math.PI : 0;
    squad.rotation.y = baseYaw;

    const root = new THREE.Group();
    root.add(squad);
    root.scale.setScalar(mounted ? 1.02 : 1.12);
    root.position.set(this.worldX(u.x), this.tileTop(u.x, u.y), this.worldZ(u.y));
    root.userData.getTile = () => ({ x: u.x, y: u.y });

    // ── 세력 베이스: 색 링 + 반투명 원판 ──
    const fac = factionOf(u.faction);
    const facRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.02, 6, 28),
      new THREE.MeshBasicMaterial({ color: fac.color })
    );
    facRing.rotation.x = Math.PI / 2;
    facRing.position.y = 0.018;
    root.add(facRing);
    const facDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.37, 28),
      new THREE.MeshBasicMaterial({
        color: fac.color,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      })
    );
    facDisc.rotation.x = -Math.PI / 2;
    facDisc.position.y = 0.014;
    root.add(facDisc);

    // ── 선택 링 (세력 링 바깥, 노란색) ──
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.47, 0.024, 6, 28),
      new THREE.MeshBasicMaterial({ color: 0xffe14d })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    ring.visible = false;
    root.add(ring);

    // HP 바
    const hpCanvas = document.createElement("canvas");
    hpCanvas.width = 64;
    hpCanvas.height = 12;
    this.drawHpBar(hpCanvas, u);
    const tex = new THREE.CanvasTexture(hpCanvas);
    tex.minFilter = THREE.LinearFilter;
    const hpSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    hpSprite.scale.set(0.55, 0.1, 1);
    hpSprite.position.y = 1.0;
    hpSprite.raycast = () => {};
    root.add(hpSprite);

    this.scene.add(root);
    return {
      root,
      squad,
      ring,
      actors: [leader, ...escorts],
      escorts,
      status: "alive",
      deathT: 0,
      baseYaw,
      yaw: baseYaw,
      forcedYaw: null,
      forcedUntil: 0,
      lunge: null,
      hpCanvas,
      hpSprite,
      lastHp: u.hp,
    };
  }

  private drawHpBar(canvas: HTMLCanvasElement, u: Unit) {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 64, 12);
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 1, 64, 10);
    const ratio = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = ratio > 0.4 ? "#4ddb66" : "#ffb347";
    ctx.fillRect(2, 3, 60 * ratio, 4);
    // 영웅 기력 게이지 (필살기)
    if (ULTIMATES[u.id]) {
      ctx.fillStyle = u.rage >= RAGE_MAX ? "#ffe14d" : "#c8a020";
      ctx.fillRect(2, 8, 60 * (u.rage / RAGE_MAX), 2);
    }
  }

  // ── 애니메이션 ───────────────────────────────────────────────

  private setLoco(a: Actor, state: Loco) {
    if (a.loco === state) return;
    const prev = a.loco;
    a.loco = state;
    if (a.gltf) {
      const from = a.gltf.actions[prev];
      const to = a.gltf.actions[state];
      to?.reset().fadeIn(0.18).play();
      from?.fadeOut(0.18);
    }
  }

  private playOnce(a: Actor, role: "attack" | "death") {
    if (!a.gltf) return;
    const act = a.gltf.actions[role];
    if (!act) return;
    const loco = a.gltf.actions[a.loco];
    act.reset().fadeIn(0.06).play();
    loco?.fadeOut(0.06);
    if (role === "attack") {
      const mixer = a.gltf.mixer;
      const onFin = (e: { action: THREE.AnimationAction }) => {
        if (e.action === act) {
          mixer.removeEventListener("finished", onFin as never);
          act.fadeOut(0.12);
          loco?.reset().fadeIn(0.12).play();
        }
      };
      mixer.addEventListener("finished", onFin as never);
    }
  }

  /** 공격/책략 시전 연출: 대상을 향해 몸을 던진다. 임팩트 시점에 resolve */
  attackAnim(u: Unit, target: { x: number; y: number }, power = 1): Promise<void> {
    const view = this.views.get(u.id);
    if (!view || view.status !== "alive") return Promise.resolve();
    const dx = this.worldX(target.x) - view.root.position.x;
    const dz = this.worldZ(target.y) - view.root.position.z;
    view.forcedYaw = Math.atan2(-dz, dx);
    view.forcedUntil = this.time + 0.8;
    for (const a of view.actors) if (!a.isEscort || Math.random() < 0.7) this.playOnce(a, "attack");
    return new Promise((resolve) => {
      view.lunge = { t: 0, dur: 0.34, dist: 0.24 * power, resolve };
    });
  }

  // ── 유닛 동기화 (매 프레임) ──────────────────────────────────

  syncUnits(units: Unit[], selected: Unit | null) {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;

    this.updateKeyPan(dt);

    // 수면 일렁임
    for (const w of this.waterMats) {
      w.mat.opacity = 0.3 + 0.14 * Math.sin(this.time * 1.7 + w.phase);
    }

    for (const u of units) {
      let view = this.views.get(u.id);
      if (!view) {
        view = this.buildView(u);
        this.views.set(u.id, view);
      }

      // ── 사망 처리 ──
      if (u.hp <= 0) {
        if (view.status === "alive") {
          view.status = "dying";
          view.deathT = 0;
          view.ring.visible = false;
          view.hpSprite.visible = false;
          for (const a of view.actors) this.playOnce(a, "death");
        }
        if (view.status === "dying") {
          view.deathT += dt;
          const k = Math.min(1, view.deathT / 0.7);
          for (const a of view.actors) {
            if (!a.gltf?.actions.death) a.inner.rotation.z = (Math.PI / 2) * k; // 절차: 쓰러짐
            a.gltf?.mixer.update(dt);
          }
          const fade = Math.max(0, 1 - Math.max(0, view.deathT - 0.5) / 0.6);
          for (const a of view.actors) for (const m of a.materials) m.opacity = fade;
          if (view.deathT > 1.2) {
            view.status = "dead";
            view.root.visible = false;
          }
        }
        continue;
      }
      view.root.visible = true;

      // ── 이동 ──
      const target = new THREE.Vector3(
        this.worldX(u.x),
        this.tileTop(u.x, u.y),
        this.worldZ(u.y)
      );
      const dist = view.root.position.distanceTo(target);
      const walking = dist > 0.05;
      const prev = view.root.position.clone();
      view.root.position.lerp(target, Math.min(1, dt * 7));

      // ── 방향 ──
      let desired = view.baseYaw;
      if (view.forcedYaw !== null && this.time < view.forcedUntil) {
        desired = view.forcedYaw;
      } else if (walking) {
        const vx = view.root.position.x - prev.x;
        const vz = view.root.position.z - prev.z;
        if (Math.abs(vx) + Math.abs(vz) > 1e-4) desired = Math.atan2(-vz, vx);
      }
      view.yaw += shortestAngle(view.yaw, desired) * Math.min(1, dt * 10);
      view.squad.rotation.y = view.yaw;

      // ── 런지 (공격 연출) ──
      if (view.lunge) {
        const l = view.lunge;
        const before = l.t;
        l.t += dt;
        const k = Math.min(1, l.t / l.dur);
        view.squad.position.x = Math.sin(Math.PI * k) * l.dist;
        if (before < l.dur * 0.45 && l.t >= l.dur * 0.45) l.resolve(); // 임팩트
        if (k >= 1) {
          view.squad.position.x = 0;
          view.lunge = null;
        }
      }

      // ── 개체 애니메이션 ──
      for (const a of view.actors) {
        this.setLoco(a, walking ? "walk" : "idle");
        if (a.gltf) a.gltf.mixer.update(dt);
        // 클립이 없는 모델(절차 모델, 정적 AI 생성 모델)은 봅 + 걸음 흔들림
        if (!a.gltf || !a.gltf.actions.idle) {
          const amp = walking ? 0.028 : 0.008;
          const freq = walking ? 11 : 2.4;
          a.inner.position.y = Math.abs(Math.sin(this.time * freq + a.phase)) * amp;
          a.inner.rotation.z = walking
            ? Math.sin(this.time * freq + a.phase) * 0.05
            : 0;
        }
      }

      // ── 행동 완료 반투명 ──
      const opacity = u.acted && u.side === "player" ? 0.45 : 1;
      for (const a of view.actors) for (const m of a.materials) m.opacity = opacity;

      // ── 부대 손실: HP에 따라 호위병 이탈 ──
      const ratio = u.hp / u.maxHp;
      const show = [ratio > 1 / 3, ratio > 2 / 3];
      view.escorts.forEach((e, i) => {
        if (show[i]) {
          if (e.dyingT > 0) {
            // 회복으로 복귀
            e.dyingT = 0;
            e.inner.rotation.z = 0;
            e.obj.visible = true;
          }
        } else if (e.obj.visible) {
          if (e.dyingT === 0) this.playOnce(e, "death");
          e.dyingT += dt;
          if (!e.gltf?.actions.death) e.inner.rotation.z = (Math.PI / 2) * Math.min(1, e.dyingT / 0.5);
          for (const m of e.materials) m.opacity = Math.max(0, 1 - e.dyingT / 0.8);
          if (e.dyingT > 0.9) e.obj.visible = false;
        }
      });

      view.ring.visible = u === selected;

      // ── HP/기력 바 ──
      const barKey = u.hp * 1000 + u.rage;
      if (view.lastHp !== barKey) {
        view.lastHp = barKey;
        this.drawHpBar(view.hpCanvas, u);
        (view.hpSprite.material as THREE.SpriteMaterial).map!.needsUpdate = true;
      }
    }
  }

  /** 에셋이 늦게 로드됐을 때 모든 유닛 뷰를 새 에셋으로 재구성 */
  invalidateViews() {
    for (const v of this.views.values()) this.scene.remove(v.root);
    this.views.clear();
  }

  // ── 플로팅 텍스트 (HTML 오버레이) ────────────────────────────

  floatText(x: number, y: number, text: string, color: string) {
    const { px, py } = this.project(x, y);
    const div = document.createElement("div");
    div.className = "float";
    div.textContent = text;
    div.style.color = color;
    div.style.left = `${px}px`;
    div.style.top = `${py}px`;
    this.container.appendChild(div);
    setTimeout(() => div.remove(), 1300);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
