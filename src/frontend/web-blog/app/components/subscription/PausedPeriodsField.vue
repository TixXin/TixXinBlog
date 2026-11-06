<!-- @file PausedPeriodsField.vue @description 订阅暂停区间编辑：逐段填写开始与恢复日期，恢复日期留空表示仍在暂停 -->
<template>
  <section class="subscription-stack" :aria-label="$t('misc.subscription.fields.pausedPeriods')">
    <div class="subscription-row">
      <h3>{{ $t('misc.subscription.fields.pausedPeriods') }}</h3>
      <button type="button" :disabled="!canAdd" @click="add">
        <Icon name="lucide:plus" size="15" aria-hidden="true" />{{ $t('misc.subscription.fields.addPause') }}
      </button>
    </div>
    <ol v-if="periods.length" class="subscription-pauses">
      <li v-for="(period, index) in periods" :key="index" class="subscription-grid">
        <label
          >{{ $t('misc.subscription.fields.pauseFrom', { index: index + 1 })
          }}<CommonDatePicker
            :model-value="period.from"
            :min="minFrom(index)"
            :aria-label="$t('misc.subscription.fields.pauseFrom', { index: index + 1 })"
            @update:model-value="update(index, { from: $event })"
        /></label>
        <label
          >{{ $t('misc.subscription.fields.pauseTo', { index: index + 1 })
          }}<CommonDatePicker
            :model-value="period.to ?? ''"
            :min="period.from || undefined"
            :aria-label="$t('misc.subscription.fields.pauseTo', { index: index + 1 })"
            clearable
            @update:model-value="update(index, { to: $event || null })"
        /></label>
        <button
          type="button"
          class="subscription-pauses__remove"
          :aria-label="$t('misc.subscription.fields.removePause', { index: index + 1 })"
          @click="remove(index)"
        >
          <Icon name="lucide:x" size="15" aria-hidden="true" />
        </button>
      </li>
    </ol>
    <p class="subscription-note">{{ $t('misc.subscription.fields.pauseNote') }}</p>
  </section>
</template>
<script setup lang="ts">
import { MAX_PAUSED_PERIODS } from '@tixxin/subscription-domain'
import type { PausedPeriod } from '@tixxin/subscription-domain'

const props = defineProps<{ periods: PausedPeriod[]; startDate: string | null }>()
const emit = defineEmits<{ change: [periods: PausedPeriod[]] }>()
// 只有最后一段可以未结束：最后一段仍在暂停时不能再添加
const canAdd = computed(() => {
  const last = props.periods.at(-1)
  return props.periods.length < MAX_PAUSED_PERIODS && (!last || last.to !== null)
})
const minFrom = (index: number) =>
  index ? (props.periods[index - 1]?.to ?? undefined) : (props.startDate ?? undefined)
function add() {
  emit('change', [...props.periods, { from: props.periods.at(-1)?.to ?? props.startDate ?? '', to: null }])
}
function update(index: number, patch: Partial<PausedPeriod>) {
  emit(
    'change',
    props.periods.map((period, at) => (at === index ? { ...period, ...patch } : period)),
  )
}
function remove(index: number) {
  emit(
    'change',
    props.periods.filter((_, at) => at !== index),
  )
}
</script>
<style scoped lang="scss">
@use '~/features/subscription/styles';
h3 {
  margin: 0;
  font-size: 0.95rem;
}
.subscription-pauses {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  li {
    grid-template-columns: 1fr 1fr auto;
    align-items: end;
  }
}
.subscription-pauses__remove {
  align-self: end;
}
</style>
