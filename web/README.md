# Havenote Web

React/Vite frontend: visit recording, transcript + editable SOAP note review, sign-off, and PDF
export. See the [root README](../README.md) for the full architecture.

## Setup

```bash
npm install
cp .env.example .env   # fill in VITE_API_URL and VITE_COGNITO_* values
npm run dev
```

## Scripts

- `npm run dev` — local dev server
- `npm run build` — type-checks and builds for production (runs `scripts/assert-env.mjs` first)
- `npm run test` — Vitest unit tests
- `npm run lint` — Oxlint
