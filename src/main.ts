import {
  attackExchange,
  castSpell,
  spellHitChance,
  ultimateStrike,
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
import { factionOf } from "./data/factions";
import { EXP_MAX, applyLevelUp } from "./core/growth";
import { RAGE_MAX, ULTIMATES, Ultimate } from "./data/ultimates";
import { getPortrait } from "./ui/portraits";
import { Highlight, Scene3D } from "./render3d/scene";
import { loadAssets } from "./render3d/assets";

// ── 게임 상태 ──────────────────────────────────────────────────

type Phase = "player" | "enemy" | "over";
type Mode =
  | "idle"
  | "moveSelect" // 이동 목적지 선택
  | "menu" // 행동 메뉴 (공격/책략/아이템/대기)
  | "attackSelect" // 공격 대상 선택
  | "spellSelect" // 책략 대상 선택
  | "ultSelect" // 필살기 대상 선택
  | "busy"; // 연출 중 입력 잠금

const stage: Stage = stage01;
const units: Unit[] = stage.units.map((u) => ({
  ...u,
  spells: [...u.spells],
  items: [...u.items],
  hp: u.maxHp,
  mp: u.maxMp,
  acted: false,
  rage: 0,
  level: u.level ?? 1,
  exp: 0,
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
let pendingUlt: Ultimate | null = null;
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

/** 게이지 바 HTML */
function barHtml(label: string, val: number, max: number, cls: string): string {
  const pct = max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 0;
  return `<div class="bar"><em>${label}</em>
    <div class="track"><div class="fill ${cls}" style="width:${pct}%"></div></div>
    <span>${val}/${max}</span></div>`;
}

function showInfo(u: Unit | null, x?: number, y?: number) {
  if (!u) {
    infoEl.innerHTML = `<div class="placeholder">${
      x !== undefined && y !== undefined
        ? `지형 — <b>${TERRAIN_LABEL[terrainAt(stage, x, y)]}</b>`
        : "유닛을 선택하세요"
    }</div>`;
    return;
  }
  const job = JOBS[u.job];
  const fac = factionOf(u.faction);
  const ult = ULTIMATES[u.id];
  const spellNames = u.spells.map((s) => SPELLS[s].name).join(" · ") || "없음";
  const itemNames = u.items.map((i) => ITEMS[i].name).join(" · ") || "없음";
  const rangeStr = job.range[0] === job.range[1] ? `${job.range[0]}` : job.range.join("~");

  infoEl.innerHTML = `
    <div class="pwrap"><div class="fchip" style="--fc:${fac.colorCss}">${fac.hanja} ${fac.name}</div></div>
    <div class="ptext">
      <div class="hd">
        <span class="ulv">Lv.${u.level}</span>
        <span class="uname">${u.name}</span>
        <span class="ujob">${job.name}</span>
        <span class="usub">${CATEGORY_LABEL[job.category]} · 사거리 ${rangeStr} · 이동 ${u.mov}</span>
        ${
          u.buff && u.buff.turns > 0
            ? `<span class="buffchip">공 +${Math.round(u.buff.pct * 100)}% · ${u.buff.turns}턴</span>`
            : ""
        }
      </div>
      <div class="bars">
        ${barHtml("HP", u.hp, u.maxHp, "hp")}
        ${u.maxMp > 0 ? barHtml("MP", u.mp, u.maxMp, "mp") : ""}
        ${ult ? barHtml("기력", u.rage, RAGE_MAX, "rage") : ""}
        ${u.side === "player" ? barHtml("EXP", u.exp, EXP_MAX, "exp") : ""}
      </div>
      <div class="statrow">
        <span class="st"><em>공격</em>${u.atk}</span>
        <span class="st"><em>방어</em>${u.def}</span>
        <span class="st"><em>지력</em>${u.int}</span>
        <span class="st"><em>지형</em>${TERRAIN_LABEL[terrainAt(stage, u.x, u.y)]}</span>
      </div>
      ${
        u.trait
          ? `<div class="skill"><b class="trait">★ ${TRAITS[u.trait].name}</b>
             <span class="d">${TRAITS[u.trait].desc}</span></div>`
          : ""
      }
      ${
        ult
          ? `<div class="skill"><b class="ult">⚡ ${ult.name}</b>
             <span class="d">${ult.desc}</span></div>`
          : ""
      }
      <div class="util">책략: ${spellNames} &nbsp;·&nbsp; 소지품: ${itemNames}</div>
    </div>`;
  infoEl.querySelector(".pwrap")!.prepend(getPortrait(u));
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
  pendingUlt = null;
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

/** 쌓인 경험치로 레벨업 처리 (아군 전원) */
function processLevelUps() {
  for (const u of alive("player")) {
    while (u.exp >= EXP_MAX) {
      u.exp -= EXP_MAX;
      const gains = applyLevelUp(u);
      addFloat(u.x, u.y, `LEVEL UP! Lv.${u.level}`, "#ffe14d");
      const summary = gains.map((g) => `${g.label}+${g.amount}`).join(" ");
      setTimeout(() => addFloat(u.x, u.y, summary, "#a8e8b0"), 450);
    }
  }
}

function finishAction(u: Unit) {
  u.acted = true;
  processLevelUps();
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

/** dist칸 이내의 적 유닛 목록 */
function enemiesWithin(u: Unit, dist: number): Unit[] {
  return alive(u.side === "player" ? "enemy" : "player").filter(
    (t) => manhattan(t, u) <= dist
  );
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

  const ult = ULTIMATES[u.id];
  const ultReady =
    ult &&
    u.rage >= RAGE_MAX &&
    (ult.kind === "buff" ||
      (ult.kind === "strike" && enemiesInWeaponRange(u).size > 0) ||
      (ult.kind === "volley" && enemiesWithin(u, 3).length > 0));

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
    ...(ult
      ? [
          {
            label: `⚡ ${ult.name.split("(")[0]}`,
            sub: `기 ${u.rage}/${RAGE_MAX}`,
            disabled: !ultReady,
            onClick: () => {
              if (ult.kind === "strike") {
                pendingUlt = ult;
                targetCells = enemiesInWeaponRange(u);
                targetStyle = { color: 0xffd24d, opacity: 0.6 };
                mode = "ultSelect";
                hideMenu();
              } else {
                hideMenu();
                void doUltimate(u, ult, null);
              }
            },
          },
        ]
      : []),
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

// ── 필살기 실행 ────────────────────────────────────────────────

async function doUltimate(u: Unit, ult: Ultimate, target: Unit | null) {
  mode = "busy";
  targetCells = null;
  u.rage = 0;
  await banner(`⚡ ${ult.name} ⚡`, 800);

  if (ult.kind === "buff") {
    // 패왕령: 3칸 내 아군 (자신 포함) 공격력 버프
    const allies = alive(u.side).filter((a) => manhattan(a, u) <= 3);
    for (const a of allies) {
      a.buff = { pct: 0.3, turns: 2 };
      addFloat(a.x, a.y, "공격력 +30%!", "#ffd24d");
      await sleep(120);
    }
  } else if (ult.kind === "strike" && target) {
    // 귀신참: 지형 무시 250% 일격
    await scene3d.attackAnim(u, target, 1.5);
    const hit = ultimateStrike(stage, u, target, 2.5, true, units);
    addFloat(target.x, target.y, `-${hit.damage}!!`, "#ffd24d");
    if (hit.killed) addFloat(target.x, target.y, "격파!", "#ff8080");
  } else if (ult.kind === "volley") {
    // 천리연사: 3칸 내 모든 적에게 화살 세례
    const targets = enemiesWithin(u, 3);
    if (targets.length > 0) {
      await scene3d.attackAnim(u, targets[0], 1.2);
      for (const t of targets) {
        const hit = ultimateStrike(stage, u, t, 0.8, false, units);
        addFloat(t.x, t.y, `-${hit.damage}`, "#ffd24d");
        if (hit.killed) addFloat(t.x, t.y, "격파!", "#ff8080");
        await sleep(180);
      }
    }
  }

  await sleep(400);
  finishAction(u);
}

// ── 전투 실행 ──────────────────────────────────────────────────

async function doAttack(attacker: Unit, defender: Unit) {
  mode = "busy";
  targetCells = null;
  await scene3d.attackAnim(attacker, defender);
  const hits = attackExchange(stage, attacker, defender, units);
  let first = true;
  for (const h of hits) {
    if (h.counter) {
      await sleep(300);
      await scene3d.attackAnim(defender, attacker);
    } else if (!first) {
      await sleep(250);
      await scene3d.attackAnim(attacker, defender); // 연사 등 추가 타격
    }
    first = false;
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
  await sleep(400);
  finishAction(attacker);
}

async function doSpell(caster: Unit, spell: Spell, target: Unit) {
  mode = "busy";
  targetCells = null;
  addFloat(caster.x, caster.y, spell.name + "!", "#c890ff");
  await scene3d.attackAnim(caster, target, 0.45);
  await sleep(200);
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

    case "ultSelect": {
      if (!selected || !pendingUlt) return;
      const target = unitAt(x, y);
      if (target && targetCells?.has(key(x, y))) {
        const ult = pendingUlt;
        pendingUlt = null;
        void doUltimate(selected, ult, target);
      } else {
        pendingUlt = null;
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

// ── ESC: 선택 취소 / 설정 창 ──────────────────────────────────

const settingsEl = document.getElementById("settings")!;

function toggleSettings(open: boolean) {
  settingsEl.hidden = !open;
}

document.getElementById("settings-close")!.addEventListener("click", () => toggleSettings(false));
settingsEl.addEventListener("click", (e) => {
  if (e.target === settingsEl) toggleSettings(false); // 바깥 클릭으로 닫기
});

window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!settingsEl.hidden) {
    toggleSettings(false);
    return;
  }
  if (phase === "player" && mode !== "busy" && mode !== "idle") {
    cancelToOrigin(); // 뭔가 선택 중이면 먼저 취소
    return;
  }
  toggleSettings(true);
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
    processLevelUps(); // 반격으로 얻은 경험치
    await sleep(350);
    if (checkGameOver()) return;
  }

  turn++;
  for (const u of units) {
    u.acted = false;
    // 버프 지속시간 감소
    if (u.buff && --u.buff.turns <= 0) {
      if (u.hp > 0) addFloat(u.x, u.y, "버프 종료", "#9aa3b5");
      delete u.buff;
    }
  }
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
      await sleep(500);
      addFloat(e.x, e.y, spell.name + "!", "#c890ff");
      await scene3d.attackAnim(e, best.target, 0.45);
      await sleep(200);
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
    await sleep(500);
    await scene3d.attackAnim(e, best.target);
    const hits = attackExchange(stage, e, best.target, units);
    let first = true;
    for (const h of hits) {
      if (h.counter) {
        await sleep(300);
        await scene3d.attackAnim(best.target, e);
      } else if (!first) {
        await sleep(250);
        await scene3d.attackAnim(e, best.target);
      }
      first = false;
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
(async () => {
  // GLTF 병사 모델 프리로드 (실패해도 절차 모델로 진행)
  bannerEl.textContent = "부대 편성 중…";
  bannerEl.classList.add("show");
  const assetsReady = loadAssets().catch(() => {});
  await Promise.race([assetsReady, sleep(8000)]);
  bannerEl.classList.remove("show");
  banner(`${stage.name}\n1턴 아군 페이즈`, 1500);
  frame();
  // 타임아웃 뒤 늦게 도착한 에셋도 반영 (뷰 재구성)
  void assetsReady.then(() => scene3d.invalidateViews());
})();

// 디버그: ?select=조조 정보 카드 / ?settings=설정 모달 미리보기
if (location.search.includes("select")) showInfo(units[0]);
if (location.search.includes("settings")) toggleSettings(true);

// 디버그: ?portraits 로 접속하면 전 유닛 초상화 확인
if (location.search.includes("portraits")) {
  const strip = document.createElement("div");
  strip.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;padding:12px;";
  for (const u of units) strip.appendChild(getPortrait(u)); // 캐시 공유라 중복 유닛은 한 번만 표시됨
  document.body.prepend(strip);
}
