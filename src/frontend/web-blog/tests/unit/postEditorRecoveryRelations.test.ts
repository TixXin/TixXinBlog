/** @file postEditorRecoveryRelations.test.ts @description 新文章带关联字段时可比较并载入本机副本，不误报服务器读取失败。 */
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { usePostEditor } from '../../app/composables/usePostEditor'
import type { PostRecoveryItem } from '../../app/utils/postRecovery'
const mocks = vi.hoisted(() => ({ api: vi.fn(), leave: vi.fn() }))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => ({
  currentUser: ref({ id: 'post-recovery-owner' }),
  restore: async () => true,
}))
mockNuxtImport('useToast', () => () => ({ success: vi.fn() }))
mockNuxtImport('onBeforeRouteLeave', () => mocks.leave)
const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  localStorage.clear()
  vi.clearAllMocks()
})
it('关联数组不以 Vue 代理进入 structuredClone，恢复仍保存完整关联顺序', async () => {
  mocks.api.mockResolvedValue({ folders: [], tags: [] })
  let editor!: ReturnType<typeof usePostEditor>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          editor = usePostEditor(null)
          return () => h('div')
        },
      }),
    ),
  )
  await vi.waitFor(() => expect(editor.ready.value).toBe(true))
  editor.serverAutoSave.value = false
  editor.draft.value.relatedContent = [
    { type: 'gallery', id: 8 },
    { type: 'project', id: 9 },
  ]
  const recovery: PostRecoveryItem = {
    key: 'local-copy',
    schemaVersion: 1,
    savedAt: '2026-09-11T12:00:00Z',
    draft: { ...JSON.parse(JSON.stringify(editor.draft.value)), title: '本机长文', contentRaw: '# 章节\n\n继续写作。' },
  }
  await editor.reviewRecovery(recovery)
  expect(editor.error.value).toBe('')
  expect(editor.recoverySelection.value?.key).toBe('local-copy')
  expect(editor.recoveryServer.value?.relatedContent).toEqual([
    { type: 'gallery', id: 8 },
    { type: 'project', id: 9 },
  ])
  editor.applyRecovery()
  await flushPromises()
  expect(editor.draft.value.contentRaw).toBe('# 章节\n\n继续写作。')
  expect(editor.draft.value.relatedContent).toEqual([
    { type: 'gallery', id: 8 },
    { type: 'project', id: 9 },
  ])
})
