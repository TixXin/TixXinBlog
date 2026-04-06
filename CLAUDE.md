# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TixXinBlog is a personal blog system currently in **UI polishing stage** — all business data uses mock, no backend API integration yet. Mock data lives in `features/<domain>/mock.ts` with types in `features/<domain>/types.ts`. Components receive data via props only (component-data decoupled).

## Commands

```bash
pnpm dev              # Dev server at localhost:3456
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

Package manager: **pnpm 9.15.0** (enforced). Node >= 20.

## Architecture

**Monorepo** with pnpm workspaces:
- `src/frontend/web-blog/` — Nuxt 4 + Vue 3 + TypeScript blog frontend (the active project)
- `src/backend/` — Planned, currently empty

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

Pre-commit hook (Husky) runs lint-staged: ESLint fix + Prettier on staged files.

Commit format: Conventional Commits with Chinese subjects.
```
<type>(<scope>): <中文描述，不超过50字>
```
Types: feat, fix, style, refactor, chore, docs, perf, test  
Scopes: web-blog, theme, sidebar, pages, blog, etc.

## Key Config Files

- `nuxt.config.ts` — Modules: color-mode (dark default), @nuxt/icon, theme-engine, eslint, fonts (Inter), image, sitemap, robots. Security headers and SSG/ISR route rules configured.
- `vitest.config.ts` — Environment: nuxt, globals enabled
- `.cursor/rules/` — Project rules (main.mdc, frontend/nuxt4.mdc, git-commit-message.mdc)
- `docs/` — Architecture baseline (`project-architecture.md`), directory map (`directory-structure.md`), theme guide (`theme-development-guide.md`)
- `src/frontend/web-blog/todo.md` — Active task tracking

## CI Pipeline

GitHub Actions on push/PR to main: install → lint → typecheck (`nuxi typecheck`) → test → build → audit (non-blocking).

## Docker

Multi-stage build: Node 20-Alpine. Production runs on port 3000.
