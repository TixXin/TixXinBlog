/** @file useLocalLinkDraft.ts @description 公开友链资料仅在本机整理复制，刷新与主题切换保留输入，不发送申请 */
import type { LocalLinkDraft } from '~/features/link/types'
export function useLocalLinkDraft() {
  const draft = useState<LocalLinkDraft>('local-link-draft', () => ({ name: '', url: '', avatar: '', description: '' }))
  const initialized = useState('local-link-draft-initialized', () => false)
  const ready = ref(false),
    copying = ref(false),
    error = ref(''),
    notice = ref(''),
    storageError = ref('')
  let alive = true
  function persist() {
    if (!ready.value) return
    try {
      sessionStorage.setItem('tixxin-local-link-draft', JSON.stringify(draft.value))
      storageError.value = ''
    } catch {
      storageError.value = '本机恢复副本暂时无法保存，请保留当前输入。'
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
      text = `站点名称：${value.name.trim()}\n站点地址：${value.url.trim()}\n头像地址：${value.avatar.trim()}\n一句话描述：${value.description.trim()}`
    try {
      await navigator.clipboard.writeText(text)
      if (alive) notice.value = '友链资料已复制，尚未提交申请'
    } catch {
      if (alive) error.value = '复制失败，资料已保留。请重试或手动复制各字段。'
    } finally {
      if (alive) copying.value = false
    }
  }
  onMounted(() => {
    try {
      const raw = !initialized.value ? sessionStorage.getItem('tixxin-local-link-draft') : null
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
      storageError.value = '本机恢复副本暂时无法读取。'
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
