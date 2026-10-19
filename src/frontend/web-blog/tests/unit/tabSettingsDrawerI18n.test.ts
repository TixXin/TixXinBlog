/**
 * @file tabSettingsDrawerI18n.test.ts
 * @description 标签页设置抽屉的中英文文案：分组导航、自定义搜索占位符说明与壁纸名称
 */
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TabSettingsDrawer from '../../app/components/tab/TabSettingsDrawer.vue'

async function openSection(label: string) {
  const wrapper = await mountSuspended(TabSettingsDrawer, {
    props: { visible: true, user: null },
    global: { stubs: { Teleport: true, Icon: true } },
  })
  const nav = wrapper.findAll('.tsd-nav__item').find((item) => item.text() === label)
  await nav!.trigger('click')
  return wrapper
}

describe('标签页设置抽屉文案', () => {
  it('中文保留原文案，搜索说明内嵌 %s 代码片段', async () => {
    const { settings, update } = useTabSettings()
    const previous = settings.value.searchEngine
    update('searchEngine', 'custom')
    try {
      const wrapper = await openSection('搜索')
      expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('标签页设置')
      expect(wrapper.text()).toContain('使用 %s 占位符表示查询词位置。')
      expect(wrapper.get('.tsd-hint code').text()).toBe('%s')
      wrapper.unmount()
    } finally {
      update('searchEngine', previous)
    }
  })

  it('英文界面下导航、分组标题与壁纸名称跟随语言', async () => {
    const i18n = useNuxtApp().$i18n
    await i18n.setLocale('en')
    const { settings, update } = useTabSettings()
    const previous = settings.value.wallpaperLight
    update('wallpaperLight', { ...previous, kind: 'preset', presetId: 'aurora' })
    try {
      const wrapper = await openSection('Theme/Wallpaper')
      expect(wrapper.get('.tsd-section__title').text()).toBe('Theme & wallpaper')
      expect(wrapper.text()).toContain('Mountain Dawn')
      expect(wrapper.text()).toContain('Restore defaults')
      wrapper.unmount()
    } finally {
      update('wallpaperLight', previous)
      await i18n.setLocale('zh-CN')
    }
  })
})
