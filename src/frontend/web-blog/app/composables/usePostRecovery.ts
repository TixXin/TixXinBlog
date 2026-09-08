/**
 * @file usePostRecovery.ts
 * @description 本机恢复副本生命周期：写入失败明确提示，只清理本编辑页拥有的已保存副本。
 */
import type { AdminPostDraft } from '~/features/post/adminTypes'
import { readPostRecoveries, recoveryPrefix, writePostRecovery } from '~/utils/postRecovery'
import type { PostRecoveryItem } from '~/utils/postRecovery'

export function usePostRecovery(postId: string | null) {
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
        localError.value = `${result.invalidCount} 份本机副本格式异常，已保留原数据并跳过自动读取`
    } catch {
      localError.value = '无法读取本机副本，请检查浏览器存储权限'
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
      localError.value = '本机副本保存失败，当前输入仍在页面；请勿关闭页面，可重试或保存到服务器'
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
      localError.value = '服务器已保存，但本机旧副本未能清理；可以稍后重新查看'
    }
  }
  function discard(key: string) {
    if (!key.startsWith(prefix)) return
    try {
      localStorage.removeItem(key)
      reload()
    } catch {
      localError.value = '无法移除本机副本，请稍后重试'
    }
  }
  return { recoveries, localSavedAt, localError, initialize, reload, persist, preserve, clearSaved, discard }
}
