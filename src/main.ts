import { attack } from "./core/battle";
import {
  attackCells,
  key,
  manhattan,
  movementRange,
  terrainAt,
} from "./core/grid";
import {
  CLASS_LABEL,
  Stage,
  TERRAIN_LABEL,
  Unit,
} from "./core/types";
import { stage01 } from "./data/stage01";
import { FloatText, Renderer, TILE } from "./render/renderer";

// ── 게임 상태 ──────────────────────────────────────────────────

type Phase = "player" | "enemy" | "over";
type Mode = "idle" | "moveSelect" | "attackSelect";

const stage: Stage = stage01;
const units: Unit[] = stage.units.map((u) => ({ ...u, hp: u.maxHp, acted: false }));

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new Renderer(canvas, stage);
const infoEl = document.getElementById("info")!;
const bannerEl = document.getElementById("banner")!;
const endTurnBtn = document.getElementById("end-turn") as HTMLButtonElement;

let phase: Phase = "player";
let mode: Mode = "idle";
let turn = 1;
let selected: Unit | null = null;
let moveRange: Map<string, number> | null = null;
let attackTargets: Set<string> | null = null;
let origin: { x: number; y: number } | null = null; // 이동 전 위치 (취소용)
let cursor: { x: number; y: number } | null = null;
const floats: FloatText[] = [];

const alive = (side: string) => units.filter((u) => u.side === side && u.hp > 0);
const unitAt = (x: number, y: number) =>
  units.find((u) => u.hp > 0 && u.x === x && u.y === y);

// ── UI 헬퍼 ────────────────────────────────────────────────────

function banner(text: string, ms = 1200): Promise<void> {
  bannerEl.textContent = text;
  bannerEl.classList.add("show");
  return new Promise((r) =>
    setTimeout(() => {
      bannerEl.classList.remove("show");
      r();
    }, ms)
  );
}

function showInfo(u: Unit | null, x?: number, y?: number) {
  if (!u) {
    if (x !== undefined && y !== undefined) {
      infoEl.innerHTML = `<b>${TERRAIN_LABEL[terrainAt(stage, x, y)]}</b>`;
    } else {
      infoEl.innerHTML = "유닛을 선택하세요";
    }
    return;
  }
  infoEl.innerHTML = `
    <b>${u.name}</b> <span class="cls">${CLASS_LABEL[u.cls]}</span><br>
    HP ${u.hp}/${u.maxHp} · 공 ${u.atk} · 방 ${u.def} · 이동 ${u.mov}<br>
    <span class="terrain">지형: ${TERRAIN_LABEL[terrainAt(stage, u.x, u.y)]}</span>`;
}

function addFloat(x: number, y: number, text: string, color: string) {
  floats.push({ x, y, text, color, life: 40 });
}

function deselect() {
  selected = null;
  moveRange = null;
  attackTargets = null;
  origin = null;
  mode = "idle";
}

function checkGameOver(): boolean {
  if (alive("enemy").length === 0) {
    phase = "over";
    banner(stage.winText, 60000);
    return true;
  }
  if (alive("player").length === 0) {
    phase = "over";
    banner(stage.loseText, 60000);
    return true;
  }
  return false;
}

// ── 플레이어 입력 ──────────────────────────────────────────────

function enemiesInRange(u: Unit): Set<string> {
  const cells = attackCells(stage, u.x, u.y, u.range);
  const out = new Set<string>();
  for (const c of cells) {
    const t = unitAt(c.x, c.y);
    if (t && t.side !== u.side) out.add(key(c.x, c.y));
  }
  return out;
}

function finishAction(u: Unit) {
  u.acted = true;
  deselect();
  if (checkGameOver()) return;
  // 모든 아군이 행동했으면 자동으로 적 턴
  if (alive("player").every((p) => p.acted)) startEnemyPhase();
}

