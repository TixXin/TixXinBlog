/** @file client-error-report.ts @description 客户端错误日志的地址识别与防御性脱敏。 */

/** Express 默认不区分路由大小写，并接受尾斜线，日志和限流须覆盖相同入口。 */
export function isClientErrorPath(path: string): boolean {
  return /^\/api\/v1\/client-errors\/?$/i.test(path)
}

/** 保守移除全部查询与片段，兼容堆栈中的相对地址；随后移除凭据和日志控制字符。 */
export function sanitizeClientErrorText(value: string): string {
  return value
    .replace(/[?#][^\s"'<>`]*/g, '')
    .replace(/((?:https?:)?\/\/)[^\s/"'<>`]*@/gi, '$1')
    .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, ' ')
}

/** 页面地址仅保留协议、主机和路径，不记录查询、片段或 URL 内嵌凭据。 */
export function sanitizeClientErrorUrl(value: string): string {
  const url = new URL(value)
  // URL 会把 Unicode 路径转成百分号编码，再次裁切以维持日志的长度上限。
  return sanitizeClientErrorText(`${url.origin}${url.pathname}`).slice(0, 2048)
}
