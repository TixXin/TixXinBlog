/** @file contentRelations.test.ts @description 关联白名单、各编辑器恢复和有序选择不破坏原输入。 */
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useContentRelationPicker } from '../../app/composables/useContentRelationPicker'
import { copyContentRelations, validContentRelations } from '../../app/features/content-relation/editor'
import { projectForm, parseProjectRecovery } from '../../app/features/project/editor'
import { galleryForm, parseGalleryRecovery } from '../../app/features/gallery/editor'
import type { ContentRelation } from '../../app/features/content-relation/types'
const mocks = vi.hoisted(() => ({ api: vi.fn() }))
mockNuxtImport('useAdminApi', () => () => mocks.api)
let wrapper: { unmount(): void } | undefined
afterEach(() => {
  wrapper?.unmount()
  mocks.api.mockReset()
})
it('恢复副本保留关联类型编号和順序，不保存派生标题或外部地址', () => {
  const relations: ContentRelation[] = [
    { type: 'gallery', id: 3 },
    { type: 'post', id: 8 },
  ]
  expect(copyContentRelations([{ ...relations[0]!, title: '不保存' } as ContentRelation])).toEqual([relations[0]])
  expect(validContentRelations([{ type: 'post', id: -1 }])).toBe(false)
  const base = {
    version: 1,
    context: 'content-library',
    id: 1,
    revision: 0,
    requestId: '11111111-1111-4111-8111-111111111111',
    pendingCreate: null,
    savedAt: '2026-09-11T00:00:00Z',
  }
  const project = parseProjectRecovery(JSON.stringify({ ...base, form: projectForm({ relatedContent: relations }) }))
  const gallery = parseGalleryRecovery(JSON.stringify({ ...base, form: galleryForm({ relatedContent: relations }) }))
  expect(project?.form.relatedContent).toEqual(relations)
  expect(gallery?.form.relatedContent).toEqual(relations)
  expect(projectForm().relatedContent).toEqual([])
  expect(galleryForm().relatedContent).toEqual([])
})
it('选择器拒绝自身和重复，排序创建新数组，解析失败保留失效编号', async () => {
  const value = ref<ContentRelation[]>([]),
    enabled = ref(true)
  mocks.api.mockImplementation((path: string, options?: { body?: { relatedContent: ContentRelation[] } }) =>
    Promise.resolve(
      path.endsWith('/resolve')
        ? options!.body!.relatedContent.map((item) => ({
            ...item,
            title: '目标',
            status: 'published',
            available: true,
          }))
        : { items: [], total: 0 },
    ),
  )
  let state!: ReturnType<typeof useContentRelationPicker>
  wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useContentRelationPicker(value, ref({ type: 'post' as const, id: 1 }), enabled, (next) => {
          value.value = next
        })
        return () => h('div')
      },
    }),
  )
  state.choose({ type: 'post', id: 1 })
  expect(value.value).toEqual([])
  state.choose({ type: 'gallery', id: 2 })
  state.choose({ type: 'gallery', id: 2 })
  state.choose({ type: 'project', id: 3 })
  await flushPromises()
  const original = copyContentRelations(value.value)
  state.move(1, -1)
  expect(value.value).toEqual([original[1], original[0]])
  expect(original[0]?.type).toBe('gallery')
  await flushPromises()
  mocks.api.mockRejectedValueOnce(new Error('断连'))
  await state.resolve()
  expect(state.props.value.resolveError).toContain('原有编号和顺序已保留')
  expect(value.value).toEqual([original[1], original[0]])
  expect(state.props.value.selected.every((item) => item.status === 'unknown')).toBe(true)
  enabled.value = false
  state.remove(0)
  expect(value.value).toHaveLength(2)
})
