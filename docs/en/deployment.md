# Deployment and Version Switching

[中文原文](../deployment.md) | **English**

References without an English translation link to the Chinese guides.

The project provides a standalone local configuration in `compose.yaml` and a production configuration with pinned image versions in `compose.production.yaml`. The production stack consists of PostgreSQL, a one-off migration service, the API, the frontend, a Caddy HTTPS entry point, and an optional worker. The database, media, certificates, Caddy configuration, and backups are persisted separately.

Releasing, rolling back the application, and restoring data are separate procedures. An application rollback does not run old migrations; use [Backup and Recovery](../backup-and-recovery.md) when data needs to be restored.

Command examples primarily use bash on a Linux server, followed by equivalent Windows PowerShell commands. Variables correspond directly between the two forms: `release_version`/`$releaseVersion` is the application version, `release_env`/`$releaseEnv` is the production environment file, `origin`/`$origin` is the site's HTTPS origin, and `backup_directory`/`$backupDirectory` is a verified full-backup directory.

## Images and Environment

The application consists of four images. They must be built from the same commit and use the same immutable tag. Do not overwrite a version tag that has already been released:

| Image     | Build method                                               | Purpose                                                                                                                                           |
| --------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| web       | Root `Dockerfile` (`runtime`)                              | Nuxt frontend and same-origin API gateway                                                                                                         |
| api       | `runtime` target in `src/backend/server-main/Dockerfile`   | Starts HTTP only                                                                                                                                  |
| migration | `migration` target in `src/backend/server-main/Dockerfile` | Runs formal migrations only                                                                                                                       |
| worker    | `worker` target in `src/backend/server-main/Dockerfile`    | Includes production dependencies, maintenance scripts, and the PostgreSQL 16 client; running the image directly performs a read-only status check |

The release script only checks images already present on the target host and starts them with `--pull never`; it does not build, push, or pull images. Choose either of the following approaches and prepare all four images on the target host before running the preflight check. PostgreSQL 16 and Caddy 2 should also be pinned to verified full tags or digests.

The target host also needs Docker Compose, Node 25, and a repository checkout matching the application version: the release scripts, `compose.production.yaml`, and `deploy/Caddyfile` are all read from that checkout.

### Using Prebuilt Images

After a `v*` tag is pushed, the [Release workflow](../../.github/workflows/release.yml) checks that the tag matches the version in the root `package.json`, that the tagged commit has been merged into main, and that CHANGELOG contains the corresponding section. It then runs the static checks, unit tests, migration replay, and dependency audit from CI. Next, it builds all four images on native amd64/arm64 hosted runners and pushes them to GHCR by digest without tags. Only after web/api/migration pass container smoke tests on both platforms does it combine the images into multi-architecture manifests, apply version tags, and create a GitHub Release. Browser and isolated integration regressions are not repeated in this workflow; before tagging, confirm that CI has passed for the corresponding commit on main. Image addresses follow `ghcr.io/<owner>/<repository>-<image>` (all lowercase). For this repository, they are `ghcr.io/tixxin/tixxinblog-web`, `-api`, `-migration`, and `-worker`.

Each image has only two types of tags: the version number without `v` (such as `0.2.0`) and `sha-<full commit SHA>`. There is no `latest` tag. Images include both linux/amd64 and linux/arm64, with an SBOM and build provenance attestations. The release notes list each image's manifest digest.

Set the GHCR repositories in the environment file (see the examples in the [production template](../../deploy/production.env.example)), set `RELEASE_VERSION` to the version number, then pull the images and verify their digests on the target host:

```sh
release_version=0.2.0
image_prefix=ghcr.io/tixxin/tixxinblog
for name in web api migration worker; do
  docker pull "$image_prefix-$name:$release_version"
  docker image inspect --format '{{index .RepoDigests 0}}' "$image_prefix-$name:$release_version"
done
# 发布脚本以 --pull never 启动依赖服务，需与环境文件中的 POSTGRES_IMAGE、CADDY_IMAGE 一致并预先拉取
docker pull postgres:16-alpine
docker pull caddy:2-alpine
```

