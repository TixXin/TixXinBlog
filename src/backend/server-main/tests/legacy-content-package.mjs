/** @file legacy-content-package.mjs @description 维护回归显式构造v13之前的真实字段集，不放宽生产解析器 */
export function stripV13Fields(value) {
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
