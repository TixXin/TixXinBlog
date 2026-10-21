<!--
  @file TabSettingsTheme.vue
  @description 标签页设置抽屉 - 主题与壁纸设置分区
  @author TixXin
  @since 2026-10-21
-->

<template>
  <section class="tsd-section">
    <h3 class="tsd-section__title">{{ $t('misc.tab.settings.theme.title') }}</h3>

    <!-- 颜色模式 -->
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.theme.colorMode') }}</span>
      <div class="tsd-options">
        <button
          v-for="opt in colorModeOptions"
          :key="opt.value"
          type="button"
          class="tsd-opt"
          :class="{ 'tsd-opt--active': colorMode.preference === opt.value }"
          @click="colorMode.preference = opt.value"
        >
          <Icon :name="opt.icon" size="14" />
          <span>{{ opt.label }}</span>
        </button>
      </div>
    </div>

    <!-- 亮暗独立壁纸开关 -->
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.theme.independent') }}</span>
      <button
        type="button"
        class="tsd-toggle"
        :class="{ 'is-on': s.wallpaperIndependent }"
        @click="update('wallpaperIndependent', !s.wallpaperIndependent)"
      >
        <span class="tsd-toggle__thumb" />
      </button>
    </div>

    <!-- 当前编辑的配置目标 -->
    <div v-if="s.wallpaperIndependent" class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.theme.editing') }}</span>
      <div class="tsd-options">
        <button
          type="button"
          class="tsd-opt"
          :class="{ 'tsd-opt--active': wallpaperEditing === 'light' }"
          @click="wallpaperEditing = 'light'"
        >
          <Icon name="lucide:sun" size="12" />
          <span>{{ $t('misc.tab.settings.theme.light') }}</span>
        </button>
        <button
          type="button"
          class="tsd-opt"
          :class="{ 'tsd-opt--active': wallpaperEditing === 'dark' }"
          @click="wallpaperEditing = 'dark'"
        >
          <Icon name="lucide:moon" size="12" />
          <span>{{ $t('misc.tab.settings.theme.dark') }}</span>
        </button>
      </div>
    </div>

    <!-- 类型选择 -->
    <div class="tsd-row tsd-row--col">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.theme.kind') }}</span>
      </div>
      <div class="tsd-wp-kinds">
        <button
          v-for="kind in wallpaperKinds"
          :key="kind.value"
          type="button"
          class="tsd-opt tsd-wp-kind"
          :class="{ 'tsd-opt--active': currentWallpaper.kind === kind.value }"
          @click="onKindChange(kind.value)"
        >
          <Icon :name="kind.icon" size="12" />
          <span>{{ kind.label }}</span>
        </button>
      </div>
    </div>

    <!-- solid -->
    <div v-if="currentWallpaper.kind === 'solid'" class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.theme.solidColor') }}</span>
      <input
        type="color"
        class="tsd-color-pick__input"
        :value="currentWallpaper.solidColor || '#0f172a'"
        @input="patchWallpaper({ solidColor: ($event.target as HTMLInputElement).value })"
      />
    </div>

    <!-- gradient -->
    <template v-if="currentWallpaper.kind === 'gradient'">
      <div class="tsd-row">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.theme.gradientFrom') }}</span>
        <input
          type="color"
          class="tsd-color-pick__input"
          :value="currentWallpaper.gradient?.from || '#1e3a8a'"
          @input="patchGradient({ from: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="tsd-row">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.theme.gradientTo') }}</span>
        <input
          type="color"
          class="tsd-color-pick__input"
          :value="currentWallpaper.gradient?.to || '#7c3aed'"
          @input="patchGradient({ to: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="tsd-row tsd-row--col">
        <div class="tsd-row__head">
          <span class="tsd-row__label">{{ $t('misc.tab.settings.theme.gradientAngle') }}</span>
          <span class="tsd-row__val-badge">{{ currentWallpaper.gradient?.angle ?? 135 }}°</span>
        </div>
        <input
          type="range"
          class="tsd-range"
          :value="currentWallpaper.gradient?.angle ?? 135"
          min="0"
          max="360"
          step="5"
          @input="patchGradient({ angle: +($event.target as HTMLInputElement).value })"
        />
      </div>
    </template>

    <!-- preset 图库 -->
    <div v-if="currentWallpaper.kind === 'preset'" class="tsd-row tsd-row--col">
      <div class="tsd-wp-gallery">
        <button
          v-for="wp in builtinWallpapers"
          :key="wp.id"
          type="button"
          class="tsd-wp-thumb"
          :class="{ 'tsd-wp-thumb--active': currentWallpaper.presetId === wp.id }"
          :title="$t(wp.nameKey)"
          :style="{ backgroundImage: `url(${wp.thumb})` }"
          @click="patchWallpaper({ presetId: wp.id })"
        >
          <span class="tsd-wp-thumb__label">{{ $t(wp.nameKey) }}</span>
        </button>
      </div>
    </div>

    <!-- url -->
    <div v-if="currentWallpaper.kind === 'url'" class="tsd-row tsd-row--col">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.theme.imageUrl') }}</span>
      </div>
      <input
        type="text"
        class="tsd-text-input"
        placeholder="https://..."
        :value="currentWallpaper.url || ''"
        @change="patchWallpaper({ url: ($event.target as HTMLInputElement).value })"
      />
    </div>

    <!-- upload -->
    <div v-if="currentWallpaper.kind === 'upload'" class="tsd-row tsd-row--col">
      <label class="tsd-wp-upload">
        <input type="file" accept="image/*" @change="onWallpaperUpload" />
        <Icon name="lucide:upload" size="18" />
        <span>{{ $t('misc.tab.settings.theme.uploadHint') }}</span>
      </label>
      <p v-if="uploadError" class="tsd-upload-error">
        <Icon name="lucide:alert-circle" size="11" />
        {{ uploadError }}
      </p>
    </div>

    <!-- 叠加层：遮罩/模糊/噪点/暗角 -->
    <div class="tsd-row tsd-row--col">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.theme.maskOpacity') }}</span>
        <span class="tsd-row__val-badge">{{ Math.round(s.wallpaperMaskOpacity * 100) }}%</span>
      </div>
      <input
        type="range"
        class="tsd-range"
        :value="s.wallpaperMaskOpacity"
        min="0"
        max="0.8"
        step="0.05"
        @input="update('wallpaperMaskOpacity', +($event.target as HTMLInputElement).value)"
      />
    </div>
    <div class="tsd-row tsd-row--col">
      <div class="tsd-row__head">
        <span class="tsd-row__label">{{ $t('misc.tab.settings.theme.blur') }}</span>
        <span class="tsd-row__val-badge">{{ s.wallpaperBlur }}px</span>
      </div>
      <input
        type="range"
        class="tsd-range"
        :value="s.wallpaperBlur"
        min="0"
        max="24"
        step="1"
        @input="update('wallpaperBlur', +($event.target as HTMLInputElement).value)"
      />
    </div>
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.theme.noise') }}</span>
      <button
        type="button"
        class="tsd-toggle"
        :class="{ 'is-on': s.wallpaperNoise }"
        @click="update('wallpaperNoise', !s.wallpaperNoise)"
      >
        <span class="tsd-toggle__thumb" />
      </button>
    </div>
    <div class="tsd-row">
      <span class="tsd-row__label">{{ $t('misc.tab.settings.theme.vignette') }}</span>
      <button
        type="button"
        class="tsd-toggle"
        :class="{ 'is-on': s.wallpaperVignette }"
        @click="update('wallpaperVignette', !s.wallpaperVignette)"
      >
        <span class="tsd-toggle__thumb" />
      </button>
    </div>

    <button type="button" class="tsd-reset" @click="resetSection('wallpaper')">
      <Icon name="lucide:rotate-ccw" size="12" />
      {{ $t('misc.tab.settings.resetSection') }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { useTabSettings } from '~/composables/useTabSettings'
import { useTabWallpaperSettings } from '~/features/tab/useTabWallpaperSettings'
import { builtinWallpapers } from '~/features/tab/wallpapers'

const colorMode = useColorMode()
const { settings, update, resetSection } = useTabSettings()
const s = settings

const {
  wallpaperEditing,
  uploadError,
  colorModeOptions,
  wallpaperKinds,
  currentWallpaper,
  patchWallpaper,
  patchGradient,
  onKindChange,
  onWallpaperUpload,
} = useTabWallpaperSettings()
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-settings' as tsd;

@include tsd.styles;

/* ---- 壁纸类型按钮组 ---- */
.tsd-wp-kinds {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.25rem;
}

.tsd-wp-kind {
  justify-content: center;
}

/* ---- 内置壁纸缩略图网格 ---- */
.tsd-wp-gallery {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.375rem;
}

.tsd-wp-thumb {
  position: relative;
  aspect-ratio: 16 / 10;
  border: 2px solid var(--border-soft);
  border-radius: $radius-sm;
  background-size: cover;
  background-position: center;
  background-color: var(--surface-2);
  cursor: var(--interaction-cursor, pointer);
  overflow: hidden;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
  }

  &--active {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }
}

.tsd-wp-thumb__label {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0.125rem 0.375rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 500;
  text-align: left;
}

/* ---- 壁纸上传 ---- */
.tsd-wp-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 1rem;
  border: 2px dashed var(--border);
  border-radius: $radius-sm;
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 0.6875rem;
  cursor: var(--interaction-cursor, pointer);
  text-align: center;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    border-color: var(--accent);
    color: var(--accent-text);
    background: var(--accent-soft);
  }

  input[type='file'] {
    display: none;
  }
}

.tsd-upload-error {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0.375rem 0 0;
  padding: 0.375rem 0.5rem;
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  border-radius: $radius-sm;
  font-size: 0.6875rem;
}
</style>