PowerShell:

```powershell
$releaseVersion = '0.2.0'
$imagePrefix = 'ghcr.io/tixxin/tixxinblog'
foreach ($name in 'web', 'api', 'migration', 'worker') {
  docker pull "${imagePrefix}-${name}:${releaseVersion}"
  docker image inspect --format '{{index .RepoDigests 0}}' "${imagePrefix}-${name}:${releaseVersion}"
}
docker pull postgres:16-alpine
docker pull caddy:2-alpine
```

The output digests should match the release notes. For private GHCR packages, first run `docker login ghcr.io` with a token that has `read:packages` permission. To inspect provenance or the SBOM, run `docker buildx imagetools inspect <image-reference> --format '{{ json .Provenance }}'` (use `.SBOM` for the SBOM).

Forked repositories can push their own `v*` tags to produce images with the same naming rules. After the first push, confirm visibility and repository access permissions in the GitHub package settings.

### Building Images Yourself

Build all four images from the same commit in a clean checkout on the target host or a trusted build machine. Using the full Git SHA as the version is recommended. The build context is the repository root:

```sh
release_version="$(git rev-parse HEAD)"
docker build -t "tixxin-blog-web:$release_version" .
docker build -f src/backend/server-main/Dockerfile --target runtime -t "tixxin-blog-api:$release_version" .
docker build -f src/backend/server-main/Dockerfile --target migration -t "tixxin-blog-migration:$release_version" .
docker build -f src/backend/server-main/Dockerfile --target worker -t "tixxin-blog-worker:$release_version" .
```

PowerShell:

```powershell
$releaseVersion = git rev-parse HEAD
docker build -t "tixxin-blog-web:$releaseVersion" .
docker build -f src/backend/server-main/Dockerfile --target runtime -t "tixxin-blog-api:$releaseVersion" .
docker build -f src/backend/server-main/Dockerfile --target migration -t "tixxin-blog-migration:$releaseVersion" .
docker build -f src/backend/server-main/Dockerfile --target worker -t "tixxin-blog-worker:$releaseVersion" .
```

When building on another machine, push the images to a trusted registry or transfer them with `docker save`/`docker load`, and verify that the image IDs on the target host match the build results.

### Environment File

Copy the [production template](../../deploy/production.env.example) to a controlled directory outside the repository, fill in the actual values, and restrict file permissions. Do not commit secret files or `docker compose config` output containing the fully expanded environment. Database passwords and signing keys can be generated with `openssl rand -hex 32`.

```sh
install -d -m 700 ../tixxin-private
cp -n deploy/production.env.example ../tixxin-private/production.env
chmod 600 ../tixxin-private/production.env
```

PowerShell:

```powershell
New-Item -ItemType Directory -Force ../tixxin-private | Out-Null
if (-not (Test-Path ../tixxin-private/production.env)) {
  Copy-Item deploy/production.env.example ../tixxin-private/production.env
}
```

Neither command sequence overwrites an existing environment file. Edit the actual values after copying.

