<!--
  @file ActiveMembers.vue
  @description 留言板右侧栏活跃成员列表，前三名显示排名标识，多个成员可显示在线状态
  @author TixXin
  @since 2026-03-20
-->

<template>
  <section class="card active-members">
    <h3 class="active-members__title">
      <Icon
        name="lucide:users"
        size="14"
      />
      活跃成员
    </h3>
    <ul class="active-members__list">
      <li
        v-for="(m, index) in members"
        :key="`${m.name}-${index}`"
        class="active-members__row"
      >
        <!-- 排名标识 -->
        <div v-if="index < 3" class="active-members__rank" :class="`active-members__rank--${index + 1}`">
          <Icon name="lucide:crown" size="10" />
        </div>
        <div v-else class="active-members__rank active-members__rank--num">
          {{ index + 1 }}
        </div>

        <div
          class="active-members__avatar-wrap"
          :class="{ 'active-members__avatar-wrap--online': m.isOnline }"
        >
          <img
            class="active-members__avatar"
            :src="m.avatar"
            :alt="`${m.name} 的头像`"
            width="36"
            height="36"
          >
        </div>
        <div class="active-members__info">
          <span class="active-members__name">{{ m.name }}</span>
          <span class="active-members__count">{{ m.messageCount }} 条留言</span>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { ActiveMember } from '~/features/guestbook/types'

defineProps<{
  members: ActiveMember[]
}>()
</script>

<style lang="scss" scoped>
.active-members {
  padding: 1.25rem;
}

.active-members__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem;
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-main);

  :deep(svg),
  :deep(.icon) {
    color: var(--text-soft);
  }
}

.active-members__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.active-members__row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.4375rem 0.5rem;
  border-radius: $radius-md;
  transition: background 0.2s;

  &:hover {
    background: var(--surface-2);
  }
}

/* ---- 排名标识 ---- */
.active-members__rank {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-full;
  font-size: 0.5625rem;
  font-weight: 700;

  &--1 {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    color: #fff;
    box-shadow: 0 1px 3px rgba(245, 158, 11, 0.4);
  }

  &--2 {
    background: linear-gradient(135deg, #d1d5db, #9ca3af);
    color: #fff;
    box-shadow: 0 1px 3px rgba(156, 163, 175, 0.4);
  }

  &--3 {
    background: linear-gradient(135deg, #d97706, #b45309);
    color: #fff;
    box-shadow: 0 1px 3px rgba(180, 83, 9, 0.4);
  }

  &--num {
    color: var(--text-faint);
    font-size: 0.625rem;
  }
}

.active-members__avatar-wrap {
  position: relative;
  flex-shrink: 0;

  &--online::after {
    content: '';
    position: absolute;
    right: -1px;
    bottom: -1px;
    width: 0.625rem;
    height: 0.625rem;
    border-radius: $radius-full;
    background: #10b981;
    box-shadow: 0 0 0 2px var(--surface-1);
  }
}

.active-members__avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: $radius-full;
  object-fit: cover;
  box-shadow: 0 0 0 2px var(--surface-2);
}

.active-members__info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.active-members__name {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-members__count {
  font-size: 0.625rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
