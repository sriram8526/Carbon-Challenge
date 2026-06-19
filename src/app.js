/**
 * @fileoverview EcoTrack — main application controller.
 *
 * Architecture:
 *   - CONFIG   : named constants, no magic numbers anywhere
 *   - STATE    : single source of truth, immutable snapshots
 *   - STORAGE  : isolated localStorage read/write with error handling
 *   - CALC     : pure DOM-reading functions, one per category
 *   - RENDER   : one render function per page/section, no side effects
 *   - CHAT     : async AI assistant with full error boundary
 *   - NAV      : page routing, ARIA state management
 *   - INIT     : single entry point, all event binding here
 *
 * Coding standards: Google JavaScript Style Guide
 * Max function length: 40 lines (excl. comments)
 * All public functions documented with JSDoc
 */

"use strict";

/* ════════════════════════════════════════════════════
   CONFIG — all constants in one place, zero magic numbers
════════════════════════════════════════════════════ */

/**
 * Reference benchmark values (kg CO₂e per year).
 * @enum {number}
 */
const BENCHMARKS = Object.freeze({
  INDIA_AVERAGE:  1800,
  PARIS_TARGET:   2300,
  GLOBAL_AVERAGE: 4000,
});

/**
 * Emission factors (kg CO₂e per unit).
 * Sources: EPA 2024, IPCC AR6, CEA India Grid 2023-24.
 * @const {Object}
 */
const EMISSION_FACTORS = Object.freeze({
  transport: Object.freeze({
    car_petrol:           0.192,  // kg CO₂e per km
    car_diesel:           0.171,
    car_electric:         0.053,  // India grid average
    bus:                  0.089,
    train:                0.041,
    flight_domestic:      0.255,  // per passenger per km
    flight_international: 0.195,
    motorcycle:           0.114,
    auto_rickshaw:        0.098,  // CNG auto
    walking:              0.000,
    cycling:              0.000,
  }),
  food: Object.freeze({
    heavy_meat:  3300,  // kg CO₂e per year (diet-type annual proxy)
    omnivore:    2100,
    pescatarian: 1500,
    vegetarian:  1200,
    vegan:        900,
  }),
  energy: Object.freeze({
    electricity_kwh: 0.716,  // India grid (CEA 2023-24)
    lpg_kg:          2.980,
  }),
  shopping: Object.freeze({
    clothing_item:          10.0,   // kg CO₂e per item
    electronics_smartphone: 70.0,
    electronics_laptop:    300.0,
    online_delivery_parcel:  0.5,
  }),
  waste: Object.freeze({
    landfill_kg:   0.587,   // kg CO₂e per kg to landfill
    recycling_kg: -0.200,   // kg CO₂e saved per kg recycled
    composting_kg:-0.100,   // kg CO₂e saved per kg composted
  }),
});

/** Weeks per calendar year. @const {number} */
const WEEKS_PER_YEAR = 52;

/** Months per calendar year. @const {number} */
const MONTHS_PER_YEAR = 12;

/**
 * Organic fraction of waste assumed compostable (30%).
 * @const {number}
 */
const ORGANIC_WASTE_FRACTION = 0.30;

/** Maximum number of history entries retained. @const {number} */
const MAX_HISTORY_ENTRIES = 90;

/** localStorage key for persisted application state. @const {string} */
const STORAGE_KEY = "ecotrack_v3";

/** Maximum characters accepted in a chat message. @const {number} */
const CHAT_MAX_CHARS = 1000;

/**
 * Category display metadata.
 * @const {Object.<string, {icon: string, color: string, label: string}>}
 */
const CATEGORY_META = Object.freeze({
  transport: { icon: "🚗", color: "#3b82f6", label: "Transport" },
  food:      { icon: "🍽️", color: "#f59e0b", label: "Food"      },
  energy:    { icon: "⚡",  color: "#ef4444", label: "Energy"    },
  shopping:  { icon: "🛍️", color: "#8b5cf6", label: "Shopping"  },
  waste:     { icon: "♻️", color: "#10b981", label: "Waste"     },
});

/**
 * Transport mode options for the select dropdown.
 * @const {Array<{value: string, label: string}>}
 */
const TRANSPORT_OPTIONS = Object.freeze([
  { value: "car_petrol",           label: "🚗 Car (Petrol)"           },
  { value: "car_diesel",           label: "🚗 Car (Diesel)"           },
  { value: "car_electric",         label: "🔋 Car (Electric)"         },
  { value: "motorcycle",           label: "🏍️ Motorcycle"             },
  { value: "auto_rickshaw",        label: "🛺 Auto Rickshaw"          },
  { value: "bus",                  label: "🚌 Bus"                    },
  { value: "train",                label: "🚆 Train / Metro"          },
  { value: "flight_domestic",      label: "✈️ Domestic Flight"        },
  { value: "flight_international", label: "✈️ International Flight"   },
  { value: "cycling",              label: "🚲 Cycling"                },
  { value: "walking",              label: "🚶 Walking"                },
]);

/**
 * Reduction tips database — 20 tips across 5 categories.
 * @const {Array<{
 *   id: string, category: string, title: string,
 *   description: string, savingKgPerYear: number, difficulty: string
 * }>}
 */
