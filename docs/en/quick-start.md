# Five-Minute Deployment

[中文原文](../quick-start.md) | **English**

For first-time users: run one install command on a Linux server, then create the owner account in your browser, and you have a site served over HTTPS. The install script uses the prebuilt images and deployment package published with each GitHub Release; you do not need to clone the repository or install Node.js.

One-command installation is available from **v0.3.0**. Earlier versions have no deployment package and can only be deployed with the manual release procedure in [Deployment and Version Switching](deployment.md). The version `0.3.0` below is only an example; check the [Releases page](https://github.com/TixXin/TixXinBlog/releases) for the actual version. If you need to control every environment variable, build images yourself or use PowerShell, also see [Deployment and Version Switching](deployment.md).

## Prerequisites

- An amd64 or arm64 Linux server where you can use root or `sudo`.
- Docker Engine and the Docker Compose v2 plugin (`docker compose`). Optional: if Docker is not installed, the script offers to run Docker's official install script (`get.docker.com`); you can also install it yourself first by following the [Docker documentation](https://docs.docker.com/engine/install/).
- `bash`, `curl`, `tar` and `sha256sum` (or `shasum`) on the host; common distributions ship them by default.
- The domain's A/AAAA records point at this server.
- Ports 80 and 443 are reachable from the internet and not used by any other program. On a cloud server, also allow both ports in the security group.

The examples use `blog.example.com`; replace it with your own domain.

## Install

The recommended way is to download the script, read it, then run it:

```sh
curl -fsSL https://github.com/TixXin/TixXinBlog/releases/latest/download/install.sh -o install.sh
less install.sh
sudo bash install.sh
```

Each Release also provides `SHA256SUMS`, so you can verify the script before running it:

```sh
curl -fsSL https://github.com/TixXin/TixXinBlog/releases/latest/download/SHA256SUMS -o SHA256SUMS
sha256sum --ignore-missing -c SHA256SUMS
```

You can also run it in one step through a pipe:

```sh
curl -fsSL https://github.com/TixXin/TixXinBlog/releases/latest/download/install.sh | sudo bash
```

`latest` points at the newest stable release, and the downloaded script installs the version it belongs to by default. To pin a version, download the script from that tag instead, for example `https://github.com/TixXin/TixXinBlog/releases/download/v0.3.0/install.sh`.

### What the Script Asks

| Question                              | Notes                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| Run Docker's official install script? | Asked only when Docker is not found; the default is no                               |
| Site domain                           | Such as `blog.example.com`, without scheme or path                                   |
| Site language                         | `1` for Chinese `zh-CN` (default), `2` for English `en`                              |
| Install directory                     | `/opt/tixxin-blog` by default; `~/tixxin-blog` for `--local` as a regular user       |
| Confirm installation                  | Shows the version, architecture, directory, site URL and language; type `y` to go on |

The prompts are currently in Chinese. When the script runs through a pipe, it reads answers from the terminal (`/dev/tty`), so answer as usual. Without an interactive terminal, use a [non-interactive installation](#non-interactive-installation).

### What the Script Does

1. Preflight: CPU architecture, root privileges, required commands, Docker and Compose v2; it checks whether the domain resolves to an address on this host's network interfaces (a warning only, it does not stop the installation).
2. Refuses to overwrite an existing site: if the install directory is not empty, already has a `.env`, or a Compose project of the same name already has containers or volumes, it exits and suggests `tixxin update` instead.
3. Checks that ports 80 and 443 are free.
4. Downloads the deployment package `tixxin-blog-<version>.tar.gz` and `SHA256SUMS`, and extracts the package only after the checksum matches.
5. Writes the install directory and generates a random database password, signing secret and one-time setup token, stored in `<install directory>/.env` (mode 600).
6. Creates the management command `/usr/local/bin/tixxin`, pointing at `<install directory>/deploy/tixxin`; if another file already exists there it is left alone and you use the full path.
7. Pulls the images, starts the database, runs the formal migrations, starts the API, frontend and Caddy, then checks the same-origin API and release header over the real HTTPS address.
8. Prints the site URL, version, install directory and setup link; the install log is written to `<install directory>/logs/`. The terminal shows only a one-line database migration summary ("N run"); details are in `logs/migration-*.log`.

### What the Script Does Not Do

- It collects and reports nothing. Apart from GitHub Releases for the deployment package, the image registry for the images, and `get.docker.com` if you agree to install Docker, it contacts no other service. The domain check compares only against local network interface addresses by default; only when you explicitly pass `--check-public-ip` does it query that address for your public IP, which exposes this host's IP to that service.
- It never overwrites an existing site, never runs `docker compose down -v` and never deletes volumes. When installation fails, it keeps the install directory, containers and volumes, and prints troubleshooting commands.
- It writes no development samples, so the new site has no posts; it does not start the worker, and SMTP and automatic backups stay disabled.

Once the site is up, Caddy requests and renews HTTPS certificates from a certificate authority by itself. That is part of running the site, not something the install script does.

## Setup

When installation finishes, it prints a setup link:

```text
https://blog.example.com/setup?token=…
```

Open it in a browser and set the username, password (6–128 characters), site name and site language to create the owner account. You are then signed in and taken to the admin panel automatically.

- Opening the home page does not redirect to the setup page: a new site has no posts, and the home page shows a full-screen translucent "Not set up yet" watermark that does not block browsing or clicks. Visitors without the token therefore cannot claim the account first; the notice disappears once setup is complete.
- The token can be used successfully only once: after the account is created, the wizard and its endpoint close permanently, opening or submitting the link again fails, and a leaked token is useless.
- The page removes the token from the address bar as soon as it reads it; submissions are rate limited (5 per address every 10 minutes).
- If you lose the link, see [Lost setup link](#lost-setup-link).

## Local Trial

Without a server or domain, you can try it on your own computer (Docker Desktop on macOS, Docker Engine on Linux; Windows is not supported, and the script exits under Git Bash and similar environments). A local trial does not need root; as a regular user it installs to `~/tixxin-blog` by default:

```sh
curl -fsSL https://github.com/TixXin/TixXinBlog/releases/latest/download/install.sh -o install.sh
bash install.sh --local --dir "$HOME/tixxin-blog"
```

- The site is fixed to `localhost` at `https://localhost:8443`, and `http://localhost:8080` redirects to HTTPS. Both ports listen only on `127.0.0.1`; if they are taken, choose others with `--http-port` and `--https-port`.
- The certificate is issued by Caddy's internal CA: no public certificate is requested and no HSTS header is sent. The install script exports the root certificate to `<install directory>/local-ca.crt` and uses it to verify HTTPS in its own checks, rather than skipping certificate verification.
- Your browser warns that the certificate is not trusted on the first visit. You can accept the warning and continue, or import `local-ca.crt` into your system or browser certificate trust settings first; remove it again when you finish the trial. On macOS:

  ```sh
  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$HOME/tixxin-blog/local-ca.crt"
  ```

- When not run as root, `/usr/local/bin/tixxin` is not created; use the full path for the management command, for example `"$HOME/tixxin-blog/deploy/tixxin" status`.
- To pause the trial, run `docker compose stop` in the install directory; the volumes are kept. Only when you are sure you no longer need the trial data, run `"$HOME/tixxin-blog/deploy/tixxin" uninstall` to delete the containers, volumes, network and the whole install directory (including any backups in it); you confirm by typing the project name. The command only works on a local trial site and refuses to run on a production site.

## Day-to-Day Management

In a production installation `.env` is readable only by root, so the management command needs `sudo`. Every subcommand supports `--help`; `update`, `rollback`, `reset-password` and `uninstall` ask for confirmation, and `--yes` skips it. The command output is in Chinese.

```sh
sudo tixxin status
sudo tixxin logs backend --tail 100
sudo tixxin logs edge -f
sudo tixxin backup
sudo tixxin update
sudo tixxin rollback 0.3.0 --database-compatible
sudo tixxin restart
sudo tixxin reset-password
sudo tixxin help
```

| Command                                    | Purpose                                                                                                                                                                                                                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`                                   | Shows the install directory, project name, current version, site URL and service states, and runs one entry check                                                                                                                                                                            |
| `logs`                                     | Shows logs, the last 200 lines by default, `-f` to follow; services are `postgres`, `backend`, `frontend`, `edge`, `worker` and `migration`                                                                                                                                                  |
| `backup`                                   | Creates and verifies a full backup (a consistent database snapshot plus registered media) inside the worker image, exports it to `<install directory>/backups` and keeps the same copy in the volume. Backups contain private drafts and password hashes; move them to a controlled location |
| `update [version]`                         | Takes a full backup, then downloads and verifies the new package, pulls images, stops writes, migrates, recreates services and checks the entry. Without a version it uses the latest stable release; the current version repairs configuration or recreates containers                      |
| `rollback <version> --database-compatible` | Application rollback: takes a full backup, then switches to the images and compose files of the given older version without running migrations, keeping volumes. `--database-compatible` states that you have confirmed the version is compatible with the current database                  |
| `restart`                                  | Restarts the API, frontend and entry point (plus a running worker) and waits for health checks                                                                                                                                                                                               |
| `reset-password`                           | Reads a new password twice with hidden input (at least 6 characters) and revokes all sessions of that administrator; with several administrators, choose one with `--user <username>`                                                                                                        |
| `uninstall`                                | Local trial only: deletes the containers, volumes, network and install directory (including backups) after you type the project name; refused on a production site                                                                                                                           |

Replace `0.3.0` in the example with the version you actually want to roll back to. When an update or rollback fails, the command keeps everything in place and prints the failed stage, troubleshooting commands and the matching rollback command. An application rollback does not replace data recovery; to return to the data as it was at backup time, see [Backup and Recovery](../backup-and-recovery.md) (in Chinese). Apart from `uninstall` on a local trial, no subcommand ever runs `docker compose down -v`.

Scheduled full backups need the worker enabled separately; see [automatic full backups](../operations.md#自动完整备份) (in Chinese).

## Networks in Mainland China

If the server reaches GitHub or GHCR slowly or not at all, you can replace the deployment package and images with sources you prepare yourself:

```sh
sudo bash install.sh --version 0.3.0 --download-base https://mirror.example.com/tixxin-blog --registry registry.example.com/tixxin/tixxinblog
```

- `--download-base` replaces the deployment package source and accepts only `https://` or `file://`. The script downloads `tixxin-blog-<version>.tar.gz` and `SHA256SUMS` from `<address>/v<version>/` and verifies SHA256 as usual. Sync those two files from the Release into your source using that layout; you also need to obtain `install.sh` itself from a place you can reach.
- `--registry` replaces the prefix `ghcr.io/tixxin/tixxinblog` of the four application images, which become `<prefix>-web`, `<prefix>-api`, `<prefix>-migration` and `<prefix>-worker`, still tagged with the version. Sync the four images of that version from GHCR into the registry beforehand.
- The two dependency images for PostgreSQL and Caddy (`POSTGRES_IMAGE` and `CADDY_IMAGE` in `.env`, `postgres:16-alpine` and `caddy:2-alpine` by default) come from Docker Hub and are not affected by `--registry`. To speed them up, configure a registry mirror of your own choosing for the Docker daemon, or load all six images beforehand and use `--no-pull`.
- When using `--download-base`, also state the version with `--version`. Both addresses are written to `.env` and reused by `tixxin update`; with a custom download source, updates also need an explicit version, for example `sudo tixxin update 0.3.0`.
- You must prepare and vet any registry mirror or image sync yourself. This documentation recommends none, and the script has no third-party site built in. The package is always verified against `SHA256SUMS`, but both come from the same source, so the source itself must be trustworthy.
- Servers in mainland China that serve a website under a domain usually need ICP filing first; otherwise the provider may block traffic on 80/443 and certificates cannot be issued.

## Non-Interactive Installation

`--yes` skips every prompt and uses defaults for anything not given; a production installation must also pass `--domain`:

```sh
sudo bash install.sh --yes --domain blog.example.com --locale en --dir /opt/tixxin-blog
```

| Option                  | Description                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `--yes`                 | Do not prompt; use the options and defaults                                                                       |
| `--domain DOMAIN`       | Site domain                                                                                                       |
| `--locale zh-CN\|en`    | Default site language, `zh-CN` by default                                                                         |
| `--dir DIR`             | Install directory, `/opt/tixxin-blog` by default; `~/tixxin-blog` for `--local` as a regular user                 |
| `--version VERSION`     | Pinned version to install; defaults to the release the script belongs to                                          |
| `--registry PREFIX`     | Replace the application image prefix; see [Networks in Mainland China](#networks-in-mainland-china)               |
| `--download-base URL`   | Replace the deployment package source; see [Networks in Mainland China](#networks-in-mainland-china)              |
| `--local`               | Local trial mode                                                                                                  |
| `--http-port PORT`      | Host HTTP port (80 for production, 8080 for a local trial)                                                        |
| `--https-port PORT`     | Host HTTPS port (8443 for a local trial); must be 443 for production                                              |
| `--project NAME`        | Compose project name, `tixxin-production` by default; it determines volume names and cannot change after install  |
| `--subnet CIDR`         | Internal network subnet, `172.31.250.0/24` by default; give each site on the same host its own range              |
| `--check-public-ip URL` | Also query this https address for the public IP to check DNS; off by default, and it exposes this host's IP to it |
| `--no-pull`             | Use images already on the host; do not pull                                                                       |
| `--install-docker`      | Run Docker's official install script without asking when Docker is missing                                        |

In non-interactive mode a missing Docker is not installed automatically; pass `--install-docker` as well. The output of `bash install.sh --help` (in Chinese) is the authoritative usage.

## Security Notes

- **Keep `.env` safe**: `<install directory>/.env` holds the database password, signing secret and setup token. If it is lost, you cannot connect to the existing database or restore the site. Store a copy in a controlled location and never commit it to Git or send it to anyone.
- **Do not leak the setup link**: until the owner account exists, anyone with the link can create the account first. While you keep the link, do not screenshot, forward or paste it anywhere public; the install log `<install directory>/logs/install-*.log` also records it (readable only by root). The token stops working once the account is created.
- **Understand HSTS**: the Caddy template sends `Strict-Transport-Security: max-age=86400` (no subdomains, no preload). Browsers that receive it use only HTTPS for the site for one day and cannot fall back to HTTP if the certificate breaks. Watch automatic certificate renewal first; after one or two stable weeks, lengthen the period in `deploy/Caddyfile` as described in [Optional Worker and Operational Monitoring](deployment.md#optional-worker-and-operational-monitoring).
- Never use `docker compose down -v` to deal with a fault; it deletes the data volumes.

## FAQ

### The Domain Does Not Resolve Yet

If the installer warns that the domain has no DNS records yet, or that it resolves to addresses different from this host's interfaces, the domain does not point at this server yet (the latter can be ignored behind a CDN or proxy). The script only warns, but certificates require the domain to resolve to this host. When the server sits behind NAT with no public address on its interfaces, the script cannot tell; compare against the public IP shown in your cloud provider's console.

After fixing DNS and waiting for it to propagate, Caddy retries issuance automatically; check with `sudo tixxin status`. If installation stopped at the entry check, continue with a same-version update as the installer suggests (replace `0.3.0` with the installed version):

```sh
sudo tixxin update 0.3.0
```

### A Port Is Already in Use

When the installer reports that port 80 or 443 is in use, find the program holding it, stop it and run the installation again:

```sh
sudo ss -ltnp '( sport = :80 or sport = :443 )'
```

A production installation must use HTTPS port 443. A local trial can switch ports with `--http-port` and `--https-port`. If the port is held by the OpenResty/Nginx of a panel such as 1Panel or BT Panel, do not just stop it; see [Servers with an existing panel or reverse proxy](deployment.md#servers-with-an-existing-panel-or-reverse-proxy-such-as-1panel).

### The Certificate Is Not Issued

Check in order: DNS points at this host, the firewall and security group allow 80/443, the server clock is correct, and servers in mainland China have ICP filing. Then read the entry logs:

```sh
sudo tixxin logs edge --tail 200
```

Do not delete the certificate volume to request again; repeated failures hit the certificate authority's rate limits. Caddy retries after the fix; see [HTTPS certificate errors](../troubleshooting.md#https-证书错误或无法签发) (in Chinese).

### Internal Subnet Conflict

If startup fails with `Pool overlaps with other one on this address space`, the default internal subnet `172.31.250.0/24` overlaps an existing network on the host. If you know about the conflict before installing, choose an unused private range:

```sh
sudo bash install.sh --subnet 172.31.251.0/24
```

If installation has already failed for this reason, the install directory exists and a new installation is refused; switch the subnet with a same-version update instead. A first installation has no data yet and its database cannot start, so skip the pre-update backup:

```sh
sudo tixxin update 0.3.0 --subnet 172.31.251.0/24 --skip-backup
```

For a site that was running normally, drop `--skip-backup`. The command recreates this project's network and keeps the volumes. To install another site on the same host, change `--dir`, `--project` and `--subnet` together.

### Forgotten Password

```sh
sudo tixxin reset-password
```

Enter the new password twice with hidden input; every signed-in device must sign in again. With several administrators, add `--user <username>`.

### Lost Setup Link

The setup token is stored as `SETUP_TOKEN` in `.env`. As long as no administrator has been created, read the token and open `https://<domain>/setup?token=<token>` again:

```sh
sudo grep '^SETUP_TOKEN=' /opt/tixxin-blog/.env
```

Once an account exists the wizard no longer opens; if you forgot the password, use `tixxin reset-password`.

### The Install Directory or Volumes Already Exist

The script never overwrites an existing site. Upgrade an existing site with `sudo tixxin update`; to install another site on the same host, change `--dir` and `--project`.

For other faults (502, 429, migrations, memory), see [Troubleshooting](../troubleshooting.md) (in Chinese).
