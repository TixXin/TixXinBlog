/**
 * @file package-base.messages.ts
 * @description 内容包基础格式、包大小、版本与关联校验文案
 * @author TixXin
 * @since 2026-10-19
 */
import { defineMessages } from './types'

export const packageBaseMessages = defineMessages({
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
  'package.fieldRelationTargetMissing': {
    zh: '内容包字段不合法：关联目标不在内容包内，不能把来源编号当作目标站点编号',
    en: 'Invalid content package field: relation target is not in the package; source IDs cannot be used as target site IDs',
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
})
