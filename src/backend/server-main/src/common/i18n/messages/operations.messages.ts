/**
 * @file operations.messages.ts
 * @description 运维任务与通知的中英文案
 * @author TixXin
 * @since 2026-10-19
 */
import { ErrorCode } from '../../constants/error-codes'
import { defineMessages } from './types'

export const operationsMessages = defineMessages({
  'operations.taskNotFound': {
    zh: '任务不存在或记录已清理',
    en: 'The task does not exist or its record has been cleaned up',
  },
  'operations.retryNotAcknowledged': {
    zh: '请核对任务实际结果后明确选择重试',
    en: 'Check the actual task result, then explicitly choose to retry.',
  },
  'operations.configUnavailable': {
    zh: '运行配置不可用，请核对迁移',
    en: 'The operations configuration is unavailable. Check the migrations.',
  },
  'operations.taskStateChanged': {
    zh: '任务状态已变化，请刷新后核对',
    en: 'The task status has changed. Refresh and check again.',
    code: ErrorCode.RevisionConflict,
  },
  'operations.channelPaused': {
    zh: '通道当前暂停，请先按运行说明显式启用',
    en: 'This channel is paused. Enable it explicitly as described in the operations guide first.',
  },
  'operations.notificationNotFoundOrRemoved': {
    zh: '通知不存在或记录已移除',
    en: 'The notification does not exist or has been removed',
  },
  'operations.notificationNotFound': { zh: '通知不存在', en: 'Notification not found' },
})
