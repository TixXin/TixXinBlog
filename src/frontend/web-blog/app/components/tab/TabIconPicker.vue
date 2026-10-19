<!--
  @file TabIconPicker.vue
  @description 图标选择器三合一：Lucide 图标 / Emoji / 上传本地图片（dataURL）
  @author TixXin
  @since 2026-04-12
-->

<template>
  <div class="icon-picker">
    <!-- Tab 切换 -->
    <div class="icon-picker__tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.value"
        class="icon-picker__tab"
        :class="{ 'icon-picker__tab--active': activeTab === tab.value }"
        @click="activeTab = tab.value"
      >
        <Icon :name="tab.icon" size="12" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- Lucide -->
    <div v-if="activeTab === 'lucide'" class="icon-picker__pane">
      <div class="icon-picker__search">
        <Icon name="lucide:search" size="12" class="icon-picker__search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          class="icon-picker__search-input"
          :placeholder="$t('misc.tab.iconPicker.searchIcons')"
        />
      </div>
      <div class="icon-picker__grid">
        <button
          v-for="icon in filteredIcons"
          :key="icon.name"
          type="button"
          class="icon-picker__item"
          :class="{ 'icon-picker__item--active': modelValue === icon.name }"
          :title="icon.label"
          @click="$emit('update:modelValue', icon.name)"
        >
          <Icon :name="icon.name" size="16" />
        </button>
      </div>
      <div v-if="filteredIcons.length === 0" class="icon-picker__empty">{{ $t('misc.tab.iconPicker.noIcons') }}</div>
    </div>

    <!-- Emoji -->
    <div v-else-if="activeTab === 'emoji'" class="icon-picker__pane">
      <div class="icon-picker__search">
        <Icon name="lucide:search" size="12" class="icon-picker__search-icon" />
        <input
          v-model="emojiQuery"
          type="text"
          class="icon-picker__search-input"
          :placeholder="$t('misc.tab.iconPicker.searchEmoji')"
        />
      </div>
      <div class="icon-picker__grid icon-picker__grid--emoji">
        <button
          v-for="e in filteredEmojis"
          :key="e.char + e.keywords"
          type="button"
          class="icon-picker__item icon-picker__item--emoji"
          :class="{ 'icon-picker__item--active': modelValue === e.char }"
          :title="e.keywords"
          @click="$emit('update:modelValue', e.char)"
        >
          {{ e.char }}
        </button>
      </div>
      <div v-if="filteredEmojis.length === 0" class="icon-picker__empty">{{ $t('misc.tab.iconPicker.noEmoji') }}</div>
    </div>

    <!-- 上传 -->
    <div v-else-if="activeTab === 'upload'" class="icon-picker__pane icon-picker__upload">
      <label class="icon-picker__upload-dropzone">
        <input type="file" accept="image/*" class="icon-picker__upload-input" @change="onUpload" />
        <Icon name="lucide:upload" size="24" />
        <span class="icon-picker__upload-hint">
          <strong>{{ $t('misc.tab.iconPicker.uploadClick') }}</strong
          >{{ $t('misc.tab.iconPicker.uploadDrag') }}
          <small>{{ $t('misc.tab.iconPicker.uploadHint') }}</small>
        </span>
      </label>
      <p v-if="uploadError" class="icon-picker__upload-error">
        <Icon name="lucide:alert-circle" size="12" />
        {{ uploadError }}
      </p>
      <div v-if="isDataUrl" class="icon-picker__upload-preview">
        <img :src="modelValue" :alt="$t('misc.tab.iconPicker.preview')" />
        <button type="button" class="icon-picker__upload-clear" @click="$emit('update:modelValue', '')">
          <Icon name="lucide:x" size="11" />
          {{ $t('misc.tab.iconPicker.clear') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()

type TabKey = 'lucide' | 'emoji' | 'upload'

const tabs = computed<{ value: TabKey; label: string; icon: string }[]>(() => [
  { value: 'lucide', label: 'Lucide', icon: 'lucide:shapes' },
  { value: 'emoji', label: 'Emoji', icon: 'lucide:smile' },
  { value: 'upload', label: t('misc.tab.iconPicker.upload'), icon: 'lucide:upload' },
])

const isDataUrl = computed(() => props.modelValue.startsWith('data:'))
const activeTab = ref<TabKey>(isDataUrl.value ? 'upload' : props.modelValue.startsWith('lucide:') ? 'lucide' : 'emoji')

const searchQuery = ref('')
const emojiQuery = ref('')
const uploadError = ref('')

/** Lucide 常用图标 40+（保持原有） */
const iconList = [
  { name: 'lucide:home', labelKey: 'misc.tab.iconPicker.icons.home', keywords: '主页 home 首页' },
  { name: 'lucide:star', labelKey: 'misc.tab.iconPicker.icons.star', keywords: '收藏 star 常用' },
  { name: 'lucide:heart', labelKey: 'misc.tab.iconPicker.icons.heart', keywords: '喜欢 heart 爱心' },
  { name: 'lucide:sparkles', labelKey: 'misc.tab.iconPicker.icons.sparkles', keywords: 'ai 智能 sparkles' },
  { name: 'lucide:bot', labelKey: 'misc.tab.iconPicker.icons.bot', keywords: '机器人 bot ai' },
  { name: 'lucide:terminal', labelKey: 'misc.tab.iconPicker.icons.terminal', keywords: '终端 terminal 程序员 代码' },
  { name: 'lucide:code', labelKey: 'misc.tab.iconPicker.icons.code', keywords: '代码 code 编程' },
  { name: 'lucide:palette', labelKey: 'misc.tab.iconPicker.icons.palette', keywords: '设计 palette 颜色' },
  { name: 'lucide:box', labelKey: 'misc.tab.iconPicker.icons.box', keywords: '产品 box 盒子' },
  { name: 'lucide:server', labelKey: 'misc.tab.iconPicker.icons.server', keywords: '服务器 server' },
  { name: 'lucide:fish', labelKey: 'misc.tab.iconPicker.icons.fish', keywords: '摸鱼 fish 娱乐' },
  { name: 'lucide:folder', labelKey: 'misc.tab.iconPicker.icons.folder', keywords: '文件夹 folder' },
  { name: 'lucide:book-open', labelKey: 'misc.tab.iconPicker.icons.bookOpen', keywords: '学习 book 阅读' },
  { name: 'lucide:lightbulb', labelKey: 'misc.tab.iconPicker.icons.lightbulb', keywords: '灵感 lightbulb 想法' },
  { name: 'lucide:wrench', labelKey: 'misc.tab.iconPicker.icons.wrench', keywords: '工具 wrench' },
  { name: 'lucide:globe', labelKey: 'misc.tab.iconPicker.icons.globe', keywords: '网站 globe 世界' },
  { name: 'lucide:music', labelKey: 'misc.tab.iconPicker.icons.music', keywords: '音乐 music' },
  { name: 'lucide:gamepad-2', labelKey: 'misc.tab.iconPicker.icons.gamepad2', keywords: '游戏 gamepad' },
  { name: 'lucide:camera', labelKey: 'misc.tab.iconPicker.icons.camera', keywords: '摄影 camera 相机' },
  { name: 'lucide:shopping-bag', labelKey: 'misc.tab.iconPicker.icons.shoppingBag', keywords: '购物 shopping' },
  { name: 'lucide:newspaper', labelKey: 'misc.tab.iconPicker.icons.newspaper', keywords: '新闻 newspaper 资讯' },
  { name: 'lucide:rocket', labelKey: 'misc.tab.iconPicker.icons.rocket', keywords: '火箭 rocket 发射' },
  { name: 'lucide:zap', labelKey: 'misc.tab.iconPicker.icons.zap', keywords: '闪电 zap 快速' },
  { name: 'lucide:bookmark', labelKey: 'misc.tab.iconPicker.icons.bookmark', keywords: '书签 bookmark' },
  { name: 'lucide:compass', labelKey: 'misc.tab.iconPicker.icons.compass', keywords: '导航 compass 探索' },
  { name: 'lucide:cpu', labelKey: 'misc.tab.iconPicker.icons.cpu', keywords: '硬件 cpu 芯片' },
  { name: 'lucide:database', labelKey: 'misc.tab.iconPicker.icons.database', keywords: '数据库 database' },
  { name: 'lucide:shield', labelKey: 'misc.tab.iconPicker.icons.shield', keywords: '安全 shield 防护' },
  { name: 'lucide:cloud', labelKey: 'misc.tab.iconPicker.icons.cloud', keywords: '云 cloud' },
  { name: 'lucide:download', labelKey: 'misc.tab.iconPicker.icons.download', keywords: '下载 download' },
  { name: 'lucide:image', labelKey: 'misc.tab.iconPicker.icons.image', keywords: '图片 image 照片' },
  { name: 'lucide:video', labelKey: 'misc.tab.iconPicker.icons.video', keywords: '视频 video' },
  { name: 'lucide:pen-tool', labelKey: 'misc.tab.iconPicker.icons.penTool', keywords: '钢笔 pen 绘画' },
  { name: 'lucide:layout-grid', labelKey: 'misc.tab.iconPicker.icons.layoutGrid', keywords: '网格 layout grid' },
  { name: 'lucide:users', labelKey: 'misc.tab.iconPicker.icons.users', keywords: '社交 users 用户' },
  { name: 'lucide:trophy', labelKey: 'misc.tab.iconPicker.icons.trophy', keywords: '成就 trophy 奖杯' },
  { name: 'lucide:coffee', labelKey: 'misc.tab.iconPicker.icons.coffee', keywords: '咖啡 coffee 休息' },
  {
    name: 'lucide:graduation-cap',
    labelKey: 'misc.tab.iconPicker.icons.graduationCap',
    keywords: '教育 graduation 毕业',
  },
  { name: 'lucide:briefcase', labelKey: 'misc.tab.iconPicker.icons.briefcase', keywords: '工作 briefcase 办公' },
  { name: 'lucide:map-pin', labelKey: 'misc.tab.iconPicker.icons.mapPin', keywords: '位置 map pin 地图' },
]

/** 常用 emoji（覆盖场景：表情、物品、符号） */
const emojiList: { char: string; keywords: string }[] = [
  { char: '🏠', keywords: '家 主页 home house' },
  { char: '⭐', keywords: '星 收藏 star' },
  { char: '❤️', keywords: '心 喜欢 heart' },
  { char: '🔥', keywords: '火 热门 fire' },
  { char: '✨', keywords: '闪光 sparkles ai' },
  { char: '🤖', keywords: '机器人 ai bot' },
  { char: '💻', keywords: '电脑 代码 code' },
  { char: '🧑‍💻', keywords: '程序员 developer' },
  { char: '🎨', keywords: '调色 设计 art' },
  { char: '📦', keywords: '盒子 产品 box' },
  { char: '🎮', keywords: '游戏 gamepad' },
  { char: '🎵', keywords: '音乐 music' },
  { char: '📚', keywords: '书 学习 book' },
  { char: '💡', keywords: '灵感 idea lightbulb' },
  { char: '🔧', keywords: '工具 wrench tool' },
  { char: '🌐', keywords: '地球 全球 网站 globe' },
  { char: '🚀', keywords: '火箭 rocket 发射' },
  { char: '⚡', keywords: '闪电 快速 zap' },
  { char: '📌', keywords: '图钉 置顶 pin' },
  { char: '🔖', keywords: '书签 bookmark' },
  { char: '🧭', keywords: '指南针 compass' },
  { char: '📷', keywords: '相机 摄影 camera' },
  { char: '🛒', keywords: '购物车 cart shopping' },
  { char: '📰', keywords: '新闻 newspaper' },
  { char: '☕', keywords: '咖啡 coffee 休息' },
  { char: '🎓', keywords: '毕业 教育 graduation' },
  { char: '💼', keywords: '工作 briefcase 办公' },
  { char: '🌈', keywords: '彩虹 rainbow' },
  { char: '🍿', keywords: '爆米花 娱乐 popcorn' },
  { char: '🧠', keywords: '大脑 思考 brain' },
  { char: '🐱', keywords: '猫 cat 喵' },
  { char: '🐶', keywords: '狗 dog 汪' },
  { char: '🌸', keywords: '花 sakura blossom' },
  { char: '🍀', keywords: '四叶草 幸运 clover' },
  { char: '🗺️', keywords: '地图 map' },
  { char: '📅', keywords: '日历 calendar 日期' },
  { char: '🎯', keywords: '目标 target' },
  { char: '🔒', keywords: '锁 安全 security' },
  { char: '🔔', keywords: '铃铛 通知 bell' },
  { char: '💬', keywords: '对话 聊天 chat' },
  { char: '👥', keywords: '用户 社交 users' },
  { char: '🛠️', keywords: '工具箱 tools' },
  { char: '📊', keywords: '图表 chart 数据' },
  { char: '📝', keywords: '笔记 memo note' },
  { char: '🎬', keywords: '电影 video 视频' },
  { char: '🎧', keywords: '耳机 音乐 headphones' },
  { char: '📖', keywords: '翻开书 阅读 open book' },
  { char: '🧩', keywords: '拼图 puzzle' },
  { char: '🎁', keywords: '礼物 gift' },
  { char: '💰', keywords: '钱 money 薪水' },
]

/** 名称按当前语言翻译；keywords 是中英混合的搜索别名，两种语言下都可检索 */
const localizedIcons = computed(() => iconList.map((icon) => ({ ...icon, label: t(icon.labelKey) })))

const filteredIcons = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return localizedIcons.value
  return localizedIcons.value.filter(
    (i) => i.keywords.includes(q) || i.label.toLowerCase().includes(q) || i.name.includes(q),
  )
})

