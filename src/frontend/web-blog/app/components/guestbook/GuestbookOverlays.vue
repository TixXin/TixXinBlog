<!--
  @file GuestbookOverlays.vue
  @description 留言板全局浮层：游客身份弹窗与右侧侧栏概览挂载
  @author TixXin
  @since 2026-10-21
-->

<template>
  <CommonGuestIdentityModal
    :visible="identityVisible"
    @confirm="$emit('confirmIdentity', $event)"
    @cancel="$emit('cancelIdentity')"
    @login="$emit('login')"
  />
  <!-- ClientOnly 包裹关系保持原样；右栏概览由能力位门控组件决定是否挂载 -->
  <ClientOnly>
    <CommonThemeSidebarPortal>
      <SidebarRightSidebar>
        <GuestbookOverview
          :data="metadata"
          :pending="metadataPending"
          :error="metadataError || undefined"
          @retry="$emit('retryMetadata')"
        />
      </SidebarRightSidebar>
    </CommonThemeSidebarPortal>
  </ClientOnly>
</template>

<script setup lang="ts">
import type { GuestbookMetadata } from '~/features/guestbook/types'
import type { GuestIdentity } from '~/composables/useGuestIdentity'

defineProps<{
  identityVisible: boolean
  metadata: GuestbookMetadata | null
  metadataPending: boolean
  metadataError?: string | null
}>()

defineEmits<{
  confirmIdentity: [identity: GuestIdentity]
  cancelIdentity: []
  login: []
  retryMetadata: []
}>()
</script>