canvas.addEventListener("click", (e) => {
  if (phase !== "player") return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * stage.width);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * stage.height);
  cursor = { x, y };
  const clicked = unitAt(x, y);

  if (mode === "idle") {
    if (clicked) {
      showInfo(clicked);
      if (clicked.side === "player" && !clicked.acted) {
        selected = clicked;
        origin = { x: clicked.x, y: clicked.y };
        moveRange = movementRange(stage, units, clicked);
        mode = "moveSelect";
      }
    } else {
      showInfo(null, x, y);
    }
    return;
  }

  if (mode === "moveSelect" && selected) {
    if (clicked === selected) {
      // 제자리에서 행동: 이동 생략
      moveRange = null;
      attackTargets = enemiesInRange(selected);
      mode = "attackSelect";
      if (attackTargets.size === 0) finishAction(selected);
      return;
    }
    if (moveRange?.has(key(x, y)) && !clicked) {
      selected.x = x;
      selected.y = y;
      moveRange = null;
      attackTargets = enemiesInRange(selected);
      mode = "attackSelect";
      showInfo(selected);
      if (attackTargets.size === 0) finishAction(selected);
      return;
    }
    // 범위 밖 클릭 → 선택 취소
    deselect();
    if (clicked) showInfo(clicked);
    return;
  }

  if (mode === "attackSelect" && selected) {
    const target = unitAt(x, y);
    if (target && attackTargets?.has(key(x, y))) {
      const res = attack(stage, selected, target);
      addFloat(target.x, target.y, `-${res.damage}`, "#ffe14d");
      if (res.killed) addFloat(target.x, target.y, "격파!", "#ff8080");
      finishAction(selected);
    } else if (clicked === selected || !target) {
      // 공격하지 않고 대기
      finishAction(selected);
    }
  }
});

// 우클릭 = 이동 취소
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (phase !== "player" || !selected) return;
  if (origin) {
    selected.x = origin.x;
    selected.y = origin.y;
  }
  deselect();
});

endTurnBtn.addEventListener("click", () => {
  if (phase !== "player") return;
  for (const u of alive("player")) u.acted = true;
  startEnemyPhase();
});

// ── 적 AI ──────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function startEnemyPhase() {
  phase = "enemy";
  deselect();
  await banner("적군 페이즈");

  for (const e of alive("enemy")) {
    if (phase !== "enemy") return; // 도중 게임 종료
    await enemyAct(e);
    await sleep(350);
    if (checkGameOver()) return;
  }

  // 다음 아군 턴
  turn++;
  for (const u of units) u.acted = false;
  phase = "player";
  await banner(`${turn}턴 아군 페이즈`);
}

async function enemyAct(e: Unit) {
  const players = alive("player");
  if (players.length === 0) return;

  const range = movementRange(stage, units, e);

  // 이동 가능한 각 칸에서 공격할 수 있는 대상 탐색 → 최대 데미지 예상 대상 우선
  let best: { cell: string; target: Unit } | null = null;
  for (const cell of range.keys()) {
    const [cx, cy] = cell.split(",").map(Number);
    if (unitAt(cx, cy) && !(cx === e.x && cy === e.y)) continue;
    for (const ac of attackCells(stage, cx, cy, e.range)) {
      const t = unitAt(ac.x, ac.y);
      if (t && t.side === "player") {
        if (!best || t.hp < best.target.hp) best = { cell, target: t };
      }
    }
  }

  if (best) {
    const [cx, cy] = best.cell.split(",").map(Number);
    e.x = cx;
    e.y = cy;
    await sleep(250);
    const res = attack(stage, e, best.target);
    addFloat(best.target.x, best.target.y, `-${res.damage}`, "#ff9090");
    if (res.killed) addFloat(best.target.x, best.target.y, "전사…", "#ffffff");
    return;
  }

  // 공격 불가 → 가장 가까운 아군 쪽으로 이동
  let nearest = players[0];
  for (const p of players) {
    if (manhattan(p, e) < manhattan(nearest, e)) nearest = p;
  }
  let bestCell: string | null = null;
  let bestDist = manhattan(nearest, e);
  for (const cell of range.keys()) {
    const [cx, cy] = cell.split(",").map(Number);
    if (unitAt(cx, cy) && !(cx === e.x && cy === e.y)) continue;
    const d = manhattan(nearest, { x: cx, y: cy });
    if (d < bestDist) {
      bestDist = d;
      bestCell = cell;
    }
  }
  if (bestCell) {
    const [cx, cy] = bestCell.split(",").map(Number);
    e.x = cx;
    e.y = cy;
  }
}

// ── 메인 루프 ──────────────────────────────────────────────────

function frame() {
  for (let i = floats.length - 1; i >= 0; i--) {
    floats[i].life--;
    if (floats[i].life <= 0) floats.splice(i, 1);
  }
  const moveSet = moveRange ? new Set(moveRange.keys()) : null;
  renderer.draw(units, moveSet, attackTargets, selected, cursor, floats);
  requestAnimationFrame(frame);
}

document.getElementById("stage-name")!.textContent = stage.name;
banner(`${stage.name}\n1턴 아군 페이즈`, 1500);
frame();
