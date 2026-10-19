<!--
  @file TabSettingsDrawer.vue
  @description 标签页设置抽屉：从右侧滑出，双栏布局，所有设置项实时生效 + 分组恢复默认
  @author TixXin
  @since 2026-04-12
-->

<template>
  <Teleport to="body">
    <div v-if="visible" ref="backdropRef" class="tab-settings-backdrop" @click="close" />
    <Transition name="tab-settings-drawer">
      <aside
        v-if="visible"
        ref="dialogRef"
        class="tab-settings-drawer"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('misc.tab.settings.dialogLabel')"
        tabindex="-1"
      >
        <header class="tsd-header">
          <Icon name="lucide:settings" size="16" />
          <h2 class="tsd-header__title">{{ $t('misc.tab.settings.title') }}</h2>
          <button type="button" class="tsd-header__close" :aria-label="$t('misc.tab.common.close')" @click="close">
            <Icon name="lucide:x" size="16" />
          </button>
        </header>

        <div class="tsd-body">
          <!-- 左列：导航 -->
          <nav class="tsd-nav">
            <button
              v-for="sec in sections"
              :key="sec.id"
              type="button"
              class="tsd-nav__item"
              :class="{ 'tsd-nav__item--active': activeSection === sec.id }"
              :aria-pressed="activeSection === sec.id"
              @click="activeSection = sec.id"
            >
              <Icon :name="sec.icon" size="14" />
              <span>{{ sec.label }}</span>
            </button>
          </nav>

          <!-- 右列：内容 -->
          <div class="tsd-content">
            <!-- ==================== 个人信息 ==================== -->
            <section v-if="activeSection === 'profile'" class="tsd-section">
              <h3 class="tsd-section__title">{{ $t('misc.tab.settings.profile.title') }}</h3>
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.profile.username') }}</span>
                <span class="tsd-row__value">{{ user?.nickname || $t('misc.tab.sidebar.notLoggedIn') }}</span>
              </div>
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.profile.role') }}</span>
                <span class="tsd-row__value tsd-chip">{{
                  user?.role === 'owner' ? $t('misc.tab.settings.profile.owner') : $t('misc.tab.settings.profile.guest')
                }}</span>
              </div>
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.profile.email') }}</span>
                <span class="tsd-row__value">{{ user?.email || '—' }}</span>
              </div>
            </section>

            <!-- ==================== 布局 ==================== -->
            <section v-else-if="activeSection === 'layout'" class="tsd-section">
              <h3 class="tsd-section__title">{{ $t('misc.tab.settings.layout.title') }}</h3>
              <!-- 视图模式：四格缩略卡 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">{{ $t('misc.tab.settings.layout.viewMode') }}</span>
                </div>
                <div class="tsd-view-grid">
                  <button
                    v-for="opt in viewModeOptions"
                    :key="opt.value"
                    type="button"
                    class="tsd-view-card"
                    :class="{ 'tsd-view-card--active': s.viewMode === opt.value }"
                    :title="opt.desc"
                    @click="update('viewMode', opt.value)"
                  >
                    <Icon :name="opt.icon" size="20" />
                    <span class="tsd-view-card__label">{{ opt.label }}</span>
                  </button>
                </div>
              </div>
              <!-- 列数（仅 grid/compact） -->
              <div
                class="tsd-row tsd-row--col"
                :class="{ 'tsd-row--disabled': s.viewMode !== 'grid' && s.viewMode !== 'compact' }"
              >
                <div class="tsd-row__head">
                  <span class="tsd-row__label">{{ $t('misc.tab.settings.layout.columns') }}</span>
                  <span class="tsd-row__val-badge">
                    {{
                      s.gridColumns === 'auto'
                        ? $t('misc.tab.settings.layout.columnsAuto')
                        : $t('misc.tab.settings.layout.columnsCount', { count: s.gridColumns }, s.gridColumns)
                    }}
                  </span>
                </div>
                <input
                  type="range"
                  class="tsd-range"
                  :value="s.gridColumns === 'auto' ? 0 : s.gridColumns"
                  min="0"
                  max="10"
                  step="1"
                  :disabled="s.viewMode !== 'grid' && s.viewMode !== 'compact'"
                  @input="onGridColumnsChange(($event.target as HTMLInputElement).value)"
                />
              </div>
              <!-- 图标间距 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.gap') }}</span>
                  <span class="tsd-row__val-badge">{{ s.iconGap }}px</span>
                </div>
                <input
                  type="range"
                  class="tsd-range"
                  :value="s.iconGap"
                  min="0"
                  max="32"
                  step="2"
                  @input="update('iconGap', +($event.target as HTMLInputElement).value)"
                />
              </div>
              <!-- 启用拖拽 -->
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.layout.dragEnabled') }}</span>
                <button
                  type="button"
                  class="tsd-toggle"
                  :class="{ 'is-on': s.dragEnabled }"
                  @click="update('dragEnabled', !s.dragEnabled)"
                >
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <p class="tsd-hint">
                <Icon name="lucide:info" size="11" />
                {{ $t('misc.tab.settings.layout.dragHint') }}
              </p>
              <button type="button" class="tsd-reset" @click="resetSection('view')">
                <Icon name="lucide:rotate-ccw" size="12" />
                {{ $t('misc.tab.settings.resetSection') }}
              </button>
            </section>

            <!-- ==================== 图标 ==================== -->
            <section v-else-if="activeSection === 'icon'" class="tsd-section">
              <h3 class="tsd-section__title">{{ $t('misc.tab.settings.icon.title') }}</h3>
              <!-- 图标风格 -->
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.style') }}</span>
                <div class="tsd-options">
                  <button
                    v-for="opt in iconStyleOptions"
                    :key="opt.value"
                    type="button"
                    class="tsd-opt"
                    :class="{ 'tsd-opt--active': s.iconStyle === opt.value }"
                    @click="update('iconStyle', opt.value)"
                  >
                    <Icon :name="opt.icon" size="14" />
                    <span>{{ opt.label }}</span>
                  </button>
                </div>
              </div>
              <!-- 图标大小 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.size') }}</span>
                  <span class="tsd-row__val-badge">{{ s.iconSize }}px</span>
                </div>
                <input
                  type="range"
                  class="tsd-range"
                  :value="s.iconSize"
                  min="32"
                  max="80"
                  step="2"
                  @input="update('iconSize', +($event.target as HTMLInputElement).value)"
                />
              </div>
              <!-- 图标圆角 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.radius') }}</span>
                  <span class="tsd-row__val-badge">{{ effectiveIconRadius }}px</span>
                </div>
                <input
                  type="range"
                  class="tsd-range"
                  :value="s.iconRadius"
                  min="0"
                  :max="Math.floor(s.iconSize / 2)"
                  step="1"
                  :disabled="s.iconStyle === 'rounded'"
                  @input="update('iconRadius', +($event.target as HTMLInputElement).value)"
                />
              </div>
              <!-- 不透明度 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.opacity') }}</span>
                  <span class="tsd-row__val-badge">{{ Math.round(s.iconOpacity * 100) }}%</span>
                </div>
                <input
                  type="range"
                  class="tsd-range"
                  :value="s.iconOpacity"
                  min="0.2"
                  max="1"
                  step="0.05"
                  @input="update('iconOpacity', +($event.target as HTMLInputElement).value)"
                />
              </div>
              <!-- 图标间距 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.gap') }}</span>
                  <span class="tsd-row__val-badge">{{ s.iconGap }}px</span>
                </div>
                <input
                  type="range"
                  class="tsd-range"
                  :value="s.iconGap"
                  min="0"
                  max="32"
                  step="2"
                  @input="update('iconGap', +($event.target as HTMLInputElement).value)"
                />
              </div>
              <!-- 显示图标名称 -->
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.showName') }}</span>
                <button
                  type="button"
                  class="tsd-toggle"
                  :class="{ 'is-on': s.showIconName }"
                  @click="update('showIconName', !s.showIconName)"
                >
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <!-- 文字大小 -->
              <div class="tsd-row tsd-row--col" :class="{ 'tsd-row--disabled': !s.showIconName }">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.nameSize') }}</span>
                  <span class="tsd-row__val-badge">{{ s.nameSize }}px</span>
                </div>
                <input
                  type="range"
                  class="tsd-range"
                  :value="s.nameSize"
                  min="10"
                  max="18"
                  step="1"
                  :disabled="!s.showIconName"
                  @input="update('nameSize', +($event.target as HTMLInputElement).value)"
                />
              </div>
              <!-- 名称颜色 -->
              <div class="tsd-row" :class="{ 'tsd-row--disabled': !s.showIconName }">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.nameColor') }}</span>
                <div class="tsd-color-pick">
                  <input
                    type="color"
                    class="tsd-color-pick__input"
                    :value="s.nameColor || '#888888'"
                    :disabled="!s.showIconName"
                    @input="update('nameColor', ($event.target as HTMLInputElement).value)"
                  />
                  <button
                    v-if="s.nameColor"
                    type="button"
                    class="tsd-color-pick__clear"
                    :title="$t('misc.tab.settings.icon.resetColor')"
                    @click="update('nameColor', '')"
                  >
                    <Icon name="lucide:x" size="10" />
                  </button>
                </div>
              </div>
              <!-- 区域最大宽度 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.maxWidth') }}</span>
                  <span class="tsd-row__val-badge">
                    {{ s.gridMaxWidth }}{{ s.gridMaxWidthUnit }}
                    <button
                      type="button"
                      class="tsd-unit-toggle"
                      @click="update('gridMaxWidthUnit', s.gridMaxWidthUnit === 'px' ? '%' : 'px')"
                    >
                      {{ $t('misc.tab.settings.icon.switchUnit', { unit: s.gridMaxWidthUnit === 'px' ? '%' : 'px' }) }}
                    </button>
                  </span>
                </div>
                <input
                  type="range"
                  class="tsd-range"
                  :value="s.gridMaxWidth"
                  :min="s.gridMaxWidthUnit === 'px' ? 400 : 40"
                  :max="s.gridMaxWidthUnit === 'px' ? 2400 : 100"
                  :step="s.gridMaxWidthUnit === 'px' ? 10 : 5"
                  @input="update('gridMaxWidth', +($event.target as HTMLInputElement).value)"
                />
              </div>
              <!-- 自动抓取 favicon -->
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.faviconAutoFetch') }}</span>
                <button
                  type="button"
                  class="tsd-toggle"
                  :class="{ 'is-on': s.faviconAutoFetch }"
                  @click="update('faviconAutoFetch', !s.faviconAutoFetch)"
                >
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <!-- favicon provider -->
              <div class="tsd-row" :class="{ 'tsd-row--disabled': !s.faviconAutoFetch }">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.icon.faviconProvider') }}</span>
                <div class="tsd-options">
                  <button
                    v-for="opt in faviconProviderOptions"
                    :key="opt.value"
                    type="button"
                    class="tsd-opt"
                    :class="{ 'tsd-opt--active': s.faviconProvider === opt.value }"
                    :disabled="!s.faviconAutoFetch"
                    @click="update('faviconProvider', opt.value)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>
              <button type="button" class="tsd-reset" @click="resetSection('icon')">
                <Icon name="lucide:rotate-ccw" size="12" />
                {{ $t('misc.tab.settings.resetSection') }}
              </button>
            </section>

            <!-- ==================== 时间 ==================== -->
            <section v-else-if="activeSection === 'time'" class="tsd-section">
              <h3 class="tsd-section__title">{{ $t('misc.tab.settings.time.title') }}</h3>
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.time.showGreeting') }}</span>
                <button
                  type="button"
                  class="tsd-toggle"
                  :class="{ 'is-on': s.showGreeting }"
                  @click="update('showGreeting', !s.showGreeting)"
                >
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.time.showDate') }}</span>
                <button
                  type="button"
                  class="tsd-toggle"
                  :class="{ 'is-on': s.showDate }"
                  @click="update('showDate', !s.showDate)"
                >
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <div class="tsd-row" :class="{ 'tsd-row--disabled': !s.showDate }">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.time.showSeconds') }}</span>
                <button
                  type="button"
                  class="tsd-toggle"
                  :class="{ 'is-on': s.showSeconds }"
                  :disabled="!s.showDate"
                  @click="update('showSeconds', !s.showSeconds)"
                >
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <button type="button" class="tsd-reset" @click="resetSection('time')">
                <Icon name="lucide:rotate-ccw" size="12" />
                {{ $t('misc.tab.settings.resetSection') }}
              </button>
            </section>

            <!-- ==================== 主题/壁纸 ==================== -->
            <section v-else-if="activeSection === 'theme'" class="tsd-section">
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

            <!-- ==================== 搜索 ==================== -->
            <section v-else-if="activeSection === 'search'" class="tsd-section">
              <h3 class="tsd-section__title">{{ $t('misc.tab.settings.search.title') }}</h3>
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">{{ $t('misc.tab.settings.search.engine') }}</span>
                </div>
                <div class="tsd-wp-kinds">
                  <button
                    v-for="opt in searchEngineOptions"
                    :key="opt.value"
                    type="button"
                    class="tsd-opt tsd-wp-kind"
                    :class="{ 'tsd-opt--active': s.searchEngine === opt.value }"
                    @click="update('searchEngine', opt.value)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>
              <div v-if="s.searchEngine === 'custom'" class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">{{ $t('misc.tab.settings.search.customUrl') }}</span>
                </div>
                <input
                  type="text"
                  class="tsd-text-input"
                  placeholder="https://example.com/search?q=%s"
                  :value="s.searchEngineCustomUrl"
                  @change="update('searchEngineCustomUrl', ($event.target as HTMLInputElement).value)"
                />
                <p class="tsd-hint">
                  <Icon name="lucide:info" size="11" />
                  <i18n-t keypath="misc.tab.settings.search.customUrlHint" scope="global">
                    <template #placeholder><code>%s</code></template>
                  </i18n-t>
                </p>
              </div>
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.search.palette') }}</span>
                <button
                  type="button"
                  class="tsd-toggle"
                  :class="{ 'is-on': s.commandPaletteEnabled }"
                  @click="update('commandPaletteEnabled', !s.commandPaletteEnabled)"
                >
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <p class="tsd-hint">
                <Icon name="lucide:keyboard" size="11" />
                {{ $t('misc.tab.settings.search.paletteHint') }}
              </p>
              <button type="button" class="tsd-reset" @click="resetSection('search')">
                <Icon name="lucide:rotate-ccw" size="12" />
                {{ $t('misc.tab.settings.resetSection') }}
              </button>
            </section>

            <!-- ==================== 侧边栏 ==================== -->
            <section v-else-if="activeSection === 'sidebar'" class="tsd-section">
              <h3 class="tsd-section__title">{{ $t('misc.tab.settings.sidebar.title') }}</h3>
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.sidebar.defaultCollapsed') }}</span>
                <button
                  type="button"
                  class="tsd-toggle"
                  :class="{ 'is-on': s.defaultCollapsed }"
                  @click="update('defaultCollapsed', !s.defaultCollapsed)"
                >
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.sidebar.showCounts') }}</span>
                <button
                  type="button"
                  class="tsd-toggle"
                  :class="{ 'is-on': s.showCounts }"
                  @click="update('showCounts', !s.showCounts)"
                >
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">{{ $t('misc.tab.settings.sidebar.radius') }}</span>
                  <span class="tsd-row__val-badge">{{ s.sidebarRadius }}px</span>
                </div>
                <input
                  type="range"
                  class="tsd-range"
                  :value="s.sidebarRadius"
                  min="0"
                  max="24"
                  step="1"
                  @input="update('sidebarRadius', +($event.target as HTMLInputElement).value)"
                />
              </div>
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">{{ $t('misc.tab.settings.sidebar.opacity') }}</span>
                  <span class="tsd-row__val-badge">{{ Math.round(s.sidebarOpacity * 100) }}%</span>
                </div>
                <input
                  type="range"
                  class="tsd-range"
                  :value="s.sidebarOpacity"
                  min="0.3"
                  max="1"
                  step="0.05"
                  @input="update('sidebarOpacity', +($event.target as HTMLInputElement).value)"
                />
              </div>
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.sidebar.blur') }}</span>
                <button
                  type="button"
                  class="tsd-toggle"
                  :class="{ 'is-on': s.sidebarBlur }"
                  @click="update('sidebarBlur', !s.sidebarBlur)"
                >
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <button type="button" class="tsd-reset" @click="resetSection('sidebar')">
                <Icon name="lucide:rotate-ccw" size="12" />
                {{ $t('misc.tab.settings.resetSection') }}
              </button>
            </section>

            <!-- ==================== 数据管理 ==================== -->
            <section v-else-if="activeSection === 'data'" class="tsd-section">
              <h3 class="tsd-section__title">{{ $t('misc.tab.settings.data.title') }}</h3>
              <p class="tsd-hint">
                <Icon name="lucide:info" size="11" />
                {{ $t('misc.tab.settings.data.hint') }}
              </p>
              <div class="tsd-data-actions">
                <button type="button" class="tsd-data-btn" @click="onExport">
                  <Icon name="lucide:download" size="14" />
                  <div>
                    <div class="tsd-data-btn__title">{{ $t('misc.tab.settings.data.export') }}</div>
                    <div class="tsd-data-btn__desc">{{ $t('misc.tab.settings.data.exportDesc') }}</div>
                  </div>
                </button>
                <button type="button" class="tsd-data-btn" @click="emit('openImport')">
                  <Icon name="lucide:upload" size="14" />
                  <div>
                    <div class="tsd-data-btn__title">{{ $t('misc.tab.settings.data.import') }}</div>
                    <div class="tsd-data-btn__desc">{{ $t('misc.tab.settings.data.importDesc') }}</div>
                  </div>
                </button>
                <button type="button" class="tsd-data-btn tsd-data-btn--danger" @click="onClearBookmarks">
                  <Icon name="lucide:trash-2" size="14" />
                  <div>
                    <div class="tsd-data-btn__title">{{ $t('misc.tab.settings.data.clear') }}</div>
                    <div class="tsd-data-btn__desc">{{ $t('misc.tab.settings.data.clearDesc') }}</div>
                  </div>
                </button>
                <button type="button" class="tsd-data-btn tsd-data-btn--danger" @click="onResetSettings">
                  <Icon name="lucide:rotate-ccw" size="14" />
                  <div>
                    <div class="tsd-data-btn__title">{{ $t('misc.tab.settings.data.reset') }}</div>
                    <div class="tsd-data-btn__desc">{{ $t('misc.tab.settings.data.resetDesc') }}</div>
                  </div>
                </button>
              </div>
            </section>

            <!-- ==================== 关于 ==================== -->
            <section v-else-if="activeSection === 'about'" class="tsd-section">
              <h3 class="tsd-section__title">{{ $t('misc.tab.settings.about.title') }}</h3>
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.about.version') }}</span>
                <span class="tsd-row__value tsd-row__value--mono">v1.0.0</span>
              </div>
              <div class="tsd-row">
                <span class="tsd-row__label">{{ $t('misc.tab.settings.about.author') }}</span>
                <span class="tsd-row__value">{{ ownerCard.name }}</span>
              </div>
              <p class="tsd-about-text">
                {{ $t('misc.tab.settings.about.text') }}
              </p>
            </section>
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { CurrentUser } from '~/features/auth/types'
import type { TabIconStyle, FaviconProvider, WallpaperKind, WallpaperConfig } from '~/composables/useTabSettings'
import { builtinWallpapers } from '~/features/tab/wallpapers'
import { idbSet, idbDel } from '~/utils/idbBlob'

