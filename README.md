# 🌿 EcoTrack — Carbon Footprint Awareness Platform

> A smart, personalised carbon footprint tracker powered by AI — helping individuals **understand**, **track**, and **reduce** their environmental impact through simple actions and data-driven insights.

---

## 🎯 Problem Statement Alignment

| Challenge Requirement | EcoTrack Implementation |
|---|---|
| Help individuals **understand** their footprint | Dashboard with category breakdown, benchmark comparisons (India avg / Paris target), and progress history |
| **Track** carbon footprint | Multi-category tracker: transport (11 modes), diet (5 types), energy, shopping, and **waste/recycling** |
| **Reduce** through simple actions | 20 curated tips ranked by personal impact, filterable by category |
| **Personalised insights** | EcoGuide AI (Claude Sonnet 4.6) with footprint context, goal data, and suggested prompts |

---

## 🚀 Quick Start

### Open directly in browser (no install needed)
```
open src/index.html
```

### Run tests
```bash
node tests/index.test.js
# Expected: 168 passed, 0 failed
```

### Serve locally
```bash
npx serve src -p 3000
# Open http://localhost:3000
```

---

## 🏗️ Architecture

```
carbon-footprint-platform/
├── src/
│   ├── index.html              # Complete zero-dependency SPA
│   ├── components/
│   │   └── assistant.js        # AI chat component (Node.js module)
│   ├── data/
│   │   ├── emissionFactors.js  # Peer-reviewed emission factors (EPA/IPCC/CEA)
│   │   └── tips.js             # 20 curated reduction tips with impact estimates
│   └── utils/
│       ├── calculator.js       # Pure-function carbon calculation engine
│       ├── validation.js       # Input validation & XSS sanitization
│       └── userProfile.js      # Data persistence & profile management
├── tests/
│   └── index.test.js           # 168 unit tests — 100% passing
├── docs/
│   └── ARCHITECTURE.md         # Full technical documentation
├── .gitignore
├── LICENSE
└── README.md                   ← You are here
```

---

## 💡 Chosen Vertical: Individual Lifestyle Tracking

EcoTrack targets **individual consumers** — the broadest and most impactful segment for carbon awareness.

### Why this vertical?
- Individual consumption drives ~60–70% of global GHG emissions
- Most people have no idea what their personal footprint is
- India's growing middle class is making high-impact consumption decisions now
- Small, consistent behaviour changes at scale produce massive collective impact

---

## 🔬 Approach & Logic

### Carbon Calculation Engine

All calculations use **pure functions** (no side effects) with validated emission factors from:
- **EPA** Emission Factors for GHG Inventories (2024) — transport
- **IPCC AR6** (2022) — food lifecycle assessments
- **CEA India Grid** (2023–24) — electricity: 0.716 kg CO₂e/kWh
- **Our World in Data** — diet type annual benchmarks

**Five tracked categories:**

| Category | Inputs | Method |
|---|---|---|
| Transport | Mode, distance (km), frequency (days/week) | `factor × km × trips/wk × 52` |
| Food | Diet type (5 options) | Annual benchmark by diet pattern |
| Energy | Monthly electricity (kWh), LPG (kg) | `monthly × 12 × emission_factor` |
| Shopping | Clothing, electronics, deliveries | Per-item lifecycle factors |
| Waste | Weekly waste (kg), recycling %, composting | Landfill emissions minus recycling/compost savings |

### Personalised Tip Ranking
1. Categories sorted by share of user's total footprint (highest first)
2. Top-impact tips surfaced from the highest-emission category
3. No tip shown twice (Set-based deduplication by ID)
4. 20 tips across all 5 categories, each with difficulty and estimated annual saving

### AI Assistant (EcoGuide)
- **Model**: Claude Sonnet 4.6 via Anthropic API
- **Context**: Full footprint breakdown + diet type + goals injected into every system prompt
- **Conversation memory**: Last 10 turns maintained per session
- **Guardrails**: Input sanitization, 1000-char limit, disabled send during request, graceful error recovery

### Goals Feature
- User sets a custom reduction target (kg CO₂e/year) and target year
- Preset shortcuts: Paris target, India average, "cut in half"
- Visual progress bar showing current vs target
- Persisted across sessions via localStorage

---

## 🛡️ Security

| Threat | Mitigation |
|---|---|
| XSS via user input | `sanitize()` strips all HTML tags before any DOM insertion |
| Injection in enum fields | Allowlist validation — unknown values rejected by default |
| Numeric overflow / DoS | `clamp()` enforces strict min/max on all numeric inputs |
| Prototype pollution | `Array.isArray()` + `typeof` guards before property access |
| API key exposure | Never hardcoded — injected by the Anthropic platform |
| Data privacy | No PII collected; only anonymised numeric footprint data stored locally |
| Data erasure | `clearAllData()` in `userProfile.js` for full GDPR-style erasure |

---

## ✅ Testing

**168 unit tests, 100% passing** across 18 test groups:

