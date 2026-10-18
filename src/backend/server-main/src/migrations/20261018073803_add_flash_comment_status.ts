/** @file 20261018073803_add_flash_comment_status.ts @description 闪念评论新增审核状态，存量评论按默认值迁移为已发布；不回退 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20261018073803_add_flash_comment_status extends Migration {
  override async up(): Promise<void> {
    // 带常量默认值的新增列在 PostgreSQL 中直接为存量行填入 published，不重写评论内容。
    this.addSql(`alter table "flash_comment" add column "status" text not null default 'published';`)
    this.addSql(
      `create index "flash_comment_flash_note_id_status_created_at_index" on "flash_comment" ("flash_note_id", "status", "created_at");`,
    )
  }
  override async down(): Promise<void> {
    // 删除状态列会让待审与隐藏评论重新公开，因此不提供自动回退。
    throw new Error('闪念评论审核状态迁移不可逆；回退应用时保留状态列，避免待审或隐藏评论被公开')
  }
}
