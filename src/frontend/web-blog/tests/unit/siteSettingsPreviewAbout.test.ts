/** @file siteSettingsPreviewAbout.test.ts @description 管理预览可审阅完整隐藏资料，旧包未携带关于字段时不伪造待写内容。 */
import { afterEach, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SiteSettingsPreview from '../../app/components/admin/SiteSettingsPreview.vue'
import { defaultSiteSettings } from '../../app/features/site/settings'
const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
it('整体、栏目和条目隐藏不妨碍管理员在详情中核对文字和顺序', async () => {
  const wrapper = await mountSuspended(SiteSettingsPreview, {
    props: {
      label: '最新服务器资料',
      value: {
        ...defaultSiteSettings,
        avatar: '',
        about: {
          visible: false,
          introduction: '尚未公开的介绍',
          sections: [
            {
              kind: 'reading',
              visible: false,
              items: [{ title: '隐藏书单', detail: '私人整理的笔记', period: '近期', visible: false }],
            },
            { kind: 'skill', visible: true, items: [] },
          ],
        },
      },
    },
  })
  wrappers.push(wrapper)
  expect(wrapper.get('summary').text()).toContain('整体未公开')
  expect(wrapper.get('details').text()).toContain('尚未公开的介绍')
  expect(wrapper.get('details').text()).toContain('书单 · 栏目隐藏')
  expect(wrapper.get('details').text()).toContain('隐藏书单 · 条目隐藏')
  expect(wrapper.get('details').text()).toContain('私人整理的笔记')
  expect(wrapper.findAll('h4').map((item) => item.text())).toEqual(['书单 · 栏目隐藏', '技能 · 栏目公开'])
})
it('旧内容包没有关于字段时不展示空的覆盖预览', async () => {
  const wrapper = await mountSuspended(SiteSettingsPreview, {
    props: { label: '导入站点资料预览', value: { ...defaultSiteSettings, avatar: '' } },
  })
  wrappers.push(wrapper)
  expect(wrapper.find('details').exists()).toBe(false)
})
it('预览列出 v17 新字段：英文资料、本站信息、更新日期、条目链接与支持方式', async () => {
  const wrapper = await mountSuspended(SiteSettingsPreview, {
    props: {
      label: '最新服务器资料',
      value: {
        ...defaultSiteSettings,
        avatar: '',
        about: {
          visible: true,
          introduction: '介绍',
          en: { introduction: 'Hello' },
          showSiteInfo: true,
          support: {
            visible: false,
            message: '',
            methods: [{ label: 'Ko-fi', url: 'https://ko-fi.com/x', image: '/api/v1/media/a.webp' }],
          },
          sections: [
            {
              kind: 'now',
              visible: true,
              updatedAt: '2026-11-01',
              items: [
                {
                  title: '整理博客',
                  detail: '',
                  period: '',
                  visible: true,
                  url: 'https://example.org/now',
                  en: { title: 'Tidying', detail: '', period: '' },
                },
              ],
            },
          ],
        },
      },
    },
  })
  wrappers.push(wrapper)
  const text = wrapper.get('details').text()
  for (const expected of [
    '英文介绍：Hello',
    '本站信息：展示',
    '更新于：2026-11-01',
    '英文名称：Tidying',
    '链接：https://example.org/now',
    '支持方式：未开启',
    '感谢语：使用默认文案',
    'Ko-fi：链接 + 收款码',
  ])
    expect(text).toContain(expected)
})
