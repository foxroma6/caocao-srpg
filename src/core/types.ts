// ── 기본 타입 정의 ──────────────────────────────────────────────

export type Side = "player" | "enemy";

/** 지형 타입 */
export type Terrain = "plain" | "forest" | "mountain" | "fort";

export interface UnitData {
  id: string;
  name: string; // 표시 이름 (예: 조조)
  job: string; // 직업 id (data/jobs.ts) — 상성·기마·사거리 결정
  side: Side;
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  int: number; // 지력: 책략 위력·명중·저항
  mov: number; // 이동력
  trait?: string; // 고유 특성 id (data/traits.ts)
  spells: string[]; // 사용 가능한 책략 id 목록
  items: string[]; // 소지 아이템 id 목록
  x: number;
  y: number;
}

export interface Unit extends UnitData {
  hp: number;
  mp: number;
  acted: boolean; // 이번 턴 행동 완료 여부
  rage: number; // 기력 (0~100): 필살기 게이지
  buff?: { pct: number; turns: number }; // 공격력 버프 (패왕령 등)
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

/** 지형별 이동 비용 (Infinity = 진입 불가). mounted = 기마 직업 */
export function moveCost(t: Terrain, mounted: boolean): number {
  switch (t) {
    case "plain":
      return 1;
    case "forest":
      return mounted ? 3 : 2;
    case "mountain":
      return mounted ? Infinity : 3;
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

export const TERRAIN_LABEL: Record<Terrain, string> = {
  plain: "평지",
  forest: "숲",
  mountain: "산",
  fort: "성채",
};
