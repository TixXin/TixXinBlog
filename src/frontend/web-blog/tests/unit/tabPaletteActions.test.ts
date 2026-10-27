/** @file tabPaletteActions.test.ts @description 命令面板动作：顺序、文案随当前视图与拖拽设置变化，执行时按执行那一刻的设置切换 */
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useTabPaletteActions } from '../../app/features/tab/useTabPaletteActions'

const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  localStorage.clear()
})

it('动作顺序与文案，切换视图和拖拽开关读取最新设置', async () => {
  const options = { onAddBookmark: vi.fn(), onAddCategory: vi.fn(), onOpenSettings: vi.fn(), onOpenImport: vi.fn() }
  let result!: ReturnType<typeof useTabPaletteActions>
  let settings!: ReturnType<typeof useTabSettings>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          result = useTabPaletteActions(options)
          settings = useTabSettings()
          return () => h('div')
        },
      }),
    ),
  )
  const view = () =>
    result.paletteActions.value.map(({ id, title, subtitle, icon, shortcut }) => ({
      id,
      title,
      subtitle,
      icon,
      shortcut,
    }))
  const trace: unknown[] = [view()]
  const actions = result.paletteActions.value
  for (const id of ['add-bookmark', 'add-category', 'open-settings', 'import'])
    await actions.find((a) => a.id === id)!.run()
  expect(Object.values(options).map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1, 1])
  await actions.find((a) => a.id === 'view-list')!.run()
  const drag = settings.settings.value.dragEnabled
  // 先在外部改变拖拽设置，再执行早先取到的动作：按执行时的设置取反
  settings.update('dragEnabled', !drag)
  await actions.find((a) => a.id === 'toggle-drag')!.run()
  trace.push(settings.settings.value.viewMode, settings.settings.value.dragEnabled === drag, view())
  expect(trace).toMatchSnapshot()
})
