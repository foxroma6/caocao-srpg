#!/usr/bin/env node
// ── Tripo AI 3D 모델 생성 파이프라인 ────────────────────────────
// 사용법:
//   node scripts/tripo-generate.mjs --hero caocao        # 프리셋 영웅 1명
//   node scripts/tripo-generate.mjs --all                # 영웅 전원
//   node scripts/tripo-generate.mjs --prompt "..." --name my_model
//
// API 키: 환경변수 TRIPO_API_KEY 또는 프로젝트 루트 .env.local
// 결과: public/models/<name>.glb 로 저장 → 게임이 자동으로 사용
//
// 라이선스 주의: Tripo 무료 플랜 생성물은 CC BY 4.0 (출처 표기 필요),
// 유료 플랜은 상업적 사용 가능한 소유권 부여. 자세한 건 Tripo 약관 참조.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.tripo3d.ai/v2/openapi";

// ── 프리셋: 애니메이션풍 치비(SD) 삼국지 영웅 프롬프트 ──────────
// 랑그릿사류 SRPG 유닛 느낌: 귀여운 비율 + 특징만 깔끔하게
const STYLE =
  "chibi anime style 3D game character, cute super-deformed proportions with large head, " +
  "clean cel-shaded hand-painted texture, vibrant colors, anime tactical RPG unit, " +
  "smooth simple shapes, single character, full body, standing on flat ground";

const HEROES = {
  caocao: {
    name: "hero_caocao",
    prompt:
      `Cute chibi anime warlord Cao Cao from Three Kingdoms riding a small white horse, ` +
      `dark navy and gold ornate armor, flowing red cape, small golden crown, ` +
      `confident smirk, tiny goatee beard, ${STYLE}`,
  },
  xiahoudun: {
    name: "hero_xiahoudun",
    prompt:
      `Cute chibi anime general Xiahou Dun from Three Kingdoms, black eyepatch over one eye, ` +
      `short black beard, steel-blue plate armor with big shoulder pauldrons, ` +
      `holding an oversized guandao polearm, determined expression, ${STYLE}`,
  },
  xiahouyuan: {
    name: "hero_xiahouyuan",
    prompt:
      `Cute chibi anime archer general Xiahou Yuan from Three Kingdoms riding a small brown horse, ` +
      `blue leather armor, red headband, cheerful grin, ` +
      `holding an oversized bow, small quiver on back, ${STYLE}`,
  },
  taoist: {
    name: "hero_taoist",
    prompt:
      `Cute chibi anime taoist sorcerer with long grey beard, ` +
      `yellow hooded robe, holding a wooden staff with glowing purple orb, ` +
      `mysterious smile, ${STYLE}`,
  },
};

// ── API 헬퍼 ────────────────────────────────────────────────────

function apiKey() {
  if (process.env.TRIPO_API_KEY) return process.env.TRIPO_API_KEY.trim();
  try {
    const env = readFileSync(join(ROOT, ".env.local"), "utf8");
    const m = env.match(/TRIPO_API_KEY=(\S+)/);
    if (m) return m[1];
  } catch {}
  console.error("❌ TRIPO_API_KEY가 없습니다 (.env.local 또는 환경변수).");
  process.exit(1);
}

const KEY = apiKey();
const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function req(path, options = {}) {
  const res = await fetch(`${API}${path}`, { headers, ...options });
  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(`Tripo API 오류 (code ${json.code}): ${json.message ?? ""} ${json.suggestion ?? ""}`);
  }
  return json.data;
}

async function balance() {
  const d = await req("/user/balance");
  return d.balance;
}

async function createTask(prompt) {
  const d = await req("/task", {
    method: "POST",
    body: JSON.stringify({ type: "text_to_model", prompt }),
  });
  return d.task_id;
}

async function pollTask(taskId, label) {
  const start = Date.now();
  for (;;) {
    if (Date.now() - start > 15 * 60 * 1000) throw new Error("시간 초과 (15분)");
    const d = await req(`/task/${taskId}`);
    const pct = d.progress ?? 0;
    process.stdout.write(`\r  [${label}] ${d.status} ${pct}%   `);
    if (d.status === "success") {
      process.stdout.write("\n");
      return d.output?.pbr_model ?? d.output?.model ?? d.output?.base_model;
    }
    if (["failed", "cancelled", "banned", "expired"].includes(d.status)) {
      process.stdout.write("\n");
      throw new Error(`태스크 실패: ${d.status}`);
    }
    await new Promise((r) => setTimeout(r, 6000));
  }
}

async function download(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`다운로드 실패: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buf);
  return buf.length;
}

async function generate(name, prompt) {
  console.log(`\n▶ 생성 시작: ${name}`);
  console.log(`  프롬프트: ${prompt.slice(0, 80)}…`);
  const taskId = await createTask(prompt);
  console.log(`  태스크: ${taskId}`);
  const modelUrl = await pollTask(taskId, name);
  if (!modelUrl) throw new Error("결과 모델 URL이 없습니다");
  const out = join(ROOT, "public", "models", `${name}.glb`);
  const size = await download(modelUrl, out);
  console.log(`  ✅ 저장: public/models/${name}.glb (${(size / 1024 / 1024).toFixed(1)}MB)`);
}

// ── 메인 ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

(async () => {
  console.log(`잔여 크레딧: ${await balance()}`);

  const jobs = [];
  if (args.includes("--all")) {
    for (const h of Object.values(HEROES)) jobs.push(h);
  } else if (getArg("--hero")) {
    const h = HEROES[getArg("--hero")];
    if (!h) {
      console.error(`알 수 없는 영웅. 선택지: ${Object.keys(HEROES).join(", ")}`);
      process.exit(1);
    }
    jobs.push(h);
  } else if (getArg("--prompt")) {
    jobs.push({ name: getArg("--name") ?? "custom_model", prompt: getArg("--prompt") });
  } else {
    console.log(`사용법:
  node scripts/tripo-generate.mjs --hero <${Object.keys(HEROES).join("|")}>
  node scripts/tripo-generate.mjs --all
  node scripts/tripo-generate.mjs --prompt "..." --name <파일명>`);
    process.exit(0);
  }

  for (const job of jobs) {
    try {
      await generate(job.name, job.prompt);
    } catch (e) {
      console.error(`  ❌ ${job.name}: ${e.message}`);
    }
  }
  console.log(`\n잔여 크레딧: ${await balance()}`);
  console.log("완료. 게임을 새로고침하면 새 모델이 적용됩니다.");
})();
