/**
 * @file requestIdentity.ts
 * @description 访客 IP 的统一来源：外部请求按可信代理解析，SSR 期间的内部调用通过 AsyncLocalStorage 沿用外部请求的登记
 * @author TixXin
 * @since 2026-10-16
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { getHeader, type H3Event } from 'h3'
import { createProxyTrust, resolveProxyClientIp } from './trustedProxy'

export interface RequestIdentity {
  clientIp: string
}

const storage = new AsyncLocalStorage<RequestIdentity>()
let proxyTrustConfig: string | undefined
let proxyTrust = createProxyTrust('')

/** 外部请求进入时登记；SSR 渲染及其发起的内部 fetch 都是该请求的异步后代，能读到同一份身份 */
export function enterRequestIdentity(identity: RequestIdentity) {
  storage.enterWith(identity)
}

export function currentRequestIdentity(): RequestIdentity | undefined {
  return storage.getStore()
}

/** Nitro 的内部调用使用模拟 socket，远端地址为空字符串；真实网络请求总有远端地址 */
export function isInternalRequest(remoteAddress: string | undefined): boolean {
  return !remoteAddress
}

/** 按运行时配置的可信代理从连接地址与 X-Forwarded-For 解析访客 IP；配置变化时重建信任表 */
export function resolveEventClientIp(event: H3Event): string {
  const trustConfig = String(useRuntimeConfig(event).trustedProxyCidrs || '')
  if (proxyTrustConfig !== trustConfig) {
    proxyTrust = createProxyTrust(trustConfig)
    proxyTrustConfig = trustConfig
  }
  return resolveProxyClientIp(event.node.req.socket?.remoteAddress, getHeader(event, 'x-forwarded-for'), proxyTrust)
}

/**
 * 当前事件应转发给后端的访客 IP：
 * - 外部请求直接解析；
 * - 内部调用（SSR 期间的 API 读取）沿用外部请求登记的身份，没有登记时保持空串，不捏造地址。
 */
export function clientIpForUpstream(event: H3Event): string {
  if (!isInternalRequest(event.node.req.socket?.remoteAddress)) return resolveEventClientIp(event)
  return currentRequestIdentity()?.clientIp ?? ''
}
