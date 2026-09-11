/** @file editorial-initial.ts @description editorial-v1 初稿的冻结指纹来源；仅用于精确迁正，不作为新稿或公开事实回退。 */
export const legacyEditorialArticles = [
  {
    key: 'content-boundaries',
    title: 'TixXinBlog 的内容边界与页面职责',
    summary: '从页面、领域与服务端三个层次梳理个人博客的内容链路。',
    body: `# TixXinBlog 的内容边界与页面职责

## 页面负责组织，组件负责展示

前端使用 Nuxt 4、Vue 3 和 TypeScript。页面位于 app/pages，组装组件并传递数据；领域类型和数据访问位于 features，跨页面逻辑放在 composables。展示组件通过 props 接收数据、通过事件报告操作。

## 持久内容与本机资料

文章、闪念、朋友圈、留言、图库、项目和友链由 NestJS API 与 PostgreSQL 保存。文章和闪念保留显式演示仓库开关，朋友圈和留言没有请求失败后退回样本的路径。书签目前使用 LocalStorage；清理浏览器资料会影响本机书签，不能把它理解为云同步。

## 三套布局与同一业务

Nexus、Aurora 和 Dock 通过主题契约加载。主题负责布局差异，业务内容仍由页面与领域层提供，避免每套主题分别维护一份内容。

## 可核查的位置

根 package.json、src/frontend/web-blog/package.json、src/backend/server-main/package.json、docs/capability-map.md 与前端 app/features。本文描述当前仓库实现，不包含访问量、用户规模或商业结果。`,
  },
  {
    key: 'editing-recovery',
    title: '保存失败之后，如何保住正在写的内容',
    summary: '整理版本校验、恢复副本与内容上下文各自保护的边界。',
    body: `# 保存失败之后，如何保住正在写的内容

## 版本号解决并发覆盖

后台编辑接口使用修订版本比较。另一个标签页先保存时，旧版本提交会被拒绝；当前输入应保留，用于和最新服务器内容比较。读取新版本不等于可以直接用旧快照覆盖全部字段。

## 恢复副本与服务器内容

恢复副本用于保留未提交的输入，不等同于服务器备份。账号或内容库改变后，旧副本需要重新核对归属，不能自动向新内容库提交。关闭页面之前的提醒、刷新后的载入入口和保存成功后的副本清理属于不同环节。

## 不确定的提交结果

请求超时只表示客户端没有收到确定响应，服务器可能已经保存。再次提交前应核对版本或请求标识；不能把所有网络失败都看成没有写入。

## 维护中的上下文

完整恢复会轮换内容上下文并撤销旧会话。恢复之前打开的页面需要重新取得当前上下文，避免把旧内容的编辑发送到恢复后的数据。

## 可核查的位置

src/frontend/web-blog/app/composables/usePostRecovery.ts、usePostEditor.ts，后端 modules/post/admin-post.service.ts、common/guards/admin-auth.guard.ts 与 scripts/full-backup.mjs。`,
  },
  {
    key: 'backup-boundaries',
    title: '内容迁入包与完整备份分别解决什么问题',
    summary: '区分草稿迁入、媒体完整性与数据库恢复，避免把一次导出当成可恢复承诺。',
    body: `# 内容迁入包与完整备份分别解决什么问题

## 内容迁入包用于组织内容

内容包支持预览迁入计划，选择跳过相同内容或复制为新草稿。媒体与业务编号需要映射，确认票据绑定目标当前状态。计划过期或目标发生改变时应重新预览，不能沿用旧结论直接写入。

## 完整备份保留数据库与受管媒体

完整备份使用 PostgreSQL 一致快照，记录迁移、数据摘要和媒体文件摘要。图库外部图片只保存 URL，不在备份中访问或抓取远程图片。

## 生成、校验与恢复是不同结果

文件生成成功之后仍需要完整性校验。恢复演练应使用新的隔离目标，核对数据库、媒体和应用读取结果。应用版本回退不能代替数据库修复，内容包也不负责恢复管理账号和会话。

## 可核查的位置

src/backend/server-main/src/modules/backup/content-package.ts、content-import.service.ts、scripts/full-backup.mjs 与 docs/backup-and-recovery.md。迁入正文保持草稿，需要博主审阅后决定公开。`,
  },
] as const
export const legacyEditorialProject = {
  title: 'TixXinBlog：内容与维护',
  description:
    '基于 Nuxt 4、Vue 3、TypeScript、NestJS、MikroORM 与 PostgreSQL 的个人博客。文章、闪念、朋友圈、留言、图库、项目和友链使用真实业务接口，三套主题通过契约组织。后台提供版本保护、媒体管理、内容包迁入与完整备份恢复；书签仍保存在当前浏览器，友链公开申请尚未开放。',
  coverMediaId: null,
  progress: 'active' as const,
  status: 'draft' as const,
  sortOrder: 0,
  tags: [
    { label: 'Nuxt', color: 'emerald' as const },
    { label: 'NestJS', color: 'rose' as const },
    { label: 'PostgreSQL', color: 'sky' as const },
  ],
  links: [{ kind: 'source' as const, href: 'https://github.com/TixXin/TixXinBlog' }],
  relatedContent: [],
}
