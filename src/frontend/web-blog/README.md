# TixXinBlog 前端

Nuxt 4 + Vue 3 + TypeScript，使用 pnpm 9.15.0。开发地址为 http://localhost:3456。

## 本地开发与真实业务

1. 在仓库根目录执行 `pnpm install`（已安装时无需重复）。
2. 按 [后端说明](../../backend/server-main/README.md) 准备 PostgreSQL、环境与迁移。
3. 首次将本目录 `.env.example` 复制为 `.env`；已有配置保留。根目录运行 `corepack pnpm dev:check` 和 `corepack pnpm dev:all`。
4. 打开首页进入文章，填写游客身份后即可发表评论、三级回复和点赞。

| 变量                                             | 作用                                       |
| ------------------------------------------------ | ------------------------------------------ |
| `NUXT_PUBLIC_POST_USE_MOCK_REPO=false`           | 文章列表、详情、评论读写使用真实 API       |
| `NUXT_PUBLIC_USE_MOCK_REPO=false`                | 闪念使用真实 API；显式 true 才启用演示仓库 |
| `NUXT_API_BASE_URL=http://localhost:3000/api/v1` | 仅服务端使用的后端连接地址                 |

文章域未单独设置时兼容原全局开关。朋友圈始终通过真实 API 持久化，入口为 `/moments` 和 `/admin/moments`，详见[业务说明](../../../docs/moment-business.md)。标签页仓库明确保持 LocalStorage 实现；各域 HTTP 失败展示错误，不会回退 Mock。

游客昵称与头像随评论发送并公开展示；其他身份表单字段保留在浏览器。设备 ID 沿用 `tixxin-visitor-id`，通过 `X-Visitor-Id` 发送，后端保存哈希。SSR 读取公共评论，客户端挂载后恢复个人点赞状态。管理员使用真实账号登录 `/admin`，访问令牌仅在运行时内存中持有。

评论输入支持 1–1000 个字符，根评论及两级回复共三层。发送失败保留草稿；若连接在响应前中断，先刷新评论确认是否已写入，再决定重试。请求期间禁止重复操作，不宣称跨断线重试具备幂等保证。

## 检查命令（仓库根目录）

```sh
pnpm lint
pnpm --filter web-blog exec nuxt typecheck
pnpm --filter web-blog test
pnpm build
```

当前范围与验收见[阶段记录](../../../docs/archive/content-history/next-stage.md)，早期文章评论联调过程保留在[历史记录](../../../docs/archive/admin-history/comment-integration-validation.md)，后续工作见 [todo.md](todo.md)。

## 管理后台与公开配置

后台集成在 `/admin`，复用前台开发进程，不需要第三个独立 dev 端口。可使用文章/闪念/朋友圈管理、评论审核、媒体库、分类标签与站点设置。站点资料保存后无需重启，公开页面刷新后读取新版本；配置冲突需比较合并，历史恢复生成新版本。审核开关只影响新的游客评论，未配置任何邮件/消息通知渠道。

浏览器始终通过同源 `/api/v1` 网关访问后端；`NUXT_PUBLIC_API_BASE_URL` 保持 `/api/v1`。站点规范地址使用 `NUXT_PUBLIC_SITE_URL`，运行配置修改后重启。生产构建和隔离回归优先使用根目录的 `corepack pnpm` 命令。

内容保护、批量回收与评论/站点配置的历史验收见[长期维护进度](../../../docs/archive/admin-history/admin-long-term-progress.md)。会话审计、内容包及完整备份恢复已实现；当前实际能力与边界以[能力清单](../../../docs/capability-map.md)为准。

开发使用 .nuxt，生产中间产物使用 .nuxt-production；build 不再覆盖正在运行的 dev 中间目录。
