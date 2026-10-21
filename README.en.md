<div align="center">

<img src="src/frontend/web-blog/public/icon.svg" width="88" alt="TixXinBlog logo">

# TixXinBlog

**A blog system built for one author**

Public site and writing dashboard in one app · Three themes with light and dark modes · One-command install on your own server

[![CI](https://github.com/TixXin/TixXinBlog/actions/workflows/ci.yml/badge.svg)](https://github.com/TixXin/TixXinBlog/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/TixXin/TixXinBlog?color=4f46e5)](https://github.com/TixXin/TixXinBlog/releases/latest)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Nuxt](https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt&logoColor=white)](https://nuxt.com/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

[Author's blog](https://tix.xin) · [Five-minute deployment](docs/en/quick-start.md) · [Docs](docs/en/README.md) · [Changelog](CHANGELOG.md) · [中文](README.md)

</div>

<p align="center">
  <img src="docs/assets/screenshots/nexus-home.jpg" alt="Home page in the default Nexus theme, light at top left and dark at bottom right" width="100%">
</p>
<p align="center">
  <img src="docs/assets/screenshots/nexus-moments.jpg" alt="Moments page, light at top left and dark at bottom right" width="100%">
</p>
<p align="center"><sub>Home and moments pages in the default Nexus theme on a 2560×1440 screen, light at top left and dark at bottom right, using the repository's demo data (Chinese interface; English is built in)</sub></p>

## Features

| Area           | Capabilities                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Writing**    | Markdown with revision history, shareable draft previews, pre-publish checks, paste-to-upload images, section navigation for long posts                   |
| **Content**    | Posts, notes, moments, guestbook, gallery, image prompts, projects, friend links and subscription costs, with relations between items                     |
| **Reading**    | Site-wide search, tags and categories, archives, related posts, code highlighting, image lightbox, reading position memory, RSS / Atom / JSON Feed        |
| **Appearance** | Three themes (Nexus, Aurora, Dock), light and dark modes, motion presets, Chinese and English interfaces                                                  |
| **Operations** | Comment and guestbook moderation, in-app notifications and email, media library with reference lookup, runtime status page, search-engine indexing switch |
| **Data**       | Full backups from a consistent snapshot with isolated restore, content-package import across versions, audit records                                      |
| **Deployment** | One-command install, browser setup wizard, the `tixxin` management command, amd64 / arm64 images                                                          |

<details>
<summary><b>More screenshots</b></summary>
<br>
<p align="center">
  <img src="docs/assets/screenshots/nexus-article.jpg" alt="Article page, light at top left and dark at bottom right" width="74%">
  <img src="docs/assets/screenshots/nexus-mobile.jpg" alt="Home page on mobile, light at top left and dark at bottom right" width="21%">
</p>
</details>

## One-command deployment

Prepare a Linux server (amd64 or arm64), point your domain at it, open ports 80 and 443, then run:

```sh
curl -fsSL https://github.com/TixXin/TixXinBlog/releases/latest/download/install.sh -o install.sh
sudo bash install.sh
```

The script asks for the domain and site language, generates secrets, pulls the images, migrates the database and obtains an HTTPS certificate. It finishes by printing a setup link; open it in a browser to create the owner account. Day-to-day maintenance:

```sh
sudo tixxin status    # Service status, entry check and update notice
sudo tixxin backup    # Full backup (consistent database snapshot plus media)
sudo tixxin update    # Full backup first, then upgrade to the latest release
```

> [!TIP]
> No server yet? Try it on your own computer first (macOS or Linux with Docker): run `bash install.sh --local`, then visit `https://localhost:8443`.

Prerequisites, restricted networks, unattended installs and the FAQ are in the [five-minute deployment guide](docs/en/quick-start.md); to control every environment variable, see manual releases in the [deployment guide](docs/en/deployment.md). The install script's prompts and the `tixxin` output are in Chinese.

## Tech stack

| Layer      | Choice                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Frontend   | [Nuxt 4](https://nuxt.com/), Vue 3, TypeScript, `@nuxtjs/i18n`, Lucide icons                           |
| Backend    | [NestJS 11](https://nestjs.com/), [MikroORM](https://mikro-orm.io/), PostgreSQL 16                     |
| Deployment | Docker Compose, Caddy (automatic HTTPS), multi-architecture images on GHCR                             |
| Quality    | Vitest, Jest, Playwright (full Chromium and core WebKit regressions), axe accessibility checks, CodeQL |

## Local development

You need Node.js 26 (`>=26 <27`), pnpm 9.15.0 (through Corepack), PostgreSQL 16 and Docker.

```sh
git clone https://github.com/TixXin/TixXinBlog.git && cd TixXinBlog
npm install --global corepack@0.34.6
corepack pnpm install --frozen-lockfile

# First run: copy the two local config files (do not overwrite existing ones)
cp -n src/frontend/web-blog/.env.example src/frontend/web-blog/.env
cp -n src/backend/server-main/.env.example src/backend/server-main/.env.local
# Edit .env.local and fill in the signing secret and owner account (see below)

# Start the database, migrate explicitly and create the owner account
docker compose --env-file src/backend/server-main/.env.local \
  -f src/backend/server-main/docker-compose.yml up -d postgres
corepack pnpm --filter server-main migration:up
corepack pnpm --filter server-main build
corepack pnpm --filter server-main exec node dist/admin-bootstrap.js

# Start frontend and backend: site at http://localhost:3456, dashboard at /admin
corepack pnpm dev:all
```

`.env.local` needs at least:

- `JWT_ACCESS_SECRET`: a random value of 32+ characters
- `ADMIN_DEFAULT_USERNAME` / `ADMIN_DEFAULT_PASSWORD`: the owner's login name and password, with a password of at least 6 characters

Startup never migrates, seeds or clears data implicitly. Before pushing, run `corepack pnpm check:local`; it picks the lint, type checks and unit tests that match your changes. Full steps, development samples, the `dev:setup` setup sandbox and the `trial` local build trial are in [Local development and testing](docs/en/development.md).

## Documentation

| Document                                                  | Covers                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Five-minute deployment](docs/en/quick-start.md)          | One-command install, browser setup, local trial, daily management and FAQ                         |
| [Deployment and version switching](docs/en/deployment.md) | Both deployment paths, HTTPS, trusted proxies, upgrades and rollbacks, panels and reverse proxies |
| [Local development and testing](docs/en/development.md)   | Configuration, starting and reusing services, samples, setup preview and sandbox, validation      |

The full index (mostly in Chinese) is in [docs](docs/README.md); English documents are listed in [docs/en](docs/en/README.md).

## Contributing

Issues and pull requests are welcome. Development conventions, validation by change scope and PR expectations are in [CONTRIBUTING.md](CONTRIBUTING.md); please read the [Code of Conduct](CODE_OF_CONDUCT.md) first. The project is a single-author blog and does not plan to become a multi-tenant or collaborative platform.

> [!IMPORTANT]
> Report security vulnerabilities through the repository's private vulnerability reporting, not public issues; see [SECURITY.md](SECURITY.md).

## License

[GNU GPL v3](LICENSE). [LICENSE_CN](LICENSE_CN) is a Chinese translation for reference only, and the English text prevails; third-party assets follow their accompanying source and license notes.
