# 🌿 EcoTrack — Carbon Footprint Awareness Platform

> A smart, personalised carbon footprint tracker powered by AI — helping individuals **understand**, **track**, and **reduce** their environmental impact through simple actions and data-driven insights.

---

## 🎯 Problem Statement Alignment

| Challenge Requirement | EcoTrack Implementation |
|---|---|
| Help individuals **understand** their footprint | Dashboard with category breakdown, benchmark comparisons (India avg / Paris target), and progress history |
| **Track** carbon footprint | Multi-category tracker: transport (11 modes), diet (5 types), energy, shopping, and waste/recycling |
| **Reduce** through simple actions | 20 curated tips ranked by personal impact, filterable by category |
| **Personalised insights** | EcoGuide AI (Claude Sonnet 4.6) with footprint context, goal data, and suggested prompts |

---

## 🚀 Quick Start

```bash
# Open directly in browser — zero install needed
open src/index.html

# Run the full test suite (229 tests)
npm test

# Serve locally
npx serve src -p 3000
```

---

## 🏗️ Architecture

```
carbon-footprint-platform/
├── src/
│   ├── index.html              # Markup + styles only (no inline logic)
│   ├── app.js                  # Browser runtime — UI, state, rendering, AI chat
│   ├── components/
│   │   └── assistant.js        # AI chat component (reusable Node.js module)
│   ├── data/
│   │   ├── emissionFactors.js  # Canonical emission factors (EPA/IPCC/CEA)
│   │   └── tips.js             # 20 curated reduction tips
│   └── utils/
│       ├── calculator.js       # Framework-agnostic calculation API
│       ├── validation.js       # Input validation & XSS sanitization
│       └── userProfile.js      # Data persistence & profile management
├── tests/
│   ├── run-all.js              # Unified test runner
│   ├── index.test.js           # Tests for utils/ + data/ (168 tests)
│   ├── app.test.js             # Tests for app.js (61 tests)
│   └── dom-stub.js             # Lightweight DOM stub (no jsdom dependency)
├── docs/
│   └── ARCHITECTURE.md         # Full technical documentation
├── .editorconfig                # Enforces consistent indentation/encoding
├── .eslintrc.json               # Google-style lint rules
├── .gitignore
├── CONTRIBUTING.md               # Coding standards & PR process
├── LICENSE
└── README.md                    ← You are here
```

**Why `index.html` + `app.js` are separate files:** Google's JavaScript Style
Guide and most MNC engineering standards require markup and logic to be
decoupled — inline `<script>` blocks over ~50 lines are considered a code
smell because they can't be linted, unit tested in isolation, or cached
separately by the browser. `app.js` is a single 1,300-line file organised
into clearly labelled sections (CONFIG → STATE → STORAGE → CALC → RENDER →
CHAT → NAV → INIT), each with one responsibility.

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

All calculations use **pure, named functions** (no magic numbers) with
emission factors sourced from:
- **EPA** Emission Factors for GHG Inventories (2024) — transport
- **IPCC AR6** (2022) — food lifecycle assessments
- **CEA India Grid** (2023–24) — electricity: 0.716 kg CO₂e/kWh
- **Our World in Data** — diet type annual benchmarks

**Five tracked categories:**

| Category | Inputs | Method |
|---|---|---|
| Transport | Mode, distance (km), frequency (days/week) | `factor × km × trips/wk × WEEKS_PER_YEAR` |
| Food | Diet type (5 options) | Annual benchmark by diet pattern |
| Energy | Monthly electricity (kWh), LPG (kg) | `monthly × MONTHS_PER_YEAR × emission_factor` |
| Shopping | Clothing, electronics, deliveries | Per-item lifecycle factors |
| Waste | Weekly waste (kg), recycling %, composting | Landfill emissions minus recycling/compost savings |

A dedicated **cross-module consistency test suite** (`tests/app.test.js`)
verifies the browser runtime (`app.js`) and the Node calculation API
(`utils/calculator.js`) always use numerically identical emission factors —
preventing silent drift between the two implementations.

### Personalised Tip Ranking
1. Categories sorted by share of user's total footprint (highest first)
2. Top-impact tips surfaced from the highest-emission category
3. No tip shown twice (Set-based deduplication by ID)
4. 20 tips across all 5 categories, each with difficulty and estimated annual saving

### AI Assistant (EcoGuide)
- **Model**: Claude Sonnet 4.6 via Anthropic API
- **Context**: Full footprint breakdown + diet type + goals injected into every system prompt
- **Conversation memory**: Last 10 turns maintained per session
- **Guardrails**: input sanitization, 1000-char limit, disabled send during request, full try/catch error boundary with user-visible recovery message

### Goals Feature
- User sets a custom reduction target (kg CO₂e/year) and target year
- Preset shortcuts: Paris target, India average, "cut in half"
- Visual progress bar showing current vs target
- Persisted across sessions via localStorage

---

## 🏆 Code Quality (MNC / Google standard)

This codebase follows the [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html) and standard MNC engineering practices:

