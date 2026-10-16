/**
 * @file ssrTeleportSlot.test.ts
 * @description 只包含 Teleport 的插槽在 SSR 输出中必须保留原位标记，否则客户端水合找不到锚点（对应 @vue/server-renderer 补丁）
 */
import { describe, expect, it } from 'vitest'
import { Comment, createSSRApp, defineComponent, h, Teleport } from 'vue'
import { renderToString, type SSRContext } from '@vue/server-renderer'

const Frame = defineComponent({
  setup(_, { slots }) {
    return () => h('div', { class: 'frame' }, [h('main', '正文'), slots.overlays?.()])
  },
})

describe('SSR 插槽中的 Teleport 标记', () => {
  it('插槽内容仅有 Teleport 时仍输出原位标记，内容进入目标缓冲', async () => {
    const app = createSSRApp({
      render: () =>
        h(Frame, null, {
          overlays: () => h(Teleport, { to: '#sidebar' }, [h('section', { class: 'card' }, '侧栏')]),
        }),
    })
    const ctx: SSRContext = {}
    const html = await renderToString(app, ctx)
    expect(html).toContain('<!--teleport start--><!--teleport end-->')
    expect(ctx.teleports?.['#sidebar']).toContain('<section class="card">侧栏</section>')
  })

  it('只有普通注释的插槽仍视为空，使用后备内容', async () => {
    const WithFallback = defineComponent({
      setup(_, { slots }) {
        return () => h('div', slots.default?.() ?? [h('i', '后备')])
      },
    })
    const app = createSSRApp({ render: () => h(WithFallback, null, { default: () => [h(Comment, '占位')] }) })
    const html = await renderToString(app, {})
    expect(html).toContain('<!--占位-->')
    expect(html).not.toContain('teleport start')
  })
})
