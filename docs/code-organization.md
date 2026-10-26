# 代码组织与模块化

本文规定代码放在哪里、单个文件承担多少职责、什么时候必须拆分。目录总览见[架构与代码入口](architecture.md)，新增一个完整内容域的步骤见[新增内容模块](adding-a-module.md)。

## 参照

规则取自以下做法，按本项目的 Nuxt 4 与 NestJS 结构落地：

- [Vue 风格指南](https://cn.vuejs.org/style-guide/rules-strongly-recommended)：组件名多词；通用基础组件只含展示，不读全局业务状态；只在某个父组件内有意义的子组件以父组件名为前缀，文件放在一起。
- [Feature-Sliced Design](https://feature-sliced.design/)：按业务领域切片，同层切片互不依赖内部实现，只通过对方明确导出的接口使用；先在页面里写，复用出现时再提取。
- [NestJS 模块](https://docs.nestjs.com/modules)与 [Immich 服务端架构](https://docs.immich.app/developer/architecture/)：一个领域一个模块；控制器只做 HTTP 映射，业务与事务在服务里，DTO 是输入输出的公开契约，技术细节与业务规则分开。
- [Elk](https://github.com/elk-zone/elk)（Nuxt 构建的 Mastodon 客户端）：页面、组件、组合函数按领域分目录，组件保持小而专一。

## 基本原则

1. **按领域组织，再按职责分层。** 目录职责见架构文档的[前端分层](architecture.md#前端分层)与[后端分层](architecture.md#后端分层)；新代码先确定领域，再决定放在页面、组件、领域模块还是组合函数。
2. **一个文件一项职责。** 文件头的 `@description` 应能用一句话说清职责；需要用「以及」「并且」串起几件互不相关的事时就该拆分。
3. **依赖单向。** 前端为 `pages → components → features → utils`；组件不直接请求接口，通过领域仓储或组合函数取得数据；领域之间只使用对方导出的类型与函数，不引用内部实现文件。后端为 `controller → service → 纯规则/映射`，跨模块只通过模块 `exports` 的 provider，横切逻辑放 `src/common/`。
4. **拆分不改行为。** 结构重构单独提交，保持既有测试通过；新提取的纯函数与组合函数补单测。

## 文件体量上限

| 范围                                       | 上限（行，含空行与注释） |
| ------------------------------------------ | ------------------------ |
| 前端页面 `app/pages/**/*.vue`              | 300                      |
| 前端组件及其他 `.vue`（含 `themes/`）      | 400                      |
| 前端 `.ts`（`app/`、`server/`、`themes/`） | 300                      |
| 后端 `src/**/*.ts`                         | 300                      |

- 不受约束：测试（`*.spec.ts`、`*.test.ts`、`__tests__/`）、迁移、`seeders/` 样本、`mock.ts` 演示数据、类型声明。
- `corepack pnpm lint`（及单独的 `lint:size`）运行 [scripts/check-file-size.mjs](../scripts/check-file-size.mjs)：新文件和曾经达标的文件不得超限；存量超限文件登记在 [scripts/file-size-baseline.json](../scripts/file-size-baseline.json)，只许变短。拆分后运行 `node scripts/check-file-size.mjs --update` 收紧基线，该命令只会删除条目或调低行数。
- 修改基线中的文件时，优先顺带拆出本次触及的部分，不在超限文件里继续堆功能。

函数与模板的体量、通用组件的依赖边界由前后端各自的 ESLint 配置（`src/frontend/web-blog/eslint.config.mjs`、`src/backend/server-main/eslint.config.mjs`）执行，豁免范围与上面的文件体量检查相同：

| 规则                     | 上限                                   | 范围                    |
| ------------------------ | -------------------------------------- | ----------------------- |
| `max-lines-per-function` | 60 行（含空行与注释）                  | 前后端                  |
| `max-depth`              | 嵌套 3 层                              | 前后端                  |
| `complexity`             | 圈复杂度 15                            | 前后端                  |
| `max-params`             | 4 个参数，更多时改传对象               | 前后端                  |
| `vue/max-template-depth` | 模板嵌套 8 层                          | 前端 `.vue`             |
| `no-restricted-imports`  | 不导入 `~/features/**`                 | `app/components/common` |
| `no-restricted-syntax`   | 不调用 `$fetch`、`useFetch` 等请求接口 | `app/components/common` |

- 超过时拆成具名的小函数或子组件，不用 `eslint-disable` 注释绕过。
- 存量违规冻结在各包根目录的 `eslint-suppressions.json`（按文件、规则记录条数），`lint` 读取它，只报告新增违规。清单只许减少条目，不许新增或调高条数；不对新违规运行 `--suppress-all` 或 `--suppress-rule`。
- 拆分消除违规后，lint 会以「suppressions left that do not occur anymore」失败，在对应包目录运行 `corepack pnpm exec eslint . --prune-suppressions`（后端为 `eslint src mikro-orm.config.ts --prune-suppressions`）收紧清单并一起提交。该文件由 ESLint 生成，已列入 `.prettierignore`。

## 前端拆分方法

**页面**只负责路由参数、读取状态和组装组件。多步流程、提交与错误分派放进领域组合函数（如 `features/<domain>/useXxx.ts`），页面调用它并把状态交给组件。

**组件**出现以下任一情况就拆：

- 模板里有可以独立命名的区块（步骤、弹窗、面板、表单分组、列表项）；
- 同时维护多组互不相关的状态；
- 样式超过约 150 行，或需要用 `:deep` 向子组件下发大段样式。

拆出的子组件命名以父组件为前缀并放在同一领域目录，例如 `components/setup/SetupAccountStep.vue`、`SetupProfileStep.vue`、`SetupAvatarPicker.vue`。只被一个父组件使用的子组件不提升到 `common/`。

**通用组件**放在 `components/common/`，只依赖 props、事件与插槽，不读取业务状态、不请求接口、不导入领域模块；示例：`CommonDatePicker`。

**逻辑放置**：

| 逻辑                                         | 位置                                   |
| -------------------------------------------- | -------------------------------------- |
| 不依赖 Vue 的规则、校验、映射、计算          | `features/<domain>/*.ts` 纯函数        |
| 有响应式状态、生命周期或副作用、仅本领域使用 | `features/<domain>/useXxx.ts` 组合函数 |
| 多个领域复用的请求、身份、界面生命周期       | `app/composables/`                     |
| 与业务无关的通用工具（日期网格、地址、焦点） | `app/utils/`                           |

**样式**：组件私有样式留在 SFC 中；多个组件共享的表单外观抽成通用组件或 `app/assets/styles/` 下的 SCSS partial，由使用方引入，不靠父组件 `:deep` 覆盖子组件。

**后台界面**：后台内容区（`.admin-ui`）的原生按钮、输入框、下拉、复选框与文件选择由 `app/assets/styles/_admin.scss` 统一外观，页面不再为它们重写边框、背景、圆角与内边距。页面结构使用其中的工具类：`admin-page-header`（标题、说明与页面主操作）、`admin-card`（卡片）、`admin-toolbar`（筛选与操作行）、`admin-table`（数据表）、`admin-badge` 加 `is-success` / `is-warning` / `is-danger` / `is-info`（状态徽章，文字始终说明状态）、`admin-switch`（复选框的开关外观）；按钮语义用 `admin-btn--primary`（每个区域最多一个）、`--danger`（删除等不可逆操作）、`--ghost`、`--sm`。颜色只取全站主题变量，随明暗模式与强调色切换。

**开发专用代码**（预览、示例数据、调试面板）放在独立模块，只在 `import.meta.dev` 分支中调用，确保生产构建剔除。

## 后端拆分方法

- 每个领域一个模块目录：`*.module.ts` 装配，`*.controller.ts` 只做路由、守卫、参数与响应映射，`*.service.ts` 承担业务与事务，`*.dto.ts` 定义输入输出契约，规则与映射写成可单测的纯函数文件。
- 服务超过上限时按用例拆分（参照 `backup/` 的 `content-export.service.ts`、`content-import.service.ts`、`content-import-plan.ts`），而不是按技术细节随意切块。
- 共享的守卫、拦截器、过滤器、i18n 文案与响应约定放在 `src/common/`；实体与迁移的约束见[新增内容模块](adding-a-module.md)。

## 评审清单

- 新文件是否放在正确的领域与层级，命名是否说明职责；
- 是否超过体量上限，或让基线中的文件变长；
- 页面是否只在组装，组件是否直接请求了接口；
- 跨领域引用是否只用了对方的公开导出；
- 拆出的纯函数与组合函数是否有单测，结构重构是否保持了既有测试。
