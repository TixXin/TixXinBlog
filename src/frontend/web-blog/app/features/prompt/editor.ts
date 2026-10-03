/** @file editor.ts @description 提示词编辑白名单、来源互斥及本标签页恢复格式 */
import type { PromptForm } from './types'
export function promptForm(
  value: Partial<Omit<PromptForm, 'externalImageUrl'>> & { externalImageUrl?: string | null } = {},
): PromptForm {
  return {
    title: value.title ?? '',
    description: value.description ?? '',
    prompt: value.prompt ?? '',
    negativePrompt: value.negativePrompt ?? '',
    model: value.model ?? '',
    tags: [...(value.tags ?? [])],
    imageSource: value.imageSource ?? (value.externalImageUrl ? 'external' : 'media'),
    mediaId: value.mediaId ?? null,
    externalImageUrl: value.externalImageUrl ?? '',
    imageAlt: value.imageAlt ?? '',
    sourceUrl: value.sourceUrl ?? '',
    status: value.status ?? 'draft',
  }
}
export function promptPayload(value: PromptForm) {
  const { imageSource, ...body } = promptForm(value)
  return {
    ...body,
    mediaId: imageSource === 'media' ? body.mediaId : null,
    externalImageUrl: imageSource === 'external' ? body.externalImageUrl.trim() : null,
  }
}
export function promptUrlError(value: string) {
  try {
    const input = value.trim()
    if (!/^https?:\/\/[^/]/i.test(input) || /[\\\s]/u.test(input)) throw new Error('invalid')
    const url = new URL(input)
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return ''
  } catch {
    /* 保留用户原始输入，提交前提示格式。 */
  }
  return '请填写完整的 HTTP(S) 地址，不含账号或密码。'
}
export const promptFieldLimits = {
  title: 160,
  description: 2000,
  prompt: 30000,
  negativePrompt: 10000,
  model: 80,
  imageAlt: 240,
  externalImageUrl: 2048,
  sourceUrl: 2048,
} as const
export function promptFormErrors(form: PromptForm): Partial<Record<keyof PromptForm, string>> {
  const errors: Partial<Record<keyof PromptForm, string>> = {}
  if (!form.title.trim()) errors.title = '为这份灵感取一个标题。'
  if (!form.prompt.trim()) errors.prompt = '请填写完整的图片提示词。'
  if (form.imageSource === 'media' && !form.mediaId) errors.mediaId = '请先选择一张效果图片。'
  if (form.imageSource === 'external' && promptUrlError(form.externalImageUrl))
    errors.externalImageUrl = promptUrlError(form.externalImageUrl)
  if (form.sourceUrl.trim() && promptUrlError(form.sourceUrl))
    errors.sourceUrl = '来源链接：' + promptUrlError(form.sourceUrl)
  if (form.tags.length > 12 || form.tags.some((tag) => !tag.trim() || tag.trim().length > 32))
    errors.tags = '最多填写 12 个标签，每个不超过 32 字。'
  const labels = {
    title: '标题',
    description: '创作笔记',
    prompt: '完整提示词',
    negativePrompt: '负面提示词',
    model: '生成模型',
    imageAlt: '图片描述',
    externalImageUrl: '图片地址',
    sourceUrl: '来源链接',
  }
  // HTML maxlength不能约束恢复副本和程序赋值；按服务端UTF-16边界验证，保留全文供用户调整。
  for (const field of Object.keys(promptFieldLimits) as (keyof typeof promptFieldLimits)[]) {
    if (field === 'externalImageUrl' && form.imageSource !== 'external') continue
    if (form[field].trim().length > promptFieldLimits[field])
      errors[field] = `${labels[field]}最多 ${promptFieldLimits[field]} 字，请精简后保存。`
  }
  return errors
}
export function promptFormError(form: PromptForm) {
  return Object.values(promptFormErrors(form))[0] ?? ''
}
export interface PromptRecovery {
  version: 1
  context: string
  id: number | null
  revision: number | null
  requestId: string
  form: PromptForm
  pendingCreate: PromptForm | null
  savedAt: string
}
export function parsePromptRecovery(raw: string | null): PromptRecovery | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as PromptRecovery
    const validForm = (form: PromptForm) =>
      form &&
      ['draft', 'published'].includes(form.status) &&
      ['media', 'external'].includes(form.imageSource) &&
      ['title', 'description', 'prompt', 'negativePrompt', 'model', 'externalImageUrl', 'imageAlt', 'sourceUrl'].every(
        (key) => typeof form[key as keyof PromptForm] === 'string',
      ) &&
      (form.mediaId === null || typeof form.mediaId === 'string') &&
      Array.isArray(form.tags) &&
      form.tags.every((tag) => typeof tag === 'string')
    if (
      value.version !== 1 ||
      typeof value.context !== 'string' ||
      typeof value.requestId !== 'string' ||
      !value.requestId ||
      typeof value.savedAt !== 'string' ||
      (value.id !== null && (!Number.isSafeInteger(value.id) || value.id <= 0)) ||
      (value.revision !== null && (!Number.isSafeInteger(value.revision) || value.revision < 0)) ||
      !validForm(value.form) ||
      (value.pendingCreate !== null && !validForm(value.pendingCreate))
    )
      return null
    return {
      ...value,
      form: promptForm(value.form),
      pendingCreate: value.pendingCreate ? promptForm(value.pendingCreate) : null,
    }
  } catch {
    return null
  }
}
