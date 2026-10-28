// ── 조운전(趙雲傳) — 캠페인 메인 루프 ───────────────────────────

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
import { TERRAIN_LABEL, Unit, UnitData } from "./core/types";
import { CATEGORY_LABEL, JOBS } from "./data/jobs";
import { SPELLS, Spell } from "./data/spells";
import { ITEMS } from "./data/items";
import { TRAITS } from "./data/traits";
import { RAGE_MAX, ULTIMATES, Ultimate } from "./data/ultimates";
import { factionOf } from "./data/factions";
import { EXP_MAX, applyLevelUp } from "./core/growth";
import { CAMPAIGN, CampaignStage, HEROES } from "./data/campaign";
import { Highlight, Scene3D } from "./render3d/scene";
import { loadAssets } from "./render3d/assets";
import { getPortrait } from "./ui/portraits";

// ── 캠페인 상태 (스테이지를 넘어 유지) ─────────────────────────

interface HeroSave {
  level: number;
  exp: number;
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  int: number;
  items: string[];
}

const heroState = new Map<string, HeroSave>();

function saveHero(u: Unit) {
  heroState.set(u.id, {
    level: u.level,
    exp: u.exp,
    maxHp: u.maxHp,
    maxMp: u.maxMp,
    atk: u.atk,
    def: u.def,
    int: u.int,
    items: [...u.items],
  });
}

function makeHeroUnit(id: string, x: number, y: number): Unit {
  const base = HEROES[id];
  const saved = heroState.get(id);
  const data: UnitData = { ...base, x, y };
  const u: Unit = {
    ...data,
    spells: [...base.spells],
    items: saved ? [...saved.items] : [...base.items],
    hp: 0,
    mp: 0,
    acted: false,
    rage: 0,
    level: saved?.level ?? base.level ?? 1,
    exp: saved?.exp ?? 0,
  };
  if (saved) {
    u.maxHp = saved.maxHp;
    u.maxMp = saved.maxMp;
    u.atk = saved.atk;
    u.def = saved.def;
    u.int = saved.int;
  }
  u.hp = u.maxHp;
  u.mp = u.maxMp;
  return u;
}

// ── 스테이지 상태 ──────────────────────────────────────────────

type Phase = "player" | "enemy" | "over";
type Mode =
  | "idle"
  | "moveSelect"
  | "menu"
  | "attackSelect"
  | "spellSelect"
  | "ultSelect"
  | "busy";

let stageIndex = 0;
let stage: CampaignStage = CAMPAIGN[0];
let units: Unit[] = [];
let scene3d!: Scene3D; // loadStage()에서 반드시 초기화됨
let entrySnapshot: Map<string, HeroSave> = new Map(); // 재도전용

let phase: Phase = "player";
let mode: Mode = "idle";
let turn = 1;
let stageResult: "win" | "lose" | "clear" | null = null;
let selected: Unit | null = null;
let moveRange: Map<string, number> | null = null;
let targetCells: Set<string> | null = null;
let targetStyle = { color: 0xff4646, opacity: 0.5 };
let pendingSpell: Spell | null = null;
let pendingUlt: Ultimate | null = null;
let origin: { x: number; y: number } | null = null;
let cursor: { x: number; y: number } | null = null;

const wrap = document.getElementById("wrap")!;
const statusEl = document.getElementById("status")!;
const profileEl = document.getElementById("profile")!;
const bannerEl = document.getElementById("banner")!;
const menuEl = document.getElementById("menu")!;
const endTurnBtn = document.getElementById("end-turn") as HTMLButtonElement;

const alive = (side: string) =>
  units.filter((u) => u.side === side && u.hp > 0 && !u.escaped);
const unitAt = (x: number, y: number) =>
  units.find((u) => u.hp > 0 && !u.escaped && u.x === x && u.y === y);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

function bannerHold(text: string) {
  bannerEl.textContent = text;
  bannerEl.classList.add("show");
}

/** 게이지 바 HTML */
function barHtml(label: string, val: number, max: number, cls: string): string {
  const pct = max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 0;
  return `<div class="bar"><em>${label}</em>
    <div class="track"><div class="fill ${cls}" style="width:${pct}%"></div></div>
    <span>${val}/${max}</span></div>`;
}

