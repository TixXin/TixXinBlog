<!--
  @file TabSettingsDrawer.vue
  @description 标签页设置抽屉：从右侧滑出，双栏布局，所有设置项实时生效 + 分组恢复默认
  @author TixXin
  @since 2026-04-12
-->

<template>
  <Teleport to="body">
    <div v-if="visible" class="tab-settings-backdrop" @click="close" />
    <Transition name="tab-settings-drawer">
      <aside v-if="visible" class="tab-settings-drawer" role="dialog" aria-label="标签页设置">
        <header class="tsd-header">
          <Icon name="lucide:settings" size="16" />
          <h2 class="tsd-header__title">设置</h2>
          <button type="button" class="tsd-header__close" aria-label="关闭" @click="close">
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
              <h3 class="tsd-section__title">个人信息</h3>
              <div class="tsd-row">
                <span class="tsd-row__label">用户名</span>
                <span class="tsd-row__value">{{ user?.nickname || '未登录' }}</span>
              </div>
              <div class="tsd-row">
                <span class="tsd-row__label">角色</span>
                <span class="tsd-row__value tsd-chip">{{ user?.role === 'owner' ? '博主' : '访客' }}</span>
              </div>
              <div class="tsd-row">
                <span class="tsd-row__label">邮箱</span>
                <span class="tsd-row__value">{{ user?.email || '—' }}</span>
              </div>
            </section>

            <!-- ==================== 布局 ==================== -->
            <section v-else-if="activeSection === 'layout'" class="tsd-section">
              <h3 class="tsd-section__title">布局</h3>
              <!-- 视图模式：四格缩略卡 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">视图模式</span>
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
                  <span class="tsd-row__label">列数</span>
                  <span class="tsd-row__val-badge">
                    {{ s.gridColumns === 'auto' ? '自适应' : `${s.gridColumns} 列` }}
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
                >
              </div>
              <!-- 图标间距 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">图标间距</span>
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
                >
              </div>
              <!-- 启用拖拽 -->
              <div class="tsd-row">
                <span class="tsd-row__label">启用拖拽排序</span>
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
                拖动书签卡片可在同分类内重新排序；拖到左侧分类按钮可跨分类移动。
              </p>
              <button type="button" class="tsd-reset" @click="resetSection('view')">
                <Icon name="lucide:rotate-ccw" size="12" />
                恢复默认
              </button>
            </section>

            <!-- ==================== 图标 ==================== -->
            <section v-else-if="activeSection === 'icon'" class="tsd-section">
              <h3 class="tsd-section__title">图标设置</h3>
              <!-- 图标风格 -->
              <div class="tsd-row">
                <span class="tsd-row__label">图标风格</span>
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
                  <span class="tsd-row__label">图标大小</span>
                  <span class="tsd-row__val-badge">{{ s.iconSize }}px</span>
                </div>
                <input type="range" class="tsd-range" :value="s.iconSize" min="32" max="80" step="2" @input="update('iconSize', +($event.target as HTMLInputElement).value)">
              </div>
              <!-- 图标圆角 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">图标圆角</span>
                  <span class="tsd-row__val-badge">{{ effectiveIconRadius }}px</span>
                </div>
                <input type="range" class="tsd-range" :value="s.iconRadius" min="0" :max="Math.floor(s.iconSize / 2)" step="1" :disabled="s.iconStyle === 'rounded'" @input="update('iconRadius', +($event.target as HTMLInputElement).value)">
              </div>
              <!-- 不透明度 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">不透明度</span>
                  <span class="tsd-row__val-badge">{{ Math.round(s.iconOpacity * 100) }}%</span>
                </div>
                <input type="range" class="tsd-range" :value="s.iconOpacity" min="0.2" max="1" step="0.05" @input="update('iconOpacity', +($event.target as HTMLInputElement).value)">
              </div>
              <!-- 图标间距 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">图标间距</span>
                  <span class="tsd-row__val-badge">{{ s.iconGap }}px</span>
                </div>
                <input type="range" class="tsd-range" :value="s.iconGap" min="0" max="32" step="2" @input="update('iconGap', +($event.target as HTMLInputElement).value)">
              </div>
              <!-- 显示图标名称 -->
              <div class="tsd-row">
                <span class="tsd-row__label">显示图标名称</span>
                <button type="button" class="tsd-toggle" :class="{ 'is-on': s.showIconName }" @click="update('showIconName', !s.showIconName)">
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <!-- 文字大小 -->
              <div class="tsd-row tsd-row--col" :class="{ 'tsd-row--disabled': !s.showIconName }">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">文字大小</span>
                  <span class="tsd-row__val-badge">{{ s.nameSize }}px</span>
                </div>
                <input type="range" class="tsd-range" :value="s.nameSize" min="10" max="18" step="1" :disabled="!s.showIconName" @input="update('nameSize', +($event.target as HTMLInputElement).value)">
              </div>
              <!-- 名称颜色 -->
              <div class="tsd-row" :class="{ 'tsd-row--disabled': !s.showIconName }">
                <span class="tsd-row__label">名称颜色</span>
                <div class="tsd-color-pick">
                  <input type="color" class="tsd-color-pick__input" :value="s.nameColor || '#888888'" :disabled="!s.showIconName" @input="update('nameColor', ($event.target as HTMLInputElement).value)">
                  <button v-if="s.nameColor" type="button" class="tsd-color-pick__clear" title="恢复默认颜色" @click="update('nameColor', '')">
                    <Icon name="lucide:x" size="10" />
                  </button>
                </div>
              </div>
              <!-- 区域最大宽度 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">区域最大宽度</span>
                  <span class="tsd-row__val-badge">
                    {{ s.gridMaxWidth }}{{ s.gridMaxWidthUnit }}
                    <button type="button" class="tsd-unit-toggle" @click="update('gridMaxWidthUnit', s.gridMaxWidthUnit === 'px' ? '%' : 'px')">
                      {{ s.gridMaxWidthUnit === 'px' ? '切换%' : '切换px' }}
                    </button>
                  </span>
                </div>
                <input type="range" class="tsd-range" :value="s.gridMaxWidth" :min="s.gridMaxWidthUnit === 'px' ? 400 : 40" :max="s.gridMaxWidthUnit === 'px' ? 2400 : 100" :step="s.gridMaxWidthUnit === 'px' ? 10 : 5" @input="update('gridMaxWidth', +($event.target as HTMLInputElement).value)">
              </div>
              <!-- 自动抓取 favicon -->
              <div class="tsd-row">
                <span class="tsd-row__label">自动抓取 favicon</span>
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
                <span class="tsd-row__label">favicon 源</span>
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
                恢复默认
              </button>
            </section>

            <!-- ==================== 时间 ==================== -->
            <section v-else-if="activeSection === 'time'" class="tsd-section">
              <h3 class="tsd-section__title">时间与问候</h3>
              <div class="tsd-row">
                <span class="tsd-row__label">显示问候语</span>
                <button type="button" class="tsd-toggle" :class="{ 'is-on': s.showGreeting }" @click="update('showGreeting', !s.showGreeting)">
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <div class="tsd-row">
                <span class="tsd-row__label">显示日期</span>
                <button type="button" class="tsd-toggle" :class="{ 'is-on': s.showDate }" @click="update('showDate', !s.showDate)">
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <div class="tsd-row" :class="{ 'tsd-row--disabled': !s.showDate }">
                <span class="tsd-row__label">显示秒数</span>
                <button type="button" class="tsd-toggle" :class="{ 'is-on': s.showSeconds }" :disabled="!s.showDate" @click="update('showSeconds', !s.showSeconds)">
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <button type="button" class="tsd-reset" @click="resetSection('time')">
                <Icon name="lucide:rotate-ccw" size="12" />
                恢复默认
              </button>
            </section>

            <!-- ==================== 主题/壁纸 ==================== -->
            <section v-else-if="activeSection === 'theme'" class="tsd-section">
              <h3 class="tsd-section__title">主题与壁纸</h3>

              <!-- 颜色模式 -->
              <div class="tsd-row">
                <span class="tsd-row__label">颜色模式</span>
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
                <span class="tsd-row__label">亮暗独立壁纸</span>
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
                <span class="tsd-row__label">编辑</span>
                <div class="tsd-options">
                  <button
                    type="button"
                    class="tsd-opt"
                    :class="{ 'tsd-opt--active': wallpaperEditing === 'light' }"
                    @click="wallpaperEditing = 'light'"
                  >
                    <Icon name="lucide:sun" size="12" />
                    <span>亮色</span>
                  </button>
                  <button
                    type="button"
                    class="tsd-opt"
                    :class="{ 'tsd-opt--active': wallpaperEditing === 'dark' }"
                    @click="wallpaperEditing = 'dark'"
                  >
                    <Icon name="lucide:moon" size="12" />
                    <span>暗色</span>
                  </button>
                </div>
              </div>

              <!-- 类型选择 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">壁纸类型</span>
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
                <span class="tsd-row__label">纯色</span>
                <input
                  type="color"
                  class="tsd-color-pick__input"
                  :value="currentWallpaper.solidColor || '#0f172a'"
                  @input="patchWallpaper({ solidColor: ($event.target as HTMLInputElement).value })"
                >
              </div>

              <!-- gradient -->
              <template v-if="currentWallpaper.kind === 'gradient'">
                <div class="tsd-row">
                  <span class="tsd-row__label">渐变起色</span>
                  <input
                    type="color"
                    class="tsd-color-pick__input"
                    :value="currentWallpaper.gradient?.from || '#1e3a8a'"
                    @input="patchGradient({ from: ($event.target as HTMLInputElement).value })"
                  >
                </div>
                <div class="tsd-row">
                  <span class="tsd-row__label">渐变终色</span>
                  <input
                    type="color"
                    class="tsd-color-pick__input"
                    :value="currentWallpaper.gradient?.to || '#7c3aed'"
                    @input="patchGradient({ to: ($event.target as HTMLInputElement).value })"
                  >
                </div>
                <div class="tsd-row tsd-row--col">
                  <div class="tsd-row__head">
                    <span class="tsd-row__label">渐变角度</span>
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
                  >
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
                    :title="wp.name"
                    :style="{ backgroundImage: `url(${wp.thumb})` }"
                    @click="patchWallpaper({ presetId: wp.id })"
                  >
                    <span class="tsd-wp-thumb__label">{{ wp.name }}</span>
                  </button>
                </div>
              </div>

              <!-- url -->
              <div v-if="currentWallpaper.kind === 'url'" class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">图片 URL</span>
                </div>
                <input
                  type="text"
                  class="tsd-text-input"
                  placeholder="https://..."
                  :value="currentWallpaper.url || ''"
                  @change="patchWallpaper({ url: ($event.target as HTMLInputElement).value })"
                >
              </div>

              <!-- upload -->
              <div v-if="currentWallpaper.kind === 'upload'" class="tsd-row tsd-row--col">
                <label class="tsd-wp-upload">
                  <input type="file" accept="image/*" @change="onWallpaperUpload">
                  <Icon name="lucide:upload" size="18" />
                  <span>选择本地壁纸（&lt; 5MB，存储在本地）</span>
                </label>
                <p v-if="uploadError" class="tsd-upload-error">
                  <Icon name="lucide:alert-circle" size="11" />
                  {{ uploadError }}
                </p>
              </div>

              <!-- 叠加层：遮罩/模糊/噪点/暗角 -->
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">遮罩不透明度</span>
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
                >
              </div>
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">模糊半径</span>
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
                >
              </div>
              <div class="tsd-row">
                <span class="tsd-row__label">噪点纹理</span>
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
                <span class="tsd-row__label">暗角</span>
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
                恢复默认
              </button>
            </section>

            <!-- ==================== 侧边栏 ==================== -->
            <section v-else-if="activeSection === 'sidebar'" class="tsd-section">
              <h3 class="tsd-section__title">侧边栏</h3>
              <div class="tsd-row">
                <span class="tsd-row__label">默认折叠</span>
                <button type="button" class="tsd-toggle" :class="{ 'is-on': s.defaultCollapsed }" @click="update('defaultCollapsed', !s.defaultCollapsed)">
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <div class="tsd-row">
                <span class="tsd-row__label">显示书签计数</span>
                <button type="button" class="tsd-toggle" :class="{ 'is-on': s.showCounts }" @click="update('showCounts', !s.showCounts)">
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">侧边栏圆角</span>
                  <span class="tsd-row__val-badge">{{ s.sidebarRadius }}px</span>
                </div>
                <input type="range" class="tsd-range" :value="s.sidebarRadius" min="0" max="24" step="1" @input="update('sidebarRadius', +($event.target as HTMLInputElement).value)">
              </div>
              <div class="tsd-row tsd-row--col">
                <div class="tsd-row__head">
                  <span class="tsd-row__label">背景不透明度</span>
                  <span class="tsd-row__val-badge">{{ Math.round(s.sidebarOpacity * 100) }}%</span>
                </div>
                <input type="range" class="tsd-range" :value="s.sidebarOpacity" min="0.3" max="1" step="0.05" @input="update('sidebarOpacity', +($event.target as HTMLInputElement).value)">
              </div>
              <div class="tsd-row">
                <span class="tsd-row__label">毛玻璃效果</span>
                <button type="button" class="tsd-toggle" :class="{ 'is-on': s.sidebarBlur }" @click="update('sidebarBlur', !s.sidebarBlur)">
                  <span class="tsd-toggle__thumb" />
                </button>
              </div>
              <button type="button" class="tsd-reset" @click="resetSection('sidebar')">
                <Icon name="lucide:rotate-ccw" size="12" />
                恢复默认
              </button>
            </section>

            <!-- ==================== 关于 ==================== -->
            <section v-else-if="activeSection === 'about'" class="tsd-section">
              <h3 class="tsd-section__title">关于</h3>
              <div class="tsd-row">
                <span class="tsd-row__label">版本</span>
                <span class="tsd-row__value tsd-row__value--mono">v1.0.0</span>
              </div>
              <div class="tsd-row">
                <span class="tsd-row__label">作者</span>
                <span class="tsd-row__value">TixXin</span>
              </div>
              <p class="tsd-about-text">
                标签页是 TixXin Blog 的一个实验功能，灵感来自浏览器新标签页管理工具。
                数据存储在浏览器本地，登录后可同步到云端（即将支持）。
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

