# 主题开发

博客通过 `@tixxin/nuxt-theme-engine` 加载 Nexus、Aurora 和 Dock 三套布局主题。主题只负责布局与表现；路由页面、请求、身份、内容与编辑状态由宿主维护，主题偏好、持久化、水合和切换事务也由宿主运行时负责。以下路径相对 `src/frontend/web-blog/`。

## 分层与职责

| 层         | 位置                                                                     | 职责                                                                                                     | 不负责                                   |
| ---------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 引擎       | `@tixxin/nuxt-theme-engine`                                              | 构建期扫描 `themes/*/theme.json`、校验与继承、生成注册表/契约 d.ts、按主题拆包                          | 运行时主题状态、cookie、持久化、水合决策 |
| 宿主运行时 | `app/composables/useThemeRuntime.ts`、`app/features/appearance/themeRuntimeState.ts` | SSR 以 cookie 决策、水合期信任 payload、水合后对账、cookie/localStorage、跨标签同步、`?theme=` 预览语义 | 主题组件加载与切换 UX                    |
| 主题门面   | `app/composables/useLayoutTheme.ts`                                      | 合并元信息与能力位、切换事务（预热→提交→回滚→提示）、预热错误记录、滚动/焦点恢复                      | 浏览器存储与首屏水合决策                 |
| 注册表     | `app/features/appearance/themeRegistry.ts`、`nuxt.config.ts`             | 宿主能力登记、展示顺序、默认主题、非法 id 回退、构建期集合一致性校验                                    | 主题视觉实现                             |
| 主题层     | `themes/<name>/theme.json`、`theme.config.ts`、契约组件                  | 单一主题的元信息、宿主能力声明与布局组件                                                                 | 主题状态、全局外观设置、业务数据抓取     |
| 契约与壳层 | `theme-contracts/index.ts`、宿主覆盖版 `app/components/ThemeComponent.vue`、`app/components/theme/` | 逻辑组件名与 Props、组件分发、缺失组件回退宿主默认壳层                                                    | 跨主题静默回退                           |

引擎 0.0.4 自带的 `theme-sync.client` 运行时插件会在客户端重新初始化主题并读 localStorage、覆盖水合 payload。`nuxt.config.ts` 中的 `themeRuntimeHygieneModule` 在 `modules:done` 阶段把它从插件列表摘除，主题状态以宿主运行时为唯一事实源；`app/app.vue` 通过 `useHead` 同构输出 `<html data-theme="<id>">`。升级引擎时必须重新评估这条过滤与上游实现，不能默认移除。

## 主题偏好：唯一事实源与生命周期

- **cookie `blog-layout-theme` 是唯一事实源**：`path: '/'`、`maxAge: 一年`、`sameSite: 'lax'`，**只允许客户端写**。服务端写 `Set-Cookie` 会进入 SSR 缓存响应并重放给同缓存键的访客。
- `localStorage['theme-engine:storage']` 沿用引擎旧键，只作**降级备份**，用于 cookie 丢失（会话清理、换浏览器策略）后恢复访客偏好，不是第二事实源。
- 解析优先级：`?theme=` → cookie → localStorage → 默认主题 `nexus`。服务端只能看到 query 与 cookie，localStorage 不参与 SSR 决策；纯客户端首启（如关闭 SSR）才读 localStorage。
- 空串、未知名称、大小写不符、前后空格、数组/对象、原型链键等一律视为无效值，按优先级继续回退，最终回退 `nexus`；可激活主题以 `registeredThemeIds`（引擎已发现且宿主已登记）为准。
- **水合期只信任 SSR payload**：客户端首次运行不读 localStorage、不覆盖状态；payload 异常时回退默认主题。任何“水合前从 localStorage 纠正主题”的做法都会重新引入首屏错主题与水合 mismatch。
- 水合完成后在 `app:suspense:resolve` 对账一次：
  - `?theme=` 预览：不改动任何持久化；
  - cookie 权威：localStorage 备份与 cookie 不一致时同步为 cookie 值；
  - 没有 cookie：用仍有效的 localStorage 偏好恢复（会发生一次水合后主题切换，允许且不再 mismatch）。
- **`?theme=<id>` 是首屏预览语义**：只影响当前这次首屏，不写 cookie、不写 localStorage；访客在预览页主动切换主题后来源转为 `user`，才按正常规则持久化。
- 跨标签页：监听 `storage` 事件只同步本页内存状态、不回写（写入方已更新 cookie），避免广播风暴。
- 存储不可用（隐私模式、配额满、被策略禁用）时读写都安全降级：主题仍在本会话生效，不抛错、不阻断切换。
- 主题相关运行时状态键固定（`layout-theme:current/source/bootstrapped/reconciled` 等），主题不得另存一份主题偏好；客户端持久化监听、跨标签同步与水合后对账在同一浏览器只绑定一次，状态初始化与这些副作用解耦。

