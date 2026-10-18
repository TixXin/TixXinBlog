# Local Development and Testing

[中文原文](../development.md) | **English**

References without an English translation link to the Chinese guides.

Use Node.js **>=25 <26**, the pinned **pnpm 9.15.0**, and PostgreSQL 16. Run the following commands from the repository root. Using `corepack pnpm` is recommended to use the pinned version.

## Installation and Configuration

```sh
npm install --global corepack@0.34.6
corepack pnpm install --frozen-lockfile
```

For the initial configuration, create `src/frontend/web-blog/.env` using the [frontend environment template](../../src/frontend/web-blog/.env.example), and create `src/backend/server-main/.env.local` using the [backend environment template](../../src/backend/server-main/.env.example). Preserve existing configuration files; do not overwrite existing passwords, database settings, or site URLs with the templates.

| Setting                             | Purpose                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Backend `DATABASE_URL`              | PostgreSQL connection; must match the actual instance and container port mapping                     |
| Backend `JWT_ACCESS_SECRET`         | Random signing secret of at least 32 characters                                                      |
| Backend `CORS_ORIGIN`               | Development frontend origin; the default frontend URL is `http://localhost:3456`                     |
| Backend `PORT`                      | API port; defaults to 3457                                                                           |
| Frontend `NUXT_API_BASE_URL`        | Backend URL used on the server, including `/api/v1`                                                  |
| Frontend `NUXT_PUBLIC_API_BASE_URL` | Same-origin browser entry point; keep `/api/v1`                                                      |
| Frontend `NUXT_PUBLIC_SITE_URL`     | Public site origin; affects sharing, canonical URLs, and feed URLs                                   |
| Frontend `NUXT_DEVTOOLS_ENABLED`    | Nuxt DevTools is disabled by default; only `true` enables it. Restart the frontend after changing it |
| `NUXT_PORT`                         | Frontend port used by the unified launcher; defaults to 3456                                         |

Nuxt DevTools is disabled by default to prevent the debugger from traversing all page data on every state change. When debugging is needed, temporarily set `NUXT_DEVTOOLS_ENABLED=true` in the terminal used to launch the frontend, then start or restart the frontend. Closing the panel does not disable the debugger. The project's built-in DEV panel remains available. Keep DevTools disabled for performance sampling, and record development and production-build results separately.

Backend environment precedence is process environment, backend `.env.local`, then backend `.env`. The frontend follows Nuxt's process environment and frontend `.env` behavior. Keep runtime secrets out of source code, client configuration, and build images.

When a local database is needed, start only the PostgreSQL service in the development Compose configuration:

```sh
docker compose --env-file src/backend/server-main/.env.local -f src/backend/server-main/docker-compose.yml up -d postgres
corepack pnpm --filter server-main migration:list
corepack pnpm --filter server-main migration:up
corepack pnpm --filter server-main migration:check
```

Verify the connection target, port, and persistent volume before applying migrations. `migration:check` detects drift between entities and the database schema. Make database changes through formal migrations; do not edit released migrations to change an existing database.

Local ports are assigned as follows: frontend `3456`, API `3457`, and PostgreSQL `5433`, to avoid the `3000/3002/8080/8090/5432` ports commonly used by other projects. When changing the API port, update both the backend `PORT` and frontend `NUXT_API_BASE_URL`, then restart both project processes. Keep `POSTGRES_PORT` and `DATABASE_URL` pointing to the existing database; do not recreate data volumes because application ports have changed.

The production-style local preview in the root `compose.yaml` publishes `127.0.0.1:3458` by default. Override it with `WEB_PORT` and set a matching `SITE_URL` when customizing it. Inside containers, the frontend and backend each use `3000`, and the database uses `5432`. Docker networks isolate these ports, and the backend does not publish a host port, so these internal ports do not occupy host listening ports used by other projects. The production HTTPS entry point in `compose.production.yaml` continues to follow the deployment configuration.

## Starting, Reusing, and Stopping Services

```sh
corepack pnpm dev:check
corepack pnpm dev:all
```

See the [root scripts reference](../scripts.md) for the actual commands and boundaries of all root scripts.

