<!--
  @file TabSidebarFloating.vue
  @description 标签页左侧悬浮卡片：头像 + 昵称 + 分类列表 + 添加分类
  @author TixXin
  @since 2026-04-11
-->

<template>
  <aside class="tab-side">
    <div class="tab-side__header">
      <div class="tab-side__avatar">
        <Icon v-if="!user?.avatar" name="lucide:user" size="22" />
        <img v-else :src="user.avatar" :alt="user.nickname" >
      </div>
      <div class="tab-side__user">
        <div class="tab-side__name">{{ user?.nickname || '未登录' }}</div>
        <div class="tab-side__sub">{{ totalCount }} 个书签</div>
      </div>
    </div>

    <div class="tab-side__divider" />

    <nav class="tab-side__nav">
      <button
        type="button"
        class="tab-side__cat"
        :class="{ 'tab-side__cat--active': activeId === null }"
        @click="emit('select', null)"
      >
        <Icon name="lucide:layout-grid" size="14" class="tab-side__cat-icon" />
        <span class="tab-side__cat-name">全部</span>
        <span class="tab-side__cat-count">{{ totalCount }}</span>
      </button>
      <button
        v-for="cat in categories"
        :key="cat.id"
        type="button"
        class="tab-side__cat"
        :class="{ 'tab-side__cat--active': activeId === cat.id }"
        @click="emit('select', cat.id)"
      >
        <Icon
          v-if="cat.icon"
          :name="cat.icon"
          size="14"
          class="tab-side__cat-icon"
          :style="{ color: cat.color }"
        />
        <span class="tab-side__cat-name">{{ cat.name }}</span>
        <span class="tab-side__cat-count">{{ counts[cat.id] || 0 }}</span>
        <button
          v-if="!readOnly && categories.length > 1"
          type="button"
          class="tab-side__cat-remove"
          :aria-label="`删除 ${cat.name}`"
          @click.stop="emit('removeCategory', cat.id)"
        >
          <Icon name="lucide:x" size="11" />
        </button>
      </button>
    </nav>

    <template v-if="!readOnly">
      <div class="tab-side__divider" />

      <button type="button" class="tab-side__action" @click="emit('addCategory')">
        <Icon name="lucide:folder-plus" size="14" />
        <span>新建分类</span>
      </button>
    </template>
  </aside>
</template>

<script setup lang="ts">
import type { BookmarkCategory } from '~/features/tab/types'
import type { CurrentUser } from '~/features/auth/types'

defineProps<{
  user: CurrentUser | null
  categories: BookmarkCategory[]
  activeId: string | null
  counts: Record<string, number>
  totalCount: number
  readOnly?: boolean
}>()

const emit = defineEmits<{
  select: [id: string | null]
  addCategory: []
  removeCategory: [id: string]
}>()
</script>

<style lang="scss" scoped>
.tab-side {
  position: fixed;
  left: 1.5rem;
  top: 6rem;
  z-index: 5;
  width: 220px;
  padding: 1.125rem 1rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: var(--shadow-elevated, var(--shadow-card));
  backdrop-filter: blur(10px);

  @media (max-width: $breakpoint-lg) {
    display: none;
  }
}

.tab-side__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tab-side__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: $radius-full;
  background: var(--accent-soft);
  color: var(--accent);
  overflow: hidden;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.tab-side__user {
  flex: 1;
  min-width: 0;
}

.tab-side__name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-side__sub {
  font-size: 0.6875rem;
  color: var(--text-soft);
  margin-top: 0.125rem;
}

.tab-side__divider {
  height: 1px;
  background: var(--border-soft);
  margin: 1rem 0;
}

.tab-side__nav {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.tab-side__cat {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: var(--text-main);
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--surface-2);

    .tab-side__cat-remove {
      opacity: 1;
    }
  }

  &--active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }
}

.tab-side__cat-icon {
  flex-shrink: 0;
  color: var(--text-soft);
}

.tab-side__cat--active .tab-side__cat-icon {
  color: var(--accent);
}

.tab-side__cat-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-side__cat-count {
  font-size: 0.6875rem;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.tab-side__cat-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 0.25rem;
  border: none;
  border-radius: $radius-full;
  background: transparent;
  color: var(--text-soft);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;

  &:hover {
    background: var(--surface-3, var(--surface-2));
    color: var(--accent);
  }
}

.tab-side__action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 1px dashed var(--border);
  border-radius: $radius-md;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
  }
}
</style>
