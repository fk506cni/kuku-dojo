#!/usr/bin/env node
/**
 * scripts/validate-i18n.mjs
 *
 * MESSAGES の言語間キー一致検査 (SPEC §8.9.5 / v1.2.0 Phase B / 第13回 C13-13)。
 *
 * 目的:
 *   - index.html の `<script type="application/json" id="kuku-messages">` を抽出
 *   - 参照言語 ja に対して他言語 (en / zh-CN / ...) のキーが過不足なく一致するか検査
 *   - missing / extra があれば exit 1 でビルド失敗にする
 *
 * 呼出元: scripts/build-dist.mjs 先頭で execSync("node scripts/validate-i18n.mjs")
 * スタンドアロン実行も可: `node scripts/validate-i18n.mjs`
 *
 * 参照: SPEC §7.2.1.1 同期責任表 / Phase A で未整備だった CI 検査を Phase B で新設。
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_HTML = resolve(__dirname, "..", "index.html");

const html = readFileSync(SRC_HTML, "utf8");
// build-dist.mjs の MESSAGES_RE と同形式 (属性順変化を許容する [^>]*>)
const MESSAGES_RE = /<script\s+type="application\/json"\s+id="kuku-messages"[^>]*>([\s\S]*?)<\/script>/;
const m = html.match(MESSAGES_RE);
if (!m) {
  console.error("[validate-i18n] kuku-messages script not found in index.html");
  process.exit(1);
}

let messages;
try {
  messages = JSON.parse(m[1]);
} catch (e) {
  console.error("[validate-i18n] MESSAGES JSON parse failed:", e.message);
  process.exit(1);
}

if (!messages || typeof messages !== "object" || Array.isArray(messages) || !messages.ja) {
  console.error("[validate-i18n] MESSAGES must be an object with a 'ja' reference language");
  process.exit(1);
}

const langs = Object.keys(messages);
const refKeys = new Set(Object.keys(messages.ja));
let ok = true;

for (const lang of langs) {
  if (lang === "ja") continue;
  const keys = new Set(Object.keys(messages[lang]));
  for (const k of refKeys) {
    if (!keys.has(k)) {
      console.error(`[validate-i18n] [${lang}] missing key: ${k}`);
      ok = false;
    }
  }
  for (const k of keys) {
    if (!refKeys.has(k)) {
      console.error(`[validate-i18n] [${lang}] extra key: ${k}`);
      ok = false;
    }
  }
}

if (!ok) {
  console.error(`[validate-i18n] FAIL: key mismatch detected`);
  process.exit(1);
}
console.log(`[validate-i18n] OK: ${langs.length} languages (${langs.join(", ")}), ${refKeys.size} keys, all match`);
