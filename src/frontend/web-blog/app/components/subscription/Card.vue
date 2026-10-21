<!-- @file Card.vue @description 紧凑订阅行与完整详情抽屉，真实图标、原币金额及价格历史保持一致 -->
<template>
  <article class="subscription-ui subscription-list-item" :aria-label="item.name">
    <!-- 整行可点：按钮只包含名称（可见文字须是其可访问名的一部分），伪元素铺满整行承接点击 -->
    <div class="subscription-list-row">
      <span class="subscription-list-icon">
        <img
          v-if="icon && !imageFailed"
          ref="rowImage"
          :src="icon"
          :alt="$t('misc.subscription.card.iconAlt', { name: item.name })"
          width="44"
          height="44"
          loading="lazy"
          @error="imageFailed = true"
        />
        <Icon v-else name="lucide:credit-card" size="22" aria-hidden="true" />
      </span>
      <span class="subscription-list-identity">
        <button
          type="button"
          class="subscription-list-open"
          :aria-label="$t('misc.subscription.card.openLabel', { name: item.name })"
          aria-haspopup="dialog"
          :aria-expanded="open"
          :aria-describedby="`${rowId}-price ${rowId}-state ${rowId}-date`"
          :data-focus-key="`subscription-detail-${item.id}`"
          @click="showDetails"
        >
          <span class="subscription-list-name">{{ item.name }}</span>
        </button>
        <span class="subscription-list-category">{{ categoryLabel(item.category, t) }}</span>
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
          <span class="subscription-list-status__dot" aria-hidden="true" />
          <span
            >{{ stateLabel(item.subscriptionStatus, t)
            }}<small v-if="future"> · {{ $t('misc.subscription.card.future') }}</small></span
          >
        </span>
        <span
          :id="`${rowId}-date`"
          class="subscription-list-date"
          :class="{ 'subscription-list-date--overdue': overdue }"
        >
          <span>{{ item.nextBillingDate ?? $t('misc.subscription.card.billingDateUnset') }}</span>
          <span v-if="overdue" class="subscription-list-date-note">{{ $t('misc.subscription.card.overdue') }}</span>
          <span v-else-if="dueHint" class="subscription-list-date-note subscription-list-date-note--soon">{{
            dueHint
          }}</span>
        </span>
      </span>
      <Icon class="subscription-list-chevron" name="lucide:chevron-right" size="17" aria-hidden="true" />
    </div>

    <!-- 详情抽屉模态框 -->
    <CardDetailDialog
      :open="open"
      :item="item"
      :icon="icon"
      :image-failed="imageFailed"
      :cycle-suffix="cycleSuffix"
      :future="future"
      :overdue="overdue"
      :editable="editable"
      :local="local"
      :busy="busy"
      @close="open = false"
      @image-error="imageFailed = true"
      @edit="requestEdit"
      @remove="requestRemove"
    />
  </article>
</template>

<script setup lang="ts">
import { formatAmount } from '@tixxin/subscription-domain'
import { categoryLabel, cycleSuffix as cycleSuffixLabel, stateLabel } from '~/features/subscription/labels'
import type { SubscriptionItem } from '~/features/subscription/types'
import CardDetailDialog from './CardDetailDialog.vue'

const props = defineProps<{
  item: SubscriptionItem
  today: string
  editable?: boolean
  local?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{ edit: []; remove: [] }>()
const { t } = useI18n()
const rowId = useId()
const open = ref(false),
  rowImage = ref<HTMLImageElement | null>(null),
  imageFailed = ref(false),
  icon = computed(() => props.item.iconUrl || props.item.faviconUrl)
const future = computed(() => !!props.item.startDate && props.item.startDate > props.today),
  overdue = computed(() => !!props.item.nextBillingDate && props.item.nextBillingDate < props.today)
/** 7 天内的扣费给出相对提示；日期均为 YYYY-MM-DD，按 UTC 日计算差值避免时区偏移 */
const dueHint = computed(() => {
  const next = props.item.nextBillingDate
  if (!next || overdue.value) return ''
  const days = Math.round((Date.parse(`${next}T00:00:00Z`) - Date.parse(`${props.today}T00:00:00Z`)) / 86_400_000)
  if (!Number.isFinite(days) || days > 7) return ''
  return days === 0
    ? t('misc.subscription.card.dueToday')
    : days === 1
      ? t('misc.subscription.card.dueTomorrow')
      : t('misc.subscription.card.dueInDays', { days })
})
const cycleSuffix = computed(() => cycleSuffixLabel(props.item.billingCycle, t))
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
  position: relative;
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
  &:has(.subscription-list-open:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
}
.subscription-list-open {
  justify-self: start;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: var(--interaction-cursor, pointer);
  outline: none;
  // 铺满整行，点击行内任意位置都打开详情
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 0.5rem;
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
  &--active {
    color: var(--tag-emerald-text);
  }
}
// 实心圆点；图标组件以遮罩渲染，fill 不生效，改用纯 CSS
.subscription-list-status__dot {
  flex-shrink: 0;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: currentColor;
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
  &--soon {
    color: var(--accent-text);
    font-weight: 600;
  }
}
.subscription-list-chevron {
  justify-self: end;
  color: var(--text-muted);
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
@media (prefers-reduced-motion: reduce) {
  .subscription-ui .subscription-list-row {
    transition: none;
  }
}
</style>
