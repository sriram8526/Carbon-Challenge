# Contributing to EcoTrack

Thank you for your interest in contributing! This document explains our development process and coding standards.

## Code of Conduct

Be respectful, inclusive, and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

## Development Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/ecotrack.git
cd ecotrack

# Run tests
node tests/index.test.js

# Serve locally
npx serve src -p 3000
```

## Code Standards (MNC-level)

We follow Google JavaScript Style Guide principles:

### Structure
- **Single Responsibility**: Each function does exactly one thing
- **Max function length**: 40 lines (excluding comments)
- **Pure functions**: Calculation functions have no side effects
- **Separation of concerns**: DOM logic, calculation logic, and data are in separate layers

### Naming Conventions
- `camelCase` for variables and functions
- `UPPER_SNAKE_CASE` for constants and config
- `PascalCase` for types/classes (if added)
- Descriptive names: `calculateTransportEmissions` not `calcTE`

### Documentation
- Every exported function has JSDoc (`@param`, `@returns`, `@example`)
- Every module has a `@fileoverview` block
- Inline comments explain *why*, not *what*

### Error Handling
- Never swallow errors silently; always log with `console.error`
- Validation functions return `{ valid, errors[] }` — never throw
- All async functions have `try/catch` with user-visible error messages

### Security
- Never use `innerHTML` with user-provided content — use `textContent` or `sanitize()`
- All enum inputs validated against allowlists (deny-by-default)
- No `eval()`, `new Function()`, or dynamic code execution
- No API keys in source code

### Testing
- Every new function needs at least 3 tests: happy path, edge case, error case
- Test names are full English sentences describing the behaviour
- Tests live in `tests/index.test.js`, grouped by module

## Pull Request Process

1. Branch from `main`: `git checkout -b feat/your-feature`
2. Run tests: `node tests/index.test.js` — must be 100% passing
3. Update README if you add features
4. Write a clear commit message following [Conventional Commits](https://www.conventionalcommits.org/)
5. Open a PR with a description of *what* and *why*

## Commit Message Format

```
type(scope): short description

Longer explanation if needed.
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(calculator): add waste/recycling category
fix(validation): reject null in validatePositiveNumber
docs(readme): update test count to 168
test(waste): add recycling percentage boundary tests
```