function setStatus(html: string) {
  statusEl.innerHTML = html;
}

let profileUnit: Unit | null = null;

function clearProfile() {
  profileUnit = null;
  profileEl.hidden = true;
}

/** 프로필 카드를 유닛 왼쪽에 배치 (왼쪽 공간이 없으면 오른쪽) */
function positionProfile() {
  if (!profileUnit || profileUnit.hp <= 0 || profileUnit.escaped) return;
  const { px, py } = scene3d.project(profileUnit.x, profileUnit.y);
  const rect = scene3d.domElement.getBoundingClientRect();
  const w = profileEl.offsetWidth;
  const h = profileEl.offsetHeight;
  let left = px - w - 34;
  if (left < 8) left = px + 34; // 왼쪽 공간 부족 → 오른쪽
  let top = py - h / 2;
  top = Math.max(8, Math.min(rect.height - h - 8, top));
  left = Math.max(8, Math.min(rect.width - w - 8, left));
  profileEl.style.left = `${left}px`;
  profileEl.style.top = `${top}px`;
}

function showProfile(u: Unit) {
  const job = JOBS[u.job];
  const fac = factionOf(u.faction);
  const ult = u.side === "player" ? ULTIMATES[u.id] : undefined;
  const spellNames = u.spells.map((s) => SPELLS[s].name).join(" · ") || "없음";
  const itemNames = u.items.map((i) => ITEMS[i].name).join(" · ") || "없음";
  const rangeStr = job.range[0] === job.range[1] ? `${job.range[0]}` : job.range.join("~");

  profileEl.innerHTML = `
    <div class="top">
      <div class="pwrap"><div class="fchip" style="--fc:${fac.colorCss}">${fac.hanja} ${fac.name}</div></div>
      <div class="hd">
        <div class="nameline">
          <span class="ulv">Lv.${u.level}</span>
          <span class="uname">${u.name}</span>
          <span class="ujob">${job.name}</span>
        </div>
        <span class="usub">${CATEGORY_LABEL[job.category]} · 사거리 ${rangeStr} · 이동 ${u.mov}
          · ${TERRAIN_LABEL[terrainAt(stage, u.x, u.y)]}</span>
        ${
          u.buff && u.buff.turns > 0
            ? `<span class="buffchip">공 +${Math.round(u.buff.pct * 100)}% · ${u.buff.turns}턴</span>`
            : ""
        }
      </div>
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
    <div class="util">책략: ${spellNames} &nbsp;·&nbsp; 소지품: ${itemNames}</div>`;
  profileEl.querySelector(".pwrap")!.prepend(getPortrait(u));
  profileEl.hidden = false;
  profileUnit = u;
  positionProfile();
}

/** 하위 호환 진입점: 유닛 → 플로팅 프로필 / 지형·기본 → 하단 상태 바 */
function showInfo(u: Unit | null, x?: number, y?: number) {
  if (u) {
    showProfile(u);
    return;
  }
  clearProfile();
  setStatus(
    x !== undefined && y !== undefined
      ? `지형 — <b>${TERRAIN_LABEL[terrainAt(stage, x, y)]}</b>`
      : `🎯 ${stage.goalText}`
  );
}

function addFloat(x: number, y: number, text: string, color: string) {
  scene3d.floatText(x, y, text, color);
}

// ── 행동 메뉴 ──────────────────────────────────────────────────

interface MenuEntry {
  label: string;
  icon?: string; // public/icons/<icon>.png|.svg — 없으면 emoji로 폴백
  emoji?: string;
  sub?: string;
  disabled?: boolean;
  onClick: () => void;
}

/** 커스텀 아이콘 로드 (png → svg → 이모지 폴백) */
function makeIcon(icon: string | undefined, emoji: string | undefined): HTMLElement {
  const slot = document.createElement("span");
  slot.className = "mi";
  const fallback = () => (slot.textContent = emoji ?? "");
  if (!icon) {
    fallback();
    return slot;
  }
  const base = import.meta.env.BASE_URL;
  const img = document.createElement("img");
  img.src = `${base}icons/${icon}.png`;
  img.alt = "";
  img.onerror = () => {
    img.onerror = () => {
      img.remove();
      fallback();
    };
    img.src = `${base}icons/${icon}.svg`;
  };
  slot.appendChild(img);
  return slot;
}

