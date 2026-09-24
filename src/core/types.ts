// ── 기본 타입 정의 ──────────────────────────────────────────────

export type Side = "player" | "enemy";

/** 병종: 기병 > 보병 > 궁병 > 기병 상성. 책사/군주는 상성 중립 */
export type UnitClass = "cavalry" | "infantry" | "archer" | "leader" | "sorcerer";

/** 지형 타입 */
export type Terrain = "plain" | "forest" | "mountain" | "fort";

export interface UnitData {
  id: string;
  name: string; // 표시 이름 (예: 조조)
  title: string; // 칭호 (예: 난세의 효웅)
  side: Side;
  cls: UnitClass;
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  int: number; // 지력: 책략 위력·명중·저항
  mov: number; // 이동력
  range: [number, number]; // 무기 사거리 [min, max]
  spells: string[]; // 사용 가능한 책략 id 목록
  items: string[]; // 소지 아이템 id 목록
  x: number;
  y: number;
}

export interface Unit extends UnitData {
  hp: number;
  mp: number;
  acted: boolean; // 이번 턴 행동 완료 여부
}

export interface Stage {
  name: string;
  width: number;
  height: number;
  /** height 행 × width 열, 문자 코드로 지형 표기 (.=평지 f=숲 m=산 F=성채) */
  tiles: string[];
  units: UnitData[];
  winText: string;
  loseText: string;
}

export const TERRAIN_CODE: Record<string, Terrain> = {
  ".": "plain",
  f: "forest",
  m: "mountain",
  F: "fort",
};

/** 지형별 이동 비용 (Infinity = 진입 불가) */
export function moveCost(t: Terrain, cls: UnitClass): number {
  switch (t) {
    case "plain":
      return 1;
    case "forest":
      return cls === "cavalry" ? 3 : 2;
    case "mountain":
      return cls === "cavalry" ? Infinity : 3;
    case "fort":
      return 1;
  }
}

/** 지형별 받는 물리 피해 계수 (낮을수록 방어에 유리). 책략은 지형 무시 */
export function terrainGuard(t: Terrain): number {
  switch (t) {
    case "plain":
      return 1.0;
    case "forest":
      return 0.85;
    case "mountain":
      return 0.7;
    case "fort":
      return 0.6;
  }
}

/** 병종 상성 계수: attacker → defender */
export function affinity(a: UnitClass, d: UnitClass): number {
  const beats: Record<string, string> = {
    cavalry: "infantry",
    infantry: "archer",
    archer: "cavalry",
  };
  if (beats[a] === d) return 1.25;
  if (beats[d] === a) return 0.8;
  return 1.0;
}

export const CLASS_LABEL: Record<UnitClass, string> = {
  cavalry: "기병",
  infantry: "보병",
  archer: "궁병",
  leader: "군주",
  sorcerer: "책사",
};

export const TERRAIN_LABEL: Record<Terrain, string> = {
  plain: "평지",
  forest: "숲",
  mountain: "산",
  fort: "성채",
};