// 关于卡片的署名沿用博主维护的站点资料，不在组件里写死
const { ownerCard } = useSiteInfo()

defineProps<{
  user: CurrentUser | null
}>()
const emit = defineEmits<{ openImport: [] }>()
const { t } = useI18n()

const visible = defineModel<boolean>('visible', { default: false })
const dialogRef = ref<HTMLElement | null>(null)
const backdropRef = ref<HTMLElement | null>(null)
useModalFocus(visible, dialogRef, { close, extra: () => [backdropRef.value] })

const colorMode = useColorMode()
const { settings, update, resetSection } = useTabSettings()

/** 简写引用，模板中用 s.xxx */
const s = settings

const activeSection = ref('profile')

/** 圆形模式下圆角 = size/2 */
const effectiveIconRadius = computed(() =>
  s.value.iconStyle === 'rounded' ? Math.floor(s.value.iconSize / 2) : s.value.iconRadius,
)

const sections = computed(() =>
  (
    [
      { id: 'profile', icon: 'lucide:user' },
      { id: 'layout', icon: 'lucide:layout-grid' },
      { id: 'icon', icon: 'lucide:image' },
      { id: 'time', icon: 'lucide:clock' },
      { id: 'theme', icon: 'lucide:paintbrush' },
      { id: 'search', icon: 'lucide:search' },
      { id: 'sidebar', icon: 'lucide:panel-left' },
      { id: 'data', icon: 'lucide:database' },
      { id: 'about', icon: 'lucide:info' },
    ] as const
  ).map((sec) => ({ ...sec, label: t(`misc.tab.settings.nav.${sec.id}`) })),
)

