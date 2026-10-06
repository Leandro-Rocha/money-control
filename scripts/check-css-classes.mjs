#!/usr/bin/env node
// Uso: node scripts/check-css-classes.mjs <css-compilado> [saida.txt]
// Lista os tokens de string em src/ (fora de testes) que parecem classes e
// não aparecem como seletor no CSS compilado. Há ruído (palavras comuns);
// o valor está em comparar duas execuções (antes × depois) com `comm`.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [cssPath, outPath] = process.argv.slice(2);
if (!cssPath) {
  console.error("uso: node scripts/check-css-classes.mjs <css> [saida]");
  process.exit(2);
}

const css = readFileSync(cssPath, "utf8");
const unescape = (s) =>
  s
    .replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\(.)/g, "$1");
const defined = new Set();
for (const m of css.matchAll(/\.((?:\\[0-9a-fA-F]{1,6} ?|\\.|[\w-])+)/g)) defined.add(unescape(m[1]));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const used = new Set();
for (const file of walk("src")) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    for (const tok of m[2].split(/\s+/)) {
      if (!tok || /[${}]/.test(tok)) continue;
      if (!/^[!-]?[a-z0-9@[(*][^\s"'`]*$/i.test(tok)) continue;
      used.add(tok);
    }
  }
}

const missing = [...used].filter((c) => !defined.has(c)).sort();
const text = missing.join("\n") + "\n";
if (outPath) writeFileSync(outPath, text);
else process.stdout.write(text);
console.error(`${used.size} tokens, ${missing.length} sem CSS`);
