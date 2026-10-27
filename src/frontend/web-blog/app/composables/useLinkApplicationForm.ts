/** @file useLinkApplicationForm.ts @description 公开友链申请表单的提交流程；失败保留输入，成功只展示申请编号 */
import type { LinkApplicationInput } from '~/features/link/types'
import { emptyLinkApplication, linkApplicationValid, trimLinkApplication } from '~/features/link/application'
export function useLinkApplicationForm() {
  const repo = useLinkApplicationRepository(),
    t = currentTranslate()
  const draft = ref<LinkApplicationInput>(emptyLinkApplication()),
    submitting = ref(false),
    error = ref(''),
    requestId = ref('')
  const visitor = useVisitorSubmissionForm({
    submitting: () => submitting.value,
    error: () => error.value || undefined,
  })
  const valid = computed(() => linkApplicationValid(draft.value))
  function change(patch: Partial<LinkApplicationInput>) {
    draft.value = { ...draft.value, ...patch }
  }
  async function submit() {
    if (submitting.value || !valid.value) return
    submitting.value = true
    error.value = ''
    try {
      const result = await repo.apply({ ...trimLinkApplication(draft.value), ...visitor.fields() })
      requestId.value = result.requestId
      draft.value = emptyLinkApplication()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : t('interaction.linkApplication.failed')
    } finally {
      submitting.value = false
    }
  }
  /** 继续提交另一个站点时重新开始计时 */
  function again() {
    requestId.value = ''
    error.value = ''
    visitor.restart()
  }
  return { draft, website: visitor.website, submitting, error, requestId, valid, change, submit, again }
}
