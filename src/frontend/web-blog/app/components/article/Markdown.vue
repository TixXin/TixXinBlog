<!--
  @file Markdown.vue
  @description 管理后台编辑和前台文章共用的安全 Markdown 预览；正文标题由渲染工具降一级输出。
               含代码块时先按需加载精简高亮器（服务端渲染与客户端水合都等待加载，保证 HTML 一致），
               复制按钮在客户端挂载到代码块标题栏及正文标题，正文图片点击打开文章灯箱
-->
<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <article ref="rootRef" v-bind="$attrs" class="article-markdown" @click="openImage" v-html="html" />
  <CommonMarkdownImages :root="rootRef" :html="html" />
  <Teleport v-for="block in codeBlocks" :key="block.key" :to="block.target">
    <ArticleCodeCopyButton :code="block.code" />
  </Teleport>
  <Teleport v-for="heading in headings" :key="heading.key" :to="heading.target">
    <ArticleHeadingAnchorButton :heading-id="heading.id" :heading-text="heading.text" />
  </Teleport>
  <LazyArticleImageLightbox
    v-if="lightboxIndex !== null"
    v-model:index="lightboxIndex"
    :images="lightboxImages"
    @close="lightboxIndex = null"
  />
</template>

<script setup lang="ts">
import { renderArticleMarkdown } from '~/utils/articleMarkdown'
import { collectCodeLanguages, loadCodeHighlighter, type CodeHighlighter } from '~/utils/highlightCode'
import type { ArticleLightboxImage } from '~/components/article/ImageLightbox.vue'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ content: string; title?: string }>()
const siteUrl = useSiteUrl()

const highlighter = shallowRef<CodeHighlighter | null>(null)
const languages = computed(() => collectCodeLanguages(props.content))
let loading = 0
async function ensureHighlighter(names: string[]) {
  const ticket = ++loading
  try {
    const loaded = await loadCodeHighlighter(names)
    // 新语言加载完成后换一个外观对象，触发正文重新渲染；过期请求不覆盖较新的结果
    if (ticket === loading) highlighter.value = { highlight: (code, language) => loaded.highlight(code, language) }
  } catch {
    // 高亮器加载失败时保持纯文本代码块
  }
}
// 服务端与水合阶段必须等待高亮器，否则客户端首帧与服务端 HTML 不一致；之后的编辑预览在后台加载
const nuxtApp = useNuxtApp()
if (languages.value.length && (import.meta.server || nuxtApp.isHydrating)) await ensureHighlighter(languages.value)
else if (import.meta.client && languages.value.length) void ensureHighlighter(languages.value)
watch(languages, (names, previous) => {
  if (import.meta.client && names.length && names.join() !== previous?.join()) void ensureHighlighter(names)
})

// 渲染出的代码块标签、查看大图与新窗口提示跟随界面语言；服务端与水合使用同一 cookie 语言，HTML 保持一致
const { t, locale } = useI18n()
const html = computed(() => {
  void locale.value
  return renderArticleMarkdown(props.content, props.title, { highlighter: highlighter.value, siteUrl, t })
})

// 复制按钮：客户端复用静态挂载位，SSR 不读取浏览器地址或输出交互组件
const rootRef = ref<HTMLElement | null>(null)
const codeBlocks = shallowRef<{ key: string; target: HTMLElement; code: string }[]>([])
const headings = shallowRef<{ key: string; target: HTMLElement; id: string; text: string }[]>([])
let generation = 0
function collectCopyTargets() {
  const root = rootRef.value
  if (!root) return
  generation++
  codeBlocks.value = [...root.querySelectorAll<HTMLElement>('.article-code')].flatMap((block, index) => {
    const target = block.querySelector<HTMLElement>('.article-code__actions')
    const code = block.querySelector('pre code')?.textContent ?? ''
    return target ? [{ key: `${generation}-${index}`, target, code }] : []
  })
  headings.value = [...root.querySelectorAll<HTMLElement>('h2[id], h3[id], h4[id], h5[id], h6[id]')].flatMap(
    (heading, index) => {
      const target = heading.querySelector<HTMLElement>('.article-heading__anchor')
      // 复制提示沿用标题正文；按钮在命名节点之外，避免图标或状态文案进入可访问名
      const label = heading.querySelector<HTMLElement>(`#${heading.id}-text`)
      const text = (label ?? heading).textContent?.replace(/\s+/g, ' ').trim() ?? ''
      return target ? [{ key: `${generation}-${index}`, target, id: heading.id, text }] : []
    },
  )
}
onMounted(collectCopyTargets)
watch(html, collectCopyTargets, { flush: 'post' })

