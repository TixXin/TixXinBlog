/**
 * @file usePostRecovery.ts
 * @description 本机恢复副本生命周期：写入失败明确提示，只清理本编辑页拥有的已保存副本。
 */
import type { AdminPostDraft } from '~/features/post/adminTypes'
import { readPostRecoveries, recoveryPrefix, writePostRecovery } from '~/utils/postRecovery'
import type { PostRecoveryItem } from '~/utils/postRecovery'

export function usePostRecovery(postId: string | null) {
  const { t } = useI18n()
  const recoveries = ref<PostRecoveryItem[]>([])
  const localSavedAt = ref('')
  const localError = ref('')
  let prefix = ''
  let activeKey: string | null = null
  function reload() {
    if (!prefix || import.meta.server) return
    try {
      const result = readPostRecoveries(localStorage, prefix, postId)
      recoveries.value = result.items.filter((item) => item.key !== activeKey)
      if (result.invalidCount)
        localError.value = t('admin-content.postRecovery.invalid', { count: result.invalidCount }, result.invalidCount)
    } catch {
      localError.value = t('admin-content.postRecovery.readFailed')
    }
  }
  function initialize(owner: string) {
    prefix = recoveryPrefix(owner, postId)
    reload()
  }
  function persist(draft: AdminPostDraft): boolean {
    if (!prefix || import.meta.server) return false
    try {
      activeKey ??= `${prefix}${crypto.randomUUID()}`
      localSavedAt.value = writePostRecovery(localStorage, activeKey, draft)
      localError.value = ''
      return true
    } catch {
      localError.value = t('admin-content.postRecovery.writeFailed')
      return false
    }
  }
  function preserve(draft: AdminPostDraft): boolean {
    if (!persist(draft)) return false
    activeKey = null
    reload()
    return true
  }
  function clearSaved(sourceKey?: string) {
    try {
      if (activeKey) localStorage.removeItem(activeKey)
      if (sourceKey?.startsWith(prefix)) localStorage.removeItem(sourceKey)
      activeKey = null
      localSavedAt.value = ''
      localError.value = ''
      reload()
    } catch {
      localError.value = t('admin-content.postRecovery.clearFailed')
    }
  }
  function discard(key: string) {
    if (!key.startsWith(prefix)) return
    try {
      localStorage.removeItem(key)
      reload()
    } catch {
      localError.value = t('admin-content.postRecovery.discardFailed')
    }
  }
  return { recoveries, localSavedAt, localError, initialize, reload, persist, preserve, clearSaved, discard }
}
