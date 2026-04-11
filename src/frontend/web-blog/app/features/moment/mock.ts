/**
 * @file mock.ts
 * @description 朋友圈（Moment）模块 mock 数据
 * @author TixXin
 * @since 2026-04-04
 */

import type { MomentItem, MomentUserProfile } from './types'
import type { MomentAuthorStats } from '~/components/sidebar/MomentAuthorCard.vue'

/** 生成 mock 评论者头像 — 使用 UI Avatars 服务按名字生成 */
function mockAvatar(name: string, bg: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=64&font-size=0.4&rounded=true`
}

/** 评论者 profile 数据 */
const profiles: Record<string, MomentUserProfile> = {
  小林: { name: '小林', avatar: mockAvatar('小林', '4ade80'), bio: '摄影爱好者，喜欢用镜头记录生活' },
  代码小哥: { name: '代码小哥', avatar: mockAvatar('代码小哥', '60a5fa'), bio: '全栈开发，开源爱好者', link: 'https://github.com' },
  前端菜鸟: { name: '前端菜鸟', avatar: mockAvatar('前端菜鸟', 'f472b6'), bio: '正在学习前端的大三学生' },
  美食家小王: { name: '美食家小王', avatar: mockAvatar('美食家小王', 'fb923c'), bio: '吃遍深圳，一个认真的美食博主' },
  读书人: { name: '读书人', avatar: mockAvatar('读书人', 'a78bfa'), bio: '每年阅读 50+ 本书的文学爱好者' },
  驴友阿杰: { name: '驴友阿杰', avatar: mockAvatar('驴友阿杰', '34d399'), bio: '户外运动达人，已登顶 30+ 座山', link: 'https://example.com' },
  户外小白: { name: '户外小白', avatar: mockAvatar('户外小白', 'fbbf24'), bio: '刚入坑户外的打工人' },
  咖啡控: { name: '咖啡控', avatar: mockAvatar('咖啡控', 'c084fc'), bio: '每天一杯手冲咖啡' },
  摄影师老张: { name: '摄影师老张', avatar: mockAvatar('摄影师老张', '38bdf8'), bio: '十年风光摄影经验，索尼用户', link: 'https://example.com' },
  Nuxt爱好者: { name: 'Nuxt爱好者', avatar: mockAvatar('Nuxt爱好者', '2dd4bf'), bio: 'Vue/Nuxt 生态贡献者' },
}

export const mockMoments: MomentItem[] = [
  {
    id: 'm-1',
    content: '春天来了，周末去了趟植物园，樱花开得正好，随手拍了几张。',
    images: [
      'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=800&q=80',
      'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&q=80',
      'https://images.unsplash.com/photo-1504567961542-e24d9439a724?w=800&q=80',
    ],
    date: '2026-04-10T09:20:00Z',
    likes: 28,
    isLiked: false,
    location: '深圳·仙湖植物园',
    topics: ['生活日常', '摄影记录'],
    comments: [
      {
        id: 'c-1-1',
        author: '小林',
        avatar: mockAvatar('小林', '4ade80'),
        content: '好美啊！这个季节去植物园最合适了',
        time: '3小时前',
        isOwner: false,
        profile: profiles['小林'],
      },
      {
        id: 'c-1-2',
        author: 'TixXin',
        avatar: '/avatar-photo.webp',
        content: '是的，推荐周中去人少',
        time: '2小时前',
        isOwner: true,
      },
    ],
  },
  {
    id: 'm-2',
    content:
      '终于把博客的主题引擎重构完了！现在可以像搭积木一样换主题了，代码也干净了很多。接下来准备写一篇文章记录一下这个过程。',
    date: '2026-04-08T20:15:00Z',
    likes: 35,
    isLiked: true,
    device: 'MacBook Pro',
    topics: ['技术分享'],
    linkedArticle: {
      id: 'a-1',
      title: '从零搭建博客主题引擎：基于 Slot Contract 的可插拔架构',
      summary: '本文介绍如何设计一套灵活的主题引擎，通过 slot contract 模式实现主题的热切换和懒加载。',
      cover: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&q=80',
      url: '/articles/1',
    },
    comments: [
      {
        id: 'c-2-1',
        author: '代码小哥',
        avatar: mockAvatar('代码小哥', '60a5fa'),
        content: '期待文章，主题引擎是怎么做的？',
        time: '昨天',
        isOwner: false,
        profile: profiles['代码小哥'],
      },
      {
        id: 'c-2-2',
        author: 'TixXin',
        avatar: '/avatar-photo.webp',
        content: '基于 slot contract 模式，文章里会详细说',
        time: '昨天',
        isOwner: true,
      },
      { id: 'c-2-3', author: '前端菜鸟', avatar: mockAvatar('前端菜鸟', 'f472b6'), content: '@代码小哥 大佬带带我', time: '10小时前', isOwner: false, profile: profiles['前端菜鸟'] },
    ],
  },
  {
    id: 'm-3',
    content: '今天天气真好，去海边走了走，拍了夕阳和海浪。风很大但心情很好。',
    images: [
      'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80',
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80',
    ],
    date: '2026-04-06T17:30:00Z',
    likes: 42,
    isLiked: false,
    location: '深圳·大梅沙',
    topics: ['生活日常', '摄影记录'],
  },
  {
    id: 'm-4',
    content: '试了一下新开的日料店，三文鱼刺身太新鲜了！鳗鱼饭也很绝，推荐大家去试试。',
    images: [
      'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80',
      'https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&q=80',
      'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=800&q=80',
      'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&q=80',
    ],
    date: '2026-04-05T12:30:00Z',
    likes: 22,
    isLiked: false,
    location: '广州·天河城',
    device: 'iPhone 16 Pro',
    topics: ['美食探店', '生活日常'],
    comments: [
      {
        id: 'c-4-1',
        author: '美食家小王',
        avatar: mockAvatar('美食家小王', 'fb923c'),
        content: '这家我也去过，确实不错！',
        time: '4天前',
        isOwner: false,
        profile: profiles['美食家小王'],
      },
      {
        id: 'c-4-2',
        author: 'TixXin',
        avatar: '/avatar-photo.webp',
        content: '@美食家小王 强烈推荐鳗鱼饭，一定要试',
        time: '4天前',
        isOwner: true,
      },
    ],
  },
  {
    id: 'm-5',
    content: '最近在读《重构：改善既有代码的设计》，每次翻开都有新的收获。好的代码就像好的文章，清晰、简洁、有逻辑。',
    images: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80'],
    date: '2026-04-03T21:00:00Z',
    likes: 18,
    isLiked: false,
    topics: ['读书笔记', '技术分享'],
    comments: [
      { id: 'c-5-1', author: '读书人', avatar: mockAvatar('读书人', 'a78bfa'), content: '这本书是经典，值得反复看', time: '6天前', isOwner: false, profile: profiles['读书人'] },
    ],
  },
  {
    id: 'm-6',
    content:
      '用 Vue 3 的 Transition 组件做了一组微交互动画，效果比想象中好很多。CSS animation + JS hooks 的组合真的很灵活。',
    date: '2026-04-02T15:45:00Z',
    likes: 31,
    isLiked: true,
    device: 'MacBook Pro',
    topics: ['技术分享'],
    linkedArticle: {
      id: 'a-2',
      title: 'Vue 3 Transition 实战：打造丝滑的微交互动画',
      summary: '详解 CSS animation 与 JS hooks 的组合技巧，从基础过渡到复杂编排动画。',
      cover: 'https://images.unsplash.com/photo-1550439062-609e1531270e?w=600&q=80',
      url: '/articles/2',
    },
  },
  {
    id: 'm-7',
    content: '周末爬了趟梧桐山，山顶的云海太震撼了。下次要早点出发，争取看日出。',
    images: [
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
      'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&q=80',
      'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800&q=80',
      'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&q=80',
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80',
    ],
    date: '2026-03-30T07:15:00Z',
    likes: 56,
    isLiked: false,
    location: '深圳·梧桐山',
    topics: ['生活日常', '摄影记录'],
    comments: [
      {
        id: 'c-7-1',
        author: '驴友阿杰',
        avatar: mockAvatar('驴友阿杰', '34d399'),
        content: '梧桐山的云海确实绝了！几点上去的？',
        time: '10天前',
        isOwner: false,
        profile: profiles['驴友阿杰'],
      },
      {
        id: 'c-7-2',
        author: 'TixXin',
        avatar: '/avatar-photo.webp',
        content: '早上五点半开始爬，七点到山顶',
        time: '10天前',
        isOwner: true,
      },
      { id: 'c-7-3', author: '户外小白', avatar: mockAvatar('户外小白', 'fbbf24'), content: '@驴友阿杰 难度大吗？新手能去吗', time: '9天前', isOwner: false, profile: profiles['户外小白'] },
      {
        id: 'c-7-4',
        author: 'TixXin',
        avatar: '/avatar-photo.webp',
        content: '@户外小白 主要路线不难，就是有点长，带够水就行',
        time: '9天前',
        isOwner: true,
      },
    ],
  },
  {
    id: 'm-8',
    content: '整理了一下书架，发现好多买了还没读的书。立个 flag：这个月至少读完两本。',
    images: ['https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80'],
    date: '2026-03-28T14:20:00Z',
    likes: 8,
    isLiked: false,
    topics: ['读书笔记', '生活日常'],
  },
  {
    id: 'm-9',
    content: '探索了一家隐藏在巷子里的咖啡店，拿铁拉花很漂亮，蛋糕也好吃。适合一个人安静地待一下午。',
    images: [
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80',
    ],
    date: '2026-03-25T15:10:00Z',
    likes: 19,
    isLiked: false,
    location: '深圳·南山',
    topics: ['美食探店', '生活日常'],
    comments: [
      { id: 'c-9-1', author: '咖啡控', avatar: mockAvatar('咖啡控', 'c084fc'), content: '在哪里呀，求地址！', time: '15天前', isOwner: false, profile: profiles['咖啡控'] },
      {
        id: 'c-9-2',
        author: 'TixXin',
        avatar: '/avatar-photo.webp',
        content: '南山大道旁边的小巷子里，叫"慢时光"',
        time: '15天前',
        isOwner: true,
      },
    ],
  },
  {
    id: 'm-10',
    content: '给博客加了 RSS 订阅功能，终于可以用 Feedly 追更了。技术栈：Nitro server routes + XML 模板，意外地简单。',
    date: '2026-03-22T19:30:00Z',
    likes: 27,
    isLiked: true,
    device: 'MacBook Pro',
    topics: ['技术分享'],
  },
  {
    id: 'm-11',
    content:
      '周末去了趟图书馆，安安静静看了一下午《设计模式》。观察者模式在前端应用真的太广了，Vue 的响应式系统就是一个经典实现。',
    date: '2026-03-20T16:00:00Z',
    likes: 14,
    isLiked: false,
    location: '深圳·图书馆',
    topics: ['读书笔记', '技术分享'],
  },
  {
    id: 'm-12',
    content: '拍到了一组很满意的城市夜景，手持长曝光居然也能出片。',
    images: [
      'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80',
      'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80',
      'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
    ],
    date: '2026-03-17T22:45:00Z',
    likes: 45,
    isLiked: false,
    location: '深圳·福田CBD',
    device: 'Sony A7M4',
    topics: ['摄影记录'],
    comments: [
      {
        id: 'c-12-1',
        author: '摄影师老张',
        avatar: mockAvatar('摄影师老张', '38bdf8'),
        content: '手持长曝？快门速度多少？',
        time: '23天前',
        isOwner: false,
        profile: profiles['摄影师老张'],
      },
      {
        id: 'c-12-2',
        author: 'TixXin',
        avatar: '/avatar-photo.webp',
        content: '1/4s，开了 IBIS 防抖，靠在栏杆上稳住',
        time: '23天前',
        isOwner: true,
      },
    ],
  },
  {
    id: 'm-13',
    content: '发现了一家很棒的川菜馆，水煮鱼又麻又辣，回锅肉也很正宗。辣度可以选择，不太能吃辣的也可以尝试。',
    images: [
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80',
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
    ],
    date: '2026-03-14T12:00:00Z',
    likes: 16,
    isLiked: false,
    location: '深圳·华强北',
    topics: ['美食探店'],
  },
  {
    id: 'm-14',
    content:
      '研究了一下 Nuxt 4 的新特性，目录结构调整后项目组织清晰了很多。app/ 目录的概念很好，把运行时代码和配置文件分开了。',
    date: '2026-03-10T20:30:00Z',
    likes: 23,
    isLiked: true,
    device: 'MacBook Pro',
    topics: ['技术分享'],
    comments: [
      {
        id: 'c-14-1',
        author: 'Nuxt爱好者',
        avatar: mockAvatar('Nuxt爱好者', '2dd4bf'),
        content: '升级麻烦吗？有 breaking changes 吗？',
        time: '30天前',
        isOwner: false,
        profile: profiles['Nuxt爱好者'],
      },
      {
        id: 'c-14-2',
        author: 'TixXin',
        avatar: '/avatar-photo.webp',
        content: '官方有迁移指南，主要是目录结构变化，逻辑基本兼容',
        time: '30天前',
        isOwner: true,
      },
    ],
  },
  {
    id: 'm-15',
    content:
      '在家翻完了《人月神话》，虽然是几十年前的书，但关于软件工程的很多观点现在依然适用。"没有银弹"这一章值得每个程序员读一遍。',
    images: ['https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80'],
    date: '2026-03-05T21:15:00Z',
    likes: 11,
    isLiked: false,
    topics: ['读书笔记'],
  },
  {
    id: 'm-16',
    content: '早起跑了个 5 公里，沿着深圳湾跑步真的很舒服。海风、日出、空旷的跑道，完美的一天开始。',
    images: [
      'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80',
      'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=800&q=80',
      'https://images.unsplash.com/photo-1461897104016-0b3b00cc81ee?w=800&q=80',
      'https://images.unsplash.com/photo-1473091534298-04dcbce3278c?w=800&q=80',
      'https://images.unsplash.com/photo-1444491741275-3747c53c99b4?w=800&q=80',
      'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800&q=80',
      'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=800&q=80',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
      'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80',
    ],
    date: '2026-02-28T06:30:00Z',
    likes: 33,
    isLiked: false,
    location: '深圳·深圳湾',
    topics: ['生活日常', '摄影记录'],
  },
]

/** 朋友圈博主名片统计数据 */
export const mockMomentAuthorStats: MomentAuthorStats = {
  totalMoments: mockMoments.length,
  totalLikes: mockMoments.reduce((sum, m) => sum + m.likes, 0),
  totalComments: mockMoments.reduce((sum, m) => sum + (m.comments?.length || 0), 0),
  currentMood: '今天阳光正好，适合写代码 🌞',
  moodUpdatedAt: '2小时前',
  socialLinks: [
    { icon: 'lucide:github', url: 'https://github.com', label: 'GitHub' },
    { icon: 'lucide:twitter', url: 'https://twitter.com', label: 'Twitter' },
    { icon: 'lucide:mail', url: 'mailto:hi@tixxin.com', label: '邮箱' },
  ],
}
