/**
 * @file index.ts
 * @description 后端中英字典汇总：每个域一个文件，key 以域名开头，合并后的 key 不得重复（由单测校验）
 * @author TixXin
 * @since 2026-10-19
 */
import { commonMessages } from './common.messages'
import { authMessages } from './auth.messages'
import { postMessages } from './post.messages'
import { commentMessages } from './comment.messages'
import { flashMessages } from './flash.messages'
import { momentMessages } from './moment.messages'
import { guestbookMessages } from './guestbook.messages'
import { galleryMessages } from './gallery.messages'
import { projectMessages } from './project.messages'
import { linkMessages } from './link.messages'
import { promptMessages } from './prompt.messages'
import { subscriptionMessages } from './subscription.messages'
import { mediaMessages } from './media.messages'
import { siteMessages } from './site.messages'
import { backupMessages } from './backup.messages'
import { packageMessages } from './package.messages'
import { operationsMessages } from './operations.messages'
import { auditMessages } from './audit.messages'
import { setupMessages } from './setup.messages'

/** 各域字典；单测据此检查 key 前缀与跨域重复 */
export const MESSAGE_TABLES = {
  common: commonMessages,
  auth: authMessages,
  post: postMessages,
  comment: commentMessages,
  flash: flashMessages,
  moment: momentMessages,
  guestbook: guestbookMessages,
  gallery: galleryMessages,
  project: projectMessages,
  link: linkMessages,
  prompt: promptMessages,
  subscription: subscriptionMessages,
  media: mediaMessages,
  site: siteMessages,
  backup: backupMessages,
  package: packageMessages,
  operations: operationsMessages,
  audit: auditMessages,
  setup: setupMessages,
} as const

export const MESSAGES = {
  ...commonMessages,
  ...authMessages,
  ...postMessages,
  ...commentMessages,
  ...flashMessages,
  ...momentMessages,
  ...guestbookMessages,
  ...galleryMessages,
  ...projectMessages,
  ...linkMessages,
  ...promptMessages,
  ...subscriptionMessages,
  ...mediaMessages,
  ...siteMessages,
  ...backupMessages,
  ...packageMessages,
  ...operationsMessages,
  ...auditMessages,
  ...setupMessages,
}
