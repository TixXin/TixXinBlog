<!--
  @file AuthDevQuickFill.vue
  @description Dev 环境专用：登录表单悬浮快捷填入面板，列出 mock 测试账号一键填表+自动提交
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="auth-dev-fill" :class="{ 'is-open': isOpen }">
    <button
      ref="toggleRef"
      type="button"
      class="auth-dev-fill__toggle"
      :aria-label="isOpen ? '收起测试账号' : '展开测试账号'"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      <Icon name="lucide:wrench" size="11" />
      <span>DEV</span>
      <Icon name="lucide:chevron-down" size="11" class="auth-dev-fill__chevron" />
    </button>

    <Transition name="auth-dev-fill-pop">
      <div v-if="isOpen" ref="popRef" class="auth-dev-fill__list" role="menu">
        <div class="auth-dev-fill__hint">点击任意账号一键登录（仅 dev）</div>
        <button
          v-for="account in accounts"
          :key="account.email"
          type="button"
          class="auth-dev-fill__item"
          role="menuitem"
          @click="onPick(account)"
        >
          <span
            class="auth-dev-fill__role"
            :class="`auth-dev-fill__role--${account.user.role}`"
          >
            {{ account.user.role === 'owner' ? '博主' : '访客' }}
          </span>
          <div class="auth-dev-fill__cred">
            <div class="auth-dev-fill__email">{{ account.email }}</div>
            <div class="auth-dev-fill__password">{{ account.password }}</div>
          </div>
          <Icon name="lucide:log-in" size="13" class="auth-dev-fill__cta" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { mockAuthAccounts, type MockAuthAccount } from '~/features/auth/mock'

const accounts = mockAuthAccounts
const { fill } = useDevAuthFill()

const isOpen = ref(false)
const toggleRef = ref<HTMLElement | null>(null)
const popRef = ref<HTMLElement | null>(null)

function onPick(account: MockAuthAccount) {
  fill(account.email, account.password)
  isOpen.value = false
}

/** 点击外部收起 popup */
function onClickOutside(e: MouseEvent) {
  if (!isOpen.value) return
  const target = e.target as HTMLElement
  if (toggleRef.value?.contains(target)) return
  if (popRef.value?.contains(target)) return
  isOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<style lang="scss" scoped>
.auth-dev-fill {
  position: relative;
}

.auth-dev-fill__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px dashed var(--accent);
  border-radius: $radius-full;
  background: var(--accent-alpha-5, rgba(99, 102, 241, 0.06));
  color: var(--accent);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition:
    background 0.2s ease,
    transform 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    background: var(--accent-alpha-20, rgba(99, 102, 241, 0.18));
    transform: translateY(-1px);
  }

  .auth-dev-fill.is-open & {
    background: var(--accent-alpha-20, rgba(99, 102, 241, 0.18));
    border-style: solid;
  }
}

.auth-dev-fill__chevron {
  transition: transform 0.25s ease;

  .auth-dev-fill.is-open & {
    transform: rotate(180deg);
  }
}

.auth-dev-fill__list {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 30;
  min-width: 240px;
  padding: 0.5rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-md;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 2px 6px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.auth-dev-fill__hint {
  padding: 0.25rem 0.5rem 0.5rem;
  font-size: 0.6875rem;
  color: var(--text-soft);
  border-bottom: 1px dashed var(--border-soft);
  margin-bottom: 0.25rem;
}

.auth-dev-fill__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: none;
  background: transparent;
  border-radius: $radius-sm;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
  width: 100%;

  &:hover {
    background: var(--surface-2);
    transform: translateX(2px);

    .auth-dev-fill__cta {
      color: var(--accent);
      transform: translateX(2px);
    }
  }
}

.auth-dev-fill__role {
  flex-shrink: 0;
  padding: 0.125rem 0.5rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-radius: $radius-full;

  &--owner {
    background: rgba(99, 102, 241, 0.12);
    color: var(--accent);
  }

  &--visitor {
    background: rgba(34, 197, 94, 0.14);
    color: rgb(22, 163, 74);
  }
}

.auth-dev-fill__cred {
  flex: 1;
  min-width: 0;
}

.auth-dev-fill__email {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.auth-dev-fill__password {
  font-size: 0.625rem;
  color: var(--text-soft);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.auth-dev-fill__cta {
  flex-shrink: 0;
  color: var(--text-faint);
  transition:
    color 0.2s ease,
    transform 0.2s ease;
}

/* popup 进出动画 */
.auth-dev-fill-pop-enter-active,
.auth-dev-fill-pop-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.auth-dev-fill-pop-enter-from,
.auth-dev-fill-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
  transform-origin: top right;
}
</style>
