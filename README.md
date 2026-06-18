# 🌿 EcoTrack — Carbon Footprint Awareness Platform

> A smart, personalised carbon footprint tracker powered by AI — helping individuals understand, measure, and reduce their environmental impact through simple actions and data-driven insights.

---

## 🎯 Problem Statement Alignment

This project directly addresses the **Carbon Footprint Awareness Platform** challenge:

| Requirement | Implementation |
|---|---|
| Help individuals **understand** their footprint | Dashboard with category breakdown and benchmark comparisons |
| **Track** carbon footprint | Multi-category input tracker (transport, food, energy, shopping) |
| **Reduce** through simple actions | Personalised tips ranked by your highest-emission categories |
| **Personalised insights** | AI assistant (EcoGuide) that knows your footprint and gives tailored advice |

---

## 🚀 Quick Start

### Open in Browser (no install needed)
Open `src/index.html` directly in any modern browser.

### Run Tests
```bash
node tests/index.test.js
```

### Serve Locally
```bash
npx serve src -p 3000
# Open http://localhost:3000
```

---

## 🏗️ Architecture

```
carbon-footprint-platform/
├── src/
│   ├── index.html              # Complete single-page application
│   ├── components/
│   │   └── assistant.js        # AI chat assistant (Node.js module)
│   ├── data/
│   │   ├── emissionFactors.js  # Validated emission factors (EPA/IPCC sources)
│   │   └── tips.js             # 20 curated reduction tips with impact estimates
│   └── utils/
│       ├── calculator.js       # Core carbon calculation engine
│       ├── validation.js       # Input validation & sanitization
│       └── userProfile.js      # Data persistence & user profile management
├── tests/
│   └── index.test.js           # 64 unit tests across all modules
├── docs/
│   └── ARCHITECTURE.md         # Detailed technical documentation
└── README.md
```

---

## 💡 Chosen Vertical: Individual Lifestyle Tracking

EcoTrack targets **individual consumers** — the broadest and most underserved segment for carbon awareness. Unlike enterprise carbon accounting tools, EcoTrack focuses on everyday decisions: how you commute, what you eat, how you heat your home, and what you buy.

### Why this vertical?
- Individual consumption accounts for ~60–70% of global greenhouse gas emissions
- Most people have no idea what their personal footprint is
- Small, consistent behaviour changes at scale have massive collective impact
- India has a rapidly growing middle class making consumption decisions right now

---

## 🔬 Approach and Logic

### 1. Emission Calculation Engine

All calculations use peer-reviewed emission factors from:
- **EPA (US Environmental Protection Agency)** — transport factors
- **IPCC AR6 (2022)** — food lifecycle assessments
- **CEA India Grid Data (2024)** — electricity emission factor (0.716 kg CO₂e/kWh)
- **Our World in Data** — diet type benchmarks

**Formula (transport):**
```
Annual kg CO₂e = emission_factor × distance_km × trips_per_week × 52
```

**Formula (energy):**
```
Annual kg CO₂e = (monthly_kWh × 12 × 0.716) + (monthly_LPG_kg × 12 × 2.98)
```

**Diet footprints** use established annual averages by diet type:

| Diet | Annual kg CO₂e |
|------|---------------|
| Heavy meat | 3,300 |
| Omnivore | 2,100 |
| Pescatarian | 1,500 |
| Vegetarian | 1,200 |
| Vegan | 900 |

### 2. Personalised Tip Ranking

Tips are ranked by **expected annual impact** on the user's **specific profile**:
1. Categories are sorted by their share of the user's total footprint
2. Top-impact tips from the highest-emission category are surfaced first
3. No tip appears twice (deduplication by ID)
4. Each tip includes estimated savings, difficulty rating, and category

### 3. AI Assistant (EcoGuide)

EcoGuide uses the **Claude Sonnet 4.6** API with:
- **Context injection**: the user's full footprint breakdown is injected into every system prompt
- **Conversation history**: last 10 turns maintained for coherent multi-turn dialogue
- **Guardrails**: message sanitization, length limits, error handling for network failures
- **Suggested prompts**: pre-built questions to lower the barrier to engagement

### 4. Data Architecture

- **No backend required** — runs entirely in the browser
- **localStorage** for profile persistence (no PII collected)
- **History tracking** — daily footprint snapshots for progress monitoring (up to 90 days)
- **GDPR-ready**: `clearAllData()` function for full data erasure

