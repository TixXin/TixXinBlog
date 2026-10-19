/**
 * @file post.messages.ts
 * @description 文章、专栏标签、修订与批量操作的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const postMessages = defineMessages({
  // 文章读取与编辑
  'post.notFound': { zh: '文章不存在', en: 'Post not found' },
  'post.revisionNotFound': { zh: '修订不存在', en: 'Revision not found' },
  'post.previewUnavailable': { zh: '预览链接无效或已过期', en: 'The preview link is invalid or has expired' },
  'post.restoreOnlyArchivedOrTrashed': {
    zh: '只能恢复已归档或回收的文章',
    en: 'Only archived or trashed posts can be restored',
  },
  'post.coverUrlInvalid': {
    zh: '封面只允许 HTTP(S) 或站内路径',
    en: 'The cover must be an HTTP(S) URL or a site path',
  },
  'post.publishContentRequired': {
    zh: '发布文章必须填写正文',
    en: 'A post must have body content before it can be published',
  },
  'post.trashedRestoreBeforeEdit': {
    zh: '文章已在回收站，请先恢复再编辑',
    en: 'This post is in the trash. Restore it before editing.',
  },
  'post.trashedRestoreFirst': { zh: '文章已在回收站，请先恢复', en: 'This post is in the trash. Restore it first.' },
  'post.slugTaken': {
    zh: '该文章地址已被其他文章使用或保留',
    en: 'This post URL is already used or reserved by another post',
    code: ErrorCode.DuplicateResource,
  },
  'post.revisionRequired': {
    zh: '保存需要内容版本，请重新读取文章后合并修改',
    en: 'Saving requires a content revision. Reload the post and merge your changes.',
    code: ErrorCode.RevisionConflict,
  },
  'post.revisionConflict': {
    zh: '文章或关联目录已更新，已拒绝覆盖；请比较服务器版本并合并修改',
    en: 'The post or its folder and tags have been updated, so the overwrite was rejected. Compare with the server version and merge your changes.',
    code: ErrorCode.RevisionConflict,
  },
  // 修订原因：以中文写入 post_revision.reason，修订历史接口按请求语言在 post.revisionReason. 前缀下反查
  'post.revisionReason.initial': { zh: '初始版本', en: 'Initial version' },
  'post.revisionReason.previous': { zh: '历史版本', en: 'Previous version' },
  'post.revisionReason.savePublished': { zh: '保存公开内容', en: 'Saved published content' },
  'post.revisionReason.saveDraft': { zh: '保存草稿', en: 'Saved draft' },
  'post.revisionReason.saveArchived': { zh: '保存归档内容', en: 'Saved archived content' },
  'post.revisionReason.archive': { zh: '归档文章', en: 'Archived post' },
  'post.revisionReason.restoreDraft': { zh: '恢复为草稿', en: 'Restored as draft' },
  'post.revisionReason.restoreRevision': { zh: '恢复修订 {revision}', en: 'Restored revision {revision}' },
  'post.revisionReason.import': { zh: '从内容包迁入草稿', en: 'Imported from a content package as a draft' },
  'post.revisionReason.beforeBatch': { zh: '批量操作前', en: 'Before batch operation' },
  'post.revisionReason.batchWithdraw': { zh: '批量撤回', en: 'Withdrawn in batch' },
  'post.revisionReason.batchArchive': { zh: '批量归档', en: 'Archived in batch' },
  'post.revisionReason.trash': { zh: '移入回收站', en: 'Moved to trash' },
  'post.revisionReason.delete': { zh: '永久删除', en: 'Permanently deleted' },
  'post.revisionReason.beforeFolderRename': { zh: '目录更名前', en: 'Before series rename' },
  'post.revisionReason.folderRename': { zh: '专栏重命名', en: 'Series renamed' },
  'post.revisionReason.beforeTagChange': { zh: '标签修改前', en: 'Before tag change' },
  'post.revisionReason.tagChange': { zh: '标签修改', en: 'Tags changed' },
  // 专栏与标签
  'post.taxonomyUnsupported': { zh: '不支持的分类目录', en: 'Unsupported taxonomy' },
  'post.taxonomyAliasTargetDeleted': {
    zh: '旧目录名称的目标已删除，请重新选择专栏或标签',
    en: 'The target of this former name has been deleted. Choose a folder or tag again.',
  },
  'post.taxonomyNameIsAlias': {
    zh: '该名称是已更名的历史目录名，请使用当前名称或另取名称',
    en: 'This is a former name of a renamed entry. Use the current name or choose another one.',
    code: ErrorCode.DuplicateResource,
  },
  'post.folderNotFound': { zh: '专栏不存在', en: 'Folder not found' },
  'post.folderDuplicate': {
    zh: '已存在同名专栏',
    en: 'A folder with this name already exists',
    code: ErrorCode.DuplicateResource,
  },
  'post.tagNotFound': { zh: '标签不存在', en: 'Tag not found' },
  'post.tagDuplicate': {
    zh: '已存在同名标签',
    en: 'A tag with this name already exists',
    code: ErrorCode.DuplicateResource,
  },
  'post.folderInUse': {
    zh: '专栏仍被 {total} 篇文章引用（含草稿和归档），请先调整文章归属',
    en: 'This folder is still used by {total} posts (including drafts and archives). Move those posts first.',
    code: ErrorCode.ResourceInUse,
  },
  'post.tagInUse': {
    zh: '标签仍被 {total} 篇文章引用（含草稿和归档），请先移除文章标签',
    en: 'This tag is still used by {total} posts (including drafts and archives). Remove it from those posts first.',
    code: ErrorCode.ResourceInUse,
  },
  // 批量操作：计划原因与执行结果写入 post_batch_operation，读取时按语言翻译
  'post.batchDeleteOnlyTrashed': {
    zh: '永久删除仅适用于回收站文章',
    en: 'Only posts in the trash can be permanently deleted',
  },
  'post.batchRestoreOnlyTrashedOrArchived': {
    zh: '只能恢复回收或归档文章',
    en: 'Only trashed or archived posts can be restored',
  },
  'post.batchWithdrawOnlyPublished': {
    zh: '仅已发布文章可撤回',
    en: 'Only published posts can be withdrawn',
  },
  'post.batchAlreadyArchived': { zh: '文章已经归档', en: 'The post is already archived' },
  'post.batchListStale': {
    zh: '列表版本已过期，请刷新后重新选择',
    en: 'The list is out of date. Refresh and select again.',
  },
  'post.batchMissingTitle': { zh: '已不存在的文章', en: 'Deleted post' },
  'post.batchNotFound': { zh: '批量操作不存在', en: 'Batch operation not found' },
  'post.batchPreviewExpired': {
    zh: '预览已失效，请查看现有结果并重新预览未处理条目',
    en: 'The preview has expired. Review the existing results and preview the remaining items again.',
  },
  'post.batchActionInvalid': { zh: '无效批量操作', en: 'Invalid batch action' },
  'post.batchDeleteConfirmRequired': {
    zh: '永久删除需要输入确认文字',
    en: 'Enter the confirmation text to permanently delete',
  },
  'post.batchSignedOut': {
    zh: '登录已失效，未执行此条目',
    en: 'Your sign-in has expired. This item was not processed.',
    code: ErrorCode.SessionChanged,
  },
  'post.batchSessionRevoked': {
    zh: '会话已撤销或过期，未执行此条目',
    en: 'Your session was revoked or has expired. This item was not processed.',
    code: ErrorCode.SessionChanged,
  },
  'post.batchPostGone': { zh: '文章已不存在', en: 'The post no longer exists' },
  'post.batchPreviewStale': {
    zh: '预览后内容或影响范围发生变化，请重新预览',
    en: 'The content or affected scope changed after the preview. Preview again.',
    code: ErrorCode.PreviewStale,
  },
  'post.batchItemDone': { zh: '已完成', en: 'Done' },
  'post.batchItemFailed': {
    zh: '处理失败，该条目已回滚，请重试',
    en: 'Processing failed and this item was rolled back. Please try again.',
  },
})
