#!/usr/bin/env node
/**
 * scripts/validate-i18n.mjs
 *
 * MESSAGES の言語間整合性検査 (SPEC §8.9.5 / v1.2.0 Phase B / 第13回 C13-13 / 第18回 C18-03/04/15)。
 *
 * 検査次元:
 *   1. key-set 一致: 参照言語 ja に対して他言語 (en / zh-CN / ...) のキーが過不足ないか
 *   2. placeholder 整合: 各 key の値に含まれる `{name}` 等の placeholder 集合が ja と一致するか
 *      (silent な i18n 退行 — ja に "Hi {name}!" / en に "Hi" — を防ぐ)
 *   3. 型ガード: messages.{lang} が plain object であることを確認
 *      (null / string / array が紛れ込んだ場合に TypeError スタックではなく明示エラーで落とす)
 *
 * 失敗時はすべて exit 1 でビルド or テストを停止させる。
 *
 * 呼出元:
 *   - scripts/build-dist.mjs 先頭で execFileSync (バンドル前検査)
 *   - package.json "test" スクリプトで `node scripts/validate-i18n.mjs` を npm test の一部に組込み
 *     (第18回 C18-05 — node:test を経由しないが test 緑の条件に含める)
 *   - スタンドアロン実行も可: `node scripts/validate-i18n.mjs`
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

// 型ガード (第18回 C18-04): null / 配列 / プリミティブの混入で Object.keys が
// TypeError を投げる経路を、明示的なエラーメッセージで止める。
function isDict(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function describe(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

if (!isDict(messages)) {
  console.error("[validate-i18n] MESSAGES root must be a plain object (got " + describe(messages) + ")");
  process.exit(1);
}
if (!isDict(messages.ja)) {
  console.error("[validate-i18n] MESSAGES.ja must be a plain object (got " + describe(messages.ja) + ")");
  process.exit(1);
}

const langs = Object.keys(messages);
const refKeys = new Set(Object.keys(messages.ja));
let ok = true;

// placeholder 整合検査用 (第18回 C18-03): `{name}` / `{n}` 等の英数アンダースコア
// 識別子のみを placeholder と認識する。Util.t の split-join 置換と同じ namespace。
const PH_RE = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
function placeholders(value) {
  if (typeof value !== "string") return new Set();
  return new Set([...value.matchAll(PH_RE)].map((mm) => mm[1]));
}

for (const lang of langs) {
  if (lang === "ja") continue;

  // 型ガード (C18-04): 翻訳が壊れた状態 (null / 配列 / "string") の早期検出
  if (!isDict(messages[lang])) {
    console.error(`[validate-i18n] MESSAGES.${lang} must be a plain object (got ${describe(messages[lang])})`);
    ok = false;
    continue;
  }

  const dict = messages[lang];
  const keys = new Set(Object.keys(dict));

  // 1. key-set 一致
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

  // 2. placeholder 整合 (両方の辞書に存在する key についてのみ検査)
  for (const k of refKeys) {
    if (!keys.has(k)) continue;
    const phJa = placeholders(messages.ja[k]);
    const phLang = placeholders(dict[k]);
    const missing = [...phJa].filter((p) => !phLang.has(p));
    const extra = [...phLang].filter((p) => !phJa.has(p));
    if (missing.length > 0 || extra.length > 0) {
      console.error(
        `[validate-i18n] [${lang}] placeholder mismatch on '${k}': ` +
        `missing=[${missing.join(",")}], extra=[${extra.join(",")}]`
      );
      ok = false;
    }
  }
}

if (!ok) {
  console.error(`[validate-i18n] FAIL: integrity check failed`);
  process.exit(1);
}
console.log(
  `[validate-i18n] OK: ${langs.length} languages (${langs.join(", ")}), ` +
  `${refKeys.size} keys, key-set + placeholder + shape all match`
);
