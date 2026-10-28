/**
 * @file securityHeaders.ts
 * @description 公开页面统一下发的安全响应头；服务器部署由 Nitro routeRules 下发，静态发布由构建脚本写入 _headers 与 edgeone.json。
 *   只含纯数据，供 nuxt.config.ts 与 scripts/static/ 共用。
 */
export function securityHeaders(production: boolean): Record<string, string> {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      // useMockRepo=false 时浏览器需直连后端 API，把 API origin 加入 connect-src 白名单
      "connect-src 'self'",
      "frame-ancestors 'none'",
      // 站点不使用插件、内嵌框架与跨站表单；统计脚本来源由 server/plugins/csp-analytics.ts 在运行时追加
      "object-src 'none'",
      // 开发模式的错误详情浮层通过 data: iframe 展示堆栈，仅开发放行；生产仍禁止内嵌框架
      production ? "frame-src 'none'" : "frame-src 'self' data:",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  }
}