const filteredEmojis = computed(() => {
  const q = emojiQuery.value.toLowerCase().trim()
  if (!q) return emojiList
  return emojiList.filter((e) => e.keywords.includes(q) || e.char.includes(q))
})

function onUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadError.value = ''
  if (file.size > 32 * 1024) {
    uploadError.value = t('misc.tab.iconPicker.tooLarge', { size: Math.round(file.size / 1024) })
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result !== 'string') return
    emit('update:modelValue', reader.result)
  }
  reader.onerror = () => {
    uploadError.value = t('misc.tab.iconPicker.readFailed')
  }
  reader.readAsDataURL(file)
  input.value = ''
}
</script>

<style lang="scss" scoped>
/* ---- Tab 栏 ---- */
.icon-picker__tabs {
  display: flex;
  gap: 0.125rem;
  margin-bottom: 0.5rem;
  padding: 0.125rem;
  background: var(--surface-2);
  border-radius: $radius-sm;
}

.icon-picker__tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.3125rem 0.375rem;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
  }

  &--active {
    background: var(--surface-1);
    color: var(--accent-text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
}

.icon-picker__pane {
  display: flex;
  flex-direction: column;
}

/* ---- 搜索框 ---- */
.icon-picker__search {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  margin-bottom: 0.5rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-2);

  &:focus-within {
    border-color: var(--accent);
  }
}

