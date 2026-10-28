# 待办与已调研方向

这里记录已经调研、尚未排期的方向，后续会话直接沿用其中的结论，不重复调研。每条只写结论、约束、待定问题和第一步，不记录进度或完成率。开工后把结论转入设计稿或正式文档，并删除对应条目，历史通过 Git 追溯。

外部事实注明核实方式：“官方”表示已打开官方页面核对，“摘要”表示只来自搜索摘要或第三方文章。标为会变的价格、额度、版本和项目状态，动工前复核。

## Git 内容仓库（静态发布的仓库为准用法）

状态：已调研，未排期。静态发布第一版已实现「后台为准」，本条目只保留尚未实现的「仓库为准」，记录于 2026-10-27。

### 背景

静态发布第一版从运行中的后端导出构建产物，写作仍在后台完成。希望进一步支持直接在 Git 仓库里写 Markdown，推送后由 CI 构建，不需要运行后端。

### 结论

- 内容格式只保留一套：仓库格式是内容包 v14 的文件化表达。文章、闪念、朋友圈用 Markdown 与 frontmatter，项目、友链、图库、图片提示词、平台订阅费和站点资料用 YAML，校验复用内容包格式。
- 同一站点只认一个事实源，不做双向同步。后台为准时可导出仓库；仓库为准时由 CI 构建，回到服务器部署时从仓库迁入。
- 稳定地址以地址而非数据库编号作为内容标识：闪念与朋友圈沿用 UUID；文章用自定义地址，没有时用当前数字编号，迁入时保留，历史地址一并导出。
- 写作工具用 VS Code 或 Obsidian；需要网页编辑时优先选 Sveltia CMS、Decap CMS 这类不绑定框架的 Git CMS。

### 待定问题

- 仓库为准时，图库媒体的入库与引用校验如何复用内容包的媒体映射规则。
- 从仓库迁入后台时，如何处理与既有数据库编号的冲突与历史地址。

### 外部事实

| EdgeOne Pages 文档现归在 EdgeOne Makers 名下。免费版每月 500 次构建、Edge Functions 300 万次、云函数（Node.js 等）100 万次；KV 与 Blob 各 1GB；单项目最多 2 万个文件，单文件最大 25MB，总存储 5GB；`edgeone.json` 最多 100 条重定向、30 条响应头 | 官方 | 是 | [配额与限制](https://pages.edgeone.ai/document/limits-and-quotas) |
| Nitro 内置 EdgeOne 预设 `edgeone_pages` | 官方 | 否 | [Nitro](https://nitro.build/deploy/providers/edgeone) |
| EdgeOne 加速区域包含中国大陆时，域名需要 ICP 备案 | 摘要 | 是 | [EO 接入文档](https://cloud.tencent.com/document/product/1552/87601) |
| Cloudflare Pages 文档建议新项目从 Workers 起步，Pages 仍可使用 | 官方 | 是 | [Pages 文档](https://developers.cloudflare.com/pages/) |
| Workers 免费版每天 10 万次请求、单次 10ms CPU、128MB 内存；D1 免费 5GB；R2 免费 10GB，出站流量不计费 | 摘要 | 是 | [Workers 套餐](https://workers.cloudflare.com/plans)、[D1](https://developers.cloudflare.com/d1/platform/pricing/)、[R2](https://developers.cloudflare.com/r2/pricing) |
| Nuxt Content 在 Cloudflare 上做 SSR 需要 D1；纯静态部署会把内容数据库下发到浏览器 | 官方 | 是 | [Workers 部署](https://content.nuxt.com/docs/deploy/cloudflare-workers)、[静态部署](https://content.nuxt.com/docs/deploy/static) |
