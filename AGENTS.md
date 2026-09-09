# AGENTS.md

注意：使用中文进行思考和回复交流

## Project Overview

TixXinBlog is a personal blog system in **UI polishing and incremental API integration**. Article lists, details, and comments support the NestJS API via `public.postUseMockRepo`; other domains retain their existing data sources. Tab bookmarks explicitly use LocalStorage until their API is implemented. Mock data lives in `features/<domain>/mock.ts` with types in `features/<domain>/types.ts`. Components receive data via props only (component-data decoupled).

## Commands

```bash
pnpm dev              # Dev server at localhost:3456
pnpm dev:api          # NestJS API at localhost:3000（独立终端）
pnpm dev:check        # 配置、数据库、服务归属与就绪自检
pnpm dev:all          # 完整开发链路启动；复用当前项目已有服务
pnpm test:dev         # 跨平台进程生命周期回归
pnpm test:dev:integration # 隔离 Nuxt/Nest 冷启动与复用验收
pnpm build            # Production build
pnpm preview          # Preview production build
pnpm generate         # Static site generation
pnpm lint             # ESLint check
pnpm lint:fix         # ESLint auto-fix
pnpm format           # Prettier format all src/

# Testing (runs in web-blog workspace)
pnpm --filter web-blog test        # Run tests once
pnpm --filter web-blog test:watch  # Watch mode
```

Package manager: **pnpm 9.15.0** (enforced). Node >= 24 < 25；推荐通过 `corepack pnpm` 调用固定版本。

`dev` 只启动前端。真实接口模式推荐 `dev:all`，先用 `dev:check` 核对链路。统一启动不执行迁移、seed 或清空，退出仅清理本次创建的服务；已有服务保持运行。多个内容页同时出现 502 时检查后端 `/ready` 与同源 `/api/v1/posts`，不要切换 Mock 来掩盖服务故障。详见 `docs/development-runtime.md`。

## Architecture

**Monorepo** with pnpm workspaces:

- `src/frontend/web-blog/` — Nuxt 4 + Vue 3 + TypeScript blog frontend (the active project)
- `src/backend/server-main/` — NestJS + MikroORM + PostgreSQL; post, auth, comment, and flash modules

### Frontend Structure (`src/frontend/web-blog/`)

Nuxt 4 app directory layout under `app/`:

- **`pages/`** — File-system routing. Assembles components, passes data via props.
- **`components/<domain>/`** — Display-only UI components grouped by domain (article, blog, common, layout, sidebar, etc.)
- **`features/<domain>/`** — Business logic modules with `mock.ts` and `types.ts` per domain (post, stats, nav, site, about, article, gallery, guestbook, link, moment, project)
- **`composables/`** — Cross-page reusable Composition API logic
- **`layouts/`** — Page layouts
- **`assets/styles/`** — SCSS with design tokens

Other key directories:

- **`themes/`** — Three themes (nexus, aurora, dock) managed by `@tixxin/nuxt-theme-engine`
- **`theme-contracts/`** — Local theme slot contracts (RootLayout, ThemeAccessory, etc.)
- **`server/routes/`** — Nitro server routes (RSS feed)
- **`tests/`** — Vitest tests

### Theme System

Uses `@tixxin/nuxt-theme-engine` with lazy-loaded themes from `themes/` directory. Default theme: Nexus (three-column). Themes implement contracts defined in `theme-contracts/`.

## Coding Conventions

- **File headers required** on all code files (HTML comments for Vue, JSDoc for TS/SCSS)
- **Comments in Chinese**
- **Icons:** Lucide only via `<Icon name="lucide:xxx" />` — never emoji as UI elements
- **Line endings:** LF only
- **Prettier:** single quotes, no semicolons, 120 print width, trailing commas
- **ESLint:** `no-console` warns, `vue/multi-word-component-names` off
- **Page naming:** `xxx.vue` for single pages; `xxx/index.vue` only when sub-pages exist

## Git Conventions

开发（对话）过程中，按模块、按批次及时提交 Git。一组关联改动完成并通过相应验证后即提交，避免积攒为混杂的大提交。提交前检查差异与依赖，使用中文说明；提交范围遵循当前会话授权，推送和部署需要对应授权。

截图、录屏、trace、性能采样、原始测试报告和运行日志属于本地验收产物，统一写入 `.playwright-mcp/` 或 `.artifacts/`，不得复制到受 Git 跟踪的文档目录或强制添加被忽略的文件。历史 `docs/**/evidence/` 与 `docs/git-validation/` 仅保留本机副本。Git 保留测试源码、文字结论及必要的产品/文档素材（如 `docs/img/`）；报告引用本地产物时明确标注，不使用远程无法解析的图片嵌入。详情见 [验收产物管理](docs/verification-artifacts.md)。

Pre-commit hook (Husky) runs lint-staged: ESLint fix + Prettier on staged files.

Commit format: Conventional Commits with Chinese subjects.
提交正文必填：在标题后空一行，用中文解释本次变更的原因，与 commit-msg 钩子保持一致。

```
<type>(<scope>): <中文描述，不超过50字>
```

Types: feat, fix, style, refactor, chore, docs, perf, test
Scopes: web-blog, theme, sidebar, pages, blog, etc.

**禁止在 commit message 中添加 `Co-Authored-By: Codex ...` / `🤖 Generated with Codex` 之类的 AI 署名 trailer。** 仓库历史已经剥离过一次，后续保持干净：不写 trailer、不加 emoji 署名、也不在 PR body 里加「Generated with Codex」行。

## Key Config Files

- `nuxt.config.ts` — Modules: color-mode (dark default), @nuxt/icon, theme-engine, eslint, fonts (Inter), image, sitemap, robots. Same-origin API gateway, security headers and dynamic public-content routes configured.
- `vitest.config.ts` — Environment: nuxt, globals enabled
- `.cursor/rules/` — Project rules (main.mdc, frontend/nuxt4.mdc, git-commit-message.mdc)
- `docs/` — Architecture baseline (`project-architecture.md`), directory map (`directory-structure.md`), theme guide (`theme-development-guide.md`)
- `src/frontend/web-blog/todo.md` — Active task tracking

## CI Pipeline

Two workflows on push/PR to main:

- `ci.yml` (Node 24): install → secrets → lint → typecheck → unit tests → build → isolated browser E2E → production container smoke → blocking dependency audit. Skips docs-only changes.
- `backend-ci.yml` (paths: `src/backend/**`): postgres:16 service → lint → typecheck → test → migration replay + schema drift check → build → docker build.

## Docker

- Frontend: root `Dockerfile`, multi-stage Node 24-Alpine, port 3000.
- Backend: `src/backend/server-main/Dockerfile` (build context = repo root), multi-stage Node 24-Alpine, port 3000; requires `DATABASE_URL` and `JWT_ACCESS_SECRET` at runtime.
