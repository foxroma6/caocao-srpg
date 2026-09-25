// ── 직업(병과) 데이터: 조조전 직업 체계 기반 ────────────────────

/** 상성 계열: 기병 > 보병 > 궁병 > 기병. special은 중립 */
export type JobCategory = "infantry" | "cavalry" | "archer" | "special";

/** 스프라이트 종류 (렌더링용) */
export type SpriteKind =
  | "lord" // 군주 (백마 + 왕관 + 망토)
  | "guard" // 친위대 (중갑 + 창 + 방패)
  | "horsearcher" // 궁기병 (말 + 활)
  | "bandit" // 황건적 (노란 두건 + 몽둥이창)
  | "banditcav" // 적기병 (말 + 창 + 노란 두건)
  | "banditarcher" // 적궁병 (활 + 노란 두건)
  | "taoist"; // 도사 (노란 두건 로브 + 지팡이)

/** 레벨업 시 스탯 성장 기대값 (실제 성장은 0.6~1.4배 랜덤) */
export interface Growth {
  hp: number;
  mp: number;
  atk: number;
  def: number;
  int: number;
}

export interface Job {
  id: string;
  name: string;
  category: JobCategory;
  mounted: boolean; // 기마: 산 진입 불가, 숲 이동 비용 증가
  range: [number, number]; // 무기 사거리 [min, max]
  sprite: SpriteKind;
  growth: Growth;
  desc: string;
}

export const JOBS: Record<string, Job> = {
  lord: {
    id: "lord", name: "군주", category: "special", mounted: true,
    range: [1, 1], sprite: "lord",
    growth: { hp: 4.5, mp: 2, atk: 1.5, def: 1, int: 1.6 },
    desc: "군을 이끄는 총대장. 상성 중립. 쓰러지면 패배한다.",
  },
  guard: {
    id: "guard", name: "친위대", category: "infantry", mounted: false,
    range: [1, 1], sprite: "guard",
    growth: { hp: 6, mp: 0.6, atk: 1.6, def: 1.6, int: 0.5 },
    desc: "군주를 지키는 중갑 보병. 방어가 뛰어나다.",
  },
  horsearcher: {
    id: "horsearcher", name: "궁기병", category: "archer", mounted: true,
    range: [1, 2], sprite: "horsearcher",
    growth: { hp: 4.5, mp: 1, atk: 1.6, def: 0.9, int: 1.1 },
    desc: "말 위에서 활을 쏘는 유격병. 기동력과 사거리를 겸비.",
  },
  bandit: {
    id: "bandit", name: "황건적", category: "infantry", mounted: false,
    range: [1, 1], sprite: "bandit",
    growth: { hp: 4, mp: 0.3, atk: 1.2, def: 1, int: 0.4 },
    desc: "황건을 두른 반란군 보병.",
  },
  banditcav: {
    id: "banditcav", name: "적기병", category: "cavalry", mounted: true,
    range: [1, 1], sprite: "banditcav",
    growth: { hp: 4, mp: 0.3, atk: 1.4, def: 0.9, int: 0.4 },
    desc: "황건군의 기마대. 돌격이 매섭다.",
  },
  banditarcher: {
    id: "banditarcher", name: "적궁병", category: "archer", mounted: false,
    range: [2, 2], sprite: "banditarcher",
    growth: { hp: 3.5, mp: 0.5, atk: 1.3, def: 0.7, int: 0.6 },
    desc: "황건군의 궁수. 멀리서 화살을 퍼붓는다.",
  },
  taoist: {
    id: "taoist", name: "도사", category: "special", mounted: false,
    range: [1, 1], sprite: "taoist",
    growth: { hp: 3, mp: 2.5, atk: 0.6, def: 0.6, int: 1.8 },
    desc: "태평도의 술법사. 요술로 공격한다.",
  },
};

/** 병종 상성 계수: attacker 계열 → defender 계열 */
export function affinity(a: JobCategory, d: JobCategory): number {
  const beats: Record<string, string> = {
    cavalry: "infantry",
    infantry: "archer",
    archer: "cavalry",
  };
  if (beats[a] === d) return 1.25;
  if (beats[d] === a) return 0.8;
  return 1.0;
}

export const CATEGORY_LABEL: Record<JobCategory, string> = {
  infantry: "보병계",
  cavalry: "기병계",
  archer: "궁병계",
  special: "특수",
};
