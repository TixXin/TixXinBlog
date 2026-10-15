<!-- @file Card.vue @description 紧凑订阅行与完整详情抽屉，真实图标、原币金额及价格历史保持一致 -->
<template>
  <article class="subscription-ui subscription-list-item" :aria-label="item.name">
    <button
      type="button"
      class="subscription-list-row"
      :aria-label="`查看${item.name}的订阅详情`"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-describedby="`${rowId}-price ${rowId}-state ${rowId}-date`"
      :data-focus-key="`subscription-detail-${item.id}`"
      @click="showDetails"
    >
      <span class="subscription-list-icon">
        <img
          v-if="icon && !imageFailed"
          ref="rowImage"
          :src="icon"
          :alt="`${item.name}图标`"
          width="44"
          height="44"
          loading="lazy"
          @error="imageFailed = true"
        />
        <Icon v-else name="lucide:credit-card" size="22" aria-hidden="true" />
      </span>
      <span class="subscription-list-identity">
        <span class="subscription-list-name">{{ item.name }}</span>
        <span class="subscription-list-category">{{ categoryLabels[item.category] }}</span>
      </span>
      <span :id="`${rowId}-price`" class="subscription-list-price">
        <strong>{{ formatAmount(item.amount, item.currency) }}</strong>
        <span>{{ cycleSuffix }}</span>
      </span>
      <span class="subscription-list-meta">
        <span
          :id="`${rowId}-state`"
          class="subscription-list-status"
          :class="`subscription-list-status--${item.subscriptionStatus}`"
        >
          <Icon name="lucide:circle" size="8" aria-hidden="true" />
          <span>{{ stateLabels[item.subscriptionStatus] }}<small v-if="future"> · 未来开始</small></span>
        </span>
        <span
          :id="`${rowId}-date`"
          class="subscription-list-date"
          :class="{ 'subscription-list-date--overdue': overdue }"
        >
          <span>{{ item.nextBillingDate ?? '扣费日期未设置' }}</span>
          <span v-if="overdue" class="subscription-list-date-note">已逾期，请核对</span>
        </span>
      </span>
      <Icon class="subscription-list-chevron" name="lucide:chevron-right" size="17" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <Transition name="subscription-detail">
        <div v-if="open" class="subscription-detail-overlay" @click.self="open = false">
          <section
            ref="dialog"
            class="subscription-ui subscription-detail-panel"
            role="dialog"
            aria-modal="true"
            :aria-label="`${item.name}订阅详情`"
            tabindex="-1"
          >
            <header class="subscription-detail-header">
              <span>{{ local ? '我的订阅 · 仅本机' : '平台订阅详情' }}</span>
              <button type="button" class="subscription-detail-close" aria-label="关闭订阅详情" @click="open = false">
                <Icon name="lucide:x" size="20" aria-hidden="true" />
              </button>
            </header>
            <div class="subscription-detail-body">
              <div class="subscription-detail-identity">
                <span class="subscription-list-icon">
                  <img
                    v-if="icon && !imageFailed"
                    :src="icon"
                    :alt="`${item.name}图标`"
                    width="44"
                    height="44"
                    @error="imageFailed = true"
                  />
                  <Icon v-else name="lucide:credit-card" size="22" aria-hidden="true" />
                </span>
                <div>
                  <p class="subscription-list-category">{{ categoryLabels[item.category] }}</p>
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
                  <dt>平台或供应商</dt>
                  <dd>{{ item.platform || '未填写' }}</dd>
                </div>
                <div>
                  <dt>订阅状态</dt>
                  <dd>{{ stateLabels[item.subscriptionStatus] }}{{ future ? ' · 未来开始' : '' }}</dd>
                </div>
                <div>
                  <dt>计费周期</dt>
                  <dd>{{ cycleLabels[item.billingCycle] }}</dd>
                </div>
                <div>
                  <dt>开始日期</dt>
                  <dd>{{ item.startDate ?? '未设置' }}</dd>
                </div>
                <div>
                  <dt>下次扣费</dt>
                  <dd :class="{ 'subscription-list-date--overdue': overdue }">
                    {{ item.nextBillingDate ?? '未设置' }}{{ overdue ? ' · 已逾期，请核对' : '' }}
                  </dd>
                </div>
                <div v-if="website">
                  <dt>服务官网</dt>
                  <dd>
                    <a :href="website" target="_blank" rel="noopener noreferrer">
                      访问官网 <Icon name="lucide:external-link" size="14" aria-hidden="true" />
                      <span class="sr-only">（在新标签页打开）</span>
                    </a>
                  </dd>
                </div>
              </dl>
              <SubscriptionHistory :history="item.priceHistory" />
              <footer v-if="editable || local" class="subscription-detail-actions">
                <button v-if="editable" type="button" :disabled="busy" @click="requestEdit">
                  <Icon name="lucide:pencil" size="15" aria-hidden="true" />编辑订阅
                </button>
                <button
                  v-if="local"
                  type="button"
                  class="subscription-detail-remove"
                  :disabled="busy"
                  @click="requestRemove"
                >
                  <Icon name="lucide:trash-2" size="15" aria-hidden="true" />删除订阅
                </button>
              </footer>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </article>
