// ── 경험치 / 레벨업 ─────────────────────────────────────────────
// 경험치는 아군만 획득한다. 100이 되면 레벨업하고 직업 성장률에
// 따라 스탯이 오른다 (기대값의 0.6~1.4배 랜덤).

import { Unit } from "./types";
import { JOBS } from "../data/jobs";

export const EXP_MAX = 100;

/**
 * 경험치 획득. 상대와의 레벨 차이에 따라 보정된다
 * (강한 적 = 더 많은 경험치, 약한 적 = 적은 경험치).
 */
export function gainExp(u: Unit, target: Unit, base: number) {
  if (u.side !== "player" || u.hp <= 0) return;
  const mult = Math.min(2, Math.max(0.3, 1 + (target.level - u.level) * 0.25));
  u.exp += Math.round(base * mult);
}

export interface StatGain {
  label: string;
  amount: number;
}

/** 레벨 1 상승을 적용하고 오른 스탯 목록을 돌려준다 */
export function applyLevelUp(u: Unit): StatGain[] {
  const g = JOBS[u.job].growth;
  const roll = (v: number) => Math.round(v * (0.6 + Math.random() * 0.8));

  const gains: StatGain[] = [];
  const add = (label: string, amount: number) => {
    if (amount > 0) gains.push({ label, amount });
  };

  const hp = Math.max(1, roll(g.hp));
  u.maxHp += hp;
  u.hp += hp; // 오른 만큼 즉시 회복
  add("HP", hp);

  const mp = roll(g.mp);
  u.maxMp += mp;
  u.mp += mp;
  add("MP", mp);

  const atk = roll(g.atk);
  u.atk += atk;
  add("공", atk);

  const def = roll(g.def);
  u.def += def;
  add("방", def);

  const int = roll(g.int);
  u.int += int;
  add("지", int);

  u.level++;
  return gains;
}
