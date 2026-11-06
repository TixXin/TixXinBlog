# 待办与已调研方向

这里记录已经调研、尚未排期的方向，后续会话直接沿用其中的结论，不重复调研。每条只写结论、约束、待定问题和第一步，不记录进度或完成率。开工后把结论转入设计稿或正式文档，并删除对应条目，历史通过 Git 追溯。

外部事实注明核实方式：“官方”表示已打开官方页面核对，“摘要”表示只来自搜索摘要或第三方文章。标为会变的价格、额度、版本和项目状态，动工前复核。

## Git 内容仓库（静态发布的仓库为准用法）

状态：仓库格式与「后台为准」的导出、打包已实现，见[内容仓库](content-repo.md)；本条目只保留尚未实现的「仓库为准、由 CI 构建」，记录于 2026-10-27，2026-11-05 更新。

### 背景

静态发布第一版从运行中的后端导出构建产物，写作仍在后台完成。希望进一步支持直接在 Git 仓库里写 Markdown，推送后由 CI 构建，不需要长期运行的后端。

### 结论

- 仓库格式就是内容包的文件化表达，已由 `content:repo` 实现并保证往返无损；版本跟随内容包（当前 v20），校验复用后台内容包规则。
- 同一站点只认一个事实源，不做双向同步。后台为准时导出仓库；仓库为准时由 CI 构建，回到服务器部署时从仓库迁入。
- CI 构建不重写后端：在 CI 里起一次性 PostgreSQL 与 API，把仓库打成内容包载入后运行现有 `static:build`，分享卡片、图片变体、搜索与归档沿用后端实现，构建结束即丢弃。
- 阻塞点在载入方式：现有迁入一律分配新编号并存为草稿，静态站会缺页且地址变化。需要新增仅限空库的「站点重建」载入：保留来源编号、发布状态与时间、地址和关系，只在 worker 维护命令中提供，不进后台界面；目标库已有任何内容时拒绝。
- 媒体以 UUID 与 SHA-256 为身份，登记在 `media/index.yaml`，打包时逐个核对（已实现）。从仓库迁回已有后台时走普通迁入：新编号、`skip` 去重，编号冲突由迁入的关系映射处理，不需要额外规则。
- 写作工具用 VS Code 或 Obsidian；需要网页编辑时优先选 Sveltia CMS、Decap CMS 这类不绑定框架的 Git CMS。

### 待定问题

- 仓库里新增图片：尺寸与真实格式需要解码，计划在 CI 载入时由后端补齐并回写 `media/index.yaml`，还是提供本机 `content:repo media add`（需要图片解码依赖）。
- 文章历史地址不在内容包里，仓库为准时旧地址的跳转如何表达。
- 「站点重建」载入的空库判定范围（是否允许已有站点资料与管理员）与重复执行的幂等规则。

### 第一步

后端新增空库专用的站点重建维护命令，复用内容包解析与校验，用本机隔离库验证载入后 `static:build` 的页面、地址与统计和后台为准时一致。

### 外部事实

