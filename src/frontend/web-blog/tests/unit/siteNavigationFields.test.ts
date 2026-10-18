/** @file siteNavigationFields.test.ts @description 后台“导航与页脚”编辑区：显隐开关、键盘排序、外链增删、错误提示关联与上限 */
import { afterEach, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SiteNavigationFields from '../../app/components/admin/SiteNavigationFields.vue'
import { defaultSiteSettings } from '../../app/features/site/settings'
import type { SiteSettingsData } from '../../app/features/site/settings'
import { buildNavItems } from '../../app/features/nav/routes'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function setup() {
  const value = ref<SiteSettingsData>(structuredClone(defaultSiteSettings))
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

it('首页开关不可关闭，隐藏模块后从前台导航中消失', async () => {
  const { wrapper, value } = await setup()
  const toggles = wrapper.findAll('input[type="checkbox"]')
  expect(toggles[0]!.attributes('disabled')).toBeDefined()
  const subscriptions = wrapper
    .findAll('label')
    .find((label) => label.text().includes('显示「平台订阅费」'))!
    .find('input')
  await subscriptions.setValue(false)
  expect(value.value.navigation.find((entry) => entry.type === 'route' && entry.key === 'subscriptions')?.visible).toBe(
    false,
  )
  expect(buildNavItems(value.value.navigation).map((item) => item.label)).not.toContain('平台订阅费')
})

it('上下移动按钮调整顺序，焦点留在移动后的按钮并播报位置', async () => {
  const { wrapper, value } = await setup()
  const down = wrapper.get('[aria-label="下移导航「主页」"]')
  await down.trigger('click')
  await nextTick()
  expect(value.value.navigation.slice(0, 2).map((entry) => (entry.type === 'route' ? entry.key : ''))).toEqual([
    'archive',
    'home',
  ])
  expect(document.activeElement?.getAttribute('aria-label')).toBe('下移导航「主页」')
  expect(wrapper.get('[role="status"]').text()).toContain('已移至第 2 项')
  expect(wrapper.get('[aria-label="上移导航「归档」"]').attributes('disabled')).toBeDefined()
})

it('外链增删与错误提示通过 aria-describedby 关联，最多 4 个', async () => {
  const { wrapper, value } = await setup()
  const add = wrapper.findAll('button').find((button) => button.text().startsWith('添加外链导航'))!
  await add.trigger('click')
  const url = wrapper.get('input[type="url"][placeholder="https://"]')
  await url.setValue('ftp://example.com')
  const describedBy = url.attributes('aria-describedby')!
  expect(url.attributes('aria-invalid')).toBe('true')
  expect(wrapper.get(`[id="${describedBy}"]`).text()).toContain('http')
  await url.setValue('https://example.com')
  expect(url.attributes('aria-invalid')).toBe('false')
  for (let index = 0; index < 3; index++) await add.trigger('click')
  expect(value.value.navigation.filter((entry) => entry.type === 'external')).toHaveLength(4)
  expect(add.attributes('disabled')).toBeDefined()
  await wrapper.get('[aria-label^="移除外链导航"]').trigger('click')
  expect(value.value.navigation.filter((entry) => entry.type === 'external')).toHaveLength(3)
})

it('页脚链接、每日一言、备案与版权可编辑，重复一言提示错误', async () => {
  const { wrapper, value } = await setup()
  await wrapper.get('[aria-label="移除页脚链接站点地图"]').trigger('click')
  expect(value.value.footerLinks.map((link) => link.label)).toEqual(['关于本站', 'RSS 订阅'])
  const quoteAdd = wrapper.findAll('button').find((button) => button.text() === '添加一言')!
  await quoteAdd.trigger('click')
  const quotes = wrapper.findAll('input[maxlength="120"]')
  await quotes.at(-1)!.setValue(value.value.quotes[0]!)
  expect(quotes.at(-1)!.attributes('aria-invalid')).toBe('true')
  const icp = wrapper
    .findAll('label')
    .find((label) => label.text().startsWith('ICP 备案号'))!
    .get('input')
  await icp.setValue('京ICP备00000000号')
  expect(value.value.icpNumber).toBe('京ICP备00000000号')
  expect(wrapper.text()).toContain('京ICP备00000000号')
  const copyright = wrapper
    .findAll('label')
    .find((label) => label.text().startsWith('版权文案'))!
    .get('input')
  expect(copyright.attributes('aria-describedby')).toBeTruthy()
})
