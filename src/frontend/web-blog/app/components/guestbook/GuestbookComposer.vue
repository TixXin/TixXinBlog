<!--
  @file GuestbookComposer.vue
  @description 留言输入组件包装：统一传递表单配置与交互分派事件；静态发布形态不渲染
  @author TixXin
  @since 2026-10-21
-->

<template>
  <!-- 静态发布没有后端，留言只读展示，不渲染发送框 -->
  <GuestbookMessageInput
    v-if="!staticSite"
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

const staticSite = useStaticSite()

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