const TIPS = Object.freeze([
  { id:"t001", category:"transport", title:"Use public transport for daily commute",    description:"Buses or trains instead of driving cuts commute emissions by up to 75%.",                               savingKgPerYear:1500, difficulty:"medium" },
  { id:"t002", category:"transport", title:"Walk or cycle for trips under 3 km",        description:"Short trips by foot or bike have zero direct emissions and boost your health.",                          savingKgPerYear: 300, difficulty:"easy"   },
  { id:"t003", category:"transport", title:"Carpool to work",                            description:"Sharing rides with 2 others cuts per-person transport emissions by ~67%.",                              savingKgPerYear: 800, difficulty:"easy"   },
  { id:"t004", category:"transport", title:"Take the train instead of short flights",   description:"A return domestic flight emits 500–700 kg CO₂e. Rail emits roughly 85% less.",                          savingKgPerYear: 600, difficulty:"medium" },
  { id:"t005", category:"transport", title:"Work from home 2 days a week",              description:"Remote work 2 days per week cuts your commute emissions by 40%.",                                        savingKgPerYear: 700, difficulty:"medium" },
  { id:"f001", category:"food",      title:"Try meat-free meals 3 days a week",         description:"Replacing beef with plant-based meals 3 days weekly saves 500+ kg CO₂e annually.",                      savingKgPerYear: 550, difficulty:"easy"   },
  { id:"f002", category:"food",      title:"Reduce beef consumption by half",            description:"Beef is the most carbon-intensive food. Halving intake and switching to legumes makes a large impact.",  savingKgPerYear: 400, difficulty:"medium" },
  { id:"f003", category:"food",      title:"Plan meals to cut food waste",               description:"Around 30% of food is wasted globally. Planning and using leftovers reduces this significantly.",        savingKgPerYear: 200, difficulty:"easy"   },
  { id:"f004", category:"food",      title:"Buy local and seasonal produce",             description:"Local, seasonal produce has far lower transport emissions than imported out-of-season food.",             savingKgPerYear: 150, difficulty:"easy"   },
  { id:"f005", category:"food",      title:"Compost food scraps",                        description:"Composting diverts organic waste from landfill, preventing methane emissions.",                           savingKgPerYear: 100, difficulty:"easy"   },
  { id:"e001", category:"energy",    title:"Switch all lighting to LED",                 description:"LED bulbs use 75% less energy than incandescent and last 25 times longer.",                              savingKgPerYear: 300, difficulty:"easy"   },
  { id:"e002", category:"energy",    title:"Set AC to 24°C instead of lower",            description:"Each 1°C increase in AC setpoint reduces energy use by approximately 6%.",                              savingKgPerYear: 250, difficulty:"easy"   },
  { id:"e003", category:"energy",    title:"Install a solar water heater",               description:"Solar water heaters can meet 50–70% of hot water needs year-round in India.",                           savingKgPerYear: 600, difficulty:"hard"   },
  { id:"e004", category:"energy",    title:"Unplug electronics on standby",              description:"Standby power accounts for 5–10% of home electricity. Smart strips eliminate this waste.",              savingKgPerYear: 100, difficulty:"easy"   },
  { id:"e005", category:"energy",    title:"Use a pressure cooker daily",                description:"Pressure cookers reduce cooking time by 50–70%, saving significant LPG or electricity.",                savingKgPerYear: 150, difficulty:"easy"   },
  { id:"s001", category:"shopping",  title:"Buy second-hand clothes and electronics",    description:"Extending product lifespans reduces demand for emissions-intensive new manufacturing.",                   savingKgPerYear: 200, difficulty:"easy"   },
  { id:"s002", category:"shopping",  title:"Repair gadgets instead of replacing",        description:"Repairing a phone instead of buying new saves 50–100 kg CO₂e per device.",                             savingKgPerYear: 150, difficulty:"medium" },
  { id:"s003", category:"shopping",  title:"Consolidate online deliveries",              description:"Bundling orders and choosing slower delivery reduces last-mile logistics emissions.",                     savingKgPerYear:  50, difficulty:"easy"   },
  { id:"w001", category:"waste",     title:"Segregate dry and wet waste at home",        description:"Proper waste segregation enables recycling and composting, diverting waste from landfill.",              savingKgPerYear: 200, difficulty:"easy"   },
  { id:"w002", category:"waste",     title:"Carry a reusable bag and water bottle",      description:"Eliminating single-use plastics reduces both production emissions and plastic pollution.",               savingKgPerYear:  30, difficulty:"easy"   },
]);

/* ════════════════════════════════════════════════════
   STATE — single source of truth
════════════════════════════════════════════════════ */

/**
 * @typedef {Object} TransportEntry
 * @property {string} mode - Transport mode key
 * @property {number} distanceKm - One-way trip distance in km
 * @property {number} frequencyPerWeek - Number of one-way trips per week
 */

/**
 * @typedef {Object} FootprintResult
 * @property {number} totalKgCO2ePerYear - Total annual emissions
 * @property {Object.<string, number>} byCategory - Per-category emissions
 * @property {string} dietType - Diet type used in calculation
 * @property {string} calculatedAt - ISO timestamp of calculation
 */

/**
 * @typedef {Object} Goal
 * @property {number} targetKgCO2ePerYear - User's emission reduction target
 * @property {number} targetYear - Year to achieve the target
 */

/**
 * @typedef {Object} AppState
 * @property {FootprintResult|null} footprint - Latest calculation result
 * @property {Array<{date: string, total: number, byCategory: Object}>} history
 * @property {Array<{role: string, content: string}>} chat - AI conversation
 * @property {TransportEntry[]} transportEntries - User's transport modes
 * @property {Goal|null} goal - User's reduction goal
 * @property {string} activeTipCategory - Currently selected tip filter
 */

/** @type {AppState} */
const state = {
  footprint:         null,
  history:           [],
  chat:              [],
  transportEntries:  [{ mode: "car_petrol", distanceKm: 10, frequencyPerWeek: 5 }],
  goal:              null,
  activeTipCategory: "",
};

/* ════════════════════════════════════════════════════
   STORAGE — isolated localStorage with error handling
════════════════════════════════════════════════════ */

/**
 * Persists serialisable state to localStorage.
 * Silently fails if storage is unavailable (private mode, quota exceeded).
 * @returns {void}
 */
function persistState() {
  try {
    const payload = {
      footprint:        state.footprint,
      history:          state.history.slice(-MAX_HISTORY_ENTRIES),
      transportEntries: state.transportEntries,
      goal:             state.goal,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("[EcoTrack] State persistence failed:", err.message);
  }
}

/**
 * Hydrates application state from localStorage on startup.
 * Merges saved data into the default state; ignores corrupt data.
 * @returns {void}
 */
function hydrateState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { return; }

    const saved = JSON.parse(raw);

    if (saved.footprint)                     { state.footprint        = saved.footprint; }
    if (Array.isArray(saved.history))        { state.history          = saved.history; }
    if (Array.isArray(saved.transportEntries)) { state.transportEntries = saved.transportEntries; }
    if (saved.goal)                          { state.goal             = saved.goal; }
  } catch (err) {
    console.warn("[EcoTrack] State hydration failed:", err.message);
  }
}

