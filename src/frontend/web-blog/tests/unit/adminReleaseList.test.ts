/** @file adminReleaseList.test.ts @description 后台版本列表：标签、默认展开、更新说明净化与升级命令复制的 DOM 回归。 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ReleaseList from '../../app/components/admin/ReleaseList.vue'
import { upgradeCommand, type ReleaseItem } from '../../app/features/release/types'

const item = (version: string, extra: Partial<ReleaseItem> = {}): ReleaseItem => ({
  version,
  prerelease: version.includes('-'),
  publishedAt: '2026-11-05T17:00:00Z',
  url: `https://github.com/TixXin/TixXinBlog/releases/tag/v${version}`,
  notes: '',
  migration: false,
  current: false,
  newer: false,
  ...extra,
})
const items = [
  item('0.5.2-beta.7', {
    newer: true,
    migration: true,
    notes: '### 升级说明\n\n- 含一项数据库迁移\n\n<img src=x onerror=alert(1)>',
  }),
  item('0.5.2-beta.6', { current: true, notes: '### 变更\n\n- 友链页改版' }),
]
const wrappers: { unmount(): void }[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('后台版本列表', () => {
  it('标出最新、当前、测试版与迁移，默认展开可升级的最新版本', async () => {
    const wrapper = await mountSuspended(ReleaseList, { props: { items } })
    wrappers.push(wrapper)
    const [latest, current] = wrapper.findAll('.release-item')
    expect(latest!.text()).toContain('最新')
    expect(latest!.text()).toContain('含数据库迁移')
    expect(latest!.text()).toContain('测试版')
    expect(current!.text()).toContain('当前')
    expect(latest!.get('details').attributes('open')).toBeDefined()
    expect(current!.get('details').attributes('open')).toBeUndefined()
    // 只有比当前新的版本给出升级命令
    expect(latest!.find('code').text()).toBe('sudo tixxin update 0.5.2-beta.7')
    expect(current!.find('code').exists()).toBe(false)
  })

  it('更新说明渲染为净化后的 HTML，原始 HTML 只作为文本显示', async () => {
    const wrapper = await mountSuspended(ReleaseList, { props: { items } })
    wrappers.push(wrapper)
    const notes = wrapper.get('.release-item__notes')
    expect(notes.find('h3').text()).toBe('升级说明')
    expect(notes.find('img').exists()).toBe(false)
    expect(notes.text()).toContain('<img src=x onerror=alert(1)>')
  })

  it('复制按钮写入升级命令并短暂显示已复制', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as unknown as Clipboard)
    const wrapper = await mountSuspended(ReleaseList, { props: { items } })
    wrappers.push(wrapper)
    const button = wrapper.get('.release-item__command button')
    await button.trigger('click')
    await vi.waitFor(() => expect(button.text()).toContain('已复制'))
    expect(writeText).toHaveBeenCalledWith('sudo tixxin update 0.5.2-beta.7')
  })

  it('升级命令只接受合法版本号', () => {
    expect(upgradeCommand('0.5.2')).toBe('sudo tixxin update 0.5.2')
    expect(upgradeCommand('0.5.2; rm -rf /')).toBe('')
  })
})
