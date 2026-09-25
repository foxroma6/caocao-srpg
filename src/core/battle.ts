import { Stage, Unit, terrainGuard } from "./types";
import { manhattan, terrainAt } from "./grid";
import { JOBS, affinity } from "../data/jobs";
import { Spell } from "../data/spells";
import { Item } from "../data/items";

// ── 물리 공격 ──────────────────────────────────────────────────

export interface Hit {
  target: Unit;
  damage: number;
  killed: boolean;
  counter: boolean; // 반격 여부
  tags: string[]; // 발동한 특성 표시 ("맹장!" 등) — 타격자 위에 띄운다
}

/** 기력 획득 (최대 100) */
export function gainRage(u: Unit, amount: number) {
  u.rage = Math.min(100, u.rage + amount);
}

/** 특성에 의한 물리 데미지 배율 (타격자 기준) */
function traitBonus(attacker: Unit, allUnits?: Unit[]): { mult: number; tags: string[] } {
  let mult = 1;
  const tags: string[] = [];

  // 공격력 버프 (패왕령 등)
  if (attacker.buff && attacker.buff.turns > 0) {
    mult *= 1 + attacker.buff.pct;
  }

  // 외눈의 맹장: 잃은 HP 비율에 비례해 강해진다 (최대 +50%)
  if (attacker.trait === "oneEyed") {
    const lost = 1 - attacker.hp / attacker.maxHp;
    if (lost > 0) {
      mult += 0.5 * lost;
      if (lost >= 0.4) tags.push("맹장!");
    }
  }

  // 패왕의 카리스마: 2칸 이내에 카리스마 보유 아군이 있으면 +15%
  if (allUnits) {
    for (const a of allUnits) {
      if (
        a.hp > 0 &&
        a !== attacker &&
        a.side === attacker.side &&
        a.trait === "charisma" &&
        manhattan(a, attacker) <= 2
      ) {
        mult += 0.15;
        tags.push("카리스마!");
        break;
      }
    }
  }
  return { mult, tags };
}

/** 물리 데미지 = (공격력 × 상성 × 지형계수) − 방어력, 특성 배율, ±10% 난수, 최소 1 */
function calcHit(
  stage: Stage,
  attacker: Unit,
  defender: Unit,
  allUnits: Unit[] | undefined,
  scale: number
): { damage: number; tags: string[] } {
  const aff = affinity(JOBS[attacker.job].category, JOBS[defender.job].category);
  const guard = terrainGuard(terrainAt(stage, defender.x, defender.y));
  const base = attacker.atk * aff * guard - defender.def;
  const { mult, tags } = traitBonus(attacker, allUnits);
  const variance = 0.9 + Math.random() * 0.2;
  return { damage: Math.max(1, Math.round(base * mult * scale * variance)), tags };
}

/**
 * 공격 실행. 하후연류 특성은 연속 사격이 발생할 수 있고,
 * 방어자가 생존해 있으며 공격자가 방어자의 무기 사거리 안이면
 * 반격이 발생한다 (위력 75%).
 */
export function attackExchange(
  stage: Stage,
  attacker: Unit,
  defender: Unit,
  allUnits?: Unit[]
): Hit[] {
  const hits: Hit[] = [];

  const strike = (scale: number, extraTag?: string) => {
    const { damage, tags } = calcHit(stage, attacker, defender, allUnits, scale);
    defender.hp = Math.max(0, defender.hp - damage);
    if (extraTag) tags.unshift(extraTag);
    const killed = defender.hp === 0;
    gainRage(attacker, killed ? 50 : 30);
    gainRage(defender, 20);
    hits.push({ target: defender, damage, killed, counter: false, tags });
  };

  strike(1);

  // 신궁: 25% 확률로 연속 사격
  if (attacker.trait === "rapidShot" && defender.hp > 0 && Math.random() < 0.25) {
    strike(0.6, "연사!");
  }

  // 반격 (방어자 특성도 적용)
  if (defender.hp > 0) {
    const d = manhattan(attacker, defender);
    const [lo, hi] = JOBS[defender.job].range;
    if (d >= lo && d <= hi) {
      const { damage, tags } = calcHit(stage, defender, attacker, allUnits, 0.75);
      attacker.hp = Math.max(0, attacker.hp - damage);
      gainRage(defender, 10);
      gainRage(attacker, 15);
      hits.push({ target: attacker, damage, killed: attacker.hp === 0, counter: true, tags });
    }
  }
  return hits;
}