/* ════════════════════════════════════════════════════
   UTILS — shared helpers
════════════════════════════════════════════════════ */

/**
 * Clamps a value to [min, max], returning min for non-finite inputs.
 * @param {*} value - Raw input (string or number)
 * @param {number} min - Lower bound (inclusive)
 * @param {number} max - Upper bound (inclusive)
 * @returns {number} Clamped numeric value
 */
function clamp(value, min, max) {
  const numeric = parseFloat(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : min;
}

/**
 * Strips all HTML tags and truncates to maxLength.
 * Prevents XSS when inserting user content into the DOM.
 * @param {*} input - Raw input value
 * @param {number} [maxLength=500] - Maximum character length
 * @returns {string} Sanitized plain text
 */
function sanitizeText(input, maxLength = 500) {
  if (typeof input !== "string") { return ""; }
  return input.replace(/<[^>]*>/g, "").trim().slice(0, maxLength);
}

/**
 * Capitalises the first character of a string.
 * @param {string} str - Input string
 * @returns {string} String with first character uppercased
 */
function capitalise(str) {
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}

/**
 * Reads a numeric input value from the DOM by element ID.
 * Accepts an optional `doc` parameter for dependency injection in tests;
 * defaults to the global `document` in normal browser operation.
 * @param {string} elementId - ID of the input element
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {Document} [doc=document] - Document reference (injectable for testing)
 * @returns {number} Clamped numeric value
 */
function readNumericInput(elementId, min, max, doc = document) {
  const element = doc.getElementById(elementId);
  return element ? clamp(element.value, min, max) : min;
}

/* ════════════════════════════════════════════════════
   CALC — one pure function per emission category
════════════════════════════════════════════════════ */

/**
 * Calculates annual transport emissions from the current transport entries.
 * Formula: factor (kg/km) × distanceKm × tripsPerWeek × WEEKS_PER_YEAR
 * @returns {number} Annual transport emissions in kg CO₂e
 */
function calcTransportKg() {
  return state.transportEntries.reduce((total, entry) => {
    const factor = EMISSION_FACTORS.transport[entry.mode] ?? 0;
    const distance = clamp(entry.distanceKm, 0, 100_000);
    const frequency = clamp(entry.frequencyPerWeek, 0, 14);
    return total + (factor * distance * frequency * WEEKS_PER_YEAR);
  }, 0);
}

/**
 * Reads the selected diet type and returns its annual food emissions.
 * @param {Document} [doc=document] - Document reference (injectable for testing)
 * @returns {number} Annual food emissions in kg CO₂e
 */
function calcFoodKg(doc = document) {
  const selected = doc.getElementById("diet-select")?.value ?? "omnivore";
  return EMISSION_FACTORS.food[selected] ?? EMISSION_FACTORS.food.omnivore;
}

/**
 * Calculates annual home energy emissions from monthly electricity and LPG inputs.
 * Formula: monthlyAmount × MONTHS_PER_YEAR × emissionFactor
 * @param {Document} [doc=document] - Document reference (injectable for testing)
 * @returns {number} Annual energy emissions in kg CO₂e
 */
function calcEnergyKg(doc = document) {
  const electricityKwh = readNumericInput("electricity-kwh", 0, 10_000, doc);
  const lpgKg          = readNumericInput("lpg-kg", 0, 1_000, doc);

  const electricityKgCO2e = electricityKwh * MONTHS_PER_YEAR * EMISSION_FACTORS.energy.electricity_kwh;
  const lpgKgCO2e         = lpgKg          * MONTHS_PER_YEAR * EMISSION_FACTORS.energy.lpg_kg;

  return electricityKgCO2e + lpgKgCO2e;
}

/**
 * Calculates annual shopping emissions from consumer goods purchases.
 * @param {Document} [doc=document] - Document reference (injectable for testing)
 * @returns {number} Annual shopping emissions in kg CO₂e
 */
function calcShoppingKg(doc = document) {
  const clothing    = readNumericInput("clothing-items",    0, 200,    doc);
  const smartphones = readNumericInput("smartphones",       0, 10,     doc);
  const laptops     = readNumericInput("laptops",           0, 10,     doc);
  const deliveries  = readNumericInput("online-deliveries", 0, 1_000, doc);

  return (
    (clothing    * EMISSION_FACTORS.shopping.clothing_item)          +
    (smartphones * EMISSION_FACTORS.shopping.electronics_smartphone) +
    (laptops     * EMISSION_FACTORS.shopping.electronics_laptop)     +
    (deliveries  * EMISSION_FACTORS.shopping.online_delivery_parcel)
  );
}

/**
 * Calculates net annual waste emissions accounting for recycling and composting.
 * Formula: landfillEmissions − recyclingSavings − compostingSavings
 * @param {Document} [doc=document] - Document reference (injectable for testing)
 * @returns {number} Net annual waste emissions in kg CO₂e (minimum 0)
 */
function calcWasteKg(doc = document) {
  const weeklyWasteKg    = readNumericInput("weekly-waste",  0, 200, doc);
  const recyclingPercent = readNumericInput("recycling-pct", 0, 100, doc);
  const compostsFood     = doc.getElementById("composts-food")?.checked ?? false;

  const annualWasteKg    = weeklyWasteKg * WEEKS_PER_YEAR;
  const recycledFraction = recyclingPercent / 100;
  const landfillFraction = 1 - recycledFraction;

  const landfillEmissions  = annualWasteKg * landfillFraction * EMISSION_FACTORS.waste.landfill_kg;
  const recyclingSavings   = annualWasteKg * recycledFraction * Math.abs(EMISSION_FACTORS.waste.recycling_kg);
  const compostingSavings  = compostsFood
    ? annualWasteKg * ORGANIC_WASTE_FRACTION * Math.abs(EMISSION_FACTORS.waste.composting_kg)
    : 0;

  return Math.max(0, landfillEmissions - recyclingSavings - compostingSavings);
}

/**
 * Aggregates all category emissions and persists the result to state.
 * Updates state.footprint and appends a history entry for today.
 * @param {Document} [doc=document] - Document reference (injectable for testing)
 * @returns {FootprintResult} The calculated footprint result
 */
function runCalculation(doc = document) {
  /** @type {Object.<string, number>} */
  const byCategory = {
    transport: Math.round(calcTransportKg()      * 10) / 10,
    food:      Math.round(calcFoodKg(doc)         * 10) / 10,
    energy:    Math.round(calcEnergyKg(doc)       * 10) / 10,
    shopping:  Math.round(calcShoppingKg(doc)     * 10) / 10,
    waste:     Math.round(calcWasteKg(doc)        * 10) / 10,
  };

  const total = Object.values(byCategory).reduce((sum, kg) => sum + kg, 0);

  /** @type {FootprintResult} */
  const result = {
    totalKgCO2ePerYear: Math.round(total),
    byCategory,
    dietType:     doc.getElementById("diet-select")?.value ?? "omnivore",
    calculatedAt: new Date().toISOString(),
  };

  state.footprint = result;
  appendHistoryEntry(result);
  persistState();

  return result;
}

/**
 * Appends or updates today's footprint entry in state.history.
 * Ensures only one entry per calendar day.
 * @param {FootprintResult} result - The calculation result to record
 * @returns {void}
 */
function appendHistoryEntry(result) {
  const today  = new Date().toISOString().split("T")[0];
  const entry  = { date: today, total: result.totalKgCO2ePerYear, byCategory: result.byCategory };
  const index  = state.history.findIndex((h) => h.date === today);

  if (index >= 0) {
    state.history[index] = entry;
  } else {
    state.history.push(entry);
  }
}

/* ════════════════════════════════════════════════════
   RENDER HELPERS — shared building blocks
════════════════════════════════════════════════════ */

/**
 * Renders an HTML string for a single reduction tip card.
 * Uses textContent-safe rendering to prevent XSS.
 * @param {{id: string, category: string, title: string, description: string,
 *          savingKgPerYear: number, difficulty: string}} tip
 * @returns {string} HTML string for the tip card
 */
function renderTipCard(tip) {
  const meta = CATEGORY_META[tip.category] || { icon: "💡" };
  return `
    <article class="tip-card" aria-label="${sanitizeText(tip.title)}">
      <div class="tip-icon" aria-hidden="true">${meta.icon}</div>
      <div>
        <div class="tip-title">${sanitizeText(tip.title)}</div>
        <div class="tip-desc">${sanitizeText(tip.description)}</div>
        <span class="tip-saving">≈ ${tip.savingKgPerYear.toLocaleString("en-IN")} kg CO₂e/yr saved</span>
        <span class="tip-difficulty ${tip.difficulty}">${capitalise(tip.difficulty)}</span>
      </div>
    </article>`;
}

/**
 * Returns the top N tips personalised to the user's highest-emission categories.
 * Tips are ranked by potential saving within each high-emission category first.
 * @param {Object.<string, number>} footprintByCategory - Category emission values
 * @param {number} [limit=5] - Maximum tips to return
 * @returns {Array} Ordered, deduplicated tip objects
 */
function getPersonalisedTips(footprintByCategory, limit = 5) {
  const sortedCategories = Object.entries(footprintByCategory)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([category]) => category);

  /** @type {Array} */
  const result = [];
  const seen   = new Set();

  for (const category of sortedCategories) {
    const categoryTips = TIPS
      .filter((tip) => tip.category === category && !seen.has(tip.id))
      .sort((a, b) => b.savingKgPerYear - a.savingKgPerYear);

    for (const tip of categoryTips) {
      if (result.length >= limit) { return result; }
      result.push(tip);
      seen.add(tip.id);
    }
  }

  return result;
}

