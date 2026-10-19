/**
 * @file site.messages.ts
 * @description 站点资料、导航、页脚与历史版本的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const siteMessages = defineMessages({
  // DTO 的 @Matches 自定义文案；过滤器按中文反查翻译。
  'site.launchedAtFormat': { zh: '上线日期需为 YYYY-MM-DD', en: 'The launch date must be in YYYY-MM-DD format' },
  'site.avatarUrlInvalid': {
    zh: '头像需要 HTTP(S) 地址或站内图片路径',
    en: 'The avatar must be an HTTP(S) URL or an on-site image path',
  },
  'site.socialLinkInvalid': {
    zh: '社交链接仅支持 HTTP(S) 或 mailto 邮箱',
    en: 'Social links only support HTTP(S) or mailto addresses',
  },
  'site.aboutSectionDuplicate': { zh: '关于页栏目不能重复', en: 'About page sections cannot be duplicated' },
  'site.revisionConflict': {
    zh: '站点资料已更新，请读取最新版本并比较；当前输入未保存',
    en: 'Site settings have been updated. Load the latest version and compare; your input has not been saved.',
    code: ErrorCode.RevisionConflict,
  },
  'site.historyNotFound': { zh: '站点历史版本不存在', en: 'Site settings revision not found' },
  // 历史版本原因以中文持久化，历史列表按请求语言反查翻译。
  'site.reasonUpdate': { zh: '更新站点资料', en: 'Updated site settings' },
  'site.reasonRestore': { zh: '恢复站点版本 {revision}', en: 'Restored site revision {revision}' },
  'site.reasonInitial': { zh: '初始站点资料', en: 'Initial site settings' },
  'site.reasonSafeInitial': {
    zh: '收起未经确认的初始个人资料',
    en: 'Hid unconfirmed initial profile details',
  },
  'site.navFormatInvalid': { zh: '导航配置格式不正确', en: 'Invalid navigation format' },
  'site.navVisibleBoolean': { zh: '导航显隐需为布尔值', en: 'Navigation visibility must be a boolean' },
  'site.navRouteCustomized': {
    zh: '内置导航项不能自定义名称或地址',
    en: 'Built-in navigation items cannot have a custom label or URL',
  },
  'site.navUnknownModule': { zh: '导航包含未知模块', en: 'Navigation contains an unknown module' },
  'site.navModuleDuplicate': { zh: '导航模块重复', en: 'Duplicate navigation module' },
  'site.navHomeHidden': { zh: '首页导航不能隐藏', en: 'The home navigation item cannot be hidden' },
  'site.navExternalKey': {
    zh: '外链导航项不能指定模块',
    en: 'External navigation items cannot specify a module',
  },
  'site.navExternalLabelLength': {
    zh: '外链导航名称需为 1–{max} 个字符',
    en: 'External navigation labels must be 1–{max} characters',
  },
  'site.navExternalUrlInvalid': {
    zh: '外链导航仅支持 http(s) 地址',
    en: 'External navigation only supports http(s) URLs',
  },
  'site.navExternalNewTab': {
    zh: '外链导航需说明是否新窗口打开',
    en: 'External navigation items must specify whether to open in a new tab',
  },
  'site.navExternalUrlDuplicate': { zh: '外链导航地址重复', en: 'Duplicate external navigation URL' },
  'site.navItemTypeInvalid': { zh: '导航条目类型不正确', en: 'Invalid navigation item type' },
  'site.navExternalTooMany': {
    zh: '外链导航最多 {max} 个',
    en: 'You can add up to {max} external navigation items',
  },
  'site.footerFormatInvalid': { zh: '页脚链接格式不正确', en: 'Invalid footer link format' },
  'site.footerTooMany': { zh: '页脚链接最多 {max} 个', en: 'You can add up to {max} footer links' },
  'site.footerLabelLength': {
    zh: '页脚链接名称需为 1–{max} 个字符',
    en: 'Footer link labels must be 1–{max} characters',
  },
  'site.footerUrlInvalid': {
    zh: '页脚链接仅支持站内路径或 http(s) 地址',
    en: 'Footer links only support on-site paths or http(s) URLs',
  },
  'site.footerNewTab': {
    zh: '页脚链接需说明是否新窗口打开',
    en: 'Footer links must specify whether to open in a new tab',
  },
  'site.footerUrlDuplicate': { zh: '页脚链接地址重复', en: 'Duplicate footer link URL' },
  'site.quotesFormatInvalid': { zh: '每日一言格式不正确', en: 'Invalid daily quotes format' },
  'site.quotesTooMany': { zh: '每日一言最多 {max} 条', en: 'You can add up to {max} daily quotes' },
  'site.quoteLength': {
    zh: '每日一言每条需为 1–{max} 个字符',
    en: 'Each daily quote must be 1–{max} characters',
  },
  'site.quotesDuplicate': { zh: '每日一言不能重复', en: 'Daily quotes cannot be duplicated' },
  'site.filingFormatInvalid': {
    zh: '备案号、备案链接或版权文案格式不正确',
    en: 'Invalid ICP number, ICP link, or copyright text',
  },
  'site.filingUrlInvalid': { zh: '备案链接仅支持 http(s) 地址', en: 'The ICP link only supports http(s) URLs' },
})
