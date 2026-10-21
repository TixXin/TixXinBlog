/**
 * @file package-media.messages.ts
 * @description 内容包媒体资产、编码、完整性校验文案
 * @author TixXin
 * @since 2026-10-19
 */
import { defineMessages } from './types'

export const packageMediaMessages = defineMessages({
  'package.imageSourceConflict': {
    zh: '内容包字段不合法：{path}.图片来源互斥',
    en: 'Invalid content package field: {path} (media and external image are mutually exclusive)',
  },
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
})