/* ════════════════════════════════════════════════════
   RENDER — DASHBOARD
════════════════════════════════════════════════════ */

/**
 * Updates the four key metric cards on the dashboard.
 * @param {number|null} total - Total annual footprint, or null if uncalculated
 * @returns {void}
 */
function renderMetricCards(total) {
  document.getElementById("metric-total").textContent =
    total != null ? total.toLocaleString("en-IN") : "–";

  if (total == null) { return; }

  const diff      = total - BENCHMARKS.INDIA_AVERAGE;
  const pctChange = Math.round((Math.abs(diff) / BENCHMARKS.INDIA_AVERAGE) * 100);
  const vsEl      = document.getElementById("metric-vs");
  const vsLabel   = document.getElementById("metric-vs-label");

  vsEl.textContent   = diff > 0 ? `+${pctChange}%` : `-${pctChange}%`;
  vsEl.style.color   = diff > 0 ? "var(--red-500)" : "var(--green-600)";
  vsLabel.textContent = diff > 0 ? "above India avg" : "below India avg";
}

/**
 * Renders the comparison bar and benchmark badge section.
 * @param {number} total - Total annual footprint in kg CO₂e
 * @returns {void}
 */
function renderComparisonSection(total) {
  const indiaClass = total <= BENCHMARKS.INDIA_AVERAGE ? "badge-green" : "badge-red";
  const parisClass = total <= BENCHMARKS.PARIS_TARGET  ? "badge-green" : "badge-amber";
  const barPct     = Math.min(100, (total / (BENCHMARKS.GLOBAL_AVERAGE * 1.5)) * 100);
  const isOverParis = total > BENCHMARKS.PARIS_TARGET;

  document.getElementById("comparison-content").innerHTML = `
    <p style="margin-bottom:10px">
      Your annual footprint is <strong>${total.toLocaleString("en-IN")} kg CO₂e</strong>.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <span class="badge ${indiaClass}">
        India avg: ${total <= BENCHMARKS.INDIA_AVERAGE ? "below ✓" : "above"}
      </span>
      <span class="badge ${parisClass}">
        Paris target: ${total <= BENCHMARKS.PARIS_TARGET ? "below ✓" : "above"}
      </span>
    </div>
    <div class="progress-outer" role="progressbar"
         aria-valuenow="${total}" aria-valuemin="0"
         aria-valuemax="${BENCHMARKS.GLOBAL_AVERAGE}"
         aria-label="Footprint vs global average: ${total} of ${BENCHMARKS.GLOBAL_AVERAGE} kg CO₂e">
      <div class="progress-inner ${isOverParis ? "over" : ""}"
           style="width:${barPct}%"></div>
    </div>
    <div class="flex-between text-muted" style="margin-top:4px">
      <span>0</span>
      <span>India: ${BENCHMARKS.INDIA_AVERAGE.toLocaleString()} | Paris: ${BENCHMARKS.PARIS_TARGET.toLocaleString()}</span>
      <span>${BENCHMARKS.GLOBAL_AVERAGE.toLocaleString()}</span>
    </div>`;
}

