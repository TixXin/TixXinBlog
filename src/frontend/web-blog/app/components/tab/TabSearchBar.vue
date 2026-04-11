<!--
  @file TabSearchBar.vue
  @description 标签页顶部居中大搜索框，回车跳转外部搜索引擎
  @author TixXin
  @since 2026-04-11
-->

<template>
  <form class="tab-search" @submit.prevent="onSubmit">
    <div class="tab-search__inner">
      <Icon name="lucide:search" size="18" class="tab-search__icon" />
      <input
        v-model="query"
        type="text"
        class="tab-search__input"
        :placeholder="placeholder"
        autocomplete="off"
        spellcheck="false"
      >
      <button v-if="query" type="button" class="tab-search__clear" aria-label="清空" @click="query = ''">
        <Icon name="lucide:x" size="14" />
      </button>
      <button type="submit" class="tab-search__submit" :disabled="!query.trim()" aria-label="搜索">
        <Icon name="lucide:arrow-right" size="16" />
      </button>
    </div>
    <div class="tab-search__hint">按 Enter 在 Google 中搜索</div>
  </form>
</template>

<script setup lang="ts">
const query = ref('')
const placeholder = '搜索任何东西，或输入网址…'

function onSubmit() {
  const q = query.value.trim()
  if (!q) return
  // 直接是 URL 的话直接跳转
  if (/^https?:\/\//i.test(q)) {
    window.open(q, '_blank', 'noopener')
    return
  }
  const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`
  window.open(url, '_blank', 'noopener')
}
</script>

<style lang="scss" scoped>
.tab-search {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.625rem;
}

.tab-search__inner {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 3.25rem;
  padding: 0 0.75rem 0 1.125rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-full;
  box-shadow: var(--shadow-card);
  transition: all 0.2s;

  &:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-soft);
  }
}

.tab-search__icon {
  flex-shrink: 0;
  color: var(--text-soft);
  margin-right: 0.75rem;
}

.tab-search__input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.9375rem;
  color: var(--text-main);

  &::placeholder {
    color: var(--text-faint);
  }
}

.tab-search__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: $radius-full;
  background: transparent;
  color: var(--text-soft);
  cursor: pointer;

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
}

.tab-search__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-left: 0.5rem;
  border: none;
  border-radius: $radius-full;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  transition: opacity 0.2s;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    opacity: 0.88;
  }
}

.tab-search__hint {
  font-size: 0.6875rem;
  color: var(--text-faint);
}
</style>
