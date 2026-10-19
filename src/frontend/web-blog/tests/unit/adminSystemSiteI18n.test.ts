/** @file adminSystemSiteI18n.test.ts @description 后台站点设置编辑区英文冒烟：导航与页脚、关于页资料、只读预览与即时校验切到 en 后显示英文，默认中文保持原文 */
import { afterEach, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SiteNavigationFields from '../../app/components/admin/SiteNavigationFields.vue'
import AboutSettingsFields from '../../app/components/admin/AboutSettingsFields.vue'
import SiteSettingsPreview from '../../app/components/admin/SiteSettingsPreview.vue'
import { siteExtrasErrors } from '../../app/features/site/extras'
import { defaultSiteSettings } from '../../app/features/site/settings'
import type { SiteSettingsData } from '../../app/features/site/settings'
import type { AboutSettings } from '../../app/features/about/types'

const i18n = () => useNuxtApp().$i18n
const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function inEnglish(run: () => Promise<void>) {
  await i18n().setLocale('en')
  try {
    await run()
  } finally {
    await i18n().setLocale('zh-CN')
  }
}

function mountNavigation() {
  const value = ref<SiteSettingsData>(structuredClone(defaultSiteSettings))
  return mountSuspended(
    defineComponent({
      setup: () => () =>
        h(SiteNavigationFields, {
          modelValue: value.value,
          'onUpdate:modelValue': (next: SiteSettingsData) => (value.value = next),
        }),
    }),
  )
}

const about: AboutSettings = {
  visible: false,
  introduction: '',
  sections: [{ kind: 'reading', visible: false, items: [{ title: '', detail: '', period: '', visible: false }] }],
}

it('导航与页脚编辑区切到英文', async () => {
  await inEnglish(async () => {
    const wrapper = await mountNavigation()
    wrappers.push(wrapper)
    const text = wrapper.text()
    expect(text).toContain('Navigation and footer')
    expect(text).toContain('Add footer link')
    expect(text).toContain('ICP filing and copyright')
    expect(text).toContain('Use {year} for the current year and {siteName} for the site name.')
    expect(text).not.toMatch(/添加一言|备案与版权/)
    expect(wrapper.find('[aria-label^="Move nav item"]').exists()).toBe(true)
  })
})

it('关于页资料与预览切到英文，栏目名使用英文', async () => {
  await inEnglish(async () => {
    const fields = await mountSuspended(
      defineComponent({ setup: () => () => h(AboutSettingsFields, { modelValue: structuredClone(about) }) }),
    )
    wrappers.push(fields)
    expect(fields.text()).toContain('Publish the About page content below')
    expect(fields.text()).toContain('Reading entry 1')
    expect(fields.find('[aria-label="Remove entry 1"]').exists()).toBe(true)

    const preview = await mountSuspended(SiteSettingsPreview, {
      props: { label: 'Preview', value: { ...defaultSiteSettings, avatar: '', about: structuredClone(about) } },
    })
    wrappers.push(preview)
    expect(preview.get('summary').text()).toContain('Not public')
    expect(preview.findAll('h4').map((item) => item.text())).toEqual(['Reading · Section hidden'])
    expect(preview.text()).toContain('Navigation and footer')
  })
})

it('即时校验文案跟随界面语言，默认仍为中文原文', async () => {
  const value = {
    ...structuredClone(defaultSiteSettings),
    quotes: ['同一句', '同一句'],
  }
  expect(siteExtrasErrors(value)['quote-1']).toBe('与前面的一言重复')
  await inEnglish(async () => {
    expect(siteExtrasErrors(value)['quote-1']).toBe('Duplicates an earlier quote')
  })
})

it('默认中文的读屏标签与提示保持原文', async () => {
  const wrapper = await mountNavigation()
  wrappers.push(wrapper)
  expect(wrapper.find('[aria-label="下移导航「主页」"]').exists()).toBe(true)
  expect(wrapper.text()).toContain('可用 {year} 表示当前年份、{siteName} 表示站点名称。')
})
