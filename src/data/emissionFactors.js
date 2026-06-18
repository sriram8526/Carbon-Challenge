/**
 * Emission factors (kg CO2e per unit)
 * Sources: EPA, IPCC AR6, Our World in Data
 */

"use strict";

const EMISSION_FACTORS = Object.freeze({
  transport: {
    car_petrol_km: 0.192,        // kg CO2e per km (average petrol car)
    car_diesel_km: 0.171,        // kg CO2e per km (average diesel car)
    car_electric_km: 0.053,      // kg CO2e per km (EV, India grid average)
    bus_km: 0.089,               // kg CO2e per km (public bus)
    train_km: 0.041,             // kg CO2e per km (rail)
    flight_domestic_km: 0.255,   // kg CO2e per km (domestic flight, per passenger)
    flight_international_km: 0.195, // kg CO2e per km (long haul, per passenger)
    motorcycle_km: 0.114,        // kg CO2e per km
    auto_rickshaw_km: 0.098,     // kg CO2e per km (CNG auto)
    walking_km: 0.0,
    cycling_km: 0.0,
  },

  food: {
    beef_kg: 27.0,               // kg CO2e per kg of beef
    lamb_kg: 39.2,               // kg CO2e per kg of lamb
    pork_kg: 12.1,               // kg CO2e per kg of pork
    chicken_kg: 6.9,             // kg CO2e per kg of chicken
    fish_kg: 6.1,                // kg CO2e per kg of fish
    eggs_kg: 4.5,                // kg CO2e per kg of eggs
    dairy_milk_litre: 3.2,       // kg CO2e per litre of milk
    cheese_kg: 13.5,             // kg CO2e per kg of cheese
    rice_kg: 2.7,                // kg CO2e per kg of rice
    wheat_kg: 1.4,               // kg CO2e per kg of wheat/bread
    vegetables_kg: 0.4,          // kg CO2e per kg of vegetables
    fruits_kg: 0.4,              // kg CO2e per kg of fruits
    legumes_kg: 0.9,             // kg CO2e per kg of lentils/beans
    nuts_kg: 2.3,                // kg CO2e per kg of nuts
  },

  energy: {
    electricity_kwh: 0.716,      // kg CO2e per kWh (India grid avg 2024)
    natural_gas_m3: 2.04,        // kg CO2e per m3
    lpg_kg: 2.98,                // kg CO2e per kg
    coal_kg: 2.42,               // kg CO2e per kg
    solar_kwh: 0.041,            // kg CO2e per kWh (lifecycle)
    wood_kg: 0.016,              // kg CO2e per kg (sustainable)
  },

  shopping: {
    clothing_item: 10.0,         // kg CO2e per clothing item (avg)
    electronics_smartphone: 70.0, // kg CO2e per smartphone
    electronics_laptop: 300.0,   // kg CO2e per laptop
    electronics_tv: 400.0,       // kg CO2e per TV
    furniture_piece: 100.0,      // kg CO2e per furniture piece
    online_delivery_parcel: 0.5, // kg CO2e per delivery parcel
  },

  waste: {
    landfill_kg: 0.587,          // kg CO2e per kg waste to landfill
    recycling_kg: -0.2,          // kg CO2e saved per kg recycled
    composting_kg: -0.1,         // kg CO2e saved per kg composted
  },
});

const GLOBAL_AVERAGE_KG_PER_YEAR = 4000;
const INDIA_AVERAGE_KG_PER_YEAR = 1800;
const PARIS_TARGET_KG_PER_YEAR = 2300;

const CATEGORY_COLORS = Object.freeze({
  transport: "#3b82f6",
  food: "#f59e0b",
  energy: "#ef4444",
  shopping: "#8b5cf6",
  waste: "#10b981",
});

const CATEGORY_ICONS = Object.freeze({
  transport: "🚗",
  food: "🍽️",
  energy: "⚡",
  shopping: "🛍️",
  waste: "♻️",
});

module.exports = {
  EMISSION_FACTORS,
  GLOBAL_AVERAGE_KG_PER_YEAR,
  INDIA_AVERAGE_KG_PER_YEAR,
  PARIS_TARGET_KG_PER_YEAR,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
};
