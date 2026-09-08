/**
 * @file 20260907230000_add_content_imports.ts
 * @description 保存导入预览和结果；完成或过期后清除临时包内容，保留操作摘要。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260907230000_add_content_imports extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table "content_import" ("id" uuid not null, "actor_id" uuid not null, "session_version" int not null, "strategy" text not null, "include_settings" boolean not null, "file_hash" text not null, "payload" jsonb null, "plan" jsonb not null, "created_at" timestamptz not null, "expires_at" timestamptz not null, "started_at" timestamptz null, "completed_at" timestamptz null, "result" jsonb null, "last_error" text null, constraint "content_import_pkey" primary key ("id"));',
    )
    this.addSql('create index content_import_actor_id_index on content_import (actor_id);')
    this.addSql('create index content_import_expires_at_index on content_import (expires_at);')
  }
  override async down(): Promise<void> {
    this.addSql('drop table content_import;')
  }
}
