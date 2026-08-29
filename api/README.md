# Havenote API

NestJS backend: Cognito-authenticated REST API, Prisma/Postgres, S3 presigned uploads, and the
Step Functions trigger for the transcription → AI-note pipeline. See the [root README](../README.md)
for the full architecture.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, Cognito pool, AWS resource IDs
npx prisma migrate deploy
npm run start:dev
```

## Scripts

- `npm run start:dev` — local dev server with hot reload
- `npm run test` / `npm run test:e2e` — unit and end-to-end tests
- `npm run lint` — ESLint
- `npx prisma migrate deploy` — apply migrations in `prisma/migrations/`
