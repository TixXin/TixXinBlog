/** @file pageMotionRegions.ts @description 页面动效边界与请求级加载状态注入，不保存跨请求DOM */
import type { InjectionKey, Ref } from 'vue'

export const pageMotionPendingKey: InjectionKey<Ref<boolean>> = Symbol('page-motion-pending')

export function getPageMotionRegions(root: HTMLElement) {
  const structured = root.hasAttribute('data-page-frame')
  return {
    header: structured ? root.querySelector<HTMLElement>(':scope > [data-page-header]') : null,
    body: structured ? root.querySelector<HTMLElement>(':scope > [data-page-body-frame] > [data-page-body]')! : root,
    frame: structured ? root.querySelector<HTMLElement>(':scope > [data-page-body-frame]')! : root,
    headerKey: structured ? (root.dataset.pageHeaderKey ?? '') : '',
  }
}
