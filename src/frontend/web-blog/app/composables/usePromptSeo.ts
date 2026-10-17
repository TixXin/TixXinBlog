/** @file usePromptSeo.ts @description 公开分享链接绑定选中作品；私有状态不输出作品内容，缺失目标不借用列表首图。 */
import type { Ref } from 'vue'
import type { ImagePrompt } from '~/features/prompt/types'
import { absoluteUrl } from '~/utils/absoluteUrl'

interface PromptSeoOptions {
  selectedId: Ref<number | null>
  selectedItem: Ref<ImagePrompt | null>
  selectedDraft: Ref<boolean>
  editorOpen: Ref<boolean>
  prompts: Ref<ImagePrompt[]>
}
function excerpt(value: string) {
  const characters = [...value.replace(/\s+/g, ' ').trim()]
  return characters.length > 160 ? characters.slice(0, 160).join('') + '…' : characters.join('')
}
export function usePromptSeo(options: PromptSeoOptions) {
  const route = useRoute()
  const site = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
  const seo = computed(() => {
    const privateView =
      route.query.view === 'drafts' ||
      route.query.edit !== undefined ||
      options.editorOpen.value ||
      options.selectedDraft.value
    const detailRequested = route.query.prompt !== undefined
    const item =
      !privateView && options.selectedItem.value?.id === options.selectedId.value ? options.selectedItem.value : null
    const title = privateView
      ? '提示词管理 · 灵感图鉴'
      : item
        ? `${item.title} · 灵感图鉴`
        : detailRequested
          ? '图片提示词 · 灵感图鉴'
          : '灵感图鉴 · 图片提示词'
    const description = privateView
      ? '整理图片提示词与创作草稿。'
      : item
        ? excerpt(item.description || item.prompt)
        : detailRequested
          ? '这份图片提示词不存在或暂时无法读取，请返回灵感图鉴继续浏览。'
          : '收藏画面的可能，也分享创作的起点。浏览图片效果与完整提示词，找到属于自己的灵感。'
    const canonical = absoluteUrl(
      `/prompts${!privateView && options.selectedId.value !== null ? `?prompt=${options.selectedId.value}` : ''}`,
      site,
    )
    const image = privateView
      ? undefined
      : absoluteUrl(item?.imageUrl || (!detailRequested ? options.prompts.value[0]?.imageUrl : undefined), site)
    return {
      title,
      description,
      canonical,
      image,
      imageAlt: item?.imageAlt || (!detailRequested && !privateView ? options.prompts.value[0]?.imageAlt : undefined),
      robots: privateView ? 'noindex, nofollow' : detailRequested && !item ? 'noindex, follow' : 'index, follow',
      type: item ? ('article' as const) : ('website' as const),
    }
  })
  useSeoMeta({
    title: () => seo.value.title,
    description: () => seo.value.description,
    ogTitle: () => seo.value.title,
    ogDescription: () => seo.value.description,
    ogType: () => seo.value.type,
    ogUrl: () => seo.value.canonical,
    // null 显式移除全局默认分享图：私有与缺失目标不输出任何分享图
    ogImage: () => seo.value.image ?? null,
    ogImageAlt: () => (seo.value.image ? seo.value.imageAlt : null) ?? null,
    // 可索引时不覆盖 robots 模块的默认指令（含 max-image-preview 等）
    robots: () => (seo.value.robots === 'index, follow' ? undefined : seo.value.robots),
    twitterCard: () => (seo.value.image ? 'summary_large_image' : 'summary'),
    twitterTitle: () => seo.value.title,
    twitterDescription: () => seo.value.description,
    twitterImage: () => seo.value.image ?? null,
  })
  useHead(() => ({
    link: seo.value.canonical ? [{ key: 'canonical', rel: 'canonical', href: seo.value.canonical }] : [],
  }))
  return seo
}
