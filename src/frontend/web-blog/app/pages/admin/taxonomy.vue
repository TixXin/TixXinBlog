<!--
  @file taxonomy.vue
  @description 专栏与标签真实管理，展示全状态引用并防止误删。
-->
<template>
  <section class="taxonomy">
    <h1>分类与标签</h1>
    <p class="taxonomy__intro">技术 / 生活是固定内容类型；专栏组织文章栏目，标签可跨专栏使用。</p>
    <ClientOnly>
      <p v-if="pending" role="status">正在加载目录…</p>
      <p v-if="error" role="alert">
        {{ error }} <button type="button" :disabled="working || pending" @click="load">重新加载</button>
      </p>
      <div v-if="data" class="taxonomy__types">
        <span>技术 · {{ categoryCount('tech') }} 篇</span><span>生活 · {{ categoryCount('life') }} 篇</span>
      </div>
      <form ref="editorForm" class="taxonomy__editor" @submit.prevent="save">
        <h2>{{ editingId === null ? '新增目录项' : '修改目录项' }}</h2>
        <fieldset :disabled="working || pending || !ready">
          <label
            >目录类型<select v-model="kind" :disabled="editingId !== null">
              <option value="folders">专栏</option>
              <option value="tags">标签</option>
            </select></label
          >
          <label>名称<input v-model="label" required maxlength="64" /></label>
          <label v-if="kind === 'tags'"
            >标签颜色<select v-model="color">
              <option v-for="option in colors" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select></label
          >
          <button type="submit" :disabled="!label.trim()">
            {{ working ? '保存中…' : editingId === null ? '新增' : '保存修改' }}
          </button>
          <button v-if="editingId !== null || label" type="button" @click="resetEditor">取消编辑</button>
        </fieldset>
        <p v-if="editingId !== null">重命名将同步关联文章；不会删除文章或改变发布状态。</p>
      </form>
      <template v-if="data">
        <section v-for="group in groups" :key="group.kind" class="taxonomy__group" :aria-label="group.title">
          <h2>{{ group.title }}（{{ group.items.length }}）</h2>
          <p>引用总数包含草稿和归档；有引用的目录项不能删除。</p>
          <p v-if="!group.items.length">暂无{{ group.title }}</p>
          <div v-else class="taxonomy__table">
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>全部引用</th>
                  <th>公开文章</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in group.items" :key="item.id">
                  <td>{{ item.label }}</td>
                  <td>{{ item.total }}</td>
                  <td>{{ item.published }}</td>
                  <td>
                    <NuxtLink
                      :to="{
                        path: '/admin/posts',
                        query: group.kind === 'folders' ? { folder: item.label } : { tag: item.label },
                      }"
                      >查看文章</NuxtLink
                    >
                    <button type="button" :disabled="working" @click="edit(group.kind, item)">修改</button>
                    <button
                      type="button"
                      :disabled="working || item.total > 0"
                      :title="item.total ? '请先调整关联文章' : '删除未引用的目录项'"
                      @click="remove(group.kind, item)"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '分类与标签', robots: 'noindex, nofollow' })
