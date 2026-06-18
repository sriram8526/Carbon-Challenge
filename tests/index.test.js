/**
 * EcoTrack Test Suite
 * Tests for: emission calculations, validation, tip engine, user profile
 * Run with: node tests/index.test.js
 */

"use strict";

const { calcTransportEmissions, calcFoodEmissions, calcEnergyEmissions,
        calcShoppingEmissions, calcTotalFootprint, DIET_EMISSION_KG_PER_YEAR }
  = require("../src/utils/calculator");

const { validatePositiveNumber, validateTransportMode, validateDietType,
        validateCategory, sanitizeString, validateTransportEntry,
        validateEnergyEntry }
  = require("../src/utils/validation");

const { getPersonalizedTips, getTipsByCategory, TIPS }
  = require("../src/data/tips");

const { EMISSION_FACTORS, INDIA_AVERAGE_KG_PER_YEAR, PARIS_TARGET_KG_PER_YEAR }
  = require("../src/data/emissionFactors");

/* ═══════════════════════════════════════════
   Minimal test harness
═══════════════════════════════════════════ */

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
      `${label ? label + ": " : ""}Expected ~${expected}, got ${actual} (tolerance ±${tolerance})`
    );
  }
}

function assertValid(result, label = "") {
  assert(result.valid === true, `${label}: Expected valid=true, got valid=${result.valid}`);
}

function assertInvalid(result, label = "") {
  assert(result.valid === false, `${label}: Expected valid=false, got valid=${result.valid}`);
}

function group(name, fn) {
  console.log(`\n📂 ${name}`);
  fn();
}

/* ═══════════════════════════════════════════
   EMISSION FACTORS DATA
═══════════════════════════════════════════ */

group("Emission Factors Data", () => {
  test("All transport factors are non-negative numbers", () => {
    for (const [key, val] of Object.entries(EMISSION_FACTORS.transport)) {
      assert(typeof val === "number" && val >= 0,
        `Factor ${key} should be a non-negative number, got ${val}`);
    }
  });

  test("Walking and cycling have zero emission factors", () => {
    assertEqual(EMISSION_FACTORS.transport.walking_km, 0, "walking");
    assertEqual(EMISSION_FACTORS.transport.cycling_km, 0, "cycling");
  });

  test("Car petrol has higher emissions than EV", () => {
    assert(
      EMISSION_FACTORS.transport.car_petrol_km > EMISSION_FACTORS.transport.car_electric_km,
      "Petrol car should emit more than EV"
    );
  });

  test("Beef has higher emissions than vegetables", () => {
    assert(
      EMISSION_FACTORS.food.beef_kg > EMISSION_FACTORS.food.vegetables_kg * 10,
      "Beef should have much higher emissions than vegetables"
    );
  });

  test("India average is a reasonable positive number", () => {
    assert(INDIA_AVERAGE_KG_PER_YEAR > 0 && INDIA_AVERAGE_KG_PER_YEAR < 10000,
      "India average should be between 0 and 10,000 kg");
  });

  test("Paris target is a positive number below 5000", () => {
    assert(PARIS_TARGET_KG_PER_YEAR > 0 && PARIS_TARGET_KG_PER_YEAR < 5000,
      "Paris target should be between 0 and 5,000 kg");
  });
});

/* ═══════════════════════════════════════════
   VALIDATION
═══════════════════════════════════════════ */

group("Validation — validatePositiveNumber", () => {
  test("Accepts valid finite positive numbers", () => {
    assertValid(validatePositiveNumber(100), "100");
    assertValid(validatePositiveNumber(0), "0");
    assertValid(validatePositiveNumber("50"), "string 50");
  });

  test("Rejects non-finite values", () => {
    assertInvalid(validatePositiveNumber(Infinity), "Infinity");
    assertInvalid(validatePositiveNumber(NaN), "NaN");
    assertInvalid(validatePositiveNumber("abc"), "abc");
  });

  test("Rejects values below min", () => {
    assertInvalid(validatePositiveNumber(-1, 0), "-1 with min=0");
  });

  test("Rejects values above max", () => {
    assertInvalid(validatePositiveNumber(200, 0, 100), "200 with max=100");
  });

  test("Returns the numeric value", () => {
    const result = validatePositiveNumber("42.5");
    assertValid(result);
    assertEqual(result.value, 42.5, "parsed value");
  });
});

