/**
 * @file backup.messages.ts
 * @description 内容包导出、导入计划与维护的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const backupMessages = defineMessages({
  // 内容包导出
  'backup.exportTooLarge': {
    zh: '内容规模超过浏览器包限制，请使用完整维护备份',
    en: 'The content exceeds the browser package limit. Use a full maintenance backup instead.',
  },
  'backup.exportMediaTooLarge': {
    zh: '图片总量过大，可导出媒体清单或使用完整维护备份',
    en: 'The images are too large in total. Export a media manifest or use a full maintenance backup instead.',
  },
  'backup.packageOver50mb': {
    zh: '内容包超过 50MB，请使用完整维护备份',
    en: 'The content package exceeds 50MB. Use a full maintenance backup instead.',
  },
  'backup.packageWithMediaOver50mb': {
    zh: '包含图片后的内容包超过 50MB，可导出媒体清单或使用完整维护备份',
    en: 'With images included, the content package exceeds 50MB. Export a media manifest or use a full maintenance backup instead.',
  },
  'backup.exportMediaUnreadable': {
    zh: '媒体 {id} 文件不可读，无法生成完整内容包',
    en: 'The file for media {id} cannot be read, so a complete content package cannot be generated.',
  },
  'backup.exportMediaIntegrity': {
    zh: '媒体 {id} 完整性校验失败',
    en: 'Integrity check failed for media {id}.',
  },

  // 导入票据与执行
  'backup.previewExpiredReselect': {
    zh: '预览已过期，请重新选择文件',
    en: 'The preview has expired. Please choose the file again.',
  },
  'backup.importTicketNotFound': { zh: '导入票据不存在', en: 'Import ticket not found' },
  'backup.invalidPackageFile': {
    zh: '请选择 JSON 内容包，文件名不能包含路径',
    en: 'Choose a JSON content package. The file name cannot contain a path.',
  },
  'backup.uploadIdUsed': {
    zh: '上传标识已经使用，请重新选择文件',
    en: 'This upload ID has already been used. Please choose the file again.',
    code: ErrorCode.SubmissionConflict,
  },
  'backup.uploadIdConflict': {
    zh: '上传标识冲突',
    en: 'Upload ID conflict',
    code: ErrorCode.SubmissionConflict,
  },
  'backup.packageExpired': {
    zh: '内容包已过期，请重新选择文件',
    en: 'The content package has expired. Please choose the file again.',
  },
  'backup.confirmDraftImport': {
    zh: '请确认以新草稿迁入内容',
    en: 'Confirm that the content will be imported as new drafts.',
  },
  'backup.previewUpdated': {
    zh: '预览已更新，请重新读取后确认',
    en: 'The preview has been updated. Reload it before confirming.',
    code: ErrorCode.PreviewStale,
  },
  'backup.previewInvalid': {
    zh: '预览已失效，请重新预览',
    en: 'The preview is no longer valid. Please preview again.',
  },
  'backup.sessionInvalidNotStarted': {
    zh: '会话已经失效，未开始导入',
    en: 'Your session is no longer valid. The import was not started.',
    code: ErrorCode.SessionChanged,
  },
  'backup.importConditionsUnmet': {
    zh: '媒体或引用条件不满足',
    en: 'Media or reference requirements are not met',
  },
  'backup.targetChanged': {
    zh: '目标内容或配置已变化，请重新预览后确认',
    en: 'The target content or settings have changed. Preview again before confirming.',
    code: ErrorCode.PreviewStale,
  },
  'backup.gallerySettingsChanged': {
    zh: '图库器材配置已变化，请重新预览',
    en: 'The gallery gear settings have changed. Please preview again.',
    code: ErrorCode.PreviewStale,
  },
  'backup.linkSettingsChanged': {
    zh: '友链规则已变化，请重新预览',
    en: 'The link rules have changed. Please preview again.',
    code: ErrorCode.PreviewStale,
  },
  'backup.importRolledBack': {
    zh: '导入未完成，数据库变更已回滚，可重新预览后重试',
    en: 'The import did not complete and database changes were rolled back. Preview again and retry.',
  },
  'backup.importResultUnknown': {
    zh: '导入结果暂时无法确认，请通过票据查询，原文件仍保留',
    en: 'The import result cannot be confirmed right now. Check it with the ticket; the original file is kept.',
  },
  'backup.guestbookPlanMissing': {
    zh: '留言导入计划缺失，请重新预览',
    en: 'The guestbook import plan is missing. Please preview again.',
    code: ErrorCode.PreviewStale,
  },
  'backup.promptPlanMissing': {
    zh: '图片提示词迁入计划缺失，请重新预览',
    en: 'The image prompt import plan is missing. Please preview again.',
    code: ErrorCode.PreviewStale,
  },
  'backup.subscriptionPlanMissing': {
    zh: '平台订阅迁入计划缺失，请重新预览',
    en: 'The platform subscription import plan is missing. Please preview again.',
    code: ErrorCode.PreviewStale,
  },
  'backup.guestbookDuplicateUnmapped': {
    zh: '相同留言未能映射，迁入已回滚',
    en: 'A matching guestbook message could not be mapped. The import was rolled back.',
  },
  'backup.guestbookParentUnmapped': {
    zh: '留言引用未能映射，迁入已回滚',
    en: 'A guestbook reply reference could not be mapped. The import was rolled back.',
  },
  'backup.momentPostUnmapped': {
    zh: '动态引用文章未能映射，迁入已回滚',
    en: 'A post referenced by a moment could not be mapped. The import was rolled back.',
  },
  'backup.guestbookRefIncomplete': {
    zh: '留言引用不完整，不能生成导入预览',
    en: 'Guestbook reply references are incomplete, so an import preview cannot be generated.',
  },

  // 导入计划错误（持久化在 content_import.plan，读取时反查翻译）
  'backup.planPostFolderUnmapped': {
    zh: '文章 {sourceId} 的历史目录名无法映射，请先调整目录',
    en: 'The legacy folder name of post {sourceId} cannot be mapped. Adjust the folders first.',
  },
  'backup.planPostSlugConflict': {
    zh: '文章 {sourceId} 的导入地址仍有冲突',
    en: 'The import URL of post {sourceId} still conflicts',
  },
  'backup.planMomentPostDeleted': {
    zh: '动态 {sourceId} 的引用文章已删除，请选择创建副本或先恢复文章',
    en: 'The post referenced by moment {sourceId} has been deleted. Choose to create copies or restore the post first.',
  },
  'backup.planMediaUnregistered': {
    zh: '内容引用未登记的媒体 {id}',
    en: 'Content references unregistered media {id}',
  },
  'backup.planMediaRecycled': {
    zh: '引用媒体 {id} 处于回收状态，请先恢复资源',
    en: 'Referenced media {id} is in the recycle bin. Restore it first.',
  },
  'backup.planMediaIdConflict': {
    zh: '媒体 {id} 与现有文件标识冲突，不能覆盖',
    en: 'Media {id} conflicts with an existing file ID and cannot be overwritten.',
  },
  'backup.planMediaUnreadable': { zh: '媒体 {id} 当前无法读取', en: 'Media {id} cannot be read right now' },
  'backup.planMediaIntegrity': {
    zh: '媒体 {id} 文件完整性不符，需要维护恢复',
    en: 'The file for media {id} failed the integrity check and needs a maintenance restore.',
  },
  'backup.planMediaFileMissing': {
    zh: '缺少媒体 {id} 的文件，请使用包含图片的内容包或先完成媒体恢复',
    en: 'The file for media {id} is missing. Use a content package that includes images or restore the media first.',
  },
  'backup.planFolderUnmapped': {
    zh: '专栏历史名称 {label} 无法映射',
    en: 'Legacy column name {label} cannot be mapped',
  },
  'backup.planTagUnmapped': {
    zh: '标签历史名称 {label} 无法映射',
    en: 'Legacy tag name {label} cannot be mapped',
  },
  'backup.planRelationSelf': {
    zh: '关联内容 {type}:{sourceId} 去重后会指向自身，请选择复制策略',
    en: 'Related content {type}:{sourceId} would point to itself after deduplication. Choose the copy strategy.',
  },

  // 导入计划原因（持久化在 content_import.plan，读取时反查翻译）
  'backup.planSkipSameWithComments': { zh: '跳过相同内容及其评论', en: 'Skip identical content and its comments' },
  'backup.planPostCreate': { zh: '创建新草稿', en: 'Create a new draft' },
  'backup.planPostCopy': {
    zh: '创建新的草稿副本，现有内容保留',
    en: 'Create a new draft copy; existing content is kept',
  },
  'backup.planPostCreateNewSlug': {
    zh: '创建新草稿；原地址占用，使用新的地址标识',
    en: 'Create a new draft; the original URL is taken, so a new URL slug is used',
  },
  'backup.planPostCopyNewSlug': {
    zh: '创建新的草稿副本，现有内容保留；原地址占用，使用新的地址标识',
    en: 'Create a new draft copy; existing content is kept; the original URL is taken, so a new URL slug is used',
  },
  'backup.planFlashCreate': { zh: '创建新的闪念草稿', en: 'Create a new flash note draft' },
  'backup.planMomentCreate': {
    zh: '创建新的朋友圈草稿；保留未删除评论的审核状态；点赞和访客身份不迁入',
    en: 'Create a new moment draft; keep the moderation status of undeleted comments; likes and visitor identities are not imported',
  },
  'backup.planGuestbookSkipSame': {
    zh: '跳过相同留言及引用语义，保留目标审核状态',
    en: 'Skip identical messages and reply semantics; keep the target moderation status',
  },
  'backup.planGuestbookKeepDeleted': {
    zh: '保留已删除记录以重建回复引用，不公开、不恢复媒体引用',
    en: 'Keep the deleted record to rebuild reply references; not published and media references are not restored',
  },
  'backup.planGuestbookHidden': {
    zh: '迁入为隐藏留言，保留回复关系',
    en: 'Import as a hidden message; keep reply relationships',
  },
  'backup.planGuestbookPending': {
    zh: '迁入为待审留言，保留回复关系；不迁入置顶、访客凭据和回应',
    en: 'Import as a pending message; keep reply relationships; pinning, visitor credentials and responses are not imported',
  },
  'backup.planGallerySkipDeleted': {
    zh: '跳过已删除作品，保留删除状态',
    en: 'Skip the deleted photo; keep it deleted',
  },
  'backup.planGallerySkipSame': { zh: '跳过相同图库作品', en: 'Skip the identical gallery photo' },
  'backup.planGalleryCreate': {
    zh: '创建新的图库草稿，保留拍摄信息及媒体关联',
    en: 'Create a new gallery draft; keep shooting details and media links',
  },
  'backup.planProjectSkipDeleted': {
    zh: '跳过已删除项目，保留删除状态',
    en: 'Skip the deleted project; keep it deleted',
  },
  'backup.planProjectSkipSame': { zh: '跳过相同项目内容', en: 'Skip identical project content' },
  'backup.planProjectCreate': {
    zh: '创建新的项目草稿，保留项目进展、标签、链接与封面关联',
    en: 'Create a new project draft; keep progress, tags, links and the cover link',
  },
  'backup.planLinkSkipDeleted': {
    zh: '跳过已删除友链，不自动恢复',
    en: 'Skip the deleted link; it is not restored automatically',
  },
  'backup.planLinkSkipSame': {
    zh: '跳过已有相同规范地址的友链，现有内容保持不变',
    en: 'Skip the link with the same canonical URL; existing content stays unchanged',
  },
  'backup.planLinkCopy': {
    zh: '相同地址另建非公开草稿副本，保留原路径与参数；不能自动上架',
    en: 'Create a separate private draft copy for the same URL, keeping the original path and parameters; it cannot be listed automatically',
  },
  'backup.planLinkCreate': {
    zh: '创建新的友链草稿，保留推荐与排序；不会自动上架',
    en: 'Create a new link draft, keeping featured status and order; it is not listed automatically',
  },
  'backup.planPromptSkipSame': { zh: '跳过相同图片提示词', en: 'Skip the identical image prompt' },
  'backup.planPromptCreate': {
    zh: '创建新的提示词草稿，保留提示词、模型、标签和图片来源',
    en: 'Create a new prompt draft; keep the prompt, model, tags and image source',
  },
  'backup.planSubscriptionSkipDeleted': {
    zh: '跳过已删除订阅，不自动恢复',
    en: 'Skip the deleted subscription; it is not restored automatically',
  },
  'backup.planSubscriptionSkipSame': {
    zh: '跳过相同订阅及完整价格历史，已有记录保持不变',
    en: 'Skip the identical subscription and its full price history; existing records stay unchanged',
  },
  'backup.planSubscriptionCreate': {
    zh: '创建新的订阅草稿，保留币种、周期、业务状态、价格历史和受管图标',
    en: 'Create a new subscription draft; keep currency, billing cycle, status, price history and the managed icon',
  },

  // 维护诊断
  'backup.mediaFileMissing': { zh: '文件缺失', en: 'File missing' },
  'backup.mediaIntegrityMismatch': { zh: '完整性不符', en: 'Integrity mismatch' },
  'backup.mediaFileUnreadable': { zh: '文件不可读', en: 'File unreadable' },
})
