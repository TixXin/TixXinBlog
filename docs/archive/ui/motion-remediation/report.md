# TixXinBlog 动效整改

> 历史归档：原文来自 `docs/motion-remediation/report.md`，保留当时的设计、实施与验收事实。文中的阶段、版本、数量和“当前／下一步”不代表现状；现行入口见[文档导航](../../../README.md)。本机验收产物仍按原仓库相对路径留存。

> 本文截图、录屏、原始日志、采样和临时实验脚本仅在本机留存，不随 Git 发布。下列本地产物路径以仓库根目录为起点，新检出不包含这些文件；验收结论与正式测试源码继续保留。见[验收产物管理](../../../verification-artifacts.md)。

T01–T10已完成正式实现；本文保留性能及真实设备验证限制。整改前338个审查指纹与保存快照全部一致，测试版本及最终提交的对应关系见格式与源码核验（本地：`docs/motion-remediation/evidence/post-commit-source.json`），当前证据见源码指纹（本地：`docs/motion-remediation/evidence/source-proof.json`）。保留了原工作区修改、三种主题、原数据源边界和业务接口；写入测试使用随机隔离库。

完整生产回归113/113通过。三浏览器、响应式、故障与热更新结果见[覆盖记录](coverage.md)。Lint、类型和最新构建通过；81项单测通过。测试工具问题与产品问题分列，不能把较早的失败或旧截图充当最终通过证据。

## M01–M16处理记录

