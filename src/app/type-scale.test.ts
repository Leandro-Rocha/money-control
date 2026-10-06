import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

describe("escala tipográfica", () => {
  it("nenhum texto abaixo de 11px fora da escala (use text-2xs)", () => {
    const offenders = walk(SRC).flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)]
        .filter((m) => Number(m[1]) < 12)
        .map((m) => `${path.relative(SRC, f)}: ${m[0]}`),
    );
    expect(offenders).toEqual([]);
  });
});
