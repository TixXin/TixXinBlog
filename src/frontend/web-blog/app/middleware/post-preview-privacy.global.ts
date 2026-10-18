/** @file post-preview-privacy.global.ts @description 进入或离开草稿预览时重建文档，防止已有统计脚本读取预览令牌 */
import { isPostPreviewPath } from '~/utils/postPreviewPrivacy'

export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server || useNuxtApp().isHydrating || isPostPreviewPath(to.path) === isPostPreviewPath(from.path))
    return
  // 已执行的统计脚本无法仅靠移除 script 标签撤销；在路由提交前通过整页导航隔离。
  return navigateTo(to.fullPath, { external: true })
})
