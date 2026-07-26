// Static check: every t("key")/t.rich("key") call in src/ must resolve to a
// real entry in both messages/en.json and messages/fr.json.
//
// Why this exists: on 2026-07-12 the entire real CSV-upload page's translations
// (messages.upload — ~80 keys covering the dropzone, every error state, and
// the post-import summary) were silently overwritten by an unrelated small
// "demo upload progress" block that happened to reuse the same top-level JSON
// key. JSON.parse doesn't error on duplicate/overwritten keys, TypeScript
// doesn't check message-file contents, and next-intl doesn't fail the build
// on a missing key either — it just renders the raw key name ("upload.done.title")
// to real users. Nothing in the existing toolchain would have caught it before
// a real person saw it. This script exists so that never happens silently again.
//
// Known limitation: dynamic keys built from a template literal, e.g.
// t(`status.${client.status}`), can't be resolved statically — this script
// skips those. They were manually cross-checked against every enum value at
// the time this script was written; if you add a new enum value that maps to
// a dynamic translation key, double-check the corresponding messages/*.json
// entry exists by hand.

import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const en = require(path.join(ROOT, "messages", "en.json"));
const fr = require(path.join(ROOT, "messages", "fr.json"));

function flatten(obj: Record<string, unknown>, prefix = "", out: Set<string> = new Set()): Set<string> {
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    const key = prefix ? `${prefix}.${k}` : k;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      flatten(val as Record<string, unknown>, key, out);
    } else {
      out.add(key);
    }
  }
  return out;
}
const enKeys = flatten(en);
const frKeys = flatten(fr);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx|ts)$/.test(entry.name)) files.push(full);
  }
  return files;
}
const files = walk(SRC);

interface Miss { file: string; fullPath: string; locale: "en" | "fr"; }
const misses: Miss[] = [];
let dynamicCount = 0;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);

  // A translator identifier can legitimately map to more than one namespace
  // in the same file — most commonly a helper function parameter typed
  // `t: ReturnType<typeof useTranslations<"some.namespace">>` that shadows an
  // outer `const t = useTranslations("other.namespace")` within its own body.
  // Rather than tracking exact lexical scope, we collect every namespace an
  // identifier is ever bound to in the file and accept a key if it resolves
  // under ANY of them — this trades a little precision for zero false
  // positives on the shadowing pattern that's actually used in this codebase.
  const nsCandidates: Record<string, Set<string>> = {};
  const addNs = (varName: string, ns: string) => {
    (nsCandidates[varName] ??= new Set()).add(ns);
  };

  let m: RegExpExecArray | null;
  const declRegex = /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g;
  while ((m = declRegex.exec(content))) addNs(m[1], m[2]);

  const declRegexNoArg = /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*\)/g;
  while ((m = declRegexNoArg.exec(content))) addNs(m[1], "");

  const typedParamRegex = /(\w+)\s*:\s*ReturnType<typeof\s+useTranslations<"([^"]+)">>/g;
  while ((m = typedParamRegex.exec(content))) addNs(m[1], m[2]);

  if (Object.keys(nsCandidates).length === 0) continue;

  for (const varName of Object.keys(nsCandidates)) {
    const namespaces = [...nsCandidates[varName]];
    const callRegex = new RegExp(`\\b${varName}(?:\\.rich)?\\(\\s*([^)]*)`, "g");
    let cm: RegExpExecArray | null;
    while ((cm = callRegex.exec(content))) {
      const argsRaw = cm[1];
      const strMatch = argsRaw.match(/^\s*"([^"]*)"/) || argsRaw.match(/^\s*'([^']*)'/);
      if (strMatch) {
        const key = strMatch[1];
        if (!key) continue;
        const enOk = namespaces.some((ns) => enKeys.has(ns ? `${ns}.${key}` : key));
        const frOk = namespaces.some((ns) => frKeys.has(ns ? `${ns}.${key}` : key));
        const fullPath = namespaces[0] ? `${namespaces[0]}.${key}` : key;
        if (!enOk) misses.push({ file: rel, fullPath, locale: "en" });
        if (!frOk) misses.push({ file: rel, fullPath, locale: "fr" });
      } else if (/^\s*`/.test(argsRaw)) {
        dynamicCount++;
      }
    }
  }
}

if (misses.length === 0) {
  console.log(`✓ i18n check passed — ${files.length} files scanned, every static translation key resolves in both en.json and fr.json.`);
  console.log(`  (${dynamicCount} dynamic template-literal keys were skipped — not statically checkable; see comment at the top of this script.)`);
} else {
  console.error(`✗ i18n check found ${misses.length} translation key(s) used in code but missing from messages/*.json:\n`);
  for (const miss of misses) {
    console.error(`  [${miss.locale}] ${miss.file}  →  "${miss.fullPath}"`);
  }
  console.error(
    `\nThis usually means one of:\n` +
    `  1. A typo in a t("...") call.\n` +
    `  2. Two features share the same top-level JSON key and one silently overwrote the other's\n` +
    `     translations (JSON.parse allows duplicate keys — the last one wins with no error).\n` +
    `Fix by adding the missing key(s) to both messages/en.json and messages/fr.json, or by giving\n` +
    `the colliding feature its own distinct namespace.`
  );
  process.exit(1);
}
