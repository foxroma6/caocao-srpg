// ── Three.js 3D 씬: 지형, 카메라, 피킹, 유닛 동기화 ─────────────

import * as THREE from "three";
import { Stage, Terrain, Unit } from "../core/types";
import { terrainAt } from "../core/grid";
import { UnitModel, buildUnitModel } from "./models";

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

export class Scene3D {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  domElement: HTMLCanvasElement;

  private raycaster = new THREE.Raycaster();
  private tileMeshes: THREE.Mesh[] = [];
  private tileHeights: number[][] = [];
  private highlightGroup = new THREE.Group();
  private highlightSig = "";
  private cursorMesh: THREE.LineLoop;
  private models = new Map<string, UnitModel>();
  private hpSprites = new Map<string, { sprite: THREE.Sprite; canvas: HTMLCanvasElement; lastHp: number }>();

  constructor(public container: HTMLElement, public stage: Stage) {
    const W = 800;
    const H = 600;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(W, H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.domElement = this.renderer.domElement;
    container.appendChild(this.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x252a24);

    // ── 조명 ──
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x5a6b3a, 1.05));
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.9);
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
      new THREE.LineBasicMaterial({ color: 0xffe14d, linewidth: 2 })
    );
    this.cursorMesh.visible = false;
    this.scene.add(this.cursorMesh);

    // ── 카메라 (아이소메트릭 오소그래픽) ──
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    const center = new THREE.Vector3(0, 0, 0);
    this.camera.position.set(center.x + 9, 11, center.z + 9);
    this.camera.lookAt(center);
    this.fitCamera(W / H);
  }

  // 보드를 원점 중심으로 배치: 타일 (x,y) → 월드 (x - cx, ·, y - cy)
  worldX(x: number) {
    return x - (this.stage.width - 1) / 2;
  }
  worldZ(y: number) {
    return y - (this.stage.height - 1) / 2;
  }
  tileTop(x: number, y: number) {
    return this.tileHeights[y]?.[x] ?? 0;
  }

  /** 보드 전체가 화면에 들어오도록 카메라 프러스텀 맞춤 */
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

        // 타일 본체 (살짝 틈을 둬서 격자감)
        const boxH = hgt + 0.25;
        const color =
          t === "mountain" ? 0x8d7b5f
          : t === "fort" ? 0xa8a08c
          : GREENS[Math.floor(hash(x, y) * GREENS.length)];
        const tile = new THREE.Mesh(new THREE.BoxGeometry(0.97, boxH, 0.97), std(color));
        tile.position.set(this.worldX(x), boxH / 2 - 0.25, this.worldZ(y));
        tile.receiveShadow = true;
        tile.userData.tile = { x, y };
        this.scene.add(tile);
        this.tileMeshes.push(tile);

        if (t === "forest") this.addTrees(x, y);
        if (t === "mountain") this.addRocks(x, y, hgt);
        if (t === "fort") this.addFortWalls(x, y, hgt);
      }
    }
  }

  private addTrees(x: number, y: number) {
    const std = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true });
    // 나무 2그루를 타일 모서리 쪽에 배치 (유닛이 중앙에 서도 겹치지 않게)
    const spots: [number, number][] = [
      [-0.28 + hash(x, y, 1) * 0.12, -0.26],
      [0.26, 0.2 + hash(x, y, 2) * 0.1],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [ox, oz] = spots[i];
      const scale = 0.8 + hash(x, y, 3 + i) * 0.4;
      const g = new THREE.Group();
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
      g.scale.setScalar(scale);
      g.position.set(this.worldX(x) + ox, 0, this.worldZ(y) + oz);
      g.rotation.y = hash(x, y, 7 + i) * Math.PI;
      this.scene.add(g);
    }
  }

  private addRocks(x: number, y: number, hgt: number) {
    const std = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true });
    // 봉우리 바위들 (모서리 배치)
    const spots: [number, number, number][] = [
      [-0.3, -0.3, 0.16],
      [0.3, -0.25, 0.12],
      [0.28, 0.3, 0.14],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [ox, oz, r] = spots[i];
      const rock = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r * (0.8 + hash(x, y, 50 + i) * 0.5), 0),
        std(i % 2 ? 0x6e5f48 : 0x7d6c53)
      );
      rock.position.set(this.worldX(x) + ox, hgt + r * 0.5, this.worldZ(y) + oz);
      rock.rotation.set(hash(x, y, 60 + i) * 3, hash(x, y, 63 + i) * 3, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    }
  }

  private addFortWalls(x: number, y: number, hgt: number) {
    const std = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true });
    const wx = this.worldX(x);
    const wz = this.worldZ(y);
    // 뒤쪽(북)과 옆면 일부에 성벽, 모서리에 망루
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.22, 0.12), std(0x8f8674));
    wall.position.set(wx, hgt + 0.11, wz - 0.42);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.scene.add(wall);
    // 총안 (톱니)
    for (let i = 0; i < 4; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), std(0x7a7262));
      tooth.position.set(wx - 0.36 + i * 0.24, hgt + 0.26, wz - 0.42);
      tooth.castShadow = true;
      this.scene.add(tooth);
    }
    // 망루
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.4, 6), std(0x8a8270));
    tower.position.set(wx - 0.38, hgt + 0.2, wz - 0.36);
    tower.castShadow = true;
    this.scene.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.14, 6), std(0x6a4a3a));
    roof.position.set(wx - 0.38, hgt + 0.47, wz - 0.36);
    roof.castShadow = true;
    this.scene.add(roof);
    // 깃발
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 4), std(0x5a4a32));
    pole.position.set(wx + 0.38, hgt + 0.4, wz - 0.36);
    this.scene.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xc03030, side: THREE.DoubleSide })
    );
    flag.position.set(wx + 0.28, hgt + 0.54, wz - 0.36);
    this.scene.add(flag);
  }

  // ── 피킹 / 투영 ──────────────────────────────────────────────

  /** 마우스 이벤트 → 타일 좌표 */
  pick(e: MouseEvent): { x: number; y: number } | null {
    const rect = this.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets: THREE.Object3D[] = [...this.tileMeshes];
    for (const m of this.models.values()) targets.push(m.group);
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

  /** 타일 좌표 → 컨테이너 기준 픽셀 좌표 */
  project(x: number, y: number): { px: number; py: number } {
    const v = new THREE.Vector3(this.worldX(x), this.tileTop(x, y) + 0.5, this.worldZ(y));
    v.project(this.camera);
    const rect = this.domElement.getBoundingClientRect();
    return { px: ((v.x + 1) / 2) * rect.width, py: ((1 - v.y) / 2) * rect.height };
  }

  // ── 하이라이트 / 커서 ────────────────────────────────────────

  setHighlights(hs: Highlight[]) {
    const sig = hs
      .map((h) => h.color + ":" + [...h.cells].sort().join(";"))
      .join("|");
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

  // ── 유닛 동기화 ──────────────────────────────────────────────

  syncUnits(units: Unit[], selected: Unit | null) {
    for (const u of units) {
      let model = this.models.get(u.id);
      if (!model) {
        model = buildUnitModel(u);
        model.group.userData.getTile = () => ({ x: u.x, y: u.y });
        this.models.set(u.id, model);
        this.scene.add(model.group);
        model.group.position.set(this.worldX(u.x), this.tileTop(u.x, u.y), this.worldZ(u.y));
        this.attachHpBar(u, model.group);
      }

      if (u.hp <= 0) {
        model.group.visible = false;
        continue;
      }
      model.group.visible = true;

      // 부드러운 이동
      const target = new THREE.Vector3(this.worldX(u.x), this.tileTop(u.x, u.y), this.worldZ(u.y));
      model.group.position.lerp(target, 0.18);

      // 행동 완료 반투명
      const opacity = u.acted && u.side === "player" ? 0.45 : 1;
      for (const m of model.materials) m.opacity = opacity;

      model.ring.visible = u === selected;

      // HP 바 갱신
      const hp = this.hpSprites.get(u.id);
      if (hp && hp.lastHp !== u.hp) {
        hp.lastHp = u.hp;
        this.drawHpBar(hp.canvas, u);
        (hp.sprite.material as THREE.SpriteMaterial).map!.needsUpdate = true;
      }
    }
  }

  private attachHpBar(u: Unit, group: THREE.Group) {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 12;
    this.drawHpBar(canvas, u);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, depthTest: false })
    );
    sprite.scale.set(0.55, 0.1, 1);
    sprite.position.y = 1.0;
    sprite.raycast = () => {}; // 피킹 제외
    group.add(sprite);
    this.hpSprites.set(u.id, { sprite, canvas, lastHp: u.hp });
  }

  private drawHpBar(canvas: HTMLCanvasElement, u: Unit) {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 64, 12);
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 2, 64, 8);
    const ratio = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = ratio > 0.4 ? "#4ddb66" : "#ffb347";
    ctx.fillRect(2, 4, 60 * ratio, 4);
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
