# End-to-End (E2E) Test Infrastructure Documentation

## 1. Test Philosophy
Our E2E test infrastructure is designed for reliability, completeness, and offline-friendliness. Key principles include:
- **Behavior-Driven Testing**: Testing the actual user behaviors (like document uploading, text selections, speed bump interactions, and page redirections) rather than raw API implementations.
- **Real Application Targets**: All fake mocking and page routing facades (which intercepted frontend navigation and API endpoints via Playwright page routes with hardcoded HTML/JSON) have been removed. The E2E tests now target the actual running web application (frontend on `http://localhost:5173` and backend on `http://localhost:8000`). If certain features are not yet implemented in the codebase, their respective E2E tests are expected to fail.
- **Offline Compatibility**: Playwright is configured via `conftest.py` to use the pre-installed system Google Chrome browser channel (`"chrome"`). This enables immediate testing in offline or air-gapped environments without attempting to fetch browser binaries externally.
- **Strict Isolation & State Cleanup**: Each test runs in an isolated browser context, cleaning up session storage and localStorage dynamically before each test starts.

---

## 2. Directory Layout
All E2E test files are organized under the `e2e/` directory at the project root:
```text
e2e/
├── conftest.py                # Playwright configuration and Chrome channel mapping
├── test_tier1_features.py     # Tier 1: Core Feature Coverage (Auth, Dashboard, AI Redaction, OCR, UI/UX Polish)
├── test_tier2_boundaries.py   # Tier 2: Boundary & Corner Cases (empty, large, long inputs, injection checks, styling)
├── test_tier3_combinations.py # Tier 3: Cross-Feature Pairwise Flows (unauthorized flows, OCR retry, isolation check)
└── test_tier4_scenarios.py     # Tier 4: Real-world Application Scenarios (HR resume, Legal audit, Medical scrubbing)
```

---

## 3. Feature Inventory
The suite covers the following 5 main features:
1. **Authentication (Auth)**: Login form, validation, logout, session persistence, credential bounds, XSS/SQL Injection safety.
2. **Dashboard**: Document listings, search/filter scenarios, empty lists, large document counts, review navigation.
3. **AI Redaction**: Suggested redaction rendering, manual selection and categorization, removing false positives, preview blackout toggles, overlapping/special unicode text handling.
4. **OCR Processing**: Document uploading, status transitions (Processing -> Completed), failure handling, empty file rejection, file size boundaries.
5. **UI/UX Polish**: Responsive container widths, loading spinner states, speed bump warnings (based on elapsed time and unresolved low-confidence areas), dismiss/export override actions, contrast classes.

---

## 4. Runner Commands
To execute the tests using the backend virtual environment:

### Run the entire test suite
```bash
./backend/venv/bin/pytest -v e2e/
```

### Run specific tiers
- **Tier 1 (Feature Coverage)**: `./backend/venv/bin/pytest -v e2e/test_tier1_features.py`
- **Tier 2 (Boundary & Corner Cases)**: `./backend/venv/bin/pytest -v e2e/test_tier2_boundaries.py`
- **Tier 3 (Cross-Feature Combinations)**: `./backend/venv/bin/pytest -v e2e/test_tier3_combinations.py`
- **Tier 4 (Real-world Scenarios)**: `./backend/venv/bin/pytest -v e2e/test_tier4_scenarios.py`

### Run a specific test case
```bash
./backend/venv/bin/pytest -v e2e/test_tier1_features.py -k "test_ai_redaction_add_span"
```
