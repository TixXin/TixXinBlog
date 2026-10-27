/** @file backupRequest.ts @description 内容包请求的公共流程：认证恢复与 401 刷新、请求代次登记、失败提示与结束收尾 */
import type { BackupOwner, BackupSession } from './backupSession'

/** 带身份与内容库头发起请求；初次恢复身份可以绑定刚确认的账号，已有身份的请求禁止跨账号或跨代次继续 */
export async function authenticated<T>(
  s: BackupSession,
  owner: BackupOwner,
  send: (headers: Record<string, string>) => Promise<T>,
  refreshUnauthorized = true,
): Promise<T> {
  const restored = await s.auth.restore()
  const actor = s.auth.currentUser.value?.id
  if (
    !s.session.alive ||
    s.pageContext.value !== owner.context ||
    (owner.actor && (actor !== owner.actor || s.session.generation !== owner.generation))
  )
    throw s.ownershipError()
  if (!restored || !actor) throw new Error('请重新登录后重试')
  owner.actor = actor
  owner.generation = s.session.generation
  const attempt = async () => {
    s.assertOwner(owner)
    const value = await send({
      ...(s.auth.accessToken.value ? { Authorization: `Bearer ${s.auth.accessToken.value}` } : {}),
      ...(owner.context ? { 'X-Content-Context': owner.context } : {}),
    })
    s.assertOwner(owner)
    return value
  }
  try {
    return await attempt()
  } catch (cause) {
    if (refreshUnauthorized && (cause as { statusCode?: number })?.statusCode === 401) {
      s.assertOwner(owner)
      const refreshed = await s.auth.refresh()
      s.assertOwner(owner)
      if (refreshed) return attempt()
    }
    throw cause
  }
}

export function begin(s: BackupSession, sideEffect = true) {
  s.pending.value = true
  s.guarded.value = sideEffect
  s.error.value = ''
  return { owner: s.captureOwner(), version: ++s.session.operation }
}

export async function fail(
  s: BackupSession,
  cause: unknown,
  fallbackKey: string,
  { owner, version }: { owner: BackupOwner; version: number },
) {
  let message = s.detail(cause, fallbackKey)
  const blob = (cause as { data?: unknown })?.data
  if (blob instanceof Blob && s.owns(owner)) {
    try {
      const parsed = JSON.parse(await blob.text()) as { message?: unknown }
      if (typeof parsed.message === 'string') message = parsed.message
    } catch {
      /* Blob 错误无法解码时使用固定提示，保留文件及票据。 */
    }
  }
  if (s.session.alive && version === s.session.operation) s.error.value = s.owns(owner) ? message : s.ownershipMessage()
}

export function finish(s: BackupSession, version: number) {
  if (s.session.alive && version === s.session.operation) s.pending.value = s.guarded.value = false
}
