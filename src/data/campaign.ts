// ── 조운전(趙雲傳) 캠페인 ───────────────────────────────────────
// 4개 시나리오: 장판파(돌파) → 한수(방어) → 계양(점령) → 기곡(퇴각).
// 영웅의 레벨·스탯·소지품은 시나리오를 넘어 계승된다.

import { Stage, UnitData } from "../core/types";

// ── 승리 목표 ──────────────────────────────────────────────────

export type StageGoal =
  | { type: "rout" } // 적 전멸
  | { type: "escort"; unitId: string; exits: [number, number][] } // 특정 유닛이 출구 도달
  | { type: "defend"; turns: number } // N턴 생존
  | { type: "capture"; cell: [number, number] } // 지점 점령
  | { type: "retreat"; exits: [number, number][]; turnLimit: number }; // 제한 턴 내 전원 퇴각

export interface CampaignStage extends Stage {
  subtitle: string;
  goal: StageGoal;
  goalText: string;
  intro: string[]; // 시작 전 대사 (배너로 순차 표시)
  heroSpawns: { id: string; x: number; y: number }[];
}

// ── 아군 영웅 기본값 (레벨 계승의 시작점) ───────────────────────

export const HEROES: Record<string, UnitData> = {
  zhaoyun: {
    id: "zhaoyun", name: "조운", job: "lancer", faction: "shu", side: "player",
    maxHp: 52, maxMp: 12, atk: 23, def: 11, int: 15, mov: 6,
    trait: "dauntless",
    spells: [], items: ["potion"], x: 0, y: 0,
  },
  huangzhong: {
    id: "huangzhong", name: "황충", job: "horsearcher", faction: "shu", side: "player",
    maxHp: 48, maxMp: 10, atk: 22, def: 8, int: 13, mov: 5,
    trait: "rapidShot",
    spells: [], items: ["herb"], x: 0, y: 0,
  },
  jindao: {
    id: "jindao", name: "진도", job: "guard", faction: "shu", side: "player",
    maxHp: 56, maxMp: 6, atk: 19, def: 13, int: 8, mov: 4,
    spells: [], items: ["potion", "herb"], x: 0, y: 0,
  },
};

// ── 적군 유닛 헬퍼 ─────────────────────────────────────────────

let seq = 0;
function wei(
  name: string,
  job: string,
  stats: { hp: number; atk: number; def: number; int?: number; mov?: number; level?: number },
  x: number,
  y: number,
  extra: Partial<UnitData> = {}
): UnitData {
  return {
    id: `e${seq++}`,
    name,
    job,
    faction: "wei",
    side: "enemy",
    maxHp: stats.hp,
    maxMp: 0,
    atk: stats.atk,
    def: stats.def,
    int: stats.int ?? 6,
    mov: stats.mov ?? 4,
    level: stats.level ?? 1,
    spells: [],
    items: [],
    x,
    y,
    ...extra,
  };
}

// ── 시나리오 1: 장판파 (208년) — 단기돌파 ──────────────────────

const stage1: CampaignStage = {
  name: "제1장 장판파",
  subtitle: "單騎救主 — 홀로 어린 주공을 품고 적진을 뚫다",
  width: 16,
  height: 12,
  tiles: [
    "................",
    "..f......f......",
    ".ff.....ff......",
    "................",
    "....m...........",
    "....m......f....",
    "...........f....",
    "......f.........",
    "......ff........",
    "................",
    "..f.........f...",
    "................",
  ],
  goal: { type: "escort", unitId: "zhaoyun", exits: [[15, 4], [15, 5], [15, 6], [15, 7]] },
  goalText: "조운이 동쪽 끝(장판교)에 도달하면 승리 · 조운이 쓰러지면 패배",
  intro: [
    "유비군은 조조의 추격에 흩어졌다…",
    "조운 「아두님과 감부인을 두고 갈 수 없다!」",
    "적진 한가운데, 상산 조자룡의 단기돌파가 시작된다.",
  ],
  heroSpawns: [
    { id: "zhaoyun", x: 1, y: 5 },
    { id: "jindao", x: 0, y: 6 },
  ],
  units: [
    wei("조조군 보병", "guard", { hp: 42, atk: 16, def: 9 }, 5, 4),
    wei("조조군 보병", "guard", { hp: 42, atk: 16, def: 9 }, 6, 7),
    wei("조조군 보병", "guard", { hp: 42, atk: 16, def: 9 }, 9, 3),
    wei("조조군 보병", "guard", { hp: 42, atk: 16, def: 9, level: 2 }, 10, 8),
    wei("조조군 기마궁수", "horsearcher", { hp: 40, atk: 17, def: 7, mov: 6, level: 2 }, 11, 5),
    wei("조조군 기마궁수", "horsearcher", { hp: 40, atk: 17, def: 7, mov: 6, level: 2 }, 12, 7),
    wei("하후돈", "guard", { hp: 62, atk: 22, def: 13, int: 10, level: 3 }, 13, 5,
      { id: "xiahoudun", trait: "oneEyed" }),
  ],
  winText: "돌파 성공! 조운은 아두를 품에 안고 장판교를 건넜다.",
  loseText: "조운이 쓰러졌다… 장판파의 전설은 여기서 끝났다.",
};

