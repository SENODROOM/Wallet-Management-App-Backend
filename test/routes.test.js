// The routers in routes/ are all mounted at the same "/api" prefix, so an
// unscoped router.use() runs for every API request — not just the ones its own
// router answers. That is how the notepads admin check came to reject
// /api/monthly/rollover with a 403 for the admin account, silently stopping the
// monthly rollover. Each router must guard only the paths it owns.
const assert = require("assert");

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

// Middleware added with router.use(fn) — no path — matches everything. Express
// marks that layer's regexp fast_slash; a path-scoped layer has it false.
function unscopedMiddleware(router) {
  return router.stack
    .filter((layer) => !layer.route && layer.regexp && layer.regexp.fast_slash)
    .map((layer) => layer.name || "anonymous");
}

function ownedPrefixes(router) {
  return new Set(
    router.stack
      .filter((layer) => layer.route)
      .map((layer) => "/" + String(layer.route.path).split("/").filter(Boolean)[0])
  );
}

const routers = {
  state: require("../routes/state"),
  notepads: require("../routes/notepads"),
  monthly: require("../routes/monthly")
};

for (const [name, router] of Object.entries(routers)) {
  test(`the ${name} router guards only its own paths`, () => {
    const unscoped = unscopedMiddleware(router);
    assert.deepStrictEqual(
      unscoped,
      [],
      `routes/${name}.js has middleware with no path (${unscoped.join(", ")}); ` +
        `mounted at /api it would run for every API request. Give it a path: router.use("/${name}", ...)`
    );
  });

  test(`the ${name} router only answers under /${name}`, () => {
    assert.deepStrictEqual(Array.from(ownedPrefixes(router)), [`/${name}`]);
  });
}

// The rollover has to be reachable for the admin account: it is the one the
// notepads router is written to turn away.
test("no router claims a path another router owns", () => {
  const seen = new Map();
  for (const [name, router] of Object.entries(routers)) {
    ownedPrefixes(router).forEach((prefix) => {
      assert.ok(!seen.has(prefix), `${name} and ${seen.get(prefix)} both answer under ${prefix}`);
      seen.set(prefix, name);
    });
  }
});

if (!process.exitCode) console.log(`${passed} passing`);
