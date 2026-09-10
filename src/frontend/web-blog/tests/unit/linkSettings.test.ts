/** @file linkSettings.test.ts @description 友链须知版本合并与跨内容库恢复只读保留 */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useLinkSettingsEditor } from '../../app/composables/useLinkSettingsEditor'
const mocks = vi.hoisted(() => ({
  settings: vi.fn(),
  saveSettings: vi.fn(),
  auth: {} as { currentUser: Ref<{ id: string } | null>; restore: ReturnType<typeof vi.fn> },
}))
mockNuxtImport('useLinkRepository', () => () => mocks)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  sessionStorage.clear()
  mocks.auth = { currentUser: ref({ id: 'owner' }), restore: vi.fn().mockResolvedValue(true) }
  mocks.settings.mockReset().mockImplementation(async () => ({ rules: [], revision: 0, updatedAt: '2026-09-10' }))
  mocks.saveSettings.mockReset()
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup(context = 'before') {
  let editor!: ReturnType<typeof useLinkSettingsEditor>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          useState('page-content-context').value = context
          editor = useLinkSettingsEditor()
          return () => h('div')
        },
      }),
    ),
  )
  await vi.waitFor(() => expect(editor.ready.value).toBe(true))
  return editor
}
it('规则冲突保留输入，显式合并后使用当前revision保存', async () => {
  const editor = await setup()
  editor.draft.value!.rules = ['原窗口未保存的须知']
  mocks.saveSettings.mockRejectedValueOnce(Object.assign(new Error('规则已变化'), { statusCode: 409 }))
  mocks.settings.mockResolvedValueOnce({ rules: ['服务器最新须知'], revision: 2, updatedAt: '2026-09-10' })
  await editor.save()
  expect(editor.conflict.value?.rules).toEqual(['服务器最新须知'])
  expect(editor.draft.value?.rules).toEqual(['原窗口未保存的须知'])
  editor.merge()
  mocks.saveSettings.mockResolvedValueOnce({ rules: ['原窗口未保存的须知'], revision: 3, updatedAt: '2026-09-10' })
  await editor.save()
  expect(mocks.saveSettings.mock.calls[1]?.[0]).toMatchObject({ revision: 2, rules: ['原窗口未保存的须知'] })
})
it('新内容库编辑不覆盖旧须知副本，也不自动恢复其规则', async () => {
  const before = await setup()
  before.draft.value!.rules = ['仅存在旧内容库本机的须知']
  await flushPromises()
  wrappers.pop()!.unmount()
  const after = await setup('restored')
  expect(after.recovery.value).toBeNull()
  expect(after.previousRecoveries.value[0]?.value.rules).toEqual(['仅存在旧内容库本机的须知'])
  after.draft.value!.rules = ['恢复后新输入']
  await flushPromises()
  expect(sessionStorage.getItem('tixxin-link-rules:owner:before')).toContain('仅存在旧内容库本机的须知')
  expect(mocks.saveSettings).not.toHaveBeenCalled()
})
