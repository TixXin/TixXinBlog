/** @file 20260910135819_add_projects.ts @description 增加独立项目业务和封面引用，不修改既有内容与媒体 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20260910135819_add_projects extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "project" ("id" serial primary key, "title" text not null, "description" text not null default '', "cover_media_id" uuid null, "tags" jsonb not null default '[]', "links" jsonb not null default '[]', "progress" text not null default 'dev', "status" text not null default 'draft', "sort_order" int not null default 0, "revision" int not null default 0, "request_id" text null, "request_hash" text null, "published_at" timestamptz null, "deleted_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`,
    )
    this.addSql(
      `create index "project_visibility_order_idx" on "project" ("status", "deleted_at", "sort_order", "id");`,
    )
    this.addSql(`alter table "project" add constraint "project_request_id_unique" unique ("request_id");`)

    this.addSql(
      `alter table "project" add constraint "project_cover_media_id_foreign" foreign key ("cover_media_id") references "media_asset" ("id") on update cascade on delete restrict;`,
    )

    this.addSql(`alter table "media_reference" add column "project_id" int null;`)
    this.addSql(
      `alter table "media_reference" add constraint "media_reference_project_id_foreign" foreign key ("project_id") references "project" ("id") on update cascade on delete cascade;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "media_reference" drop constraint "media_reference_project_id_foreign";`)

    this.addSql(`drop table "project";`)

    this.addSql(`alter table "media_reference" drop column "project_id";`)
  }
}
