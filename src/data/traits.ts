// ── 캐릭터 고유 특성 (패시브) ───────────────────────────────────
// 로직은 core/battle.ts에서 trait id로 분기한다.

export interface Trait {
  id: string;
  name: string;
  desc: string;
}

export const TRAITS: Record<string, Trait> = {
  charisma: {
    id: "charisma",
    name: "패왕의 카리스마",
    desc: "2칸 이내 아군의 공격 데미지 +15%",
  },
  oneEyed: {
    id: "oneEyed",
    name: "외눈의 맹장",
    desc: "잃은 HP에 비례해 공격 데미지 증가 (최대 +50%)",
  },
  rapidShot: {
    id: "rapidShot",
    name: "신궁",
    desc: "공격 시 25% 확률로 연속 사격 (2발째 위력 60%)",
  },
  zealot: {
    id: "zealot",
    name: "태평도 광신",
    desc: "책략 위력 +20%",
  },
};
