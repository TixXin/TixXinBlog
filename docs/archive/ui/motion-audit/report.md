# TixXinBlog 动效审查

> 历史归档：原文来自 `docs/motion-audit/report.md`，保留当时的设计、实施与验收事实。文中的阶段、版本、数量和“当前／下一步”不代表现状；现行入口见[文档导航](../../../README.md)。本机验收产物仍按原仓库相对路径留存。

> 本文截图、录屏、原始日志、采样和临时实验脚本仅在本机留存，不随 Git 发布。下列本地产物路径以仓库根目录为起点，新检出不包含这些文件；验收结论与正式测试源码继续保留。见[验收产物管理](../../../verification-artifacts.md)。

本轮完成动效审查和整改方案，**未实施产品修复**。当前共整理16项：P0 1项、P1 5项、P2 9项、P3 1项。优先处理无动画导航空白、搜索Enter重开、取消导航侧栏消失，以及颜色切换监听累积。

## 结论与历史空白问题

与此前截图相似的“正文空白＋侧栏骨架”已在当前源码的独立生产预览中复现。真实指针快速导航、减少动态效果或关闭动画能触发M01；URL更新而正文不恢复。现场设置弹窗仍能打开，因此本轮没有复现“所有控件都失效”。没有证据证明历史截图必然由同一原因造成。

开发对照在相同源码、相同数据和操作下执行：保留零时长Transition包装3/3空白；仅在独立副本临时将NuxtPage过渡设为false，0/3空白。该改动已还原，是诊断实验，不是已交付修复。非当前主题资源故障另可阻断交互启动（M08），应分别处理。

快速导航后的实际空白（本地：`docs/motion-audit/evidence/race/pointer-关闭动画-false-30.png`）

## 审查流程与健康状况

| 步骤 | 场景                               | 本轮结果                                                                   | 证据                                                                     |
| ---- | ---------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1    | 当前用户开发页与独立副本首屏       | 日常开发页正常；冷启动及资源失败另列M08                                    | 开发结果（本地：`docs/motion-audit/evidence/development/results.json`）  |
| 2    | 列表、分页、连续加载、慢请求与重试 | 数据恢复可用；存在过渡空档和未统一时长                                     | 列表结果（本地：`docs/motion-audit/evidence/interactions/results.json`） |
| 3    | 搜索→结果→详情→返回                | 鼠标正常；Enter会重开弹层（M03）                                           | 键鼠对照（本地：`docs/motion-audit/evidence/search-key/results.json`）   |
| 4    | 路由预设与快速导航                 | 普通预设本轮正常；零时长竞态M01                                            | 导航对照（本地：`docs/motion-audit/evidence/race/results.json`）         |
| 5    | 设置、颜色及布局主题               | 基本切换可用；监听累积、none路径颜色插值、竞态风险                         | 主题结果（本地：`docs/motion-audit/evidence/themes/results.json`）       |
| 6    | 图片灯箱、认证、书签嵌套弹层       | 一般关闭和焦点清理可用；减少模式仍有位移；图片错误弱                       | 组件结果（本地：`docs/motion-audit/evidence/components/results.json`）   |
| 7    | 朋友圈、留言、闪念更新             | 更新与互动可用，局部入场未响应减少动态效果                                 | 补充结果（本地：`docs/motion-audit/evidence/supplement/results.json`）   |
| 8    | 长文滚动、目录和历史               | 站内导航返回三主题均恢复1800px；快捷键容器错误M10                          | 阅读结果（本地：`docs/motion-audit/evidence/reading-spa/results.json`）  |
| 9    | 多端与主题组合                     | 完成24个主题/尺寸/配色/偏好组合及9个断点检查；不是所有组合笛卡尔积         | [矩阵](coverage.md)                                                      |
| 10   | 后台路由                           | 13个已认证管理页面完成进入与静态状态检查；高风险业务动作未遍历             | 后台结果（本地：`docs/motion-audit/evidence/smoke/results.json`）        |
| 11   | 开发热更新、配置重启               | CSS、SFC脚本、RootLayout热更新后弹窗可关闭，无残留inert；reduce水合警告M09 | 开发结果（本地：`docs/motion-audit/evidence/development/results.json`）  |
| 12   | 资源生命周期、帧时间与合成层       | 模态/导航预热后计数稳定；颜色切换订阅增长；节流下绘制成本明显              | 性能结果（本地：`docs/motion-audit/evidence/performance/results.json`）  |

## 问题总表

