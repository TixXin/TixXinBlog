/**
 * @file 00.request-identity.ts
 * @description 每个外部请求先解析访客 IP 并登记，SSR 内部调用后端时沿用，不再以服务器自身地址计入限流
 * @author TixXin
 * @since 2026-10-16
 */
import { enterRequestIdentity, isInternalRequest, resolveEventClientIp } from '../utils/requestIdentity'

export default defineEventHandler((event) => {
  // 内部调用是外部请求的异步后代，保留外部请求登记的身份，不要用空地址覆盖
  if (isInternalRequest(event.node.req.socket?.remoteAddress)) return
  enterRequestIdentity({ clientIp: resolveEventClientIp(event) })
})
