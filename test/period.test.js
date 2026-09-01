// Month-boundary logic for the Monthly Budget. Run with: npm test
const assert = require("assert");
const { isPeriod, inferPeriod, planRollover } = require("../lib/period");

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

const day = (d) => ({ day: d, name: "x", price: 100 });

test("isPeriod accepts YYYY-MM and rejects anything else", () => {
  assert.ok(isPeriod("2026-09"));
  assert.ok(isPeriod("2026-01"));
  assert.ok(isPeriod("2026-12"));
  ["2026-00", "2026-13", "2026-9", "26-09", "2026/09", "", null, undefined].forEach((v) =>
    assert.ok(!isPeriod(v), `should reject ${JSON.stringify(v)}`)
  );
});

test("inferPeriod reads the month from the last dated entry", () => {
  assert.strictEqual(inferPeriod([day("16 Aug (Saturday)"), day("31 Aug (Sunday)")], "2026-09"), "2026-08");
});

test("inferPeriod handles the older '(Monday) 31 Aug' label", () => {
  assert.strictEqual(inferPeriod([day("(Monday) 31 Aug")], "2026-09"), "2026-08");
});

test("inferPeriod rolls back a year when the month is ahead of the one being opened", () => {
  assert.strictEqual(inferPeriod([day("28 Dec (Monday)")], "2026-01"), "2025-12");
});

test("inferPeriod ignores undated entries and gives up when none are dated", () => {
  assert.strictEqual(inferPeriod([{ day: "", name: "a", price: 1 }, day("2 Jul (Thursday)")], "2026-09"), "2026-07");
  assert.strictEqual(inferPeriod([{ day: "", name: "a", price: 1 }], "2026-09"), null);
  assert.strictEqual(inferPeriod([], "2026-09"), null);
});

test("an unstamped August section is archived as August when September opens", () => {
  const plan = planRollover(
    { period: "", budget: 300000, description: "note", items: [day("16 Aug (Saturday)")] },
    "2026-09"
  );
  assert.deepStrictEqual(plan, { archive: "2026-08", reset: true, period: "2026-09" });
});

test("a stamped section rolls over on the month it carries", () => {
  const plan = planRollover({ period: "2026-08", budget: 0, description: "", items: [day("16 Aug")] }, "2026-09");
  assert.deepStrictEqual(plan, { archive: "2026-08", reset: true, period: "2026-09" });
});

test("re-opening the month already in progress changes nothing", () => {
  const plan = planRollover({ period: "2026-09", budget: 300000, description: "", items: [day("2 Sep")] }, "2026-09");
  assert.deepStrictEqual(plan, { archive: null, reset: false, period: "2026-09" });
});

test("an empty month is cleared forward without leaving a record", () => {
  const plan = planRollover({ period: "2026-08", budget: 0, description: "  ", items: [] }, "2026-09");
  assert.deepStrictEqual(plan, { archive: null, reset: true, period: "2026-09" });
});

test("a budget set but never spent still leaves a record", () => {
  const plan = planRollover({ period: "2026-08", budget: 300000, description: "", items: [] }, "2026-09");
  assert.deepStrictEqual(plan, { archive: "2026-08", reset: true, period: "2026-09" });
});

test("months skipped entirely are archived under the month they belong to", () => {
  const plan = planRollover({ period: "2026-07", budget: 10, description: "", items: [day("9 Jul")] }, "2026-09");
  assert.deepStrictEqual(plan, { archive: "2026-07", reset: true, period: "2026-09" });
});

test("a section ahead of the client's clock is left untouched", () => {
  const plan = planRollover({ period: "2026-10", budget: 10, description: "", items: [day("3 Oct")] }, "2026-09");
  assert.deepStrictEqual(plan, { archive: null, reset: false, period: "2026-10" });
});

test("an unstamped section with no dated entries adopts the current month", () => {
  const plan = planRollover({ period: "", budget: 0, description: "", items: [] }, "2026-09");
  assert.deepStrictEqual(plan, { archive: null, reset: false, period: "2026-09" });
});

test("a December section rolls into January of the next year", () => {
  const plan = planRollover({ period: "2025-12", budget: 5, description: "", items: [day("31 Dec")] }, "2026-01");
  assert.deepStrictEqual(plan, { archive: "2025-12", reset: true, period: "2026-01" });
});

if (!process.exitCode) console.log(`${passed} passing`);
