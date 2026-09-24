// ── 아이템 데이터 ───────────────────────────────────────────────

export interface Item {
  id: string;
  name: string;
  heal?: number; // HP 회복량
  mp?: number; // MP 회복량
  desc: string;
}

export const ITEMS: Record<string, Item> = {
  potion: {
    id: "potion",
    name: "회복약",
    heal: 25,
    desc: "HP를 25 회복한다.",
  },
  herb: {
    id: "herb",
    name: "약초",
    heal: 12,
    desc: "HP를 12 회복한다.",
  },
  tea: {
    id: "tea",
    name: "명차",
    mp: 10,
    desc: "MP를 10 회복한다.",
  },
};
