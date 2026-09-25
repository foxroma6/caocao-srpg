// ── 초상화 시스템: KOEI풍 흉상 일러스트를 캔버스로 절차 생성 ─────
// 어두운 배경 + 흉상 구도 + 갑주 + 개성(눈매/수염/관모)으로
// 캐릭터 성격을 전달한다. 유닛 정보 패널·대화창에서 사용.

import { Unit } from "../core/types";
import { JOBS } from "../data/jobs";

const SIZE = 160;

type Brow = "fierce" | "sharp" | "calm";
type Eyes = "open" | "narrow";
type Beard = "none" | "goatee" | "full" | "long" | "scruffy";
type Mouth = "smirk" | "grim" | "grin" | "neutral";
type Hat = "crown" | "helmet" | "band" | "turban" | "hood" | "none";

interface PortraitSpec {
  bgA: string; // 배경 그라데이션
  bgB: string;
  armor: string;
  armorDark: string;
  trim: string;
  brow: Brow;
  eyes: Eyes;
  eyepatch?: boolean;
  beard: Beard;
  beardColor: string;
  hat: Hat;
  hatColor?: string;
  mouth: Mouth;
}

const SKIN = "#e8b98a";
const SKIN_SHADE = "#c89468";
const HAIR = "#241c12";

// ── 캐릭터/직업별 스펙 ─────────────────────────────────────────

const SPECS: Record<string, PortraitSpec> = {
  // 조조: 난세의 간웅 — 날카로운 눈매, 옅은 미소, 금장 남색 갑주
  caocao: {
    bgA: "#2a2440", bgB: "#0f0c1a",
    armor: "#2a3060", armorDark: "#1d2445", trim: "#e8c030",
    brow: "sharp", eyes: "narrow", beard: "goatee", beardColor: HAIR,
    hat: "crown", mouth: "smirk",
  },
  // 하후돈: 외눈의 맹장 — 안대, 사나운 눈, 굳게 다문 입
  xiahoudun: {
    bgA: "#22303e", bgB: "#0c1218",
    armor: "#2c4a80", armorDark: "#1f355c", trim: "#8a8f9a",
    brow: "fierce", eyes: "open", eyepatch: true, beard: "full", beardColor: HAIR,
    hat: "helmet", mouth: "grim",
  },
  // 하후연: 질풍의 신궁 — 시원한 미소, 붉은 머리띠
  xiahouyuan: {
    bgA: "#1e3430", bgB: "#0a1412",
    armor: "#3d6ad4", armorDark: "#2a4ba0", trim: "#5a3e26",
    brow: "calm", eyes: "open", beard: "goatee", beardColor: "#3a2c1c",
    hat: "band", hatColor: "#c03030", mouth: "grin",
  },
  // 황건적 계열: 험상궂은 산적
  bandit: {
    bgA: "#33261a", bgB: "#120c08",
    armor: "#8a5a3a", armorDark: "#6a4228", trim: "#54402a",
    brow: "fierce", eyes: "open", beard: "scruffy", beardColor: "#3a2c1c",
    hat: "turban", mouth: "grim",
  },
  // 도사: 장각풍 — 지그시 감은 눈, 긴 회색 수염
  taoist: {
    bgA: "#3a3018", bgB: "#14100a",
    armor: "#c8a030", armorDark: "#9a7a20", trim: "#e8c832",
    brow: "calm", eyes: "narrow", beard: "long", beardColor: "#b8b4ac",
    hat: "hood", mouth: "neutral",
  },
  // 이름 없는 아군 병사 (범용)
  soldier: {
    bgA: "#242c3e", bgB: "#0e1218",
    armor: "#3d6ad4", armorDark: "#2a4ba0", trim: "#8a8f9a",
    brow: "calm", eyes: "open", beard: "none", beardColor: HAIR,
    hat: "helmet", mouth: "neutral",
  },
};

