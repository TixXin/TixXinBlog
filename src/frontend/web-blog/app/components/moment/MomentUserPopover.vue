<!--
  @file MomentUserPopover.vue
  @description 用户信息悬浮卡片，hover 触发显示用户头像、昵称、简介
  @author TixXin
  @since 2026-04-10
-->

<template>
  <div
    ref="triggerRef"
    class="moment-user-popover"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <slot />
    <Teleport to="body">
      <Transition name="popover-fade">
        <div
          v-if="show && profile"
          class="moment-user-popover__card"
          :style="floatingStyle"
          @mouseenter="onEnter"
          @mouseleave="onLeave"
        >
          <div class="moment-user-popover__header">
            <div class="moment-user-popover__avatar">
              <NuxtImg
                v-if="profile.avatar"
                :src="profile.avatar"
                :alt="profile.name"
                width="40"
                height="40"
                class="moment-user-popover__avatar-img"
              />
              <Icon v-else name="lucide:user" size="20" />
            </div>
            <div class="moment-user-popover__info">
              <span class="moment-user-popover__name" :class="{ 'is-owner': isOwner }">{{ profile.name }}</span>
              <span v-if="isOwner" class="moment-user-popover__badge">博主</span>
            </div>
          </div>
          <p v-if="profile.bio" class="moment-user-popover__bio">{{ profile.bio }}</p>
          <a
            v-if="profile.link"
            :href="profile.link"
            target="_blank"
            rel="noopener noreferrer"
            class="moment-user-popover__link"
          >
            <Icon name="lucide:external-link" size="12" />
            主页
          </a>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { MomentUserProfile } from '~/features/moment/types'

const props = defineProps<{
  profile?: MomentUserProfile
  isOwner?: boolean
  placement?: 'top' | 'bottom'
}>()

const show = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const floatingStyle = ref<Record<string, string>>({})

/** 延迟关闭计时器，防止鼠标从触发元素移入弹窗时闪烁 */
let hideTimer: ReturnType<typeof setTimeout> | null = null

function onEnter() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  show.value = true
  nextTick(updatePosition)
}

function onLeave() {
  hideTimer = setTimeout(() => {
    show.value = false
  }, 80)
}

function updatePosition() {
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const gap = 8
  const placement = props.placement ?? 'bottom'

  // 水平居中对齐触发元素
  const left = rect.left + rect.width / 2

  if (placement === 'top') {
    floatingStyle.value = {
      position: 'fixed',
      zIndex: '9999',
      left: `${left}px`,
      bottom: `${window.innerHeight - rect.top + gap}px`,
      transform: 'translateX(-50%)',
    }
  } else {
    floatingStyle.value = {
      position: 'fixed',
      zIndex: '9999',
      left: `${left}px`,
      top: `${rect.bottom + gap}px`,
      transform: 'translateX(-50%)',
    }
  }
}
</script>

<style lang="scss" scoped>
.moment-user-popover {
  position: relative;
  display: inline-flex;
  // 当父级是 row 方向 flex 时，避免被默认 align-items: stretch 纵向拉伸到整列，
  // 否则 wrapper div 的 hover hitbox 会扩展到头像之外的整列空白区
  align-self: flex-start;
}
</style>

<!-- Teleport 到 body 的弹窗样式，需要非 scoped -->
<style lang="scss">
.moment-user-popover__card {
  min-width: 200px;
  max-width: 260px;
  padding: 0.75rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-md;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  pointer-events: auto;
}

.moment-user-popover__header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.moment-user-popover__avatar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: $radius-md;
  overflow: hidden;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
}

.moment-user-popover__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.moment-user-popover__info {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.moment-user-popover__name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-main);

  &.is-owner {
    color: var(--accent);
  }
}

.moment-user-popover__badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.0625rem 0.375rem;
  border-radius: $radius-full;
  background: var(--accent-soft);
  color: var(--accent);
}

.moment-user-popover__bio {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: var(--text-soft);
  line-height: 1.5;
}

.moment-user-popover__link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--accent);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

// 浮层过渡动画
.popover-fade-enter-active {
  transition: all 0.2s ease-out;
}

.popover-fade-leave-active {
  transition: all 0.15s ease-in;
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}
</style>
