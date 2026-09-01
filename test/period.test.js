// Month-boundary logic for the Monthly Budget. Run with: npm test
const assert = require("assert");
const { isPeriod, monthOfLabel, inferPeriod, planRollover } = require("../lib/period");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    console.error(`FAIL  ${name}\n      ${err.message}`);
    process.exitCode = 1;
  }
}

const day = (d, price = 100) => ({ day: d, name: "x", price });
const blank = (d) => ({ day: d, name: "", price: 0 });
const undated = (price = 100) => ({ day: "", name: "x", price });

test("isPeriod accepts YYYY-MM and rejects anything else", () => {
  assert.ok(isPeriod("2026-09"));
  assert.ok(isPeriod("2026-01"));
  assert.ok(isPeriod("2026-12"));
  ["2026-00", "2026-13", "2026-9", "26-09", "2026/09", "", null, undefined].forEach((v) =>
    assert.ok(!isPeriod(v), `should reject ${JSON.stringify(v)}`)
  );
});

test("monthOfLabel reads both stored label formats, and rolls the year back", () => {
  assert.strictEqual(monthOfLabel("16 Aug (Saturday)", "2026-09"), "2026-08");
  assert.strictEqual(monthOfLabel("(Monday) 31 Aug", "2026-09"), "2026-08");
  assert.strictEqual(monthOfLabel("28 Dec (Monday)", "2026-01"), "2025-12");
  assert.strictEqual(monthOfLabel("", "2026-09"), null);
  assert.strictEqual(monthOfLabel("whenever", "2026-09"), null);
});

test("inferPeriod follows the weight of the entries, not the last one", () => {
  const items = [day("16 Aug"), day("17 Aug"), day("31 Aug"), blank("1 Sep")];
  assert.strictEqual(inferPeriod(items, "2026-09"), "2026-08");
});

test("inferPeriod falls back to blank rows when nothing has been written yet", () => {
  assert.strictEqual(inferPeriod([blank("22 Aug")], "2026-09"), "2026-08");
  assert.strictEqual(inferPeriod([undated()], "2026-09"), null);
  assert.strictEqual(inferPeriod([], "2026-09"), null);
});

// The case that actually failed: opening the app in September auto-added a row
// dated today to August's list, and reading the last entry made the whole month
// look current.
test("a today-dated blank row does not cancel the rollover", () => {
  const plan = planRollover(
    { period: "", budget: 247000, description: "100000 + 5000", items: [day("16 Aug"), day("31 Aug"), blank("1 Sep")] },
    "2026-09"
  );
  assert.strictEqual(plan.archives.length, 1);
  assert.strictEqual(plan.archives[0].period, "2026-08");
  assert.strictEqual(plan.archives[0].items.length, 2);
  assert.strictEqual(plan.archives[0].description, "100000 + 5000");
  assert.deepStrictEqual(plan.keep, [blank("1 Sep")]);
  assert.strictEqual(plan.period, "2026-09");
});

test("entries typed in the new month stay in it, with their amounts", () => {
  const plan = planRollover(
    { period: "2026-08", budget: 10, description: "", items: [day("30 Aug"), day("1 Sep", 500), day("2 Sep", 250)] },
    "2026-09"
  );
  assert.deepStrictEqual(plan.archives.map((a) => a.period), ["2026-08"]);
  assert.strictEqual(plan.archives[0].items.length, 1);
  assert.deepStrictEqual(plan.keep.map((i) => i.price), [500, 250]);
});

test("undated entries close with the month they were written in", () => {
  const plan = planRollover(
    { period: "", budget: 0, description: "", items: [day("16 Aug"), undated(58020), blank("1 Sep")] },
    "2026-09"
  );
  assert.strictEqual(plan.archives.length, 1);
  assert.strictEqual(plan.archives[0].period, "2026-08");
  assert.deepStrictEqual(plan.archives[0].items.map((i) => i.price), [100, 58020]);
});

test("a section wrongly stamped with the current month is repaired by its entries", () => {
  const plan = planRollover(
    { period: "2026-09", budget: 247000, description: "note", items: [day("16 Aug"), day("31 Aug")] },
    "2026-09"
  );
  assert.deepStrictEqual(plan.archives.map((a) => a.period), ["2026-08"]);
  assert.deepStrictEqual(plan.keep, []);
});

test("re-opening the month already in progress changes nothing", () => {
  const plan = planRollover(
    { period: "2026-09", budget: 300000, description: "", items: [day("2 Sep")] },
    "2026-09"
  );
  assert.deepStrictEqual(plan, { archives: [], keep: null, reset: false, period: "2026-09" });
});

test("an empty month is cleared forward without leaving a record", () => {
  const plan = planRollover({ period: "2026-08", budget: 0, description: "  ", items: [] }, "2026-09");
  assert.deepStrictEqual(plan.archives, []);
  assert.strictEqual(plan.reset, true);
  assert.strictEqual(plan.period, "2026-09");
});

test("a budget set but never spent still leaves a record", () => {
  const plan = planRollover({ period: "2026-08", budget: 300000, description: "", items: [] }, "2026-09");
  assert.deepStrictEqual(plan.archives.map((a) => a.period), ["2026-08"]);
  assert.strictEqual(plan.archives[0].budget, 300000);
});

test("months skipped entirely keep their own records", () => {
  const plan = planRollover(
    { period: "", budget: 10, description: "note", items: [day("9 Jul"), day("10 Jul"), day("3 Aug")] },
    "2026-09"
  );
  assert.deepStrictEqual(plan.archives.map((a) => a.period), ["2026-07", "2026-08"]);
  assert.strictEqual(plan.archives[0].items.length, 2);
  // The note belongs to the month the section was actually about.
  assert.strictEqual(plan.archives[0].description, "");
  assert.strictEqual(plan.archives[1].description, "note");
});

test("a section ahead of the client's clock is left untouched", () => {
  const plan = planRollover({ period: "2026-10", budget: 10, description: "", items: [day("3 Oct")] }, "2026-09");
  assert.deepStrictEqual(plan, { archives: [], keep: null, reset: false, period: "2026-10" });
});

test("an unstamped section with no dated entries adopts the current month", () => {
  const plan = planRollover({ period: "", budget: 0, description: "", items: [undated()] }, "2026-09");
  assert.deepStrictEqual(plan, { archives: [], keep: null, reset: false, period: "2026-09" });
});

test("a December section rolls into January of the next year", () => {
  const plan = planRollover({ period: "", budget: 5, description: "", items: [day("31 Dec")] }, "2026-01");
  assert.deepStrictEqual(plan.archives.map((a) => a.period), ["2025-12"]);
  assert.strictEqual(plan.period, "2026-01");
});

test("nothing is dropped: every entry is either kept or archived", () => {
  const items = [day("16 Aug"), undated(), day("31 Aug"), blank("1 Sep"), day("2 Sep")];
  const plan = planRollover({ period: "", budget: 1, description: "", items }, "2026-09");
  const archived = plan.archives.reduce((n, a) => n + a.items.length, 0);
  assert.strictEqual(archived + plan.keep.length, items.length);
});

if (!process.exitCode) console.log(`${passed} passing`);