function specFor(u: Unit): PortraitSpec {
  if (SPECS[u.id]) return SPECS[u.id];
  const sprite = JOBS[u.job].sprite;
  if (sprite === "taoist") return SPECS.taoist;
  if (sprite.startsWith("bandit")) return SPECS.bandit;
  return SPECS.soldier;
}

// ── 드로잉 ─────────────────────────────────────────────────────

function drawPortrait(s: PortraitSpec): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const x = c.getContext("2d")!;

  // 배경: 대각 그라데이션 + 비네트
  const bg = x.createLinearGradient(0, 0, SIZE, SIZE);
  bg.addColorStop(0, s.bgA);
  bg.addColorStop(1, s.bgB);
  x.fillStyle = bg;
  x.fillRect(0, 0, SIZE, SIZE);
  // 뒤쪽 사선 광 (KOEI풍 드라마틱 배경)
  x.save();
  x.globalAlpha = 0.14;
  x.fillStyle = "#ffffff";
  x.beginPath();
  x.moveTo(96, 0);
  x.lineTo(150, 0);
  x.lineTo(60, SIZE);
  x.lineTo(20, SIZE);
  x.closePath();
  x.fill();
  x.restore();

  // ── 흉상(어깨 갑주) ──
  x.fillStyle = s.armor;
  x.beginPath();
  x.moveTo(12, 160);
  x.lineTo(24, 122);
  x.quadraticCurveTo(46, 108, 62, 112);
  x.lineTo(98, 112);
  x.quadraticCurveTo(114, 108, 136, 122);
  x.lineTo(148, 160);
  x.closePath();
  x.fill();
  // 견갑
  x.fillStyle = s.armorDark;
  x.beginPath();
  x.ellipse(34, 130, 20, 14, -0.35, 0, Math.PI * 2);
  x.ellipse(126, 130, 20, 14, 0.35, 0, Math.PI * 2);
  x.fill();
  // 흉갑 트림
  x.strokeStyle = s.trim;
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(52, 126);
  x.quadraticCurveTo(80, 116, 108, 126);
  x.stroke();
  x.beginPath();
  x.moveTo(56, 140);
  x.quadraticCurveTo(80, 130, 104, 140);
  x.stroke();

  // ── 목 + 얼굴 ──
  x.fillStyle = SKIN_SHADE;
  x.fillRect(70, 94, 20, 22);
  x.fillStyle = SKIN;
  x.beginPath();
  x.ellipse(80, 72, 30, 34, 0, 0, Math.PI * 2);
  x.fill();
  // 귀
  x.beginPath();
  x.ellipse(50, 76, 5, 8, 0, 0, Math.PI * 2);
  x.ellipse(110, 76, 5, 8, 0, 0, Math.PI * 2);
  x.fill();
  // 얼굴 음영 (오른쪽)
  x.save();
  x.globalAlpha = 0.13;
  x.fillStyle = "#7a4a20";
  x.beginPath();
  x.ellipse(92, 74, 20, 32, 0, -Math.PI / 2, Math.PI / 2);
  x.fill();
  x.restore();

  // ── 기본 머리카락 (관모가 덮기 전) ──
  if (s.hat !== "hood" && s.hat !== "helmet") {
    x.fillStyle = HAIR;
    x.beginPath();
    x.ellipse(80, 52, 30, 18, 0, Math.PI, 0);
    x.fill();
  }

  // ── 눈썹 ──
  x.strokeStyle = HAIR;
  x.lineCap = "round";
  if (s.brow === "fierce") {
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(56, 58); x.lineTo(74, 66);
    x.moveTo(104, 58); x.lineTo(86, 66);
    x.stroke();
  } else if (s.brow === "sharp") {
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(58, 62); x.quadraticCurveTo(68, 57, 75, 63);
    x.moveTo(102, 62); x.quadraticCurveTo(92, 57, 85, 63);
    x.stroke();
  } else {
    x.lineWidth = 3.5;
    x.beginPath();
    x.moveTo(58, 61); x.quadraticCurveTo(66, 59, 74, 62);
    x.moveTo(102, 61); x.quadraticCurveTo(94, 59, 86, 62);
    x.stroke();
  }

  // ── 눈 ──
  const drawEye = (ex: number) => {
    if (s.eyes === "narrow") {
      x.strokeStyle = HAIR;
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(ex - 8, 71);
      x.quadraticCurveTo(ex, 67, ex + 8, 71);
      x.stroke();
      x.fillStyle = HAIR;
      x.beginPath();
      x.ellipse(ex, 71, 3, 2.2, 0, 0, Math.PI * 2);
      x.fill();
    } else {
      x.fillStyle = "#f4ede2";
      x.beginPath();
      x.ellipse(ex, 71, 8, 5, 0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = HAIR;
      x.beginPath();
      x.ellipse(ex, 71.5, 3.4, 4, 0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#fff";
      x.beginPath();
      x.ellipse(ex + 1.4, 69.8, 1.1, 1.1, 0, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = HAIR;
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(ex - 8, 68.5);
      x.quadraticCurveTo(ex, 64.5, ex + 8, 68.5);
      x.stroke();
    }
  };
  drawEye(66);
  if (!s.eyepatch) drawEye(94);

  // ── 안대 ──
  if (s.eyepatch) {
    x.fillStyle = "#141210";
    x.beginPath();
    x.ellipse(94, 70, 10, 8, 0, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = "#141210";
    x.lineWidth = 3.5;
    x.beginPath();
    x.moveTo(51, 62);
    x.lineTo(86, 66);
    x.moveTo(102, 65);
    x.lineTo(109, 61);
    x.stroke();
  }

  // ── 코 + 입 ──
  x.strokeStyle = SKIN_SHADE;
  x.lineWidth = 2.5;
  x.beginPath();
  x.moveTo(80, 74);
  x.lineTo(77, 85);
  x.lineTo(83, 87);
  x.stroke();

  x.strokeStyle = "#7a4030";
  x.lineWidth = 3;
  x.beginPath();
  if (s.mouth === "smirk") {
    x.moveTo(70, 96);
    x.quadraticCurveTo(82, 96, 92, 91);
  } else if (s.mouth === "grim") {
    x.moveTo(70, 96);
    x.quadraticCurveTo(80, 99, 90, 96);
  } else if (s.mouth === "grin") {
    x.moveTo(68, 93);
    x.quadraticCurveTo(80, 101, 92, 93);
  } else {
    x.moveTo(72, 95);
    x.lineTo(88, 95);
  }
  x.stroke();

  // ── 수염 ──
  x.fillStyle = s.beardColor;
  if (s.beard === "goatee") {
    mustache(x, s.beardColor);
    x.beginPath();
    x.moveTo(72, 100);
    x.quadraticCurveTo(80, 124, 80, 128);
    x.quadraticCurveTo(80, 124, 88, 100);
    x.closePath();
    x.fill();
  } else if (s.beard === "full" || s.beard === "scruffy") {
    mustache(x, s.beardColor);
    x.beginPath();
    x.moveTo(52, 78);
    x.quadraticCurveTo(56, 108, 80, 112);
    x.quadraticCurveTo(104, 108, 108, 78);
    x.quadraticCurveTo(104, 96, 80, 100);
    x.quadraticCurveTo(56, 96, 52, 78);
    x.closePath();
    x.fill();
    if (s.beard === "scruffy") {
      // 삐죽삐죽한 수염 끝
      for (const [bx, by] of [[62, 104], [72, 110], [88, 110], [98, 104]] as const) {
        x.beginPath();
        x.moveTo(bx - 4, by - 4);
        x.lineTo(bx, by + 7);
        x.lineTo(bx + 4, by - 4);
        x.closePath();
        x.fill();
      }
    }
  } else if (s.beard === "long") {
    mustache(x, s.beardColor);
    x.beginPath();
    x.moveTo(56, 82);
    x.quadraticCurveTo(62, 110, 74, 116);
    x.lineTo(80, 152);
    x.lineTo(86, 116);
    x.quadraticCurveTo(98, 110, 104, 82);
    x.quadraticCurveTo(96, 98, 80, 101);
    x.quadraticCurveTo(64, 98, 56, 82);
    x.closePath();
    x.fill();
  }

  // ── 관모/투구 ──
  if (s.hat === "crown") {
    x.fillStyle = HAIR;
    x.beginPath();
    x.ellipse(80, 48, 28, 14, 0, Math.PI, 0);
    x.fill();
    x.fillStyle = "#e8c030";
    x.fillRect(52, 42, 56, 10);
    x.beginPath();
    x.moveTo(70, 42); x.lineTo(80, 24); x.lineTo(90, 42);
    x.closePath();
    x.fill();
    x.fillStyle = "#c03030";
    x.beginPath();
    x.ellipse(80, 47, 4, 4, 0, 0, Math.PI * 2);
    x.fill();
  } else if (s.hat === "helmet") {
    x.fillStyle = "#c8ccd4";
    x.beginPath();
    x.ellipse(80, 50, 32, 22, 0, Math.PI, 0);
    x.fill();
    x.fillRect(48, 48, 64, 6);
    x.fillStyle = "#c03030";
    x.beginPath();
    x.moveTo(76, 30); x.quadraticCurveTo(80, 12, 84, 30);
    x.closePath();
    x.fill();
  } else if (s.hat === "band") {
    x.fillStyle = s.hatColor ?? "#c03030";
    x.fillRect(50, 50, 60, 8);
    x.beginPath();
    x.moveTo(110, 52); x.lineTo(122, 46); x.lineTo(118, 58);
    x.closePath();
    x.fill();
    // 상투
    x.fillStyle = HAIR;
    x.beginPath();
    x.ellipse(80, 36, 9, 8, 0, 0, Math.PI * 2);
    x.fill();
  } else if (s.hat === "turban") {
    // 황건: 검은 머리 위에 이마를 두른 노란 띠 + 매듭
    x.fillStyle = "#e8c832";
    x.beginPath();
    x.moveTo(50, 62);
    x.quadraticCurveTo(80, 48, 110, 62);
    x.lineTo(110, 52);
    x.quadraticCurveTo(80, 38, 50, 52);
    x.closePath();
    x.fill();
    x.beginPath();
    x.moveTo(108, 54); x.lineTo(124, 44); x.lineTo(118, 60); x.lineTo(112, 66);
    x.closePath();
    x.fill();
  } else if (s.hat === "hood") {
    x.fillStyle = "#e8c832";
    x.beginPath();
    x.moveTo(46, 84);
    x.quadraticCurveTo(46, 30, 80, 26);
    x.quadraticCurveTo(114, 30, 114, 84);
    x.quadraticCurveTo(108, 60, 80, 56);
    x.quadraticCurveTo(52, 60, 46, 84);
    x.closePath();
    x.fill();
  }

  // 비네트 + 금테
  const vg = x.createRadialGradient(80, 76, 50, 80, 80, 115);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  x.fillStyle = vg;
  x.fillRect(0, 0, SIZE, SIZE);
  x.strokeStyle = "rgba(217,192,122,0.8)";
  x.lineWidth = 2;
  x.strokeRect(1, 1, SIZE - 2, SIZE - 2);

  return c;
}

function mustache(x: CanvasRenderingContext2D, color: string) {
  x.strokeStyle = color;
  x.lineWidth = 4;
  x.lineCap = "round";
  x.beginPath();
  x.moveTo(78, 90);
  x.quadraticCurveTo(68, 90, 62, 97);
  x.moveTo(82, 90);
  x.quadraticCurveTo(92, 90, 98, 97);
  x.stroke();
}

// ── 캐시 + 공개 API ────────────────────────────────────────────

const cache = new Map<string, HTMLCanvasElement>();

export function getPortrait(u: Unit): HTMLCanvasElement {
  const key = SPECS[u.id] ? u.id : JOBS[u.job].sprite;
  let c = cache.get(key);
  if (!c) {
    c = drawPortrait(specFor(u));
    cache.set(key, c);
  }
  return c;
}
