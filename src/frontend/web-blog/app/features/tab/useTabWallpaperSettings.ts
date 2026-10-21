/**
 * @file useTabWallpaperSettings.ts
 * @description 标签页主题与壁纸设置的组合函数：管理独立壁纸状态、渐变与预设切换、自定义图片上传
 * @author TixXin
 * @since 2026-10-21
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WallpaperConfig, WallpaperKind } from '~/composables/useTabSettings'
import { useTabSettings } from '~/composables/useTabSettings'
import { builtinWallpapers } from '~/features/tab/wallpapers'
import { idbDel, idbSet } from '~/utils/idbBlob'

export function useTabWallpaperSettings() {
  const { t } = useI18n()
  const { settings, update } = useTabSettings()

  /** 当前编辑哪一份壁纸配置（亮 / 暗）；联动模式下始终编辑 light */
  const wallpaperEditing = ref<'light' | 'dark'>('light')
  const uploadError = ref('')

  const colorModeOptions = computed(() => [
    { value: 'light', label: t('misc.tab.settings.theme.light'), icon: 'lucide:sun' },
    { value: 'dark', label: t('misc.tab.settings.theme.dark'), icon: 'lucide:moon' },
    { value: 'system', label: t('misc.tab.settings.theme.system'), icon: 'lucide:monitor' },
  ])

  const wallpaperKinds = computed<{ value: WallpaperKind; label: string; icon: string }[]>(() => [
    { value: 'none', label: t('misc.tab.settings.theme.kinds.none'), icon: 'lucide:ban' },
    { value: 'solid', label: t('misc.tab.settings.theme.kinds.solid'), icon: 'lucide:square' },
    { value: 'gradient', label: t('misc.tab.settings.theme.kinds.gradient'), icon: 'lucide:paintbrush' },
    { value: 'preset', label: t('misc.tab.settings.theme.kinds.preset'), icon: 'lucide:image' },
    { value: 'url', label: 'URL', icon: 'lucide:link' },
    { value: 'upload', label: t('misc.tab.settings.theme.kinds.upload'), icon: 'lucide:upload' },
  ])

  const currentWallpaper = computed<WallpaperConfig>(() => {
    if (settings.value.wallpaperIndependent) {
      return wallpaperEditing.value === 'dark' ? settings.value.wallpaperDark : settings.value.wallpaperLight
    }
    return settings.value.wallpaperLight
  })

  function writeWallpaper(next: WallpaperConfig) {
    if (settings.value.wallpaperIndependent && wallpaperEditing.value === 'dark') {
      update('wallpaperDark', next)
    } else {
      update('wallpaperLight', next)
    }
  }

  function patchWallpaper(patch: Partial<WallpaperConfig>) {
    writeWallpaper({ ...currentWallpaper.value, ...patch })
  }

  function patchGradient(patch: Partial<NonNullable<WallpaperConfig['gradient']>>) {
    const current = currentWallpaper.value.gradient ?? { from: '#1e3a8a', to: '#7c3aed', angle: 135 }
    patchWallpaper({ gradient: { ...current, ...patch } })
  }

  function onKindChange(kind: WallpaperKind) {
    const next: WallpaperConfig = { ...currentWallpaper.value, kind }
    if (kind === 'solid' && !next.solidColor) next.solidColor = '#0f172a'
    if (kind === 'gradient' && !next.gradient) {
      next.gradient = { from: '#1e3a8a', to: '#7c3aed', angle: 135 }
    }
    if (kind === 'preset' && !next.presetId) next.presetId = builtinWallpapers[0]!.id
    writeWallpaper(next)
  }

  async function onWallpaperUpload(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    uploadError.value = ''
    if (file.size > 5 * 1024 * 1024) {
      uploadError.value = t('misc.tab.settings.theme.tooLarge', { size: (file.size / 1024 / 1024).toFixed(1) })
      input.value = ''
      return
    }
    try {
      const prev = currentWallpaper.value.uploadKey
      if (prev) await idbDel(prev)
      const key = `wp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      await idbSet(key, file)
      writeWallpaper({ ...currentWallpaper.value, kind: 'upload', uploadKey: key })
    } catch (err) {
      uploadError.value = err instanceof Error ? err.message : t('misc.tab.settings.theme.uploadFailed')
    }
    input.value = ''
  }

  return {
    wallpaperEditing,
    uploadError,
    colorModeOptions,
    wallpaperKinds,
    currentWallpaper,
    writeWallpaper,
    patchWallpaper,
    patchGradient,
    onKindChange,
    onWallpaperUpload,
  }
}
