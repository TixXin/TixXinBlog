# ---- install ----
FROM node:20-alpine AS install
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY src/frontend/web-blog/package.json ./src/frontend/web-blog/
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM install AS build
COPY . .
RUN pnpm build

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/src/frontend/web-blog/.output ./.output

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