defineProps<{
  user: CurrentUser | null
}>()

const visible = defineModel<boolean>('visible', { default: false })

const colorMode = useColorMode()
const { settings, update, resetSection } = useTabSettings()

/** 简写引用，模板中用 s.xxx */
const s = settings

const activeSection = ref('profile')

/** 圆形模式下圆角 = size/2 */
const effectiveIconRadius = computed(() =>
  s.value.iconStyle === 'rounded' ? Math.floor(s.value.iconSize / 2) : s.value.iconRadius,
)

const sections = [
  { id: 'profile', label: '个人信息', icon: 'lucide:user' },
  { id: 'layout', label: '布局', icon: 'lucide:layout-grid' },
  { id: 'icon', label: '图标', icon: 'lucide:image' },
  { id: 'time', label: '时间', icon: 'lucide:clock' },
  { id: 'theme', label: '主题/壁纸', icon: 'lucide:paintbrush' },
  { id: 'sidebar', label: '侧边栏', icon: 'lucide:panel-left' },
  { id: 'about', label: '关于', icon: 'lucide:info' },
] as const

const iconStyleOptions: { value: TabIconStyle; label: string; icon: string }[] = [
  { value: 'default', label: '默认', icon: 'lucide:square' },
  { value: 'rounded', label: '圆形', icon: 'lucide:circle' },
  { value: 'flat', label: '扁平', icon: 'lucide:minus' },
]

