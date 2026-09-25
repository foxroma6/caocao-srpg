// ── GLTF 에셋 로더/레지스트리 ───────────────────────────────────
// KayKit Adventurers (CC0) 등 애니메이션 내장 GLB를 로드해
// 유닛 종류(sprite)별로 인스턴스화한다. 로드 실패 시 절차 모델로 폴백.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

interface Asset {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  normScale: number; // 캐릭터 키를 월드 기준(0.62)으로 정규화
}

const REGISTRY = new Map<string, Asset>();

/** GLB 파일 목록 (public/models/) */
const FILES: Record<string, string> = {
  knight: "models/Knight.glb",
  barbarian: "models/Barbarian.glb",
  mage: "models/Mage.glb",
  rogue: "models/Rogue_Hooded.glb",
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
    Object.entries(FILES).map(async ([key, url]) => {
      try {
        const gltf = await loader.loadAsync(import.meta.env.BASE_URL + url);
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const h = Math.max(0.001, box.max.y - box.min.y);
        REGISTRY.set(key, {
          scene: gltf.scene,
          clips: gltf.animations,
          normScale: 0.62 / h,
        });
      } catch (e) {
        console.warn(`GLTF 로드 실패(${key}) — 절차 모델로 대체:`, e);
      }
    })
  );
}

export function hasAsset(key: string | null | undefined): boolean {
  return !!key && REGISTRY.has(key);
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
  model.rotation.y = FACE_FIX;

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
