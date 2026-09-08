# 动效机制台账

> 本文截图、录屏、原始日志、采样和临时实验脚本仅在本机留存，不随 Git 发布。下列本地产物路径以仓库根目录为起点，新检出不包含这些文件；验收结论与正式测试源码继续保留。见[验收产物管理](../verification-artifacts.md)。

以当前338个源文件为扫描范围，135文件命中719处动效/调度语法；Sass实际编译提取423条过渡/动画/will-change规则、51个Vue过渡入口。命中数不等于独立动画数。另人工检查ThemeComponent、预加载插件、useModalFocus及主题引擎/Sortable等复用机制。

## 机制归并

以下按用途合并复用组件；精确选择器、属性值、关键帧和Vue触发条件见后附逐文件规则。运行期实际计算结果优先于注释描述，未运行的分支明确注明。

### I01 全局颜色状态反馈

- 位置/入口：[app/assets/styles/_tokens.scss](../../src/frontend/web-blog/app/assets/styles/_tokens.scss)。
- 触发及用途：全局颜色状态反馈；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：颜色300ms ease；fast200/normal300ms all。
- 层级：随组件。
- 中断与布局：CSS重定向过渡；颜色通常不布局，但all可能覆盖布局属性。
- 减少动态效果：fast/normal取0；colors仍300ms。
- 验证/问题：M07/M14。

### I02 首屏品牌/加载反馈

- 位置/入口：[app/app.vue](../../src/frontend/web-blog/app/app.vue)。
- 触发及用途：首屏品牌/加载反馈；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：ready后800ms；品牌入场500ms/16px；退出500ms/-24px。
- 层级：9999。
- 中断与布局：退出依赖ready；没有启动失败交互；生产visited会隐藏首屏层。
- 减少动态效果：装饰循环停止，固定等待仍在。
- 验证/问题：M08/M16。

### I03 顶部加载进度

- 位置/入口：[app/components/common/AppLoadingTopBar.vue](../../src/frontend/web-blog/app/components/common/AppLoadingTopBar.vue)。
- 触发及用途：顶部加载进度；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：transform200ms，退出opacity300ms。
- 层级：顶部固定层。
- 中断与布局：useLoadingProgress：interval清理；进度包含假进度。
- 减少动态效果：CSS过渡被关。
- 验证/问题：development。

### I04 主题预加载与组件替换

- 位置/入口：[app/plugins/00.theme-preload.ts](../../src/frontend/web-blog/app/plugins/00.theme-preload.ts)。
- 触发及用途：主题预加载与组件替换；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：逐个await所有主题组件；useLayoutTheme最少200ms；ThemeComponent异步缓存。
- 层级：主题加载层9999。
- 中断与布局：预热缓存、请求ID防旧结果；启动依赖和失败提示不完整；换布局影响页面实例。
- 减少动态效果：最少等待降到0，但启动依赖不变。
- 验证/问题：M08；当前lazyLoadThemes=false。

### I05 颜色圆形扩张/收回

- 位置/入口：[app/composables/useTheme.ts](../../src/frontend/web-blog/app/composables/useTheme.ts)。
- 触发及用途：颜色圆形扩张/收回；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：520ms cubic-bezier(.4,0,.2,1)；clip-path圆半径按视口；指针/按钮中心。
- 层级：ViewTransition伪元素层。
- 中断与布局：WAAPI fill forwards；finished删共享data，未做事务归属；不改变文档流。
- 减少动态效果：JS跳过VT；CSS颜色仍插值。
- 验证/问题：M04/M07/M15。

### I06 颜色渐变/模糊

- 位置/入口：[app/assets/styles/_base.scss](../../src/frontend/web-blog/app/assets/styles/_base.scss)。
- 触发及用途：颜色渐变/模糊；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：fade350ms；blur450ms，18px模糊。
- 层级：根视图快照层。
- 中断与布局：新旧根快照叠加，临时抑制其他颜色过渡；不改变布局。
- 减少动态效果：跳过VT。
- 验证/问题：themes/advanced。

### I07 路由空间衔接

- 位置/入口：[app/layouts/default.vue](../../src/frontend/web-blog/app/layouts/default.vue)。
- 触发及用途：路由空间衔接；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：out-in；vertical CSS150ms ±10px/Vue180ms；soft160ms ±6px；fade140ms；none0。
- 层级：主内容区。
- 中断与布局：含异步Suspense、全宽状态onBeforeEnter；零时长仍包装导致竞态。
- 减少动态效果：返回none对象而非false。
- 验证/问题：M01/M16。

### I08 分页与连续新增

- 位置/入口：[app/components/blog/PostCardList.vue](../../src/frontend/web-blog/app/components/blog/PostCardList.vue)。
- 触发及用途：分页与连续新增；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：分页淡入/淡出见规则附录；连续350ms ease + 每项50ms、20px。
- 层级：主内容区。
- 中断与布局：key切换；新增集合才进入；JS无句柄清理；布局随条目改变。
- 减少动态效果：连续JS跳过；分页仍有过渡。
- 验证/问题：M05/M12/M16；15→30已观察。

### I09 右侧栏进入

- 位置/入口：[app/assets/styles/_utilities.scss](../../src/frontend/web-blog/app/assets/styles/_utilities.scss)。
- 触发及用途：右侧栏进入；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：右移24px/350ms，fade250ms，scale .92/300ms；Vue版本250/200ms。
- 层级：右栏内部。
- 中断与布局：Teleport目标/子元素作用域；只变opacity/transform。
- 减少动态效果：名称/类替换none；水合类名不同。
- 验证/问题：M09。

### I10 右侧栏离场副本

- 位置/入口：[app/composables/useSidebarExitAnimation.ts](../../src/frontend/web-blog/app/composables/useSidebarExitAnimation.ts)。
- 触发及用途：右侧栏离场副本；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：普通淡出150ms，右移24px/200ms。
- 层级：绝对定位到aside。
- 中断与布局：克隆inert/aria-hidden；隐藏源；仅animationend移除副本，取消导航不恢复。
- 减少动态效果：新导航守卫跳过；现有任务无专门中断。
- 验证/问题：M02。

### I11 根布局入场/图片揭示

- 位置/入口：[app/assets/styles/_base.scss](../../src/frontend/web-blog/app/assets/styles/_base.scss)。
- 触发及用途：根布局入场/图片揭示；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：fade-in-up600ms、20px，延迟100–600ms；img-reveal450ms scale1.015。
- 层级：正常文档流。
- 中断与布局：按挂载播放、填充forwards/both；图片加载晚于入场可跳变。
- 减少动态效果：图片降级；根fade-in-up未降级。
- 验证/问题：M05/M11。

### I12 外观设置面板及遮罩

- 位置/入口：[app/components/common/AppearanceDrawer.vue](../../src/frontend/web-blog/app/components/common/AppearanceDrawer.vue)。
- 触发及用途：外观设置面板及遮罩；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：遮罩180ms；面板opacity/transform200ms ease。
- 层级：遮罩/面板79/80附近，源码为准。
- 中断与布局：面板基准translate(-50%,-50%)；运行样本仅opacity过渡，位移规则被更具体基准样式覆盖；关闭触发模态栈释放。
- 减少动态效果：显式过渡仍在；图标300ms旋转仍在。
- 验证/问题：matrix；进入/退出存在定义与计算样式差异。

### I13 搜索与上下文抽屉

- 位置/入口：[app/components/common/SearchModal.vue](../../src/frontend/web-blog/app/components/common/SearchModal.vue)。
- 触发及用途：搜索与上下文抽屉；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：搜索200ms、-10px scale.98；ContextDrawer150ms淡入；搜索防抖250ms。
- 层级：搜索200；上下文70。
- 中断与布局：焦点栈、Esc、遮罩关闭；成功导航键盘默认动作造成重开。
- 减少动态效果：显式位移仍在。
- 验证/问题：M03/M05。

### I14 登录弹层与表单视图

- 位置/入口：[app/components/auth/AuthPanel.vue](../../src/frontend/web-blog/app/components/auth/AuthPanel.vue)。
- 触发及用途：登录弹层与表单视图；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：外层200/150ms；面板12px scale.96；表单横滑200ms、高度300ms。
- 层级：84/85。
- 中断与布局：ResizeObserver测高度，切表单断开旧观察器，卸载清理；height触发布局，永久will-change:height无明显收益。
- 减少动态效果：未专门降级。
- 验证/问题：supplement/auth；M05/M14。

### I15 游客身份弹窗

- 位置/入口：[app/components/common/GuestIdentityModal.vue](../../src/frontend/web-blog/app/components/common/GuestIdentityModal.vue)。
- 触发及用途：游客身份弹窗；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：外层200ms，面板transform/opacity见规则附录。
- 层级：body模态层。
- 中断与布局：身份确认与登录切换；模态栈释放/归还；用户数据不因动画丢失。
- 减少动态效果：显式面板过渡未全覆盖。
- 验证/问题：edge/supplement。

### I16 画廊/动态/闪念灯箱

- 位置/入口：[app/components/gallery/LightBox.vue](../../src/frontend/web-blog/app/components/gallery/LightBox.vue)。
- 触发及用途：画廊/动态/闪念灯箱；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：画廊直接显隐；动态/闪念250ms进入、200ms退出，换图主要直接替换。
- 层级：100上下，详见各样式。
- 中断与布局：三独立实现；键盘左右/Esc；关闭释放焦点；画廊无加载/失败状态。
- 减少动态效果：部分纯淡入仍在，画廊本来无面板位移。
- 验证/问题：matrix/components/supplement；M11。

### I17 Tooltip与作者悬停卡

- 位置/入口：[app/components/common/Tooltip.vue](../../src/frontend/web-blog/app/components/common/Tooltip.vue)。
- 触发及用途：Tooltip与作者悬停卡；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：提示延迟200ms、离开80ms、进入150/退出100ms、4px偏移；作者卡200/150ms。
- 层级：Tooltip9999；作者卡局部浮层。
- 中断与布局：提示定时器卸载清理；无Esc；富提示不可悬停保留；作者卡延迟任务需补清理审查。
- 减少动态效果：显式位移未降级。
- 验证/问题：M13；作者卡为代码风险范围。

### I18 Toast状态通知

- 位置/入口：[app/components/common/ToastContainer.vue](../../src/frontend/web-blog/app/components/common/ToastContainer.vue)。
- 触发及用途：Toast状态通知；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：300ms弹性曲线，-1rem scale.9；定时移除。
- 层级：9999。
- 中断与布局：TransitionGroup；aria-live polite；指针容器穿透，消息本体可命中；批量消息重排未见move类。
- 减少动态效果：显式过渡未降级。
- 验证/问题：components；M05。

### I19 滚动条/回顶/进度

- 位置/入口：[app/components/common/CustomScrollbar.vue](../../src/frontend/web-blog/app/components/common/CustomScrollbar.vue)。
- 触发及用途：滚动条/回顶/进度；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：滑块transform100ms；显示/隐藏150–300ms；点击循环弹跳600ms；阅读条width150ms。
- 层级：局部滚动区及固定入口。
- 中断与布局：scroll读取尺寸+更新；observer和hide timer有清理；拖动和点击反馈规则独立。
- 减少动态效果：部分弹跳和scrollTo降级；其他显式过渡保留。
- 验证/问题：M10/M14。

### I20 滚动恢复与目录

- 位置/入口：[app/composables/usePageScrollRestoration.ts](../../src/frontend/web-blog/app/composables/usePageScrollRestoration.ts)。
- 触发及用途：滚动恢复与目录；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：rAF两帧恢复，最长2秒窗口；scrollArticleHeading按偏好smooth/instant。
- 层级：实际滚动根。
- 中断与布局：Mutation/ResizeObserver及路由钩子调度；wheel/touch/pointer/key取消；清理句柄。
- 减少动态效果：主要滚动工具支持；全局快捷键未复用。
- 验证/问题：reading-spa/advanced；M10。

### I21 Aurora Hero轮播/视差

- 位置/入口：[themes/aurora/app/components/RootLayout.vue](../../src/frontend/web-blog/themes/aurora/app/components/RootLayout.vue)。
- 触发及用途：Aurora Hero轮播/视差；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：每3000ms换图、2000ms交叉淡入；scrollY×.4视差；永久will-change:transform。
- 层级：Hero背景与顶部栏。
- 中断与布局：离开首页未停止interval；主题卸载清理；滚动源更新未按帧合并。
- 减少动态效果：轮播/视差未降级。
- 验证/问题：M06。

### I22 Nexus底栏展开/状态

- 位置/入口：[themes/nexus/app/components/StatusFooter.vue](../../src/frontend/web-blog/themes/nexus/app/components/StatusFooter.vue)。
- 触发及用途：Nexus底栏展开/状态；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：多段height/opacity/transform及60/100/140ms子项延迟；头像3秒循环；回顶600ms。
- 层级：底部导航层。
- 中断与布局：展开/折叠timer清理；部分next-turn监听绑定需关注卸载竞态；高度改变布局。
- 减少动态效果：持续装饰/弹跳已局部降级，展开显式过渡仍在。
- 验证/问题：源码附录；matrix。

### I23 朋友圈点赞与评论

- 位置/入口：[app/components/moment/MomentCard.vue](../../src/frontend/web-blog/app/components/moment/MomentCard.vue)。
- 触发及用途：朋友圈点赞与评论；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：点赞350ms，粒子500ms，数字300/200ms；评论250/200ms。
- 层级：卡片内部。
- 中断与布局：600ms重置justLiked未保存timer；计数有key；评论展开改变布局。
- 减少动态效果：未降级。
- 验证/问题：M05/M12。

### I24 留言入场/数字/历史加载

- 位置/入口：[app/components/guestbook/MessageList.vue](../../src/frontend/web-blog/app/components/guestbook/MessageList.vue)。
- 触发及用途：留言入场/数字/历史加载；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：新消息250ms、8px；统计800ms数字递增；初次模拟加载600ms、历史收尾200ms。
- 层级：留言列表/右栏。
- 中断与布局：JS done靠transitionend；顶部追加补偿scrollTop；IO清理，部分timer/rAF未清理。
- 减少动态效果：JS及部分状态动画仍在；骨架shimmer已停。
- 验证/问题：M05/M12/M16。

### I25 闪念搜索/展开/操作反馈

- 位置/入口：[app/pages/flash/index.vue](../../src/frontend/web-blog/app/pages/flash/index.vue)。
- 触发及用途：闪念搜索/展开/操作反馈；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：搜索面板180ms；卡片高亮2000ms；评论、编辑与确认180–250ms。
- 层级：列表局部与AI模态。
- 中断与布局：搜索timer清理、复制/删除确认timer清理；定位scrollIntoView强制smooth；AI仅静态实现审查。
- 减少动态效果：多处显式时长保留。
- 验证/问题：components/supplement；AI分支未实测。

### I26 书签拖拽及分组

- 位置/入口：[app/components/tab/TabBookmarkGrid.vue](../../src/frontend/web-blog/app/components/tab/TabBookmarkGrid.vue)。
- 触发及用途：书签拖拽及分组；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：Sortable animation150ms；网格max-width/gap200ms；项hover200ms。
- 层级：网格/浮动侧栏。
- 中断与布局：useSortable start/stop；HTML5 drag；本轮指针序列未改变顺序，未确证有效重排；替代键盘移动未完整验证。
- 减少动态效果：Sortable固定150ms。
- 验证/问题：M05；此项运行结果非通过。

### I27 书签设置/添加/导入/命令面板

- 位置/入口：[app/components/tab/TabSettingsDrawer.vue](../../src/frontend/web-blog/app/components/tab/TabSettingsDrawer.vue)。
- 触发及用途：书签设置/添加/导入/命令面板；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：设置transform250ms；添加/命令180ms；其他150–200ms。
- 层级：body模态层。
- 中断与布局：模态栈；设置遮罩即时卸载而面板继续离场；嵌套导入Esc先回设置再回页面。
- 减少动态效果：位移未统一降级。
- 验证/问题：components；图标/全部上下文分支未实测。

### I28 数据条、卡片、背景和状态小动效

- 位置/入口：[app/components/about/SkillBars.vue](../../src/frontend/web-blog/app/components/about/SkillBars.vue)。
- 触发及用途：数据条、卡片、背景和状态小动效；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：宽度1000ms（技能/归档/技术栈）；卡片图片scale hover300–500ms；状态点2秒。
- 层级：各卡片。
- 中断与布局：宽度动画影响布局；多数hover无JS资源；Wallpaper filter300ms。
- 减少动态效果：tokens部分支持；显式图片放大、宽度过渡多数未覆盖。
- 验证/问题：M05/M14/M16；详见135文件附录。

### I29 后台页面及开发工具

- 位置/入口：[app/layouts/admin.vue](../../src/frontend/web-blog/app/layouts/admin.vue)。
- 触发及用途：后台页面及开发工具；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：后台主体以直接状态变化为主；动态编辑器显式150–200ms；DevDebugPanel180–200ms等。
- 层级：后台布局/开发浮层。
- 中断与布局：后台路由和表单进入已实测；写入保护不由动效放松；DevTools为开发依赖自带UI。
- 减少动态效果：主要公共token，开发工具未保证全reduce。
- 验证/问题：smoke/development；NuxtDevTools内部动效不列作产品缺陷。

### I30 非视觉调度排除项

- 位置/入口：[app/composables/useContentBackup.ts](../../src/frontend/web-blog/app/composables/useContentBackup.ts)。
- 触发及用途：非视觉调度排除项；具体状态选择器和v-if条件见对应文件附录。
- 时长、延迟、缓动、位移：URL撤销0/1000ms、favicon超时、编辑器防抖等。
- 层级：不适用。
- 中断与布局：命中setTimeout不等于动画；按资源/业务生命周期审查，未据此计作视觉缺陷。
- 减少动态效果：不适用。
- 验证/问题：原始命中清单保留，用途在此明确。

## 第三方机制

本轮构建实际版本为Nuxt 4.5.2、Vue 3.5.42、Vite 8.2.2、主题引擎0.0.4。NuxtPage内部包装Vue Transition/Suspense，零时长对象仍会进入生命周期；本轮通过A/B验证其参与M01，未单独声称是框架上游缺陷。useSortable的150ms由宿主配置，reduce不会自动替宿主改写该数值。颜色变化使用原生View Transitions与WAAPI，已运行无API对照。Nuxt DevTools仅作为开发面板进入范围，未逐一审查该第三方工具内部所有界面动效。

## 层级与资源规则

useModalFocus维护body直接子元素的inert/aria-hidden及overflow，十二次及三十次重复开关均未留下锁定。成功导航与用户取消需采用不同焦点归还策略，见M03。临时clone、timer、rAF、observer以及根视图data属性的所有权问题分别见M02/M04/M12/M15。

机器可读完整规则：inventory-rules.json（本地：`docs/motion-audit/evidence/inventory-rules.json`）。样式编译失败0项。原始源码命中附上下文：source-motion-hits.json（本地：`docs/motion-audit/evidence/source-motion-hits.json`）。

## 逐文件规则附录

以下覆盖扫描命中的全部文件；使用本机实际安装的 Sass 编译静态规则。包含工具类定义、复用入口和非视觉调度命中，不能把命中数量当作独立动画数量。属性值来自当前源码；运行条件、是否可中断及实测结论参见正文机制台账和 findings.json。

### F001 app/app.vue

Nuxt 应用根组件，挂载布局（NuxtPage 已移入 layouts/default.vue 以实现卡片持久化）

