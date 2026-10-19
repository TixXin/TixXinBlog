<!--
  @file comments.vue
  @description 评论管理页面：检索、博主回复、明确确认后的删除，以及当前页多选的批量审核与删除
-->
<template>
  <section class="admin-comments">
    <h1>{{ t('admin-content.comments.title') }}</h1>
    <ClientOnly>
      <section class="admin-comments__policy" :aria-label="t('admin-content.comments.policy.label')">
        <h2>{{ t('admin-content.comments.policy.heading') }}</h2>
        <p>{{ t('admin-content.comments.policy.intro') }}</p>
        <label
          ><input v-model="requireApproval" type="checkbox" :disabled="!policy || policyPending" />{{
            t('admin-content.comments.policy.requireApproval')
          }}</label
        >
        <button
          type="button"
          :disabled="!policy || policyPending || requireApproval === policy.requireApproval"
          @click="savePolicy"
        >
          {{ t('admin-content.comments.policy.save') }}
        </button>
        <p v-if="policy" role="status">
          {{
            t('admin-content.comments.policy.current', {
              mode: t(
                policy.requireApproval
                  ? 'admin-content.comments.policy.modeApproval'
                  : 'admin-content.comments.policy.modeDirect',
              ),
              revision: policy.revision,
            })
          }}
        </p>
        <p v-if="policyError" role="alert">
          {{ policyError }}
          <button type="button" :disabled="policyPending" @click="loadPolicy">
            {{ t('admin-content.comments.policy.reload') }}
          </button>
        </p>
        <p>{{ t('admin-content.comments.policy.noNotification') }}</p>
      </section>
      <form class="admin-comments__filters" @submit.prevent="resetPage">
        <select
          v-model="postId"
          :aria-label="t('admin-content.comments.filters.post')"
          :disabled="working"
          @change="resetPage"
        >
          <option value="">{{ t('admin-content.comments.filters.allPosts') }}</option>
          <option v-for="article in articles" :key="article.id" :value="String(article.id)">{{ article.title }}</option>
        </select>
        <label
          ><input v-model="unanswered" type="checkbox" :disabled="working" @change="resetPage" />{{
            t('admin-content.comments.filters.unanswered')
          }}</label
        >
        <select
          v-model="status"
          :aria-label="t('admin-content.comments.filters.status')"
          :disabled="working"
          @change="resetPage"
        >
          <option value="">{{ t('admin-content.comments.filters.allStatus') }}</option>
          <option v-for="(label, value) in statusLabels" :key="value" :value="value">{{ label }}</option>
        </select>
        <label
          >{{ t('admin-content.comments.filters.from')
          }}<input v-model="from" type="date" :disabled="working" @change="resetPage"
        /></label>
        <label
          >{{ t('admin-content.comments.filters.to')
          }}<input v-model="to" type="date" :disabled="working" @change="resetPage"
        /></label>
        <input
          v-model="search"
          :aria-label="t('admin-content.comments.filters.search')"
          :placeholder="t('admin-content.comments.filters.searchPlaceholder')"
        /><button :aria-busy="pending" type="submit" :disabled="pending">
          {{ t('admin-content.comments.filters.submit') }}
        </button>
      </form>
      <p v-if="error" role="alert">
        {{ error }}
        <button type="button" :disabled="pending || working" @click="load">
          {{ t('admin-content.comments.reload') }}
        </button>
      </p>
      <p v-if="articleError" role="alert">
        {{ t('admin-content.comments.articlesFailed') }}
        <button type="button" @click="loadArticles">{{ t('admin-content.comments.retryArticles') }}</button>
      </p>
      <p v-if="pending" role="status">{{ t('admin-content.comments.processing') }}</p>
      <form v-if="replyTarget" class="admin-comments__reply" @submit.prevent="sendReply">
        <label
          >{{ t('admin-content.comments.reply.label', { author: replyTarget.author })
          }}<textarea
            ref="replyInput"
            v-model="replyText"
            :aria-label="t('admin-content.comments.reply.input')"
            maxlength="1000"
            rows="3"
            required
            :disabled="working"
          />
        </label>
        <p>{{ t('admin-content.comments.reply.post', { title: replyTarget.postTitle }) }}</p>
        <blockquote>{{ replyTarget.content }}</blockquote>
        <button :aria-busy="replySubmitting" type="submit" :disabled="working || !replyText.trim()">
          {{ t('admin-content.comments.reply.submit') }}
        </button>
        <button type="button" :disabled="working" @click="cancelReply">
          {{ t('admin-content.comments.reply.cancel') }}
        </button>
      </form>
      <section
        v-if="context || contextPending || contextError"
        ref="contextPanel"
        tabindex="-1"
        class="admin-comments__context"
        :aria-label="t('admin-content.comments.context.title')"
      >
        <h2>{{ t('admin-content.comments.context.title') }}</h2>
        <button type="button" @click="closeContext">{{ t('admin-content.comments.context.close') }}</button>
        <p v-if="contextPending" role="status">{{ t('admin-content.comments.context.pending') }}</p>
        <p v-if="contextError" role="alert">{{ contextError }}</p>
        <template v-if="context">
          <p>
            {{
              t('admin-content.comments.context.deleteImpact', {
                title: context.post.title,
                count: context.deleteTotal,
              })
            }}
          </p>
          <p>
            {{
              t('admin-content.comments.context.visibility', {
                visible: context.visibleTotal,
                approved: context.approvedVisibleTotal,
              })
            }}
          </p>
          <ol>
            <li v-for="ancestor in context.ancestors" :key="ancestor.id">
              <strong>{{ ancestor.author }} · {{ statusLabels[ancestor.status] }}</strong>
              <p>{{ ancestor.content }}</p>
              <button type="button" @click="showContext(ancestor.id)">
                {{ t('admin-content.comments.context.viewAncestor') }}
              </button>
            </li>
          </ol>
          <blockquote>
            <strong>{{
              t('admin-content.comments.context.current', {
                author: context.target.author,
                status: statusLabels[context.target.status],
              })
            }}</strong>
            <p>{{ context.target.content }}</p>
          </blockquote>
          <h3>{{ t('admin-content.comments.context.directReplies', { count: context.total }) }}</h3>
          <p v-if="!context.total">{{ t('admin-content.comments.context.noReplies') }}</p>
          <ul>
            <li v-for="reply in context.replies" :key="reply.id">
              <strong
                >{{ reply.author }}{{ reply.isOwner ? ` · ${t('admin-content.comments.owner')}` : '' }} ·
                {{ statusLabels[reply.status] }}</strong
              >
              <p>{{ reply.content }}</p>
              <button type="button" @click="showContext(reply.id)">
                {{ t('admin-content.comments.context.viewReply') }}
              </button>
            </li>
          </ul>
          <nav class="admin-comments__pagination" :aria-label="t('admin-content.comments.context.pagination')">
            <button
              type="button"
              :disabled="contextPending || context.page <= 1"
              @click="showContext(context.target.id, context.page - 1)"
            >
              {{ t('admin-content.comments.context.previous') }}
            </button>
            <span>{{ context.page }} / {{ Math.max(1, Math.ceil(context.total / 20)) }}</span>
            <button
              type="button"
              :disabled="contextPending || context.page * 20 >= context.total"
              @click="showContext(context.target.id, context.page + 1)"
            >
              {{ t('admin-content.comments.context.next') }}
            </button>
          </nav>
        </template>
      </section>
      <AdminBatchBar
        v-if="items.length"
        :noun="t('admin-content.comments.batch.noun')"
        :count="selection.count.value"
        :page-count="items.length"
        :all-selected="selection.allSelected.value"
        :partially-selected="selection.partiallySelected.value"
        :actions="batchActions"
        :disabled="pending || working"
        :busy="batchBusy"
        @toggle-all="selection.toggleAll"
        @action="runBatch"
        @clear="selection.clear"
      />
      <ul class="admin-comments__list">
        <li v-for="comment in items" :key="comment.id" :class="{ 'is-selected': selection.isSelected(comment.id) }">
          <label class="admin-comments__select"
            ><input
              type="checkbox"
              :checked="selection.isSelected(comment.id)"
              :disabled="pending || working"
              :aria-label="
                t('admin-content.comments.item.select', {
                  author: comment.author,
                  excerpt: comment.content.slice(0, 40),
                })
              "
              @change="selection.toggle(comment.id, ($event.target as HTMLInputElement).checked)"
          /></label>
          <NuxtLink
            :to="comment.postStatus === 'published' ? `/articles/${comment.postId}` : `/admin/posts/${comment.postId}`"
            >{{ comment.postTitle }}</NuxtLink
          >
          <p>
            <strong>{{ comment.author }}</strong>
            {{ comment.isOwner ? `· ${t('admin-content.comments.owner')}` : '' }} ·
            {{ comment.createdAt.slice(0, 10) }}
          </p>
          <p>{{ comment.content }}</p>
          <p>
            {{ statusLabels[comment.status] }} ·
            {{
              comment.visible ? t('admin-content.comments.item.visible') : t('admin-content.comments.item.invisible')
            }}
          </p>
          <p v-if="comment.postStatus !== 'published'">{{ t('admin-content.comments.item.postUnpublished') }}</p>
          <div class="admin-comments__actions">
            <button type="button" :disabled="working" @click="showContext(comment.id)">
              {{ t('admin-content.comments.item.viewContext') }}
            </button>
            <button
              v-if="comment.depth < 2 && comment.visible"
              type="button"
              :disabled="working"
              @click="startReply(comment)"
            >
              {{ t('admin-content.comments.item.reply') }}
            </button>
            <button type="button" :disabled="pending || working" @click="remove(comment)">
              {{ t('admin-content.comments.item.remove') }}
            </button>
            <button
              v-if="comment.status !== 'published'"
              type="button"
              :disabled="pending || working"
              @click="moderate(comment, 'published')"
            >
              {{ t('admin-content.comments.item.publish') }}
            </button>
            <button
              v-if="comment.status === 'published'"
              type="button"
              :disabled="pending || working"
              @click="moderate(comment, 'hidden')"
            >
              {{ t('admin-content.comments.item.hide') }}
            </button>
            <button
              v-if="comment.status !== 'spam'"
              type="button"
              :disabled="pending || working"
              @click="moderate(comment, 'spam')"
            >
              {{ t('admin-content.comments.item.spam') }}
            </button>
          </div>
        </li>
      </ul>
      <p v-if="!pending && !error && !items.length">{{ t('admin-content.comments.empty') }}</p>
      <nav class="admin-comments__pagination" :aria-label="t('admin-content.comments.pagination')">
        <button type="button" :disabled="pending || page <= 1" @click="previousPage">
          {{ t('admin-content.comments.previous') }}
        </button>
        <span>{{
          t('admin-content.comments.pageSummary', { page, pages: Math.max(1, Math.ceil(total / 20)), total })
        }}</span>
        <button type="button" :disabled="pending || page * 20 >= total" @click="nextPage">
          {{ t('admin-content.comments.next') }}
        </button>
      </nav>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import { describeBatchResult } from '~/composables/useAdminBatchSelection'