| 事实                                                                                                                                                                                                                                             | 核实 | 会变 | 来源                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EdgeOne Pages 文档现归在 EdgeOne Makers 名下。免费版每月 500 次构建、Edge Functions 300 万次、云函数（Node.js 等）100 万次；KV 与 Blob 各 1GB；单项目最多 2 万个文件，单文件最大 25MB，总存储 5GB；`edgeone.json` 最多 100 条重定向、30 条响应头 | 官方 | 是   | [配额与限制](https://pages.edgeone.ai/document/limits-and-quotas)                                                                                                      |
| Nitro 内置 EdgeOne 预设 `edgeone_pages`                                                                                                                                                                                                          | 官方 | 否   | [Nitro](https://nitro.build/deploy/providers/edgeone)                                                                                                                  |
| EdgeOne 加速区域包含中国大陆时，域名需要 ICP 备案                                                                                                                                                                                                | 摘要 | 是   | [EO 接入文档](https://cloud.tencent.com/document/product/1552/87601)                                                                                                   |
| Cloudflare Pages 文档建议新项目从 Workers 起步，Pages 仍可使用                                                                                                                                                                                   | 官方 | 是   | [Pages 文档](https://developers.cloudflare.com/pages/)                                                                                                                 |
| Workers 免费版每天 10 万次请求、单次 10ms CPU、128MB 内存；D1 免费 5GB；R2 免费 10GB，出站流量不计费                                                                                                                                             | 摘要 | 是   | [Workers 套餐](https://workers.cloudflare.com/plans)、[D1](https://developers.cloudflare.com/d1/platform/pricing/)、[R2](https://developers.cloudflare.com/r2/pricing) |
| Nuxt Content 在 Cloudflare 上做 SSR 需要 D1；纯静态部署会把内容数据库下发到浏览器                                                                                                                                                                | 官方 | 是   | [Workers 部署](https://content.nuxt.com/docs/deploy/cloudflare-workers)、[静态部署](https://content.nuxt.com/docs/deploy/static)                                       |

## 后台一键升级（网页触发 tixxin update）

状态：已调研，未排期，记录于 2026-11-06。后台目前只显示版本、新版本提示与升级命令，升级仍在服务器上手动执行。

### 背景

维护者希望在后台版本弹窗里点一下就把一键安装的站点升级到选定版本，不再登录服务器。

### 结论

- 不挂 Docker socket，也不经 socket 代理：挂载 socket 等同宿主机 root，`:ro` 无效，代理本身仍持有真实 socket；API 或后台账号一旦失守即可控制宿主机上的全部容器。Coolify（辅助容器挂 socket）、Home Assistant Supervisor（特权容器）都属这一类。
- 采用「应用写请求、宿主机执行」：API 只在一个专用目录写 `request.json`，宿主机 systemd `.path` 单元监听后由 root 运行 `tixxin` 的受限子命令，再调用现有 `tixxin update <版本> --yes`（备份、SHA256 校验、迁移、验收都沿用）。与社区项目 HA Container Updater 的做法一致。
- 请求只携带版本号：严格按语义化版本校验，不拼进 shell；只允许升级，降级与回退仍只在命令行；与手动命令共用 `.tixxin.lock`，上一次未结束或 10 分钟内已升级时拒绝。
- 进度写 `status.json` 与日志；以 `tixxin update` 的退出码判定成败，不能像 Coolify #11571 那样在 `compose up` 失败后仍报成功。升级期间前端与 API 会重启，后台弹窗轮询健康检查与版本头，恢复后读取结果。
- 默认关闭，`tixxin agent enable` 开启并在 `.env` 写入开关；发起升级要求 5 分钟内重新输入密码，并写审计日志。只支持有 systemd 的 Linux，其余形态保留「复制命令」。

### 待定问题

- 部署包、镜像下载慢的站点（如国内服务器需中转镜像）如何配合：检测到本地已有目标镜像时带 `--no-pull`，还是要求先配置镜像代理。
- 代理脚本放进 `deploy/tixxin` 还是独立文件，以及部署包文件清单与安装冒烟（`install-smoke.sh`）的覆盖方式。

### 第一步

在本机试装（`corepack pnpm trial`）上手工搭 `.path` + `.service`，验证写入请求、升级成功、升级失败三种情况下的状态文件与后台展示，再决定接口与命令的最终形态。

### 外部事实

| 事实                                                                                           | 核实 | 会变 | 来源                                                                                                                       |
| ---------------------------------------------------------------------------------------------- | ---- | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| Discourse 由 docker_manager 插件提供 `/admin/update` 网页升级，失败时回到 `./launcher rebuild` | 摘要 | 是   | [docker_manager](https://github.com/discourse/docker_manager)                                                              |
| Coolify 网页升级由挂载 Docker socket 的辅助容器运行 `upgrade.sh`                               | 摘要 | 是   | [升级文档](https://next.coolify.io/docs/get-started/upgrade)、[#11571](https://github.com/coollabsio/coolify/issues/11571) |
| HA Container Updater 不挂 socket，容器写触发文件，宿主机 systemd 服务执行 compose 升级         | 摘要 | 是   | [社区帖](https://community.home-assistant.io/t/ha-container-updater-supervisor-style-updates-for-docker-users/1019584)     |
| Docker socket 代理按 API 分区放行，但代理自身持有真实 socket                                   | 摘要 | 否   | [docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy)                                                    |
