/**
 * @file package-content.messages.ts
 * @description 内容包文章、评论、闪念、动态、社交等业务字段校验文案
 * @author TixXin
 * @since 2026-10-19
 */
import { defineMessages } from './types'

export const packageContentMessages = defineMessages({
  'package.subscriptionIdInvalid': {
    zh: '内容包字段不合法：{path}.重复或非法编号',
    en: 'Invalid content package field: {path} (duplicate or invalid ID)',
  },
  'package.subscriptionHistoryInvalid': {
    zh: '内容包字段不合法：{path}.价格历史或图标域名',
    en: 'Invalid content package field: {path} (price history or icon domain)',
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
  'package.fieldExportedAt': { zh: '内容包字段不合法：导出时间', en: 'Invalid content package field: export time' },
  'package.fieldRequireCommentApproval': {
    zh: '内容包字段不合法：评论审核策略',
    en: 'Invalid content package field: comment moderation policy',
  },
})
