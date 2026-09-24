import { Stage } from "../core/types";

/**
 * 1장 1화 「영천 구원전」
 * 황건적에게 포위당한 영천을 구원하라. 적을 모두 격파하면 승리.
 */
export const stage01: Stage = {
  name: "1화 영천 구원전",
  width: 12,
  height: 10,
  tiles: [
    "....ff......",
    "....ff...m..",
    "..........m.",
    "...f........",
    "...f....F...",
    "........F...",
    ".mm.........",
    ".mm....f....",
    ".......f....",
    "............",
  ],
  units: [
    // ── 아군 ──
    { id: "caocao",   name: "조조",   side: "player", cls: "leader",
      maxHp: 50, atk: 22, def: 10, mov: 5, range: [1, 1], x: 1, y: 8 },
    { id: "xiahoudun", name: "하후돈", side: "player", cls: "infantry",
      maxHp: 55, atk: 20, def: 12, mov: 4, range: [1, 1], x: 0, y: 7 },
    { id: "xiahouyuan", name: "하후연", side: "player", cls: "archer",
      maxHp: 45, atk: 19, def: 7,  mov: 4, range: [2, 2], x: 2, y: 9 },
    // ── 적군 ──
    { id: "yb1", name: "황건적", side: "enemy", cls: "infantry",
      maxHp: 40, atk: 15, def: 8, mov: 4, range: [1, 1], x: 8, y: 3 },
    { id: "yb2", name: "황건적", side: "enemy", cls: "infantry",
      maxHp: 40, atk: 15, def: 8, mov: 4, range: [1, 1], x: 9, y: 5 },
    { id: "yb3", name: "황건적", side: "enemy", cls: "cavalry",
      maxHp: 42, atk: 17, def: 7, mov: 6, range: [1, 1], x: 10, y: 2 },
    { id: "yb4", name: "황건궁병", side: "enemy", cls: "archer",
      maxHp: 35, atk: 16, def: 5, mov: 4, range: [2, 2], x: 8, y: 4 },
  ],
  winText: "승리! 영천을 구원했다.",
  loseText: "패배… 조조군은 물러났다.",
};
