// StatsHelpers.aggregate ユニットテスト。SPEC §8.8 / prompts.md Step 11 実装対象 4。
// F1 (v1.1.0) で追加される時間集計（responseTime 関連）の検証。
//
// 既存の cellStats (recent STATS_RECENT_N セッション内の attempts / correct / wrong / correctRate) /
// danStats には手を加えない点を、既存テスト枠外で非破壊的に確認する。
//
// 新規フィールド（cellStats[key] 内に追記される想定）:
//   - responseTimes: number[]  - 最新 5 サンプル（timestamp 降順、同一セッション内は details[] 順）
//                                  cold start (先頭 3 問) は除外
//   - avgResponseMs: number|null - responseTimes[] の単純平均（空なら null）。trimmed mean 不採用 (C13-06)
//   - responseAttempts: number - 累積 responseTime サンプル件数（全有効セッション、cold start 除外）

import { test } from "node:test";
import assert from "node:assert";
import { loadCore } from "./helpers/load-core.mjs";

// 第16回 C16-09: マジックナンバー 3 / 5 ではなく load-core.mjs 経由で定数を参照し、
// 定数変更（例: COLD_START_COUNT = 3 → 4）時にテストが silent に古い挙動を検査し続けるのを防ぐ。
const { StatsHelpers, COLD_START_COUNT, STATS_RESPONSE_TIME_SAMPLES } = loadCore();

/** 先頭 N 問スキップを可視化するためのセッションビルダー。 */
function session(ts, details) {
  return {
    sessionId: "s" + ts,
    timestamp: ts,
    selectedDans: [2],
    totalQuestions: details.length,
    correctCount: details.filter((d) => d.isCorrect).length,
    elapsedTime: 60,
    details,
  };
}

/** 同一セルを繰り返す短縮ビルダー。responseTime だけを配列で受ける。 */
function cellSession(ts, dan, multiplier, times) {
  return session(
    ts,
    times.map((rt) => ({ dan, multiplier, correctAnswer: dan * multiplier, userAnswer: dan * multiplier, isCorrect: true, responseTime: rt })),
  );
}

test("aggregate: load-core.mjs が COLD_START_COUNT / STATS_RESPONSE_TIME_SAMPLES を export する（C16-09）", () => {
  assert.equal(typeof COLD_START_COUNT, "number");
  assert.ok(COLD_START_COUNT >= 1, "COLD_START_COUNT は正整数");
  assert.equal(typeof STATS_RESPONSE_TIME_SAMPLES, "number");
  assert.ok(STATS_RESPONSE_TIME_SAMPLES >= 1, "STATS_RESPONSE_TIME_SAMPLES は正整数");
});

test("aggregate: cellStats[key] に responseTimes / avgResponseMs / responseAttempts が生える", () => {
  const agg = StatsHelpers.aggregate([cellSession(1000, 2, 2, [1000, 1500, 2000, 2500, 3000])]);
  const cs = agg.cellStats["2-2"];
  assert.ok(Array.isArray(cs.responseTimes), "responseTimes は配列");
  assert.equal(typeof cs.avgResponseMs === "number" || cs.avgResponseMs === null, true);
  assert.equal(typeof cs.responseAttempts, "number");
});

test("aggregate: 各セッションの先頭 COLD_START_COUNT 問は responseTime 集計から除外（cold start）", () => {
  // 1 セッションで同一セル "3-4" を COLD_START_COUNT + 2 問連続。先頭 COLD_START_COUNT 問は除外、
  // 残り 2 問 [7000, 8000] のみ集計。
  const coldTimes = Array(COLD_START_COUNT).fill(99999);
  const agg = StatsHelpers.aggregate([cellSession(1000, 3, 4, coldTimes.concat([7000, 8000]))]);
  const cs = agg.cellStats["3-4"];
  // responseTimes は timestamp 降順 + 同一セッション内は details[] 順（= 入力順）で最新 STATS_RESPONSE_TIME_SAMPLES 件
  assert.deepEqual(cs.responseTimes, [7000, 8000]);
  assert.equal(cs.responseAttempts, 2);
  assert.equal(cs.avgResponseMs, 7500); // 単純平均 (7000+8000)/2
});

test("aggregate: セッション内の問題数 <= COLD_START_COUNT なら responseTime は 0 件", () => {
  // ちょうど COLD_START_COUNT 問ピッタリ（= ギリギリ全除外）のケース。
  const times = Array(COLD_START_COUNT).fill(0).map((_, i) => 4000 + i * 1000);
  const agg = StatsHelpers.aggregate([cellSession(1000, 5, 5, times)]);
  const cs = agg.cellStats["5-5"];
  assert.deepEqual(cs.responseTimes, []);
  assert.equal(cs.responseAttempts, 0);
  assert.equal(cs.avgResponseMs, null);
});

