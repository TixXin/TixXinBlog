/**
 * @file useCommentPolicy.ts
 * @description 文章评论审核策略：读取与按版本保存「新游客评论需审核」，dirty 标记供页面做离开确认
 * @author TixXin
 * @since 2026-10-20
 */
export interface CommentPolicy {
  requireApproval: boolean
  revision: number
}

export function useCommentPolicy() {
  const { t } = useI18n()
  const api = useAdminApi()
  const { success } = useToast()
  const policy = ref<CommentPolicy | null>(null)
  const requireApproval = ref(false)
  const pending = ref(false)
  const error = ref('')
  const dirty = computed(() => !!policy.value && requireApproval.value !== policy.value.requireApproval)

  async function load() {
    if (pending.value) return
    pending.value = true
    error.value = ''
    try {
      const latest = await api<CommentPolicy>('/admin/comments/policy')
      policy.value = latest
      requireApproval.value = latest.requireApproval
    } catch {
      error.value = t('admin-content.comments.policy.loadFailed')
    } finally {
      pending.value = false
    }
  }
  async function save() {
    if (!policy.value || pending.value) return
    pending.value = true
    error.value = ''
    try {
      policy.value = await api<CommentPolicy>('/admin/comments/policy', {
        method: 'PATCH',
        body: { requireApproval: requireApproval.value, revision: policy.value.revision },
      })
      success(t('admin-content.comments.policy.saved'))
    } catch (cause) {
      error.value = apiErrorMessage(cause, 'admin-content.comments.policy.saveFailed')
    } finally {
      pending.value = false
    }
  }
  return { policy, requireApproval, pending, error, dirty, load, save }
}
