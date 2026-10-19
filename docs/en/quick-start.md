# Five-Minute Deployment

[中文原文](../quick-start.md) | **English**

For first-time users: with a Linux server that already runs Docker and a domain name, bring up the site over HTTPS using the prebuilt images published by GitHub Release (v0.2.0 in this example). This page covers only the shortest path for a first installation. For the full explanation of each setting, building images yourself, PowerShell commands and local previews, see [Deployment and Version Switching](deployment.md).

## Prerequisites

- An amd64 or arm64 Linux server with Docker Engine and the Docker Compose v2 plugin (`docker compose`).
- Node.js 25 (`>=25 <26`), `git` and `openssl` on the server. The release script runs on the host and does not need the project's dependencies installed.
- The domain's A/AAAA records point at this server, ports 80 and 443 are reachable from the internet, and no other program is using them. Caddy requests a certificate on first start, and the release script finishes by checking the real HTTPS address.

The examples use `blog.example.com`; replace it with your own domain.

## 1. Get the Deployment Files

Nothing needs to be built, but the release script, `compose.production.yaml` and `deploy/Caddyfile` are all read from a repository checkout, so check out the tag that matches the images. A shallow clone downloads only that version:

```sh
git clone --depth 1 --branch v0.2.0 https://github.com/TixXin/TixXinBlog.git
cd TixXinBlog
```

Run all later commands from this directory. The files actually used are:

| File                            | Purpose                                                               |
| ------------------------------- | --------------------------------------------------------------------- |
| `compose.production.yaml`       | Production stack: PostgreSQL, migration, API, frontend, Caddy, worker |
| `deploy/Caddyfile`              | HTTPS entry point; obtains certificates and proxies to the frontend   |
| `deploy/production.env.example` | Production environment template                                       |
| `scripts/release/release.mjs`   | Preflight, first installation, upgrade and rollback script            |

## 2. Fill In the Environment Variables

Copy the template into a private directory outside the repository. The commands never overwrite an existing file:

```sh
install -d -m 700 ../tixxin-private
cp -n deploy/production.env.example ../tixxin-private/production.env
chmod 600 ../tixxin-private/production.env
```

Generate two secrets by running the command once for each, and put the outputs into the matching variables in the table below:

```sh
openssl rand -hex 32
openssl rand -hex 32
```

Then edit `../tixxin-private/production.env`. Only the following entries need to change; keep the template values for everything else:

| Variable                     | Value                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `RELEASE_VERSION`            | `0.2.0` (the version without the leading `v`)                                                             |
| `WEB_IMAGE_REPOSITORY`       | `ghcr.io/tixxin/tixxinblog-web`                                                                           |
| `API_IMAGE_REPOSITORY`       | `ghcr.io/tixxin/tixxinblog-api`                                                                           |
| `MIGRATION_IMAGE_REPOSITORY` | `ghcr.io/tixxin/tixxinblog-migration`                                                                     |
| `WORKER_IMAGE_REPOSITORY`    | `ghcr.io/tixxin/tixxinblog-worker`                                                                        |
| `POSTGRES_PASSWORD`          | Output of the first `openssl rand -hex 32` (must be hexadecimal, at least 32 characters)                  |
| `JWT_ACCESS_SECRET`          | Output of the second `openssl rand -hex 32` (at least 32 characters)                                      |
| `SITE_HOST`                  | The domain, such as `blog.example.com`                                                                    |
| `SITE_URL`                   | The matching HTTPS origin, such as `https://blog.example.com`, with no path or trailing slash             |
| `HTTPS_BIND_ADDRESS`         | `0.0.0.0` or the server's public interface address; the template default `127.0.0.1` listens locally only |

Notes:

- Keep `RELEASE_PROJECT` as `tixxin-production`. It determines the volume names and must not change after installation.
- `NUXT_PUBLIC_DEFAULT_LOCALE` sets the site's default interface language. The template uses `zh-CN`; change it to `en` for an English-speaking audience. It only affects interface text and the still-unedited initial site profile, and does not translate posts or other content.
- When using images from a fork, replace `tixxin/tixxinblog` with your own `<owner>/<repository>` (all lowercase).
- The environment file holds the database password and signing secret. Never commit it to Git, and keep a safe copy; without it you cannot connect to the existing database.

