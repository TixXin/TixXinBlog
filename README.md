# TixXinBlog

个人博客系统。前台基于 Nuxt 4 + Vue 3，文章、评论、认证、闪念、朋友圈、留言、媒体及站点配置已接入真实 API；书签使用本机存储，项目、图库和友链保留演示数据。逐项边界见[能力清单](docs/capability-map.md)。

<p align="center">
  <img alt="Nuxt 4" src="https://img.shields.io/badge/Nuxt_4-00DC82?style=for-the-badge&logo=nuxt&logoColor=white" />
  <img alt="Vue 3" src="https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="SCSS" src="https://img.shields.io/badge/SCSS-CC6699?style=for-the-badge&logo=sass&logoColor=white" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white" />
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" />
  <img alt="ESLint" src="https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white" />
  <img alt="Prettier" src="https://img.shields.io/badge/Prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=black" />
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square" />
  <img alt="Node" src="https://img.shields.io/badge/Node-24-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-9.15.0-F69220?style=flat-square&logo=pnpm&logoColor=white" />
  <a href="https://tix.xin"><img alt="在线预览" src="https://img.shields.io/badge/在线预览-tix.xin-brightgreen?style=flat-square" /></a>
</p>

![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/01.png?raw=true)
![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/02.png?raw=true)
![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/03.png?raw=true)
![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/04.png?raw=true)
![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/05.png?raw=true)

**在线预览**：[https://tix.xin](https://tix.xin)

## 技术栈

- **前端**：Nuxt 4、Vue 3、TypeScript、SCSS
- **图标**：@nuxt/icon + Lucide
- **主题引擎**：@tixxin/nuxt-theme-engine
- **色彩模式**：@nuxtjs/color-mode
- **字体**：@nuxt/fonts (Inter)
- **图片**：@nuxt/image
- **SEO**：@nuxtjs/sitemap、@nuxtjs/robots、JSON-LD
- **代码规范**：@nuxt/eslint、Prettier、Husky + lint-staged
- **测试**：Vitest + @nuxt/test-utils
- **CI/CD**：GitHub Actions

## 环境要求

- Node.js >= 24 < 25
- pnpm 9.15.0（推荐 `corepack pnpm`）

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/TixXin/TixXinBlog.git
cd TixXinBlog

# 安装依赖
corepack pnpm install

# 数据库、迁移和环境变量准备好后，统一启动或复用服务
corepack pnpm dev:all
```

首次启动前按 [后端说明](src/backend/server-main/README.md) 准备数据库、配置并执行迁移，前端环境模板见 `src/frontend/web-blog/.env.example`。`dev:all` 负责启动或复用前后端；访问 http://localhost:3456 查看本地效果。生产式编排与管理员初始化见 [部署验收说明](docs/local-production-validation.md)。

`dev:check` 检查当前链路，`dev:all` 统一启动；`dev` / `dev:blog` 仅启动前端，`dev:api` 仅启动后端。配置、进程归属和清理规则见[开发启动说明](docs/development-runtime.md)。多个栏目同时加载失败时，也可按[服务恢复记录](docs/service-recovery.md)检查后端就绪与前端同源接口。

## 构建与部署

```bash
# 生产构建
pnpm build

# 本地预览生产构建
pnpm --filter web-blog preview

# Docker 构建
docker build -t tixxin-blog .
docker run -p 3000:3000 tixxin-blog
```

## 环境变量

开发环境分服务配置：前端参考 [前端模板](src/frontend/web-blog/.env.example)，配置放在该目录 `.env`；后端参考 [后端模板](src/backend/server-main/.env.example)，配置放在该目录 `.env.local`。已有文件保留并按需补充；环境优先级见[开发启动说明](docs/development-runtime.md)。根目录 `.env.example` 不是统一开发链路的配置来源。

朋友圈阅读入口为 `/moments`，登录后通过 `/admin/moments` 发布、编辑、置顶和管理评论。真实模式不会回退演示数据，使用方式与输入恢复见[朋友圈业务说明](docs/moment-business.md)。`corepack pnpm db:dev status` 可检查数据库，显式开发样本和清空工具见[开发数据库说明](docs/development-database.md)。

留言入口为 `/guestbook`，博主通过 `/admin/guestbook` 回复、审核、置顶和管理内容。日常开发数据检查使用 `corepack pnpm db:dev check-data`，增量补齐预览使用 `corepack pnpm db:dev seed-data --dataset all`；核对目标后加上 `--apply --confirm 数据库名` 执行。新功能必须同批交付日常样本与隔离测试，具体归属、数量及安全清理见[开发数据目录](docs/development-data-catalog.md)。

## 代码规范

```bash
# ESLint 检查
pnpm lint

# ESLint 自动修复
pnpm lint:fix

# Prettier 格式化
pnpm format
```

提交代码时 Husky + lint-staged 会自动运行检查。

## 测试

```bash
pnpm --filter web-blog test
```

## 项目结构

```
src/
├── frontend/web-blog/    # 博客前台
└── backend/server-main/  # NestJS API、数据库迁移和维护工具
docs/                     # 架构与目录说明
```

详见 [project-architecture.md](docs/project-architecture.md) 与 [directory-structure.md](docs/directory-structure.md)。

## 开源协议

本项目采用 [GPL-3.0](LICENSE) 协议。

### 第三方许可

本项目使用的 [@tixxin/nuxt-theme-engine](https://github.com/TixXin/nuxt-theme-engine) 主题引擎采用 [MIT License](https://github.com/TixXin/nuxt-theme-engine/LICENSE) 许可。
