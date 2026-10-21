<!--
  @file StatusFooterAvatar.vue
  @description Nexus 底栏头像组件：半悬浮头像、在线状态微标签与呼吸光晕
  @author TixXin
  @since 2026-04-21
-->

<template>
  <NuxtLink
    ref="avatarWrapRef"
    to="/"
    class="nexus-bar__avatar-wrap"
    :style="{ '--avatar-glow-color': avatarGlowColor }"
    :aria-label="avatarLinkLabel"
    @mouseenter="$emit('avatar-enter')"
  >
    <img
      v-if="!avatarError"
      :key="displayAvatarUrl"
      :src="displayAvatarUrl"
      :alt="displayName"
      :width="80"
      :height="80"
      class="nexus-bar__avatar-img"
      loading="eager"
      fetchpriority="high"
      @error="onAvatarError"
    />
    <span v-else class="nexus-bar__avatar-fallback">{{ avatarFallback }}</span>
    <span class="nexus-bar__presence-badge" :class="`nexus-bar__presence-badge--${effectivePresence.status}`">
      <span class="nexus-bar__presence-badge-dot" />
      <span class="nexus-bar__presence-badge-text">{{ presenceBadgeText }}</span>
    </span>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { OwnerPresence } from '~/features/site/types'

defineEmits<{
  (e: 'avatar-enter'): void
}>()

const { ownerPresence, ownerCard } = useSiteInfo()
const { isLoggedIn, currentUser } = useCurrentUser()
const { t } = useI18n()

const avatarWrapRef = ref<ComponentPublicInstance | null>(null)
const avatarError = ref(false)

// 头像呼吸光晕颜色映射
const GLOW_COLOR_MAP: Record<OwnerPresence, string> = {
  online: 'var(--accent-alpha-20, rgba(99, 102, 241, 0.2))',
  idle: 'rgba(234, 179, 8, 0.15)',
  busy: 'rgba(239, 68, 68, 0.15)',
  offline: 'transparent',
}

const defaultAvatarUrl = computed(() => ownerCard.value.avatar || '/avatar.svg')
const displayAvatarUrl = computed(() => currentUser.value?.avatar || defaultAvatarUrl.value)
const displayName = computed(() => currentUser.value?.nickname || ownerCard.value.name)

const avatarFallback = computed(() => {
  const name = displayName.value || 'TX'
  return name.slice(0, 2).toUpperCase()
})

const effectivePresence = computed(() => {
  if (isLoggedIn.value && currentUser.value) {
    return {
      status: 'online' as const,
      label: t('theme.nexus.statusBar.presence.online'),
      signature: currentUser.value.signature ?? '',
      since: ownerPresence.value.since,
    }
  }
  return ownerPresence.value
})

const avatarGlowColor = computed(() => GLOW_COLOR_MAP[effectivePresence.value.status])

const presenceBadgeText = computed(() => {
  const { label, status } = effectivePresence.value
  return label.length <= 2 ? label : t(`theme.nexus.statusBar.presence.${status}`)
})

const avatarLinkLabel = computed(() => {
  const { label } = effectivePresence.value
  const status =
    label === presenceBadgeText.value
      ? label
      : t('theme.nexus.statusBar.presenceDetail', { short: presenceBadgeText.value, label })
  return t('theme.nexus.statusBar.avatarLink', { name: displayName.value, status })
})

function onAvatarError() {
  avatarError.value = true
}

watch(displayAvatarUrl, () => {
  avatarError.value = false
})

defineExpose({
  avatarWrapRef,
})
</script>

<style lang="scss" scoped>
.nexus-bar__avatar-wrap {
  position: absolute;
  left: calc(1.25rem + var(--bar-avatar-offset));
  bottom: 16px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 3px solid var(--surface-1);
  box-shadow:
    0 2px 16px rgba(0, 0, 0, 0.12),
    0 0 0 0 var(--accent-alpha-0);
  z-index: 22;
  cursor: var(--interaction-cursor, pointer);
  transition:
    transform 0.3s cubic-bezier(0.22, 0.68, 0.35, 1),
    box-shadow 0.3s ease,
    border-color 0.3s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    border-color: var(--accent);
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.15),
      0 0 0 3px var(--accent-alpha-20, rgba(99, 102, 241, 0.15));
    transform: scale(1.05);
    transition:
      transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.3s ease,
      border-color 0.3s ease;
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }

  &:active {
    transform: scale(1.02);
  }

  &:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-alpha-20, rgba(99, 102, 241, 0.2));
  }
}

.nexus-bar__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  transition: filter 0.3s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  .nexus-bar__avatar-wrap:hover & {
    filter: brightness(1.05);
  }
}

.nexus-bar__avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--accent-text);
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

// ---- 头像呼吸光晕 ----
.nexus-bar__avatar-wrap::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.6s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

:global(.nexus-bar:not(.is-expanded)) .nexus-bar__avatar-wrap::after {
  opacity: 1;
  animation: nexus-avatar-glow 3s ease-in-out infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes nexus-avatar-glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 var(--avatar-glow-color, transparent);
  }
  50% {
    box-shadow: 0 0 12px 2px var(--avatar-glow-color, transparent);
  }
}

// ---- 在线状态微标签 ----
.nexus-bar__presence-badge {
  position: absolute;
  right: -8px;
  bottom: -2px;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px 1px 4px;
  border-radius: $radius-full;
  background: var(--surface-1);
  border: 1.5px solid var(--border-soft);
  font-size: 0.5625rem;
  font-weight: 600;
  color: var(--text-soft);
  white-space: nowrap;
  z-index: 2;
  pointer-events: none;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  :global(.nexus-bar.is-expanded) & {
    opacity: 0;
    transform: scale(0.8);
  }
}

.nexus-bar__presence-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.nexus-bar__presence-badge--online .nexus-bar__presence-badge-dot {
  background: var(--presence-online);
}
.nexus-bar__presence-badge--idle .nexus-bar__presence-badge-dot {
  background: var(--presence-idle);
}
.nexus-bar__presence-badge--busy .nexus-bar__presence-badge-dot {
  background: var(--presence-busy);
}
.nexus-bar__presence-badge--offline .nexus-bar__presence-badge-dot {
  background: var(--presence-offline);
}

.nexus-bar__presence-badge-text {
  line-height: 1;
}
</style>
