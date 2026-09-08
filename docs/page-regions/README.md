# 朋友圈侧栏去重与标题、正文分区

已按确认方案完成：Nexus作者资料和动态日历保留在左侧，右侧显示照片、话题和时光胶囊；标题保持在卡片顶部，正文独立过渡。用户开发页也已实际检查，左侧作者/日历各1份，右侧均为0份。

## 展示与状态归属

|布局|固定资料区|紧凑布局|
|---|---|---|
|Nexus|1024px起左侧作者与日历；1440px起显示右侧补充内容|抽屉补充隐藏的信息；左侧已经可见时，抽屉不再重复作者与日历|
|Aurora|1280px起右侧作者与日历|右侧收起后由抽屉提供|
|Dock|单栏，不显示固定侧栏|通过信息抽屉提供|

列表、详情与话题页使用同一归属策略。日期/话题继续以URL为状态来源；重新挂载的日历会回到已选日期所在月份。跨断点或布局变化关闭旧抽屉，并释放背景锁。

## 标题与正文

11个普通页面接入PageFrame：header、默认正文及overlays具名插槽明确分区，原有搜索、筛选、发布与输入状态仍由原页面持有。SSR直接输出标题和正文，不在客户端搬移标题。

首页与朋友圈共用feed标题组，标题区域不播放进出场动画，只更新选中项、图标和工具；键盘焦点归还同名导航入口。跨不同栏目时，标题采用120ms纯透明度过渡，正文沿用140/150/160ms预设，两者同时开始、分别清理。整页根节点不再做位移动画。

正文的进入和离场都限制在正文区域内，快照不含标题，移除重复ID和焦点标识，并设置inert/aria-hidden。慢请求只在正文内显示提示；快速导航、取消、失败、减少动态效果与主题重挂均清理旧任务。分页/筛选继续使用列表自己的过渡，不触发标题过渡。

文章阅读工具条、全屏书签、关于页大幅介绍及后台页面保留现有结构。主题外框、后端API和数据源边界不变。[源码与验证副本一致性](D:/Projects/TixXinBlog/docs/page-regions/evidence/source-check.json)。

产品源文件与验证构建副本一致。归档时详情测试文件仅经Prettier整理换行，归一结果一致，原测试哈希和提交哈希均已单独记录。

## 验证结果

|验证|结果与证据|
|---|---|
|三浏览器专项|84/84通过，Chromium/Firefox/WebKit各28项，含侧栏分配、抽屉、分区动画、慢请求、取消、无动画及SSR：[结果](D:/Projects/TixXinBlog/docs/page-regions/evidence/main/report.json)|
|既有回归|115/115通过，涵盖30/120/300ms快速导航、分页、历史位置、搜索、评论草稿与在途提交、连续加载及特殊页：[结果](D:/Projects/TixXinBlog/docs/page-regions/evidence/legacy/report.json)|
|修复后定向复测|抽屉/焦点6项、减少模式/搜索/订阅16项均通过：[焦点](D:/Projects/TixXinBlog/docs/page-regions/evidence/context/report.json)、[减少模式](D:/Projects/TixXinBlog/docs/page-regions/evidence/reduced/report.json)|
|真实详情入口补测|3主题×3浏览器，9/9通过：[详情补测](D:/Projects/TixXinBlog/docs/page-regions/evidence/detail/report.json)|
|代码检查|[Lint](D:/Projects/TixXinBlog/docs/page-regions/evidence/lint-final.log)、[类型](D:/Projects/TixXinBlog/docs/page-regions/evidence/typecheck-final.log)、[83项单测](D:/Projects/TixXinBlog/docs/page-regions/evidence/unit-final.log)、[独立生产构建](D:/Projects/TixXinBlog/docs/page-regions/evidence/build-final.log)通过|

侧栏矩阵覆盖320、390、1023/1024、1279/1280、1439/1440和1920px，三主题的列表、详情、话题页均验证，另覆盖六个有向主题切换。普通栏目检查真实正文高度及快照边界，不仅检查标题存在。旧动效测试也已改为断言标题/正文区域，防止重新出现整页一起移动。

首次115项既有回归完成后，仅补充抽屉入口焦点和原生媒体偏好的时序保护；最终84项及相关定向回归在对应最终实现上通过。数量包含跨浏览器重复和定向复测，不相加解释为独立功能数量。Windows WebKit为引擎验证，不等同于实体Safari或真机手机。

## 实际画面

用户提供的整改前画面：[原截图](D:/Projects/TixXinBlog/docs/page-regions/evidence/before.png)。整改后Nexus左右分工：

![侧栏去重后](D:/Projects/TixXinBlog/docs/page-regions/evidence/nexus-sidebars.png)

正常动画视频：[Nexus](D:/Projects/TixXinBlog/docs/page-regions/evidence/motion/nexus.webm)、[Aurora](D:/Projects/TixXinBlog/docs/page-regions/evidence/motion/aurora.webm)、[Dock](D:/Projects/TixXinBlog/docs/page-regions/evidence/motion/dock.webm)。[逐帧数据](D:/Projects/TixXinBlog/docs/page-regions/evidence/motion/results.json)记录真实透明度、变换、标题坐标及快照边界；录制保持正常动画开启。三主题feed切换中标题Y坐标均保持不变，正文存在实际过渡帧。录制在首次生产候选完成，后续仅修复抽屉与reduce时序，不改变录制的普通导航行为。

## 发现并补齐的问题

- WebKit连续点击已聚焦入口时，会先将它失焦到body。抽屉现在先明确聚焦入口再打开；关闭后可以可靠返回。[修复前](D:/Projects/TixXinBlog/docs/page-regions/evidence/focus-before.json)、[修复后](D:/Projects/TixXinBlog/docs/page-regions/evidence/focus-after.json)。
- 原生减少动态效果已生效时，订阅通知可能尚未处理。动画创建前补充原生条件检查；修复前5次采样有3次在native=true时仍创建动画，修复后5次均未创建。[前](D:/Projects/TixXinBlog/docs/page-regions/evidence/reduce-probe.json)、[后](D:/Projects/TixXinBlog/docs/page-regions/evidence/reduce-after.json)。
- 日期共享测试最初在抽屉退场尚未结束时检查全局话题按钮，产生定位歧义；改为等待抽屉完全关闭后检查稳定状态。此前格式化时遇到短暂文件占用，重试后通过，不作为产品缺陷。
- 最后复查发现原详情定位器命中了靠前的话题链接。现使用“查看动态详情”专用入口，并断言moment-detail-page真实出现；详情分支的9项在最终代码上单独重验通过，详情覆盖以该补测记录为准。

所有写入验收在随机隔离库进行；开发/HMR、构建与单测使用独立目录。未归档可能含临时凭据的Playwright trace包。资源与日常开发服务的清理记录见[cleanup](D:/Projects/TixXinBlog/docs/page-regions/evidence/cleanup.json)。