const viewModeOptions: { value: 'grid' | 'compact' | 'list' | 'cards'; label: string; icon: string; desc: string }[] = [
  { value: 'grid', label: '网格', icon: 'lucide:layout-grid', desc: '默认大图标 + 名称' },
  { value: 'compact', label: '紧凑', icon: 'lucide:grid-2x2', desc: '小图标密排' },
  { value: 'list', label: '列表', icon: 'lucide:list', desc: '横向行式含 URL' },
  { value: 'cards', label: '卡片', icon: 'lucide:square-stack', desc: '宽卡片含描述' },
]

const faviconProviderOptions: { value: FaviconProvider; label: string }[] = [
  { value: 'google', label: 'Google' },
  { value: 'duckduckgo', label: 'DuckDuckGo' },
  { value: 'icon-horse', label: 'Icon Horse' },
]

const wallpaperKinds: { value: WallpaperKind; label: string; icon: string }[] = [
  { value: 'none', label: '无', icon: 'lucide:ban' },
  { value: 'solid', label: '纯色', icon: 'lucide:square' },
  { value: 'gradient', label: '渐变', icon: 'lucide:paintbrush' },
  { value: 'preset', label: '图库', icon: 'lucide:image' },
  { value: 'url', label: 'URL', icon: 'lucide:link' },
  { value: 'upload', label: '上传', icon: 'lucide:upload' },
]

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
    uploadError.value = `图片过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请压缩至 5MB 以内。`
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
    uploadError.value = err instanceof Error ? err.message : '上传失败，请重试'
  }
  input.value = ''
}

