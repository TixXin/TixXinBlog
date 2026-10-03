/** @file 20261003190721_add_image_prompts.ts @description 新增图片提示词及媒体引用，回退应用时保留已保存内容。 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20261003190721_add_image_prompts extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "image_prompt" ("id" serial primary key, "title" text not null, "description" text not null default '', "prompt" text not null, "negative_prompt" text not null default '', "model" text not null default '', "tags" jsonb not null default '[]', "media_id" uuid null, "external_image_url" text null, "image_alt" text not null default '', "source_url" text not null default '', "status" text not null default 'draft', "revision" int not null default 0, "request_id" text null, "request_hash" text null, "published_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint image_prompt_source_check check ((media_id is not null and external_image_url is null) or (media_id is null and external_image_url is not null and length(external_image_url) > 0)), constraint image_prompt_status_check check (status in ('draft', 'published')));`,
    )
    this.addSql(`create index "image_prompt_visibility_order_idx" on "image_prompt" ("status", "id");`)
    this.addSql(`alter table "image_prompt" add constraint "image_prompt_request_id_unique" unique ("request_id");`)

    this.addSql(
      `alter table "image_prompt" add constraint "image_prompt_media_id_foreign" foreign key ("media_id") references "media_asset" ("id") on update cascade on delete restrict;`,
    )

    this.addSql(`alter table "media_reference" add column "image_prompt_id" int null;`)
    this.addSql(
      `alter table "media_reference" add constraint "media_reference_image_prompt_id_foreign" foreign key ("image_prompt_id") references "image_prompt" ("id") on update cascade on delete cascade;`,
    )
  }

  override async down(): Promise<void> {
    // 拒绝回退迁移账本；旧版应用可以忽略新增表和列，但不能丢弃已保存的作品。
    throw new Error('图片提示词迁移不可逆；回退应用时请保留数据库结构和已保存内容')
  }
}
