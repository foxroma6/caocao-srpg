import {
  Stage,
  Terrain,
  TERRAIN_CODE,
  Unit,
  UnitClass,
  moveCost,
} from "./types";

export interface Cell {
  x: number;
  y: number;
}

export const key = (x: number, y: number) => `${x},${y}`;

export function terrainAt(stage: Stage, x: number, y: number): Terrain {
  return TERRAIN_CODE[stage.tiles[y][x]] ?? "plain";
}

export function inBounds(stage: Stage, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < stage.width && y < stage.height;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * 이동 가능 범위 계산 (다익스트라).
 * 적 유닛이 있는 칸은 통과 불가, 아군 유닛 칸은 통과만 가능(정지 불가).
 */
export function movementRange(
  stage: Stage,
  units: Unit[],
  mover: Unit
): Map<string, number> {
  const cost = new Map<string, number>();
  const occupied = new Map<string, Unit>();
  for (const u of units) if (u.hp > 0) occupied.set(key(u.x, u.y), u);

  const frontier: [number, number, number][] = [[0, mover.x, mover.y]];
  cost.set(key(mover.x, mover.y), 0);

  while (frontier.length) {
    frontier.sort((a, b) => a[0] - b[0]);
    const [c, x, y] = frontier.shift()!;
    if (c > (cost.get(key(x, y)) ?? Infinity)) continue;

    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(stage, nx, ny)) continue;
      const blocker = occupied.get(key(nx, ny));
      if (blocker && blocker.side !== mover.side) continue; // 적은 통과 불가
      const step = moveCost(terrainAt(stage, nx, ny), mover.cls);
      const nc = c + step;
      if (nc > mover.mov) continue;
      if (nc < (cost.get(key(nx, ny)) ?? Infinity)) {
        cost.set(key(nx, ny), nc);
        frontier.push([nc, nx, ny]);
      }
    }
  }

  // 아군이 서 있는 칸은 도착지에서 제외 (자기 자신 위치는 유지)
  for (const [k, u] of occupied) {
    if (u !== mover && cost.has(k)) cost.delete(k);
  }
  return cost;
}

/** (x,y)에서 공격 가능한 칸 목록 (맨해튼 거리 기반 사거리) */
export function attackCells(
  stage: Stage,
  x: number,
  y: number,
  range: [number, number]
): Cell[] {
  const out: Cell[] = [];
  const [lo, hi] = range;
  for (let dy = -hi; dy <= hi; dy++) {
    for (let dx = -hi; dx <= hi; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < lo || d > hi) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(stage, nx, ny)) out.push({ x: nx, y: ny });
    }
  }
  return out;
}

export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
