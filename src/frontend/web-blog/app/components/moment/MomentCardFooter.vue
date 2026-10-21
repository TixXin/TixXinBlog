<!--
  @file MomentCardFooter.vue
  @description 朋友圈动态卡片底部栏：时间戳、设备定位元信息及点赞评论操作
  @author TixXin
  @since 2026-04-20
-->

<template>
  <div class="moment-card__footer">
    <div class="moment-card__meta">
      <NuxtLink
        :to="{ path: `/moments/${momentId}`, query: detailQuery }"
        class="moment-card__time"
        :aria-label="$t('flash-moment.momentCard.viewDetail', { date: formattedDate })"
      >
        {{ formattedDate }}
      </NuxtLink>
      <span v-if="location" class="moment-card__location">
        <Icon name="lucide:map-pin" size="12" />
        {{ location }}
      </span>
      <span v-if="device" class="moment-card__device">
        <Icon name="lucide:smartphone" size="12" />
        {{ device }}
      </span>
    </div>

    <div class="moment-card__actions">
      <!-- 评论按钮 -->
      <button
        type="button"
        class="moment-action-btn"
        :class="{ 'is-active': showComments }"
        :aria-label="$t('flash-moment.momentCard.viewComments')"
        :aria-expanded="showComments"
        @click="$emit('toggle-comments')"
      >
        <Icon name="lucide:message-square" size="15" />
        <span v-if="commentCount > 0" class="moment-action-count">{{ commentCount }}</span>
      </button>

      <!-- 点赞按钮 -->
      <button
        type="button"
        class="moment-action-btn"
        :class="{ 'is-liked': isLiked }"
        :aria-label="isLiked ? $t('flash-moment.momentCard.unlike') : $t('flash-moment.momentCard.like')"
        :aria-pressed="isLiked"
        :disabled="likePending || syncing || !hydrated"
        @click="toggleLike"
      >
        <span class="like-icon-wrap" :class="{ 'like-icon-wrap--burst': justLiked }">
          <Icon name="lucide:heart" size="15" :class="{ 'fill-current': isLiked }" />
        </span>
        <span class="moment-action-count-wrap">
          <Transition name="like-count">
            <span v-if="likes > 0" :key="likes" class="moment-action-count">{{ likes }}</span>
          </Transition>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  momentId: string
  formattedDate: string
  location?: string
  device?: string
  detailQuery?: Record<string, string>
  likes: number
  isLiked: boolean
  commentCount: number
  showComments: boolean
  likePending?: boolean
  syncing?: boolean
}>()

const emit = defineEmits<{
  'toggle-comments': []
  like: [complete: (success: boolean) => void]
}>()

const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})

const justLiked = ref(false)
const { reducedMotion } = useMotionPreference()
let likeTimer: ReturnType<typeof setTimeout> | undefined
let alive = true

function finishLike() {
  if (likeTimer) clearTimeout(likeTimer)
  justLiked.value = false
}

watch(reducedMotion, (value) => {
  if (value) finishLike()
})

onBeforeUnmount(() => {
  alive = false
  finishLike()
})

function toggleLike() {
  if (props.likePending || props.syncing || !hydrated.value) return
  const willLike = !props.isLiked
  emit('like', (success: boolean) => {
    if (!success || !willLike || !alive || reducedMotion.value) return
    finishLike()
    justLiked.value = true
    likeTimer = setTimeout(finishLike, 400)
  })
}
</script>

<style lang="scss" scoped>
// 底部栏
.moment-card__footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.moment-card__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
  gap: 0.25rem 0.75rem;
  padding-block: 0.25rem;
  line-height: 1.5rem;
  font-size: 0.8125rem;
  color: var(--text-faint);
}

.moment-card__location,
.moment-card__device {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-soft);
}

// 时间戳兼详情入口：点击跳转单条动态详情页
.moment-card__time {
  color: var(--text-faint);
  text-decoration: none;
  transition: $transition-colors;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--accent-text);
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
  }
}

// 操作按钮
.moment-card__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.25rem;
}

.moment-action-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2rem;
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-faint);
  font-size: 0.8125rem;
  border-radius: $radius-sm;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-colors;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &.is-active {
    color: var(--accent-text);
  }

  &.is-liked {
    color: var(--danger);

    .fill-current {
      fill: currentColor;
    }
  }
}

// 触屏放大操作热区到 44px，元信息首行同步下移保持对齐
@media (pointer: coarse) {
  .moment-action-btn {
    min-width: 44px;
    min-height: 44px;
    justify-content: center;
  }

  .moment-card__meta {
    padding-block: 0.625rem;
  }
}

.moment-action-count-wrap {
  position: relative;
  min-width: 0.75rem;
}

// 点赞动画 — 心形弹跳
.like-icon-wrap {
  position: relative;
  display: inline-flex;

  &--burst {
    animation: like-pop 0.35s ease-out;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }

    // 粒子效果（6个圆点从中心向外扩散）
    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 2px;
      height: 2px;
      border-radius: 50%;
      animation: like-particles 0.5s ease-out forwards;
      @media (prefers-reduced-motion: reduce) {
        animation: none;
      }
    }
  }
}

@keyframes like-pop {
  0% {
    transform: scale(1);
  }

  25% {
    transform: scale(1.35);
  }

  50% {
    transform: scale(0.88);
  }

  75% {
    transform: scale(1.08);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes like-particles {
  0% {
    opacity: 1;
    box-shadow:
      0 0 0 var(--danger),
      0 0 0 var(--danger),
      0 0 0 #f59e0b,
      0 0 0 #f59e0b,
      0 0 0 #ec4899,
      0 0 0 #ec4899;
  }

  100% {
    opacity: 0;
    box-shadow:
      -8px -10px 0 var(--danger),
      8px -10px 0 var(--danger),
      -12px 0 0 #f59e0b,
      12px 0 0 #f59e0b,
      -6px 10px 0 #ec4899,
      6px 10px 0 #ec4899;
  }
}

// 点赞数字过渡
.like-count-enter-active {
  animation: count-float-in 0.3s ease-out;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

.like-count-leave-active {
  animation: count-float-out 0.2s ease-in;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
  position: absolute;
  left: 0;
}

@keyframes count-float-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes count-float-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }

  to {
    opacity: 0;
    transform: translateY(-6px);
  }
}
</style>