const searchEngineOptions = computed<{ value: 'google' | 'bing' | 'duckduckgo' | 'baidu' | 'custom'; label: string }[]>(
  () => [
    { value: 'google', label: 'Google' },
    { value: 'bing', label: 'Bing' },
    { value: 'duckduckgo', label: 'DuckDuckGo' },
    { value: 'baidu', label: t('misc.tab.search.engine.baidu') },
    { value: 'custom', label: t('misc.tab.settings.search.custom') },
  ],
)

const iconStyleOptions = computed<{ value: TabIconStyle; label: string; icon: string }[]>(() => [
  { value: 'default', label: t('misc.tab.settings.icon.styles.default'), icon: 'lucide:square' },
  { value: 'rounded', label: t('misc.tab.settings.icon.styles.rounded'), icon: 'lucide:circle' },
  { value: 'flat', label: t('misc.tab.settings.icon.styles.flat'), icon: 'lucide:minus' },
])

const viewModeOptions = computed(() =>
  (
    [
      { value: 'grid', icon: 'lucide:layout-grid' },
      { value: 'compact', icon: 'lucide:grid-2x2' },
      { value: 'list', icon: 'lucide:list' },
      { value: 'cards', icon: 'lucide:square-stack' },
    ] as const
  ).map((opt) => ({
    ...opt,
    label: t(`misc.tab.viewMode.${opt.value}`),
    desc: t(`misc.tab.settings.layout.viewModeDesc.${opt.value}`),
  })),
)

