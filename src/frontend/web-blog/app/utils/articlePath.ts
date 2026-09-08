/**
 * @file articlePath.ts
 * @description 公开文章地址的单一生成规则，保留数字 ID 作为兼容后备。
 */
export function articlePath(post: { id: string | number; slug?: string }): string {
  return `/articles/${encodeURIComponent(post.slug || String(post.id))}`
}
