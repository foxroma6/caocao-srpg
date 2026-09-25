import {
  attackExchange,
  castSpell,
  spellHitChance,
  useItem,
} from "./core/battle";
import {
  attackCells,
  key,
  manhattan,
  movementRange,
  terrainAt,
} from "./core/grid";
import { Stage, TERRAIN_LABEL, Unit } from "./core/types";
import { CATEGORY_LABEL, JOBS } from "./data/jobs";
import { stage01 } from "./data/stage01";
import { SPELLS, Spell } from "./data/spells";
import { ITEMS } from "./data/items";
import { TRAITS } from "./data/traits";
import { Highlight, Scene3D } from "./render3d/scene";

// ── 게임 상태 ──────────────────────────────────────────────────

type Phase = "player" | "enemy" | "over";
type Mode =
  | "idle"
  | "moveSelect" // 이동 목적지 선택
  | "menu" // 행동 메뉴 (공격/책략/아이템/대기)
  | "attackSelect" // 공격 대상 선택
  | "spellSelect" // 책략 대상 선택
  | "busy"; // 연출 중 입력 잠금

const stage: Stage = stage01;
const units: Unit[] = stage.units.map((u) => ({
  ...u,
  spells: [...u.spells],
  items: [...u.items],
  hp: u.maxHp,
  mp: u.maxMp,
  acted: false,
}));

const wrap = document.getElementById("wrap")!;
const scene3d = new Scene3D(wrap, stage);
const infoEl = document.getElementById("info")!;
const bannerEl = document.getElementById("banner")!;
const menuEl = document.getElementById("menu")!;
const endTurnBtn = document.getElementById("end-turn") as HTMLButtonElement;

let phase: Phase = "player";
let mode: Mode = "idle";
let turn = 1;
let selected: Unit | null = null;
let moveRange: Map<string, number> | null = null;
let targetCells: Set<string> | null = null; // 공격/책략 대상 칸
let targetStyle = { color: 0xff4646, opacity: 0.5 };
let pendingSpell: Spell | null = null;
let origin: { x: number; y: number } | null = null; // 이동 전 위치 (취소용)
let cursor: { x: number; y: number } | null = null;

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
  const job = JOBS[u.job];
  const spellNames = u.spells.map((s) => SPELLS[s].name).join("·") || "없음";
  const itemNames = u.items.map((i) => ITEMS[i].name).join("·") || "없음";
  infoEl.innerHTML = `
    <b>${u.name}</b> <span class="cls">${job.name}</span>
    <span class="title">${CATEGORY_LABEL[job.category]} · 사거리 ${
      job.range[0] === job.range[1] ? job.range[0] : job.range.join("~")
    }</span><br>
    HP ${u.hp}/${u.maxHp} · MP ${u.mp}/${u.maxMp} ·
    공 ${u.atk} · 방 ${u.def} · 지 ${u.int} · 이동 ${u.mov}<br>
    ${
      u.trait
        ? `<span class="trait">★ ${TRAITS[u.trait].name}</span>
           <span class="sub">${TRAITS[u.trait].desc}</span><br>`
        : ""
    }<span class="sub">책략: ${spellNames} · 소지품: ${itemNames} ·
    지형: ${TERRAIN_LABEL[terrainAt(stage, u.x, u.y)]}</span>`;
}

function addFloat(x: number, y: number, text: string, color: string) {
  scene3d.floatText(x, y, text, color);
}

// ── 행동 메뉴 ──────────────────────────────────────────────────

interface MenuEntry {
  label: string;
  sub?: string;
  disabled?: boolean;
  onClick: () => void;
}

function showMenu(u: Unit, entries: MenuEntry[]) {
  menuEl.innerHTML = "";
  for (const e of entries) {
    const btn = document.createElement("button");
    btn.innerHTML = e.sub ? `${e.label} <span>${e.sub}</span>` : e.label;
    btn.disabled = !!e.disabled;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      e.onClick();
    });
    menuEl.appendChild(btn);
  }
  const { px, py } = scene3d.project(u.x, u.y);
  menuEl.style.display = "flex";
  const rect = scene3d.domElement.getBoundingClientRect();
  let left = px + 36;
  let top = py - 20;
  const mw = menuEl.offsetWidth;
  const mh = menuEl.offsetHeight;
  if (left + mw > rect.width) left = px - mw - 36;
  if (top + mh > rect.height) top = rect.height - mh - 4;
  menuEl.style.left = `${Math.max(0, left)}px`;
  menuEl.style.top = `${Math.max(0, top)}px`;
}