// ── 책략 ───────────────────────────────────────────────────────

export interface SpellResult {
  missed: boolean;
  amount: number; // 데미지 또는 회복량
  killed: boolean;
  tags: string[];
}

/** 책략 명중률: 지력 차이 기반. 회복은 항상 성공 */
export function spellHitChance(caster: Unit, target: Unit): number {
  return Math.min(95, Math.max(30, 65 + (caster.int - target.int) * 2));
}

/**
 * 책략 사용. 데미지 = 지력 × 위력 − 대상 지력 × 0.5 (지형 무시, 반격 없음).
 * 회복 = 지력 × 위력.
 */
export function castSpell(caster: Unit, spell: Spell, target: Unit): SpellResult {
  caster.mp -= spell.mp;
  gainRage(caster, 15);
  const tags: string[] = [];

  if (spell.kind === "heal") {
    const amount = Math.round(caster.int * spell.power);
    const healed = Math.min(amount, target.maxHp - target.hp);
    target.hp += healed;
    return { missed: false, amount: healed, killed: false, tags };
  }

  if (Math.random() * 100 > spellHitChance(caster, target)) {
    return { missed: true, amount: 0, killed: false, tags };
  }

  // 태평도 광신: 책략 위력 +20%
  let mult = 1;
  if (caster.trait === "zealot") {
    mult = 1.2;
    tags.push("광신!");
  }

  const variance = 0.9 + Math.random() * 0.2;
  const amount = Math.max(
    1,
    Math.round((caster.int * spell.power - target.int * 0.5) * mult * variance)
  );
  target.hp = Math.max(0, target.hp - amount);
  gainRage(target, 15);
  return { missed: false, amount, killed: target.hp === 0, tags };
}

// ── 필살기 ─────────────────────────────────────────────────────

export interface UltHit {
  damage: number;
  killed: boolean;
}

/**
 * 필살기 타격: 위력 배율 적용, 반격 없음.
 * ignoreGuard=true면 지형 방어를 무시한다. 특성·버프 배율도 적용.
 */
export function ultimateStrike(
  stage: Stage,
  attacker: Unit,
  defender: Unit,
  scale: number,
  ignoreGuard: boolean,
  allUnits?: Unit[]
): UltHit {
  const aff = affinity(JOBS[attacker.job].category, JOBS[defender.job].category);
  const guard = ignoreGuard ? 1 : terrainGuard(terrainAt(stage, defender.x, defender.y));
  const { mult } = traitBonus(attacker, allUnits);
  const variance = 0.9 + Math.random() * 0.2;
  const damage = Math.max(
    1,
    Math.round((attacker.atk * aff * guard - defender.def * 0.6) * mult * scale * variance)
  );
  defender.hp = Math.max(0, defender.hp - damage);
  gainRage(defender, 15);
  return { damage, killed: defender.hp === 0 };
}

// ── 아이템 ─────────────────────────────────────────────────────

export interface ItemResult {
  hpGain: number;
  mpGain: number;
}

/** 아이템 사용 (자신에게). 사용 후 소지품에서 제거는 호출측 책임 */
export function useItem(user: Unit, item: Item): ItemResult {
  const hpGain = item.heal ? Math.min(item.heal, user.maxHp - user.hp) : 0;
  const mpGain = item.mp ? Math.min(item.mp, user.maxMp - user.mp) : 0;
  user.hp += hpGain;
  user.mp += mpGain;
  return { hpGain, mpGain };
}
