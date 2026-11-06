---
name: tixxinblog-dev-session
description: 在 TixXinBlog 启动、复用、停止或排查本地开发服务，使用 macOS 可见 Terminal.app 显示前后端日志；适用于运行项目、本地预览、端口冲突和多页面 502。不用于无需长期服务的构建、lint 或单测。
---

# TixXinBlog 开发会话

参考 PhotoNexusFlow 的可见终端工作方式，实际使用 TixXinBlog 已有的统一启动器。所有命令从项目根目录执行；具体配置和运行契约见根目录 `docs/development.md`。

## 启动与复用

1. 先检查 `git status --short` 与 `corepack pnpm dev:check`，核对当前配置、数据库目标和服务归属；不要输出连接密码或令牌。
2. 两端已就绪时直接复用自检输出的地址，不为同一服务再开窗口。自检非零时先区分未运行、数据库故障、端口冲突或待迁移。
3. 配置正确、需要启动时，macOS 执行 `corepack pnpm dev:terminal`，让长期服务显示在用户可见的 Terminal.app 中。不要把长期服务藏在代理工具的后台执行会话里。其他系统在本地终端运行 `corepack pnpm dev:all --logs`。
4. 观察终端输出并再次运行 `corepack pnpm dev:check`；窗口创建成功不等于服务已就绪。只有 API `/ready` 与前端同源业务接口通过后才报告启动成功。
5. 服务在运行却坏了（页面模块报错、依赖或补丁升级后未生效）时，由发现的会话用 `corepack pnpm dev:terminal --service=<api|web> --restart` 恢复：只停本启动器在 `.artifacts/dev/*/session.json` 登记的进程再重开，手动起的进程不碰；恢复后自检并告知其他会话。

终端入口先启动或复用后端，再启动前端，各用一个独立窗口（标题分别为后端 API、前端网站），默认在首块副屏左侧一列上下排列（未连接副屏时使用主屏），后端在上、前端在下，不层叠遮挡。单独启动或恢复使用 `corepack pnpm dev:terminal:api` / `corepack pnpm dev:terminal:web`。已就绪的服务直接复用，不重复开窗。每端独立保留 `.artifacts/dev/<会话>/` 日志与 `session.json`（PID、mode、会话与复用状态）。成功巡检静默，普通请求与错误日志保留。

```sh
corepack pnpm dev:terminal --help
corepack pnpm dev:terminal --dry-run
corepack pnpm dev:terminal
corepack pnpm dev:terminal:api
corepack pnpm dev:terminal:web
corepack pnpm dev:check
```

`--dry-run` 只预览命令。新窗口读取自己的终端环境与项目已有 `.env` 文件；调用方临时业务变量不转发，Node、pnpm 和 PATH 路径会转交。需要临时覆盖时，在本地终端设置变量后分别执行 `corepack pnpm dev:session:api --logs` / `corepack pnpm dev:session:web --logs`，不为测试改写环境文件。

## 退出与故障

- 在对应可见终端按 Ctrl+C，只停止该会话创建的服务及后代；另一端、复用服务与 PostgreSQL 保留。后端临时停止时前端保留进程并报告未就绪，恢复后继续工作；前端首次启动仍要求 API 可用。退出或崩溃后保留窗口用于查看输出。
- 不按端口直接 kill，不自动结束其他会话。端口冲突时根据实际端口运行 `lsof -nP -iTCP:<端口> -sTCP:LISTEN`，核对归属后决定下一步。
- 数据库连接失败或有待迁移时报告具体阻塞；不得自动迁移、seed、reset、改密码或清库。数据库写入遵循根目录 AGENTS.md。
- 多栏目 502 时检查 API `/ready` 和前端同源 `/api/v1/posts`，恢复真实链路，不切 Mock。
- Terminal.app 权限被拒绝时如实报告，提供手动在两个终端分别运行 `corepack pnpm dev:session:api --logs` / `corepack pnpm dev:session:web --logs` 的路径；不静默退回后台启动。

报告实际动作（启动、复用、停止或阻塞）、自检得到的地址、是否就绪，以及本次日志和状态文件路径。不要照搬 PhotoNexusFlow 的端口、registry、gateway、dev:start 或 dev:stop 命令，本项目未实现这些入口。
