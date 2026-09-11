# TixXinBlog 全项目排查（2026-09-06）

> 历史归档：原文来自 `docs/project-audit-2026-09-06.md`，保留当时的设计、实施与验收事实。文中的阶段、版本、数量和“当前／下一步”不代表现状；现行入口见[文档导航](../../README.md)。本机验收产物仍按原仓库相对路径留存。

结论：项目已具备真实文章和评论链路，但仍处于增量接入阶段，尚不适合按“完整生产博客”验收。下一步优先完成安全与配置收尾，再统一文章数据源，然后交付最小创作后台。

本轮覆盖前端主要页面与数据层、全部后端业务模块、数据库实体/迁移、环境配置、CI/Docker及生产依赖树。采用静态审查、本地只读 HTTP 验证、浏览器导航、现有生产产物临时预览和无敏感凭据的日志探针。未修改业务代码，未进行压力测试、真实账号漏洞利用、外部账号操作或镜像推送。本轮没有重新执行全部构建/单测；此前已通过的 41/15 项测试不能代替本次安全审查。

发现 28 项问题：P1 8 项、P2 18 项、P3 2 项。P1 表示上线前优先处理，不代表本轮已经证明可被远程利用。每项明确标注证据强度。

## 01. P1 — JWT 密钥初始化早于环境文件加载

证据：运行验证。仅用 .env.local 配置密钥时，AuthModule 导入阶段已用开发默认值注册 JWT。隔离导入实测：环境文件后来有值，但 jwtUsesLoadedSecret=false、jwtUsesDevFallback=true。系统环境变量预先注入的部署不一定受此路径影响。ORM clientUrl 也在模块导入时读取，有同类配置时序风险。

位置：[src/backend/server-main/src/modules/auth/auth.module.ts](../../../src/backend/server-main/src/modules/auth/auth.module.ts)。

建议：先完成统一配置加载，再用异步模块工厂注入 JWT/ORM 配置；生产缺值直接拒绝启动，并加入环境文件加载回归。

## 02. P1 — 请求日志没有脱敏认证信息

证据：运行验证。向本地 /auth/me 发送无效测试标记，日志中能找到完整 Authorization 和 Cookie 标记。没有使用、展示或验证真实凭据。

位置：[src/backend/server-main/src/app.module.ts](../../../src/backend/server-main/src/app.module.ts)。

建议：配置日志 redact，覆盖 Authorization、Cookie、Set-Cookie；加入日志不包含测试令牌的断言。

## 03. P1 — MCP 配置含明文 API key

证据：静态确认。工作区 .mcp.json 的参数中存在 Context7 API key 格式的明文值。未验证其有效性，也未检查 Git 历史或远程传播情况。

位置：[.mcp.json](../../../.mcp.json)。

建议：将密钥移至本机环境或秘密配置；确认现存值是否有效和是否曾分享，必要时轮换。报告不复述密钥。

## 04. P1 — Docker 构建上下文未排除本地秘密文件

证据：静态确认。.dockerignore 不排除 .env* 和 .mcp.json。前端 COPY . .、后端 COPY src/backend/server-main 都会把对应文件带入构建层；是否进入最终镜像尚未逐层检查。

位置：[.dockerignore](../../../.dockerignore)。

建议：排除本地凭据，只保留 .env.example；用无秘密的干净构建上下文验证镜像内容。

## 05. P1 — 代码块高亮失败时存在 HTML 注入路径

证据：静态确认。fallbackHtml 直接把 props.code 插入 HTML，随后交给 v-html。高亮不支持某种语言或失败时，代码中的 HTML 会被当作标记。当前未构造执行脚本的攻击，也不将普通评论当作此入口。

位置：[src/frontend/web-blog/app/components/common/CodeBlock.vue](../../../src/frontend/web-blog/app/components/common/CodeBlock.vue)。

建议：兜底使用文本节点或 HTML 转义；测试不支持的语言及包含 HTML 的代码样例。

## 06. P1 — 登录和公开写接口缺少应用层限流

证据：静态确认。后端入口、业务模块及依赖中未发现限流实现，文档的限流表未落实。X-Visitor-Id 由客户端选择，不能单独作为防刷身份；不存在的用户名还会额外执行一次 argon2.hash。未进行压力测试。

位置：[src/backend/server-main/src/main.ts](../../../src/backend/server-main/src/main.ts)。

建议：给登录、评论和点赞设置按 IP/身份组合的速率限制，补充 429 验收；登录失败走预先计算的固定 dummy hash。

## 07. P1 — Refresh token 轮换不是原子消费

证据：静态风险，待并发实测。refresh 先读取未撤销记录，再设置 revokedAt 和创建新 token，没有行锁或条件更新。同一旧 token 的并发请求可能均通过检查；本轮未使用管理员账号进行真实并发登录。

