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
    {
      id: "caocao", name: "조조", title: "난세의 효웅", side: "player", cls: "leader",
      maxHp: 50, maxMp: 22, atk: 22, def: 10, int: 24, mov: 5, range: [1, 1],
      spells: ["fire", "heal"], items: ["potion"], x: 1, y: 8,
    },
    {
      id: "xiahoudun", name: "하후돈", title: "외눈의 맹장", side: "player", cls: "infantry",
      maxHp: 58, maxMp: 6, atk: 21, def: 13, int: 10, mov: 4, range: [1, 1],
      spells: [], items: ["potion", "herb"], x: 0, y: 7,
    },
    {
      id: "xiahouyuan", name: "하후연", title: "질풍의 신궁", side: "player", cls: "archer",
      maxHp: 46, maxMp: 8, atk: 19, def: 7, int: 14, mov: 4, range: [2, 2],
      spells: [], items: ["herb"], x: 2, y: 9,
    },
    // ── 적군 ──
    {
      id: "yb1", name: "황건적", title: "황건의 무리", side: "enemy", cls: "infantry",
      maxHp: 40, maxMp: 0, atk: 15, def: 8, int: 5, mov: 4, range: [1, 1],
      spells: [], items: [], x: 8, y: 3,
    },
    {
      id: "yb2", name: "황건적", title: "황건의 무리", side: "enemy", cls: "infantry",
      maxHp: 40, maxMp: 0, atk: 15, def: 8, int: 5, mov: 4, range: [1, 1],
      spells: [], items: [], x: 9, y: 5,
    },
    {
      id: "yb3", name: "황건기병", title: "황건의 무리", side: "enemy", cls: "cavalry",
      maxHp: 42, maxMp: 0, atk: 17, def: 7, int: 5, mov: 6, range: [1, 1],
      spells: [], items: [], x: 10, y: 2,
    },
    {
      id: "yb4", name: "황건궁병", title: "황건의 무리", side: "enemy", cls: "archer",
      maxHp: 35, maxMp: 0, atk: 16, def: 5, int: 6, mov: 4, range: [2, 2],
      spells: [], items: [], x: 8, y: 4,
    },
    {
      id: "yb5", name: "황건도사", title: "태평도의 술사", side: "enemy", cls: "sorcerer",
      maxHp: 32, maxMp: 18, atk: 9, def: 4, int: 18, mov: 4, range: [1, 1],
      spells: ["dark"], items: [], x: 9, y: 3,
    },
  ],
  winText: "승리! 영천을 구원했다.",
  loseText: "패배… 조조군은 물러났다.",
};
