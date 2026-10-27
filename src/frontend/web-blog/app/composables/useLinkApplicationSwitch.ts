/** @file useLinkApplicationSwitch.ts @description 公开友链申请开关；与友链须知共用设置版本，冲突时重新读取而不覆盖他处保存的须知 */
import type { Ref } from 'vue'
import type { LinkSettings } from '~/features/link/types'
import { failureStatus, failureText } from '~/features/link/requestFailure'
export function useLinkApplicationSwitch(list: {
  pending: Ref<boolean>
  error: Ref<string>
  notice: Ref<string>
  settings: Ref<LinkSettings | null>
  load: () => Promise<void>
}) {
  const links = useLinkRepository(),
    app = useNuxtApp(),
    scope = useAdminActionScope(),
    t = currentTranslate()
  const toggling = ref(false)
  async function toggle() {
    const current = list.settings.value
    if (!current || toggling.value || list.pending.value) return
    const valid = scope.capture(),
      enabled = !current.applicationsEnabled
    toggling.value = true
    list.error.value = ''
    list.notice.value = ''
    try {
      const next = await links.saveSettings({
        rules: current.rules,
        revision: current.revision,
        applicationsEnabled: enabled,
      })
      if (!valid()) return
      list.settings.value = next
      list.notice.value = t(enabled ? 'admin-media.linkApplications.opened' : 'admin-media.linkApplications.closed')
      // 公开友链页的开关来自 metadata，保存后刷新同一会话中已缓存的读取。
      void app.runWithContext(() => refreshNuxtData('links-metadata'))
    } catch (cause) {
      if (!valid()) return
      list.error.value = failureText(cause, t('admin-media.linkApplications.toggleFailed'))
      if (failureStatus(cause) === 409) await list.load()
    } finally {
      toggling.value = false
    }
  }
  return { toggling, toggle }
}