function showMenu(u: Unit, entries: MenuEntry[]) {
  menuEl.innerHTML = "";
  for (const e of entries) {
    const btn = document.createElement("button");
    btn.appendChild(makeIcon(e.icon, e.emoji));
    const label = document.createElement("span");
    label.className = "ml";
    label.textContent = e.label;
    btn.appendChild(label);
    if (e.sub) {
      const sub = document.createElement("span");
      sub.className = "ms";
      sub.textContent = e.sub;
      btn.appendChild(sub);
    }
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
  setStatus(`🎯 ${stage.goalText}`);
}

function cancelToOrigin() {
  if (selected && origin) {
    selected.x = origin.x;
    selected.y = origin.y;
  }
  deselect();
}

// ── 승패 판정 (시나리오 목표별) ────────────────────────────────

function isExit(exits: [number, number][], x: number, y: number): boolean {
  return exits.some(([ex, ey]) => ex === x && ey === y);
}

const zhaoyun = () => units.find((u) => u.id === "zhaoyun");

function checkStageEnd(): boolean {
  if (stageResult) return true;
  const g = stage.goal;

  // 공통 패배: 조운 사망 / 아군 전멸
  const zy = zhaoyun();
  if ((zy && zy.hp <= 0) || alive("player").length === 0) {
    return endStage(false);
  }

  // 공통 승리: 적 전멸
  if (alive("enemy").length === 0) return endStage(true);

  if (g.type === "escort") {
    const u = units.find((v) => v.id === g.unitId);
    if (u && u.hp > 0 && isExit(g.exits, u.x, u.y)) return endStage(true);
  } else if (g.type === "capture") {
    const occupant = unitAt(g.cell[0], g.cell[1]);
    if (occupant?.side === "player") return endStage(true);
  } else if (g.type === "retreat") {
    const fielded = alive("player");
    const escapedZy = units.find((v) => v.id === "zhaoyun")?.escaped;
    if (fielded.length === 0 && escapedZy) return endStage(true);
  }
  return false;
}

/** 퇴각전: 출구에 도착한 아군은 전장을 벗어난다 */
function processEscape(u: Unit) {
  const g = stage.goal;
  if (g.type !== "retreat" || u.side !== "player") return;
  if (isExit(g.exits, u.x, u.y)) {
    u.escaped = true;
    addFloat(u.x, u.y, `${u.name} 퇴각!`, "#8fd0ff");
  }
}

function endStage(win: boolean): boolean {
  phase = "over";
  stageResult = win ? "win" : "lose";
  hideMenu();
  void scene3d.releaseFocus(0.4);
  void (async () => {
    await banner(win ? stage.winText : stage.loseText, 2600);
    if (win) {
      // 생존 영웅 상태 저장 (전사한 영웅은 다음 장에서 이전 상태로 복귀)
      for (const u of units) {
        if (u.side === "player" && u.hp > 0) saveHero(u);
      }
      if (stageIndex + 1 < CAMPAIGN.length) {
        await banner("… 다음 장으로 …", 1400);
        loadStage(stageIndex + 1);
      } else {
        stageResult = "clear";
        bannerHold("🏆 조운전 完 — 모든 시나리오를 클리어했습니다!\n(클릭하면 처음부터 다시)");
      }
    } else {
      bannerHold("패배 — 화면을 클릭하면 이 장을 다시 시작합니다");
    }
  })();
  return true;
}

// ── 레벨업 ─────────────────────────────────────────────────────

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
  processEscape(u);
  processLevelUps();
  deselect();
  if (u.escaped) clearProfile();
  else showProfile(u);
  if (checkStageEnd()) return;
  if (alive("player").every((p) => p.acted)) void startEnemyPhase();
}

// ── 범위 계산 ──────────────────────────────────────────────────

function enemiesInWeaponRange(u: Unit): Set<string> {
  const out = new Set<string>();
  for (const c of attackCells(stage, u.x, u.y, JOBS[u.job].range)) {
    const t = unitAt(c.x, c.y);
    if (t && t.side !== u.side) out.add(key(c.x, c.y));
  }
  return out;
}

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

