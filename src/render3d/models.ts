// ── 로우폴리 3D 유닛 모델 (직업/캐릭터별 절차 생성) ──────────────
// 모델은 +X 방향을 바라보게 만든다. 적군은 그룹을 π 회전.
// 삼국지 무장 일러스트의 문법(수염, 갑주 층, 색 개성)을 로우폴리로 재해석.

import * as THREE from "three";
import { Unit } from "../core/types";
import { JOBS, SpriteKind } from "../data/jobs";

const SKIN = 0xe8b98a;
const YELLOW = 0xe8c832; // 황건(黃巾)
const METAL = 0xc8ccd4;
const METAL_DARK = 0x8a8f9a;
const GOLD = 0xe8c030;
const WOOD = 0x7a5230;
const EYE = 0x181410;
const HAIR = 0x2a2018;

function mat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    transparent: true, // acted 표시용 opacity 토글
  });
}

function mesh(geo: THREE.BufferGeometry, color: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color));
  m.castShadow = true;
  return m;
}

// ── 얼굴 ───────────────────────────────────────────────────────

function addEyes(g: THREE.Group, hy: number) {
  for (const dz of [-0.034, 0.034]) {
    const eye = mesh(new THREE.BoxGeometry(0.012, 0.02, 0.018), EYE);
    eye.position.set(0.082, hy + 0.008, dz);
    g.add(eye);
  }
}

type BeardKind = "none" | "goatee" | "full" | "long";

function addBeard(g: THREE.Group, hy: number, kind: BeardKind, color = HAIR) {
  if (kind === "none") return;
  // 콧수염
  const mustache = mesh(new THREE.BoxGeometry(0.016, 0.014, 0.08), color);
  mustache.position.set(0.08, hy - 0.028, 0);
  g.add(mustache);

  if (kind === "goatee") {
    // 턱 아래로 뾰족한 염소수염
    const goatee = mesh(new THREE.ConeGeometry(0.024, 0.1, 5), color);
    goatee.rotation.x = Math.PI;
    goatee.position.set(0.068, hy - 0.1, 0);
    g.add(goatee);
  } else if (kind === "full") {
    // 턱을 덮는 풍성한 수염
    const beard = mesh(new THREE.SphereGeometry(0.075, 6, 5), color);
    beard.scale.set(0.85, 0.8, 1);
    beard.position.set(0.028, hy - 0.055, 0);
    g.add(beard);
  } else if (kind === "long") {
    // 가슴까지 내려오는 긴 수염 (도사)
    const beard = mesh(new THREE.ConeGeometry(0.042, 0.18, 5), color);
    beard.rotation.x = Math.PI;
    beard.position.set(0.06, hy - 0.13, 0);
    g.add(beard);
  }
}

// ── 머리 장식 ──────────────────────────────────────────────────

function addTurban(g: THREE.Group, hy: number) {
  const band = mesh(new THREE.TorusGeometry(0.085, 0.026, 6, 10), YELLOW);
  band.rotation.x = Math.PI / 2;
  band.position.y = hy + 0.03;
  g.add(band);
}

function addGuardHelmet(g: THREE.Group, hy: number) {
  const helm = mesh(new THREE.ConeGeometry(0.1, 0.13, 7), METAL);
  helm.position.y = hy + 0.08;
  g.add(helm);
  const plume = mesh(new THREE.ConeGeometry(0.025, 0.09, 5), 0xc03030);
  plume.position.y = hy + 0.18;
  g.add(plume);
}

/** 통천관풍 금관 (군주) */
function addLordCrown(g: THREE.Group, hy: number) {
  const band = mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.06, 6, 1, true), GOLD);
  (band.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  band.position.y = hy + 0.08;
  g.add(band);
  // 관 위 세움 장식
  const fan = mesh(new THREE.BoxGeometry(0.02, 0.09, 0.07), GOLD);
  fan.position.set(-0.02, hy + 0.15, 0);
  fan.rotation.z = 0.15;
  g.add(fan);
  // 이마 앞 붉은 보석
  const gem = mesh(new THREE.SphereGeometry(0.018, 5, 4), 0xc03030);
  gem.position.set(0.07, hy + 0.07, 0);
  g.add(gem);
}

