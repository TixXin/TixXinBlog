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
  // 全局 i18n 实例的 t 读取响应式 locale，切换语言时 computed 随之重算
  const { t } = useNuxtApp().$i18n
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
      ? t('misc.prompt.seo.manageTitle')
      : item
        ? t('misc.prompt.seo.itemTitle', { title: item.title })
        : detailRequested
          ? t('misc.prompt.seo.detailTitle')
          : t('misc.prompt.seo.title')
    const description = privateView
      ? t('misc.prompt.seo.manageDescription')
      : item
        ? excerpt(item.description || item.prompt)
        : detailRequested
          ? t('misc.prompt.seo.missingDescription')
          : t('misc.prompt.seo.description')
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
