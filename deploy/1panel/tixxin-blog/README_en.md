## Introduction

TixXinBlog is a personal blog for a single author: the public site and the `/admin` panel ship together, and posts, notes, moments, guestbook, gallery, projects and friend links are stored in a bundled PostgreSQL. After installation you create the author account in a browser setup wizard, no command line needed.

## Features

- Posts, notes, moments, guestbook, gallery, projects and friend links, with three switchable themes
- Built-in admin: drafts and revisions, comment moderation, media library, content package export and restore
- Simplified Chinese and English interface; visitors can switch on their own
- Per-visitor rate limiting, Secure cookies and a one-time setup token

## Installation

The app has no HTTPS entry of its own; 1Panel Websites (OpenResty) handles the domain and certificate. Install OpenResty from the 1Panel App Store first and point your domain at the server.

1. To install it as a local app, upload the whole `tixxin-blog` directory to `/opt/1panel/resource/apps/local/` (replace `/opt` if 1Panel lives elsewhere), then click "Sync Local App" in the App Store ("Sync" on 1Panel v1).
2. The install form asks for three things only:
   - **Site domain**: the bare domain such as `blog.example.com`, without `https://` or a path;
   - **Site language**: Simplified Chinese or English; visitors can still switch in the interface;
   - **HTTP port**: the container listens on this port on `127.0.0.1` only and is not reachable from outside.
3. The database password, signing secret and setup token are generated randomly on the server by the install script and stored in `data/secrets/` inside the app directory; they are not form fields. Leave "External access" in the advanced settings unchecked: the compose file always binds `127.0.0.1`, so checking it does not expose the port.

## Website and HTTPS

1. In 1Panel Websites, create a "Reverse proxy" website whose primary domain is the site domain and whose proxy address is `http://127.0.0.1:<HTTP port>`.
2. Under the website's HTTPS settings, request or upload a certificate, enable it and redirect HTTP to HTTPS. The site must be served over HTTPS: the login cookie is `Secure`, so signing in over plain HTTP fails.
3. Keep 1Panel's default proxy headers (`Host`, `X-Forwarded-For`, `X-Forwarded-Proto`); do not hard-code or remove them. The app relies on them to identify visitor IPs and HTTPS requests.

OpenResty runs on the host network and reaches the app port through `127.0.0.1`, so the app sees the gateway of its own internal network as the peer. The install script picks a free private subnet for the app (recorded in `data/network.env`, `172.31.250.0/24` by default). The frontend and API trust proxies inside that subnet only and take the visitor address that OpenResty appended to `X-Forwarded-For`; a forged `X-Forwarded-For` from a visitor has no effect. With a CDN in front of the site, the visitor address will be the CDN node.

## Create the author account

Once the website and certificate are ready, open the setup link:

```text
https://<site domain>/setup?token=<SETUP_TOKEN>
```

The link is printed at the end of the 1Panel install log. The token is also stored in `data/secrets/app.env` in the app directory (Installed → this app → "Open the installation directory"), as the value after `SETUP_TOKEN=`. Choose a username, a password (12–128 characters) and a site name, then sign in at `/admin/login`. The wizard closes for good once the account exists, and the token stops working.

## Upgrades and backups

- Every start, rebuild or upgrade first runs the `migration` service to apply database migrations, and the API starts only after it finishes; with an up-to-date schema the migration is a no-op. The migration container stays idle after success, which is expected.
- **Always tick "Backup application before upgrade".** 1Panel stops the app and archives the whole app directory (database files, media and secrets all live under `data/`); if the upgrade fails, 1Panel rolls back from that backup automatically. Migrations change the database schema; going back to an older version requires restoring the data together with it.
- For routine backups use 1Panel app backups or a scheduled "Back up app" task; content packages exported from the admin "Backup" page can be kept separately.
- Uninstalling deletes the app directory, including the database and media. Back up first.
- Keep or restore `data/secrets/` and `data/postgres/` together: the database password is written only when the database is first initialized, so freshly generated secrets cannot connect to an existing database, and the script refuses that case.

## Notes

- The Caddy entry and the optional worker from the one-line installer are not included; use 1Panel scheduled tasks for backups, or deploy them separately for email notifications.
- 1Panel websites accept uploads up to 50 MB by default; raise `client_max_body_size` in the website configuration before restoring a content package close to 50 MB.
- HSTS can be enabled in the website's HTTPS settings; start with a short max-age while you watch certificate renewals.
- See the project documentation for further configuration and operations: <https://github.com/TixXin/TixXinBlog/tree/main/docs>