</template>
<script setup lang="ts">
import { formatAmount } from '@tixxin/subscription-domain'
import { categoryLabels, cycleLabels, stateLabels } from '~/features/subscription/types'
import type { SubscriptionItem } from '~/features/subscription/types'
import { safeSubscriptionUrl } from '~/features/subscription/local'
const props = defineProps<{
  item: SubscriptionItem
  today: string
  editable?: boolean
  local?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{ edit: []; remove: [] }>()
const rowId = useId()
const open = ref(false),
  dialog = ref<HTMLElement | null>(null),
  rowImage = ref<HTMLImageElement | null>(null),
  imageFailed = ref(false),
  icon = computed(() => props.item.iconUrl || props.item.faviconUrl)
const future = computed(() => !!props.item.startDate && props.item.startDate > props.today),
  overdue = computed(() => !!props.item.nextBillingDate && props.item.nextBillingDate < props.today)
const cycleSuffix = computed(
  () =>
    ({ monthly: '/ 月', quarterly: '/ 季', yearly: '/ 年', lifetime: '买断', 'one-time': '一次性' })[
      props.item.billingCycle
    ],
)
// 后端重新获取 favicon 后地址不变，新读取的记录仍应重试；图片错误本身不触发循环重载。
function checkLoadedImage() {
  const image = rowImage.value
  if (image?.complete && image.naturalWidth === 0) imageFailed.value = true
}
// SSR 图片可能在水合绑定事件前失败，补查缓存状态，避免保留破图。
onMounted(checkLoadedImage)
watch([icon, () => props.item], async () => {
  imageFailed.value = false
  await nextTick()
  checkLoadedImage()
})
const website = computed(() => {
  try {
    return safeSubscriptionUrl(props.item.url)
  } catch {
    return null
  }
})
// 与 ContextDrawer 共用焦点约束、Escape 关闭、背景隔离及关闭后的入口焦点归还。
useModalFocus(open, dialog, {
  close: () => {
    open.value = false
  },
  initialFocus: () => dialog.value?.querySelector<HTMLButtonElement>('.subscription-detail-close') ?? null,
})
function showDetails(event: MouseEvent) {
  ;(event.currentTarget as HTMLButtonElement).focus({ preventScroll: true })
  open.value = true
}
async function requestEdit() {
  if (!props.editable || props.busy) return
  open.value = false
  await nextTick()
  emit('edit')
}
async function requestRemove() {
  if (!props.local || props.busy) return
  open.value = false
  await nextTick()
  emit('remove')
}
</script>
<style scoped lang="scss">
@use '~/features/subscription/styles';
.subscription-list-item {
  container-type: inline-size;
  container-name: subscription-item;
  border-bottom: 1px solid var(--border);
}
.subscription-ui .subscription-list-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1.5fr) minmax(0, 1fr) minmax(5rem, 0.7fr) minmax(0, 1fr) 17px;
  align-items: center;
  gap: 1rem;
  width: 100%;
  min-height: 84px;
  padding: 1rem 0.25rem;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  text-align: left;
  transition: background-color 0.15s ease;
  &:hover {
    background: var(--accent-soft);
  }
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
}
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
.subscription-list-identity {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}
.subscription-list-name {
  color: var(--text-main);
  font-size: 1rem;
  font-weight: 650;
  line-height: 1.45;
}
.subscription-list-category {
  color: var(--text-muted);
  font-size: 0.875rem;
  line-height: 1.45;
}
.subscription-list-price {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem;
  font-size: 1rem;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  strong {
    font-weight: 600;
  }
  > span {
    color: var(--text-muted);
    font-size: 0.875rem;
  }
}
.subscription-list-meta {
  display: contents;
}
.subscription-list-status {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--text-muted);
  font-size: 0.875rem;
  :deep(svg) {
    fill: currentColor;
  }
  &--active {
    color: var(--tag-emerald-text);
  }
}
.subscription-list-date {
  display: grid;
  gap: 0.2rem;
  color: var(--text-muted);
  font-size: 0.875rem;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  &--overdue {
    color: var(--danger);
  }
}
.subscription-list-date-note {
  font-size: 0.72rem;
}
.subscription-list-chevron {
  justify-self: end;
  color: var(--text-muted);
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
@container subscription-item (max-width: 42rem) {
  .subscription-ui .subscription-list-row {
    grid-template-columns: 44px minmax(0, 1fr) 17px;
    grid-template-areas: 'icon identity chevron' 'icon price chevron' 'meta meta meta';
    column-gap: 0.75rem;
    row-gap: 0.35rem;
    padding: 1rem 0.25rem;
  }
  .subscription-list-icon {
    grid-area: icon;
    align-self: start;
  }
  .subscription-list-identity {
    grid-area: identity;
  }
  .subscription-list-price {
    grid-area: price;
  }
  .subscription-list-meta {
    grid-area: meta;
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 0.5rem;
  }
  .subscription-list-status {
    flex-shrink: 0;
  }
  .subscription-list-date {
    min-width: 0;
    text-align: right;
  }
  .subscription-list-chevron {
    grid-area: chevron;
  }
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
  .subscription-ui .subscription-list-row,
  .subscription-detail-enter-active,
  .subscription-detail-leave-active {
    transition: none;
  }
}
</style>