import type { AdminBatchAction, AdminBatchResult } from '~/composables/useAdminBatchSelection'
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-content.comments.title'), robots: 'noindex, nofollow' })
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
const COMMENT_STATUSES: CommentStatus[] = ['published', 'pending', 'hidden', 'spam']
const statusLabels = computed(
  () =>
    Object.fromEntries(COMMENT_STATUSES.map((value) => [value, t(`admin-content.comments.status.${value}`)])) as Record<
      CommentStatus,
      string
    >,
)
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
    policyError.value = t('admin-content.comments.policy.loadFailed')
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
    success(t('admin-content.comments.policy.saved'))
  } catch (cause) {
    policyError.value = apiErrorMessage(cause, 'admin-content.comments.policy.saveFailed')
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
const replySubmitting = ref(false)
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
const selection = useAdminBatchSelection(items)
const batchBusy = ref('')
const batchActions = computed<AdminBatchAction[]>(() => [
  { key: 'published', label: t('admin-content.comments.batch.approve'), icon: 'lucide:check' },
  { key: 'hidden', label: t('admin-content.comments.batch.hide'), icon: 'lucide:eye-off' },
  { key: 'spam', label: t('admin-content.comments.batch.spam'), icon: 'lucide:shield-alert' },
  { key: 'delete', label: t('admin-content.comments.batch.delete'), icon: 'lucide:trash-2', danger: true },
])
const replyDirty = computed(() => !!replyTarget.value && !!replyText.value.trim())
function allowDiscard() {
  return !replyDirty.value || window.confirm(t('admin-content.comments.reply.discardConfirm'))
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
  status.value = COMMENT_STATUSES.includes(text('status') as CommentStatus) ? text('status') : ''
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
      error.value = t('admin-content.comments.listFailed')
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
    if (version === contextVersion) contextError.value = t('admin-content.comments.context.loadFailed')
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
    error.value = t('admin-content.comments.remove.replyDirty')
    return
  }
  working.value = true
  error.value = ''
  try {
    const preview = await api<CommentContext>(`/admin/comments/${comment.id}/context`)
    if (
      !window.confirm(
        t('admin-content.comments.remove.confirm', { author: comment.author, count: preview.deleteTotal }),
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
    success(t('admin-content.comments.remove.done', { count: result.deleted }))
    await Promise.all([loadArticles(), load()])
  } catch (cause) {
    error.value = apiErrorMessage(cause, 'admin-content.comments.remove.failed')
  } finally {
    working.value = false
  }
}
/** 批量审核只改选中评论自身状态；批量删除级联删除所有层级回复，需要明确确认 */
async function runBatch(action: string) {
  if (working.value || pending.value) return
  const selected = selection.selectedItems.value
  if (!selected.length) return
  if (replyDirty.value) {
    error.value = t('admin-content.comments.batch.replyDirty')
    return
  }
  const remove = action === 'delete'
  if (remove && !window.confirm(t('admin-content.comments.batch.deleteConfirm', { count: selected.length }))) return
  working.value = true
  batchBusy.value = action
  error.value = ''
  const items = selected.map((comment) => ({ id: comment.id, revision: comment.revision }))
  try {
    const result = remove
      ? await api<AdminBatchResult & { deleted?: number }>('/admin/comments/batch/delete', {
          method: 'POST',
          body: { items },
        })
      : await api<AdminBatchResult & { deleted?: number }>('/admin/comments/batch/moderation', {
          method: 'POST',
          body: { status: action, items },
        })
    const message = describeBatchResult(
      result,
      remove
        ? t('admin-content.comments.batch.deleted')
        : t('admin-content.comments.batch.setTo', { status: statusLabels.value[action as CommentStatus] }),
      t('admin-content.comments.batch.noun'),
      // 在 await 之后调用，显式传入翻译函数，不依赖当时的组件上下文
      t,
    )
    selection.clear()
    if (remove) closeContext()
    clearNuxtData((key) => key.startsWith('article-') || key.startsWith('post-'))
    await Promise.all([remove ? loadArticles() : Promise.resolve(), load()])
    if (!remove && context.value) await showContext(context.value.target.id, context.value.page)
    // 列表重新读取会清空错误提示，因此在刷新之后再展示跳过项。
    if (result.failedCount) error.value = message
    else
      success(
        remove
          ? t('admin-content.comments.batch.deletedWithReplies', { message, count: result.deleted ?? 0 })
          : message,
      )
  } catch (cause) {
    error.value = apiErrorMessage(cause, 'admin-content.comments.batch.failed')
  } finally {
    working.value = false
    batchBusy.value = ''
  }
}
async function sendReply() {
  if (!replyTarget.value || working.value) return
  working.value = true
  replySubmitting.value = true
  error.value = ''
  const id = replyTarget.value.id
  try {
    await api(`/admin/comments/${id}/reply`, { method: 'POST', body: { content: replyText.value } })
    replyTarget.value = null
    replyText.value = ''
    clearNuxtData((key) => key.startsWith('article-') || key.startsWith('post-'))
    success(t('admin-content.comments.reply.sent'))
    await load()
    if (context.value) await showContext(context.value.target.id, context.value.page)
  } catch (cause) {
    error.value = apiErrorMessage(cause, 'admin-content.comments.reply.failed')
  } finally {
    working.value = false
    replySubmitting.value = false
  }
}
async function moderate(comment: Row, target: CommentStatus) {
  if (working.value || pending.value) return
  if (replyDirty.value) {
    error.value = t('admin-content.comments.moderate.replyDirty')
    return
  }
  working.value = true
  error.value = ''
  try {
    const preview = await api<CommentContext>(`/admin/comments/${comment.id}/context`)
    const after = target === 'published' ? preview.approvedVisibleTotal : 0
    if (
      !window.confirm(
        t('admin-content.comments.moderate.confirm', {
          author: comment.author,
          status: statusLabels.value[target],
          count: preview.deleteTotal,
          visible: preview.visibleTotal,
          after,
        }),
      )
    )
      return
    await api(`/admin/comments/${comment.id}/moderation`, {
      method: 'POST',
      body: { status: target, revision: preview.target.revision, expectedFingerprint: preview.deleteFingerprint },
    })
    success(t('admin-content.comments.moderate.done'))
    clearNuxtData((key) => key.startsWith('article-') || key.startsWith('post-'))
    await load()
    if (context.value) await showContext(context.value.target.id, context.value.page)
  } catch (cause) {
    error.value = apiErrorMessage(cause, 'admin-content.comments.moderate.failed')
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
      window.confirm(t('admin-content.comments.policy.leaveConfirm'))),
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
.admin-comments {
  min-width: 0;
  overflow-wrap: anywhere;
}
.admin-comments__filters,
.admin-comments__actions,
.admin-comments__pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.admin-comments__filters {
  margin-block: 1rem;
}
.admin-comments__filters > label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
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
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-block: 1rem;
  overflow-wrap: anywhere;
}
.admin-comments__list li {
  position: relative;
  padding-left: 3rem;
}
.admin-comments__list li.is-selected {
  border-color: var(--accent);
}
.admin-comments .admin-comments__select {
  position: absolute;
  top: 0.75rem;
  left: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
}
.admin-comments .admin-comments__select input {
  width: 1.1rem;
  height: 1.1rem;
  margin: 0;
  padding: 0;
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
  min-width: 0;
  max-width: calc(100% - 0.5rem);
  box-sizing: border-box;
}
.admin-comments textarea {
  width: 100%;
  display: block;
}
.admin-comments__filters > select,
.admin-comments__filters > input:not([type='checkbox']) {
  flex: 1 1 12rem;
}
.admin-comments__filters input,
.admin-comments__filters select,
.admin-comments__filters button,
.admin-comments__actions button,
.admin-comments__pagination button {
  margin: 0;
  max-width: 100%;
}
.admin-comments__filters input:not([type='checkbox']),
.admin-comments__filters select,
.admin-comments button {
  min-height: 44px;
}
@media (max-width: 640px) {
  .admin-comments__filters > label,
  .admin-comments__filters > select,
  .admin-comments__filters > input:not([type='checkbox']) {
    flex: 1 1 100%;
    width: 100%;
  }
  .admin-comments__filters input[type='date'] {
    flex: 1 1 100%;
    width: 100%;
  }
  .admin-comments__context ol {
    padding-left: 1rem;
  }
  .admin-comments blockquote {
    margin-inline: 0;
  }
}
</style>
