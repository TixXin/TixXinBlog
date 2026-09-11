# server-main 生产镜像(多阶段)。构建上下文为仓库根目录:
#   docker build -f src/backend/server-main/Dockerfile -t tixxin-blog-server .
FROM node:24-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# 先复制清单文件,让依赖安装层可被缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY src/backend/server-main/package.json src/backend/server-main/
# --ignore-scripts:根 prepare(husky)在过滤安装下不可用;argon2 等原生依赖均带预编译产物
RUN corepack pnpm install --frozen-lockfile --filter server-main --ignore-scripts

COPY src/backend/server-main src/backend/server-main
RUN corepack pnpm --filter server-main build \
  && corepack pnpm --filter server-main --prod deploy /out

FROM build AS migration
WORKDIR /repo/src/backend/server-main
ENV NODE_ENV=production
CMD ["corepack", "pnpm", "migration:up"]

# 独立运行任务镜像：原生 PG16 客户端与脚本随镜像交付，不依赖宿主 Docker socket。
FROM node:24-alpine AS worker
ENV NODE_ENV=production \
    BACKUP_EXECUTION_MODE=native \
    MEDIA_DIRECTORY=/app/var/media \
    BACKUP_DIRECTORY=/app/var/backups
WORKDIR /app
RUN apk add --no-cache postgresql16-client \
  && npm install --global pnpm@9.15.0 \
  && test "$(pnpm --version)" = '9.15.0' \
  && pg_dump --version
COPY --from=build --chown=node:node /out .
COPY --from=build --chown=node:node /repo/src/backend/server-main/scripts ./scripts
RUN mkdir -p /app/var/media /app/var/backups && chown -R node:node /app/var
USER node
# 直接运行镜像只读状态；只有显式 profile、配置及 loop --apply 才启用持续执行。
CMD ["node", "scripts/operations.mjs", "status"]

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /out .
RUN mkdir -p /app/var/media && chown -R node:node /app/var
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# 迁移在发布前由独立任务执行(development.md §11.2),运行时只启动 HTTP 服务
CMD ["node", "dist/main.js"]