/**
 * Renders the horizontal bar chart of emissions by category.
 * @param {Object.<string, number>} byCategory - Per-category emissions
 * @param {number} total - Total emissions for percentage calculation
 * @returns {void}
 */
function renderCategoryChart(byCategory, total) {
  const maxValue = Math.max(...Object.values(byCategory), 1);

  document.getElementById("breakdown-chart").innerHTML =
    Object.entries(byCategory).map(([category, value]) => {
      const pct    = Math.round((value / (total || 1)) * 100);
      const barPct = (value / maxValue) * 100;
      const meta   = CATEGORY_META[category] || { icon: "•", color: "#888", label: category };

      return `
        <div class="chart-row" role="group"
             aria-label="${meta.label}: ${value.toLocaleString()} kg CO₂e, ${pct}% of total">
          <div class="chart-row-header">
            <span class="chart-label">${meta.icon} ${meta.label}</span>
            <span class="chart-value">${value.toLocaleString()} kg (${pct}%)</span>
          </div>
          <div class="chart-bar-bg">
            <div class="chart-bar-fill"
                 style="width:${barPct}%;background:${meta.color}"></div>
          </div>
        </div>`;
    }).join("");
}

/**
 * Renders the progress history section with recent snapshots.
 * @returns {void}
 */
function renderHistorySection() {
  const histEl = document.getElementById("history-content");
  const sorted = [...state.history].sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 2) {
    histEl.innerHTML = `<p class="text-muted">
      Track again to see your progress over time.
    </p>`;
    return;
  }

  const first  = sorted[0];
  const latest = sorted[sorted.length - 1];
  const change = latest.total - first.total;
  const sign   = change > 0 ? "+" : "";
  const color  = change <= 0 ? "var(--green-600)" : "var(--red-500)";
  const recent = sorted.slice(-6);

  histEl.innerHTML = `
    <p style="margin-bottom:10px">
      Tracked from <strong>${first.date}</strong> to <strong>${latest.date}</strong>
      &nbsp;·&nbsp; Change:
      <strong style="color:${color}">${sign}${change.toLocaleString("en-IN")} kg CO₂e</strong>
    </p>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${recent.map((h) => `
        <div class="metric-card" style="padding:10px;min-width:80px">
          <div style="font-weight:700;font-size:.9rem;color:var(--green-700)">
            ${h.total.toLocaleString("en-IN")}
          </div>
          <div style="font-size:.7rem;color:var(--n500)">${h.date.slice(5)}</div>
        </div>`).join("")}
    </div>`;
}

/**
 * Orchestrates a full dashboard re-render.
 * Delegates to focused sub-render functions.
 * @returns {void}
 */
function renderDashboard() {
  const fp    = state.footprint;
  const total = fp?.totalKgCO2ePerYear ?? null;

  renderMetricCards(total);

  if (total != null) {
    renderComparisonSection(total);
    renderCategoryChart(fp.byCategory, total);
  }

  renderHistorySection();
}

/* ════════════════════════════════════════════════════
   RENDER — TRACKER
════════════════════════════════════════════════════ */

/**
 * Builds the HTML for a single transport entry row.
 * @param {TransportEntry} entry - Transport entry data
 * @param {number} index - Entry index in state.transportEntries
 * @param {boolean} isRemovable - Whether to show the remove button
 * @returns {string} HTML string for the entry
 */
function buildTransportEntryHTML(entry, index, isRemovable) {
  const removeButton = isRemovable
    ? `<button class="entry-remove" data-idx="${index}"
             aria-label="Remove transport entry ${index + 1}">×</button>`
    : "";

  const options = TRANSPORT_OPTIONS.map(({ value, label }) =>
    `<option value="${value}"${entry.mode === value ? " selected" : ""}>${label}</option>`
  ).join("");

  return `
    ${removeButton}
    <div class="input-row-3">
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label" for="mode-${index}">Mode</label>
        <select class="form-input" id="mode-${index}"
                data-idx="${index}" data-field="mode"
                aria-label="Transport mode for entry ${index + 1}">
          ${options}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label" for="dist-${index}">Distance (km)</label>
        <input class="form-input" type="number" id="dist-${index}"
               data-idx="${index}" data-field="distanceKm"
               value="${entry.distanceKm}" min="0" max="100000"
               aria-label="One-way distance in km for entry ${index + 1}" />
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label" for="freq-${index}">Days/week</label>
        <input class="form-input" type="number" id="freq-${index}"
               data-idx="${index}" data-field="frequencyPerWeek"
               value="${entry.frequencyPerWeek}" min="0" max="14" step="0.5"
               aria-label="Days per week for entry ${index + 1}" />
      </div>
    </div>`;
}

/**
 * Re-renders all transport entry rows and re-binds their event listeners.
 * @returns {void}
 */
function renderTransportEntries() {
  const container   = document.getElementById("transport-entries");
  const isRemovable = state.transportEntries.length > 1;

  container.innerHTML = "";

  state.transportEntries.forEach((entry, index) => {
    const div = document.createElement("div");
    div.className = "transport-entry";
    div.setAttribute("role", "listitem");
    div.innerHTML = buildTransportEntryHTML(entry, index, isRemovable);
    container.appendChild(div);
  });

  bindTransportEntryEvents(container);
}

/**
 * Binds change and remove events for transport entry controls.
 * @param {HTMLElement} container - The transport entries container element
 * @returns {void}
 */
