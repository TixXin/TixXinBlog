<!--
  @file index.vue
  @description 博主概览：真实内容统计、待处理数量与最近更新
-->
<template>
  <section class="overview">
    <header>
      <div>
        <h1>管理概览</h1>
        <p>查看内容近况，继续你的创作。</p>
      </div>
      <NuxtLink to="/admin/posts/new">新建文章</NuxtLink>
    </header>
    <p v-if="pending" role="status">正在读取内容统计…</p>
    <p v-if="error" role="alert">{{ error }} <button type="button" :disabled="pending" @click="load">重试</button></p>
    <template v-if="data">
      <div class="overview__stats">
        <NuxtLink v-for="card in cards" :key="card.label" :to="card.to"
          ><Icon :name="card.icon" /><span>{{ card.label }}</span
          ><strong>{{ card.value }}</strong></NuxtLink
        >
      </div>
      <section class="overview__panel">
        <h2>待处理</h2>
        <p>还有 {{ data.counts.drafts }} 篇文章草稿、{{ data.counts.flashDrafts }} 条闪念草稿。</p>
        <p>
          <NuxtLink to="/admin/comments?status=pending">{{ data.counts.pendingComments }} 条评论待审核</NuxtLink>；{{
            data.counts.spamComments
          }}
          条已标记垃圾。
        </p>
        <p>
          评论总数 {{ data.counts.comments }} 条，当前公开文章中可见
          {{ data.counts.publicComments }} 条（包含回复，排除未通过审核及被上级隐藏的内容）。文章总数不含回收站。
        </p>
        <p>{{ data.counts.unanswered }} 条公开文章下的游客根评论尚无博主直接回复。</p>
        <NuxtLink to="/admin/comments?unanswered=true">查看待回复评论 <Icon name="lucide:arrow-right" /></NuxtLink>
      </section>
      <section class="overview__panel">
        <h2>最近更新</h2>
        <p v-if="!data.recentPosts.length">还没有文章，从第一篇草稿开始。</p>
        <ul v-else>
          <li v-for="post in data.recentPosts" :key="post.id">
            <NuxtLink :to="`/admin/posts/${post.id}`">{{ post.title }}</NuxtLink
            ><span>{{ statusLabels[post.status] }} · {{ formatDate(post.updatedAt) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '管理概览', robots: 'noindex, nofollow' })
interface Overview {
  counts: {
    posts: number
    published: number
    drafts: number
    archived: number
    trashed: number
    comments: number
    pendingComments: number
    spamComments: number
    publicComments: number
    flashes: number
    flashDrafts: number
    unanswered: number
  }
  recentPosts: { id: number; title: string; status: 'draft' | 'published' | 'archived'; updatedAt: string }[]
}
const api = useAdminApi()
const { restore } = useCurrentUser()
const data = ref<Overview | null>(null)
const pending = ref(false)
const error = ref('')
const statusLabels = { draft: '草稿', published: '已发布', archived: '已归档' }
const cards = computed(() =>
  data.value
    ? [
        { label: '全部文章', value: data.value.counts.posts, icon: 'lucide:files', to: '/admin/posts' },
        {
          label: '文章回收站',
          value: data.value.counts.trashed,
          icon: 'lucide:trash-2',
          to: '/admin/posts?status=trash',
        },
        {
          label: '已发布',
          value: data.value.counts.published,
          icon: 'lucide:send',
          to: '/admin/posts?status=published',
        },
        {
          label: '文章草稿',
          value: data.value.counts.drafts,
          icon: 'lucide:file-pen-line',
          to: '/admin/posts?status=draft',
        },
        { label: '文章评论', value: data.value.counts.comments, icon: 'lucide:messages-square', to: '/admin/comments' },
        { label: '全部闪念', value: data.value.counts.flashes, icon: 'lucide:lightbulb', to: '/admin/flashes' },
        {
          label: '闪念草稿',
          value: data.value.counts.flashDrafts,
          icon: 'lucide:file-clock',
          to: '/admin/flashes?status=draft',
        },
      ]
    : [],
)
function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
async function load() {
  if (pending.value) return
  pending.value = true
  error.value = ''
  try {
    data.value = await api<Overview>('/admin/overview')
  } catch {
    error.value = '概览加载失败，请检查登录状态后重试'
  } finally {
    pending.value = false
  }
}
onMounted(async () => {
  if (await restore()) await load()
  else await navigateTo({ path: '/admin/login', query: { next: '/admin' } })
})
</script>
<style scoped lang="scss">
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
}
h1 {
  font-size: 1.75rem;
  font-weight: 700;
}
header p {
  color: var(--text-muted);
  margin-top: 0.5rem;
}
a {
  color: var(--accent);
}
.overview__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}
.overview__stats a {
  display: grid;
  gap: 0.75rem;
  padding: 1.25rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--surface-2);
}
.overview__stats span {
  color: var(--text-muted);
}
.overview__stats strong {
  font-size: 2rem;
  color: var(--text-main);
}
.overview__panel {
  margin-top: 1.5rem;
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--surface-2);
}
h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}
.overview__panel p {
  color: var(--text-muted);
  margin-bottom: 0.75rem;
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
  padding-bottom: 0;
}
li span {
  font-size: 0.8125rem;
  color: var(--text-muted);
  flex-shrink: 0;
}
@media (max-width: 700px) {
  .overview__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  li {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.4rem;
  }
}
</style>