| Setting                                                                                                 | Requirement                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RELEASE_PROJECT`                                                                                       | A distinct, stable Compose project name; do not casually change volume ownership after the initial installation                                                                                                                            |
| `RELEASE_VERSION`                                                                                       | A prepared, immutable application version; use the version number (such as `0.2.0`) for prebuilt images, or preferably the full Git SHA for self-built images                                                                              |
| `WEB_IMAGE_REPOSITORY`, `API_IMAGE_REPOSITORY`, `MIGRATION_IMAGE_REPOSITORY`, `WORKER_IMAGE_REPOSITORY` | Image repositories for the same version; use untagged GHCR repository addresses for prebuilt images                                                                                                                                        |
| `POSTGRES_IMAGE`, `CADDY_IMAGE`                                                                         | Explicitly pinned dependency images already present locally                                                                                                                                                                                |
| `POSTGRES_PASSWORD`                                                                                     | A random hexadecimal value of at least 32 characters, avoiding reserved characters in connection URLs                                                                                                                                      |
| `JWT_ACCESS_SECRET`                                                                                     | A random signing key of at least 32 characters                                                                                                                                                                                             |
| `SITE_HOST`, `SITE_URL`                                                                                 | The public domain and its corresponding HTTPS origin                                                                                                                                                                                       |
| `NUXT_PUBLIC_DEFAULT_LOCALE`                                                                            | The site's default interface language, `zh-CN` (default) or `en`; any other value falls back to `zh-CN`. Read at runtime; visitors can switch languages in the appearance settings, and their choice is stored in the `blog-locale` cookie |
| `HTTPS_BIND_ADDRESS`, `HTTP_PORT`, `HTTPS_PORT`                                                         | Bound to the local host only by default, so the site is unreachable and cannot obtain certificates; for direct public serving set `0.0.0.0` or the public interface address, and configure the firewall and DNS                            |

If `NODE_ENV` is unset, the API treats it as `production`: rate limits apply, refresh cookies use `Secure`, the default log level is `info`, and `MEDIA_DIRECTORY` must be an absolute path or startup is rejected. The images already set `NODE_ENV=production` and `MEDIA_DIRECTORY=/app/var/media`. Only explicit `development`/`test` environments allow rate limiting to be disabled with `RATE_LIMIT_DISABLED=true`; production ignores that switch.

The database does not publish a host port, and the API is accessed through the frontend's same-origin gateway. Caddy forwards requests to the frontend, which forwards `/api/v1` to the API. The release response header is `X-TixXin-Release`. Caddy obtains certificates for a real domain; prepare DNS and the HTTP/HTTPS entry points before going live. Isolated validation uses an internal CA and actually verifies certificates; it does not disable TLS checks or modify system trust.

### Trusted Proxies, Read Quotas, and Media Caching

Both ends ignore forwarded address headers by default. In production, set `WEB_TRUSTED_PROXY_CIDRS` (the Caddy addresses directly in front of Nuxt) and `API_TRUSTED_PROXY_CIDRS` (the Nuxt addresses directly in front of the API) according to the actual network. Values are explicit, comma-separated IPv4/IPv6 addresses or CIDRs, mapped to `NUXT_TRUSTED_PROXY_CIDRS` and `TRUSTED_PROXY_CIDRS`. Include only controlled proxy addresses, narrow CIDRs for isolated proxy networks, or the subnet of this project's own Compose network that contains only this project's containers (from `docker network inspect <project>_default`). Do not substitute all private networks, `0.0.0.0/0`, a boolean switch, or an arbitrary hop count for verification. Addresses may change when containers are recreated, so use a dedicated stable proxy network or update these settings accordingly. Without this configuration, visitors share quotas based on the proxy connection address; this default state is not suitable for production acceptance checks involving multiple visitors.

The current Caddy template receives visitor connections directly, overwrites `X-Forwarded-For`, and removes other client-address hints. Nuxt verifies the proxy chain hop by hop outward from the connection address, then sends a single client IP to the API. The API only accepts forwarded addresses from trusted Nuxt connections. If a CDN or load balancer sits in front of Caddy, independently configure and validate the outermost trust boundary according to the actual topology first; do not pass through visitor-supplied headers directly. After deployment, verify quota isolation using two independent visitor addresses and forged forwarding headers.

Rate limits are counted by the real client address: each IPv4 address is counted individually, while IPv6 addresses are grouped by `/64` prefix. The counter table is bounded. When full, it first removes expired windows, then evicts the oldest windows; a full table does not cause new visitors to be rejected.

Within a fixed 60-second window, each IP can make 120 public business reads, 600 public media reads, and 300 admin reads. These three buckets are independent. Login, authentication refresh, writes, uploads, and view counts retain their existing quotas. Rate-limit responses include `Retry-After`, and the browser does not immediately retry automatically.

The public media bucket also includes the exact route `GET/HEAD /api/v1/subscriptions/favicons/<64 lowercase hexadecimal characters>.webp`. Subscription lists and statistics still use the business-read bucket; favicons continue to use `no-store` through the same-origin gateway.

Successful GET/HEAD and 304 responses for managed media use `Cache-Control: public, max-age=31536000, immutable` and an ETag based on the registered SHA-256 (resource keys are determined by UUIDs, and bytes are immutable). Conditional requests first check that the resource has not been deleted and that the file on disk is readable; a match returns a 304 with no body. The next request after deletion returns 404; a missing file returns 503. Errors and other business responses retain `no-store`. The same-origin gateway preserves cache headers only for exact managed-media paths.

Public reads can include `?w=320|640|960|1280` to request a proportionally downscaled WebP variant (quality 80, with ETag `"<sha256>-w<width>"`); frontend list images use these variants to provide `srcset/sizes`. Other widths return 400, and the original image is returned directly when the requested width is at least the original width. Variants are generated on the first request and cached at `MEDIA_DIRECTORY/.media-variants/<mediaUUID>-w<width>-<first16ofSHA-256>.webp`. Concurrent requests for the same variant generate it only once, with at most 2 variants generated simultaneously across the process. Variants are regenerable caches: they are deleted when the media is reclaimed or the original file is removed, and regenerated on demand after restoration. The entire `.media-variants/` directory can be deleted at any time to reclaim disk space (at most 4 variants per media item, typically totaling no more than the original image size), without downtime. A cache write failure, such as a full disk or read-only mount, affects only the cache, not the response.

The `media` volume is mounted at `/app/var/media` in the API. The worker mounts the same media volume read-only and writes backups to a dedicated volume, without needing the Docker socket. Uploaded resources are converted to WebP. When changing storage locations, migrate original files, database registrations, and permissions together; `.media-variants/` does not need to be migrated. Do not use `down -v` to troubleshoot service failures.

## Site URL and Indexing

The frontend production build uses the project's `build` command to select the `production-build` configuration layer, isolate `.nuxt-production/`, and explicitly retain `site.env: production`. The layer name must not be interpreted as a staging environment for the site. At runtime, `NUXT_PUBLIC_SITE_URL` must be the actual public origin; do not rely on the build-time default domain.

For a production site, verify that the homepage canonical URL, robots, RSS/JSON feeds, and sitemap all use the same runtime address. The public homepage must not carry noindex or a site-wide `Disallow: /`. Admin URLs remain blocked from indexing and excluded from the sitemap.

For staging, set the runtime variable `NUXT_SITE_ENV=staging` or `NUXT_SITE_INDEXABLE=false`. These settings override build defaults. Do not force indexability globally and make staging content indexable. Check production and staging configurations separately using the same artifact.

## Analytics

Analytics is disabled by default and supports Umami or Plausible. The frontend reads the following settings at runtime, so they also apply to prebuilt images. `compose.production.yaml` maps `ANALYTICS_*` in the production environment file to the frontend's `NUXT_PUBLIC_ANALYTICS_*` variables:

| Production environment file | Frontend runtime variable          | Description                                                                                          |
| --------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ANALYTICS_PROVIDER`        | `NUXT_PUBLIC_ANALYTICS_PROVIDER`   | `umami` or `plausible`; leave empty to disable                                                       |
| `ANALYTICS_SITE_ID`         | `NUXT_PUBLIC_ANALYTICS_SITE_ID`    | The Umami website ID, or the site domain registered in Plausible                                     |
| `ANALYTICS_SCRIPT_URL`      | `NUXT_PUBLIC_ANALYTICS_SCRIPT_URL` | The full analytics script URL, such as `https://<domain>/script.js` for a self-hosted Umami instance |

