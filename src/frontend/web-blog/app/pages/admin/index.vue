<!-- @file index.vue @description 运营工作台：真实待办、六域草稿、快捷创作与最近编辑。 -->
<template>
  <section class="overview">
    <header>
      <div>
        <h1>管理概览</h1>
        <p>处理互动，继续创作。</p>
      </div>
      <button type="button" :disabled="pending" @click="load">刷新工作台</button>
    </header>
    <nav class="overview__quick" aria-label="快捷创作">
      <NuxtLink
        v-for="domain in overviewDomains"
        :key="domain.domain"
        :to="domain.domain === 'flash' ? '/admin/flashes?create=true' : domain.path + '/new'"
      >
        <Icon :name="domain.icon" />新建{{ domain.label }}
      </NuxtLink>
    </nav>
    <CommonRequestFeedback
      v-if="pending || error"
      :pending="pending"
      :compact="!!data"
      :title="error || '正在读取运营信息'"
      @retry="load"
    />
    <p v-if="error && data" role="status">以下保留上次成功读取的结果，请刷新后再判断待办。</p>
    <template v-if="data">
      <p class="overview__time">读取于 {{ formatDate(data.generatedAt) }}</p>
      <section class="overview__panel" aria-labelledby="overview-tasks">
        <h2 id="overview-tasks">待处理互动</h2>
        <p v-if="!data.counts" role="alert">
          互动统计暂不可用。<button type="button" :disabled="pending" @click="load">重新读取统计</button>
        </p>
        <template v-else>
          <p v-if="overviewTasks.every((task) => data!.counts![task.key] === 0)">当前没有待审核或待回复的互动。</p>
          <div class="overview__stats">
            <NuxtLink v-for="task in overviewTasks" :key="task.key" :to="task.to">
              <span>{{ task.label }}</span
              ><strong>{{ data.counts[task.key] }}</strong>
            </NuxtLink>
          </div>
        </template>
        <details>
          <summary>查看统计口径</summary>
          <p>
            待回复仅包含公开文章下可见的游客根评论，以及公开且未删除的游客根留言。公开博主直接回复会移出待办；隐藏或删除该回复后重新计入。
          </p>
          <p>
            文章评论待审核包含后台仍可处理的全部待审评论；朋友圈评论及留言排除软删除，朋友圈还排除已删除动态。撤回或隐藏的主内容不会计入待回复。
          </p>
          <p>朋友圈和闪念没有直接回复关系，不汇总待回复；闪念没有审核状态。通知是否已读不影响业务待办。</p>
        </details>
      </section>
      <section class="overview__panel" aria-labelledby="overview-drafts">
        <h2 id="overview-drafts">创作与草稿</h2>
        <p v-if="!data.counts" role="alert">内容统计暂不可用，请重新读取。</p>
        <div v-else class="overview__stats">
          <article v-for="domain in overviewDomains" :key="domain.domain">
            <NuxtLink :to="domain.path"
              ><Icon :name="domain.icon" />{{ domain.label }} · {{ data.counts[domain.total] }} 项</NuxtLink
            >
            <NuxtLink :to="domain.path + '?status=draft'"
              ><strong>{{ data.counts[domain.drafts] }}</strong> 份草稿</NuxtLink
            >
          </article>
        </div>
        <p>内容总数不含软删除；归档、撤回不是草稿，已归档闪念即使保留草稿标记也不计入草稿。</p>
        <NuxtLink to="/admin/posts?status=trash"
          >文章回收站<span v-if="data.counts"> · {{ data.counts.trashed }} 篇</span></NuxtLink
        >
      </section>
      <section class="overview__panel" aria-labelledby="overview-recent">
        <h2 id="overview-recent">最近编辑</h2>
        <p v-if="data.recentContent === null" role="alert">
          最近编辑暂不可用。<button type="button" :disabled="pending" @click="load">重新读取最近编辑</button>
        </p>
        <p v-else-if="!data.recentContent.length">还没有内容，从上方创建第一份草稿。</p>
        <ul v-else>
          <li v-for="item in data.recentContent" :key="item.domain + ':' + item.id">
            <NuxtLink :to="overviewEditorPath(item)">{{ item.title }}</NuxtLink>
            <span
              >{{ domainLabels[item.domain] }} · {{ statusLabels[item.status] }} ·
              {{ formatDate(item.updatedAt) }}</span
            >
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>
<script setup lang="ts">
import type { AdminOverview } from '~/features/admin/types'
import { overviewDomains, overviewTasks, overviewEditorPath } from '~/features/admin/overview'
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '管理概览', robots: 'noindex, nofollow' })
const api = useAdminApi()
const auth = useCurrentUser()
const data = ref<AdminOverview | null>(null)
const pending = ref(false)
const error = ref('')
const statusLabels = { draft: '草稿', published: '已发布', archived: '已归档', withdrawn: '已撤回' }
const domainLabels = Object.fromEntries(overviewDomains.map((item) => [item.domain, item.label]))
let alive = true
function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
async function load() {
  if (pending.value) return
  pending.value = true
  error.value = ''
  const actor = auth.currentUser.value?.id
  try {
    const result = await api<AdminOverview>('/admin/overview')
    if (alive && actor === auth.currentUser.value?.id) data.value = result
  } catch {
    if (alive) error.value = '工作台加载失败，请检查登录状态后重试'
  } finally {
    if (alive) pending.value = false
  }
}
onMounted(async () => {
  if (await auth.restore()) await load()
  else await navigateTo({ path: '/admin/login', query: { next: '/admin' } })
})
watch(
  () => auth.currentUser.value?.id,
  () => {
    data.value = null
  },
)
onBeforeUnmount(() => {
  alive = false
})
</script>
<style scoped lang="scss">
.overview {
  min-width: 0;
}
header,
.overview__quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
header {
  justify-content: space-between;
  margin-bottom: 1rem;
}
h1 {
  font-size: 1.75rem;
  font-weight: 700;
}
h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}
p,
.overview__time,
li span {
  color: var(--text-muted);
}
p {
  margin: 0.75rem 0;
}
a {
  color: var(--accent);
  overflow-wrap: anywhere;
}
button,
.overview__quick a {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface-2);
  color: var(--text-main);
}
button:disabled {
  opacity: 0.5;
}
.overview__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}
.overview__stats > a,
.overview__stats article {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  min-width: 0;
}
.overview__stats article a {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  flex-wrap: wrap;
}
strong {
  font-size: 1.5rem;
  color: var(--text-main);
}
.overview__panel {
  margin-top: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--surface-2);
}
details {
  margin-top: 1rem;
}
summary {
  cursor: pointer;
}
ul {
  list-style: none;
  padding: 0;
}
li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--border);
}
li:last-child {
  border: 0;
}
li span {
  font-size: 0.8125rem;
  flex-shrink: 0;
}
@media (max-width: 760px) {
  .overview__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  li {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.4rem;
  }
}
@media (max-width: 390px) {
  .overview__stats {
    grid-template-columns: minmax(0, 1fr);
  }
  .overview__panel {
    padding: 0.75rem;
  }
}
</style>
