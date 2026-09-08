<!--
  @file index.vue
  @description 真实文章管理列表：分页、状态筛选、编辑和可恢复归档
-->
<template>
  <section class="admin-posts">
    <h1>文章管理</h1>
    <ClientOnly>
      <div v-if="isLoggedIn">
        <form class="admin-posts__filters" @submit.prevent="resetPage">
          <NuxtLink to="/admin/posts/new">新建文章</NuxtLink>
          <input v-model="search" placeholder="搜索文章标题" aria-label="搜索文章标题" />
          <select v-model="status" aria-label="文章状态" @change="resetPage">
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
            <option value="trash">回收站</option>
          </select>
          <select v-model="category" aria-label="内容类型" @change="resetPage">
            <option value="">全部类型</option>
            <option value="tech">技术</option>
            <option value="life">生活</option>
          </select>
          <select v-model="folder" aria-label="专栏筛选" @change="resetPage">
            <option value="">全部专栏</option>
            <option v-for="value in filters.folders" :key="value" :value="value">{{ value }}</option>
          </select>
          <select v-model="tag" aria-label="标签筛选" @change="resetPage">
            <option value="">全部标签</option>
            <option v-for="value in filters.tags" :key="value" :value="value">{{ value }}</option>
          </select>
          <select v-model="sort" aria-label="排序字段" @change="resetPage">
            <option value="updatedAt">更新时间</option>
            <option value="publishedAt">发布时间</option>
            <option value="title">标题</option>
          </select>
          <select v-model="order" aria-label="排序方向" @change="resetPage">
            <option value="desc">降序</option>
            <option value="asc">升序</option>
          </select>
          <button type="submit" :disabled="pending">搜索</button>
          <button type="button" :disabled="pending" @click="clearFilters">清除筛选</button>
        </form>
        <p v-if="filterError" role="alert">
          筛选选项加载失败 <button type="button" @click="loadFilters">重试选项</button>
        </p>
        <p v-if="error" role="alert">{{ error }} <button type="button" @click="load">重试</button></p>
        <p v-if="pending" role="status">正在加载文章…</p>
        <div class="admin-posts__batch">
          <label
            ><input
              type="checkbox"
              :checked="allSelected"
              :disabled="pending || working || !items.length"
              @change="togglePage"
            />选择本页全部</label
          >
          <span>已选 {{ selectedIds.length }} 篇，仅限当前页；切换筛选或分页后清空。</span>
          <select v-model="batchAction" aria-label="批量操作">
            <option v-for="(label, action) in postBatchLabels" :key="action" :value="action">{{ label }}</option>
          </select>
          <button
            type="button"
            :disabled="pending || working || batch.pending.value || !selectedIds.length"
            @click="reviewBatch"
          >
            预览批量操作
          </button>
        </div>
        <div class="admin-posts__table">
          <table>
            <thead>
              <tr>
                <th>标题</th>
                <th>状态</th>
                <th>分类与标签</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="post in items" :key="post.id">
                <td data-label="标题">
                  <input
                    v-model="selectedIds"
                    type="checkbox"
                    :value="post.id"
                    :aria-label="`选择文章：${post.title}`"
                    :disabled="pending || working"
                  />
                  <Icon v-if="post.pinned" name="lucide:pin" aria-label="已置顶" />{{ post.title }}
                </td>
                <td data-label="状态">{{ post.deleted ? '回收站' : statusLabels[post.status] }}</td>
                <td data-label="分类与标签">
                  {{ post.category === 'tech' ? '技术' : '生活' }} / {{ post.folder
                  }}<small>{{ post.tags.join(' · ') || '无标签' }}</small>
                </td>
                <td data-label="更新时间">{{ new Date(post.updatedAt).toLocaleString('zh-CN', { hour12: false }) }}</td>
                <td data-label="操作">
                  <NuxtLink v-if="!post.deleted" :to="`/admin/posts/${post.id}`">编辑</NuxtLink
                  ><button
                    v-if="post.status !== 'archived' && !post.deleted"
                    type="button"
                    :disabled="pending || working"
                    @click="archive(post)"
                  >
                    归档
                  </button>
                  <button v-else type="button" :disabled="pending || working" @click="restorePost(post)">
                    恢复为草稿
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!pending && !error && !items.length">暂无文章</p>
        <div class="admin-posts__pagination">
          <button type="button" :disabled="pending || page <= 1" @click="previousPage">上一页</button>
          <span>{{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }} · 共 {{ total }} 篇</span>
          <button type="button" :disabled="pending || page * 20 >= total" @click="nextPage">下一页</button>
        </div>
        <AdminPostBatch
          v-model:open="batch.open.value"
          v-model:acknowledgement="batch.acknowledgement.value"
          :preview="batch.preview.value"
          :result="batch.result.value"
          :pending="batch.pending.value"
          :error="batch.error.value"
          :attempted="batch.attempted.value"
          @execute="batch.execute"
          @query="batch.queryResult"
        />
        <section class="admin-posts__history" aria-label="最近批量操作">
          <h2>最近批量操作</h2>
          <p>最近 10 次已开始的操作，刷新页面后仍可查看结果。</p>
          <p v-if="batch.recentError.value" role="alert">
            {{ batch.recentError.value }} <button type="button" @click="batch.loadRecent">重试记录</button>
          </p>
          <p v-else-if="!batch.recent.value.length">暂无执行记录</p>
          <ul>
            <li v-for="item in batch.recent.value" :key="item.ticket">
              <button type="button" :disabled="batch.pending.value" @click="batch.inspect(item.ticket)">
                {{ postBatchLabels[item.action] }} · {{ item.count }} 篇 ·
                {{ new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false }) }} ·
                {{ item.completed ? '已结束' : '尚未完成' }}
              </button>
            </li>
          </ul>
        </section>
      </div>
      <p v-else>请先<NuxtLink to="/admin/login">登录博主账号</NuxtLink>。</p>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import { postBatchLabels } from '~/features/post/batchTypes'
