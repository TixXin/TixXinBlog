/**
 * @file 20260907170000_add_comment_moderation.ts
 * @description 保留已有评论公开状态与计数，增加审核版本和默认关闭的先审后发策略。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260907170000_add_comment_moderation extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table comment add column status text not null default 'published', add column revision int not null default 0, add column moderated_at timestamptz null;`,
    )
    this.addSql('create index comment_status_index on comment (status);')
    this.addSql(
      'create table comment_policy (id text not null, require_approval boolean not null default false, revision int not null default 0, updated_at timestamptz not null, constraint comment_policy_pkey primary key (id));',
    )
    this.addSql(
      "insert into comment_policy (id, require_approval, revision, updated_at) values ('default', false, 0, now());",
    )
  }
  override async down(): Promise<void> {
    this.addSql('drop table comment_policy;')
    this.addSql('drop index comment_status_index;')
    this.addSql('alter table comment drop column status, drop column revision, drop column moderated_at;')
  }
}