| Test Group | Tests | What's Covered |
|---|---|---|
| Emission Factors | 10 | Data integrity, ordering, boundary values |
| validatePositiveNumber | 16 | All edge cases including null, Infinity, NaN |
| validateTransportMode | 18 | All 11 modes, case-insensitivity, rejections |
| validateDietType | 9 | All 5 types + rejections |
| validateCategory | 7 | All 5 categories + rejections |
| sanitizeString | 10 | XSS variants, length, non-string inputs |
| validateTransportEntry | 10 | Full object validation |
| validateEnergyEntry | 6 | Valid + invalid combinations |
| validateWasteEntry | 7 | Range checks, boolean coercion |
| Transport Calculator | 12 | Formula correctness, ordering, linearity |
| Total Transport | 6 | Array handling, summation, stress test |
| Food Calculator | 7 | Diet ordering, all valid diets, errors |
| Energy Calculator | 8 | Formula verification, breakdown, linearity |
| Shopping Calculator | 8 | Per-item factors, totals, breakdown |
| Waste Calculator | 6 | Recycling/composting impact, breakdown |
| Total Footprint | 6 | All 5 categories, summation, graceful nulls |
| Tips Engine | 11 | Personalisation, dedup, filtering, edge cases |
| Security & Edge Cases | 11 | XSS, SQL injection, prototype pollution, stress |

```bash
node tests/index.test.js
# ═══════════════════════════════════════════════════════
#   Results: 168 passed, 0 failed out of 168 tests
# ═══════════════════════════════════════════════════════
```

---

## ♿ Accessibility (WCAG 2.1 AA)

| Criterion | Implementation |
|---|---|
| Skip link | `#skip-link` focuses `#main-content` on keyboard activation |
| Semantic HTML | `<nav>`, `<main>`, `<section>`, `<article>`, `<h1>–<h3>` hierarchy |
| ARIA tab pattern | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls` |
| Live regions | Chat: `role="log" aria-live="polite"`; errors: `role="alert"` |
| Form labels | Every `<input>` and `<select>` has explicit `<label for="">` |
| Focus indicators | `:focus-visible` — 3px green outline, 2px offset, on all interactive elements |
| Colour contrast | All text/background pairs ≥ 4.5:1 (WCAG AA) |
| Keyboard navigation | All controls reachable and operable without mouse |
| Screen reader support | `aria-label` on icon-only controls; `aria-hidden` on decorative elements |
| Progress bars | `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |
| Dark mode | Full `@media (prefers-color-scheme: dark)` theme |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` disables animations |
| Mobile | Responsive from 320px; fixed bottom navigation with safe-area insets |
| Error identification | `aria-invalid="true"` on invalid inputs; errors announced via `role="alert"` |

---

## ⚡ Efficiency

- **Zero production dependencies** — single `index.html` file, one HTTP request
- **Pure function calculator** — O(n) transport, O(1) all other categories
- **Minimal DOM writes** — full re-renders only on explicit user action
- **Capped AI context** — last 10 conversation turns to control token usage
- **localStorage batching** — full state serialised in one key per write
- **History trimming** — auto-limits to 90 entries to prevent storage bloat
- **Input clamping** — prevents runaway computation from extreme values

---

## 📊 Feature Summary

| Feature | Details |
|---|---|
| Transport tracker | 11 modes incl. auto rickshaw, EV, domestic/international flight |
| Diet calculator | 5 diet types with IPCC-sourced annual benchmarks |
| Energy calculator | Monthly electricity + LPG with India grid factor |
| Shopping calculator | Clothing, smartphones, laptops, TVs, online deliveries |
| Waste calculator | Weekly waste, recycling %, composting toggle |
| Dashboard | Metrics, category chart, India avg / Paris target comparison, history |
| Goals | Custom target + year, presets, progress bar, persisted |
| Tips | 20 tips across 5 categories, personalised ranking, filterable |
| AI Guide | Claude Sonnet 4.6 with footprint + goals context |
| Dark mode | System-preference based |
| Mobile nav | Bottom bar with safe-area insets |
| Persistence | localStorage, 90-day history, GDPR erasure |

---

## 🌍 Assumptions

1. **India grid factor** — 0.716 kg CO₂e/kWh (CEA 2023–24)
2. **Individual accounting** — carpooling / shared housing not modelled
3. **Diet as proxy** — diet type used as annual food footprint proxy (practical for everyday use)
4. **Monthly energy averages** — seasonal variation is smoothed
5. **Domestic flights use km** — users input distance, not route codes
6. **No offset accounting** — focus is on actual emission reduction

---

## 📚 Data Sources

- EPA Emission Factors for Greenhouse Gas Inventories (2024)
- IPCC Sixth Assessment Report (AR6), 2022 — food systems
- Central Electricity Authority, India — CO₂ baseline emission factor 2023–24
- Our World in Data — "Environmental impacts of food production"
- Mike Berners-Lee, *How Bad Are Bananas?* — consumer product lifecycle data

---

## 📄 License

MIT — see [LICENSE](LICENSE)
