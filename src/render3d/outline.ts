// ── 만화풍 외곽선 (인버티드 헐) ─────────────────────────────────
// 각 메시의 뒷면(BackSide)을 법선 방향으로 살짝 부풀린 검은 복제를 겹쳐
// 애니메이션 선화 느낌을 낸다. 스킨드 메시(뼈대 애니메이션)도 지원.

import * as THREE from "three";

function makeOutlineMaterial(thickness: number): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({
    color: 0x241a12,
    side: THREE.BackSide,
    transparent: true, // 사망 페이드에 함께 사라지도록
  });
  m.onBeforeCompile = (shader) => {
    // MeshBasicMaterial에는 objectNormal이 없으므로 normal 어트리뷰트 사용
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `transformed += normalize(normal) * ${thickness.toFixed(4)};\n#include <project_vertex>`
    );
  };
  return m;
}

/**
 * root 아래 모든 메시에 외곽선을 붙인다.
 * 평면(깃발·포말)과 스프라이트는 제외. 유닛 하나당 한 번 호출.
 */
export function addOutlines(root: THREE.Object3D, thickness = 0.012) {
  const mat = makeOutlineMaterial(thickness);
  const targets: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (o.userData.isOutline) return;
    if (o.geometry instanceof THREE.PlaneGeometry) return;
    targets.push(o);
  });
  for (const mesh of targets) {
    let outline: THREE.Mesh;
    if (mesh instanceof THREE.SkinnedMesh) {
      const sk = new THREE.SkinnedMesh(mesh.geometry, mat);
      sk.bind(mesh.skeleton, mesh.bindMatrix);
      sk.frustumCulled = false;
      outline = sk;
    } else {
      outline = new THREE.Mesh(mesh.geometry, mat);
    }
    outline.userData.isOutline = true;
    mesh.add(outline);
  }
}
