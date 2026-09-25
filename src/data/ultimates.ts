// ── 영웅 필살기 ─────────────────────────────────────────────────
// 기력(rage) 100이 되면 사용 가능. 사용 시 기력이 0으로 돌아간다.
// 기력은 공격(+30), 피격(+20), 격파(+20), 책략(+15) 등으로 쌓인다.

export interface Ultimate {
  id: string;
  name: string;
  desc: string;
  kind: "buff" | "strike" | "volley";
}

/** unit.id → 필살기 */
export const ULTIMATES: Record<string, Ultimate> = {
  caocao: {
    id: "caocao",
    name: "패왕령(覇王令)",
    desc: "3칸 이내 모든 아군의 공격력 +30% (2턴)",
    kind: "buff",
  },
  xiahoudun: {
    id: "xiahoudun",
    name: "귀신참(鬼神斬)",
    desc: "사거리 내 적 하나에게 지형을 무시하는 250% 위력의 일격",
    kind: "strike",
  },
  xiahouyuan: {
    id: "xiahouyuan",
    name: "천리연사(千里連射)",
    desc: "3칸 이내 모든 적에게 80% 위력의 화살 세례",
    kind: "volley",
  },
};

export const RAGE_MAX = 100;
