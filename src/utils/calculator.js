"use strict";

const { EMISSION_FACTORS } = require("../data/emissionFactors");
const {
  validateTransportEntry,
  validateEnergyEntry,
  validatePositiveNumber,
} = require("./validation");

/**
 * Carbon Calculator — all methods are pure functions with no side effects.
 * Inputs are validated before computation; invalid inputs return structured errors.
 */

const WEEKS_PER_YEAR = 52;

/**
 * Calculates annual transport emissions for a single transport mode entry.
 *
 * @param {Object} entry - { mode: string, distanceKm: number, frequencyPerWeek: number }
 * @returns {{ valid: boolean, kgCO2ePerYear?: number, errors?: string[] }}
 */
function calcTransportEmissions(entry) {
  const validation = validateTransportEntry(entry);
  if (!validation.valid) return { valid: false, errors: validation.errors };

  const { mode, distanceKm, frequencyPerWeek } = validation.data;

  // Map mode to emission factor key
  const factorKeyMap = {
    car_petrol: "car_petrol_km",
    car_diesel: "car_diesel_km",
    car_electric: "car_electric_km",
    bus: "bus_km",
    train: "train_km",
    flight_domestic: "flight_domestic_km",
    flight_international: "flight_international_km",
    motorcycle: "motorcycle_km",
    auto_rickshaw: "auto_rickshaw_km",
    walking: null,
    cycling: null,
  };

  const factorKey = factorKeyMap[mode];
  if (!factorKey) {
    // zero-emission modes
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
 * Calculates annual transport emissions from an array of transport entries.
 *
 * @param {Array<Object>} entries
 * @returns {{ valid: boolean, totalKgCO2ePerYear?: number, breakdown?: Array, errors?: string[] }}
 */
function calcTotalTransportEmissions(entries) {
  if (!Array.isArray(entries)) {
    return { valid: false, errors: ["entries must be an array"] };
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
    breakdown.push({
      mode: entries[i].mode,
      kgCO2ePerYear: result.kgCO2ePerYear,
    });
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
 * Diet type to approximate annual food emissions (kg CO2e/year).
 * Based on average consumption patterns per diet type.
 */
const DIET_EMISSION_KG_PER_YEAR = Object.freeze({
  heavy_meat: 3300,
  omnivore: 2100,
  pescatarian: 1500,
  vegetarian: 1200,
  vegan: 900,
});

/**
 * Calculates annual food emissions based on diet type.
 *
 * @param {string} dietType
 * @returns {{ valid: boolean, kgCO2ePerYear?: number, error?: string }}
 */
function calcFoodEmissions(dietType) {
  if (typeof dietType !== "string") {
    return { valid: false, error: "dietType must be a string" };
  }
  const clean = dietType.trim().toLowerCase();
  if (!(clean in DIET_EMISSION_KG_PER_YEAR)) {
    return {
      valid: false,
      error: `Unknown diet type: ${clean}. Valid: ${Object.keys(DIET_EMISSION_KG_PER_YEAR).join(", ")}`,
    };
  }
  return { valid: true, kgCO2ePerYear: DIET_EMISSION_KG_PER_YEAR[clean] };
}

/**
 * Calculates annual energy emissions from monthly energy consumption.
 *
 * @param {Object} entry - { electricityKwh: number, lpgKg: number }
 * @returns {{ valid: boolean, kgCO2ePerYear?: number, breakdown?: Object, errors?: string[] }}
 */
function calcEnergyEmissions(entry) {
  const validation = validateEnergyEntry(entry);
  if (!validation.valid) return { valid: false, errors: validation.errors };

  const { electricityKwh, lpgKg } = validation.data;

  // Monthly to annual
  const electricityAnnual = electricityKwh * 12;
  const lpgAnnual = lpgKg * 12;

  const electricityKg =
    electricityAnnual * EMISSION_FACTORS.energy.electricity_kwh;
  const lpgKg_co2e = lpgAnnual * EMISSION_FACTORS.energy.lpg_kg;

  const total = electricityKg + lpgKg_co2e;

  return {
    valid: true,
    kgCO2ePerYear: Math.round(total * 10) / 10,
    breakdown: {
      electricity: Math.round(electricityKg * 10) / 10,
      lpg: Math.round(lpgKg_co2e * 10) / 10,
    },
  };
}

/**
 * Calculates annual shopping/consumption emissions.
 *
 * @param {Object} entry - { clothingItems: number, smartphones: number, laptops: number }
 * @returns {{ valid: boolean, kgCO2ePerYear?: number, errors?: string[] }}
 */
function calcShoppingEmissions(entry) {
  if (!entry || typeof entry !== "object") {
    return { valid: false, errors: ["entry must be an object"] };
  }

  const errors = [];
  let total = 0;

  const fields = [
    { key: "clothingItems", factor: EMISSION_FACTORS.shopping.clothing_item, max: 200 },
    { key: "smartphones", factor: EMISSION_FACTORS.shopping.electronics_smartphone, max: 10 },
    { key: "laptops", factor: EMISSION_FACTORS.shopping.electronics_laptop, max: 10 },
    { key: "tvs", factor: EMISSION_FACTORS.shopping.electronics_tv, max: 10 },
    { key: "onlineDeliveries", factor: EMISSION_FACTORS.shopping.online_delivery_parcel, max: 1000 },
  ];

  for (const { key, factor, max } of fields) {
    const raw = entry[key] ?? 0;
    const result = validatePositiveNumber(raw, 0, max);
    if (!result.valid) {
      errors.push(`${key}: ${result.error}`);
      continue;
    }
    total += result.value * factor;
  }

  if (errors.length > 0 && total === 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    kgCO2ePerYear: Math.round(total * 10) / 10,
    warnings: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Aggregates all category emissions into a total footprint.
 *
 * @param {Object} params
 * @param {string} params.dietType
 * @param {Array} params.transportEntries
 * @param {Object} params.energyEntry
 * @param {Object} params.shoppingEntry
 * @returns {{ valid: boolean, totalKgCO2ePerYear?: number, byCategory?: Object, errors?: string[] }}
 */
function calcTotalFootprint({ dietType, transportEntries, energyEntry, shoppingEntry }) {
  const allErrors = [];
  const byCategory = {};

  // Transport
  const transportResult = calcTotalTransportEmissions(transportEntries || []);
  if (!transportResult.valid) {
    allErrors.push(...(transportResult.errors || []));
    byCategory.transport = 0;
  } else {
    byCategory.transport = transportResult.totalKgCO2ePerYear;
  }

  // Food
  const foodResult = calcFoodEmissions(dietType || "omnivore");
  if (!foodResult.valid) {
    allErrors.push(foodResult.error);
    byCategory.food = 0;
  } else {
    byCategory.food = foodResult.kgCO2ePerYear;
  }

  // Energy
  const energyResult = calcEnergyEmissions(
    energyEntry || { electricityKwh: 0, lpgKg: 0 }
  );
  if (!energyResult.valid) {
    allErrors.push(...(energyResult.errors || []));
    byCategory.energy = 0;
  } else {
    byCategory.energy = energyResult.kgCO2ePerYear;
  }

  // Shopping
  const shoppingResult = calcShoppingEmissions(shoppingEntry || {});
  if (!shoppingResult.valid) {
    allErrors.push(...(shoppingResult.errors || []));
    byCategory.shopping = 0;
  } else {
    byCategory.shopping = shoppingResult.kgCO2ePerYear;
  }

  const total = Object.values(byCategory).reduce((a, b) => a + b, 0);

  return {
    valid: true,
    totalKgCO2ePerYear: Math.round(total * 10) / 10,
    byCategory,
    warnings: allErrors.length > 0 ? allErrors : undefined,
  };
}

module.exports = {
  calcTransportEmissions,
  calcTotalTransportEmissions,
  calcFoodEmissions,
  calcEnergyEmissions,
  calcShoppingEmissions,
  calcTotalFootprint,
  DIET_EMISSION_KG_PER_YEAR,
};
