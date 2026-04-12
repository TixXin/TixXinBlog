<!--
  @file TabSettingsDrawer.vue
  @description 标签页设置抽屉：从右侧滑出，双栏布局，包含个人信息、时间、主题等设置
  @author TixXin
  @since 2026-04-12
-->

<template>
  <Teleport to="body">
    <!-- 遮罩 -->
    <Transition name="tab-settings-overlay">
      <div v-if="visible" class="tab-settings-overlay" @click="close" />
    </Transition>

    <!-- 抽屉 -->
    <Transition name="tab-settings-drawer">
      <aside v-if="visible" class="tab-settings-drawer" role="dialog" aria-label="标签页设置">
        <header class="tab-settings-drawer__header">
          <Icon name="lucide:settings" size="16" />
          <h2 class="tab-settings-drawer__title">设置</h2>
          <button type="button" class="tab-settings-drawer__close" aria-label="关闭" @click="close">
            <Icon name="lucide:x" size="16" />
          </button>
        </header>

        <div class="tab-settings-drawer__body">
          <!-- 左列：导航菜单 -->
          <nav class="tab-settings-nav">
            <button
              v-for="section in sections"
              :key="section.id"
              type="button"
              class="tab-settings-nav__item"
              :class="{ 'tab-settings-nav__item--active': activeSection === section.id }"
              @click="activeSection = section.id"
            >
              <Icon :name="section.icon" size="14" />
              <span>{{ section.label }}</span>
            </button>
          </nav>

          <!-- 右列：设置内容 -->
          <div class="tab-settings-content">
            <!-- 个人信息 -->
            <section v-if="activeSection === 'profile'" class="tab-settings-section">
              <h3 class="tab-settings-section__title">个人信息</h3>
              <div class="tab-settings-field">
                <label class="tab-settings-field__label">用户名</label>
                <span class="tab-settings-field__value">{{ user?.nickname || '未登录' }}</span>
              </div>
              <div class="tab-settings-field">
                <label class="tab-settings-field__label">角色</label>
                <span class="tab-settings-field__value tab-settings-field__value--chip">
                  {{ user?.role === 'owner' ? '博主' : '访客' }}
                </span>
              </div>
              <div class="tab-settings-field">
                <label class="tab-settings-field__label">邮箱</label>
                <span class="tab-settings-field__value">{{ user?.email || '—' }}</span>
              </div>
            </section>

            <!-- 图标 -->
            <section v-else-if="activeSection === 'icon'" class="tab-settings-section">
              <h3 class="tab-settings-section__title">图标设置</h3>
              <div class="tab-settings-field">
                <label class="tab-settings-field__label">书签图标风格</label>
                <div class="tab-settings-options">
                  <button
                    v-for="opt in iconStyleOptions"
                    :key="opt.value"
                    type="button"
                    class="tab-settings-option"
                    :class="{ 'tab-settings-option--active': iconStyle === opt.value }"
                    @click="iconStyle = opt.value"
                  >
                    <Icon :name="opt.icon" size="16" />
                    <span>{{ opt.label }}</span>
                  </button>
                </div>
              </div>
            </section>

            <!-- 时间 -->
            <section v-else-if="activeSection === 'time'" class="tab-settings-section">
              <h3 class="tab-settings-section__title">时间与问候</h3>
              <div class="tab-settings-field">
                <label class="tab-settings-field__label">显示问候语</label>
                <button type="button" class="tab-settings-toggle" :class="{ 'is-on': showGreeting }" @click="showGreeting = !showGreeting">
                  <span class="tab-settings-toggle__thumb" />
                </button>
              </div>
              <div class="tab-settings-field">
                <label class="tab-settings-field__label">显示日期</label>
                <button type="button" class="tab-settings-toggle" :class="{ 'is-on': showDate }" @click="showDate = !showDate">
                  <span class="tab-settings-toggle__thumb" />
                </button>
              </div>
            </section>

            <!-- 主题/壁纸 -->
            <section v-else-if="activeSection === 'theme'" class="tab-settings-section">
              <h3 class="tab-settings-section__title">主题与壁纸</h3>
              <div class="tab-settings-field">
                <label class="tab-settings-field__label">颜色模式</label>
                <div class="tab-settings-options">
                  <button
                    v-for="opt in colorModeOptions"
                    :key="opt.value"
                    type="button"
                    class="tab-settings-option"
                    :class="{ 'tab-settings-option--active': colorMode.preference === opt.value }"
                    @click="colorMode.preference = opt.value"
                  >
                    <Icon :name="opt.icon" size="14" />
                    <span>{{ opt.label }}</span>
                  </button>
                </div>
              </div>
              <div class="tab-settings-field">
                <label class="tab-settings-field__label">壁纸</label>
                <span class="tab-settings-field__value tab-settings-field__value--muted">即将支持</span>
              </div>
            </section>

            <!-- 侧边栏 -->
            <section v-else-if="activeSection === 'sidebar'" class="tab-settings-section">
              <h3 class="tab-settings-section__title">侧边栏</h3>
              <div class="tab-settings-field">
                <label class="tab-settings-field__label">默认折叠</label>
                <button type="button" class="tab-settings-toggle" :class="{ 'is-on': defaultCollapsed }" @click="defaultCollapsed = !defaultCollapsed">
                  <span class="tab-settings-toggle__thumb" />
                </button>
              </div>
              <div class="tab-settings-field">
                <label class="tab-settings-field__label">显示书签计数</label>
                <button type="button" class="tab-settings-toggle" :class="{ 'is-on': showCounts }" @click="showCounts = !showCounts">
                  <span class="tab-settings-toggle__thumb" />
                </button>
              </div>
            </section>

            <!-- 关于 -->
            <section v-else-if="activeSection === 'about'" class="tab-settings-section">
              <h3 class="tab-settings-section__title">关于</h3>
              <div class="tab-settings-field">
                <label class="tab-settings-field__label">版本</label>
                <span class="tab-settings-field__value tab-settings-field__value--mono">v1.0.0</span>
              </div>
              <div class="tab-settings-field">
                <label class="tab-settings-field__label">作者</label>
                <span class="tab-settings-field__value">TixXin</span>
              </div>
              <p class="tab-settings-about-text">
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

