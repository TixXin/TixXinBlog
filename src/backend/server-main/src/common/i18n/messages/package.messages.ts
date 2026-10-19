/**
 * @file package.messages.ts
 * @description 内容包解析与结构校验的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { defineMessages } from './types'

/**
 * 字段校验失败统一为「内容包字段不合法：<字段>」。
 * 字段路径（如 posts[0].values）作为 {path} 参数传入；中文字段名不作参数，按字段拆为 package.field* 独立条目。
 */
export const packageMessages = defineMessages({
  'package.tooLarge': {
    zh: '内容包不能超过 50MB；较大站点请使用完整维护备份',
    en: 'Content packages cannot exceed 50MB. For larger sites, use a full maintenance backup.',
  },
  'package.invalidJson': {
    zh: '请选择有效的 UTF-8 JSON 内容包',
    en: 'Choose a valid UTF-8 JSON content package.',
  },
  'package.unsupportedVersion': {
    zh: '不支持的内容包格式或版本',
    en: 'Unsupported content package format or version',
  },
  'package.pixelsTooLarge': {
    zh: '图片总量过大，请使用完整维护备份',
    en: 'The total image size is too large. Use a full maintenance backup.',
  },
  'package.invalidField': { zh: '内容包字段不合法：{path}', en: 'Invalid content package field: {path}' },
  'package.imageSourceConflict': {
    zh: '内容包字段不合法：{path}.图片来源互斥',
    en: 'Invalid content package field: {path} (media and external image are mutually exclusive)',
  },
  'package.subscriptionIdInvalid': {
    zh: '内容包字段不合法：{path}.重复或非法编号',
    en: 'Invalid content package field: {path} (duplicate or invalid ID)',
  },
  'package.subscriptionHistoryInvalid': {
    zh: '内容包字段不合法：{path}.价格历史或图标域名',
    en: 'Invalid content package field: {path} (price history or icon domain)',
  },
  'package.fieldNestingOrCount': {
    zh: '内容包字段不合法：数据层级或数量',
    en: 'Invalid content package field: data nesting depth or node count',
  },
  'package.fieldUnsupportedKey': {
    zh: '内容包字段不合法：不支持的字段',
    en: 'Invalid content package field: unsupported key',
  },
  'package.fieldRoot': { zh: '内容包字段不合法：根对象', en: 'Invalid content package field: root object' },
  'package.fieldLegacyOmittedRelations': {
    zh: '内容包字段不合法：旧版本不支持关联省略计数',
    en: 'Invalid content package field: omitted relation count is not supported by older versions',
  },
  'package.fieldOmittedRelations': {
    zh: '内容包字段不合法：关联省略计数',
    en: 'Invalid content package field: omitted relation count',
  },
  'package.fieldLegacyRelations': {
    zh: '内容包字段不合法：旧版本不支持结构化关联',
    en: 'Invalid content package field: structured relations are not supported by older versions',
  },
  'package.fieldRelationType': { zh: '内容包字段不合法：关联类型', en: 'Invalid content package field: relation type' },
  'package.fieldRelationDuplicateOrSelf': {
    zh: '内容包字段不合法：重复或自身关联',
    en: 'Invalid content package field: duplicate or self relation',
  },
  'package.fieldV1Moments': {
    zh: '内容包字段不合法：v1 不支持朋友圈字段',
    en: 'Invalid content package field: v1 does not support moments',
  },
  'package.fieldV2Guestbook': {
    zh: '内容包字段不合法：v1/v2 不支持留言字段',
    en: 'Invalid content package field: v1/v2 do not support guestbook messages',
  },
  'package.fieldV3Gallery': {
    zh: '内容包字段不合法：v1/v2/v3 不支持图库字段或器材配置',
    en: 'Invalid content package field: v1/v2/v3 do not support gallery photos or gear settings',
  },
  'package.fieldV4Projects': {
    zh: '内容包字段不合法：v1/v2/v3/v4 不支持项目字段',
    en: 'Invalid content package field: v1/v2/v3/v4 do not support projects',
  },
  'package.fieldV5Links': {
    zh: '内容包字段不合法：v1/v2/v3/v4/v5 不支持友链或规则配置',
    en: 'Invalid content package field: v1/v2/v3/v4/v5 do not support links or link rules',
  },
  'package.fieldV9Prompts': {
    zh: '内容包字段不合法：v1–v9 不支持图片提示词',
    en: 'Invalid content package field: v1–v9 do not support image prompts',
  },
  'package.fieldV10Subscriptions': {
    zh: '内容包字段不合法：v1–v10 不支持平台订阅费',
    en: 'Invalid content package field: v1–v10 do not support platform subscriptions',
  },
  'package.fieldCommentAvatar': {
    zh: '内容包字段不合法：评论头像',
    en: 'Invalid content package field: comment avatar',
  },
  'package.fieldCommentStatusOrAvatar': {
    zh: '内容包字段不合法：评论状态或头像',
    en: 'Invalid content package field: comment status or avatar',
  },
  'package.fieldCommentId': { zh: '内容包字段不合法：评论编号', en: 'Invalid content package field: comment ID' },
  'package.fieldCommentParentId': {
    zh: '内容包字段不合法：父评论编号',
    en: 'Invalid content package field: parent comment ID',
  },
  'package.fieldCommentAuthor': {
    zh: '内容包字段不合法：评论作者',
    en: 'Invalid content package field: comment author',
  },
  'package.fieldCommentContent': {
    zh: '内容包字段不合法：评论内容',
    en: 'Invalid content package field: comment content',
  },
  'package.fieldCommentIsOwner': { zh: '内容包字段不合法：博主标记', en: 'Invalid content package field: owner flag' },
  'package.fieldCommentCreatedAt': {
    zh: '内容包字段不合法：评论时间',
    en: 'Invalid content package field: comment time',
  },
  'package.fieldCommentIdDuplicate': {
    zh: '内容包字段不合法：重复评论编号',
    en: 'Invalid content package field: duplicate comment ID',
  },
  'package.fieldCommentNesting': {
    zh: '内容包字段不合法：评论层级或跨文章引用',
    en: 'Invalid content package field: comment nesting or cross-post reference',
  },
  'package.fieldPostIdDuplicate': {
    zh: '内容包字段不合法：重复文章编号',
    en: 'Invalid content package field: duplicate post ID',
  },
  'package.fieldFlashValues': { zh: '内容包字段不合法：闪念字段', en: 'Invalid content package field: flash fields' },
  'package.fieldFlashContent': {
    zh: '内容包字段不合法：闪念内容、标签或图片',
    en: 'Invalid content package field: flash content, tags or images',
  },
  'package.fieldFlashComment': { zh: '内容包字段不合法：闪念评论', en: 'Invalid content package field: flash comment' },
  'package.fieldFlashCommentAvatar': {
    zh: '内容包字段不合法：闪念评论头像',
    en: 'Invalid content package field: flash comment avatar',
  },
  'package.fieldFlashCommentStatus': {
    zh: '内容包字段不合法：闪念评论状态',
    en: 'Invalid content package field: flash comment status',
  },
  'package.fieldFlashCommentAuthor': {
    zh: '内容包字段不合法：闪念评论作者',
    en: 'Invalid content package field: flash comment author',
  },
  'package.fieldFlashCommentContent': {
    zh: '内容包字段不合法：闪念评论内容',
    en: 'Invalid content package field: flash comment content',
  },
  'package.fieldFlashCommentCreatedAt': {
    zh: '内容包字段不合法：闪念评论时间',
    en: 'Invalid content package field: flash comment time',
  },
  'package.fieldFlashId': { zh: '内容包字段不合法：闪念编号', en: 'Invalid content package field: flash ID' },
  'package.fieldFlashCreatedAt': { zh: '内容包字段不合法：闪念时间', en: 'Invalid content package field: flash time' },
  'package.fieldMomentArticleMissing': {
    zh: '内容包字段不合法：动态引用的文章不在内容包中',
    en: 'Invalid content package field: the post referenced by a moment is not in the package',
  },
  'package.fieldMomentComment': {
    zh: '内容包字段不合法：动态评论',
    en: 'Invalid content package field: moment comment',
  },
  'package.fieldMomentCommentStatus': {
    zh: '内容包字段不合法：动态评论状态',
    en: 'Invalid content package field: moment comment status',
  },
  'package.fieldMomentCommentId': {
    zh: '内容包字段不合法：动态评论编号',
    en: 'Invalid content package field: moment comment ID',
  },
  'package.fieldMomentCommentAuthor': {
    zh: '内容包字段不合法：动态评论作者',
    en: 'Invalid content package field: moment comment author',
  },
  'package.fieldMomentCommentAvatar': {
    zh: '内容包字段不合法：动态评论头像',
    en: 'Invalid content package field: moment comment avatar',
  },
  'package.fieldMomentCommentContent': {
    zh: '内容包字段不合法：动态评论内容',
    en: 'Invalid content package field: moment comment content',
  },
  'package.fieldMomentCommentIsOwner': {
    zh: '内容包字段不合法：动态博主标记',
    en: 'Invalid content package field: moment owner flag',
  },
  'package.fieldMomentCommentDeleted': {
    zh: '内容包字段不合法：动态评论删除标记',
    en: 'Invalid content package field: moment comment deleted flag',
  },
  'package.fieldMomentCommentCreatedAt': {
    zh: '内容包字段不合法：动态评论时间',
    en: 'Invalid content package field: moment comment time',
  },
  'package.fieldMomentCommentIdDuplicate': {
    zh: '内容包字段不合法：重复动态评论编号',
    en: 'Invalid content package field: duplicate moment comment ID',
  },
  'package.fieldMomentId': { zh: '内容包字段不合法：动态编号', en: 'Invalid content package field: moment ID' },
  'package.fieldMomentCreatedAt': {
    zh: '内容包字段不合法：动态创建时间',
    en: 'Invalid content package field: moment creation time',
  },
  'package.fieldMomentPublishedAt': {
    zh: '内容包字段不合法：动态发布时间',
    en: 'Invalid content package field: moment publish time',
  },
  'package.fieldMomentDeleted': {
    zh: '内容包字段不合法：动态删除标记',
    en: 'Invalid content package field: moment deleted flag',
  },
  'package.fieldMomentIdDuplicate': {
    zh: '内容包字段不合法：重复动态编号',
    en: 'Invalid content package field: duplicate moment ID',
  },
  'package.fieldGalleryIdDuplicate': {
    zh: '内容包字段不合法：重复图库作品编号',
    en: 'Invalid content package field: duplicate gallery photo ID',
  },
  'package.fieldGalleryGear': { zh: '内容包字段不合法：图库器材', en: 'Invalid content package field: gallery gear' },
  'package.fieldGalleryGearIcon': {
    zh: '内容包字段不合法：图库器材图标',
    en: 'Invalid content package field: gallery gear icon',
  },
  'package.fieldGalleryGearName': {
    zh: '内容包字段不合法：图库器材名称',
    en: 'Invalid content package field: gallery gear name',
  },
  'package.fieldGalleryGearDescription': {
    zh: '内容包字段不合法：图库器材介绍',
    en: 'Invalid content package field: gallery gear description',
  },
  'package.fieldProjectIdDuplicate': {
    zh: '内容包字段不合法：重复项目编号',
    en: 'Invalid content package field: duplicate project ID',
  },
  'package.fieldLinkIdDuplicate': {
    zh: '内容包字段不合法：重复友链编号',
    en: 'Invalid content package field: duplicate link ID',
  },
  'package.fieldPromptIdDuplicate': {
    zh: '内容包字段不合法：重复图片提示词编号',
    en: 'Invalid content package field: duplicate image prompt ID',
  },
  'package.fieldLinkRule': { zh: '内容包字段不合法：友链规则', en: 'Invalid content package field: link rule' },
  'package.fieldGuestbookIdDuplicate': {
    zh: '内容包字段不合法：重复留言编号',
    en: 'Invalid content package field: duplicate guestbook message ID',
  },
  'package.fieldGuestbookReplyLoop': {
    zh: '内容包字段不合法：留言引用缺失或循环',
    en: 'Invalid content package field: missing or circular guestbook reply reference',
  },
  'package.fieldCommentsTotalOrFlashIdDuplicate': {
    zh: '内容包字段不合法：评论总量或重复闪念编号',
    en: 'Invalid content package field: total comment count or duplicate flash ID',
  },
  'package.fieldFolderName': { zh: '内容包字段不合法：专栏名称', en: 'Invalid content package field: folder name' },
  'package.fieldTag': { zh: '内容包字段不合法：标签', en: 'Invalid content package field: tag' },
  'package.fieldTagColor': { zh: '内容包字段不合法：标签颜色', en: 'Invalid content package field: tag color' },
  'package.fieldTagLabel': { zh: '内容包字段不合法：标签名称', en: 'Invalid content package field: tag name' },
  'package.fieldFolderOrTagDuplicate': {
    zh: '内容包字段不合法：目录名称重复或空白',
    en: 'Invalid content package field: duplicate or blank folder or tag name',
  },
  'package.fieldSite': { zh: '内容包字段不合法：站点资料', en: 'Invalid content package field: site profile' },
  'package.fieldSiteNavigation': {
    zh: '内容包字段不合法：站点导航与页脚',
    en: 'Invalid content package field: site navigation and footer',
  },
  'package.fieldAboutSectionDuplicate': {
    zh: '内容包字段不合法：关于页栏目重复',
    en: 'Invalid content package field: duplicate About page section',
  },
  'package.fieldSiteAvatar': { zh: '内容包字段不合法：站点头像', en: 'Invalid content package field: site avatar' },
  'package.fieldSiteSocial': { zh: '内容包字段不合法：社交链接', en: 'Invalid content package field: social link' },
  'package.fieldMedia': { zh: '内容包字段不合法：媒体', en: 'Invalid content package field: media' },
  'package.fieldMediaId': { zh: '内容包字段不合法：媒体编号', en: 'Invalid content package field: media ID' },
  'package.fieldMediaName': { zh: '内容包字段不合法：媒体名称', en: 'Invalid content package field: media name' },
  'package.fieldMediaSha256': { zh: '内容包字段不合法：媒体摘要', en: 'Invalid content package field: media digest' },
  'package.fieldMediaByteSize': { zh: '内容包字段不合法：媒体大小', en: 'Invalid content package field: media size' },
  'package.fieldMediaWidth': { zh: '内容包字段不合法：图片宽度', en: 'Invalid content package field: image width' },
  'package.fieldMediaHeight': { zh: '内容包字段不合法：图片高度', en: 'Invalid content package field: image height' },
  'package.fieldMediaAttributes': {
    zh: '内容包字段不合法：媒体标识、名称、大小或尺寸',
    en: 'Invalid content package field: media ID, name, size or dimensions',
  },
  'package.fieldMediaBase64': { zh: '内容包字段不合法：媒体字节', en: 'Invalid content package field: media bytes' },
  'package.fieldMediaIncludedMismatch': {
    zh: '内容包字段不合法：媒体包含标记与字节不一致',
    en: 'Invalid content package field: media inclusion flag does not match the bytes',
  },
  'package.fieldMediaEncoding': {
    zh: '内容包字段不合法：媒体编码',
    en: 'Invalid content package field: media encoding',
  },
  'package.fieldMediaIntegrity': {
    zh: '内容包字段不合法：媒体完整性或真实格式',
    en: 'Invalid content package field: media integrity or actual format',
  },
  'package.fieldMediaMetadata': {
    zh: '内容包字段不合法：媒体元信息',
    en: 'Invalid content package field: media metadata',
  },
  'package.fieldMediaDecode': { zh: '内容包字段不合法：媒体解码', en: 'Invalid content package field: media decoding' },
  'package.fieldMediaDescription': {
    zh: '内容包字段不合法：媒体说明',
    en: 'Invalid content package field: media description',
  },
  'package.fieldMediaAlt': { zh: '内容包字段不合法：图片说明', en: 'Invalid content package field: image alt text' },
  'package.fieldMediaCreatedAt': { zh: '内容包字段不合法：媒体时间', en: 'Invalid content package field: media time' },
  'package.fieldMediaDeleted': {
    zh: '内容包字段不合法：媒体回收状态',
    en: 'Invalid content package field: media trash state',
  },
  'package.fieldMediaIdDuplicate': {
    zh: '内容包字段不合法：重复媒体编号',
    en: 'Invalid content package field: duplicate media ID',
  },
  'package.fieldRelationTargetMissing': {
    zh: '内容包字段不合法：关联目标不在内容包内，不能把来源编号当作目标站点编号',
    en: 'Invalid content package field: relation target is not in the package; source IDs cannot be used as target site IDs',
  },
  'package.fieldExportedAt': { zh: '内容包字段不合法：导出时间', en: 'Invalid content package field: export time' },
  'package.fieldRequireCommentApproval': {
    zh: '内容包字段不合法：评论审核策略',
    en: 'Invalid content package field: comment moderation policy',
  },
})
