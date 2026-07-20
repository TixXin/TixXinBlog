# server-main 生产镜像(多阶段)。构建上下文为仓库根目录:
#   docker build -f src/backend/server-main/Dockerfile -t tixxin-blog-server .
FROM node:22-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# 先复制清单文件,让依赖安装层可被缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY src/backend/server-main/package.json src/backend/server-main/
# --ignore-scripts:根 prepare(husky)在过滤安装下不可用;argon2 等原生依赖均带预编译产物
RUN pnpm install --frozen-lockfile --filter server-main --ignore-scripts

COPY src/backend/server-main src/backend/server-main
RUN pnpm --filter server-main build \
  && pnpm --filter server-main --prod deploy /out

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=build /out .
EXPOSE 3000
# 迁移在发布前由独立任务执行(development.md §11.2),运行时只启动 HTTP 服务
CMD ["node", "dist/main.js"]
