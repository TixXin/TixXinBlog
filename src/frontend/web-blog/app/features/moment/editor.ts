/** @file editor.ts @description 动态编辑字段白名单与本标签页恢复副本校验 */
import type { MomentEditable, ManagedMoment } from './types'

export function momentForm(note?: ManagedMoment): MomentEditable {
  return {
    content: note?.content ?? '',
    topics: [...(note?.topics ?? [])],
    images: [...(note?.images ?? [])],
    location: note?.location ?? '',
    device: note?.device ?? '',
    mood: note?.mood ?? '',
    linkedArticleId: note?.linkedArticleId ?? null,
    linkedLink: note?.linkedLink ? { ...note.linkedLink } : null,
    status: note?.status ?? 'draft',
    isPinned: note?.isPinned ?? false,
  }
}
export interface MomentRecovery {
  version: 1
  id: string | null
  revision: number | null
  requestId: string
  form: MomentEditable
  savedAt: string
}
export function parseMomentRecovery(raw: string | null): MomentRecovery | null {
  if (!raw || raw.length > 60000) return null
  try {
    const value = JSON.parse(raw) as MomentRecovery
    if (
      value.version !== 1 ||
      typeof value.requestId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(value.requestId) ||
      (value.id !== null && typeof value.id !== 'string') ||
      (value.revision !== null && (!Number.isInteger(value.revision) || value.revision < 0))
    )
      return null
    const form = value.form
    if (
      !form ||
      typeof form.content !== 'string' ||
      form.content.length > 10000 ||
      !['draft', 'published', 'archived'].includes(form.status) ||
      typeof form.isPinned !== 'boolean'
    )
      return null
    if (
      !Array.isArray(form.images) ||
      form.images.length > 9 ||
      !form.images.every((url) => typeof url === 'string' && url.length <= 2048)
    )
      return null
    if (
      !Array.isArray(form.topics) ||
      form.topics.length > 10 ||
      !form.topics.every((topic) => typeof topic === 'string' && topic.length <= 40)
    )
      return null
    if (![form.location, form.device, form.mood].every((text) => typeof text === 'string' && text.length <= 160))
      return null
    if (form.linkedArticleId !== null && (!Number.isInteger(form.linkedArticleId) || form.linkedArticleId < 1))
      return null
    if (form.linkedLink && (typeof form.linkedLink.url !== 'string' || typeof form.linkedLink.title !== 'string'))
      return null
    const linked = form.linkedLink
    if (
      linked &&
      [linked.description, linked.image, linked.siteName, linked.favicon].some(
        (item) => item !== undefined && typeof item !== 'string',
      )
    )
      return null
    return {
      version: 1,
      id: value.id,
      revision: value.revision,
      requestId: value.requestId,
      savedAt: value.savedAt,
      form: {
        content: form.content,
        topics: [...form.topics],
        images: [...form.images],
        location: form.location,
        device: form.device,
        mood: form.mood,
        status: form.status,
        isPinned: form.isPinned,
        linkedArticleId: form.linkedArticleId,
        linkedLink: linked
          ? {
              url: linked.url,
              title: linked.title,
              description: linked.description,
              image: linked.image,
              siteName: linked.siteName,
              favicon: linked.favicon,
            }
          : null,
      },
    }
  } catch {
    return null
  }
}
