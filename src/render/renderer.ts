import { Stage, Terrain, Unit } from "../core/types";
import { terrainAt } from "../core/grid";

export const TILE = 52;

const TERRAIN_COLOR: Record<Terrain, string> = {
  plain: "#8aa85c",
  forest: "#4d7a3a",
  mountain: "#8a7a62",
  fort: "#9c8f7a",
};

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number; // 남은 프레임
}

export class Renderer {
  ctx: CanvasRenderingContext2D;

  constructor(public canvas: HTMLCanvasElement, public stage: Stage) {
    canvas.width = stage.width * TILE;
    canvas.height = stage.height * TILE;
    this.ctx = canvas.getContext("2d")!;
  }

  draw(
    units: Unit[],
    moveRange: Set<string> | null,
    attackRange: Set<string> | null,
    selected: Unit | null,
    cursor: { x: number; y: number } | null,
    floats: FloatText[]
  ) {
    const { ctx, stage } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 지형
    for (let y = 0; y < stage.height; y++) {
      for (let x = 0; x < stage.width; x++) {
        const t = terrainAt(stage, x, y);
        ctx.fillStyle = TERRAIN_COLOR[t];
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        // 지형 장식
        if (t === "forest") this.deco(x, y, "▲", "#2e5424");
        if (t === "mountain") this.deco(x, y, "⛰", "#6b5d49");
        if (t === "fort") this.deco(x, y, "🏯", "");
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    // 이동/공격 범위 하이라이트
    if (moveRange) {
      ctx.fillStyle = "rgba(80,150,255,0.4)";
      for (const k of moveRange) {
        const [x, y] = k.split(",").map(Number);
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    if (attackRange) {
      ctx.fillStyle = "rgba(255,70,70,0.45)";
      for (const k of attackRange) {
        const [x, y] = k.split(",").map(Number);
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    // 유닛
    for (const u of units) {
      if (u.hp <= 0) continue;
      const cx = u.x * TILE + TILE / 2;
      const cy = u.y * TILE + TILE / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, TILE * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = u.side === "player" ? "#2b5fd9" : "#c43131";
      if (u.acted && u.side === "player") ctx.fillStyle = "#5a6b8f";
      ctx.fill();
      ctx.lineWidth = u === selected ? 3 : 1.5;
      ctx.strokeStyle = u === selected ? "#ffe14d" : "rgba(0,0,0,0.5)";
      ctx.stroke();

      // 이름 첫 글자
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${TILE * 0.34}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(u.name[0], cx, cy);

      // HP 바
      const w = TILE * 0.7;
      const hx = u.x * TILE + (TILE - w) / 2;
      const hy = u.y * TILE + TILE - 8;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(hx, hy, w, 5);
      ctx.fillStyle = u.hp / u.maxHp > 0.4 ? "#4ddb66" : "#ffb347";
      ctx.fillRect(hx, hy, w * (u.hp / u.maxHp), 5);
    }

    // 커서
    if (cursor) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffe14d";
      ctx.strokeRect(cursor.x * TILE + 2, cursor.y * TILE + 2, TILE - 4, TILE - 4);
    }

    // 데미지 플로팅 텍스트
    ctx.textAlign = "center";
    for (const f of floats) {
      ctx.globalAlpha = Math.min(1, f.life / 20);
      ctx.font = `bold 18px sans-serif`;
      ctx.fillStyle = f.color;
      const rise = (40 - f.life) * 0.8;
      ctx.fillText(f.text, f.x * TILE + TILE / 2, f.y * TILE + 6 - rise);
      ctx.globalAlpha = 1;
    }
  }

  private deco(x: number, y: number, ch: string, color: string) {
    const { ctx } = this;
    ctx.font = `${TILE * 0.4}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (color) ctx.fillStyle = color;
    ctx.fillText(ch, x * TILE + TILE / 2, y * TILE + TILE / 2);
  }
}