| Practice | Where |
|---|---|
| **Single Responsibility Principle** | Every function does one thing — e.g. `renderMetricCards`, `renderComparisonSection`, and `renderCategoryChart` are three separate functions, not one giant `renderDashboard` |
| **No magic numbers** | All constants named and grouped in a `CONFIG` section (`WEEKS_PER_YEAR`, `MONTHS_PER_YEAR`, `ORGANIC_WASTE_FRACTION`, `CHAT_MAX_CHARS`, etc.) |
| **Full JSDoc coverage** | Every exported function has `@param`, `@returns`, and `@typedef` annotations; complex objects (`FootprintResult`, `TransportEntry`, `Goal`) are typed |
| **Dependency injection** | Calculation functions (`calcFoodKg`, `calcEnergyKg`, etc.) accept an optional `doc` parameter, decoupling them from the global `document` for unit testing |
| **Immutable configuration** | All config objects use `Object.freeze()` — `EMISSION_FACTORS`, `BENCHMARKS`, `TIPS`, `CATEGORY_META` cannot be mutated at runtime |
| **No `innerHTML` with raw user input** | Chat messages render via `textContent`; tip cards run all dynamic text through `sanitizeText()` |
| **Consistent naming** | `camelCase` functions/variables, `UPPER_SNAKE_CASE` constants, full descriptive names (`calcTransportKg` not `calcTE`) |
| **Separation of concerns** | CONFIG / STATE / STORAGE / CALC / RENDER / CHAT / NAV / INIT are distinct sections, each independently testable |
| **Linting** | `.eslintrc.json` enforces `eqeqeq`, `no-var`, `prefer-const`, `no-eval`, `max-lines-per-function` |
| **Consistent formatting** | `.editorconfig` enforces 2-space indent, LF line endings, UTF-8 across all editors |
| **Documented contribution process** | `CONTRIBUTING.md` defines commit conventions, PR checklist, and code review expectations |

---

## 🛡️ Security

| Threat | Mitigation |
|---|---|
| XSS via user input | `sanitizeText()` strips all HTML tags before any DOM insertion; chat bubbles use `textContent`, never `innerHTML` |
| Injection in enum fields | Allowlist validation — unknown values rejected by default |
| Numeric overflow / DoS | `clamp()` enforces strict min/max on all numeric inputs; non-finite values (`Infinity`, `NaN`) fall back to a safe minimum by design |
| Prototype pollution | `Array.isArray()` + `typeof` guards before property access |
| Config tampering | All emission factor / benchmark objects are `Object.freeze()`-protected |
| API key exposure | Never hardcoded — injected by the Anthropic platform |
| Data privacy | No PII collected; only anonymised numeric footprint data stored locally |
| Data erasure | `clearAllData()` in `userProfile.js` for full GDPR-style erasure |

---

## ✅ Testing

**229 unit tests, 100% passing** across two coordinated suites:

```bash
npm test
# or directly:
node tests/run-all.js
```

| Suite | File | Tests | Covers |
|---|---|---|---|
| Core utilities | `tests/index.test.js` | 168 | `utils/calculator.js`, `utils/validation.js`, `data/tips.js`, `data/emissionFactors.js` |
| App controller | `tests/app.test.js` | 61 | `src/app.js` — config, calc functions, tips engine, security edge cases, cross-module consistency |

Both suites are **dependency-free** — no jsdom, no test framework, just a
60-line in-house assertion harness and a minimal DOM stub
(`tests/dom-stub.js`). This keeps the repository well under the 10 MB limit
and CI runs in under a second.

Key testing patterns used:
- **Boundary testing**: every numeric validator tested at exactly min/max
- **Security testing**: XSS payloads, SQL-injection-style strings, prototype pollution attempts, Unicode injection
- **Stress testing**: 1,000-entry transport arrays processed without error
- **Consistency testing**: emission factors verified identical across both calculation implementations
- **Dependency injection for testability**: `calcFoodKg(doc)`, `calcEnergyKg(doc)` etc. accept an injectable `document` reference instead of always reading the implicit global

---

## ♿ Accessibility (WCAG 2.1 AA)

| Criterion | Implementation |
|---|---|
| Skip link | `#skip-link` focuses `#main-content` on keyboard activation |
| Semantic HTML | `<nav>`, `<main>`, `<section>`, `<article>`, `<h1>–<h3>` hierarchy |
| ARIA tab pattern | `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls` |
| Live regions | Chat: `role="log" aria-live="polite"`; errors: `role="alert"` |
| Form labels | Every `<input>` and `<select>` has explicit `<label for="">` |
| Focus indicators | `:focus-visible` — 3px green outline, 2px offset |
| Colour contrast | All text/background pairs ≥ 4.5:1 (WCAG AA) |
| Keyboard navigation | All controls reachable and operable without mouse |
| Dark mode | Full `@media (prefers-color-scheme: dark)` theme |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` disables animations |
| Mobile | Responsive from 320px; fixed bottom navigation with safe-area insets |

---

## ⚡ Efficiency

- **Zero production dependencies** — `index.html` + `app.js`, two HTTP requests total
- **Pure function calculator** — O(n) transport, O(1) all other categories
- **Capped AI context** — last 10 conversation turns to control token usage
- **localStorage batching** — full state serialised in one key per write
- **History trimming** — auto-limits to 90 entries to prevent storage bloat
- **Input clamping** — prevents runaway computation from extreme values

---

## 🌍 Assumptions

1. **India grid factor** — 0.716 kg CO₂e/kWh (CEA 2023–24)
2. **Individual accounting** — carpooling / shared housing not modelled
3. **Diet as proxy** — diet type used as annual food footprint proxy (practical for everyday use)
4. **Monthly energy averages** — seasonal variation is smoothed
5. **No offset accounting** — focus is on actual emission reduction

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
