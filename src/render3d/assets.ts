// ── GLTF 에셋 로더/레지스트리 ───────────────────────────────────
// KayKit Adventurers (CC0) 등 애니메이션 내장 GLB를 로드해
// 유닛 종류(sprite)별로 인스턴스화한다. 로드 실패 시 절차 모델로 폴백.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

interface Asset {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  normScale: number; // 목표 키(targetH)로 정규화
  faceFix: number;
}

const REGISTRY = new Map<string, Asset>();

interface FileSpec {
  url: string;
  targetH?: number; // 월드 기준 목표 키 (기본 0.62)
  faceFix?: number; // 기본 +Z → +X 회전 (π/2)
  optional?: boolean; // 없어도 조용히 넘어감 (AI 생성 영웅 등)
}

/** GLB 파일 목록 (public/models/) */
const FILES: Record<string, FileSpec> = {
  knight: { url: "models/Knight.glb" },
  barbarian: { url: "models/Barbarian.glb" },
  mage: { url: "models/Mage.glb" },
  rogue: { url: "models/Rogue_Hooded.glb" },
  // ── AI 생성 영웅 (scripts/tripo-generate.mjs 로 생성 시 자동 적용) ──
  "hero:caocao": { url: "models/hero_caocao.glb", targetH: 0.95, optional: true },
  "hero:xiahoudun": { url: "models/hero_xiahoudun.glb", targetH: 0.68, optional: true },
  "hero:xiahouyuan": { url: "models/hero_xiahouyuan.glb", targetH: 0.95, optional: true },
  "hero:yb5": { url: "models/hero_taoist.glb", targetH: 0.68, optional: true },
  // ── 지형 데코 (KayKit Medieval Hexagon, CC0) ──
  "prop:tree_a": { url: "models/props/tree_single_A.gltf", targetH: 0.62, optional: true },
  "prop:tree_b": { url: "models/props/tree_single_B.gltf", targetH: 0.68, optional: true },
  "prop:rock_a": { url: "models/props/rock_single_A.gltf", targetH: 0.2, optional: true },
  "prop:rock_b": { url: "models/props/rock_single_B.gltf", targetH: 0.26, optional: true },
  "prop:rock_d": { url: "models/props/rock_single_D.gltf", targetH: 0.17, optional: true },
  "prop:tower": { url: "models/props/building_tower_A_yellow.gltf", targetH: 0.8, optional: true },
};

/** 유닛 sprite → GLTF 에셋 매핑 (보행 유닛만; 기마·전용 캐릭터는 절차 모델) */
export const SPRITE_ASSET: Record<string, string> = {
  guard: "knight",
  bandit: "barbarian",
  banditarcher: "rogue",
};

/** GLB 캐릭터의 기본 바라보는 방향(+Z)을 게임 기준(+X)으로 돌리는 회전 */
const FACE_FIX = Math.PI / 2;

export async function loadAssets(): Promise<void> {
  const loader = new GLTFLoader();
  await Promise.all(
    Object.entries(FILES).map(async ([key, spec]) => {
      try {
        const gltf = await loader.loadAsync(import.meta.env.BASE_URL + spec.url);
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const h = Math.max(0.001, box.max.y - box.min.y);
        REGISTRY.set(key, {
          scene: gltf.scene,
          clips: gltf.animations,
          normScale: (spec.targetH ?? 0.62) / h,
          faceFix: spec.faceFix ?? FACE_FIX,
        });
      } catch (e) {
        const log = spec.optional ? console.info : console.warn;
        log(`GLTF 로드 실패(${key}) — 절차 모델로 대체:`, e);
      }
    })
  );
}

export function hasAsset(key: string | null | undefined): boolean {
  return !!key && REGISTRY.has(key);
}

/** AI 생성 영웅 모델 키 (없으면 null → 절차 모델 사용) */
export function heroAssetKey(unitId: string): string | null {
  const key = `hero:${unitId}`;
  return REGISTRY.has(key) ? key : null;
}

/**
 * 정적 데코 프롭 인스턴스 (지오메트리·머티리얼 공유, 발밑 y=0 정렬).
 * 로드 전이거나 실패했으면 null → 호출측이 절차 데코로 폴백.
 */
export function instantiateProp(key: string): THREE.Object3D | null {
  const asset = REGISTRY.get(key);
  if (!asset) return null;
  const obj = asset.scene.clone(true);
  obj.scale.setScalar(asset.normScale);
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const b = new THREE.Box3().setFromObject(obj);
  obj.position.y = -b.min.y;
  return obj;
}

export type ClipRole = "idle" | "walk" | "attack" | "death";

export interface GltfInstance {
  root: THREE.Group; // 방향 보정 래퍼 (게임 기준 +X를 바라봄)
  mixer: THREE.AnimationMixer;
  actions: Partial<Record<ClipRole, THREE.AnimationAction>>;
  materials: THREE.MeshStandardMaterial[];
}

export function instantiate(key: string): GltfInstance | null {
  const asset = REGISTRY.get(key);
  if (!asset) return null;

  const model = skeletonClone(asset.scene);
  model.scale.setScalar(asset.normScale);
  model.rotation.y = asset.faceFix;
  // 발밑을 y=0에 맞춤 (원점 중심으로 내보내진 모델 대응)
  const bounds = new THREE.Box3().setFromObject(model);
  model.position.y -= bounds.min.y;

  const materials: THREE.MeshStandardMaterial[] = [];
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      // 인스턴스별 opacity 제어를 위해 머티리얼 복제
      const clone = (m: THREE.Material) => {
        const c = m.clone();
        c.transparent = true;
        if (c instanceof THREE.MeshStandardMaterial) materials.push(c);
        return c;
      };
      o.material = Array.isArray(o.material)
        ? o.material.map(clone)
        : clone(o.material);
      if (o instanceof THREE.SkinnedMesh) o.frustumCulled = false;
    }
  });

  const root = new THREE.Group();
  root.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const pick = (patterns: RegExp[]): THREE.AnimationAction | undefined => {
    for (const p of patterns) {
      const clip = asset.clips.find((c) => p.test(c.name));
      if (clip) return mixer.clipAction(clip);
    }
    return undefined;
  };

  const actions: GltfInstance["actions"] = {
    idle: pick([/^idle$/i, /idle/i]),
    walk: pick([/^walking_a$/i, /walking/i, /^run/i]),
    attack:
      key === "rogue"
        ? pick([/crossbow.*shoot|shoot.*crossbow/i, /ranged/i, /attack/i])
        : pick([/1h_melee_attack_(chop|slice)/i, /2h_melee_attack/i, /melee_attack/i, /attack/i]),
    death: pick([/^death_a$/i, /death/i]),
  };
  for (const role of ["attack", "death"] as const) {
    const a = actions[role];
    if (a) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
  }
  actions.idle?.play();

  return { root, mixer, actions, materials };
}
