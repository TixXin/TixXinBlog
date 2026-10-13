/** @file legacy-content-package.mjs @description 维护回归显式构造v11之前的真实字段集，不放宽生产解析器 */
export function stripV11Fields(value) {
  delete value.subscriptions
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