import type { PostBatchAction } from '~/features/post/batchTypes'
definePageMeta({ layout: 'admin', key: '/admin/posts' })
useSeoMeta({ title: '文章管理', robots: 'noindex, nofollow' })
interface Row {
  id: number
  revision: number
  deleted: boolean
  title: string
  status: 'draft' | 'published' | 'archived'
  category: 'tech' | 'life'
  folder: string
  tags: string[]
  pinned: boolean
  updatedAt: string
}
const { isLoggedIn, restore } = useCurrentUser()
const { success } = useToast()
const api = useAdminApi()
const route = useRoute()
const router = useRouter()
const items = ref<Row[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const status = ref('')
const category = ref('')
const folder = ref('')
const tag = ref('')
const sort = ref('updatedAt')
const order = ref('desc')
const filters = ref<{ folders: string[]; tags: string[] }>({ folders: [], tags: [] })
const filterError = ref(false)
const pending = ref(false)
const working = ref(false)
const ready = ref(false)
const error = ref('')
const selectedIds = ref<number[]>([])
const batchAction = ref<PostBatchAction>('archive')
const batch = usePostBatch(load)
const allSelected = computed(
  () => items.value.length > 0 && items.value.every((item) => selectedIds.value.includes(item.id)),
)
function togglePage() {
  selectedIds.value = allSelected.value ? [] : items.value.map((item) => item.id)
}
function reviewBatch() {
  void batch.review(
    batchAction.value,
    items.value.filter((item) => selectedIds.value.includes(item.id)).map(({ id, revision }) => ({ id, revision })),
  )
}
let requestVersion = 0
const statusLabels = { draft: '草稿', published: '已发布', archived: '已归档' }
function syncQuery() {
  const text = (key: string) => (typeof route.query[key] === 'string' ? (route.query[key] as string) : '')
  search.value = text('search')
  status.value = ['draft', 'published', 'archived', 'trash'].includes(text('status')) ? text('status') : ''
  category.value = ['tech', 'life'].includes(text('category')) ? text('category') : ''
  folder.value = text('folder')
  tag.value = text('tag')
  sort.value = ['updatedAt', 'publishedAt', 'title'].includes(text('sort')) ? text('sort') : 'updatedAt'
  order.value = text('order') === 'asc' ? 'asc' : 'desc'
  const value = Number(text('page'))
  page.value = Number.isSafeInteger(value) && value > 0 ? value : 1
}
async function navigate(pageNumber: number) {
  const query: Record<string, string> = { sort: sort.value, order: order.value }
  for (const [key, value] of Object.entries({
    search: search.value.trim(),
    status: status.value,
    category: category.value,
    folder: folder.value,
    tag: tag.value,
  })) {
    if (value) query[key] = value
  }
  if (pageNumber > 1) query.page = String(pageNumber)
  const target = router.resolve({ path: '/admin/posts', query }).fullPath
  if (target === route.fullPath) await load()
  else await router.push({ path: '/admin/posts', query })
}
function resetPage() {
  void navigate(1)
}
function previousPage() {
  void navigate(Math.max(1, page.value - 1))
}
function nextPage() {
  void navigate(page.value + 1)
}
function clearFilters() {
  search.value = status.value = category.value = folder.value = tag.value = ''
  sort.value = 'updatedAt'
  order.value = 'desc'
  resetPage()
}
async function loadFilters() {
  filterError.value = false
  try {
    filters.value = await api('/admin/posts/filters')
  } catch {
    filterError.value = true
  }
}
async function load() {
  selectedIds.value = []
  const version = ++requestVersion
  pending.value = true
  error.value = ''
  try {
    const result = await api<{ items: Row[]; total: number }>('/admin/posts', {
      query: {
        page: page.value,
        pageSize: 20,
        search: search.value || undefined,
        status: status.value || undefined,
        category: category.value || undefined,
        folder: folder.value || undefined,
        tag: tag.value || undefined,
        sort: sort.value,
        order: order.value,
      },
    })
    if (version !== requestVersion) return
    items.value = result.items
    total.value = result.total
    const lastPage = Math.max(1, Math.ceil(result.total / 20))
    if (page.value > lastPage) await navigate(lastPage)
  } catch {
    if (version === requestVersion) {
      items.value = []
      error.value = '文章列表加载失败，请检查登录状态后重试'
    }
  } finally {
    if (version === requestVersion) pending.value = false
  }
}
async function changeStatus(post: Row, restoreArchived: boolean) {
  if (working.value || pending.value) return
  if (
    !window.confirm(
      restoreArchived
        ? `将“${post.title}”恢复为草稿？恢复后仍不公开。`
        : `将“${post.title}”移入归档？文章及评论保留，可恢复为草稿。`,
    )
  )
    return
  working.value = true
  error.value = ''
  try {
    await api(`/admin/posts/${post.id}${restoreArchived ? '/restore' : ''}`, {
      method: restoreArchived ? 'POST' : 'DELETE',
      query: { revision: post.revision },
    })
    clearNuxtData((key) => key.startsWith('article-') || key.startsWith('post-'))
    success(restoreArchived ? '已恢复为草稿' : '文章已归档')
    await load()
  } catch {
    error.value = restoreArchived ? '恢复失败，请稍后重试' : '归档失败，请稍后重试'
  } finally {
    working.value = false
  }
}
function archive(post: Row) {
  void changeStatus(post, false)
}
function restorePost(post: Row) {
  void changeStatus(post, true)
}
watch(
  () => route.query,
  () => {
    syncQuery()
    if (ready.value) void load()
  },
  { immediate: true },
)
onMounted(async () => {
  if (await restore()) {
    ready.value = true
    await Promise.all([loadFilters(), load(), batch.loadRecent()])
    if (typeof route.query.operation === 'string' && /^[a-f0-9-]{36}$/.test(route.query.operation))
      await batch.inspect(route.query.operation)
  } else await navigateTo({ path: '/admin/login', query: { next: route.fullPath } })
})
onBeforeUnmount(() => {
  requestVersion += 1
})
</script>
<style scoped lang="scss">
.admin-posts h1 {
  font-size: 1.6rem;
  margin-bottom: 1rem;
}
.admin-posts__filters,
.admin-posts__batch,
.admin-posts__pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-block: 1rem;
}
.admin-posts a {
  color: var(--accent);
  margin-right: 0.75rem;
}
.admin-posts button,
.admin-posts input,
.admin-posts select {
  background: var(--surface-2);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  padding: 0.5rem;
}
.admin-posts small {
  display: block;
  color: var(--text-muted);
  margin-top: 0.4rem;
}
.admin-posts__table {
  overflow-x: auto;
}
.admin-posts table {
  border-collapse: collapse;
  width: 100%;
}
.admin-posts td,
.admin-posts th {
  padding: 0.8rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
@media (max-width: 700px) {
  .admin-posts table,
  .admin-posts tbody,
  .admin-posts tr,
  .admin-posts td {
    display: block;
  }
  .admin-posts thead {
    display: none;
  }
  .admin-posts tr {
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.85rem;
    background: var(--surface-2);
  }
  .admin-posts td {
    border: 0;
    padding: 0.45rem 0;
    overflow-wrap: anywhere;
  }
  .admin-posts td::before {
    content: attr(data-label);
    display: block;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
  }
  .admin-posts td:first-child {
    font-weight: 600;
  }
}
</style>