## 3. Pull the Images and Start

The release script only uses images already on the host (it starts services with `--pull never`), so first pull the four application images plus the PostgreSQL and Caddy dependency images. Set `origin` to your own `SITE_URL`:

```sh
release_env=../tixxin-private/production.env
release_version=0.2.0
origin=https://blog.example.com
for name in web api migration worker; do
  docker pull "ghcr.io/tixxin/tixxinblog-$name:$release_version"
done
docker pull postgres:16-alpine
docker pull caddy:2-alpine
node scripts/release/release.mjs --env-file "$release_env" --version "$release_version" --origin "$origin" --initialize
node scripts/release/release.mjs --env-file "$release_env" --version "$release_version" --origin "$origin" --initialize --apply
```

- The first `release.mjs` run (without `--apply`) is a preflight. It parses the configuration, checks that `SITE_HOST`, `SITE_URL` and `--origin` agree, validates the password and secret formats, confirms the images exist locally, and verifies that this is a fresh project with no containers or volumes. It creates no services or volumes and prints a JSON report.
- The second run performs the installation: it starts an empty database, runs the one-off `migration` container to apply the formal migrations, starts the API, frontend and Caddy, and finally checks HTTPS, the same-origin API and the version header through `https://<domain>/api/v1/posts?pageSize=1`. `"status": "ready"` in the output means success.
- Migrations are part of the second command; there is no separate step. No development samples are written, so the new site has no posts.
- On failure the script keeps the volumes and the current state, and writes its report under `.artifacts/release/`. Work through the FAQ below; do not rerun `--initialize` to bypass the checks. See [Preflight and Initial Installation](deployment.md#preflight-and-initial-installation).

## 4. Create the Owner Account

Run this in the same terminal. The login name and a password of at least 12 characters are read through hidden input and never appear in command arguments. The prompt text stays Chinese, matching the admin interface: `登录名` is the login name and `密码` is the password.

```sh
read -rp '登录名：' ADMIN_DEFAULT_USERNAME && export ADMIN_DEFAULT_USERNAME
read -rsp '密码：' ADMIN_DEFAULT_PASSWORD && echo && export ADMIN_DEFAULT_PASSWORD
docker compose --env-file "$release_env" -f compose.production.yaml run --rm --no-deps -e ADMIN_DEFAULT_USERNAME -e ADMIN_DEFAULT_PASSWORD backend node dist/admin-bootstrap.js
unset ADMIN_DEFAULT_USERNAME ADMIN_DEFAULT_PASSWORD
```

The command only creates an account and refuses to overwrite an existing account with the same name. Then open `https://<domain>/admin/login`, sign in, fill in your details under site settings and start writing. If you forget the password, see [Resetting the Administrator Password](deployment.md#resetting-the-administrator-password).

## 5. Go-Live Checklist

- [ ] **HTTPS works**: the commands below succeed without `-k`, and the response includes `x-tixxin-release: 0.2.0`. The home page and `/admin/login` open in a browser without certificate warnings.

  ```sh
  curl -I --max-time 15 "$origin/"
  curl -i --max-time 15 "$origin/api/v1/posts?pageSize=1"
  ```

- [ ] **Understand HSTS**: the Caddy template sends `Strict-Transport-Security: max-age=86400` (no subdomains, no preload). Browsers that receive it use only HTTPS for the site for one day and cannot fall back to HTTP if the certificate breaks. Watch automatic certificate renewal first; after one or two stable weeks, lengthen the period in `deploy/Caddyfile` as described in [Optional Worker and Operational Monitoring](deployment.md#optional-worker-and-operational-monitoring).
- [ ] **`/ready` health check**: the API publishes no host port, and its container health check requests `/ready`. `backend` showing `healthy` means the probe passes; you can also request it inside the container, which prints `200`. `/ready` on the public domain is not the backend probe.

  ```sh
  docker compose --env-file "$release_env" -f compose.production.yaml ps -a
  docker compose --env-file "$release_env" -f compose.production.yaml exec backend node -e "fetch('http://127.0.0.1:3000/ready').then((r) => console.log(r.status))"
  ```

- [ ] **Rate limits count real visitor IPs**: when both `*_TRUSTED_PROXY_CIDRS` are unset or empty, they trust this project's fixed internal network subnet (`TIXXIN_NETWORK_SUBNET`, `172.31.250.0/24` by default), so no subnet lookup is needed. If they still hold a `<RELEASE_PROJECT>_default` subnet looked up for an older version, new containers are outside it and every visitor shares one read quota keyed on Caddy's address (120 public reads per minute); empty both values and recreate the frontend and API. Never use `0.0.0.0/0` or all private ranges; if a CDN sits in front of Caddy, review the topology under [Trusted Proxies](deployment.md#trusted-proxies-read-quotas-and-media-caching) first.

  ```sh
  docker compose --env-file "$release_env" -f compose.production.yaml up -d --no-deps --no-build --pull never --wait backend frontend
  ```

- [ ] **Backups**: once you have written your first content, download a content package with managed images from `/admin/maintenance` as a minimum backup. Upgrades require a verified full backup (database plus media); scheduled full backups need the worker enabled separately, see [automatic full backups](../operations.md#自动完整备份) and [Backup and Recovery](../backup-and-recovery.md) (both in Chinese). Keep the environment file safe as well. Never use `docker compose down -v` to deal with a fault; it deletes the data volumes.

## Upgrades and Rollbacks

- Upgrade: take a full backup, pull the four images of the new version, check out the matching tag, then run the release script with `--backup-directory`; see [Releasing to an Existing Site](deployment.md#releasing-to-an-existing-site).
- Rollback: once you have confirmed the older version is compatible with the current database, use `--action rollback --database-compatible` to switch only the application images without reverting data; see [Application Rollback and Data Recovery](deployment.md#application-rollback-and-data-recovery).

## FAQ

**The certificate is not issued, or the browser reports a certificate error.** Check that DNS points at this host, `SITE_HOST`/`SITE_URL` match the domain you visit, `HTTPS_BIND_ADDRESS` is not `127.0.0.1` and the firewall allows 80/443, then read the `edge` logs. Do not delete the certificate volume to request again. See [HTTPS certificate errors](../troubleshooting.md#https-证书错误或无法签发) (in Chinese).

```sh
docker compose --env-file "$release_env" -f compose.production.yaml logs --tail=100 edge
```

**The release script reports that images are not ready locally (`镜像未在本机就绪`).** All six images (the four application images plus `postgres:16-alpine` and `caddy:2-alpine`) must be pulled first, and the image repositories in the environment file and `--version` must match the pulled tags. If the GHCR packages are private (for example, your own fork), first run `docker login ghcr.io` with a token that has `read:packages`.

**Pages or `/api/v1` return 502.** Check the logs and health of `edge`, `frontend` and `backend` in turn. If `backend` is not `healthy`, look for database connection errors first instead of only restarting the frontend. See [SSR pages or the same-origin API return 502](../troubleshooting.md#ssr-页面或同源-api-返回-502) (in Chinese).

```sh
docker compose --env-file "$release_env" -f compose.production.yaml logs --tail=100 edge frontend backend
```

**Several visitors keep getting 429.** Usually trusted proxies are not configured, so all visitors share one quota; follow the step in the go-live checklist. See [Requests return 429](../troubleshooting.md#请求返回-429) (in Chinese).

**The browser still forces HTTPS or shows an error after the certificate is fixed.** This is how HSTS works: the only fix is a working HTTPS endpoint, and switching to HTTP or removing the header does not clear a policy the browser has stored. See [HSTS forces HTTPS](../troubleshooting.md#hsts-导致浏览器强制-https) (in Chinese).