| 编号 | 级别 | 状态                     | 实施与验证                                                                                                                                                                                                                                                                                                                        |
| ---- | ---- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M01  | P0   | 已实施并验证             | 页面实例与视觉过渡分离；NuxtPage不使用内置Transition包装，正常模式由受控WAAPI保留进入/离场。快速导航取消旧任务，布局状态独立更新。慢文章读取随页面销毁取消，旧初始化不会再抛出全局503覆盖新页面；真实请求错误继续反馈。 三主题×三模式×三间隔导航；慢请求进入全宽页、迟到响应和历史导航；真实503保留；实际正常动画视频与清理记录。 |
| M02  | P1   | 已实施并验证             | 侧栏克隆、隐藏与还原归属同一可取消任务，完成、取消、失败、卸载及400ms兜底均幂等清理。 后置守卫取消；原侧栏可见，无clone残留。                                                                                                                                                                                                     |
| M03  | P1   | 已实施并验证             | IME确认不提交；Enter阻止默认激活。取消归还入口，成功导航等待新内容和视觉过渡完成后聚焦正文。根组件显式共享搜索控制器，应用级指针入口记录兼容点击按钮不自动聚焦的WebKit。 键鼠导航不重开、H1获焦、Esc归还入口、IME及字体延迟期间快捷键；三浏览器灯箱/搜索焦点。                                                                    |
| M04  | P1   | 已实施并验证             | 应用插件拥有唯一减少动态效果订阅，useTheme事件复用setup阶段偏好状态；应用结束和HMR释放。 预热后颜色100次、弹层30次：媒体查询新增0、移除0，无净增长；背景锁释放。                                                                                                                                                                  |
| M05  | P1   | 已实施并验证             | 统一只读偏好接入CSS、WAAPI、列表、数字、Sortable、轮播、视差和滚动；运行中切换直接呈现终态，保留信息反馈。 三主题减少模式矩阵、运行中切换保持页面实例、真实拖拽与减少模式、10.5秒静态Hero。                                                                                                                                       |
| M06  | P2   | 已实施；真实后台验证受限 | Hero默认静态，手动播放/暂停；8秒轮换，预加载成功才换图。减少模式、离屏、非主页、文档隐藏与卸载停止任务。 减少模式/手动暂停、离屏10.5秒和离开主页8.5秒通过；本机窗口切换/最小化未产生hidden，不冒充真实后台通过。                                                                                                                  |
| M07  | P2   | 已实施并验证             | 无动画及无VT接口统一即时颜色事务；收窄all过渡，消除滚动条颜色的意外插值，完成后恢复普通hover反馈。 7页面×有无VT接口：颜色插值记录为空；两方向、系统配色实时变化和普通操作恢复。                                                                                                                                                   |
| M08  | P1   | 已实施并验证             | 构建期生成主题宿主元数据，只预载当前主题。客户端共享缓存、SSR按请求隔离，避免热更新后继续输出旧模板。可选主题失败保留当前布局；关键主题失败保留只读SSR内容，入口失败由独立内联守卫显示刷新入口。 非当前主题、当前主题和主入口分别有效拦截，保留内容并刷新恢复；共享子组件热更新后刷新SSR仍一致。                                  |
| M09  | P2   | 已实施并验证             | SSR与hydration先输出一致的侧栏类；ready后应用实际偏好，首帧由CSS减少模式保护。 三主题/配色/偏好矩阵及开发热更新未出现相关水合警告。                                                                                                                                                                                               |
| M10  | P2   | 已实施并验证             | 统一解析真正的阅读滚动容器；j/k/t、目录、进度和回顶复用策略。用户滚轮/触摸/按键可中断程序平滑滚动，减少模式即时完成。Dock增加回顶入口。 三主题390/1440长文目录、历史恢复及快捷键；三主题真实滚轮中断、运行中reduce与Dock回顶。真机惯性和系统键盘另列限制。                                                                        |
| M11  | P2   | 已实施并验证             | 图片保留真实比例或稳定占位；加载/解码/错误/空图/重试有状态。挂载时补查SSR期间已失败的图片；已可见缓存图不重复隐藏。 有效破图注入、重试前后盒高差小于1px、三类灯箱及字体/图像加载场景。整改中新发现的挂载前失败已修复。                                                                                                            |
| M12  | P2   | 已实施并验证             | 动画、定时器、rAF、观察器和监听按所有者清理，结束/取消/卸载只调用一次done；拖拽等第三方在nextTick后持久化真实顺序。详情、关联和评论初始读取接入取消信号，评论提交与草稿仍由共享控制器持有。 旧实现中断用例失败、新实现通过；81项单测含离屏不创建任务；读取取消在1.5秒内可观测；运行中reduce、快速开关、HMR及嵌套层回归。          |
| M13  | P2   | 已实施并验证             | Tooltip可Esc关闭且不立即重开，触发器与浮层共同悬停保持；建立aria-describedby，滚动/尺寸变化重新定位，关闭释放监听。长提示按视口换行，页脚状态可键盘聚焦，Dock为页脚预留导航空间。 短提示与320/1440长提示的键盘焦点、Esc、悬停保持、文本宽度和视口边界；三浏览器验证。                                                             |
| M14  | P2   | 已改善；保留性能限制     | 根据轨迹移除设置遮罩的全屏背景模糊，收窄过渡属性、合并滚动测量，阅读进度用scaleX。正常进入/离场继续保留。 固定负载前后各6份轨迹，p95显著改善；4倍CPU仍有长帧，Paint总耗时和部分Layout样本增加，未宣称所有指标下降。                                                                                                               |
| M15  | P2   | 已实施并验证             | 颜色切换拥有事务标识和当前动画句柄；新请求取消旧任务，只有当前任务能清理根属性，失败降级到目标颜色。 旧任务完成不能删除新任务属性的单测先红后绿；快速键盘切换、两方向及无API回归。                                                                                                                                                |
| M16  | P3   | 已实施并验证             | 公共反馈token收窄到必要属性，列表只动画可见新增项，25ms交错并封顶150ms；去除首屏800ms和主题等人为最短等待。设置面板位移修正为8px，首屏就绪后的淡出层不再拦截点击，移除过时的0.3秒提示。 编译/Lint/实际正常动画记录；列表分页、连续加载、失败重试、离屏单测及首屏淡出不阻挡用例。                                                  |