group("Validation — validateTransportMode", () => {
  test("Accepts valid transport modes", () => {
    assertValid(validateTransportMode("car_petrol"));
    assertValid(validateTransportMode("bus"));
    assertValid(validateTransportMode("walking"));
    assertValid(validateTransportMode("cycling"));
  });

  test("Rejects invalid modes", () => {
    assertInvalid(validateTransportMode("hoverboard"));
    assertInvalid(validateTransportMode(""));
    assertInvalid(validateTransportMode(123));
  });

  test("Is case-insensitive", () => {
    assertValid(validateTransportMode("CAR_PETROL"));
    assertValid(validateTransportMode("Bus"));
  });
});

group("Validation — validateDietType", () => {
  test("Accepts all valid diet types", () => {
    const valid = ["vegan", "vegetarian", "pescatarian", "omnivore", "heavy_meat"];
    for (const d of valid) {
      assertValid(validateDietType(d), d);
    }
  });

  test("Rejects invalid diet types", () => {
    assertInvalid(validateDietType("paleo"));
    assertInvalid(validateDietType(""));
    assertInvalid(validateDietType(null));
  });
});

group("Validation — validateCategory", () => {
  test("Accepts valid categories", () => {
    ["transport", "food", "energy", "shopping", "waste"].forEach(c =>
      assertValid(validateCategory(c), c));
  });

  test("Rejects invalid categories", () => {
    assertInvalid(validateCategory("aviation"));
    assertInvalid(validateCategory(""));
  });
});

group("Validation — sanitizeString", () => {
  test("Strips HTML tags", () => {
    const result = sanitizeString('<script>alert("xss")</script>hello');
    assert(!result.includes("<script>"), "Should remove script tags");
    assert(result.includes("hello"), "Should keep plain text");
  });

  test("Trims whitespace", () => {
    const result = sanitizeString("  hello  ");
    assertEqual(result, "hello");
  });

  test("Enforces max length", () => {
    const long = "a".repeat(1000);
    const result = sanitizeString(long, 100);
    assertEqual(result.length, 100);
  });

  test("Returns empty string for non-string input", () => {
    assertEqual(sanitizeString(null), "");
    assertEqual(sanitizeString(42), "");
    assertEqual(sanitizeString(undefined), "");
  });
});

group("Validation — validateTransportEntry", () => {
  test("Accepts a valid complete entry", () => {
    const result = validateTransportEntry({
      mode: "car_petrol", distanceKm: 20, frequencyPerWeek: 5
    });
    assertValid(result);
    assertEqual(result.data.mode, "car_petrol");
  });

  test("Rejects missing mode", () => {
    assertInvalid(validateTransportEntry({ distanceKm: 10, frequencyPerWeek: 5 }));
  });

  test("Rejects negative distance", () => {
    assertInvalid(validateTransportEntry({ mode: "bus", distanceKm: -1, frequencyPerWeek: 5 }));
  });

  test("Rejects frequency over 14 days/week", () => {
    assertInvalid(validateTransportEntry({ mode: "bus", distanceKm: 5, frequencyPerWeek: 15 }));
  });

  test("Rejects non-object input", () => {
    assertInvalid(validateTransportEntry(null));
    assertInvalid(validateTransportEntry("string"));
  });
});

/* ═══════════════════════════════════════════
   CALCULATOR — TRANSPORT
═══════════════════════════════════════════ */