test("aggregate: 複数セッションで最新 5 サンプル（timestamp 降順）に絞られる", () => {
  // 各セッションで "2-3" を 4 問（先頭 3 問は cold start 除外 → 各 1 サンプルのみ寄与）
  const sessions = [
    cellSession(1000, 2, 3, [9000, 9000, 9000, 1000]), // 古 → 除外
    cellSession(2000, 2, 3, [9000, 9000, 9000, 2000]),
    cellSession(3000, 2, 3, [9000, 9000, 9000, 3000]),
    cellSession(4000, 2, 3, [9000, 9000, 9000, 4000]),
    cellSession(5000, 2, 3, [9000, 9000, 9000, 5000]),
    cellSession(6000, 2, 3, [9000, 9000, 9000, 6000]), // 新 → 先頭
  ];
  const agg = StatsHelpers.aggregate(sessions);
  const cs = agg.cellStats["2-3"];
  // 新→古の順で最新 5 件（6000 → 5000 → 4000 → 3000 → 2000）
  assert.deepEqual(cs.responseTimes, [6000, 5000, 4000, 3000, 2000]);
  assert.equal(cs.responseAttempts, 6); // 累積は 6 サンプル全件（cold start 除外後）
  assert.equal(cs.avgResponseMs, 4000); // (6000+5000+4000+3000+2000)/5
});

test("aggregate: 同一セッション内の複数サンプル順序は details[] の順（timestamp 同値での tie-break）", () => {
  // 1 セッション内に同一セル "4-4" 複数（4 問目以降が cold start 外）
  const sessions = [
    cellSession(1000, 4, 4, [9000, 9000, 9000, 100, 200, 300]),
  ];
  const agg = StatsHelpers.aggregate(sessions);
  // details[] の元順（100, 200, 300）で入ってくる
  assert.deepEqual(agg.cellStats["4-4"].responseTimes, [100, 200, 300]);
  assert.equal(agg.cellStats["4-4"].avgResponseMs, 200);
});

test("aggregate: responseTime が欠落 / 非数値 / <=0 のサンプルは除外（cold start count には含める）", () => {
  // details 先頭 3 問は cold start で除外扱いだが、4 問目以降でも無効 responseTime はスキップ
  const sessions = [
    session(1000, [
      { dan: 2, multiplier: 2, responseTime: 1000, isCorrect: true, correctAnswer: 4, userAnswer: 4 }, // cold
      { dan: 2, multiplier: 2, responseTime: 1000, isCorrect: true, correctAnswer: 4, userAnswer: 4 }, // cold
      { dan: 2, multiplier: 2, responseTime: 1000, isCorrect: true, correctAnswer: 4, userAnswer: 4 }, // cold
      { dan: 2, multiplier: 2, isCorrect: true, correctAnswer: 4, userAnswer: 4 }, // missing responseTime → skip
      { dan: 2, multiplier: 2, responseTime: "slow", isCorrect: true, correctAnswer: 4, userAnswer: 4 }, // non-number → skip
      { dan: 2, multiplier: 2, responseTime: 0, isCorrect: true, correctAnswer: 4, userAnswer: 4 }, // 0 → skip
      { dan: 2, multiplier: 2, responseTime: 1800, isCorrect: true, correctAnswer: 4, userAnswer: 4 }, // kept
    ]),
  ];
  const agg = StatsHelpers.aggregate(sessions);
  const cs = agg.cellStats["2-2"];
  assert.deepEqual(cs.responseTimes, [1800]);
  assert.equal(cs.responseAttempts, 1);
  assert.equal(cs.avgResponseMs, 1800);
});

test("aggregate: データ皆無セルは avgResponseMs=null / responseTimes=[] / responseAttempts=0 で初期化", () => {
  const agg = StatsHelpers.aggregate([]);
  for (let dan = 1; dan <= 9; dan++) {
    for (let m = 1; m <= 9; m++) {
      const cs = agg.cellStats[dan + "-" + m];
      assert.deepEqual(cs.responseTimes, []);
      assert.equal(cs.avgResponseMs, null);
      assert.equal(cs.responseAttempts, 0);
    }
  }
});

test("aggregate: 既存 cellStats (attempts/correct/wrong/correctRate) は影響を受けない（回帰担保）", () => {
  // recent 5 セッションに cold start 3 問含む session を 1 本。
  // 既存 cellStats.attempts は details[] 全件をカウントする仕様のまま。
  const agg = StatsHelpers.aggregate([cellSession(1000, 7, 7, [1000, 1500, 2000, 2500, 3000])]);
  const cs = agg.cellStats["7-7"];
  assert.equal(cs.attempts, 5);    // cold start 込みで 5 問
  assert.equal(cs.correct, 5);
  assert.equal(cs.wrong, 0);
  assert.equal(cs.correctRate, 1);
});