function bindTransportEntryEvents(container) {
  container.querySelectorAll(".entry-remove").forEach((button) => {
    button.addEventListener("click", () => {
      const index = parseInt(button.dataset.idx, 10);
      state.transportEntries.splice(index, 1);
      renderTransportEntries();
    });
  });

  container.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("change", () => {
      const index = parseInt(input.dataset.idx, 10);
      const field = input.dataset.field;
      state.transportEntries[index][field] = field === "mode"
        ? input.value
        : parseFloat(input.value) || 0;
    });
  });
}

/* ════════════════════════════════════════════════════
   RENDER — TIPS
════════════════════════════════════════════════════ */

/**
 * Renders the personalised top-5 tips section and the filterable all-tips section.
 * @returns {void}
 */
function renderTipsPage() {
  renderPersonalisedTips();
  renderAllTips(state.activeTipCategory);
}

/**
 * Renders the personalised tips section based on the user's footprint.
 * @returns {void}
 */
function renderPersonalisedTips() {
  const container = document.getElementById("tips-content");
  const fp        = state.footprint;

  if (!fp?.byCategory) {
    container.innerHTML = `<p class="text-muted">
      Calculate your footprint first to see personalised recommendations.
    </p>`;
    return;
  }

  const tips = getPersonalisedTips(fp.byCategory);
  container.innerHTML = `
    <h2 class="card-title" style="margin-bottom:14px">
      ⭐ Your top actions (based on your footprint)
    </h2>
    ${tips.map(renderTipCard).join("")}`;
}

/**
 * Renders the filterable all-tips section and updates filter button states.
 * @param {string} [category=""] - Category to filter by, or "" for all
 * @returns {void}
 */
function renderAllTips(category = "") {
  const filteredTips = category
    ? TIPS.filter((tip) => tip.category === category)
    : [...TIPS];

  const sorted = filteredTips.sort((a, b) => b.savingKgPerYear - a.savingKgPerYear);
  document.getElementById("all-tips-content").innerHTML = sorted.map(renderTipCard).join("");

  document.querySelectorAll("[data-category]").forEach((button) => {
    const isActive = button.dataset.category === category;
    button.className    = `btn btn-sm ${isActive ? "btn-primary" : "btn-secondary"}`;
    button.setAttribute("aria-pressed", String(isActive));
  });
}

/* ════════════════════════════════════════════════════
   RENDER — GOALS
════════════════════════════════════════════════════ */

/**
 * Renders the goals page. Delegates to sub-renderers for
 * the goal-setter form and the progress section.
 * @returns {void}
 */
function renderGoalsPage() {
  const fp      = state.footprint;
  const goalEl  = document.getElementById("goals-content");

  if (!fp) {
    goalEl.innerHTML = `<p class="text-muted">
      Calculate your footprint first to set meaningful goals.
    </p>`;
    return;
  }

  goalEl.innerHTML =
    buildGoalFormHTML(fp.totalKgCO2ePerYear) +
    buildGoalProgressHTML(fp.totalKgCO2ePerYear) +
    buildGoalTipsHTML(fp.totalKgCO2ePerYear);

  bindGoalFormEvents(fp.totalKgCO2ePerYear);
}

/**
 * Builds the HTML for the goal-setting form card.
 * @param {number} currentTotal - Current annual footprint in kg CO₂e
 * @returns {string} HTML string
 */
function buildGoalFormHTML(currentTotal) {
  const savedTarget = state.goal?.targetKgCO2ePerYear ?? BENCHMARKS.PARIS_TARGET;
  const savedYear   = state.goal?.targetYear ?? (new Date().getFullYear() + 1);

  return `
    <div class="goal-card">
      <div class="card-title">🎯 Set your reduction goal</div>
      <p class="text-muted" style="margin-bottom:16px">
        Current footprint: <strong>${currentTotal.toLocaleString("en-IN")} kg CO₂e/year</strong>
      </p>
      <div class="input-row" style="margin-bottom:12px">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" for="goal-target">Target (kg CO₂e/year)</label>
          <input class="form-input" type="number" id="goal-target"
                 min="0" max="${currentTotal}" value="${savedTarget}"
                 aria-describedby="goal-hint" />
          <p class="form-hint" id="goal-hint">
            Paris: ${BENCHMARKS.PARIS_TARGET.toLocaleString()} |
            India avg: ${BENCHMARKS.INDIA_AVERAGE.toLocaleString()}
          </p>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" for="goal-year">Target year</label>
          <input class="form-input" type="number" id="goal-year"
                 min="${new Date().getFullYear()}"
                 max="${new Date().getFullYear() + 10}"
                 value="${savedYear}" />
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <button class="btn btn-sm btn-secondary" id="preset-paris">
          📍 Paris target (${BENCHMARKS.PARIS_TARGET.toLocaleString()})
        </button>
        <button class="btn btn-sm btn-secondary" id="preset-india">
          🇮🇳 India average (${BENCHMARKS.INDIA_AVERAGE.toLocaleString()})
        </button>
        <button class="btn btn-sm btn-secondary" id="preset-half">
          ✂️ Cut in half (${Math.round(currentTotal / 2).toLocaleString()})
        </button>
      </div>
      <button class="btn btn-primary" id="save-goal-btn">Save Goal</button>
    </div>`;
}

/**
 * Builds the HTML for the goal progress section (shown only when a goal is saved).
 * @param {number} currentTotal - Current annual footprint in kg CO₂e
 * @returns {string} HTML string (empty if no goal set)
 */