## 首屏与水合安全

- `app/plugins/00.theme-preload.ts`（`enforce: 'pre'`）在挂载前预加载当前主题全部组件；`ThemeComponent` 同步命中预加载缓存，SSR 与水合首帧输出同一棵树。
- 缺失组件只允许回退**宿主默认壳层**（`app/components/theme/DefaultPostCard.vue`、`DefaultStatusFooter.vue`），绝不跨主题回退；`ThemeAccessory` 缺失合法（不渲染）；`RootLayout` 缺失渲染可重试错误态。
- 加载失败/超时不是终态：`ThemeLoadError` 提供“重试加载”和刷新入口；组件缓存写入后递增客户端模块级响应式版本（`app/utils/themeRuntime.ts` 的 `themeCacheVersion`），`ThemeComponent` 监听它重试，迟到资源就绪后自动从错误态恢复。首屏失败时保留服务端已净化的正文快照，允许只读浏览。
- `<html data-theme>` 由宿主 `useHead` 输出，SSR 与客户端一致；主题不要自行设置 `data-theme`，也不要在首屏依赖“客户端补上才生效”的样式。

## SSR 缓存约束

- 生产公开页 SSR HTML 缓存 60 秒并带 stale-while-revalidate，缓存键包含请求 URL（含 query）与**整串 Cookie 请求头**，不同主题的请求分开缓存。细节与失效链路见[架构与代码入口](architecture.md#请求链路与-ssr-缓存)。
- 主题 cookie 只在客户端写，服务端不为主题写 `Set-Cookie`。新增任何服务端 cookie 前必须评估缓存响应重放与串访客风险；不要为了首屏改主题加服务端 cookie。
- localStorage 对 SSR 不可见，不能参与 SSR 决策；不能靠它“修正”首屏主题。

## 契约与宿主默认壳层

`theme-contracts/index.ts` 声明四个逻辑组件（引擎按 `themeContractNames` 字面量生成类型）：

| 契约             | 必需性 | Props                                    | 缺失时行为                       |
| ---------------- | ------ | ---------------------------------------- | -------------------------------- |
| `RootLayout`     | 必需   | 无（默认 slot 接收宿主页面）             | 渲染 `ThemeLoadError` 可重试错误 |
| `PostCard`       | 可选   | `{ post: PostItem; priority?: boolean }` | 使用宿主 `DefaultPostCard`       |
| `StatusFooter`   | 可选   | 无                                       | 使用宿主 `DefaultStatusFooter`   |
| `ThemeAccessory` | 可选   | 无                                       | 合法不渲染                       |

`SidebarNav` 是已删除的僵尸契约（全仓无 `<ThemeComponent name="SidebarNav">` 调用方，唯一实现也已被宿主共享导航取代），不要恢复。新增契约必须同时补契约声明、宿主分发、三主题或宿主默认实现与测试；只有名字没有 Props 的空契约会掩盖调用方漂移。

宿主编排依赖的 DOM 约定（主题 `RootLayout` 必须遵守）：

- 根节点带 `page-root theme-<name>` 类，供样式与 e2e 定位；
- 提供 `#main-content`（`tabindex="-1"`）与 `#site-navigation`，跳转与焦点恢复依赖它们；
- 声明 `rightSidebar` 的主题提供空 `#right-sidebar-target` 挂载点；页面统一通过 `ThemeSidebarPortal` 把右栏内容投递进来，不要把“是否投递”写回页面；
- 内部滚动容器使用 `.custom-scrollbar__viewport` / `.article-viewport` 类，切主题时宿主按 DOM 顺序恢复滚动；
- 可聚焦元素尽量带 `data-focus-key`，切主题后焦点按 `data-focus-key` → `id` → `#main-content` 顺序恢复。

## theme.json 与 theme.config.ts 的单一职责

`theme.json` 是主题元信息唯一事实源，由引擎扫描：

```json
{
  "name": "magazine",
  "label": "theme.themes.magazine.label",
  "description": "theme.themes.magazine.description",
  "meta": {
    "version": "1.0.0",
    "icon": "lucide:newspaper"
  }
}
```

- `label` / `description` 写 `theme` 域字典 key（`theme.themes.<name>.label/description`），中英文案放 `i18n/locales/<locale>/theme.json`，展示时按当前界面语言翻译；第三方主题直接写字面文案则原样展示。宿主只在字典缺失时做中性兜底（name 用 id、version `0.0.0`、icon `lucide:layout`）。
- `meta.version` / `meta.icon` 只维护在 `theme.json`；`theme.config.ts` 不再重复声明，避免双源漂移。

`theme.config.ts` 只导出宿主能力：

```ts
/** @file theme.config.ts @description 杂志主题的宿主能力声明 */
export default {
  capabilities: {
    rightSidebar: true,
    rightSidebarBreakpoint: 1280,
    mobileNav: true,
    customizer: ['colorMode', 'contentTransition'] as const,
  },
}
```

宿主登记在 `nuxt.config.ts` 的 `themeHostConfigs`（导入三份 `theme.config.ts`），**登记顺序即外观抽屉展示顺序**。构建期 `assertThemeRegistryConsistency()` 校验 `themes/*/theme.json` 集合与登记完全一致、默认主题已登记，漏登记/多登记直接构建失败，避免“引擎能激活、宿主不认识”的脑裂。

## 能力位

主题通过 `capabilities` 声明宿主行为，宿主页面与组合函数只读能力位，不再按主题 id 写分支（`useThemeSidebarVisibility()` 是统一派生出口）：

| 字段                    | 类型                                   | 语义                                             | 未声明/兜底                                   |
| ----------------------- | -------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| `rightSidebar`          | `boolean`（必需）                      | 是否渲染右栏并接受 `ThemeSidebarPortal` 投递     | 未登记主题兜底 `false`；`false` 时不投递内容  |
| `rightSidebarBreakpoint` | `number`（可选）                      | 右栏出现的最小视口宽度                           | 未声明视为“右栏存在即显示”                    |
| `mobileNav`             | `boolean`（可选）                      | 宿主是否渲染移动导航                             | 未声明按渲染处理；`false` 表示主题自带移动导航（如 dock 浮岛） |
| `guestbookChat`         | `boolean`（可选）                      | 留言板宽屏聊天态                                 | 未声明视为关闭                                |
| `momentInfoPlacement`   | `'left' \| 'right'`（可选）            | 朋友圈资料固定侧栏归属                           | 未声明只放紧凑抽屉                            |
| `customizer`            | `('colorMode' \| 'contentTransition' \| 'sidebarAnimation')[]`（可选） | 外观抽屉可定制项；只声明实际支持的项 | 未声明不展示对应定制区块                      |

视口相关的派生值（`rightSidebarVisible`、`chatLayoutEnabled`）在 SSR 恒为 `false`，只能在客户端消费；结构性渲染（是否创建挂载点）直接读 `activeTheme.capabilities`，避免水合结构不一致。未登记主题的兜底能力是“左右栏都不渲染”，宁可少渲染也不按错误假设渲染。

## 切换事务与整树重挂

- 唯一入口是 `useLayoutTheme().setLayoutTheme(id): Promise<boolean>`：先预热目标主题全部组件，再提交当前主题，恢复滚动/焦点后返回 `true`；失败回滚上一主题、写 `switchingState = 'error'`、Toast 提示并返回 `false`。抽屉应在成功后关闭，失败保留并允许重试。
- latest-wins：每次切换递增版本号，迟到的旧请求返回 `false`、不覆盖较新的选择，也不会关闭仍在等待的新请求 loading。
- 重复选择当前主题直接成功（不预热、不重挂）；非法或未登记的 id 先回退 `nexus` 再走正常事务；`resetSwitchState()` 只负责清掉过期错误态。
- **切换会替换 `RootLayout`，整棵主题树重挂**，这是当前架构接受的代价：宿主在切换前用 `app/utils/themeSwitchScroll.ts` 记录 window 滚动、主题内部滚动容器位置与焦点，切换完成后尽力恢复（失败不影响切换结果）。主题需保留相同 `data-focus-key` 与滚动容器结构，恢复才有意义。
- 主题内部不得自行维护主题状态、写主题 cookie/localStorage 或调用引擎 `setTheme`；组件缺失与加载失败交给宿主 `ThemeComponent` 处理。

## 引擎边界与已知限制

- 引擎的全局组件别名不可用：宿主统一 `<ThemeComponent name="RootLayout" />` 等分发方式，不要写 `<NexusRootLayout>` 之类别名（dev 可能能解析，生产不存在）。
- 引擎 devtools 路由（`/_theme-engine-devtools`）只在开发可用，生产由 `pages:resolved` 移除；不要依赖它在生产调试。
- 旧的 `components:extend` 删除主题别名钩子已移除（它删不到模块注册的别名）；不要恢复。
- 契约 d.ts 由引擎正则读取 `themeContractNames` 字面量，必须保持 `[...] as const` 形式；改成类型注解或变量拼接会静默丢失组件名类型。
- 不要把 `.nuxt/` 下生成文件当作登记入口；注册只说 `theme.json` 存在 + `nuxt.config.ts` 的 `themeHostConfigs` 登记两件事。

## 添加第四主题 checklist

1. `themes/<唯一名称>/theme.json`：`name` 唯一，`label`/`description` 写字典 key，`meta.version` 与 Lucide `meta.icon`。
2. `themes/<名称>/theme.config.ts`：只导出 `capabilities`，按实际支持声明（右栏给断点、移动导航归属、留言板聊天态、朋友圈资料归属、customizer）。
3. 实现 `RootLayout.vue`（必需，使用 `<slot />`，遵守上面的 DOM 约定）；右栏内容经页面 `ThemeSidebarPortal` 投递，不自行判断主题 id。
4. 可选实现 `PostCard`/`StatusFooter`/`ThemeAccessory`：不实现 PostCard/StatusFooter 时由宿主默认壳层承接，ThemeAccessory 缺失合法不渲染；禁止复制宿主实现形成双源。
5. 在 `i18n/locales/zh-CN/theme.json` 与 `i18n/locales/en/theme.json` 补 `theme.themes.<name>.label/description`。
6. 在 `nuxt.config.ts` 的 `themeHostConfigs` 导入并登记（顺序决定外观抽屉顺序）；构建期一致性校验会拒绝漏登记。
7. 测试登记点：
   - `tests/unit/themeRegistry.test.ts`：契约集合、能力位、元信息与引擎定义一致；
   - 新增 `tests/unit/<name>ThemeShell.test.ts`（参照另外三个 shell 测试）：根布局、landmark、导航、外观入口唯一性；
   - `tests/unit/themeRuntimeState.test.ts` 与 `tests/unit/layoutTheme.test.ts` 覆盖宿主运行时/切换事务通用逻辑，新主题通常无需改；
   - e2e 主题矩阵：`tests/e2e/accessibility.spec.ts`、`page-regions.spec.ts`、`motion-*.spec.ts`、`theme-persistence.spec.ts` 等按现有循环补主题名。
8. 跑验证命令与浏览器回归；不要修改 `.nuxt/` 生成文件，也不要在主题里新增业务数据副本。

## 动效与可访问性

页面标题、正文、侧栏动效由宿主的页面区域与动效 composable 管理，主题只做壳层。动画不是数据就绪条件：无动画、减少动态效果、请求取消或导航中断时都必须正确收尾，不能依赖某个 `transitionend` 才恢复内容。主题组件必须在卸载时清理观察器、监听器、定时器、动画与临时节点；支持键盘焦点、Escape、焦点归还、低高度视口、窄屏重排与 `prefers-reduced-motion`；图标只用 Lucide（`<Icon name="lucide:xxx" />`），不以图标或动画替代操作名称与状态反馈；移动端每主题只保留一组外观入口，不重复全局外观设置或移动导航实例。

## 验证

```sh
corepack pnpm --filter web-blog exec nuxt prepare
corepack pnpm --filter web-blog exec nuxt typecheck
corepack pnpm --filter web-blog exec vitest run \
  tests/unit/themeRegistry.test.ts tests/unit/themeRuntimeState.test.ts \
  tests/unit/layoutTheme.test.ts tests/unit/themeSwitchScroll.test.ts \
  tests/unit/nexusThemeShell.test.ts tests/unit/auroraThemeShell.test.ts tests/unit/dockThemeShell.test.ts \
  --hookTimeout=60000
corepack pnpm --filter web-blog exec eslint app/composables/useLayoutTheme.ts app/features/appearance tests/unit
corepack pnpm build
```

- Nuxt 测试环境冷启动慢，单测命令保留 `--hookTimeout=60000`；不要用扩大业务断言超时或删除断言换绿。
- 浏览器主题回归需隔离后端、数据库与生产构建（`corepack pnpm test:e2e`），覆盖三主题 × 明暗 × 移动/桌面、切换失败重试、URL/历史恢复与动效禁用。单元 DOM 环境不能证明真实排版、系统缩放或辅助技术支持。
- 测试与运行产物规则见[开发指南](development.md)。
