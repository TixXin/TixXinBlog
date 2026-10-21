<!--
  @file GuestbookComposer.vue
  @description 留言输入组件包装：统一传递表单配置与交互分派事件
  @author TixXin
  @since 2026-10-21
-->

<template>
  <GuestbookMessageInput
    v-bind="composerProps"
    @update:draft="interactions.setDraft"
    @send="interactions.submit"
    @cancel-reply="interactions.setReply(null)"
    @restore="interactions.restore"
    @discard="interactions.discardRecovery"
    @login="interactions.openLogin"
  />
</template>

<script setup lang="ts">
import type { useGuestbookInteractions } from '~/composables/useGuestbookInteractions'
import type { ReplyRef } from '~/features/guestbook/types'

defineProps<{
  composerProps: {
    draft: string
    replyTo?: ReplyRef | null
    ready: boolean
    expired?: boolean
    submitting: boolean
    error?: string
    notice?: string
    storageError?: string
    hasRecovery?: boolean
    identityLabel: string
    replyPlacement: 'above' | 'below'
  }
  interactions: ReturnType<typeof useGuestbookInteractions>
}>()
</script>