`dev:check` performs read-only checks of configuration, dependencies, database authentication, pending migrations, and service ownership and readiness. It returns a nonzero status if a service is not running, conflicts exist, or a failure occurs. `dev:all` checks the database first, then starts or reuses this project's API and frontend. The complete request path requires real API mode.

`dev` / `dev:blog` starts only the frontend; `dev:api` starts only the backend. If a service already occupies a port, the launcher reuses it only when the ownership probe identifies it as an instance of this project. It does not terminate unknown processes. Nuxt may still be compiling after its port begins listening; wait for the business endpoints and probes to become ready. Use `TIXXIN_DEV_TIMEOUT_MS` to adjust the wait limit.

When the database port is not listening, the unified launcher can start the PostgreSQL Compose service that matches the configuration. It exits if the port is already listening but authentication fails, the database is external, or the configuration does not match. Startup does not implicitly migrate, seed, clear, or recreate the database. The API started by the unified launcher receives `RATE_LIMIT_DISABLED=true` by default: local browsers, SSR, and test tools all appear as 127.0.0.1, so IP-based rate limiting would only throttle your own requests. To verify rate limiting, explicitly set `RATE_LIMIT_DISABLED=false` in `.env.local`. Production ignores this switch.

Ctrl+C cleans up only services and descendant processes created by the current launcher; reused services keep running. PostgreSQL is a persistent dependency, so its container and data volumes are retained. To stop a reused service, exit it normally in its original terminal.

### Visible Terminals on macOS

When an agent starts long-running services, first run `corepack pnpm dev:check` and reuse services that are already ready. If startup is needed, use:

```sh
corepack pnpm dev:terminal --help
corepack pnpm dev:terminal --dry-run
corepack pnpm dev:terminal
corepack pnpm dev:terminal:api
corepack pnpm dev:terminal:web
```

The default entry point starts or reuses the backend first, waits for readiness, and then starts the frontend. Each runs in a separate Terminal.app window, titled `TixXinBlog | 后端 API` and `TixXinBlog | 前端网站`, with separate log output. By default, the two windows are stacked in a single column on the left side of the first secondary display enumerated by the system; the main display is used if there is no secondary display. The layout remains one column, with the backend above the frontend and a gap between them. Window height is reduced to fit the available screen space, avoiding the menu bar and Dock. `dev:terminal:api` / `dev:terminal:web` handles only the corresponding service; `--service=api|web` is also supported. Ready services are reused without opening duplicate windows. Startup command output for each new window is also written to `.artifacts/dev-terminal/<time>-<process>-<service>.log`, using timestamp, process, and service placeholders; the path is printed before the window opens. These logs remain available when configuration, version, or database checks fail before the managed session is created. Logs contain stdout and stderr from the current command; existing terminal contents are not read. `--dry-run` creates neither directories nor log files.

Each window runs a manager for a single service and stores its own logs and `session.json` under `.artifacts/dev/<session>/`, where the placeholder identifies the session. Ctrl+C cleans up only the service and descendant processes created by that window. If the backend stops or restarts, a frontend that has previously become ready keeps its process running and reports that its dependency is not ready; it resumes working when the backend recovers. Initial frontend startup still requires the same-origin API to be ready. A frontend process exit or a change in port ownership still causes an error and exit. Failure to start one side does not stop the other, and the database keeps running. View reused service logs in their original sessions.

The launcher's ownership and business probes carry `x-tixxin-dev-probe: 1`. In development, only successful read-only probe access logs are silenced; normal business requests are still logged. Health checks and probes that return 4xx, 5xx, or errors retain warning and error logs, and runtime state changes are also displayed. This prevents continuous successful checks from flooding the logs.

`--dry-run` only displays startup commands; it does not open windows or start services. Startup commands forward only the current Node, pnpm, and PATH paths. Business configuration is read from the new terminal environment and the project's existing environment files; temporary business environment variables set by the caller are not forwarded. For temporary overrides, set variables separately in two local terminals and run `corepack pnpm dev:session:api --logs` and `corepack pnpm dev:session:web --logs`.

An open window does not mean a service is ready. Run `corepack pnpm dev:check` to verify readiness. Windows remain open after Ctrl+C cleans up services, and error output remains visible after startup failures. Before starting the same service again, the launcher automatically closes old windows with the same title that no longer have running processes; running windows and other terminals are unaffected. Do not repeatedly open windows to resolve port conflicts; identify the owner first. If macOS denies terminal-control permission, the command reports an error. You can manually open two terminals and run `corepack pnpm dev:session:api --logs` and `corepack pnpm dev:session:web --logs`. These two entry points also work on other systems, or you can continue to use `dev:all` for unified startup.

