<!--
  @file CardDetailDialog.vue
  @description 订阅详情模态抽屉，展示完整字段、价格历史及编辑与删除操作
  @author TixXin
  @since 2026-04-20
-->

<template>
  <Teleport to="body">
    <Transition name="subscription-detail">
      <div v-if="open" class="subscription-detail-overlay" @click.self="$emit('close')">
        <section
          ref="dialog"
          class="subscription-ui subscription-detail-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="$t('misc.subscription.card.dialogLabel', { name: item.name })"
          tabindex="-1"
        >
          <header class="subscription-detail-header">
            <span>{{
              local ? $t('misc.subscription.card.localHeading') : $t('misc.subscription.card.blogHeading')
            }}</span>
            <button
              type="button"
              class="subscription-detail-close"
              :aria-label="$t('misc.subscription.card.close')"
              @click="$emit('close')"
            >
              <Icon name="lucide:x" size="20" aria-hidden="true" />
            </button>
          </header>
          <div class="subscription-detail-body">
            <div class="subscription-detail-identity">
              <span class="subscription-list-icon">
                <img
                  v-if="icon && !imageFailed"
                  :src="icon"
                  :alt="$t('misc.subscription.card.iconAlt', { name: item.name })"
                  width="44"
                  height="44"
                  @error="$emit('image-error')"
                />
                <Icon v-else name="lucide:credit-card" size="22" aria-hidden="true" />
              </span>
              <div>
                <p class="subscription-list-category">{{ categoryLabel(item.category, t) }}</p>
                <h2>{{ item.name }}</h2>
              </div>
            </div>
            <p class="subscription-detail-price">
              <strong>{{ formatAmount(item.amount, item.currency) }}</strong>
              <span>{{ cycleSuffix }}</span>
            </p>
            <p v-if="item.description" class="subscription-detail-description">{{ item.description }}</p>
            <dl class="subscription-detail-facts">
              <div>
                <dt>{{ $t('misc.subscription.card.platform') }}</dt>
                <dd>{{ item.platform || $t('misc.subscription.card.notFilled') }}</dd>
              </div>
              <div>
                <dt>{{ $t('misc.subscription.card.status') }}</dt>
                <dd>
                  {{ stateLabel(item.subscriptionStatus, t)
                  }}{{ future ? ` · ${t('misc.subscription.card.future')}` : '' }}
                </dd>
              </div>
              <div>
                <dt>{{ $t('misc.subscription.card.cycle') }}</dt>
                <dd>{{ cycleLabel(item.billingCycle, t) }}</dd>
              </div>
              <div>
                <dt>{{ $t('misc.subscription.card.startDate') }}</dt>
                <dd>{{ item.startDate ?? $t('misc.subscription.card.unset') }}</dd>
              </div>
              <div>
                <dt>{{ $t('misc.subscription.card.nextBilling') }}</dt>
                <dd :class="{ 'subscription-list-date--overdue': overdue }">
                  {{ item.nextBillingDate ?? $t('misc.subscription.card.unset')
                  }}{{ overdue ? ` · ${t('misc.subscription.card.overdue')}` : '' }}
                </dd>
              </div>
              <div v-if="website">
                <dt>{{ $t('misc.subscription.card.website') }}</dt>
                <dd>
                  <a :href="website" target="_blank" rel="noopener noreferrer">
                    {{ $t('misc.subscription.card.visitWebsite') }}
                    <Icon name="lucide:external-link" size="14" aria-hidden="true" />
                    <span class="sr-only">{{ $t('misc.subscription.card.newTab') }}</span>
                  </a>
                </dd>
              </div>
            </dl>
            <SubscriptionHistory :history="item.priceHistory" />
            <footer v-if="editable || local" class="subscription-detail-actions">
              <button v-if="editable" type="button" :disabled="busy" @click="$emit('edit')">
                <Icon name="lucide:pencil" size="15" aria-hidden="true" />{{ $t('misc.subscription.card.edit') }}
              </button>
              <button
                v-if="local"
                type="button"
                class="subscription-detail-remove"
                :disabled="busy"
                @click="$emit('remove')"
              >
                <Icon name="lucide:trash-2" size="15" aria-hidden="true" />{{ $t('misc.subscription.card.remove') }}
              </button>
            </footer>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { formatAmount } from '@tixxin/subscription-domain'
