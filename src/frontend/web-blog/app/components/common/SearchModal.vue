<!--
  @file SearchModal.vue
  @description 全局搜索弹窗 (Cmd+K)，跨文章、项目、友链进行模糊搜索
  @author TixXin
  @since 2026-04-06
-->

<template>
  <Teleport to="body">
    <Transition name="search-modal">
      <div v-if="visible" class="search-modal-overlay" @click.self="close">
        <div class="search-modal">
          <div class="search-modal__header">
            <Icon name="lucide:search" size="16" class="search-modal__icon" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="search-modal__input"
              placeholder="搜索文章、项目、友链..."
              @keydown.escape="close"
              @keydown.enter="navigateToFirst"
              @keydown.down.prevent="selectNext"
              @keydown.up.prevent="selectPrev"
            >
            <kbd class="search-modal__kbd">ESC</kbd>
          </div>

          <div v-if="query.trim()" class="search-modal__body">
            <div v-if="isSearching" class="search-modal__loading">
              <Icon name="lucide:loader-2" size="16" class="search-modal__spinner" />
              搜索中...
            </div>
            <ul v-else-if="results.length" class="search-modal__list">
              <li
                v-for="(item, i) in results"
                :key="item.id"
                class="search-modal__item"
                :class="{ 'search-modal__item--active': selectedIndex === i }"
                @click="navigateTo(item)"
                @mouseenter="selectedIndex = i"
              >
                <Icon :name="item.icon" size="16" class="search-modal__item-icon" />
                <div class="search-modal__item-content">
                  <span class="search-modal__item-title">{{ item.title }}</span>
                  <span class="search-modal__item-desc line-clamp-1">{{ item.description }}</span>
                </div>
                <span class="search-modal__item-type">{{ typeLabel(item.type) }}</span>
              </li>
            </ul>
            <div v-else class="search-modal__empty">
              <Icon name="lucide:search-x" size="20" />
              <span>没有找到相关内容</span>
            </div>
          </div>

          <div v-else class="search-modal__hint">
            <span>输入关键词开始搜索</span>
            <div class="search-modal__hint-keys">
              <kbd>&uarr;&darr;</kbd> 导航 <kbd>Enter</kbd> 跳转 <kbd>ESC</kbd> 关闭
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { mockPosts } from '~/features/post/mock'
import { mockProjects } from '~/features/project/mock'
import { mockLinks } from '~/features/link/mock'
import type { SearchResultItem } from '~/composables/useSearch'

const visible = defineModel<boolean>('visible', { default: false })

const inputRef = ref<HTMLInputElement | null>(null)
const selectedIndex = ref(0)

const { query, results, isSearching, search } = useSearch()

watch(visible, (v) => {
  if (v) {
    query.value = ''
    results.value = []
    selectedIndex.value = 0
    nextTick(() => inputRef.value?.focus())
  }
})

watch(query, (q) => {
  selectedIndex.value = 0
  search(q, mockPosts, mockProjects, mockLinks)
})

function close() {
  visible.value = false
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    post: '文章',
    project: '项目',
    link: '友链',
  }
  return labels[type] ?? type
}

const router = useRouter()

function navigateTo(item: SearchResultItem) {
  close()
  if (item.type === 'link') {
    window.open(item.url, '_blank')
  } else {
    router.push(item.url)
  }
}

function navigateToFirst() {
  if (results.value.length > 0) {
    navigateTo(results.value[selectedIndex.value]!)
  }
}

function selectNext() {
  if (selectedIndex.value < results.value.length - 1) {
    selectedIndex.value++
  }
}

function selectPrev() {
  if (selectedIndex.value > 0) {
    selectedIndex.value--
  }
}
</script>

<style lang="scss" scoped>
.search-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: min(20vh, 10rem);
}

.search-modal {
  width: min(560px, calc(100vw - 2rem));
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.search-modal__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-soft);
}

.search-modal__icon {
  color: var(--text-soft);
  flex-shrink: 0;
}

.search-modal__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.9375rem;
  color: var(--text-main);

  &::placeholder {
    color: var(--text-soft);
  }
}

.search-modal__kbd {
  font-size: 0.625rem;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-soft);
  font-family: $font-family-base;
  flex-shrink: 0;
}

.search-modal__body {
  max-height: 360px;
  overflow-y: auto;
}

.search-modal__loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem;
  color: var(--text-soft);
  font-size: 0.875rem;
}

.search-modal__spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.search-modal__list {
  list-style: none;
  margin: 0;
  padding: 0.5rem;
}

.search-modal__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: $radius-md;
  cursor: pointer;
  transition: background 0.15s;

  &--active {
    background: var(--surface-2);
  }
}

.search-modal__item-icon {
  color: var(--text-soft);
  flex-shrink: 0;
}

.search-modal__item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.search-modal__item-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-main);
}

.search-modal__item-desc {
  font-size: 0.75rem;
  color: var(--text-soft);
}

.search-modal__item-type {
  font-size: 0.6875rem;
  color: var(--text-faint);
  background: var(--surface-3);
  padding: 0.125rem 0.5rem;
  border-radius: $radius-sm;
  flex-shrink: 0;
}

.search-modal__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--text-soft);
  font-size: 0.875rem;
}

.search-modal__hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  color: var(--text-soft);
  font-size: 0.8125rem;
}

.search-modal__hint-keys {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-faint);

  kbd {
    font-size: 0.625rem;
    padding: 0.15rem 0.35rem;
    border-radius: 3px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    font-family: $font-family-base;
  }
}

/* Transition */
.search-modal-enter-active,
.search-modal-leave-active {
  transition: opacity 0.2s ease;
}

.search-modal-enter-active .search-modal,
.search-modal-leave-active .search-modal {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.search-modal-enter-from,
.search-modal-leave-to {
  opacity: 0;
}

.search-modal-enter-from .search-modal {
  transform: translateY(-10px) scale(0.98);
  opacity: 0;
}

.search-modal-leave-to .search-modal {
  transform: translateY(-10px) scale(0.98);
  opacity: 0;
}
</style>
