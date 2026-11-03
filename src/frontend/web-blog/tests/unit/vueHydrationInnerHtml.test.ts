/**
 * @file vueHydrationInnerHtml.test.ts
 * @description v-html 水合：服务端输出与客户端一致时保留原节点，不一致时仍纠正（对应 @vue/runtime-core 补丁）
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createElementVNode, createSSRApp, ref } from 'vue'
import { renderToString } from '@vue/server-renderer'

// 与模板 `<div class="body" v-html="html" />` 的编译结果一致：innerHTML 是动态属性（PROPS 标记）。
function contentApp(html: () => string) {
  return createSSRApp({
    render: () => createElementVNode('div', { class: 'body', innerHTML: html() }, null, 8, ['innerHTML']),
  })
}

const containers: HTMLElement[] = []
afterEach(() => containers.splice(0).forEach((node) => node.remove()))

async function hydrate(serverHtml: string, clientHtml: string) {
  const container = document.createElement('div')
  containers.push(container)
  container.innerHTML = await renderToString(contentApp(() => serverHtml))
  document.body.append(container)
  const before = [...container.querySelectorAll('.body *')]
  const content = ref(clientHtml)
  contentApp(() => content.value).mount(container)
  return { container, before, content }
}

describe('v-html 水合', () => {
  it('服务端与客户端内容一致时不重写，原有子节点保持在文档中', async () => {
    const html = '<h2 id="a">标题</h2>\n<p>正文 <img src="/a.png" alt="图"></p>\n'
    const { container, before } = await hydrate(html, html)
    expect(before.length).toBe(3)
    expect(before.every((node) => node.isConnected)).toBe(true)
    expect(container.querySelector('.body')!.innerHTML).toBe(html)
  })

  it('内容不一致时仍按客户端结果纠正', async () => {
    const { container, before } = await hydrate('<p>旧内容</p>', '<p>新内容</p>')
    expect(before[0]!.isConnected).toBe(false)
    expect(container.querySelector('.body')!.innerHTML).toBe('<p>新内容</p>')
  })

  it('水合后内容变化照常更新', async () => {
    const { container, content } = await hydrate('<p>一</p>', '<p>一</p>')
    content.value = '<p>二</p>'
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve))
    expect(container.querySelector('.body')!.innerHTML).toBe('<p>二</p>')
  })
})
