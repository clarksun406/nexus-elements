FROM node:22-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter @nexus-elements/server...
COPY packages/contracts packages/contracts
COPY apps/server apps/server
RUN pnpm --filter @nexus-elements/contracts build && pnpm --filter @nexus-elements/server build

FROM node:22-bookworm-slim
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001
CMD ["pnpm", "--filter", "@nexus-elements/server", "start"]
