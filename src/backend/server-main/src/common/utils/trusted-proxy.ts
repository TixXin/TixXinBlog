/**
 * @file trusted-proxy.ts
 * @description 只接受显式 IP/CIDR 的代理信任配置，不允许命名网段或全局布尔开关。
 */
import { isIP } from 'node:net'

export function parseTrustedProxyCidrs(value: string | undefined): string[] {
  const entries = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  for (const entry of entries) {
    const [address = '', prefix, extra] = entry.split('/')
    const family = isIP(address)
    if (
      !family ||
      extra !== undefined ||
      (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) > (family === 4 ? 32 : 128)))
    )
      throw new Error('TRUSTED_PROXY_CIDRS 必须是逗号分隔的 IP 地址或 CIDR')
  }
  return entries
}
