"use strict";

/**
 * @fileoverview Input validation and sanitization utilities.
 *
 * Security principle: ALL external input must pass through these validators
 * before use. Allowlists are used instead of blocklists — unknown values
 * are rejected by default (deny-by-default security posture).
 *
 * @module validation
 */

/** @type {ReadonlySet<string>} */
const ALLOWED_TRANSPORT_MODES = Object.freeze(new Set([
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
]));

/** @type {ReadonlySet<string>} */
const ALLOWED_DIET_TYPES = Object.freeze(new Set([
  "vegan",
  "vegetarian",
  "pescatarian",
  "omnivore",
  "heavy_meat",
]));

/** @type {ReadonlySet<string>} */
const ALLOWED_CATEGORIES = Object.freeze(new Set([
  "transport",
  "food",
  "energy",
  "shopping",
  "waste",
]));

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {*} [value] - Sanitized value (present on success)
 * @property {string} [error] - Error message (present on failure)
 * @property {string[]} [errors] - Multiple error messages (present on failure)
 */

/**
 * Validates a numeric value is a finite number within [min, max].
 *
 * @param {*} value - Raw input value
 * @param {number} [min=0] - Minimum allowed value (inclusive)
 * @param {number} [max=1e9] - Maximum allowed value (inclusive)
 * @returns {ValidationResult}
 *
 * @example
 * validatePositiveNumber(42)           // { valid: true, value: 42 }
 * validatePositiveNumber(-1)           // { valid: false, error: "..." }
 * validatePositiveNumber(Infinity)     // { valid: false, error: "..." }
 */
function validatePositiveNumber(value, min = 0, max = 1e9) {
  if (value === null) return { valid: false, error: "Value must be a finite number." };
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
 * Validates a transport mode string against the allowed modes allowlist.
 * Comparison is case-insensitive.
 *
 * @param {*} mode - Raw mode input
 * @returns {ValidationResult}
 *
 * @example
 * validateTransportMode("car_petrol")  // { valid: true, value: "car_petrol" }
 * validateTransportMode("hoverboard")  // { valid: false, error: "..." }
 */
function validateTransportMode(mode) {
  if (typeof mode !== "string") {
    return { valid: false, error: "Transport mode must be a string." };
  }
  const clean = mode.trim().toLowerCase();
  if (!ALLOWED_TRANSPORT_MODES.has(clean)) {
    return {
      valid: false,
      error: `Invalid transport mode "${clean}". Allowed: ${[...ALLOWED_TRANSPORT_MODES].join(", ")}`,
    };
  }
  return { valid: true, value: clean };
}

/**
 * Validates a diet type string against the allowed diet types allowlist.
 *
 * @param {*} diet - Raw diet type input
 * @returns {ValidationResult}
 */
function validateDietType(diet) {
  if (typeof diet !== "string") {
    return { valid: false, error: "Diet type must be a string." };
  }
  const clean = diet.trim().toLowerCase();
  if (!ALLOWED_DIET_TYPES.has(clean)) {
    return {
      valid: false,
      error: `Invalid diet type "${clean}". Allowed: ${[...ALLOWED_DIET_TYPES].join(", ")}`,
    };
  }
  return { valid: true, value: clean };
}

/**
 * Validates a category string against the allowed categories allowlist.
 *
 * @param {*} category - Raw category input
 * @returns {ValidationResult}
 */
function validateCategory(category) {
  if (typeof category !== "string") {
    return { valid: false, error: "Category must be a string." };
  }
  const clean = category.trim().toLowerCase();
  if (!ALLOWED_CATEGORIES.has(clean)) {
    return {
      valid: false,
      error: `Invalid category "${clean}". Allowed: ${[...ALLOWED_CATEGORIES].join(", ")}`,
    };
  }
  return { valid: true, value: clean };
}

/**
 * Sanitizes a user-provided string by stripping all HTML tags and trimming.
 * Prevents XSS injection when user content is rendered in the DOM.
 *
 * @param {*} str - Raw input
 * @param {number} [maxLength=500] - Maximum allowed character length
 * @returns {string} Sanitized string (empty string if input is not a string)
 *
 * @example
 * sanitizeString('<script>alert(1)</script>hi')  // "hi"
 * sanitizeString('  hello  ')                     // "hello"
 */
function sanitizeString(str, maxLength = 500) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLength);
}

/**
 * Validates a complete transport activity entry object.
 *
 * @param {Object} entry - Raw transport entry
 * @param {string} entry.mode - Transport mode (see ALLOWED_TRANSPORT_MODES)
 * @param {number} entry.distanceKm - One-way trip distance in kilometres
 * @param {number} entry.frequencyPerWeek - Number of one-way trips per week
 * @returns {ValidationResult}
 */
function validateTransportEntry(entry) {
  const errors = [];

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return { valid: false, errors: ["Entry must be a plain object."] };
  }

  const modeResult = validateTransportMode(entry.mode);
  if (!modeResult.valid) errors.push(modeResult.error);

  const distanceResult = validatePositiveNumber(entry.distanceKm, 0, 100000);
  if (!distanceResult.valid) errors.push(`Distance: ${distanceResult.error}`);

  const frequencyResult = validatePositiveNumber(entry.frequencyPerWeek, 0, 14);
  if (!frequencyResult.valid) errors.push(`Frequency: ${frequencyResult.error}`);

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
 * Validates a monthly home energy consumption entry.
 *
 * @param {Object} entry - Raw energy entry
 * @param {number} entry.electricityKwh - Monthly electricity usage in kWh
 * @param {number} entry.lpgKg - Monthly LPG consumption in kg
 * @returns {ValidationResult}
 */
function validateEnergyEntry(entry) {
  const errors = [];

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return { valid: false, errors: ["Entry must be a plain object."] };
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

/**
 * Validates a waste/recycling entry.
 *
 * @param {Object} entry - Raw waste entry
 * @param {number} entry.weeklyWasteKg - Weekly household waste generated in kg
 * @param {number} entry.recyclingPercent - Percentage of waste recycled (0-100)
 * @param {boolean} entry.compostsFood - Whether food scraps are composted
 * @returns {ValidationResult}
 */
function validateWasteEntry(entry) {
  const errors = [];

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return { valid: false, errors: ["Entry must be a plain object."] };
  }

  const waste = validatePositiveNumber(entry.weeklyWasteKg, 0, 200);
  if (!waste.valid) errors.push(`Weekly waste: ${waste.error}`);

  const recycling = validatePositiveNumber(entry.recyclingPercent, 0, 100);
  if (!recycling.valid) errors.push(`Recycling %: ${recycling.error}`);

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      weeklyWasteKg: waste.value,
      recyclingPercent: recycling.value,
      compostsFood: entry.compostsFood === true,
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
  validateWasteEntry,
  ALLOWED_TRANSPORT_MODES,
  ALLOWED_DIET_TYPES,
  ALLOWED_CATEGORIES,
};