const faviconProviderOptions: { value: FaviconProvider; label: string }[] = [
  { value: 'google', label: 'Google' },
  { value: 'duckduckgo', label: 'DuckDuckGo' },
  { value: 'icon-horse', label: 'Icon Horse' },
]

const wallpaperKinds = computed<{ value: WallpaperKind; label: string; icon: string }[]>(() => [
  { value: 'none', label: t('misc.tab.settings.theme.kinds.none'), icon: 'lucide:ban' },
  { value: 'solid', label: t('misc.tab.settings.theme.kinds.solid'), icon: 'lucide:square' },
  { value: 'gradient', label: t('misc.tab.settings.theme.kinds.gradient'), icon: 'lucide:paintbrush' },
  { value: 'preset', label: t('misc.tab.settings.theme.kinds.preset'), icon: 'lucide:image' },
  { value: 'url', label: 'URL', icon: 'lucide:link' },
  { value: 'upload', label: t('misc.tab.settings.theme.kinds.upload'), icon: 'lucide:upload' },
])

/** 当前编辑哪一份壁纸配置（亮 / 暗）；联动模式下始终编辑 light */
const wallpaperEditing = ref<'light' | 'dark'>('light')

const currentWallpaper = computed<WallpaperConfig>(() => {
  if (s.value.wallpaperIndependent) {
    return wallpaperEditing.value === 'dark' ? s.value.wallpaperDark : s.value.wallpaperLight
  }
  return s.value.wallpaperLight
})