## 关键实现位置

- M01：[app/layouts/default.vue](../../../../src/frontend/web-blog/app/layouts/default.vue)、[app/composables/usePageMotion.ts](../../../../src/frontend/web-blog/app/composables/usePageMotion.ts)、[app/composables/usePageRequestScope.ts](../../../../src/frontend/web-blog/app/composables/usePageRequestScope.ts)、[app/composables/useArticleDetail.ts](../../../../src/frontend/web-blog/app/composables/useArticleDetail.ts)、[app/utils/pageRequestCancellation.ts](../../../../src/frontend/web-blog/app/utils/pageRequestCancellation.ts)
- M02：[app/composables/useSidebarExitAnimation.ts](../../../../src/frontend/web-blog/app/composables/useSidebarExitAnimation.ts)
- M03：[app/components/common/SearchModal.vue](../../../../src/frontend/web-blog/app/components/common/SearchModal.vue)、[app/composables/useModalFocus.ts](../../../../src/frontend/web-blog/app/composables/useModalFocus.ts)、[app/utils/modalFocusOrigin.ts](../../../../src/frontend/web-blog/app/utils/modalFocusOrigin.ts)、[app/plugins/modal-focus-origin.client.ts](../../../../src/frontend/web-blog/app/plugins/modal-focus-origin.client.ts)、[app/composables/useKeyboardShortcuts.ts](../../../../src/frontend/web-blog/app/composables/useKeyboardShortcuts.ts)、[app/app.vue](../../../../src/frontend/web-blog/app/app.vue)
- M04：[app/plugins/00.motion-preference.client.ts](../../../../src/frontend/web-blog/app/plugins/00.motion-preference.client.ts)、[app/composables/useMotionPreference.ts](../../../../src/frontend/web-blog/app/composables/useMotionPreference.ts)、[app/composables/useTheme.ts](../../../../src/frontend/web-blog/app/composables/useTheme.ts)
- M05：[app/composables/useEntranceMotion.ts](../../../../src/frontend/web-blog/app/composables/useEntranceMotion.ts)、[app/components/tab/TabBookmarkGrid.vue](../../../../src/frontend/web-blog/app/components/tab/TabBookmarkGrid.vue)、[app/components/guestbook/ChatStats.vue](../../../../src/frontend/web-blog/app/components/guestbook/ChatStats.vue)、[app/assets/styles/_base.scss](../../../../src/frontend/web-blog/app/assets/styles/_base.scss)
- M06：[themes/aurora/app/components/RootLayout.vue](../../../../src/frontend/web-blog/themes/aurora/app/components/RootLayout.vue)
- M07：[app/utils/colorMotion.ts](../../../../src/frontend/web-blog/app/utils/colorMotion.ts)、[app/assets/styles/_base.scss](../../../../src/frontend/web-blog/app/assets/styles/_base.scss)、[app/assets/styles/_tokens.scss](../../../../src/frontend/web-blog/app/assets/styles/_tokens.scss)
- M08：[nuxt.config.ts](../../../../src/frontend/web-blog/nuxt.config.ts)、[app/plugins/00.theme-preload.ts](../../../../src/frontend/web-blog/app/plugins/00.theme-preload.ts)、[app/utils/themeRuntime.ts](../../../../src/frontend/web-blog/app/utils/themeRuntime.ts)、[app/utils/themeComponentCache.ts](../../../../src/frontend/web-blog/app/utils/themeComponentCache.ts)、[app/components/ThemeComponent.vue](../../../../src/frontend/web-blog/app/components/ThemeComponent.vue)、[app/components/common/ThemeLoadError.vue](../../../../src/frontend/web-blog/app/components/common/ThemeLoadError.vue)、[public/startup-guard.js](../../../../src/frontend/web-blog/public/startup-guard.js)
- M09：[app/composables/useAppearanceSettings.ts](../../../../src/frontend/web-blog/app/composables/useAppearanceSettings.ts)、[app/plugins/00.motion-preference.client.ts](../../../../src/frontend/web-blog/app/plugins/00.motion-preference.client.ts)
- M10：[app/utils/scrollRoot.ts](../../../../src/frontend/web-blog/app/utils/scrollRoot.ts)、[app/composables/useKeyboardShortcuts.ts](../../../../src/frontend/web-blog/app/composables/useKeyboardShortcuts.ts)、[app/components/common/CustomScrollbar.vue](../../../../src/frontend/web-blog/app/components/common/CustomScrollbar.vue)、[themes/dock/app/components/RootLayout.vue](../../../../src/frontend/web-blog/themes/dock/app/components/RootLayout.vue)
- M11：[app/composables/useImageState.ts](../../../../src/frontend/web-blog/app/composables/useImageState.ts)、[app/components/common/ImageFrame.vue](../../../../src/frontend/web-blog/app/components/common/ImageFrame.vue)、[app/plugins/image-motion.client.ts](../../../../src/frontend/web-blog/app/plugins/image-motion.client.ts)、[app/components/gallery/GalleryItem.vue](../../../../src/frontend/web-blog/app/components/gallery/GalleryItem.vue)
- M12：[app/utils/elementMotion.ts](../../../../src/frontend/web-blog/app/utils/elementMotion.ts)、[app/composables/useEntranceMotion.ts](../../../../src/frontend/web-blog/app/composables/useEntranceMotion.ts)、[app/composables/usePostListAnimation.ts](../../../../src/frontend/web-blog/app/composables/usePostListAnimation.ts)、[app/composables/useModalFocus.ts](../../../../src/frontend/web-blog/app/composables/useModalFocus.ts)、[app/composables/usePageRequestScope.ts](../../../../src/frontend/web-blog/app/composables/usePageRequestScope.ts)、[app/composables/useArticleComments.ts](../../../../src/frontend/web-blog/app/composables/useArticleComments.ts)、[app/features/post/api.ts](../../../../src/frontend/web-blog/app/features/post/api.ts)
- M13：[app/components/common/Tooltip.vue](../../../../src/frontend/web-blog/app/components/common/Tooltip.vue)、[app/components/layout/StatusFooter.vue](../../../../src/frontend/web-blog/app/components/layout/StatusFooter.vue)、[themes/dock/app/components/RootLayout.vue](../../../../src/frontend/web-blog/themes/dock/app/components/RootLayout.vue)
- M14：[app/components/common/AppearanceDrawer.vue](../../../../src/frontend/web-blog/app/components/common/AppearanceDrawer.vue)、[app/components/common/CustomScrollbar.vue](../../../../src/frontend/web-blog/app/components/common/CustomScrollbar.vue)、[app/components/common/ReadingProgress.vue](../../../../src/frontend/web-blog/app/components/common/ReadingProgress.vue)、[app/assets/styles/_tokens.scss](../../../../src/frontend/web-blog/app/assets/styles/_tokens.scss)
- M15：[app/utils/colorMotion.ts](../../../../src/frontend/web-blog/app/utils/colorMotion.ts)、[app/composables/useTheme.ts](../../../../src/frontend/web-blog/app/composables/useTheme.ts)
- M16：[app/assets/styles/_tokens.scss](../../../../src/frontend/web-blog/app/assets/styles/_tokens.scss)、[app/composables/usePostListAnimation.ts](../../../../src/frontend/web-blog/app/composables/usePostListAnimation.ts)、[app/app.vue](../../../../src/frontend/web-blog/app/app.vue)、[app/components/common/AppearanceDrawer.vue](../../../../src/frontend/web-blog/app/components/common/AppearanceDrawer.vue)、[app/components/common/AppLoadingScreen.vue](../../../../src/frontend/web-blog/app/components/common/AppLoadingScreen.vue)、[app/features/appearance/types.ts](../../../../src/frontend/web-blog/app/features/appearance/types.ts)、[app/composables/useLayoutTheme.ts](../../../../src/frontend/web-blog/app/composables/useLayoutTheme.ts)