function addTopknot(g: THREE.Group, hy: number, bandColor: number) {
  // 붉은 머리띠 + 상투
  const band = mesh(new THREE.TorusGeometry(0.086, 0.014, 5, 10), bandColor);
  band.rotation.x = Math.PI / 2;
  band.position.y = hy + 0.035;
  g.add(band);
  const bun = mesh(new THREE.SphereGeometry(0.035, 5, 4), HAIR);
  bun.position.set(-0.02, hy + 0.1, 0);
  g.add(bun);
}

function addTaoistHood(g: THREE.Group, hy: number) {
  const hood = mesh(new THREE.ConeGeometry(0.105, 0.17, 7), YELLOW);
  hood.position.y = hy + 0.08;
  g.add(hood);
}

// ── 무기 ───────────────────────────────────────────────────────

function addSpear(g: THREE.Group, x: number, y: number, z: number, len: number) {
  const shaft = mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 5), WOOD);
  shaft.position.set(x, y, z);
  g.add(shaft);
  const tip = mesh(new THREE.ConeGeometry(0.03, 0.09, 5), METAL);
  tip.position.set(x, y + len / 2 + 0.04, z);
  g.add(tip);
}

/** 대도(언월도): 긴 자루 + 큰 곡선 칼날 + 붉은 술 */
function addGlaive(g: THREE.Group, x: number, y: number, z: number) {
  const shaft = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.78, 5), 0x4a3220);
  shaft.position.set(x, y, z);
  g.add(shaft);
  const bladeY = y + 0.78 / 2 + 0.1;
  const blade = mesh(new THREE.BoxGeometry(0.09, 0.26, 0.018), METAL);
  blade.rotation.z = -0.18;
  blade.position.set(x + 0.035, bladeY, z);
  g.add(blade);
  const edge = mesh(new THREE.ConeGeometry(0.028, 0.1, 4), METAL);
  edge.position.set(x + 0.05, bladeY + 0.16, z);
  edge.rotation.z = -0.3;
  g.add(edge);
  const tassel = mesh(new THREE.ConeGeometry(0.025, 0.09, 5), 0xc03030);
  tassel.rotation.x = Math.PI;
  tassel.position.set(x, bladeY - 0.17, z);
  g.add(tassel);
}

function addBow(g: THREE.Group, x: number, y: number, z: number, big = false) {
  const r = big ? 0.16 : 0.13;
  const bow = mesh(new THREE.TorusGeometry(r, 0.014, 5, 12, Math.PI * 0.75), WOOD);
  bow.rotation.z = -Math.PI * 0.375; // 호를 +X 중심으로
  bow.position.set(x, y, z);
  g.add(bow);
  if (big) {
    // 메긴 화살
    const arrow = mesh(new THREE.CylinderGeometry(0.006, 0.006, r * 2, 4), 0xd8d0c0);
    arrow.rotation.z = Math.PI / 2;
    arrow.position.set(x, y, z);
    g.add(arrow);
    const head = mesh(new THREE.ConeGeometry(0.014, 0.04, 4), METAL);
    head.rotation.z = -Math.PI / 2;
    head.position.set(x + r + 0.02, y, z);
    g.add(head);
  }
}

function addStaff(g: THREE.Group, x: number, y: number, z: number) {
  const shaft = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.55, 5), WOOD);
  shaft.position.set(x, y, z);
  g.add(shaft);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 6),
    new THREE.MeshStandardMaterial({
      color: 0xb060e0,
      emissive: 0x8030b0,
      emissiveIntensity: 0.6,
      transparent: true,
    })
  );
  orb.position.set(x, y + 0.32, z);
  g.add(orb);
}

