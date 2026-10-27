<!-- @file LinkApplicationItem.vue @description 单条友链申请：展示访客提交的文本与状态，通过、拒绝与编辑草稿由页面处理 -->
<template>
  <li :data-application-id="item.id" :class="{ 'is-focused': focused }" :aria-current="focused ? 'true' : undefined">
    <div class="link-application-item__head">
      <h2>{{ item.name }}</h2>
      <span class="admin-badge" :class="tone">{{ t(linkApplicationStatusKeys[item.status]) }}</span>
    </div>
    <p class="link-application-item__url">
      <a :href="item.url" target="_blank" rel="noopener noreferrer nofollow">{{ item.url }}</a>
    </p>
    <p v-if="item.description">{{ item.description }}</p>
    <dl>
      <template v-if="item.contact">
        <dt>{{ t('admin-media.linkApplications.contact') }}</dt>
        <dd>{{ item.contact }}</dd>
      </template>
      <template v-if="item.message">
        <dt>{{ t('admin-media.linkApplications.message') }}</dt>
        <dd class="link-application-item__message">{{ item.message }}</dd>
      </template>
      <dt>{{ t('admin-media.linkApplications.submittedAt') }}</dt>
      <dd>{{ formatDateTime(item.createdAt) }}</dd>
      <template v-if="item.handledAt">
        <dt>{{ t('admin-media.linkApplications.handledAt') }}</dt>
        <dd>{{ formatDateTime(item.handledAt) }}</dd>
      </template>
    </dl>
    <div class="link-application-item__actions">
      <template v-if="item.status === 'pending'">
        <button class="admin-btn admin-btn--primary" type="button" :disabled="disabled" @click="$emit('approve', item)">
          <Icon name="lucide:check" size="16" aria-hidden="true" />{{ t('admin-media.linkApplications.approve') }}
        </button>
        <button class="admin-btn admin-btn--danger" type="button" :disabled="disabled" @click="$emit('reject', item)">
          <Icon name="lucide:x" size="16" aria-hidden="true" />{{ t('admin-media.linkApplications.reject') }}
        </button>
      </template>
      <NuxtLink v-if="linkId" :to="`/admin/links/${linkId}`">{{
        t('admin-media.linkApplications.editDraft', { id: linkId })
      }}</NuxtLink>
    </div>
  </li>
</template>
<script setup lang="ts">
import type { LinkApplication } from '~/features/link/types'
import { linkApplicationStatusKeys } from '~/features/link/application'
const props = defineProps<{
  item: LinkApplication
  disabled: boolean
  focused: boolean
  /** 通过后生成的友链草稿编号，优先使用本次操作返回值 */
  linkId: number | null
}>()
defineEmits<{ approve: [item: LinkApplication]; reject: [item: LinkApplication] }>()
const { t } = useI18n()
const tone = computed(() =>
  props.item.status === 'approved' ? 'is-success' : props.item.status === 'pending' ? 'is-warning' : '',
)
</script>
<style scoped lang="scss">
li {
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--admin-card-border);
  border-radius: var(--admin-radius-card);
  background: var(--admin-card-bg);
  box-shadow: var(--admin-card-shadow);
  overflow-wrap: anywhere;

  &.is-focused {
    border-color: var(--accent);
  }
}
.link-application-item__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
h2 {
  font-size: 1rem;
  font-weight: 600;
}
p {
  color: var(--text-muted);
  margin-block: 0.5rem;
}
.link-application-item__url {
  font-size: 0.8125rem;
}
a {
  color: var(--accent);
}
dl {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.25rem 0.75rem;
  margin-block: 0.75rem;
  font-size: 0.8125rem;
}
dt {
  color: var(--text-soft);
}
dd {
  margin: 0;
  color: var(--text-main);
}
.link-application-item__message {
  white-space: pre-wrap;
}
.link-application-item__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
@media (max-width: 600px) {
  dl {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
