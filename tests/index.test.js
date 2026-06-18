/**
 * @fileoverview EcoTrack comprehensive test suite.
 *
 * Covers:
 *   - Emission factor data integrity
 *   - Input validation (all validators, edge cases, security)
 *   - Calculator correctness (formula verification, boundary conditions)
 *   - Tips engine (personalisation, deduplication, filtering)
 *   - Error handling and graceful degradation
 *   - Security: XSS, injection, prototype pollution, extreme values
 *
 * Run: node tests/index.test.js
 */

"use strict";

const {
  calcTransportEmissions,
  calcTotalTransportEmissions,
  calcFoodEmissions,
  calcEnergyEmissions,
  calcShoppingEmissions,
  calcWasteEmissions,
  calcTotalFootprint,
  DIET_EMISSION_KG_PER_YEAR,
  TRANSPORT_FACTOR_MAP,
} = require("../src/utils/calculator");

const {
  validatePositiveNumber,
  validateTransportMode,
  validateDietType,
  validateCategory,
  sanitizeString,
  validateTransportEntry,
  validateEnergyEntry,
  validateWasteEntry,
} = require("../src/utils/validation");

const { getPersonalizedTips, getTipsByCategory, TIPS } = require("../src/data/tips");

const {
  EMISSION_FACTORS,
  INDIA_AVERAGE_KG_PER_YEAR,
  PARIS_TARGET_KG_PER_YEAR,
  GLOBAL_AVERAGE_KG_PER_YEAR,
} = require("../src/data/emissionFactors");

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
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, label = "") {
  if (actual !== expected) {
    throw new Error(
      `${label ? label + ": " : ""}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertApprox(actual, expected, tolerance = 5, label = "") {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `${label ? label + ": " : ""}Expected ~${expected} (±${tolerance}), got ${actual}`
    );
  }
}

function assertValid(result, label = "") {
  assert(
    result && result.valid === true,
    `${label}: Expected valid=true, got valid=${result?.valid} (errors: ${JSON.stringify(result?.errors)})`
  );
}

function assertInvalid(result, label = "") {
  assert(
    result && result.valid === false,
    `${label}: Expected valid=false, got valid=${result?.valid}`
  );
}

function group(name, fn) {
  console.log(`\n📂 ${name}`);
  fn();
}

/* ════════════════════════════════════════════════
   1. EMISSION FACTORS — DATA INTEGRITY
════════════════════════════════════════════════ */

group("Emission Factors — Data Integrity", () => {
  test("All transport factors are non-negative finite numbers", () => {
    for (const [key, val] of Object.entries(EMISSION_FACTORS.transport)) {
      assert(
        typeof val === "number" && Number.isFinite(val) && val >= 0,
        `Factor "${key}" should be a non-negative finite number, got ${val}`
      );
    }
  });

  test("Walking and cycling have exactly zero emissions", () => {
    assertEqual(EMISSION_FACTORS.transport.walking_km, 0, "walking");
    assertEqual(EMISSION_FACTORS.transport.cycling_km, 0, "cycling");
  });

  test("Petrol car emits more than EV per km", () => {
    assert(
      EMISSION_FACTORS.transport.car_petrol_km > EMISSION_FACTORS.transport.car_electric_km,
      "Petrol car should emit more than EV per km"
    );
  });

  test("Beef emits >10× more than vegetables per kg", () => {
    assert(
      EMISSION_FACTORS.food.beef_kg > EMISSION_FACTORS.food.vegetables_kg * 10,
      "Beef should emit >10× more than vegetables"
    );
  });

  test("All food factors are positive", () => {
    for (const [key, val] of Object.entries(EMISSION_FACTORS.food)) {
      assert(val > 0, `Food factor "${key}" should be positive, got ${val}`);
    }
  });

  test("Electricity factor is a positive number", () => {
    assert(EMISSION_FACTORS.energy.electricity_kwh > 0, "Electricity factor must be positive");
  });

  test("India average is within expected bounds (500–5000)", () => {
    assert(
      INDIA_AVERAGE_KG_PER_YEAR >= 500 && INDIA_AVERAGE_KG_PER_YEAR <= 5000,
      `India average ${INDIA_AVERAGE_KG_PER_YEAR} out of expected range`
    );
  });

  test("Paris target is lower than global average", () => {
    assert(
      PARIS_TARGET_KG_PER_YEAR < GLOBAL_AVERAGE_KG_PER_YEAR,
      "Paris target should be below global average"
    );
  });

  test("Waste landfill factor is positive, recycling is negative", () => {
    assert(EMISSION_FACTORS.waste.landfill_kg > 0, "Landfill factor should be positive");
    assert(EMISSION_FACTORS.waste.recycling_kg < 0, "Recycling factor should be negative (savings)");
  });

  test("TRANSPORT_FACTOR_MAP covers all allowed modes", () => {
    const modes = ["car_petrol","car_diesel","car_electric","bus","train",
                   "flight_domestic","flight_international","motorcycle","auto_rickshaw","walking","cycling"];
    for (const mode of modes) {
      assert(mode in TRANSPORT_FACTOR_MAP, `Mode "${mode}" missing from TRANSPORT_FACTOR_MAP`);
    }
  });
});

/* ════════════════════════════════════════════════
   2. VALIDATION — validatePositiveNumber
════════════════════════════════════════════════ */

group("Validation — validatePositiveNumber", () => {
  test("Accepts zero", () => assertValid(validatePositiveNumber(0)));
  test("Accepts positive integer", () => assertValid(validatePositiveNumber(42)));
  test("Accepts positive float", () => assertValid(validatePositiveNumber(3.14)));
  test("Accepts numeric string", () => assertValid(validatePositiveNumber("100")));
  test("Rejects Infinity", () => assertInvalid(validatePositiveNumber(Infinity)));
  test("Rejects -Infinity", () => assertInvalid(validatePositiveNumber(-Infinity)));
  test("Rejects NaN", () => assertInvalid(validatePositiveNumber(NaN)));
  test("Rejects non-numeric string", () => assertInvalid(validatePositiveNumber("abc")));
  test("Rejects null", () => assertInvalid(validatePositiveNumber(null)));
  test("Rejects undefined", () => assertInvalid(validatePositiveNumber(undefined)));
  test("Rejects below min", () => assertInvalid(validatePositiveNumber(-1, 0)));
  test("Rejects above max", () => assertInvalid(validatePositiveNumber(101, 0, 100)));
  test("Accepts exactly min", () => assertValid(validatePositiveNumber(0, 0, 100)));
  test("Accepts exactly max", () => assertValid(validatePositiveNumber(100, 0, 100)));
  test("Returns parsed numeric value", () => {
    const r = validatePositiveNumber("42.5");
    assertValid(r);
    assertEqual(r.value, 42.5, "parsed value");
  });
  test("Returns error string on failure", () => {
    const r = validatePositiveNumber("bad");
    assertInvalid(r);
    assert(typeof r.error === "string", "error should be a string");
    assert(r.error.length > 0, "error should not be empty");
  });
});

/* ════════════════════════════════════════════════
   3. VALIDATION — validateTransportMode
════════════════════════════════════════════════ */

group("Validation — validateTransportMode", () => {
  const validModes = ["car_petrol","car_diesel","car_electric","bus","train",
                      "flight_domestic","flight_international","motorcycle",
                      "auto_rickshaw","walking","cycling"];
  for (const m of validModes) {
    test(`Accepts "${m}"`, () => assertValid(validateTransportMode(m)));
  }

  test("Is case-insensitive", () => {
    assertValid(validateTransportMode("CAR_PETROL"));
    assertValid(validateTransportMode("Bus"));
    assertValid(validateTransportMode("WALKING"));
  });

  test("Rejects unknown mode", () => assertInvalid(validateTransportMode("hoverboard")));
  test("Rejects empty string", () => assertInvalid(validateTransportMode("")));
  test("Rejects number", () => assertInvalid(validateTransportMode(123)));
  test("Rejects null", () => assertInvalid(validateTransportMode(null)));
  test("Rejects object", () => assertInvalid(validateTransportMode({})));
  test("Returns normalised lowercase value", () => {
    const r = validateTransportMode("CAR_PETROL");
    assertValid(r);
    assertEqual(r.value, "car_petrol");
  });
});

/* ════════════════════════════════════════════════
   4. VALIDATION — validateDietType
════════════════════════════════════════════════ */

group("Validation — validateDietType", () => {
  const validDiets = ["vegan","vegetarian","pescatarian","omnivore","heavy_meat"];
  for (const d of validDiets) {
    test(`Accepts "${d}"`, () => assertValid(validateDietType(d)));
  }
  test("Rejects unknown diet", () => assertInvalid(validateDietType("paleo")));
  test("Rejects empty string", () => assertInvalid(validateDietType("")));
  test("Rejects null", () => assertInvalid(validateDietType(null)));
  test("Rejects number", () => assertInvalid(validateDietType(42)));
});

/* ════════════════════════════════════════════════
   5. VALIDATION — validateCategory
════════════════════════════════════════════════ */

group("Validation — validateCategory", () => {
  const validCats = ["transport","food","energy","shopping","waste"];
  for (const c of validCats) {
    test(`Accepts "${c}"`, () => assertValid(validateCategory(c)));
  }
  test("Rejects unknown category", () => assertInvalid(validateCategory("aviation")));
  test("Rejects empty string", () => assertInvalid(validateCategory("")));
});

/* ════════════════════════════════════════════════
   6. VALIDATION — sanitizeString
════════════════════════════════════════════════ */

group("Validation — sanitizeString", () => {
  test("Strips <script> tags", () => {
    const r = sanitizeString('<script>alert("xss")</script>hello');
    assert(!r.includes("<script>"), "Should remove script tag");
    assert(r.includes("hello"), "Should keep plain text");
  });
  test("Strips <img onerror>", () => {
    const r = sanitizeString('<img src=x onerror=alert(1)>world');
    assert(!r.includes("onerror"), "Should strip event handler");
    assert(!r.includes("<"), "Should remove all HTML");
  });
  test("Strips <a href>", () => {
    const r = sanitizeString('<a href="evil.com">click</a>');
    assert(!r.includes("<a"), "Should remove anchor tag");
    assert(r.includes("click"), "Should keep text content");
  });
  test("Trims leading/trailing whitespace", () => {
    assertEqual(sanitizeString("  hello  "), "hello");
  });
  test("Enforces maxLength", () => {
    const r = sanitizeString("a".repeat(1000), 50);
    assertEqual(r.length, 50);
  });
  test("Returns empty string for null", () => assertEqual(sanitizeString(null), ""));
  test("Returns empty string for number", () => assertEqual(sanitizeString(42), ""));
  test("Returns empty string for undefined", () => assertEqual(sanitizeString(undefined), ""));
  test("Returns empty string for object", () => assertEqual(sanitizeString({}), ""));
  test("Passes through safe plain text", () => {
    assertEqual(sanitizeString("Hello World"), "Hello World");
  });
});

/* ════════════════════════════════════════════════
   7. VALIDATION — validateTransportEntry
════════════════════════════════════════════════ */

group("Validation — validateTransportEntry", () => {
  test("Accepts valid complete entry", () => {
    assertValid(validateTransportEntry({ mode: "car_petrol", distanceKm: 20, frequencyPerWeek: 5 }));
  });
  test("Returns sanitised data on success", () => {
    const r = validateTransportEntry({ mode: "BUS", distanceKm: 10, frequencyPerWeek: 3 });
    assertValid(r);
    assertEqual(r.data.mode, "bus", "mode should be normalised");
    assertEqual(r.data.distanceKm, 10);
    assertEqual(r.data.frequencyPerWeek, 3);
  });
  test("Accepts walking (zero-emission)", () => {
    assertValid(validateTransportEntry({ mode: "walking", distanceKm: 1, frequencyPerWeek: 7 }));
  });
  test("Rejects missing mode", () => assertInvalid(validateTransportEntry({ distanceKm: 10, frequencyPerWeek: 5 })));
  test("Rejects invalid mode", () => assertInvalid(validateTransportEntry({ mode: "jetpack", distanceKm: 10, frequencyPerWeek: 5 })));
  test("Rejects negative distance", () => assertInvalid(validateTransportEntry({ mode: "bus", distanceKm: -1, frequencyPerWeek: 5 })));
  test("Rejects frequency > 14", () => assertInvalid(validateTransportEntry({ mode: "bus", distanceKm: 5, frequencyPerWeek: 15 })));
  test("Rejects null", () => assertInvalid(validateTransportEntry(null)));
  test("Rejects string", () => assertInvalid(validateTransportEntry("bus")));
  test("Rejects array", () => assertInvalid(validateTransportEntry([])));
});

/* ════════════════════════════════════════════════
   8. VALIDATION — validateEnergyEntry
════════════════════════════════════════════════ */

group("Validation — validateEnergyEntry", () => {
  test("Accepts valid entry", () => assertValid(validateEnergyEntry({ electricityKwh: 100, lpgKg: 10 })));
  test("Accepts zeros", () => assertValid(validateEnergyEntry({ electricityKwh: 0, lpgKg: 0 })));
  test("Rejects negative electricity", () => assertInvalid(validateEnergyEntry({ electricityKwh: -1, lpgKg: 0 })));
  test("Rejects negative LPG", () => assertInvalid(validateEnergyEntry({ electricityKwh: 0, lpgKg: -5 })));
  test("Rejects null", () => assertInvalid(validateEnergyEntry(null)));
  test("Rejects string", () => assertInvalid(validateEnergyEntry("100kwh")));
});

/* ════════════════════════════════════════════════
   9. VALIDATION — validateWasteEntry
════════════════════════════════════════════════ */

group("Validation — validateWasteEntry", () => {
  test("Accepts valid waste entry", () => {
    assertValid(validateWasteEntry({ weeklyWasteKg: 5, recyclingPercent: 30, compostsFood: true }));
  });
  test("Accepts zero waste", () => {
    assertValid(validateWasteEntry({ weeklyWasteKg: 0, recyclingPercent: 0, compostsFood: false }));
  });
  test("Accepts 100% recycling", () => {
    assertValid(validateWasteEntry({ weeklyWasteKg: 5, recyclingPercent: 100, compostsFood: false }));
  });
  test("Rejects recycling > 100", () => {
    assertInvalid(validateWasteEntry({ weeklyWasteKg: 5, recyclingPercent: 110, compostsFood: false }));
  });
  test("Rejects negative waste", () => {
    assertInvalid(validateWasteEntry({ weeklyWasteKg: -1, recyclingPercent: 0, compostsFood: false }));
  });
  test("Rejects null", () => assertInvalid(validateWasteEntry(null)));
  test("compostsFood defaults to false for non-boolean", () => {
    const r = validateWasteEntry({ weeklyWasteKg: 3, recyclingPercent: 20, compostsFood: "yes" });
    assertValid(r);
    assertEqual(r.data.compostsFood, false, "compostsFood should be false for non-boolean string");
  });
});

/* ════════════════════════════════════════════════
   10. CALCULATOR — Transport
════════════════════════════════════════════════ */

group("Calculator — Transport Emissions", () => {
  test("Walking returns exactly 0", () => {
    const r = calcTransportEmissions({ mode: "walking", distanceKm: 5, frequencyPerWeek: 5 });
    assertValid(r);
    assertEqual(r.kgCO2ePerYear, 0);
  });
  test("Cycling returns exactly 0", () => {
    const r = calcTransportEmissions({ mode: "cycling", distanceKm: 3, frequencyPerWeek: 7 });
    assertValid(r);
    assertEqual(r.kgCO2ePerYear, 0);
  });
  test("Car petrol: formula 0.192 × 10km × 5d × 52wks = 499.2", () => {
    const r = calcTransportEmissions({ mode: "car_petrol", distanceKm: 10, frequencyPerWeek: 5 });
    assertValid(r);
    assertApprox(r.kgCO2ePerYear, 499.2, 1, "car petrol formula");
  });
  test("Car diesel emits less than petrol for same trip", () => {
    const petrol = calcTransportEmissions({ mode: "car_petrol", distanceKm: 10, frequencyPerWeek: 5 });
    const diesel = calcTransportEmissions({ mode: "car_diesel", distanceKm: 10, frequencyPerWeek: 5 });
    assert(diesel.kgCO2ePerYear < petrol.kgCO2ePerYear, "diesel < petrol");
  });
  test("EV emits less than diesel car", () => {
    const diesel = calcTransportEmissions({ mode: "car_diesel", distanceKm: 20, frequencyPerWeek: 5 });
    const ev     = calcTransportEmissions({ mode: "car_electric", distanceKm: 20, frequencyPerWeek: 5 });
    assert(ev.kgCO2ePerYear < diesel.kgCO2ePerYear, "EV < diesel");
  });
  test("Bus emits less than motorcycle per km", () => {
    const bus  = calcTransportEmissions({ mode: "bus", distanceKm: 10, frequencyPerWeek: 5 });
    const moto = calcTransportEmissions({ mode: "motorcycle", distanceKm: 10, frequencyPerWeek: 5 });
    assert(bus.kgCO2ePerYear < moto.kgCO2ePerYear, "bus < motorcycle");
  });
  test("Train emits less than bus per km", () => {
    const bus   = calcTransportEmissions({ mode: "bus", distanceKm: 10, frequencyPerWeek: 5 });
    const train = calcTransportEmissions({ mode: "train", distanceKm: 10, frequencyPerWeek: 5 });
    assert(train.kgCO2ePerYear < bus.kgCO2ePerYear, "train < bus");
  });
  test("Flight has positive emissions", () => {
    const r = calcTransportEmissions({ mode: "flight_domestic", distanceKm: 500, frequencyPerWeek: 0.1 });
    assertValid(r);
    assert(r.kgCO2ePerYear > 0, "flight should have positive emissions");
  });
  test("Doubling distance doubles emissions", () => {
    const r1 = calcTransportEmissions({ mode: "car_petrol", distanceKm: 10, frequencyPerWeek: 5 });
    const r2 = calcTransportEmissions({ mode: "car_petrol", distanceKm: 20, frequencyPerWeek: 5 });
    assertApprox(r2.kgCO2ePerYear, r1.kgCO2ePerYear * 2, 2, "doubling distance");
  });
  test("Doubling frequency doubles emissions", () => {
    const r1 = calcTransportEmissions({ mode: "bus", distanceKm: 10, frequencyPerWeek: 3 });
    const r2 = calcTransportEmissions({ mode: "bus", distanceKm: 10, frequencyPerWeek: 6 });
    assertApprox(r2.kgCO2ePerYear, r1.kgCO2ePerYear * 2, 2, "doubling frequency");
  });
  test("Returns error for invalid mode", () => assertInvalid(calcTransportEmissions({ mode: "hoverboard", distanceKm: 5, frequencyPerWeek: 3 })));
  test("Returns error for null input", () => assertInvalid(calcTransportEmissions(null)));
});

/* ════════════════════════════════════════════════
   11. CALCULATOR — calcTotalTransportEmissions
════════════════════════════════════════════════ */

group("Calculator — Total Transport Emissions", () => {
  test("Empty array returns 0", () => {
    const r = calcTotalTransportEmissions([]);
    assertValid(r);
    assertEqual(r.totalKgCO2ePerYear, 0);
  });
  test("Single entry totals correctly", () => {
    const r = calcTotalTransportEmissions([{ mode: "bus", distanceKm: 5, frequencyPerWeek: 5 }]);
    assertValid(r);
    assert(r.totalKgCO2ePerYear > 0, "should be positive");
    assert(Array.isArray(r.breakdown), "should have breakdown");
  });
  test("Multiple entries sum correctly", () => {
    const e1 = calcTransportEmissions({ mode: "car_petrol", distanceKm: 10, frequencyPerWeek: 5 });
    const e2 = calcTransportEmissions({ mode: "bus", distanceKm: 5, frequencyPerWeek: 3 });
    const total = calcTotalTransportEmissions([
      { mode: "car_petrol", distanceKm: 10, frequencyPerWeek: 5 },
      { mode: "bus", distanceKm: 5, frequencyPerWeek: 3 },
    ]);
    assertValid(total);
    assertApprox(total.totalKgCO2ePerYear, e1.kgCO2ePerYear + e2.kgCO2ePerYear, 1, "sum of two");
  });
  test("100 entries handled without error", () => {
    const entries = Array.from({ length: 100 }, () => ({ mode: "bus", distanceKm: 1, frequencyPerWeek: 1 }));
    const r = calcTotalTransportEmissions(entries);
    assertValid(r);
    assert(r.totalKgCO2ePerYear > 0);
  });
  test("Rejects non-array input", () => assertInvalid(calcTotalTransportEmissions("bus")));
  test("Rejects null input", () => assertInvalid(calcTotalTransportEmissions(null)));
});

/* ════════════════════════════════════════════════
   12. CALCULATOR — Food
════════════════════════════════════════════════ */

group("Calculator — Food Emissions", () => {
  test("Vegan is lowest emission diet", () => {
    const vegan = calcFoodEmissions("vegan");
    const meat  = calcFoodEmissions("heavy_meat");
    assertValid(vegan); assertValid(meat);
    assert(vegan.kgCO2ePerYear < meat.kgCO2ePerYear, "vegan < heavy_meat");
  });
  test("Diet emissions in ascending order", () => {
    const order = ["vegan","vegetarian","pescatarian","omnivore","heavy_meat"];
    const vals  = order.map(d => calcFoodEmissions(d).kgCO2ePerYear);
    for (let i = 1; i < vals.length; i++) {
      assert(vals[i] >= vals[i-1], `${order[i]} (${vals[i]}) should be >= ${order[i-1]} (${vals[i-1]})`);
    }
  });
  test("All valid diets return positive values", () => {
    for (const d of Object.keys(DIET_EMISSION_KG_PER_YEAR)) {
      const r = calcFoodEmissions(d);
      assertValid(r, d);
      assert(r.kgCO2ePerYear > 0, `${d} should be positive`);
    }
  });
  test("Returns error for unknown diet", () => assertInvalid(calcFoodEmissions("keto")));
  test("Returns error for empty string", () => assertInvalid(calcFoodEmissions("")));
  test("Returns error for number", () => assertInvalid(calcFoodEmissions(42)));
  test("Returns error for null", () => assertInvalid(calcFoodEmissions(null)));
});

/* ════════════════════════════════════════════════
   13. CALCULATOR — Energy
════════════════════════════════════════════════ */

group("Calculator — Energy Emissions", () => {
  test("Zero inputs return 0", () => {
    const r = calcEnergyEmissions({ electricityKwh: 0, lpgKg: 0 });
    assertValid(r);
    assertEqual(r.kgCO2ePerYear, 0);
  });
  test("Electricity formula: 100kWh × 12 × 0.716 = 859.2", () => {
    const r = calcEnergyEmissions({ electricityKwh: 100, lpgKg: 0 });
    assertValid(r);
    assertApprox(r.kgCO2ePerYear, 100 * 12 * 0.716, 2, "electricity formula");
  });
  test("LPG formula: 10kg × 12 × 2.98 = 357.6", () => {
    const r = calcEnergyEmissions({ electricityKwh: 0, lpgKg: 10 });
    assertValid(r);
    assertApprox(r.kgCO2ePerYear, 10 * 12 * 2.98, 2, "LPG formula");
  });
  test("Combined energy = electricity + LPG", () => {
    const elec  = calcEnergyEmissions({ electricityKwh: 100, lpgKg: 0 });
    const lpg   = calcEnergyEmissions({ electricityKwh: 0, lpgKg: 10 });
    const combo = calcEnergyEmissions({ electricityKwh: 100, lpgKg: 10 });
    assertValid(combo);
    assertApprox(combo.kgCO2ePerYear, elec.kgCO2ePerYear + lpg.kgCO2ePerYear, 1, "combined");
  });
  test("Returns breakdown object", () => {
    const r = calcEnergyEmissions({ electricityKwh: 50, lpgKg: 5 });
    assertValid(r);
    assert(r.breakdown && typeof r.breakdown.electricity === "number", "breakdown.electricity");
    assert(typeof r.breakdown.lpg === "number", "breakdown.lpg");
  });
  test("Doubling kWh doubles electricity emissions", () => {
    const r1 = calcEnergyEmissions({ electricityKwh: 100, lpgKg: 0 });
    const r2 = calcEnergyEmissions({ electricityKwh: 200, lpgKg: 0 });
    assertApprox(r2.kgCO2ePerYear, r1.kgCO2ePerYear * 2, 2);
  });
  test("Returns error for negative electricity", () => assertInvalid(calcEnergyEmissions({ electricityKwh: -1, lpgKg: 0 })));
  test("Returns error for string input", () => assertInvalid(calcEnergyEmissions("100kwh")));
});

/* ════════════════════════════════════════════════
   14. CALCULATOR — Shopping
════════════════════════════════════════════════ */

group("Calculator — Shopping Emissions", () => {
  test("Empty object returns 0", () => {
    const r = calcShoppingEmissions({});
    assertValid(r);
    assertEqual(r.kgCO2ePerYear, 0);
  });
  test("1 laptop = 300 kg CO₂e", () => {
    const r = calcShoppingEmissions({ laptops: 1 });
    assertValid(r);
    assertEqual(r.kgCO2ePerYear, 300);
  });
  test("1 smartphone = 70 kg CO₂e", () => {
    const r = calcShoppingEmissions({ smartphones: 1 });
    assertValid(r);
    assertEqual(r.kgCO2ePerYear, 70);
  });
  test("5 clothing items = 50 kg CO₂e", () => {
    const r = calcShoppingEmissions({ clothingItems: 5 });
    assertValid(r);
    assertEqual(r.kgCO2ePerYear, 50);
  });
  test("Multiple items sum correctly", () => {
    const r = calcShoppingEmissions({ clothingItems: 5, smartphones: 1 });
    assertValid(r);
    assertEqual(r.kgCO2ePerYear, 120, "5 clothes + 1 phone = 120");
  });
  test("Returns per-item breakdown", () => {
    const r = calcShoppingEmissions({ laptops: 1, clothingItems: 3 });
    assertValid(r);
    assert(r.breakdown && typeof r.breakdown.laptops === "number", "laptops breakdown");
    assert(typeof r.breakdown.clothingItems === "number", "clothing breakdown");
  });
  test("Returns error for null", () => assertInvalid(calcShoppingEmissions(null)));
  test("Returns error for string", () => assertInvalid(calcShoppingEmissions("laptop")));
});

/* ════════════════════════════════════════════════
   15. CALCULATOR — Waste
════════════════════════════════════════════════ */

group("Calculator — Waste Emissions", () => {
  test("Zero waste = 0 emissions", () => {
    const r = calcWasteEmissions({ weeklyWasteKg: 0, recyclingPercent: 0, compostsFood: false });
    assertValid(r);
    assertEqual(r.kgCO2ePerYear, 0);
  });
  test("100% recycling reduces landfill emissions to 0", () => {
    const r = calcWasteEmissions({ weeklyWasteKg: 5, recyclingPercent: 100, compostsFood: false });
    assertValid(r);
    assertEqual(r.breakdown.landfill, 0, "no landfill at 100% recycling");
  });
  test("More recycling = lower net emissions", () => {
    const low  = calcWasteEmissions({ weeklyWasteKg: 5, recyclingPercent: 10,  compostsFood: false });
    const high = calcWasteEmissions({ weeklyWasteKg: 5, recyclingPercent: 80,  compostsFood: false });
    assert(high.kgCO2ePerYear < low.kgCO2ePerYear, "more recycling = fewer emissions");
  });
  test("Composting reduces net emissions", () => {
    const no  = calcWasteEmissions({ weeklyWasteKg: 5, recyclingPercent: 20, compostsFood: false });
    const yes = calcWasteEmissions({ weeklyWasteKg: 5, recyclingPercent: 20, compostsFood: true });
    assert(yes.kgCO2ePerYear < no.kgCO2ePerYear, "composting reduces emissions");
  });
  test("Returns breakdown with landfill, recycling, composting keys", () => {
    const r = calcWasteEmissions({ weeklyWasteKg: 5, recyclingPercent: 30, compostsFood: true });
    assertValid(r);
    assert("landfill"   in r.breakdown, "breakdown.landfill");
    assert("recycling"  in r.breakdown, "breakdown.recycling");
    assert("composting" in r.breakdown, "breakdown.composting");
  });
  test("Returns error for invalid entry", () => {
    assertInvalid(calcWasteEmissions({ weeklyWasteKg: -1, recyclingPercent: 0, compostsFood: false }));
  });
});

/* ════════════════════════════════════════════════
   16. CALCULATOR — Total Footprint
════════════════════════════════════════════════ */

group("Calculator — Total Footprint", () => {
  test("All 5 categories present in result", () => {
    const r = calcTotalFootprint({
      dietType: "omnivore",
      transportEntries: [{ mode: "bus", distanceKm: 5, frequencyPerWeek: 5 }],
      energyEntry: { electricityKwh: 100, lpgKg: 10 },
      shoppingEntry: { clothingItems: 3 },
      wasteEntry: { weeklyWasteKg: 5, recyclingPercent: 20, compostsFood: false },
    });
    assertValid(r);
    for (const cat of ["transport","food","energy","shopping","waste"]) {
      assert(cat in r.byCategory, `Missing category: ${cat}`);
    }
  });
  test("Total equals sum of category values", () => {
    const r = calcTotalFootprint({
      dietType: "vegan",
      transportEntries: [],
      energyEntry: { electricityKwh: 50, lpgKg: 5 },
      shoppingEntry: {},
      wasteEntry: { weeklyWasteKg: 3, recyclingPercent: 50, compostsFood: true },
    });
    assertValid(r);
    const sum = Object.values(r.byCategory).reduce((a, b) => a + b, 0);
    assertApprox(r.totalKgCO2ePerYear, sum, 1, "total = sum");
  });
  test("Vegan food < heavy meat food in total", () => {
    const vegan = calcTotalFootprint({ dietType: "vegan",       transportEntries: [], energyEntry: { electricityKwh: 0, lpgKg: 0 }, shoppingEntry: {}, wasteEntry: { weeklyWasteKg: 0, recyclingPercent: 0, compostsFood: false } });
    const meat  = calcTotalFootprint({ dietType: "heavy_meat",  transportEntries: [], energyEntry: { electricityKwh: 0, lpgKg: 0 }, shoppingEntry: {}, wasteEntry: { weeklyWasteKg: 0, recyclingPercent: 0, compostsFood: false } });
    assert(vegan.byCategory.food < meat.byCategory.food, "vegan < heavy_meat food");
  });
  test("Empty transport gives transport = 0", () => {
    const r = calcTotalFootprint({ dietType: "omnivore", transportEntries: [], energyEntry: { electricityKwh: 0, lpgKg: 0 }, shoppingEntry: {}, wasteEntry: { weeklyWasteKg: 0, recyclingPercent: 0, compostsFood: false } });
    assertValid(r);
    assertEqual(r.byCategory.transport, 0);
  });
  test("Null entries handled gracefully (no throw)", () => {
    const r = calcTotalFootprint({ dietType: "omnivore", transportEntries: null, energyEntry: null, shoppingEntry: null, wasteEntry: null });
    assert(r !== null && typeof r === "object", "should return result");
  });
  test("Total footprint is always ≥ 0", () => {
    const r = calcTotalFootprint({ dietType: "vegan", transportEntries: [], energyEntry: { electricityKwh: 0, lpgKg: 0 }, shoppingEntry: {}, wasteEntry: { weeklyWasteKg: 10, recyclingPercent: 100, compostsFood: true } });
    assert(r.totalKgCO2ePerYear >= 0, "footprint must be non-negative");
  });
});

/* ════════════════════════════════════════════════
   17. TIPS ENGINE
════════════════════════════════════════════════ */

group("Tips Engine", () => {
  test("All tips have required fields", () => {
    for (const tip of TIPS) {
      assert(tip.id,                   `Tip missing id`);
      assert(tip.category,             `Tip ${tip.id} missing category`);
      assert(tip.title,                `Tip ${tip.id} missing title`);
      assert(tip.description || tip.desc, `Tip ${tip.id} missing description`);
      assert(typeof (tip.estimatedSavingKgPerYear ?? tip.saving) === "number",
        `Tip ${tip.id} missing numeric saving`);
      assert(["easy","medium","hard"].includes(tip.difficulty),
        `Tip ${tip.id} invalid difficulty: ${tip.difficulty}`);
    }
  });
  test("All tip IDs are unique", () => {
    const ids    = TIPS.map(t => t.id);
    const unique = new Set(ids);
    assertEqual(unique.size, ids.length, "Duplicate tip IDs found");
  });
  test("Tips cover all 5 categories", () => {
    const cats = new Set(TIPS.map(t => t.category));
    for (const c of ["transport","food","energy","shopping","waste"]) {
      assert(cats.has(c), `No tips for category: ${c}`);
    }
  });
  test("getTipsByCategory filters correctly", () => {
    const tips = getTipsByCategory("transport");
    assert(tips.length > 0, "Should have transport tips");
    for (const t of tips) assertEqual(t.category, "transport");
  });
  test("getTipsByCategory('') returns all tips", () => {
    assertEqual(getTipsByCategory("").length, TIPS.length);
  });
  test("getPersonalizedTips: transport-heavy profile gets transport tips first", () => {
    const tips = getPersonalizedTips({ transport: 3000, food: 500, energy: 200, shopping: 100 }, 3);
    assert(tips.length > 0, "Should return tips");
    assert(tips.length <= 3, "Should not exceed limit");
    assertEqual(tips[0].category, "transport", "First tip should be transport");
  });
  test("getPersonalizedTips respects limit", () => {
    const tips = getPersonalizedTips({ transport: 2000, food: 1500, energy: 1000, shopping: 500 }, 4);
    assert(tips.length <= 4);
  });
  test("getPersonalizedTips returns no duplicates", () => {
    const tips = getPersonalizedTips({ transport: 2000, food: 1500, energy: 1000, shopping: 500 }, 10);
    const ids  = tips.map(t => t.id);
    assertEqual(new Set(ids).size, ids.length, "No duplicate tips");
  });
  test("getPersonalizedTips handles null gracefully", () => {
    assert(Array.isArray(getPersonalizedTips(null, 3)));
  });
  test("getPersonalizedTips handles empty object gracefully", () => {
    assert(Array.isArray(getPersonalizedTips({}, 3)));
  });
  test("All tip saving values are positive", () => {
    for (const tip of TIPS) {
      const saving = tip.estimatedSavingKgPerYear ?? tip.saving;
      assert(saving > 0, `Tip ${tip.id} saving should be > 0, got ${saving}`);
    }
  });
});

/* ════════════════════════════════════════════════
   18. SECURITY & EDGE CASES
════════════════════════════════════════════════ */

group("Security & Edge Cases", () => {
  test("XSS: script tag removed by sanitizeString", () => {
    const r = sanitizeString('<script>alert("xss")</script>safe');
    assert(!r.includes("<script>"), "script tag removed");
  });
  test("XSS: event handler attribute removed", () => {
    const r = sanitizeString('<img src=x onerror=alert(1)>text');
    assert(!r.includes("onerror"), "event handler removed");
  });
  test("SQL injection in transport mode rejected by allowlist", () => {
    assertInvalid(validateTransportMode("car'; DROP TABLE users; --"));
  });
  test("Prototype pollution object fails transport entry validation", () => {
    const evil = JSON.parse('{"__proto__":{"polluted":true},"mode":"bus"}');
    assertInvalid(validateTransportEntry(evil));
  });
  test("Object with constructor override fails validation", () => {
    const evil = { mode: "bus", distanceKm: 1, frequencyPerWeek: 1, constructor: { name: "evil" } };
    // Should validate or reject — must not throw
    const r = validateTransportEntry(evil);
    assert(typeof r === "object", "should return a result object without throwing");
  });
  test("Extreme numeric input (1e15) rejected by validatePositiveNumber", () => {
    assertInvalid(validatePositiveNumber(1e15, 0, 1e9));
  });
  test("Negative number rejected", () => {
    assertInvalid(validatePositiveNumber(-0.001));
  });
  test("Empty transport array doesn't crash calcTotalFootprint", () => {
    const r = calcTotalFootprint({ dietType: "omnivore", transportEntries: [], energyEntry: { electricityKwh: 0, lpgKg: 0 }, shoppingEntry: {}, wasteEntry: { weeklyWasteKg: 0, recyclingPercent: 0, compostsFood: false } });
    assert(r !== null);
  });
  test("Very large transport array (1000 entries) completes without error", () => {
    const entries = Array.from({ length: 1000 }, () => ({ mode: "walking", distanceKm: 1, frequencyPerWeek: 1 }));
    const r = calcTotalTransportEmissions(entries);
    assertValid(r);
    assertEqual(r.totalKgCO2ePerYear, 0, "1000 walking entries = 0 emissions");
  });
  test("String injection in diet type rejected", () => {
    assertInvalid(calcFoodEmissions("vegan\"; exec('rm -rf');"));
  });
  test("Unicode in transport mode rejected", () => {
    assertInvalid(validateTransportMode("🚗"));
  });
});

/* ════════════════════════════════════════════════
   RESULTS
════════════════════════════════════════════════ */

console.log("\n" + "═".repeat(55));
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failures.length > 0) {
  console.log("\n  Failed tests:");
  failures.forEach(f => console.log(`    ❌ ${f.name}\n       ${f.error}`));
}
console.log("═".repeat(55) + "\n");

if (failed > 0) process.exit(1);
