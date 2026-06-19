/**
 * @fileoverview Tests for src/app.js — the main application controller.
 *
 * Uses a lightweight in-house DOM stub (tests/dom-stub.js) instead of jsdom
 * to keep the test suite dependency-free and the repository under 10MB.
 *
 * Run: node tests/app.test.js
 */

"use strict";

const { createDOMStub } = require("./dom-stub.js");

/**
 * Loads a fresh instance of app.js with a given set of DOM input values.
 * Each call gets an isolated `document`/`localStorage`/`state`, preventing
 * test cross-contamination from Node's require() module cache.
 * @param {Object} elementValues - Map of element ID -> value/checked
 * @returns {Object} The app.js module exports
 */
function loadApp(elementValues = {}) {
  const { document, localStorage } = createDOMStub(elementValues);
  global.document = document;
  global.localStorage = localStorage;
  delete require.cache[require.resolve("../src/app.js")];
  return require("../src/app.js");
}

/* ════════════════════════════════════════════════
   TEST HARNESS
════════════════════════════════════════════════ */

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     → ${err.message}`);
    failures.push({ name, error: err.message });
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) { throw new Error(message || "Assertion failed"); }
}

function assertEqual(actual, expected, label = "") {
  if (actual !== expected) {
    throw new Error(`${label ? label + ": " : ""}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertApprox(actual, expected, tolerance = 2, label = "") {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label ? label + ": " : ""}Expected ~${expected} (±${tolerance}), got ${actual}`);
  }
}

function group(name, fn) {
  console.log(`\n📂 ${name}`);
  fn();
}

/* ════════════════════════════════════════════════
   1. CONFIG — constants integrity
════════════════════════════════════════════════ */

group("Config — Constants Integrity", () => {
  const app = loadApp();

  test("BENCHMARKS has all 3 required keys", () => {
    assert("INDIA_AVERAGE" in app.BENCHMARKS, "missing INDIA_AVERAGE");
    assert("PARIS_TARGET" in app.BENCHMARKS, "missing PARIS_TARGET");
    assert("GLOBAL_AVERAGE" in app.BENCHMARKS, "missing GLOBAL_AVERAGE");
  });

  test("BENCHMARKS are in ascending order", () => {
    assert(app.BENCHMARKS.INDIA_AVERAGE < app.BENCHMARKS.PARIS_TARGET, "India < Paris");
    assert(app.BENCHMARKS.PARIS_TARGET < app.BENCHMARKS.GLOBAL_AVERAGE, "Paris < Global");
  });

  test("BENCHMARKS object is frozen (immutable)", () => {
    assert(Object.isFrozen(app.BENCHMARKS), "BENCHMARKS should be frozen");
  });

  test("EMISSION_FACTORS.transport is frozen", () => {
    assert(Object.isFrozen(app.EMISSION_FACTORS.transport), "transport factors should be frozen");
  });

  test("WEEKS_PER_YEAR equals 52", () => assertEqual(app.WEEKS_PER_YEAR, 52));
  test("MONTHS_PER_YEAR equals 12", () => assertEqual(app.MONTHS_PER_YEAR, 12));

  test("TIPS array has exactly 20 entries", () => assertEqual(app.TIPS.length, 20));

  test("TIPS is frozen (immutable)", () => {
    assert(Object.isFrozen(app.TIPS), "TIPS should be frozen");
  });

  test("All TIPS have unique IDs", () => {
    const ids = app.TIPS.map((t) => t.id);
    assertEqual(new Set(ids).size, ids.length, "duplicate tip IDs found");
  });

  test("CATEGORY_META covers all 5 categories", () => {
    for (const cat of ["transport", "food", "energy", "shopping", "waste"]) {
      assert(cat in app.CATEGORY_META, `missing category meta: ${cat}`);
    }
  });
});

/* ════════════════════════════════════════════════
   2. UTILS — clamp, sanitizeText, capitalise
════════════════════════════════════════════════ */

group("Utils — clamp()", () => {
  const app = loadApp();
  test("Clamps value above max", () => assertEqual(app.clamp(150, 0, 100), 100));
  test("Clamps value below min", () => assertEqual(app.clamp(-10, 0, 100), 0));
  test("Passes through in-range value", () => assertEqual(app.clamp(50, 0, 100), 50));
  test("Returns min for NaN", () => assertEqual(app.clamp("abc", 5, 100), 5));
  test("Returns min for null", () => assertEqual(app.clamp(null, 5, 100), 5));
  test("Returns min for undefined", () => assertEqual(app.clamp(undefined, 5, 100), 5));
  test("Parses numeric strings", () => assertEqual(app.clamp("42", 0, 100), 42));
  test("Handles exact boundary (min)", () => assertEqual(app.clamp(0, 0, 100), 0));
  test("Handles exact boundary (max)", () => assertEqual(app.clamp(100, 0, 100), 100));
});

group("Utils — sanitizeText()", () => {
  const app = loadApp();
  test("Strips script tags", () => {
    const result = app.sanitizeText("<script>alert(1)</script>hello");
    assert(!result.includes("<script>"), "script tag not removed");
    assert(result.includes("hello"), "text content lost");
  });
  test("Strips img onerror XSS", () => {
    const result = app.sanitizeText("<img src=x onerror=alert(1)>text");
    assert(!result.includes("onerror"), "event handler not removed");
  });
  test("Trims whitespace", () => assertEqual(app.sanitizeText("  hi  "), "hi"));
  test("Enforces maxLength", () => assertEqual(app.sanitizeText("a".repeat(100), 10).length, 10));
  test("Returns empty string for non-string", () => {
    assertEqual(app.sanitizeText(42), "");
    assertEqual(app.sanitizeText(null), "");
    assertEqual(app.sanitizeText(undefined), "");
  });
});

group("Utils — capitalise()", () => {
  const app = loadApp();
  test("Capitalises lowercase word", () => assertEqual(app.capitalise("transport"), "Transport"));
  test("Leaves already-capitalised word unchanged", () => assertEqual(app.capitalise("Food"), "Food"));
  test("Handles single character", () => assertEqual(app.capitalise("a"), "A"));
});

/* ════════════════════════════════════════════════
   3. CALC — per-category pure functions
════════════════════════════════════════════════ */

group("Calc — calcFoodKg()", () => {
  test("Vegan diet returns 900", () => {
    const app = loadApp({ "diet-select": "vegan" });
    assertEqual(app.calcFoodKg(), 900);
  });
  test("Heavy meat diet returns 3300", () => {
    const app = loadApp({ "diet-select": "heavy_meat" });
    assertEqual(app.calcFoodKg(), 3300);
  });
  test("Unknown diet falls back to omnivore (2100)", () => {
    const app = loadApp({ "diet-select": "invalid_diet" });
    assertEqual(app.calcFoodKg(), 2100);
  });
});

group("Calc — calcEnergyKg()", () => {
  test("Zero inputs return 0", () => {
    const app = loadApp({ "electricity-kwh": 0, "lpg-kg": 0 });
    assertEqual(app.calcEnergyKg(), 0);
  });
  test("100 kWh/month = 859.2 kg CO2e/year", () => {
    const app = loadApp({ "electricity-kwh": 100, "lpg-kg": 0 });
    assertApprox(app.calcEnergyKg(), 100 * 12 * 0.716, 1);
  });
  test("10 kg LPG/month = 357.6 kg CO2e/year", () => {
    const app = loadApp({ "electricity-kwh": 0, "lpg-kg": 10 });
    assertApprox(app.calcEnergyKg(), 10 * 12 * 2.98, 1);
  });
  test("Combined sources sum correctly", () => {
    const app = loadApp({ "electricity-kwh": 100, "lpg-kg": 10 });
    assertApprox(app.calcEnergyKg(), (100 * 12 * 0.716) + (10 * 12 * 2.98), 1);
  });
});

group("Calc — calcShoppingKg()", () => {
  test("All zeros returns 0", () => {
    const app = loadApp({ "clothing-items": 0, smartphones: 0, laptops: 0, "online-deliveries": 0 });
    assertEqual(app.calcShoppingKg(), 0);
  });
  test("1 laptop = 300 kg CO2e", () => {
    const app = loadApp({ "clothing-items": 0, smartphones: 0, laptops: 1, "online-deliveries": 0 });
    assertEqual(app.calcShoppingKg(), 300);
  });
  test("5 clothing items = 50 kg CO2e", () => {
    const app = loadApp({ "clothing-items": 5, smartphones: 0, laptops: 0, "online-deliveries": 0 });
    assertEqual(app.calcShoppingKg(), 50);
  });
});

group("Calc — calcWasteKg()", () => {
  test("Zero waste returns 0", () => {
    const app = loadApp({ "weekly-waste": 0, "recycling-pct": 0, "composts-food": false });
    assertEqual(app.calcWasteKg(), 0);
  });
  test("100% recycling minimises net emissions", () => {
    const app = loadApp({ "weekly-waste": 5, "recycling-pct": 100, "composts-food": false });
    assert(app.calcWasteKg() >= 0, "should never be negative");
  });
  test("Composting reduces net emissions vs not composting", () => {
    const without = loadApp({ "weekly-waste": 5, "recycling-pct": 20, "composts-food": false });
    const withoutResult = without.calcWasteKg();   // capture BEFORE reloading app (see note below)

    const withCompost = loadApp({ "weekly-waste": 5, "recycling-pct": 20, "composts-food": true });
    const withResult = withCompost.calcWasteKg();

    // Note: app.js calc functions read the *global* `document`, so once loadApp()
    // is called again the previous module's functions would read the NEW global
    // state if invoked afterwards. We therefore capture each result immediately
    // after its own loadApp() call, before the global document is reassigned.
    assert(withResult < withoutResult, "composting should reduce emissions");
  });
  test("Net emissions never go negative", () => {
    const app = loadApp({ "weekly-waste": 5, "recycling-pct": 100, "composts-food": true });
    assert(app.calcWasteKg() >= 0, "waste emissions should be clamped to >= 0");
  });
});

group("Calc — runCalculation() integration", () => {
  test("Produces all 5 categories", () => {
    const app = loadApp({
      "diet-select": "omnivore", "electricity-kwh": 100, "lpg-kg": 10,
      "clothing-items": 5, smartphones: 0, laptops: 0, "online-deliveries": 10,
      "weekly-waste": 5, "recycling-pct": 20, "composts-food": false,
    });
    const result = app.runCalculation();
    for (const cat of ["transport", "food", "energy", "shopping", "waste"]) {
      assert(cat in result.byCategory, `missing category: ${cat}`);
    }
  });
  test("Total equals sum of categories", () => {
    const app = loadApp({
      "diet-select": "vegan", "electricity-kwh": 50, "lpg-kg": 5,
      "clothing-items": 0, smartphones: 0, laptops: 0, "online-deliveries": 0,
      "weekly-waste": 0, "recycling-pct": 0, "composts-food": false,
    });
    const result = app.runCalculation();
    const sum = Object.values(result.byCategory).reduce((a, b) => a + b, 0);
    assertApprox(result.totalKgCO2ePerYear, sum, 1);
  });
  test("Persists result to state.footprint", () => {
    const app = loadApp({
      "diet-select": "omnivore", "electricity-kwh": 0, "lpg-kg": 0,
      "clothing-items": 0, smartphones: 0, laptops: 0, "online-deliveries": 0,
      "weekly-waste": 0, "recycling-pct": 0, "composts-food": false,
    });
    app.runCalculation();
    assert(app.state.footprint !== null, "state.footprint should be set");
  });
  test("Appends an entry to state.history", () => {
    const app = loadApp({
      "diet-select": "omnivore", "electricity-kwh": 0, "lpg-kg": 0,
      "clothing-items": 0, smartphones: 0, laptops: 0, "online-deliveries": 0,
      "weekly-waste": 0, "recycling-pct": 0, "composts-food": false,
    });
    app.runCalculation();
    assert(app.state.history.length >= 1, "history should have at least 1 entry");
  });
});

/* ════════════════════════════════════════════════
   4. TIPS — personalisation engine
════════════════════════════════════════════════ */

group("Tips — getPersonalisedTips()", () => {
  const app = loadApp();

  test("Highest-emission category surfaces first", () => {
    const tips = app.getPersonalisedTips({ transport: 3000, food: 500, energy: 200 }, 3);
    assertEqual(tips[0].category, "transport");
  });

  test("Respects the limit parameter", () => {
    const tips = app.getPersonalisedTips({ transport: 2000, food: 1500, energy: 1000 }, 2);
    assert(tips.length <= 2, "should not exceed limit of 2");
  });

  test("Returns no duplicate tip IDs", () => {
    const tips = app.getPersonalisedTips({ transport: 2000, food: 1500, energy: 1000, shopping: 500 }, 10);
    const ids = tips.map((t) => t.id);
    assertEqual(new Set(ids).size, ids.length);
  });

  test("Ignores zero/negative category values", () => {
    const tips = app.getPersonalisedTips({ transport: 0, food: -100, energy: 500 }, 5);
    assert(tips.every((t) => t.category === "energy"), "only energy should be considered");
  });

  test("Handles empty footprint object gracefully", () => {
    const tips = app.getPersonalisedTips({}, 3);
    assert(Array.isArray(tips), "should return an array");
    assertEqual(tips.length, 0, "empty footprint yields no tips");
  });
});

group("Tips — renderTipCard()", () => {
  const app = loadApp();

  test("Returns a string containing the tip title", () => {
    const tip = app.TIPS[0];
    const html = app.renderTipCard(tip);
    assert(typeof html === "string", "should return a string");
    assert(html.includes(tip.title), "should contain the tip title");
  });

  test("Sanitizes XSS in tip title (defence in depth)", () => {
    const maliciousTip = {
      id: "xss-test", category: "transport",
      title: "<script>alert(1)</script>Evil", description: "test",
      savingKgPerYear: 100, difficulty: "easy",
    };
    const html = app.renderTipCard(maliciousTip);
    assert(!html.includes("<script>"), "script tag should be stripped");
  });
});

/* ════════════════════════════════════════════════
   5. SECURITY — edge cases
════════════════════════════════════════════════ */

group("Security — Edge Cases", () => {
  const app = loadApp();

  test("clamp() treats Infinity as invalid input (returns min, not max)", () => {
    // By design, non-finite values (Infinity, -Infinity, NaN) are rejected
    // entirely and clamped to `min` — the safe default — rather than being
    // treated as "very large valid numbers". This prevents Infinity from
    // silently passing validation and corrupting downstream calculations.
    assertEqual(app.clamp(Infinity, 0, 100), 0, "Infinity should fall back to min (safe default)");
  });

  test("clamp() rejects -Infinity safely", () => {
    assertEqual(app.clamp(-Infinity, 0, 100), 0, "-Infinity should clamp to min");
  });

  test("sanitizeText neutralises nested tag injection", () => {
    const result = app.sanitizeText("<<script>script>alert(1)<</script>/script>");
    assert(!result.includes("<script>"), "nested injection should not reconstruct a tag");
  });

  test("calcFoodKg never throws on malformed diet-select value", () => {
    const malformedApp = loadApp({ "diet-select": "'; DROP TABLE users; --" });
    assert(typeof malformedApp.calcFoodKg() === "number", "should return a safe fallback number");
  });

  test("EMISSION_FACTORS cannot be mutated (frozen)", () => {
    "use strict";
    let threw = false;
    try {
      app.EMISSION_FACTORS.transport.car_petrol = 999;
    } catch (e) {
      threw = true;
    }
    // Either throws (strict mode) or silently fails (non-strict) — both are safe;
    // the real assertion is that the value did NOT change.
    assertEqual(app.EMISSION_FACTORS.transport.car_petrol, 0.192, "factor should remain unchanged");
  });
});

/* ════════════════════════════════════════════════
   6. CROSS-MODULE CONSISTENCY
   Ensures app.js (browser) and calculator.js (Node API)
   never silently drift apart on shared emission factors.
════════════════════════════════════════════════ */

group("Cross-Module Consistency — app.js vs calculator.js", () => {
  const app = loadApp();
  const { EMISSION_FACTORS: nodeFactors } = require("../src/data/emissionFactors.js");

  test("Transport factors match between app.js and calculator.js", () => {
    const map = {
      car_petrol: "car_petrol_km", car_diesel: "car_diesel_km",
      car_electric: "car_electric_km", bus: "bus_km", train: "train_km",
      flight_domestic: "flight_domestic_km", flight_international: "flight_international_km",
      motorcycle: "motorcycle_km", auto_rickshaw: "auto_rickshaw_km",
    };
    for (const [appKey, nodeKey] of Object.entries(map)) {
      assertEqual(
        app.EMISSION_FACTORS.transport[appKey],
        nodeFactors.transport[nodeKey],
        `transport.${appKey}`
      );
    }
  });

  test("Electricity emission factor matches between modules", () => {
    assertEqual(
      app.EMISSION_FACTORS.energy.electricity_kwh,
      nodeFactors.energy.electricity_kwh,
      "energy.electricity_kwh"
    );
  });

  test("LPG emission factor matches between modules", () => {
    assertEqual(
      app.EMISSION_FACTORS.energy.lpg_kg,
      nodeFactors.energy.lpg_kg,
      "energy.lpg_kg"
    );
  });

  test("Benchmark constants match calculator.js INDIA_AVERAGE/PARIS_TARGET", () => {
    const { INDIA_AVERAGE_KG_PER_YEAR, PARIS_TARGET_KG_PER_YEAR } = require("../src/data/emissionFactors.js");
    assertEqual(app.BENCHMARKS.INDIA_AVERAGE, INDIA_AVERAGE_KG_PER_YEAR, "INDIA_AVERAGE");
    assertEqual(app.BENCHMARKS.PARIS_TARGET, PARIS_TARGET_KG_PER_YEAR, "PARIS_TARGET");
  });
});

/* ════════════════════════════════════════════════
   RESULTS
════════════════════════════════════════════════ */

console.log("\n" + "═".repeat(55));
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failures.length > 0) {
  console.log("\n  Failed tests:");
  failures.forEach((f) => console.log(`    ❌ ${f.name}\n       ${f.error}`));
}
console.log("═".repeat(55) + "\n");

if (failed > 0) { process.exit(1); }
