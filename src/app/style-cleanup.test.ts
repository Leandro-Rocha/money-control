import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

const RULES: [string, RegExp][] = [
  ["slate-", /(?<![a-z])slate-/],
  ["text-[9px]", /text-\[9px\]/],
  ["text-[10px]", /text-\[10px\]/],
  ["text-[11px]", /text-\[11px\]/],
  ["alert(", /(?<![\w.])alert\(|window\.alert\(/],
  ["confirm(", /(?<![\w])confirm\(|window\.confirm\(/],
];

describe("critério de limpeza do redesenho (spec 8)", () => {
  const all = files(ROOT).map((f) => [f.slice(ROOT.length + 1), readFileSync(f, "utf8")] as const);
  it.each(RULES)("nenhum %s em src/", (_, re) => {
    const hits = all.filter(([, src]) => re.test(src)).map(([f]) => f);
    expect(hits).toEqual([]);
  });
});
