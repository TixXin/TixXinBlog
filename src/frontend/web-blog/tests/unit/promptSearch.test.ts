/** @file promptSearch.test.ts @description 搜索组合输入、防抖提交、历史导航和卸载取消的 URL 行为回归。 */
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { Router } from 'vue-router'
import { useRouter } from '#app'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { usePromptSearch } from '../../app/composables/usePromptSearch'

const wrappers: { unmount(): void }[] = []
const guards: (() => void)[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  guards.splice(0).forEach((remove) => remove())
  vi.restoreAllMocks()
})

async function setup(route = '/prompts?model=Flux&page=2&prompt=7') {
  let state!: ReturnType<typeof usePromptSearch>
  let router!: Router
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = usePromptSearch(30)
        router = useRouter()
        return () => h('div')
      },
    }),
    { route },
  )
  wrappers.push(wrapper)
  return { state, router, wrapper }
}

it('连续输入只提交完成的关键词，并保留筛选、清除旧页码和详情', async () => {
  const { state, router } = await setup()
  const replace = vi.spyOn(router, 'replace')
  state.keyword.value = '窗'
  state.keyword.value = '窗边的光'
  expect(router.currentRoute.value.query.q).toBeUndefined()
  expect(replace).not.toHaveBeenCalled()
  await vi.waitFor(() => expect(router.currentRoute.value.query.q).toBe('窗边的光'))
  expect(replace).toHaveBeenCalledOnce()
  expect(router.currentRoute.value.query).toEqual({ model: 'Flux', q: '窗边的光' })
})

it('中文组合输入期间不改路由，结束后才提交最终汉字，Enter 可立即提交', async () => {
  const { state, router } = await setup()
  state.startComposition()
  state.keyword.value = 'chuang'
  state.submit()
  await new Promise((resolve) => setTimeout(resolve, 60))
  expect(router.currentRoute.value.query.q).toBeUndefined()
  state.keyword.value = '窗'
  state.endComposition(new CompositionEvent('compositionend'))
  state.submit()
  await vi.waitFor(() => expect(router.currentRoute.value.query.q).toBe('窗'))
})

it('历史路由到来时取消尚未提交的文字，并同步历史关键词', async () => {
  const { state, router } = await setup('/prompts?q=旧关键词&model=Flux')
  state.keyword.value = '尚未提交'
  await router.push('/prompts?q=历史关键词&tag=光影')
  await flushPromises()
  expect(state.keyword.value).toBe('历史关键词')
  await new Promise((resolve) => setTimeout(resolve, 60))
  expect(router.currentRoute.value.query).toEqual({ q: '历史关键词', tag: '光影' })
})

it('输入中清除筛选也会取消尚未提交的搜索，卸载后不能回写路由', async () => {
  const { state, router, wrapper } = await setup()
  state.keyword.value = '待清除'
  await router.push('/prompts')
  await flushPromises()
  expect(state.keyword.value).toBe('')
  state.keyword.value = '离开后的文字'
  wrapper.unmount()
  await new Promise((resolve) => setTimeout(resolve, 60))
  expect(router.currentRoute.value.query).toEqual({})
})

it('自动纠正页码保留尚未提交的搜索，并在纠正后继续提交最新文字', async () => {
  const { state, router } = await setup('/prompts?q=旧关键词&page=999&model=Flux')
  state.keyword.value = '窗边的新光'
  await state.replacePreservingInput({ path: '/prompts', query: { q: '旧关键词', page: '2', model: 'Flux' } })
  await flushPromises()
  expect(state.keyword.value).toBe('窗边的新光')
  expect(router.currentRoute.value.query.page).toBe('2')
  await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ q: '窗边的新光', model: 'Flux' }))
})

it('自动纠正页码不结束中文组合输入，结束后才提交最终汉字', async () => {
  const { state, router } = await setup('/prompts?q=旧关键词&page=999')
  state.startComposition()
  state.keyword.value = 'chuang'
  await state.replacePreservingInput({ path: '/prompts', query: { q: '旧关键词', page: '2' } })
  await flushPromises()
  expect(state.keyword.value).toBe('chuang')
  state.submit()
  await new Promise((resolve) => setTimeout(resolve, 60))
  expect(router.currentRoute.value.query).toEqual({ q: '旧关键词', page: '2' })
  state.keyword.value = '窗'
  state.endComposition(new CompositionEvent('compositionend'))
  await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ q: '窗' }))
})

it('自身搜索导航迟到时保留后续输入，并继续提交更新的关键词', async () => {
  const { state, router } = await setup('/prompts?q=旧关键词&model=Flux')
  const replace = vi.spyOn(router, 'replace')
  let finish!: () => void
  let entered = false
  const held = new Promise<void>((resolve) => {
    finish = resolve
  })
  guards.push(
    router.beforeEach(async (to) => {
      if (to.query.q === '第一段') {
        entered = true
        await held
      }
    }),
  )
  state.keyword.value = '第一段'
  state.submit()
  const firstNavigation = replace.mock.results[0]!.value as Promise<unknown>
  await vi.waitFor(() => expect(entered).toBe(true))
  state.keyword.value = '第一段继续输入'
  finish()
  await firstNavigation
  await flushPromises()
  expect(router.currentRoute.value.query.q).toBe('第一段')
  expect(state.keyword.value).toBe('第一段继续输入')
  await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ q: '第一段继续输入', model: 'Flux' }))
})

it('普通页码或筛选导航即使关键词不变，也取消未提交输入并服从用户目标', async () => {
  const { state, router } = await setup('/prompts?q=旧关键词&page=3&model=Flux')
  state.keyword.value = '尚未提交'
  await router.push('/prompts?q=旧关键词&page=2&model=Flux')
  await flushPromises()
  expect(state.keyword.value).toBe('旧关键词')
  await new Promise((resolve) => setTimeout(resolve, 60))
  expect(router.currentRoute.value.query).toEqual({ q: '旧关键词', page: '2', model: 'Flux' })
})
