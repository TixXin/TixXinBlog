/** @file gallerySettingsRecovery.test.ts @description 内容库恢复后旧器材副本可见且不被当前输入覆盖 */
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useGallerySettingsEditor } from '../../app/composables/useGallerySettingsEditor'
const mocks = vi.hoisted(() => ({
  settings: vi.fn(),
  auth: {} as { currentUser: Ref<{ id: string } | null>; restore: ReturnType<typeof vi.fn> },
}))
mockNuxtImport('useGalleryRepository', () => () => ({ settings: mocks.settings }))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
it('按账号和内容上下文分别保留器材输入，旧副本不直接恢复提交', async () => {
  sessionStorage.clear()
  mocks.auth = { currentUser: ref({ id: 'owner' }), restore: vi.fn().mockResolvedValue(true) }
  mocks.settings.mockImplementation(async () => ({
    gear: [{ name: '服务器器材', description: '', icon: 'lucide:camera' }],
    revision: 3,
    updatedAt: '2026-09-10',
  }))
  let editor!: ReturnType<typeof useGallerySettingsEditor>, context!: Ref<string>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          context = useState<string>('page-content-context', () => '')
          context.value = 'old'
          editor = useGallerySettingsEditor()
          return () => h('div')
        },
      }),
    ),
  )
  await vi.waitFor(() => expect(editor.ready.value).toBe(true))
  editor.draft.value!.gear[0]!.name = '尚未保存的旧器材'
  await flushPromises()
  context.value = 'restored'
  await flushPromises()
  expect(editor.ready.value).toBe(false)
  await editor.load()
  expect(editor.recovery.value).toBeNull()
  expect(editor.previousRecoveries.value[0]?.gear[0]?.name).toBe('尚未保存的旧器材')
  editor.draft.value!.gear[0]!.name = '恢复后新输入'
  await flushPromises()
  expect(sessionStorage.getItem('tixxin-gallery-gear:owner:old')).toContain('尚未保存的旧器材')
  expect(sessionStorage.getItem('tixxin-gallery-gear:owner:restored')).toContain('恢复后新输入')
})