| 编号 | 优先级 | 证据性质                                 | 问题                                       |
| ---- | ------ | ---------------------------------------- | ------------------------------------------ |
| M01  | P0     | 已复现并完成隔离对照                     | 零时长页面过渡在快速导航后留下永久空正文   |
| M02  | P1     | 已复现（故障注入）                       | 导航被取消后右侧栏原内容没有恢复           |
| M03  | P1     | 已复现并记录事件顺序                     | 搜索按Enter跳转后弹窗再次打开              |
| M04  | P1     | 已复现并测量                             | 颜色切换反复创建媒体查询监听               |
| M05  | P1     | 已复现＋源码覆盖                         | 减少动态效果只覆盖部分动效                 |
| M06  | P2     | 轮播已复现；不可见暂停为代码确认风险     | Aurora背景轮播和视差持续打断静态阅读       |
| M07  | P2     | 已复现                                   | “无动画”颜色切换仍发生局部颜色插值         |
| M08  | P1     | 已复现（资源故障注入）                   | 非当前主题资源失败可阻断开发页交互启动     |
| M09  | P2     | 开发日志已确认                           | 减少动态效果条件导致SSR侧栏类名不一致      |
| M10  | P2     | 已复现                                   | 阅读快捷键操作window，未使用实际滚动容器   |
| M11  | P2     | 图片失败已复现；晚加载为代码确认风险     | 图片入场按挂载播放，失败时网格缺少稳定占位 |
| M12  | P2     | 代码确认风险，未复现永久卡死             | 手写入场回调缺少取消和结束兜底             |
| M13  | P2     | 已复现                                   | Tooltip按Esc不关闭且不能悬停保留           |
| M14  | P2     | 已测量；性能优化建议                     | 叠加绘制效果在CPU节流下出现明显帧间隔拉长  |
| M15  | P2     | 代码确认风险，连续键盘测试未出现终态锁死 | 重叠颜色切换缺少事务归属                   |
| M16  | P3     | 体验建议，时长由源码确认                 | 等待和交错入场预算缺少统一上限             |

## 重点交互证据

搜索键盘跳转后弹层重新打开，事件顺序证明是焦点归还后再次触发入口；鼠标路径正常。

搜索Enter跳转后重新显示弹窗（本地：`docs/motion-audit/evidence/search-key/keyboard-700.png`）

取消导航后右侧栏源节点被留在visibility:hidden，当前首页内容未变。

取消导航后消失的右侧栏（本地：`docs/motion-audit/evidence/edge/cancelled-sidebar.png`）

## 性能样本

设备：Intel(R) Core(TM) i5-14600KF，20逻辑核心，64GB内存；Windows 10 Pro；Chromium 153.0.8010.12 headless。物理屏幕刷新率、GPU和真机体验未据此推断。测量是在独立Chromium、1440×1000、无网络节流下对同一4秒设置开关和路由切换操作进行的样本；4倍CPU节流单独对照。

| 条件   | 有效帧间隔样本 |    p50 |    p95 |   最大 | 长任务 |
| ------ | -------------: | -----: | -----: | -----: | -----: |
| CPU 1× |            205 | 16.7ms |   50ms | 66.7ms |      0 |
| CPU 4× |            154 | 16.7ms | 66.7ms |  200ms |      6 |

这些是该负载的采样结果，不是全站平均帧率或真实性能下限。打开设置和路由预热后，30次模态操作与穿插导航的DOM计数稳定在1842节点/381监听；颜色切换30次另新增60个媒体查询监听、移除0个。合成层采样及圆形/模糊轨迹见advanced目录，不将瞬时层数直接解释为泄漏。

## 逐项整改建议

### M01 零时长页面过渡在快速导航后留下永久空正文

**P0 · 已复现并完成隔离对照**。范围：首页→归档→项目→首页；Nexus；生产及独立开发。

复现：1. 开启系统减少动态效果，或将主内容切换设为关闭动画。 2. 以真实指针在归档、项目、主页三个固定导航项之间按约30ms间隔循环5轮；无force、无DOM模拟click。 3. 停止操作，等待5秒，再点击关于。

实际：正文字符数为0，右栏停留骨架；URL已变化，标题仍可能是旧页面；后续导航未恢复正文。设置弹窗可打开，现场没有inert、滚动锁和活动模态。开发副本原实现3/3复现，临时将NuxtPage的transition改为false后0/3复现。

预期：无动画模式直接完成内容切换；快速导航最终呈现最后一次请求的页面，标题、URL和导航状态一致。

影响：核心阅读路径被阻断，需要刷新。触发属于快速操作压力场景，不能推断普通点击必现。

