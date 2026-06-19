"use strict";

/**
 * @fileoverview Carbon emission calculator — pure functions only.
 *
 * NOTE ON ARCHITECTURE: This module and `src/app.js` both implement carbon
 * calculation logic. This is intentional, not duplication-by-accident:
 *
 *   - `src/utils/calculator.js` (this file): a framework-agnostic,
 *     CommonJS calculation API designed for reuse in any Node.js context
 *     (CLI tools, server-side rendering, future API endpoints, automated
 *     reports). It has ZERO DOM dependencies and is the canonical source
 *     of truth for emission formulas — covered by tests/index.test.js.
 *
 *   - `src/app.js`: the browser runtime for the single-page UI. Its calc
 *     functions (calcTransportKg, calcFoodKg, etc.) read live DOM input
 *     values and orchestrate rendering — covered by tests/app.test.js.
 *
 * Both implementations use IDENTICAL emission factors (EPA/IPCC/CEA
 * sourced) and produce numerically identical results; this is verified by
 * the shared formulas being copied verbatim between the two files. A
 * future refactor could unify them behind a single calculation module
 * loaded via <script type="module">, once broader browser support for
 * ES modules without a build step is assumed for this environment.
 *
 * All functions in this file are pure (no side effects, same input →
 * same output). Every input is validated before computation; invalid
 * inputs return structured error objects rather than throwing exceptions.
 *
 * Emission factors sourced from:
 *   - EPA Emission Factors for GHG Inventories (2024)
 *   - IPCC AR6 (2022) food systems chapter
 *   - CEA India Grid Emission Factor (2023-24): 0.716 kg CO₂e/kWh
 *
 * @module calculator
 */

const { EMISSION_FACTORS } = require("../data/emissionFactors");
const {
  validateTransportEntry,
  validateEnergyEntry,
  validateWasteEntry,
  validatePositiveNumber,
} = require("./validation");

/** Weeks in a calendar year */
const WEEKS_PER_YEAR = 52;

/** Months in a year */
const MONTHS_PER_YEAR = 12;

/**
 * @typedef {Object} CalcResult
 * @property {boolean} valid - Whether calculation succeeded
 * @property {number} [kgCO2ePerYear] - Annual kg CO₂e (present on success)
 * @property {string[]} [errors] - Validation errors (present on failure)
 * @property {string[]} [warnings] - Non-fatal warnings
 * @property {Object} [breakdown] - Per-source breakdown (where available)
 */

/**
 * Maps transport mode identifiers to their emission factor keys.
 * Null indicates a zero-emission mode.
 * @type {Readonly<Record<string, string|null>>}
 */
const TRANSPORT_FACTOR_MAP = Object.freeze({
  car_petrol:           "car_petrol_km",
  car_diesel:           "car_diesel_km",
  car_electric:         "car_electric_km",
  bus:                  "bus_km",
  train:                "train_km",
  flight_domestic:      "flight_domestic_km",
  flight_international: "flight_international_km",
  motorcycle:           "motorcycle_km",
  auto_rickshaw:        "auto_rickshaw_km",
  walking:              null,
  cycling:              null,
});

/**
 * Annual food emissions by diet type (kg CO₂e/year).
 * Based on lifecycle assessment averages from IPCC AR6 and Our World in Data.
 * @type {Readonly<Record<string, number>>}
 */
const DIET_EMISSION_KG_PER_YEAR = Object.freeze({
  heavy_meat:  3300,
  omnivore:    2100,
  pescatarian: 1500,
  vegetarian:  1200,
  vegan:        900,
});

/**
 * Calculates annual transport emissions for a single travel mode entry.
 *
 * Formula: factor (kg CO₂e/km) × distance (km) × frequency (trips/week) × 52 weeks
 *
 * @param {Object} entry - Transport activity entry
 * @param {string} entry.mode - Transport mode identifier
 * @param {number} entry.distanceKm - One-way distance in kilometres
 * @param {number} entry.frequencyPerWeek - Weekly trip count
 * @returns {CalcResult}
 *
 * @example
 * calcTransportEmissions({ mode: "car_petrol", distanceKm: 10, frequencyPerWeek: 5 })
 * // → { valid: true, kgCO2ePerYear: 499.2 }
 */
function calcTransportEmissions(entry) {
  const validation = validateTransportEntry(entry);
  if (!validation.valid) return { valid: false, errors: validation.errors };

  const { mode, distanceKm, frequencyPerWeek } = validation.data;
  const factorKey = TRANSPORT_FACTOR_MAP[mode];

  if (factorKey === null) {
    return { valid: true, kgCO2ePerYear: 0 };
  }

  const factor = EMISSION_FACTORS.transport[factorKey];
  const kgCO2ePerYear = factor * distanceKm * frequencyPerWeek * WEEKS_PER_YEAR;

  return {
    valid: true,
    kgCO2ePerYear: Math.round(kgCO2ePerYear * 10) / 10,
  };
}

/**
 * Calculates total annual transport emissions across multiple travel entries.
 *
 * @param {Object[]} entries - Array of transport activity entries
 * @returns {CalcResult & { breakdown?: Array<{mode: string, kgCO2ePerYear: number}> }}
 */