function writeWallpaper(next: WallpaperConfig) {
  if (s.value.wallpaperIndependent && wallpaperEditing.value === 'dark') {
    update('wallpaperDark', next)
  } else {
    update('wallpaperLight', next)
  }
}

function patchWallpaper(patch: Partial<WallpaperConfig>) {
  writeWallpaper({ ...currentWallpaper.value, ...patch })
}

function patchGradient(patch: Partial<NonNullable<WallpaperConfig['gradient']>>) {
  const current = currentWallpaper.value.gradient ?? { from: '#1e3a8a', to: '#7c3aed', angle: 135 }
  patchWallpaper({ gradient: { ...current, ...patch } })
}

function onKindChange(kind: WallpaperKind) {
  const next: WallpaperConfig = { ...currentWallpaper.value, kind }
  // 切换 kind 时为没填的字段填默认值
  if (kind === 'solid' && !next.solidColor) next.solidColor = '#0f172a'
  if (kind === 'gradient' && !next.gradient) {
    next.gradient = { from: '#1e3a8a', to: '#7c3aed', angle: 135 }
  }
  if (kind === 'preset' && !next.presetId) next.presetId = builtinWallpapers[0]!.id
  writeWallpaper(next)
}

const uploadError = ref('')

async function onWallpaperUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadError.value = ''
  if (file.size > 5 * 1024 * 1024) {
    uploadError.value = t('misc.tab.settings.theme.tooLarge', { size: (file.size / 1024 / 1024).toFixed(1) })
    input.value = ''
    return
  }
  try {
    // 清理旧上传（若存在）
    const prev = currentWallpaper.value.uploadKey
    if (prev) await idbDel(prev)
    const key = `wp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await idbSet(key, file)
    writeWallpaper({ ...currentWallpaper.value, kind: 'upload', uploadKey: key })
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : t('misc.tab.settings.theme.uploadFailed')
  }
  input.value = ''
}

const colorModeOptions = computed(() => [
  { value: 'light', label: t('misc.tab.settings.theme.light'), icon: 'lucide:sun' },
  { value: 'dark', label: t('misc.tab.settings.theme.dark'), icon: 'lucide:moon' },
  { value: 'system', label: t('misc.tab.settings.theme.system'), icon: 'lucide:monitor' },
])

function close() {
  visible.value = false
}

/** 列数滑块：0 表示自适应，1-10 表示固定列数 */
function onGridColumnsChange(v: string) {
  const n = Number(v)
  update('gridColumns', n === 0 ? 'auto' : n)
}

const { exportBulk, categories: allCategories, bookmarks: allBookmarks } = useTabBookmarks()
const { success, error: toastError } = useToast()

async function onExport() {
  try {
    const data = await exportBulk()
    const { buildExportJson, triggerDownload } = await import('~/features/tab/export')
    const payload = {
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      categories: data?.categories ?? allCategories.value,
      bookmarks: data?.bookmarks ?? allBookmarks.value,
      settings: settings.value,
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    triggerDownload(`tabs-${stamp}.json`, buildExportJson(payload))
    success(t('misc.tab.settings.data.exported'))
  } catch (err) {
    toastError(err instanceof Error ? err.message : t('misc.tab.settings.data.exportFailed'))
  }
}

function onClearBookmarks() {
  if (!window.confirm(t('misc.tab.settings.data.clearConfirm'))) return
  if (typeof window === 'undefined') return
  const prefixes = ['tab:categories:', 'tab:bookmarks:']
  const keysToDel: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && prefixes.some((p) => k.startsWith(p))) keysToDel.push(k)
  }
  keysToDel.forEach((k) => localStorage.removeItem(k))
  success(t('misc.tab.settings.data.cleared'))
}

function onResetSettings() {
  if (!window.confirm(t('misc.tab.settings.data.resetConfirm'))) return
  if (typeof window === 'undefined') return
  localStorage.removeItem('tab-settings')
  success(t('misc.tab.settings.data.resetDone'))
}
</script>

<style lang="scss" scoped>
/* ---- Backdrop ---- */
.tab-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 199;
}

/* ---- Drawer ---- */
.tab-settings-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  width: min(540px, 90vw);
  display: flex;
  flex-direction: column;
  background: var(--surface-1);
  border-left: 1px solid var(--border-soft);
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.12);
}

.tab-settings-drawer-enter-active,
.tab-settings-drawer-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.tab-settings-drawer-enter-from,
.tab-settings-drawer-leave-to {
  transform: translateX(100%);
}

/* ---- Header ---- */
.tsd-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border-soft);
  color: var(--accent-text);
  flex-shrink: 0;
}

.tsd-header__title {
  flex: 1;
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-main);
}

.tsd-header__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: transparent;
  border-radius: $radius-full;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
}

/* ---- Body ---- */
.tsd-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* 左列导航 */
.tsd-nav {
  width: 130px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.625rem 0.375rem;
  border-right: 1px solid var(--border-soft);
  overflow-y: auto;
}

.tsd-nav__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4375rem 0.5rem;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: var(--interaction-cursor, pointer);
  text-align: left;
  white-space: nowrap;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }

  &--active {
    background: var(--accent-soft);
    color: var(--accent-text);
    font-weight: 600;
  }
}

/* 右列内容 */
.tsd-content {
  flex: 1;
  padding: 1rem 1.25rem;
  overflow-y: auto;
}

.tsd-section {
  display: flex;
  flex-direction: column;
}

.tsd-section__title {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-main);
}

/* ---- 通用行 ---- */
.tsd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-soft);
  min-height: 2rem;

  &:last-of-type {
    border-bottom: none;
  }

  &--col {
    flex-direction: column;
    align-items: stretch;
    gap: 0.375rem;
  }

  &--disabled {
    opacity: 0.4;
    pointer-events: none;
  }
}

.tsd-row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tsd-row__label {
  font-size: 0.75rem;
  color: var(--text-main);
  font-weight: 500;
}

.tsd-row__value {
  font-size: 0.75rem;
  color: var(--text-soft);

  &--mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  &--muted {
    font-style: italic;
    color: var(--text-faint);
  }
}

.tsd-row__val-badge {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-soft);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.tsd-chip {
  padding: 0.0625rem 0.5rem;
  background: var(--accent-soft);
  color: var(--accent-text);
  border-radius: $radius-full;
  font-size: 0.625rem;
  font-weight: 600;
}

/* ---- 选项组 ---- */
.tsd-options {
  display: flex;
  gap: 0.25rem;
}

.tsd-opt {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3125rem 0.5rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.625rem;
  font-weight: 500;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    border-color: var(--accent);
    color: var(--accent-text);
  }

  &--active {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent-text);
    font-weight: 600;
  }
}

/* ---- Range slider ---- */
.tsd-range {
  width: 100%;
  height: 4px;
  appearance: none;
  background: var(--border);
  border-radius: 2px;
  outline: none;
  cursor: var(--interaction-cursor, pointer);

  &::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: $radius-full;
    background: var(--accent);
    cursor: var(--interaction-cursor, pointer);
    border: 2px solid var(--surface-1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: $radius-full;
    background: var(--accent);
    cursor: var(--interaction-cursor, pointer);
    border: 2px solid var(--surface-1);
  }

  &:disabled {
    opacity: 0.4;
    cursor: var(--interaction-cursor, not-allowed);
  }
}

/* ---- Toggle ---- */
.tsd-toggle {
  position: relative;
  width: 34px;
  height: 18px;
  border: none;
  border-radius: 9px;
  background: var(--border);
  cursor: var(--interaction-cursor, pointer);
  transition: background 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  padding: 0;
  flex-shrink: 0;

  &.is-on {
    background: var(--accent);
  }

  &:disabled {
    opacity: 0.4;
    cursor: var(--interaction-cursor, not-allowed);
  }
}

.tsd-toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: $radius-full;
  background: #fff;
  transition: transform 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);

  .is-on & {
    transform: translateX(16px);
  }
}

/* ---- Color picker ---- */
.tsd-color-pick {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.tsd-color-pick__input {
  width: 28px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--border-soft);
  border-radius: 3px;
  cursor: var(--interaction-cursor, pointer);

  &::-webkit-color-swatch-wrapper {
    padding: 1px;
  }

  &::-webkit-color-swatch {
    border: none;
    border-radius: 2px;
  }
}

.tsd-color-pick__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: $radius-full;
  background: var(--surface-2);
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);

  &:hover {
    color: var(--accent-text);
  }
}

/* ---- Unit toggle ---- */
.tsd-unit-toggle {
  padding: 0.0625rem 0.25rem;
  border: 1px solid var(--border-soft);
  border-radius: 3px;
  background: transparent;
  color: var(--accent-text);
  font-size: 0.5625rem;
  cursor: var(--interaction-cursor, pointer);

  &:hover {
    background: var(--accent-soft);
  }
}

/* ---- Reset button ---- */
.tsd-reset {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.25rem;
  margin-top: 0.75rem;
  padding: 0.3125rem 0.625rem;
  border: 1px dashed var(--border);
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.625rem;
  font-weight: 500;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    border-color: var(--accent);
    color: var(--accent-text);
    background: var(--accent-soft);
  }
}

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

/* ---- 文本输入 ---- */
.tsd-text-input {
  width: 100%;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-2);
  font-size: 0.75rem;
  color: var(--text-main);
  outline: none;

  &:focus {
    border-color: var(--accent);
  }
}

/* ---- 视图模式四格缩略卡 ---- */
.tsd-view-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.tsd-view-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 0.25rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
  background: transparent;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    border-color: var(--accent);
    color: var(--accent-text);
    background: var(--accent-soft);
  }

  &--active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-text);
    font-weight: 600;
  }
}

.tsd-view-card__label {
  font-size: 0.6875rem;
  font-weight: 500;
}

/* ---- 数据管理按钮 ---- */
.tsd-data-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.tsd-data-btn {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-2);
  color: var(--text-main);
  text-align: left;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-text);
  }

  &--danger:hover {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
    color: #ef4444;
  }
}

.tsd-data-btn__title {
  font-size: 0.8125rem;
  font-weight: 600;
}

.tsd-data-btn__desc {
  font-size: 0.6875rem;
  color: var(--text-soft);
  margin-top: 0.125rem;
}

.tsd-data-btn:hover .tsd-data-btn__desc,
.tsd-data-btn--danger:hover .tsd-data-btn__desc {
  color: inherit;
  opacity: 0.8;
}

/* ---- 提示文字 ---- */
.tsd-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  margin: 0.5rem 0 0;
  padding: 0.5rem 0.625rem;
  border-radius: $radius-sm;
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 0.6875rem;
  line-height: 1.5;
}

/* ---- About ---- */
.tsd-about-text {
  margin: 0.75rem 0 0;
  font-size: 0.6875rem;
  line-height: 1.7;
  color: var(--text-soft);
}
</style>
