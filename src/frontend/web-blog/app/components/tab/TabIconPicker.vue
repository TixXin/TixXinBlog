<!--
  @file TabIconPicker.vue
  @description 图标选择器：从预设的常用 Lucide 图标中选择，支持关键词搜索
  @author TixXin
  @since 2026-04-12
-->

<template>
  <div class="icon-picker">
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
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
}>()

defineEmits<{
  'update:modelValue': [name: string]
}>()

const searchQuery = ref('')

/** 预设常用图标（覆盖分类场景常用的 50 个） */
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

const filteredIcons = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return iconList
  return iconList.filter((i) => i.keywords.includes(q) || i.label.includes(q) || i.name.includes(q))
})
</script>

<style lang="scss" scoped>
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

.icon-picker__grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0.25rem;
  max-height: 160px;
  overflow-y: auto;
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
}

.icon-picker__empty {
  text-align: center;
  padding: 1rem;
  font-size: 0.75rem;
  color: var(--text-faint);
}
</style>
