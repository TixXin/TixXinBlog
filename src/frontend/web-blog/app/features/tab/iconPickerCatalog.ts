/**
 * @file iconPickerCatalog.ts
 * @description 图标选择器的候选目录：常用 Lucide 图标与 Emoji，以及按关键词、名称或字符的搜索过滤
 * @author TixXin
 * @since 2026-10-27
 */

/** Lucide 常用图标 40+（保持原有） */
export const TAB_ICON_LIST: { name: string; labelKey: string; keywords: string }[] = [
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
export const TAB_EMOJI_LIST: { char: string; keywords: string }[] = [
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

export type TabIconOption = (typeof TAB_ICON_LIST)[number] & { label: string }

/** Lucide 图标按中英文关键词、当前语言名称或图标名搜索，不区分大小写 */
export function filterTabIcons(icons: TabIconOption[], query: string) {
  const q = query.toLowerCase().trim()
  if (!q) return icons
  return icons.filter((i) => i.keywords.includes(q) || i.label.toLowerCase().includes(q) || i.name.includes(q))
}

/** Emoji 按关键词或字符本身搜索 */
export function filterTabEmojis(query: string) {
  const q = query.toLowerCase().trim()
  if (!q) return TAB_EMOJI_LIST
  return TAB_EMOJI_LIST.filter((e) => e.keywords.includes(q) || e.char.includes(q))
}