defineProps<{
  user: CurrentUser | null
}>()

const visible = defineModel<boolean>('visible', { default: false })

const colorMode = useColorMode()

const activeSection = ref('profile')

// 设置项本地状态（后续可持久化到 localStorage）
const iconStyle = ref('default')
const showGreeting = ref(true)
const showDate = ref(true)
const defaultCollapsed = ref(false)
const showCounts = ref(true)

const sections = [
  { id: 'profile', label: '个人信息', icon: 'lucide:user' },
  { id: 'icon', label: '图标', icon: 'lucide:image' },
  { id: 'time', label: '时间', icon: 'lucide:clock' },
  { id: 'theme', label: '主题/壁纸', icon: 'lucide:paintbrush' },
  { id: 'sidebar', label: '侧边栏', icon: 'lucide:panel-left' },
  { id: 'about', label: '关于', icon: 'lucide:info' },
] as const

const iconStyleOptions = [
  { value: 'default', label: '默认', icon: 'lucide:square' },
  { value: 'rounded', label: '圆角', icon: 'lucide:circle' },
  { value: 'flat', label: '扁平', icon: 'lucide:minus' },
]

const colorModeOptions = [
  { value: 'light', label: '亮色', icon: 'lucide:sun' },
  { value: 'dark', label: '暗色', icon: 'lucide:moon' },
  { value: 'system', label: '跟随', icon: 'lucide:monitor' },
]

function close() {
  visible.value = false
}
</script>

<style lang="scss" scoped>
/* ---- 遮罩 ---- */
.tab-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 199;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(2px);
}

.tab-settings-overlay-enter-active,
.tab-settings-overlay-leave-active {
  transition: opacity 0.2s ease;
}

.tab-settings-overlay-enter-from,
.tab-settings-overlay-leave-to {
  opacity: 0;
}

/* ---- 抽屉 ---- */
.tab-settings-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  width: min(520px, 90vw);
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
.tab-settings-drawer__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--border-soft);
  color: var(--accent);
  flex-shrink: 0;
}

.tab-settings-drawer__title {
  flex: 1;
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
}

.tab-settings-drawer__close {
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

/* ---- Body：双栏布局 ---- */
.tab-settings-drawer__body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* 左列：导航 */
.tab-settings-nav {
  width: 140px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.75rem 0.5rem;
  border-right: 1px solid var(--border-soft);
  overflow-y: auto;
}

.tab-settings-nav__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.75rem;
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

/* 右列：内容 */
.tab-settings-content {
  flex: 1;
  padding: 1.25rem;
  overflow-y: auto;
}

.tab-settings-section__title {
  margin: 0 0 1rem;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-main);
}

/* ---- 字段行 ---- */
.tab-settings-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--border-soft);

  &:last-of-type {
    border-bottom: none;
  }
}

.tab-settings-field__label {
  font-size: 0.8125rem;
  color: var(--text-main);
  font-weight: 500;
}

.tab-settings-field__value {
  font-size: 0.8125rem;
  color: var(--text-soft);

  &--mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
  }

  &--chip {
    padding: 0.125rem 0.5rem;
    background: var(--accent-soft);
    color: var(--accent);
    border-radius: $radius-full;
    font-size: 0.6875rem;
    font-weight: 600;
  }

  &--muted {
    font-style: italic;
    color: var(--text-faint);
    font-size: 0.75rem;
  }
}

/* ---- 选项组 ---- */
.tab-settings-options {
  display: flex;
  gap: 0.375rem;
}

.tab-settings-option {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
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

/* ---- Toggle 开关 ---- */
.tab-settings-toggle {
  position: relative;
  width: 36px;
  height: 20px;
  border: none;
  border-radius: 10px;
  background: var(--border);
  cursor: pointer;
  transition: background 0.2s;
  padding: 0;
  flex-shrink: 0;

  &.is-on {
    background: var(--accent);
  }
}

.tab-settings-toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: $radius-full;
  background: #fff;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);

  .is-on & {
    transform: translateX(16px);
  }
}

/* ---- 关于文本 ---- */
.tab-settings-about-text {
  margin: 1rem 0 0;
  font-size: 0.75rem;
  line-height: 1.7;
  color: var(--text-soft);
}
</style>
