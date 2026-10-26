# Multi-stage Dockerfile for NestJS API
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile || pnpm install

FROM dependencies AS build
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY tsconfig.json ./
RUN pnpm --filter @examvault/shared run build || true
RUN pnpm --filter @examvault/api run db:generate
RUN pnpm --filter @examvault/api run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY package.json pnpm-workspace.yaml ./

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
