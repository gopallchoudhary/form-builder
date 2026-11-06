# syntax=docker/dockerfile:1

# Build the API from the workspace root so workspace packages are available to tsup.
# The runtime image contains only the bundled API, its production dependencies, and migrations.
FROM node:22-bookworm-slim AS base
RUN npm install -g pnpm@9.0.0
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/database/package.json packages/database/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/logger/package.json packages/logger/
COPY packages/services/package.json packages/services/
COPY packages/trpc/package.json packages/trpc/
COPY packages/typescript-config/package.json packages/typescript-config/

# Install only the API and the workspace packages it depends on. This keeps node_modules
# out of the image for the web app and unrelated tooling.
RUN pnpm install --frozen-lockfile --filter @repo/api...

COPY . .
RUN pnpm --filter @repo/api build
RUN pnpm --filter @repo/api deploy --prod /out

# `dist` is gitignored, and deploy uses package packing rules, so copy it explicitly.
RUN cp -r apps/api/dist /out/dist
RUN test -f /out/dist/index.js && test -f /out/dist/migrate.js

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /out ./
COPY --from=build --chown=node:node /app/packages/database/drizzle ./migrations

USER node
EXPOSE 8000

CMD ["node", "dist/index.js"]
