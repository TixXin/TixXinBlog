/**
 * @file useTabPaletteActions.ts
 * @description 标签页快捷命令面板动作项构建
 * @author TixXin
 * @since 2026-04-11
 */

import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { CommandAction } from '~/components/tab/TabCommandPalette.vue'
import type { TabViewMode } from '~/composables/useTabSettings'
import { getTabViewModeLabel, getTabViewModeIcon } from './viewMode'

export interface UseTabPaletteActionsOptions {
  onAddBookmark: () => void
  onAddCategory: () => void
  onOpenSettings: () => void
  onOpenImport: () => void
}

/**
 * 构建标签页命令面板的可用动作
 */
export function useTabPaletteActions(options: UseTabPaletteActionsOptions): {
  paletteActions: ComputedRef<CommandAction[]>
} {
  const { t } = useI18n()
  const { settings: tabSettings, update: updateSetting } = useTabSettings()

  const paletteActions = computed<CommandAction[]>(() => {
    const switchView = (mode: TabViewMode): CommandAction => ({
      id: `view-${mode}`,
      title: t('misc.tab.palette.switchView', { view: getTabViewModeLabel(mode, t) }),
      subtitle: tabSettings.value.viewMode === mode ? t('misc.tab.palette.currentView') : '',
      icon: getTabViewModeIcon(mode),
      section: 'actions',
      run: () => updateSetting('viewMode', mode),
    })

    return [
      {
        id: 'add-bookmark',
        title: t('misc.tab.palette.addBookmark'),
        subtitle: t('misc.tab.palette.addBookmarkSubtitle'),
        icon: 'lucide:plus',
        shortcut: 'N',
        section: 'actions',
        run: () => options.onAddBookmark(),
      },
      {
        id: 'add-category',
        title: t('misc.tab.palette.addCategory'),
        icon: 'lucide:folder-plus',
        section: 'actions',
        run: () => options.onAddCategory(),
      },
      switchView('grid'),
      switchView('compact'),
      switchView('list'),
      switchView('cards'),
      {
        id: 'open-settings',
        title: t('misc.tab.palette.openSettings'),
        icon: 'lucide:settings',
        section: 'actions',
        run: () => options.onOpenSettings(),
      },
      {
        id: 'toggle-drag',
        title: tabSettings.value.dragEnabled ? t('misc.tab.palette.disableDrag') : t('misc.tab.palette.enableDrag'),
        icon: 'lucide:move',
        section: 'actions',
        run: () => updateSetting('dragEnabled', !tabSettings.value.dragEnabled),
      },
      {
        id: 'import',
        title: t('misc.tab.palette.import'),
        subtitle: t('misc.tab.palette.importSubtitle'),
        icon: 'lucide:upload',
        section: 'actions',
        run: () => options.onOpenImport(),
      },
    ]
  })

  return {
    paletteActions,
  }
}