function hideMenu() {
  menuEl.style.display = "none";
  menuEl.innerHTML = "";
}

// ── 상태 전환 ──────────────────────────────────────────────────

function deselect() {
  selected = null;
  moveRange = null;
  targetCells = null;
  pendingSpell = null;
  origin = null;
  mode = "idle";
  hideMenu();
}

function cancelToOrigin() {
  if (selected && origin) {
    selected.x = origin.x;
    selected.y = origin.y;
  }
  deselect();
}

function checkGameOver(): boolean {
  if (alive("enemy").length === 0) {
    phase = "over";
    hideMenu();
    banner(stage.winText, 60000);
    return true;
  }
  if (alive("player").length === 0) {
    phase = "over";
    hideMenu();
    banner(stage.loseText, 60000);
    return true;
  }
  return false;
}

function finishAction(u: Unit) {
  u.acted = true;
  deselect();
  showInfo(u);
  if (checkGameOver()) return;
  if (alive("player").every((p) => p.acted)) startEnemyPhase();
}

/** 무기 사거리 내 적 칸 집합 */
function enemiesInWeaponRange(u: Unit): Set<string> {
  const out = new Set<string>();
  for (const c of attackCells(stage, u.x, u.y, JOBS[u.job].range)) {
    const t = unitAt(c.x, c.y);
    if (t && t.side !== u.side) out.add(key(c.x, c.y));
  }
  return out;
}

/** 책략 사거리 내 대상 칸 집합 (damage=적, heal=아군·자신) */
function spellTargets(u: Unit, spell: Spell): Set<string> {
  const out = new Set<string>();
  for (const c of attackCells(stage, u.x, u.y, spell.range)) {
    const t = unitAt(c.x, c.y);
    if (!t) continue;
    if (spell.kind === "damage" && t.side !== u.side) out.add(key(c.x, c.y));
    if (spell.kind === "heal" && t.side === u.side) out.add(key(c.x, c.y));
  }
  if (spell.kind === "heal" && spell.range[0] === 0) out.add(key(u.x, u.y));
  return out;
}

// ── 메인 행동 메뉴 구성 ────────────────────────────────────────

function openActionMenu(u: Unit) {
  mode = "menu";
  moveRange = null;
  targetCells = null;

  const canAttack = enemiesInWeaponRange(u).size > 0;
  const usableSpells = u.spells
    .map((id) => SPELLS[id])
    .filter((s) => u.mp >= s.mp && spellTargets(u, s).size > 0);

  const entries: MenuEntry[] = [
    {
      label: "⚔ 공격",
      disabled: !canAttack,
      onClick: () => {
        targetCells = enemiesInWeaponRange(u);
        targetStyle = { color: 0xff4646, opacity: 0.5 };
        mode = "attackSelect";
        hideMenu();
      },
    },
    {
      label: "📜 책략",
      disabled: usableSpells.length === 0,
      onClick: () => openSpellMenu(u),
    },
    {
      label: "🎒 아이템",
      disabled: u.items.length === 0,
      onClick: () => openItemMenu(u),
    },
    {
      label: "🚩 대기",
      onClick: () => finishAction(u),
    },
  ];
  showMenu(u, entries);
}

function openSpellMenu(u: Unit) {
  const entries: MenuEntry[] = u.spells.map((id) => {
    const s = SPELLS[id];
    const usable = u.mp >= s.mp && spellTargets(u, s).size > 0;
    return {
      label: s.name,
      sub: `MP${s.mp}`,
      disabled: !usable,
      onClick: () => {
        pendingSpell = s;
        targetCells = spellTargets(u, s);
        targetStyle =
          s.kind === "heal"
            ? { color: 0x50dc78, opacity: 0.55 }
            : { color: 0xc850ff, opacity: 0.55 };
        mode = "spellSelect";
        hideMenu();
      },
    };
  });
  entries.push({ label: "← 돌아가기", onClick: () => openActionMenu(u) });
  showMenu(u, entries);
}