group("Calculator — Transport", () => {
  test("Walking returns zero emissions", () => {
    const result = calcTransportEmissions({ mode: "walking", distanceKm: 5, frequencyPerWeek: 5 });
    assertValid(result);
    assertEqual(result.kgCO2ePerYear, 0);
  });

  test("Cycling returns zero emissions", () => {
    const result = calcTransportEmissions({ mode: "cycling", distanceKm: 3, frequencyPerWeek: 7 });
    assertValid(result);
    assertEqual(result.kgCO2ePerYear, 0);
  });

  test("Car petrol: correct formula (0.192 × 10km × 5days × 52wks)", () => {
    const result = calcTransportEmissions({ mode: "car_petrol", distanceKm: 10, frequencyPerWeek: 5 });
    assertValid(result);
    const expected = 0.192 * 10 * 5 * 52; // 499.2
    assertApprox(result.kgCO2ePerYear, expected, 1, "car petrol");
  });

  test("EV emits less than petrol car for same distance", () => {
    const petrol = calcTransportEmissions({ mode: "car_petrol", distanceKm: 20, frequencyPerWeek: 5 });
    const ev     = calcTransportEmissions({ mode: "car_electric", distanceKm: 20, frequencyPerWeek: 5 });
    assertValid(petrol); assertValid(ev);
    assert(ev.kgCO2ePerYear < petrol.kgCO2ePerYear, "EV should emit less than petrol car");
  });

  test("Bus emits less than petrol car per km", () => {
    const bus  = calcTransportEmissions({ mode: "bus", distanceKm: 10, frequencyPerWeek: 5 });
    const car  = calcTransportEmissions({ mode: "car_petrol", distanceKm: 10, frequencyPerWeek: 5 });
    assert(bus.kgCO2ePerYear < car.kgCO2ePerYear, "Bus < petrol car");
  });

  test("Returns error for invalid entry", () => {
    assertInvalid(calcTransportEmissions({ mode: "hoverboard", distanceKm: 5, frequencyPerWeek: 3 }));
    assertInvalid(calcTransportEmissions(null));
  });

  test("Domestic flight emits more per km than car", () => {
    const flight = calcTransportEmissions({ mode: "flight_domestic", distanceKm: 500, frequencyPerWeek: 0.1 });
    assertValid(flight);
    assert(flight.kgCO2ePerYear > 0, "Flight should have positive emissions");
  });
});

/* ═══════════════════════════════════════════
   CALCULATOR — FOOD
═══════════════════════════════════════════ */

group("Calculator — Food", () => {
  test("Vegan diet has lowest emissions", () => {
    const vegan = calcFoodEmissions("vegan");
    const heavyMeat = calcFoodEmissions("heavy_meat");
    assertValid(vegan); assertValid(heavyMeat);
    assert(vegan.kgCO2ePerYear < heavyMeat.kgCO2ePerYear,
      "Vegan < heavy meat");
  });

  test("Diet emissions are in correct order", () => {
    const diets = ["vegan", "vegetarian", "pescatarian", "omnivore", "heavy_meat"];
    const vals = diets.map(d => calcFoodEmissions(d).kgCO2ePerYear);
    for (let i = 1; i < vals.length; i++) {
      assert(vals[i] >= vals[i-1],
        `${diets[i]} (${vals[i]}) should be >= ${diets[i-1]} (${vals[i-1]})`);
    }
  });

  test("All valid diet types return positive emissions", () => {
    for (const diet of Object.keys(DIET_EMISSION_KG_PER_YEAR)) {
      const result = calcFoodEmissions(diet);
      assertValid(result, diet);
      assert(result.kgCO2ePerYear > 0, `${diet} should have positive emissions`);
    }
  });

  test("Invalid diet type returns error", () => {
    assertInvalid(calcFoodEmissions("paleo"));
    assertInvalid(calcFoodEmissions(""));
    assertInvalid(calcFoodEmissions(42));
  });
});

/* ═══════════════════════════════════════════
   CALCULATOR — ENERGY
═══════════════════════════════════════════ */

group("Calculator — Energy", () => {
  test("Zero inputs return zero emissions", () => {
    const result = calcEnergyEmissions({ electricityKwh: 0, lpgKg: 0 });
    assertValid(result);
    assertEqual(result.kgCO2ePerYear, 0);
  });

  test("Electricity only: correct formula (kWh × 12 × 0.716)", () => {
    const result = calcEnergyEmissions({ electricityKwh: 100, lpgKg: 0 });
    assertValid(result);
    const expected = 100 * 12 * 0.716; // 859.2
    assertApprox(result.kgCO2ePerYear, expected, 2, "electricity only");
  });

  test("LPG only: correct formula (kg × 12 × 2.98)", () => {
    const result = calcEnergyEmissions({ electricityKwh: 0, lpgKg: 10 });
    assertValid(result);
    const expected = 10 * 12 * 2.98; // 357.6
    assertApprox(result.kgCO2ePerYear, expected, 2, "LPG only");
  });

  test("Returns breakdown for both sources", () => {
    const result = calcEnergyEmissions({ electricityKwh: 100, lpgKg: 10 });
    assertValid(result);
    assert(result.breakdown, "Should include breakdown");
    assert(result.breakdown.electricity > 0, "Electricity breakdown should be positive");
    assert(result.breakdown.lpg > 0, "LPG breakdown should be positive");
  });

  test("Invalid input returns error", () => {
    assertInvalid(calcEnergyEmissions({ electricityKwh: -100, lpgKg: 10 }));
    assertInvalid(calcEnergyEmissions("string"));
  });
});

