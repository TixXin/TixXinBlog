<!--
  @file TabSidebarFloating.vue
  @description 标签页悬浮侧栏：脱离内容流，悬浮在视口左侧空白区域，支持折叠/展开
  @author TixXin
  @since 2026-04-11
-->

<template>
  <aside class="tab-side" :class="{ 'tab-side--collapsed': collapsed }">
    <!-- 折叠/展开切换 -->
    <button type="button" class="tab-side__toggle" aria-label="折叠/展开" @click="collapsed = !collapsed">
      <Icon :name="collapsed ? 'lucide:chevron-right' : 'lucide:chevron-left'" size="14" />
    </button>

    <!-- 用户头像 + 名称 -->
    <div class="tab-side__header">
      <div class="tab-side__avatar">
        <Icon v-if="!user?.avatar" name="lucide:user" size="18" />
        <img v-else :src="user.avatar" :alt="user.nickname" >
      </div>
      <div v-if="!collapsed" class="tab-side__user">
        <div class="tab-side__name">{{ user?.nickname || '未登录' }}</div>
        <div class="tab-side__sub">{{ totalCount }} 个书签</div>
      </div>
    </div>

    <div class="tab-side__divider" />

    <!-- 分类列表 -->
    <nav class="tab-side__nav">
      <!-- 全部 -->
      <CommonTooltip v-if="collapsed" content="全部" placement="right">
        <button
          type="button"
          class="tab-side__cat"
          :class="{ 'tab-side__cat--active': activeId === null }"
          @click="emit('select', null)"
        >
          <Icon name="lucide:layout-grid" size="15" class="tab-side__cat-icon" />
        </button>
      </CommonTooltip>
      <button
        v-else
        type="button"
        class="tab-side__cat"
        :class="{ 'tab-side__cat--active': activeId === null }"
        @click="emit('select', null)"
      >
        <Icon name="lucide:layout-grid" size="15" class="tab-side__cat-icon" />
        <span class="tab-side__cat-name">全部</span>
        <span class="tab-side__cat-count">{{ totalCount }}</span>
      </button>

      <!-- 各分类 -->
      <template v-for="cat in categories" :key="cat.id">
        <CommonTooltip v-if="collapsed" :content="cat.name" placement="right">
          <button
            type="button"
            class="tab-side__cat"
            :class="{ 'tab-side__cat--active': activeId === cat.id }"
            @click="emit('select', cat.id)"
          >
            <Icon v-if="cat.icon" :name="cat.icon" size="15" class="tab-side__cat-icon"  />
          </button>
        </CommonTooltip>
        <button
          v-else
          type="button"
          class="tab-side__cat"
          :class="{ 'tab-side__cat--active': activeId === cat.id }"
          @click="emit('select', cat.id)"
        >
          <Icon v-if="cat.icon" :name="cat.icon" size="15" class="tab-side__cat-icon"  />
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
      </template>
    </nav>

    <!-- 新建分类 -->
    <template v-if="!readOnly">
      <div class="tab-side__divider" />
      <CommonTooltip v-if="collapsed" content="新建分类" placement="right">
        <button type="button" class="tab-side__action tab-side__action--icon" @click="emit('addCategory')">
          <Icon name="lucide:folder-plus" size="15" />
        </button>
      </CommonTooltip>
      <button v-else type="button" class="tab-side__action" @click="emit('addCategory')">
        <Icon name="lucide:folder-plus" size="14" />
        <span>新建分类</span>
      </button>
    </template>

    <!-- 底部弹性空间 + 功能按钮 -->
    <div class="tab-side__spacer" />
    <div class="tab-side__bottom">
      <CommonTooltip v-if="collapsed" content="设置" placement="right">
        <button type="button" class="tab-side__bottom-btn" @click="emit('openSettings')">
          <Icon name="lucide:settings" size="15" />
        </button>
      </CommonTooltip>
      <button v-else type="button" class="tab-side__bottom-btn" @click="emit('openSettings')">
        <Icon name="lucide:settings" size="15" />
        <span v-if="!collapsed">设置</span>
      </button>

      <CommonTooltip v-if="collapsed" content="打赏" placement="right">
        <button type="button" class="tab-side__bottom-btn" @click="emit('openDonate')">
          <Icon name="lucide:heart" size="15" />
        </button>
      </CommonTooltip>
      <button v-else type="button" class="tab-side__bottom-btn" @click="emit('openDonate')">
        <Icon name="lucide:heart" size="15" />
        <span v-if="!collapsed">打赏</span>
      </button>
    </div>
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
  openSettings: []
  openDonate: []
}>()

const collapsed = defineModel<boolean>('collapsed', { default: false })
</script>

<style lang="scss" scoped>
$side-expanded: 160px;
$side-collapsed: 44px;

.tab-side {
  position: fixed;
  left: 1.25rem;
  top: 4rem;
  bottom: 4rem;
  z-index: 10;
  width: $side-expanded;
  padding: 0.625rem;
  display: flex;
  flex-direction: column;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: var(--shadow-elevated, var(--shadow-card));
  backdrop-filter: blur(12px);
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  @media (max-width: $breakpoint-lg) {
    display: none;
  }

  &--collapsed {
    width: $side-collapsed;
    padding: 0.75rem 0.375rem;

    .tab-side__header {
      justify-content: center;
    }

    .tab-side__cat {
      justify-content: center;
      padding: 0.4375rem;
    }

    .tab-side__divider {
      margin: 0.5rem 0;
    }
  }
}

/* ---- 折叠按钮 ---- */
.tab-side__toggle {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;

  .tab-side--collapsed & {
    position: static;
    align-self: center;
    margin-bottom: 0.25rem;
  }

  &:hover {
    color: var(--accent);
    background: var(--accent-soft);
  }
}

/* ---- 头像区 ---- */
.tab-side__header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.tab-side__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
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
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-side__sub {
  font-size: 0.625rem;
  color: var(--text-soft);
  margin-top: 0.0625rem;
}

/* ---- 分割线 ---- */
.tab-side__divider {
  height: 1px;
  background: var(--border-soft);
  margin: 0.75rem 0;
}

/* ---- 分类列表 ---- */
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
  padding: 0.4375rem 0.5rem;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: var(--text-main);
  font-size: 0.75rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

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
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-side__cat-count {
  font-size: 0.625rem;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.tab-side__cat-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 0.125rem;
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

/* ---- 新建分类 ---- */
.tab-side__action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.4375rem 0.5rem;
  border: 1px dashed var(--border);
  border-radius: $radius-md;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
  }

  &--icon {
    padding: 0.4375rem;
  }
}

/* ---- 底部弹性空间 + 功能按钮 ---- */
.tab-side__spacer {
  flex: 1;
}

.tab-side__bottom {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-soft);
}

.tab-side__bottom-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4375rem 0.5rem;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  .tab-side--collapsed & {
    justify-content: center;
    padding: 0.4375rem;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }
}
</style>
