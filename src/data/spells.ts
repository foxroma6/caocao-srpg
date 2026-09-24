// ── 책략 데이터 ─────────────────────────────────────────────────

export interface Spell {
  id: string;
  name: string;
  kind: "damage" | "heal";
  mp: number; // 소모 MP
  power: number; // 위력 계수 (지력에 곱해짐)
  range: [number, number]; // 사거리 [min, max] (0이면 자신 포함)
  desc: string;
}

export const SPELLS: Record<string, Spell> = {
  fire: {
    id: "fire",
    name: "화계",
    kind: "damage",
    mp: 5,
    power: 1.3,
    range: [1, 2],
    desc: "불길로 적을 태운다. 지력이 높을수록 강력하다.",
  },
  water: {
    id: "water",
    name: "수계",
    kind: "damage",
    mp: 7,
    power: 1.6,
    range: [1, 2],
    desc: "물길을 터뜨려 적을 휩쓴다.",
  },
  heal: {
    id: "heal",
    name: "회복",
    kind: "heal",
    mp: 4,
    power: 1.8,
    range: [0, 2],
    desc: "아군의 부상을 치료한다.",
  },
  dark: {
    id: "dark",
    name: "요술",
    kind: "damage",
    mp: 5,
    power: 1.2,
    range: [1, 2],
    desc: "괴이한 술법으로 정신을 어지럽힌다.",
  },
};