const colorModeOptions = [
  { value: 'light', label: '亮色', icon: 'lucide:sun' },
  { value: 'dark', label: '暗色', icon: 'lucide:moon' },
  { value: 'system', label: '跟随', icon: 'lucide:monitor' },
]

function close() {
  visible.value = false
}

/** 列数滑块：0 表示自适应，1-10 表示固定列数 */
function onGridColumnsChange(v: string) {
  const n = Number(v)
  update('gridColumns', n === 0 ? 'auto' : n)
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
  color: var(--accent);
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
  cursor: pointer;

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
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }

  &--active {
    background: var(--accent-soft);
    color: var(--accent);
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
  color: var(--accent);
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
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  &--active {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent);
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
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: $radius-full;
    background: var(--accent);
    cursor: pointer;
    border: 2px solid var(--surface-1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: $radius-full;
    background: var(--accent);
    cursor: pointer;
    border: 2px solid var(--surface-1);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
  cursor: pointer;
  transition: background 0.2s;
  padding: 0;
  flex-shrink: 0;

  &.is-on {
    background: var(--accent);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
  cursor: pointer;

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
  cursor: pointer;

  &:hover {
    color: var(--accent);
  }
}

/* ---- Unit toggle ---- */
.tsd-unit-toggle {
  padding: 0.0625rem 0.25rem;
  border: 1px solid var(--border-soft);
  border-radius: 3px;
  background: transparent;
  color: var(--accent);
  font-size: 0.5625rem;
  cursor: pointer;

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
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
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
  cursor: pointer;
  overflow: hidden;
  transition: all 0.15s;

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
  cursor: pointer;
  text-align: center;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
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
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
  }

  &--active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }
}

.tsd-view-card__label {
  font-size: 0.6875rem;
  font-weight: 500;
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
