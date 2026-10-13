<!-- @file Fields.vue @description 订阅管理与访客本地共享展示字段，媒体与公开设置仅向管理模式开放 -->
<template>
  <fieldset class="subscription-ui" :disabled="disabled">
    <div class="subscription-grid">
      <label
        >服务名称<input
          :value="value.name"
          required
          maxlength="160"
          aria-label="服务名称"
          @input="change('name', input($event))"
      /></label>
      <label
        >平台或供应商<input
          :value="value.platform ?? ''"
          maxlength="160"
          aria-label="平台或供应商"
          @input="change('platform', input($event) || null)"
      /></label>
    </div>
    <label
      >{{ managed ? '公开描述' : '描述'
      }}<textarea
        :value="value.description"
        maxlength="5000"
        rows="3"
        aria-label="订阅描述"
        @input="change('description', input($event))"
      />
    </label>
    <label
      >官网地址<input
        :value="value.url ?? ''"
        type="url"
        pattern="https?://.+"
        maxlength="2048"
        placeholder="https://"
        aria-label="官网地址"
        @input="change('url', input($event) || null)"
    /></label>
    <div class="subscription-grid">
      <label
        >分类<select
          :value="value.category"
          aria-label="订阅分类"
          @change="change('category', input($event) as SubscriptionForm['category'])"
        >
          <option v-for="(label, key) in categoryLabels" :key="key" :value="key">{{ label }}</option>
        </select></label
      >
      <label
        >币种<select
          :value="value.currency"
          aria-label="订阅币种"
          @change="change('currency', input($event) as SubscriptionForm['currency'])"
        >
          <option v-for="currency in currencyOptions" :key="currency" :value="currency">{{ currency }}</option>
        </select></label
      >
      <label
        >原始金额<input
          :value="value.amountInput"
          inputmode="decimal"
          required
          maxlength="40"
          aria-label="订阅金额"
          @input="change('amountInput', input($event))"
      /></label>
      <label
        >计费周期<select
          :value="value.billingCycle"
          aria-label="计费周期"
          @change="change('billingCycle', input($event) as SubscriptionForm['billingCycle'])"
        >
          <option v-for="(label, key) in cycleLabels" :key="key" :value="key">{{ label }}</option>
        </select></label
      >
    </div>
    <p class="subscription-note">
      按原币种记录，不换算汇率。JPY 只接受整数；其他币种最多两位小数。一次性和买断不计入持续费用。
    </p>
    <div class="subscription-grid">
      <label
        >订阅状态<select
          :value="value.subscriptionStatus"
          aria-label="订阅状态"
          @change="change('subscriptionStatus', input($event) as SubscriptionForm['subscriptionStatus'])"
        >
          <option v-for="(label, key) in stateLabels" :key="key" :value="key">{{ label }}</option>
        </select></label
      >
      <label
        >开始日期<input
          :value="value.startDate ?? ''"
          type="date"
          aria-label="开始日期"
          @input="change('startDate', input($event) || null)"
      /></label>
      <label
        >下次扣费日期<input
          :value="value.nextBillingDate ?? ''"
          type="date"
          :min="value.startDate ?? undefined"
          aria-label="下次扣费日期"
          @input="change('nextBillingDate', input($event) || null)"
      /></label>
    </div>
    <p class="subscription-note">日期未设置时不推测扣款；逾期日期保留原值。试用不假定结束后必然收费。</p>
    <label v-if="changed"
      >变价原因<textarea
        :value="value.priceChangeReason ?? ''"
        rows="2"
        maxlength="500"
        aria-label="变价原因"
        placeholder="可选，例如套餐调整"
        @input="change('priceChangeReason', input($event))"
      />
    </label>
    <p v-if="changed" class="subscription-note">保存后追加当前新价格快照；既有价格历史保持只读。</p>
    <label
      >{{ managed ? '管理备注（不公开）' : '私人备注（仅本机）'
      }}<textarea
        :value="value.notes"
        maxlength="5000"
        rows="3"
        aria-label="订阅备注"
        @input="change('notes', input($event))"
      />
    </label>
    <template v-if="managed">
      <section aria-label="订阅图标" class="subscription-stack">
        <div class="subscription-row">
          <h3>订阅图标</h3>
          <button type="button" @click="mediaOpen = true">选择或上传图标</button
          ><button v-if="value.iconMediaId" type="button" @click="change('iconMediaId', null)">移除受管图标</button
          ><button type="button" :disabled="!value.url || fetchingIcon" @click="$emit('favicon')">
            {{ fetchingIcon ? '正在获取图标…' : '获取官网图标' }}
          </button>
        </div>
        <img
          v-if="value.iconMediaId"
          class="subscription-icon-preview"
          :src="`/api/v1/media/${value.iconMediaId}.webp`"
          alt="手动选择的图标"
        />
        <img v-else-if="faviconUrl" class="subscription-icon-preview" :src="faviconUrl" alt="自动获取的官网图标" />
        <p class="subscription-note">手动受管图标优先于官网 favicon；获取失败使用默认图标，不影响保存。</p>
        <p v-if="iconMessage" role="status">{{ iconMessage }}</p>
      </section>
      <div class="subscription-grid">
        <label
          >发布状态<select
            :value="value.status"
            aria-label="订阅发布状态"
            @change="change('status', input($event) as SubscriptionForm['status'])"
          >
            <option v-for="(label, key) in publicationLabels" :key="key" :value="key">{{ label }}</option>
          </select></label
        >
        <label
          >排序值（越大越靠前）<input
            :value="value.sortOrder"
            type="number"
            min="-1000000"
            max="1000000"
            step="1"
            aria-label="订阅排序值"
            @input="change('sortOrder', Number(input($event)))"
        /></label>
      </div>
      <ClientOnly><AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" /></ClientOnly>
    </template>
  </fieldset>
</template>
<script setup lang="ts">
import {
  categoryLabels,
  cycleLabels,
  stateLabels,
  publicationLabels,
  currencyOptions,
} from '~/features/subscription/types'
import type { SubscriptionForm } from '~/features/subscription/types'
import type { MediaAsset } from '~/features/media/types'
defineProps<{
  value: SubscriptionForm
  managed?: boolean
  changed?: boolean
  disabled?: boolean
  fetchingIcon?: boolean
  faviconUrl?: string | null
  iconMessage?: string
}>()
const emit = defineEmits<{ change: [value: Partial<SubscriptionForm>]; favicon: [] }>()
const mediaOpen = ref(false)
const input = (event: Event) => (event.target as HTMLInputElement).value
function change<K extends keyof SubscriptionForm>(key: K, value: SubscriptionForm[K]) {
  emit('change', { [key]: value })
}
function selectMedia(asset: MediaAsset) {
  change('iconMediaId', asset.id)
}
</script>
<style scoped lang="scss">
@use '~/features/subscription/styles';
.subscription-icon-preview {
  width: 64px;
  height: 64px;
  object-fit: contain;
  border-radius: 0.5rem;
}
</style>
