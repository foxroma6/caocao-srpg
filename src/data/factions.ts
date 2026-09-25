// ── 세력(국가) 데이터 ───────────────────────────────────────────
// 유닛 발밑의 원형 베이스 색과 정보 패널의 세력 칩에 사용된다.

export interface Faction {
  id: string;
  name: string;
  hanja: string;
  color: number; // three.js용
  colorCss: string; // DOM용
}

export const FACTIONS: Record<string, Faction> = {
  wei: { id: "wei", name: "위", hanja: "魏", color: 0x3d6ad4, colorCss: "#3d6ad4" },
  shu: { id: "shu", name: "촉", hanja: "蜀", color: 0x3da45a, colorCss: "#3da45a" },
  wu: { id: "wu", name: "오", hanja: "吳", color: 0xc43131, colorCss: "#c43131" },
  yellow: { id: "yellow", name: "황건", hanja: "黃", color: 0xd8b62a, colorCss: "#d8b62a" },
  none: { id: "none", name: "재야", hanja: "在", color: 0x8a8f9a, colorCss: "#8a8f9a" },
};

export function factionOf(id: string | undefined): Faction {
  return FACTIONS[id ?? "none"] ?? FACTIONS.none;
}
