<!-- @file MomentFormNotices.vue @description 动态编辑表单的恢复提示：本机恢复副本与服务器上的新版本 -->
<template>
  <section v-if="recovery" class="moment-editor__recovery" :aria-label="$t('admin-content.momentForm.recoveryLabel')">
    <h2>{{ $t('admin-content.momentForm.recoveryTitle') }}</h2>
    <p>{{ recovery.form.content.slice(0, 160) }}</p>
    <button type="button" :disabled="saving" @click="emit('restore')">
      {{ $t('admin-content.momentForm.restore') }}
    </button>
    <button type="button" :disabled="saving" @click="emit('discard')">
      {{ $t('admin-content.momentForm.discard') }}
    </button>
  </section>
  <section
    v-if="serverVersion"
    class="moment-editor__recovery"
    :aria-label="$t('admin-content.momentForm.serverLabel')"
  >
    <h2>{{ $t('admin-content.momentForm.serverTitle', { revision: serverVersion.revision }) }}</h2>
    <p>
      {{ $t(`admin-content.momentForm.status.${serverVersion.status}`) }} ·
      {{ serverVersion.topics?.join($t('admin-content.momentForm.listSeparator')) }}
    </p>
    <blockquote>{{ serverVersion.content }}</blockquote>
    <button type="button" :disabled="saving" @click="emit('reload')">
      {{ $t('admin-content.momentForm.loadServer') }}
    </button>
  </section>
</template>
<script setup lang="ts">
import type { ManagedMoment } from '~/features/moment/types'
import type { MomentRecovery } from '~/features/moment/editor'

defineProps<{ recovery: MomentRecovery | null; serverVersion: ManagedMoment | null; saving: boolean }>()
const emit = defineEmits<{ restore: []; discard: []; reload: [] }>()
</script>
<style scoped lang="scss">
@use '~/assets/styles/moment-editor' as moment;

@include moment.form;
</style>