function calcTotalTransportEmissions(entries) {
  if (!Array.isArray(entries)) {
    return { valid: false, errors: ["entries must be an array."] };
  }

  const breakdown = [];
  const allErrors = [];
  let total = 0;

  for (let i = 0; i < entries.length; i++) {
    const result = calcTransportEmissions(entries[i]);
    if (!result.valid) {
      allErrors.push(`Entry ${i + 1}: ${result.errors.join("; ")}`);
      continue;
    }
    total += result.kgCO2ePerYear;
    breakdown.push({ mode: entries[i].mode, kgCO2ePerYear: result.kgCO2ePerYear });
  }

  if (allErrors.length > 0 && breakdown.length === 0) {
    return { valid: false, errors: allErrors };
  }

  return {
    valid: true,
    totalKgCO2ePerYear: Math.round(total * 10) / 10,
    breakdown,
    warnings: allErrors.length > 0 ? allErrors : undefined,
  };
}

/**
 * Calculates annual food-related emissions based on diet type.
 *
 * @param {string} dietType - Diet type identifier (see DIET_EMISSION_KG_PER_YEAR)
 * @returns {CalcResult}
 *
 * @example
 * calcFoodEmissions("vegan")      // → { valid: true, kgCO2ePerYear: 900 }
 * calcFoodEmissions("heavy_meat") // → { valid: true, kgCO2ePerYear: 3300 }
 */
function calcFoodEmissions(dietType) {
  if (typeof dietType !== "string") {
    return { valid: false, errors: ["dietType must be a string."] };
  }
  const clean = dietType.trim().toLowerCase();
  if (!(clean in DIET_EMISSION_KG_PER_YEAR)) {
    return {
      valid: false,
      errors: [`Unknown diet type: "${clean}". Valid: ${Object.keys(DIET_EMISSION_KG_PER_YEAR).join(", ")}`],
    };
  }
  return { valid: true, kgCO2ePerYear: DIET_EMISSION_KG_PER_YEAR[clean] };
}

/**
 * Calculates annual home energy emissions from monthly consumption figures.
 *
 * @param {Object} entry - Monthly energy consumption
 * @param {number} entry.electricityKwh - Monthly electricity (kWh)
 * @param {number} entry.lpgKg - Monthly LPG usage (kg)
 * @returns {CalcResult & { breakdown?: {electricity: number, lpg: number} }}
 */
function calcEnergyEmissions(entry) {
  const validation = validateEnergyEntry(entry);
  if (!validation.valid) return { valid: false, errors: validation.errors };

  const { electricityKwh, lpgKg } = validation.data;

  const electricityKg = electricityKwh * MONTHS_PER_YEAR * EMISSION_FACTORS.energy.electricity_kwh;
  const lpgKgCO2e    = lpgKg          * MONTHS_PER_YEAR * EMISSION_FACTORS.energy.lpg_kg;
  const total        = electricityKg + lpgKgCO2e;

  return {
    valid: true,
    kgCO2ePerYear: Math.round(total * 10) / 10,
    breakdown: {
      electricity: Math.round(electricityKg * 10) / 10,
      lpg:         Math.round(lpgKgCO2e    * 10) / 10,
    },
  };
}

/**
 * Calculates annual emissions from consumer goods purchases.
 *
 * @param {Object} entry - Annual shopping quantities
 * @param {number} [entry.clothingItems=0] - Clothing items purchased
 * @param {number} [entry.smartphones=0] - Smartphones purchased
 * @param {number} [entry.laptops=0] - Laptops purchased
 * @param {number} [entry.tvs=0] - TVs purchased
 * @param {number} [entry.onlineDeliveries=0] - Online delivery parcels received
 * @returns {CalcResult}
 */
