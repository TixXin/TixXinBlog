<!--
  @file StatusFooterOwnerRow.vue
  @description Nexus 底栏展开态博主信息行：博主身份、在线状态、一言与社交外链
  @author TixXin
  @since 2026-04-21
-->

<template>
  <div class="nexus-bar__row-owner" :inert="!isExpanded">
    <div class="nexus-bar__owner-card">
      <!-- 左列：名字、头衔、在线状态（登录态下切换为当前用户身份） -->
      <div class="nexus-bar__owner-left">
        <div class="nexus-bar__owner-header">
          <span class="nexus-bar__owner-name">{{ displayName }}</span>
          <span class="nexus-bar__owner-title">{{ displayTitle }}</span>
        </div>
        <div class="nexus-bar__owner-status-line">
          <span
            class="nexus-bar__owner-status-dot"
            :class="`nexus-bar__owner-status-dot--${effectivePresence.status}`"
          />
          <span class="nexus-bar__owner-status-label">{{ effectivePresence.label }}</span>
          <span v-if="effectivePresence.signature" class="nexus-bar__owner-status-sig">
            <span aria-hidden="true">· </span>{{ effectivePresence.signature }}
          </span>
        </div>
      </div>
      <!-- 分隔线 -->
      <div class="nexus-bar__owner-divider" aria-hidden="true" />
      <!-- 右列：一言 + 社交链接 -->
      <div class="nexus-bar__owner-right">
        <div v-if="dailyQuote" class="nexus-bar__owner-quote-row">
          <p class="nexus-bar__owner-quote">
            <Transition name="nexus-quote-swap" mode="out-in">
              <span :key="dailyQuote">{{ $t('theme.nexus.quote.text', { quote: dailyQuote }) }}</span>
            </Transition>
          </p>
          <button
            class="nexus-bar__quote-refresh"
            type="button"
            :aria-label="$t('theme.nexus.quote.refresh')"
            @click="refreshQuote"
          >
            <Icon name="lucide:refresh-cw" size="12" />
          </button>
        </div>
        <div v-if="showSocials" class="nexus-bar__owner-socials">
          <a
            v-for="social in ownerCard.socials"
            :key="social.href"
            :href="social.href"
            target="_blank"
            rel="noopener noreferrer"
            class="nexus-bar__social-link"
          >
            <Icon :name="social.icon" size="14" />
            <span>{{ social.label }}</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isExpanded: boolean
}>()

const { ownerPresence, ownerCard, dailyQuote } = useSiteInfo()
const { isLoggedIn, currentUser } = useCurrentUser()
const { t } = useI18n()

const displayName = computed(() => currentUser.value?.nickname || ownerCard.value.name)

const displayTitle = computed(() => {
  if (currentUser.value?.role === 'visitor') return t('theme.nexus.statusBar.visitor')
  return ownerCard.value.title
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

const showSocials = computed(() => !isLoggedIn.value || currentUser.value?.role === 'owner')

function refreshQuote() {
  const quotes = ownerCard.value.quotes
  if (quotes.length <= 1) return
  let next: string = ''
  do {
    next = quotes[Math.floor(Math.random() * quotes.length)] || ''
  } while (next === dailyQuote.value)
  dailyQuote.value = next
}
</script>

<style lang="scss" scoped>
.nexus-bar__row-owner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease 0.04s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  :global(.nexus-bar.is-expanded) & {
    opacity: 1;
    pointer-events: auto;
  }
}

.nexus-bar__owner-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.nexus-bar__owner-card > * {
  opacity: 0;
  transform: translateX(-8px);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

:global(.nexus-bar.is-expanded) .nexus-bar__owner-card > :nth-child(1) {
  opacity: 1;
  transform: translateX(0);
  transition-delay: 0.06s;
}

:global(.nexus-bar.is-expanded) .nexus-bar__owner-card > :nth-child(2) {
  opacity: 1;
  transform: translateX(0);
  transition-delay: 0.1s;
}

:global(.nexus-bar.is-expanded) .nexus-bar__owner-card > :nth-child(3) {
  opacity: 1;
  transform: translateX(0);
  transition-delay: 0.14s;
}

.nexus-bar__owner-left {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0;
}

.nexus-bar__owner-divider {
  width: 1px;
  height: 2rem;
  flex-shrink: 0;
  background: var(--border-soft);
  opacity: 0.6;
}

.nexus-bar__owner-right {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.nexus-bar__owner-header {
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
}

.nexus-bar__owner-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: 0.02em;
}

.nexus-bar__owner-title {
  font-size: 0.75rem;
  color: var(--text-soft);
}

.nexus-bar__owner-status-line {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: var(--text-soft);
}

.nexus-bar__owner-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;

  &--online {
    background: var(--presence-online);
  }
  &--idle {
    background: var(--presence-idle);
  }
  &--busy {
    background: var(--presence-busy);
  }
  &--offline {
    background: var(--presence-offline);
  }
}

.nexus-bar__owner-status-label {
  font-weight: 600;
}

.nexus-bar__owner-status-sig {
  color: var(--text-muted);
  font-style: italic;
}

.nexus-bar__owner-quote-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.nexus-bar__owner-quote {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
  margin: 0;
}

.nexus-bar__quote-refresh {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  border-radius: $radius-full;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: var(--interaction-cursor, pointer);
  opacity: 0;
  transition:
    opacity 0.2s ease,
    color 0.2s ease,
    transform 0.3s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  .nexus-bar__owner-quote-row:hover & {
    opacity: 1;
  }

  &:focus-visible {
    opacity: 1;
    color: var(--accent-text);
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
    border-radius: $radius-full;
  }

  &::before {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: $radius-full;
  }

  &:hover {
    color: var(--accent-text);
  }

  &:active {
    transform: rotate(180deg);
  }
}

.nexus-quote-swap-enter-active,
.nexus-quote-swap-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.nexus-quote-swap-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.nexus-quote-swap-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.nexus-bar__owner-socials {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.125rem;
}

.nexus-bar__social-link {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-soft);
  transition: color 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--accent-text);
  }
}
</style>
