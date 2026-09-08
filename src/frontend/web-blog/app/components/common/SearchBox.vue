<!--
  @file SearchBox.vue
  @description 通用搜索框组件，多页面复用
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="search-box" :class="{ 'is-disabled': disabled }">
    <Icon name="lucide:search" size="14" class="search-box__icon" />
    <button
      v-if="readonly"
      type="button"
      class="search-box__input is-readonly"
      :disabled="disabled || !hydrated"
      :aria-label="label || placeholder"
      aria-haspopup="dialog"
      data-focus-key="site-search"
      @click="$emit('click')"
    >
      {{ disabled ? '搜索功能即将上线' : placeholder }}
    </button>
    <input
      v-else
      type="text"
      :aria-label="label || placeholder"
      :placeholder="disabled ? '搜索功能即将上线' : placeholder"
      :value="modelValue"
      :disabled="disabled || !hydrated"
      class="search-box__input"
      :class="{ 'is-readonly': readonly }"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @click="$emit('click')"
    />
  </div>
</template>

<script setup lang="ts">
const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})
withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    label?: string
    disabled?: boolean
    readonly?: boolean
  }>(),
  {
    modelValue: '',
    placeholder: '搜索...',
    label: '',
    disabled: false,
    readonly: false,
  },
)

defineEmits<{
  'update:modelValue': [value: string]
  click: []
}>()
</script>

<style lang="scss" scoped>
.search-box {
  position: relative;
  width: var(--search-box-width, 100%);
  max-width: 16rem;

  // 紧凑档（sm–xl）：搜索框收窄，避免与右侧按钮组挤压
  @media (min-width: $breakpoint-sm) and (max-width: #{$breakpoint-xl - 1px}) {
    max-width: 12rem;
  }
}

.search-box__icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-soft);
  pointer-events: none;
  transition: color 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.search-box__input {
  min-height: 44px;
  text-align: left;
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: $radius-full;
  padding: 0.625rem 1rem 0.625rem 2.75rem;
  font-size: 0.875rem;
  color: var(--text-main);
  outline: none;
  transition: $transition-normal;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

  &::placeholder {
    color: var(--text-soft);
  }

  &:focus {
    border-color: var(--border-hover);
    background: var(--surface-1);
    box-shadow: 0 0 0 4px var(--accent-soft);

    & + .search-box__icon,
    ~ .search-box__icon {
      color: var(--text-muted);
    }
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
    background: var(--surface-3);
  }

  &.is-readonly {
    cursor: pointer;
    color: var(--text-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.search-box.is-disabled {
  cursor: not-allowed;
}

.search-box:focus-within .search-box__icon {
  color: var(--text-muted);
}
</style>
