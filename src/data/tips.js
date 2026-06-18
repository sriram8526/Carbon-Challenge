"use strict";

/**
 * Curated carbon reduction tips with estimated impact.
 * Each tip has: id, category, title, description, estimatedSavingKgPerYear,
 * difficulty (easy/medium/hard), tags, and source reference.
 */

const TIPS = Object.freeze([
  // TRANSPORT
  {
    id: "t001",
    category: "transport",
    title: "Switch to public transport for daily commute",
    description:
      "Taking buses or trains instead of driving alone can cut your commute emissions by up to 75%. Even 3 days per week makes a big difference.",
    estimatedSavingKgPerYear: 1500,
    difficulty: "medium",
    tags: ["commute", "daily", "high-impact"],
  },
  {
    id: "t002",
    category: "transport",
    title: "Walk or cycle for short trips under 3 km",
    description:
      "Replacing car trips under 3 km with walking or cycling eliminates those emissions entirely and improves your health.",
    estimatedSavingKgPerYear: 300,
    difficulty: "easy",
    tags: ["daily", "health", "zero-emission"],
  },
  {
    id: "t003",
    category: "transport",
    title: "Carpool to work",
    description:
      "Sharing rides with 2 others cuts per-person transport emissions by roughly 67% on that route.",
    estimatedSavingKgPerYear: 800,
    difficulty: "easy",
    tags: ["commute", "social", "cost-saving"],
  },
  {
    id: "t004",
    category: "transport",
    title: "Avoid one short-haul flight per year",
    description:
      "A single return domestic flight can emit 500–700 kg CO2e. Consider trains for journeys under 700 km.",
    estimatedSavingKgPerYear: 600,
    difficulty: "medium",
    tags: ["travel", "high-impact"],
  },
  {
    id: "t005",
    category: "transport",
    title: "Work from home 2 days a week",
    description:
      "Remote work for 2 days cuts commute emissions by 40% and often reduces energy use across the week.",
    estimatedSavingKgPerYear: 700,
    difficulty: "medium",
    tags: ["commute", "work", "flexible"],
  },

  // FOOD
  {
    id: "f001",
    category: "food",
    title: "Try meat-free meals 3 days a week",
    description:
      "Replacing beef and lamb with plant-based meals 3 days per week can save over 500 kg CO2e annually. Start with lentils, chickpeas, and tofu.",
    estimatedSavingKgPerYear: 550,
    difficulty: "easy",
    tags: ["diet", "daily", "health"],
  },
  {
    id: "f002",
    category: "food",
    title: "Reduce beef consumption by half",
    description:
      "Beef is the most carbon-intensive food. Halving beef intake and replacing with chicken or legumes saves significant emissions.",
    estimatedSavingKgPerYear: 400,
    difficulty: "medium",
    tags: ["diet", "high-impact"],
  },
  {
    id: "f003",
    category: "food",
    title: "Cut food waste by planning meals",
    description:
      "Around 30% of food is wasted globally. Meal planning and using leftovers reduces waste and the emissions of producing uneaten food.",
    estimatedSavingKgPerYear: 200,
    difficulty: "easy",
    tags: ["waste", "cost-saving", "daily"],
  },
  {
    id: "f004",
    category: "food",
    title: "Buy local and seasonal produce",
    description:
      "Imported out-of-season produce travels thousands of kilometres. Local, seasonal food has a fraction of the transport footprint.",
    estimatedSavingKgPerYear: 150,
    difficulty: "easy",
    tags: ["shopping", "local"],
  },
  {
    id: "f005",
    category: "food",
    title: "Compost food scraps",
    description:
      "Composting diverts organic waste from landfill, preventing methane emissions. It also produces nutrient-rich soil amendment.",
    estimatedSavingKgPerYear: 100,
    difficulty: "easy",
    tags: ["waste", "gardening"],
  },

  // ENERGY
  {
    id: "e001",
    category: "energy",
    title: "Switch to LED lighting throughout your home",
    description:
      "LED bulbs use 75% less energy than incandescent bulbs and last 25x longer. A full home switch can save 200–400 kg CO2e per year.",
    estimatedSavingKgPerYear: 300,
    difficulty: "easy",
    tags: ["home", "cost-saving", "one-time"],
  },
  {
    id: "e002",
    category: "energy",
    title: "Install a solar water heater",
    description:
      "Solar water heaters can meet 50–70% of hot water needs and save 400–800 kg CO2e per year depending on current fuel type.",
    estimatedSavingKgPerYear: 600,
    difficulty: "hard",
    tags: ["home", "solar", "investment"],
  },
  {
    id: "e003",
    category: "energy",
    title: "Set AC to 24°C instead of 18°C",
    description:
      "Every 1°C increase in AC setpoint reduces energy consumption by ~6%. Setting 24°C vs 18°C can cut AC energy use by 36%.",
    estimatedSavingKgPerYear: 250,
    difficulty: "easy",
    tags: ["home", "daily", "cost-saving"],
  },
  {
    id: "e004",
    category: "energy",
    title: "Unplug electronics when not in use",
    description:
      "Standby power (phantom load) accounts for 5–10% of home electricity. Unplugging or using smart strips eliminates this waste.",
    estimatedSavingKgPerYear: 100,
    difficulty: "easy",
    tags: ["home", "daily", "habit"],
  },
  {
    id: "e005",
    category: "energy",
    title: "Use a pressure cooker for cooking",
    description:
      "Pressure cookers reduce cooking time by 50–70%, cutting LPG or electricity use significantly for daily meals.",
    estimatedSavingKgPerYear: 150,
    difficulty: "easy",
    tags: ["home", "cooking", "cost-saving"],
  },

  // SHOPPING
  {
    id: "s001",
    category: "shopping",
    title: "Buy second-hand clothes and electronics",
    description:
      "Extending the life of products by buying second-hand reduces the demand for new manufacturing, which is emissions-intensive.",
    estimatedSavingKgPerYear: 200,
    difficulty: "easy",
    tags: ["clothing", "circular", "cost-saving"],
  },
  {
    id: "s002",
    category: "shopping",
    title: "Repair instead of replace gadgets",
    description:
      "Repairing a phone instead of buying new can save 50–100 kg CO2e. Most cities have affordable repair shops.",
    estimatedSavingKgPerYear: 150,
    difficulty: "medium",
    tags: ["electronics", "circular"],
  },
  {
    id: "s003",
    category: "shopping",
    title: "Batch online deliveries to reduce trips",
    description:
      "Choosing slower delivery and consolidating orders into fewer trips reduces last-mile logistics emissions.",
    estimatedSavingKgPerYear: 50,
    difficulty: "easy",
    tags: ["ecommerce", "habit"],
  },

  // WASTE
  {
    id: "w001",
    category: "waste",
    title: "Segregate dry and wet waste at home",
    description:
      "Proper waste segregation enables recycling and composting. Dry recyclables diverted from landfill can save 200+ kg CO2e per household.",
    estimatedSavingKgPerYear: 200,
    difficulty: "easy",
    tags: ["home", "habit", "daily"],
  },
  {
    id: "w002",
    category: "waste",
    title: "Carry a reusable bag and bottle",
    description:
      "Eliminating single-use plastic bags and bottles reduces both production emissions and plastic pollution.",
    estimatedSavingKgPerYear: 30,
    difficulty: "easy",
    tags: ["daily", "plastic-free", "habit"],
  },
]);