If several sections return 502 or fail to load at the same time, first check the backend `/ready`, then the frontend's same-origin `/api/v1/posts`. Distinguish services that are not ready, configuration errors, and valid empty results. Do not switch to Mock to hide real API failures.

## Administrator and Development Samples

After providing `ADMIN_DEFAULT_USERNAME` and a random `ADMIN_DEFAULT_PASSWORD` of at least 12 characters in a controlled terminal environment:

```sh
corepack pnpm --filter server-main build
corepack pnpm --filter server-main exec node dist/admin-bootstrap.js
```

This command only creates an administrator and refuses to overwrite an account with the same username. Remove the password environment variable from the terminal afterward. The development `seed:dev` command inserts content and must not be used for production initialization.

Development samples are managed incrementally through a stable ownership ledger. Check first, then preview:

```sh
corepack pnpm db
corepack pnpm db:dev status
corepack pnpm db:dev check-data
corepack pnpm db:dev seed-data --dataset all
corepack pnpm db:dev remove-data --dataset gallery-v1
```

| Command                           | Behavior                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`                          | Always read-only; displays the target and migration status                                                                                            |
| `list`                            | Read-only listing of available actions, datasets, and data domains, for menus and scripts                                                             |
| `volume --scale <scale>`          | Previews or fills in posts and comments at the specified volume scale; `--clear` removes the entire batch                                             |
| `check-data`                      | Checks domain records, relationships, media, and representative scenarios; use `--domain` to limit the domain                                         |
| `seed-data --dataset <dataset>`   | Previews incremental additions; datasets and stable ownership are maintained by the [seed implementation](../../src/backend/server-main/src/seeders/) |
| `remove-data --dataset <dataset>` | Previews which specified samples can be removed and why others are protected; see below for `--forget-ownership`                                      |
| `prepare-profile`                 | Only normalizes initial profile values that match exactly and have not been edited; preserves modified profile data                                   |
| `clear-moments` / `clear-content` | Clears the specified business scope; this is not targeted sample cleanup                                                                              |
| `reset`                           | Drops application tables and replays migrations, clearing accounts, content, configuration history, and the media index                               |

Running `corepack pnpm db` without arguments opens an interactive menu with the same commands listed above, grouped into inspection, sample additions, cleanup, rebuilding, accounts and configuration, and backups. It displays the target database first and prints the complete command before execution. Write actions are previewed before asking you to enter the database name for confirmation; `clear-content` and `reset` also require the action name. The menu does not write to the database itself; its dataset and domain lists come from `db:dev list`. With arguments, `corepack pnpm db <command>` is equivalent to `corepack pnpm db:dev <command>`. In a non-interactive terminal, the menu only prints usage and available entries and returns a nonzero status, for use with scripts and CI.

Volume datasets provide enough data for pagination, search, and statistics and are separate from representative samples. Preview with `corepack pnpm db:dev volume --scale small|large`, write with `--apply --confirm <database-name>`, and remove the entire batch with `volume --clear`. Content is generated deterministically from fixed vocabulary lists and sequence numbers. Repeated runs fill only missing records; titles, bodies, and comments use natural Chinese without markers. Three posts concentrate the comments (60/30/15 for small and 300/150/60 for large, including one reply level and pending and hidden states) to exercise comment pagination on individual posts. Increasing the scale also fills only missing records in this part of the dataset. Volume records belong to `volume-v1` and are deleted as an entire batch. They do not use the per-record fingerprint protection of representative samples and are not included in the protected cleanup plan for `remove-data --dataset all`. Full-table counts from `check-data` include volume data; clear it first or use a clean database when checking representative sample coverage.

Actual writes require explicitly appending `--apply --confirm <database-name>`. The tool only permits verified local non-production targets, requires all migrations to be applied and the schema to match, and first creates a backup through the full backup process. It does not write if the backup fails. When there is nothing pending, it does not modify data again.

The `core-v1` core sample set includes public discussions with enough comments for pagination, two levels of replies, pending and hidden states, long comments, and distribution across multiple posts. It also keeps one orphan media asset that is not referenced by any content, for checking the media library and cleanup plans. When coverage requirements increase, development databases that were seeded previously must run `seed-data --dataset core-v1` again to add the new records. Repeated runs do not overwrite edited content or recreate deleted records.

The realistic `showcase-v1` sample set makes the development database resemble an actively maintained personal blog: fifty long-form posts of at least 1,600 Chinese characters each (with post folders (专栏), tags, covers, pinned posts, and publication dates spread over two years), visitor comments and blogger replies responding to their content, likes distributed according to post popularity, eighteen Moments entries with locations and equipment plus their comments and likes, four gallery works, two guestbook messages dated today, and the blogger profile (name, title, avatar, online status and signature, launch date, announcement, and social links). Post bodies and comments are stored in [`showcase-content/`](../../src/backend/server-main/src/seeders/showcase-content/); image assets and sources are registered in [`showcase-assets/`](../../src/backend/server-main/src/seeders/showcase-assets/README.md). Visitors have no avatar images; the frontend generates initials avatars from their names. Profile fields are written only when they still match the initial values or the output of `prepare-profile`. Edited configuration is preserved and explained in the report's `unavailable` field. When the profile name changes, the blogger attribution is updated only in samples whose fingerprints are unchanged. Preview with `corepack pnpm db:dev seed-data --dataset showcase-v1` and follow the write procedure in this section. If volume data also exists, statistics include both datasets; run `volume --clear` first for site figures closer to those of a real blog.

Development samples must cover common states, pagination, relationships, recent dates, and failure recovery for current features. Bodies use natural content; stable internal identifiers and purpose descriptions belong in scripts and ownership records. Keep everyday development samples long-term. Automated regression tests use separate databases, media, and accounts that can be cleaned up.

The representative platform subscription sample set is `subscription-v1` (15 subscriptions and 1 managed icon with source and license information). It covers seven currencies, five billing cycles, both states, price history, and recent dates. Amounts are representative development values only; they do not describe the blogger's actual spending or vendors' current prices. Preview with `corepack pnpm db:dev seed-data --dataset subscription-v1`, then follow this section's backup and target-confirmation procedure to write. Vendor responses for the icon proxy are controlled by isolated tests; preparing samples does not make third-party network requests.

Repeated seeding does not overwrite user edits, rewrite dates, or recreate deleted records. Targeted cleanup protects user changes, external interactions, relationships across datasets, and historical media references; records with unknown relationships are retained. The ownership ledger remains in place to prevent later seeding from recreating deleted content.

When sample definitions change and an already seeded database needs to catch up, ordinary cleanup followed by seeding will not work: the ownership ledger survives cleanup, so seeding treats these records as user-deleted and skips them. In this case, use `remove-data --dataset <dataset> --forget-ownership` to clear ownership entries that no longer have corresponding records while cleaning up; the dataset can then be seeded again. This also recreates samples that were genuinely deleted earlier, so use this switch only for rebuilding, not everyday cleanup. Ownership entries for records that still exist are retained, and user-edited content is not overwritten.

`remove-data`, clearing, and rebuilding also require other database clients to disconnect. The tool does not stop services itself. It acquires application table locks and rechecks the plan, exiting if the scope changes. `reset` does not use `CASCADE`; dependencies outside the application cause the transaction to fail and roll back. The tool does not delete disk media, environment files, or existing backups. Reinitializing an account after rebuilding does not restore the original data; use a [full backup](../backup-and-recovery.md) for recovery.

## Build and Generated Directories

```sh
corepack pnpm build
corepack pnpm --filter server-main build
corepack pnpm preview
```

Installation-time `nuxt prepare` and type checking use the standard `.nuxt/` directory, matching ESLint and tsconfig references. If needed, run `corepack pnpm --filter web-blog exec nuxt prepare`.

The project's `build` / `generate` commands explicitly select `--envName production-build`, isolate production intermediate files in `.nuxt-production/`, and set `site.env: production` in that configuration layer. Do not bypass the project's build entry points or choose generated directories based solely on `NODE_ENV`: prepare/typecheck may also use production. Production `.output/` is separate from development `.nuxt/`; backend watch mode uses `.dev-dist/`, while production builds use `dist/`. Do not rebuild a directory that another validation process is reading.

Development environments are not indexable by default. See the [deployment guide](deployment.md) for runtime indexing settings in production and staging environments.

## Interaction Cursors

Site-wide cursor rules are provided by `_interaction.scss` based on native controls and interaction roles. Disabled controls use `not-allowed`. Only action buttons that are actually executing requests set `aria-busy` and use `progress`; do not propagate a busy container's state to child controls. Read-only text remains selectable and copyable.

When a component needs a specialized cursor for image zooming, dragging, or resizing, use a native fallback such as `cursor: var(--interaction-cursor, zoom-in)`. Shared variables take precedence when expressing disabled and busy states, preventing component selectors from overriding site-wide rules. Do not infer whether a control is actionable solely from `tabindex`, hover effects, or `aria-busy` on a parent container.

## Validation

Node 25 exposes server-side Web Storage by default. The frontend unit test entry point disables this API so that the Nuxt test environment uses the simulated browser's storage implementation, preventing a native empty object from overriding browser interfaces.

```sh
corepack pnpm check:secrets
corepack pnpm test:subscription-domain
corepack pnpm lint
corepack pnpm --filter web-blog exec nuxt typecheck
corepack pnpm --filter web-blog test
corepack pnpm --filter server-main lint
corepack pnpm --filter server-main typecheck
corepack pnpm --filter server-main test
corepack pnpm --filter server-main test:integration
```

Choose checks that match the changes. Database, migration, and write/recovery behavior cannot be verified through frontend unit tests alone.

| Scope                                          | Command                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Startup lifecycle                              | `corepack pnpm test:dev`                                                                                      |
| Isolated Nuxt/Nest cold startup and reuse      | `corepack pnpm test:dev:integration`                                                                          |
| PostgreSQL startup ownership                   | `corepack pnpm test:dev:postgres`                                                                             |
| Pinned-version Nuxt patches                    | `corepack pnpm test:nuxt-patches`                                                                             |
| Subscription business logic and content import | Backend `test:subscriptions`; shared calculations: `corepack pnpm test:subscription-domain`                   |
| Database tools and sample ownership            | Backend `test:database-dev`, `test:development-data`                                                          |
| Backups and runtime tasks                      | Backend `test:backup-integrity`, `test:backup-restore`, `test:operations`                                     |
| Browser                                        | `corepack pnpm test:e2e`, or `corepack pnpm test:e2e:run` after production builds of both sides are available |

The browser runner requires a PostgreSQL user that can create temporary databases. Select the scope by spec and browser:

```sh
node src/backend/server-main/tests/browser-runner.mjs release-seo.spec.ts --browser=all
node src/backend/server-main/tests/browser-runner.mjs blog.spec.ts --browser=firefox
```

For scenarios that persistently modify public query results, start a new runner and database for each browser to prevent data from one browser from contaminating the next. Tests clean up only the databases, media, processes, and containers they own; they must not clear the everyday development database.

To evaluate post-list projection, run `corepack pnpm --filter server-main exec tsx tests/post-list-performance.ts --compare` after building the backend. It compares complete business responses, pagination, and public filtering, rather than elapsed time alone. Record browser performance and service method timing separately. State sample, warm-up, cache, hardware, and concurrency conditions explicitly; do not treat local measurements as direct evidence of production benefits.

Public-section navigation validation uses `node src/backend/server-main/tests/navigation-performance.mjs --samples=28 --devtools-ab`; complete production builds of the frontend and backend before running it. The script creates a separate database and media directory, uses at least 2,000 public posts and 12 real managed images per page, and samples production navigation across all three themes as well as DevTools enabled/disabled comparisons in independent development processes. The report includes click-to-page-ready time, long tasks, peak DOM size, requests and transfer volume, and cleanup results for the resources created by the run. By default, assertions cover only functionality and resource boundaries. Millisecond targets must be verified using the same hardware, samples, and warm-up conditions; a fast run with failed responses does not count as a successful performance result.

Keep repeatable test source code in Git. Store screenshots, recordings, traces, coverage, machine-generated reports, runtime logs, and temporary scripts in `.artifacts/` or `.playwright-mcp/`, outside published documentation. Remove credentials and private content before sharing reports.
