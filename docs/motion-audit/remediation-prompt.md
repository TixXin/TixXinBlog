请在D:/Projects/TixXinBlog中，根据本轮动效审查完成整改，交付经过实际验证的结果。

先阅读以下当前审查材料并确认源码指纹是否仍适用：
- D:/Projects/TixXinBlog/docs/motion-audit/report.md
- D:/Projects/TixXinBlog/docs/motion-audit/findings.json
- D:/Projects/TixXinBlog/docs/motion-audit/inventory.md
- D:/Projects/TixXinBlog/docs/motion-audit/coverage.md
- D:/Projects/TixXinBlog/docs/motion-audit/motion-spec.md

目标：修复已复现的导航/焦点/订阅问题，完善动效中断和减少动态效果策略，改善加载、滚动及绘制表现，保留博客的三种布局和现有业务能力。此前的“审查完成”不代表产品问题已修复。

执行约束：保留现有工作区修改、数据源边界和业务接口；先验证现状，不盲目应用过时结论。遵循项目AGENTS.md。写入测试使用隔离数据库，开发/HMR/构建使用独立生成目录和缓存。将本轮诊断副本的临时改动视为证据而非正式补丁。

不能通过禁止连续导航、取消全部正常动画、吞掉错误、删除功能或锁住页面来让检查通过。对纯体验建议采用与现有风格一致的实现；对代码风险先构造有意义的中断场景，再决定实现范围。

按以下依赖顺序完成：

T01 修复零时长路由竞态
依赖：无。对应：M01。
修改范围：D:/Projects/TixXinBlog/src/frontend/web-blog/app/layouts/default.vue:28；D:/Projects/TixXinBlog/src/frontend/web-blog/app/composables/useAppearanceSettings.ts:86。
预期效果：无动画模式直接完成内容切换；快速导航最终呈现最后一次请求的页面，标题、URL和导航状态一致。
实现方向：无动画/减少动态效果时真正关闭页面过渡包装；将fullbleed等布局状态同步从动画钩子中解耦。为导航中断和异步页面替换建立明确收尾规则，保留正常模式过渡。
验收与回归：
- 三主题、正常/关闭/减少动态效果执行30/120/300ms导航压力测试；最终正文、URL、标题一致。
- 慢请求、前进后退及全宽页面切换不挂起；不能用阻止用户导航掩盖问题。
复现参考：D:/Projects/TixXinBlog/docs/motion-audit/evidence/race/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/ab/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/race/pointer-关闭动画-false-30.png；D:/Projects/TixXinBlog/docs/motion-audit/evidence/ab/ab-true-0.png。

T02 使侧栏离场可取消和恢复
依赖：T01。对应：M02。
修改范围：D:/Projects/TixXinBlog/src/frontend/web-blog/app/composables/useSidebarExitAnimation.ts:20。
预期效果：取消或失败的导航恢复当前页面侧栏，移除临时副本并还原原始属性。
实现方向：把克隆、隐藏和还原作为同一可取消任务；监听导航结果，在失败、取消、卸载和超时兜底中幂等清理。
验收与回归：
- 取消导航后原侧栏可见、可聚焦。
- 快速重定向和切主题后没有残留clone、重复ID或hidden样式。
复现参考：D:/Projects/TixXinBlog/docs/motion-audit/evidence/edge/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/edge/cancelled-sidebar.png。

T03 修复搜索按键与导航焦点
依赖：无。对应：M03。
修改范围：D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/common/SearchModal.vue:13；D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/common/SearchModal.vue:146；D:/Projects/TixXinBlog/src/frontend/web-blog/app/composables/useModalFocus.ts:142。
预期效果：结果跳转结束后显示目标正文；按键不会重新激活旧页面入口。
实现方向：先处理IME，再阻止此次Enter的默认激活；区分用户取消和成功导航两种关闭原因，导航时将焦点转移到新页面适当位置。
验收与回归：
- 键盘Enter与鼠标选择都只导航一次且弹窗保持关闭。
- Esc关闭仍将焦点归还原入口；IME确认不误导航。
复现参考：D:/Projects/TixXinBlog/docs/motion-audit/evidence/search-key/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/search-key/keyboard-700.png；D:/Projects/TixXinBlog/docs/motion-audit/evidence/search-key/mouse-700.png。