## 前后证据

此前零时长导航空白、搜索Enter重开和侧栏消失见[原审查报告](../motion-audit/report.md)。本轮三主题真实进入/离场记录见时间轴（本地：`docs/motion-remediation/evidence/normal-motion/results.json`），视频为Nexus（本地：`docs/motion-remediation/evidence/normal-motion/nexus.webm`）、Aurora（本地：`docs/motion-remediation/evidence/normal-motion/aurora.webm`）、Dock（本地：`docs/motion-remediation/evidence/normal-motion/dock.webm`）。拍摄保持动画开启。

正常导航后的正文（本地：`docs/motion-remediation/evidence/normal-motion/nexus-3.png`）

启动入口失败后保留SSR内容，刷新恢复已实际验证：

入口失败时的可读内容和恢复入口（本地：`docs/motion-remediation/evidence/faults/entry-failure.png`）

## 额外修复与验证纠正

- 图片在hydration之前已失败的事件可能被错过，改为挂载时检测complete与naturalWidth并提供重试。
- 书签排序此前仅更新sortOrder而未重排内存数组；键盘和真实拖拽现在刷新后仍保持顺序。
- AI搜索使用请求版本与取消句柄，旧会话结果不覆盖新会话。
- 上下文菜单打开编辑框前归还稳定入口，快速关闭不会将焦点留给退场菜单。
- Aurora紧凑顶栏的flex-end溢出导致前几个链接不可点击，改为可从起始位置横向滚动，空间足够时仍靠右。
- 两项连续加载测试原来写死106篇，前序发布会令隔离库增至110篇；现在逐项比较真实接口全集、顺序和唯一性。
- Windows WebKit的字体请求及单个FontFace均已完成，聚合fonts.ready仍可能不兑现。截图辅助代码验证实际请求和FontFace状态后采集原生图像，保持animations:allow；没有修改应用字体或动画。
- Firefox单次大滚轮输入可能限制到一屏；测试改为连续真实输入达到相同位置，并等待用户滚轮的原生惯性停止后再验证程序回顶被中断。
- 整改期间发现过错误scoped全局选择器令html整体透明；已修正并加入根opacity断言，实际首页、图库与多端截图检查通过。