import { categoryLabel, cycleLabel, stateLabel } from '~/features/subscription/labels'
import type { SubscriptionItem } from '~/features/subscription/types'
import { safeSubscriptionUrl } from '~/features/subscription/local'

const props = defineProps<{
  open: boolean
  item: SubscriptionItem
  icon: string | null
  imageFailed: boolean
  cycleSuffix: string
  future: boolean
  overdue: boolean
  editable?: boolean
  local?: boolean
  busy?: boolean
}>()

const emit = defineEmits<{
  close: []
  'image-error': []
  edit: []
  remove: []
}>()

const { t } = useI18n()
const dialog = ref<HTMLElement | null>(null)

const website = computed(() => {
  try {
    return safeSubscriptionUrl(props.item.url)
  } catch {
    return null
  }
})

// 与 ContextDrawer 共用焦点约束、Escape 关闭、背景隔离及关闭后的入口焦点归还。
useModalFocus(() => props.open, dialog, {
  close: () => {
    emit('close')
  },
  initialFocus: () => dialog.value?.querySelector<HTMLButtonElement>('.subscription-detail-close') ?? null,
})
</script>

<style scoped lang="scss">
@use '~/features/subscription/styles';
.subscription-list-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 0.8rem;
  background: var(--surface-2);
  color: var(--text-muted);
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}
.subscription-list-category {
  color: var(--text-muted);
  font-size: 0.875rem;
  line-height: 1.45;
}
.subscription-list-date--overdue {
  color: var(--danger);
}
.subscription-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  justify-content: flex-end;
  background: var(--overlay-bg);
}
.subscription-detail-panel {
  display: flex;
  flex-direction: column;
  width: min(34rem, 100%);
  max-height: 100dvh;
  background: var(--surface-1);
  color: var(--text-main);
  box-shadow: var(--shadow-card);
  padding-bottom: env(safe-area-inset-bottom);
}
.subscription-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 64px;
  padding: 0.5rem 1.25rem;
  border-bottom: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.8125rem;
  flex-shrink: 0;
}
.subscription-ui .subscription-detail-close {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
}
.subscription-detail-body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 1.5rem;
}
.subscription-detail-identity {
  display: flex;
  align-items: center;
  gap: 1rem;
  > div {
    min-width: 0;
  }
  h2 {
    margin: 0.2rem 0 0;
    font-size: 1.35rem;
    line-height: 1.4;
  }
}
.subscription-ui .subscription-detail-price {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.6rem;
  margin-block: 1.5rem;
  color: var(--text-main);
  font-variant-numeric: tabular-nums;
  strong {
    font-size: clamp(1.5rem, 5vw, 2.25rem);
    font-weight: 650;
    line-height: 1.2;
  }
  > span {
    color: var(--text-muted);
    font-size: 0.875rem;
  }
}
.subscription-detail-description {
  white-space: pre-wrap;
  font-size: 0.875rem;
}
.subscription-detail-facts {
  display: grid;
  gap: 1rem;
  margin-block: 1.5rem;
  > div {
    display: grid;
    grid-template-columns: minmax(6rem, 0.7fr) minmax(0, 1.3fr);
    gap: 1rem;
  }
  dt {
    color: var(--text-muted);
    font-size: 0.8125rem;
  }
  dd {
    margin: 0;
    font-size: 0.875rem;
  }
  a {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 44px;
    margin-top: -0.75rem;
    margin-bottom: -0.75rem;
  }
}
.subscription-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 44px;
  }
  .subscription-detail-remove {
    color: var(--danger);
  }
}
.subscription-detail-enter-active,
.subscription-detail-leave-active {
  transition: opacity 0.15s ease;
}
.subscription-detail-enter-from,
.subscription-detail-leave-to {
  opacity: 0;
}
@media (max-width: 420px) {
  .subscription-detail-header {
    padding-inline: 1rem;
  }
  .subscription-detail-body {
    padding: 1.25rem 1rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .subscription-detail-enter-active,
  .subscription-detail-leave-active {
    transition: none;
  }
}
</style>