T04 统一订阅所有权与水合偏好
依赖：无。对应：M04、M09。
修改范围：D:/Projects/TixXinBlog/src/frontend/web-blog/app/composables/useTheme.ts:56；D:/Projects/TixXinBlog/src/frontend/web-blog/app/composables/useAppearanceSettings.ts:35；D:/Projects/TixXinBlog/src/frontend/web-blog/app/composables/useAppearanceSettings.ts:152。
预期效果：重复切换复用偏好订阅；组件或应用结束后释放监听，数量不随操作线性增长。 水合阶段类名一致；ready后应用实际偏好，避免可见动画闪现。
实现方向：在setup阶段获取所需偏好或通过共享只读state注入，避免从事件回调创建含副作用的composable；明确订阅所有者。 调整水合守卫顺序并配合纯CSS首帧降级；保留动态偏好更新。
验收与回归：
- 切换100次后，媒体查询活跃订阅回到稳定基线。
- 系统深浅色及减少动态效果变化仍能实时响应。
- 深浅色、三主题、reduce/normal首次刷新无该水合警告，首帧不播放被禁用的位移。
复现参考：D:/Projects/TixXinBlog/docs/motion-audit/evidence/listener/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/performance/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/development-diagnostics.txt；D:/Projects/TixXinBlog/docs/motion-audit/evidence/ab/results.json。

T05 隔离可选主题预热与启动错误恢复
依赖：T01、T04。对应：M08。
修改范围：D:/Projects/TixXinBlog/src/frontend/web-blog/app/plugins/00.theme-preload.ts:16；D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/ThemeComponent.vue:132；D:/Projects/TixXinBlog/src/frontend/web-blog/app/composables/useAppLoading.ts:24；D:/Projects/TixXinBlog/src/frontend/web-blog/app/app.vue:67。
预期效果：非当前主题失败不阻断当前页面启动；关键启动失败给出可操作的重试/刷新反馈，不永久覆盖可读SSR内容。
实现方向：拆分当前主题必需依赖和可选预热；为启动/预热设置明确错误反馈及恢复策略。后续另测已启动应用中的真实主题资源失败。
验收与回归：
- 不可用的非当前主题不阻断当前主题阅读与导航。
- 关键入口失败可恢复，失败后不存在透明阻挡层和无限假进度。
复现参考：D:/Projects/TixXinBlog/docs/motion-audit/evidence/failure/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/failure/module-failure.png；D:/Projects/TixXinBlog/docs/motion-audit/evidence/failure/module-restored.png；D:/Projects/TixXinBlog/docs/motion-audit/evidence/development-diagnostics.txt。

T06 建立可取消动效协议并接入减少模式
依赖：T01、T02、T04。对应：M05、M12。
修改范围：D:/Projects/TixXinBlog/src/frontend/web-blog/app/assets/styles/_base.scss:95；D:/Projects/TixXinBlog/src/frontend/web-blog/app/assets/styles/_base.scss:272；D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/common/SearchModal.vue:373；D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/auth/AuthPanel.vue:166；D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/guestbook/MessageList.vue:44；D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/tab/TabBookmarkGrid.vue:59；D:/Projects/TixXinBlog/src/frontend/web-blog/app/composables/usePostListAnimation.ts:39；D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/guestbook/MessageList.vue:49；D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/guestbook/ChatStats.vue:73。
预期效果：非必要位移、缩放、视差、弹跳及数字滚动响应系统偏好；信息反馈保持清楚。 完成、取消、卸载、零时长都保证一次且仅一次收尾，并清理临时样式及调度。
实现方向：建立统一偏好入口和按机制的降级策略；逐一接入显式CSS、JS及Sortable。先保证无动画收尾可靠，再关闭非必要运动。 使用受控动画句柄或通用清理集合；实现enter-cancelled及卸载清理；有限时间兜底，done幂等。
验收与回归：
- 覆盖inventory中的每种非必要运动，正常/减少模式均测试。
- 运行中更改偏好可停止持续运动并呈现最终状态；没有等待永不触发的结束事件。
- 入场中导航、移除、减动效切换后无待处理动画任务。
- transitioncancel、无transitionend时仍可靠收尾。
复现参考：D:/Projects/TixXinBlog/docs/motion-audit/evidence/matrix/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/edge/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/components/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/supplement/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/inventory-rules.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/inventory-rules.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/source-motion-hits.txt；D:/Projects/TixXinBlog/docs/motion-audit/evidence/interactions/results.json。