type Kind = 'folders' | 'tags'
interface Item {
  id: number
  label: string
  total: number
  published: number
  color?: string
}
interface Taxonomy {
  folders: Item[]
  tags: Item[]
  categories: { category: string; total: number }[]
}
const api = useAdminApi()
const { restore } = useCurrentUser()
const { success } = useToast()
const data = ref<Taxonomy | null>(null)
const pending = ref(false)
const ready = ref(false)
const working = ref(false)
const error = ref('')
const kind = ref<Kind>('folders')
const label = ref('')
const color = ref('sky')
const editingId = ref<number | null>(null)
const baseline = ref('')
const editorForm = ref<HTMLFormElement | null>(null)
const snapshot = computed(() => JSON.stringify([kind.value, label.value, color.value]))
const dirty = computed(() => (editingId.value !== null || !!label.value.trim()) && snapshot.value !== baseline.value)
const colors = [
  { value: 'sky', label: '天蓝' },
  { value: 'blue', label: '蓝色' },
  { value: 'emerald', label: '翠绿' },
  { value: 'rose', label: '玫红' },
  { value: 'orange', label: '橙色' },
  { value: 'amber', label: '琥珀' },
]
const groups = computed(() =>
  data.value
    ? [
        { kind: 'folders' as const, title: '专栏', items: data.value.folders },
        { kind: 'tags' as const, title: '标签', items: data.value.tags },
      ]
    : [],
)
function categoryCount(value: string) {
  return data.value?.categories.find((item) => item.category === value)?.total ?? 0
}
function allowDiscard() {
  return !dirty.value || window.confirm('目录项有未保存修改，确定放弃吗？')
}
function resetEditor() {
  if (!allowDiscard()) return
  editingId.value = null
  label.value = ''
  color.value = 'sky'
  baseline.value = snapshot.value
}
function edit(type: Kind, item: Item) {
  if (working.value || pending.value || !allowDiscard()) return
  kind.value = type
  editingId.value = item.id
  label.value = item.label
  color.value = item.color ?? 'sky'
  baseline.value = snapshot.value
  void nextTick(() => editorForm.value?.querySelector('input')?.focus())
}
async function load() {
  if (pending.value) return
  pending.value = true
  error.value = ''
  try {
    data.value = await api<Taxonomy>('/admin/taxonomy')
    ready.value = true
  } catch {
    error.value = '目录加载失败，请检查登录后重试'
  } finally {
    pending.value = false
  }
}
function report(cause: unknown, fallback: string) {
  const message = (cause as { data?: { message?: unknown } }).data?.message
  error.value = typeof message === 'string' ? message : fallback
}
async function save() {
  if (working.value || pending.value) return
  working.value = true
  error.value = ''
  try {
    await api(`/admin/taxonomy/${kind.value}${editingId.value === null ? '' : `/${editingId.value}`}`, {
      method: editingId.value === null ? 'POST' : 'PATCH',
      body: { label: label.value.trim(), ...(kind.value === 'tags' ? { color: color.value } : {}) },
    })
    baseline.value = snapshot.value
    resetEditor()
    clearNuxtData((key) => key.startsWith('post-') || key.startsWith('article-'))
    success('目录已保存，关联文章已同步')
    await load()
  } catch (cause) {
    report(cause, '保存失败，输入已保留')
  } finally {
    working.value = false
  }
}
async function remove(type: Kind, item: Item) {
  if (
    working.value ||
    item.total ||
    !window.confirm(`删除未被引用的${type === 'folders' ? '专栏' : '标签'}“${item.label}”？`)
  )
    return
  working.value = true
  error.value = ''
  try {
    await api(`/admin/taxonomy/${type}/${item.id}`, { method: 'DELETE' })
    if (kind.value === type && editingId.value === item.id) {
      baseline.value = snapshot.value
      resetEditor()
    }
    clearNuxtData((key) => key.startsWith('post-') || key.startsWith('article-'))
    success('目录项已删除')
    await load()
  } catch (cause) {
    report(cause, '删除失败，请重新检查引用')
  } finally {
    working.value = false
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(() => !working.value && allowDiscard())
onMounted(async () => {
  baseline.value = snapshot.value
  window.addEventListener('beforeunload', beforeUnload)
  if (await restore()) await load()
  else await navigateTo({ path: '/admin/login', query: { next: '/admin/taxonomy' } })
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>
<style scoped lang="scss">
h1 {
  font-size: 1.6rem;
  font-weight: 700;
}
h2 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
}
.taxonomy__intro,
.taxonomy__group > p,
.taxonomy__editor > p {
  color: var(--text-muted);
  margin: 0.75rem 0;
}
.taxonomy__types {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin: 1.5rem 0;
}
.taxonomy__group,
.taxonomy__editor {
  padding: 1.25rem;
  border: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: 1rem;
  margin: 1rem 0;
}
fieldset {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem;
  border: 0;
  padding: 0;
}
label {
  display: grid;
  gap: 0.4rem;
}
input,
select,
button {
  background: var(--surface-1);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.55rem 0.75rem;
}
button:disabled {
  opacity: 0.45;
}
td button {
  margin-left: 0.6rem;
}
a {
  color: var(--accent);
}
.taxonomy__table {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
td,
th {
  text-align: left;
  padding: 0.8rem;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
@media (max-width: 600px) {
  fieldset label {
    width: 100%;
  }
  .taxonomy__editor,
  .taxonomy__group {
    padding: 1rem;
  }
}
</style>
