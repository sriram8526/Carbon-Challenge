# EcoTrack — Technical Architecture

## System Overview

EcoTrack is a **client-side single-page application (SPA)** with optional Node.js utility modules for testing and server-side integration. The architecture prioritises:

- Zero-dependency production deployment
- Testable, modular pure functions
- Clear separation of data, logic, and presentation

## Module Dependency Graph

```
index.html (UI + App Shell)
  └─ Inline JavaScript
       ├─ emissionFactors (data constants)
       ├─ calculator (pure functions)
       ├─ validation (input guards)
       └─ tips (recommendation engine)

Node.js modules (testable independently):
src/
  ├─ data/
  │   ├─ emissionFactors.js  ← no dependencies
  │   └─ tips.js             ← no dependencies
  └─ utils/
      ├─ validation.js       ← no dependencies
      ├─ calculator.js       ← depends on: emissionFactors, validation
      ├─ userProfile.js      ← no dependencies (uses browser localStorage)
      └─ components/
          └─ assistant.js    ← depends on: fetch (browser/node-fetch)
```

## Data Flow

```
User Input
    │
    ▼
Validation Layer (validation.js)
    │  rejects malformed/malicious input
    ▼
Calculation Engine (calculator.js)
    │  computes kg CO₂e per category
    ▼
State Update (in-memory + localStorage)
    │
    ├──▶ Dashboard Render (charts, metrics, comparisons)
    ├──▶ Tips Engine (personalised ranking)
    └──▶ AI Context (injected into system prompt)

AI Assistant
    │
    ├── User message (sanitized, max 1000 chars)
    ├── System prompt (EcoGuide persona + footprint context)
    ├── Last 10 conversation turns
    └──▶ Claude Sonnet 4.6 API
              │
              ▼
         Streamed text response
              │
              ▼
         Chat UI (aria-live region)
```

## Emission Calculation Design

### Why pure functions?

All calculators are **pure functions** (no side effects, deterministic output for given input). This enables:
- Easy unit testing (64 tests, zero mocks needed)
- Safe composition and reuse
- Predictable debugging

### Why allowlist validation?

All string inputs (transport mode, diet type, category) are validated against **explicit allowlists** rather than regex blocklists. This is safer because:
- Blocklists miss edge cases; allowlists are closed by default
- New valid values must be explicitly added (principle of least privilege)
- Injection attacks fail immediately (SQL, XSS, prototype pollution)

## AI Assistant Design Decisions

### Context injection over fine-tuning
Rather than fine-tuning a model on carbon data, we inject:
1. A **persona system prompt** (EcoGuide character, tone guidelines)
2. The **user's current footprint data** (serialized to text)
3. **Conversation history** (last 10 turns)

This approach is:
- Zero-shot generalizable
- Easy to update (change data, not model)
- Transparent (users can see what data is used)

### Conversation window management
We cap history at 10 turns (~5 exchanges) to:
- Stay within token budget (1000 output tokens)
- Maintain relevance (older context often irrelevant)
- Reduce API cost

### Graceful degradation
If the API call fails (network error, rate limit), the UI:
1. Shows a human-readable error message
2. Re-enables the send button
3. Does not corrupt conversation state
4. Suggests the user try again

## Accessibility Implementation

### WCAG 2.1 AA Checklist

| Criterion | Implementation |
|---|---|
| 1.1.1 Non-text content | All icons have `aria-hidden="true"`; meaningful images have alt text |
| 1.3.1 Info and relationships | Semantic HTML: nav, main, section, article, h1-h3 |
| 1.4.3 Contrast (minimum) | All text/bg pairs ≥ 4.5:1 (verified with contrast checker) |
| 2.1.1 Keyboard | All interactives reachable and operable by keyboard |
| 2.4.7 Focus visible | `:focus-visible` outline: 3px solid green, offset: 2px |
| 3.1.1 Language of page | `<html lang="en">` |
| 3.3.1 Error identification | Form errors displayed with `role="alert"` |
| 4.1.2 Name, role, value | All form controls have labels; buttons have aria-label |

### Screen Reader Support
- Chat output area: `role="log" aria-live="polite"` for progressive announcements
- Tab panels: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`
- Progress bar: `role="progressbar"` with `aria-valuenow/min/max`
- Form groups: explicit `<label for="">` linkage on all inputs

## Security Model

### Threat Model

| Threat Actor | Attack Vector | Mitigation |
|---|---|---|
| Malicious user | XSS via input fields | HTML stripping in `sanitizeString()` |
| Malicious user | Numeric overflow | `clamp()` with explicit min/max bounds |
| Malicious user | Prototype pollution | Explicit `typeof` checks before property access |
| Third-party content | Injected HTML | CSP-compatible: no `innerHTML` with user data |
| API abuse | Message flooding | Input length cap (1000 chars), send button disabled during request |

### Data Privacy
- **No PII collected** — the app never asks for name, email, or location
- **Local storage only** — no data leaves the device except AI chat messages to the API
- **Data erasure** — `clearAllData()` completely removes all stored data
- **Minimal data** — only emission numbers stored, not raw inputs

## Performance Profile

| Metric | Value | Notes |
|---|---|---|
| First contentful paint | <100ms | Single HTML file, no network requests at load |
| Time to interactive | <200ms | No framework to hydrate |
| Bundle size | ~35 KB | Zero external JS dependencies |
| localStorage footprint | <5 KB typical | 90-day history, single state key |
| API latency | 1–3s | Claude Sonnet 4.6 typical response time |
| Test suite runtime | <50ms | 64 pure function tests, no I/O |
