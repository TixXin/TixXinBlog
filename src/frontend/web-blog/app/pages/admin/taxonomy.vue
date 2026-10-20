<!--
  @file taxonomy.vue
  @description 专栏与标签真实管理，展示全状态引用并防止误删。
-->
<template>
  <section class="taxonomy">
    <header class="admin-page-header">
      <div>
        <h1>{{ t('admin-content.taxonomy.title') }}</h1>
        <p class="taxonomy__intro">{{ t('admin-content.taxonomy.intro') }}</p>
      </div>
    </header>
    <ClientOnly>
      <p v-if="pending" role="status">{{ t('admin-content.taxonomy.loading') }}</p>
      <p v-if="error" role="alert">
        {{ error }}
        <button type="button" :disabled="working || pending" @click="load">
          {{ t('admin-content.taxonomy.reload') }}
        </button>
      </p>
      <div v-if="data" class="taxonomy__types">
        <span>{{ t('admin-content.taxonomy.techCount', { count: categoryCount('tech') }) }}</span
        ><span>{{ t('admin-content.taxonomy.lifeCount', { count: categoryCount('life') }) }}</span>
      </div>
      <form ref="editorForm" class="taxonomy__editor" @submit.prevent="save">
        <h2>
          {{ t(editingId === null ? 'admin-content.taxonomy.editor.create' : 'admin-content.taxonomy.editor.edit') }}
        </h2>
        <fieldset :disabled="working || pending || !ready">
          <label
            >{{ t('admin-content.taxonomy.editor.kind')
            }}<select v-model="kind" :disabled="editingId !== null">
              <option value="folders">{{ t('admin-content.taxonomy.folders') }}</option>
              <option value="tags">{{ t('admin-content.taxonomy.tags') }}</option>
            </select></label
          >
          <label>{{ t('admin-content.taxonomy.editor.name') }}<input v-model="label" required maxlength="64" /></label>
          <label v-if="kind === 'tags'"
            >{{ t('admin-content.taxonomy.editor.color')
            }}<select v-model="color">
              <option v-for="option in colors" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select></label
          >
          <button :aria-busy="saving" type="submit" :disabled="!label.trim()">
            {{
              t(
                working
                  ? 'admin-content.taxonomy.editor.saving'
                  : editingId === null
                    ? 'admin-content.taxonomy.editor.add'
                    : 'admin-content.taxonomy.editor.saveEdit',
              )
            }}
          </button>
          <button v-if="editingId !== null || label" type="button" @click="resetEditor">
            {{ t('admin-content.taxonomy.editor.cancel') }}
          </button>
        </fieldset>
        <p v-if="editingId !== null">{{ t('admin-content.taxonomy.editor.renameHint') }}</p>
      </form>
      <template v-if="data">
        <section v-for="group in groups" :key="group.kind" class="taxonomy__group" :aria-label="group.title">
          <h2>{{ t('admin-content.taxonomy.group.heading', { title: group.title, count: group.items.length }) }}</h2>
          <p>{{ t('admin-content.taxonomy.group.hint') }}</p>
          <p v-if="!group.items.length">{{ group.empty }}</p>
          <div
            v-else
            class="taxonomy__table"
            role="region"
            :aria-label="t('admin-content.taxonomy.group.table', { title: group.title })"
            tabindex="0"
          >
            <table>
              <thead>
                <tr>
                  <th>{{ t('admin-content.taxonomy.columns.name') }}</th>
                  <th>{{ t('admin-content.taxonomy.columns.total') }}</th>
                  <th>{{ t('admin-content.taxonomy.columns.published') }}</th>
                  <th>{{ t('admin-content.taxonomy.columns.actions') }}</th>
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
                      >{{ t('admin-content.taxonomy.viewPosts') }}</NuxtLink
                    >
                    <button type="button" :disabled="working" @click="edit(group.kind, item)">
                      {{ t('admin-content.taxonomy.edit') }}
                    </button>
                    <button
                      type="button"
                      :disabled="working || item.total > 0"
                      :title="
                        t(item.total ? 'admin-content.taxonomy.deleteBlocked' : 'admin-content.taxonomy.deleteHint')
                      "
                      @click="remove(group.kind, item)"
                    >
                      {{ t('admin-content.taxonomy.delete') }}
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
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-content.taxonomy.title'), robots: 'noindex, nofollow' })
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
const saving = ref(false)
const error = ref('')
const kind = ref<Kind>('folders')
const label = ref('')
const color = ref('sky')
const editingId = ref<number | null>(null)
const baseline = ref('')
const editorForm = ref<HTMLFormElement | null>(null)
const snapshot = computed(() => JSON.stringify([kind.value, label.value, color.value]))
const dirty = computed(() => (editingId.value !== null || !!label.value.trim()) && snapshot.value !== baseline.value)
const colors = computed(() =>
  ['sky', 'blue', 'emerald', 'rose', 'orange', 'amber'].map((value) => ({
    value,
    label: t(`admin-content.taxonomy.colors.${value}`),
  })),
)
const groups = computed(() =>
  data.value
    ? [
        {
          kind: 'folders' as const,
          title: t('admin-content.taxonomy.folders'),
          empty: t('admin-content.taxonomy.group.emptyFolders'),
          items: data.value.folders,
        },
        {
          kind: 'tags' as const,
          title: t('admin-content.taxonomy.tags'),
          empty: t('admin-content.taxonomy.group.emptyTags'),
          items: data.value.tags,
        },
      ]
    : [],
)
function categoryCount(value: string) {
  return data.value?.categories.find((item) => item.category === value)?.total ?? 0
}
function allowDiscard() {
  return !dirty.value || window.confirm(t('admin-content.taxonomy.discardConfirm'))
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
    error.value = t('admin-content.taxonomy.loadFailed')
  } finally {
    pending.value = false
  }
}
function report(cause: unknown, fallbackKey: string) {
  error.value = apiErrorMessage(cause, fallbackKey)
}
async function save() {
  if (working.value || pending.value) return
  working.value = true
  saving.value = true
  error.value = ''
  try {
    await api(`/admin/taxonomy/${kind.value}${editingId.value === null ? '' : `/${editingId.value}`}`, {
      method: editingId.value === null ? 'POST' : 'PATCH',
      body: { label: label.value.trim(), ...(kind.value === 'tags' ? { color: color.value } : {}) },
    })
    baseline.value = snapshot.value
    resetEditor()
    clearNuxtData((key) => key.startsWith('post-') || key.startsWith('article-'))
    success(t('admin-content.taxonomy.saved'))
    await load()
  } catch (cause) {
    report(cause, 'admin-content.taxonomy.saveFailed')
  } finally {
    working.value = false
    saving.value = false
  }
}
async function remove(type: Kind, item: Item) {
  if (
    working.value ||
    item.total ||
    !window.confirm(
      t(type === 'folders' ? 'admin-content.taxonomy.deleteFolderConfirm' : 'admin-content.taxonomy.deleteTagConfirm', {
        label: item.label,
      }),
    )
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
    success(t('admin-content.taxonomy.deleted'))
    await load()
  } catch (cause) {
    report(cause, 'admin-content.taxonomy.deleteFailed')
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
.taxonomy {
  min-width: 0;
  overflow-wrap: anywhere;
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
  min-width: 0;
  max-width: 100%;
  padding: 1.25rem;
  border: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: 1rem;
  margin: 1rem 0;
}
fieldset {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem;
  border: 0;
  padding: 0;
}
label {
  display: grid;
  min-width: 0;
  gap: 0.4rem;
}

td button {
  margin-left: 0.6rem;
}
a:not(.admin-btn) {
  color: var(--accent);
}
.taxonomy__table {
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
}
.taxonomy__table:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
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
