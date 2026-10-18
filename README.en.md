# TixXinBlog

[![CI](https://github.com/TixXin/TixXinBlog/actions/workflows/ci.yml/badge.svg)](https://github.com/TixXin/TixXinBlog/actions/workflows/ci.yml)
[![Backend CI](https://github.com/TixXin/TixXinBlog/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/TixXin/TixXinBlog/actions/workflows/backend-ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D25%20%3C26-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Nuxt](https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt&logoColor=white)](https://nuxt.com/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)

[中文](README.md) | **English**

A personal blog system for a single author, bundling the public site and its authoring back office. The frontend is Nuxt 4 / Vue 3; the backend is NestJS / MikroORM / PostgreSQL.

Live instance: <https://tix.xin> (the author's own blog; its content is unrelated to the demo data in this repository).

> **Note on language.** The interface and seeded demo content are written in Chinese, and the project has no i18n layer yet. The [documentation index](docs/en/README.md), [development guide](docs/en/development.md) and [deployment guide](docs/en/deployment.md) are available in English; the other guides remain in Chinese.

## What it does

- **Writing and reading** — Markdown posts, revision history, comment moderation, archive, full-text search, RSS and sitemap.
- **Content surfaces** — flash notes, moments, guestbook, gallery, image prompts, subscription expenses, projects and links; posts, projects and gallery items can hold ordered relations to one another.
- **Authoring and operations** — section-level navigation in long posts, media descriptions with reference lookup, a draft workspace, in-app notifications and optional email delivery.
- **Appearance and upkeep** — three layout themes (Nexus, Aurora, Dock), site and about-page editing, content-package import and full backup/restore.

Posts and the other business domains are persisted through the real API. Bookmarks still live in the browser's LocalStorage; public link applications and visitor email subscriptions are not available yet. Email, scheduled backups and the long-running worker each need to be configured and enabled separately. See [content management](docs/content.md) and [operations](docs/operations.md) (both in Chinese).

## Requirements

- Node.js **25.x** (`>=25 <26`)
- pnpm **9.15.0** — the commands below pin it through Corepack
- PostgreSQL **16**
- Docker and Docker Compose, if you use the database and deployment orchestration shipped with the repository

## Running locally

Run everything from the repository root. Existing configuration, database volumes and accounts are preserved — nothing below re-initialises them.

1. **Clone and install.**

   ```sh
   git clone https://github.com/TixXin/TixXinBlog.git
   cd TixXinBlog
   npm install --global corepack@0.34.6
   corepack pnpm install --frozen-lockfile
   ```

2. **Prepare local configuration for both services.** Copy the [frontend template](src/frontend/web-blog/.env.example) to `.env` beside it, and the [backend template](src/backend/server-main/.env.example) to `.env.local` beside it. Never overwrite existing files. The values that matter:

   | Backend setting            | Requirement                                                       |
   | -------------------------- | ----------------------------------------------------------------- |
   | `DATABASE_URL`             | Points at the PostgreSQL database you intend to use               |
   | `JWT_ACCESS_SECRET`        | A random secret of at least 32 characters                         |
   | `ADMIN_DEFAULT_USERNAME`   | The login name to create for the blog owner                       |
   | `ADMIN_DEFAULT_PASSWORD`   | A random password of at least 12 characters — not the placeholder |
   | `NODE_ENV` / `CORS_ORIGIN` | `development` / `http://localhost:3456`                           |

   On the frontend keep `NUXT_PUBLIC_API_BASE_URL=/api/v1` and point `NUXT_API_BASE_URL` at your local API (the template uses `http://127.0.0.1:3457/api/v1`). Both mock switches stay `false`. Keep secrets in local configuration or a managed environment — never commit them.

3. **Start PostgreSQL.** An existing PostgreSQL 16 works as-is; the repository's local setup only needs the `postgres` service:

   ```sh
   docker compose --env-file src/backend/server-main/.env.local -f src/backend/server-main/docker-compose.yml up -d postgres
   docker compose --env-file src/backend/server-main/.env.local -f src/backend/server-main/docker-compose.yml ps postgres
   ```

   Wait for it to report healthy. The user, password and database in that local setup match the backend template's default `DATABASE_URL`; keep the two in sync if you switch instances. On a port clash, change `POSTGRES_PORT` and `DATABASE_URL` together.

4. **Apply migrations explicitly and verify the schema.**

   ```sh
   corepack pnpm --filter server-main migration:up
   corepack pnpm --filter server-main migration:check
   ```

5. **Create the administrator.**

   ```sh
   corepack pnpm --filter server-main build
   corepack pnpm --filter server-main exec node dist/admin-bootstrap.js
   ```

   This reads the account settings from step 2. It inserts no posts and no demo data, and refuses to overwrite an account that already exists — skip it if you have one.

6. **Start both services.**

   ```sh
   corepack pnpm dev:all
   ```

   This starts or reuses the project's services. It never migrates, seeds or resets the database implicitly. Run `corepack pnpm dev:check` in another terminal to verify the chain.

7. **Start using it.** Open the [site](http://localhost:3456) and the [back office](http://localhost:3456/admin), sign in with the account you created, fill in your own details under site settings, then create content. A fresh database has no public posts; preparing demo data is an explicit step described in the [development guide](docs/en/development.md).

## Routes worth knowing

| Purpose                             | Path                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| Posts, archive, cross-domain search | `/`, `/archive`, `/search`                                                             |
| Subscription expenses               | `/subscriptions`; admin at `/admin/subscriptions`; visitor records stay in the browser |
| Image prompts                       | `/prompts`; the owner can add, edit and manage drafts in place                         |
| About, projects, gallery            | `/about`, `/projects`, `/gallery`                                                      |
| Flash notes, moments, guestbook     | `/flash`, `/moments`, `/guestbook`                                                     |
| Authoring and profile upkeep        | `/admin`, `/admin/site`, `/admin/media`                                                |
| Notifications and backups           | `/admin/notifications`, `/admin/operations`, `/admin/maintenance`                      |

## Repository layout

```text
src/frontend/web-blog/   Site, admin interface and frontend tests
src/backend/server-main/ API, migrations, demo data and backend tests
docs/                    Current usage, architecture and maintenance guides
scripts/                 Development startup, checks and release tooling
deploy/                  Production and HTTPS configuration templates
patches/                 Patches required to pin dependency behaviour
.github/workflows/       Continuous integration and releases
```

Shared formatting, commit hooks and dependency configuration live at the root; personal editor settings and build artefacts stay out of version control. Module responsibilities are described in the [architecture guide](docs/architecture.md).

## Building, deploying and contributing

```sh
corepack pnpm build
corepack pnpm --filter server-main build
```

The root `build` builds the frontend; the backend builds separately. Every root script is described in the [scripts reference](docs/scripts.md). Production orchestration uses `compose.production.yaml` and the templates under `deploy/`. Before deploying, set your real domain, pin image versions, provide secrets and persistent storage, and run migrations first. Pushing a `v*` tag runs the Release workflow, which publishes multi-arch `web`, `api`, `migration` and `worker` images to GHCR and creates a GitHub Release; you can also build the images yourself on the target host. Both paths, Linux and PowerShell commands, and a local production-style preview are covered in the [deployment guide](docs/en/deployment.md). See [backup and recovery](docs/backup-and-recovery.md) (in Chinese) for data recovery procedures.

Development setup, module boundaries, testing and PR expectations are in [CONTRIBUTING.md](CONTRIBUTING.md). The [documentation index](docs/en/README.md) covers development, architecture, API, content and themes, with links to the English guides and the remaining Chinese references. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before taking part. Release notes live in [CHANGELOG.md](CHANGELOG.md).

Contributions are welcome in English — issues and pull requests do not have to be written in Chinese.

## Security

Report vulnerabilities through the repository's private vulnerability reporting channel rather than a public issue. See [SECURITY.md](SECURITY.md).

## License

Licensed under the [GNU GPL v3](LICENSE). [LICENSE_CN](LICENSE_CN) is a Chinese translation of the same license provided for convenience only; the English original governs in case of any discrepancy. Third-party assets follow the licenses stated alongside them.