## 慢请求取消与热更新补充

慢文章请求尚未完成时进入书签页，曾出现URL为/tabs而正文为503的错误。现将详情、关联、前后篇和评论初始读取归属当前页面，销毁后中断请求；共享评论提交继续保留。仅消费显式预期取消，当前页面真实503继续显示。三主题×三模式及关联读取取消回归通过，补测6种慢导航和前进后退也通过。

整改前迟到错误覆盖书签页（本地：`docs/motion-remediation/evidence/slow-navigation/nexus-no-preference-failed.png`）

整改后保留最后请求的书签页（本地：`docs/motion-remediation/evidence/slow-navigation/nexus-no-preference.png`）

SSR主题组件缓存改为按请求隔离，消除热更新后新请求继续输出旧模板的问题；共享页脚改动、刷新和恢复均已验证。详细记录见8类热更新（本地：`docs/motion-remediation/evidence/hmr/results.json`）。

## 验证限制

后台窗口切换和最小化实验未令本机浏览器报告hidden，不能将源码监听策略冒充真实后台暂停通过。Hero离屏、非主页、暂停及reduce已验证。真实手机惯性/系统软键盘、实体Safari与辅助技术朗读尚无对应设备证据。WebKit引擎验证不等同于实体Safari验收。

性能改善与保留问题见[性能报告](performance.md)；统一规则见[动效规范](motion-spec.md)。
