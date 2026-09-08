<!--
  @file comments.vue
  @description 评论管理页面：检索、博主回复及明确确认后的删除
-->
<template>
  <section class="admin-comments">
    <h1>评论管理</h1>
    <ClientOnly>
      <section class="admin-comments__policy" aria-label="评论审核设置">
        <h2>审核设置</h2>
        <p>现有评论保持原状态。新游客评论可直接公开，或先由博主审核；博主回复通过真实管理接口公开。</p>
        <label
          ><input
            v-model="requireApproval"
            type="checkbox"
            :disabled="!policy || policyPending"
          />新游客评论需要审核后公开</label
        >
        <button
          type="button"
          :disabled="!policy || policyPending || requireApproval === policy.requireApproval"
          @click="savePolicy"
        >
          保存审核设置
        </button>
        <p v-if="policy" role="status">
          服务器当前：{{ policy.requireApproval ? '先审核后公开' : '直接公开' }} · 版本 {{ policy.revision }}
        </p>
        <p v-if="policyError" role="alert">
          {{ policyError }} <button type="button" :disabled="policyPending" @click="loadPolicy">重新读取设置</button>
        </p>
        <p>通知渠道尚未接入，不会向评论者发送邮件或消息。</p>
      </section>
      <form @submit.prevent="resetPage">
        <select v-model="postId" aria-label="按文章筛选评论" :disabled="working" @change="resetPage">
          <option value="">全部文章</option>
          <option v-for="article in articles" :key="article.id" :value="String(article.id)">{{ article.title }}</option>
        </select>
        <label
          ><input v-model="unanswered" type="checkbox" :disabled="working" @change="resetPage" />仅待回复根评论</label
        >
        <select v-model="status" aria-label="评论状态" :disabled="working" @change="resetPage">
          <option value="">全部状态</option>
          <option v-for="(label, value) in statusLabels" :key="value" :value="value">{{ label }}</option>
        </select>
        <label>开始日期（UTC）<input v-model="from" type="date" :disabled="working" @change="resetPage" /></label>
        <label>结束日期（UTC）<input v-model="to" type="date" :disabled="working" @change="resetPage" /></label>
        <input v-model="search" aria-label="搜索评论" placeholder="搜索评论内容" /><button
          type="submit"
          :disabled="pending"
        >
          搜索
        </button>
      </form>
      <p v-if="error" role="alert">
        {{ error }} <button type="button" :disabled="pending || working" @click="load">重新加载</button>
      </p>
      <p v-if="articleError" role="alert">
        文章筛选选项加载失败 <button type="button" @click="loadArticles">重试选项</button>
      </p>
      <p v-if="pending" role="status">正在处理…</p>
      <form v-if="replyTarget" class="admin-comments__reply" @submit.prevent="sendReply">
        <label
          >回复 {{ replyTarget.author
          }}<textarea
            ref="replyInput"
            v-model="replyText"
            aria-label="博主回复内容"
            maxlength="1000"
            rows="3"
            required
            :disabled="working"
          />
        </label>
        <p>回复文章：{{ replyTarget.postTitle }}</p>
        <blockquote>{{ replyTarget.content }}</blockquote>
        <button type="submit" :disabled="working || !replyText.trim()">发表博主回复</button>
        <button type="button" :disabled="working" @click="cancelReply">取消回复</button>
      </form>
      <section
        v-if="context || contextPending || contextError"
        ref="contextPanel"
        tabindex="-1"
        class="admin-comments__context"
        aria-label="评论上下文"
      >
        <h2>评论上下文</h2>
        <button type="button" @click="closeContext">关闭上下文</button>
        <p v-if="contextPending" role="status">正在读取上下文…</p>
        <p v-if="contextError" role="alert">{{ contextError }}</p>
        <template v-if="context">
          <p>{{ context.post.title }} · 删除当前评论将影响 {{ context.deleteTotal }} 条评论（含所有层级回复）</p>
          <p>
            当前公开 {{ context.visibleTotal }} 条；通过当前评论后预计公开
            {{ context.approvedVisibleTotal }}
            条。上级未通过、文章未公开时不会展示，单独隐藏或标记垃圾的回复继续保留原状态。
          </p>
          <ol>
            <li v-for="ancestor in context.ancestors" :key="ancestor.id">
              <strong>{{ ancestor.author }} · {{ statusLabels[ancestor.status] }}</strong>
              <p>{{ ancestor.content }}</p>
              <button type="button" @click="showContext(ancestor.id)">查看此上级评论</button>
            </li>
          </ol>
          <blockquote>
            <strong>当前评论 · {{ context.target.author }} · {{ statusLabels[context.target.status] }}</strong>
            <p>{{ context.target.content }}</p>
          </blockquote>
          <h3>直接回复（{{ context.total }} 条）</h3>
          <p v-if="!context.total">暂无直接回复</p>
          <ul>
            <li v-for="reply in context.replies" :key="reply.id">
              <strong>{{ reply.author }}{{ reply.isOwner ? ' · 博主' : '' }} · {{ statusLabels[reply.status] }}</strong>
              <p>{{ reply.content }}</p>
              <button type="button" @click="showContext(reply.id)">查看此回复上下文</button>
            </li>
          </ul>
          <button
            type="button"
            :disabled="contextPending || context.page <= 1"
            @click="showContext(context.target.id, context.page - 1)"
          >
            上一页回复
          </button>
          <span>{{ context.page }} / {{ Math.max(1, Math.ceil(context.total / 20)) }}</span>
          <button
            type="button"
            :disabled="contextPending || context.page * 20 >= context.total"
            @click="showContext(context.target.id, context.page + 1)"
          >
            下一页回复
          </button>
        </template>
      </section>
      <ul>
        <li v-for="comment in items" :key="comment.id">
          <NuxtLink
            :to="comment.postStatus === 'published' ? `/articles/${comment.postId}` : `/admin/posts/${comment.postId}`"
            >{{ comment.postTitle }}</NuxtLink
          >
          <p>
            <strong>{{ comment.author }}</strong> {{ comment.isOwner ? '· 博主' : '' }} ·
            {{ comment.createdAt.slice(0, 10) }}
          </p>
          <p>{{ comment.content }}</p>
          <p>
            {{ statusLabels[comment.status] }} ·
            {{ comment.visible ? '当前公开可见' : '当前不公开（自身、上级评论或文章状态限制）' }}
          </p>
          <p v-if="comment.postStatus !== 'published'">文章未公开，当前不能新增回复。</p>
          <button type="button" :disabled="working" @click="showContext(comment.id)">查看上下文</button>
          <button
            v-if="comment.depth < 2 && comment.visible"
            type="button"
            :disabled="working"
            @click="startReply(comment)"
          >
            回复
          </button>
          <button type="button" :disabled="pending || working" @click="remove(comment)">删除评论及回复</button>
          <button
            v-if="comment.status !== 'published'"
            type="button"
            :disabled="pending || working"
            @click="moderate(comment, 'published')"
          >
            通过或恢复公开
          </button>
          <button
            v-if="comment.status === 'published'"
            type="button"
            :disabled="pending || working"
            @click="moderate(comment, 'hidden')"
          >
            隐藏评论
          </button>
          <button
            v-if="comment.status !== 'spam'"
            type="button"
            :disabled="pending || working"
            @click="moderate(comment, 'spam')"
          >
            标记垃圾
          </button>
        </li>
      </ul>
      <p v-if="!pending && !error && !items.length">暂无评论</p>
      <button type="button" :disabled="pending || page <= 1" @click="previousPage">上一页</button>
      <span>{{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }} · {{ total }} 条</span>
      <button type="button" :disabled="pending || page * 20 >= total" @click="nextPage">下一页</button>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '评论管理', robots: 'noindex, nofollow' })
