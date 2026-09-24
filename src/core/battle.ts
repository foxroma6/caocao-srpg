import { Stage, Unit, affinity, terrainGuard } from "./types";
import { terrainAt } from "./grid";

export interface CombatResult {
  damage: number;
  killed: boolean;
}

/** 데미지 = (공격력 × 상성 × 지형계수) − 방어력, ±10% 난수, 최소 1 */
export function calcDamage(stage: Stage, attacker: Unit, defender: Unit): number {
  const aff = affinity(attacker.cls, defender.cls);
  const guard = terrainGuard(terrainAt(stage, defender.x, defender.y));
  const base = attacker.atk * aff * guard - defender.def;
  const variance = 0.9 + Math.random() * 0.2;
  return Math.max(1, Math.round(base * variance));
}

export function attack(stage: Stage, attacker: Unit, defender: Unit): CombatResult {
  const damage = calcDamage(stage, attacker, defender);
  defender.hp = Math.max(0, defender.hp - damage);
  return { damage, killed: defender.hp === 0 };
}
