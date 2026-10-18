/**
 * @file types.ts
 * @description 客户端错误上报的最小公开契约，不携带账号、组件实例或请求正文
 */

export type ClientErrorSource = 'vue' | 'window' | 'unhandledrejection'

export interface ClientErrorReport {
  source: ClientErrorSource
  message: string
  url: string
  stack?: string
  info?: string
}
