// ── 로우폴리 3D 유닛 모델 (직업별 절차 생성) ─────────────────────
// 모델은 +X 방향을 바라보게 만든다. 적군은 그룹을 π 회전.

import * as THREE from "three";
import { Unit } from "../core/types";
import { JOBS, SpriteKind } from "../data/jobs";

const SKIN = 0xe8b98a;
const YELLOW = 0xe8c832; // 황건
const METAL = 0xc8ccd4;
const METAL_DARK = 0x8a8f9a;
const WOOD = 0x7a5230;

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

// ── 파츠 ───────────────────────────────────────────────────────

function addHead(g: THREE.Group, y: number, kind: SpriteKind) {
  const head = mesh(new THREE.SphereGeometry(0.09, 7, 6), SKIN);
  head.position.y = y;
  g.add(head);

  if (kind === "guard") {
    const helm = mesh(new THREE.ConeGeometry(0.1, 0.13, 7), METAL);
    helm.position.y = y + 0.08;
    g.add(helm);
    const plume = mesh(new THREE.ConeGeometry(0.025, 0.09, 5), 0xc03030);
    plume.position.y = y + 0.18;
    g.add(plume);
  } else if (kind === "lord") {
    const crown = mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.06, 6, 1, true), 0xe8c030);
    (crown.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    crown.position.y = y + 0.08;
    g.add(crown);
  } else if (kind === "taoist") {
    const hood = mesh(new THREE.ConeGeometry(0.105, 0.17, 7), YELLOW);
    hood.position.y = y + 0.08;
    g.add(hood);
  } else {
    // 황건 두건 띠
    const band = mesh(new THREE.TorusGeometry(0.085, 0.026, 6, 10), YELLOW);
    band.rotation.x = Math.PI / 2;
    band.position.y = y + 0.03;
    g.add(band);
  }
}

function addSpear(g: THREE.Group, x: number, y: number, z: number, len: number) {
  const shaft = mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 5), WOOD);
  shaft.position.set(x, y, z);
  g.add(shaft);
  const tip = mesh(new THREE.ConeGeometry(0.03, 0.09, 5), METAL);
  tip.position.set(x, y + len / 2 + 0.04, z);
  g.add(tip);
}

