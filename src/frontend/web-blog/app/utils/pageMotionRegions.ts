/** @file pageMotionRegions.ts @description 页面动效边界，不保存跨请求DOM */

export function getPageMotionRegions(root: HTMLElement) {
  const structured = root.hasAttribute('data-page-frame')
  return {
    header: structured ? root.querySelector<HTMLElement>(':scope > [data-page-header]') : null,
    body: structured ? root.querySelector<HTMLElement>(':scope > [data-page-body-frame] > [data-page-body]')! : root,
    frame: structured ? root.querySelector<HTMLElement>(':scope > [data-page-body-frame]')! : root,
    headerKey: structured ? (root.dataset.pageHeaderKey ?? '') : '',
  }
}
