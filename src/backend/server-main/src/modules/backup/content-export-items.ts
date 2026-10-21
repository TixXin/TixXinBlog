/**
 * @file content-export-items.ts
 * @description 导出图库、项目、友链、提示词与平台订阅等展示内容的结构映射。
 */
import type { GalleryPhoto } from '../../entities/gallery-photo.entity'
import type { GallerySettings } from '../../entities/gallery-settings.entity'
import type { Project } from '../../entities/project.entity'
import type { FriendLink } from '../../entities/friend-link.entity'
import type { LinkSettings } from '../../entities/link-settings.entity'
import type { ImagePrompt } from '../../entities/image-prompt.entity'
import type { Subscription } from '../../entities/subscription.entity'
import type { ContentPackage } from './content-package'

export function exportGalleryItems(
  gallery: GalleryPhoto[],
  gallerySettings: GallerySettings,
): { gallery: ContentPackage['gallery']; gallerySettings: ContentPackage['gallerySettings'] } {
  return {
    gallery: gallery.map((photo) => ({
      sourceId: photo.id,
      createdAt: photo.createdAt.toISOString(),
      publishedAt: photo.publishedAt?.toISOString() ?? null,
      deleted: !!photo.deletedAt,
      values: {
        mediaId: photo.media?.id ?? null,
        relatedContent: photo.relatedContent ?? [],
        externalUrl: photo.externalUrl ?? null,
        title: photo.title,
        description: photo.description,
        category: photo.category,
        takenOn: photo.takenOn ?? null,
        location: photo.location,
        device: photo.device,
        status: photo.status,
        sortOrder: photo.sortOrder,
      },
    })),
    gallerySettings: { gear: gallerySettings.gear },
  }
}

export function exportProjectItems(projects: Project[]): ContentPackage['projects'] {
  return projects.map((project) => ({
    sourceId: project.id,
    createdAt: project.createdAt.toISOString(),
    publishedAt: project.publishedAt?.toISOString() ?? null,
    deleted: !!project.deletedAt,
    values: {
      title: project.title,
      relatedContent: project.relatedContent ?? [],
      description: project.description,
      coverMediaId: project.coverMedia?.id ?? null,
      tags: project.tags,
      links: project.links,
      progress: project.progress,
      status: project.status,
      sortOrder: project.sortOrder,
    },
  }))
}

export function exportLinkItems(
  links: FriendLink[],
  linkSettings: LinkSettings,
): { links: ContentPackage['links']; linkSettings: ContentPackage['linkSettings'] } {
  return {
    links: links.map((link) => ({
      sourceId: link.id,
      createdAt: link.createdAt.toISOString(),
      publishedAt: link.publishedAt?.toISOString() ?? null,
      deleted: !!link.deletedAt,
      values: {
        name: link.name,
        description: link.description,
        url: link.url,
        logoMediaId: link.logoMedia?.id ?? null,
        logoUrl: link.logoUrl ?? null,
        status: link.status,
        isFeatured: link.isFeatured,
        sortOrder: link.sortOrder,
      },
    })),
    linkSettings: { rules: linkSettings.rules },
  }
}

export function exportPromptItems(prompts: ImagePrompt[]): ContentPackage['prompts'] {
  return prompts.map((prompt) => ({
    sourceId: prompt.id,
    createdAt: prompt.createdAt.toISOString(),
    publishedAt: prompt.publishedAt?.toISOString() ?? null,
    values: {
      title: prompt.title,
      description: prompt.description,
      prompt: prompt.prompt,
      negativePrompt: prompt.negativePrompt,
      model: prompt.model,
      tags: prompt.tags,
      mediaId: prompt.media?.id ?? null,
      externalImageUrl: prompt.externalImageUrl ?? null,
      imageAlt: prompt.imageAlt,
      sourceUrl: prompt.sourceUrl,
      status: prompt.status,
    },
  }))
}

export function exportSubscriptionItems(subscriptions: Subscription[]): ContentPackage['subscriptions'] {
  return subscriptions.map((subscription) => ({
    sourceId: subscription.id,
    createdAt: subscription.createdAt.toISOString(),
    publishedAt: subscription.publishedAt?.toISOString() ?? null,
    deleted: !!subscription.deletedAt,
    values: {
      name: subscription.name,
      description: subscription.description,
      url: subscription.url ?? null,
      platform: subscription.platform ?? null,
      category: subscription.category,
      currency: subscription.currency,
      amount: subscription.amount,
      billingCycle: subscription.billingCycle,
      startDate: subscription.startDate ?? null,
      nextBillingDate: subscription.nextBillingDate ?? null,
      subscriptionStatus: subscription.subscriptionStatus,
      notes: subscription.notes,
      iconMediaId: subscription.iconMedia?.id ?? null,
      // favicon 是可再生缓存，仅保存官网域名，不把缓存冒充正式媒体。
      faviconDomain: subscription.faviconDomain ?? null,
      priceHistory: subscription.priceHistory,
      status: subscription.status,
      sortOrder: subscription.sortOrder,
    },
  }))
}