// 图片灯箱：只收集正文中带放大触发器的图片，在同一篇文章内切换
const lightboxImages = shallowRef<ArticleLightboxImage[]>([])
const lightboxIndex = ref<number | null>(null)
function openImage(event: MouseEvent) {
  const trigger = event.target instanceof Element ? event.target.closest('[data-article-image]') : null
  const root = rootRef.value
  if (!trigger || !root) return
  const triggers = [...root.querySelectorAll('[data-article-image]')]
  lightboxImages.value = triggers.map((element) => {
    const image = element.closest('.markdown-image')?.querySelector('img') ?? element.querySelector('img')
    // 灯箱用原图地址而非 srcset 选中的缩小变体
    return { src: image?.src ?? '', alt: image?.alt ?? '' }
  })
  lightboxIndex.value = Math.max(0, triggers.indexOf(trigger))
}
watch(html, () => {
  lightboxIndex.value = null
})
</script>

<style scoped lang="scss">
.article-markdown {
  color: var(--text-main);
  line-height: 1.8;
  overflow-wrap: anywhere;
  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin: 1.5rem 0 0.75rem;
    scroll-margin-top: 5rem;
  }
  // 正文标题已降一级渲染（# → h2），字号按原 Markdown 级别保持
  :deep(h2) {
    font-size: 1.6rem;
  }
  :deep(h3) {
    font-size: 1.3rem;
  }
  :deep(h4) {
    font-size: 1.1rem;
  }
  // 保留按钮空间避免悬停时标题重排；透明按钮仍可 Tab 聚焦，触屏直接显示入口
  :deep(.article-heading__anchor) {
    display: inline-flex;
    margin-inline-start: 0.35rem;
    vertical-align: middle;
    font-size: 1rem;
    line-height: 1;
    opacity: 0;
    transition: opacity 0.15s ease;

    &:empty {
      display: none;
    }

    @media (hover: none) {
      opacity: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }
  :deep(:is(h2, h3, h4, h5, h6):hover .article-heading__anchor),
  :deep(:is(h2, h3, h4, h5, h6):focus-within .article-heading__anchor) {
    opacity: 1;
  }
  :deep(p),
  :deep(ul),
  :deep(ol) {
    margin: 0 0 1rem;
  }
  :deep(ul),
  :deep(ol) {
    padding-left: 1.5rem;
  }
  // 代码块：容器限宽不撑破布局，长行在 pre 内横向滚动；配色取 Shiki 双主题变量，随 html.dark 切换
  :deep(.article-code) {
    max-width: 100%;
    margin: 0 0 1.25rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--surface-2);
    overflow: hidden;
  }
  :deep(.article-code__header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-height: 2.5rem;
    padding: 0.25rem 0.5rem 0.25rem 1rem;
    border-bottom: 1px solid var(--border);
  }
  :deep(.article-code__lang) {
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1.2;
    overflow-wrap: normal;
  }
  :deep(.article-code__actions) {
    display: inline-flex;
    flex-shrink: 0;
    min-height: 2rem;
  }
  :deep(pre) {
    margin: 0;
    padding: 1rem;
    overflow-x: auto;
    background: var(--surface-2);
    border-radius: 0.75rem;
    font-size: 0.875rem;
    line-height: 1.65;
    tab-size: 2;
    overflow-wrap: normal;
  }
  :deep(.article-code pre) {
    border-radius: 0;
    background: transparent;
  }
  :deep(pre:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  :deep(pre code) {
    display: block;
    width: max-content;
    min-width: 100%;
    font-size: inherit;
    white-space: pre;
    overflow-wrap: normal;
  }
  :deep(.shiki),
  :deep(.shiki span) {
    color: var(--shiki-light);
    font-style: var(--shiki-light-font-style);
    font-weight: var(--shiki-light-font-weight);
    text-decoration: var(--shiki-light-text-decoration);
  }
  // 只写 monospace 会触发浏览器的等宽默认字号（约 13px），中文正文里的行内代码显得过小；用明确字体栈避开
  :deep(code) {
    font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
    font-size: 0.875em;
  }
  :deep(:not(pre) > code) {
    padding: 0.125em 0.375em;
    border-radius: 0.3rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    overflow-wrap: anywhere;
  }
  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
  }
  // 正文图片放大触发器：去掉按钮默认外观，保留键盘焦点环
  :deep(.article-image) {
    display: inline-block;
    max-width: 100%;
    padding: 0;
    border: 0;
    border-radius: 0.5rem;
    background: none;
    font: inherit;
    line-height: 0;
    vertical-align: top;
    cursor: zoom-in;
  }
  :deep(.article-image:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  :deep(a) {
    color: var(--accent-text);
    text-decoration: underline;
  }
  :deep(blockquote) {
    border-left: 3px solid var(--accent);
    padding-left: 1rem;
    color: var(--text-muted);
  }
  :deep(table) {
    display: block;
    max-width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
  }
  :deep(td),
  :deep(th) {
    padding: 0.5rem;
    border: 1px solid var(--border);
  }
}

// 暗色模式切换只改变量选择，不需要重新高亮（祖先 html.dark 写在作用域选择器之前）
:is(html.dark) .article-markdown :deep(.shiki),
:is(html.dark) .article-markdown :deep(.shiki span) {
  color: var(--shiki-dark);
  font-style: var(--shiki-dark-font-style);
  font-weight: var(--shiki-dark-font-weight);
  text-decoration: var(--shiki-dark-text-decoration);
}
</style>
