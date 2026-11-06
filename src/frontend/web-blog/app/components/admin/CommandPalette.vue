<!--
  @file CommandPalette.vue
  @description 后台命令面板（Ctrl/⌘ + K）：搜索并跳转到后台页面、快速新建内容、按标题打开文章；
               组合框加列表框，方向键移动、Enter 打开、Esc 关闭，焦点约束在面板内，关闭后焦点回到打开前的位置
  @author TixXin
  @since 2026-11-06
-->

<template>
  <Teleport to="body">
    <div v-if="open" class="admin-command" @pointerdown.self="close">
      <div
        ref="dialog"
        class="admin-command__dialog admin-ui"
        role="dialog"
        aria-modal="true"
        :aria-label="t('admin-system.command.dialog')"
      >
        <div class="admin-command__search">
          <Icon name="lucide:search" aria-hidden="true" />
          <input
            ref="input"
            v-model="query"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            :aria-controls="listId"
            :aria-activedescendant="results[active] ? optionId(active) : undefined"
            :aria-label="t('admin-system.command.input')"
            :placeholder="t('admin-system.command.placeholder')"
            @keydown="onKeydown"
          />
        </div>
        <ul :id="listId" class="admin-command__list" role="listbox" :aria-label="t('admin-system.command.dialog')">
          <template v-for="item in rows" :key="item.key">
            <li v-if="item.heading" class="admin-command__heading" role="presentation">
              {{ t(`admin-system.command.groups.${item.group}`) }}
            </li>
            <li
              v-else
              :id="optionId(item.index)"
              class="admin-command__option"
              role="option"
              :aria-selected="item.index === active"
              @pointermove="active = item.index"
              @click="go(item.command)"
            >
              <Icon :name="item.command.icon" aria-hidden="true" />{{ item.command.label }}
            </li>
          </template>
        </ul>
        <p v-if="postsPending" class="admin-command__note">{{ t('admin-system.command.searching') }}</p>
        <p v-else-if="postsError" class="admin-command__note" role="alert">
          {{ t('admin-system.command.postsFailed') }}
        </p>
        <p v-else-if="!results.length" class="admin-command__note">{{ t('admin-system.command.empty') }}</p>
        <p class="sr-only" aria-live="polite">{{ t('admin-system.command.results', { count: results.length }) }}</p>
        <p class="admin-command__hint" aria-hidden="true">{{ t('admin-system.command.hint') }}</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { AdminCommand } from '~/features/admin/commands'

const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
const listId = useId()
const query = ref('')
const active = ref(0)
const dialog = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const { results, postsPending, postsError } = useAdminCommandSearch(query, open)
let navigated = false

// 带分组标题的渲染行；index 为在结果中的序号，供方向键与 aria-activedescendant 使用
const rows = computed(() =>
  results.value.flatMap((command, index) => {
    const row = { key: command.id, heading: false, group: command.group, command, index }
    return index === 0 || results.value[index - 1]!.group !== command.group
      ? [{ ...row, key: `heading:${command.group}`, heading: true }, row]
      : [row]
  }),
)
const optionId = (index: number) => `${listId}-option-${index}`

function close() {
  open.value = false
}
useModalFocus(open, dialog, {
  close,
  initialFocus: () => input.value,
  // 打开了新页面时由页面管理焦点；单纯关闭则回到打开前的位置
  restoreFocus: () => !navigated,
})
watch(open, (value) => {
  if (!value) return
  query.value = ''
  active.value = 0
  navigated = false
})
watch(results, () => (active.value = Math.min(active.value, Math.max(0, results.value.length - 1))))
watch(query, () => (active.value = 0))
watch(active, async (index) => {
  await nextTick()
  document.getElementById(optionId(index))?.scrollIntoView({ block: 'nearest' })
})

function go(command: AdminCommand | undefined) {
  if (!command) return
  navigated = true
  close()
  void navigateTo(command.to)
}
function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  const count = results.value.length
  if (event.key === 'ArrowDown' && count) active.value = (active.value + 1) % count
  else if (event.key === 'ArrowUp' && count) active.value = (active.value - 1 + count) % count
  else if (event.key === 'Home' && count) active.value = 0
  else if (event.key === 'End' && count) active.value = count - 1
  else if (event.key === 'Enter') go(results.value[active.value])
  else return
  event.preventDefault()
}
</script>

<style scoped lang="scss">
.admin-command {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 12vh 1rem 1rem;
  background: rgba(15, 23, 42, 0.45);
}
.admin-command__dialog {
  display: flex;
  flex-direction: column;
  width: min(36rem, 100%);
  max-height: 70vh;
  overflow: hidden;
  border: 1px solid var(--border-soft);
  border-radius: 0.75rem;
  background: var(--surface-1);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.25);
}
.admin-command__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-soft);
  color: var(--text-soft);

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--text-main);
    font-size: 1rem;
    outline: none;
  }
}
.admin-command__list {
  flex: 1;
  margin: 0;
  padding: 0.375rem;
  overflow-y: auto;
  list-style: none;
}
.admin-command__heading {
  padding: 0.5rem 0.625rem 0.25rem;
  color: var(--text-soft);
  font-size: 0.75rem;
  font-weight: 600;
}
.admin-command__option {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-height: 2.5rem;
  padding: 0.375rem 0.625rem;
  border-radius: 0.5rem;
  color: var(--text-main);
  font-size: 0.875rem;
  cursor: var(--interaction-cursor, pointer);

  &[aria-selected='true'] {
    background: color-mix(in srgb, var(--accent-action) 14%, transparent);
    color: var(--accent-action);
  }
}
.admin-command__note,
.admin-command__hint {
  margin: 0;
  padding: 0.5rem 1rem;
  color: var(--text-soft);
  font-size: 0.8125rem;
}
.admin-command__hint {
  border-top: 1px solid var(--border-soft);
  font-size: 0.75rem;
}
</style>
