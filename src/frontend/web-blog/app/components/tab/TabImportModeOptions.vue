<!--
  @file TabImportModeOptions.vue
  @description 书签导入策略单选：合并、追加或覆盖，名称与说明见字典 misc.tab.import.modes.*
  @author TixXin
  @since 2026-10-27
-->

<template>
  <div class="tid-mode">
    <span class="tid-mode__label">{{ $t('misc.tab.import.mode') }}</span>
    <div class="tid-mode__options">
      <label v-for="opt in modeOptions" :key="opt" class="tid-mode__opt">
        <input v-model="mode" type="radio" :value="opt" />
        <div>
          <div class="tid-mode__opt-title">{{ $t(`misc.tab.import.modes.${opt}.label`) }}</div>
          <div class="tid-mode__opt-desc">{{ $t(`misc.tab.import.modes.${opt}.desc`) }}</div>
        </div>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ImportMode } from '~/features/tab/types'

const mode = defineModel<ImportMode>({ required: true })

/** 导入策略；名称与说明见字典 misc.tab.import.modes.* */
const modeOptions: ImportMode[] = ['merge', 'append', 'replace']
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-import-dialog' as importDialog;

@include importDialog.dialog;
</style>
