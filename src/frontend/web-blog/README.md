# TixXinBlog 前端

Nuxt 4 + Vue 3 + TypeScript，使用 pnpm 9.15.0。开发地址为 http://localhost:3456。

## 本地文章与评论联调

1. 在仓库根目录执行 `pnpm install`（已安装时无需重复）。
2. 启动 [后端及 PostgreSQL](../../backend/server-main/README.md)。
3. 将本目录 `.env.example` 复制为 `.env`，执行根目录的 `pnpm dev`。
4. 打开首页进入文章，填写游客身份后即可发表评论、三级回复和点赞。

| 变量                                             | 作用                                 |
| ------------------------------------------------ | ------------------------------------ |
| `NUXT_PUBLIC_POST_USE_MOCK_REPO=false`           | 文章列表、详情、评论读写使用真实 API |
| `NUXT_PUBLIC_USE_MOCK_REPO=true`                 | 保留闪念等其他域现有本地演示行为     |
| `NUXT_API_BASE_URL=http://localhost:3000/api/v1` | 仅服务端使用的后端连接地址           |

文章域未单独设置时兼容原全局开关。标签页仓库明确保持 LocalStorage 实现，尚未实现的 HTTP 占位不会因其他域联调而启用。文章 HTTP 失败会展示错误，不会回退 Mock。

游客昵称与头像随评论发送并公开展示；其他身份表单字段保留在浏览器。设备 ID 沿用 `tixxin-visitor-id`，通过 `X-Visitor-Id` 发送，后端保存哈希。SSR 读取公共评论，客户端挂载后恢复个人点赞状态。管理员使用真实账号登录 `/admin`，访问令牌仅在运行时内存中持有。

评论输入支持 1–1000 个字符，根评论及两级回复共三层。发送失败保留草稿；若连接在响应前中断，先刷新评论确认是否已写入，再决定重试。请求期间禁止重复操作，不宣称跨断线重试具备幂等保证。

## 检查命令（仓库根目录）

```sh
pnpm lint
pnpm --filter web-blog exec nuxt typecheck
pnpm --filter web-blog test
pnpm build
```

本轮范围、浏览器验收和已知限制见 [评论联调验收记录](../../../docs/comment-integration-validation.md)，后续工作见 [todo.md](todo.md)。

## 管理后台与公开配置

后台集成在 `/admin`，复用前台开发进程，不需要第三个独立 dev 端口。可使用文章/闪念管理、评论审核、媒体库、分类标签与站点设置。站点资料保存后无需重启，公开页面刷新后读取新版本；配置冲突需比较合并，历史恢复生成新版本。审核开关只影响新的游客评论，未配置任何邮件/消息通知渠道。

浏览器始终通过同源 `/api/v1` 网关访问后端；`NUXT_PUBLIC_API_BASE_URL` 保持 `/api/v1`。站点规范地址使用 `NUXT_PUBLIC_SITE_URL`，运行配置修改后重启。生产构建和隔离回归优先使用根目录的 `corepack pnpm` 命令。

内容保护、批量回收与评论/站点配置的最新验收见 [长期维护进度](../../../docs/admin-long-term-progress.md)。会话审计、完整备份恢复和统一体验仍属进行中的目标。

开发使用 .nuxt，生产中间产物使用 .nuxt-production；build 不再覆盖正在运行的 dev 中间目录。
