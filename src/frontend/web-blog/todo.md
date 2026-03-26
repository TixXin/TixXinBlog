# Web Blog 开发 Todo

> 本文档用于维护 `src/frontend/web-blog/` 当前阶段的开发待办、总体进度与状态变化。开发前先阅读，开发中同步更新，开发完成后复核总进度与任务状态。

## 总进度

- 总任务数：17
- 已完成：16
- 进行中：0
- 未开始：0
- 暂缓：1
- 完成率：94%

## 维护约定

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `[-]` 暂缓 / 阻塞
- 开始新任务前，先把对应事项移入合适状态，并更新总进度
- 开发过程中任务范围、优先级或阻塞状态发生变化时，必须同步更新本文档
- 完成任务后，先更新本文档，再结束本轮开发

## 当前进行中

（无）

## 待处理

（无）

## 已完成

- [x] 建立 `web-blog` 开发 Todo 文档：补齐总进度、状态约定与首批任务清单
- [x] Todo 维护规则落地：在项目级规则中加入开发过程中必须同步维护 `todo.md` 的约束
- [x] 目录文档同步：在 `docs/directory-structure.md` 中补充 `src/frontend/web-blog/todo.md` 的职责说明
- [x] 主题 manifest 契约：产出 `BlogThemeManifest` 接口，明确 id、name、version、author、compatibility、capabilities、load() 等必填项
- [x] 主题 runtime 契约：产出 `BlogThemeRuntime` 接口，明确 layout、pageLayouts、components、tokens 结构
- [x] 主题 capabilities 模型：产出 `ThemeCapabilities` 接口，明确 leftSidebar、rightSidebar、customizer 可声明能力
- [x] parent/child 合并策略：在 registry 中实现 `resolveManifest` + `mergeManifests`，明确子覆盖父标量、capabilities/defaults 浅合并规则
- [x] 主题注册中心改造：registry 改为 manifest 注册 + runtime 缓存 + 动态校验，去除硬编码预设依赖
- [x] 默认三套主题迁移：classic、docs、minimal 已迁移为 `BlogThemeManifest` 格式，含 version、compatibility、capabilities 与 load()
- [x] 主题设置面板重构：面板根据 capabilities.customizer 动态显隐区段，布局主题按钮增加版本标签，resetAppearanceSettings 改用 DEFAULT_THEME_ID
- [x] mock 边界清理：新增 useNavItems/useSiteInfo composable 抽象数据源，SidebarNav、MobileNav、StatusFooter、DocsLayout、MinimalLayout 改用 composable，PostTabs 改为 props
- [x] 滚动与布局容器梳理：修复 useReadingProgress 冗余 window 监听，清理 _layout.scss 中 main-content__body 与 CustomScrollbar 的 overflow 职责冲突
- [x] SEO / Meta 补齐：nuxt.config.ts 全局 title 模板 + charset + viewport + OG/Twitter 默认值，8 个页面全部补充 useSeoMeta，文章详情页 useHead 升级为 useSeoMeta 并补齐 OG + Twitter Card
- [x] 图片与首屏性能优化：文章详情封面 fetchpriority="high" 优化 LCP，PostCard alt 动态化，关键图片补 width/height 减 CLS，灯箱去 lazy，封面/头像/友链 @error 兜底（后续可引入 @nuxt/image 做 srcset/格式优化）
- [x] 主题动态加载机制：setLayoutTheme 异步化支持第三方主题加载，新增 switchingState 状态机、preloadTheme hover 预热、AppearanceDrawer loading/error 态与切换防竞态
- [x] 后台主题管理方案：registry 新增 unregisterTheme 卸载接口 + checkCompatibility 兼容性校验 + satisfiesSemver 版本匹配，useLayoutTheme 新增 disableCurrentTheme 回退能力，后端 API 路由设计已记录于方案文档

## 暂缓 / 阻塞

- [-] 评论系统接入：等待后端接口方案与数据模型明确后再进入实现
