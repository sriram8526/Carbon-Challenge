"use strict";

/**
 * UserProfile — manages user data with localStorage persistence.
 * Follows data minimisation: only stores what's needed for footprint tracking.
 * No PII (name, email, etc.) is collected or stored.
 */

const STORAGE_KEY = "cfp_user_profile";
const HISTORY_KEY = "cfp_history";
const MAX_HISTORY_ENTRIES = 90; // ~3 months of daily entries

/**
 * Default empty profile structure
 */
function createDefaultProfile() {
  return {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Preferences
    preferences: {
      units: "metric",
      locale: "en-IN",
      theme: "light",
    },
    // Current footprint inputs
    inputs: {
      transport: [],
      dietType: "omnivore",
      energy: {
        electricityKwh: 100, // monthly kWh
        lpgKg: 10,           // monthly kg
      },
      shopping: {
        clothingItems: 5,
        smartphones: 0,
        laptops: 0,
        tvs: 0,
        onlineDeliveries: 10,
      },
    },
    // Calculated footprint (cached, recalculated on input change)
    footprint: null,
    // Goals set by user
    goals: {
      targetKgCO2ePerYear: null,
      targetYear: null,
      chosenTips: [],
    },
    // Actions completed (for streak tracking)
    completedActions: [],
  };
}

/**
 * Loads user profile from localStorage.
 * Returns default profile if none exists or data is corrupt.
 * @returns {Object}
 */
function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProfile();
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle schema evolution
    return deepMerge(createDefaultProfile(), parsed);
  } catch (e) {
    console.error("[UserProfile] Failed to load profile:", e.message);
    return createDefaultProfile();
  }
}

/**
 * Saves user profile to localStorage.
 * @param {Object} profile
 * @returns {boolean} success
 */
function saveProfile(profile) {
  try {
    if (!profile || typeof profile !== "object") return false;
    profile.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch (e) {
    console.error("[UserProfile] Failed to save profile:", e.message);
    return false;
  }
}

/**
 * Saves a footprint calculation result to history.
 * @param {Object} footprintResult - calculated footprint data
 * @returns {boolean}
 */
function saveToHistory(footprintResult) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];

    const entry = {
      date: new Date().toISOString().split("T")[0], // YYYY-MM-DD
      totalKgCO2ePerYear: footprintResult.totalKgCO2ePerYear,
      byCategory: footprintResult.byCategory,
    };

    // Avoid duplicate entries for the same day
    const idx = history.findIndex((h) => h.date === entry.date);
    if (idx >= 0) {
      history[idx] = entry;
    } else {
      history.push(entry);
    }

    // Trim to max entries (keep most recent)
    const trimmed = history
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-MAX_HISTORY_ENTRIES);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    return true;
  } catch (e) {
    console.error("[UserProfile] Failed to save history:", e.message);
    return false;
  }
}

/**
 * Loads footprint history from localStorage.
 * @returns {Array<Object>}
 */
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("[UserProfile] Failed to load history:", e.message);
    return [];
  }
}

/**
 * Marks a tip as chosen by the user.
 * @param {Object} profile
 * @param {string} tipId
 * @returns {Object} updated profile
 */
function chooseTip(profile, tipId) {
  if (!profile || typeof tipId !== "string") return profile;
  const goals = profile.goals || {};
  const existing = goals.chosenTips || [];
  if (!existing.includes(tipId)) {
    goals.chosenTips = [...existing, tipId];
  }
  return { ...profile, goals };
}

/**
 * Records a completed action.
 * @param {Object} profile
 * @param {string} tipId
 * @returns {Object} updated profile
 */
function completeAction(profile, tipId) {
  if (!profile || typeof tipId !== "string") return profile;
  const existing = profile.completedActions || [];
  const entry = { tipId, completedAt: new Date().toISOString() };
  return { ...profile, completedActions: [...existing, entry] };
}

/**
 * Clears all stored data (GDPR-style data erasure).
 */
function clearAllData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HISTORY_KEY);
    return true;
  } catch (e) {
    console.error("[UserProfile] Failed to clear data:", e.message);
    return false;
  }
}

/**
 * Shallow deep-merge: fills missing keys from defaults without overwriting.
 * @param {Object} defaults
 * @param {Object} actual
 * @returns {Object}
 */
function deepMerge(defaults, actual) {
  const result = { ...defaults };
  for (const key of Object.keys(actual)) {
    if (
      actual[key] !== null &&
      typeof actual[key] === "object" &&
      !Array.isArray(actual[key]) &&
      typeof defaults[key] === "object" &&
      defaults[key] !== null &&
      !Array.isArray(defaults[key])
    ) {
      result[key] = deepMerge(defaults[key], actual[key]);
    } else {
      result[key] = actual[key];
    }
  }
  return result;
}

module.exports = {
  createDefaultProfile,
  loadProfile,
  saveProfile,
  saveToHistory,
  loadHistory,
  chooseTip,
  completeAction,
  clearAllData,
};