根因/边界：关闭动画仍返回truthy过渡对象，保留mode=out-in及NuxtPage的Transition/Suspense生命周期；对照实验证明该包装参与竞态。框架内部更细的失配位置尚未归责。

建议：无动画/减少动态效果时真正关闭页面过渡包装；将fullbleed等布局状态同步从动画钩子中解耦。为导航中断和异步页面替换建立明确收尾规则，保留正常模式过渡。

验收：三主题、正常/关闭/减少动态效果执行30/120/300ms导航压力测试；最终正文、URL、标题一致。 慢请求、前进后退及全宽页面切换不挂起；不能用阻止用户导航掩盖问题。

实现：[源码](../../../../src/frontend/web-blog/app/layouts/default.vue#L28)、[源码](../../../../src/frontend/web-blog/app/composables/useAppearanceSettings.ts#L86)。证据：race/results.json（本地：`docs/motion-audit/evidence/race/results.json`）、ab/results.json（本地：`docs/motion-audit/evidence/ab/results.json`）、race/pointer-关闭动画-false-30.png（本地：`docs/motion-audit/evidence/race/pointer-关闭动画-false-30.png`）、ab/ab-true-0.png（本地：`docs/motion-audit/evidence/ab/ab-true-0.png`）。

### M02 导航被取消后右侧栏原内容没有恢复

**P1 · 已复现（故障注入）**。范围：Nexus/Aurora右侧栏。

复现：1. 默认开启侧栏动画。 2. 在隔离浏览器中添加后置路由守卫，仅取消到/archive的导航。 3. 从首页点击归档，等待离场结束。

实际：导航留在首页，右侧栏源元素visibility仍为hidden；离场clone已删除。

预期：取消或失败的导航恢复当前页面侧栏，移除临时副本并还原原始属性。

影响：筛选入口与上下文内容消失，容易被误认为数据未加载。

根因/边界：beforeEach隐藏原节点后仅依赖clone的animationend删除副本，没有导航失败/取消的恢复路径。

建议：把克隆、隐藏和还原作为同一可取消任务；监听导航结果，在失败、取消、卸载和超时兜底中幂等清理。

验收：取消导航后原侧栏可见、可聚焦。 快速重定向和切主题后没有残留clone、重复ID或hidden样式。

实现：[源码](../../../../src/frontend/web-blog/app/composables/useSidebarExitAnimation.ts#L20)。证据：edge/results.json（本地：`docs/motion-audit/evidence/edge/results.json`）、edge/cancelled-sidebar.png（本地：`docs/motion-audit/evidence/edge/cancelled-sidebar.png`）。

### M03 搜索按Enter跳转后弹窗再次打开

**P1 · 已复现并记录事件顺序**。范围：全局搜索；所有布局共享。

复现：1. 打开站内搜索并输入唯一文章标题。 2. 在输入框按Enter打开结果；与鼠标点击结果对照。

实际：键盘路径已进入文章URL，但搜索弹窗再次显示并锁定背景。事件记录为：输入框keydown→焦点归还搜索按钮→搜索按钮click→输入框重新获焦→keyup。鼠标路径正常关闭。

预期：结果跳转结束后显示目标正文；按键不会重新激活旧页面入口。

影响：键盘用户需额外关闭弹层，误以为导航无响应。

根因/边界：onEnter没有取消默认动作，关闭时同步归还焦点，使同一次Enter产生的默认按钮激活落到搜索入口。

建议：先处理IME，再阻止此次Enter的默认激活；区分用户取消和成功导航两种关闭原因，导航时将焦点转移到新页面适当位置。

验收：键盘Enter与鼠标选择都只导航一次且弹窗保持关闭。 Esc关闭仍将焦点归还原入口；IME确认不误导航。

实现：[源码](../../../../src/frontend/web-blog/app/components/common/SearchModal.vue#L13)、[源码](../../../../src/frontend/web-blog/app/components/common/SearchModal.vue#L146)、[源码](../../../../src/frontend/web-blog/app/composables/useModalFocus.ts#L142)。证据：search-key/results.json（本地：`docs/motion-audit/evidence/search-key/results.json`）、search-key/keyboard-700.png（本地：`docs/motion-audit/evidence/search-key/keyboard-700.png`）、search-key/mouse-700.png（本地：`docs/motion-audit/evidence/search-key/mouse-700.png`）。

### M04 颜色切换反复创建媒体查询监听

**P1 · 已复现并测量**。范围：全局颜色主题切换。

复现：1. 打开设置，将主题切换动画设为无动画。 2. 交替点击浅色/深色30次，关闭弹窗，等待并触发浏览器GC。 3. 记录MediaQueryList的add/remove以及浏览器DOM监听计数。

实际：新增60条prefers-reduced-motion change监听，移除0条；GC后DOM事件监听计数由384升至503。仅反复开关弹窗和常规导航的对照计数则在预热后稳定。

预期：重复切换复用偏好订阅；组件或应用结束后释放监听，数量不随操作线性增长。

影响：长期使用累积订阅和响应式工作，增加内存占用及系统偏好变化时的开销。

根因/边界：setTheme事件函数中再次调用useAppearanceSettings，而它每次创建useMediaQuery；该调用没有组件setup作用域负责销毁。

建议：在setup阶段获取所需偏好或通过共享只读state注入，避免从事件回调创建含副作用的composable；明确订阅所有者。

验收：切换100次后，媒体查询活跃订阅回到稳定基线。 系统深浅色及减少动态效果变化仍能实时响应。

实现：[源码](../../../../src/frontend/web-blog/app/composables/useTheme.ts#L56)、[源码](../../../../src/frontend/web-blog/app/composables/useAppearanceSettings.ts#L35)。证据：listener/results.json（本地：`docs/motion-audit/evidence/listener/results.json`）、performance/results.json（本地：`docs/motion-audit/evidence/performance/results.json`）。

### M05 减少动态效果只覆盖部分动效

**P1 · 已复现＋源码覆盖**。范围：三布局公共组件；认证、搜索、书签、留言、朋友圈。

复现：1. 浏览器实际启用prefers-reduced-motion: reduce。 2. 依次打开搜索/登录帮助/书签导入，切换分页，添加演示留言，点赞朋友圈。

实际：根布局fade-in-up仍有20px位移/600ms；搜索仍有位移缩放，认证子视图仍有高度及横向过渡，留言JS入场和朋友圈点赞仍播放；Sortable仍固定150ms。部分纯淡入仍保留，不能把所有opacity过渡都认定为可访问性违规。

预期：非必要位移、缩放、视差、弹跳及数字滚动响应系统偏好；信息反馈保持清楚。

影响：用户已选择减少动态效果仍受到明显移动干扰，体验在组件间不一致。

根因/边界：只将部分token设为0并为部分keyframe补媒体查询，未覆盖显式时长、JS动画、第三方排序以及已有动画运行中切换。

建议：建立统一偏好入口和按机制的降级策略；逐一接入显式CSS、JS及Sortable。先保证无动画收尾可靠，再关闭非必要运动。

验收：覆盖inventory中的每种非必要运动，正常/减少模式均测试。 运行中更改偏好可停止持续运动并呈现最终状态；没有等待永不触发的结束事件。

实现：[源码](../../../../src/frontend/web-blog/app/assets/styles/_base.scss#L95)、[源码](../../../../src/frontend/web-blog/app/assets/styles/_base.scss#L272)、[源码](../../../../src/frontend/web-blog/app/components/common/SearchModal.vue#L373)、[源码](../../../../src/frontend/web-blog/app/components/auth/AuthPanel.vue#L166)、[源码](../../../../src/frontend/web-blog/app/components/guestbook/MessageList.vue#L44)、[源码](../../../../src/frontend/web-blog/app/components/tab/TabBookmarkGrid.vue#L59)。证据：matrix/results.json（本地：`docs/motion-audit/evidence/matrix/results.json`）、edge/results.json（本地：`docs/motion-audit/evidence/edge/results.json`）、components/results.json（本地：`docs/motion-audit/evidence/components/results.json`）、supplement/results.json（本地：`docs/motion-audit/evidence/supplement/results.json`）、inventory-rules.json（本地：`docs/motion-audit/evidence/inventory-rules.json`）。

### M06 Aurora背景轮播和视差持续打断静态阅读

**P2 · 轮播已复现；不可见暂停为代码确认风险**。范围：Aurora首页和朋友圈Hero。

复现：1. 进入Aurora首页，开启减少动态效果。 2. 持续观察超过3秒，滚动越过Hero并浏览其他页面。

实际：减少模式下背景仍按3秒轮换，交叉淡入淡出各2秒；源码始终注册轮播interval，未按Hero可见性或页面可见性暂停，视差仍取scrollY×0.4。卸载主题时会清理interval。

预期：减少模式使用静态背景；非当前页面、Hero离屏和后台标签页停止不必要的轮播工作。

影响：阅读时反复出现大面积画面变化，同时产生无效更新。

根因/边界：主题内轮播/视差与全局偏好、路由及可见性没有建立联动。

建议：首选静态Hero；保留轮播时提供暂停控制，降低频率，按可见性管理生命周期，并在减少模式停用轮播和视差。

验收：减少模式观察至少10秒无换图和视差。 离开Hero、切后台及卸载后无持续无效更新；真实后台标签行为补充验证。

实现：[源码](../../../../src/frontend/web-blog/themes/aurora/app/components/RootLayout.vue#L146)、[源码](../../../../src/frontend/web-blog/themes/aurora/app/components/RootLayout.vue#L157)、[源码](../../../../src/frontend/web-blog/themes/aurora/app/components/RootLayout.vue#L174)。证据：themes/results.json（本地：`docs/motion-audit/evidence/themes/results.json`）、themes/aurora-reduced-rotation.png（本地：`docs/motion-audit/evidence/themes/aurora-reduced-rotation.png`）。

### M07 “无动画”颜色切换仍发生局部颜色插值

**P2 · 已复现**。范围：颜色切换无动画及不支持View Transitions的降级路径。

复现：1. 打开设置，将主题切换动画设为无动画。 2. 由深色切为浅色，检查最初几帧和过渡事件。

实际：无View Transition，但局部CSS color/background/border仍以各自时长插值。连续帧可见面板、选项和背景暂时明暗混杂。

预期：无动画路径同步完成颜色状态变化，不留下另一套主题过渡。

影响：设置含义不准确，中间帧影响视觉一致性。

根因/边界：仅data-color-mode-anim存在时才统一抑制CSS过渡，none及API不支持分支直接返回，没有执行同样的颜色过渡抑制。

建议：将颜色事务和视觉预设分离，为直接切换路径提供短生命周期的统一颜色更新机制；保留正常hover反馈。

验收：无动画路径不生成颜色插值事件；切换结束后普通交互样式恢复。 深浅色两个方向、系统切换及无API路径都验证。

实现：[源码](../../../../src/frontend/web-blog/app/composables/useTheme.ts#L61)、[源码](../../../../src/frontend/web-blog/app/assets/styles/_base.scss#L175)、[源码](../../../../src/frontend/web-blog/app/assets/styles/_tokens.scss#L40)。证据：themes/results.json（本地：`docs/motion-audit/evidence/themes/results.json`）、themes/color-无动画-0.png（本地：`docs/motion-audit/evidence/themes/color-无动画-0.png`）。

### M08 非当前主题资源失败可阻断开发页交互启动

**P1 · 已复现（资源故障注入）**。范围：独立开发副本冷启动；当前Nexus，Dock资源不可用。

复现：1. 新浏览器上下文拦截/themes/dock/下的样式模块及theme.config.ts。 2. 访问Nexus首页，等待8秒，然后尝试打开设置。 3. 取消拦截并完整刷新作为恢复对照。

实际：SSR正文存在，但设置入口不能完成点击操作；开发日志出现入口动态模块加载失败。恢复资源并刷新后可操作。此次注入未成功进入“已启动后主题切换失败”的回退路径。

预期：非当前主题失败不阻断当前页面启动；关键启动失败给出可操作的重试/刷新反馈，不永久覆盖可读SSR内容。

影响：会形成“页面外壳已有、交互未启动”的另一类故障。它与M01不同，不能据此断言历史截图由资源失败造成。

根因/边界：当前配置及预加载链将多主题依赖纳入启动路径；加载层退出依赖客户端ready，没有独立失败状态。

建议：拆分当前主题必需依赖和可选预热；为启动/预热设置明确错误反馈及恢复策略。后续另测已启动应用中的真实主题资源失败。

验收：不可用的非当前主题不阻断当前主题阅读与导航。 关键入口失败可恢复，失败后不存在透明阻挡层和无限假进度。

实现：[源码](../../../../src/frontend/web-blog/app/plugins/00.theme-preload.ts#L16)、[源码](../../../../src/frontend/web-blog/app/components/ThemeComponent.vue#L132)、[源码](../../../../src/frontend/web-blog/app/composables/useAppLoading.ts#L24)、[源码](../../../../src/frontend/web-blog/app/app.vue#L67)。证据：failure/results.json（本地：`docs/motion-audit/evidence/failure/results.json`）、failure/module-failure.png（本地：`docs/motion-audit/evidence/failure/module-failure.png`）、failure/module-restored.png（本地：`docs/motion-audit/evidence/failure/module-restored.png`）、development-diagnostics.txt（本地：`docs/motion-audit/evidence/development-diagnostics.txt`）。

### M09 减少动态效果条件导致SSR侧栏类名不一致

**P2 · 开发日志已确认**。范围：减少动态效果；Nexus首屏。

复现：1. 系统减少动态效果开启后完整刷新独立开发页。 2. 检查服务端转发的Vue水合警告。

实际：服务端class为空，客户端期望anim-sidebar-none；出现Hydration class mismatch。该警告在原实现与临时过渡对照中都存在。

预期：水合阶段类名一致；ready后应用实际偏好，避免可见动画闪现。

影响：引入水合噪声和首屏动效偏差风险，不能把该警告直接当作M01的原因。

根因/边界：sidebarAnimationClass在hydrated守卫之前提前返回减少模式类名，客户端媒体查询与SSR默认值不一致。

建议：调整水合守卫顺序并配合纯CSS首帧降级；保留动态偏好更新。

验收：深浅色、三主题、reduce/normal首次刷新无该水合警告，首帧不播放被禁用的位移。

实现：[源码](../../../../src/frontend/web-blog/app/composables/useAppearanceSettings.ts#L152)。证据：development-diagnostics.txt（本地：`docs/motion-audit/evidence/development-diagnostics.txt`）、ab/results.json（本地：`docs/motion-audit/evidence/ab/results.json`）。

### M10 阅读快捷键操作window，未使用实际滚动容器

**P2 · 已复现**。范围：Nexus/Aurora文章详情；Dock对照。

复现：1. 滚动至长文中段，点击当前可见正文以聚焦。 2. 按j；对照Nexus、Aurora与Dock的实际滚动位置。

实际：Nexus和Aurora的内部滚动位置分别保持4653/3792px不变；Dock的window从1800移动至1900px。代码中的j/k/t均直接操作window并强制smooth。

预期：快捷键作用于当前阅读容器，并遵守减少动态效果偏好。

影响：同一快捷键在不同布局表现不同，阅读中产生无响应感。

根因/边界：快捷键没有复用已实现的滚动根解析与减少动态效果逻辑。

建议：统一解析阅读滚动根，复用滚动行为策略；保留输入框和IME保护。

验收：三主题j/k/t都移动正确容器；reduce时不平滑运动。 目录、返回顶部及用户滚动中断规则保持一致。

实现：[源码](../../../../src/frontend/web-blog/app/composables/useKeyboardShortcuts.ts#L51)、[源码](../../../../src/frontend/web-blog/app/utils/scrollRoot.ts#L8)。证据：reading-spa/results.json（本地：`docs/motion-audit/evidence/reading-spa/results.json`）、reading-spa/reading-nexus.png（本地：`docs/motion-audit/evidence/reading-spa/reading-nexus.png`）。

### M11 图片入场按挂载播放，失败时网格缺少稳定占位

**P2 · 图片失败已复现；晚加载为代码确认风险**。范围：画廊、图片灯箱及通用图片揭示。

复现：1. 访问画廊时拦截Unsplash图片请求。 2. 与正常灯箱加载前后的连续帧对照。

实际：失败的画廊图片区域收缩为文本/破图，灯箱先显示深色背景和说明；没有明确的加载失败/重试反馈。img-reveal在节点挂载时执行，不等待load/decode。

预期：预留图片比例和空间，加载、成功、失败有清楚状态；入场与真正图像就绪衔接。

影响：内容跳变、误以为图片尚在加载，动画无法掩盖布局不稳定。

根因/边界：图片生命周期没有进入动效状态机；部分尺寸由远程图像实际到达后决定。

建议：添加稳定比例或尺寸约束、失败占位和重试；按图片就绪触发一次揭示，减少模式直接显示。

验收：慢图、破图、缓存图与无图时布局稳定；失败可以理解并恢复。

实现：[源码](../../../../src/frontend/web-blog/app/components/gallery/GalleryItem.vue#L16)、[源码](../../../../src/frontend/web-blog/app/components/gallery/LightBox.vue#L24)、[源码](../../../../src/frontend/web-blog/app/assets/styles/_base.scss#L79)。证据：edge/gallery-images-fail.png（本地：`docs/motion-audit/evidence/edge/gallery-images-fail.png`）、edge/results.json（本地：`docs/motion-audit/evidence/edge/results.json`）、matrix/results.json（本地：`docs/motion-audit/evidence/matrix/results.json`）。

### M12 手写入场回调缺少取消和结束兜底

**P2 · 代码确认风险，未复现永久卡死**。范围：连续文章列表、留言入场、数字统计、部分复制反馈。

复现：1. 在入场期间删除节点、离开页面，或改变减少动态效果/主题。 2. 检查rAF、timeout与transitionend的销毁路径。

实际：文章入场rAF和timeout未保存句柄；留言只靠一次transitionend调用done，未过滤目标和属性、未处理cancel及超时；数字递增没有保存rAF句柄。

预期：完成、取消、卸载、零时长都保证一次且仅一次收尾，并清理临时样式及调度。

影响：被中断时可能残留回调、样式或过渡状态；当前运行测试没有证明这些位置造成永久卡死。

根因/边界：各组件各自实现动画，缺少统一可取消协议。

建议：使用受控动画句柄或通用清理集合；实现enter-cancelled及卸载清理；有限时间兜底，done幂等。

验收：入场中导航、移除、减动效切换后无待处理动画任务。 transitioncancel、无transitionend时仍可靠收尾。

实现：[源码](../../../../src/frontend/web-blog/app/composables/usePostListAnimation.ts#L39)、[源码](../../../../src/frontend/web-blog/app/components/guestbook/MessageList.vue#L49)、[源码](../../../../src/frontend/web-blog/app/components/guestbook/ChatStats.vue#L73)。证据：inventory-rules.json（本地：`docs/motion-audit/evidence/inventory-rules.json`）、source-motion-hits.txt（本地：`docs/motion-audit/evidence/source-motion-hits.txt`）、interactions/results.json（本地：`docs/motion-audit/evidence/interactions/results.json`）。

### M13 Tooltip按Esc不关闭且不能悬停保留

**P2 · 已复现**。范围：共享Tooltip；列表模式提示及其他复用入口。

复现：1. 键盘聚焦连续加载按钮，等待提示出现。 2. 按Esc，保持焦点。

实际：提示仍显示；源码无Esc处理，浮层pointer-events:none，触发器离开80ms后关闭，富文本提示也无法移入保留。

预期：用户能主动关闭提示；需要阅读的较长内容允许维持显示，并与触发器建立可理解的关系。

影响：提示遮挡内容时无法直接清除，长提示阅读时间不足。

根因/边界：Tooltip仅由触发器enter/leave与focusin/out驱动，缺少关闭和浮层可达策略。

建议：添加Esc退出、稳定的触发器/浮层共同悬停状态及适当描述关联；保持普通短提示克制。

验收：Esc关闭后不立即重开，焦点不丢失；长提示可读，滚动定位不漂移。

实现：[源码](../../../../src/frontend/web-blog/app/components/common/Tooltip.vue#L83)、[源码](../../../../src/frontend/web-blog/app/components/common/Tooltip.vue#L185)。证据：edge/results.json（本地：`docs/motion-audit/evidence/edge/results.json`）、edge/tooltip-escape.png（本地：`docs/motion-audit/evidence/edge/tooltip-escape.png`）。

### M14 叠加绘制效果在CPU节流下出现明显帧间隔拉长

**P2 · 已测量；性能优化建议**。范围：Nexus：设置开关与首页/归档切换。

复现：1. 独立Chromium中对4秒设置开关和页面切换场景采集rAF与DevTools轨迹。 2. 对照CPU不节流与4倍节流。

实际：样本p95帧间隔由50ms升至66.7ms，最大由66.7ms升至200ms；4倍节流出现6个长任务。绘制累计时间约141→884ms，样式更新约67→463ms。轨迹统计存在嵌套，不能相加解释为总墙钟时间。

预期：核心交互在目标设备保持及时反馈，减少同帧大量绘制和布局。

影响：较弱设备容易感知卡顿；这不是全站FPS结论，也不等同于某个单一组件已被证明是唯一瓶颈。

根因/边界：轨迹显示Paint/UpdateLayoutTree成本显著；广泛transition:all、阴影/模糊、布局式进度条和滚动测量是进一步定位入口。

建议：依据轨迹逐项减少无效绘制、收窄过渡属性、合并滚动测量，进度优先transform。复测相同负载，避免无依据堆叠will-change。

验收：同一环境、同一交互至少重复采样，报告分布与相对改善。 补充代表性真实移动设备后再设设备级性能门槛。

实现：[源码](../../../../src/frontend/web-blog/app/assets/styles/_components.scss#L15)、[源码](../../../../src/frontend/web-blog/app/components/common/AppearanceDrawer.vue#L352)、[源码](../../../../src/frontend/web-blog/app/components/common/CustomScrollbar.vue#L200)。证据：performance/results.json（本地：`docs/motion-audit/evidence/performance/results.json`）、performance/cpu-1-trace.json（本地：`docs/motion-audit/evidence/performance/cpu-1-trace.json`）、performance/cpu-4-trace.json（本地：`docs/motion-audit/evidence/performance/cpu-4-trace.json`）、advanced/results.json（本地：`docs/motion-audit/evidence/advanced/results.json`）。

### M15 重叠颜色切换缺少事务归属

**P2 · 代码确认风险，连续键盘测试未出现终态锁死**。范围：颜色切换circle/fade/blur。

复现：1. 在一次颜色切换尚未完成时通过键盘请求下一次切换。 2. 检查data属性设置及finished.finally清理的归属。

实际：每次请求写相同根节点data属性，每个旧finished均无条件删除这些属性；没有当前事务ID或显式取消策略。本次连续键盘测试最终颜色可恢复，没有证实永久遮挡。

预期：只有当前事务能清理自己的根样式，最后一次操作决定最终状态。

影响：中间帧可能使用错误预设或临时恢复CSS颜色插值。

根因/边界：共享DOM状态由互不识别的异步任务管理。

建议：保存当前ViewTransition及事务ID，对替换、失败、取消、结束进行幂等处理；必要时skip旧transition。

验收：连续键盘切换中旧任务不能删除新任务属性；最终无伪元素、属性或遮罩残留。

实现：[源码](../../../../src/frontend/web-blog/app/composables/useTheme.ts#L85)、[源码](../../../../src/frontend/web-blog/app/composables/useTheme.ts#L124)。证据：themes/results.json（本地：`docs/motion-audit/evidence/themes/results.json`）、source-motion-hits.txt（本地：`docs/motion-audit/evidence/source-motion-hits.txt`）。

### M16 等待和交错入场预算缺少统一上限

**P3 · 体验建议，时长由源码确认**。范围：首屏、主题切换、连续文章列表、右侧栏。

复现：1. 比较首屏、普通路由、翻页、连续加载及布局主题切换的节奏。

实际：首屏ready后仍固定等待800ms；新增15张文章卡的最后一张最迟约1050ms完成入场；纵向路由CSS为150ms而Vue显式时长180ms。部分等待有视觉目的，但缺统一预算。

预期：高频操作迅速完成，装饰性等待有明确预算且不延迟内容访问。

影响：博客阅读节奏不一致，快速浏览时有多余等待感。

根因/边界：时长和延迟分散在组件、composable和全局样式中。

建议：建立统一motion token，按用途定义上限；列表交错只作用于可见新增内容且限制总尾延迟，移除与真实加载无关的固定等待。

验收：规则集中、可解释，视觉稿与实际计算时长一致；首屏不因装饰延迟阻止已就绪操作。

实现：[源码](../../../../src/frontend/web-blog/app/app.vue#L67)、[源码](../../../../src/frontend/web-blog/app/composables/usePostListAnimation.ts#L31)、[源码](../../../../src/frontend/web-blog/app/composables/useAppearanceSettings.ts#L103)、[源码](../../../../src/frontend/web-blog/app/assets/styles/_utilities.scss#L61)。证据：inventory-rules.json（本地：`docs/motion-audit/evidence/inventory-rules.json`）、interactions/results.json（本地：`docs/motion-audit/evidence/interactions/results.json`）、development/results.json（本地：`docs/motion-audit/evidence/development/results.json`）。

## 优先顺序和验证边界

先处理M01/M02/M03的导航及焦点收尾，再处理M04/M08/M09的生命周期与启动，随后统一M05/M06/M07/M10/M12/M15的偏好和中断策略，最后完成图片、Tooltip及绘制与节奏优化。完整可执行任务见[整改提示词](remediation-prompt.md)。

本轮使用当前源文件指纹和新采集证据，未复用历史截图充当本轮结果。故障注入、临时对照、自动化目标失配和修正均在coverage中公开记录。真实Safari/Firefox、手机系统键盘/惯性滚动、辅助技术朗读、后台标签节流、物理低端GPU、闪烁阈值分析仍未验证。完整组合与限制见[覆盖矩阵](coverage.md)。

## 交付核验

完成核验记录（本地：`docs/motion-audit/evidence/completion-check.json`）列明源文件未变更、证据链接与测试资源清理结果。复现脚本保存在evidence/reproduce（本地：`docs/motion-audit/evidence/reproduce/README.md`）。本次已结束12543/12544隔离预览及其子进程，删除唯一对应审查进程的随机数据库和空测试媒体目录；日常开发3456接口仍返回200。
