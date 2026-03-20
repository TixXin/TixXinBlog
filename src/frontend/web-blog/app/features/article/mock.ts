/**
 * @file mock.ts
 * @description 文章归档模块 mock 数据
 * @author TixXin
 * @since 2025-03-17
 */

import type { ArchiveStat, ArchiveYear, CategoryDistribution } from './types'

export const mockArchiveYears: ArchiveYear[] = [
  {
    year: 2024,
    shortYear: '24',
    count: 6,
    posts: [
      {
        date: '2024-12-18',
        title: 'Nuxt 4 与 Vite 6：迁移笔记与踩坑合集',
        category: '前端开发',
        categoryColor: 'sky',
        href: '/articles/nuxt4-vite6-migration',
      },
      {
        date: '2024-11-02',
        title: 'TypeScript 5.x 泛型实战：从 API 层到组件 props',
        category: '前端开发',
        categoryColor: 'blue',
        href: '/articles/ts-generics-api-to-props',
      },
      {
        date: '2024-09-20',
        title: '一年远程协作复盘：异步沟通与文档优先',
        category: '工作复盘',
        categoryColor: 'amber',
        href: '/articles/remote-async-retro',
      },
      {
        date: '2024-07-08',
        title: '用 Playwright 做博客 E2E：稳定选择器与 CI 集成',
        category: '前端开发',
        categoryColor: 'emerald',
        href: '/articles/playwright-blog-e2e',
      },
      {
        date: '2024-04-15',
        title: 'NestJS 模块化与依赖注入：个人项目里的边界划分',
        category: '后端技术',
        categoryColor: 'orange',
        href: '/articles/nestjs-module-di',
      },
      {
        date: '2024-02-01',
        title: '开年随笔：技术博客还值得写吗',
        category: '随笔日记',
        categoryColor: 'rose',
        href: '/articles/new-year-blog-worth',
      },
    ],
  },
  {
    year: 2023,
    shortYear: '23',
    count: 8,
    posts: [
      {
        date: '2023-12-05',
        title: 'Vue 3 Composition API 大型组件拆分心得',
        category: '前端开发',
        categoryColor: 'emerald',
        href: '/articles/vue3-composition-split',
      },
      {
        date: '2023-10-22',
        title: 'CSS 容器查询落地：侧边栏与卡片自适应',
        category: '前端开发',
        categoryColor: 'sky',
        href: '/articles/css-container-queries',
      },
      {
        date: '2023-09-01',
        title: 'PostgreSQL 索引选型：从慢查询日志说起',
        category: '后端技术',
        categoryColor: 'slate',
        href: '/articles/pg-index-slow-query',
      },
      {
        date: '2023-07-14',
        title: '季度复盘：需求波动下的优先级管理',
        category: '工作复盘',
        categoryColor: 'amber',
        href: '/articles/q2-priority-retro',
      },
      {
        date: '2023-05-30',
        title: 'Vite 插件开发入门：写一个 Markdown 短代码插件',
        category: '前端开发',
        categoryColor: 'blue',
        href: '/articles/vite-plugin-shortcode',
      },
      {
        date: '2023-04-08',
        title: '周末读书笔记：《程序员修炼之道》摘录',
        category: '随笔日记',
        categoryColor: 'rose',
        href: '/articles/weekend-pragmatic-programmer',
      },
      {
        date: '2023-02-28',
        title: 'Node 流与背压：大文件上传服务侧实践',
        category: '后端技术',
        categoryColor: 'orange',
        href: '/articles/node-stream-backpressure',
      },
      {
        date: '2023-01-10',
        title: '2022 年终技术总结与 2023 学习清单',
        category: '工作复盘',
        categoryColor: 'slate',
        href: '/articles/2022-wrap-2023-plan',
      },
    ],
  },
  {
    year: 2022,
    shortYear: '22',
    count: 4,
    posts: [
      {
        date: '2022-11-18',
        title: '从 Webpack 迁到 Vite：构建时间与 HMR 对比',
        category: '前端开发',
        categoryColor: 'sky',
        href: '/articles/webpack-to-vite',
      },
      {
        date: '2022-08-06',
        title: 'Docker 多阶段构建：减小 Node 镜像体积',
        category: '后端技术',
        categoryColor: 'emerald',
        href: '/articles/docker-node-multistage',
      },
      {
        date: '2022-05-20',
        title: '团队代码评审：我常用的检查清单',
        category: '工作复盘',
        categoryColor: 'amber',
        href: '/articles/code-review-checklist',
      },
      {
        date: '2022-03-03',
        title: '初春随笔：换机械键盘与长时间编码',
        category: '随笔日记',
        categoryColor: 'rose',
        href: '/articles/spring-keyboard-ergonomics',
      },
    ],
  },
]

export const mockArchiveStats: ArchiveStat[] = [
  { label: '文章', value: '86' },
  { label: '分类', value: '12' },
  { label: '标签', value: '34' },
]

export const mockCategoryDistribution: CategoryDistribution[] = [
  { name: '前端开发', count: 28, percent: 33 },
  { name: '工作复盘', count: 15, percent: 17 },
  { name: '随笔日记', count: 10, percent: 12 },
  { name: '后端技术', count: 8, percent: 9 },
]
