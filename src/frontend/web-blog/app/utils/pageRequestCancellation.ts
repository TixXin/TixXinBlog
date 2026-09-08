/**
 * @file pageRequestCancellation.ts
 * @description 页面所有者销毁产生的预期取消，区别于仍活动页面的真实请求失败
 * @author TixXin
 * @since 2026-09-08
 */
const cancellation = Symbol.for('tixxin.page-request-cancelled')

export class PageRequestCancellation extends Error {
  readonly [cancellation] = true
  constructor() {
    super('页面已离开，停止后续初始化')
    this.name = 'PageRequestCancellation'
  }
}

export function isPageRequestCancellation(error: unknown) {
  return !!error && typeof error === 'object' && Reflect.get(error, cancellation) === true
}
