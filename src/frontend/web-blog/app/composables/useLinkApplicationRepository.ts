/** @file useLinkApplicationRepository.ts @description 友链申请仓储：访客提交携带内容上下文，审核走博主接口，失败不回退样本 */
import type { LinkApplication, LinkApplicationInput, LinkApplicationPage, ManagedLink } from '~/features/link/types'
import type { VisitorSubmissionFields } from '~/features/visitor/types'
import { linkRequestFailure } from '~/features/link/requestFailure'
export function useLinkApplicationRepository() {
  const base = String(useRuntimeConfig().public.apiBaseUrl).replace(/\/$/, ''),
    admin = useAdminApi(),
    contentContext = useState('page-content-context', () => ''),
    t = currentTranslate()
  // 内容库恢复后旧页面的提交会被服务端拒绝，避免申请落到错误的内容库。
  async function apply(body: LinkApplicationInput & VisitorSubmissionFields) {
    try {
      const result = await $fetch<{ code: number; data: { requestId: string } }>(base + '/links/applications', {
        method: 'POST',
        body: { ...body, contact: body.contact || null },
        headers: contentContext.value ? { 'X-Content-Context': contentContext.value } : {},
        timeout: 10000,
        retry: 0,
      })
      if (result.code !== 0) throw new Error(t('interaction.links.requestIncomplete'))
      return result.data
    } catch (cause) {
      throw linkRequestFailure(cause, t)
    }
  }
  async function manage<T>(path: string, options?: Parameters<typeof admin>[1]): Promise<T> {
    try {
      return await admin<T>(path, options)
    } catch (cause) {
      throw linkRequestFailure(cause, t)
    }
  }
  return {
    apply,
    list: (query: { status: string; page: number }) =>
      manage<LinkApplicationPage>('/admin/links/applications', { query: { ...query } }),
    approve: (id: string) =>
      manage<{ application: LinkApplication; link: ManagedLink }>(`/admin/links/applications/${id}/approve`, {
        method: 'POST',
      }),
    reject: (id: string) =>
      manage<{ application: LinkApplication }>(`/admin/links/applications/${id}/reject`, { method: 'POST' }),
  }
}