/**
 * Get tips filtered by category
 * @param {string} category
 * @returns {Array}
 */
function getTipsByCategory(category) {
  if (!category) return [...TIPS];
  return TIPS.filter((tip) => tip.category === category);
}

/**
 * Get personalized tips based on user's highest-emission categories
 * @param {Object} footprintByCategory - { transport: number, food: number, ... }
 * @param {number} limit - max tips to return
 * @returns {Array}
 */
function getPersonalizedTips(footprintByCategory, limit = 5) {
  if (!footprintByCategory || typeof footprintByCategory !== "object") {
    return TIPS.slice(0, limit);
  }

  // Sort categories by emission amount (highest first)
  const sortedCategories = Object.entries(footprintByCategory)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([cat]) => cat);

  const result = [];
  const seen = new Set();

  // Prioritize tips from highest-emission categories
  for (const category of sortedCategories) {
    const categoryTips = TIPS.filter(
      (tip) => tip.category === category && !seen.has(tip.id)
    ).sort((a, b) => b.estimatedSavingKgPerYear - a.estimatedSavingKgPerYear);

    for (const tip of categoryTips) {
      if (result.length >= limit) break;
      result.push(tip);
      seen.add(tip.id);
    }
    if (result.length >= limit) break;
  }

  return result;
}

module.exports = { TIPS, getTipsByCategory, getPersonalizedTips };