.icon-picker__search-icon {
  color: var(--text-faint);
  flex-shrink: 0;
}

.icon-picker__search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.75rem;
  color: var(--text-main);

  &::placeholder {
    color: var(--text-faint);
  }
}

/* ---- 网格 ---- */
.icon-picker__grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0.25rem;
  max-height: 160px;
  overflow-y: auto;
}

.icon-picker__grid--emoji {
  grid-template-columns: repeat(8, 1fr);
}

.icon-picker__item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.15s,
    color 0.15s;
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
  }

  &--emoji {
    font-size: 1.125rem;
    line-height: 1;
  }
}

.icon-picker__empty {
  text-align: center;
  padding: 1rem;
  font-size: 0.75rem;
  color: var(--text-faint);
}

/* ---- 上传 ---- */
.icon-picker__upload {
  gap: 0.5rem;
}

.icon-picker__upload-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem;
  border: 2px dashed var(--border);
  border-radius: $radius-md;
  background: var(--surface-2);
  color: var(--text-soft);
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

  strong {
    color: var(--accent-text);
  }

  small {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.625rem;
    color: var(--text-faint);
    font-weight: 400;
  }
}

.icon-picker__upload-input {
  display: none;
}

.icon-picker__upload-hint {
  font-size: 0.75rem;
  font-weight: 500;
}

.icon-picker__upload-error {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0;
  padding: 0.375rem 0.5rem;
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  border-radius: $radius-sm;
  font-size: 0.6875rem;
}

.icon-picker__upload-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface-2);
  border-radius: $radius-sm;

  img {
    width: 32px;
    height: 32px;
    border-radius: $radius-sm;
    object-fit: contain;
    background: var(--surface-1);
  }
}

.icon-picker__upload-clear {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
  cursor: var(--interaction-cursor, pointer);

  &:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
  }
}
</style>
