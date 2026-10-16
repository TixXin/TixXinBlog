/**
 * @file trustedProxy.ts
 * @description 从连接地址向外逐跳验证代理链，网关只向 API 转发重新计算的客户端地址。
 */
import { BlockList, isIP } from 'node:net'

export function createProxyTrust(config: string): (address: string) => boolean {
  const blockList = new BlockList()
  for (const entry of config
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)) {
    const [address = '', prefix, extra] = entry.split('/')
    const family = isIP(address)
    if (
      !family ||
      extra !== undefined ||
      (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) > (family === 4 ? 32 : 128)))
    ) {
      throw new Error('NUXT_TRUSTED_PROXY_CIDRS 必须是逗号分隔的 IP 地址或 CIDR')
    }
    const type = family === 4 ? 'ipv4' : 'ipv6'
    if (prefix === undefined) blockList.addAddress(address, type)
    else blockList.addSubnet(address, Number(prefix), type)
  }
  return (address) => {
    const family = isIP(address)
    return Boolean(family && blockList.check(address, family === 4 ? 'ipv4' : 'ipv6'))
  }
}

export function resolveProxyClientIp(
  remoteAddress: string | undefined,
  forwardedFor: string | undefined,
  trust: (address: string) => boolean,
): string {
  // 缺失连接地址时不能采用用户提交的头，也不捏造一个可信连接。
  const remote = remoteAddress && isIP(remoteAddress) ? remoteAddress : ''
  if (!remote || !trust(remote) || !forwardedFor) return remote
  const hops = forwardedFor.split(',').map((value) => value.trim())
  if (hops.some((value) => !isIP(value))) return remote
  let client = remote
  for (const hop of hops.reverse()) {
    if (!trust(client)) break
    client = hop
  }
  return client
}

/** 仅已存在的受管媒体读取可以保留后端的条件缓存头。 */
export function canCacheMediaResponse(path: string, method: string, status: number): boolean {
  return (
    ['GET', 'HEAD'].includes(method) &&
    [200, 304].includes(status) &&
    /^media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(path)
  )
}
