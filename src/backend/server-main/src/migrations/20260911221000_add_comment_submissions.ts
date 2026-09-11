/** @file 20260911221000_add_comment_submissions.ts @description 新评论客户端提交去重凭据，删除内容后保留去重结果 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260911221000_add_comment_submissions extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table comment_submission (id text primary key, request_hash text not null, comment_id int null, created_at timestamptz not null);`,
    )
    this.addSql(
      `alter table comment_submission add constraint comment_submission_comment_id_foreign foreign key (comment_id) references comment (id) on update cascade on delete set null;`,
    )
  }
  override async down(): Promise<void> {
    throw new Error('删除提交凭据会失去去重保护，请使用向前修复或隔离恢复')
  }
}