位置：[src/backend/server-main/src/modules/auth/auth.service.ts](../../../src/backend/server-main/src/modules/auth/auth.service.ts)。

建议：用事务与行锁或原子条件更新保证旧 token 只成功消费一次；补数据库并发集成测试。

## 08. P1 — 依赖安全告警较多且 CI 不阻断

证据：依赖审计告警。本轮 pnpm audit --prod --json 汇总：Critical 4、High 47、Moderate 47、Low 13。Critical 包含 shell-quote、tar、seroval、@nuxt/devtools；审计依赖树包含开发/构建链，不能据此断言这些告警都能从生产入口利用。

位置：[.github/workflows/ci.yml](../../../.github/workflows/ci.yml)。

建议：分离运行时、开发服务和构建链，按实际可达性升级/消除告警；CI 对可达高危告警建立门禁，不采用盲目全部 override。

## 09. P2 — 公开闪念 feed 包含草稿和归档种子

证据：HTTP 验证。/flash.xml 和 /api/flash.json 均返回 flash-seed-08-mood-draft、flash-seed-04-archived。当前是演示种子，未证明真实私人内容泄露，但公开过滤语义已经错误。

位置：[src/frontend/web-blog/server/routes/flash.xml.ts](../../../src/frontend/web-blog/server/routes/flash.xml.ts)。

建议：统一公开数据查询，显式过滤草稿及不公开的归档项；RSS 与 JSON 共用过滤器。

## 10. P2 — Sitemap 缺少文章详情，反而收录内部页面

证据：生产产物验证。启动当前生产产物后读取 sitemap：12 个 URL，0 个 /articles/:id，包含 /admin/moments/new 和 /_theme-engine-devtools。

位置：[src/frontend/web-blog/nuxt.config.ts](../../../src/frontend/web-blog/nuxt.config.ts)。

建议：从真实公开文章生成动态 sitemap；排除管理页和调试页，验证新增/撤回文章后的结果。

## 11. P2 — 主题调试页在生产环境公开可访问

证据：生产浏览器验证。生产产物 /_theme-engine-devtools 返回 200，浏览器展示模块选项、主题映射和本机 contractsEntry 绝对路径。未测试任何写操作；这是主题引擎自己的页面，不等同于 Nuxt DevTools 的安全告警。

位置：[src/frontend/web-blog/nuxt.config.ts](../../../src/frontend/web-blog/nuxt.config.ts)。

建议：主题调试路由仅在开发时注册；生产请求应返回 404，不只从 sitemap 隐藏。

## 12. P2 — 前端认证与后台管理没有真实闭环

证据：功能缺口。登录仍调用 findMockAccount；注册构造内存用户；找回密码等待后直接提示已发邮件；社交登录仅 toast。后端已有 auth，但未与这些界面连接，文章管理 CRUD 仍在待办。

位置：[src/frontend/web-blog/app/components/auth/AuthLoginForm.vue](../../../src/frontend/web-blog/app/components/auth/AuthLoginForm.vue)。

建议：先明确博主后台登录与游客身份两条流程，完成真实登录/刷新/退出与文章草稿、发布、撤回；未实现操作明确禁用或标识。

## 13. P2 — 文章周边仍与数据库使用不同数据源

证据：静态确认。首页正文和评论已接 API，但搜索、归档、RSS、相关推荐、分类标签统计仍依赖 Mock。新文章不会自然进入所有入口，撤回文章也可能留在这些入口。

位置：[src/frontend/web-blog/app/components/common/SearchModal.vue](../../../src/frontend/web-blog/app/components/common/SearchModal.vue)。

建议：围绕公开文章服务统一取数，再回归搜索、归档、feed、统计与相关链接。

## 14. P2 — 文章超过 100 篇后会在前端列表中遗漏

证据：静态确认。fetchPostList 固定请求 page=1/pageSize=100 并丢弃 total，后续分页在这 100 条上进行。当前只有 50 篇，因此阈值问题未在当前数据库触发。

位置：[src/frontend/web-blog/app/features/post/api.ts](../../../src/frontend/web-blog/app/features/post/api.ts)。

建议：将分页、筛选、排序传入后端，保留 total；用超过 100 篇的隔离测试数据验收。

## 15. P2 — 上一篇/下一篇写死

证据：浏览器复现。在文章 2 页面，上一篇链接仍是 /articles/2，指向自己；两侧标题也写死。

位置：[src/frontend/web-blog/app/components/article/ArticleNav.vue](../../../src/frontend/web-blog/app/components/article/ArticleNav.vue)。

