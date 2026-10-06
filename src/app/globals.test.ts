import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ACCENT_PRESETS } from "@/lib/appearance";

const css = readFileSync(path.resolve(__dirname, "globals.css"), "utf8");

function block(marker: string): Map<string, string> {
  const re = new RegExp(`/\\* ${marker} \\*/\\s*[^{]+\\{([^}]*)\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`bloco "${marker}" não encontrado em globals.css`);
  const vars = new Map<string, string>();
  for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(d[1], d[2].trim());
  return vars;
}

describe("tokens de tema", () => {
  it("todo token do claro tem par no escuro", () => {
    const light = block("tokens:light");
    const dark = block("tokens:dark");
    const missing = [...light.keys()].filter((k) => !dark.has(k));
    expect(missing).toEqual([]);
    expect(light.size).toBeGreaterThanOrEqual(17);
  });

  it("vermelho e âmbar seguem o spec", () => {
    const light = block("tokens:light");
    expect(light.get("--negative")).toBe("hsl(358 80% 45%)");
    expect(light.get("--caution")).toBe("#c76a00");
  });
});

describe("presets de acento no CSS", () => {
  it.each(ACCENT_PRESETS.map((p) => [p.id, p] as const))("%s bate com appearance.ts", (id, p) => {
    const re = new RegExp(`\\[data-accent="${id}"\\]\\s*\\{([^}]*)\\}`);
    const m = css.match(re);
    expect(m, `bloco [data-accent="${id}"] ausente`).toBeTruthy();
    const body = m![1];
    expect(body).toContain(`--accent: ${p.accent};`);
    expect(body).toContain(`--accent-soft: ${p.soft};`);
    expect(body).toContain(`--accent-ink: ${p.ink};`);
  });
});
