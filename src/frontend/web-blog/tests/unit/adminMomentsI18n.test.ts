/**
 * @file adminMomentsI18n.test.ts
 * @description 后台朋友圈与闪念的英文冒烟：动态编辑表单、闪念状态确认与操作提示在英文界面下切换为英文，
 *              切回中文后保持原文
 * @author TixXin
 * @since 2026-10-19
 */

import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import MomentForm from '../../app/components/admin/MomentForm.vue'
import { useAdminFlashes } from '../../app/composables/useAdminFlashes'
import { momentForm } from '../../app/features/moment/editor'
import type { FlashNote } from '../../app/features/flash/types'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  success: vi.fn(),
  route: { path: '/admin/flashes', fullPath: '/admin/flashes', query: {} as Record<string, string> },
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useToast', () => () => ({ success: mocks.success, error: vi.fn() }))
mockNuxtImport('useRoute', () => () => mocks.route)
mockNuxtImport('useCurrentUser', () => () => ({
  currentUser: ref({ id: 'owner' }),
  isLoggedIn: ref(true),
  restoringPending: ref(false),
  restore: vi.fn().mockResolvedValue(true),
}))
mockNuxtImport('onBeforeRouteLeave', () => () => undefined)
mockNuxtImport('onBeforeRouteUpdate', () => () => undefined)

/** 用到时再取：收集阶段 Nuxt 测试应用尚未就绪 */
const i18n = () => useNuxtApp().$i18n

async function inEnglish(run: () => void | Promise<void>) {
  await i18n().setLocale('en')
  try {
    await run()
  } finally {
    await i18n().setLocale('zh-CN')
  }
}

const SlotStub = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
})
const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function mountForm() {
  const wrapper = await mountSuspended(MomentForm, {
    props: {
      value: { ...momentForm(), content: 'Evening breeze', topics: ['river', 'walk'] },
      id: 'm1',
      ready: true,
      loading: false,
      saving: false,
      dirty: true,
      saved: null,
      serverVersion: null,
      recovery: null,
      error: '',
      notice: '',
      localError: '',
      articleChoices: [],
      articlesPending: false,
      articlesError: '',
    },
    global: {
      stubs: {
        AdminBackLink: SlotStub,
        NuxtLink: true,
        AdminActionBar: SlotStub,
        CommonTooltip: SlotStub,
        ClientOnly: SlotStub,
        AdminMediaPicker: true,
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

const flash = {
  id: 'f1',
  content: 'note',
  tags: [],
  comments: [],
  isDraft: true,
  isPinned: false,
} as unknown as FlashNote

async function mountFlashes() {
  let state!: ReturnType<typeof useAdminFlashes>
  mocks.route = reactive({ path: '/admin/flashes', fullPath: '/admin/flashes', query: {} })
  mocks.api.mockReset().mockResolvedValue({ items: [flash], total: 1 })
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          state = useAdminFlashes()
          return () => h('div')
        },
      }),
    ),
  )
  await flushPromises()
  return state
}

describe('后台朋友圈与闪念英文冒烟', () => {
  it('动态编辑表单显示英文标签与按钮，话题用英文逗号连接', async () => {
    await inEnglish(async () => {
      const wrapper = await mountForm()
      const text = wrapper.text()
      expect(text).toContain('Edit moment')
      expect(text).toContain('Back to moments')
      expect(text).toContain('Save moment')
      expect(text).toContain('Publish moment')
      expect(text).toContain('Unsaved changes')
      expect(wrapper.find('textarea').attributes('aria-label')).toBe('Moment text')
      expect(wrapper.find('input[aria-label="Moment topics"]').element).toHaveProperty('value', 'river, walk')
    })
  })

  it('切回中文后动态表单保持原文', async () => {
    const wrapper = await mountForm()
    expect(wrapper.text()).toContain('保存动态')
    expect(wrapper.find('input[aria-label="动态话题"]').element).toHaveProperty('value', 'river，walk')
  })

  it('闪念状态操作的确认与成功提示随语言切换', async () => {
    const confirm = vi.fn(() => true)
    vi.stubGlobal('confirm', confirm)
    await inEnglish(async () => {
      const state = await mountFlashes()
      await state.update(flash, 'publish')
      expect(confirm).toHaveBeenLastCalledWith('Publish this flash note?')
      expect(mocks.success).toHaveBeenLastCalledWith('Published')
    })
    const state = await mountFlashes()
    await state.update(flash, 'withdraw')
    expect(confirm).toHaveBeenLastCalledWith('确定撤回为草稿这条闪念？草稿不会公开。')
    expect(mocks.success).toHaveBeenLastCalledWith('已撤回为草稿')
  })

  it('闪念接口失败时优先显示后端说明，否则显示当前语言兜底', async () => {
    await inEnglish(async () => {
      const state = await mountFlashes()
      mocks.api.mockRejectedValueOnce(new Error('[GET] /api/v1/admin/flashes: 500'))
      await state.load()
      expect(state.error.value).toBe("Couldn't load flash notes. Please try again.")
      mocks.api.mockRejectedValueOnce({ data: { message: '后端说明' } })
      await state.load()
      expect(state.error.value).toBe('后端说明')
    })
  })
})