建议：根据当前文章及统一排序生成相邻文章，首尾无邻居时隐藏相应入口。

## 16. P2 — 文章点赞和浏览计数前端尚未接 API

证据：静态确认。文章详情点赞使用 localStorage 集合并在数据库计数上临时加 1；阅读没有调用后端 view 接口。与已完成的评论点赞是两套实现。

位置：[src/frontend/web-blog/app/composables/useLikes.ts](../../../src/frontend/web-blog/app/composables/useLikes.ts)。

建议：复用访客请求身份接通文章互动，定义持久化状态、计数一致性及浏览去重语义。

## 17. P2 — 文章/闪念点赞与浏览仍可能丢失并发增量

证据：静态风险，待并发实测。PostService 和 FlashService 采用读计数、内存加一、flush；唯一索引只能约束同一访客记录，不能保护不同访客同时更新计数。评论模块已加锁，但这些模块尚未同步。

位置：[src/backend/server-main/src/modules/post/post.service.ts](../../../src/backend/server-main/src/modules/post/post.service.ts)。

建议：使用原子增量或事务行锁；覆盖多访客点赞、取消及浏览计数并发测试。

## 18. P2 — 闪念博主 ID 契约不一致

证据：HTTP 验证。/flashes?userId=owner-001 返回 0，userId=tixxin 返回 20。前端默认博主是 owner-001，现存数据库归属为 tixxin。本轮前端按域保留本地模式，只是避免触发，尚未完成闪念 HTTP 联调。

位置：[src/frontend/web-blog/app/composables/useFlashNotes.ts](../../../src/frontend/web-blog/app/composables/useFlashNotes.ts)。

建议：统一站点所有者来源，并完成公开读取、管理员写入的权限与身份映射。

## 19. P2 — 健康就绪探针不能反映依赖故障

证据：静态确认。/ready 无数据库检查，直接构造 status=ok。即使业务数据库不可用，这段实现也无法报告未就绪；本轮未中断数据库。

位置：[src/backend/server-main/src/modules/health/health.controller.ts](../../../src/backend/server-main/src/modules/health/health.controller.ts)。

建议：就绪探针检测实际必需依赖，失败返回 503；与仅检查进程存活的 /health 分离。

## 20. P2 — 本地保存失败被吞掉

证据：静态确认。标签页 writeJson、闪念 writeAll 在 localStorage 容量超限或禁用时静默 catch，调用方仍可能显示成功。书签导入又分两次写入分类和书签，存在部分成功的不一致风险。

位置：[src/frontend/web-blog/app/features/tab/repository.local.ts](../../../src/frontend/web-blog/app/features/tab/repository.local.ts)。

建议：将保存失败传播至 UI；保留未保存内容，导入先验证并提供原数据备份/回滚。

## 21. P2 — 导入数据缺少字段和 URL 协议校验

证据：静态确认。JSON 导入只校验两个字段是数组；Netscape 导入直接接收 HREF。错误字段、未知格式版本和危险协议能进入仓库。未在用户浏览器中导入恶意文件。

位置：[src/frontend/web-blog/app/features/tab/export.ts](../../../src/frontend/web-blog/app/features/tab/export.ts)。

建议：加入完整 schema、文件大小/条数限制、版本校验和允许的 URL 协议；报告跳过或拒绝的条目。

## 22. P2 — 代码高亮缓存 key 会发生内容碰撞

证据：静态确认。useAsyncData key 只包含代码前 20 字符和语言。前缀相同、后半段不同的代码块会共享同一个 key，可能展示另一块的高亮内容。

位置：[src/frontend/web-blog/app/components/common/CodeBlock.vue](../../../src/frontend/web-blog/app/components/common/CodeBlock.vue)。

建议：使用完整内容的稳定哈希或唯一块 ID；测试同语言、同前缀的多个代码块。

## 23. P2 — Dock 移动导航缺少可访问名称

证据：前轮已复现，本轮静态复核。小屏隐藏 label，链接没有 aria-label；前轮 390px 快照中出现无名称链接。设置入口偶有点击无响应仍需进一步定位，不能直接认定根因。

位置：[src/frontend/web-blog/themes/dock/app/components/RootLayout.vue](../../../src/frontend/web-blog/themes/dock/app/components/RootLayout.vue)。

建议：提供持续存在的可访问名称，检查底栏溢出和触控范围，覆盖键盘及 390px 浏览器测试。

## 24. P2 — CI 尚未覆盖真实端到端业务链路

证据：静态确认。当前后端 4 个测试文件覆盖健康、访客哈希和评论；没有 auth/post/flash 的真实 HTTP 测试。前端 6 个测试文件主要是纯逻辑；浏览器联调过程没有固化为 CI 门禁。

