/** @file guestbookMessageGrouping.test.ts @description 留言连续分组边界与逐条交互回归，覆盖分页重算、身份、时间提示及键盘访问 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MessageList from '../../app/components/guestbook/MessageList.vue'
import MessageBubble from '../../app/components/guestbook/MessageBubble.vue'
import type { DateGroup, GuestMessage } from '../../app/features/guestbook/types'

mockNuxtImport('useToast', () => () => ({ error: vi.fn() }))
mockNuxtImport('useEntranceMotion', () => () => ({
  enter: (_element: Element, done: () => void) => done(),
  cancel: vi.fn(),
}))

const wrappers: { unmount(): void }[] = []
const origin = Date.parse('2026-10-18T10:00:00.000Z')
const message = (id: number, overrides: Partial<GuestMessage> = {}): GuestMessage => ({
  id,
  author: '小林',
  avatar: '/avatar.svg',
  content: `秋日散步记录 ${id}`,
  time: `2026年10月18日 18:${String(id).padStart(2, '0')}`,
  createdAt: new Date(origin + id * 60_000).toISOString(),
  isOwner: false,
  browser: 'Safari',
  region: '杭州',
  moderationStatus: 'published',
  ...overrides,
})
const groups = (messages: GuestMessage[]): DateGroup[] => [{ date: '2026-10-18', messages }]
async function setup(messages: GuestMessage[], overrides: Partial<InstanceType<typeof MessageList>['$props']> = {}) {
  const wrapper = await mountSuspended(MessageList, {
    attachTo: document.body,
    props: { groups: groups(messages), interactive: true, ...overrides },
    global: { stubs: { Icon: true } },
  })
  wrappers.push(wrapper)
  return wrapper
}
type ListWrapper = Awaited<ReturnType<typeof setup>>
const bubbles = (wrapper: ListWrapper) => wrapper.findAllComponents(MessageBubble)
const boundaries = (wrapper: ListWrapper) =>
  bubbles(wrapper).map((bubble) => [bubble.props('message').id, bubble.props('groupStart'), bubble.props('groupEnd')])
const bubbleById = (wrapper: ListWrapper, id: number) => wrapper.get(`[data-guestbook-id="${id}"]`)

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('连续消息分组边界', () => {
  it('空列表不产生消息，单条列表和单独使用的气泡均保留完整组首尾', async () => {
    const list = await setup([])
    expect(boundaries(list)).toEqual([])
    await list.setProps({ groups: groups([message(1)]) })
    expect(boundaries(list)).toEqual([[1, true, true]])
    const bubble = await mountSuspended(MessageBubble, {
      props: { message: message(9) },
      global: { stubs: { Icon: true } },
    })
    wrappers.push(bubble)
    expect(bubble.props()).toMatchObject({ groupStart: true, groupEnd: true })
    expect(bubble.get('.message-bubble__name').text()).toBe('小林')
    expect(bubble.get('.message-bubble__browser').text()).toBe('Safari')
    expect(bubble.get('.message-bubble__region').text()).toBe('杭州')
  })

  it.each([
    { label: '不足五分钟', interval: 299_999, grouped: true },
    { label: '恰好五分钟', interval: 300_000, grouped: true },
    { label: '超过五分钟', interval: 300_001, grouped: false },
    { label: '时间相同', interval: 0, grouped: true },
  ])('$label 的正逆序边界相同', async ({ interval, grouped }) => {
    const first = message(1, { createdAt: new Date(origin).toISOString() })
    const second = message(2, { createdAt: new Date(origin + interval).toISOString() })
    const wrapper = await setup([first, second])
    expect(boundaries(wrapper)).toEqual([
      [1, true, !grouped],
      [2, !grouped, true],
    ])
    await wrapper.setProps({ groups: groups([second, first]) })
    expect(boundaries(wrapper)).toEqual([
      [2, true, !grouped],
      [1, !grouped, true],
    ])
  })

  it.each([false, true])('博主身份为 %s 时按相邻间隔成组，保留头中尾及逐条身份和定位节点', async (isOwner) => {
    const messages = [0, 4, 8].map((minute, index) =>
      message(index + 1, { createdAt: new Date(origin + minute * 60_000).toISOString(), isOwner }),
    )
    const wrapper = await setup(messages)
    expect(boundaries(wrapper)).toEqual([
      [1, true, false],
      [2, false, false],
      [3, false, true],
    ])
    expect(bubbleById(wrapper, 1).classes()).not.toContain('message-list__continuation')
    expect(bubbleById(wrapper, 2).classes()).toContain('message-list__continuation')
    expect(bubbleById(wrapper, 3).classes()).toContain('message-list__continuation')
    expect(bubbleById(wrapper, 1).classes()).not.toContain('message-bubble--continuation')
    expect(bubbleById(wrapper, 2).classes()).toContain('message-bubble--continuation')
    expect(bubbleById(wrapper, 1).classes()).not.toContain('message-bubble--group-end')
    expect(bubbleById(wrapper, 2).classes()).not.toContain('message-bubble--group-end')
    expect(bubbleById(wrapper, 3).classes()).toContain('message-bubble--group-end')
    expect(wrapper.findAll('[data-guestbook-id]').map((item) => item.attributes('data-guestbook-id'))).toEqual([
      '1',
      '2',
      '3',
    ])
    for (const item of messages) {
      const content = bubbleById(wrapper, item.id).get('.message-bubble__content')
      expect(content.attributes('tabindex')).toBe('0')
      expect(content.attributes('role')).toBe('group')
      expect(content.attributes('aria-label')).toBe(`${item.author}${isOwner ? '（博主）' : ''}，${item.time}`)
    }
  })

  it.each([
    { label: '作者不同', overrides: { author: '小周' } },
    { label: '头像不同', overrides: { avatar: '/another-avatar.svg' } },
    { label: '博主身份不同', overrides: { isOwner: true } },
    { label: '作者为空', overrides: { author: '' } },
    { label: '时间缺失', overrides: { createdAt: undefined } },
    { label: '时间为空', overrides: { createdAt: '' } },
    { label: '时间非法', overrides: { createdAt: 'not-a-date' } },
  ])('$label 时不合并，也不借用相同的展示时间', async ({ overrides }) => {
    const first = message(1)
    const second = message(2, { ...overrides, time: first.time })
    const wrapper = await setup([first, second])
    expect(boundaries(wrapper)).toEqual([
      [1, true, true],
      [2, true, true],
    ])
    await wrapper.setProps({ groups: groups([second, first]) })
    expect(boundaries(wrapper)).toEqual([
      [2, true, true],
      [1, true, true],
    ])
  })

  it('另一作者打断连续分组，移除插入记录后重新合并且保留消息 DOM 身份', async () => {
    const first = message(1)
    const last = message(3)
    const wrapper = await setup([first, message(2, { author: '小周' }), last])
    const originalLast = bubbleById(wrapper, 3).element
    expect(boundaries(wrapper)).toEqual([
      [1, true, true],
      [2, true, true],
      [3, true, true],
    ])
    await wrapper.setProps({ groups: groups([first, last]) })
    expect(boundaries(wrapper)).toEqual([
      [1, true, false],
      [3, false, true],
    ])
    expect(bubbleById(wrapper, 3).element).toBe(originalLast)
  })

  it('跨日期数据容器仍以平铺后的相邻时间分组，并使用末条设备地区', async () => {
    const first = message(1, { createdAt: '2026-10-17T23:59:00.000Z' })
    const second = message(2, { createdAt: '2026-10-18T00:01:00.000Z', browser: 'Firefox', region: '上海' })
    const wrapper = await setup([], {
      groups: [
        { date: '2026-10-17', messages: [first] },
        { date: '2026-10-18', messages: [second] },
      ],
    })
    expect(boundaries(wrapper)).toEqual([
      [1, true, false],
      [2, false, true],
    ])
    expect(bubbleById(wrapper, 2).get('.message-bubble__browser').text()).toBe('Firefox')
    expect(bubbleById(wrapper, 2).get('.message-bubble__region').text()).toBe('上海')
  })

  it('前插与追加分页后重算组首尾，筛选或删除记录后保留其余消息的 DOM 身份', async () => {
    const first = message(1)
    const middle = message(2)
    const last = message(3)
    const wrapper = await setup([middle])
    const originalMiddle = bubbleById(wrapper, 2).element
    await wrapper.setProps({ groups: groups([first, middle]) })
    expect(boundaries(wrapper)).toEqual([
      [1, true, false],
      [2, false, true],
    ])
    await wrapper.setProps({ groups: groups([first, middle, last]) })
    expect(boundaries(wrapper)).toEqual([
      [1, true, false],
      [2, false, false],
      [3, false, true],
    ])
    expect(bubbleById(wrapper, 2).element).toBe(originalMiddle)
    const originalLast = bubbleById(wrapper, 3).element
    await wrapper.setProps({ groups: groups([middle, last]) })
    expect(boundaries(wrapper)).toEqual([
      [2, true, false],
      [3, false, true],
    ])
    expect(bubbleById(wrapper, 2).element).toBe(originalMiddle)
    await wrapper.setProps({ groups: groups([last]) })
    expect(boundaries(wrapper)).toEqual([[3, true, true]])
    expect(bubbleById(wrapper, 3).element).toBe(originalLast)
  })
})

describe('分组后的逐条交互', () => {
  it('回复、引用跳转与反应仍使用各自消息编号，正文与作者高亮保持', async () => {
    const items = [1, 2, 3].map((id) =>
      message(id, {
        author: '秋日访客',
        replyTo: { id: 10 + id, author: '博主', content: `原留言 ${id}` },
        reactions: [{ emoji: '👍', count: id, reacted: id === 2 }],
      }),
    )
    const wrapper = await setup(items, { highlight: '秋日' })
    for (const item of items) {
      const bubble = bubbleById(wrapper, item.id)
      expect(bubble.get('.message-bubble__text mark').text()).toBe('秋日')
      await bubble.get('[aria-label="回复秋日访客的留言"]').trigger('click')
      await bubble.get('.message-bubble__reply--link').trigger('click')
      const reaction = bubble.get('.message-bubble__reaction')
      expect(reaction.attributes('aria-pressed')).toBe(String(item.id === 2))
      expect(reaction.text()).toBe(String(item.id))
      await reaction.trigger('click')
    }
    expect(wrapper.get('.message-bubble__name mark').text()).toBe('秋日')
    expect(wrapper.emitted('reply')).toEqual(items.map((item) => [item]))
    expect(wrapper.emitted('jump')).toEqual(items.map((item) => [{ target: 10 + item.id, from: item.id }]))
    expect(wrapper.emitted('react')).toEqual(
      items.map((item) => [{ id: item.id, emoji: '👍', reacted: item.id !== 2, complete: expect.any(Function) }]),
    )
  })

  it('每条消息的待审核、反应进行中与错误状态互不影响，禁用操作不产生事件', async () => {
    const items = [1, 2, 3].map((id) =>
      message(id, {
        moderationStatus: id === 1 ? 'pending' : 'published',
        reactions: [{ emoji: '👍', count: 1, reacted: false }],
      }),
    )
    const wrapper = await setup(items, { reacting: [2], reactionErrors: { 2: '回应未保存，请重试' } })
    const pending = bubbleById(wrapper, 1)
    expect(pending.text()).toContain('待审核，仅自己可见')
    const reply = pending.get('[aria-label="回复小林的留言"]')
    expect(reply.attributes('disabled')).toBeDefined()
    await reply.trigger('click')
    for (const id of [1, 2]) {
      const bubble = bubbleById(wrapper, id)
      for (const selector of ['.message-bubble__reaction', '[aria-label="添加回应"]']) {
        const control = bubble.get(selector)
        expect(control.attributes('disabled')).toBeDefined()
        await control.trigger('click')
      }
    }
    expect(bubbleById(wrapper, 1).find('[role="alert"]').exists()).toBe(false)
    expect(bubbleById(wrapper, 2).get('[role="alert"]').text()).toBe('回应未保存，请重试')
    expect(bubbleById(wrapper, 3).get('.message-bubble__reaction').attributes('disabled')).toBeUndefined()
    expect(wrapper.emitted('reply')).toBeUndefined()
    expect(wrapper.emitted('react')).toBeUndefined()
    await bubbleById(wrapper, 3).get('.message-bubble__reaction').trigger('click')
    expect(wrapper.emitted('react')?.[0]?.[0]).toMatchObject({ id: 3, reacted: true })
    await wrapper.setProps({ interactive: false })
    expect(bubbleById(wrapper, 3).get('.message-bubble__reaction').attributes('disabled')).toBeDefined()
  })

  it.each(['悬停', '键盘聚焦'])('%s消息正文不再弹出时间提示，时间仍保留在无障碍标签中', async (mode) => {
    const wrapper = await setup([message(1)])
    const content = bubbleById(wrapper, 1).get('.message-bubble__content')
    const trigger = content.element.parentElement!
    if (mode === '悬停') trigger.dispatchEvent(new MouseEvent('mouseenter'))
    else (content.element as HTMLElement).focus()
    vi.useFakeTimers()
    await vi.advanceTimersByTimeAsync(220)
    await nextTick()
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    expect(content.attributes('aria-describedby')).toBeUndefined()
    expect(content.attributes('aria-label')).toContain('2026年10月18日 18:01')
    if (mode === '悬停') trigger.dispatchEvent(new MouseEvent('mouseleave'))
    else (content.element as HTMLElement).blur()
  })
})