interface CommentText {
  status: CommentStatus
  revision: number
  id: number
  author: string
  content: string
  depth: number
  isOwner: boolean
  createdAt: string
}
interface Row extends CommentText {
  visible: boolean
  postId: number
  postTitle: string
  postStatus: 'draft' | 'published' | 'archived'
  parentId: number | null
}
interface CommentContext {
  target: CommentText
  ancestors: CommentText[]
  replies: CommentText[]
  total: number
  page: number
  deleteTotal: number
  deleteFingerprint: string
  visibleTotal: number
  approvedVisibleTotal: number
  visible: boolean
  post: { id: number; title: string; status: string }
}
const api = useAdminApi()
type CommentStatus = 'published' | 'pending' | 'hidden' | 'spam'
const statusLabels: Record<CommentStatus, string> = {
  published: '已通过',
  pending: '待审核',
  hidden: '已隐藏',
  spam: '垃圾评论',
}
const status = ref('')
const from = ref('')
const to = ref('')
const policy = ref<{ requireApproval: boolean; revision: number } | null>(null)
const requireApproval = ref(false)
const policyPending = ref(false)
const policyError = ref('')
async function loadPolicy() {
  if (policyPending.value) return
  policyPending.value = true
  policyError.value = ''
  try {
    const latest = await api<{ requireApproval: boolean; revision: number }>('/admin/comments/policy')
    policy.value = latest
    requireApproval.value = latest.requireApproval
  } catch {
    policyError.value = '审核设置读取失败'
  } finally {
    policyPending.value = false
  }
}
async function savePolicy() {
  if (!policy.value || policyPending.value) return
  policyPending.value = true
  policyError.value = ''
  try {
    policy.value = await api('/admin/comments/policy', {
      method: 'PATCH',
      body: { requireApproval: requireApproval.value, revision: policy.value.revision },
    })
    success('审核设置已生效，现有评论保持原状态')
  } catch (cause) {
    const message = (cause as { data?: { message?: unknown } }).data?.message
    policyError.value = typeof message === 'string' ? message : '保存失败，当前选择保留'
  } finally {
    policyPending.value = false
  }
}
const { restore } = useCurrentUser()
const { success } = useToast()
const route = useRoute()
const router = useRouter()
const items = ref<Row[]>([])
const articles = ref<{ id: number; title: string }[]>([])
const articleError = ref(false)
const total = ref(0)
const page = ref(1)
const search = ref('')
const postId = ref('')
const unanswered = ref(false)
const pending = ref(false)
const working = ref(false)
const ready = ref(false)
const error = ref('')
const replyTarget = ref<Row | null>(null)
const replyText = ref('')
const context = ref<CommentContext | null>(null)
const contextPending = ref(false)
const contextError = ref('')
const contextPanel = ref<HTMLElement | null>(null)
const replyInput = ref<HTMLTextAreaElement | null>(null)
let listVersion = 0
let contextVersion = 0
const replyDirty = computed(() => !!replyTarget.value && !!replyText.value.trim())
function allowDiscard() {
  return !replyDirty.value || window.confirm('有尚未发送的博主回复，确定放弃吗？')
}
function cancelReply() {
  if (allowDiscard()) {
    replyTarget.value = null
    replyText.value = ''
  }
}
function startReply(comment: Row) {
  if (working.value || comment.id === replyTarget.value?.id || !allowDiscard()) return
  replyTarget.value = comment
  replyText.value = ''
  void nextTick(() => replyInput.value?.focus())
}
function syncQuery() {
  const text = (key: string) => (typeof route.query[key] === 'string' ? (route.query[key] as string) : '')
  search.value = text('search')
  postId.value = /^[1-9]\d*$/.test(text('postId')) ? text('postId') : ''
  unanswered.value = text('unanswered') === 'true'
  status.value = Object.hasOwn(statusLabels, text('status')) ? text('status') : ''
  from.value = text('from')
  to.value = text('to')
  const value = Number(text('page'))
  page.value = Number.isSafeInteger(value) && value > 0 ? value : 1
}
async function changePage(value: number) {
  const query: Record<string, string> = {}
  if (postId.value) query.postId = postId.value
  if (search.value.trim()) query.search = search.value.trim()
  if (unanswered.value) query.unanswered = 'true'
  if (status.value) query.status = status.value
  if (from.value) query.from = from.value
  if (to.value) query.to = to.value
  if (value > 1) query.page = String(value)
  if (router.resolve({ path: '/admin/comments', query }).fullPath === route.fullPath) await load()
  else await router.push({ path: '/admin/comments', query })
}
function resetPage() {
  void changePage(1)
}
function previousPage() {
  void changePage(Math.max(1, page.value - 1))
}
function nextPage() {
  void changePage(page.value + 1)
}
async function loadArticles() {
  articleError.value = false
  try {
    articles.value = await api('/admin/comments/articles')
  } catch {
    articleError.value = true
  }
}
async function load() {
  const version = ++listVersion
  pending.value = true
  error.value = ''
  try {
    const result = await api<{ items: Row[]; total: number }>('/admin/comments', {
      query: {
        page: page.value,
        pageSize: 20,
        postId: postId.value || undefined,
        search: search.value || undefined,
        unanswered: unanswered.value ? 'true' : undefined,
        status: status.value || undefined,
        from: from.value || undefined,
        to: to.value || undefined,
      },
    })
    if (version !== listVersion) return
    items.value = result.items
    total.value = result.total
    const lastPage = Math.max(1, Math.ceil(total.value / 20))
    if (page.value > lastPage) await changePage(lastPage)
  } catch {
    if (version === listVersion) {
      items.value = []
      error.value = '评论列表加载失败，请检查登录后重试'
    }
  } finally {
    if (version === listVersion) pending.value = false
  }
}
async function showContext(id: number, currentPage = 1) {
  const version = ++contextVersion
  contextPending.value = true
  contextError.value = ''
  context.value = null
  try {
    const result = await api<CommentContext>(`/admin/comments/${id}/context`, { query: { page: currentPage } })
    if (version === contextVersion) {
      context.value = result
      await nextTick()
      contextPanel.value?.focus()
    }
  } catch {
    if (version === contextVersion) contextError.value = '上下文加载失败，请重新选择评论；评论也可能已被删除'
  } finally {
    if (version === contextVersion) contextPending.value = false
  }
}
function closeContext() {
  contextVersion += 1
  context.value = null
  contextError.value = ''
  contextPending.value = false
}
async function remove(comment: Row) {
  if (working.value || pending.value) return
  if (replyDirty.value) {
    error.value = '请先发送或明确取消当前回复，再删除评论'
    return
  }
  working.value = true
  error.value = ''
  try {
    const preview = await api<CommentContext>(`/admin/comments/${comment.id}/context`)
    if (
      !window.confirm(
        `将永久删除“${comment.author}”的评论及其所有层级回复，共 ${preview.deleteTotal} 条，无法恢复。确定删除吗？`,
      )
    )
      return
    const result = await api<{ deleted: number }>(`/admin/comments/${comment.id}`, {
      method: 'DELETE',
      query: { expectedTotal: preview.deleteTotal, expectedFingerprint: preview.deleteFingerprint },
    })
    closeContext()
    replyTarget.value = null
    clearNuxtData((key) => key.startsWith('article-') || key.startsWith('post-'))
    success(`已删除 ${result.deleted} 条评论`)
    await Promise.all([loadArticles(), load()])
  } catch (cause) {
    const message = (cause as { data?: { message?: unknown } }).data?.message
    error.value = typeof message === 'string' ? message : '删除失败，请重新查看影响范围后重试'
  } finally {
    working.value = false
  }
}
async function sendReply() {
  if (!replyTarget.value || working.value) return
  working.value = true
  error.value = ''
  const id = replyTarget.value.id
  try {
    await api(`/admin/comments/${id}/reply`, { method: 'POST', body: { content: replyText.value } })
    replyTarget.value = null
    replyText.value = ''
    clearNuxtData((key) => key.startsWith('article-') || key.startsWith('post-'))
    success('博主回复已发表')
    await load()
    if (context.value) await showContext(context.value.target.id, context.value.page)
  } catch (cause) {
    const message = (cause as { data?: { message?: unknown } }).data?.message
    error.value = typeof message === 'string' ? message : '回复失败，内容已保留'
  } finally {
    working.value = false
  }
}
async function moderate(comment: Row, target: CommentStatus) {
  if (working.value || pending.value) return
  if (replyDirty.value) {
    error.value = '请先发送或明确取消当前回复，再修改评论状态'
    return
  }
  working.value = true
  error.value = ''
  try {
    const preview = await api<CommentContext>(`/admin/comments/${comment.id}/context`)
    const after = target === 'published' ? preview.approvedVisibleTotal : 0
    if (
      !window.confirm(
        `将“${comment.author}”的评论设为${statusLabels[target]}？本条及回复共 ${preview.deleteTotal} 条，公开可见数量从 ${preview.visibleTotal} 变为 ${after} 条。回复自身的审核状态保留；没有评论会被删除。`,
      )
    )
      return
    await api(`/admin/comments/${comment.id}/moderation`, {
      method: 'POST',
      body: { status: target, revision: preview.target.revision, expectedFingerprint: preview.deleteFingerprint },
    })
    success('评论状态已更新')
    clearNuxtData((key) => key.startsWith('article-') || key.startsWith('post-'))
    await load()
    if (context.value) await showContext(context.value.target.id, context.value.page)
  } catch (cause) {
    const message = (cause as { data?: { message?: unknown } }).data?.message
    error.value = typeof message === 'string' ? message : '修改失败，请重新查看影响范围后重试'
  } finally {
    working.value = false
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (replyDirty.value || (policy.value && requireApproval.value !== policy.value.requireApproval)) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(
  () =>
    !working.value &&
    !policyPending.value &&
    allowDiscard() &&
    (!policy.value ||
      requireApproval.value === policy.value.requireApproval ||
      window.confirm('审核设置尚未保存，确定离开吗？')),
)
watch(
  () => route.query,
  () => {
    syncQuery()
    if (ready.value) void load()
  },
  { immediate: true },
)
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  if (await restore()) {
    ready.value = true
    await Promise.all([loadArticles(), load(), loadPolicy()])
    if (typeof route.query.commentId === 'string' && /^[1-9]\d*$/.test(route.query.commentId))
      await showContext(Number(route.query.commentId))
  } else await navigateTo({ path: '/admin/login', query: { next: route.fullPath } })
})
onBeforeUnmount(() => {
  listVersion += 1
  contextVersion += 1
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>
<style scoped>
.admin-comments h1 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}
.admin-comments ul {
  list-style: none;
  padding: 0;
}
.admin-comments li,
.admin-comments__context,
.admin-comments__policy,
.admin-comments__reply {
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-block: 1rem;
  overflow-wrap: anywhere;
}
.admin-comments a {
  color: var(--accent);
}
.admin-comments input,
.admin-comments select,
.admin-comments button,
.admin-comments textarea {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-main);
  border-radius: 0.4rem;
  padding: 0.5rem;
  margin: 0.25rem;
}
.admin-comments textarea {
  width: 100%;
  display: block;
}
</style>
