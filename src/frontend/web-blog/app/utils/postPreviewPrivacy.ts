/** @file postPreviewPrivacy.ts @description 草稿预览的页面边界，隔离第三方自动统计与普通页面运行环境 */

export function isPostPreviewPath(path: string): boolean {
  return path.replace(/\/+$/, '') === '/posts/preview'
}
