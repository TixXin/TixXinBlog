# 覆盖与证据边界

> 历史归档：原文来自 `docs/motion-audit/coverage.md`，保留当时的设计、实施与验收事实。文中的阶段、版本、数量和“当前／下一步”不代表现状；现行入口见[文档导航](../../../README.md)。本机验收产物仍按原仓库相对路径留存。

> 本文截图、录屏、原始日志、采样和临时实验脚本仅在本机留存，不随 Git 发布。下列本地产物路径以仓库根目录为起点，新检出不包含这些文件；验收结论与正式测试源码继续保留。见[验收产物管理](../../../verification-artifacts.md)。

审查范围：用户提供的16部分目标，输出审查和整改方案。所有产品源码基于当前工作区快照；临时实验位于D:/Projects/TixXinBlog/.codex/motion-audit/。产品修改不在本轮交付内。

## 运行清单

共108个具名采样场景（含故障注入、对照、脚本修正前记录）。**observed仅表示采集执行完成，不表示没有产品缺陷**。判断依据是正文/URL、状态、事件、截图及对应findings；不能把日志的OBSERVED当作全绿测试。

| 套件                                                                               | 场景数 | 中断数 | 内容                               |
| ---------------------------------------------------------------------------------- | -----: | -----: | ---------------------------------- |
| ab（本地：`docs/motion-audit/evidence/ab/results.json`）                           |      6 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| advanced（本地：`docs/motion-audit/evidence/advanced/results.json`）               |      3 |      1 | 详见逐场景步骤、最终状态和原始采样 |
| components（本地：`docs/motion-audit/evidence/components/results.json`）           |      4 |      1 | 详见逐场景步骤、最终状态和原始采样 |
| development（本地：`docs/motion-audit/evidence/development/results.json`）         |      6 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| edge（本地：`docs/motion-audit/evidence/edge/results.json`）                       |      6 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| failure（本地：`docs/motion-audit/evidence/failure/results.json`）                 |      1 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| interactions（本地：`docs/motion-audit/evidence/interactions/results.json`）       |      9 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| listener（本地：`docs/motion-audit/evidence/listener/results.json`）               |      1 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| matrix（本地：`docs/motion-audit/evidence/matrix/results.json`）                   |     12 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| performance（本地：`docs/motion-audit/evidence/performance/results.json`）         |      3 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| race（本地：`docs/motion-audit/evidence/race/results.json`）                       |      6 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| reading（本地：`docs/motion-audit/evidence/reading/results.json`）                 |      3 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| reading-spa（本地：`docs/motion-audit/evidence/reading-spa/results.json`）         |      3 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| responsive（本地：`docs/motion-audit/evidence/responsive/results.json`）           |     12 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| scroll-boundary（本地：`docs/motion-audit/evidence/scroll-boundary/results.json`） |      1 |      1 | 详见逐场景步骤、最终状态和原始采样 |
| scroll-final（本地：`docs/motion-audit/evidence/scroll-final/results.json`）       |      1 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| search-key（本地：`docs/motion-audit/evidence/search-key/results.json`）           |      2 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| smoke（本地：`docs/motion-audit/evidence/smoke/results.json`）                     |     13 |      0 | 详见逐场景步骤、最终状态和原始采样 |
| supplement（本地：`docs/motion-audit/evidence/supplement/results.json`）           |      5 |      1 | 详见逐场景步骤、最终状态和原始采样 |
| themes（本地：`docs/motion-audit/evidence/themes/results.json`）                   |     11 |      0 | 详见逐场景步骤、最终状态和原始采样 |

## 页面范围

公开基础路由：首页、归档、文章详情、项目、画廊、闪念、朋友圈、书签、友链、留言、关于、后台登录。补充检查朋友圈详情/话题、闪念详情；后台检查概览、文章列表/新建/编辑、动态发布、闪念管理、评论、分类标签、媒体、站点设置、账号、审计、维护共13页。未知动态/文章的错误态代码进行了检查；本轮没有为所有404路由单独新增运行用例。

## 组合选择

基础矩阵：3布局×2偏好（normal/reduce）×2配对（1440深色、390浅色）=12组合；每组包含首页、设置和画廊灯箱的连续帧。补充矩阵：每布局追加768深色正常、1024浅色减少、1440浅色正常、390深色减少，共12组合，检查页面及设置清理。另以Nexus检查320/375/767/768/1023/1024/1439/1440/1920宽度，覆盖断点邻接值；手机高度844或900、桌面1000。

这是针对共享机制及主题差异选择的24组采样，不是每个页面、颜色、尺寸、输入和网络条件的全组合。系统配色通过emulateMedia实际改变matchMedia结果；触摸用hasTouch/isMobile与tap验证抽屉，不能替代真实手机。

## 16部分目标对应