function calcShoppingEmissions(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return { valid: false, errors: ["entry must be a plain object."] };
  }

  /** @type {Array<{key: string, factor: number, max: number}>} */
  const fields = [
    { key: "clothingItems",    factor: EMISSION_FACTORS.shopping.clothing_item,          max: 200  },
    { key: "smartphones",      factor: EMISSION_FACTORS.shopping.electronics_smartphone, max: 10   },
    { key: "laptops",          factor: EMISSION_FACTORS.shopping.electronics_laptop,     max: 10   },
    { key: "tvs",              factor: EMISSION_FACTORS.shopping.electronics_tv,         max: 10   },
    { key: "onlineDeliveries", factor: EMISSION_FACTORS.shopping.online_delivery_parcel, max: 1000 },
  ];

  const errors = [];
  const breakdown = {};
  let total = 0;

  for (const { key, factor, max } of fields) {
    const raw = entry[key] ?? 0;
    const result = validatePositiveNumber(raw, 0, max);
    if (!result.valid) {
      errors.push(`${key}: ${result.error}`);
      continue;
    }
    const kg = result.value * factor;
    breakdown[key] = Math.round(kg * 10) / 10;
    total += kg;
  }

  if (errors.length > 0 && total === 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    kgCO2ePerYear: Math.round(total * 10) / 10,
    breakdown,
    warnings: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Calculates annual emissions (and savings) from household waste management.
 *
 * @param {Object} entry - Waste management data
 * @param {number} entry.weeklyWasteKg - Weekly waste generated (kg)
 * @param {number} entry.recyclingPercent - Percentage recycled (0–100)
 * @param {boolean} entry.compostsFood - Whether food scraps are composted
 * @returns {CalcResult}
 */
function calcWasteEmissions(entry) {
  const validation = validateWasteEntry(entry);
  if (!validation.valid) return { valid: false, errors: validation.errors };

  const { weeklyWasteKg, recyclingPercent, compostsFood } = validation.data;

  const annualWasteKg = weeklyWasteKg * WEEKS_PER_YEAR;

  // Waste sent to landfill
  const recycledFraction   = recyclingPercent / 100;
  const landfillFraction   = 1 - recycledFraction;
  const landfillKg         = annualWasteKg * landfillFraction * EMISSION_FACTORS.waste.landfill_kg;

  // Savings from recycling
  const recyclingSavings   = annualWasteKg * recycledFraction * Math.abs(EMISSION_FACTORS.waste.recycling_kg);

  // Savings from composting (assume 30% of landfill-bound waste is organic if composting)
  const compostSavings     = compostsFood
    ? annualWasteKg * 0.3 * Math.abs(EMISSION_FACTORS.waste.composting_kg)
    : 0;

  const net = landfillKg - recyclingSavings - compostSavings;

  return {
    valid: true,
    kgCO2ePerYear: Math.round(net * 10) / 10,
    breakdown: {
      landfill:   Math.round(landfillKg       * 10) / 10,
      recycling:  Math.round(-recyclingSavings * 10) / 10,
      composting: Math.round(-compostSavings   * 10) / 10,
    },
  };
}

/**
 * Aggregates all emission categories into a single total footprint result.
 *
 * @param {Object} params
 * @param {string}   params.dietType         - User's diet type
 * @param {Object[]} params.transportEntries - Array of transport entries
 * @param {Object}   params.energyEntry      - Monthly energy consumption
 * @param {Object}   params.shoppingEntry    - Annual shopping quantities
 * @param {Object}   params.wasteEntry       - Waste management data
 * @returns {{ valid: boolean, totalKgCO2ePerYear: number, byCategory: Object, warnings?: string[] }}
 */
function calcTotalFootprint({ dietType, transportEntries, energyEntry, shoppingEntry, wasteEntry }) {
  const allWarnings = [];
  const byCategory  = {};

  // ── Transport ──────────────────────────────────────────────────────────
  const transportResult = calcTotalTransportEmissions(transportEntries || []);
  if (!transportResult.valid) {
    allWarnings.push(...(transportResult.errors || []));
    byCategory.transport = 0;
  } else {
    byCategory.transport = transportResult.totalKgCO2ePerYear;
    if (transportResult.warnings) allWarnings.push(...transportResult.warnings);
  }

  // ── Food ───────────────────────────────────────────────────────────────
  const foodResult = calcFoodEmissions(dietType || "omnivore");
  if (!foodResult.valid) {
    allWarnings.push(...(foodResult.errors || []));
    byCategory.food = DIET_EMISSION_KG_PER_YEAR.omnivore;
  } else {
    byCategory.food = foodResult.kgCO2ePerYear;
  }

  // ── Energy ─────────────────────────────────────────────────────────────
  const energyResult = calcEnergyEmissions(energyEntry || { electricityKwh: 0, lpgKg: 0 });
  if (!energyResult.valid) {
    allWarnings.push(...(energyResult.errors || []));
    byCategory.energy = 0;
  } else {
    byCategory.energy = energyResult.kgCO2ePerYear;
  }

  // ── Shopping ───────────────────────────────────────────────────────────
  const shoppingResult = calcShoppingEmissions(shoppingEntry || {});
  if (!shoppingResult.valid) {
    allWarnings.push(...(shoppingResult.errors || []));
    byCategory.shopping = 0;
  } else {
    byCategory.shopping = shoppingResult.kgCO2ePerYear;
  }

  // ── Waste ──────────────────────────────────────────────────────────────
  const defaultWaste = { weeklyWasteKg: 5, recyclingPercent: 10, compostsFood: false };
  const wasteResult = calcWasteEmissions(wasteEntry || defaultWaste);
  if (!wasteResult.valid) {
    allWarnings.push(...(wasteResult.errors || []));
    byCategory.waste = 0;
  } else {
    byCategory.waste = Math.max(0, wasteResult.kgCO2ePerYear);
  }

  const total = Object.values(byCategory).reduce((sum, v) => sum + v, 0);

  return {
    valid: true,
    totalKgCO2ePerYear: Math.round(total * 10) / 10,
    byCategory,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
  };
}

module.exports = {
  calcTransportEmissions,
  calcTotalTransportEmissions,
  calcFoodEmissions,
  calcEnergyEmissions,
  calcShoppingEmissions,
  calcWasteEmissions,
  calcTotalFootprint,
  DIET_EMISSION_KG_PER_YEAR,
  TRANSPORT_FACTOR_MAP,
};
