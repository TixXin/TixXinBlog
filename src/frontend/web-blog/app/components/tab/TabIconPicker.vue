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
          placeholder="搜索图标..."
        >
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
      <div v-if="filteredIcons.length === 0" class="icon-picker__empty">
        没有匹配的图标
      </div>
    </div>

    <!-- Emoji -->
    <div v-else-if="activeTab === 'emoji'" class="icon-picker__pane">
      <div class="icon-picker__search">
        <Icon name="lucide:search" size="12" class="icon-picker__search-icon" />
        <input
          v-model="emojiQuery"
          type="text"
          class="icon-picker__search-input"
          placeholder="搜索 emoji..."
        >
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
      <div v-if="filteredEmojis.length === 0" class="icon-picker__empty">
        没有匹配的 emoji
      </div>
    </div>

    <!-- 上传 -->
    <div v-else-if="activeTab === 'upload'" class="icon-picker__pane icon-picker__upload">
      <label class="icon-picker__upload-dropzone">
        <input type="file" accept="image/*" class="icon-picker__upload-input" @change="onUpload">
        <Icon name="lucide:upload" size="24" />
        <span class="icon-picker__upload-hint">
          <strong>点击上传</strong>或拖拽图片
          <small>建议 64×64 PNG / SVG，单图 &lt; 32KB</small>
        </span>
      </label>
      <p v-if="uploadError" class="icon-picker__upload-error">
        <Icon name="lucide:alert-circle" size="12" />
        {{ uploadError }}
      </p>
      <div v-if="isDataUrl" class="icon-picker__upload-preview">
        <img :src="modelValue" alt="预览">
        <button type="button" class="icon-picker__upload-clear" @click="$emit('update:modelValue', '')">
          <Icon name="lucide:x" size="11" />
          清除
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

type TabKey = 'lucide' | 'emoji' | 'upload'

const tabs: { value: TabKey; label: string; icon: string }[] = [
  { value: 'lucide', label: 'Lucide', icon: 'lucide:shapes' },
  { value: 'emoji', label: 'Emoji', icon: 'lucide:smile' },
  { value: 'upload', label: '上传', icon: 'lucide:upload' },
]

const isDataUrl = computed(() => props.modelValue.startsWith('data:'))
const activeTab = ref<TabKey>(
  isDataUrl.value ? 'upload' : props.modelValue.startsWith('lucide:') ? 'lucide' : 'emoji',
)

const searchQuery = ref('')
const emojiQuery = ref('')
const uploadError = ref('')

/** Lucide 常用图标 40+（保持原有） */
const iconList = [
  { name: 'lucide:home', label: '主页', keywords: '主页 home 首页' },
  { name: 'lucide:star', label: '收藏', keywords: '收藏 star 常用' },
  { name: 'lucide:heart', label: '喜欢', keywords: '喜欢 heart 爱心' },
  { name: 'lucide:sparkles', label: 'AI', keywords: 'ai 智能 sparkles' },
  { name: 'lucide:bot', label: '机器人', keywords: '机器人 bot ai' },
  { name: 'lucide:terminal', label: '终端', keywords: '终端 terminal 程序员 代码' },
  { name: 'lucide:code', label: '代码', keywords: '代码 code 编程' },
  { name: 'lucide:palette', label: '调色板', keywords: '设计 palette 颜色' },
  { name: 'lucide:box', label: '产品', keywords: '产品 box 盒子' },
  { name: 'lucide:server', label: '服务器', keywords: '服务器 server' },
  { name: 'lucide:fish', label: '摸鱼', keywords: '摸鱼 fish 娱乐' },
  { name: 'lucide:folder', label: '文件夹', keywords: '文件夹 folder' },
  { name: 'lucide:book-open', label: '学习', keywords: '学习 book 阅读' },
  { name: 'lucide:lightbulb', label: '灵感', keywords: '灵感 lightbulb 想法' },
  { name: 'lucide:wrench', label: '工具', keywords: '工具 wrench' },
  { name: 'lucide:globe', label: '网站', keywords: '网站 globe 世界' },
  { name: 'lucide:music', label: '音乐', keywords: '音乐 music' },
  { name: 'lucide:gamepad-2', label: '游戏', keywords: '游戏 gamepad' },
  { name: 'lucide:camera', label: '摄影', keywords: '摄影 camera 相机' },
  { name: 'lucide:shopping-bag', label: '购物', keywords: '购物 shopping' },
  { name: 'lucide:newspaper', label: '新闻', keywords: '新闻 newspaper 资讯' },
  { name: 'lucide:rocket', label: '火箭', keywords: '火箭 rocket 发射' },
  { name: 'lucide:zap', label: '闪电', keywords: '闪电 zap 快速' },
  { name: 'lucide:bookmark', label: '书签', keywords: '书签 bookmark' },
  { name: 'lucide:compass', label: '导航', keywords: '导航 compass 探索' },
  { name: 'lucide:cpu', label: '硬件', keywords: '硬件 cpu 芯片' },
  { name: 'lucide:database', label: '数据库', keywords: '数据库 database' },
  { name: 'lucide:shield', label: '安全', keywords: '安全 shield 防护' },
  { name: 'lucide:cloud', label: '云', keywords: '云 cloud' },
  { name: 'lucide:download', label: '下载', keywords: '下载 download' },
  { name: 'lucide:image', label: '图片', keywords: '图片 image 照片' },
  { name: 'lucide:video', label: '视频', keywords: '视频 video' },
  { name: 'lucide:pen-tool', label: '钢笔', keywords: '钢笔 pen 绘画' },
  { name: 'lucide:layout-grid', label: '网格', keywords: '网格 layout grid' },
  { name: 'lucide:users', label: '社交', keywords: '社交 users 用户' },
  { name: 'lucide:trophy', label: '成就', keywords: '成就 trophy 奖杯' },
  { name: 'lucide:coffee', label: '咖啡', keywords: '咖啡 coffee 休息' },
  { name: 'lucide:graduation-cap', label: '教育', keywords: '教育 graduation 毕业' },
  { name: 'lucide:briefcase', label: '工作', keywords: '工作 briefcase 办公' },
  { name: 'lucide:map-pin', label: '位置', keywords: '位置 map pin 地图' },
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

const filteredIcons = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return iconList
  return iconList.filter((i) => i.keywords.includes(q) || i.label.includes(q) || i.name.includes(q))
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
    uploadError.value = `图片过大（${Math.round(file.size / 1024)}KB）。请压缩至 32KB 以内。`
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result !== 'string') return
    emit('update:modelValue', reader.result)
  }
  reader.onerror = () => {
    uploadError.value = '读取图片失败，请重试'
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
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: var(--text-main);
  }

  &--active {
    background: var(--surface-1);
    color: var(--accent);
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
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }

  &--active {
    background: var(--accent-soft);
    color: var(--accent);
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
  cursor: pointer;
  text-align: center;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
  }

  strong {
    color: var(--accent);
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
  cursor: pointer;

  &:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
  }
}
</style>