function addSword(g: THREE.Group, x: number, y: number, z: number) {
  const blade = mesh(new THREE.BoxGeometry(0.022, 0.34, 0.05), METAL);
  blade.rotation.z = -0.5;
  blade.position.set(x, y, z);
  g.add(blade);
  const guard = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.11), GOLD);
  guard.rotation.z = -0.5;
  guard.position.set(x - 0.08, y - 0.15, z);
  g.add(guard);
}

function addShield(g: THREE.Group, x: number, y: number, z: number) {
  const shield = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 8), 0x6a4a2a);
  shield.rotation.z = Math.PI / 2;
  shield.position.set(x, y, z);
  g.add(shield);
  const boss = mesh(new THREE.SphereGeometry(0.03, 6, 5), METAL_DARK);
  boss.position.set(x + 0.02, y, z);
  g.add(boss);
}

// ── 갑주 파츠 ──────────────────────────────────────────────────

interface Palette {
  armor: number;
  armorDark: number;
  pants: number;
}

function palette(u: Unit): Palette {
  const kind = JOBS[u.job].sprite;
  if (u.side === "player") {
    return { armor: 0x3d6ad4, armorDark: 0x2a4ba0, pants: 0x2a3350 };
  }
  if (kind === "taoist") return { armor: 0xc8a030, armorDark: 0x9a7a20, pants: 0x6a5230 };
  return { armor: 0x8a5a3a, armorDark: 0x6a4228, pants: 0x54402a };
}

function addShoulderPads(g: THREE.Group, y: number, color: number, r = 0.055) {
  for (const dz of [-0.13, 0.13]) {
    const pad = mesh(new THREE.SphereGeometry(r, 6, 5), color);
    pad.position.set(0, y, dz);
    g.add(pad);
  }
}

/** 갑주 치마 (허리 아래 판갑) */
function addTassets(g: THREE.Group, y: number, color: number) {
  const skirt = mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.12, 6, 1, true), color);
  (skirt.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  skirt.position.y = y;
  g.add(skirt);
}

/** 흉갑 (가슴 전면 판) */
function addChestPlate(g: THREE.Group, y: number, color: number) {
  const plate = mesh(new THREE.BoxGeometry(0.035, 0.15, 0.2), color);
  plate.position.set(0.075, y, 0);
  g.add(plate);
}

// ── 공용 골격 ──────────────────────────────────────────────────

/** 보행 유닛 하체+몸통. 반환값은 머리 높이 */
function footBase(g: THREE.Group, pal: Palette, robe = false): number {
  for (const dz of [-0.055, 0.055]) {
    const leg = mesh(new THREE.BoxGeometry(0.08, 0.15, 0.07), pal.pants);
    leg.position.set(0, 0.075, dz);
    g.add(leg);
  }
  if (robe) {
    const body = mesh(new THREE.CylinderGeometry(0.09, 0.17, 0.32, 7), pal.armor);
    body.position.y = 0.24;
    g.add(body);
  } else {
    const torso = mesh(new THREE.BoxGeometry(0.15, 0.2, 0.22), pal.armor);
    torso.position.y = 0.25;
    g.add(torso);
    const belt = mesh(new THREE.BoxGeometry(0.16, 0.04, 0.23), pal.armorDark);
    belt.position.y = 0.16;
    g.add(belt);
  }
  const head = mesh(new THREE.SphereGeometry(0.09, 7, 6), SKIN);
  head.position.y = 0.44;
  g.add(head);
  addEyes(g, 0.44);
  return 0.44;
}

