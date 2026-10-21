# 前端生产镜像：Node 26 构建，非 root 运行；API 地址由运行环境提供。
FROM node:26-alpine AS install
# 基础镜像不带 Corepack；在镜像内安装固定版本并启用 pnpm 入口。
RUN npm install --global --force corepack@0.34.6 && corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY src/frontend/web-blog/package.json ./src/frontend/web-blog/
COPY src/backend/server-main/package.json ./src/backend/server-main/
COPY src/shared/subscription-domain ./src/shared/subscription-domain/
RUN corepack pnpm install --frozen-lockfile

# ---- build ----
FROM install AS build
COPY . .
RUN corepack pnpm build

# ---- runtime ----
FROM node:26-alpine AS runtime
WORKDIR /app
COPY --from=build --chown=node:node /app/src/frontend/web-blog/.output ./.output

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