The script is injected only when both the provider and script URL are set. After changing the environment file, recreate the frontend container to apply the settings; rebuilding the image is unnecessary. For an existing site, follow [Releasing to an Existing Site](#releasing-to-an-existing-site), or run `docker compose --env-file "$release_env" -f compose.production.yaml up -d --no-deps --no-build --pull never frontend` during a maintenance window to recreate only the frontend container.

At runtime, the frontend reads `NUXT_PUBLIC_ANALYTICS_SCRIPT_URL` and adds that script's origin to the CSP `script-src` and `connect-src`; prebuilt images do not need to be rebuilt. Umami and Plausible send reports to the script's origin by default, so only that origin is allowed. If reporting uses a different origin from the script, adjust the CSP separately. Analytics scripts are injected only in the browser and are not loaded when a visitor enables Do Not Track (DNT) or Global Privacy Control (GPC). After setup, verify in browser developer tools that both script loading and reporting requests succeed.

## Preflight and Initial Installation

Replace the configuration and backup paths in the following examples with actual directories outside the repository:

```sh
release_env=../tixxin-private/production.env
origin=https://blog.example.com
node scripts/release/release.mjs --env-file "$release_env" --version "$release_version" --origin "$origin"
```

PowerShell:

```powershell
$releaseEnv = '../tixxin-private/production.env'
$origin = 'https://blog.example.com'
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin
```

By default, this only parses configuration and checks entry-point requirements and local images; it does not create services or volumes. The script explicitly specifies the environment file and clears current-shell overrides for template variables. Only `--version` overrides the version in the file. Preflight does not establish that DNS, certificate issuance, production credentials, or database compatibility are valid.

Initial installation requires that the project has no containers and that none of the target volumes exist:

```sh
node scripts/release/release.mjs --env-file "$release_env" --version "$release_version" --origin "$origin" --initialize
node scripts/release/release.mjs --env-file "$release_env" --version "$release_version" --origin "$origin" --initialize --apply
```

PowerShell:

```powershell
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin --initialize
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin --initialize --apply
```

Execution starts an empty database, runs formal migrations, starts the API/frontend/HTTPS services, then verifies readiness, the same-origin public API, and release headers. It does not run the development seed. If initial installation fails, created volumes are preserved. Do not repeatedly use `--initialize` to bypass checks. Inspect the current state, back it up, then use the existing-site procedure.

## Initializing the Administrator

In a controlled terminal environment, set `ADMIN_DEFAULT_USERNAME` and a random `ADMIN_DEFAULT_PASSWORD` of at least 12 characters. Do not put the password in command arguments or logs. The prompt text in the commands stays Chinese, matching the admin interface: `登录名` is the login name and `密码` is the password. Once the service images are ready, run:

```sh
read -rp '登录名：' ADMIN_DEFAULT_USERNAME && export ADMIN_DEFAULT_USERNAME
read -rsp '密码：' ADMIN_DEFAULT_PASSWORD && echo && export ADMIN_DEFAULT_PASSWORD
docker compose --env-file "$release_env" -f compose.production.yaml run --rm --no-deps -e ADMIN_DEFAULT_USERNAME -e ADMIN_DEFAULT_PASSWORD backend node dist/admin-bootstrap.js
unset ADMIN_DEFAULT_USERNAME ADMIN_DEFAULT_PASSWORD
```

PowerShell:

```powershell
$env:ADMIN_DEFAULT_USERNAME = Read-Host '登录名'
$env:ADMIN_DEFAULT_PASSWORD = Read-Host '密码' -MaskInput
docker compose --env-file $releaseEnv -f compose.production.yaml run --rm --no-deps -e ADMIN_DEFAULT_USERNAME -e ADMIN_DEFAULT_PASSWORD backend node dist/admin-bootstrap.js
Remove-Item Env:ADMIN_DEFAULT_USERNAME, Env:ADMIN_DEFAULT_PASSWORD
```

This command only creates an account and refuses to overwrite an existing account with the same username. After completion, remove the password environment variable from the terminal, then visit `/admin/login`. `seed:dev` inserts development content and must not be used to initialize production. Deliberately maintain the profile and initial content in the admin interface, review them, and then publish.

## Resetting the Administrator Password

If you forget the password or suspect credential exposure, run the reset locally on the server using a one-off container. This operation has no HTTP endpoint. The new password must be at least 12 characters. Set `ADMIN_RESET_PASSWORD` in a controlled terminal, or, if unset, enter it twice with hidden input in an interactive terminal. If multiple administrators exist, use `ADMIN_RESET_USERNAME` to select the account. The first command uses interactive input; the second reads environment variables:

```sh
docker compose --env-file "$release_env" -f compose.production.yaml run --rm --no-deps -it backend node dist/admin-reset-password.js
docker compose --env-file "$release_env" -f compose.production.yaml run --rm --no-deps -e ADMIN_RESET_USERNAME -e ADMIN_RESET_PASSWORD backend node dist/admin-reset-password.js
```

PowerShell:

```powershell
docker compose --env-file $releaseEnv -f compose.production.yaml run --rm --no-deps -it backend node dist/admin-reset-password.js
docker compose --env-file $releaseEnv -f compose.production.yaml run --rm --no-deps -e ADMIN_RESET_USERNAME -e ADMIN_RESET_PASSWORD backend node dist/admin-reset-password.js
```

The command stores the new password using argon2id, increments the session version, and revokes all sessions and refresh tokens. Every signed-in device must sign in again. The same transaction writes an audit entry described as `命令行重置密码` (command-line password reset). For local development, first run `corepack pnpm --filter server-main build`, then `corepack pnpm --filter server-main exec node dist/admin-reset-password.js`. Remove the password environment variable from the terminal after completion.

The initialization and reset commands report specific reasons for missing configuration, existing or nonexistent accounts, and invalid passwords. Unknown errors, such as database exceptions, produce only a redacted message and do not print connection parameters.

## Releasing to an Existing Site

First create a recent, consistent full backup of the actual target and verify its manifest and files. Perform an additional isolated restore if needed. The backup must include the database and registered media; a regular dump does not replace a full backup. The operator must verify the target, snapshot time, and media scope. The script cannot establish that an arbitrary input directory belongs to the site being upgraded.

```sh
backup_directory=../tixxin-private/backups/verified-backup
node scripts/release/release.mjs --env-file "$release_env" --version "$release_version" --origin "$origin" --backup-directory "$backup_directory"
node scripts/release/release.mjs --env-file "$release_env" --version "$release_version" --origin "$origin" --backup-directory "$backup_directory" --apply
```

PowerShell:

```powershell
$backupDirectory = '../tixxin-private/backups/verified-backup'
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin --backup-directory $backupDirectory
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin --backup-directory $backupDirectory --apply
```

Execution validates the full backup, acquires the local project's release lock, checks the database, stops frontend/API writes, runs migrations separately, then starts the application and HTTPS services and checks the version. Releases have an explicit maintenance window. If a release lock exists, first confirm whether a release process is still running; do not delete the lock to force concurrent execution.

If this project's worker is already running, it is also stopped before migration. It is restored with the same-version image only after the new application and HTTPS are ready and the new configuration still permits the worker. Releasing does not automatically start a worker that is disabled by default. If a one-off `compose run worker` exists, preflight refuses concurrent execution; wait for that task to finish first.

If migration fails, the new application is not started. If entry-point checks fail, success is not reported and the worker remains stopped. Volumes, images, and the failure state are preserved. The operator restores the required services based on the stage results; the script does not automatically roll back the database or delete data.

## Application Rollback and Data Recovery

Use rollback mode only after confirming that the target application is compatible with the current database schema and newly written data. Replace `0.1.0` in the examples with a verified older version (the shell comment `替换为已验证的旧版本`):

```sh
rollback_version=0.1.0 # 替换为已验证的旧版本
node scripts/release/release.mjs --env-file "$release_env" --version "$rollback_version" --origin "$origin" --action rollback --database-compatible --backup-directory "$backup_directory"
```

PowerShell:

```powershell
$rollbackVersion = '0.1.0' # 替换为已验证的旧版本
node scripts/release/release.mjs --env-file $releaseEnv --version $rollbackVersion --origin $origin --action rollback --database-compatible --backup-directory $backupDirectory
```

After reviewing preflight, append `--apply`. Rollback only switches application images, preserves persistent volumes, skips migrations, and checks the entry point. `--database-compatible` is an explicit judgment by the operator, not an automatic compatibility check.

If migration succeeds but the application fails, prefer fixing the application or adding a forward migration. To return data to the state at backup time, stop API and worker writes, restore and verify on a separate target, then switch the database and media together. Preserve the data from before the switch; see the [recovery procedure](../backup-and-recovery.md#切换恢复目标). Application rollback and data recovery do not replace one another.

## Optional Worker and Operational Monitoring

SMTP, automatic backups, and the continuous worker are disabled by default. First configure the channels and database control state according to [Operations](../operations.md), then explicitly enable them:

```sh
docker compose --env-file "$release_env" -f compose.production.yaml --profile worker run --rm worker node scripts/operations.mjs status
docker compose --env-file "$release_env" -f compose.production.yaml --profile worker up -d --no-build --pull never worker
```

PowerShell:

```powershell
docker compose --env-file $releaseEnv -f compose.production.yaml --profile worker run --rm worker node scripts/operations.mjs status
docker compose --env-file $releaseEnv -f compose.production.yaml --profile worker up -d --no-build --pull never worker
```

Continuous execution also requires `OPERATIONS_WORKER_ENABLED=true`. Email and backups each have an environment switch and a database pause state; both must allow execution. Starting the worker does not automatically redeliver restored old queues.

Every API response includes `X-Request-Id`, matching `traceId` in the response body, `req.id` in access logs, and the trace identifier in admin audits. An upstream `x-trace-id` is accepted only if it is a UUID or consists of at most 64 characters matching `[A-Za-z0-9._-]`; otherwise, a new one is generated. Unknown exceptions and 5xx errors record a stack trace and `traceId` in server logs, while clients receive only a generic message. When the API receives `SIGTERM`/`SIGINT`, `/ready` immediately returns 503 before the existing shutdown procedure continues. Startup failures are logged and exit with a nonzero code.

The Caddy entry point adds `Strict-Transport-Security: max-age=86400` (without subdomains or preload) and a `Permissions-Policy` that disables the camera, microphone, geolocation, payment, and USB. The API does not return `X-Powered-By`.

Once HSTS takes effect, visitors' browsers use only HTTPS for this site during its validity period. An expired certificate or incorrect configuration produces an error page that cannot be bypassed, and visitors cannot temporarily fall back to HTTP. Revocation requires changing the header to `max-age=0` and takes effect only for browsers that visit again over HTTPS. Start with a one-day duration while observing automatic certificate renewal and migration procedures. After confirming stability (at least one to two weeks and one renewal are recommended), change it to `max-age=31536000` in `deploy/Caddyfile`. Consider `includeSubDomains` only after confirming that all subdomains will support HTTPS long-term. Removing a site from `preload` requires waiting for browser version updates; a personal site generally does not need preloading.

Service logs go to stdout/stderr and are rotated per service by Compose. Logs are not backups. Monitor the system through `/ready`, actual public API requests, media reads, admin login, task status, and storage integrity checks. After an upgrade, verify public content, admin writes, indexing, and backups; a container's running state alone does not establish availability.

## Local Compose and Isolated Validation

Use the root `compose.yaml` for a local production-style preview that does not touch an existing deployment or reuse the development database. It builds frontend, API, and migration images from source. On `up`, it runs the one-off migration before starting the API and frontend, and publishes the frontend port only on `127.0.0.1`. The database and media use this Compose project's own volumes (the project name defaults to the repository directory name). A local HTTP entry point does not replace real HTTPS login and release validation.

| Variable            | Requirement                                                                       |
| ------------------- | --------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD` | Required; a random hexadecimal value                                              |
| `JWT_ACCESS_SECRET` | Required; a random value of at least 32 characters                                |
| `WEB_PORT`          | Optional; the host port, defaulting to `3458`                                     |
| `SITE_URL`          | Optional; defaults to `http://localhost:3458`; update it when changing `WEB_PORT` |

1. Create an environment file outside the repository without overwriting an existing file:

   ```sh
   preview_env=../tixxin-local/compose.env
   install -d -m 700 ../tixxin-local
   test -e "$preview_env" || (
     umask 077
     printf 'POSTGRES_PASSWORD=%s\nJWT_ACCESS_SECRET=%s\nWEB_PORT=3458\nSITE_URL=http://localhost:3458\n' \
       "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > "$preview_env"
   )
   ```

   PowerShell (7.2 or later):

   ```powershell
   $previewEnv = '../tixxin-local/compose.env'
   New-Item -ItemType Directory -Force ../tixxin-local | Out-Null
   function New-HexSecret { -join ([Security.Cryptography.RandomNumberGenerator]::GetBytes(32) | ForEach-Object { $_.ToString('x2') }) }
   if (-not (Test-Path $previewEnv)) {
     "POSTGRES_PASSWORD=$(New-HexSecret)", "JWT_ACCESS_SECRET=$(New-HexSecret)", 'WEB_PORT=3458', 'SITE_URL=http://localhost:3458' |
       Set-Content -Encoding utf8NoBOM $previewEnv
   }
   ```

2. Build and start the stack, then wait for `backend` and `frontend` to be healthy and `migration` to exit successfully:

   ```sh
   docker compose --env-file "$preview_env" up --build -d
   docker compose --env-file "$preview_env" ps -a
   ```

   PowerShell:

   ```powershell
   docker compose --env-file $previewEnv up --build -d
   docker compose --env-file $previewEnv ps -a
   ```

3. Initialize the administrator. As with [production initialization](#initializing-the-administrator), the password must be at least 12 characters and is passed only through environment variables. The prompts are the same Chinese strings, `登录名` (login name) and `密码` (password):

   ```sh
   read -rp '登录名：' ADMIN_DEFAULT_USERNAME && export ADMIN_DEFAULT_USERNAME
   read -rsp '密码：' ADMIN_DEFAULT_PASSWORD && echo && export ADMIN_DEFAULT_PASSWORD
   docker compose --env-file "$preview_env" run --rm --no-deps -e ADMIN_DEFAULT_USERNAME -e ADMIN_DEFAULT_PASSWORD backend node dist/admin-bootstrap.js
   unset ADMIN_DEFAULT_USERNAME ADMIN_DEFAULT_PASSWORD
   ```

   PowerShell:

   ```powershell
   $env:ADMIN_DEFAULT_USERNAME = Read-Host '登录名'
   $env:ADMIN_DEFAULT_PASSWORD = Read-Host '密码' -MaskInput
   docker compose --env-file $previewEnv run --rm --no-deps -e ADMIN_DEFAULT_USERNAME -e ADMIN_DEFAULT_PASSWORD backend node dist/admin-bootstrap.js
   Remove-Item Env:ADMIN_DEFAULT_USERNAME, Env:ADMIN_DEFAULT_PASSWORD
   ```

   If you forget the preview account password, run `backend node dist/admin-reset-password.js` in the same way. See [Resetting the Administrator Password](#resetting-the-administrator-password) for its parameters.

4. Open the site and `/admin/login` at the address in `SITE_URL`. The API runs in production mode and refresh cookies use `Secure`. Access it through `localhost`; if browsers handle Secure cookies over local HTTP differently, rely on validation in a real HTTPS environment. A new database has no public content, and no development seed is run.

5. Stop the preview with `docker compose --env-file "$preview_env" down` (replace the variable with `$previewEnv` in PowerShell). Data volumes are preserved. Append `-v` to delete this project's volumes only after confirming that the preview data is no longer needed. Do not use `down -v` on a production project.

Automated validation for the release script and production-style Compose setup:

```sh
node --test scripts/release/release.test.mjs scripts/release/production-artifact-cleanup.test.mjs
node scripts/release/production-integration.mjs
```

The production-style integration requires a clean Git checkout and freezes a single snapshot from tracked files only to build all four image types. It uses a random Docker project, random credentials, local ports, and an internal CA to validate initial HTTPS, indexing, nonempty content, native backup/recovery, pausing nonempty historical queues, version coordination, migration failures, rollback, and failure feedback.

All test resources are cleaned up according to this run's ownership; raw evidence remains in ignored directories. When image aliases come from the same snapshot, they can only validate version-switch orchestration, not prove that an arbitrary older application is compatible with a new database. Real DNS, external certificates, SMTP authentication, remote receiving services, and actual data switching must each be verified in the target environment.
