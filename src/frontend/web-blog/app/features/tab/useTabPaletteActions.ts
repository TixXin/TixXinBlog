/**
 * @file useTabPaletteActions.ts
 * @description 标签页快捷命令面板动作项构建
 * @author TixXin
 * @since 2026-04-11
 */

import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { CommandAction } from './paletteItems'
import type { TabSettings, TabViewMode } from '~/composables/useTabSettings'
import type { Translate } from '~/utils/format'
import { getTabViewModeLabel, getTabViewModeIcon } from './viewMode'

export interface UseTabPaletteActionsOptions {
  onAddBookmark: () => void
  onAddCategory: () => void
  onOpenSettings: () => void
  onOpenImport: () => void
}

interface PaletteActionContext {
  t: Translate
  settings: Ref<TabSettings>
  update: <K extends keyof TabSettings>(key: K, value: TabSettings[K]) => void
  options: UseTabPaletteActionsOptions
}

/** 切换到指定视图的动作，当前视图在摘要中注明 */
function switchViewAction({ t, settings, update }: PaletteActionContext, mode: TabViewMode): CommandAction {
  return {
    id: `view-${mode}`,
    title: t('misc.tab.palette.switchView', { view: getTabViewModeLabel(mode, t) }),
    subtitle: settings.value.viewMode === mode ? t('misc.tab.palette.currentView') : '',
    icon: getTabViewModeIcon(mode),
    section: 'actions',
    run: () => update('viewMode', mode),
  }
}

/** 按当前设置生成全部动作：新增书签与分类、四种视图、设置、拖拽开关与导入 */
function buildPaletteActions(context: PaletteActionContext): CommandAction[] {
  const { t, settings, update, options } = context
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
    switchViewAction(context, 'grid'),
    switchViewAction(context, 'compact'),
    switchViewAction(context, 'list'),
    switchViewAction(context, 'cards'),
    {
      id: 'open-settings',
      title: t('misc.tab.palette.openSettings'),
      icon: 'lucide:settings',
      section: 'actions',
      run: () => options.onOpenSettings(),
    },
    {
      id: 'toggle-drag',
      title: settings.value.dragEnabled ? t('misc.tab.palette.disableDrag') : t('misc.tab.palette.enableDrag'),
      icon: 'lucide:move',
      section: 'actions',
      run: () => update('dragEnabled', !settings.value.dragEnabled),
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
}

/**
 * 构建标签页命令面板的可用动作
 */
export function useTabPaletteActions(options: UseTabPaletteActionsOptions): {
  paletteActions: ComputedRef<CommandAction[]>
} {
  const { t } = useI18n()
  const { settings: tabSettings, update: updateSetting } = useTabSettings()
  const paletteActions = computed<CommandAction[]>(() =>
    buildPaletteActions({ t, settings: tabSettings, update: updateSetting, options }),
  )
  return {
    paletteActions,
  }
}