function addBow(g: THREE.Group, x: number, y: number, z: number) {
  // 활: +X쪽으로 볼록한 호
  const bow = mesh(new THREE.TorusGeometry(0.13, 0.014, 5, 12, Math.PI * 0.75), WOOD);
  bow.rotation.z = -Math.PI * 0.375; // 호를 +X 중심으로
  bow.position.set(x, y, z);
  g.add(bow);
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
  const blade = mesh(new THREE.BoxGeometry(0.022, 0.32, 0.05), METAL);
  blade.rotation.z = -0.5;
  blade.position.set(x, y, z);
  g.add(blade);
  const hilt = mesh(new THREE.BoxGeometry(0.03, 0.04, 0.1), 0xe8c030);
  hilt.rotation.z = -0.5;
  hilt.position.set(x - 0.08, y - 0.14, z);
  g.add(hilt);
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

// ── 보행 유닛 ──────────────────────────────────────────────────

function buildFoot(kind: SpriteKind, pal: Palette): THREE.Group {
  const g = new THREE.Group();

  // 다리
  for (const dz of [-0.055, 0.055]) {
    const leg = mesh(new THREE.BoxGeometry(0.08, 0.15, 0.07), pal.pants);
    leg.position.set(0, 0.075, dz);
    g.add(leg);
  }

  // 몸통 (도사는 긴 로브)
  if (kind === "taoist") {
    const robe = mesh(new THREE.CylinderGeometry(0.09, 0.17, 0.32, 7), pal.armor);
    robe.position.y = 0.24;
    g.add(robe);
  } else {
    const torso = mesh(new THREE.BoxGeometry(0.15, 0.2, 0.22), pal.armor);
    torso.position.y = 0.25;
    g.add(torso);
    const belt = mesh(new THREE.BoxGeometry(0.16, 0.04, 0.23), pal.armorDark);
    belt.position.y = 0.16;
    g.add(belt);
  }

  // 친위대 어깨 갑주
  if (kind === "guard") {
    for (const dz of [-0.13, 0.13]) {
      const pad = mesh(new THREE.SphereGeometry(0.055, 6, 5), METAL_DARK);
      pad.position.set(0, 0.33, dz);
      g.add(pad);
    }
  }

  addHead(g, 0.44, kind);

  // 무기
  if (kind === "guard") {
    addSpear(g, 0.1, 0.33, 0.16, 0.6);
    addShield(g, 0.1, 0.26, -0.17);
  } else if (kind === "bandit") {
    addSpear(g, 0.1, 0.3, 0.15, 0.5);
  } else if (kind === "banditarcher") {
    addBow(g, 0.14, 0.32, 0.12);
  } else if (kind === "taoist") {
    addStaff(g, 0.12, 0.28, 0.14);
  }
  return g;
}

// ── 기마 유닛 ──────────────────────────────────────────────────

function buildMounted(kind: SpriteKind, pal: Palette): THREE.Group {
  const g = new THREE.Group();
  const bodyColor = kind === "lord" ? 0xe8e4da : 0x7a5236;
  const darkColor = kind === "lord" ? 0xc0bcb0 : 0x5c3e28;

  // 말 다리
  for (const dx of [-0.15, 0.15]) {
    for (const dz of [-0.07, 0.07]) {
      const leg = mesh(new THREE.CylinderGeometry(0.026, 0.022, 0.26, 5), darkColor);
      leg.position.set(dx, 0.13, dz);
      g.add(leg);
    }
  }
  // 말 몸통
  const body = mesh(new THREE.CapsuleGeometry(0.11, 0.3, 3, 8), bodyColor);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.33;
  g.add(body);
  // 목
  const neck = mesh(new THREE.BoxGeometry(0.09, 0.2, 0.08), bodyColor);
  neck.rotation.z = -0.45;
  neck.position.set(0.22, 0.46, 0);
  g.add(neck);
  // 머리
  const head = mesh(new THREE.BoxGeometry(0.16, 0.075, 0.07), bodyColor);
  head.rotation.z = -0.15;
  head.position.set(0.33, 0.54, 0);
  g.add(head);
  // 귀
  const ear = mesh(new THREE.ConeGeometry(0.02, 0.05, 4), darkColor);
  ear.position.set(0.28, 0.6, 0);
  g.add(ear);
  // 갈기
  const mane = mesh(new THREE.BoxGeometry(0.05, 0.2, 0.03), darkColor);
  mane.rotation.z = -0.45;
  mane.position.set(0.18, 0.49, 0);
  g.add(mane);
  // 꼬리
  const tail = mesh(new THREE.ConeGeometry(0.035, 0.2, 5), darkColor);
  tail.rotation.z = 2.5;
  tail.position.set(-0.28, 0.28, 0);
  g.add(tail);

  // ── 기수 ──
  // 다리 (말에 걸침)
  const riderLeg = mesh(new THREE.BoxGeometry(0.07, 0.16, 0.05), pal.pants);
  riderLeg.position.set(0, 0.36, 0.12);
  g.add(riderLeg);
  // 몸통
  const torso = mesh(new THREE.BoxGeometry(0.13, 0.19, 0.17), pal.armor);
  torso.position.y = 0.55;
  g.add(torso);

  // 군주 망토
  if (kind === "lord") {
    const cape = mesh(new THREE.BoxGeometry(0.04, 0.26, 0.18), 0xb02a2a);
    cape.rotation.z = 0.25;
    cape.position.set(-0.12, 0.48, 0);
    g.add(cape);
  }

  addHead(g, 0.72, kind);

  if (kind === "lord") {
    addSword(g, 0.16, 0.62, 0.12);
  } else if (kind === "horsearcher") {
    addBow(g, 0.16, 0.58, 0.12);
  } else if (kind === "banditcav") {
    addSpear(g, 0.12, 0.6, 0.14, 0.6);
  }
  return g;
}

// ── 진입점 ─────────────────────────────────────────────────────

export interface UnitModel {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  ring: THREE.Mesh; // 선택 링
}

export function buildUnitModel(u: Unit): UnitModel {
  const job = JOBS[u.job];
  const pal = palette(u);
  const g = job.mounted ? buildMounted(job.sprite, pal) : buildFoot(job.sprite, pal);

  if (u.side === "enemy") g.rotation.y = Math.PI; // 적은 -X를 바라봄

  // 선택 링 (회전 영향 없도록 부모에 별도 부착)
  const root = new THREE.Group();
  root.add(g);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.022, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe14d })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.02;
  ring.visible = false;
  root.add(ring);

  root.scale.setScalar(1.25); // 보드 대비 가독성 확보

  const materials: THREE.MeshStandardMaterial[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
      materials.push(o.material);
    }
  });

  return { group: root, materials, ring };
}