/** 말 (색상/안장 지정) */
function buildHorse(g: THREE.Group, bodyColor: number, darkColor: number, saddleColor?: number) {
  for (const dx of [-0.15, 0.15]) {
    for (const dz of [-0.07, 0.07]) {
      const leg = mesh(new THREE.CylinderGeometry(0.026, 0.022, 0.26, 5), darkColor);
      leg.position.set(dx, 0.13, dz);
      g.add(leg);
    }
  }
  const body = mesh(new THREE.CapsuleGeometry(0.11, 0.3, 3, 8), bodyColor);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.33;
  g.add(body);
  const neck = mesh(new THREE.BoxGeometry(0.09, 0.2, 0.08), bodyColor);
  neck.rotation.z = -0.45;
  neck.position.set(0.22, 0.46, 0);
  g.add(neck);
  const head = mesh(new THREE.BoxGeometry(0.16, 0.075, 0.07), bodyColor);
  head.rotation.z = -0.15;
  head.position.set(0.33, 0.54, 0);
  g.add(head);
  const ear = mesh(new THREE.ConeGeometry(0.02, 0.05, 4), darkColor);
  ear.position.set(0.28, 0.6, 0);
  g.add(ear);
  const mane = mesh(new THREE.BoxGeometry(0.05, 0.2, 0.03), darkColor);
  mane.rotation.z = -0.45;
  mane.position.set(0.18, 0.49, 0);
  g.add(mane);
  const tail = mesh(new THREE.ConeGeometry(0.035, 0.2, 5), darkColor);
  tail.rotation.z = 2.5;
  tail.position.set(-0.28, 0.28, 0);
  g.add(tail);
  if (saddleColor !== undefined) {
    const saddle = mesh(new THREE.BoxGeometry(0.18, 0.05, 0.2), saddleColor);
    saddle.position.set(-0.02, 0.43, 0);
    g.add(saddle);
  }
}

/** 기수 하체+몸통. 반환값은 머리 높이 */
function riderBase(g: THREE.Group, pal: Palette): number {
  const riderLeg = mesh(new THREE.BoxGeometry(0.07, 0.16, 0.05), pal.pants);
  riderLeg.position.set(0, 0.36, 0.12);
  g.add(riderLeg);
  const torso = mesh(new THREE.BoxGeometry(0.13, 0.19, 0.17), pal.armor);
  torso.position.y = 0.55;
  g.add(torso);
  const head = mesh(new THREE.SphereGeometry(0.09, 7, 6), SKIN);
  head.position.y = 0.72;
  g.add(head);
  addEyes(g, 0.72);
  return 0.72;
}

// ── 「曹」 군기 ────────────────────────────────────────────────

function bannerTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 48;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#2a4ba0";
  ctx.fillRect(0, 0, 64, 48);
  ctx.strokeStyle = "#e8c030";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 60, 44);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("曹", 32, 26);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

// ── 캐릭터 전용 모델 ───────────────────────────────────────────

/** 조조: 남색+금 갑주, 염소수염, 통천관, 백마+붉은 안장, 붉은 망토, 「曹」 군기 */
function buildCaocao(): THREE.Group {
  const g = new THREE.Group();
  const pal: Palette = { armor: 0x2a3060, armorDark: 0x1d2445, pants: 0x1d2438 };
  buildHorse(g, 0xe8e4da, 0xc0bcb0, 0x8a2020);

  // 망토 (몸 뒤로)
  const cape = mesh(new THREE.BoxGeometry(0.045, 0.28, 0.2), 0xa02020);
  cape.rotation.z = 0.25;
  cape.position.set(-0.13, 0.48, 0);
  g.add(cape);

  const hy = riderBase(g, pal);
  addChestPlate(g, 0.56, GOLD);
  addShoulderPads(g, 0.64, GOLD, 0.045);
  addBeard(g, hy, "goatee", 0x201810);
  addLordCrown(g, hy);
  addSword(g, 0.17, 0.63, 0.12);

  // 등 뒤 「曹」 군기
  const pole = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 5), 0x5a4a32);
  pole.position.set(-0.2, 0.66, -0.08);
  g.add(pole);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.17),
    new THREE.MeshStandardMaterial({
      map: bannerTexture(),
      side: THREE.DoubleSide,
      transparent: true,
    })
  );
  flag.position.set(-0.32, 0.9, -0.08);
  flag.castShadow = true;
  g.add(flag);
  return g;
}