// ── 시나리오 2: 한수 전투 (219년) — 공성계 방어 ────────────────

const stage2: CampaignStage = {
  name: "제2장 한수 전투",
  subtitle: "空營計 — 진문을 활짝 열고 조조군을 맞이하다",
  width: 16,
  height: 12,
  tiles: [
    "................",
    ".mm.............",
    ".mm.......f.....",
    "................",
    "..FF............",
    "..FF............",
    "...........m....",
    "...........m....",
    "....f...........",
    "....f...........",
    "................",
    "................",
  ],
  goal: { type: "defend", turns: 8 },
  goalText: "8턴 동안 진영을 지키면 승리 (적 전멸도 승리) · 아군 전멸·조운 사망 시 패배",
  intro: [
    "황충이 조조군의 군량을 급습하다 포위당했다.",
    "조운은 황충을 구출하고, 진영의 문을 활짝 연 채 홀로 섰다.",
    "조조 「저 담대함… 필시 복병이 있다!」 — 의심이 적을 멈추게 하리라.",
  ],
  heroSpawns: [
    { id: "zhaoyun", x: 3, y: 4 },
    { id: "huangzhong", x: 2, y: 5 },
    { id: "jindao", x: 3, y: 5 },
  ],
  units: [
    wei("조조군 보병", "guard", { hp: 50, atk: 19, def: 11, level: 3 }, 10, 3),
    wei("조조군 보병", "guard", { hp: 50, atk: 19, def: 11, level: 3 }, 11, 6),
    wei("조조군 보병", "guard", { hp: 50, atk: 19, def: 11, level: 3 }, 10, 8),
    wei("조조군 보병", "guard", { hp: 50, atk: 19, def: 11, level: 4 }, 12, 4),
    wei("조조군 기마궁수", "horsearcher", { hp: 46, atk: 20, def: 8, mov: 6, level: 4 }, 13, 7),
    wei("조조군 기마궁수", "horsearcher", { hp: 46, atk: 20, def: 8, mov: 6, level: 4 }, 13, 3),
    wei("조조군 기마궁수", "horsearcher", { hp: 46, atk: 20, def: 8, mov: 6, level: 4 }, 14, 9),
    wei("조조", "lord", { hp: 72, atk: 24, def: 12, int: 26, mov: 5, level: 5 }, 14, 5,
      { id: "caocao", trait: "charisma", maxMp: 20, spells: ["fire"] }),
  ],
  winText: "조조군이 물러간다! 「자룡의 온몸은 담덩어리다(一身是膽)!」",
  loseText: "진영이 무너졌다… 한수의 물이 붉게 물들었다.",
};

// ── 시나리오 3: 계양 공략 (209년) — 공성 점령 ──────────────────

