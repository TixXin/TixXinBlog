/** @file usePostTaxonomyRoute.ts @description 标签与专栏独立页的筛选、URL 分页和自引用 SEO */
import { readPostListQuery } from '~/features/post/listQuery'
import { resolvePostTaxonomy } from '~/features/post/taxonomy'
import type { PostTaxonomyKind } from '~/features/post/taxonomy'

export async function usePostTaxonomyRoute(kind: PostTaxonomyKind) {
  const route = useRoute()
  const router = useRouter()
  // 路径由当前页面持有；离开守卫必须在首次 await 前注册，否则拿不到当前路由记录。
  const sourcePath = route.path
  let leaving = false
  onBeforeRouteLeave(() => {
    leaving = true
  })
  const removeAfter = router.afterEach(() => {
    if (router.currentRoute.value.path === sourcePath) leaving = false
  })
  onBeforeUnmount(removeAfter)

  // SEO 同样必须在首次 await 前注册：普通 async 函数里 await 之后既没有 Nuxt 实例也没有组件实例，
  // 此时调用 useRuntimeConfig/useHead 会让 SSR 直接 500，客户端也无法随页面卸载清理 head。
  const page = computed(() => readPostListQuery(route.query).page)
  const label = kind === 'tag' ? '标签' : '专栏'
  const taxonomyRef = shallowRef<NonNullable<ReturnType<typeof resolvePostTaxonomy>> | null>(null)
  const title = computed(() =>
    taxonomyRef.value ? `${label}：${taxonomyRef.value.name}${page.value > 1 ? ` · 第 ${page.value} 页` : ''}` : null,
  )
  const description = computed(() =>
    taxonomyRef.value
      ? `浏览${label}「${taxonomyRef.value.name}」下的公开文章${page.value > 1 ? `，第 ${page.value} 页` : ''}。`
      : '',
  )
  const canonical = computed(() =>
    taxonomyRef.value ? `${taxonomyRef.value.path}${page.value > 1 ? `?page=${page.value}` : ''}` : null,
  )
  usePageSeo({ title, description, canonical, type: 'website' })

  const { metadata, error: metadataError } = await usePostMetadata()
  if (metadataError.value || !metadata.value)
    throw createError({ statusCode: 503, statusMessage: '文章目录暂时不可用' })
  const rawName = route.params[kind === 'tag' ? 'name' : 'slug']
  const name = typeof rawName === 'string' ? rawName : ''
  const taxonomy = resolvePostTaxonomy(kind, name, metadata.value)
  if (!taxonomy) throw createError({ statusCode: 404, statusMessage: kind === 'tag' ? '标签不存在' : '专栏不存在' })
  taxonomyRef.value = taxonomy
  const heading = `${label}：${taxonomy.name}`

  function changePage(value: number, replace = false) {
    if (leaving || router.currentRoute.value.path !== sourcePath || route.path !== sourcePath) return
    const next = readPostListQuery({ page: String(value) }).page
    // 点击分页发生在事件回调里，使用已捕获的路由器写入；navigateTo 离开 setup 后不会改地址。
    const location = { path: sourcePath, query: next > 1 ? { page: String(next) } : {} }
    return replace ? router.replace(location) : router.push(location)
  }

  return {
    heading,
    description,
    canonical,
    page,
    changePage,
    listOptions: {
      page,
      selectedTag: ref(taxonomy.tag),
      selectedCategory: ref(taxonomy.folder),
      displayMode: ref<'pagination' | 'waterfall'>('pagination'),
      resetOnScopeChange: false,
    },
  }
}