实现：[源码](../../src/frontend/web-blog/app/app.vue#L70)。

JS 调度/观察器位置：[70](../../src/frontend/web-blog/app/app.vue#L70) `setTimeout(() => {`。

### F002 app/assets/styles/_base.scss

全局基础样式，包含重置、排版、滚动条、选区等基础规则

实现：[源码](../../src/frontend/web-blog/app/assets/styles/_base.scss#L28)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`body`|常规样式；状态选择器触发|background-color: var(--bg); background-image: radial-gradient(var(--bg-dot) 1px, transparent 1px); background-size: var(--bg-dot-size) var(--bg-dot-size); color: var(--text-main); transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease; line-height: 1.6; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale|
|`.post-item__cover-bg img, .owner-profile-card__avatar, .hero-section__avatar-img, .nexus-bar__avatar-img, .moment-card__avatar, .moment-card img, .project-card img, .moment-photo-wall-card img, .gallery-item img`|常规样式；状态选择器触发|animation: img-reveal 0.45s ease-out both|
|`.post-item__cover-bg img,   .owner-profile-card__avatar,   .hero-section__avatar-img,   .nexus-bar__avatar-img,   .moment-card__avatar,   .moment-card img,   .project-card img,   .moment-photo-wall-card img,   .gallery-item img`|@media (prefers-reduced-motion: reduce)|animation: none|
|`html[data-color-mode-anim], html[data-color-mode-anim] *, html[data-color-mode-anim] *::before, html[data-color-mode-anim] *::after`|常规样式；状态选择器触发|transition-duration: 0s; transition-delay: 0s|
|`html[data-color-mode-anim=fade]::view-transition-old(root), html[data-color-mode-anim=fade]::view-transition-new(root)`|常规样式；状态选择器触发|animation-duration: 0.35s; animation-timing-function: ease|
|`html[data-color-mode-anim=circle]::view-transition-old(root), html[data-color-mode-anim=circle]::view-transition-new(root)`|常规样式；状态选择器触发|animation: none; mix-blend-mode: normal|
|`html[data-color-mode-anim=blur]::view-transition-new(root)`|常规样式；状态选择器触发|animation: color-mode-blur-in 0.45s cubic-bezier(0.22, 0.68, 0.35, 1) both|
|`html[data-color-mode-anim=blur]::view-transition-old(root)`|常规样式；状态选择器触发|animation: color-mode-blur-out 0.45s cubic-bezier(0.22, 0.68, 0.35, 1) both|
|`.anim-fade-in-up`|常规样式；状态选择器触发|opacity: 0; animation: fade-in-up 0.6s ease-out forwards|
|`.anim-delay-1`|常规样式；状态选择器触发|animation-delay: 100ms|
|`.anim-delay-2`|常规样式；状态选择器触发|animation-delay: 200ms|
|`.anim-delay-3`|常规样式；状态选择器触发|animation-delay: 300ms|
|`.anim-delay-4`|常规样式；状态选择器触发|animation-delay: 400ms|
|`.anim-delay-5`|常规样式；状态选择器触发|animation-delay: 500ms|
|`.anim-delay-6`|常规样式；状态选择器触发|animation-delay: 600ms|

JS 调度/观察器位置：[160](../../src/frontend/web-blog/app/assets/styles/_base.scss#L160) `* 明暗主题切换动画：全部走 View Transitions API（document.startViewTransition），`。

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes img-reveal {
  from {
    opacity: 0;
    transform: scale(1.015);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes color-mode-blur-in {
  from {
    filter: blur(18px);
    opacity: 0.65;
  }
  to {
    filter: blur(0);
    opacity: 1;
  }
}
@keyframes color-mode-blur-out {
  from {
    filter: blur(0);
    opacity: 1;
  }
  to {
    filter: blur(18px);
    opacity: 0.4;
  }
}
@keyframes fade-in-up {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}
```

### F003 app/assets/styles/_components.scss

全局共享组件样式，包含卡片、导航项、Tab、按钮、主题切换等

实现：[源码](../../src/frontend/web-blog/app/assets/styles/_components.scss#L15)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.card`|常规样式；状态选择器触发|background: var(--surface-1); border: 1px solid var(--border); border-radius: 1.5rem; box-shadow: var(--shadow-card); transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease|
|`.nav-item`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 1rem; border-radius: 0.75rem; font-size: 0.875rem; font-weight: 500; color: var(--text-muted); transition: all var(--motion-fast, 0.2s) ease; cursor: pointer|
|`.tab-btn`|常规样式；状态选择器触发|position: relative; padding: 1rem 0; font-weight: 500; color: var(--text-muted); transition: all var(--motion-fast, 0.2s) ease; white-space: nowrap|
|`.theme-toggle-btn`|常规样式；状态选择器触发|display: flex; justify-content: center; padding: 0.625rem; border-radius: 0.75rem; color: var(--text-soft); transition: all var(--motion-fast, 0.2s) ease|
|`.input-field`|常规样式；状态选择器触发|width: 100%; background: var(--surface-2); border: 1px solid var(--border-soft); border-radius: 9999px; padding: 0.5rem 1rem; font-size: 0.875rem; color: var(--text-main); outline: none; transition: all var(--motion-fast, 0.2s) ease|
|`.btn-primary`|常规样式；状态选择器触发|display: inline-flex; align-items: center; justify-content: center; padding: 0.5rem 1rem; border-radius: 0.75rem; font-size: 0.875rem; font-weight: 700; background: var(--text-main); color: var(--bg); transition: all var(--motion-fast, 0.2s) ease; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06)|

### F004 app/assets/styles/_layout.scss

页面布局样式，定义两级网格（外层左侧栏+内容区，内层中间+右侧栏）、断点响应和滚动行为

实现：[源码](../../src/frontend/web-blog/app/assets/styles/_layout.scss#L162)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.main-content`|常规样式；状态选择器触发|background: var(--surface-1); border-radius: 1.5rem; border: 1px solid var(--border); box-shadow: var(--shadow-card); display: flex; flex: 1; min-height: 0; flex-direction: column; overflow: hidden; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease; --scrollbar-track-inset: 1.5rem|
|`.site-footer`|@media (min-width: 1024px)|display: flex; justify-content: space-between; align-items: center; flex: 1; min-width: 0; padding: 0.75rem 1.5rem; font-size: 0.75rem; background: var(--surface-1-alpha); backdrop-filter: blur(12px); border-radius: 0.75rem; border: 1px solid var(--border); box-shadow: var(--shadow-card); transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|
|`.mobile-nav__item`|常规样式；状态选择器触发|min-width: 44px; min-height: 44px; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.5rem; color: var(--text-soft); transition: all var(--motion-fast, 0.2s) ease; font-size: 0.625rem; font-weight: 500|

### F005 app/assets/styles/_tokens.scss

SCSS 编译时变量（断点、圆角、间距、字体等），通过 additionalData 注入全局

实现：[源码](../../src/frontend/web-blog/app/assets/styles/_tokens.scss#L40)。

### F006 app/assets/styles/_utilities.scss

工具类样式，提供文本截断、隐藏滚动条、动画延迟等通用辅助类

实现：[源码](../../src/frontend/web-blog/app/assets/styles/_utilities.scss#L61)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.content-vertical-enter-active, .content-vertical-leave-active`|常规样式；状态选择器触发|transition: opacity 0.15s ease, transform 0.15s ease|
|`.content-soft-enter-active, .content-soft-leave-active`|常规样式；状态选择器触发|transition: opacity 0.16s ease, transform 0.16s ease|
|`.content-fade-enter-active, .content-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 0.14s ease|
|`.content-none-enter-active, .content-none-leave-active`|常规样式；状态选择器触发|transition: none|
|`.sidebar-leaving-clone`|常规样式；状态选择器触发|position: absolute; top: 0; left: 0; right: 0; animation: sidebar-leave 0.15s ease forwards; pointer-events: none|
|`.sidebar-leaving-clone.sidebar-leave-slide-right`|常规样式；状态选择器触发|animation: sidebar-leave-slide-right 0.2s ease forwards|
|`.anim-sidebar-up > *:not(.sidebar-leaving-clone)`|常规样式；状态选择器触发|animation: sidebar-slide-in-right 0.35s ease-out both|
|`.anim-sidebar-fade > *:not(.sidebar-leaving-clone)`|常规样式；状态选择器触发|animation: sidebar-fade-in 0.25s ease-out both|
|`.anim-sidebar-scale > *:not(.sidebar-leaving-clone)`|常规样式；状态选择器触发|animation: sidebar-scale-in 0.3s ease-out both|
|`.anim-sidebar-none > *:not(.sidebar-leaving-clone)`|常规样式；状态选择器触发|animation: none|
|`.sidebar-slide-enter-active, .sidebar-slide-leave-active`|常规样式；状态选择器触发|transition: opacity 0.25s ease, transform 0.25s ease|
|`.sidebar-scale-enter-active, .sidebar-scale-leave-active`|常规样式；状态选择器触发|transition: opacity 0.25s ease, transform 0.25s ease|
|`.sidebar-fade-enter-active, .sidebar-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease|
|`.sidebar-none-enter-active, .sidebar-none-leave-active`|常规样式；状态选择器触发|transition: none|

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes sidebar-leave {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
@keyframes sidebar-leave-slide-right {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(24px);
  }
}
@keyframes sidebar-slide-in-right {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@keyframes sidebar-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes sidebar-scale-in {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
```

### F007 app/components/about/AboutHero.vue

个人信息 Hero 组件，展示头像、简介和社交链接

实现：[源码](../../src/frontend/web-blog/app/components/about/AboutHero.vue#L106)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.about-hero__social`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 0.75rem; font-size: 0.75rem; font-weight: 500; text-decoration: none; background: var(--surface-3); color: var(--text-main); transition: all var(--motion-fast, 0.2s) ease|

### F008 app/components/about/ContactCards.vue

联系方式网格组件，展示各类联系渠道

实现：[源码](../../src/frontend/web-blog/app/components/about/ContactCards.vue#L73)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.contact-cards__item`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--surface-1); border: 1px solid var(--border); border-radius: 1.5rem; text-decoration: none; color: inherit; transition: all var(--motion-normal, 0.3s) ease|
|`.contact-cards__icon`|常规样式；状态选择器触发|width: 2.5rem; height: 2.5rem; border-radius: 0.75rem; background: var(--surface-3); display: flex; align-items: center; justify-content: center; color: var(--text-soft); flex-shrink: 0; transition: all var(--motion-fast, 0.2s) ease|

### F009 app/components/about/SkillBars.vue

技能进度条组件，以双列网格展示技能熟练度

实现：[源码](../../src/frontend/web-blog/app/components/about/SkillBars.vue#L83)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.skill-bars__fill`|常规样式；状态选择器触发|height: 100%; border-radius: 9999px; background: var(--text-main); transition: width 1s ease|

### F010 app/components/article/ArchiveItem.vue

文章归档单条时间线条目：日期、分类标签与可点击标题

实现：[源码](../../src/frontend/web-blog/app/components/article/ArchiveItem.vue#L136)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.archive-item__title`|常规样式；状态选择器触发|font-size: 0.9375rem; font-weight: 600; color: var(--text-main); text-decoration: none; line-height: 1.45; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|

### F011 app/components/article/ArchiveStats.vue

文章归档侧栏：汇总统计与分类分布进度条

实现：[源码](../../src/frontend/web-blog/app/components/article/ArchiveStats.vue#L145)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.archive-stats__fill`|常规样式；状态选择器触发|height: 100%; border-radius: 9999px; background: var(--text-muted); transition: width 1s ease|

### F012 app/components/article/ArticleNav.vue

文章详情页上一篇 / 下一篇导航卡片

实现：[源码](../../src/frontend/web-blog/app/components/article/ArticleNav.vue#L56)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.article-nav__card`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.75rem; padding: 1rem; border-radius: 0.75rem; border: 1px solid var(--border-soft); background: var(--surface-1); text-decoration: none; color: inherit; transition: all var(--motion-fast, 0.2s) ease; box-shadow: var(--shadow-card)|
|`.article-nav__icon`|常规样式；状态选择器触发|flex-shrink: 0; color: var(--text-soft); transition: transform 0.2s ease|

### F013 app/components/article/CommentBubble.vue

单条评论气泡组件，展示头像、作者、时间、内容和操作按钮

实现：[源码](../../src/frontend/web-blog/app/components/article/CommentBubble.vue#L162)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.comment-bubble__tool`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.25rem; padding: 0; border: none; background: none; font-size: 0.75rem; color: var(--text-soft); cursor: pointer; transition: all var(--motion-fast, 0.2s) ease|

### F014 app/components/article/CommentSection.vue

评论表单与列表展示，数据、身份和请求状态由页面传入

实现：[源码](../../src/frontend/web-blog/app/components/article/CommentSection.vue#L101)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.comment-section__textarea`|常规样式；状态选择器触发|width: 100%; padding: 0.75rem 1rem; border-radius: 0.75rem; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-main); font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 0.875rem; line-height: 1.5; resize: none; outline: none; transition: all var(--motion-fast, 0.2s) ease|
|`.comment-section__submit`|常规样式；状态选择器触发|padding: 0.5rem 1.25rem; border: none; border-radius: 0.75rem; font-size: 0.75rem; font-weight: 600; cursor: pointer; background: var(--accent); color: var(--surface-1); transition: all var(--motion-fast, 0.2s) ease|

JS 调度/观察器位置：[101](../../src/frontend/web-blog/app/components/article/CommentSection.vue#L101) `input.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })`。

### F015 app/components/article/RelatedPosts.vue

文章详情页右侧相关文章列表

实现：[源码](../../src/frontend/web-blog/app/components/article/RelatedPosts.vue#L45)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.related`|常规样式；状态选择器触发|padding: 1.25rem; border-radius: 1.5rem; border: 1px solid var(--border); box-shadow: var(--shadow-card); background: var(--surface-1-alpha); backdrop-filter: blur(12px); transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|
|`.related__link`|常规样式；状态选择器触发|display: block; padding: 0.75rem; margin: 0 -0.75rem; border-radius: 0.75rem; text-decoration: none; color: inherit; transition: all var(--motion-fast, 0.2s) ease|

### F016 app/components/article/StickyHeader.vue

文章详情页粘性顶栏：返回、标题与元信息

实现：[源码](../../src/frontend/web-blog/app/components/article/StickyHeader.vue#L63)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.article-sticky-header`|常规样式；状态选择器触发|position: sticky; top: 0; z-index: 20; padding: 0 2rem; background: var(--surface-1-alpha-90); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border-soft); transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|
|`.article-sticky-header__back`|常规样式；状态选择器触发|min-height: 44px; display: inline-flex; align-items: center; gap: 0.375rem; padding: 0; font-size: 0.75rem; color: var(--text-soft); background: none; border: none; cursor: pointer; margin-bottom: 0.375rem; transition: all var(--motion-fast, 0.2s) ease|

### F017 app/components/article/TableOfContents.vue

文章右侧目录导航，支持层级缩进与当前章节高亮

实现：[源码](../../src/frontend/web-blog/app/components/article/TableOfContents.vue#L67)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.toc`|常规样式；状态选择器触发|display: block; padding: 1.25rem; border-radius: 1.5rem; border: 1px solid var(--border); box-shadow: var(--shadow-card); background: var(--surface-1-alpha); backdrop-filter: blur(12px); transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|
|`.toc__link`|常规样式；状态选择器触发|min-height: 44px; display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0.75rem; border-radius: 0.75rem; font-size: 0.875rem; font-weight: 500; color: var(--text-muted); text-decoration: none; transition: all var(--motion-fast, 0.2s) ease|

JS 调度/观察器位置：[67](../../src/frontend/web-blog/app/components/article/TableOfContents.vue#L67) `requestAnimationFrame(() => {`。

### F018 app/components/auth/AuthModal.vue

居中弹窗包装器（Aurora/通用主题），Teleport 到 body + 遮罩层

实现：[源码](../../src/frontend/web-blog/app/components/auth/AuthModal.vue#L10)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.auth-modal-enter-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease-out|
|`.auth-modal-enter-active .auth-modal`|常规样式；状态选择器触发|transition: opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)|
|`.auth-modal-leave-active`|常规样式；状态选择器触发|transition: opacity 0.15s ease-in|
|`.auth-modal-leave-active .auth-modal`|常规样式；状态选择器触发|transition: opacity 0.15s ease-in, transform 0.15s ease-in|

Vue 进入/退出配置：

```vue
<Transition name="auth-modal">

      <div v-if="visible" class="auth-modal-overlay" @click.self="close">
        <div ref="dialogRef" class="auth-modal" role="dialog" aria-modal="true" aria-label="博主登录" tabindex="-1">
          <AuthPanel />
        </div>
      </div>
    </Transition>
  </Teleport>
</templa
```

### F019 app/components/auth/AuthPanel.vue

认证面板容器：根据 currentView 渲染登录/注册/忘记密码表单，带视图切换动画

实现：[源码](../../src/frontend/web-blog/app/components/auth/AuthPanel.vue#L22)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.auth-panel__close`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 9999px; border: none; background: transparent; color: var(--text-soft); cursor: pointer; transition: all 0.2s ease|
|`.auth-panel__body`|常规样式；状态选择器触发|position: relative; overflow: hidden; transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1); will-change: height|
|`.auth-slide-left-enter-active, .auth-slide-left-leave-active`|常规样式；状态选择器触发|transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)|
|`.auth-slide-right-enter-active, .auth-slide-right-leave-active`|常规样式；状态选择器触发|transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)|
|`.auth-field__toggle`|常规样式；状态选择器触发|position: absolute; right: 0.5rem; display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 9999px; border: none; background: transparent; color: var(--text-soft); cursor: pointer; transition: color 0.2s ease|
|`.auth-submit__spinner`|常规样式；状态选择器触发|animation: auth-spin 1s linear infinite|
|`.auth-social__btn`|常规样式；状态选择器触发|flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 0.75rem; border: 1px solid var(--border-soft); background: var(--surface-2); color: var(--text-main); font-size: 0.8125rem; font-weight: 500; cursor: pointer; transition: all 0.2s ease|
|`.auth-link`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.25rem; background: none; border: none; color: var(--accent-text); font-size: 0.8125rem; font-weight: 600; cursor: pointer; padding: 0; transition: opacity 0.2s ease|

Vue 进入/退出配置：

```vue
<Transition
        :name="transitionName"
        mode="out-in"
        @enter="onViewEnter"
        @after-enter="onViewAfterEnter"
        @before-leave="onViewBeforeLeave"
      >

        <AuthLoginForm v-if="currentView === 'login'" :key="'login'" @switch-view="switchView" />
        <AuthRegisterForm v-else-if="currentView === 'register'" :key="'register'" @switch-view="switchView" />
        <AuthForgotForm v-else :key="'forgot'" @switch-view="switchVi
```

JS 调度/观察器位置：[65](../../src/frontend/web-blog/app/components/auth/AuthPanel.vue#L65) `let resizeObserver: ResizeObserver | null = null`；[76](../../src/frontend/web-blog/app/components/auth/AuthPanel.vue#L76) `resizeObserver = new ResizeObserver((entries) => {`；[88](../../src/frontend/web-blog/app/components/auth/AuthPanel.vue#L88) `/** 进入完成：挂载 ResizeObserver 跟踪后续内容变化 */`。

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes auth-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
```

### F020 app/components/blog/AboutBlogCard.vue

首页关于博客卡片

实现：[源码](../../src/frontend/web-blog/app/components/blog/AboutBlogCard.vue#L105)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.btn-primary`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: var(--text-main); color: var(--bg); border-radius: 0.75rem; font-weight: 500; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease; text-decoration: none|
|`.btn-outline`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: transparent; color: var(--text-main); border: 1px solid var(--border); border-radius: 0.75rem; font-weight: 500; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease; text-decoration: none|

### F021 app/components/blog/AppearanceEntry.vue

界面设置齿轮按钮，点击打开外观设置面板

实现：[源码](../../src/frontend/web-blog/app/components/blog/AppearanceEntry.vue#L37)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`button.appearance-fab`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 0.5rem; color: var(--text-soft); cursor: pointer; transition: all var(--motion-fast, 0.2s) ease; background: transparent; border: none; box-shadow: none; outline: none|
|`.appearance-fab__icon`|常规样式；状态选择器触发|transition: transform 0.3s ease|

### F022 app/components/blog/HeroSection.vue

首页顶部区域：一言 + 博主自述

实现：[源码](../../src/frontend/web-blog/app/components/blog/HeroSection.vue#L153)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.social-btn`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 9999px; background: var(--surface-2); color: var(--text-muted); transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|

### F023 app/components/blog/PostCard.vue

文章列表项组件，展示单篇文章的缩略图、标题、摘要、标签和元信息

实现：[源码](../../src/frontend/web-blog/app/components/blog/PostCard.vue#L95)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.post-item`|常规样式；状态选择器触发|position: relative; display: flex; gap: 0.75rem; padding: 0.75rem 1rem; min-height: var(--post-card-min-h, 112px); flex-shrink: 0; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); background-color: transparent; border: 1px solid var(--border-soft); border-radius: 0.75rem; overflow: hidden; text-decoration: none; color: inherit|
|`.post-item__cover-bg img`|常规样式；状态选择器触发|width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease|
|`.post-item__title`|常规样式；状态选择器触发|overflow-wrap: anywhere; margin: 0; font-size: 1rem; font-weight: 700; line-height: 1.35; color: var(--text-main); transition: color 0.2s; position: relative; z-index: 2|

### F024 app/components/blog/PostCardList.vue

文章列表组件，按当前选中 Tab 过滤并渲染文章列表项，支持瀑布流懒加载与分页两种显示模式

实现：[源码](../../src/frontend/web-blog/app/components/blog/PostCardList.vue#L23)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.post-list__spinner`|常规样式；状态选择器触发|color: var(--text-soft); animation: spin 1.2s linear infinite|
|`.page-fade-enter-active`|常规样式；状态选择器触发|transition: opacity 0.25s ease, transform 0.25s ease|
|`.page-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 0.15s ease, transform 0.15s ease|
|`.loader-fade-enter-active, .loader-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 0.25s ease|
|`.pagination__btn`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; min-width: 1.625rem; height: 1.625rem; padding: 0 0.125rem; border-radius: 0.5rem; color: var(--text-soft); background: transparent; border: 1px solid transparent; cursor: pointer; transition: all 0.2s ease|
|`.pagination-bar.is-bounced`|常规样式；状态选择器触发|animation: pagination-bump 0.5s cubic-bezier(0.22, 0.68, 0.35, 1)|
|`.pagination-slide-enter-active`|常规样式；状态选择器触发|transition: opacity 0.25s ease-out, transform 0.25s ease-out|
|`.pagination-slide-leave-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease-in, transform 0.2s ease-in|

Vue 进入/退出配置：

```vue
<TransitionGroup
        v-if="displayMode === 'waterfall'"
        tag="div"
        class="post-list"
        name="post-enter"
        :css="false"
        @enter="onItemEnter"
      >

        <ThemeComponent
          v-for="(post, index) in displayedPosts"
          :key="post.id"
          name="PostCard"
          :post="post"
          :data-index="index"
        />
      </TransitionGroup>

      <!-- 分页模式：Transition 实现翻页淡入淡出 -->
      <Transition v-else
```

```vue
<Transition v-else name="page-fade" mode="out-in">

        <div :key="paginationKey" class="post-list">
          <ThemeComponent v-for="post in displayedPosts" :key="post.id" name="PostCard" :post="post" />
        </div>
      </Transition>

      <p v-if="!pending && !errorMessage && filteredPosts.length === 0" class="post-li
```

```vue
<Transition name="loader-fade">

          <div v-if="hasMore && showSpinner" class="post-list__loader">
            <Icon name="lucide:loader-2" size="20" class="post-list__spinner" />
            <span class="post-list__loader-text">加载中...</span>
          </div>
        </Transition>
        <Transition name
```

```vue
<Transition name="loader-fade">

          <div v-if="!hasMore && !pending && !errorMessage && filteredPosts.length > 0" class="post-list__end">
            <span class="post-list__end-line" />
            <span class="post-list__end-text">已经到底了</span>
            <span class="post-list__end-line" />
```

```vue
<Transition name="pagination-slide">

      <nav
        v-if="displayMode === 'pagination' && totalPages > 1 && paginationVisible"
        aria-label="文章分页"
        class="pagination-bar"
        :class="{ 'is-bounced': paginationBounce }"
      >
        <button
          type="button"
          aria-label="上一页"
```

JS 调度/观察器位置：[203](../../src/frontend/web-blog/app/components/blog/PostCardList.vue#L203) `setTimeout(() => {`。

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes pagination-bump {
  0% {
    transform: translateX(-50%) translateY(0);
  }
  30% {
    transform: translateX(-50%) translateY(-24px);
  }
  55% {
    transform: translateX(-50%) translateY(4px);
  }
  75% {
    transform: translateX(-50%) translateY(-6px);
  }
  100% {
    transform: translateX(-50%) translateY(0);
  }
}
```

### F025 app/components/blog/RecentPosts.vue

首页精简版近期文章列表

实现：[源码](../../src/frontend/web-blog/app/components/blog/RecentPosts.vue#L98)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.recent-posts__more`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.25rem; font-size: 0.875rem; color: var(--text-muted); transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|
|`.recent-post-item`|常规样式；状态选择器触发|display: flex; gap: 1rem; padding: 0.75rem; border-radius: 0.75rem; background: var(--surface-2); border: 1px solid transparent; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|
|`.recent-post-item__title`|常规样式；状态选择器触发|font-size: 1rem; font-weight: 500; color: var(--text-main); margin: 0 0 0.5rem; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; text-overflow: ellipsis; transition: color 0.2s ease|

### F026 app/components/blog/ThemeSwitcher.vue

颜色主题切换按钮，在 light / dark 之间切换

实现：[源码](../../src/frontend/web-blog/app/components/blog/ThemeSwitcher.vue#L64)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.theme-switcher`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 0.5rem; color: var(--text-soft); transition: all var(--motion-fast, 0.2s) ease|
|`.theme-switcher :deep(svg)`|常规样式；状态选择器触发|transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)|

### F027 app/components/common/AppearanceDrawer.vue

全局界面设置弹出面板，视口居中显示，集中管理颜色主题、主内容动画与右侧栏动画

实现：[源码](../../src/frontend/web-blog/app/components/common/AppearanceDrawer.vue#L12)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.appearance-option`|常规样式；状态选择器触发|min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.375rem; padding: 0.5rem 0.25rem; border-radius: 0.75rem; border: 1px solid var(--border); background: var(--surface-1); color: var(--text-soft); transition: all var(--motion-fast, 0.2s) ease|
|`.appearance-option__spinner`|常规样式；状态选择器触发|animation: spin 0.8s linear infinite|
|`.appearance-drawer__reset`|常规样式；状态选择器触发|width: 100%; padding: 0.4rem 1rem; border-radius: 0.75rem; background: var(--surface-2); color: var(--text-main); font-size: 0.75rem; font-weight: 700; transition: all var(--motion-fast, 0.2s) ease|
|`.appearance-toggle__switch`|常规样式；状态选择器触发|position: relative; flex-shrink: 0; width: 2.25rem; height: 1.25rem; border-radius: 9999px; background: var(--surface-3); border: 1px solid var(--border); cursor: pointer; transition: background 0.2s, border-color 0.2s|
|`.appearance-toggle__thumb`|常规样式；状态选择器触发|position: absolute; top: 2px; left: 2px; width: 0.875rem; height: 0.875rem; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15); transition: transform 0.2s ease|
|`.appearance-engine-badge`|常规样式；状态选择器触发|display: inline-flex; align-items: center; margin-left: 0.25rem; color: var(--text-soft); vertical-align: middle; opacity: 0.55; transition: all var(--motion-fast, 0.2s) ease|
|`:global(.drawer-overlay-enter-active), :global(.drawer-overlay-leave-active)`|常规样式；状态选择器触发|transition: opacity 0.18s ease|
|`:global(.drawer-panel-enter-active), :global(.drawer-panel-leave-active)`|常规样式；状态选择器触发|transition: opacity 0.2s ease, transform 0.2s ease|

Vue 进入/退出配置：

```vue
<Transition name="drawer-overlay">

        <div v-if="isDrawerOpen" ref="backdropRef" class="appearance-drawer__overlay" @click="closeDrawer" />
      </Transition>

      <Transition name="drawer-panel">
        <aside
          v-if="isDrawerOpen"
          ref="dialogRef"
          class="appearance-drawer car
```

```vue
<Transition name="drawer-panel">

        <aside
          v-if="isDrawerOpen"
          ref="dialogRef"
          class="appearance-drawer card"
          role="dialog"
          aria-modal="true"
          aria-label="界面设置"
          tabindex="-1"
        >
          <header class="appearance-drawer__heading">
```

```vue
<Transition name="tooltip">

        <div v-if="engineTipVisible" class="engine-tip-floating" :style="engineTipStyle">
          由 @tixxin/nuxt-theme-engine 驱动（MIT License）
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import { COLOR_MODE_LABELS, ty
```

JS 调度/观察器位置：[274](../../src/frontend/web-blog/app/components/common/AppearanceDrawer.vue#L274) `let engineTipTimer: ReturnType<typeof setTimeout> | null = null`；[281](../../src/frontend/web-blog/app/components/common/AppearanceDrawer.vue#L281) `engineTipTimer = setTimeout(() => {`。

### F028 app/components/common/AppLoadingScreen.vue

首次访问全屏 loading 动画，展示品牌标识与进度暗示，退出时优雅淡出

实现：[源码](../../src/frontend/web-blog/app/components/common/AppLoadingScreen.vue#L9)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.loading-screen__content`|常规样式；状态选择器触发|display: flex; flex-direction: column; align-items: center; gap: 0.5rem; animation: loading-content-enter 0.5s cubic-bezier(0.22, 0.68, 0.35, 1) both|
|`.loading-screen__progress-bar`|常规样式；状态选择器触发|position: absolute; top: 0; left: 0; width: 40%; height: 100%; background: linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%); border-radius: 1px; animation: loading-progress 1.2s ease-in-out infinite|
|`.loading-screen__progress-bar`|@media (prefers-reduced-motion: reduce)|animation: none|
|`.loading-screen-leave-active`|常规样式；状态选择器触发|transition: opacity 0.5s cubic-bezier(0.22, 0.68, 0.35, 1), transform 0.5s cubic-bezier(0.22, 0.68, 0.35, 1)|
|`.loading-screen__content`|@media (prefers-reduced-motion: reduce)|animation: none|
|`.loading-screen__progress-bar`|@media (prefers-reduced-motion: reduce)|animation: none; width: 100%; background: var(--accent)|

Vue 进入/退出配置：

```vue
<Transition name="loading-screen">

    <div v-if="visible" class="loading-screen" :class="{ 'loading-screen--force': forceVisible }" aria-hidden="true">
      <div class="loading-screen__content">
        <!-- 品牌名：Tix 用主文字色，Xin 用强调色 -->
        <h1 class="loading-screen__brand">
          <span class="loading-scr
```

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes loading-progress {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(250%);
  }
  100% {
    transform: translateX(-100%);
  }
}
@keyframes loading-content-enter {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
```

### F029 app/components/common/AppLoadingTopBar.vue

首屏加载顶部进度条（NProgress 风格细条），读取 useLoadingProgress 共享状态

实现：[源码](../../src/frontend/web-blog/app/components/common/AppLoadingTopBar.vue#L10)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.loading-topbar__bar`|常规样式；状态选择器触发|height: 100%; width: 100%; background: var(--accent); transform-origin: left center; transform: scaleX(0); transition: transform 200ms ease-out; box-shadow: 0 0 8px 0 var(--accent), 0 0 4px 0 var(--accent)|
|`.loading-topbar-leave-active`|常规样式；状态选择器触发|transition: opacity 300ms ease-out|
|`.loading-topbar__bar`|@media (prefers-reduced-motion: reduce)|transition: none; box-shadow: none|
|`.loading-topbar-leave-active`|@media (prefers-reduced-motion: reduce)|transition: none|

Vue 进入/退出配置：

```vue
<Transition name="loading-topbar">

      <div v-if="topBarVisible" class="loading-topbar" aria-hidden="true">
        <div class="loading-topbar__bar" :style="{ transform: `scaleX(${scaleX})` }" />
      </div>
    </Transition>
  </ClientOnly>
</template>

<script setup lang="ts">
import { computed } fr
```

### F030 app/components/common/CodeBlock.vue

代码块高亮组件，基于 Shiki，支持亮暗双色主题

实现：[源码](../../src/frontend/web-blog/app/components/common/CodeBlock.vue#L51)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.article-content__copy`|常规样式；状态选择器触发|position: absolute; top: 0.75rem; right: 0.75rem; z-index: 2; padding: 0.5rem; border: none; border-radius: 0.5rem; background: rgba(255, 255, 255, 0.1); color: var(--text-faint); cursor: pointer; opacity: 0; transition: all var(--motion-fast, 0.2s) ease|

JS 调度/观察器位置：[51](../../src/frontend/web-blog/app/components/common/CodeBlock.vue#L51) `setTimeout(() => {`。

### F031 app/components/common/ContextDrawer.vue

紧凑功能入口与模态抽屉，复用页面已有的筛选、目录和导航内容

实现：[源码](../../src/frontend/web-blog/app/components/common/ContextDrawer.vue#L20)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.context-drawer-enter-active, .context-drawer-leave-active`|常规样式；状态选择器触发|transition: opacity 0.15s ease|

Vue 进入/退出配置：

```vue
<Transition name="context-drawer">

        <div v-if="open" class="context-drawer__overlay" @click.self="open = false">
          <section
            ref="dialog"
            role="dialog"
            aria-modal="true"
            :aria-label="label"
            tabindex="-1"
            class="context-drawer"
```

### F032 app/components/common/CustomScrollbar.vue

自定义滚动条组件，隐藏原生滚动条并渲染可交互的轨道与滑块，支持拖拽、点击跳转、自动隐藏

实现：[源码](../../src/frontend/web-blog/app/components/common/CustomScrollbar.vue#L27)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.custom-scrollbar__progress-bar`|常规样式；状态选择器触发|height: 100%; width: 100%; background: #22c55e; transform-origin: left; transition: transform 0.1s ease-out|
|`.custom-scrollbar__back-to-top-btn`|常规样式；状态选择器触发|position: relative; display: inline-flex; align-items: center; justify-content: center; min-width: 2.75rem; height: 2.25rem; padding: 0.25rem 0.625rem; border-radius: 9999px; border: 1px solid var(--border); background: var(--surface-1-alpha); backdrop-filter: blur(12px); color: var(--text-soft); font-size: 0.75rem; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; cursor: pointer; transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease|
|`.custom-scrollbar__back-to-top-btn:hover .custom-scrollbar__progress-icon`|常规样式；状态选择器触发|opacity: 1; transform: translateY(0); animation: scrollbar-progress-bounce 0.6s ease infinite|
|`.custom-scrollbar__back-to-top-btn:hover .custom-scrollbar__progress-icon`|@media (prefers-reduced-motion: reduce)|animation: none|
|`.custom-scrollbar__back-to-top-btn.is-clicked:hover .custom-scrollbar__progress-icon`|常规样式；状态选择器触发|opacity: 0; transform: translateY(4px); animation: none|
|`.custom-scrollbar__progress-text`|常规样式；状态选择器触发|transition: opacity 0.2s ease, transform 0.2s ease|
|`.custom-scrollbar__progress-icon`|常规样式；状态选择器触发|position: absolute; opacity: 0; transform: translateY(4px); transition: opacity 0.2s ease, transform 0.2s ease|
|`.back-to-top-enter-active`|常规样式；状态选择器触发|transition: opacity 0.25s ease-out, transform 0.25s ease-out|
|`.back-to-top-leave-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease-in, transform 0.2s ease-in|
|`.custom-scrollbar__track`|常规样式；状态选择器触发|position: absolute; right: 4px; top: var(--scrollbar-track-inset, 4px); bottom: var(--scrollbar-track-inset, 4px); width: 6px; border-radius: 3px; z-index: 20; transition: width 0.2s ease, background-color 0.2s ease|
|`.custom-scrollbar__thumb`|常规样式；状态选择器触发|position: absolute; left: 0; width: 100%; border-radius: inherit; background-color: var(--text-soft); opacity: 0.3; transition: opacity 0.15s ease; cursor: pointer|
|`.scrollbar-fade-enter-active, .scrollbar-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 0.3s ease|

Vue 进入/退出配置：

```vue
<Transition name="scrollbar-fade">

      <div
        v-show="showTrack && thumbVisible && needsScrollbar"
        ref="trackRef"
        class="custom-scrollbar__track"
        @mousedown.prevent="onTrackMouseDown"
      >
        <div
          class="custom-scrollbar__thumb"
          :class="{ 'is-dragging':
```

```vue
<Transition name="back-to-top">

      <div v-if="showBackToTop && showBackToTopBtn" class="custom-scrollbar__back-to-top">
        <CommonTooltip content="返回顶部" placement="left">
          <button
            type="button"
            class="custom-scrollbar__back-to-top-btn"
            :class="{ 'is-clicked'
```

JS 调度/观察器位置：[135](../../src/frontend/web-blog/app/components/common/CustomScrollbar.vue#L135) `let hideTimer: ReturnType<typeof setTimeout> | null = null`；[136](../../src/frontend/web-blog/app/components/common/CustomScrollbar.vue#L136) `let resizeObserver: ResizeObserver | null = null`；[137](../../src/frontend/web-blog/app/components/common/CustomScrollbar.vue#L137) `let mutationObserver: MutationObserver | null = null`；[237](../../src/frontend/web-blog/app/components/common/CustomScrollbar.vue#L237) `hideTimer = setTimeout(() => {`；[290](../../src/frontend/web-blog/app/components/common/CustomScrollbar.vue#L290) `viewportRef.value.scrollTo({`；[297](../../src/frontend/web-blog/app/components/common/CustomScrollbar.vue#L297) `viewportRef.value?.scrollTo({`；[306](../../src/frontend/web-blog/app/components/common/CustomScrollbar.vue#L306) `el.scrollTo({`；[325](../../src/frontend/web-blog/app/components/common/CustomScrollbar.vue#L325) `resizeObserver = new ResizeObserver(() => updateMetrics())`；[329](../../src/frontend/web-blog/app/components/common/CustomScrollbar.vue#L329) `mutationObserver = new MutationObserver(() => nextTick(updateMetrics))`。

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes scrollbar-progress-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-3px);
  }
  60% {
    transform: translateY(1px);
  }
}
```

### F033 app/components/common/GuestIdentityModal.vue

游客身份填写弹窗：首次评论时弹出，填写昵称/邮箱/站点/头像，QQ 邮箱实时预览 QQ 头像

实现：[源码](../../src/frontend/web-blog/app/components/common/GuestIdentityModal.vue#L10)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.guest-id-notice__login`|常规样式；状态选择器触发|display: inline-flex; align-items: center; align-self: flex-start; gap: 0.25rem; padding: 0; border: none; background: transparent; font-size: 0.75rem; font-weight: 600; color: var(--accent-text); cursor: pointer; transition: opacity 0.18s|
|`.guest-id-field__input-wrap`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: var(--surface-2); border: 1px solid var(--border-soft); border-radius: 0.5rem; transition: border-color 0.18s|
|`.guest-id-submit`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; gap: 0.375rem; padding: 0.625rem 1rem; margin-top: 0.25rem; border: none; border-radius: 0.75rem; background: var(--accent-action); color: #fff; font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s|
|`.guest-id-modal-enter-active, .guest-id-modal-leave-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease|
|`.guest-id-modal-enter-active .guest-id-modal, .guest-id-modal-leave-active .guest-id-modal`|常规样式；状态选择器触发|transition: transform 0.2s ease, opacity 0.2s ease|

Vue 进入/退出配置：

```vue
<Transition name="guest-id-modal">

      <div v-if="visible" class="guest-id-overlay" @click.self="$emit('cancel')">
        <div
          ref="dialogRef"
          class="guest-id-modal"
          role="dialog"
          aria-modal="true"
          aria-label="填写评论身份"
          tabindex="-1"
        >
```

### F034 app/components/common/ReadingProgress.vue

固定在视口顶部的阅读进度条

实现：[源码](../../src/frontend/web-blog/app/components/common/ReadingProgress.vue#L39)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.reading-progress__bar`|常规样式；状态选择器触发|height: 100%; background: var(--accent); transition: width 0.15s ease-out|

### F035 app/components/common/SearchBox.vue

通用搜索框组件，多页面复用

实现：[源码](../../src/frontend/web-blog/app/components/common/SearchBox.vue#L85)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.search-box__icon`|常规样式；状态选择器触发|position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-soft); pointer-events: none; transition: color 0.2s|
|`.search-box__input`|常规样式；状态选择器触发|min-height: 44px; text-align: left; width: 100%; background: var(--surface-2); border: 1px solid var(--border); border-radius: 9999px; padding: 0.625rem 1rem 0.625rem 2.75rem; font-size: 0.875rem; color: var(--text-main); outline: none; transition: all var(--motion-normal, 0.3s) ease; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04)|

### F036 app/components/common/SearchModal.vue

全局搜索弹窗 (Cmd+K)，跨文章、项目、友链进行模糊搜索

实现：[源码](../../src/frontend/web-blog/app/components/common/SearchModal.vue#L10)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.search-modal__spinner`|常规样式；状态选择器触发|animation: spin 1s linear infinite|
|`.search-modal__item`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 0.75rem; border-radius: 0.75rem; cursor: pointer; transition: background 0.15s|
|`.search-modal-enter-active, .search-modal-leave-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease|
|`.search-modal-enter-active .search-modal, .search-modal-leave-active .search-modal`|常规样式；状态选择器触发|transition: transform 0.2s ease, opacity 0.2s ease|

Vue 进入/退出配置：

```vue
<Transition name="search-modal">

      <div v-if="visible" class="search-modal-overlay" @click.self="close">
        <div ref="dialogRef" class="search-modal" role="dialog" aria-modal="true" aria-label="站内搜索" tabindex="-1">
          <div class="search-modal__header">
            <Icon name="lucide:search" size
```

JS 调度/观察器位置：[110](../../src/frontend/web-blog/app/components/common/SearchModal.vue#L110) `const timer = setTimeout(() => {`；[154](../../src/frontend/web-blog/app/components/common/SearchModal.vue#L154) `?.scrollIntoView({ block: 'nearest' })`。

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### F037 app/components/common/ShareButtons.vue

社交分享按钮组件，支持复制链接、Twitter/X、微博

实现：[源码](../../src/frontend/web-blog/app/components/common/ShareButtons.vue#L41)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.share-buttons__btn`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border: 1px solid var(--border); border-radius: 0.5rem; background: transparent; color: var(--text-soft); cursor: pointer; transition: all 0.2s|

JS 调度/观察器位置：[41](../../src/frontend/web-blog/app/components/common/ShareButtons.vue#L41) `setTimeout(() => (copied.value = false), 2000)`。

### F038 app/components/common/StateBlock.vue

通用状态提示组件，用于空态、404、500 等场景的居中图文提示

实现：[源码](../../src/frontend/web-blog/app/components/common/StateBlock.vue#L102)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.state-block__action`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.375rem; margin-top: 0.75rem; padding: 0.5rem 1.25rem; font-size: 0.8125rem; font-weight: 600; color: var(--text-main); background: var(--surface-3); border: 1px solid var(--border); border-radius: 0.75rem; cursor: pointer; transition: all 0.2s ease|

### F039 app/components/common/ToastContainer.vue

全局 Toast 容器

实现：[源码](../../src/frontend/web-blog/app/components/common/ToastContainer.vue#L11)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.toast-list-enter-active, .toast-list-leave-active`|常规样式；状态选择器触发|transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)|

Vue 进入/退出配置：

```vue
<TransitionGroup name="toast-list">

        <div v-for="toast in toasts" :key="toast.id" class="toast-item" :class="`toast-item--${toast.type}`">
          <Icon :name="getIcon(toast.type)" size="16" class="toast-item__icon" />
          <span class="toast-item__message">{{ toast.message }}</span>
        </div>
```

### F040 app/components/common/Tooltip.vue

通用 Tooltip 提示组件，支持自动定位、明暗主题适配、方向箭头与入场/退场动画

实现：[源码](../../src/frontend/web-blog/app/components/common/Tooltip.vue#L21)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.tooltip-enter-active`|常规样式；状态选择器触发|transition: opacity 0.15s ease, transform 0.15s ease|
|`.tooltip-leave-active`|常规样式；状态选择器触发|transition: opacity 0.1s ease, transform 0.1s ease|

Vue 进入/退出配置：

```vue
<Transition name="tooltip">

      <div
        v-if="visible && (content || hasContentSlot)"
        ref="floatingRef"
        class="tooltip-floating"
        :class="[`tooltip-floating--${resolvedPlacement}`, { 'tooltip-floating--rich': rich }]"
        :style="floatingStyle"
        role="tooltip
```

JS 调度/观察器位置：[68](../../src/frontend/web-blog/app/components/common/Tooltip.vue#L68) `let showTimer: ReturnType<typeof setTimeout> | null = null`；[69](../../src/frontend/web-blog/app/components/common/Tooltip.vue#L69) `let hideTimer: ReturnType<typeof setTimeout> | null = null`；[85](../../src/frontend/web-blog/app/components/common/Tooltip.vue#L85) `showTimer = setTimeout(() => {`；[94](../../src/frontend/web-blog/app/components/common/Tooltip.vue#L94) `hideTimer = setTimeout(() => {`。

### F041 app/components/dev/DevDebugPanel.vue

Dev 全局调试面板：左上角可拖拽 FAB + 侧抽屉，分 4 个 tab 展示视口/路由+主题/登录态/环境

实现：[源码](../../src/frontend/web-blog/app/components/dev/DevDebugPanel.vue#L28)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.dev-debug-fab`|常规样式；状态选择器触发|position: fixed; z-index: 9998; display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.3rem 0.55rem; border: 1px dashed var(--accent); border-radius: 9999px; background: var(--accent-alpha-5, rgba(99, 102, 241, 0.08)); color: var(--accent); font-size: 0.625rem; font-weight: 700; letter-spacing: 0.06em; cursor: grab; user-select: none; touch-action: none; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12); transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease|
|`.dev-debug-fab.is-dragging`|常规样式；状态选择器触发|cursor: grabbing; transform: scale(0.95); transition: none|
|`.dev-debug-resize-handle`|常规样式；状态选择器触发|position: absolute; right: 0; bottom: 0; width: 1.25rem; height: 1.25rem; display: flex; align-items: flex-end; justify-content: flex-end; padding: 0.125rem; color: var(--text-faint); cursor: nwse-resize; user-select: none; touch-action: none; transition: color 0.18s ease|
|`.dev-debug-zoom-btn`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 1.375rem; height: 1.375rem; padding: 0; border: none; background: transparent; color: var(--text-soft); border-radius: 0.5rem; cursor: pointer; transition: background 0.18s ease, color 0.18s ease|
|`.dev-debug-zoom-value`|常规样式；状态选择器触发|min-width: 2.4rem; height: 1.375rem; padding: 0 0.25rem; border: none; background: transparent; color: var(--text-main); font-size: 0.625rem; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; border-radius: 0.5rem; cursor: pointer; transition: background 0.18s ease, color 0.18s ease|
|`.dev-debug-dock-btn`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 1.375rem; height: 1.375rem; padding: 0; border: none; background: transparent; color: var(--text-soft); border-radius: 0.5rem; cursor: pointer; transition: background 0.18s ease, color 0.18s ease|
|`.dev-debug-drawer__close`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 1.75rem; height: 1.75rem; border: none; background: transparent; border-radius: 9999px; color: var(--text-soft); cursor: pointer; transition: background 0.2s ease, color 0.2s ease|
|`.dev-debug-tab`|常规样式；状态选择器触发|display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.625rem 0.25rem; border: none; background: transparent; color: var(--text-soft); font-size: 0.6875rem; font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease|
|`.dev-debug-row__value--clickable`|常规样式；状态选择器触发|cursor: pointer; border-radius: 0.5rem; padding: 0.125rem 0.25rem; margin: -0.125rem -0.25rem; transition: background 0.18s ease|
|`.dev-debug-btn`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.625rem; border: 1px solid var(--border); border-radius: 0.5rem; background: var(--surface-2); color: var(--text-main); font-size: 0.6875rem; font-weight: 600; cursor: pointer; transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease|
|`.dev-debug-overlay-enter-active, .dev-debug-overlay-leave-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease|
|`.dev-debug-drawer-left-enter-active, .dev-debug-drawer-left-leave-active`|常规样式；状态选择器触发|transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)|
|`.dev-debug-drawer-right-enter-active, .dev-debug-drawer-right-leave-active`|常规样式；状态选择器触发|transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)|
|`.dev-debug-drawer-top-enter-active, .dev-debug-drawer-top-leave-active`|常规样式；状态选择器触发|transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)|
|`.dev-debug-drawer-bottom-enter-active, .dev-debug-drawer-bottom-leave-active`|常规样式；状态选择器触发|transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)|
|`.dev-debug-drawer-center-enter-active, .dev-debug-drawer-center-leave-active`|常规样式；状态选择器触发|transition: opacity 0.16s ease, transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1)|

Vue 进入/退出配置：

```vue
<Transition name="dev-debug-overlay">

      <div v-if="isOpen" class="dev-debug-overlay" @click="close" />
    </Transition>

    <!-- 抽屉：根据 position 切换为 left/right/top/bottom 贴边或 center 浮窗；transitionName 同步切换 -->
    <!-- :key="position" 强制 unmount/remount，让切位置真正走「旧位置 leave + 新位置 enter」两段独立动画 -->
    <Transition :n
```

```vue
<Transition :name="transitionName">

      <aside
        v-if="isOpen"
        :key="position"
        class="dev-debug-drawer"
        :class="`dev-debug-drawer--${position}`"
        :style="drawerStyle"
        role="dialog"
        aria-label="Dev 调试面板"
      >
        <header
          class="dev-debug-drawer
```

### F042 app/components/flash/FlashAISearchModal.vue

闪念 AI 搜索弹窗，输入关键词后由 mock AI 整理相关笔记

实现：[源码](../../src/frontend/web-blog/app/components/flash/FlashAISearchModal.vue#L10)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.flash-ai-modal__spinner`|常规样式；状态选择器触发|color: var(--accent-text); animation: spin 1s linear infinite|
|`.flash-ai-modal__citation-item`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: var(--surface-2); border-radius: 0.5rem; font-size: 0.75rem; line-height: 1.55; color: var(--text-main); cursor: pointer; transition: background 0.18s, color 0.18s|
|`.flash-ai-modal__citation-arrow`|常规样式；状态选择器触发|flex-shrink: 0; color: var(--text-faint); transition: color 0.18s|
|`.flash-ai-modal-enter-active, .flash-ai-modal-leave-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease|
|`.flash-ai-modal-enter-active .flash-ai-modal, .flash-ai-modal-leave-active .flash-ai-modal`|常规样式；状态选择器触发|transition: transform 0.2s ease, opacity 0.2s ease|

Vue 进入/退出配置：

```vue
<Transition name="flash-ai-modal">

      <div v-if="visible" class="flash-ai-modal-overlay" @click.self="close">
        <div
          ref="dialogRef"
          class="flash-ai-modal"
          role="dialog"
          aria-modal="true"
          aria-label="闪念演示搜索"
          tabindex="-1"
        >
          <di
```

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### F043 app/components/flash/FlashEditor.vue

Blinko 风格闪念编辑器：textarea + 顶部 mood 切换 + 底部工具栏（格式占位 / 标签 / 发布）

实现：[源码](../../src/frontend/web-blog/app/components/flash/FlashEditor.vue#L389)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.fed`|常规样式；状态选择器触发|background: var(--surface-1); border: 1px solid var(--border-soft); border-radius: 1.5rem; box-shadow: var(--shadow-card); display: flex; flex-direction: column; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); transition: border-color 0.2s, box-shadow 0.2s|
|`.fed__mood`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.625rem; border: none; border-radius: 9999px; background: transparent; color: var(--text-soft); font-size: 0.6875rem; font-weight: 600; cursor: pointer; transition: all 0.18s|
|`.fed__expand-toggle`|常规样式；状态选择器触发|position: absolute; top: 0.375rem; right: 0.5rem; display: flex; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; padding: 0; border: none; border-radius: 0.5rem; background: transparent; color: var(--text-faint); cursor: pointer; transition: color 0.18s, background 0.18s|
|`.fed__tool`|常规样式；状态选择器触发|display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex-shrink: 0; border: none; background: transparent; color: var(--text-soft); cursor: pointer; border-radius: 0.5rem; transition: color 0.18s, background 0.18s|
|`.fed__submit`|常规样式；状态选择器触发|min-height: 40px; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.4375rem 0.875rem; border: none; border-radius: 9999px; background: var(--accent-action); color: #fff; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.18s|

### F044 app/components/flash/FlashImageGrid.vue

闪念图片网格：1/2/3 列智能布局，点击单张打开 LightBox

实现：[源码](../../src/frontend/web-blog/app/components/flash/FlashImageGrid.vue#L101)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.flash-grid__img`|常规样式；状态选择器触发|width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease|

### F045 app/components/flash/FlashImageLightBox.vue

闪念多图灯箱：键盘左右切换 / Esc 关闭，与 MomentLightBox 同款交互但模块独立

实现：[源码](../../src/frontend/web-blog/app/components/flash/FlashImageLightBox.vue#L10)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.flash-lightbox__close`|常规样式；状态选择器触发|position: absolute; top: 1.5rem; right: 1.5rem; z-index: 10; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border: none; border-radius: 9999px; background: rgba(255, 255, 255, 0.1); color: #fff; cursor: pointer; transition: background 0.2s|
|`.flash-lightbox__nav`|常规样式；状态选择器触发|position: absolute; top: 50%; transform: translateY(-50%); z-index: 10; width: 3rem; height: 3rem; display: flex; align-items: center; justify-content: center; border: none; border-radius: 9999px; background: rgba(255, 255, 255, 0.1); color: #fff; cursor: pointer; transition: background 0.2s|
|`.flash-lightbox-fade-enter-active`|常规样式；状态选择器触发|transition: opacity 0.25s ease|
|`.flash-lightbox-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease|

Vue 进入/退出配置：

```vue
<Transition name="flash-lightbox-fade">

      <div
        v-if="visible && images.length > 0"
        ref="dialogRef"
        class="flash-lightbox"
        role="dialog"
        tabindex="-1"
        aria-modal="true"
        aria-label="图片预览"
        @click.self="onClose"
      >
        <button type="button" class
```

### F046 app/components/flash/FlashNoteCard.vue

闪念笔记卡片：Blinko 风格 — 内容 + 标签 + 操作栏（点赞 / 评论 / 复制 / 删除）+ 评论区

实现：[源码](../../src/frontend/web-blog/app/components/flash/FlashNoteCard.vue#L150)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.fnc`|常规样式；状态选择器触发|position: relative; display: flex; flex-direction: column; gap: 0.625rem; padding: 0.875rem 1rem 0.75rem; background: var(--surface-1); border: 1px solid var(--border-soft); border-radius: 1.5rem; box-shadow: var(--shadow-card); break-inside: avoid; transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease|
|`.fnc--highlighted`|常规样式；状态选择器触发|animation: flash-highlight 2s ease-out|
|`.fnc__tag`|常规样式；状态选择器触发|display: inline-flex; align-items: center; padding: 0.125rem 0.5rem; font-size: 0.6875rem; font-weight: 600; color: var(--accent-text); background: var(--accent-soft); border-radius: 9999px; cursor: pointer; transition: opacity 0.18s, background 0.18s|
|`.fnc__time`|常规样式；状态选择器触发|white-space: nowrap; display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.6875rem; color: var(--text-faint); font-variant-numeric: tabular-nums; text-decoration: none; transition: color 0.18s|
|`.fnc__action`|常规样式；状态选择器触发|min-width: 32px; min-height: 32px; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; border: none; background: transparent; color: var(--text-soft); font-size: 0.6875rem; border-radius: 0.5rem; cursor: pointer; opacity: 1; transition: opacity 0.2s, color 0.2s, background 0.2s|
|`.fnc__comment-send`|常规样式；状态选择器触发|flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: none; border-radius: 9999px; background: var(--accent-action); color: #fff; cursor: pointer; transition: opacity 0.2s|
|`.fnc__confirm-delete`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.375rem; animation: fnc-confirm-in 0.18s ease|
|`.fnc__confirm-yes, .fnc__confirm-no`|常规样式；状态选择器触发|display: inline-flex; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; padding: 0; border: none; border-radius: 9999px; cursor: pointer; transition: background 0.18s, color 0.18s|
|`.fnc-comments-enter-active, .fnc-comments-leave-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease, max-height 0.25s ease; overflow: hidden|

Vue 进入/退出配置：

```vue
<Transition name="fnc-comments">

      <div v-if="commentOpen" class="fnc__comments">
        <div v-if="note.comments.length > 0" class="fnc__comment-list">
          <div v-for="c in note.comments" :key="c.id" class="fnc__comment">
            <img :src="c.authorAvatar" :alt="c.authorName" class="fnc__comment
```

JS 调度/观察器位置：[237](../../src/frontend/web-blog/app/components/flash/FlashNoteCard.vue#L237) `let copyTimer: ReturnType<typeof setTimeout> | null = null`；[241](../../src/frontend/web-blog/app/components/flash/FlashNoteCard.vue#L241) `let deleteTimer: ReturnType<typeof setTimeout> | null = null`；[282](../../src/frontend/web-blog/app/components/flash/FlashNoteCard.vue#L282) `copyTimer = setTimeout(() => (copied.value = false), 1500)`；[291](../../src/frontend/web-blog/app/components/flash/FlashNoteCard.vue#L291) `deleteTimer = setTimeout(() => {`。

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes fnc-confirm-in {
  from {
    opacity: 0;
    transform: translateX(4px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@keyframes flash-highlight {
  0% {
    box-shadow: 0 0 0 3px var(--accent);
  }
  100% {
    box-shadow: 0 0 0 3px transparent;
  }
}
```

### F047 app/components/flash/FlashNoteList.vue

闪念笔记流：双列瀑布流布局，支持空状态与加载态

实现：[源码](../../src/frontend/web-blog/app/components/flash/FlashNoteList.vue#L110)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.flash-note-list__spinner`|常规样式；状态选择器触发|animation: flash-spin 1s linear infinite|

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes flash-spin {
  to {
    transform: rotate(360deg);
  }
}
```

### F048 app/components/gallery/GalleryFilter.vue

画廊分类筛选按钮组，支持 v-model 绑定当前分类值

实现：[源码](../../src/frontend/web-blog/app/components/gallery/GalleryFilter.vue#L54)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.gallery-filter__btn`|常规样式；状态选择器触发|min-height: 44px; padding: 0.375rem 0.75rem; font-size: 0.75rem; font-weight: 500; border: none; border-radius: 0.5rem; cursor: pointer; transition: all var(--motion-fast, 0.2s) ease; background: var(--surface-2); color: var(--text-muted)|

### F049 app/components/gallery/GalleryItem.vue

画廊瀑布流单张卡片，悬停渐变遮罩与元信息

实现：[源码](../../src/frontend/web-blog/app/components/gallery/GalleryItem.vue#L60)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.gallery-item__img`|常规样式；状态选择器触发|display: block; width: 100%; height: auto; border-radius: 0.75rem; transition: transform 0.5s ease|
|`.gallery-item__overlay`|常规样式；状态选择器触发|position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 1rem; border-radius: 0.75rem; background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent 55%); opacity: 0; transition: opacity 0.3s ease; pointer-events: none|

### F050 app/components/gallery/LightBox.vue

全屏图片灯箱，支持背景关闭与 ESC 退出

实现：[源码](../../src/frontend/web-blog/app/components/gallery/LightBox.vue#L82)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.lightbox__close`|常规样式；状态选择器触发|position: absolute; top: 1.5rem; right: 1.5rem; z-index: 10; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border: none; border-radius: 9999px; background: rgba(255, 255, 255, 0.1); color: #fff; cursor: pointer; transition: all var(--motion-fast, 0.2s) ease|

### F051 app/components/guestbook/ActiveMembers.vue

留言板右侧栏活跃成员列表，前三名显示排名标识，多个成员可显示在线状态

实现：[源码](../../src/frontend/web-blog/app/components/guestbook/ActiveMembers.vue#L97)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.active-members__row`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.625rem; padding: 0.4375rem 0.5rem; border-radius: 0.75rem; transition: background 0.2s|

### F052 app/components/guestbook/ChatStats.vue

留言板右侧栏对话统计卡片，数字首次出现时有 count-up 动效

实现：[源码](../../src/frontend/web-blog/app/components/guestbook/ChatStats.vue#L73)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.chat-stats__cell`|常规样式；状态选择器触发|text-align: center; padding: 0.75rem 0.25rem; border-radius: 0.75rem; background: var(--surface-2); transition: color 0.2s|
|`.chat-stats__value`|常规样式；状态选择器触发|margin: 0; font-size: 1.25rem; font-weight: 700; line-height: 1.2; color: var(--text-main); transition: color 0.2s; font-variant-numeric: tabular-nums|

JS 调度/观察器位置：[73](../../src/frontend/web-blog/app/components/guestbook/ChatStats.vue#L73) `requestAnimationFrame(step)`；[80](../../src/frontend/web-blog/app/components/guestbook/ChatStats.vue#L80) `requestAnimationFrame(step)`；[86](../../src/frontend/web-blog/app/components/guestbook/ChatStats.vue#L86) `const observer = new IntersectionObserver(`。

### F053 app/components/guestbook/EmptyState.vue

留言板空消息状态引导

实现：[源码](../../src/frontend/web-blog/app/components/guestbook/EmptyState.vue#L58)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.guestbook-empty__circle--outer`|常规样式；状态选择器触发|inset: 0; background: color-mix(in srgb, var(--accent, #5b7cfa) 6%, transparent); animation: guestbook-empty-pulse 3s ease-in-out infinite|
|`.guestbook-empty__circle--outer`|@media (prefers-reduced-motion: reduce)|animation: none|
|`.guestbook-empty__cta`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.375rem; margin-top: 0.5rem; padding: 0.5rem 1.25rem; border: none; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600; color: #fff; background: linear-gradient(135deg, var(--accent, #5b7cfa), #6366f1); box-shadow: 0 2px 8px rgba(91, 124, 250, 0.3); cursor: pointer; transition: all 0.2s|

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes guestbook-empty-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.7;
  }
}
```

### F054 app/components/guestbook/MessageBubble.vue

单条留言气泡，访客左对齐、博主右对齐，支持回复引用、反应、消息状态

实现：[源码](../../src/frontend/web-blog/app/components/guestbook/MessageBubble.vue#L20)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.message-bubble__avatar`|常规样式；状态选择器触发|width: 2rem; height: 2rem; border-radius: 9999px; object-fit: cover; flex-shrink: 0; box-shadow: 0 0 0 2px var(--surface-1), 0 1px 2px rgba(0, 0, 0, 0.05); cursor: pointer; transition: transform 0.15s|
|`.user-card-fade-enter-active`|常规样式；状态选择器触发|transition: opacity 0.15s ease, transform 0.15s ease|
|`.user-card-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 0.1s ease, transform 0.1s ease|
|`.message-bubble__actions`|常规样式；状态选择器触发|display: flex; gap: 0.125rem; opacity: 0; transition: opacity 0.15s ease; flex-shrink: 0|
|`.message-bubble__action`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem; border-radius: 0.5rem; border: 1px solid var(--border-soft); background: var(--surface-1); color: var(--text-faint); cursor: pointer; transition: all 0.15s ease|
|`.message-bubble__reaction-pick`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border: none; border-radius: 0.5rem; background: transparent; font-size: 1rem; cursor: pointer; transition: all 0.15s|
|`.picker-fade-enter-active`|常规样式；状态选择器触发|transition: opacity 0.15s ease, transform 0.15s ease|
|`.picker-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 0.1s ease|
|`.message-bubble__reaction`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.125rem 0.5rem; border-radius: 9999px; border: 1px solid var(--border-soft); background: var(--surface-2); font-size: 0.6875rem; cursor: pointer; transition: all 0.15s|
|`.message-bubble__status-spin`|常规样式；状态选择器触发|animation: spin 1.2s linear infinite|

Vue 进入/退出配置：

```vue
<Transition name="user-card-fade">

        <div
          v-if="showUserCard"
          class="message-bubble__user-card"
          :class="{ 'message-bubble__user-card--right': message.isOwner }"
        >
          <img
            class="message-bubble__user-card-avatar"
            :src="message.avatar"
```

```vue
<Transition name="picker-fade">

        <div
          v-if="showReactionPicker"
          role="group"
          aria-label="选择回应"
          class="message-bubble__reaction-picker"
          :class="{ 'message-bubble__reaction-picker--end': message.isOwner }"
          @keydown.escape.stop="closeReactions"
```

JS 调度/观察器位置：[208](../../src/frontend/web-blog/app/components/guestbook/MessageBubble.vue#L208) `let copyTimer: ReturnType<typeof setTimeout> | null = null`；[245](../../src/frontend/web-blog/app/components/guestbook/MessageBubble.vue#L245) `copyTimer = setTimeout(() => {`。

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### F055 app/components/guestbook/MessageInput.vue

留言输入区：访客身份栏、回复引用预览、textarea 自适应高度、发送按钮

实现：[源码](../../src/frontend/web-blog/app/components/guestbook/MessageInput.vue#L12)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.message-input__resize-handle`|常规样式；状态选择器触发|height: 6px; cursor: ns-resize; display: flex; align-items: center; justify-content: center; user-select: none; touch-action: none; transition: background 0.18s|
|`.message-input__resize-handle::after`|常规样式；状态选择器触发|content: ""; width: 2rem; height: 2px; border-radius: 1px; background: var(--border-soft); transition: background 0.18s|
|`.message-input__reply-close`|常规样式；状态选择器触发|flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; border: none; border-radius: 0.5rem; background: transparent; color: var(--text-faint); cursor: pointer; transition: all 0.15s|
|`.reply-fade-enter-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease, max-height 0.2s ease|
|`.reply-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 0.15s ease, max-height 0.15s ease|
|`.message-input__expand-toggle`|常规样式；状态选择器触发|position: absolute; top: 0.375rem; right: 0.5rem; display: flex; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; padding: 0; border: none; border-radius: 0.5rem; background: transparent; color: var(--text-faint); cursor: pointer; transition: color 0.18s, background 0.18s|
|`.message-input__send`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.875rem; border: none; border-radius: 0.5rem; color: #fff; background: var(--accent, #5b7cfa); font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s, transform 0.15s|
|`.message-input__tool`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 28px; height: 26px; padding: 0; border: none; border-radius: 0.5rem; background: transparent; color: var(--text-faint); cursor: default; transition: background 0.15s, color 0.15s|

Vue 进入/退出配置：

```vue
<Transition name="reply-fade">

      <div v-if="replyTo" class="message-input__reply-bar">
        <Icon name="lucide:reply" size="13" class="message-input__reply-icon" />
        <span class="message-input__reply-label">回复</span>
        <span class="message-input__reply-author">{{ replyTo.author }}</span>
```

### F056 app/components/guestbook/MessageList.vue

按日期分组的留言列表容器，组间展示日期分隔线与徽标

实现：[源码](../../src/frontend/web-blog/app/components/guestbook/MessageList.vue#L20)。

Vue 进入/退出配置：

```vue
<TransitionGroup name="msg-enter" :css="false" @enter="onMsgEnter">

        <GuestbookMessageBubble
          v-for="msg in group.messages"
          :key="msg.id"
          :message="msg"
          @reply="(m) => $emit('reply', m)"
        />
      </TransitionGroup>
    </template>
  </div>
</template>

<script setup lang="ts">
im
```

JS 调度/观察器位置：[49](../../src/frontend/web-blog/app/components/guestbook/MessageList.vue#L49) `requestAnimationFrame(() => {`；[57](../../src/frontend/web-blog/app/components/guestbook/MessageList.vue#L57) `htmlEl.removeEventListener('transitionend', onEnd)`；[60](../../src/frontend/web-blog/app/components/guestbook/MessageList.vue#L60) `htmlEl.addEventListener('transitionend', onEnd, { once: true })`。

### F057 app/components/guestbook/MessageSkeleton.vue

留言板消息骨架屏

实现：[源码](../../src/frontend/web-blog/app/components/guestbook/MessageSkeleton.vue#L104)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.skeleton-pulse`|常规样式；状态选择器触发|background: var(--surface-2); animation: skeleton-shimmer 1.5s ease-in-out infinite|
|`.skeleton-pulse`|@media (prefers-reduced-motion: reduce)|animation: none|

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes skeleton-shimmer {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
```

### F058 app/components/guestbook/PinnedMessage.vue

留言板置顶公告消息栏

实现：[源码](../../src/frontend/web-blog/app/components/guestbook/PinnedMessage.vue#L103)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.pinned-message__close`|常规样式；状态选择器触发|flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem; border: none; border-radius: 0.5rem; background: transparent; color: var(--text-faint); cursor: pointer; transition: all 0.15s|

### F059 app/components/layout/StatusFooter.vue

站点底部页脚组件，展示版权信息、链接和系统状态

实现：[源码](../../src/frontend/web-blog/app/components/layout/StatusFooter.vue#L77)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.footer__links a`|常规样式；状态选择器触发|font-size: 0.6875rem; transition: color 0.2s|
|`.footer__powered-link`|常规样式；状态选择器触发|font-weight: 600; color: var(--text-main); transition: opacity 0.2s|
|`.footer__dot`|常规样式；状态选择器触发|flex-shrink: 0; width: 0.45rem; height: 0.45rem; border-radius: 50%; background: var(--stat-green-dot); box-shadow: 0 0 0 2px var(--stat-green-bg); animation: pulse-dot 2s infinite|
|`.footer__dot`|@media (prefers-reduced-motion: reduce)|animation: none|

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes pulse-dot {
  0%, 100% {
    box-shadow: 0 0 0 2px var(--stat-green-bg);
  }
  50% {
    box-shadow: 0 0 0 6px transparent;
  }
}
```

### F060 app/components/link/LinkCard.vue

单个友链卡片组件，展示头像、站点名、描述和域名

实现：[源码](../../src/frontend/web-blog/app/components/link/LinkCard.vue#L59)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.link-card`|常规样式；状态选择器触发|display: flex; flex-direction: column; align-items: center; text-align: center; padding: 1.25rem; background: var(--surface-1); border: 1px solid var(--border); border-radius: 1.5rem; transition: all var(--motion-normal, 0.3s) ease; text-decoration: none; color: inherit|
|`.link-card__avatar`|常规样式；状态选择器触发|width: 4rem; height: 4rem; border-radius: 9999px; border: 2px solid var(--border-soft); margin-bottom: 0.75rem; object-fit: cover; transition: transform 0.3s ease|

### F061 app/components/moment/MomentArticleCard.vue

朋友圈动态中引用的文章卡片，点击跳转文章详情

实现：[源码](../../src/frontend/web-blog/app/components/moment/MomentArticleCard.vue#L42)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.moment-article-card`|常规样式；状态选择器触发|display: flex; gap: 0.75rem; padding: 0.75rem; margin-bottom: 0.75rem; background: var(--surface-2); border: 1px solid var(--border-soft); border-radius: 0.75rem; text-decoration: none; color: inherit; transition: all 0.2s ease; overflow: hidden|

### F062 app/components/moment/MomentCard.vue

朋友圈单条动态卡片，含点赞动画、评论区、多图灯箱

实现：[源码](../../src/frontend/web-blog/app/components/moment/MomentCard.vue#L107)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.moment-card__topic-tag`|常规样式；状态选择器触发|font-size: 0.75rem; color: var(--accent-text); background: var(--accent-soft); padding: 0.125rem 0.5rem; border-radius: 9999px; text-decoration: none; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|
|`.moment-card__image`|常规样式；状态选择器触发|width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease|
|`.moment-card__time`|常规样式；状态选择器触发|color: var(--text-faint); text-decoration: none; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|
|`.moment-action-btn`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0.5rem; border: none; background: transparent; color: var(--text-faint); font-size: 0.8125rem; border-radius: 0.5rem; cursor: pointer; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|
|`.like-icon-wrap--burst`|常规样式；状态选择器触发|animation: like-pop 0.35s ease-out|
|`.like-icon-wrap--burst::before`|常规样式；状态选择器触发|content: ""; position: absolute; top: 50%; left: 50%; width: 2px; height: 2px; border-radius: 50%; animation: like-particles 0.5s ease-out forwards|
|`.like-count-enter-active`|常规样式；状态选择器触发|animation: count-float-in 0.3s ease-out|
|`.like-count-leave-active`|常规样式；状态选择器触发|animation: count-float-out 0.2s ease-in; position: absolute; left: 0|
|`.comment-slide-enter-active`|常规样式；状态选择器触发|transition: all 0.25s ease-out|
|`.comment-slide-leave-active`|常规样式；状态选择器触发|transition: all 0.2s ease-in|

Vue 进入/退出配置：

```vue
<Transition name="like-count">

                <span v-if="likes > 0" :key="likes" class="moment-action-count">{{ likes }}</span>
              </Transition>
            </span>
          </button>
        </div>
      </div>

      <!-- 评论区 -->
      <Transition name="comment-slide">
        <MomentCommentSe
```

```vue
<Transition name="comment-slide">

        <MomentCommentSection v-if="showComments" :comments="localComments" @submit="onCommentSubmit" />
      </Transition>
    </div>

    <!-- 多图灯箱 -->
    <ClientOnly>
      <MomentLightBox
        :images="moment.images ?? []"
        :current-index="lightBoxIndex"
```

JS 调度/观察器位置：[173](../../src/frontend/web-blog/app/components/moment/MomentCard.vue#L173) `setTimeout(() => {`。

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes like-pop {
  0% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.35);
  }
  50% {
    transform: scale(0.88);
  }
  75% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}
@keyframes like-particles {
  0% {
    opacity: 1;
    box-shadow: 0 0 0 var(--danger), 0 0 0 var(--danger), 0 0 0 #f59e0b, 0 0 0 #f59e0b, 0 0 0 #ec4899, 0 0 0 #ec4899;
  }
  100% {
    opacity: 0;
    box-shadow: -8px -10px 0 var(--danger), 8px -10px 0 var(--danger), -12px 0 0 #f59e0b, 12px 0 0 #f59e0b, -6px 10px 0 #ec4899, 6px 10px 0 #ec4899;
  }
}
@keyframes count-float-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes count-float-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-6px);
  }
}
```

### F063 app/components/moment/MomentCommentSection.vue

朋友圈评论区，含头像、折叠展开与输入框

实现：[源码](../../src/frontend/web-blog/app/components/moment/MomentCommentSection.vue#L297)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.moment-comments__expand`|常规样式；状态选择器触发|display: block; border: none; background: transparent; color: var(--accent-text); font-size: 0.75rem; font-weight: 500; cursor: pointer; padding: 0.25rem 0; margin-left: 2rem; transition: opacity 0.2s|
|`.moment-comments__input`|常规样式；状态选择器触发|flex: 1; min-width: 0; padding: 0.375rem 0.625rem; border: 1px solid var(--border-soft); border-radius: 0.5rem; background: var(--surface-1); color: var(--text-main); font-size: 0.8125rem; outline: none; transition: border-color 0.2s|
|`.moment-comments__send`|常规样式；状态选择器触发|flex-shrink: 0; width: 1.75rem; height: 1.75rem; display: flex; align-items: center; justify-content: center; border: none; border-radius: 0.5rem; background: var(--accent-action); color: #fff; cursor: pointer; transition: opacity 0.2s|

### F064 app/components/moment/MomentLightBox.vue

朋友圈多图轮播灯箱，支持左右切换与键盘导航

实现：[源码](../../src/frontend/web-blog/app/components/moment/MomentLightBox.vue#L10)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.moment-lightbox__close`|常规样式；状态选择器触发|position: absolute; top: 1.5rem; right: 1.5rem; z-index: 10; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border: none; border-radius: 9999px; background: rgba(255, 255, 255, 0.1); color: #fff; cursor: pointer; transition: background 0.2s|
|`.moment-lightbox__nav`|常规样式；状态选择器触发|position: absolute; top: 50%; transform: translateY(-50%); z-index: 10; width: 3rem; height: 3rem; display: flex; align-items: center; justify-content: center; border: none; border-radius: 9999px; background: rgba(255, 255, 255, 0.1); color: #fff; cursor: pointer; transition: background 0.2s|
|`.moment-lightbox__img`|常规样式；状态选择器触发|display: block; max-width: 100%; max-height: 82vh; object-fit: contain; border-radius: 0.75rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); transition: opacity 0.2s ease|
|`.lightbox-fade-enter-active`|常规样式；状态选择器触发|transition: opacity 0.25s ease|
|`.lightbox-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease|

Vue 进入/退出配置：

```vue
<Transition name="lightbox-fade">

      <div
        v-if="visible && images.length > 0"
        ref="dialogRef"
        class="moment-lightbox"
        role="dialog"
        tabindex="-1"
        aria-modal="true"
        aria-label="图片预览"
        @click.self="onClose"
      >
        <!-- 关闭按钮 -->
        <but
```

### F065 app/components/moment/MomentLinkCard.vue

朋友圈动态中引用的外部链接卡片，含 favicon、域名、OG 图，新窗口打开

实现：[源码](../../src/frontend/web-blog/app/components/moment/MomentLinkCard.vue#L68)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.moment-link-card`|常规样式；状态选择器触发|display: flex; gap: 0.75rem; padding: 0.75rem; margin-bottom: 0.75rem; background: var(--surface-2); border: 1px solid var(--border-soft); border-radius: 0.75rem; text-decoration: none; color: inherit; transition: all 0.2s ease; overflow: hidden|
|`.moment-link-card__external`|常规样式；状态选择器触发|flex-shrink: 0; color: var(--text-faint); transition: color 0.2s|

### F066 app/components/moment/MomentList.vue

朋友圈动态列表，含无限滚动加载

实现：[源码](../../src/frontend/web-blog/app/components/moment/MomentList.vue#L97)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.moment-list__spinner-icon`|常规样式；状态选择器触发|animation: spin 1s linear infinite|

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
```

### F067 app/components/moment/MomentUserPopover.vue

用户信息悬浮卡片，hover 触发显示用户头像、昵称、简介

实现：[源码](../../src/frontend/web-blog/app/components/moment/MomentUserPopover.vue#L17)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.popover-fade-enter-active`|常规样式；状态选择器触发|transition: all 0.2s ease-out|
|`.popover-fade-leave-active`|常规样式；状态选择器触发|transition: all 0.15s ease-in|

Vue 进入/退出配置：

```vue
<Transition name="popover-fade">

        <div
          v-if="show && profile"
          class="moment-user-popover__card"
          :style="floatingStyle"
          @mouseenter="onEnter"
          @mouseleave="onLeave"
        >
          <div class="moment-user-popover__header">
            <div class="moment
```

JS 调度/观察器位置：[73](../../src/frontend/web-blog/app/components/moment/MomentUserPopover.vue#L73) `let hideTimer: ReturnType<typeof setTimeout> | null = null`；[85](../../src/frontend/web-blog/app/components/moment/MomentUserPopover.vue#L85) `hideTimer = setTimeout(() => {`。

### F068 app/components/project/ProjectCard.vue

项目卡片组件，展示封面、状态标签、Star 数、描述、技术标签和链接

实现：[源码](../../src/frontend/web-blog/app/components/project/ProjectCard.vue#L88)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.project-card`|常规样式；状态选择器触发|background: var(--surface-1); border: 1px solid var(--border); border-radius: 1.5rem; overflow: hidden; transition: all var(--motion-normal, 0.3s) ease|
|`.project-card__cover img`|常规样式；状态选择器触发|width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease|
|`.project-card__link`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; color: var(--text-soft); text-decoration: none; transition: color 0.2s|

### F069 app/components/project/TechStackCard.vue

技术栈进度条卡片组件

实现：[源码](../../src/frontend/web-blog/app/components/project/TechStackCard.vue#L90)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.tech-stack__fill`|常规样式；状态选择器触发|height: 100%; border-radius: 9999px; background: var(--text-muted); transition: width 1s ease|

### F070 app/components/sidebar/CategoryCard.vue

右侧栏专栏分类卡片组件，展示分类列表及文章数量

实现：[源码](../../src/frontend/web-blog/app/components/sidebar/CategoryCard.vue#L85)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.category-card__item`|常规样式；状态选择器触发|width: 100%; min-height: 44px; text-align: left; color: var(--text-main); display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 0.75rem; border-radius: 0.75rem; transition: all var(--motion-fast, 0.2s) ease; cursor: pointer|
|`.category-card__arrow`|常规样式；状态选择器触发|font-size: 1rem; color: var(--text-soft); transition: color 0.2s|

### F071 app/components/sidebar/FlashCalendarCard.vue

闪念右侧栏发布日历卡，按月展示发布日期，支持点击日期筛选；与 MomentCalendarCard 同款交互

实现：[源码](../../src/frontend/web-blog/app/components/sidebar/FlashCalendarCard.vue#L256)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.flash-calendar-card__nav-btn`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem; border: none; border-radius: 0.5rem; background: transparent; color: var(--text-soft); cursor: pointer; transition: all 0.15s|
|`.flash-calendar-card__day`|常规样式；状态选择器触发|position: relative; display: flex; align-items: center; justify-content: center; aspect-ratio: 1; font-size: 0.6875rem; font-weight: 500; color: var(--text-main); border-radius: 0.5rem; cursor: default; transition: all 0.15s|
|`.flash-calendar-card__today-btn`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.25rem; border: none; background: none; color: var(--accent-text); font-size: 0.6875rem; font-weight: 600; cursor: pointer; padding: 0.125rem 0; transition: opacity 0.15s|

### F072 app/components/sidebar/FlashTimeCapsuleCard.vue

闪念时间胶囊侧栏卡：去年今日 + 随机回顾

实现：[源码](../../src/frontend/web-blog/app/components/sidebar/FlashTimeCapsuleCard.vue#L158)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.flash-capsule-card__refresh`|常规样式；状态选择器触发|margin-left: auto; padding: 0.125rem; border: none; background: transparent; color: var(--text-faint); cursor: pointer; border-radius: 0.5rem; display: inline-flex; align-items: center; justify-content: center; transition: color 0.18s, background 0.18s|
|`.flash-capsule-card__item`|常规样式；状态选择器触发|display: block; padding: 0.625rem 0.75rem; background: var(--surface-2); border-radius: 0.5rem; text-decoration: none; color: inherit; transition: background 0.18s|

### F073 app/components/sidebar/HeatmapGrid.vue

活跃度热力图组件，以 GitHub 风格网格展示近期活动数据

实现：[源码](../../src/frontend/web-blog/app/components/sidebar/HeatmapGrid.vue#L230)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.heatmap__cell`|常规样式；状态选择器触发|padding: 0; border: 0; width: 10px; height: 10px; border-radius: 2px; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s, background 0.3s|
|`.heatmap-tooltip`|常规样式；状态选择器触发|position: fixed; z-index: 9999; transform: translate(-50%, -110%); background: var(--tooltip-bg); color: var(--tooltip-text); font-size: 11px; padding: 6px 12px; border-radius: 8px; box-shadow: var(--tooltip-shadow); line-height: 1.6; white-space: nowrap; transition: opacity 0.15s; pointer-events: none|

### F074 app/components/sidebar/MomentAuthorCard.vue

朋友圈右侧栏作者名片卡，展示博主信息、动态统计和社交链接

实现：[源码](../../src/frontend/web-blog/app/components/sidebar/MomentAuthorCard.vue#L143)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.moment-author-card__stat`|常规样式；状态选择器触发|display: flex; flex-direction: column; align-items: center; gap: 0.125rem; cursor: default; transition: transform 0.2s ease|
|`.moment-author-card__stat-value`|常规样式；状态选择器触发|font-size: 1.25rem; font-weight: 800; color: var(--text-main); transition: color 0.2s|
|`.moment-author-card__social-btn`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 50%; color: var(--text-soft); background: var(--surface-2); transition: all 0.2s ease|

### F075 app/components/sidebar/MomentCalendarCard.vue

朋友圈右侧栏动态日历卡，按月展示发布日期标记，支持点击日期筛选

实现：[源码](../../src/frontend/web-blog/app/components/sidebar/MomentCalendarCard.vue#L268)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.moment-calendar-card__nav-btn`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem; border: none; border-radius: 0.5rem; background: transparent; color: var(--text-soft); cursor: pointer; transition: all 0.15s|
|`.moment-calendar-card__day`|常规样式；状态选择器触发|position: relative; display: flex; align-items: center; justify-content: center; aspect-ratio: 1; font-size: 0.6875rem; font-weight: 500; color: var(--text-main); border-radius: 0.5rem; cursor: default; transition: all 0.15s|
|`.moment-calendar-card__today-btn`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.25rem; border: none; background: none; color: var(--accent-text); font-size: 0.6875rem; font-weight: 600; cursor: pointer; padding: 0.125rem 0; transition: opacity 0.15s|

### F076 app/components/sidebar/MomentInteractionCard.vue

朋友圈右侧栏互动之星卡片：展示评论活跃用户排行榜（Top 5）

实现：[源码](../../src/frontend/web-blog/app/components/sidebar/MomentInteractionCard.vue#L120)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.moment-interaction-card__item`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.625rem; padding: 0.375rem 0.5rem; border-radius: 0.5rem; transition: background-color 0.2s ease, transform 0.2s ease|

### F077 app/components/sidebar/MomentPhotoWallCard.vue

朋友圈右侧栏精选照片墙，展示获赞最多的图片动态

实现：[源码](../../src/frontend/web-blog/app/components/sidebar/MomentPhotoWallCard.vue#L113)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.moment-photo-wall__img`|常规样式；状态选择器触发|width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease|
|`.moment-photo-wall__overlay`|常规样式；状态选择器触发|position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.3); color: #fff; opacity: 0; transition: opacity 0.2s ease|

### F078 app/components/sidebar/MomentTimeCapsuleCard.vue

朋友圈时间胶囊侧栏卡：去年今日 + 随机回顾

实现：[源码](../../src/frontend/web-blog/app/components/sidebar/MomentTimeCapsuleCard.vue#L161)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.moment-capsule-card__refresh`|常规样式；状态选择器触发|margin-left: auto; padding: 0.125rem; border: none; background: transparent; color: var(--text-faint); cursor: pointer; border-radius: 0.5rem; display: inline-flex; align-items: center; justify-content: center; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|
|`.moment-capsule-card__item`|常规样式；状态选择器触发|display: block; padding: 0.625rem 0.75rem; background: var(--surface-2); border-radius: 0.5rem; text-decoration: none; color: inherit; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|

### F079 app/components/sidebar/MomentTopicCard.vue

朋友圈右侧栏热门话题卡，支持点击筛选，按热度排序，带比例条可视化

实现：[源码](../../src/frontend/web-blog/app/components/sidebar/MomentTopicCard.vue#L118)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.moment-topic-card__view-all`|常规样式；状态选择器触发|border: none; background: var(--surface-2); color: var(--text-soft); font-size: 0.6875rem; font-weight: 600; padding: 0.25rem 0.625rem; border-radius: 9999px; cursor: pointer; transition: all 0.2s ease|
|`.moment-topic-card__item`|常规样式；状态选择器触发|width: 100%; min-height: 44px; color: var(--text-main); text-align: left; position: relative; display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 0.75rem; border-radius: 0.75rem; cursor: pointer; transition: all 0.2s ease; overflow: hidden|
|`.moment-topic-card__bar`|常规样式；状态选择器触发|position: absolute; top: 0; left: 0; height: 100%; border-radius: 0.75rem; transition: width 0.3s ease; pointer-events: none|
|`.moment-topic-card__tag-name`|常规样式；状态选择器触发|font-size: 0.8125rem; font-weight: 600; color: var(--text-main); transition: color 0.15s|

### F080 app/components/sidebar/ReadingHistoryCard.vue

侧边栏阅读历史卡片，展示最近阅读的文章

实现：[源码](../../src/frontend/web-blog/app/components/sidebar/ReadingHistoryCard.vue#L63)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.reading-history-card__clear`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem; border: none; border-radius: 0.5rem; background: transparent; color: var(--text-faint); cursor: pointer; transition: all 0.2s|
|`.reading-history-card__link`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.375rem 0.5rem; border-radius: 0.5rem; text-decoration: none; transition: background 0.15s|

### F081 app/components/sidebar/SiteStatsCard.vue

右侧栏站点统计卡片组件，展示运行天数、文章数、浏览量等数据

实现：[源码](../../src/frontend/web-blog/app/components/sidebar/SiteStatsCard.vue#L96)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.stats-card__ping-dot`|常规样式；状态选择器触发|width: 0.625rem; height: 0.625rem; border-radius: 50%; background: var(--stat-green-dot); box-shadow: 0 0 0 3px var(--stat-green-bg); animation: pulse-green 2s infinite|
|`.stats-card__ping-dot`|@media (prefers-reduced-motion: reduce)|animation: none|
|`.stats-card__value`|常规样式；状态选择器触发|font-size: 1.25rem; font-weight: 800; transition: color 0.2s|

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes pulse-green {
  0%, 100% {
    box-shadow: 0 0 0 3px var(--stat-green-bg);
  }
  50% {
    box-shadow: 0 0 0 8px transparent;
  }
}
```

### F082 app/components/sidebar/TagCloudCard.vue

可用键盘与触屏操作的静态标签云，标签不重复或自动移动

实现：[源码](../../src/frontend/web-blog/app/components/sidebar/TagCloudCard.vue#L99)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.tag-cloud-card__tag`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 4px; overflow-wrap: anywhere; min-height: 32px; padding: 0.375rem 0.25rem; border-radius: 9px; font-size: 0.75rem; font-weight: 600; background: var(--surface-1); color: var(--text-muted); border: 1px solid var(--border); transition: all var(--motion-fast, 0.2s) ease; cursor: pointer|

### F083 app/components/tab/TabAddBookmarkDialog.vue

书签新建/编辑弹窗：名称、URL、所属分类、可选颜色

实现：[源码](../../src/frontend/web-blog/app/components/tab/TabAddBookmarkDialog.vue#L10)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.tab-dialog__btn`|常规样式；状态选择器触发|padding: 0.5rem 1.125rem; border-radius: 0.75rem; border: 1px solid transparent; font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: all 0.15s|
|`.dialog-enter-active, .dialog-leave-active`|常规样式；状态选择器触发|transition: opacity 0.18s ease|
|`.dialog-enter-active .tab-dialog__panel, .dialog-leave-active .tab-dialog__panel`|常规样式；状态选择器触发|transition: transform 0.18s ease|

Vue 进入/退出配置：

```vue
<Transition name="dialog">

      <div
        v-if="visible"
        ref="dialogRef"
        class="tab-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="isEdit ? '编辑书签' : '添加书签'"
        tabindex="-1"
        @click.self="close"
      >
        <div class="tab-dialog__panel">
```

### F084 app/components/tab/TabAddCategoryDialog.vue

新建分类对话框：输入名称 + 选择图标

实现：[源码](../../src/frontend/web-blog/app/components/tab/TabAddCategoryDialog.vue#L10)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.tab-cat-dialog__input`|常规样式；状态选择器触发|padding: 0.5rem 0.75rem; border: 1px solid var(--border-soft); border-radius: 0.5rem; background: var(--surface-2); color: var(--text-main); font-size: 0.8125rem; outline: none; transition: border-color 0.18s|
|`.tab-cat-dialog__submit`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; gap: 0.375rem; padding: 0.625rem 1rem; border: none; border-radius: 0.75rem; background: var(--accent-action); color: #fff; font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s|
|`.tab-cat-dialog-enter-active, .tab-cat-dialog-leave-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease|
|`.tab-cat-dialog-enter-active .tab-cat-dialog, .tab-cat-dialog-leave-active .tab-cat-dialog`|常规样式；状态选择器触发|transition: transform 0.2s ease, opacity 0.2s ease|

Vue 进入/退出配置：

```vue
<Transition name="tab-cat-dialog">

      <div v-if="visible" class="tab-cat-dialog-overlay" @click.self="close">
        <div ref="dialogRef" class="tab-cat-dialog" role="dialog" aria-modal="true" aria-label="新建分类" tabindex="-1">
          <header class="tab-cat-dialog__header">
            <Icon name="lucide:fol
```

### F085 app/components/tab/TabBookmarkGrid.vue

标签页书签网格容器：包含 + 按钮，内部接入 useSortable 做同分类内拖拽排序

实现：[源码](../../src/frontend/web-blog/app/components/tab/TabBookmarkGrid.vue#L3)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.tab-grid`|常规样式；状态选择器触发|width: 100%; margin: 0 auto; transition: max-width 0.2s ease|
|`.tab-grid__list`|常规样式；状态选择器触发|display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); transition: gap 0.2s ease|
|`.tab-grid__add`|常规样式；状态选择器触发|display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 0.875rem 0.5rem; border: 1px dashed var(--border); border-radius: 1.5rem; background: transparent; color: var(--text-soft); cursor: pointer; transition: all 0.2s|

JS 调度/观察器位置：[3](../../src/frontend/web-blog/app/components/tab/TabBookmarkGrid.vue#L3) `@description 标签页书签网格容器：包含 + 按钮，内部接入 useSortable 做同分类内拖拽排序`；[32](../../src/frontend/web-blog/app/components/tab/TabBookmarkGrid.vue#L32) `import { useSortable } from '@vueuse/integrations/useSortable'`；[46](../../src/frontend/web-blog/app/components/tab/TabBookmarkGrid.vue#L46) `// 本地 mutable 副本：useSortable 需要直接改动数组；外部 props 变化时同步`；[58](../../src/frontend/web-blog/app/components/tab/TabBookmarkGrid.vue#L58) `const { start, stop } = useSortable(listEl, localList, {`。

### F086 app/components/tab/TabBookmarkItem.vue

标签页书签格子：图标 + 名称，支持 lucide / favicon / emoji / 单字母 fallback 四种渲染

实现：[源码](../../src/frontend/web-blog/app/components/tab/TabBookmarkItem.vue#L122)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.tab-bm`|常规样式；状态选择器触发|position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 0.875rem 0.5rem; border-radius: 1.5rem; text-decoration: none; color: var(--text-main); transition: all 0.2s|
|`.tab-bm__icon`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-card); flex-shrink: 0; transition: width 0.2s ease, height 0.2s ease, border-radius 0.2s ease, opacity 0.2s ease|
|`.tab-bm__remove`|常规样式；状态选择器触发|position: absolute; top: 0.25rem; right: 0.25rem; display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: none; border-radius: 9999px; background: var(--surface-2); color: var(--text-soft); cursor: pointer; opacity: 0; transition: all 0.15s|

JS 调度/观察器位置：[122](../../src/frontend/web-blog/app/components/tab/TabBookmarkItem.vue#L122) `longPressTimer = window.setTimeout(() => {`。

### F087 app/components/tab/TabCommandPalette.vue

标签页 Cmd/Ctrl+K 命令面板：模糊搜索书签/分类/动作，键盘方向键导航

实现：[源码](../../src/frontend/web-blog/app/components/tab/TabCommandPalette.vue#L10)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.tab-palette-enter-active, .tab-palette-leave-active`|常规样式；状态选择器触发|transition: opacity 0.18s ease|
|`.tab-palette-enter-active .tab-palette__panel, .tab-palette-leave-active .tab-palette__panel`|常规样式；状态选择器触发|transition: transform 0.18s ease, opacity 0.18s ease|
|`.tab-palette__item`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.625rem; width: 100%; padding: 0.5rem 1rem; border: none; background: transparent; color: var(--text-main); text-align: left; cursor: pointer; transition: background 0.15s|

Vue 进入/退出配置：

```vue
<Transition name="tab-palette">

      <div v-if="open" class="tab-palette" @click.self="close">
        <div
          ref="dialogRef"
          class="tab-palette__panel"
          role="dialog"
          aria-modal="true"
          aria-label="书签命令面板"
          tabindex="-1"
        >
          <div class="t
```

JS 调度/观察器位置：[238](../../src/frontend/web-blog/app/components/tab/TabCommandPalette.vue#L238) `el?.scrollIntoView({ block: 'nearest' })`。

### F088 app/components/tab/TabContextMenu.vue

标签页上下文菜单：右键 / 移动端长按触发，Teleport 到 body 并自动夹在 viewport 内

实现：[源码](../../src/frontend/web-blog/app/components/tab/TabContextMenu.vue#L10)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.ctx-enter-active, .ctx-leave-active`|常规样式；状态选择器触发|transition: opacity 0.12s ease, transform 0.12s ease|
|`.tab-ctx__item`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.4375rem 0.625rem; border: none; border-radius: 0.5rem; background: transparent; color: var(--text-main); text-align: left; cursor: pointer; transition: background 0.15s, color 0.15s|

Vue 进入/退出配置：

```vue
<Transition name="ctx">

      <div v-if="visible" class="tab-ctx" :style="positionStyle" role="menu" @click.stop>
        <template v-for="(item, idx) in items" :key="idx">
          <div v-if="item.type === 'divider'" class="tab-ctx__divider" />
          <div v-else-if="item.submenu" class="tab-ctx__
```

JS 调度/观察器位置：[112](../../src/frontend/web-blog/app/components/tab/TabContextMenu.vue#L112) `setTimeout(() => {`。

### F089 app/components/tab/TabIconPicker.vue

图标选择器三合一：Lucide 图标 / Emoji / 上传本地图片（dataURL）

实现：[源码](../../src/frontend/web-blog/app/components/tab/TabIconPicker.vue#L289)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.icon-picker__tab`|常规样式；状态选择器触发|flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.25rem; padding: 0.3125rem 0.375rem; border: none; border-radius: 0.5rem; background: transparent; color: var(--text-soft); font-size: 0.6875rem; font-weight: 500; cursor: pointer; transition: all 0.15s|
|`.icon-picker__item`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 100%; aspect-ratio: 1; border: none; border-radius: 0.5rem; background: transparent; color: var(--text-soft); cursor: pointer; transition: background 0.15s, color 0.15s|
|`.icon-picker__upload-dropzone`|常规样式；状态选择器触发|display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; padding: 1.5rem 1rem; border: 2px dashed var(--border); border-radius: 0.75rem; background: var(--surface-2); color: var(--text-soft); cursor: pointer; text-align: center; transition: all 0.15s|

### F090 app/components/tab/TabImportDialog.vue

书签导入对话框：解析 JSON 或浏览器 HTML，预览数量，支持合并/追加/覆盖

实现：[源码](../../src/frontend/web-blog/app/components/tab/TabImportDialog.vue#L11)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.tid-enter-active, .tid-leave-active`|常规样式；状态选择器触发|transition: opacity 0.18s ease, transform 0.18s ease|
|`.tid-dropzone`|常规样式；状态选择器触发|display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; padding: 1.5rem 1rem; border: 2px dashed var(--border); border-radius: 0.75rem; background: var(--surface-2); color: var(--text-soft); cursor: pointer; text-align: center; transition: all 0.15s|
|`.tid-mode__opt`|常规样式；状态选择器触发|display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.5rem 0.75rem; border: 1px solid var(--border-soft); border-radius: 0.5rem; cursor: pointer; transition: all 0.15s|
|`.tid-btn`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.4375rem 0.875rem; border: 1px solid var(--border); border-radius: 0.5rem; background: var(--surface-1); color: var(--text-main); font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all 0.15s|
|`.tid-spin`|常规样式；状态选择器触发|animation: tid-spin 1.2s linear infinite|

Vue 进入/退出配置：

```vue
<Transition name="tid">

      <div
        v-if="visible"
        ref="dialogRef"
        class="tid-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="导入书签"
        tabindex="-1"
      >
        <header class="tid-header">
          <Icon name="lucide:download" size="16" />
```

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes tid-spin {
  to {
    transform: rotate(360deg);
  }
}
```

### F091 app/components/tab/TabSearchBar.vue

标签页顶部搜索框：支持外部引擎（可配置）+ 本地书签/分类模糊搜索下拉

实现：[源码](../../src/frontend/web-blog/app/components/tab/TabSearchBar.vue#L40)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.tab-search__inner`|常规样式；状态选择器触发|position: relative; display: flex; align-items: center; width: 100%; height: 3.25rem; padding: 0 0.75rem 0 1.125rem; background: var(--surface-1); border: 1px solid var(--border-soft); border-radius: 9999px; box-shadow: var(--shadow-card); transition: all 0.2s|
|`.tab-search__submit`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; margin-left: 0.5rem; border: none; border-radius: 9999px; background: var(--accent-action); color: #fff; cursor: pointer; transition: opacity 0.2s|
|`.tab-search-dropdown-enter-active, .tab-search-dropdown-leave-active`|常规样式；状态选择器触发|transition: opacity 0.15s ease, transform 0.15s ease|
|`.tab-search__hit`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.625rem; width: 100%; padding: 0.5rem 0.75rem; border: none; background: transparent; color: var(--text-main); text-align: left; cursor: pointer; border-radius: 0.5rem; transition: background 0.15s|

Vue 进入/退出配置：

```vue
<Transition name="tab-search-dropdown">

      <div v-if="showDropdown" class="tab-search__dropdown">
        <button
          v-for="(hit, idx) in localHits"
          :key="hit.id"
          ref="hitRefs"
          type="button"
          class="tab-search__hit"
          :class="{ 'tab-search__hit--focus': focusedI
```

JS 调度/观察器位置：[181](../../src/frontend/web-blog/app/components/tab/TabSearchBar.vue#L181) `setTimeout(() => {`。

### F092 app/components/tab/TabSettingsDrawer.vue

标签页设置抽屉：从右侧滑出，双栏布局，所有设置项实时生效 + 分组恢复默认

实现：[源码](../../src/frontend/web-blog/app/components/tab/TabSettingsDrawer.vue#L11)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.tab-settings-drawer-enter-active, .tab-settings-drawer-leave-active`|常规样式；状态选择器触发|transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)|
|`.tsd-nav__item`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.5rem; padding: 0.4375rem 0.5rem; border: none; border-radius: 0.75rem; background: transparent; color: var(--text-soft); font-size: 0.6875rem; font-weight: 500; cursor: pointer; text-align: left; white-space: nowrap; transition: all 0.15s|
|`.tsd-opt`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.25rem; padding: 0.3125rem 0.5rem; border: 1px solid var(--border-soft); border-radius: 0.5rem; background: transparent; color: var(--text-soft); font-size: 0.625rem; font-weight: 500; cursor: pointer; transition: all 0.15s|
|`.tsd-toggle`|常规样式；状态选择器触发|position: relative; width: 34px; height: 18px; border: none; border-radius: 9px; background: var(--border); cursor: pointer; transition: background 0.2s; padding: 0; flex-shrink: 0|
|`.tsd-toggle__thumb`|常规样式；状态选择器触发|position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 9999px; background: #fff; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15)|
|`.tsd-reset`|常规样式；状态选择器触发|display: inline-flex; align-items: center; align-self: flex-start; gap: 0.25rem; margin-top: 0.75rem; padding: 0.3125rem 0.625rem; border: 1px dashed var(--border); border-radius: 0.5rem; background: transparent; color: var(--text-soft); font-size: 0.625rem; font-weight: 500; cursor: pointer; transition: all 0.15s|
|`.tsd-wp-thumb`|常规样式；状态选择器触发|position: relative; aspect-ratio: 16/10; border: 2px solid var(--border-soft); border-radius: 0.5rem; background-size: cover; background-position: center; background-color: var(--surface-2); cursor: pointer; overflow: hidden; transition: all 0.15s|
|`.tsd-wp-upload`|常规样式；状态选择器触发|display: flex; flex-direction: column; align-items: center; gap: 0.375rem; padding: 1rem; border: 2px dashed var(--border); border-radius: 0.5rem; background: var(--surface-2); color: var(--text-soft); font-size: 0.6875rem; cursor: pointer; text-align: center; transition: all 0.15s|
|`.tsd-view-card`|常规样式；状态选择器触发|display: flex; flex-direction: column; align-items: center; gap: 0.375rem; padding: 0.625rem 0.25rem; border: 1px solid var(--border-soft); border-radius: 0.75rem; background: transparent; color: var(--text-soft); cursor: pointer; transition: all 0.15s|
|`.tsd-data-btn`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.625rem; padding: 0.625rem 0.875rem; border: 1px solid var(--border-soft); border-radius: 0.5rem; background: var(--surface-2); color: var(--text-main); text-align: left; cursor: pointer; transition: all 0.15s|

Vue 进入/退出配置：

```vue
<Transition name="tab-settings-drawer">

      <aside
        v-if="visible"
        ref="dialogRef"
        class="tab-settings-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="标签页设置"
        tabindex="-1"
      >
        <header class="tsd-header">
          <Icon name="lucide:settings" siz
```

### F093 app/components/tab/TabSidebarFloating.vue

标签页悬浮侧栏：脱离内容流，悬浮在视口左侧空白区域，支持折叠/展开

实现：[源码](../../src/frontend/web-blog/app/components/tab/TabSidebarFloating.vue#L100)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.tab-side`|常规样式；状态选择器触发|position: fixed; left: 1.25rem; top: 4rem; bottom: 0.75rem; z-index: 10; width: 160px; padding: 0.625rem; display: flex; flex-direction: column; border: 1px solid var(--border-soft); box-shadow: var(--shadow-elevated, var(--shadow-card)); transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s ease, backdrop-filter 0.25s ease|
|`.tab-side__toggle`|常规样式；状态选择器触发|position: absolute; top: 0.5rem; right: 0.5rem; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: none; border-radius: 0.5rem; background: transparent; color: var(--text-faint); cursor: pointer; transition: color 0.15s, background 0.15s|
|`.tab-side__cat`|常规样式；状态选择器触发|position: relative; display: flex; align-items: center; gap: 0.5rem; padding: 0.4375rem 0.5rem; border: none; border-radius: 0.75rem; background: transparent; color: var(--text-main); font-size: 0.75rem; text-align: left; cursor: pointer; transition: all 0.15s; white-space: nowrap|
|`.tab-side__cat-remove`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; margin-left: 0.125rem; border: none; border-radius: 9999px; background: transparent; color: var(--text-soft); cursor: pointer; opacity: 0; transition: all 0.15s|
|`.tab-side__action`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; gap: 0.375rem; width: 100%; padding: 0.4375rem 0.5rem; border: 1px dashed var(--border); border-radius: 0.75rem; background: transparent; color: var(--text-soft); font-size: 0.6875rem; font-weight: 500; cursor: pointer; transition: all 0.15s|
|`.tab-side__bottom-btn`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.5rem; padding: 0.4375rem 0.5rem; border: none; border-radius: 0.75rem; background: transparent; color: var(--text-soft); font-size: 0.6875rem; cursor: pointer; transition: all 0.15s; white-space: nowrap|

JS 调度/观察器位置：[100](../../src/frontend/web-blog/app/components/tab/TabSidebarFloating.vue#L100) `import { useSortable } from '@vueuse/integrations/useSortable'`；[131](../../src/frontend/web-blog/app/components/tab/TabSidebarFloating.vue#L131) `/** 本地 mutable 分类副本，供 useSortable 修改 */`；[143](../../src/frontend/web-blog/app/components/tab/TabSidebarFloating.vue#L143) `const { start: startSortable, stop: stopSortable } = useSortable(navEl, localCategories, {`。

### F094 app/components/tab/TabWallpaperLayer.vue

标签页壁纸背景层：Teleport 到 body，固定在视口底部（z-index: -1）

实现：[源码](../../src/frontend/web-blog/app/components/tab/TabWallpaperLayer.vue#L149)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.tab-wp__layer`|常规样式；状态选择器触发|position: absolute; inset: -24px; transition: filter 0.3s ease, background 0.3s ease|
|`.tab-wp__mask`|常规样式；状态选择器触发|position: absolute; inset: 0; transition: opacity 0.3s ease|

### F095 app/composables/useAppearanceSettings.ts

管理界面设置抽屉状态、动画偏好与本地持久化，并复用主题切换能力

实现：[源码](../../src/frontend/web-blog/app/composables/useAppearanceSettings.ts#L36)。

### F096 app/composables/useContentBackup.ts

内容包下载、文件预览与幂等导入；失败保留本地文件，状态以服务器为准。

实现：[源码](../../src/frontend/web-blog/app/composables/useContentBackup.ts#L64)。

JS 调度/观察器位置：[64](../../src/frontend/web-blog/app/composables/useContentBackup.ts#L64) `setTimeout(() => URL.revokeObjectURL(url), 1000)`。

### F097 app/composables/useFullbleedPage.ts

全屏页（fullbleed）开关：让单个页面在 default layout 下隐藏左右两栏、撑满主区，

实现：[源码](../../src/frontend/web-blog/app/composables/useFullbleedPage.ts#L8)。

### F098 app/composables/useKeyboardShortcuts.ts

全局键盘快捷键管理

实现：[源码](../../src/frontend/web-blog/app/composables/useKeyboardShortcuts.ts#L63)。

JS 调度/观察器位置：[63](../../src/frontend/web-blog/app/composables/useKeyboardShortcuts.ts#L63) `window.scrollTo({ top: 0, behavior: 'smooth' })`。

### F099 app/composables/useLayoutTheme.ts

对接主题引擎并合并宿主侧配置，提供主题元信息、切换状态与预热能力

实现：[源码](../../src/frontend/web-blog/app/composables/useLayoutTheme.ts#L105)。

JS 调度/观察器位置：[106](../../src/frontend/web-blog/app/composables/useLayoutTheme.ts#L106) `const minDisplay = new Promise<void>((resolve) => setTimeout(resolve, minimum))`。

### F100 app/composables/useLoadingProgress.ts

首屏加载假进度驱动（nprogress 风格 trickle 曲线），供顶部进度条与中央百分比共享

实现：[源码](../../src/frontend/web-blog/app/composables/useLoadingProgress.ts#L46)。

JS 调度/观察器位置：[46](../../src/frontend/web-blog/app/composables/useLoadingProgress.ts#L46) `let timer: ReturnType<typeof setInterval> | null = null`；[74](../../src/frontend/web-blog/app/composables/useLoadingProgress.ts#L74) `timer = setInterval(tick, TICK_INTERVAL)`；[90](../../src/frontend/web-blog/app/composables/useLoadingProgress.ts#L90) `setTimeout(() => {`。

### F101 app/composables/useMomentPagination.ts

朋友圈无限滚动分页逻辑，含话题/日期筛选、fuse.js 全文搜索与 IntersectionObserver

实现：[源码](../../src/frontend/web-blog/app/composables/useMomentPagination.ts#L3)。

JS 调度/观察器位置：[3](../../src/frontend/web-blog/app/composables/useMomentPagination.ts#L3) `* @description 朋友圈无限滚动分页逻辑，含话题/日期筛选、fuse.js 全文搜索与 IntersectionObserver`；[62](../../src/frontend/web-blog/app/composables/useMomentPagination.ts#L62) `let spinnerTimer: ReturnType<typeof setTimeout> | null = null`；[88](../../src/frontend/web-blog/app/composables/useMomentPagination.ts#L88) `spinnerTimer = setTimeout(() => {`；[92](../../src/frontend/web-blog/app/composables/useMomentPagination.ts#L92) `requestAnimationFrame(() => {`；[100](../../src/frontend/web-blog/app/composables/useMomentPagination.ts#L100) `// IntersectionObserver`；[101](../../src/frontend/web-blog/app/composables/useMomentPagination.ts#L101) `let observer: IntersectionObserver | null = null`；[106](../../src/frontend/web-blog/app/composables/useMomentPagination.ts#L106) `observer = new IntersectionObserver(`。

### F102 app/composables/usePageScrollRestoration.ts

按浏览器历史项保存主内容滚动位置，兼容主题重挂与异步内容恢复

实现：[源码](../../src/frontend/web-blog/app/composables/usePageScrollRestoration.ts#L17)。

JS 调度/观察器位置：[17](../../src/frontend/web-blog/app/composables/usePageScrollRestoration.ts#L17) `let timeout: ReturnType<typeof setTimeout> | undefined`；[42](../../src/frontend/web-blog/app/composables/usePageScrollRestoration.ts#L42) `if (root) root.scrollTo({ top: target, behavior: 'instant' })`；[43](../../src/frontend/web-blog/app/composables/usePageScrollRestoration.ts#L43) `else window.scrollTo({ top: target, behavior: 'instant' })`；[48](../../src/frontend/web-blog/app/composables/usePageScrollRestoration.ts#L48) `frame = requestAnimationFrame(() => {`；[49](../../src/frontend/web-blog/app/composables/usePageScrollRestoration.ts#L49) `frame = requestAnimationFrame(restore)`；[57](../../src/frontend/web-blog/app/composables/usePageScrollRestoration.ts#L57) `timeout = setTimeout(cancel, 2000)`；[77](../../src/frontend/web-blog/app/composables/usePageScrollRestoration.ts#L77) `timeout = setTimeout(cancel, 2000)`；[97](../../src/frontend/web-blog/app/composables/usePageScrollRestoration.ts#L97) `const observer = new MutationObserver(schedule)`；[99](../../src/frontend/web-blog/app/composables/usePageScrollRestoration.ts#L99) `const resize = new ResizeObserver(schedule)`。

### F103 app/composables/usePostEditor.ts

博主文章编辑状态：加载、真实保存、发布撤回、失败保留与未保存离开提示

实现：[源码](../../src/frontend/web-blog/app/composables/usePostEditor.ts#L40)。

JS 调度/观察器位置：[40](../../src/frontend/web-blog/app/composables/usePostEditor.ts#L40) `let localTimer: ReturnType<typeof setTimeout> | undefined`；[41](../../src/frontend/web-blog/app/composables/usePostEditor.ts#L41) `let serverTimer: ReturnType<typeof setTimeout> | undefined`；[275](../../src/frontend/web-blog/app/composables/usePostEditor.ts#L275) `localTimer = setTimeout(persistLocal, 400)`；[283](../../src/frontend/web-blog/app/composables/usePostEditor.ts#L283) `serverTimer = setTimeout(() => {`。

### F104 app/composables/usePostListAnimation.ts

文章列表瀑布流模式下新卡片交错入场动画控制

实现：[源码](../../src/frontend/web-blog/app/composables/usePostListAnimation.ts#L20)。

JS 调度/观察器位置：[39](../../src/frontend/web-blog/app/composables/usePostListAnimation.ts#L39) `requestAnimationFrame(() => {`；[44](../../src/frontend/web-blog/app/composables/usePostListAnimation.ts#L44) `setTimeout(() => {`。

### F105 app/composables/usePostListPagination.ts

受控分页和触底事件：组件只发出页码请求，真实取数由页面数据源负责

实现：[源码](../../src/frontend/web-blog/app/composables/usePostListPagination.ts#L74)。

JS 调度/观察器位置：[75](../../src/frontend/web-blog/app/composables/usePostListPagination.ts#L75) `if (root) root.scrollTo({ top: 0, behavior })`；[76](../../src/frontend/web-blog/app/composables/usePostListPagination.ts#L76) `else viewport?.closest('.main-inner')?.scrollIntoView({ block: 'start', behavior })`；[79](../../src/frontend/web-blog/app/composables/usePostListPagination.ts#L79) `let observer: IntersectionObserver | null = null`；[85](../../src/frontend/web-blog/app/composables/usePostListPagination.ts#L85) `observer = new IntersectionObserver(`。

### F106 app/composables/useReadingProgress.ts

以文章正文而非评论区计算阅读进度，适配文档和主题内部滚动

实现：[源码](../../src/frontend/web-blog/app/composables/useReadingProgress.ts#L12)。

JS 调度/观察器位置：[12](../../src/frontend/web-blog/app/composables/useReadingProgress.ts#L12) `let observer: ResizeObserver | null = null`；[30](../../src/frontend/web-blog/app/composables/useReadingProgress.ts#L30) `frame = requestAnimationFrame(update)`；[35](../../src/frontend/web-blog/app/composables/useReadingProgress.ts#L35) `observer = new ResizeObserver(schedule)`。

### F107 app/composables/useSidebarExitAnimation.ts

右侧栏页面切换退出动画：导航前克隆内容播放离场动画，供各布局主题复用

实现：[源码](../../src/frontend/web-blog/app/composables/useSidebarExitAnimation.ts#L26)。

JS 调度/观察器位置：[53](../../src/frontend/web-blog/app/composables/useSidebarExitAnimation.ts#L53) `'animationend',`。

### F108 app/composables/useTableOfContents.ts

按实际滚动根和粘性标题高度计算当前章节，支持长章节与文末

实现：[源码](../../src/frontend/web-blog/app/composables/useTableOfContents.ts#L34)。

JS 调度/观察器位置：[35](../../src/frontend/web-blog/app/composables/useTableOfContents.ts#L35) `frame = requestAnimationFrame(update)`。

### F109 app/composables/useTheme.ts

明暗主题切换组合式函数，用 View Transitions API 驱动四种切换动画预设

实现：[源码](../../src/frontend/web-blog/app/composables/useTheme.ts#L58)。

JS 调度/观察器位置：[61](../../src/frontend/web-blog/app/composables/useTheme.ts#L61) `if (reducedMotion || preset === 'none' || typeof document.startViewTransition !== 'function') {`；[85](../../src/frontend/web-blog/app/composables/useTheme.ts#L85) `const transition = document.startViewTransition(async () => {`；[105](../../src/frontend/web-blog/app/composables/useTheme.ts#L105) `root.animate(`。

### F110 app/composables/useToast.ts

简易全局 Toast 提示

实现：[源码](../../src/frontend/web-blog/app/composables/useToast.ts#L22)。

JS 调度/观察器位置：[22](../../src/frontend/web-blog/app/composables/useToast.ts#L22) `setTimeout(() => {`。

### F111 app/features/flash/ai-search.mock.ts

闪念 AI 搜索的 mock 实现，模拟「思考延迟 + 结构化回答 + 引用」

实现：[源码](../../src/frontend/web-blog/app/features/flash/ai-search.mock.ts#L41)。

JS 调度/观察器位置：[41](../../src/frontend/web-blog/app/features/flash/ai-search.mock.ts#L41) `return new Promise((resolve) => setTimeout(resolve, ms))`。

### F112 app/features/tab/export.ts

标签页数据导出：生成带版本号的 JSON，浏览器下载

实现：[源码](../../src/frontend/web-blog/app/features/tab/export.ts#L37)。

JS 调度/观察器位置：[37](../../src/frontend/web-blog/app/features/tab/export.ts#L37) `setTimeout(() => URL.revokeObjectURL(url), 0)`。

### F113 app/features/tab/favicon.ts

书签 favicon 抓取工具：构建 provider URL + 异步校验可达性

实现：[源码](../../src/frontend/web-blog/app/features/tab/favicon.ts#L49)。

JS 调度/观察器位置：[49](../../src/frontend/web-blog/app/features/tab/favicon.ts#L49) `const timer = window.setTimeout(() => {`。

### F114 app/layouts/admin.vue

博主管理布局，提供明确的内容管理导航和真实退出操作

实现：[源码](../../src/frontend/web-blog/app/layouts/admin.vue#L44)。

Vue 进入/退出配置：

```vue
<NuxtPage />

    </main>
  </div>
</template>
<script setup lang="ts">
const { isLoggedIn, logout, authError } = useCurrentUser()
const sessionHelp = ref(false)
function reauthenticated() {
  sessionHelp.value = false
}
const { error } = useToast()
const route = useRoute()
const sidebarNav =
```

JS 调度/观察器位置：[61](../../src/frontend/web-blog/app/layouts/admin.vue#L61) `?.scrollIntoView({ block: 'nearest', inline: 'nearest' })`。

### F115 app/layouts/default.vue

博客默认布局，稳定持有页面实例并将主题差异壳层委托给主题引擎渲染

实现：[源码](../../src/frontend/web-blog/app/layouts/default.vue#L13)。

Vue 进入/退出配置：

```vue
<NuxtPage :transition="contentTransition" />

  </ThemeComponent>
  <ThemeComponent name="ThemeAccessory" />
  <CommonAppearanceDrawer />
  <LayoutMobileNav />
</template>

<script setup lang="ts">
const { settings: siteSettings } = useSiteSettings()
const { contentTransitionName, contentTransitionDuration } = useAppearance
```

### F116 app/pages/admin/moments/new.vue

闪念发布编辑器（博主 owner 才可访问），mock 阶段写入 useMomentList 状态

实现：[源码](../../src/frontend/web-blog/app/pages/admin/moments/new.vue#L279)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.back-btn`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; color: var(--text-soft); font-size: 0.875rem; border-radius: 0.5rem; text-decoration: none; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|
|`.moment-form__textarea, .moment-form__input`|常规样式；状态选择器触发|padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 0.5rem; background: var(--surface-1); color: var(--text-main); font-size: 0.875rem; outline: none; transition: border-color 0.2s, box-shadow 0.2s; font-family: inherit; resize: vertical|
|`.moment-form__topic`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.625rem; border: 1px solid var(--border-soft); background: var(--surface-2); color: var(--text-soft); font-size: 0.75rem; border-radius: 9999px; cursor: pointer; transition: all 0.2s|
|`.primary-btn`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.5rem 1rem; background: var(--accent); color: #fff; font-size: 0.875rem; font-weight: 500; border: none; border-radius: 0.5rem; cursor: pointer; transition: opacity 0.2s|
|`.ghost-btn`|常规样式；状态选择器触发|padding: 0.5rem 1rem; background: transparent; color: var(--text-soft); font-size: 0.875rem; border: 1px solid var(--border); border-radius: 0.5rem; cursor: pointer; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|

### F117 app/pages/articles/[id].vue

文章详情页：正文、目录、评论与相关推荐

实现：[源码](../../src/frontend/web-blog/app/pages/articles/[id].vue#L352)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.article-page__stat--btn`|常规样式；状态选择器触发|border: none; background: none; cursor: pointer; padding: 0.25rem 0.5rem; border-radius: 0.5rem; transition: all 0.2s; font-size: inherit; color: inherit|

### F118 app/pages/flash/index.vue

闪念主页（原 flash.vue，为支持 /flash/:id 子路由迁移为目录式）：编辑器 + 笔记流；右栏 AI 搜索入口、标签云、统计

实现：[源码](../../src/frontend/web-blog/app/pages/flash/index.vue#L311)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.flash-page__search-toggle`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; border: 1px solid var(--border); border-radius: 0.75rem; background: transparent; color: var(--text-soft); font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: background 0.18s, color 0.18s, border-color 0.18s|
|`.flash-page__search-bar`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.5rem 0.75rem; margin-bottom: 1rem; background: var(--surface-2); border: 1px solid var(--border-soft); border-radius: 1.5rem; animation: flash-search-in 0.18s ease|
|`.flash-page__type-tab`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.3rem 0.65rem; font-size: 0.75rem; font-weight: 500; color: var(--text-soft); background: var(--surface-2); border: 1px solid transparent; border-radius: 9999px; cursor: pointer; transition: background 0.18s, color 0.18s, border-color 0.18s|
|`.flash-page__filter-bar`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: var(--accent-soft); border: 1px dashed var(--accent); border-radius: 1.5rem; font-size: 0.75rem; color: var(--text-soft); animation: flash-search-in 0.18s ease|
|`.flash-page__filter-clear`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; border: none; border-radius: 9999px; background: var(--accent-action); color: #fff; font-size: 0.6875rem; font-weight: 600; cursor: pointer; transition: opacity 0.18s|
|`.flash-page__guest-banner`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.625rem; padding: 0.75rem 1rem; border: 1px dashed var(--accent); border-radius: 1.5rem; background: var(--accent-soft); color: var(--text-main); font-size: 0.8125rem; text-align: left; cursor: pointer; transition: all 0.2s; width: 100%|
|`.flash-ai-card`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; border: 1px solid var(--border-soft); border-radius: 1.5rem; background: linear-gradient(135deg, var(--accent-soft), var(--surface-1)); color: var(--text-main); text-align: left; cursor: pointer; transition: all 0.2s; width: 100%|
|`.flash-tag-cloud__item`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.25rem; color: var(--accent-text); font-weight: 600; cursor: pointer; padding: 0.125rem 0.375rem; border-radius: 9999px; transition: opacity 0.2s, background 0.2s, color 0.2s|

JS 调度/观察器位置：[311](../../src/frontend/web-blog/app/pages/flash/index.vue#L311) `let searchTimer: ReturnType<typeof setTimeout> | null = null`；[315](../../src/frontend/web-blog/app/pages/flash/index.vue#L315) `searchTimer = setTimeout(() => {`；[348](../../src/frontend/web-blog/app/pages/flash/index.vue#L348) `document.getElementById(flash-note-${noteId})?.scrollIntoView({ behavior: 'smooth', block: 'center' })`；[349](../../src/frontend/web-blog/app/pages/flash/index.vue#L349) `setTimeout(() => {`。

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes flash-search-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### F119 app/pages/flash/[id].vue

闪念单条详情页：独立 URL、OG 卡、上下条导航，展示博主公开闪念

实现：[源码](../../src/frontend/web-blog/app/pages/flash/[id].vue#L209)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.back-btn`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; color: var(--text-soft); font-size: 0.875rem; border-radius: 0.5rem; text-decoration: none; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|
|`.flash-detail-nav__item`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.625rem; padding: 0.875rem 1rem; background: var(--surface-2); border: 1px solid var(--border-soft); border-radius: 0.75rem; color: inherit; text-decoration: none; transition: all var(--motion-normal, 0.3s) ease; min-width: 0|
|`.flash-detail-loading__icon`|常规样式；状态选择器触发|animation: flash-spin 1s linear infinite|

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes flash-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
```

### F120 app/pages/guestbook.vue

留言板页面，聊天式留言列表与侧栏统计、守则与活跃成员

实现：[源码](../../src/frontend/web-blog/app/pages/guestbook.vue#L43)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.guestbook-online__pulse::before`|常规样式；状态选择器触发|content: ""; position: absolute; inset: 0; border-radius: inherit; background: #34d399; animation: guestbook-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.6|
|`.guestbook-loader__spinner`|常规样式；状态选择器触发|color: var(--text-soft); animation: spin 1.2s linear infinite|
|`.loader-fade-enter-active, .loader-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 0.25s ease, transform 0.25s ease|
|`.guestbook-scroll-bottom`|常规样式；状态选择器触发|position: absolute; right: 1.25rem; bottom: 1rem; z-index: 8; display: flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem; border-radius: 9999px; border: 1px solid var(--border); background: color-mix(in srgb, var(--surface-1) 80%, transparent); backdrop-filter: blur(12px); color: var(--text-soft); box-shadow: var(--shadow-card); cursor: pointer; transition: all 0.2s ease|
|`.scroll-btn-fade-enter-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease, transform 0.2s ease|
|`.scroll-btn-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 0.15s ease, transform 0.15s ease|

Vue 进入/退出配置：

```vue
<Transition name="loader-fade">

          <div
            v-if="hasOlderMessages && showLoadingOlder"
            class="guestbook-loader"
            :class="isChatMode ? 'guestbook-loader--top' : 'guestbook-loader--bottom'"
          >
            <Icon name="lucide:loader-2" size="14" class="guestbook-load
```

```vue
<Transition name="scroll-btn-fade">

          <button
            v-if="isChatMode && !isAtBottom"
            type="button"
            class="guestbook-scroll-bottom"
            @click="scrollToBottom()"
          >
            <span v-if="newMessageCount > 0" class="guestbook-scroll-bottom__badge">
```

JS 调度/观察器位置：[234](../../src/frontend/web-blog/app/pages/guestbook.vue#L234) `setTimeout(() => {`；[240](../../src/frontend/web-blog/app/pages/guestbook.vue#L240) `// ---- IntersectionObserver 监听顶部哨兵 ----`；[241](../../src/frontend/web-blog/app/pages/guestbook.vue#L241) `let observer: IntersectionObserver | null = null`；[252](../../src/frontend/web-blog/app/pages/guestbook.vue#L252) `observer = new IntersectionObserver(`；[321](../../src/frontend/web-blog/app/pages/guestbook.vue#L321) `viewport.scrollTo({`；[335](../../src/frontend/web-blog/app/pages/guestbook.vue#L335) `setTimeout(() => setupObserver(), 100)`；[349](../../src/frontend/web-blog/app/pages/guestbook.vue#L349) `setTimeout(() => {`。

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes guestbook-ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### F121 app/pages/moments/index.vue

朋友圈列表页（原 moments.vue，为支持子路由 /moments/:id 迁移为目录式）

实现：[源码](../../src/frontend/web-blog/app/pages/moments/index.vue#L123)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.moments-header__publish`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.4rem 0.75rem; background: var(--accent-action); color: #fff; font-size: 0.8125rem; font-weight: 500; border-radius: 0.5rem; text-decoration: none; transition: opacity 0.2s|

JS 调度/观察器位置：[123](../../src/frontend/web-blog/app/pages/moments/index.vue#L123) `el?.scrollIntoView({ behavior: 'smooth', block: 'center' })`。

### F122 app/pages/moments/topic/[name].vue

朋友圈话题聚合页：单一话题下的全部动态时间线

实现：[源码](../../src/frontend/web-blog/app/pages/moments/topic/[name].vue#L134)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.back-btn`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; background: transparent; color: var(--text-soft); font-size: 0.875rem; border-radius: 0.5rem; text-decoration: none; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|

### F123 app/pages/moments/[id].vue

朋友圈单条动态详情页：独立 URL、OG 卡、上一条/下一条导航

实现：[源码](../../src/frontend/web-blog/app/pages/moments/[id].vue#L213)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.back-btn`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; border: none; background: transparent; color: var(--text-soft); font-size: 0.875rem; border-radius: 0.5rem; cursor: pointer; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|
|`.moment-detail-nav__item`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.625rem; padding: 0.875rem 1rem; background: var(--surface-2); border: 1px solid var(--border-soft); border-radius: 0.75rem; color: inherit; text-decoration: none; transition: all var(--motion-normal, 0.3s) ease; min-width: 0|

### F124 app/pages/tabs.vue

标签页主页：通过 fullbleed 模式让 default layout 隐藏左右两栏，

实现：[源码](../../src/frontend/web-blog/app/pages/tabs.vue#L99)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.tabs-guest-toast__login`|常规样式；状态选择器触发|display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; border: none; border-radius: 0.5rem; background: var(--accent-action); color: #fff; font-size: 0.6875rem; font-weight: 600; cursor: pointer; white-space: nowrap; transition: opacity 0.18s|
|`.tabs-guest-toast-enter-active, .tabs-guest-toast-leave-active`|常规样式；状态选择器触发|transition: opacity 0.25s ease, transform 0.25s ease|

Vue 进入/退出配置：

```vue
<Transition name="tabs-guest-toast">

          <div v-if="isReadOnly && !guestToastDismissed" class="tabs-guest-toast">
            <Icon name="lucide:info" size="14" class="tabs-guest-toast__icon" />
            <span class="tabs-guest-toast__text">正在浏览博主的标签页</span>
            <button type="button" class="tabs-gu
```

### F125 app/utils/scrollRoot.ts

根据实际溢出样式识别滚动根，统一文档与主题内部滚动的定位

实现：[源码](../../src/frontend/web-blog/app/utils/scrollRoot.ts#L26)。

JS 调度/观察器位置：[27](../../src/frontend/web-blog/app/utils/scrollRoot.ts#L27) `if (root) root.scrollTo({ top, behavior })`；[28](../../src/frontend/web-blog/app/utils/scrollRoot.ts#L28) `else window.scrollTo({ top, behavior })`。

### F126 nuxt.config.ts

Nuxt 应用配置文件，包含模块、样式、主题、图标等全局设置

实现：[源码](../../src/frontend/web-blog/nuxt.config.ts#L199)。

JS 调度/观察器位置：[199](../../src/frontend/web-blog/nuxt.config.ts#L199) `'@vueuse/integrations/useSortable',`。

### F127 themes/aurora/app/components/RootLayout.vue

Aurora 双栏布局主题：Hero 视觉区域 + 动态毛玻璃顶栏 + 双栏内容

实现：[源码](../../src/frontend/web-blog/themes/aurora/app/components/RootLayout.vue#L35)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.aurora-topbar`|常规样式；状态选择器触发|position: absolute; top: 0; left: 0; right: 0; z-index: 40; width: 100%; max-width: 100%; margin-left: auto; margin-right: auto; background: var(--aurora-topbar-bg-scrolled); backdrop-filter: blur(var(--aurora-blur-strength)); border-bottom: 1px solid var(--border-soft); transition: width 0.4s cubic-bezier(0.25, 0.1, 0.25, 1), max-width 0.4s cubic-bezier(0.25, 0.1, 0.25, 1), border-radius 0.4s cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 0.4s cubic-bezier(0.25, 0.1, 0.25, 1), background-color 0.4s ease, border-color 0.4s ease|
|`.aurora-topbar__brand`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.5rem; color: var(--text-main); font-weight: 700; font-size: 1rem; flex-shrink: 0; transition: all var(--motion-fast, 0.2s) ease|
|`.aurora-topbar__link`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; color: var(--text-soft); white-space: nowrap; transition: all var(--motion-fast, 0.2s) ease|
|`.aurora-topbar__login`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 9999px; border: 1px solid var(--border-soft); background: transparent; color: var(--text-soft); cursor: pointer; transition: all 0.2s ease|
|`.aurora-hero__bg`|常规样式；状态选择器触发|position: absolute; inset: -20%; background-size: cover; background-position: center; background-repeat: no-repeat; will-change: transform; z-index: 1|
|`.hero-fade-enter-active`|常规样式；状态选择器触发|transition: opacity 2s ease-in-out; z-index: 2|
|`.hero-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 2s ease-in-out; z-index: 1|
|`.aurora-scroll-progress`|常规样式；状态选择器触发|position: relative; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text-soft); cursor: pointer; padding: 0.25rem 0.5rem; min-width: 2.75rem; border-radius: 0.5rem; border: none; background: transparent; transition: color 0.2s ease, background 0.2s ease; white-space: nowrap|
|`.aurora-scroll-progress:hover .aurora-scroll-progress__icon`|常规样式；状态选择器触发|opacity: 1; transform: translateY(0); animation: aurora-progress-bounce 0.6s ease infinite|
|`.aurora-scroll-progress:hover .aurora-scroll-progress__icon`|@media (prefers-reduced-motion: reduce)|animation: none|
|`.aurora-scroll-progress.is-clicked:hover .aurora-scroll-progress__icon`|常规样式；状态选择器触发|opacity: 0; transform: translateY(4px); animation: none|
|`.aurora-scroll-progress__text`|常规样式；状态选择器触发|transition: opacity 0.2s ease, transform 0.2s ease|
|`.aurora-scroll-progress__icon`|常规样式；状态选择器触发|position: absolute; opacity: 0; transform: translateY(4px); transition: opacity 0.2s ease, transform 0.2s ease|
|`.progress-fade-enter-active`|常规样式；状态选择器触发|transition: opacity 0.25s ease-out, transform 0.25s ease-out|
|`.progress-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease-in, transform 0.2s ease-in|
|`:deep(.back-to-top-enter-active)`|常规样式；状态选择器触发|transition: opacity 0.3s ease-out, transform 0.3s ease-out|
|`:deep(.back-to-top-leave-active)`|常规样式；状态选择器触发|transition: opacity 0.25s ease-in, transform 0.25s ease-in|

Vue 进入/退出配置：

```vue
<Transition name="progress-fade">

            <button
              v-if="showProgress"
              class="aurora-scroll-progress"
              :class="{ 'is-clicked': progressClicked }"
              type="button"
              aria-label="返回顶部"
              @click="onProgressClick"
            >
```

```vue
<Transition name="hero-fade">

            <div
              :key="currentHeroImage"
              class="aurora-hero__bg"
              :style="{
                ...heroParallaxStyle,
                backgroundImage: `url(${currentHeroImage})`,
              }"
            />
          </Transition>
```

JS 调度/观察器位置：[146](../../src/frontend/web-blog/themes/aurora/app/components/RootLayout.vue#L146) `let imageTimer: ReturnType<typeof setInterval> | null = null`；[148](../../src/frontend/web-blog/themes/aurora/app/components/RootLayout.vue#L148) `imageTimer = setInterval(() => {`；[161](../../src/frontend/web-blog/themes/aurora/app/components/RootLayout.vue#L161) `viewport.scrollTo({`。

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes aurora-progress-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-3px);
  }
  60% {
    transform: translateY(1px);
  }
}
```

### F128 themes/dock/app/components/RootLayout.vue

Dock 浮岛布局主题：底部浮岛式导航 + 居中单栏内容

实现：[源码](../../src/frontend/web-blog/themes/dock/app/components/RootLayout.vue#L136)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.dock-bar`|常规样式；状态选择器触发|position: fixed; bottom: var(--dock-bottom-offset); left: 50%; transform: translateX(-50%); z-index: 50; background: var(--dock-bg); backdrop-filter: blur(var(--dock-blur)); border-radius: var(--dock-radius); border: var(--dock-border); box-shadow: var(--dock-shadow); padding: 0.5rem 0.75rem; transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease|
|`.dock-item`|常规样式；状态选择器触发|display: flex; flex-shrink: 0; flex-direction: column; align-items: center; gap: 0.125rem; padding: 0.375rem 0.625rem; border-radius: 0.75rem; color: var(--text-soft); cursor: pointer; transform: scale(var(--dock-scale, 1)) translateY(calc((var(--dock-scale, 1) - 1) * -8px)); transform-origin: bottom center; transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s ease, background 0.2s ease|

### F129 themes/nexus/app/components/DailyQuoteCard.vue

Nexus 左侧栏每日一言卡片，随机展示名言并支持刷新

实现：[源码](../../src/frontend/web-blog/themes/nexus/app/components/DailyQuoteCard.vue#L85)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.daily-quote-card__refresh`|常规样式；状态选择器触发|position: absolute; bottom: 0.75rem; right: 0.75rem; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; border: none; background: transparent; color: var(--text-faint); cursor: pointer; transition: all 0.2s ease|
|`.daily-quote-card__refresh-icon`|常规样式；状态选择器触发|transition: transform 0.4s ease|

### F130 themes/nexus/app/components/OwnerProfileCard.vue

Nexus 左侧栏博主名片卡，展示头像、名称、在线状态、简介和社交链接

实现：[源码](../../src/frontend/web-blog/themes/nexus/app/components/OwnerProfileCard.vue#L92)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.owner-profile-card__avatar`|常规样式；状态选择器触发|width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2.5px solid var(--border); transition: border-color 0.3s, transform 0.3s|
|`.owner-profile-card__presence-dot`|常规样式；状态选择器触发|position: absolute; bottom: 2px; right: 2px; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid var(--surface-1); transition: background-color 0.3s|
|`.owner-profile-card__presence-dot.--online`|常规样式；状态选择器触发|background: var(--presence-online); box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15); animation: owner-presence-pulse 2s infinite|
|`.owner-profile-card__presence-dot.--online`|@media (prefers-reduced-motion: reduce)|animation: none|
|`.owner-profile-card__social-link`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: var(--surface-2); color: var(--text-muted); transition: all 0.2s ease|

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes owner-presence-pulse {
  0%, 100% {
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
  }
  50% {
    box-shadow: 0 0 0 6px transparent;
  }
}
```

### F131 themes/nexus/app/components/RootLayout.vue

Nexus 三栏布局主题：左侧信息栏 + 中间主内容 + 右侧侧边栏，底部导航栏

实现：[源码](../../src/frontend/web-blog/themes/nexus/app/components/RootLayout.vue#L20)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.aside-right__skeleton-line`|常规样式；状态选择器触发|height: 0.625rem; width: 100%; border-radius: 0.5rem; background: linear-gradient(90deg, var(--surface-2) 0%, var(--surface-3) 50%, var(--surface-2) 100%); background-size: 200% 100%; animation: aside-skeleton-shimmer 1.6s ease-in-out infinite|
|`.aside-right__skeleton-line`|@media (prefers-reduced-motion: reduce)|animation: none|
|`.aside-right__skeleton-tag`|常规样式；状态选择器触发|display: inline-block; width: 3.5rem; height: 1.25rem; border-radius: 9999px; background: linear-gradient(90deg, var(--surface-2) 0%, var(--surface-3) 50%, var(--surface-2) 100%); background-size: 200% 100%; animation: aside-skeleton-shimmer 1.6s ease-in-out infinite|
|`.aside-right__skeleton-tag`|@media (prefers-reduced-motion: reduce)|animation: none|
|`.aside-right__skeleton-line,   .aside-right__skeleton-tag`|@media (prefers-reduced-motion: reduce)|animation: none|
|`.sidebar-slide-left-enter-active`|常规样式；状态选择器触发|transition: all 0.25s ease-out|
|`.sidebar-slide-left-leave-active`|常规样式；状态选择器触发|transition: all 0.2s ease-in|

Vue 进入/退出配置：

```vue
<Transition name="sidebar-slide-left" mode="out-in">

            <!-- 默认模式：博主名片、公告、统计 -->
            <div v-if="!isMomentsMode" key="default" class="aside-left__group">
              <OwnerProfileCard />
              <SidebarSiteStatsCard v-if="siteStats" :stats="siteStats" />
              <p v-else-if="statsError" role="status
```

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes aside-skeleton-shimmer {
  0%, 100% {
    background-position: 200% 0;
  }
  50% {
    background-position: -200% 0;
  }
}
```

### F132 themes/nexus/app/components/SidebarFooterCard.vue

Nexus 左侧栏站点信息卡片，展示版权、链接、技术栈和运行状态

实现：[源码](../../src/frontend/web-blog/themes/nexus/app/components/SidebarFooterCard.vue#L78)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.sidebar-footer-card__link`|常规样式；状态选择器触发|font-size: 0.6875rem; color: var(--text-muted); transition: color 0.2s|
|`.sidebar-footer-card__powered-link`|常规样式；状态选择器触发|font-weight: 600; color: var(--text-main); transition: opacity 0.2s|
|`.sidebar-footer-card__dot`|常规样式；状态选择器触发|flex-shrink: 0; width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--stat-green-dot); box-shadow: 0 0 0 2px var(--stat-green-bg); animation: sidebar-pulse-dot 2s infinite|
|`.sidebar-footer-card__dot`|@media (prefers-reduced-motion: reduce)|animation: none|

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes sidebar-pulse-dot {
  0%, 100% {
    box-shadow: 0 0 0 2px var(--stat-green-bg);
  }
  50% {
    box-shadow: 0 0 0 5px transparent;
  }
}
```

### F133 themes/nexus/app/components/SiteAnnouncementCard.vue

Nexus 左侧栏站点公告卡片，展示最近公告列表

实现：[源码](../../src/frontend/web-blog/themes/nexus/app/components/SiteAnnouncementCard.vue#L70)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.announcement-card__dot`|常规样式；状态选择器触发|flex-shrink: 0; width: 6px; height: 6px; border-radius: 50%; background: var(--text-faint); margin-top: 0.4375rem; transition: background-color 0.2s|

### F134 themes/nexus/app/components/StatusFooter.vue

Nexus 底部导航栏：头像半悬浮 + hover 展开博主卡片 + 导航 + 滚动进度 + 登录

实现：[源码](../../src/frontend/web-blog/themes/nexus/app/components/StatusFooter.vue#L76)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.nexus-bar`|常规样式；状态选择器触发|--bar-pivot-left: calc(280px + 1.5rem); --bar-avatar-pad: 7.75rem; --bar-divider-gap: 1.5rem; --bar-action-size: 2.25rem; --bar-flex-gap: 1.5rem; position: relative; display: flex; align-items: center; gap: var(--bar-flex-gap); height: 72px; padding: 0 1.25rem; padding-left: var(--bar-avatar-pad); background: var(--surface-1-alpha-90); backdrop-filter: blur(18px); border: 1px solid var(--border); border-radius: 1.5rem; box-shadow: 0 -1px 0 0 var(--border-soft) inset, 0 4px 24px rgba(0, 0, 0, 0.06); overflow: visible; transition: height 0.18s cubic-bezier(0.4, 0, 0.6, 1), transform 0.18s cubic-bezier(0.4, 0, 0.6, 1), background 0.25s ease, box-shadow 0.25s ease|
|`.nexus-bar.is-expanded`|常规样式；状态选择器触发|height: 112px; transform: translateY(-40px); z-index: 20; transition: height 0.3s cubic-bezier(0.22, 0.68, 0.35, 1), transform 0.3s cubic-bezier(0.22, 0.68, 0.35, 1), background 0.3s ease, box-shadow 0.3s ease|
|`.nexus-bar__avatar-wrap`|常规样式；状态选择器触发|position: absolute; left: 1.25rem; bottom: 16px; width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--surface-1); box-shadow: 0 2px 16px rgba(0, 0, 0, 0.12), 0 0 0 0 var(--accent-alpha-0); z-index: 22; cursor: pointer; transition: transform 0.3s cubic-bezier(0.22, 0.68, 0.35, 1), box-shadow 0.3s ease, border-color 0.3s ease|
|`.nexus-bar__avatar-wrap:hover`|常规样式；状态选择器触发|border-color: var(--accent); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 3px var(--accent-alpha-20, rgba(99, 102, 241, 0.15)); transform: scale(1.05); transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, border-color 0.3s ease|
|`.nexus-bar__avatar-img`|常规样式；状态选择器触发|width: 100%; height: 100%; object-fit: cover; border-radius: 50%; transition: filter 0.3s ease|
|`.nexus-bar__avatar-wrap::after`|常规样式；状态选择器触发|content: ""; position: absolute; inset: -4px; border-radius: 50%; opacity: 0; pointer-events: none; transition: opacity 0.6s ease|
|`.nexus-bar:not(.is-expanded) .nexus-bar__avatar-wrap::after`|常规样式；状态选择器触发|opacity: 1; animation: nexus-avatar-glow 3s ease-in-out infinite|
|`.nexus-bar:not(.is-expanded) .nexus-bar__avatar-wrap::after`|@media (prefers-reduced-motion: reduce)|animation: none|
|`.nexus-bar__presence-badge`|常规样式；状态选择器触发|position: absolute; right: -8px; bottom: -2px; display: flex; align-items: center; gap: 3px; padding: 1px 6px 1px 4px; border-radius: 9999px; background: var(--surface-1); border: 1.5px solid var(--border-soft); font-size: 0.5625rem; font-weight: 600; color: var(--text-soft); white-space: nowrap; z-index: 2; pointer-events: none; transition: opacity 0.2s ease, transform 0.2s ease|
|`.nexus-bar__row-nav`|常规样式；状态选择器触发|position: absolute; inset: 0; display: flex; align-items: center; gap: var(--bar-divider-gap); transition: opacity 0.12s ease|
|`.nexus-bar__row-owner`|常规样式；状态选择器触发|position: absolute; inset: 0; display: flex; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.15s ease 0.04s|
|`.nexus-bar__link`|常规样式；状态选择器触发|position: relative; display: flex; align-items: center; gap: 0.375rem; padding: 0.4rem 0.75rem; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 500; color: var(--text-soft); white-space: nowrap; transition: color 0.2s ease, background 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)|
|`.nexus-bar__progress`|常规样式；状态选择器触发|position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; margin-left: auto; width: 2.25rem; height: 2.25rem; border-radius: 50%; border: none; background: var(--surface-2); cursor: pointer; transition: background 0.2s ease, transform 0.15s ease|
|`.nexus-bar__progress:hover .nexus-bar__progress-icon`|常规样式；状态选择器触发|opacity: 1; transform: translateY(0); animation: nexus-bar-bounce 0.6s ease infinite|
|`.nexus-bar__progress:hover .nexus-bar__progress-icon`|@media (prefers-reduced-motion: reduce)|animation: none|
|`.nexus-bar__progress-ring-fill`|常规样式；状态选择器触发|fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round; stroke-dasharray: 100.53; transition: stroke-dashoffset 0.3s cubic-bezier(0.22, 0.68, 0.35, 1)|
|`.nexus-bar__progress-text`|常规样式；状态选择器触发|font-size: 0.625rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-soft); transition: opacity 0.2s ease, transform 0.2s ease|
|`.nexus-bar__progress-icon`|常规样式；状态选择器触发|position: absolute; opacity: 0; color: var(--accent-text); transform: translateY(3px); transition: opacity 0.2s ease, transform 0.2s ease|
|`.nexus-progress-fade-enter-active`|常规样式；状态选择器触发|transition: opacity 0.25s ease-out, transform 0.25s ease-out|
|`.nexus-progress-fade-leave-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease-in, transform 0.2s ease-in|
|`.nexus-bar__owner-card > *`|常规样式；状态选择器触发|opacity: 0; transform: translateX(-8px); transition: opacity 0.18s ease, transform 0.18s ease|
|`.nexus-bar.is-expanded .nexus-bar__owner-card > :nth-child(1)`|常规样式；状态选择器触发|opacity: 1; transform: translateX(0); transition-delay: 0.06s|
|`.nexus-bar.is-expanded .nexus-bar__owner-card > :nth-child(2)`|常规样式；状态选择器触发|opacity: 1; transform: translateX(0); transition-delay: 0.1s|
|`.nexus-bar.is-expanded .nexus-bar__owner-card > :nth-child(3)`|常规样式；状态选择器触发|opacity: 1; transform: translateX(0); transition-delay: 0.14s|
|`.nexus-bar__quote-refresh`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; flex-shrink: 0; border-radius: 9999px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; opacity: 0; transition: opacity 0.2s ease, color 0.2s ease, transform 0.3s ease|
|`.nexus-quote-swap-enter-active, .nexus-quote-swap-leave-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease, transform 0.2s ease|
|`.nexus-bar__social-link`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.25rem; font-size: 0.6875rem; color: var(--text-soft); transition: color 0.2s ease|
|`.nexus-bar__login`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: var(--bar-action-size); height: var(--bar-action-size); flex-shrink: 0; border: none; border-radius: 0.5rem; color: var(--text-soft); background: transparent; cursor: pointer; transition: color 0.2s ease, background 0.2s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)|
|`.nexus-bar__user-menu-item`|常规样式；状态选择器触发|display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.5rem 0.625rem; border: none; background: transparent; color: var(--text-main); font-size: 0.8125rem; text-align: left; border-radius: 0.5rem; cursor: pointer; transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease|
|`.nexus-user-menu-enter-active`|常规样式；状态选择器触发|transition: opacity 0.18s ease-out, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)|
|`.nexus-user-menu-leave-active`|常规样式；状态选择器触发|transition: opacity 0.14s ease-in, transform 0.14s ease-in|
|`.nexus-login-panel-enter-active`|常规样式；状态选择器触发|transition: opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)|
|`.nexus-login-panel-leave-active`|常规样式；状态选择器触发|transition: opacity 0.15s ease-in, transform 0.15s ease-in|

Vue 进入/退出配置：

```vue
<Transition name="nexus-progress-fade">

          <button
            v-if="showProgress"
            class="nexus-bar__progress"
            type="button"
            :aria-label="scrollDirection === 'down' ? '返回底部' : '返回顶部'"
            @click="onProgressClick"
          >
            <svg class="nexus-bar__progress
```

```vue
<Transition name="nexus-quote-swap" mode="out-in">

                  <span :key="dailyQuote">「{{ dailyQuote }}」</span>
                </Transition>
              </p>
              <button class="nexus-bar__quote-refresh" type="button" aria-label="换一条" @click="refreshQuote">
                <Icon name="lucide:refresh-cw" size="
```

```vue
<Transition name="nexus-login-panel">

      <div v-if="isLoginOpen && !preferModal" ref="loginPanelRef" class="nexus-bar__login-panel">
        <AuthPanel />
      </div>
    </Transition>

    <!-- 用户菜单 popover（底部栏上方悬浮，已登录时可展开） -->
    <Transition name="nexus-user-menu">
      <div v-if="isUserMenuOpen && isLoggedI
```

```vue
<Transition name="nexus-user-menu">

      <div v-if="isUserMenuOpen && isLoggedIn" ref="userMenuRef" class="nexus-bar__user-menu" role="menu">
        <div class="nexus-bar__user-menu-header">
          <div class="nexus-bar__user-menu-name">{{ currentUser?.nickname }}</div>
          <div class="nexus-bar__user-m
```

JS 调度/观察器位置：[312](../../src/frontend/web-blog/themes/nexus/app/components/StatusFooter.vue#L312) `let expandTimer: ReturnType<typeof setTimeout> | null = null`；[313](../../src/frontend/web-blog/themes/nexus/app/components/StatusFooter.vue#L313) `let collapseTimer: ReturnType<typeof setTimeout> | null = null`；[323](../../src/frontend/web-blog/themes/nexus/app/components/StatusFooter.vue#L323) `expandTimer = setTimeout(() => {`；[344](../../src/frontend/web-blog/themes/nexus/app/components/StatusFooter.vue#L344) `collapseTimer = setTimeout(() => {`；[460](../../src/frontend/web-blog/themes/nexus/app/components/StatusFooter.vue#L460) `// 必须用 setTimeout（macrotask），不能用 nextTick（microtask）——`；[462](../../src/frontend/web-blog/themes/nexus/app/components/StatusFooter.vue#L462) `// 导致 onClickOutside 在同一次点击中被触发。setTimeout 保证在下一轮事件循环才注册。`；[463](../../src/frontend/web-blog/themes/nexus/app/components/StatusFooter.vue#L463) `setTimeout(() => attachOutsideHandler(), 0)`。

关键帧（位移、缩放、透明度及其他实际变化）：

```css
@keyframes nexus-avatar-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 var(--avatar-glow-color, transparent);
  }
  50% {
    box-shadow: 0 0 12px 2px var(--avatar-glow-color, transparent);
  }
}
@keyframes nexus-bar-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-3px);
  }
  60% {
    transform: translateY(1px);
  }
}
```

### F135 themes/nexus/app/components/ThemeAccessory.vue

Nexus 三栏主题的额外浮动入口，保留移动端界面设置按钮

实现：[源码](../../src/frontend/web-blog/themes/nexus/app/components/ThemeAccessory.vue#L33)。

|作用元素/状态选择器|媒体/条件|持续时间、延迟、缓动及相关声明|
|---|---|---|
|`.nexus-mobile-fab`|常规样式；状态选择器触发|position: fixed; top: calc(1rem + env(safe-area-inset-top)); right: 1rem; z-index: 60; border-radius: 9999px; border: 1px solid var(--border); box-shadow: var(--shadow-card); background: var(--surface-1-alpha); backdrop-filter: blur(12px); height: 2.75rem; display: flex; align-items: center; justify-content: center; padding: 0 0.5rem; overflow: visible; transition: border-color 0.15s ease, box-shadow 0.15s ease|
|`.nexus-fab-item`|常规样式；状态选择器触发|display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; color: var(--text-soft); transition: color all var(--motion-fast, 0.2s) ease|

