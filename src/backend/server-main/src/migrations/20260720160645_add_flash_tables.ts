/**
 * @file 20260720160645_add_flash_tables.ts
 * @description 创建闪念、点赞及评论表。
 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20260720160645_add_flash_tables extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create type "flash_type" as enum ('idea', 'todo', 'memo');`)
    this.addSql(
      `create table "flash_note" ("id" text not null, "user_id" text not null, "content" text not null, "tags" jsonb not null, "images" jsonb not null, "type" "flash_type" not null default 'memo', "likes" int not null default 0, "is_pinned" boolean not null default false, "is_archived" boolean not null default false, "is_draft" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "flash_note_pkey" primary key ("id"));`,
    )
    this.addSql(`create index "flash_note_user_id_index" on "flash_note" ("user_id");`)
    this.addSql(`create index "flash_note_is_archived_index" on "flash_note" ("is_archived");`)
    this.addSql(`create index "flash_note_created_at_index" on "flash_note" ("created_at");`)

    this.addSql(
      `create table "flash_like" ("id" serial primary key, "flash_note_id" text not null, "visitor_id_hash" text not null, "created_at" timestamptz not null);`,
    )
    this.addSql(
      `alter table "flash_like" add constraint "flash_like_flash_note_id_visitor_id_hash_unique" unique ("flash_note_id", "visitor_id_hash");`,
    )

    this.addSql(
      `create table "flash_comment" ("id" text not null, "flash_note_id" text not null, "author_id" text not null, "author_name" text not null, "author_avatar" text not null, "content" text not null, "created_at" timestamptz not null, constraint "flash_comment_pkey" primary key ("id"));`,
    )
    this.addSql(`create index "flash_comment_flash_note_id_index" on "flash_comment" ("flash_note_id");`)

    this.addSql(
      `alter table "flash_like" add constraint "flash_like_flash_note_id_foreign" foreign key ("flash_note_id") references "flash_note" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table "flash_comment" add constraint "flash_comment_flash_note_id_foreign" foreign key ("flash_note_id") references "flash_note" ("id") on update cascade on delete cascade;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "flash_like" drop constraint "flash_like_flash_note_id_foreign";`)

    this.addSql(`alter table "flash_comment" drop constraint "flash_comment_flash_note_id_foreign";`)

    this.addSql(`drop table if exists "flash_note" cascade;`)

    this.addSql(`drop table if exists "flash_like" cascade;`)

    this.addSql(`drop table if exists "flash_comment" cascade;`)

    this.addSql(`drop type "flash_type";`)
  }
}