const stage3: CampaignStage = {
  name: "제3장 계양 공략",
  subtitle: "桂陽平定 — 형남 사군, 성문을 열게 하라",
  width: 16,
  height: 12,
  tiles: [
    "................",
    "....f...........",
    "....f...........",
    "..........mmm...",
    ".........m......",
    "..f......m.FF...",
    ".........m.FF...",
    "..........mmm...",
    "................",
    ".f..............",
    "................",
    "................",
  ],
  goal: { type: "capture", cell: [12, 6] },
  goalText: "아군이 계양성 본성(성채 깃발 지점)에 서면 점령 승리",
  intro: [
    "적벽 이후, 유비는 형남 사군 평정에 나섰다.",
    "조운이 계양 공략의 선봉을 맡는다.",
    "태수 조범이 성문을 걸어 잠갔다 — 힘으로 열 수밖에.",
  ],
  heroSpawns: [
    { id: "zhaoyun", x: 1, y: 8 },
    { id: "huangzhong", x: 0, y: 9 },
    { id: "jindao", x: 2, y: 9 },
  ],
  units: [
    wei("계양 수비병", "guard", { hp: 56, atk: 21, def: 13, level: 5 }, 8, 4),
    wei("계양 수비병", "guard", { hp: 56, atk: 21, def: 13, level: 5 }, 8, 7),
    wei("계양 수비병", "guard", { hp: 56, atk: 21, def: 13, level: 5 }, 11, 4),
    wei("계양 수비병", "guard", { hp: 56, atk: 21, def: 13, level: 5 }, 11, 8),
    wei("계양 궁기병", "horsearcher", { hp: 50, atk: 22, def: 9, mov: 6, level: 5 }, 12, 3),
    wei("계양 궁기병", "horsearcher", { hp: 50, atk: 22, def: 9, mov: 6, level: 6 }, 13, 8),
    wei("조범", "guard", { hp: 70, atk: 23, def: 15, int: 12, level: 6 }, 12, 5,
      { id: "zhaofan" }),
  ],
  winText: "계양 함락! 조범이 항복하고 성문이 열렸다.",
  loseText: "공성 실패… 계양의 성벽은 높았다.",
};

// ── 시나리오 4: 기곡 퇴각전 (228년) — 후퇴 ─────────────────────

const stage4: CampaignStage = {
  name: "제4장 기곡 퇴각전",
  subtitle: "箕谷斷後 — 늙은 용, 마지막까지 길을 지키다",
  width: 16,
  height: 12,
  tiles: [
    "mmmmmmmmmmmmmmmm",
    "mmm.........mmm.",
    "................",
    "....f...........",
    "................",
    "................",
    "........f.......",
    "................",
    "....m...........",
    "...mm...........",
    "mmm.........mmmm",
    "mmmmmmmmmmmmmmmm",
  ],
  goal: { type: "retreat", exits: [[0, 4], [0, 5], [0, 6], [0, 7]], turnLimit: 10 },
  goalText: "10턴 안에 생존 아군 전원이 서쪽 골짜기 출구로 퇴각하면 승리 · 조운 사망 시 패배",
  intro: [
    "제1차 북벌 — 가정이 무너지고, 전군 퇴각 명령이 떨어졌다.",
    "일흔의 조운이 스스로 후미를 맡는다.",
    "「내가 길을 막는다. 한 사람도 잃지 말고 물러나라!」",
  ],
  heroSpawns: [
    { id: "zhaoyun", x: 14, y: 5 },
    { id: "huangzhong", x: 14, y: 6 },
    { id: "jindao", x: 13, y: 4 },
  ],
  units: [
    wei("위군 정예병", "guard", { hp: 64, atk: 24, def: 15, level: 7 }, 6, 3),
    wei("위군 정예병", "guard", { hp: 64, atk: 24, def: 15, level: 7 }, 7, 7),
    wei("위군 정예병", "guard", { hp: 64, atk: 24, def: 15, level: 7 }, 9, 5),
    wei("위군 정예병", "guard", { hp: 64, atk: 24, def: 15, level: 8 }, 10, 2),
    wei("위군 정예병", "guard", { hp: 64, atk: 24, def: 15, level: 8 }, 10, 8),
    wei("위군 기마궁수", "horsearcher", { hp: 56, atk: 25, def: 10, mov: 6, level: 8 }, 11, 4),
    wei("위군 기마궁수", "horsearcher", { hp: 56, atk: 25, def: 10, mov: 6, level: 8 }, 12, 6),
    wei("곽회", "guard", { hp: 84, atk: 27, def: 17, int: 16, level: 9 }, 5, 5,
      { id: "guohuai" }),
  ],
  winText: "전원 퇴각 완료. 촉군 중 기곡의 부대만이 온전했다 — 조운 최후의 무훈.",
  loseText: "퇴각로가 끊겼다… 기곡에 백은의 창이 떨어졌다.",
};

export const CAMPAIGN: CampaignStage[] = [stage1, stage2, stage3, stage4];

// 맵 데이터 검증 (개발 중 실수 방지)
for (const s of CAMPAIGN) {
  if (s.tiles.length !== s.height || s.tiles.some((r) => r.length !== s.width)) {
    throw new Error(`맵 크기 오류: ${s.name}`);
  }
}