T07 颜色切换事务与即时降级
依赖：T04、T06。对应：M07、M15。
修改范围：D:/Projects/TixXinBlog/src/frontend/web-blog/app/composables/useTheme.ts:61；D:/Projects/TixXinBlog/src/frontend/web-blog/app/assets/styles/_base.scss:175；D:/Projects/TixXinBlog/src/frontend/web-blog/app/assets/styles/_tokens.scss:40；D:/Projects/TixXinBlog/src/frontend/web-blog/app/composables/useTheme.ts:85；D:/Projects/TixXinBlog/src/frontend/web-blog/app/composables/useTheme.ts:124。
预期效果：无动画路径同步完成颜色状态变化，不留下另一套主题过渡。 只有当前事务能清理自己的根样式，最后一次操作决定最终状态。
实现方向：将颜色事务和视觉预设分离，为直接切换路径提供短生命周期的统一颜色更新机制；保留正常hover反馈。 保存当前ViewTransition及事务ID，对替换、失败、取消、结束进行幂等处理；必要时skip旧transition。
验收与回归：
- 无动画路径不生成颜色插值事件；切换结束后普通交互样式恢复。
- 深浅色两个方向、系统切换及无API路径都验证。
- 连续键盘切换中旧任务不能删除新任务属性；最终无伪元素、属性或遮罩残留。
复现参考：D:/Projects/TixXinBlog/docs/motion-audit/evidence/themes/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/themes/color-无动画-0.png；D:/Projects/TixXinBlog/docs/motion-audit/evidence/themes/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/source-motion-hits.txt。

T08 停止不必要轮播和统一阅读滚动
依赖：T06。对应：M06、M10。
修改范围：D:/Projects/TixXinBlog/src/frontend/web-blog/themes/aurora/app/components/RootLayout.vue:146；D:/Projects/TixXinBlog/src/frontend/web-blog/themes/aurora/app/components/RootLayout.vue:157；D:/Projects/TixXinBlog/src/frontend/web-blog/themes/aurora/app/components/RootLayout.vue:174；D:/Projects/TixXinBlog/src/frontend/web-blog/app/composables/useKeyboardShortcuts.ts:51；D:/Projects/TixXinBlog/src/frontend/web-blog/app/utils/scrollRoot.ts:8。
预期效果：减少模式使用静态背景；非当前页面、Hero离屏和后台标签页停止不必要的轮播工作。 快捷键作用于当前阅读容器，并遵守减少动态效果偏好。
实现方向：首选静态Hero；保留轮播时提供暂停控制，降低频率，按可见性管理生命周期，并在减少模式停用轮播和视差。 统一解析阅读滚动根，复用滚动行为策略；保留输入框和IME保护。
验收与回归：
- 减少模式观察至少10秒无换图和视差。
- 离开Hero、切后台及卸载后无持续无效更新；真实后台标签行为补充验证。
- 三主题j/k/t都移动正确容器；reduce时不平滑运动。
- 目录、返回顶部及用户滚动中断规则保持一致。
复现参考：D:/Projects/TixXinBlog/docs/motion-audit/evidence/themes/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/themes/aurora-reduced-rotation.png；D:/Projects/TixXinBlog/docs/motion-audit/evidence/reading-spa/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/reading-spa/reading-nexus.png。

T09 完善图像状态和提示关闭
依赖：T03、T06。对应：M11、M13。
修改范围：D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/gallery/GalleryItem.vue:16；D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/gallery/LightBox.vue:24；D:/Projects/TixXinBlog/src/frontend/web-blog/app/assets/styles/_base.scss:79；D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/common/Tooltip.vue:83；D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/common/Tooltip.vue:185。
预期效果：预留图片比例和空间，加载、成功、失败有清楚状态；入场与真正图像就绪衔接。 用户能主动关闭提示；需要阅读的较长内容允许维持显示，并与触发器建立可理解的关系。
实现方向：添加稳定比例或尺寸约束、失败占位和重试；按图片就绪触发一次揭示，减少模式直接显示。 添加Esc退出、稳定的触发器/浮层共同悬停状态及适当描述关联；保持普通短提示克制。
验收与回归：
- 慢图、破图、缓存图与无图时布局稳定；失败可以理解并恢复。
- Esc关闭后不立即重开，焦点不丢失；长提示可读，滚动定位不漂移。
复现参考：D:/Projects/TixXinBlog/docs/motion-audit/evidence/edge/gallery-images-fail.png；D:/Projects/TixXinBlog/docs/motion-audit/evidence/edge/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/matrix/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/edge/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/edge/tooltip-escape.png。

