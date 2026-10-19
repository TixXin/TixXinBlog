/** @file usePostPreviewLink.ts @description 草稿分享链接的签发与复制，仅保留当前文章和身份的内存结果。 */
import type { Ref } from 'vue'
import type { AdminPostDraft } from '~/features/post/adminTypes'
import type { PostPreviewLink } from '~/features/post/types'

export function usePostPreviewLink(draft: Ref<AdminPostDraft>, busy: Ref<boolean>) {
  const api = useAdminApi()
  const { t } = useI18n()
  const auth = useCurrentUser()
  const context = useState<string>('page-content-context', () => '')
  const link = ref<PostPreviewLink | null>(null)
  const pending = ref(false)
  const copying = ref(false)
  const error = ref('')
  const notice = ref('')
  const url = computed(() =>
    link.value && import.meta.client
      ? `${window.location.origin}/posts/preview?token=${encodeURIComponent(link.value.token)}`
      : '',
  )
  const available = computed(() => !!draft.value.id && draft.value.status === 'draft' && !draft.value.deletedAt)
  let generation = 0
  let alive = true

  // 内容修订不撤销链接；切换文章、状态、账号或内容库时清除当前页面持有的凭据。
  watch(
    [
      () => draft.value.id,
      () => draft.value.status,
      () => draft.value.deletedAt,
      () => auth.currentUser.value?.id,
      context,
    ],
    () => {
      generation += 1
      link.value = null
      pending.value = false
      copying.value = false
      error.value = ''
      notice.value = ''
    },
    { flush: 'sync' },
  )

  async function generate() {
    if (!available.value || busy.value || pending.value) return
    const current = generation
    const postId = draft.value.id
    pending.value = true
    error.value = ''
    notice.value = ''
    try {
      const result = await api<PostPreviewLink>(`/admin/posts/${postId}/preview-link`, { method: 'POST' })
      if (!alive || generation !== current) return
      link.value = result
      notice.value = t('admin-content.postPreview.generated')
    } catch (cause) {
      if (!alive || generation !== current) return
      error.value = apiErrorMessage(cause, 'admin-content.postPreview.generateFailed', { t })
    } finally {
      if (alive && generation === current) pending.value = false
    }
  }

  async function copy() {
    if (!url.value || copying.value || pending.value || busy.value) return
    const current = generation
    const target = url.value
    copying.value = true
    error.value = ''
    notice.value = ''
    try {
      await navigator.clipboard.writeText(target)
      if (alive && generation === current) notice.value = t('admin-content.postPreview.copied')
    } catch {
      if (alive && generation === current) error.value = t('admin-content.postPreview.copyFailed')
    } finally {
      if (alive && generation === current) copying.value = false
    }
  }

  onScopeDispose(() => {
    alive = false
    generation += 1
    link.value = null
  })
  return { link, url, available, pending, copying, error, notice, generate, copy }
}
