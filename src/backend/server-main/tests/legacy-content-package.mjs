/** @file legacy-content-package.mjs @description 维护回归显式构造v20之前的真实字段集，不放宽生产解析器 */
export function stripV20Fields(value) {
  // v20 才引入的订阅暂停区间、套餐名与付款方式：旧包必须显式移除，解析器按缺省值读取。
  for (const row of value.subscriptions ?? []) {
    delete row.values.pausedPeriods
    delete row.values.planName
    delete row.values.paymentMethod
  }
  return value
}
export function stripV19Fields(value) {
  stripV20Fields(value)
  // v19 才引入的朋友圈评论回复关系：旧包必须显式移除，解析器按 null 读取。
  for (const note of value.moments ?? []) for (const comment of note.comments ?? []) delete comment.replyToId
  return value
}
export function stripV18Fields(value) {
  stripV19Fields(value)
  // v18 才引入的订阅试用到期日与结束日：旧包必须显式移除，解析器按 null 读取。
  for (const row of value.subscriptions ?? []) {
    delete row.values.trialEndDate
    delete row.values.endDate
  }
  return value
}
export function stripV17Fields(value) {
  stripV18Fields(value)
  // v17 才引入的关于页字段：条目链接与英文资料、“现在”与“装备与工具”栏目、更新日期、本站信息开关与支持方式。
  const about = value.site?.about
  if (about) {
    for (const key of ['en', 'showSiteInfo', 'support']) delete about[key]
    about.sections = (about.sections ?? []).filter((section) => !['now', 'uses'].includes(section.kind))
    for (const section of about.sections) {
      delete section.updatedAt
      for (const item of section.items ?? []) {
        delete item.url
        delete item.en
      }
    }
  }
  return value
}
export function stripV16Fields(value) {
  stripV17Fields(value)
  // v16 才引入的站点时区：旧包必须显式移除，迁入设置时沿用目标站现值。
  if (value.site) delete value.site.timeZone
  return value
}
export function stripV15Fields(value) {
  stripV16Fields(value)
  // v15 才引入的手动状态到期时间：旧包必须显式移除，迁入设置时沿用目标站现值。
  if (value.site) delete value.site.presenceExpiresAt
  return value
}
export function stripV14Fields(value) {
  stripV15Fields(value)
  // v14 才引入的搜索引擎收录开关：旧包必须显式移除，解析器按允许收录读取。
  if (value.site) delete value.site.searchIndexing
  return value
}
export function stripV13Fields(value) {
  stripV14Fields(value)
  // v13 才引入的闪念评论审核状态：旧包必须显式移除，解析器按已发布读取。
  for (const flash of value.flashes ?? []) for (const comment of flash.comments ?? []) delete comment.status
  return value
}
export function stripV12Fields(value) {
  stripV13Fields(value)
  // v12 才引入的站点导航、页脚、每日一言、备案与版权：旧包必须显式移除。
  for (const key of ['navigation', 'footerLinks', 'quotes', 'icpNumber', 'icpUrl', 'copyright'])
    if (value.site) delete value.site[key]
  return value
}
export function stripV11Fields(value) {
  stripV12Fields(value)
  delete value.subscriptions
  // v11 才引入的标量字段：旧包必须显式移除，解析器才应接受。
  for (const key of ['presenceLabel', 'presenceSignature', 'presenceStatus', 'launchedAt'])
    if (value.site) delete value.site[key]
  for (const row of value.guestbook ?? []) {
    delete row.browser
    delete row.region
  }
  return value
}
export function stripV10Fields(value) {
  stripV11Fields(value)
  delete value.prompts
  return value
}
export function stripV9Fields(value) {
  stripV10Fields(value)
  delete value.omittedRelations
  for (const row of [...(value.posts ?? []), ...(value.projects ?? []), ...(value.gallery ?? [])])
    delete row.values.relatedContent
  for (const asset of value.media ?? []) delete asset.description
  return value
}
