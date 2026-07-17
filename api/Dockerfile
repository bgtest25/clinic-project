# Build context is the repo root (npm workspaces need the root package.json/lockfile).
FROM node:20-bookworm-slim AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY api/package.json ./api/package.json
RUN npm ci

COPY api ./api
RUN npx prisma generate --schema=api/prisma/schema.prisma
RUN npm run build --workspace=api

FROM node:20-bookworm-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/api/dist ./api/dist
COPY --from=build /repo/api/prisma ./api/prisma
COPY --from=build /repo/api/prisma.config.ts ./api/prisma.config.ts
COPY --from=build /repo/api/package.json ./api/package.json

EXPOSE 3000
CMD ["node", "api/dist/src/main.js"]
