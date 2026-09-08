# 内容标签与文章分页修复

用户报告的两项问题均已复现并修复。保留三种布局及原数据源边界，正常分页仍有动画；修改已经在本机开发页和独立生产构建中验证。

## 原因与处理

|问题|已复现原因|现在的行为|
|---|---|---|
|全部文章/朋友圈标签挤在一起|朋友圈复用了articles-tabs类名，却没有文章页的scoped样式；实际从flex和24px间距变为block，且缺少图标容器|两页共同使用PostTabs，统一图标、标签间距、高度、当前页状态和操作区；键盘焦点轮廓内置，避免被溢出容器裁切|
|分页动画提前播放、随后突然换内容|过渡key取请求页码，URL变化就对旧文章播放out-in；数据返回后在同一key内直接更新。慢请求记录中25帧动画发生在旧内容等待期间|列表容器保持稳定，只有新文章被接受后才播放一次可取消入场；关闭动画/reduce即时显示；后续翻页取消旧读取，最后一次选择生效|

同时修复：加载提示脱离文档流，避免提示出现/消失推动列表；筛选和分页失败保留原列表并可重试；删除与URL历史恢复冲突的额外平滑回顶，滚动落点统一管理。连续追加仍保留串行保护，显式分页可替换在途请求。

## 验证

|检查|结果|
|---|---|
|内容标签|18场景×Chromium/Firefox/WebKit，54项通过；三主题、320/390/768/1024/1440/1920，含明暗色、减少模式、直接进入朋友圈、键盘及历史往返|
|分页时序与恢复|24场景×三浏览器，72项通过；慢请求、快速页码替换、失败/重试、末页、模式切换、关闭/reduce、fade/soft预设及运行中减少动态效果|
|分页与标签联动|3主题×三浏览器，9项通过；等待中离开到朋友圈，迟到响应不覆盖，返回恢复第2页|
|既有业务回归|9项通过；SSR文章、页码/筛选/历史、连续模式完整集合、旧朋友圈锚点、主题切换保留内容和评论草稿|
|代码检查|Lint、Nuxt类型检查、83项单测和独立生产构建通过；包含2项新增数据源中断/失败回归|
|实际动画|三主题均记录正常动画视频和rAF状态；新内容有真实中间透明度，列表节点不重建，最终opacity=1、transform=none、动画任务为空|

三浏览器专项合计135项通过，另有9项既有业务回归。查看[主运行](D:/Projects/TixXinBlog/docs/content-navigation-fix/evidence/main/report.json)、[联动补测](D:/Projects/TixXinBlog/docs/content-navigation-fix/evidence/combined/report.json)、[业务回归](D:/Projects/TixXinBlog/docs/content-navigation-fix/evidence/regression/report.json)。本轮代码与验证副本的逐文件一致性见[源码核验](D:/Projects/TixXinBlog/docs/content-navigation-fix/evidence/source-check.json)。

## 前后画面

整改前朋友圈导航：

![整改前标签挤在一起](D:/Projects/TixXinBlog/docs/content-navigation-fix/evidence/tabs-moments-before.png)

整改后统一图标、间距及选中标记：

![整改后朋友圈导航](D:/Projects/TixXinBlog/docs/content-navigation-fix/evidence/normal-pagination/nexus-moments-tabs.png)

键盘焦点轮廓完整：

![键盘焦点](D:/Projects/TixXinBlog/docs/content-navigation-fix/evidence/normal-pagination/nexus-keyboard-tabs.png)

正常分页记录：[Nexus视频](D:/Projects/TixXinBlog/docs/content-navigation-fix/evidence/normal-pagination/nexus.webm)、[Aurora视频](D:/Projects/TixXinBlog/docs/content-navigation-fix/evidence/normal-pagination/aurora.webm)、[Dock视频](D:/Projects/TixXinBlog/docs/content-navigation-fix/evidence/normal-pagination/dock.webm)。[实际帧数据](D:/Projects/TixXinBlog/docs/content-navigation-fix/evidence/normal-pagination/results.json)包含透明度、变换、正文和动画状态；没有关闭正常动画来拍摄效果。

## 测试修正与边界

最初的独立单测副本尚未生成Nuxt类型，运行prepare后正常执行。首轮跨浏览器采集漏接已有prepareMotionCapture，导致Windows WebKit在字体聚合就绪处等待；另一次在动画结束帧到finished回调之间过早断言transform必须为none。已补初始化，并在1秒内等待所有动画句柄移除后检查终态。保留[初轮记录](D:/Projects/TixXinBlog/docs/content-navigation-fix/evidence/initial-run/run.log)及[中止原因](D:/Projects/TixXinBlog/docs/content-navigation-fix/evidence/initial-run/aborted.json)；中止时的Target crashed来自停止测试子进程，不记为产品崩溃。

既有9项业务回归在首次生产候选执行，后续只补充标签焦点样式及测试初始化，没有再修改分页数据逻辑。最终135项专项对应最终生产构建；联动补测是在原126项之外新增3个场景。Windows WebKit验证不等于实体Safari，手机宽度为模拟视口，本轮不声称真机测试。

测试使用独立数据库、媒体、端口和生成目录；归档不包含临时凭据或Playwright trace压缩包。清理及用户开发服务状态见[清理结果](D:/Projects/TixXinBlog/docs/content-navigation-fix/evidence/cleanup.json)。
