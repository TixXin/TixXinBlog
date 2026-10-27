/** @file useLinkApplicationActions.ts @description 友链申请的通过与拒绝；通过后记录新建草稿编号，结果只写回仍属于当前页面的状态 */
import type { Ref } from 'vue'
import type { LinkApplication } from '~/features/link/types'
import { failureText } from '~/features/link/requestFailure'
type Decision = 'approve' | 'reject'
const decisionKeys: Record<Decision, { confirm: string; done: string }> = {
  approve: {
    confirm: 'admin-media.linkApplications.approveConfirm',
    done: 'admin-media.linkApplications.approved',
  },
  reject: {
    confirm: 'admin-media.linkApplications.rejectConfirm',
    done: 'admin-media.linkApplications.rejected',
  },
}
export function useLinkApplicationActions(list: {
  pending: Ref<boolean>
  error: Ref<string>
  notice: Ref<string>
  load: () => Promise<void>
}) {
  const applications = useLinkApplicationRepository(),
    scope = useAdminActionScope(),
    t = currentTranslate()
  const busy = ref<string[]>([]),
    /** 本次会话中刚通过的申请对应的友链草稿编号 */
    approvedLinks = ref<Record<string, number>>({})
  async function run(item: LinkApplication, decision: Decision) {
    if (decision === 'reject') return void (await applications.reject(item.id))
    const result = await applications.approve(item.id)
    approvedLinks.value = { ...approvedLinks.value, [item.id]: result.link.id }
  }
  async function decide(item: LinkApplication, decision: Decision) {
    if (busy.value.includes(item.id) || list.pending.value) return
    if (!window.confirm(t(decisionKeys[decision].confirm, { name: item.name }))) return
    const valid = scope.capture()
    busy.value = [...busy.value, item.id]
    list.error.value = ''
    list.notice.value = ''
    try {
      await run(item, decision)
      if (!valid()) return
      list.notice.value = t(decisionKeys[decision].done, { name: item.name })
      await list.load()
    } catch (cause) {
      if (valid()) list.error.value = failureText(cause, t('admin-media.linkApplications.decideFailed'))
    } finally {
      busy.value = busy.value.filter((id) => id !== item.id)
    }
  }
  return { busy, approvedLinks, decide }
}