function openItemMenu(u: Unit) {
  const entries: MenuEntry[] = u.items.map((id, idx) => {
    const it = ITEMS[id];
    return {
      label: it.name,
      sub: it.heal ? `HP+${it.heal}` : `MP+${it.mp}`,
      onClick: () => {
        const res = useItem(u, it);
        u.items.splice(idx, 1);
        if (res.hpGain > 0) addFloat(u.x, u.y, `+${res.hpGain}`, "#4ddb66");
        if (res.mpGain > 0) addFloat(u.x, u.y, `MP+${res.mpGain}`, "#6ab8ff");
        finishAction(u);
      },
    };
  });
  entries.push({ label: "← 돌아가기", onClick: () => openActionMenu(u) });
  showMenu(u, entries);
}

// ── 전투 실행 ──────────────────────────────────────────────────

async function doAttack(attacker: Unit, defender: Unit) {
  mode = "busy";
  targetCells = null;
  const hits = attackExchange(stage, attacker, defender, units);
  let delay = false;
  for (const h of hits) {
    if (delay || h.counter) await sleep(450);
    delay = true;
    const striker = h.counter ? defender : attacker;
    for (const tag of h.tags) addFloat(striker.x, striker.y, tag, "#ffd24d");
    if (h.counter) {
      addFloat(h.target.x, h.target.y, `반격 -${h.damage}`, "#ffb347");
    } else {
      addFloat(h.target.x, h.target.y, `-${h.damage}`, "#ffe14d");
    }
    if (h.killed)
      addFloat(h.target.x, h.target.y, h.target.side === "enemy" ? "격파!" : "전사…", "#ff8080");
  }
  await sleep(300);
  finishAction(attacker);
}

async function doSpell(caster: Unit, spell: Spell, target: Unit) {
  mode = "busy";
  targetCells = null;
  addFloat(caster.x, caster.y, spell.name + "!", "#c890ff");
  await sleep(350);
  const res = castSpell(caster, spell, target);
  for (const tag of res.tags) addFloat(caster.x, caster.y, tag, "#ffd24d");
  if (res.missed) {
    addFloat(target.x, target.y, "실패!", "#cccccc");
  } else if (spell.kind === "heal") {
    addFloat(target.x, target.y, `+${res.amount}`, "#4ddb66");
  } else {
    addFloat(target.x, target.y, `-${res.amount}`, "#ff9aff");
    if (res.killed) addFloat(target.x, target.y, target.side === "enemy" ? "격파!" : "전사…", "#ff8080");
  }
  await sleep(300);
  finishAction(caster);
}

// ── 플레이어 입력 ──────────────────────────────────────────────

scene3d.domElement.addEventListener("click", (e) => {
  if (phase !== "player" || mode === "busy") return;
  const cell = scene3d.pick(e);
  if (!cell) return;
  const { x, y } = cell;
  cursor = { x, y };
  const clicked = unitAt(x, y);

  switch (mode) {
    case "idle": {
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

    case "moveSelect": {
      if (!selected) return;
      if (clicked === selected) {
        openActionMenu(selected); // 제자리에서 행동
        return;
      }
      if (moveRange?.has(key(x, y)) && !clicked) {
        selected.x = x;
        selected.y = y;
        showInfo(selected);
        openActionMenu(selected);
        return;
      }
      deselect();
      if (clicked) showInfo(clicked);
      return;
    }

    case "menu": {
      // 메뉴 밖 클릭 → 이동 취소
      cancelToOrigin();
      return;
    }

    case "attackSelect": {
      if (!selected) return;
      const target = unitAt(x, y);
      if (target && targetCells?.has(key(x, y))) {
        void doAttack(selected, target);
      } else {
        openActionMenu(selected); // 대상 아닌 곳 클릭 → 메뉴로 복귀
      }
      return;
    }

    case "spellSelect": {
      if (!selected || !pendingSpell) return;
      const target = unitAt(x, y);
      if (target && targetCells?.has(key(x, y))) {
        void doSpell(selected, pendingSpell, target);
      } else {
        pendingSpell = null;
        openActionMenu(selected);
      }
      return;
    }
  }
});

// 우클릭 = 전체 취소 (이동 전 위치로 복귀)
scene3d.domElement.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (phase !== "player" || mode === "busy" || !selected) return;
  cancelToOrigin();
});

