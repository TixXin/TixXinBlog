/** @file links.ts @description 关于页外链属性：网页主页新标签打开并声明 rel="me"，mailto 等在当前页交给系统处理 */
import { isWebProfile } from './settings'

/** 社交主页与联系方式链接的属性；网页地址带 rel="me"，声明与本站属于同一身份 */
export function externalLinkAttrs(href: string, identity = true): Record<string, string> {
  if (!isWebProfile(href)) return {}
  return { target: '_blank', rel: identity ? 'me noopener' : 'noopener' }
}
