/**
 * @file post-snapshot.ts
 * @description 编辑与修订共用的内容快照和旧正文转换。
 */
import type { Post, PostContentSection } from '../../entities/post.entity'
import type { PostSnapshot } from '../../entities/post-revision.entity'

export function legacyMarkdown(sections: PostContentSection[] = []): string {
  return sections
    .map((section) => {
      if (section.type === 'heading') return `${'#'.repeat(section.level ?? 2)} ${section.text ?? ''}`
      if (section.type === 'code') return `\`\`\`${section.language ?? ''}\n${section.text ?? ''}\n\`\`\``
      if (section.type === 'quote') return `> ${section.text ?? ''}`
      if (section.type === 'list') return (section.items ?? []).map((item) => `- ${item}`).join('\n')
      return section.text ?? ''
    })
    .join('\n\n')
}

export function postSnapshot(post: Post): PostSnapshot {
  return {
    relatedContent: (post.relatedContent ?? []).map((item) => ({ ...item })),
    slug: post.slug ?? '',
    coverAlt: post.coverAlt ?? '',
    seoTitle: post.seoTitle ?? '',
    seoDescription: post.seoDescription ?? '',
    seoNoindex: post.seoNoindex,
    title: post.title,
    summary: post.summary,
    cover: post.cover ?? '',
    folder: post.folder,
    category: post.category,
    contentRaw: post.contentRaw ?? legacyMarkdown(post.contentSections),
    contentSections: post.contentSections,
    readTimeMinutes: post.readTimeMinutes,
    status: post.status,
    pinned: post.pinned,
    tags: post.tags.getItems().map((tag) => tag.label),
  }
}
