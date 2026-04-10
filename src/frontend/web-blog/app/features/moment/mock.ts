/**
 * @file mock.ts
 * @description 朋友圈（Moment）模块 mock 数据
 * @author TixXin
 * @since 2026-04-04
 */

import type { MomentItem } from './types'

export const mockMoments: MomentItem[] = [
  {
    id: 'm-1',
    content: '今天天气真好，去公园散了步，拍了些照片。',
    images: [
      'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80',
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80',
    ],
    date: '2026-04-04T10:30:00Z',
    likes: 12,
    isLiked: false,
    location: '深圳',
  },
  {
    id: 'm-2',
    content:
      '终于把博客的主题引擎重构完了！现在可以像搭积木一样换主题了，代码也干净了很多。接下来准备写一篇文章记录一下这个过程。',
    date: '2026-04-03T20:15:00Z',
    likes: 35,
    isLiked: true,
    device: 'MacBook Pro',
  },
  {
    id: 'm-3',
    content: '周末在家看书，推荐《深入理解 TypeScript》。',
    images: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80'],
    date: '2026-03-28T14:20:00Z',
    likes: 8,
    isLiked: false,
  },
]