function buildGoalProgressHTML(currentTotal) {
  if (!state.goal) { return ""; }

  const target    = state.goal.targetKgCO2ePerYear;
  const toReduce  = Math.max(0, currentTotal - target);
  const progressPct = Math.round((target / currentTotal) * 100);

  return `
    <div class="card">
      <div class="card-title">📉 Goal progress</div>
      <div class="metrics-grid" style="grid-template-columns:1fr 1fr 1fr">
        <div class="metric-card">
          <div class="metric-value">${currentTotal.toLocaleString("en-IN")}</div>
          <div class="metric-unit">kg CO₂e/yr</div>
          <div class="metric-label">Current</div>
        </div>
        <div class="metric-card">
          <div class="metric-value" style="color:var(--green-600)">
            ${target.toLocaleString("en-IN")}
          </div>
          <div class="metric-unit">kg CO₂e/yr</div>
          <div class="metric-label">Target ${state.goal.targetYear}</div>
        </div>
        <div class="metric-card">
          <div class="metric-value" style="color:var(--amber-500)">
            ${toReduce.toLocaleString("en-IN")}
          </div>
          <div class="metric-unit">kg CO₂e/yr</div>
          <div class="metric-label">To reduce</div>
        </div>
      </div>
      <div class="progress-outer" role="progressbar"
           aria-valuenow="${progressPct}" aria-valuemin="0" aria-valuemax="100"
           aria-label="Goal: ${progressPct}% of the way to target">
        <div class="progress-inner" style="width:${progressPct}%"></div>
      </div>
      <p class="text-muted">
        Reduce by <strong>${toReduce.toLocaleString("en-IN")} kg CO₂e</strong>
        to reach your ${state.goal.targetYear} target.
      </p>
    </div>`;
}

/**
 * Builds the HTML for the goal-tips section.
 * @param {number} currentTotal - Current annual footprint in kg CO₂e
 * @returns {string} HTML string
 */
function buildGoalTipsHTML(currentTotal) {
  const parisGap     = Math.max(0, currentTotal - BENCHMARKS.PARIS_TARGET);
  const alertClass   = parisGap > 0 ? "alert-info" : "alert-success";
  const alertMessage = parisGap > 0
    ? `To reach the Paris target, reduce by <strong>${parisGap.toLocaleString("en-IN")} kg CO₂e/year</strong>.`
    : "🎉 You are already below the Paris climate target!";

  const topTips = [...TIPS].sort((a, b) => b.savingKgPerYear - a.savingKgPerYear).slice(0, 3);

  return `
    <div class="card">
      <div class="card-title">💡 How to reach your goal</div>
      <div class="alert ${alertClass}" style="margin-bottom:12px">${alertMessage}</div>
      <div class="tips-grid">${topTips.map(renderTipCard).join("")}</div>
    </div>`;
}

/**
 * Binds preset buttons and the save button on the goals form.
 * Separated from renderGoalsPage to satisfy SRP.
 * @param {number} currentTotal - Current footprint, used for "cut in half" preset
 * @returns {void}
 */
function bindGoalFormEvents(currentTotal) {
  const targetInput = document.getElementById("goal-target");

  document.getElementById("preset-paris")
    ?.addEventListener("click", () => { targetInput.value = BENCHMARKS.PARIS_TARGET; });

  document.getElementById("preset-india")
    ?.addEventListener("click", () => { targetInput.value = BENCHMARKS.INDIA_AVERAGE; });

  document.getElementById("preset-half")
    ?.addEventListener("click", () => { targetInput.value = Math.round(currentTotal / 2); });

  document.getElementById("save-goal-btn")
    ?.addEventListener("click", () => saveGoal(currentTotal));
}

/**
 * Reads, validates, and persists the user's goal from the form.
 * Re-renders the goals page to reflect the saved goal.
 * @param {number} currentTotal - Upper bound for target validation
 * @returns {void}
 */
function saveGoal(currentTotal) {
  const rawTarget = document.getElementById("goal-target")?.value;
  const rawYear   = document.getElementById("goal-year")?.value;
  const thisYear  = new Date().getFullYear();

  state.goal = {
    targetKgCO2ePerYear: Math.round(clamp(rawTarget, 0, currentTotal)),
    targetYear:          Math.round(clamp(rawYear, thisYear, thisYear + 10)),
  };

  persistState();
  renderGoalsPage();
}

/* ════════════════════════════════════════════════════
   CHAT — AI assistant with full error boundary
════════════════════════════════════════════════════ */

/**
 * Serialises the user's footprint data into a prompt-ready context string.
 * @param {FootprintResult|null} footprint
 * @param {Goal|null} goal
 * @returns {string} Formatted context for the AI system prompt
 */
function buildAIContext(footprint, goal) {
  if (!footprint) { return "No footprint calculated yet."; }

  const lines = [
    `Total annual footprint: ${footprint.totalKgCO2ePerYear} kg CO₂e`,
    "Breakdown by category:",
    ...Object.entries(footprint.byCategory).map(
      ([cat, val]) => `  ${capitalise(cat)}: ${val} kg CO₂e`
    ),
    `Diet type: ${footprint.dietType}`,
    `India average: ${BENCHMARKS.INDIA_AVERAGE} kg | Paris target: ${BENCHMARKS.PARIS_TARGET} kg`,
  ];

  if (goal) {
    lines.push(`User's goal: reduce to ${goal.targetKgCO2ePerYear} kg by ${goal.targetYear}`);
  }

  return lines.join("\n");
}

/**
 * Sends a user message to the Claude API and displays the response.
 * Handles loading state, errors, and conversation history management.
 * @param {string} rawMessage - Raw user input (will be sanitized)
 * @returns {Promise<void>}
 */
async function sendChatMessage(rawMessage) {
  const message = sanitizeText(rawMessage, CHAT_MAX_CHARS);
  if (!message) { return; }

  appendChatBubble("user", message);
  state.chat.push({ role: "user", content: message });

  const loadingId = `loading-${Date.now()}`;
  appendChatBubble("bot", "EcoGuide is thinking…", /* isLoading */ true, loadingId);
  setChatInputEnabled(false);

  try {
    const reply = await fetchAIReply(message);
    document.getElementById(loadingId)?.remove();
    appendChatBubble("bot", reply);
    state.chat.push({ role: "assistant", content: reply });
  } catch (err) {
    document.getElementById(loadingId)?.remove();
    appendChatBubble("bot", `⚠️ ${sanitizeText(err.message)}. Please try again.`);
  } finally {
    setChatInputEnabled(true);
  }
}

/**
 * Makes the API request to Claude and returns the reply text.
 * @param {string} message - The sanitized user message
 * @returns {Promise<string>} The AI-generated reply text
 * @throws {Error} If the API request fails or returns a non-OK status
 */
