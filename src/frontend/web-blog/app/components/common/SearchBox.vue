<!--
  @file SearchBox.vue
  @description 通用搜索框组件，多页面复用
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="search-box" :class="{ 'is-disabled': disabled }" @click="$emit('click')">
    <Icon name="lucide:search" size="14" class="search-box__icon" />
    <input
      type="text"
      :placeholder="disabled ? '搜索功能即将上线' : placeholder"
      :value="modelValue"
      :disabled="disabled"
      :readonly="readonly"
      class="search-box__input"
      :class="{ 'is-readonly': readonly }"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
  }>(),
  {
    modelValue: '',
    placeholder: '搜索...',
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
  width: 100%;
  max-width: 16rem;
}

.search-box__icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-soft);
  pointer-events: none;
  transition: color 0.2s;
}

.search-box__input {
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: $radius-full;
  padding: 0.625rem 1rem 0.625rem 2.75rem;
  font-size: 0.875rem;
  color: var(--text-main);
  outline: none;
  transition: $transition-normal;
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
  }
}

.search-box.is-disabled {
  cursor: not-allowed;
}

.search-box:focus-within .search-box__icon {
  color: var(--text-muted);
}
</style>
