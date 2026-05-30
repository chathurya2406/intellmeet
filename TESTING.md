# Testing

## Backend tests
Run all backend tests and coverage from the backend folder:

```bash
cd backend
npm install
npm test
```

## Coverage
The backend test configuration enforces 80% coverage for branches, functions, lines, and statements.

## Load testing
Use k6 for the HTTP and websocket load tests:

```bash
k6 run loadtests/http-load-test.js
k6 run loadtests/socket-load-test.js
```

## GitHub Actions
The CI workflow executes:
- backend lint
- backend unit tests
- frontend lint
- dependency audit

## Notes
Backend test files are located in `backend/tests` and use an in-memory MongoDB instance.