/** 하후돈: 강철 흉갑·견갑, 흑수염, 안대, 대도 */
function buildXiahoudun(): THREE.Group {
  const g = new THREE.Group();
  const pal: Palette = { armor: 0x2c4a80, armorDark: 0x1f355c, pants: 0x252c42 };
  const hy = footBase(g, pal);
  addChestPlate(g, 0.27, METAL_DARK);
  addShoulderPads(g, 0.34, METAL_DARK, 0.06);
  addTassets(g, 0.12, pal.armorDark);
  addBeard(g, hy, "full", 0x201810);
  addGuardHelmet(g, hy);
  // 검은 안대 + 머리끈 (오른눈)
  const strap = mesh(new THREE.TorusGeometry(0.09, 0.01, 5, 12), 0x1a1a1a);
  strap.rotation.x = Math.PI / 2;
  strap.rotation.z = 0.12;
  strap.position.y = hy + 0.015;
  g.add(strap);
  const patch = mesh(new THREE.BoxGeometry(0.02, 0.032, 0.03), 0x1a1a1a);
  patch.position.set(0.084, hy + 0.008, 0.034);
  g.add(patch);
  addGlaive(g, 0.16, 0.39, 0.16);
  return g;
}

/** 하후연: 붉은 머리띠+상투, 짧은 수염, 화살 메긴 큰 활, 화살통 */
function buildXiahouyuan(): THREE.Group {
  const g = new THREE.Group();
  const pal: Palette = { armor: 0x3d6ad4, armorDark: 0x2a4ba0, pants: 0x2a3350 };
  buildHorse(g, 0x6a4830, 0x503620, 0x3a5a8a);
  const hy = riderBase(g, pal);
  // 가죽 멜빵
  const strap = mesh(new THREE.BoxGeometry(0.02, 0.2, 0.05), 0x5a3e26);
  strap.rotation.x = 0.5;
  strap.position.set(0.068, 0.56, 0);
  g.add(strap);
  addBeard(g, hy, "goatee", 0x2a2018);
  addTopknot(g, hy, 0xc03030);
  addBow(g, 0.18, 0.6, 0.13, true);
  // 등의 화살통 + 화살
  const quiver = mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.2, 6), 0x6a4a2a);
  quiver.rotation.z = 0.5;
  quiver.position.set(-0.15, 0.58, -0.05);
  g.add(quiver);
  for (const [ox, oy] of [[-0.2, 0.7], [-0.17, 0.72], [-0.22, 0.68]] as const) {
    const arrow = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.12, 4), 0xd8d0c0);
    arrow.rotation.z = 0.5;
    arrow.position.set(ox, oy, -0.05);
    g.add(arrow);
  }
  return g;
}

// ── 직업 기본 모델 (이름 없는 병사) ─────────────────────────────

function buildFoot(kind: SpriteKind, pal: Palette): THREE.Group {
  const g = new THREE.Group();
  const hy = footBase(g, pal, kind === "taoist");

  if (kind === "guard") {
    addShoulderPads(g, 0.33, METAL_DARK);
    addGuardHelmet(g, hy);
    addSpear(g, 0.1, 0.33, 0.16, 0.6);
    addShield(g, 0.1, 0.26, -0.17);
  } else if (kind === "bandit") {
    addTurban(g, hy);
    addBeard(g, hy, "full", 0x3a2c1c);
    addSpear(g, 0.1, 0.3, 0.15, 0.5);
  } else if (kind === "banditarcher") {
    addTurban(g, hy);
    addBow(g, 0.14, 0.32, 0.12);
  } else if (kind === "taoist") {
    addTaoistHood(g, hy);
    addBeard(g, hy, "long", 0xb8b4ac); // 장각풍 긴 회색 수염
    addStaff(g, 0.12, 0.28, 0.14);
  }
  return g;
}

