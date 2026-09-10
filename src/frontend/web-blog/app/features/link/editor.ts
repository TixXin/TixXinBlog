/** @file editor.ts @description 友链编辑白名单与恢复输入校验，未完成 URL 保留给用户继续修改 */
import { linkStatusLabels } from './types'
import type { LinkEditable, ManagedLink } from './types'
export function linkForm(link?: Partial<ManagedLink>): LinkEditable {
  return {
    name: link?.name ?? '',
    description: link?.description ?? '',
    url: link?.url ?? '',
    logoMediaId: link?.logoMediaId ?? null,
    logoUrl: link?.logoUrl ?? null,
    status: link?.status ?? 'draft',
    isFeatured: link?.isFeatured ?? false,
    sortOrder: link?.sortOrder ?? 0,
  }
}
export interface LinkRecovery {
  version: 1
  context: string
  id: number | null
  revision: number | null
  requestId: string
  form: LinkEditable
  pendingCreate: LinkEditable | null
  savedAt: string
}
export function validLinkForm(value: unknown): value is LinkEditable {
  if (!value || typeof value !== 'object') return false
  const v = value as LinkEditable
  return (
    typeof v.name === 'string' &&
    v.name.length <= 80 &&
    typeof v.description === 'string' &&
    v.description.length <= 300 &&
    typeof v.url === 'string' &&
    v.url.length <= 2048 &&
    (v.logoMediaId === null || (typeof v.logoMediaId === 'string' && /^[a-f0-9-]{36}$/i.test(v.logoMediaId))) &&
    (v.logoUrl === null || (typeof v.logoUrl === 'string' && v.logoUrl.length <= 2048)) &&
    Object.hasOwn(linkStatusLabels, v.status) &&
    typeof v.isFeatured === 'boolean' &&
    Number.isInteger(v.sortOrder) &&
    Math.abs(v.sortOrder) <= 1000000
  )
}
export function parseLinkRecovery(raw: string | null): LinkRecovery | null {
  if (!raw || raw.length > 100000) return null
  try {
    const value = JSON.parse(raw) as LinkRecovery
    if (
      value.version !== 1 ||
      typeof value.context !== 'string' ||
      value.context.length > 200 ||
      typeof value.requestId !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(value.requestId) ||
      typeof value.savedAt !== 'string' ||
      (value.id !== null && (!Number.isSafeInteger(value.id) || value.id < 1)) ||
      (value.revision !== null && (!Number.isSafeInteger(value.revision) || value.revision < 0)) ||
      !validLinkForm(value.form) ||
      (value.pendingCreate !== null && !validLinkForm(value.pendingCreate))
    )
      return null
    return {
      version: 1,
      context: value.context,
      id: value.id,
      revision: value.revision,
      requestId: value.requestId,
      savedAt: value.savedAt,
      form: linkForm(value.form),
      pendingCreate: value.pendingCreate ? linkForm(value.pendingCreate) : null,
    }
  } catch {
    return null
  }
}