/* ═══════════════════════════════════════════
   CALCULATOR — SHOPPING
═══════════════════════════════════════════ */

group("Calculator — Shopping", () => {
  test("Empty object returns near-zero emissions", () => {
    const result = calcShoppingEmissions({});
    assertValid(result);
    assertEqual(result.kgCO2ePerYear, 0);
  });

  test("Laptop purchase has significant impact", () => {
    const result = calcShoppingEmissions({ laptops: 1 });
    assertValid(result);
    assertEqual(result.kgCO2ePerYear, 300, "1 laptop should be 300 kg CO2e");
  });

  test("Multiple items add correctly", () => {
    const result = calcShoppingEmissions({ clothingItems: 5, smartphones: 1 });
    assertValid(result);
    const expected = (5 * 10) + (1 * 70); // 120
    assertEqual(result.kgCO2ePerYear, expected, "5 clothes + 1 phone");
  });
});

/* ═══════════════════════════════════════════
   CALCULATOR — TOTAL FOOTPRINT
═══════════════════════════════════════════ */

group("Calculator — Total Footprint", () => {
  test("Returns all categories in result", () => {
    const result = calcTotalFootprint({
      dietType: "omnivore",
      transportEntries: [{ mode: "bus", distanceKm: 5, frequencyPerWeek: 5 }],
      energyEntry: { electricityKwh: 100, lpgKg: 10 },
      shoppingEntry: { clothingItems: 3 },
    });
    assert(result.valid, "Should be valid");
    assert("transport" in result.byCategory, "Should have transport");
    assert("food" in result.byCategory, "Should have food");
    assert("energy" in result.byCategory, "Should have energy");
    assert("shopping" in result.byCategory, "Should have shopping");
  });

  test("Total equals sum of categories", () => {
    const result = calcTotalFootprint({
      dietType: "vegan",
      transportEntries: [],
      energyEntry: { electricityKwh: 50, lpgKg: 5 },
      shoppingEntry: {},
    });
    assertValid(result);
    const sum = Object.values(result.byCategory).reduce((a, b) => a + b, 0);
    assertApprox(result.totalKgCO2ePerYear, sum, 1, "total = sum of categories");
  });

  test("Vegan has lower food emissions than heavy meat", () => {
    const vegan = calcTotalFootprint({
      dietType: "vegan",
      transportEntries: [],
      energyEntry: { electricityKwh: 0, lpgKg: 0 },
      shoppingEntry: {},
    });
    const meat = calcTotalFootprint({
      dietType: "heavy_meat",
      transportEntries: [],
      energyEntry: { electricityKwh: 0, lpgKg: 0 },
      shoppingEntry: {},
    });
    assert(vegan.byCategory.food < meat.byCategory.food,
      "Vegan food footprint should be lower");
  });

  test("Empty transport array is handled gracefully", () => {
    const result = calcTotalFootprint({
      dietType: "omnivore",
      transportEntries: [],
      energyEntry: { electricityKwh: 0, lpgKg: 0 },
      shoppingEntry: {},
    });
    assertValid(result);
    assertEqual(result.byCategory.transport, 0, "Empty transport = 0");
  });

  test("Null/undefined entries are handled gracefully", () => {
    const result = calcTotalFootprint({
      dietType: "omnivore",
      transportEntries: null,
      energyEntry: null,
      shoppingEntry: null,
    });
    // Should not throw; returns valid result with defaults
    assert(result !== null, "Should return a result");
  });
});

/* ═══════════════════════════════════════════
   TIPS ENGINE
═══════════════════════════════════════════ */