function buildMounted(kind: SpriteKind, pal: Palette): THREE.Group {
  const g = new THREE.Group();
  buildHorse(g, kind === "lord" ? 0xe8e4da : 0x7a5236, kind === "lord" ? 0xc0bcb0 : 0x5c3e28);

  if (kind === "lord") {
    const cape = mesh(new THREE.BoxGeometry(0.04, 0.26, 0.18), 0xb02a2a);
    cape.rotation.z = 0.25;
    cape.position.set(-0.12, 0.48, 0);
    g.add(cape);
  }

  const hy = riderBase(g, pal);

  if (kind === "lord") {
    addBeard(g, hy, "goatee");
    addLordCrown(g, hy);
    addSword(g, 0.16, 0.62, 0.12);
  } else if (kind === "horsearcher") {
    const helm = mesh(new THREE.SphereGeometry(0.09, 7, 6, 0, Math.PI * 2, 0, Math.PI / 2), METAL);
    helm.position.y = hy + 0.015;
    g.add(helm);
    addBow(g, 0.16, 0.58, 0.12);
  } else if (kind === "banditcav") {
    addTurban(g, hy);
    addBeard(g, hy, "full", 0x3a2c1c);
    addSpear(g, 0.12, 0.6, 0.14, 0.6);
  }
  return g;
}

// ── 진입점 ─────────────────────────────────────────────────────

const CHARACTER_BUILDERS: Record<string, () => THREE.Group> = {
  caocao: buildCaocao,
  xiahoudun: buildXiahoudun,
  xiahouyuan: buildXiahouyuan,
};

/** 장수를 따르는 호위병 (부대 표현) */
function buildEscort(u: Unit, pal: Palette): THREE.Group {
  const sprite = JOBS[u.job].sprite;
  switch (sprite) {
    case "lord":
    case "guard":
      return buildFoot("guard", pal);
    case "horsearcher":
      return buildMounted("horsearcher", pal);
    case "banditcav":
      return buildMounted("banditcav", pal);
    case "banditarcher":
      return buildFoot("banditarcher", pal);
    default:
      return buildFoot("bandit", pal);
  }
}

export interface UnitModel {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  ring: THREE.Mesh; // 선택 링
  escorts: THREE.Group[]; // 호위병 (HP에 따라 줄어든다)
}

export function buildUnitModel(u: Unit): UnitModel {
  const job = JOBS[u.job];
  const custom = CHARACTER_BUILDERS[u.id];
  const pal = palette(u);
  const leader = custom
    ? custom()
    : job.mounted
      ? buildMounted(job.sprite, pal)
      : buildFoot(job.sprite, pal);

  // ── 부대 편성: 장수(앞) + 호위병 2(뒤 양옆) ──
  const squad = new THREE.Group();
  leader.position.x = 0.08;
  squad.add(leader);

  const escorts: THREE.Group[] = [];
  const escortScale = job.mounted ? 0.62 : 0.7;
  for (const dz of [-0.25, 0.25]) {
    const e = buildEscort(u, pal);
    e.scale.setScalar(escortScale);
    e.position.set(job.mounted ? -0.26 : -0.24, 0, dz);
    squad.add(e);
    escorts.push(e);
  }

  if (u.side === "enemy") squad.rotation.y = Math.PI; // 적은 -X를 바라봄

  // 선택 링 (회전 영향 없도록 부모에 별도 부착)
  const root = new THREE.Group();
  root.add(squad);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.022, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe14d })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.02;
  ring.visible = false;
  root.add(ring);

  root.scale.setScalar(job.mounted ? 1.02 : 1.12); // 보드 대비 가독성

  const materials: THREE.MeshStandardMaterial[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
      materials.push(o.material);
    }
  });

  return { group: root, materials, ring, escorts };
}
