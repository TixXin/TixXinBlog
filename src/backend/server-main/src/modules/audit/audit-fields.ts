/**
 * @file audit-fields.ts
 * @description 审计摘要字段白名单与语言翻译映射
 */
import { translate, zh, type ApiLocale, type MessageKey } from '../../common/i18n'

/** 摘要字段的字典 key；写入审计时保存中文名称，读取时再按语言翻译 */
export const fields: Readonly<Record<string, MessageKey>> = {
  title: 'audit.field.title',
  summary: 'audit.field.summary',
  contentRaw: 'audit.field.contentRaw',
  content: 'audit.field.content',
  category: 'audit.field.category',
  folder: 'audit.field.folder',
  tags: 'audit.field.tags',
  status: 'audit.field.status',
  slug: 'audit.field.slug',
  cover: 'audit.field.cover',
  coverAlt: 'audit.field.coverAlt',
  seoTitle: 'audit.field.seoTitle',
  seoDescription: 'audit.field.seoDescription',
  seoNoindex: 'audit.field.seoNoindex',
  pinned: 'audit.field.pinned',
  readTimeMinutes: 'audit.field.readTimeMinutes',
  name: 'audit.field.name',
  description: 'audit.field.description',
  ownerName: 'audit.field.ownerName',
  ownerTitle: 'audit.field.ownerTitle',
  avatar: 'audit.field.avatar',
  avatarAlt: 'audit.field.avatarAlt',
  announcement: 'audit.field.announcement',
  socials: 'audit.field.socials',
  searchIndexing: 'audit.field.searchIndexing',
  alt: 'audit.field.alt',
  label: 'audit.field.label',
  color: 'audit.field.color',
  images: 'audit.field.images',
  isDraft: 'audit.field.isDraft',
  isArchived: 'audit.field.isArchived',
  isPinned: 'audit.field.isPinned',
  topics: 'audit.field.topics',
  location: 'audit.field.location',
  device: 'audit.field.device',
  mood: 'audit.field.mood',
  linkedArticleId: 'audit.field.linkedArticleId',
  linkedLink: 'audit.field.linkedLink',
  replyToId: 'audit.field.replyToId',
  requireApproval: 'audit.field.requireApproval',
  mediaId: 'audit.field.mediaId',
  takenOn: 'audit.field.takenOn',
  sortOrder: 'audit.field.sortOrder',
  gear: 'audit.field.gear',
  progress: 'audit.field.progress',
  amount: 'audit.field.amount',
  currency: 'audit.field.currency',
  billingCycle: 'audit.field.billingCycle',
  subscriptionStatus: 'audit.field.subscriptionStatus',
  startDate: 'audit.field.startDate',
  nextBillingDate: 'audit.field.nextBillingDate',
  iconMediaId: 'audit.field.iconMediaId',
  notes: 'audit.field.notes',
  priceChangeReason: 'audit.field.priceChangeReason',
  coverMediaId: 'audit.field.coverMediaId',
  prompt: 'audit.field.prompt',
  negativePrompt: 'audit.field.negativePrompt',
  model: 'audit.field.model',
  imageAlt: 'audit.field.imageAlt',
  externalImageUrl: 'audit.field.externalImageUrl',
  sourceUrl: 'audit.field.sourceUrl',
  links: 'audit.field.links',
  url: 'audit.field.url',
  logoMediaId: 'audit.field.logoMediaId',
  logoUrl: 'audit.field.logoUrl',
  isFeatured: 'audit.field.isFeatured',
  rules: 'audit.field.rules',
}

let fieldKeysByLabel: Map<string, MessageKey> | undefined

/** 把持久化的中文字段名翻译为请求语言；未知名称原样返回 */
export function auditFieldLabel(label: string, locale: ApiLocale): string {
  if (locale === 'zh-CN') return label
  fieldKeysByLabel ??= new Map(Object.values(fields).map((key) => [zh(key), key]))
  const key = fieldKeysByLabel.get(label)
  return key ? translate(locale, key) : label
}
