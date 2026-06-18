"use strict";

/**
 * Input validation utilities.
 * All external input must pass through these validators before use.
 */

const ALLOWED_TRANSPORT_MODES = new Set([
  "car_petrol",
  "car_diesel",
  "car_electric",
  "bus",
  "train",
  "flight_domestic",
  "flight_international",
  "motorcycle",
  "auto_rickshaw",
  "walking",
  "cycling",
]);

const ALLOWED_DIET_TYPES = new Set([
  "vegan",
  "vegetarian",
  "pescatarian",
  "omnivore",
  "heavy_meat",
]);

const ALLOWED_CATEGORIES = new Set([
  "transport",
  "food",
  "energy",
  "shopping",
  "waste",
]);

/**
 * Validates a numeric value is a finite positive number within range.
 * @param {*} value
 * @param {number} min
 * @param {number} max
 * @returns {{ valid: boolean, value?: number, error?: string }}
 */
function validatePositiveNumber(value, min = 0, max = 1e9) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return { valid: false, error: "Value must be a finite number." };
  }
  if (num < min) {
    return { valid: false, error: `Value must be at least ${min}.` };
  }
  if (num > max) {
    return { valid: false, error: `Value must not exceed ${max}.` };
  }
  return { valid: true, value: num };
}

/**
 * Validates transport mode string
 * @param {*} mode
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
function validateTransportMode(mode) {
  if (typeof mode !== "string") {
    return { valid: false, error: "Transport mode must be a string." };
  }
  const clean = mode.trim().toLowerCase();
  if (!ALLOWED_TRANSPORT_MODES.has(clean)) {
    return {
      valid: false,
      error: `Invalid transport mode. Allowed: ${[...ALLOWED_TRANSPORT_MODES].join(", ")}`,
    };
  }
  return { valid: true, value: clean };
}

/**
 * Validates diet type
 * @param {*} diet
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
function validateDietType(diet) {
  if (typeof diet !== "string") {
    return { valid: false, error: "Diet type must be a string." };
  }
  const clean = diet.trim().toLowerCase();
  if (!ALLOWED_DIET_TYPES.has(clean)) {
    return {
      valid: false,
      error: `Invalid diet type. Allowed: ${[...ALLOWED_DIET_TYPES].join(", ")}`,
    };
  }
  return { valid: true, value: clean };
}

/**
 * Validates category string
 * @param {*} category
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
function validateCategory(category) {
  if (typeof category !== "string") {
    return { valid: false, error: "Category must be a string." };
  }
  const clean = category.trim().toLowerCase();
  if (!ALLOWED_CATEGORIES.has(clean)) {
    return {
      valid: false,
      error: `Invalid category. Allowed: ${[...ALLOWED_CATEGORIES].join(", ")}`,
    };
  }
  return { valid: true, value: clean };
}

/**
 * Sanitizes a user-facing string by stripping HTML tags and trimming.
 * Does NOT allow HTML injection.
 * @param {*} str
 * @param {number} maxLength
 * @returns {string}
 */
function sanitizeString(str, maxLength = 500) {
  if (typeof str !== "string") return "";
  // Strip HTML tags
  const stripped = str.replace(/<[^>]*>/g, "").trim();
  return stripped.slice(0, maxLength);
}

/**
 * Validates a full transport entry object
 * @param {Object} entry
 * @returns {{ valid: boolean, errors: string[], data?: Object }}
 */
function validateTransportEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== "object") {
    return { valid: false, errors: ["Entry must be an object."] };
  }

  const modeResult = validateTransportMode(entry.mode);
  if (!modeResult.valid) errors.push(modeResult.error);

  const distanceResult = validatePositiveNumber(entry.distanceKm, 0, 100000);
  if (!distanceResult.valid) errors.push(`Distance: ${distanceResult.error}`);

  const frequencyResult = validatePositiveNumber(entry.frequencyPerWeek, 0, 14);
  if (!frequencyResult.valid)
    errors.push(`Frequency: ${frequencyResult.error}`);

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      mode: modeResult.value,
      distanceKm: distanceResult.value,
      frequencyPerWeek: frequencyResult.value,
    },
  };
}

/**
 * Validates an energy consumption entry
 * @param {Object} entry
 * @returns {{ valid: boolean, errors: string[], data?: Object }}
 */
function validateEnergyEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== "object") {
    return { valid: false, errors: ["Entry must be an object."] };
  }

  const kwh = validatePositiveNumber(entry.electricityKwh, 0, 10000);
  if (!kwh.valid) errors.push(`Electricity: ${kwh.error}`);

  const lpg = validatePositiveNumber(entry.lpgKg, 0, 1000);
  if (!lpg.valid) errors.push(`LPG: ${lpg.error}`);

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      electricityKwh: kwh.value,
      lpgKg: lpg.value,
    },
  };
}

module.exports = {
  validatePositiveNumber,
  validateTransportMode,
  validateDietType,
  validateCategory,
  sanitizeString,
  validateTransportEntry,
  validateEnergyEntry,
  ALLOWED_TRANSPORT_MODES,
  ALLOWED_DIET_TYPES,
  ALLOWED_CATEGORIES,
};
