// ── 모델 디버그 뷰어: /viewer.html?m=hero_caocao&fix=-90 ────────
// 원점에 모델을 세우고 +X(빨강)/+Z(파랑) 축을 표시한다.
// 게임에서 유닛의 "앞"은 +X. fix 파라미터(도 단위)로 faceFix 실험 가능.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const params = new URLSearchParams(location.search);
const modelName = params.get("m") ?? "hero_caocao";
const fixDeg = Number(params.get("fix") ?? "0");

const W = 800;
const H = 800;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(W, H);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2e38);
scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(3, 6, 4);
scene.add(sun);

scene.add(new THREE.GridHelper(2, 8, 0x888888, 0x555555));
scene.add(new THREE.AxesHelper(1)); // X=빨강(게임의 앞), Y=초록, Z=파랑

// 카메라: 게임과 같은 방향 (+X+Z 쪽 위에서 내려다봄)
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
camera.position.set(1.6, 1.4, 1.6);
camera.lookAt(0, 0.35, 0);

const info = document.getElementById("info")!;
info.textContent = `${modelName}.glb · fix=${fixDeg}° · 카메라는 게임과 같은 방향(+X+Z에서 봄) · X축(빨강)이 게임의 '앞'`;

new GLTFLoader().load(
  `/models/${modelName}.glb`,
  (gltf) => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const h = box.max.y - box.min.y;
    gltf.scene.scale.setScalar(0.7 / h);
    // 발밑을 y=0에 맞춤
    const box2 = new THREE.Box3().setFromObject(gltf.scene);
    gltf.scene.position.y = -box2.min.y;
    gltf.scene.rotation.y = (fixDeg * Math.PI) / 180;
    scene.add(gltf.scene);
  },
  undefined,
  (e) => (info.textContent = `로드 실패: ${e}`)
);

function frame() {
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