位置：[.github/workflows/backend-ci.yml](../../../.github/workflows/backend-ci.yml)。

建议：用隔离 PostgreSQL 固化登录刷新、草稿权限、分页、评论和计数并发测试；增加关键浏览器流程。

## 25. P2 — 运行时 API 地址与 CSP 使用不同配置时机

证据：部署风险，待环境矩阵验证。API 基址可由 Nuxt runtimeConfig 环境变量覆盖，但 connect-src 在构建配置中由 process.env 拼接。构建和运行域名不同可能出现 SSR 能请求、浏览器被 CSP 拦截。前后端服务共用一个公开 API 基址也需在容器网络中验收。

位置：[src/frontend/web-blog/nuxt.config.ts](../../../src/frontend/web-blog/nuxt.config.ts)。

建议：明确构建/运行配置边界，考虑同源代理或分离服务端/浏览器地址；加入不同部署 origin 的验收。

## 26. P2 — 运行环境与发布检查基线不一致

证据：静态确认。根 engines 允许 Node>=20、前端 Docker 使用 Node20、CI/后端 Docker 使用 Node22，本机为 Node24；CI 注释还明确提到 Node20 的工具兼容问题。前端 CI 只做 Nuxt build，没有验证根 Dockerfile；本轮未运行镜像构建，因此不宣称镜像必然失败。

位置：[Dockerfile](../../../Dockerfile)。

建议：选定统一 Node 基线并验证前后端镜像、非 root 运行、迁移执行与重启恢复流程。

## 27. P3 — 仓库协作规则和阶段文档仍有冲突

证据：静态确认。MCP 配置/技能仍引用 E 盘，但仓库位于 D 盘；技能要求 AI 提交署名，与 AGENTS 的禁止要求冲突。旧架构文档仍有全 Mock、Prisma 等过时阶段说明。

位置：[.agents/skills/mcp/SKILL.md](../../../.agents/skills/mcp/SKILL.md)。

建议：统一路径、提交规范与已实现架构描述，区分目标设计和当前实现。

## 28. P3 — 文章标题样式选择器不匹配实际 DOM

证据：静态确认。class 直接加在 h2/h3 上，但 SCSS 写成 .article-content__heading 下嵌 h2/h3，编译后选择的是后代标题，字号/间距规则未正确命中。

位置：[src/frontend/web-blog/app/components/article/ArticleContent.vue](../../../src/frontend/web-blog/app/components/article/ArticleContent.vue)。

建议：改为 h2.article-content__heading / h3.article-content__heading 或对应修饰类，再核对文章视觉层级。

## 依赖告警的解释

审计汇总为 111 条告警计数，不等于 111 个独立、可从公网利用的漏洞；`--prod` 仍会遍历 Nuxt 包所依赖的开发和构建工具。应结合实际入口与构建产物分流处置。

核对的 [Nuxt 官方公告 GHSA-9473-5f9j-94wq](https://github.com/nuxt/nuxt/security/advisories/GHSA-9473-5f9j-94wq) 涉及服务器 island 的动态组件路径，公告列出修复版本 4.5.1。本项目使用 Nuxt 4.4.2，但没有据此直接认定当前生产站可执行任意代码；仍需逐项确认相关前提。此次也未复现依赖漏洞。

## 下一步顺序与验收标准

1. **安全和配置收尾（问题 1–8）**：统一配置注入；日志脱敏；秘密文件隔离；转义代码块；限流；原子刷新 token；依赖升级与可达性梳理。验收：环境文件密钥确实用于签名，日志无测试秘密，非法渲染样例显示为文本，并发刷新最多一次成功，可达高危告警被消除或有明确处置证据。
2. **统一公开文章数据（问题 9–11、13–17、22）**：文章列表/搜索/归档/RSS/sitemap/相邻文章由数据库驱动；实现真正分页与文章互动。验收：新增或撤回一篇隔离测试文章后，各入口一致；超过 100 篇无遗漏；公开 feed 不含草稿；生产调试页返回 404。
3. **最小创作后台（问题 12）**：管理员登录、文章列表、Markdown 草稿、发布、撤回；补评论管理。验收：博主可以通过网页完成一篇真实文章从草稿到发布再到撤回，访客不能访问管理操作。
4. **可靠性与交付门禁（问题 18–28）**：身份对齐、存储失败处理、导入校验、真实就绪探针、浏览器与数据库测试、统一镜像环境及文档。验收：失败不伪装成功，数据可恢复，主要流程由 CI 自动验证。

如只建立一个下一步目标，建议是：**修复环境配置时序、认证日志脱敏、秘密文件进入构建及代码块 HTML 注入路径，并为每项补充可重复验证；随后完成认证限流与刷新 token 并发保护。**
