/** @file useLocalLinkDraft.ts @description 公开友链资料仅在本机整理复制，刷新与主题切换保留输入，不发送申请 */
import type { LocalLinkDraft } from '~/features/link/types'
export function useLocalLinkDraft() {
  const draft = useState<LocalLinkDraft>('local-link-draft', () => ({ name: '', url: '', avatar: '', description: '' }))
  const initialized = useState('local-link-draft-initialized', () => false)
  const t = currentTranslate()
  const ready = ref(false),
    copying = ref(false),
    error = ref(''),
    notice = ref(''),
    storageError = ref('')
  let alive = true
  function persist() {
    if (!ready.value) return
    try {
      sessionStorage.setItem('blog-local-link-draft', JSON.stringify(draft.value))
      storageError.value = ''
    } catch {
      storageError.value = t('interaction.linkForm.storageSaveFailed')
    }
  }
  function change(value: Partial<LocalLinkDraft>) {
    if (!ready.value) return
    Object.assign(draft.value, value)
    error.value = ''
    notice.value = ''
  }
  function validUrl(value: string) {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol)
    } catch {
      return false
    }
  }
  const valid = computed(
    () =>
      !!draft.value.name.trim() &&
      validUrl(draft.value.url.trim()) &&
      (!draft.value.avatar.trim() || validUrl(draft.value.avatar.trim())),
  )
  async function copy() {
    if (!ready.value || !valid.value || copying.value) return
    copying.value = true
    error.value = ''
    notice.value = ''
    persist()
    const value = draft.value,
      text = t('interaction.linkForm.copyText', {
        name: value.name.trim(),
        url: value.url.trim(),
        avatar: value.avatar.trim(),
        description: value.description.trim(),
      })
    try {
      await navigator.clipboard.writeText(text)
      if (alive) notice.value = t('interaction.linkForm.copied')
    } catch {
      if (alive) error.value = t('interaction.linkForm.copyFailed')
    } finally {
      if (alive) copying.value = false
    }
  }
  onMounted(() => {
    try {
      const raw = !initialized.value ? sessionStorage.getItem('blog-local-link-draft') : null
      if (raw && raw.length <= 10000) {
        const value = JSON.parse(raw) as LocalLinkDraft
        if (
          typeof value.name === 'string' &&
          value.name.length <= 80 &&
          typeof value.url === 'string' &&
          value.url.length <= 2048 &&
          typeof value.avatar === 'string' &&
          value.avatar.length <= 2048 &&
          typeof value.description === 'string' &&
          value.description.length <= 300
        )
          draft.value = { name: value.name, url: value.url, avatar: value.avatar, description: value.description }
      }
    } catch {
      storageError.value = t('interaction.linkForm.storageReadFailed')
    }
    initialized.value = true
    ready.value = true
  })
  watch(draft, persist, { deep: true })
  onScopeDispose(() => {
    persist()
    alive = false
  })
  return { draft, ready, copying, error, notice, storageError, valid, change, copy, persist }
}
