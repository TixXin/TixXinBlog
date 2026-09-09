# 内容服务故障与恢复

2026-09-08 用户报告首页、归档和闪念同时加载失败。本机前端正常运行，但其配置指向的 `127.0.0.1:3000` 没有后端进程监听；同源文章请求返回 502，直接连接后端为 `ECONNREFUSED`。原 PostgreSQL 容器仍健康，已有 `.env.local` 配置完整。本次使用原配置恢复后端开发服务，没有迁移、补种、重置数据库或切换 Mock。

## 日常启动与排查

真实接口模式需要 PostgreSQL、后端和前端同时运行。在完成[后端初始化](../src/backend/server-main/README.md)后，从仓库根目录的两个终端分别运行：

```bash
corepack pnpm dev:api
corepack pnpm dev
```

`dev` / `dev:blog` 只启动前端。`dev:api` 使用后端已有的 `start:dev`，从 `src/backend/server-main/.env.local` 读取本机配置。已有数据库不要重复 seed。

| 检查 | 默认地址或位置 | 意义 |
| --- | --- | --- |
| 后端就绪 | `http://127.0.0.1:3000/ready` | 确认 API 与数据库可用 |
| 前端同源网关 | `http://localhost:3456/api/v1/posts?pageSize=1` | 确认浏览器实际使用的完整请求链路 |
| 后端配置 | `src/backend/server-main/.env.local` | 检查 `PORT`、`DATABASE_URL` 与 PostgreSQL 映射端口一致 |
| 前端配置 | `src/frontend/web-blog/.env` | 服务端 `NUXT_API_BASE_URL` 指向后端；公开 `NUXT_PUBLIC_API_BASE_URL=/api/v1` |

使用自定义端口时替换以上地址。若就绪探针连接被拒绝，先查看后端终端是否退出或启动失败；探针成功但同源请求失败时，检查前端网关配置，修改 `.env` 后重启前端。不要把接口地址改成直连浏览器的跨域地址，也不要用演示数据掩盖真实服务故障。

## 页面修复

- 首页首次失败使用正文内的明确反馈和重试按钮；已有列表的后续失败继续保留原内容。首页重试会同时恢复已失败的标签和分类。
- 归档增加原地重试，并将首次不可用、刷新失败及真实空归档分开。共享统计保留最后成功结果，首次失败不显示虚假零统计；缓存与监听在 `await` 前初始化，保持 SSR 上下文。
- 闪念公开与管理请求共用可读错误处理，不显示 FetchError 中的请求地址。加载失败与空列表互斥；没有成功读取数据时统计显示未知，搜索无结果使用筛选提示。
- 闪念主列表和归档箱分别维护等待、失败、重试状态。刷新保留现有笔记组件及未提交内容；切换身份清理旧身份数据，归档请求通过版本检查忽略失效结果。发布失败保留编辑草稿，不自动重试写入。
- 新增 `dev:api` 入口，并修正启动说明中未实现的 Worker 命令和过时的前端 API 地址。

## 验证方式

产品检查使用独立源码、Nuxt 构建目录和测试数据库；断连代理只连接隔离服务。用户开发服务仅进行公开页面检查，保持原内容数据与已有配置。正式回归位于 [service-recovery.spec.ts](../src/frontend/web-blog/tests/e2e/service-recovery.spec.ts)，单测见 [postMetadata.test.ts](../src/frontend/web-blog/tests/unit/postMetadata.test.ts) 和 [flashRepositoryHttp.test.ts](../src/frontend/web-blog/tests/unit/flashRepositoryHttp.test.ts)。

截图、原始日志、故障代理与机器报告仅保留在本机 `.artifacts/service-recovery/` 和 `.codex/service-recovery/`，不进入 Git，遵循[验收产物管理](verification-artifacts.md)。Windows WebKit 结果代表浏览器引擎回归，不等同于实体 Safari 或真机手机。
