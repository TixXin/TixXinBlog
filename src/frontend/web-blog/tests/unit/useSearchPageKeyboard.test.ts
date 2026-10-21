/** @file useSearchPageKeyboard.test.ts @description 搜索页键盘焦点导航组合函数单元测试 */
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useSearchPageKeyboard } from '../../app/features/search/useSearchPageKeyboard'

describe('useSearchPageKeyboard', () => {
  it('应该在按向下键时从输入框导航到第一个结果', () => {
    const input = document.createElement('input')
    const resultList = document.createElement('div')
    const link1 = document.createElement('a')
    link1.setAttribute('data-search-result', '')
    const link2 = document.createElement('a')
    link2.setAttribute('data-search-result', '')
    resultList.appendChild(link1)
    resultList.appendChild(link2)

    const link1Focus = vi.spyOn(link1, 'focus')
    vi.spyOn(link1, 'scrollIntoView').mockImplementation(() => {})

    const inputRef = ref(input)
    const resultListRef = ref(resultList)
    const keyword = ref('vue')
    const activeQuery = ref('vue')
    const isSearching = ref(false)

    const { onInputKeydown } = useSearchPageKeyboard({
      inputRef,
      resultListRef,
      keyword,
      activeQuery,
      isSearching,
    })

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true })
    onInputKeydown(event)

    expect(event.defaultPrevented).toBe(true)
    expect(link1Focus).toHaveBeenCalled()
  })

  it('应该在搜索中或输入框内容与当前查询不一致时忽略键盘导航', () => {
    const input = document.createElement('input')
    const resultList = document.createElement('div')
    const link1 = document.createElement('a')
    link1.setAttribute('data-search-result', '')
    resultList.appendChild(link1)

    const link1Focus = vi.spyOn(link1, 'focus')
    const inputRef = ref(input)
    const resultListRef = ref(resultList)
    const keyword = ref('react')
    const activeQuery = ref('vue')
    const isSearching = ref(false)

    const { onInputKeydown } = useSearchPageKeyboard({
      inputRef,
      resultListRef,
      keyword,
      activeQuery,
      isSearching,
    })

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true })
    onInputKeydown(event)

    expect(event.defaultPrevented).toBe(false)
    expect(link1Focus).not.toHaveBeenCalled()
  })
})
