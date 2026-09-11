/** @file legacy-content-package.mjs @description 维护回归显式构造v9之前的真实字段集，不放宽生产解析器 */
export function stripV9Fields(value) {
  delete value.omittedRelations
  for (const row of [...(value.posts ?? []), ...(value.projects ?? []), ...(value.gallery ?? [])]) delete row.values.relatedContent
  for (const asset of value.media ?? []) delete asset.description
  return value
}
