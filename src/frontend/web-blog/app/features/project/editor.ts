/** @file editor.ts @description 项目编辑字段白名单、链接标签约束与绑定内容上下文的恢复副本 */
import { projectLinkLabels, projectProgressLabels, projectStatusLabels, projectTagColors } from './types'
import type { ManagedProject, ProjectEditable } from './types'
export function projectForm(project?: Partial<ManagedProject>): ProjectEditable {
  return {
    title: project?.title ?? '',
    description: project?.description ?? '',
    coverMediaId: project?.coverMediaId ?? null,
    progress: project?.progress ?? 'dev',
    status: project?.status ?? 'draft',
    sortOrder: project?.sortOrder ?? 0,
    tags: project?.tags?.map(({ label, color }) => ({ label, color })) ?? [],
    links: project?.links?.map(({ kind, href }) => ({ kind, href })) ?? [],
  }
}
export interface ProjectRecovery {
  version: 1
  context: string
  id: number | null
  revision: number | null
  requestId: string
  form: ProjectEditable
  pendingCreate: ProjectEditable | null
  savedAt: string
}
export function validProjectForm(value: unknown): value is ProjectEditable {
  if (!value || typeof value !== 'object') return false
  const v = value as ProjectEditable
  return (
    typeof v.title === 'string' &&
    v.title.length <= 160 &&
    typeof v.description === 'string' &&
    v.description.length <= 5000 &&
    (v.coverMediaId === null || (typeof v.coverMediaId === 'string' && /^[0-9a-f-]{36}$/i.test(v.coverMediaId))) &&
    Object.hasOwn(projectProgressLabels, v.progress) &&
    Object.hasOwn(projectStatusLabels, v.status) &&
    Number.isInteger(v.sortOrder) &&
    Math.abs(v.sortOrder) <= 1000000 &&
    Array.isArray(v.tags) &&
    v.tags.length <= 20 &&
    v.tags.every(
      (tag) => tag && typeof tag.label === 'string' && tag.label.length <= 40 && projectTagColors.includes(tag.color),
    ) &&
    Array.isArray(v.links) &&
    v.links.length <= 4 &&
    v.links.every(
      (link) =>
        link &&
        Object.hasOwn(projectLinkLabels, link.kind) &&
        typeof link.href === 'string' &&
        link.href.length <= 2048,
    )
  )
}
export function parseProjectRecovery(raw: string | null): ProjectRecovery | null {
  if (!raw || raw.length > 100000) return null
  try {
    const v = JSON.parse(raw) as ProjectRecovery
    if (
      v.version !== 1 ||
      typeof v.context !== 'string' ||
      v.context.length > 200 ||
      typeof v.requestId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(v.requestId) ||
      typeof v.savedAt !== 'string' ||
      (v.id !== null && (!Number.isSafeInteger(v.id) || v.id < 1)) ||
      (v.revision !== null && (!Number.isSafeInteger(v.revision) || v.revision < 0)) ||
      !validProjectForm(v.form) ||
      (v.pendingCreate !== null && !validProjectForm(v.pendingCreate))
    )
      return null
    return {
      version: 1,
      context: v.context,
      id: v.id,
      revision: v.revision,
      requestId: v.requestId,
      form: projectForm(v.form),
      pendingCreate: v.pendingCreate ? projectForm(v.pendingCreate) : null,
      savedAt: v.savedAt,
    }
  } catch {
    return null
  }
}