T10 基于轨迹优化绘制并统一节奏
依赖：T01、T02、T03、T04、T05、T06、T07、T08、T09。对应：M14、M16。
修改范围：D:/Projects/TixXinBlog/src/frontend/web-blog/app/assets/styles/_components.scss:15；D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/common/AppearanceDrawer.vue:352；D:/Projects/TixXinBlog/src/frontend/web-blog/app/components/common/CustomScrollbar.vue:200；D:/Projects/TixXinBlog/src/frontend/web-blog/app/app.vue:67；D:/Projects/TixXinBlog/src/frontend/web-blog/app/composables/usePostListAnimation.ts:31；D:/Projects/TixXinBlog/src/frontend/web-blog/app/composables/useAppearanceSettings.ts:103；D:/Projects/TixXinBlog/src/frontend/web-blog/app/assets/styles/_utilities.scss:61。
预期效果：核心交互在目标设备保持及时反馈，减少同帧大量绘制和布局。 高频操作迅速完成，装饰性等待有明确预算且不延迟内容访问。
实现方向：依据轨迹逐项减少无效绘制、收窄过渡属性、合并滚动测量，进度优先transform。复测相同负载，避免无依据堆叠will-change。 建立统一motion token，按用途定义上限；列表交错只作用于可见新增内容且限制总尾延迟，移除与真实加载无关的固定等待。
验收与回归：
- 同一环境、同一交互至少重复采样，报告分布与相对改善。
- 补充代表性真实移动设备后再设设备级性能门槛。
- 规则集中、可解释，视觉稿与实际计算时长一致；首屏不因装饰延迟阻止已就绪操作。
复现参考：D:/Projects/TixXinBlog/docs/motion-audit/evidence/performance/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/performance/cpu-1-trace.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/performance/cpu-4-trace.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/advanced/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/inventory-rules.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/interactions/results.json；D:/Projects/TixXinBlog/docs/motion-audit/evidence/development/results.json。

最终回归必须包含：
1. 三主题×正常/关闭/减少动态效果的快速导航，30/120/300ms间隔；等待最后请求完成后断言正文、URL、title一致。
2. 模拟后置守卫取消导航，确认侧栏可见且无clone/hidden残留。
3. 搜索键盘Enter、鼠标、Esc与IME；确认不会重开，焦点正确。
4. 颜色切换100次、模态开关30次、反复导航；区分预热增长与持续增长，记录媒体查询添加/移除。
5. 系统配色及减少动态效果在运行中改变；正在播放的CSS、JS、Sortable、轮播都可靠收尾。
6. 列表分页/追加/筛选、慢请求/失败/重试、图片晚到/失败/无图；已读内容和草稿不被动画丢弃。
7. 长文目录、站内返回阅读位置、用户中断滚动、j/k/t与实际滚动容器，手机和桌面均检查。
8. 认证/搜索/设置/身份/灯箱/书签导入的嵌套、快速开关、路由变化及卸载清理。
9. 样式/SFC/布局/相关composable热更新，以及配置重启后的交互恢复；复查减少模式水合警告。
10. 初始主题资源故障与应用启动后的主题资源故障分别注入；明确可恢复状态，不把被缓存资源导致的无效拦截当作通过。
11. 固定负载、固定设备和浏览器的性能前后样本，至少重复采样3轮；记录正常及节流条件。
12. 320/390/768/1024/1440/1920及真实断点邻近宽度；三主题、两配色、减少模式有代表性覆盖。

补齐本次审查的验证缺口：有效的书签拖拽/键盘替代操作；Dock返回顶部或其明确的功能边界；真实移动端惯性及软键盘；支持范围内的Safari/Firefox；后台标签暂停；字体延迟；AI搜索与全部上下文弹层。环境无法覆盖时说明具体限制，不伪造通过。

验证命令使用项目已定义的Lint、类型检查、必要单测、构建及隔离E2E流程。新增回归测试重点覆盖竞态、中断、错误恢复和资源释放，避免只镜像实现。浏览器捕获实际动画；不要以禁用动画的截图证明动效效果。

交付：正式代码修改、必要回归测试、逐项M01–M16处理记录、前后证据、性能与覆盖结果，以及更新后的todo/目录文档。测试日志注明哪些属于产品缺陷、哪些是测试脚本问题。已解决项必须以当前源码和实际结果证明；保留未解决项及原因。提交、推送、部署按会话授权执行。