---

## 🛡️ Security Implementation

| Threat | Mitigation |
|---|---|
| XSS injection | `sanitizeString()` strips all HTML tags before use |
| Input manipulation | Strict allowlist validation for all enum fields |
| Prototype pollution | Object type checking before property access |
| Numeric overflow | `clamp()` enforces min/max on all numeric inputs |
| API key exposure | Key injected by platform; never hardcoded |
| Data privacy | No PII collected; only anonymised usage metrics stored locally |

---

## ✅ Testing

**64 unit tests** covering:
- Emission factor data integrity
- Validation edge cases (XSS, SQL injection, prototype pollution, extreme values)
- Calculator correctness (formula verification with expected values)
- Tips engine (personalisation logic, deduplication, filtering)
- Graceful error handling for all invalid inputs

```bash
node tests/index.test.js
# Results: 64 passed, 0 failed
```

---

## ♿ Accessibility

- **Semantic HTML**: `<nav>`, `<main>`, `<section>`, `<article>`, proper heading hierarchy
- **ARIA labels**: all interactive elements have `aria-label` or `aria-labelledby`
- **ARIA live regions**: chat output uses `aria-live="polite"` for screen readers
- **Keyboard navigation**: all controls reachable and operable via keyboard
- **Focus indicators**: visible `:focus-visible` styles with 3px green outline
- **Colour contrast**: all text/background pairs meet WCAG 2.1 AA (≥4.5:1)
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables animations
- **Dark mode**: `@media (prefers-color-scheme: dark)` full dark theme support
- **Mobile responsive**: adapts to screens from 320px width; mobile bottom navigation
- **Screen reader tested**: `sr-only` utility class for context-only text

---

## ⚡ Efficiency

- **Zero external dependencies** for the production UI (no npm install required)
- **Single HTML file** — one HTTP request to load the entire app
- **Lazy calculation** — only recalculates when the user explicitly requests
- **Capped context window** — AI chat uses last 10 turns only (avoids token bloat)
- **localStorage batching** — state saved in one key to minimise writes
- **Input clamping** — prevents runaway calculations from extreme values
- **History trimming** — auto-trims to last 90 entries to avoid storage bloat

---

## 📊 Key Features

### Dashboard
- Annual CO₂e total vs India average (1,800 kg) and Paris target (2,300 kg)
- Visual progress bar showing position relative to targets
- Category breakdown bar chart with percentage shares
- Historical footprint tracking with recent trend

### Carbon Tracker
- Multi-mode transport (11 modes: car, bus, train, flight, rickshaw, walking, cycling…)
- Diet type selector (5 diet patterns with calibrated emission factors)
- Monthly home energy inputs (electricity + LPG)
- Annual shopping inputs (clothing, electronics, deliveries)
- Dynamic transport entry add/remove

### Personalised Tips
- Top 5 tips selected from your highest-emission categories
- Full browsable library of 20 tips, filterable by category
- Each tip shows: estimated saving, difficulty (Easy/Medium/Hard), and description

### AI Guide (EcoGuide)
- Knows your footprint data and gives contextual advice
- Suggested quick-start prompts
- Full multi-turn conversation
- Compares you to India average and Paris climate target

---

## 🌍 Assumptions Made

1. **India context** — emission factors calibrated for Indian grid electricity and typical consumption patterns
2. **Per-person accounting** — carpooling and shared housing are not modelled (individual focus)
3. **Diet as proxy** — we use diet type as a proxy for food footprint rather than granular meal logging, making it practical for everyday use
4. **Monthly energy bills** — users input monthly averages; seasonal variation is smoothed out
5. **Domestic flights use km** — users input distance, not route names, for flexibility
6. **No offset accounting** — we focus on actual emission reduction, not purchased offsets

---

## 📚 Data Sources

- EPA Emission Factors for Greenhouse Gas Inventories (2024)
- IPCC Sixth Assessment Report (AR6), 2022 — food systems
- Central Electricity Authority, India — CO₂ baseline emission factor 2023-24
- Our World in Data — "Environmental impacts of food production"
- Mike Berners-Lee, "How Bad Are Bananas?" — consumer product lifecycle data

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
# Carbon-Challenge
