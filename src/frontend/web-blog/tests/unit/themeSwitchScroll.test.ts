/** @vitest-environment happy-dom */
/**
 * @file themeSwitchScroll.test.ts
 * @description 主题切换快照回归：切换前记录页面滚动、主题内部滚动容器与焦点，切换后按 DOM 顺序尽力恢复
 */
import { beforeEach, describe, expect, it } from 'vitest'
import type { ThemeSwitchSnapshot } from '../../app/utils/themeSwitchScroll'
import { captureThemeSwitchSnapshot, restoreThemeSwitchSnapshot } from '../../app/utils/themeSwitchScroll'

function clearDom() {
  document.body.replaceChildren()
  window.scrollTo({ top: 0 })
}

/** 复刻三主题根布局里会被整体重挂的滚动容器顺序 */
function buildScrollRoots(tops: [number, number]) {
  const first = document.createElement('div')
  first.className = 'custom-scrollbar__viewport'
  const second = document.createElement('div')
  second.className = 'article-viewport'
  document.body.append(first, second)
  first.scrollTop = tops[0]
  second.scrollTop = tops[1]
  return { first, second }
}

beforeEach(clearDom)

describe('captureThemeSwitchSnapshot', () => {
  it('记录页面滚动、内部滚动容器位置与焦点标识', () => {
    const { first, second } = buildScrollRoots([120, 40])
    const search = document.createElement('button')
    search.id = 'search-input'
    search.dataset.focusKey = 'search'
    document.body.append(search)
    search.focus()
    window.scrollTo({ top: 480 })

    expect(captureThemeSwitchSnapshot()).toEqual({
      windowY: 480,
      scrollTops: [first.scrollTop, second.scrollTop],
      focusKey: 'search',
      focusId: 'search-input',
    })
  })

  it('没有聚焦元素时记录空焦点，不把 body 当成目标', () => {
    buildScrollRoots([0, 0])
    const snapshot = captureThemeSwitchSnapshot()
    expect(snapshot?.focusKey).toBeNull()
    expect(snapshot?.focusId).toBeNull()
  })

  it('文档没有关联窗口时安全返回 null，不阻断主题切换', () => {
    const detached = document.implementation.createHTMLDocument('detached')
    expect(detached.defaultView).toBeNull()
    expect(captureThemeSwitchSnapshot(detached)).toBeNull()
  })
})

describe('restoreThemeSwitchSnapshot', () => {
  it('按 DOM 顺序恢复内部滚动与焦点', () => {
    const snapshot: ThemeSwitchSnapshot = {
      windowY: 480,
      scrollTops: [120, 40],
      focusKey: 'search',
      focusId: 'search-input',
    }
    const { first, second } = buildScrollRoots([0, 0])
    const search = document.createElement('button')
    search.id = 'search-input'
    search.dataset.focusKey = 'search'
    document.body.append(search)
    search.focus()
    search.blur()

    restoreThemeSwitchSnapshot(snapshot)

    expect(window.scrollY).toBe(480)
    expect(first.scrollTop).toBe(120)
    expect(second.scrollTop).toBe(40)
    expect(document.activeElement).toBe(search)
  })

  it('焦点标识缺失时按 id 恢复', () => {
    const { first } = buildScrollRoots([0, 0])
    const submit = document.createElement('button')
    submit.id = 'submit'
    document.body.append(submit)

    restoreThemeSwitchSnapshot({ windowY: 0, scrollTops: [90], focusKey: 'gone', focusId: 'submit' })

    expect(first.scrollTop).toBe(90)
    expect(document.activeElement).toBe(submit)
  })

  it('新旧布局都没有可定位焦点时回退主内容区', () => {
    const main = document.createElement('main')
    main.id = 'main-content'
    main.tabIndex = -1
    document.body.append(main)

    restoreThemeSwitchSnapshot({ windowY: 0, scrollTops: [], focusKey: 'gone', focusId: null })

    expect(document.activeElement).toBe(main)
  })

  it('用户已在新布局里聚焦时不抢焦点', () => {
    const current = document.createElement('button')
    current.id = 'current'
    const previous = document.createElement('button')
    previous.dataset.focusKey = 'search'
    document.body.append(current, previous)
    current.focus()

    restoreThemeSwitchSnapshot({ windowY: 0, scrollTops: [], focusKey: 'search', focusId: null })

    expect(document.activeElement).toBe(current)
  })

  it('没有快照或快速返回时安全返回，不抛错也不改滚动', () => {
    const { first } = buildScrollRoots([30, 0])
    expect(() => restoreThemeSwitchSnapshot(null)).not.toThrow()
    expect(window.scrollY).toBe(0)
    expect(first.scrollTop).toBe(30)

    const detached = document.implementation.createHTMLDocument('detached')
    expect(() =>
      restoreThemeSwitchSnapshot({ windowY: 10, scrollTops: [1], focusKey: null, focusId: null }, detached),
    ).not.toThrow()
  })
})
