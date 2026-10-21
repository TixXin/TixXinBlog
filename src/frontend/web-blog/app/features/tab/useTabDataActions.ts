/**
 * @file useTabDataActions.ts
 * @description 标签页数据管理操作组合函数：批量导出 JSON、清空本地书签数据、重置设置为默认值
 * @author TixXin
 * @since 2026-10-21
 */
import { useI18n } from 'vue-i18n'
import { useTabBookmarks } from '~/composables/useTabBookmarks'
import { useTabSettings } from '~/composables/useTabSettings'
import { useToast } from '~/composables/useToast'

export function useTabDataActions() {
  const { t } = useI18n()
  const { settings } = useTabSettings()
  const { exportBulk, categories: allCategories, bookmarks: allBookmarks } = useTabBookmarks()
  const { success, error: toastError } = useToast()

  async function onExport() {
    try {
      const data = await exportBulk()
      const { buildExportJson, triggerDownload } = await import('~/features/tab/export')
      const payload = {
        version: 1 as const,
        exportedAt: new Date().toISOString(),
        categories: data?.categories ?? allCategories.value,
        bookmarks: data?.bookmarks ?? allBookmarks.value,
        settings: settings.value,
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      triggerDownload(`tabs-${stamp}.json`, buildExportJson(payload))
      success(t('misc.tab.settings.data.exported'))
    } catch (err) {
      toastError(err instanceof Error ? err.message : t('misc.tab.settings.data.exportFailed'))
    }
  }

  function onClearBookmarks() {
    if (!window.confirm(t('misc.tab.settings.data.clearConfirm'))) return
    if (typeof window === 'undefined') return
    const prefixes = ['tab:categories:', 'tab:bookmarks:']
    const keysToDel: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && prefixes.some((p) => k.startsWith(p))) keysToDel.push(k)
    }
    keysToDel.forEach((k) => localStorage.removeItem(k))
    success(t('misc.tab.settings.data.cleared'))
  }

  function onResetSettings() {
    if (!window.confirm(t('misc.tab.settings.data.resetConfirm'))) return
    if (typeof window === 'undefined') return
    localStorage.removeItem('tab-settings')
    success(t('misc.tab.settings.data.resetDone'))
  }

  return {
    onExport,
    onClearBookmarks,
    onResetSettings,
  }
}
