<!-- @file SearchModalHint.vue @description 搜索弹窗底部的键盘操作快捷键提示栏 -->
<template>
  <div class="search-modal__hint">
    <span>{{ $t('layout.searchModal.start') }}</span>
    <div class="search-modal__hint-keys">
      <kbd>&uarr;&darr;</kbd> {{ $t('layout.searchModal.keyNavigate') }} <kbd>Enter</kbd>
      {{ $t('layout.searchModal.keyOpen') }} <kbd>ESC</kbd> {{ $t('layout.searchModal.keyClose') }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
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
    font-family: inherit;
  }
}

@media (max-height: 700px), (max-width: 400px) {
  .search-modal__hint {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
