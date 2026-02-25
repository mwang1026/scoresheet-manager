# Testing Guide

## Frameworks

| Layer | Framework | Runner |
|-------|-----------|--------|
| Frontend unit/component | Vitest + React Testing Library | `npm test` |
| Backend API/integration | pytest + httpx | `pytest` |

## File Conventions

- **Frontend:** `*.test.ts(x)` colocated next to source file
- **Backend:** `test_*.py` in `tests/` directory

## Test Layers

### Unit Tests (Frontend)
- Test all exported utility functions (e.g., `cn()`, stat calculators)
- Test React components: render, variants, interaction, disabled states
- Keep tests focused — one behavior per test

### Integration Tests — Frontend API Calls
- Mock the fetch layer (not the SWR hook internals)
- Test loading, error, and success states
- Verify correct request URLs and parameters

### Integration Tests — External Services
- Mock at the HTTP/network layer (e.g., `respx`, `httpx.MockTransport`), not above parsing logic
- Fixtures must be derived from real service responses — never hand-write HTML/JSON to match current parser code
- Test response parsing, data transformation, and error handling
- Never hit real external APIs in tests
- When a parser changes, verify fixtures still represent real upstream data — not just that tests pass

### Integration Tests — Internal API Endpoints (Backend)
- Use pytest + httpx `AsyncClient` against the FastAPI app
- Seed test database with fixtures before each test
- Test full request → DB query → response cycle
- Verify status codes, response shapes, and edge cases

## Scripts

```bash
# Frontend (run from /frontend)
npm test              # Run all tests once
npm run test:watch    # Watch mode during development
npm run test:coverage # Run with coverage report

# Backend (run from /backend, with venv activated)
python -m pytest tests/ -v                        # Run all tests
python -m pytest tests/api/test_teams.py -v       # Run one file
python -m pytest tests/ --cov=app --cov-report=term-missing  # With coverage
```

## Rules

1. All exported functions must have tests
2. All API endpoints must have integration tests
3. Mock external services — never hit real APIs
4. Run `npm test` (frontend) and `python -m pytest tests/ -v` (backend) before considering work complete
5. Test files live next to their source, not in a separate `__tests__/` tree