function enemiesWithin(u: Unit, dist: number): Unit[] {
  return alive(u.side === "player" ? "enemy" : "player").filter(
    (t) => manhattan(t, u) <= dist
  );
}

// ── 행동 메뉴 구성 ─────────────────────────────────────────────

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
      label: "공격",
      icon: "attack",
      emoji: "⚔",
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
            label: ult.name.split("(")[0],
            icon: "ultimate",
            emoji: "⚡",
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
      label: "책략",
      icon: "strategy",
      emoji: "📜",
      disabled: usableSpells.length === 0,
      onClick: () => openSpellMenu(u),
    },
    {
      label: "아이템",
      icon: "item",
      emoji: "🎒",
      disabled: u.items.length === 0,
      onClick: () => openItemMenu(u),
    },
    {
      label: "대기",
      icon: "wait",
      emoji: "🚩",
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
      icon: `spell_${s.id}`,
      emoji: s.kind === "heal" ? "✚" : "📜",
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
  entries.push({ label: "돌아가기", icon: "back", emoji: "←", onClick: () => openActionMenu(u) });
  showMenu(u, entries);
}

function openItemMenu(u: Unit) {
  const entries: MenuEntry[] = u.items.map((id, idx) => {
    const it = ITEMS[id];
    return {
      label: it.name,
      icon: `item_${it.id}`,
      emoji: "🧪",
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
  entries.push({ label: "돌아가기", icon: "back", emoji: "←", onClick: () => openActionMenu(u) });
  showMenu(u, entries);
}

// ── 필살기 ─────────────────────────────────────────────────────

async function doUltimate(u: Unit, ult: Ultimate, target: Unit | null) {
  mode = "busy";
  targetCells = null;
  u.rage = 0;
  await scene3d.focusOn(u.x, u.y, 2.2, 0.45);
  await banner(`⚡ ${ult.name} ⚡`, 800);

  if (ult.kind === "buff") {
    const allies = alive(u.side).filter((a) => manhattan(a, u) <= 3);
    for (const a of allies) {
      a.buff = { pct: 0.3, turns: 2 };
      addFloat(a.x, a.y, "공격력 +30%!", "#ffd24d");
      await sleep(120);
    }
  } else if (ult.kind === "strike" && target) {
    await scene3d.attackAnim(u, target, 1.5);
    const hit = ultimateStrike(stage, u, target, 2.8, true, units);
    addFloat(target.x, target.y, `-${hit.damage}!!`, "#ffd24d");
    if (hit.killed) addFloat(target.x, target.y, "격파!", "#ff8080");
  } else if (ult.kind === "volley") {
    const targets = enemiesWithin(u, 3);
    if (targets.length > 0) {
      await scene3d.attackAnim(u, targets[0], 1.2);
      for (const t of targets) {
        const hit = ultimateStrike(stage, u, t, 0.9, false, units);
        addFloat(t.x, t.y, `-${hit.damage}`, "#ffd24d");
        if (hit.killed) addFloat(t.x, t.y, "격파!", "#ff8080");
        await sleep(180);
      }
    }
  }

  await sleep(400);
  await scene3d.releaseFocus();
  finishAction(u);
}

// ── 전투 실행 ──────────────────────────────────────────────────

async function doAttack(attacker: Unit, defender: Unit) {
  mode = "busy";
  targetCells = null;
  await scene3d.focusOn(
    (attacker.x + defender.x) / 2,
    (attacker.y + defender.y) / 2,
    1.7,
    0.35
  );
  await scene3d.attackAnim(attacker, defender);
  const hits = attackExchange(stage, attacker, defender, units);
  let first = true;
  for (const h of hits) {
    if (h.counter) {
      await sleep(300);
      await scene3d.attackAnim(defender, attacker);
    } else if (!first) {
      await sleep(250);
      await scene3d.attackAnim(attacker, defender);
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
  await scene3d.releaseFocus(0.45);
  finishAction(attacker);
}

async function doSpell(caster: Unit, spell: Spell, target: Unit) {
  mode = "busy";
  targetCells = null;
  await scene3d.focusOn((caster.x + target.x) / 2, (caster.y + target.y) / 2, 1.7, 0.35);
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
  await scene3d.releaseFocus(0.45);
  finishAction(caster);
}

// ── 적 AI ──────────────────────────────────────────────────────

async function startEnemyPhase() {
  phase = "enemy";
  deselect();
  await banner("적군 페이즈");

  for (const e of alive("enemy")) {
    if (phase !== "enemy") return;
    await scene3d.focusOn(e.x, e.y, 1.45, 0.4);
    await enemyAct(e);
    processLevelUps();
    await sleep(350);
    if (checkStageEnd()) return;
  }
  await scene3d.releaseFocus();

  turn++;
  for (const u of units) {
    u.acted = false;
    if (u.buff && --u.buff.turns <= 0) {
      if (u.hp > 0) addFloat(u.x, u.y, "버프 종료", "#9aa3b5");
      delete u.buff;
    }
  }

  // 방어전: 버텨낸 턴 수 달성 → 승리
  if (stage.goal.type === "defend" && turn > stage.goal.turns) {
    endStage(true);
    return;
  }
  // 퇴각전: 제한 턴 초과 → 패배
  if (stage.goal.type === "retreat" && turn > stage.goal.turnLimit) {
    endStage(false);
    return;
  }

  phase = "player";
  const limit =
    stage.goal.type === "defend"
      ? ` / ${stage.goal.turns}`
      : stage.goal.type === "retreat"
        ? ` / ${stage.goal.turnLimit}`
        : "";
  await banner(`${turn}턴${limit} 아군 페이즈`);
}

async function enemyAct(e: Unit) {
  const players = alive("player");
  if (players.length === 0) return;

  const range = movementRange(stage, units, e);
  const reachable = (cell: string) => {
    const [cx, cy] = cell.split(",").map(Number);
    return !unitAt(cx, cy) || (cx === e.x && cy === e.y);
  };

  // 1) 책략 우선
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

  // 2) 물리 공격
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

  // 3) 접근
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

// ── 입력 연결 (스테이지마다 새 캔버스에 다시 연결) ─────────────

function wireSceneInput() {
  scene3d.domElement.addEventListener("click", (e) => {
    if (scene3d.consumeDrag()) return;

    // 결과 화면 클릭: 재도전 / 처음부터
    if (phase === "over") {
      if (stageResult === "lose") {
        bannerEl.classList.remove("show");
        heroState.clear();
        for (const [id, s] of entrySnapshot) heroState.set(id, { ...s, items: [...s.items] });
        loadStage(stageIndex);
      } else if (stageResult === "clear") {
        bannerEl.classList.remove("show");
        heroState.clear();
        loadStage(0);
      }
      return;
    }

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
          openActionMenu(selected);
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
        cancelToOrigin();
        return;
      }
      case "attackSelect": {
        if (!selected) return;
        const target = unitAt(x, y);
        if (target && targetCells?.has(key(x, y))) {
          void doAttack(selected, target);
        } else {
          openActionMenu(selected);
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

  scene3d.domElement.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (phase !== "player" || mode === "busy" || !selected) return;
    cancelToOrigin();
  });

  scene3d.domElement.addEventListener("mousemove", (e) => {
    if (mode !== "spellSelect" || !selected || !pendingSpell) return;
    const cell = scene3d.pick(e);
    if (!cell) return;
    const t = unitAt(cell.x, cell.y);
    if (t && targetCells?.has(key(cell.x, cell.y)) && pendingSpell.kind === "damage") {
      setStatus(`<b>${pendingSpell.name}</b> → ${t.name} ·
        명중률 <b>${spellHitChance(selected, t)}%</b> ·
        예상 위력 ≈ ${Math.max(1, Math.round(selected.int * pendingSpell.power - t.int * 0.5))}`);
    }
  });
}

// ── 전역 UI (1회 연결) ─────────────────────────────────────────

endTurnBtn.addEventListener("click", () => {
  if (phase !== "player" || mode === "busy") return;
  for (const u of alive("player")) u.acted = true;
  void startEnemyPhase();
});

const settingsEl = document.getElementById("settings")!;
function toggleSettings(open: boolean) {
  settingsEl.hidden = !open;
}
document.getElementById("settings-close")!.addEventListener("click", () => toggleSettings(false));
settingsEl.addEventListener("click", (e) => {
  if (e.target === settingsEl) toggleSettings(false);
});
window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!settingsEl.hidden) {
    toggleSettings(false);
    return;
  }
  if (phase === "player" && mode !== "busy" && mode !== "idle") {
    cancelToOrigin();
    return;
  }
  toggleSettings(true);
});

// ── 렌더 루프 ──────────────────────────────────────────────────

function frame() {
  const highlights: Highlight[] = [];
  if (moveRange)
    highlights.push({ cells: new Set(moveRange.keys()), color: 0x5096ff, opacity: 0.45 });
  if (targetCells) highlights.push({ cells: targetCells, ...targetStyle });

  // 목표 지점 표시 (출구·점령지)
  const g = stage.goal;
  const goalCells = new Set<string>();
  if (g.type === "escort" || g.type === "retreat") {
    for (const [ex, ey] of g.exits) goalCells.add(key(ex, ey));
  } else if (g.type === "capture") {
    goalCells.add(key(g.cell[0], g.cell[1]));
  }
  if (goalCells.size > 0)
    highlights.push({ cells: goalCells, color: 0x8fd0ff, opacity: 0.35 });

  scene3d.setHighlights(highlights);
  scene3d.setCursor(cursor);
  scene3d.syncUnits(units, selected);
  scene3d.render();
  positionProfile(); // 프로필 카드가 유닛·카메라를 따라감
  requestAnimationFrame(frame);
}

// ── 스테이지 로드 ──────────────────────────────────────────────

function loadStage(idx: number) {
  stageIndex = idx;
  stage = CAMPAIGN[idx];
  stageResult = null;
  turn = 1;
  phase = "player";
  deselect();
  cursor = null;

  // 재도전용 스냅샷
  entrySnapshot = new Map();
  for (const [id, s] of heroState) entrySnapshot.set(id, { ...s, items: [...s.items] });

  // 유닛 구성: 영웅(계승) + 적군
  units = [
    ...stage.heroSpawns.map((h) => makeHeroUnit(h.id, h.x, h.y)),
    ...stage.units.map((u) => ({
      ...u,
      spells: [...u.spells],
      items: [...u.items],
      hp: u.maxHp,
      mp: u.maxMp,
      acted: false,
      rage: 0,
      level: u.level ?? 1,
      exp: 0,
    })),
  ];

  // 씬 재구성
  if (scene3d) scene3d.dispose();
  scene3d = new Scene3D(wrap, stage);
  wireSceneInput();

  document.getElementById("stage-name")!.textContent = `${stage.name} · ${stage.subtitle}`;
  clearProfile();
  setStatus(`🎯 ${stage.goalText}`);

  void (async () => {
    for (const line of stage.intro) await banner(line, 2000);
    await banner(`🎯 ${stage.goalText}`, 2600);
    await banner(`1턴 아군 페이즈`, 1100);
  })();
}

// ── 시작 ───────────────────────────────────────────────────────

(() => {
  // 대기 화면 없이 즉시 시작 — 고품질 모델은 백그라운드 로드 후 교체 반영
  const assetsReady = loadAssets().catch(() => {});

  loadStage(0);
  frame();

  void assetsReady.then(() => {
    scene3d.invalidateViews();
    scene3d.refreshDecor();
  });

  // 디버그: ?stage=N / ?zoom= / ?select / ?settings
  const q = new URLSearchParams(location.search);
  const st = q.get("stage");
  if (st) loadStage(Math.max(0, Math.min(CAMPAIGN.length - 1, Number(st))));
  if (q.has("select")) showInfo(units[0]);
  if (q.has("menu")) {
    // 디버그: 행동 메뉴 미리보기
    selected = units[0];
    origin = { x: units[0].x, y: units[0].y };
    openActionMenu(units[0]);
  }
  if (q.has("settings")) toggleSettings(true);
  const zm = q.get("zoom");
  if (zm) scene3d.setView(Number(zm), Number(q.get("px") ?? 0), Number(q.get("pz") ?? 0));
})();
