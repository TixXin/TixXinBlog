/** @file data-source.get.ts @description 仅本机开发检查使用的上游身份，确认实际网关数据库，不开放公共代理通道 */
export default defineEventHandler(async (event) => {
  const address = event.node.req.socket.remoteAddress ?? getRequestIP(event, { xForwardedFor: true })
  if (!import.meta.dev || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? ''))
    throw createError({ statusCode: 404 })
  try {
    const config = useRuntimeConfig(event)
    const value = await $fetch<
      | { service: string; workspace: string; database: string }
      | { data: { service: string; workspace: string; database: string } }
    >(String(config.apiBaseUrl).replace(/\/$/, '') + '/dev/identity', { timeout: 1500, retry: 0 })
    const identity = 'data' in value ? value.data : value
    if (
      identity.service !== 'server-main' ||
      !/^[a-f0-9]{64}$/.test(identity.workspace) ||
      !/^[a-f0-9]{64}$/.test(identity.database)
    )
      throw new Error('invalid upstream')
    return { service: identity.service, workspace: identity.workspace, database: identity.database }
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Development API identity unavailable' })
  }
})
