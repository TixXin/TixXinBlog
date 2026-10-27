/** @file siteNavigationFieldsCharacterization.test.ts @description 后台“导航与页脚”编辑区的渲染表征：外链、页脚链接、一言、备案与版权在超限和错误状态下的结构与编号关联，以及各列表移动、移除的播报与焦点，拆分区块前后必须一致 */
import { afterEach, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SiteNavigationFields from '../../app/components/admin/SiteNavigationFields.vue'
import { defaultSiteSettings } from '../../app/features/site/settings'
import type { SiteSettingsData } from '../../app/features/site/settings'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function setup(patch: Partial<SiteSettingsData> = {}) {
  const value = ref<SiteSettingsData>({ ...structuredClone(defaultSiteSettings), ...patch })
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        return () =>
          h(SiteNavigationFields, {
            modelValue: value.value,
            'onUpdate:modelValue': (next: SiteSettingsData) => (value.value = next),
          })
      },
    }),
    { attachTo: document.body },
  )
  wrappers.push(wrapper)
  return { wrapper, value }
}
/** 去掉 scoped 样式标记，把本组件的 useId 前缀与当前年份换成占位符，保留编号之间的关联 */
function markup(wrapper: Awaited<ReturnType<typeof setup>>['wrapper']) {
  const uid = wrapper
    .get('fieldset > p')
    .attributes('id')!
    .replace(/-hint$/, '')
  return wrapper
    .html()
    .replace(/ data-v-[a-f0-9]+(="")?/g, '')
    .replaceAll(uid, '<uid>')
    .replaceAll(String(new Date().getFullYear()), '<year>')
}
const external = (index: number, url = `https://example.com/${index}`) => ({
  type: 'external' as const,
  label: index === 0 ? '' : `外链${index}`,
  url,
  newTab: index % 2 === 0,
  visible: index !== 2,
})

it('超限与错误状态的完整结构', async () => {
  const base = structuredClone(defaultSiteSettings)
  const { wrapper } = await setup({
    name: '林间',
    navigation: [
      ...base.navigation.slice(0, 3),
      external(0, 'ftp://bad'),
      external(1),
      external(2, 'https://example.com/1'),
      external(3),
      external(4),
    ],
    footerLinks: Array.from({ length: 9 }, (_, index) => ({
      label: index === 1 ? '' : `链接${index}`,
      url: index === 2 ? 'javascript:alert(1)' : index === 3 ? '/about' : `/page-${index}`,
      newTab: index === 4,
    })).concat({ label: '重复', url: '/about', newTab: false }),
    quotes: [...Array.from({ length: 30 }, (_, index) => `一言 ${index}`), '一言 0', ''],
    icpNumber: '京'.repeat(41),
    icpUrl: 'ftp://beian',
    copyright: '©'.repeat(201),
  })
  expect(markup(wrapper)).toMatchSnapshot()
})

it('默认数据与正常备案、版权的预览', async () => {
  const { wrapper } = await setup({ name: '', icpNumber: '  京ICP备00000000号  ', copyright: '© {year} 林间' })
  expect(markup(wrapper)).toMatchSnapshot()
})

it('页脚链接与一言的移动、移除：播报、焦点与边界', async () => {
  const { wrapper, value } = await setup({ quotes: ['甲', '乙', '丙'] })
  const live = () => wrapper.get('[role="status"]').text()
  const focused = () => document.activeElement?.getAttribute('aria-label')
  const trace: unknown[] = []
  const click = async (label: string) => {
    await wrapper.get(`[aria-label="${label}"]`).trigger('click')
    await nextTick()
    await nextTick()
    trace.push([label, live(), focused()])
  }
  await click('下移页脚链接关于本站')
  await click('下移页脚链接关于本站')
  await click('上移第 3 条一言')
  await click('上移第 1 条一言')
  await click('移除第 2 条一言')
  await click('移除页脚链接站点地图')
  trace.push(
    value.value.footerLinks.map((link) => link.label),
    value.value.quotes,
  )
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '添加页脚链接')!
    .trigger('click')
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '添加一言')!
    .trigger('click')
  trace.push(value.value.footerLinks.at(-1), value.value.quotes.length, wrapper.findAll('[aria-invalid="true"]').length)
  expect(trace).toMatchSnapshot()
})
