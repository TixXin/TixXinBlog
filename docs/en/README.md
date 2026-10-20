# Documentation

[中文原文](../README.md) | **English**

Guides to using, developing and maintaining TixXinBlog. See the [root README](../../README.en.md) for an introduction and quick start. Commands reflect the current repository version; use the source code and tests to verify feature and API behavior.

The documentation index, quick start, development guide and deployment guide are available in English. The other guides linked below are currently in Chinese.

| Document                                                                     | Contents                                                                                                                                                       |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Five-minute deployment](quick-start.md)                                     | One-command install with the browser setup wizard, local trial, `tixxin` management and FAQ                                                                    |
| [Local development and testing](development.md)                              | Installation, configuration, migrations, service startup, development samples, build isolation, local build trial and validation                               |
| [Root scripts reference](../scripts.md) (Chinese)                            | Actual commands, purposes, arguments and boundaries of the scripts in the root `package.json`                                                                  |
| [Architecture and code entry points](../architecture.md) (Chinese)           | Workspaces, frontend/backend layers, data and permission boundaries, relationships and persistent task responsibilities                                        |
| [Content and admin guide](../content.md) (Chinese)                           | Site profile, writing and publishing, interactions, gallery/projects/links, media and content discovery                                                        |
| [API contract](../api.md) (Chinese)                                          | Authentication, responses, versioning, idempotency, content context and main business endpoints                                                                |
| [Backup and recovery](../backup-and-recovery.md) (Chinese)                   | v13 content package compatibility, import previews, full snapshots, isolated recovery and switching data sources                                               |
| [Deployment and version switching](deployment.md)                            | Two ways to deploy; for manual releases, prebuilt and self-built images, HTTPS, indexing and analytics, initialization, releases, rollbacks and local previews |
| [Operations, notifications and persistent tasks](../operations.md) (Chinese) | Actionable tasks, SMTP, runtime controls, backup execution, transfer and retention policies                                                                    |
| [Theme development](../themes.md) (Chinese)                                  | Theme contracts, metadata, host capabilities, switching, motion and validation                                                                                 |

For a first read, follow development → content → backup → deployment. Check the API and architecture guides before extending interfaces. Before maintaining external delivery, review the runtime task switches and how uncertain outcomes are handled.

Bookmarks and visitors' “我的订阅” (My subscriptions) are currently stored in browser LocalStorage. Visitor registration, bookmark cloud sync, public link applications and visitor email subscriptions are not available. Starting the HTTP service does not run migrations, seed data, clear the database or start persistent tasks. SMTP, automatic backups and the worker are disabled by default.

Documentation covers lasting operational procedures and contracts. Keep screenshots, runtime logs, performance samples, temporary scripts and raw test reports in locally ignored directories; see [Validation](development.md#validation) in the development guide.