async function fetchAIReply(message) {
  const systemPrompt = [
    "You are EcoGuide, a friendly carbon footprint assistant.",
    "Be concise, positive, and practical. Max 2–3 actionable suggestions per reply.",
    "Never be preachy. Plain text only, no markdown.",
    "",
    "User footprint data:",
    buildAIContext(state.footprint, state.goal),
  ].join("\n");

  const messages = [
    ...state.chat.slice(-10, -1),
    { role: "user", content: message },
  ];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      model:      "claude-sonnet-4-6",
      max_tokens: 1000,
      system:     systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`API ${response.status}: ${errorBody.error?.message ?? "Unknown error"}`);
  }

  const data = await response.json();
  return data.content?.find((block) => block.type === "text")?.text?.trim()
    ?? "I couldn't generate a response. Please try again.";
}

/**
 * Appends a chat bubble to the chat area.
 * @param {"user"|"bot"} role - Message sender role
 * @param {string} text - Message content (will be set via textContent, not innerHTML)
 * @param {boolean} [isLoading=false] - Whether to apply the loading style
 * @param {string|null} [id=null] - Optional ID for the bubble element
 * @returns {void}
 */
function appendChatBubble(role, text, isLoading = false, id = null) {
  const chatArea  = document.getElementById("chat-area");
  const bubble    = document.createElement("div");
  const roleClass = role === "user" ? "chat-bubble-user" : "chat-bubble-bot";

  bubble.className   = `chat-bubble ${roleClass}${isLoading ? " loading" : ""}`;
  bubble.textContent = text;   // textContent: never innerHTML with user data

  if (id) { bubble.id = id; }

  chatArea.appendChild(bubble);
  chatArea.scrollTop = chatArea.scrollHeight;
}

/**
 * Enables or disables the chat send button and sets its ARIA state.
 * @param {boolean} enabled - Whether the button should be enabled
 * @returns {void}
 */
function setChatInputEnabled(enabled) {
  const button         = document.getElementById("chat-send-btn");
  button.disabled      = !enabled;
  button.setAttribute("aria-disabled", String(!enabled));
}

/* ════════════════════════════════════════════════════
   NAV — routing and ARIA tab state
════════════════════════════════════════════════════ */

/**
 * Switches the visible page and updates all ARIA tab/panel attributes.
 * Triggers page-specific render functions.
 * @param {string} pageId - The page identifier (e.g. "dashboard", "tracker")
 * @returns {void}
 */
function navigateTo(pageId) {
  // Deactivate all pages and tabs
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
    page.setAttribute("hidden", "");
  });
  document.querySelectorAll(".nav-tab, .mobile-nav-btn").forEach((tab) => {
    tab.classList.remove("active");
    tab.setAttribute("aria-selected", "false");
  });

  // Activate target page
  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.classList.add("active");
    targetPage.removeAttribute("hidden");
  }

  // Activate matching nav buttons
  document.querySelectorAll(`[data-page="${pageId}"]`).forEach((tab) => {
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
  });

  // Trigger page-specific renders
  const pageRenders = {
    dashboard: renderDashboard,
    tips:      renderTipsPage,
    goals:     renderGoalsPage,
  };
  pageRenders[pageId]?.();
}

/* ════════════════════════════════════════════════════
   INIT — single entry point, all event binding here
════════════════════════════════════════════════════ */

/**
 * Bootstraps the application:
 * 1. Hydrates state from localStorage
 * 2. Renders initial views
 * 3. Binds all event listeners
 * @returns {void}
 */
function init() {
  hydrateState();
  renderTransportEntries();
  renderDashboard();
  renderAllTips("");

  // Mark non-active pages as hidden for accessibility
  document.querySelectorAll(".page:not(.active)").forEach((page) => {
    page.setAttribute("hidden", "");
  });

  bindNavigationEvents();
  bindTrackerEvents();
  bindChatEvents();
}

/**
 * Binds all navigation tab and mobile nav button events.
 * @returns {void}
 */
function bindNavigationEvents() {
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => navigateTo(button.dataset.page));
  });
}

/**
 * Binds all events on the tracker page:
 * - Add transport entry
 * - Calculate button
 * - Tip category filters
 * @returns {void}
 */
function bindTrackerEvents() {
  document.getElementById("add-transport-btn").addEventListener("click", () => {
    state.transportEntries.push({ mode: "bus", distanceKm: 5, frequencyPerWeek: 5 });
    renderTransportEntries();
  });

  document.getElementById("calculate-btn").addEventListener("click", () => {
    const errorEl = document.getElementById("calc-errors");
    errorEl.setAttribute("hidden", "");

    try {
      runCalculation();
      navigateTo("dashboard");
    } catch (err) {
      errorEl.textContent = `Calculation error: ${sanitizeText(err.message)}`;
      errorEl.removeAttribute("hidden");
    }
  });

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTipCategory = button.dataset.category;
      renderAllTips(state.activeTipCategory);
    });
  });
}

/**
 * Binds all chat events:
 * - Send button click
 * - Enter key in textarea
 * - Suggested prompt buttons
 * @returns {void}
 */
function bindChatEvents() {
  const sendButton = document.getElementById("chat-send-btn");
  const chatInput  = document.getElementById("chat-input");

  sendButton.addEventListener("click", () => {
    const message = chatInput.value.trim();
    if (message) {
      chatInput.value = "";
      sendChatMessage(message);
    }
  });

  chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendButton.click();
    }
  });

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => sendChatMessage(button.dataset.prompt));
  });
}

// Bootstrap on DOM ready (browser only — guarded for Node.js test imports)
if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("DOMContentLoaded", init);
}

// Export pure functions for unit testing (Node.js / CommonJS only).
// Browsers ignore this block since `module` is undefined there.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    // Config
    BENCHMARKS, EMISSION_FACTORS, WEEKS_PER_YEAR, MONTHS_PER_YEAR,
    ORGANIC_WASTE_FRACTION, CATEGORY_META, TIPS,
    // Utils
    clamp, sanitizeText, capitalise, readNumericInput,
    // Calc
    calcTransportKg, calcFoodKg, calcEnergyKg, calcShoppingKg, calcWasteKg,
    runCalculation, appendHistoryEntry,
    // Tips
    getPersonalisedTips, renderTipCard,
    // State (for inspection in tests)
    state,
  };
}
