import { Stage } from "../core/types";

/**
 * 1장 1화 「영천 구원전」 (16×12)
 * 황건적에게 포위당한 영천을 구원하라. 적을 모두 격파하면 승리.
 * 남서쪽에서 진입해 중앙 평원을 가로질러 동쪽 성채의 정원지를 친다.
 */
export const stage01: Stage = {
  name: "1화 영천 구원전",
  width: 16,
  height: 12,
  tiles: [
    "................",
    "..ff.........m..",
    "..ff..........m.",
    "......f.........",
    "...........F....",
    "......m....F....",
    "..mm..m.........",
    "..mm.......f....",
    "...........f....",
    ".f..............",
    ".f.....f........",
    "................",
  ],
  units: [
    // ── 아군 (위) ──
    {
      id: "caocao", name: "조조", job: "lord", faction: "wei", side: "player",
      maxHp: 50, maxMp: 22, atk: 22, def: 10, int: 24, mov: 5,
      trait: "charisma",
      spells: ["fire", "heal"], items: ["potion"], x: 2, y: 9,
    },
    {
      id: "xiahoudun", name: "하후돈", job: "guard", faction: "wei", side: "player",
      maxHp: 58, maxMp: 6, atk: 21, def: 13, int: 10, mov: 4,
      trait: "oneEyed",
      spells: [], items: ["potion", "herb"], x: 1, y: 8,
    },
    {
      id: "xiahouyuan", name: "하후연", job: "horsearcher", faction: "wei", side: "player",
      maxHp: 46, maxMp: 8, atk: 19, def: 7, int: 14, mov: 6,
      trait: "rapidShot",
      spells: [], items: ["herb"], x: 3, y: 10,
    },
    // ── 적군 (황건) ──
    {
      id: "yb1", name: "황건적", job: "bandit", faction: "yellow", side: "enemy",
      maxHp: 40, maxMp: 0, atk: 15, def: 8, int: 5, mov: 4,
      spells: [], items: [], x: 8, y: 3,
    },
    {
      id: "yb2", name: "황건적", job: "bandit", faction: "yellow", side: "enemy",
      maxHp: 40, maxMp: 0, atk: 15, def: 8, int: 5, mov: 4,
      spells: [], items: [], x: 9, y: 7,
    },
    {
      id: "yb6", name: "황건적", job: "bandit", faction: "yellow", side: "enemy",
      maxHp: 40, maxMp: 0, atk: 15, def: 8, int: 5, mov: 4,
      spells: [], items: [], x: 5, y: 5,
    },
    {
      id: "yb3", name: "황건기병", job: "banditcav", faction: "yellow", side: "enemy",
      maxHp: 42, maxMp: 0, atk: 17, def: 7, int: 5, mov: 6,
      spells: [], items: [], x: 13, y: 2,
    },
    {
      id: "yb4", name: "황건궁병", job: "banditarcher", faction: "yellow", side: "enemy",
      maxHp: 35, maxMp: 0, atk: 16, def: 5, int: 6, mov: 4,
      spells: [], items: [], x: 11, y: 3,
    },
    {
      id: "yb5", name: "황건도사", job: "taoist", faction: "yellow", side: "enemy",
      maxHp: 34, maxMp: 20, atk: 9, def: 4, int: 19, mov: 4,
      trait: "zealot", level: 2,
      spells: ["dark"], items: [], x: 12, y: 6,
    },
    {
      id: "boss", name: "정원지", job: "bandit", faction: "yellow", side: "enemy",
      maxHp: 56, maxMp: 6, atk: 19, def: 11, int: 8, mov: 4,
      level: 3,
      spells: [], items: [], x: 11, y: 5,
    },
  ],
  winText: "승리! 영천을 구원했다.",
  loseText: "패배… 조조군은 물러났다.",
};