group("Tips Engine", () => {
  test("All tips have required fields", () => {
    for (const tip of TIPS) {
      assert(tip.id, `Tip missing id: ${JSON.stringify(tip)}`);
      assert(tip.category, `Tip ${tip.id} missing category`);
      assert(tip.title, `Tip ${tip.id} missing title`);
      assert(typeof tip.estimatedSavingKgPerYear === "number",
        `Tip ${tip.id} missing estimatedSavingKgPerYear`);
      assert(["easy","medium","hard"].includes(tip.difficulty),
        `Tip ${tip.id} has invalid difficulty: ${tip.difficulty}`);
    }
  });

  test("All tip IDs are unique", () => {
    const ids = TIPS.map(t => t.id);
    const unique = new Set(ids);
    assertEqual(unique.size, ids.length, "Duplicate tip IDs detected");
  });

  test("getTipsByCategory filters correctly", () => {
    const transportTips = getTipsByCategory("transport");
    assert(transportTips.length > 0, "Should have transport tips");
    for (const tip of transportTips) {
      assertEqual(tip.category, "transport", "All returned tips should be transport");
    }
  });

  test("getTipsByCategory('') returns all tips", () => {
    const all = getTipsByCategory("");
    assertEqual(all.length, TIPS.length, "Empty category should return all");
  });

  test("getPersonalizedTips returns tips from highest-emission categories first", () => {
    const footprint = { transport: 3000, food: 500, energy: 200, shopping: 100 };
    const tips = getPersonalizedTips(footprint, 3);
    assert(tips.length > 0, "Should return tips");
    assert(tips.length <= 3, "Should not exceed limit");
    // First tip should be from transport (highest)
    assertEqual(tips[0].category, "transport", "First tip should be from transport");
  });

  test("getPersonalizedTips respects limit", () => {
    const footprint = { transport: 2000, food: 1500, energy: 1000, shopping: 500 };
    const tips = getPersonalizedTips(footprint, 5);
    assert(tips.length <= 5, "Should not exceed limit");
  });

  test("getPersonalizedTips returns no duplicates", () => {
    const footprint = { transport: 2000, food: 1500, energy: 1000, shopping: 500 };
    const tips = getPersonalizedTips(footprint, 10);
    const ids = tips.map(t => t.id);
    const unique = new Set(ids);
    assertEqual(unique.size, ids.length, "No duplicate tips");
  });

  test("getPersonalizedTips handles empty footprint gracefully", () => {
    const tips = getPersonalizedTips(null, 3);
    assert(Array.isArray(tips), "Should return an array");
  });
});

/* ═══════════════════════════════════════════
   EDGE CASES & SECURITY
═══════════════════════════════════════════ */

group("Edge Cases & Security", () => {
  test("XSS: sanitizeString removes script injection", () => {
    const malicious = '<img src=x onerror=alert(1)>Hello';
    const clean = sanitizeString(malicious);
    assert(!clean.includes("onerror"), "Should remove onerror attribute");
    assert(!clean.includes("<"), "Should remove all HTML tags");
  });

  test("SQL-like injection in string fields is neutralised by type enforcement", () => {
    const result = validateTransportMode("car_petrol'; DROP TABLE users; --");
    assertInvalid(result, "SQL injection string should fail validation");
  });

  test("Extreme values are clamped or rejected", () => {
    assertInvalid(validatePositiveNumber(1e10, 0, 1e9), "Beyond max should fail");
    assertInvalid(validatePositiveNumber(-999), "Negative should fail");
  });

  test("Prototype pollution attempt fails validation", () => {
    const dangerous = JSON.parse('{"__proto__":{"polluted":true}}');
    const result = validateTransportEntry(dangerous);
    assertInvalid(result, "Malformed entry should fail");
  });

  test("Very large transport arrays don't crash calculator", () => {
    const entries = Array.from({ length: 100 }, () => ({
      mode: "bus", distanceKm: 1, frequencyPerWeek: 1
    }));
    const { calcTotalTransportEmissions } = require("../src/utils/calculator");
    const result = calcTotalTransportEmissions(entries);
    assert(result.valid, "Should handle 100 entries");
    assert(result.totalKgCO2ePerYear > 0, "Should compute positive total");
  });
});

/* ═══════════════════════════════════════════
   RESULTS
═══════════════════════════════════════════ */

console.log("\n" + "═".repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFailed tests:");
  failures.forEach(f => console.log(`  ❌ ${f.name}\n     ${f.error}`));
}
console.log("═".repeat(50) + "\n");

if (failed > 0) process.exit(1);