| 部分            | 完成的检查及证据                                                                                              | 范围/限制                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1 原则          | source-hashes、分级findings、当前截图和日志                                                                   | 已复现、代码风险、体验建议明确区分                                                            |
| 2 台账          | 338源文件扫描；135文件命中719处；423编译样式规则、51个Vue过渡入口；另人工审查预加载、ThemeComponent和模态控制 | 包含非视觉定时器命中并标明；完整原始规则附录可追溯                                            |
| 3 页面/核心路径 | smoke、components、supplement、interactions、reading-spa                                                      | 后台仅使用随机测试库，未对所有业务按钮进行写入遍历                                            |
| 4 首屏/异步     | development、failure、列表慢请求/失败重试、破图、正常灯箱加载                                                 | 字体延迟单独注入、精确CLS归因未覆盖；首屏固定等待代码明确                                     |
| 5 页面过渡      | 4预设、30/120/300ms指针序列、历史前后退、取消守卫、AB对照                                                     | 普通预设未出现相同空白；无全宽转换的每一条边穷举                                              |
| 6 颜色/布局     | themes、listener、advanced；四预设、三布局、跟随系统、无API降级                                               | 冷启动资源注入未进入已启动后的主题失败回退，不能宣称该回退通过                                |
| 7 内容列表      | 分页、连续15→30、筛选、闪念发布、朋友圈点赞/评论、演示留言、书签添加/拖拽尝试                                 | 批量删除/所有排序及海量列表未遍历；JS取消风险见M12                                            |
| 8 浮层          | 设置/搜索/认证、三类灯箱、游客身份、书签导入嵌套、移动抽屉、Tooltip、Toast                                    | 本轮未逐一触发AI搜索、图标选择器和所有上下文菜单分支，静态规则及清理路径已审查                |
| 9 滚动          | 三主题长文内部/窗口滚动、站内返回1800px、目录、j键对照                                                        | reading旧套件用整页goto离开，不能用于证明SPA恢复失败；以reading-spa为准。真机惯性和软键盘未测 |
| 10 微交互       | hover/focus/active样式全量提取、键盘及拖拽尝试、动画一致性与节奏评估                                          | 书签键盘等价排序未完整验证；截图只支持当前实际状态                                            |
| 11 减少动态效果 | 真实媒体模拟、三主题、CSS/JS/第三方代码审查、运行中切换                                                       | 未宣称WCAG整体合规；闪烁阈值没有仪器/视频分析                                                 |
| 12 性能         | CPU1×/4×轨迹、rAF/长任务、30次模态与导航计数、30次颜色监听账本、LayerTree样本                                 | 真实低端GPU、后台标签暂停未实测；短样本不代表全站性能                                         |
| 13 开发专项     | 原3456开发页及隔离开发副本；CSS/SFC/RootLayout HMR、配置重启；冷启动/失败恢复；生产新构建                     | 长期多小时留页未重复模拟；保留生成目录隔离设置和日志                                          |
| 14 组合         | 24主题组合、9宽度点、正常/慢/失败请求、键盘与触摸模拟                                                         | 选择覆盖公共机制与主题差异，不声称全排列                                                      |
| 15 证据/分级    | 每项含步骤、实际/预期、根因边界、文件、验收与证据；连续帧/轨迹                                                | 无完整视频文件；连续帧实际时间记录在results，文件尾数不是精确时间轴                           |
| 16 交付         | report、inventory、coverage、findings、motion-spec、remediation-prompt与evidence                              | 本轮为审查完成，产品问题保持待整改                                                            |

## 脚本修正与证据取舍

- 初次隔离构建因审查自定义buildDir与tsconfig引用不一致失败；修正隔离副本生成路径后重新构建成功。这是测试配置问题，不列为产品缺陷。
- components认证场景首次使用“立即登录”作为完整按钮名称，实际名称包含横幅说明；由supplement的auth corrected target完成。
- supplement长文首次被多个loading-screen选择器的严格匹配中断；由reading-spa和advanced补齐。
- reading旧场景采用page.goto离开，发生的是整页导航；它不能证明站内SPA返回失败。旧场景中正文locator.click还会滚回元素顶部，不能用于快捷键结论。reading-spa使用站内链接和可见区域指针，结果有效。
- advanced返回顶部场景没有找到Dock的可见返回顶部按钮，不能把超时说成点击失效，也不能宣称已验证其滚动中断。相关规则已做源码检查，真机和该入口需后续补验。
- development/isolated-dev-entry.png捕获了客户端加载层刚出现的中间帧，不作为稳定首屏截图；后续刷新、HMR与重连画面证明恢复状态。
- gallery/images失败场景中的破图和加载帧是有意采集的故障/中间态证据；稳定灯箱结果使用后续帧。

## 数据与隔离

后端基于当前源码新构建并使用仓库createBrowserTestApp创建随机tixxin_browser库；106篇基础文章以及本轮长文/闪念样本仅存在该库。日常开发数据未用于写入测试。浏览器登录使用临时测试账号；凭据仅留在本次临时服务state文件中，清理后删除。报告不含token或密码。副本共享已安装依赖，Nuxt生成目录和Vite缓存显式指向审查副本，避免并行污染日常dev。

## 尚未验证

真实Safari/Firefox及移动WebKit；手机软键盘、惯性滚动和设备方向切换；真实后台标签页、系统锁屏恢复；辅助技术朗读；专业闪烁阈值/光敏分析；字体单独延迟；多小时留页；所有后台写入分支；已启动后主题模块故障的恢复路径。上述内容不是“通过”，整改阶段需按目标环境补验。

## 补充的结果取舍

书签测试虽然执行了HTML5拖拽指针序列，但前后排序未变化，因此没有证明有效重排成功；其150ms配置来自源码，键盘等价移动继续作为验证缺口。

Nexus回顶补测见scroll-final/results.json：起始1800px，点击返回顶部并注入滚轮后最终为0px。回顶有效，但该样本没有证明滚轮成功中断，不能记为中断通过。初次scroll-boundary聚合在再次点击已隐藏的回顶按钮时中断；补测保留了按钮隐藏这一状态。Dock未找到回顶入口的记录独立保留。

截图共336张（不含联系表），已通过22张带文件名的缩略检查表及关键原图核验；空白/骨架/破图/加载层作为指定故障或中间态证据，不冒充稳定终态。新增回顶原图单独检查。连续帧文件后缀是脚本等待增量，准确的相对时刻见对应results.json。