// 명중률 미리보기: 책략 대상 위에 마우스를 올리면 정보 패널에 표시
scene3d.domElement.addEventListener("mousemove", (e) => {
  if (mode !== "spellSelect" || !selected || !pendingSpell) return;
  const cell = scene3d.pick(e);
  if (!cell) return;
  const t = unitAt(cell.x, cell.y);
  if (t && targetCells?.has(key(cell.x, cell.y)) && pendingSpell.kind === "damage") {
    infoEl.innerHTML = `<b>${pendingSpell.name}</b> → ${t.name} ·
      명중률 <b>${spellHitChance(selected, t)}%</b> ·
      예상 위력 ≈ ${Math.max(1, Math.round(selected.int * pendingSpell.power - t.int * 0.5))}`;
  }
});

endTurnBtn.addEventListener("click", () => {
  if (phase !== "player" || mode === "busy") return;
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
    if (phase !== "enemy") return;
    await enemyAct(e);
    await sleep(350);
    if (checkGameOver()) return;
  }

  turn++;
  for (const u of units) u.acted = false;
  phase = "player";
  await banner(`${turn}턴 아군 페이즈`);
}

async function enemyAct(e: Unit) {
  const players = alive("player");
  if (players.length === 0) return;

  const range = movementRange(stage, units, e);
  const reachable = (cell: string) => {
    const [cx, cy] = cell.split(",").map(Number);
    return !unitAt(cx, cy) || (cx === e.x && cy === e.y);
  };

  // 1) 책략 우선 (도사): 이동 후 책략이 닿는 가장 약한 대상
  const spell = e.spells.map((id) => SPELLS[id]).find((s) => e.mp >= s.mp);
  if (spell && spell.kind === "damage") {
    let best: { cell: string; target: Unit } | null = null;
    for (const cell of range.keys()) {
      if (!reachable(cell)) continue;
      const [cx, cy] = cell.split(",").map(Number);
      for (const ac of attackCells(stage, cx, cy, spell.range)) {
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
      await sleep(400);
      addFloat(e.x, e.y, spell.name + "!", "#c890ff");
      await sleep(350);
      const res = castSpell(e, spell, best.target);
      if (res.missed) addFloat(best.target.x, best.target.y, "실패!", "#cccccc");
      else {
        addFloat(best.target.x, best.target.y, `-${res.amount}`, "#ff9aff");
        if (res.killed) addFloat(best.target.x, best.target.y, "전사…", "#ffffff");
      }
      return;
    }
  }

  // 2) 물리 공격: 이동 범위 내에서 가장 약한 대상
  let best: { cell: string; target: Unit } | null = null;
  for (const cell of range.keys()) {
    if (!reachable(cell)) continue;
    const [cx, cy] = cell.split(",").map(Number);
    for (const ac of attackCells(stage, cx, cy, JOBS[e.job].range)) {
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
    await sleep(400);
    const hits = attackExchange(stage, e, best.target, units);
    let delay = false;
    for (const h of hits) {
      if (delay || h.counter) await sleep(450);
      delay = true;
      const striker = h.counter ? best.target : e;
      for (const tag of h.tags) addFloat(striker.x, striker.y, tag, "#ffd24d");
      if (h.counter) {
        addFloat(h.target.x, h.target.y, `반격 -${h.damage}`, "#ffb347");
      } else {
        addFloat(h.target.x, h.target.y, `-${h.damage}`, "#ff9090");
      }
      if (h.killed)
        addFloat(h.target.x, h.target.y, h.target.side === "player" ? "전사…" : "격파!", "#ffffff");
    }
    return;
  }

  // 3) 접근: 가장 가까운 아군 쪽으로 이동
  let nearest = players[0];
  for (const p of players) {
    if (manhattan(p, e) < manhattan(nearest, e)) nearest = p;
  }
  let bestCell: string | null = null;
  let bestDist = manhattan(nearest, e);
  for (const cell of range.keys()) {
    if (!reachable(cell)) continue;
    const [cx, cy] = cell.split(",").map(Number);
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
  const highlights: Highlight[] = [];
  if (moveRange)
    highlights.push({
      cells: new Set(moveRange.keys()),
      color: 0x5096ff,
      opacity: 0.45,
    });
  if (targetCells)
    highlights.push({ cells: targetCells, ...targetStyle });
  scene3d.setHighlights(highlights);
  scene3d.setCursor(cursor);
  scene3d.syncUnits(units, selected);
  scene3d.render();
  requestAnimationFrame(frame);
}

document.getElementById("stage-name")!.textContent = stage.name;
banner(`${stage.name}\n1턴 아군 페이즈`, 1500);
frame();
